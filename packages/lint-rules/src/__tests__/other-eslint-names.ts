import { type Catalog, pluginPrefixOf, type RuleRoute } from '@workspace/rule-data'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { typescriptEslintExtensions } from '@workspace/rule-data/test-support/typescript-eslint-extensions'
import { builtinRules } from 'eslint/use-at-your-own-risk'

/** A rule an editor part states and a twin of it, which a team's config may run beside it. */
export type TwinPair = { readonly ours: string; readonly theirs: string }

/**
 * Every other ESLint name of the same rule, sorted: its ESLint aliases, and each oxlint spelling
 * that is an ESLint rule ID. A spelling is one when it is a rule ID of the catalog, or carries the
 * rule's own plugin prefix, as the old name of a renamed rule does (`unicorn/no-array-for-each`
 * beside `unicorn/no-for-each`). A spelling only oxlint reads (`typescript/…`, `eslint/…`, a
 * package form) is not. A twin is not either, though oxlint spells some twins as the rule itself
 * (`@typescript-eslint/no-unused-vars` beside `no-unused-vars`): in ESLint it is another rule.
 * Aliases and spellings are read from the catalog, so a spec built on them walks the catalog.
 */
export function sameRuleNamesOf(id: string, catalog: Catalog): string[] {
  const { eslintAliases, oxlintSpellings } = routeIn(catalog, id)
  const prefix = pluginPrefixOf(id)
  const spellingsEslintKnows = oxlintSpellings.filter(
    (spelling) => catalog.rules.has(spelling) || pluginPrefixOf(spelling) === prefix,
  )
  const twins = new Set(typescriptEslintTwinsOf(id))
  return [...new Set([...eslintAliases, ...spellingsEslintKnows])]
    .filter((name) => name !== id && !twins.has(name))
    .toSorted()
}

/** The same-rule names of every rule given, once each and sorted. */
export function sameRuleNamesOfEach(ids: readonly string[], catalog: Catalog): string[] {
  return [...new Set(ids.flatMap((id) => sameRuleNamesOf(id, catalog)))].toSorted()
}

/**
 * typescript-eslint's twins of the rule, sorted: of a core rule, each typescript-eslint rule that
 * extends it; of a typescript-eslint rule, the core rule it extends. Both report the same finding.
 * Read from the installed typescript-eslint's own metadata (`meta.docs.extendsBaseRule`), never from
 * the catalog the merge reads. An extension deprecated in favour of its core rule checks nothing
 * the core rule does not, so it is the same rule under another name, not a twin.
 */
export function typescriptEslintTwinsOf(id: string): string[] {
  const extensions = typescriptEslintExtensions().filter(({ replacedByCoreRule }) => !replacedByCoreRule)
  const extendingIt = extensions.filter(({ coreRule }) => coreRule === id).map((extension) => extension.id)
  const extendedByIt = extensions.filter((extension) => extension.id === id).map(({ coreRule }) => coreRule)
  return [...extendingIt, ...extendedByIt].toSorted()
}

/**
 * Every other name the rule's own plugin binds to the rule's module object, sorted: @eslint-react
 * 5.24.10 registers rules both as `x-no-missing-key` and as `no-missing-key`, one rule under two
 * names (decisions.md, round 6). Read from the installed plugins and ESLint's own core rules, never
 * from the catalog the merge reads. A rule of a plugin ESLint has none installed of, as an
 * oxlint-only rule, has none.
 */
export function sameModuleNamesOf(id: string): string[] {
  const prefix = pluginPrefixOf(id)
  const rules = rulesUnder(prefix)
  const ruleModule = rules.get(prefix === null ? id : id.slice(`${prefix}/`.length))
  if (ruleModule === undefined) return []
  return [...rules]
    .filter(([, other]) => other === ruleModule)
    .map(([ruleName]) => (prefix === null ? ruleName : `${prefix}/${ruleName}`))
    .filter((name) => name !== id)
    .toSorted()
}

/** The same-module names of every rule given, once each and sorted. */
export function sameModuleNamesOfEach(ids: readonly string[]): string[] {
  return [...new Set(ids.flatMap(sameModuleNamesOf))].toSorted()
}

/** Each rule given beside each of its twins, in the order given. */
export function twinPairsOf(ids: readonly string[]): TwinPair[] {
  return ids.flatMap((ours) => typescriptEslintTwinsOf(ours).map((theirs) => ({ ours, theirs })))
}

/** Every ESLint name of the rule, sorted: its own ID, its same-rule names and its same-module names. */
export function eslintNamesOf(id: string, catalog: Catalog): string[] {
  return [...new Set([id, ...sameRuleNamesOf(id, catalog), ...sameModuleNamesOf(id)])].toSorted()
}

/**
 * The names given, and each one under a prefix of ours also under every prefix the team registers
 * that plugin under, sorted: `ts/array-type` beside `@typescript-eslint/array-type` where the team
 * registers typescript-eslint as `ts`, as antfu's config does. `teamsPrefixes` is keyed by our prefix.
 */
export function withTheTeamsPrefixes(names: readonly string[], teamsPrefixes: ReadonlyMap<string, readonly string[]>): string[] {
  const underTheTeamsPrefixes = names.flatMap((name) => {
    const prefix = pluginPrefixOf(name)
    const teams = prefix === null ? undefined : teamsPrefixes.get(prefix)
    return prefix === null || teams === undefined ? [] : teams.map((team) => `${team}${name.slice(prefix.length)}`)
  })
  return [...new Set([...names, ...underTheTeamsPrefixes])].toSorted()
}

/** ESLint's core rules where there is no prefix, the installed plugin's under one, none where no plugin of ours is installed under it. */
function rulesUnder(prefix: string | null): ReadonlyMap<string, unknown> {
  if (prefix === null) return builtinRules
  const plugin = eslintPlugins[prefix]
  if (plugin === undefined) return new Map()
  if (plugin.rules === undefined) throw new Error(`the plugin installed under ${prefix} has no rules`)
  return new Map(Object.entries(plugin.rules))
}

function routeIn(catalog: Catalog, id: string): RuleRoute {
  const route = catalog.rules.get(id)
  if (route === undefined) throw new Error(`${id} is not in the catalog`)
  return route
}
