import eslintFallbackSkips from '../data/eslint-fallback-skips.json' with { type: 'json' }
import eslintStandIns from '../data/eslint-stand-ins.json' with { type: 'json' }

import { foundOr, groupBy } from './collections.ts'
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
  /** `true`: `init` names the ruleset only in a comment, for a team to list. */
  readonly optIn: boolean
  /** `true`: its rules reorder code, so `init` warns it conflicts with a formatter that sorts. */
  readonly sortsCode: boolean
}

/** What a shipped rule runs with, and on which files. */
export type ShippedScope = {
  /** What the rule runs with when on. A rule `allowSuppressions` decides runs with its `whenSuppressions` instead. */
  options: readonly unknown[]
  files: readonly string[] | null
  ignores: readonly string[] | null
}

/**
 * An entry of a list in the rule's options whose calls another shipped rule reports: the entry is kept
 * in the options exactly where that rule is on, so each such call is reported once.
 */
export type AllowanceLeftTo = {
  /** The key, in an object of the rule's options, of the list holding the entry. */
  readonly option: string
  readonly entry: unknown
  /** The shipped rule the entry's calls are left to. */
  readonly rule: string
}

export type ShippedRule = TurnedOnBy &
  ShippedScope & {
    /**
     * The shipped rule, in another ruleset, whose findings include this one's: this rule is left out
     * wherever that one is on. `null` where none.
     */
    readonly coveredBy: string | null
    /**
     * The shipped rule whose findings include this one's where oxlint runs both: this rule is left out
     * wherever oxlint runs it and that one is on. `null` where none.
     */
    readonly coveredInOxlintBy: string | null
    /**
     * The typed rule this untyped one splits by types with: this rule is off where that one runs with
     * type information. `null` where none.
     */
    readonly splitByTypesWith: string | null
    /** Whether our runtimes' globals serve the rule: the editor merges give them only where such a rule runs. */
    readonly readsRuntimeGlobals: boolean
    /** Each entry of the rule's options left to another rule; empty where none. */
    readonly allowancesLeftTo: readonly AllowanceLeftTo[]
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
  /**
   * Without oxlint, ESLint states each stand-in in place of a shipped oxlint rule it has no version
   * of: oxlint rule ID → the ID of the ESLint rule that reports the same code.
   */
  readonly eslintStandIns: ReadonlyMap<string, string>
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

export type OxlintRoute = RuleRoute & { readonly oxlintName: string; readonly oxlintPlugin: string }

/** An installed ESLint rule that extends a core rule under another name. */
type CoreRuleExtension = { readonly id: string; readonly coreRule: string }

type GeneratedRoute = (typeof routing)[number]

type InventoryRule = (typeof inventory.rules)[number]

/**
 * A route's `shipped` as the generated routing writes it. Declared rather than inferred: JSON infers a
 * field only while some rule in today's data uses it.
 */
type GeneratedShippedRule = TurnedOnByFields &
  Readonly<ShippedScope> & {
    readonly coveredBy?: string | undefined
    readonly coveredInOxlintBy?: string | undefined
    readonly splitByTypesWith?: string | undefined
    readonly readsRuntimeGlobals?: boolean | undefined
    readonly allowancesLeftTo?: readonly AllowanceLeftTo[] | undefined
  }

/** Every `RuleId` with its engine and, for the rules we ship, its ruleset and settings. */
export const catalog: Catalog = {
  rules: new Map(routing.map(parseRuleRoute).map((route) => [route.id, route])),
  rulesets: rulesetDefinitions,
  eslintFallbackSkips: new Map(Object.entries(eslintFallbackSkips)),
  eslintStandIns: new Map(Object.entries(eslintStandIns).map(([oxlintRule, { standIn }]) => [oxlintRule, standIn])),
  oxlintRules: inventory.rules.flatMap(oxlintRuleOf),
  coreRuleExtensions: extensionsByCoreRule(inventory.rules.flatMap(coreRuleExtensionOf)),
  ruleIdsWithAnEslintVersion: new Set(inventory.rules.filter(({ eslint }) => eslint !== null).map(({ id }) => id)),
}

/**
 * The RuleId of each rule the oxlint we install runs only with type information, which a config
 * turns on with `options.typeAware`: a category never runs one otherwise.
 */
export const ruleIdsOxlintRunsTypeAware: ReadonlySet<string> = new Set(inventory.rules.filter(isRunTypeAwareByOxlint).map(({ id }) => id))

export function routeOf(id: string, { rules }: Pick<Catalog, 'rules'>): RuleRoute {
  return foundOr(rules.get(id), `unknown rule ID "${id}"`)
}

/** Narrows an oxlint-routed rule to one that carries the oxlint name and plugin it needs. */
export function isOxlintRoute(route: RuleRoute): route is OxlintRoute {
  if (route.engine !== 'oxlint') return false
  if (route.oxlintName === null || route.oxlintPlugin === null) {
    throw new Error(`${route.id}: routed to oxlint without an oxlint name and plugin`)
  }
  return true
}

/** What the rule ships with; a rule we do not ship throws. */
export function shippedRuleOf({ id, shipped }: RuleRoute): ShippedRule {
  if (shipped === null) throw new Error(`${id} is not shipped`)
  return shipped
}

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

/** Routing writes a relation, a mark or an allowance left to another rule only where the canonical list records one; absent, it is none. */
function parseShippedRule(id: string, shipped: GeneratedShippedRule | null): ShippedRule | null {
  if (shipped === null) return null
  const { ruleset, alwaysOn, whenSuppressions, coveredBy, coveredInOxlintBy, splitByTypesWith, readsRuntimeGlobals, allowancesLeftTo, ...scope } = shipped
  return {
    ...parseTurnedOnBy(id, { ruleset, alwaysOn, whenSuppressions }),
    ...scope,
    coveredBy: coveredBy === undefined ? null : coveredBy,
    coveredInOxlintBy: coveredInOxlintBy === undefined ? null : coveredInOxlintBy,
    splitByTypesWith: splitByTypesWith === undefined ? null : splitByTypesWith,
    readsRuntimeGlobals: readsRuntimeGlobals === true,
    allowancesLeftTo: allowancesLeftTo === undefined ? [] : allowancesLeftTo,
  }
}
