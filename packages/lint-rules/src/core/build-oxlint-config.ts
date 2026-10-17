import { type Catalog, isOxlintRoute, type OxlintRoute, routeOf } from '@workspace/rule-data'
import type { DummyRule, DummyRuleMap, OxlintConfig, OxlintEnv, OxlintGlobals, OxlintOverride, RuleCategories } from 'oxlint'
import { TS_FILES } from './eslint-file-types.ts'
import { bothOf, EVERY_FILE, type FilesCondition, filesInScopeOf } from './file-conditions.ts'
import { type FrameworkEnv, OTHER_FRAMEWORK_ENVS, SVELTE_COMPONENT_GLOBALS, SVELTE_RUNES, TEST_RUNNER_GLOBALS } from './framework-globals.ts'
import type { LintRulesInput } from './lint-rules-input.ts'
import { overrideFilesOf } from './oxlint-override-files.ts'
import {
  type EnvChanges,
  type FileOverrideLayer,
  type RuleLayers,
  type RuleSetting,
  type RuleSettings,
  ruleEntryOf,
  ruleSettingsOfEveryLayer,
  suppressionRulesOf,
  tsFileRulesOf,
} from './resolve-rule-layers.ts'
import { agentBuildLayersOf } from './twin-pairs.ts'

export type OxlintPlugin = NonNullable<OxlintConfig['plugins']>[number]

type OxlintSetting = { readonly route: OxlintRoute; readonly setting: RuleSetting }

type IgnoringSetting = OxlintSetting & { readonly setting: { readonly ignores: readonly string[] } }

type OffInItsFiles = OxlintSetting & { readonly setting: { readonly files: readonly string[] } }

// Categories would switch on rules outside the catalog, so every one is off and each rule is named.
const EVERY_CATEGORY_OFF = {
  correctness: 'off',
  nursery: 'off',
  pedantic: 'off',
  perf: 'off',
  restriction: 'off',
  style: 'off',
  suspicious: 'off',
} as const satisfies Required<RuleCategories>

const BUILTIN_ENV = { builtin: true, es2024: true } as const satisfies OxlintEnv

// Read-only, as both engines' envs give every other framework global (oxlint 1.87, globals 17.13).
const READ_ONLY: NonNullable<OxlintGlobals[string]> = 'readonly'

// Whatever rulesets are listed: framework and test-runner globals belong to those files, not to a ruleset.
const GLOBALS_OVERRIDES: readonly OxlintOverride[] = [
  envOverrideOf(SVELTE_RUNES),
  { files: [...SVELTE_COMPONENT_GLOBALS.files], globals: globalsReadOnly(SVELTE_COMPONENT_GLOBALS.names) },
  ...OTHER_FRAMEWORK_ENVS.map(envOverrideOf),
  { files: [...TEST_RUNNER_GLOBALS.files], env: envSwitchedTo(true, TEST_RUNNER_GLOBALS.envs) },
]

// ESLint never lints node_modules; ignoring it here too means both engines see the same files.
const BUILTIN_IGNORE_PATTERNS = ['**/node_modules/**']

const OXLINT_PLUGINS: readonly OxlintPlugin[] = [
  'eslint',
  'react',
  'unicorn',
  'typescript',
  'oxc',
  'import',
  'jsdoc',
  'jest',
  'vitest',
  'jsx-a11y',
  'nextjs',
  'react-perf',
  'promise',
  'node',
  'vue',
]

/** No `extends`: oxlint's `extends` drops `ignorePatterns`, `env` and `globals`. */
export function buildOxlintConfig(lintRules: LintRulesInput, catalog: Catalog): OxlintConfig {
  const layers = agentBuildLayersOf(lintRules, catalog)
  return {
    categories: { ...EVERY_CATEGORY_OFF },
    plugins: oxlintPluginsOf(ruleSettingsOfEveryLayer(layers), catalog),
    env: oxlintEnvOf(layers),
    ignorePatterns: oxlintIgnorePatternsOf(layers),
    options: { reportUnusedDisableDirectives: 'off' },
    rules: topLevelRuleMap(layers, catalog),
    overrides: oxlintOverridesOf(layers, catalog),
  }
}

export function oxlintEnvOf(layers: RuleLayers): OxlintEnv {
  return { ...BUILTIN_ENV, ...envSwitchedTo(true, layers.env) }
}

export function oxlintIgnorePatternsOf(layers: RuleLayers): string[] {
  return [...BUILTIN_IGNORE_PATTERNS, ...layers.ignores]
}

export function topLevelRuleMap(layers: RuleLayers, catalog: Catalog): DummyRuleMap {
  return oxlintRuleMap(oxlintSettingsOf(layers.rules, catalog))
}

/** Framework and test-runner globals, each rule off under its own ignores, the top level's TS-file rules, then each file-override entry's. */
export function oxlintOverridesOf(layers: RuleLayers, catalog: Catalog): OxlintOverride[] {
  return [
    ...GLOBALS_OVERRIDES,
    ...oxlintSettingsOf(layers.rules, catalog).filter(hasIgnores).map(offUnderItsIgnores),
    ...tsFileOverridesOf(EVERY_FILE, tsFileRulesOf(layers), catalog),
    ...layers.fileOverrides.flatMap((layer) => fileOverrideOverrides(layer, catalog)),
  ]
}

/** oxlint silently skips a rule whose plugin is not listed, so every plugin of a rule we emit is. */
export function oxlintPluginsOf(ruleMaps: readonly RuleSettings[], catalog: Catalog): OxlintPlugin[] {
  const plugins = ruleMaps
    .flatMap((settings) => Object.keys(settings))
    .map((id) => routeOf(id, catalog))
    .filter(isOxlintRoute)
    .map((route) => toOxlintPlugin(route.oxlintPlugin))
  return sortedUnique(plugins)
}

export function toOxlintPlugin(name: string): OxlintPlugin {
  const plugin = oxlintPluginNamed(name)
  if (plugin === undefined) throw new Error(`"${name}" is not an oxlint plugin`)
  return plugin
}

export function oxlintPluginNamed(name: string): OxlintPlugin | undefined {
  return OXLINT_PLUGINS.find((candidate) => candidate === name)
}

export function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].toSorted()
}

/** Ruleset changes and suppression rules, then the entry's own rules, which win over those, then its TS files' rules. */
function fileOverrideOverrides(layer: FileOverrideLayer, catalog: Catalog): OxlintOverride[] {
  const files = [...layer.files]
  const configChanges = { ...layer.rulesetChanges, ...suppressionRulesOf(layer) }
  return [
    ...overridesSetting(files, envChangesOf(layer.env), oxlintSettingsOf(configChanges, catalog)),
    ...overridesSetting(files, {}, oxlintSettingsOf(layer.rules, catalog)),
    ...tsFileOverridesOf(filesInScopeOf(files, []), tsFileRulesOf(layer), catalog),
  ]
}

function tsFileOverridesOf(layerFiles: FilesCondition, tsFileRules: RuleSettings, catalog: Catalog): OxlintOverride[] {
  return oxlintSettingsOf(tsFileRules, catalog).flatMap(({ route, setting }) => {
    const where = bothOf(layerFiles, filesInScopeOf([TS_FILES], ignoresOf(setting)))
    return overrideFilesOf(where).map((overrideFiles): OxlintOverride => ({ ...overrideFiles, rules: { [route.oxlintName]: ruleEntryOf(setting) } }))
  })
}

/** An override has one `excludeFiles`, so each rule turned on with ignores gets its own override to stay off under them. */
function overridesSetting(files: string[], env: OxlintEnv, settings: readonly OxlintSetting[]): OxlintOverride[] {
  const onWithIgnores = settings.filter(isOnWithIgnores)
  const offInSomeFiles = settings.filter(isOffInItsFiles)
  const throughout = settings.filter((setting) => !isOnWithIgnores(setting) && !isOffInItsFiles(setting))
  return [
    ...overrideIfNotEmpty(files, env, oxlintRuleMap(throughout)),
    ...onWithIgnores.map((setting) => onExcludingItsIgnores(files, setting)),
    ...offInSomeFiles.flatMap((setting) => offInItsFilesOf(files, setting)),
  ]
}

function offInItsFilesOf(files: string[], { route, setting }: OffInItsFiles): OxlintOverride[] {
  const where = bothOf(filesInScopeOf(files, []), filesInScopeOf(setting.files, []))
  return overrideFilesOf(where).map((overrideFiles): OxlintOverride => ({ ...overrideFiles, rules: { [route.oxlintName]: 'off' } }))
}

function offUnderItsIgnores({ route, setting }: IgnoringSetting): OxlintOverride {
  return { files: [...setting.ignores], rules: { [route.oxlintName]: 'off' } }
}

function onExcludingItsIgnores(files: string[], { route, setting }: IgnoringSetting): OxlintOverride {
  return { files, excludeFiles: [...setting.ignores], rules: { [route.oxlintName]: ruleEntryOf(setting) } }
}

function overrideIfNotEmpty(files: string[], env: OxlintEnv, rules: DummyRuleMap): OxlintOverride[] {
  const hasEnv = Object.keys(env).length > 0
  const hasRules = Object.keys(rules).length > 0
  if (!hasEnv && !hasRules) return []
  return [{ files, ...(hasEnv ? { env } : {}), ...(hasRules ? { rules } : {}) }]
}

function envChangesOf({ enabled, disabled }: EnvChanges): OxlintEnv {
  return { ...envSwitchedTo(false, disabled), ...envSwitchedTo(true, enabled) }
}

function envSwitchedTo(on: boolean, envs: readonly string[]): OxlintEnv {
  return Object.fromEntries(envs.map((env): [string, boolean] => [env, on]))
}

function envOverrideOf({ files, env }: FrameworkEnv): OxlintOverride {
  return { files: [...files], env: envSwitchedTo(true, [env]) }
}

function globalsReadOnly(names: readonly string[]): OxlintGlobals {
  return Object.fromEntries(names.map((name) => [name, READ_ONLY]))
}

function oxlintSettingsOf(settings: RuleSettings, catalog: Catalog): OxlintSetting[] {
  return Object.entries(settings).flatMap(([id, setting]): OxlintSetting[] => {
    const route = routeOf(id, catalog)
    if (!isOxlintRoute(route)) return []
    // The catalog routes every rule shipped with files of its own to ESLint, so only an off is written here.
    if (setting.severity !== 'off' && setting.files !== null) {
      throw new Error(`${id}: turned on in files of its own, so the catalog must route it to ESLint`)
    }
    return [{ route, setting }]
  })
}

function oxlintRuleMap(settings: readonly OxlintSetting[]): DummyRuleMap {
  return Object.fromEntries(
    settings.map(({ route, setting }): [string, DummyRule] => [route.oxlintName, ruleEntryOf(setting)]),
  )
}

function ignoresOf({ ignores }: RuleSetting): readonly string[] {
  return ignores === null ? [] : ignores
}

function hasIgnores(oxlintSetting: OxlintSetting): oxlintSetting is IgnoringSetting {
  return oxlintSetting.setting.ignores !== null
}

function isOnWithIgnores(oxlintSetting: OxlintSetting): oxlintSetting is IgnoringSetting {
  return oxlintSetting.setting.severity !== 'off' && hasIgnores(oxlintSetting)
}

function isOffInItsFiles(oxlintSetting: OxlintSetting): oxlintSetting is OffInItsFiles {
  return oxlintSetting.setting.severity === 'off' && oxlintSetting.setting.files !== null
}
