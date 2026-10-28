import type { Catalog, OxlintRule } from '@workspace/rule-data'
import { readOnce } from '../core/read-once.ts'

// How oxlint 1.87 reads a rule key and a `plugins` name (rules.rs, plugins.rs), modelled apart from
// merge-oxlint-config.ts so the differential oracle does not share the merge's reading.

type CutKey = { readonly prefix: string; readonly ruleName: string }

const SEPARATOR = '/'
const SCOPE_START = '@'
const PACKAGE_NAME_PREFIXES = ['eslint-plugin', 'oxlint-plugin']
const PACKAGE_NAME_JOINER = '-'
// In a rule key, oxlint reads these as nextjs's beside the names `plugins` takes.
const NEXTJS_KEY_PREFIXES: ReadonlySet<string> = new Set(['@next', '@next/next'])
const NEXTJS = 'nextjs'

/** Each name oxlint takes for one of its plugins, once a package name is cut down. */
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

/** As `oxlint --rules` orders them: a key with no prefix names the first rule so named. */
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

/** Undefined where the prefix names no plugin of oxlint's (a JS plugin's rule), or oxlint has no rule so keyed. */
export function oxlintRuleKeyedBy(key: string, catalog: Readonly<Catalog>): OxlintRule | undefined {
  const bySpelling = oxlintRulesBySpelling(catalog)
  const cut = cutWhereOxlintCuts(key)
  if (cut === undefined) return firstRuleNamed(key, bySpelling)
  const plugin = pluginOfKeyPrefix(cut.prefix)
  return plugin === undefined ? undefined : bySpelling.get(spellingUnder(plugin, cut.ruleName))
}

/** As the catalog spells it: oxlint refuses any other name. `oxlint --rules` prints plugins by these names (`jsx_a11y`). */
export function oxlintPluginListedAs(name: string): string {
  const plugin = PLUGIN_BY_NAME.get(withThePackageNamingCut(name))
  if (plugin === undefined) throw new Error(`"${name}" names no plugin of oxlint's`)
  return plugin
}

function oxlintRulesBySpelling(catalog: Readonly<Catalog>): ReadonlyMap<string, OxlintRule> {
  return readOnce(rulesBySpellingOfEachCatalog, catalog, oxlintRulesBySpellingIn)
}

function oxlintRulesBySpellingIn(catalog: Readonly<Catalog>): ReadonlyMap<string, OxlintRule> {
  return new Map(catalog.oxlintRules.flatMap((rule) => spellingsOf(rule, catalog).map((spelling): [string, OxlintRule] => [spelling, rule])))
}

function spellingsOf({ id }: OxlintRule, catalog: Readonly<Catalog>): readonly string[] {
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
