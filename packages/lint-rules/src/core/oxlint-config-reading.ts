import { type Catalog, type OxlintCategory, type OxlintRule, routeOf, ruleIdsOxlintRunsTypeAware } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { pluginPrefixOf, ruleNameOf } from '@workspace/rule-data/rule-id-parts'
import type { AllowWarnDeny, DummyRuleMap, ExternalPluginEntry, OxlintConfig, OxlintOverride, RuleCategories } from 'oxlint'
import { type OxlintPlugin, oxlintPluginNamed, sortedUnique, toOxlintPlugin } from './build-oxlint-config.ts'
import { ruleIdsNamedInEslint } from './catalog-lookups.ts'
import { namedGroupsOf } from './named-groups.ts'
import type { OverrideFiles } from './oxlint-override-files.ts'

// How oxlint 1.87 resolves a config (crates/oxc_linter/src/config), checked by merge-oxlint-config.differential.integration.test.ts:
// - An extended config merges in: `plugins` lists unite, and one left out adds oxlint's default plugins.
// - A root or override statement applies only for a plugin listed at the root or in that override; oxlint skips the rest.
// - A rule key is `prefix/name`, or a bare name meaning the first rule so named; an unknown prefix is a JS plugin's.

/** An object in a TS config, a path in a JSON one. */
type ExtendedConfig = OxlintConfig | string

export type RuleEntry = DummyRuleMap[string]

export type OxlintRulesBySpelling = ReadonlyMap<string, OxlintRule>

/** Categories the team's config leaves out stay at oxlint's default. */
export type CategorySeverities = Readonly<Partial<Record<OxlintCategory, AllowWarnDeny>>>

/** oxlint's `eslint` plugin is left out of `plugins`: it always runs. */
export type Listing = { readonly where: OverrideFiles; readonly plugins: ReadonlySet<OxlintPlugin> }

/** What oxlint makes of the team's config, through every config it extends as an object. */
export type TeamResolution = {
  /** oxlint's `eslint` plugin aside: it always runs. */
  readonly rootPlugins: ReadonlySet<OxlintPlugin>
  readonly categories: CategorySeverities
  /** In the order oxlint applies them. */
  readonly listings: readonly Listing[]
  readonly rulesStatedAtARoot: readonly OxlintRule[]
}

type PrefixedRuleKey = { readonly prefix: string; readonly ruleName: string }

// What oxlint runs when a config leaves `plugins` out (LintPlugins::default, plugins.rs).
const OXLINT_DEFAULT_PLUGINS: readonly OxlintPlugin[] = ['oxc', 'typescript', 'unicorn']

// oxlint runs its eslint scope whatever `plugins` lists, an empty list included.
export const ALWAYS_RUN: OxlintPlugin = 'eslint'

// oxlint's own default; a rule only this default runs is not one the team sets.
const DEFAULT_CATEGORIES: CategorySeverities = { correctness: 'warn' }

// The other names oxlint takes a plugin by (LintPlugins::try_from). A JSON config is not typed to them.
const PLUGIN_ALIASES: ReadonlyMap<string, OxlintPlugin> = new Map([
  ['react-hooks', 'react'],
  ['react_hooks', 'react'],
  ['typescript-eslint', 'typescript'],
  ['typescript_eslint', 'typescript'],
  ['@typescript-eslint', 'typescript'],
  ['deepscan', 'oxc'],
  ['import-x', 'import'],
  ['jsx_a11y', 'jsx-a11y'],
  ['jsx-a11y-x', 'jsx-a11y'],
  ['jsx_a11y-x', 'jsx-a11y'],
  ['react_perf', 'react-perf'],
])

// oxlint also finds a plugin by its package's name: `eslint-plugin-x` names `x`, `@scope/eslint-plugin` names `@scope`.
const SCOPE_SEPARATOR = '/'
const PLUGIN_PACKAGE_NAME = /^(?<scope>@[^/]+)\/(?:eslint|oxlint)-plugin(?:-(?<scopedName>.+))?$|^(?:eslint|oxlint)-plugin-(?<name>.+)$/u

// In a rule key oxlint also reads these prefixes as nextjs (unalias_plugin_name, rules.rs).
const NEXTJS_RULE_PREFIXES: ReadonlySet<string> = new Set(['@next', '@next/next'])
const NEXTJS: OxlintPlugin = 'nextjs'

// A JS plugin named by a path takes its prefix from the plugin it loads, which no reading of the config gives.
const PATH_STARTS: readonly string[] = ['.', '/']

// oxlint's rule order by plugin: a bare key names the first rule so named (measured, 1.87: a bare
// `no-namespace` is import's, `prefer-includes` typescript's).
const OXLINT_PLUGINS_IN_RULE_ORDER: readonly OxlintPlugin[] = [
  'eslint',
  'import',
  'jest',
  'jsdoc',
  'jsx-a11y',
  'nextjs',
  'node',
  'oxc',
  'promise',
  'react',
  'react-perf',
  'typescript',
  'unicorn',
  'vitest',
  'vue',
]

const OFF_SEVERITIES: ReadonlySet<unknown> = new Set(['off', 'allow', 0])

/** Every rule the team's oxlint config sets, sorted: by a statement anywhere, by a category it writes on (nursery included, measured 1.87), or by a key under a JS plugin it names. oxlint's own default `correctness: warn` sets none. */
export function ruleIdsTheTeamsOxlintConfigSets(theirs: Readonly<OxlintConfig>, catalog: Readonly<Catalog>): string[] {
  const bySpelling = oxlintRulesBySpelling(catalog)
  const team = teamResolutionOf(theirs, bySpelling)
  const configs = configsInOxlintOrder(theirs)
  const rulesItsStatementsOrCategoriesSet = [
    ...rulesItsStatementsSet(configs, bySpelling),
    ...rulesItsCategoriesRun(resolvedCategoriesOf(theirs), team, runsTypeAwareRules(theirs), catalog),
  ]
  return sortedUnique([...rulesItsStatementsOrCategoriesSet.map(({ id }) => id), ...ruleIdsKeyedUnderItsJsPlugins(configs, catalog)])
}

/** At any severity, at a root or in an override, including a statement oxlint skips as its plugin is listed neither there nor at the root (owner 2026-10-22). */
function rulesItsStatementsSet(configs: readonly OxlintConfig[], bySpelling: OxlintRulesBySpelling): OxlintRule[] {
  return [...configs, ...overridesIn(configs)].flatMap((statingRules) => rulesKeyedIn(rulesOf(statingRules), bySpelling))
}

function rulesKeyedIn(rules: Readonly<DummyRuleMap>, bySpelling: OxlintRulesBySpelling): OxlintRule[] {
  return Object.keys(rules).flatMap((key) => oxlintRulesKeyed(key, bySpelling))
}

function pluginsAppliedAtTheRoot({ rootPlugins }: TeamResolution): ReadonlySet<OxlintPlugin> {
  return new Set([ALWAYS_RUN, ...rootPlugins])
}

/** The plugins whose statements oxlint applies in the override. */
export function pluginsAppliedIn(override: Readonly<OxlintOverride>, team: TeamResolution): ReadonlySet<OxlintPlugin> {
  return new Set([...pluginsAppliedAtTheRoot(team), ...pluginsListedBy(override)])
}

/** A type-aware rule counts only where the config's options turn those on. */
function rulesItsCategoriesRun(written: CategorySeverities, team: TeamResolution, areTypeAwareRulesRun: boolean, catalog: Readonly<Catalog>): OxlintRule[] {
  const listedAnywhere = pluginsListedAnywhere(team)
  return catalog.oxlintRules
    .filter((rule) => isOn(categorySeverityOf(rule, written)))
    .filter((rule) => listedAnywhere.has(pluginOf(rule)))
    .filter((rule) => areTypeAwareRulesRun || !ruleIdsOxlintRunsTypeAware.has(rule.id))
}

function pluginsListedAnywhere({ rootPlugins, listings }: TeamResolution): ReadonlySet<OxlintPlugin> {
  return new Set([ALWAYS_RUN, ...rootPlugins, ...listings.flatMap(({ plugins }) => [...plugins])])
}

/** `--type-aware` on the command line is out of its sight. */
function runsTypeAwareRules({ options }: Readonly<OxlintConfig>): boolean {
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- a team's JSON oxlint config is judged by its keys alone (oxlintConfigInJson), so "options": null reaches here, and `?.` would read it as no options where the merge stops at a TypeError (oxlint-config-reading.test.ts)
  return options !== undefined && options.typeAware === true
}

function ruleIdsKeyedUnderItsJsPlugins(configs: readonly OxlintConfig[], catalog: Readonly<Catalog>): string[] {
  const rootsAndOverrides = [...configs, ...overridesIn(configs)]
  const prefixes: ReadonlySet<string> = new Set(rootsAndOverrides.flatMap(jsPluginsNamedBy).flatMap(prefixOfJsPlugin))
  const keys = rootsAndOverrides.flatMap((statingRules) => Object.keys(rulesOf(statingRules)))
  return keys.filter((key) => isUnderAJsPluginPrefix(key, prefixes)).flatMap((key) => ruleIdsNamedInEslint(key, catalog))
}

/** oxlint reserves its own plugin names, so a JS plugin's prefix names none of them. */
function isUnderAJsPluginPrefix(key: string, prefixes: ReadonlySet<string>): boolean {
  const prefixed = prefixedRuleKeyOf(key)
  return prefixed !== null && prefixes.has(prefixed.prefix) && builtinPluginOfRulePrefix(prefixed.prefix) === undefined
}

function jsPluginsNamedBy({ jsPlugins }: Readonly<Pick<OxlintConfig, 'jsPlugins'>>): readonly ExternalPluginEntry[] {
  return jsPlugins === undefined || jsPlugins === null ? [] : jsPlugins
}

/** Its `name`, or its package's name as oxlint cuts it. */
function prefixOfJsPlugin(entry: Readonly<ExternalPluginEntry>): string[] {
  if (typeof entry !== 'string') return [entry.name]
  return PATH_STARTS.some((start) => entry.startsWith(start)) ? [] : [withoutThePackageNaming(entry)]
}

export function teamResolutionOf(theirs: Readonly<OxlintConfig>, bySpelling: OxlintRulesBySpelling): TeamResolution {
  const configs = configsInOxlintOrder(theirs)
  return {
    rootPlugins: rootPluginsOf(theirs),
    categories: { ...DEFAULT_CATEGORIES, ...resolvedCategoriesOf(theirs) },
    listings: overridesIn(configs).flatMap(listingOf),
    rulesStatedAtARoot: configs.flatMap((config) => rulesStatedAtTheRootOf(config, bySpelling)),
  }
}

/** oxlint's defaults where no config lists any. */
function rootPluginsOf(theirs: Readonly<OxlintConfig>): ReadonlySet<OxlintPlugin> {
  return new Set(listedOrDefault(resolvedPluginsOf(theirs)).filter((plugin) => plugin !== ALWAYS_RUN))
}

function rulesStatedAtTheRootOf(config: Readonly<OxlintConfig>, bySpelling: OxlintRulesBySpelling): OxlintRule[] {
  return rulesKeyedIn(rulesOf(config), bySpelling)
}

/** Merged with each config it extends, last first (Oxlintrc::merge). Undefined where none lists any. */
function resolvedPluginsOf(config: Readonly<OxlintConfig>): readonly OxlintPlugin[] | undefined {
  const own = config.plugins === undefined ? undefined : config.plugins.map(pluginNamed)
  return extendedObjectsOf(config).reduceRight<readonly OxlintPlugin[] | undefined>((merged, extended) => pluginListsMerged(merged, resolvedPluginsOf(extended)), own)
}

function pluginListsMerged(
  own: readonly OxlintPlugin[] | undefined,
  extended: readonly OxlintPlugin[] | undefined,
): readonly OxlintPlugin[] | undefined {
  if (own === undefined && extended === undefined) return undefined
  return sortedUnique([...listedOrDefault(own), ...listedOrDefault(extended)])
}

function listedOrDefault(plugins: readonly OxlintPlugin[] | undefined): readonly OxlintPlugin[] {
  return plugins === undefined ? OXLINT_DEFAULT_PLUGINS : plugins
}

/** True where neither the config nor any config it extends writes correctness. */
export function leavesCorrectnessAtOxlintsDefault(config: Readonly<OxlintConfig>): boolean {
  return resolvedCategoriesOf(config).correctness === undefined
}

/** The config's own over each config it extends, a later one over an earlier (Oxlintrc::merge). */
function resolvedCategoriesOf(config: Readonly<OxlintConfig>): RuleCategories {
  const { categories = {} } = config
  const extended = extendedObjectsOf(config)
  // A team's JSON config is judged by its keys alone, so `categories` may be null: extending nothing, it reaches its
  // readers as written, which stop at a TypeError (oxlint-config-reading.test.ts).
  if (extended.length === 0) return categories
  return { ...categoriesExtendedBy(extended), ...categories }
}

function categoriesExtendedBy(extended: readonly OxlintConfig[]): RuleCategories {
  const last = extended.at(-1)
  if (last === undefined) return {}
  return { ...categoriesExtendedBy(extended.slice(0, -1)), ...resolvedCategoriesOf(last) }
}

function listingOf(override: Readonly<OxlintOverride>): Listing[] {
  return override.plugins === undefined ? [] : [{ where: whereItApplies(override), plugins: pluginsListedBy(override) }]
}

function pluginsListedBy({ plugins = [] }: Readonly<OxlintOverride>): ReadonlySet<OxlintPlugin> {
  return new Set(plugins.map(pluginNamed).filter((plugin) => plugin !== ALWAYS_RUN))
}

function pluginNamed(name: string): OxlintPlugin {
  return foundOr(builtinPluginNamed(name), `"${name}" names no plugin of oxlint's`)
}

function builtinPluginNamed(name: string): OxlintPlugin | undefined {
  const pluginName = withoutThePackageNaming(name)
  const alias = PLUGIN_ALIASES.get(pluginName)
  return alias === undefined ? oxlintPluginNamed(pluginName) : alias
}

function builtinPluginOfRulePrefix(prefix: string): OxlintPlugin | undefined {
  return NEXTJS_RULE_PREFIXES.has(withoutThePackageNaming(prefix)) ? NEXTJS : builtinPluginNamed(prefix)
}

function withoutThePackageNaming(name: string): string {
  const match = PLUGIN_PACKAGE_NAME.exec(name)
  if (match === null) return name
  const { scope, scopedName, name: unscopedName } = namedGroupsOf(match)
  if (unscopedName !== undefined) return unscopedName
  const packageScope = foundOr(scope, `${name}: a plugin package's name matched without its scope`)
  return scopedName === undefined ? packageScope : `${packageScope}${SCOPE_SEPARATOR}${scopedName}`
}

function overridesIn(configs: readonly OxlintConfig[]): OxlintOverride[] {
  return configs.flatMap(overridesOf)
}

function overridesOf({ overrides = [] }: Readonly<OxlintConfig>): readonly OxlintOverride[] {
  return overrides
}

/** Each config it extends as an object, at any depth and in order, before the config itself. */
export function configsInOxlintOrder(config: Readonly<OxlintConfig>): OxlintConfig[] {
  return [...extendedObjectsOf(config).flatMap(configsInOxlintOrder), config]
}

function extendedObjectsOf(config: Readonly<OxlintConfig>): OxlintConfig[] {
  return extendedBy(config).filter(isAnObject)
}

export function extendedBy({ extends: extended = [] }: Readonly<OxlintConfig>): readonly ExtendedConfig[] {
  return extended
}

export function isAnObject(extended: ExtendedConfig): extended is OxlintConfig {
  return typeof extended !== 'string'
}

export function whereItApplies({ files, excludeFiles }: Readonly<OverrideFiles>): OverrideFiles {
  return { files: [...files], ...(excludeFiles !== undefined && { excludeFiles: [...excludeFiles] }) }
}

export function oxlintRulesBySpelling(catalog: Readonly<Catalog>): OxlintRulesBySpelling {
  return new Map(catalog.oxlintRules.flatMap((rule) => underEachSpelling(rule, catalog)))
}

function underEachSpelling(rule: OxlintRule, catalog: Readonly<Catalog>): Array<[string, OxlintRule]> {
  return routeOf(rule.id, catalog).oxlintSpellings.map((spelling): [string, OxlintRule] => [spelling, rule])
}

function oxlintRulesKeyed(key: string, bySpelling: OxlintRulesBySpelling): OxlintRule[] {
  const rule = oxlintRuleKeyed(key, bySpelling)
  return rule === undefined ? [] : [rule]
}

/** As oxlint's parse_rule_key reads it, whether or not the catalog spells it so. Undefined for a JS plugin's rule. */
export function oxlintRuleKeyed(key: string, bySpelling: OxlintRulesBySpelling): OxlintRule | undefined {
  const prefixed = prefixedRuleKeyOf(key)
  if (prefixed === null) return firstOxlintRuleNamed(key, bySpelling)
  const plugin = builtinPluginOfRulePrefix(prefixed.prefix)
  return plugin === undefined ? undefined : bySpelling.get(spellingUnder(plugin, prefixed.ruleName))
}

/** oxlint cuts a key where ESLint cuts a rule ID: one starting `@` at its last slash, as the scope holds one, any other at its first. */
function prefixedRuleKeyOf(key: string): PrefixedRuleKey | null {
  const prefix = pluginPrefixOf(key)
  return prefix === null ? null : { prefix, ruleName: ruleNameOf(key) }
}

function firstOxlintRuleNamed(ruleName: string, bySpelling: OxlintRulesBySpelling): OxlintRule | undefined {
  return OXLINT_PLUGINS_IN_RULE_ORDER.map((plugin) => bySpelling.get(spellingUnder(plugin, ruleName))).find(
    (rule) => rule !== undefined,
  )
}

function spellingUnder(plugin: OxlintPlugin, ruleName: string): string {
  return `${plugin}${SCOPE_SEPARATOR}${ruleName}`
}

/** Every key the merge writes is a spelling oxlint has, so a miss throws. */
export function oxlintRuleSpelled(spelling: string, bySpelling: OxlintRulesBySpelling): OxlintRule {
  return foundOr(bySpelling.get(spelling), `${spelling}: no rule oxlint has is spelled so`)
}

/** The catalog records oxlint's own plugin name for each rule. */
export function pluginOf({ oxlintPlugin }: OxlintRule): OxlintPlugin {
  return toOxlintPlugin(oxlintPlugin)
}

export function categorySeverityOf({ category }: OxlintRule, categories: CategorySeverities): AllowWarnDeny | undefined {
  return categories[category]
}

export function isOn(severity: RuleEntry | undefined): severity is RuleEntry {
  return severity !== undefined && !OFF_SEVERITIES.has(Array.isArray(severity) ? severity[0] : severity)
}

export function rulesOf({ rules = {} }: Readonly<Pick<OxlintOverride, 'rules'>>): DummyRuleMap {
  return rules
}
