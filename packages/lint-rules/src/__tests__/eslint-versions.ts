import { catalog, pluginPrefixOf, type RuleRoute } from '@workspace/rule-data'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { ESLint } from 'eslint'
import { builtinRules } from 'eslint/use-at-your-own-risk'

/** A core rule beside the current typescript-eslint rule that extends it, its twin. */
export type TwinPair = { readonly core: string; readonly twin: string }

type PluginRule = NonNullable<ESLint.Plugin['rules']>[string]

const TYPESCRIPT_ESLINT_PREFIX = '@typescript-eslint'

/** Read from ESLint and the installed plugins, not the catalog, so a spec built on it checks the catalog. */
export function hasEslintVersion(id: string): boolean {
  const prefix = pluginPrefixOf(id)
  if (prefix === null) return builtinRules.has(id)
  const plugin = eslintPlugins[prefix]
  if (plugin === undefined || plugin.rules === undefined) return false
  return Object.hasOwn(plugin.rules, id.slice(`${prefix}/`.length))
}

/** Every shipped rule oxlint runs that ESLint also has: without oxlint, the ESLint part takes it over unless it is skipped. */
export function movedRules(): RuleRoute[] {
  return shippedOxlintRoutes().filter((route) => hasEslintVersion(route.id))
}

/** Every shipped rule oxlint runs that ESLint has no version of: without oxlint, nothing runs it. */
export function oxlintOnlyRules(): RuleRoute[] {
  return shippedOxlintRoutes().filter((route) => !hasEslintVersion(route.id))
}

export function skippedRuleIds(): string[] {
  return [...catalog.eslintFallbackSkips.keys()].toSorted()
}

/** The moved rules the ESLint part runs without oxlint: every one not on the skip list. */
export function provenMovedRules(): RuleRoute[] {
  return movedRules().filter((route) => !catalog.eslintFallbackSkips.has(route.id))
}

/**
* Without oxlint, the twin runs on TS files and the core rule on JS files. Read from typescript-eslint's rule
* meta (`docs.extendsBaseRule`, and no `deprecated`), not the catalog.
*/
export function twinnedMovedRules(): TwinPair[] {
  const twinByCoreRule = new Map(currentTypescriptEslintExtensions().map(({ core, twin }) => [core, twin]))
  return movedRules().flatMap(({ id }) => {
    const twin = twinByCoreRule.get(id)
    return twin === undefined ? [] : [{ core: id, twin }]
  })
}

function shippedOxlintRoutes(): RuleRoute[] {
  return [...catalog.rules.values()].filter((route) => route.engine === 'oxlint' && route.shipped !== null)
}

function currentTypescriptEslintExtensions(): TwinPair[] {
  const plugin = eslintPlugins[TYPESCRIPT_ESLINT_PREFIX]
  if (plugin === undefined || plugin.rules === undefined) throw new Error(`no plugin with rules is registered under ${TYPESCRIPT_ESLINT_PREFIX}`)
  return Object.entries(plugin.rules).flatMap(([name, rule]) => {
    const core = coreRuleExtendedBy(name, rule)
    return core === null || isDeprecated(rule) ? [] : [{ core, twin: `${TYPESCRIPT_ESLINT_PREFIX}/${name}` }]
  })
}

/** `extendsBaseRule` is true where the core rule has the same name, and the core rule's name where it differs. */
function coreRuleExtendedBy(name: string, { meta }: PluginRule): string | null {
  if (meta === undefined || meta.docs === undefined || !('extendsBaseRule' in meta.docs)) return null
  const { extendsBaseRule } = meta.docs
  if (extendsBaseRule === true) return name
  return typeof extendsBaseRule === 'string' ? extendsBaseRule : null
}

function isDeprecated({ meta }: PluginRule): boolean {
  return meta !== undefined && meta.deprecated !== undefined && meta.deprecated !== false
}
