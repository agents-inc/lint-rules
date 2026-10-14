import { type Catalog, type OxlintCategory, type OxlintRule, ruleIdsOxlintRunsTypeAware } from '@workspace/rule-data'
import type { AllowWarnDeny, DummyRuleMap, ExternalPluginEntry, OxlintConfig, OxlintOverride, RuleCategories } from 'oxlint'
import { type OxlintPlugin, oxlintPluginNamed, sortedUnique, toOxlintPlugin } from './build-oxlint-config.ts'
import { routeOf, ruleIdsNamedInEslint } from './catalog-lookups.ts'
import type { OverrideFiles } from './oxlint-override-files.ts'

// How oxlint 1.87 resolves a config, read from its source (oxc tag oxlint_v1.87.0,
// crates/oxc_linter/src/config: config_builder.rs, config_store.rs, oxlintrc.rs, rules.rs) and
// checked against its CLI by merge-oxlint-config.differential.integration.test.ts:
// - A config extended as an object merges into the one extending it: two `plugins` lists unite,
//   and a config leaving `plugins` out adds oxlint's default plugins to the other's list.
// - The root runs its plugins' rules as `categories` (correctness warn unless given) and its rule
//   statements say; a statement of a rule whose plugin the root does not list is ignored.
// - An override's statement counts only for a plugin listed at the root or in that override.
// - A rule key names the rule parse_rule_key reads in it (rules.rs): a prefix, any name oxlint takes
//   for one of its plugins, and a rule name; or a rule name alone, the first rule so named. A key
//   whose prefix names no plugin of oxlint's is a JS plugin's rule, which no plugin listing touches.
// Both merges read a team's oxlint config through this module, so both find the same rules set in it.

/** A config `extends` names: an object in a TS config, a path in a JSON one, whatever oxlint's types say. */
type ExtendedConfig = OxlintConfig | string

/** One entry of a rule map: a severity, or a severity and options. */
export type RuleEntry = DummyRuleMap[string]

/** Each oxlint rule by each of its catalog spellings. */
export type OxlintRulesBySpelling = ReadonlyMap<string, OxlintRule>

/** A severity for each category, the ones the team's config leaves out at oxlint's default. */
export type CategorySeverities = Readonly<Partial<Record<OxlintCategory, AllowWarnDeny>>>

/** One of the team's overrides that lists plugins, and the plugins it lists, eslint aside. */
export type Listing = { readonly where: OverrideFiles; readonly plugins: ReadonlySet<OxlintPlugin> }

/** What oxlint makes of the team's config, seen through every config it extends as an object. */
export type TeamResolution = {
  /** The plugins its root lists, extended configs included; eslint, which always runs, aside. */
  readonly rootPlugins: ReadonlySet<OxlintPlugin>
  readonly categories: CategorySeverities
  /** Its overrides listing plugins, in the order oxlint applies them. */
  readonly listings: readonly Listing[]
  /** Each rule a root rule map of its config, or of a config it extends, states. */
  readonly rulesStatedAtARoot: readonly OxlintRule[]
}

/** A rule key cut where oxlint cuts it: the plugin prefix, and the rule's name under it. */
type PrefixedRuleKey = { readonly prefix: string; readonly ruleName: string }

// What oxlint runs when a config leaves `plugins` out (LintPlugins::default, plugins.rs).
const OXLINT_DEFAULT_PLUGINS: readonly OxlintPlugin[] = ['oxc', 'typescript', 'unicorn']

// oxlint runs its eslint scope whatever `plugins` lists, an empty list included.
export const ALWAYS_RUN: OxlintPlugin = 'eslint'

// oxlint's root categories, before a config's own: correctness warns unless the config says otherwise.
// A rule this default runs is not one the team sets: only a category its config writes sets rules
// (decisions.md, "Owner 2026-10-14 (questions on the merge rework spec", point 1).
const DEFAULT_CATEGORIES: CategorySeverities = { correctness: 'warn' }

// The other names oxlint takes a plugin by (LintPlugins::try_from, plugins.rs). TS configs are typed
// to the names themselves; a JSON config is not.
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

// oxlint also finds a plugin by its package's name (normalize_plugin_name, plugins.rs): `eslint-plugin-x`
// names `x`, `@scope/eslint-plugin-x` names `@scope/x`, and `@scope/eslint-plugin` names `@scope`.
const SCOPE_SEPARATOR = '/'
const PLUGIN_PACKAGE_NAME = /^(?<scope>@[^/]+)\/(?:eslint|oxlint)-plugin(?:-(?<scopedName>.+))?$|^(?:eslint|oxlint)-plugin-(?<name>.+)$/u

// In a rule key, the prefixes oxlint reads as nextjs's beside the names its `plugins` takes
// (unalias_plugin_name, rules.rs).
const NEXTJS_RULE_PREFIXES: ReadonlySet<string> = new Set(['@next', '@next/next'])
const NEXTJS: OxlintPlugin = 'nextjs'

// oxlint cuts a key starting so at its last slash, as the scope holds one, and any other at its first.
const SCOPED_KEY_START = '@'
const NO_SLASH = -1

// A JS plugin named by a path takes its prefix from the plugin it loads, which no reading of the config gives.
const PATH_STARTS: readonly string[] = ['.', '/']

// The order oxlint keeps its rules in (RULES), by plugin: a key with no prefix names the first rule
// so named (parse_rule_key, rules.rs). Measured, oxlint 1.87: `oxlint --rules` lists its plugins in
// this order, a bare `no-namespace` is import's rule over react's and typescript's, and a bare
// `prefer-includes` typescript's over unicorn's.
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

/**
 * The RuleId of every rule the team's oxlint config sets, as the installed oxlint resolves it, once
 * each and sorted (spec-merge-model.md, 1.2): each one a statement anywhere in it or in a config it
 * extends sets, at any severity, where oxlint counts the statement; each one a category it writes on
 * runs, of a plugin it lists anywhere, nursery rules included (measured, oxlint 1.87: `nursery:
 * 'warn'` runs no-unreachable-loop), and a type-aware one only where its options turn those on; and
 * each one a key under the prefix of a JS plugin it names is an ESLint name of. oxlint's own
 * `correctness: warn`, which runs where the config leaves correctness out, sets none.
 */
export function ruleIdsTheTeamsOxlintConfigSets(theirs: OxlintConfig, catalog: Catalog): string[] {
  const bySpelling = oxlintRulesBySpelling(catalog)
  const team = teamResolutionOf(theirs, bySpelling)
  const configs = configsInOxlintOrder(theirs)
  const setByStatementsOrCategories = [
    ...rulesItsStatementsSet(configs, team, bySpelling),
    ...rulesItsCategoriesRun(resolvedCategoriesOf(theirs), team, runsTypeAwareRules(theirs), catalog),
  ]
  return sortedUnique([...setByStatementsOrCategories.map(({ id }) => id), ...ruleIdsKeyedUnderItsJsPlugins(configs, catalog)])
}

/** The rules the statements of each config set where oxlint counts them: at a root, of a plugin listed there; in an override, of one listed there or in it. */
function rulesItsStatementsSet(configs: readonly OxlintConfig[], team: TeamResolution, bySpelling: OxlintRulesBySpelling): OxlintRule[] {
  const countedAtTheRoot = pluginsCountedAtTheRoot(team)
  return configs.flatMap((config) => [
    ...rulesCountedWhere(countedAtTheRoot, rulesOf(config), bySpelling),
    ...overridesOf(config).flatMap((override) => rulesCountedWhere(pluginsCountedIn(override, team), rulesOf(override), bySpelling)),
  ])
}

/** The rules keyed of a plugin running where the rule map is stated: a JS plugin's key names none. */
function rulesCountedWhere(pluginsRunning: ReadonlySet<OxlintPlugin>, rules: DummyRuleMap, bySpelling: OxlintRulesBySpelling): OxlintRule[] {
  return Object.keys(rules)
    .flatMap((key) => oxlintRulesKeyed(key, bySpelling))
    .filter((rule) => pluginsRunning.has(pluginOf(rule)))
}

/** The plugins whose rules oxlint counts a root statement of: eslint, and those the root lists. */
function pluginsCountedAtTheRoot({ rootPlugins }: TeamResolution): ReadonlySet<OxlintPlugin> {
  return new Set([ALWAYS_RUN, ...rootPlugins])
}

/** The plugins whose rules oxlint counts a statement of in the override: eslint, those the root lists, and those it lists. */
export function pluginsCountedIn(override: OxlintOverride, team: TeamResolution): ReadonlySet<OxlintPlugin> {
  return new Set([...pluginsCountedAtTheRoot(team), ...pluginsListedBy(override)])
}

/** Each rule a category the config writes on runs: of eslint, or of a plugin listed at the root or in any override; a type-aware one only where those run. */
function rulesItsCategoriesRun(written: CategorySeverities, team: TeamResolution, typeAwareRulesRun: boolean, catalog: Catalog): OxlintRule[] {
  const listedAnywhere = pluginsListedAnywhere(team)
  return catalog.oxlintRules
    .filter((rule) => isOn(categorySeverityOf(rule, written)))
    .filter((rule) => listedAnywhere.has(pluginOf(rule)))
    .filter((rule) => typeAwareRulesRun || !ruleIdsOxlintRunsTypeAware.has(rule.id))
}

/** eslint, and every plugin listed at the root or in any override. */
function pluginsListedAnywhere({ rootPlugins, listings }: TeamResolution): ReadonlySet<OxlintPlugin> {
  return new Set([ALWAYS_RUN, ...rootPlugins, ...listings.flatMap(({ plugins }) => [...plugins])])
}

/** Whether the config's options turn on the rules oxlint runs only with type information: `--type-aware` on the command line is out of its sight. */
function runsTypeAwareRules({ options }: OxlintConfig): boolean {
  return options !== undefined && options.typeAware === true
}

/** Each rule of ours a key of the configs, at a root or in an override, names in ESLint under the prefix of a JS plugin they name. */
function ruleIdsKeyedUnderItsJsPlugins(configs: readonly OxlintConfig[], catalog: Catalog): string[] {
  const rootsAndOverrides = [...configs, ...overridesIn(configs)]
  const prefixes: ReadonlySet<string> = new Set(rootsAndOverrides.flatMap(jsPluginsNamedBy).flatMap(prefixOfJsPlugin))
  const keys = rootsAndOverrides.flatMap((statingRules) => Object.keys(rulesOf(statingRules)))
  return keys.filter((key) => isUnderAJsPluginPrefix(key, prefixes)).flatMap((key) => ruleIdsNamedInEslint(key, catalog))
}

/** A JS plugin's prefix names no plugin of oxlint's: oxlint reserves those names. */
function isUnderAJsPluginPrefix(key: string, prefixes: ReadonlySet<string>): boolean {
  const prefixed = prefixedRuleKeyOf(key)
  return prefixed !== null && prefixes.has(prefixed.prefix) && builtinPluginOfRulePrefix(prefixed.prefix) === undefined
}

/** The JS plugins a config or an override names: none where it leaves them out, or gives null. */
function jsPluginsNamedBy({ jsPlugins }: Pick<OxlintConfig, 'jsPlugins'>): readonly ExternalPluginEntry[] {
  return jsPlugins === undefined || jsPlugins === null ? [] : jsPlugins
}

/** The prefix a JS plugin's rules take, where the config gives it: its `name`, or its package's name as oxlint cuts it. */
function prefixOfJsPlugin(entry: ExternalPluginEntry): string[] {
  if (typeof entry !== 'string') return [entry.name]
  return PATH_STARTS.some((start) => entry.startsWith(start)) ? [] : [withoutThePackageNaming(entry)]
}

export function teamResolutionOf(theirs: OxlintConfig, bySpelling: OxlintRulesBySpelling): TeamResolution {
  const configs = configsInOxlintOrder(theirs)
  return {
    rootPlugins: new Set(listedOrDefault(resolvedPluginsOf(theirs)).filter((plugin) => plugin !== ALWAYS_RUN)),
    categories: { ...DEFAULT_CATEGORIES, ...resolvedCategoriesOf(theirs) },
    listings: overridesIn(configs).flatMap(listingOf),
    rulesStatedAtARoot: configs.flatMap((config) => rulesStatedAtTheRootOf(config, bySpelling)),
  }
}

function rulesStatedAtTheRootOf({ rules = {} }: OxlintConfig, bySpelling: OxlintRulesBySpelling): OxlintRule[] {
  return Object.keys(rules).flatMap((key) => oxlintRulesKeyed(key, bySpelling))
}

/**
 * The plugins a config lists, merged with each it extends, last first: two lists unite, and one left
 * out adds oxlint's defaults to the other. Undefined where none of them lists any (Oxlintrc::merge).
 */
function resolvedPluginsOf(config: OxlintConfig): readonly OxlintPlugin[] | undefined {
  const own = config.plugins === undefined ? undefined : config.plugins.map(pluginNamed)
  return extendedObjectsOf(config)
    .toReversed()
    .reduce<readonly OxlintPlugin[] | undefined>((merged, extended) => pluginListsMerged(merged, resolvedPluginsOf(extended)), own)
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

/** Whether oxlint's own `correctness: warn` runs for the config: neither it nor any config it extends writes correctness. */
export function leavesCorrectnessAtOxlintsDefault(config: OxlintConfig): boolean {
  return resolvedCategoriesOf(config).correctness === undefined
}

/** The categories a config writes, over those each config it extends writes (Oxlintrc::merge). */
function resolvedCategoriesOf(config: OxlintConfig): RuleCategories {
  const { categories = {} } = config
  return extendedObjectsOf(config)
    .toReversed()
    .reduce<RuleCategories>((merged, extended) => ({ ...resolvedCategoriesOf(extended), ...merged }), categories)
}

function listingOf(override: OxlintOverride): Listing[] {
  return override.plugins === undefined ? [] : [{ where: whereItApplies(override), plugins: pluginsListedBy(override) }]
}

/** The plugins an override lists, eslint aside: it always runs. */
function pluginsListedBy({ plugins = [] }: OxlintOverride): ReadonlySet<OxlintPlugin> {
  return new Set(plugins.map(pluginNamed).filter((plugin) => plugin !== ALWAYS_RUN))
}

/** The plugin oxlint takes a name for in `plugins`, which takes no other name. */
function pluginNamed(name: string): OxlintPlugin {
  const plugin = builtinPluginNamed(name)
  if (plugin === undefined) throw new Error(`"${name}" names no plugin of oxlint's`)
  return plugin
}

/** The plugin of oxlint's a name is for, where it is for one: its own name, another it takes, or its package's name. */
function builtinPluginNamed(name: string): OxlintPlugin | undefined {
  const pluginName = withoutThePackageNaming(name)
  const alias = PLUGIN_ALIASES.get(pluginName)
  return alias === undefined ? oxlintPluginNamed(pluginName) : alias
}

/** The plugin of oxlint's a rule key's prefix is for: in a key, oxlint takes `@next` and `@next/next` for nextjs too. */
function builtinPluginOfRulePrefix(prefix: string): OxlintPlugin | undefined {
  return NEXTJS_RULE_PREFIXES.has(withoutThePackageNaming(prefix)) ? NEXTJS : builtinPluginNamed(prefix)
}

function withoutThePackageNaming(name: string): string {
  const match = PLUGIN_PACKAGE_NAME.exec(name)
  if (match === null) return name
  const { groups } = match
  if (groups === undefined) throw new Error(`${PLUGIN_PACKAGE_NAME.source} names no groups`)
  const { scope, scopedName, name: unscopedName } = groups
  if (unscopedName !== undefined) return unscopedName
  if (scope === undefined) throw new Error(`${name}: a plugin package's name matched without its scope`)
  return scopedName === undefined ? scope : `${scope}${SCOPE_SEPARATOR}${scopedName}`
}

/** Every override of the configs, in order. */
function overridesIn(configs: readonly OxlintConfig[]): OxlintOverride[] {
  return configs.flatMap(overridesOf)
}

/** A config's overrides: none where it has none. */
function overridesOf({ overrides = [] }: OxlintConfig): readonly OxlintOverride[] {
  return overrides
}

/** Each config it extends as an object, at any depth and in the order listed, before the config itself. */
export function configsInOxlintOrder(config: OxlintConfig): OxlintConfig[] {
  return [...extendedObjectsOf(config).flatMap(configsInOxlintOrder), config]
}

function extendedObjectsOf(config: OxlintConfig): OxlintConfig[] {
  return extendedBy(config).filter(isAnObject)
}

export function extendedBy({ extends: extended = [] }: OxlintConfig): readonly ExtendedConfig[] {
  return extended
}

export function isAnObject(extended: ExtendedConfig): extended is OxlintConfig {
  return typeof extended !== 'string'
}

export function whereItApplies({ files, excludeFiles }: OverrideFiles): OverrideFiles {
  return { files: [...files], ...(excludeFiles === undefined ? {} : { excludeFiles: [...excludeFiles] }) }
}

export function oxlintRulesBySpelling(catalog: Catalog): OxlintRulesBySpelling {
  return new Map(catalog.oxlintRules.flatMap((rule) => underEachSpelling(rule, catalog)))
}

/** The rule under each of its catalog spellings. */
function underEachSpelling(rule: OxlintRule, catalog: Catalog): [string, OxlintRule][] {
  return routeOf(rule.id, catalog).oxlintSpellings.map((spelling): [string, OxlintRule] => [spelling, rule])
}

/** The rule oxlint reads a key of the team's as, as a list: none where it is a JS plugin's. */
function oxlintRulesKeyed(key: string, bySpelling: OxlintRulesBySpelling): OxlintRule[] {
  const rule = oxlintRuleKeyed(key, bySpelling)
  return rule === undefined ? [] : [rule]
}

/**
 * The rule oxlint reads a key of the team's as (parse_rule_key, rules.rs), whether or not the
 * catalog spells it so: the rule of the plugin its prefix names, or, with no prefix, the first rule
 * so named. None where the prefix names no plugin of oxlint's: a JS plugin's rule.
 */
export function oxlintRuleKeyed(key: string, bySpelling: OxlintRulesBySpelling): OxlintRule | undefined {
  const prefixed = prefixedRuleKeyOf(key)
  if (prefixed === null) return firstOxlintRuleNamed(key, bySpelling)
  const plugin = builtinPluginOfRulePrefix(prefixed.prefix)
  return plugin === undefined ? undefined : bySpelling.get(spellingUnder(plugin, prefixed.ruleName))
}

/** The key cut into its prefix and rule name: null where it has no prefix. */
function prefixedRuleKeyOf(key: string): PrefixedRuleKey | null {
  const slash = slashEndingThePrefixOf(key)
  if (slash === NO_SLASH) return null
  return { prefix: key.slice(0, slash), ruleName: key.slice(slash + SCOPE_SEPARATOR.length) }
}

/** A key starting with a scope has its prefix end at its last slash, as the scope holds one; any other, at its first. */
function slashEndingThePrefixOf(key: string): number {
  return key.startsWith(SCOPED_KEY_START) ? key.lastIndexOf(SCOPE_SEPARATOR) : key.indexOf(SCOPE_SEPARATOR)
}

/** The first rule so named, in the order oxlint keeps its rules in. */
function firstOxlintRuleNamed(ruleName: string, bySpelling: OxlintRulesBySpelling): OxlintRule | undefined {
  return OXLINT_PLUGINS_IN_RULE_ORDER.map((plugin) => bySpelling.get(spellingUnder(plugin, ruleName))).find(
    (rule) => rule !== undefined,
  )
}

/** The rule's key under the plugin's own name, which oxlint takes for each of its rules. */
function spellingUnder(plugin: OxlintPlugin, ruleName: string): string {
  return `${plugin}${SCOPE_SEPARATOR}${ruleName}`
}

/** Every key the merge writes is a spelling oxlint has. */
export function oxlintRuleSpelled(spelling: string, bySpelling: OxlintRulesBySpelling): OxlintRule {
  const rule = bySpelling.get(spelling)
  if (rule === undefined) throw new Error(`${spelling}: no rule oxlint has is spelled so`)
  return rule
}

/** The plugin that runs the rule, which the catalog records by oxlint's own name for it, as `oxlintPluginsOf` reads it. */
export function pluginOf({ oxlintPlugin }: OxlintRule): OxlintPlugin {
  return toOxlintPlugin(oxlintPlugin)
}

export function categorySeverityOf({ category }: OxlintRule, categories: CategorySeverities): AllowWarnDeny | undefined {
  return categories[category]
}

export function isOn(severity: RuleEntry | undefined): severity is RuleEntry {
  return severity !== undefined && !OFF_SEVERITIES.has(Array.isArray(severity) ? severity[0] : severity)
}

/** A config's or an override's rule map: none where it states no rule. */
export function rulesOf({ rules = {} }: Pick<OxlintOverride, 'rules'>): DummyRuleMap {
  return rules
}
