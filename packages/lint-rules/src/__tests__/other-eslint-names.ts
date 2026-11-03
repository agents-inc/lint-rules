import { type Catalog, pluginPrefixOf, routeOf } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { ruleNameOf } from '@workspace/rule-data/rule-id-parts'
import { typescriptEslintExtensions } from '@workspace/rule-data/test-support/typescript-eslint-extensions'
import { builtinRules } from 'eslint/use-at-your-own-risk'

/** A rule an editor part states and a twin of it, which a team's config may run beside it. */
export type TwinPair = { readonly ours: string; readonly theirs: string }

/**
* Every other ESLint name of the same rule, sorted: its ESLint aliases, and each oxlint spelling that is an ESLint
* rule ID (a catalog rule ID, or under the rule's own plugin prefix, as a renamed rule's old name). A twin is not
* one, though oxlint spells some twins as the rule itself: in ESLint it is another rule.
*/
export function sameRuleNamesOf(id: string, catalog: Readonly<Catalog>): string[] {
  const { eslintAliases, oxlintSpellings } = routeOf(id, catalog)
  const prefix = pluginPrefixOf(id)
  const spellingsEslintKnows = oxlintSpellings.filter(
    (spelling) => catalog.rules.has(spelling) || pluginPrefixOf(spelling) === prefix,
  )
  const twins = new Set(typescriptEslintTwinsOf(id))
  return [...new Set([...eslintAliases, ...spellingsEslintKnows])]
    .filter((name) => name !== id && !twins.has(name))
    .toSorted()
}

export function sameRuleNamesOfEach(ids: readonly string[], catalog: Readonly<Catalog>): string[] {
  return [...new Set(ids.flatMap((id) => sameRuleNamesOf(id, catalog)))].toSorted()
}

/**
* typescript-eslint's twins of the rule, read from the installed plugin's `meta.docs.extendsBaseRule`, never from
* the catalog. An extension deprecated in favour of its core rule is the same rule under another name, not a twin.
*/
export function typescriptEslintTwinsOf(id: string): string[] {
  const extensions = typescriptEslintExtensions().filter(({ replacedByCoreRule }) => !replacedByCoreRule)
  const extendingIt = extensions.filter(({ coreRule }) => coreRule === id).map((extension) => extension.id)
  const extendedByIt = extensions.filter((extension) => extension.id === id).map(({ coreRule }) => coreRule)
  return [...extendingIt, ...extendedByIt].toSorted()
}

/**
* Other names the rule's own plugin binds to its module object: @eslint-react 5.24.10 registers `x-no-missing-key`
* and `no-missing-key` as one rule. Read from the installed plugins, never from the catalog.
*/
export function sameModuleNamesOf(id: string): string[] {
  const prefix = pluginPrefixOf(id)
  const rules = rulesUnder(prefix)
  const ruleModule = rules.get(ruleNameOf(id))
  if (ruleModule === undefined) return []
  return [...rules]
    .filter(([, other]) => other === ruleModule)
    .map(([ruleName]) => (prefix === null ? ruleName : `${prefix}/${ruleName}`))
    .filter((name) => name !== id)
    .toSorted()
}

export function sameModuleNamesOfEach(ids: readonly string[]): string[] {
  return [...new Set(ids.flatMap(sameModuleNamesOf))].toSorted()
}

export function twinPairsOf(ids: readonly string[]): TwinPair[] {
  return ids.flatMap((ours) => typescriptEslintTwinsOf(ours).map((theirs) => ({ ours, theirs })))
}

export function eslintNamesOf(id: string, catalog: Readonly<Catalog>): string[] {
  return [...new Set([id, ...sameRuleNamesOf(id, catalog), ...sameModuleNamesOf(id)])].toSorted()
}

/** Adds each name under every prefix the team registers that plugin under: `ts/array-type` beside `@typescript-eslint/array-type`. */
export function withTheTeamsPrefixes(names: readonly string[], teamsPrefixes: ReadonlyMap<string, readonly string[]>): string[] {
  const underTheTeamsPrefixes = names.flatMap((name) => nameUnderTheTeamsPrefixes(name, teamsPrefixes))
  return [...new Set([...names, ...underTheTeamsPrefixes])].toSorted()
}

function nameUnderTheTeamsPrefixes(name: string, teamsPrefixes: ReadonlyMap<string, readonly string[]>): string[] {
  const prefix = pluginPrefixOf(name)
  if (prefix === null) return []
  const teams = teamsPrefixes.get(prefix)
  if (teams === undefined) return []
  return teams.map((team) => `${team}${name.slice(prefix.length)}`)
}

/** None where no plugin of ours is installed under the prefix. */
function rulesUnder(prefix: string | null): ReadonlyMap<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- ESLint 10.12 lists its core rules nowhere else: its package exports `.`, `./config`, `./rules` (types only), `./universal` and `./use-at-your-own-risk`, and only the last holds them
  if (prefix === null) return builtinRules
  const plugin = eslintPlugins[prefix]
  if (plugin === undefined) return new Map()
  return new Map(Object.entries(foundOr(plugin.rules, `the plugin installed under ${prefix} has no rules`)))
}
