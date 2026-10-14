import type { Catalog, OxlintRule } from '@workspace/rule-data'

// How oxlint 1.87 reads a rule key and a `plugins` name (parse_rule_key and unalias_plugin_name in
// crates/oxc_linter/src/config/rules.rs, normalize_plugin_name and LintPlugins::try_from in
// plugins.rs), modelled here apart from merge-oxlint-config.ts, so the differential oracle does not
// share the merge's reading of a key. The catalog's oxlintSpellings say which plugin-prefixed keys
// oxlint takes for each rule, `typescript/` for the core rules oxlint adapts to TypeScript included.

/** A rule key cut where oxlint cuts it. */
type CutKey = { readonly prefix: string; readonly ruleName: string }

const SEPARATOR = '/'
const SCOPE_START = '@'
const PACKAGE_NAME_PREFIXES = ['eslint-plugin', 'oxlint-plugin']
const PACKAGE_NAME_JOINER = '-'
// In a rule key, oxlint reads these as nextjs's beside the names `plugins` takes.
const NEXTJS_KEY_PREFIXES: ReadonlySet<string> = new Set(['@next', '@next/next'])
const NEXTJS = 'nextjs'

/** Each name oxlint takes for one of its plugins, once a package name is cut down, and the plugin it names, as the catalog spells it. */
const PLUGIN_BY_NAME: ReadonlyMap<string, string> = new Map([
  ['eslint', 'eslint'],
  ['react', 'react'],
  ['react-hooks', 'react'],
  ['react_hooks', 'react'],
  ['unicorn', 'unicorn'],
  ['typescript', 'typescript'],
  ['typescript-eslint', 'typescript'],
  ['typescript_eslint', 'typescript'],
  ['@typescript-eslint', 'typescript'],
  ['oxc', 'oxc'],
  ['deepscan', 'oxc'],
  ['import', 'import'],
  ['import-x', 'import'],
  ['jsdoc', 'jsdoc'],
  ['jest', 'jest'],
  ['vitest', 'vitest'],
  ['jsx-a11y', 'jsx-a11y'],
  ['jsx_a11y', 'jsx-a11y'],
  ['jsx-a11y-x', 'jsx-a11y'],
  ['jsx_a11y-x', 'jsx-a11y'],
  ['nextjs', 'nextjs'],
  ['react-perf', 'react-perf'],
  ['react_perf', 'react-perf'],
  ['promise', 'promise'],
  ['node', 'node'],
  ['vue', 'vue'],
])

/**
 * oxlint's plugins in the order its rule list keeps them, as `oxlint --rules` prints them: a key with
 * no prefix names the first rule so named.
 */
export const OXLINT_PLUGINS_IN_RULE_ORDER: readonly string[] = [
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

const rulesBySpellingOfEachCatalog = new WeakMap<Catalog, ReadonlyMap<string, OxlintRule>>()

/**
 * The rule oxlint reads a rule key as: the rule of the plugin its prefix names, or, with no prefix,
 * the first rule so named. Undefined where the prefix names no plugin of oxlint's (a JS plugin's
 * rule), or where oxlint has no rule so keyed.
 */
export function oxlintRuleKeyedBy(key: string, catalog: Catalog): OxlintRule | undefined {
  const bySpelling = oxlintRulesBySpelling(catalog)
  const cut = cutWhereOxlintCuts(key)
  if (cut === undefined) return firstRuleNamed(key, bySpelling)
  const plugin = pluginOfKeyPrefix(cut.prefix)
  return plugin === undefined ? undefined : bySpelling.get(spellingUnder(plugin, cut.ruleName))
}

/**
 * The plugin a name in a `plugins` list names, as the catalog spells it: oxlint refuses any other
 * name. `oxlint --rules` prints each rule's plugin by one of these names (`jsx_a11y`).
 */
export function oxlintPluginListedAs(name: string): string {
  const plugin = PLUGIN_BY_NAME.get(withThePackageNamingCut(name))
  if (plugin === undefined) throw new Error(`"${name}" names no plugin of oxlint's`)
  return plugin
}

function oxlintRulesBySpelling(catalog: Catalog): ReadonlyMap<string, OxlintRule> {
  const known = rulesBySpellingOfEachCatalog.get(catalog)
  if (known !== undefined) return known
  const bySpelling = new Map(catalog.oxlintRules.flatMap((rule) => spellingsOf(rule, catalog).map((spelling): [string, OxlintRule] => [spelling, rule])))
  rulesBySpellingOfEachCatalog.set(catalog, bySpelling)
  return bySpelling
}

function spellingsOf({ id }: OxlintRule, catalog: Catalog): readonly string[] {
  const route = catalog.rules.get(id)
  if (route === undefined) throw new Error(`${id}: oxlint has it, so the catalog routes it`)
  return route.oxlintSpellings
}

/** A key starting with a scope is cut at its last slash, as the scope holds one; any other at its first. Undefined where it has no slash. */
function cutWhereOxlintCuts(key: string): CutKey | undefined {
  const slash = key.startsWith(SCOPE_START) ? key.lastIndexOf(SEPARATOR) : key.indexOf(SEPARATOR)
  return slash < 0 ? undefined : { prefix: key.slice(0, slash), ruleName: key.slice(slash + SEPARATOR.length) }
}

function pluginOfKeyPrefix(prefix: string): string | undefined {
  const cutDown = withThePackageNamingCut(prefix)
  return NEXTJS_KEY_PREFIXES.has(cutDown) ? NEXTJS : PLUGIN_BY_NAME.get(cutDown)
}

/** `@scope/eslint-plugin` names `@scope`, `@scope/eslint-plugin-x` names `@scope/x`, and `eslint-plugin-x` names `x`; oxlint-plugin alike. */
function withThePackageNamingCut(name: string): string {
  const slash = name.indexOf(SEPARATOR)
  const scoped = slash < 0 ? undefined : scopedPackageNameCut(name.slice(0, slash), name.slice(slash + SEPARATOR.length))
  if (scoped !== undefined) return scoped
  const packagePrefix = PACKAGE_NAME_PREFIXES.find((prefix) => name.startsWith(`${prefix}${PACKAGE_NAME_JOINER}`))
  return packagePrefix === undefined ? name : name.slice(packagePrefix.length + PACKAGE_NAME_JOINER.length)
}

function scopedPackageNameCut(scope: string, rest: string): string | undefined {
  if (PACKAGE_NAME_PREFIXES.includes(rest)) return scope
  const packagePrefix = PACKAGE_NAME_PREFIXES.find((prefix) => rest.startsWith(`${prefix}${PACKAGE_NAME_JOINER}`))
  return packagePrefix === undefined ? undefined : `${scope}${SEPARATOR}${rest.slice(packagePrefix.length + PACKAGE_NAME_JOINER.length)}`
}

function firstRuleNamed(ruleName: string, bySpelling: ReadonlyMap<string, OxlintRule>): OxlintRule | undefined {
  return OXLINT_PLUGINS_IN_RULE_ORDER.map((plugin) => bySpelling.get(spellingUnder(plugin, ruleName))).find((rule) => rule !== undefined)
}

function spellingUnder(plugin: string, ruleName: string): string {
  return `${plugin}${SEPARATOR}${ruleName}`
}
