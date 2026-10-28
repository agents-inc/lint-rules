import type { Catalog, OxlintRule } from '@workspace/rule-data'
import inventory from '@workspace/rule-data/generated/inventory.json' with { type: 'json' }
import type { OxlintConfig } from 'oxlint'
import { laidOver } from './laid-over.ts'
import { oxlintPluginListedAs, oxlintRuleKeyedBy } from './oxlint-rule-keys.ts'

// When the team's oxlint config sets a rule: anywhere, in any files, at any severity. A model of oxlint 1.87's
// config resolution, written apart from the merge (oxlintrc.rs, rules.rs, config_builder.rs, config_store.rs):
// - A root merges with every config it extends: `plugins` lists unite, and one left out adds oxlint's defaults.
//   Categories merge key by key, the extending config's winning; oxlint's own `correctness: warn` sets no rule.
// - A statement sets its rule wherever it stands, at a root or in an override, at any severity, though oxlint skips
//   one whose plugin is listed neither at the root nor in that override (owner 2026-10-22).
// - A category on at the root runs its rules whose plugin is eslint or listed anywhere, nursery included
//   (measured: `nursery: 'warn'` runs import/named), type-aware ones only with `options.typeAware`.
// - A key under a JS plugin's prefix sets the rule of ours that key is an ESLint name of.

/** Keyed by the path `extends` gives. */
export type ConfigsExtendedByPath = ReadonlyMap<string, OxlintConfig>

type JsPluginEntry = NonNullable<OxlintConfig['jsPlugins']>[number]

type CategorySeverities = Readonly<Record<string, unknown>>

const ALWAYS_RUNS = 'eslint'
// LintPlugins::default (plugins.rs): what a config listing no plugins anywhere runs.
const OXLINT_DEFAULT_PLUGINS: readonly string[] = ['oxc', 'typescript', 'unicorn']
// No category is written before the configs' own: oxlint's silent `correctness: warn` sets no rule.
const NO_CATEGORY_WRITTEN: CategorySeverities = {}
const RUNNING_SEVERITIES: ReadonlySet<unknown> = new Set(['warn', 'error', 'deny', 1, 2])
const NO_CONFIG_EXTENDED_BY_PATH: ConfigsExtendedByPath = new Map()
const PREFIX_SEPARATOR = '/'
const SCOPE_START = '@'
const RELATIVE_PATH_START = '.'
const PACKAGE_NAME_PREFIX = 'eslint-plugin'
const PACKAGE_NAME_JOINER = '-'
const NO_SLASH = -1

const TYPE_AWARE_RULE_IDS: ReadonlySet<string> = new Set(
  inventory.rules.filter(({ oxlint }) => oxlint?.typeAware === true).map(({ id }) => id),
)

export function ruleIdsTheTeamsOxlintConfigSets(
  team: Readonly<OxlintConfig>,
  catalog: Readonly<Catalog>,
  extendedByPath: ConfigsExtendedByPath = NO_CONFIG_EXTENDED_BY_PATH,
): string[] {
  const configs = configsInOxlintsOrder(team, extendedByPath)
  const rootPlugins = new Set([ALWAYS_RUNS, ...resolvedRootPluginsOf(team, extendedByPath)])
  const overrides = configs.flatMap(({ overrides: ofTheConfig = [] }) => ofTheConfig)
  const byStatement = [...configs, ...overrides].flatMap(({ rules = {} }) => rulesKeyed(Object.keys(rules), catalog))
  const pluginsListedAnywhere = new Set([...rootPlugins, ...overrides.flatMap(({ plugins = [] }) => plugins.map(oxlintPluginListedAs))])
  const byCategory = rulesItsCategoriesRun(resolvedCategoriesOf(team, extendedByPath), pluginsListedAnywhere, areTypeAwareRulesOn(team), catalog)
  const byJsPlugin = ruleIdsKeyedUnderJsPlugins(configs, catalog)
  return [...new Set([...byStatement, ...byCategory].map(({ id }) => id).concat(byJsPlugin))].toSorted()
}

/** Each config the config extends, at any depth and in the order listed, before the config itself. */
function configsInOxlintsOrder(config: Readonly<OxlintConfig>, extendedByPath: ConfigsExtendedByPath): OxlintConfig[] {
  return [...extendedConfigsOf(config, extendedByPath).flatMap((extended) => configsInOxlintsOrder(extended, extendedByPath)), config]
}

function extendedConfigsOf({ extends: extended = [] }: Readonly<OxlintConfig>, extendedByPath: ConfigsExtendedByPath): OxlintConfig[] {
  return extended.map((each) => (typeof each === 'string' ? configExtendedBy(each, extendedByPath) : each))
}

function configExtendedBy(path: string, extendedByPath: ConfigsExtendedByPath): OxlintConfig {
  const config = extendedByPath.get(path)
  if (config === undefined) throw new Error(`the team's config extends ${path}, which the model was not given`)
  return config
}

/** The plugins the config's root runs, every config it extends merged in, eslint aside. */
function resolvedRootPluginsOf(config: Readonly<OxlintConfig>, extendedByPath: ConfigsExtendedByPath): readonly string[] {
  const listed = pluginsListedAtTheRootOf(config, extendedByPath)
  return listed === undefined ? OXLINT_DEFAULT_PLUGINS : listed
}

/** The plugins listed at the config's root with each config it extends: undefined where none of them lists any. */
function pluginsListedAtTheRootOf(config: Readonly<OxlintConfig>, extendedByPath: ConfigsExtendedByPath): readonly string[] | undefined {
  const own = config.plugins === undefined ? undefined : config.plugins.map(oxlintPluginListedAs)
  return extendedConfigsOf(config, extendedByPath)
    .map((extended) => pluginsListedAtTheRootOf(extended, extendedByPath))
    .reduce<readonly string[] | undefined>(pluginListsUnited, own)
}

function pluginListsUnited(first: readonly string[] | undefined, second: readonly string[] | undefined): readonly string[] | undefined {
  if (first === undefined && second === undefined) return undefined
  return [...new Set([...listedOrTheDefaults(first), ...listedOrTheDefaults(second)])]
}

function listedOrTheDefaults(plugins: readonly string[] | undefined): readonly string[] {
  return plugins === undefined ? OXLINT_DEFAULT_PLUGINS : plugins
}

/** The categories each config the config extends writes, in order, under the config's own: none oxlint runs unwritten. */
function resolvedCategoriesOf(config: Readonly<OxlintConfig>, extendedByPath: ConfigsExtendedByPath): CategorySeverities {
  return laidOver(
    NO_CATEGORY_WRITTEN,
    // A copy, as oxlint types a config's categories as an interface, which no string can index.
    configsInOxlintsOrder(config, extendedByPath).map(({ categories = {} }): CategorySeverities => ({ ...categories })),
  )
}

function areTypeAwareRulesOn({ options }: Readonly<OxlintConfig>): boolean {
  return options?.typeAware === true
}

/** The rules of oxlint's the keys name: a JS plugin's key names none. */
function rulesKeyed(keys: readonly string[], catalog: Readonly<Catalog>): OxlintRule[] {
  return keys.flatMap((key) => {
    const rule = oxlintRuleKeyedBy(key, catalog)
    return rule === undefined ? [] : [rule]
  })
}

/** Each rule a category on runs: of a plugin listed somewhere, and a type-aware one only where those run. */
function rulesItsCategoriesRun(
  categories: CategorySeverities,
  pluginsListed: ReadonlySet<string>,
  areTypeAwareRulesRun: boolean,
  catalog: Readonly<Catalog>,
): OxlintRule[] {
  return catalog.oxlintRules.filter(
    (rule) =>
      RUNNING_SEVERITIES.has(categories[rule.category]) &&
      pluginsListed.has(rule.oxlintPlugin) &&
      (areTypeAwareRulesRun || !TYPE_AWARE_RULE_IDS.has(rule.id)),
  )
}

function ruleIdsKeyedUnderJsPlugins(configs: readonly OxlintConfig[], catalog: Readonly<Catalog>): string[] {
  const prefixes: ReadonlySet<string | null> = new Set(configs.flatMap(jsPluginsNamedBy).flatMap(prefixOfJsPlugin))
  const keys = configs.flatMap(({ rules = {}, overrides = [] }) => [
    ...Object.keys(rules),
    ...overrides.flatMap(({ rules: overrideRules = {} }) => Object.keys(overrideRules)),
  ])
  return keys.filter((key) => prefixes.has(prefixOfKey(key))).flatMap((key) => ruleIdsNamed(key, catalog))
}

/** The JS plugins a config names: none where it leaves them out, or gives null. */
function jsPluginsNamedBy({ jsPlugins }: Readonly<OxlintConfig>): readonly JsPluginEntry[] {
  return jsPlugins === undefined || jsPlugins === null ? [] : jsPlugins
}

/** The prefix a JS plugin's rules take, where the config gives it: its `name`, or its package's name cut down. A path's plugin names itself. */
function prefixOfJsPlugin(entry: Readonly<JsPluginEntry>): string[] {
  if (typeof entry !== 'string') return [entry.name]
  if (entry.startsWith(RELATIVE_PATH_START) || entry.startsWith(PREFIX_SEPARATOR)) return []
  return [packageNameCut(entry)]
}

/** `eslint-plugin-x` names `x`, `@scope/eslint-plugin` names `@scope`, and `@scope/eslint-plugin-x` names `@scope/x`. */
function packageNameCut(packageName: string): string {
  const unscoped = `${PACKAGE_NAME_PREFIX}${PACKAGE_NAME_JOINER}`
  if (packageName.startsWith(unscoped)) return packageName.slice(unscoped.length)
  const [scope, rest] = packageName.split(PREFIX_SEPARATOR)
  if (scope === undefined || rest === undefined) return packageName
  if (rest === PACKAGE_NAME_PREFIX) return scope
  return rest.startsWith(unscoped) ? `${scope}${PREFIX_SEPARATOR}${rest.slice(unscoped.length)}` : packageName
}

/** A key's prefix: up to its last slash where it starts with a scope, else up to its first; null where it has none. */
function prefixOfKey(key: string): string | null {
  const slash = key.startsWith(SCOPE_START) ? key.lastIndexOf(PREFIX_SEPARATOR) : key.indexOf(PREFIX_SEPARATOR)
  return slash === NO_SLASH ? null : key.slice(0, slash)
}

/** The rule of ours the key is the ID or an ESLint alias of: none where it names no rule of ours. */
function ruleIdsNamed(key: string, catalog: Readonly<Catalog>): string[] {
  return catalog.rules
    .values()
    .filter(({ id, eslintAliases }) => id === key || eslintAliases.includes(key))
    .map(({ id }) => id)
    .toArray()
}
