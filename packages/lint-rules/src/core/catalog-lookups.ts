import { type Catalog, pluginPrefixOf, routeOf, type RuleRoute, type RulesetDefinition, type ShippedRule } from '@workspace/rule-data'
import { groupBy } from '@workspace/rule-data/collections'
import { readOnce } from './read-once.ts'

export type SuppressionRoute = RuleRoute & { readonly shipped: Extract<ShippedRule, { whenSuppressions: unknown }> }

type EslintNaming = { readonly name: string; readonly ruleId: string }

const ruleIdsByEslintNameRead = new WeakMap<Catalog, ReadonlyMap<string, readonly string[]>>()

export function rulesetNamed(name: string, catalog: Catalog): RulesetDefinition | undefined {
  return catalog.rulesets.find((ruleset) => ruleset.name === name)
}

/** No ruleset turns it on: `allowSuppressions` sets it. */
export function isSuppressionRoute(route: RuleRoute): route is SuppressionRoute {
  return route.shipped !== null && 'whenSuppressions' in route.shipped
}

export function isEslintRoute(route: RuleRoute): boolean {
  return route.engine === 'eslint'
}

/** Aliases, other names its plugin binds its module to, and oxlint spellings that are ESLint rule IDs. A twin is not one: in ESLint it is another rule. */
function otherEslintNamesOf(route: RuleRoute, catalog: Catalog): string[] {
  const { id, eslintAliases, sameModuleAs = [], oxlintSpellings } = route
  const prefix = pluginPrefixOf(id)
  const twins = new Set(twinsOf(route, catalog))
  const spellingsEslintKnows = oxlintSpellings.filter(
    (spelling) => catalog.rules.has(spelling) || pluginPrefixOf(spelling) === prefix,
  )
  return [...new Set([...eslintAliases, ...sameModuleAs, ...spellingsEslintKnows])]
    .filter((name) => name !== id && !twins.has(name))
    .toSorted()
}

export function ruleIdsNamedInEslint(name: string, catalog: Catalog): readonly string[] {
  const named = ruleIdsByEslintNameIn(catalog).get(name)
  return named === undefined ? [] : named
}

/** Read once per catalog: both merges look up each name a team's config states. */
function ruleIdsByEslintNameIn(catalog: Catalog): ReadonlyMap<string, readonly string[]> {
  return readOnce(ruleIdsByEslintNameRead, catalog, ruleIdsByEslintName)
}

function ruleIdsByEslintName(catalog: Catalog): ReadonlyMap<string, readonly string[]> {
  const namings = catalog.rules.values().flatMap((route) => eslintNamingsOf(route, catalog)).toArray()
  const byName = groupBy(namings, ({ name }) => name)
  return new Map(byName.entries().map(([name, ofTheName]) => [name, ofTheName.map(({ ruleId }) => ruleId)]))
}

function eslintNamingsOf(route: RuleRoute, catalog: Catalog): EslintNaming[] {
  return everyEslintNameOf(route, catalog).map((name) => ({ name, ruleId: route.id }))
}

function everyEslintNameOf(route: RuleRoute, catalog: Catalog): string[] {
  return [route.id, ...otherEslintNamesOf(route, catalog)]
}

/** A twin reports the same findings with options of its own, so running it beside ours reports each twice. An extension recorded as a deprecated alias of its core rule is the same rule, not a twin. */
export function twinsOf(route: RuleRoute, catalog: Catalog): string[] {
  const extendedByIt = coreRulesExtendedBy(route.id, catalog).filter(
    (coreRule) => !routeOf(coreRule, catalog).eslintAliases.includes(route.id),
  )
  return [...currentExtensionsOf(route, catalog), ...extendedByIt].toSorted()
}

/** Every extension but those recorded as its deprecated aliases. */
export function currentExtensionsOf({ id, eslintAliases }: RuleRoute, catalog: Catalog): string[] {
  return extensionsOf(id, catalog).filter((extension) => !eslintAliases.includes(extension))
}

function extensionsOf(id: string, catalog: Catalog): readonly string[] {
  const extensions = catalog.coreRuleExtensions.get(id)
  return extensions === undefined ? [] : extensions
}

function coreRulesExtendedBy(id: string, catalog: Catalog): string[] {
  return [...catalog.coreRuleExtensions].filter(([, extensions]) => extensions.includes(id)).map(([coreRule]) => coreRule)
}

/** In catalog order, so list order in the config changes nothing. */
export function envOfRulesets(listed: ReadonlySet<string>, catalog: Catalog): string[] {
  return catalog.rulesets.flatMap((ruleset) =>
    listed.has(ruleset.name) && ruleset.env !== null ? [ruleset.env] : [],
  )
}

export function readsRuntimeGlobals({ shipped }: RuleRoute): boolean {
  return shipped !== null && shipped.readsRuntimeGlobals
}

export function runtimeEnvsOf(catalog: Catalog): ReadonlySet<string> {
  return new Set(catalog.rulesets.flatMap(({ env }) => (env === null ? [] : [env])))
}
