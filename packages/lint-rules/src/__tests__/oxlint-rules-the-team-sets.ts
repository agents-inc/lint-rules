import type { Catalog, OxlintRule } from '@workspace/rule-data'
import type { OxlintConfig, OxlintOverride } from 'oxlint'
import inventory from '../../../rule-data/src/generated/inventory.json' with { type: 'json' }
import { oxlintPluginListedAs, oxlintRuleKeyedBy } from './oxlint-rule-keys.ts'

// When the team's oxlint config sets a rule (spec-merge-model.md, 1.2): anywhere, in whatever files,
// at any severity. A model of oxlint 1.87's config resolution, written apart from the merge
// (Oxlintrc::merge in oxlintrc.rs, override_rules in rules.rs, resolve_overrides in
// config_builder.rs, apply_overrides in config_store.rs):
// - A config's root merges with every config it extends: two `plugins` lists unite, and one left out
//   adds oxlint's default plugins to the other's; left out everywhere, the defaults are the root's.
//   Categories merge key by key, the extending config's over the extended one's. Only a category a
//   config writes counts: oxlint's own `correctness: warn`, which runs where every config leaves
//   correctness out, sets no rule (decisions.md, "Owner 2026-10-14 (questions on the merge rework
//   spec", point 1).
// - A root statement counts where its rule's plugin is listed at the root, or is eslint, which
//   always runs; an override's where it is listed at the root or in that very override. A statement
//   oxlint ignores sets nothing (O5).
// - A category on at the root runs each of its rules whose plugin is eslint, or is listed at the root
//   or in any override, nursery rules included (measured, oxlint 1.87: `nursery: 'warn'` runs
//   import/named, no-undef and no-unreachable-loop); never a type-aware one unless `options.typeAware` is on.
// - A key under the prefix of a JS plugin the config names by its package, or by `{ name }`, sets the
//   rule of ours that key is an ESLint name of.

/** The configs a team's config extends by path, by the path its `extends` gives: the oxlint run reads them. */
export type ConfigsExtendedByPath = ReadonlyMap<string, OxlintConfig>

/** A JS plugin as a config names it: a package or a path, or a name for it and its specifier. */
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
  inventory.rules.flatMap(({ id, oxlint }) => (oxlint !== null && oxlint.typeAware ? [id] : [])),
)

/** The RuleId of every rule the team's oxlint config sets, sorted. */
export function ruleIdsTheTeamsOxlintConfigSets(
  team: OxlintConfig,
  catalog: Catalog,
  extendedByPath: ConfigsExtendedByPath = NO_CONFIG_EXTENDED_BY_PATH,
): string[] {
  const configs = configsInOxlintsOrder(team, extendedByPath)
  const rootPlugins = new Set([ALWAYS_RUNS, ...resolvedRootPluginsOf(team, extendedByPath)])
  const overrides = configs.flatMap(({ overrides: ofTheConfig = [] }) => ofTheConfig)
  const byStatement = [
    ...configs.flatMap(({ rules = {} }) => rulesCountedWhere(rootPlugins, Object.keys(rules), catalog)),
    ...overrides.flatMap((override) => rulesCountedIn(override, rootPlugins, catalog)),
  ]
  const pluginsListedAnywhere = new Set([...rootPlugins, ...overrides.flatMap(({ plugins = [] }) => plugins.map(oxlintPluginListedAs))])
  const byCategory = rulesItsCategoriesRun(resolvedCategoriesOf(team, extendedByPath), pluginsListedAnywhere, typeAwareRulesRun(team), catalog)
  const byJsPlugin = ruleIdsKeyedUnderJsPlugins(configs, catalog)
  return [...new Set([...byStatement, ...byCategory].map(({ id }) => id).concat(byJsPlugin))].toSorted()
}

/** Each config the config extends, at any depth and in the order listed, before the config itself. */
function configsInOxlintsOrder(config: OxlintConfig, extendedByPath: ConfigsExtendedByPath): OxlintConfig[] {
  return [...extendedConfigsOf(config, extendedByPath).flatMap((extended) => configsInOxlintsOrder(extended, extendedByPath)), config]
}

function extendedConfigsOf({ extends: extended = [] }: OxlintConfig, extendedByPath: ConfigsExtendedByPath): OxlintConfig[] {
  return extended.map((each) => (typeof each === 'string' ? configExtendedBy(each, extendedByPath) : each))
}

function configExtendedBy(path: string, extendedByPath: ConfigsExtendedByPath): OxlintConfig {
  const config = extendedByPath.get(path)
  if (config === undefined) throw new Error(`the team's config extends ${path}, which the model was not given`)
  return config
}

/** The plugins the config's root runs, every config it extends merged in, eslint aside. */
function resolvedRootPluginsOf(config: OxlintConfig, extendedByPath: ConfigsExtendedByPath): readonly string[] {
  const listed = pluginsListedAtTheRootOf(config, extendedByPath)
  return listed === undefined ? OXLINT_DEFAULT_PLUGINS : listed
}

/** The plugins listed at the config's root with each config it extends: undefined where none of them lists any. */
function pluginsListedAtTheRootOf(config: OxlintConfig, extendedByPath: ConfigsExtendedByPath): readonly string[] | undefined {
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
function resolvedCategoriesOf(config: OxlintConfig, extendedByPath: ConfigsExtendedByPath): CategorySeverities {
  return configsInOxlintsOrder(config, extendedByPath).reduce<CategorySeverities>(
    (merged, { categories = {} }) => ({ ...merged, ...categories }),
    NO_CATEGORY_WRITTEN,
  )
}

/** Whether the config runs oxlint's type-aware rules: its options turn them on. */
function typeAwareRulesRun({ options }: OxlintConfig): boolean {
  return options !== undefined && options.typeAware === true
}

/** The rules an override's statements count for: of a plugin the root or the override itself lists. */
function rulesCountedIn({ rules = {}, plugins = [] }: OxlintOverride, rootPlugins: ReadonlySet<string>, catalog: Catalog): OxlintRule[] {
  return rulesCountedWhere(new Set([...rootPlugins, ...plugins.map(oxlintPluginListedAs)]), Object.keys(rules), catalog)
}

/** The rules keyed that are of a plugin running where the statements are: a JS plugin's key names none. */
function rulesCountedWhere(pluginsRunning: ReadonlySet<string>, keys: readonly string[], catalog: Catalog): OxlintRule[] {
  return keys.flatMap((key) => {
    const rule = oxlintRuleKeyedBy(key, catalog)
    return rule !== undefined && pluginsRunning.has(rule.oxlintPlugin) ? [rule] : []
  })
}

/** Each rule a category on runs: of a plugin listed somewhere, and a type-aware one only where those run. */
function rulesItsCategoriesRun(
  categories: CategorySeverities,
  pluginsListed: ReadonlySet<string>,
  typeAwareRun: boolean,
  catalog: Catalog,
): OxlintRule[] {
  return catalog.oxlintRules.filter(
    (rule) =>
      RUNNING_SEVERITIES.has(categories[rule.category]) &&
      pluginsListed.has(rule.oxlintPlugin) &&
      (typeAwareRun || !TYPE_AWARE_RULE_IDS.has(rule.id)),
  )
}

/** Each rule of ours an ESLint name of which a statement keys under the prefix of a JS plugin the configs name. */
function ruleIdsKeyedUnderJsPlugins(configs: readonly OxlintConfig[], catalog: Catalog): string[] {
  const prefixes: ReadonlySet<string | null> = new Set(configs.flatMap(jsPluginsNamedBy).flatMap(prefixOfJsPlugin))
  const keys = configs.flatMap(({ rules = {}, overrides = [] }) => [
    ...Object.keys(rules),
    ...overrides.flatMap(({ rules: overrideRules = {} }) => Object.keys(overrideRules)),
  ])
  return keys.filter((key) => prefixes.has(prefixOfKey(key))).flatMap((key) => ruleIdsNamed(key, catalog))
}

/** The JS plugins a config names: none where it leaves them out, or gives null. */
function jsPluginsNamedBy({ jsPlugins }: OxlintConfig): readonly JsPluginEntry[] {
  return jsPlugins === undefined || jsPlugins === null ? [] : jsPlugins
}

/** The prefix a JS plugin's rules take, where the config gives it: its `name`, or its package's name cut down. A path's plugin names itself. */
function prefixOfJsPlugin(entry: JsPluginEntry): string[] {
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
function ruleIdsNamed(key: string, catalog: Catalog): string[] {
  return [...catalog.rules.values()].filter(({ id, eslintAliases }) => id === key || eslintAliases.includes(key)).map(({ id }) => id)
}
