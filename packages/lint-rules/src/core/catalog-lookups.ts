import { type Catalog, pluginPrefixOf, type RuleRoute, type RulesetDefinition, type ShippedRule } from '@workspace/rule-data'

export type OxlintRoute = RuleRoute & { readonly oxlintName: string; readonly oxlintPlugin: string }

/** A rule `allowSuppressions` turns on or off, with its setting in each suppression mode. */
export type SuppressionRoute = RuleRoute & { readonly shipped: Extract<ShippedRule, { whenSuppressions: unknown }> }

const ruleIdsByEslintNameRead = new WeakMap<Catalog, ReadonlyMap<string, readonly string[]>>()

export function routeOf(id: string, catalog: Catalog): RuleRoute {
  const route = catalog.rules.get(id)
  if (route === undefined) throw new Error(`unknown rule ID "${id}"`)
  return route
}

export function rulesetNamed(name: string, catalog: Catalog): RulesetDefinition | undefined {
  return catalog.rulesets.find((ruleset) => ruleset.name === name)
}

/** Narrows an oxlint-routed rule to one that carries the oxlint name and plugin it needs. */
export function isOxlintRoute(route: RuleRoute): route is OxlintRoute {
  if (route.engine !== 'oxlint') return false
  if (route.oxlintName === null || route.oxlintPlugin === null) {
    throw new Error(`${route.id}: routed to oxlint without an oxlint name and plugin`)
  }
  return true
}

/** Whether `allowSuppressions` decides the rule: no ruleset turns it on, and `rules` cannot set it. */
export function isSuppressionRoute(route: RuleRoute): route is SuppressionRoute {
  return route.shipped !== null && 'whenSuppressions' in route.shipped
}

export function isEslintRoute(route: RuleRoute): boolean {
  return route.engine === 'eslint'
}

/**
 * Every other name ESLint knows the same rule by, sorted: its aliases, each other name its plugin
 * binds its module to (questions.md #42), and each oxlint spelling that is an ESLint rule ID. A
 * spelling is one when it is a rule of the catalog, or carries the rule's own plugin prefix, as a
 * renamed rule's old name does (`unicorn/no-array-for-each` beside `unicorn/no-for-each`). A spelling
 * only oxlint reads (`typescript/…`, `eslint/…`, a package form) is none, and so is a twin, though
 * oxlint spells some twins as the rule itself (`@typescript-eslint/no-unused-vars` beside
 * `no-unused-vars`): in ESLint it is another rule.
 */
export function otherEslintNamesOf(route: RuleRoute, catalog: Catalog): string[] {
  // A rule its plugin binds under one name only has no `sameModuleAs`.
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

/**
 * Each rule of the catalog ESLint knows by the name: the rule whose ID it is, and each rule it is
 * another ESLint name of (otherEslintNamesOf). None where it names no rule of the catalog.
 */
export function ruleIdsNamedInEslint(name: string, catalog: Catalog): readonly string[] {
  const named = ruleIdsByEslintNameIn(catalog).get(name)
  return named === undefined ? [] : named
}

/** Every ESLint name of every rule, read once per catalog: both merges look up each name a team's config states. */
function ruleIdsByEslintNameIn(catalog: Catalog): ReadonlyMap<string, readonly string[]> {
  const read = ruleIdsByEslintNameRead.get(catalog)
  if (read !== undefined) return read
  const byName = ruleIdsByEslintName(catalog)
  ruleIdsByEslintNameRead.set(catalog, byName)
  return byName
}

function ruleIdsByEslintName(catalog: Catalog): ReadonlyMap<string, readonly string[]> {
  const byName = new Map<string, string[]>()
  for (const route of catalog.rules.values()) {
    for (const name of everyEslintNameOf(route, catalog)) {
      const naming = byName.get(name)
      if (naming === undefined) byName.set(name, [route.id])
      else naming.push(route.id)
    }
  }
  return byName
}

/** The rule's ID, and every other name ESLint knows it by. */
function everyEslintNameOf(route: RuleRoute, catalog: Catalog): string[] {
  return [route.id, ...otherEslintNamesOf(route, catalog)]
}

/**
 * typescript-eslint's twins of the rule, sorted: of a core rule, each rule extending it; of a rule
 * extending a core rule, that core rule. A twin reports the same findings, with options of its own,
 * so a team's config running it beside ours reports each finding twice (questions.md #41). An
 * extension the catalog records as an alias of its core rule, deprecated in its favour, is the same
 * rule under another name, not a twin.
 */
export function twinsOf(route: RuleRoute, catalog: Catalog): string[] {
  const extendedByIt = coreRulesExtendedBy(route.id, catalog).filter(
    (coreRule) => !routeOf(coreRule, catalog).eslintAliases.includes(route.id),
  )
  return [...currentExtensionsOf(route, catalog), ...extendedByIt].toSorted()
}

/**
 * Each rule extending the core rule that is current: every extension but those the catalog records
 * as its aliases, deprecated in its favour. None for a rule no installed rule extends.
 */
export function currentExtensionsOf({ id, eslintAliases }: RuleRoute, catalog: Catalog): string[] {
  return extensionsOf(id, catalog).filter((extension) => !eslintAliases.includes(extension))
}

/** A rule no installed rule extends has none. */
function extensionsOf(id: string, catalog: Catalog): readonly string[] {
  const extensions = catalog.coreRuleExtensions.get(id)
  return extensions === undefined ? [] : extensions
}

/** A core rule extends none. */
function coreRulesExtendedBy(id: string, catalog: Catalog): string[] {
  return [...catalog.coreRuleExtensions].filter(([, extensions]) => extensions.includes(id)).map(([coreRule]) => coreRule)
}

/** The env of every ruleset listed, in catalog order, so list order in the config changes nothing. */
export function envOfRulesets(listed: ReadonlySet<string>, catalog: Catalog): string[] {
  return catalog.rulesets.flatMap((ruleset) =>
    listed.has(ruleset.name) && ruleset.env !== null ? [ruleset.env] : [],
  )
}
