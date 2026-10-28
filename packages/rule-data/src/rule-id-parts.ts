import oxlintScopes from '../data/oxlint-scopes.json' with { type: 'json' }

import { compareCodeUnits, foundOr } from './collections.ts'

type OxlintScope = {
  oxlintPlugin: string
  eslintPrefix: string | null
  aliasPrefixes: readonly string[]
  /** Prefixes oxlint's config accepts for the scope's rules, besides each prefix's package form. */
  configPrefixes: readonly string[]
}

type OxlintNameParts = { scope: string; ruleName: string }

/** oxlint prints the rules of its `eslint` scope bare (`no-debugger`), and accepts them that way. */
const CORE_SCOPE = 'eslint'
/** typescript-eslint extends some core rules; both engines also know those by this scope's names. */
const EXTENDING_SCOPE = 'typescript'
const SCOPED_PACKAGE_MARK = '@'
const PLUGIN_PACKAGE_NAME = 'eslint-plugin'

const scopeByName: ReadonlyMap<string, OxlintScope> = new Map(Object.entries(oxlintScopes.scopes))
const coreRulesExtendedByTypescript: ReadonlySet<string> = new Set(oxlintScopes.coreRulesExtendedByTypescript)
const canonicalIdByOxlintName: ReadonlyMap<string, string> = new Map(
  Object.entries(oxlintScopes.canonicalIdByOxlintName),
)
const extraEslintAliasesByOxlintName: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries(oxlintScopes.eslintAliasesByOxlintName),
)

/**
 * The plugin part of an ESLint rule ID, split the way ESLint splits it: an npm-scoped prefix keeps
 * every segment but the last (`@next/next/no-img-element` → `@next/next`), any other prefix is the
 * first segment (`n/prefer-global/buffer` → `n`). A core rule has no plugin.
 */
export function pluginPrefixOf(ruleId: string): string | null {
  if (!ruleId.includes('/')) return null
  const prefixEnd = ruleId.startsWith(SCOPED_PACKAGE_MARK) ? ruleId.lastIndexOf('/') : ruleId.indexOf('/')
  return ruleId.slice(0, prefixEnd)
}

/**
 * A rule ID without its plugin prefix, split where ESLint splits it: `n/prefer-global/buffer` →
 * `prefer-global/buffer`. An oxlint name splits the same way: its scope is one segment.
 */
export function ruleNameOf(ruleId: string): string {
  const prefix = pluginPrefixOf(ruleId)
  return prefix === null ? ruleId : ruleId.slice(`${prefix}/`.length)
}

/** The name `oxlint --rules` prints and oxlint's config accepts: bare for core rules. */
export function oxlintNameOf({ scope, ruleName }: Readonly<OxlintNameParts>): string {
  return scope === CORE_SCOPE ? ruleName : `${scope}/${ruleName}`
}

/** The ESLint rule ID of an oxlint rule, which is the ID the canonical list and consumers use. */
export function canonicalIdOf(oxlintName: string): string {
  const exception = canonicalIdByOxlintName.get(oxlintName)
  if (exception !== undefined) return exception
  return eslintIdIn(scopeOf(oxlintName), partsOfOxlintName(oxlintName).ruleName)
}

/** The entry an oxlint config's `plugins` needs before oxlint runs this rule. */
export function oxlintPluginOf(oxlintName: string): string {
  return scopeOf(oxlintName).oxlintPlugin
}

/**
 * Other ESLint IDs of the same rule (`import/no-cycle` beside `import-x/no-cycle`). Some are
 * `RuleId`s of their own; routing drops those.
 */
export function eslintAliasCandidatesOf(oxlintName: string): readonly string[] {
  const { ruleName } = partsOfOxlintName(oxlintName)
  const byScope = scopeOf(oxlintName).aliasPrefixes.map((prefix) => `${prefix}/${ruleName}`)
  const byExtension = extendingScopesOf(oxlintName).map((scope) => eslintIdIn(scope, ruleName))
  return [...byScope, ...byExtension, ...extraEslintAliasesOf(oxlintName)]
}

/**
 * Keys oxlint's config accepts for this rule, in ascending code-unit order: oxlint's own name, and
 * the rule name under each config prefix of its scope (and of typescript's, for a core rule
 * typescript-eslint extends) and under each prefix's package form. oxlint takes more, such as other
 * names of a plugin (`react_hooks/`) and a rule name alone. Suppression comments are not bounded by
 * this list: oxlint matches those on the rule name alone, whatever the prefix.
 */
export function oxlintSpellingsOf(oxlintName: string): readonly string[] {
  const { ruleName } = partsOfOxlintName(oxlintName)
  const prefixed = configPrefixesWithPackageFormsOf(oxlintName).map((prefix) => `${prefix}/${ruleName}`)
  return [...new Set([oxlintName, ...prefixed])].toSorted(compareCodeUnits)
}

/** Each config prefix of the scopes the rule is spelled under, each followed by its package form. */
function configPrefixesWithPackageFormsOf(oxlintName: string): readonly string[] {
  return [scopeOf(oxlintName), ...extendingScopesOf(oxlintName)]
    .flatMap(({ configPrefixes }) => configPrefixes)
    .flatMap((prefix) => [prefix, packageFormOf(prefix)])
}

/** The aliases data/oxlint-scopes.json gives this one rule: none where it gives none. */
function extraEslintAliasesOf(oxlintName: string): readonly string[] {
  const aliases = extraEslintAliasesByOxlintName.get(oxlintName)
  return aliases === undefined ? [] : aliases
}

/**
 * The npm package a plugin prefix names, by ESLint's convention: `x` → `eslint-plugin-x`,
 * `@scope` → `@scope/eslint-plugin`, `@scope/x` → `@scope/eslint-plugin-x`.
 */
function packageFormOf(prefix: string): string {
  if (!prefix.startsWith(SCOPED_PACKAGE_MARK)) return `${PLUGIN_PACKAGE_NAME}-${prefix}`
  if (!prefix.includes('/')) return `${prefix}/${PLUGIN_PACKAGE_NAME}`
  const slash = prefix.indexOf('/')
  return `${prefix.slice(0, slash)}/${PLUGIN_PACKAGE_NAME}-${prefix.slice(slash + 1)}`
}

/** The rule's ID under a scope's ESLint prefix: bare for core rules. */
function eslintIdIn({ eslintPrefix }: Readonly<OxlintScope>, ruleName: string): string {
  return eslintPrefix === null ? ruleName : `${eslintPrefix}/${ruleName}`
}

/** The scopes besides its own that a rule is also spelled under. */
function extendingScopesOf(oxlintName: string): readonly OxlintScope[] {
  return coreRulesExtendedByTypescript.has(oxlintName) ? [scopeNamed(EXTENDING_SCOPE, oxlintName)] : []
}

function scopeOf(oxlintName: string): OxlintScope {
  return scopeNamed(partsOfOxlintName(oxlintName).scope, oxlintName)
}

function scopeNamed(scope: string, oxlintName: string): OxlintScope {
  return foundOr(scopeByName.get(scope), `oxlint scope "${scope}" (of ${oxlintName}) is not in data/oxlint-scopes.json`)
}

function partsOfOxlintName(oxlintName: string): OxlintNameParts {
  if (!oxlintName.includes('/')) return { scope: CORE_SCOPE, ruleName: oxlintName }
  const slash = oxlintName.indexOf('/')
  return { scope: oxlintName.slice(0, slash), ruleName: oxlintName.slice(slash + 1) }
}
