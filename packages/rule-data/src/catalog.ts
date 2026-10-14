import eslintFallbackSkips from '../data/eslint-fallback-skips.json' with { type: 'json' }

import { groupBy } from './generate/collections.ts'
import inventory from './generated/inventory.json' with { type: 'json' }
import routing from './generated/routing.json' with { type: 'json' }
import { parseEngine, parseOxlintCategory } from './parse-names.ts'
import { rulesetDefinitions } from './ruleset-definitions.ts'
import { type TurnedOnBy, type TurnedOnByFields, parseTurnedOnBy } from './turned-on-by.ts'

export type Engine = 'oxlint' | 'eslint'

export type RulesetList = 'quality' | 'libs' | 'runtimes' | 'languages'

/** The category oxlint files a rule under, which a config's `categories` turns on or off as one. */
export type OxlintCategory = 'correctness' | 'nursery' | 'pedantic' | 'perf' | 'restriction' | 'style' | 'suspicious'

export type RulesetDefinition = {
  name: string
  list: RulesetList
  domain: string | null
  env: string | null
}

export type ShippedRule = TurnedOnBy & {
  /** What the rule runs with when on. A rule `allowSuppressions` decides runs with its `whenSuppressions` instead. */
  options: readonly unknown[]
  files: readonly string[] | null
  ignores: readonly string[] | null
}

export type RuleRoute = {
  id: string
  engine: Engine
  oxlintName: string | null
  oxlintPlugin: string | null
  typed: boolean
  eslintAliases: readonly string[]
  /**
   * Every other rule ID the rule's plugin binds to the rule's module object, sorted: the same rule
   * under another name, as @eslint-react binds `x-no-missing-key` and `no-missing-key`. Present
   * exactly when there is one.
   */
  sameModuleAs?: readonly string[]
  /**
   * Keys oxlint's config accepts for oxlint's version of the rule, whichever engine runs it, in
   * ascending code-unit order (`oxlintSpellingsOf` says which); `[]` when oxlint has no version of it.
   */
  oxlintSpellings: readonly string[]
  /** `null` for a rule we do not ship: off until a consumer turns it on in `rules`. */
  shipped: ShippedRule | null
}

export type Catalog = {
  rules: ReadonlyMap<string, RuleRoute>
  rulesets: readonly RulesetDefinition[]
  /**
   * Without oxlint, ESLint takes over each oxlint-run rule it has a version of, except these: rule
   * ID → why. Each one's fixture does not fire in ESLint, or the owner decided against it.
   */
  eslintFallbackSkips: ReadonlyMap<string, string>
  /** Every rule the oxlint we install has, in RuleId order. */
  oxlintRules: readonly OxlintRule[]
  /**
   * Core rule ID → each ESLint rule that extends it under another name, sorted: typescript-eslint's
   * `@typescript-eslint/only-throw-error` for `no-throw-literal`. A different implementation of the
   * rule, not an alias, and a rule ID of its own where it is current. Read from each installed
   * rule's meta, deprecated rules included.
   */
  coreRuleExtensions: ReadonlyMap<string, readonly string[]>
  /**
   * Every RuleId ESLint has a version of, among its core rules and the plugins we install, deprecated
   * or not: the oxlint-run ones are the rules ESLint can take over without oxlint.
   */
  ruleIdsWithAnEslintVersion: ReadonlySet<string>
}

/**
 * A rule oxlint has, whichever engine runs it for us: its RuleId, its oxlint name, the plugin that
 * runs it, and the category a config's `categories` turns it on by.
 */
export type OxlintRule = {
  readonly id: string
  readonly oxlintName: string
  readonly oxlintPlugin: string
  readonly category: OxlintCategory
}

/** An installed ESLint rule that extends a core rule under another name. */
type CoreRuleExtension = { readonly id: string; readonly coreRule: string }

type GeneratedRoute = (typeof routing)[number]

type InventoryRule = (typeof inventory.rules)[number]

/**
 * A route's `shipped` as the generated routing writes it. Declared rather than inferred: JSON infers a
 * field only while some rule in today's data uses it.
 */
type GeneratedShippedRule = TurnedOnByFields & {
  readonly options: readonly unknown[]
  readonly files: readonly string[] | null
  readonly ignores: readonly string[] | null
}

/** Every `RuleId` with its engine and, for the rules we ship, its ruleset and settings. */
export const catalog: Catalog = {
  rules: new Map(routing.map(parseRuleRoute).map((route) => [route.id, route])),
  rulesets: rulesetDefinitions,
  eslintFallbackSkips: new Map(Object.entries(eslintFallbackSkips)),
  oxlintRules: inventory.rules.flatMap(oxlintRuleOf),
  coreRuleExtensions: extensionsByCoreRule(inventory.rules.flatMap(coreRuleExtensionOf)),
  ruleIdsWithAnEslintVersion: new Set(inventory.rules.filter(({ eslint }) => eslint !== null).map(({ id }) => id)),
}

/**
 * The RuleId of each rule the oxlint we install runs only with type information, which a config
 * turns on with `options.typeAware`: a category never runs one otherwise.
 */
export const ruleIdsOxlintRunsTypeAware: ReadonlySet<string> = new Set(inventory.rules.filter(isRunTypeAwareByOxlint).map(({ id }) => id))

function isRunTypeAwareByOxlint({ oxlint }: InventoryRule): boolean {
  return oxlint !== null && oxlint.typeAware
}

function oxlintRuleOf({ id, oxlint }: InventoryRule): OxlintRule[] {
  if (oxlint === null) return []
  return [{ id, oxlintName: oxlint.oxlintName, oxlintPlugin: oxlint.oxlintPlugin, category: parseOxlintCategory(oxlint.category) }]
}

function coreRuleExtensionOf({ id, eslint }: InventoryRule): CoreRuleExtension[] {
  if (eslint === null || eslint.extendsCoreRule === undefined) return []
  return [{ id, coreRule: eslint.extendsCoreRule }]
}

/** The inventory is in RuleId order, so each core rule's extensions are too. */
function extensionsByCoreRule(extensions: readonly CoreRuleExtension[]): ReadonlyMap<string, readonly string[]> {
  const grouped = groupBy(extensions, ({ coreRule }) => coreRule)
  return new Map([...grouped].map(([coreRule, extending]) => [coreRule, extending.map(({ id }) => id)]))
}

function parseRuleRoute(route: GeneratedRoute): RuleRoute {
  return { ...route, engine: parseEngine(route.engine), shipped: parseShippedRule(route.id, route.shipped) }
}

function parseShippedRule(id: string, shipped: GeneratedShippedRule | null): ShippedRule | null {
  if (shipped === null) return null
  const { ruleset, alwaysOn, whenSuppressions, ...scope } = shipped
  return { ...parseTurnedOnBy(id, { ruleset, alwaysOn, whenSuppressions }), ...scope }
}
