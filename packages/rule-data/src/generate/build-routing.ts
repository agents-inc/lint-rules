import type { AllowanceLeftTo, Engine, RuleRoute, ShippedScope } from '../catalog.ts'
import { compareCodeUnits, foundOr, sharedKeys } from '../collections.ts'
import { oxlintSpellingsOf } from '../rule-id-parts.ts'
import {
  type SettingBySuppressionMode,
  type SuppressionModeSetting,
  type TestFileOptions,
  type TurnedOnBy,
  type WhenSuppressions,
  inEachSuppressionMode,
  parseTurnedOnBy,
} from '../turned-on-by.ts'
import type { Inventory, InventoryRule } from './build-inventory.ts'

/** How a rule came by its ruleset, or by `alwaysOn`: the draft's confidence and author, kept for review. */
type RulesetAssignment = {
  confidence: string
  alternative?: string
  note?: string
  by: string
}

/** A suppression-mode setting as `data/rules.json` writes it: `on` runs the rule with its own `options`. */
export type CanonicalSuppressionModeSetting = 'on' | SuppressionModeSetting

/** Another shipped rule this one is related to, and why: the card it was decided on, then one line. */
export type RuleRelation = { readonly rule: string; readonly because: string }

/** An entry of the rule's options left to another rule, and why, as `data/rules.json` records it. */
export type CanonicalAllowanceLeftTo = AllowanceLeftTo & Pick<RuleRelation, 'because'>

/** The test files, the files under `__tests__`, and Vitest's type tests (`*.test-d.ts`): the files a rule's test-file setting is for. */
const TEST_FILE_GLOBS: readonly string[] = ['**/*.{test,spec}.{ts,tsx,js,jsx}', '**/__tests__/**', '**/*.{test,spec}-d.{ts,tsx,js,jsx}']

/**
 * A route's `shipped` as the generated routing writes it: each relation is the other rule's ID, and
 * present only where `data/rules.json` records it. The catalog gives every shipped rule each.
 */
type RoutedShippedRule = TurnedOnBy &
  ShippedScope & {
    readonly coveredBy?: string
    readonly coveredInOxlintBy?: string
    readonly splitByTypesWith?: string
    readonly readsRuntimeGlobals?: true
    readonly allowancesLeftTo?: readonly AllowanceLeftTo[]
  }

export type RoutingEntry = Omit<RuleRoute, 'shipped'> & { shipped: RoutedShippedRule | null }

/** One entry of `data/rules.json`: a rule we ship on, in its ruleset or always, on its engine. */
export type CanonicalRule = {
  id: string
  /** The ruleset that turns the rule on. Absent exactly when `alwaysOn` is true. */
  ruleset?: string
  /** `true`: on whatever rulesets a consumer lists. */
  alwaysOn?: boolean
  /**
   * Present on the rules `allowSuppressions` decides, whatever rulesets are listed: routing ships
   * this in place of `ruleset` and `alwaysOn`, which canonical-list.test.ts still requires one of.
   */
  whenSuppressions?: WhenSuppressions<CanonicalSuppressionModeSetting, TestFileOptions>
  engine: Engine
  /** Why ESLint runs a rule oxlint has an untyped version of: the reason oxlint's is worse, and its measurement. */
  eslintBecause?: string
  /** oxlint's name for the rule, present exactly when oxlint runs it. */
  oxlintName?: string
  options: readonly unknown[]
  typed: boolean
  files?: readonly string[]
  ignores?: readonly string[]
  /**
   * The shipped rule in another ruleset whose findings include this one's: this rule is left out
   * wherever that one is on.
   */
  coveredBy?: RuleRelation
  /**
   * The shipped rule whose findings include this one's where oxlint runs both: this rule is left out
   * wherever oxlint runs it and that one is on. ESLint's version keeps it.
   */
  coveredInOxlintBy?: RuleRelation
  /** The typed rule this untyped one is off beside, where that one runs with type information. */
  splitByTypesWith?: RuleRelation
  /** `true`: our runtimes' globals serve the rule, so the editor merges give them where it runs. */
  readsRuntimeGlobals?: boolean
  /** Each entry of the rule's options whose calls another shipped rule reports: kept exactly where that rule is on. */
  allowancesLeftTo?: readonly CanonicalAllowanceLeftTo[]
  assignment: RulesetAssignment
}

type RoutingSources = { inventory: Inventory; canonicalRules: readonly CanonicalRule[] }

type RuleIdWithOxlintName = { readonly id: string; readonly oxlintName: string }

/** The engine and shipped settings of every `RuleId`, sorted by ID. */
export function buildRouting(sources: Readonly<RoutingSources>): readonly RoutingEntry[] {
  const ruleIds = withOneRuleIdPerOxlintName(sources.inventory.rules, ruleIdsOf(sources))
  const installedById = new Map(sources.inventory.rules.map((rule) => [rule.id, rule]))
  const canonicalById = new Map(sources.canonicalRules.map((rule) => [rule.id, rule]))

  return [...ruleIds]
    .toSorted(compareCodeUnits)
    .map((id) => routeOf(installedRuleOf(id, installedById), canonicalById.get(id), ruleIds))
}

/**
 * Every rule a consumer can name: the canonical list, every rule oxlint has, and every ESLint rule
 * that is not deprecated. A deprecated rule is one only when the canonical list ships it.
 */
function ruleIdsOf({ inventory, canonicalRules }: Readonly<RoutingSources>): ReadonlySet<string> {
  const current = inventory.rules.filter(hasCurrentImplementation)
  return new Set([...canonicalRules.map(({ id }) => id), ...current.map(({ id }) => id)])
}

function hasCurrentImplementation({ oxlint, eslint }: Readonly<InventoryRule>): boolean {
  return oxlint !== null || (eslint !== null && !eslint.deprecated)
}

/** The rule IDs given, once no two of them share an oxlint name: throws naming each name two share. */
function withOneRuleIdPerOxlintName(rules: readonly InventoryRule[], ruleIds: ReadonlySet<string>): ReadonlySet<string> {
  const ruleIdsOxlintHas = rules.filter(({ id }) => ruleIds.has(id)).flatMap(idWithOxlintNameOf)
  const clashes = sharedKeys(ruleIdsOxlintHas, ({ oxlintName }) => oxlintName)
  if (clashes.length === 0) return ruleIds
  const described = clashes.map(([oxlintName, group]) => `${group.map(({ id }) => id).join(' and ')} (${oxlintName})`)
  throw new Error(`Rule IDs share one oxlint name: ${described.join('; ')}`)
}

/** The rule's ID beside oxlint's name for it: none where oxlint has no version of it. */
function idWithOxlintNameOf({ id, oxlint }: Readonly<InventoryRule>): readonly RuleIdWithOxlintName[] {
  return oxlint === null ? [] : [{ id, oxlintName: oxlint.oxlintName }]
}

function installedRuleOf(id: string, installedById: ReadonlyMap<string, InventoryRule>): InventoryRule {
  return foundOr(installedById.get(id), `${id} is in data/rules.json, but no installed engine has it`)
}

function routeOf(installed: Readonly<InventoryRule>, canonical: Readonly<CanonicalRule> | undefined, ruleIds: ReadonlySet<string>): RoutingEntry {
  const shipped = canonical === undefined ? null : shippedRuleOf(canonical)
  const engine = canonical === undefined ? defaultEngineOf(installed) : canonical.engine
  return engine === 'oxlint'
    ? oxlintRouteOf(installed, shipped, ruleIds)
    : eslintRouteOf(installed, canonical, shipped)
}

function shippedRuleOf(canonical: Readonly<CanonicalRule>): RoutedShippedRule {
  const { options, files, ignores } = canonical
  return {
    ...turnedOnByOf(canonical),
    options,
    files: files ?? null,
    ignores: ignores ?? null,
    ...relatedRuleIdsOf(canonical),
    ...runtimeGlobalsMarkOf(canonical),
    ...allowancesLeftToOf(canonical),
  }
}

/** `readsRuntimeGlobals: true` where the canonical list says so: the field left out otherwise. */
function runtimeGlobalsMarkOf({ readsRuntimeGlobals }: Readonly<CanonicalRule>): Pick<RoutedShippedRule, 'readsRuntimeGlobals'> {
  return readsRuntimeGlobals === true ? { readsRuntimeGlobals: true } : {}
}

/** Each allowance the canonical list records, without its reason: the field left out where it records none. */
function allowancesLeftToOf({ allowancesLeftTo }: Readonly<CanonicalRule>): Pick<RoutedShippedRule, 'allowancesLeftTo'> {
  if (allowancesLeftTo === undefined) return {}
  return { allowancesLeftTo: allowancesLeftTo.map(({ option, entry, rule }) => ({ option, entry, rule })) }
}

/** Each relation the canonical list records, as the other rule's ID: none where it records none. */
function relatedRuleIdsOf({ coveredBy, coveredInOxlintBy, splitByTypesWith }: Readonly<CanonicalRule>): Pick<RoutedShippedRule, 'coveredBy' | 'coveredInOxlintBy' | 'splitByTypesWith'> {
  return {
    ...(coveredBy !== undefined && { coveredBy: coveredBy.rule }),
    ...(coveredInOxlintBy !== undefined && { coveredInOxlintBy: coveredInOxlintBy.rule }),
    ...(splitByTypesWith !== undefined && { splitByTypesWith: splitByTypesWith.rule }),
  }
}

function turnedOnByOf({ id, ruleset, alwaysOn, whenSuppressions, options }: Readonly<CanonicalRule>): TurnedOnBy {
  if (whenSuppressions === undefined) return parseTurnedOnBy(id, { ruleset, alwaysOn })
  return {
    whenSuppressions: {
      ...inEachSuppressionMode(whenSuppressions, (setting) => resolvedSettingOf(setting, options)),
      ...testFileSettingWithGlobs(whenSuppressions.bannedInTestFiles),
    },
  }
}

/** The test-file options with the globs of the files they are for: none where the canonical list gives none. */
function testFileSettingWithGlobs(testFileOptions: TestFileOptions | undefined): Pick<SettingBySuppressionMode, 'bannedInTestFiles'> {
  return testFileOptions === undefined ? {} : { bannedInTestFiles: { files: TEST_FILE_GLOBS, options: testFileOptions.options } }
}

function resolvedSettingOf(
  setting: CanonicalSuppressionModeSetting,
  options: readonly unknown[],
): SuppressionModeSetting {
  return setting === 'on' ? { options } : setting
}

/** A rule nobody routed runs on oxlint when oxlint can run it without type information. */
function defaultEngineOf({ oxlint }: Readonly<InventoryRule>): Engine {
  return oxlint !== null && !oxlint.typeAware ? 'oxlint' : 'eslint'
}

function oxlintRouteOf(installed: Readonly<InventoryRule>, shipped: Readonly<RoutedShippedRule> | null, ruleIds: ReadonlySet<string>): RoutingEntry {
  const { id, oxlint } = installed
  if (oxlint === null) throw new Error(`${id} is routed to oxlint, which does not have it`)
  return {
    id,
    engine: 'oxlint',
    oxlintName: oxlint.oxlintName,
    oxlintPlugin: oxlint.oxlintPlugin,
    typed: false,
    eslintAliases: oxlint.eslintAliases.filter((alias) => !ruleIds.has(alias)),
    ...sameModuleNamesOf(installed),
    oxlintSpellings: oxlintSpellingsOf(oxlint.oxlintName),
    shipped,
  }
}

/** The canonical list's `typed` wins: some typed plugin rules do not declare it in their meta. */
function eslintRouteOf(installed: Readonly<InventoryRule>, canonical: Readonly<CanonicalRule> | undefined, shipped: Readonly<RoutedShippedRule> | null): RoutingEntry {
  const { id, oxlint, eslint } = installed
  if (eslint === null) throw new Error(`${id} is routed to ESLint, which does not have it`)
  return {
    id,
    engine: 'eslint',
    oxlintName: null,
    oxlintPlugin: null,
    typed: canonical === undefined ? eslint.typed : canonical.typed,
    eslintAliases: [],
    ...sameModuleNamesOf(installed),
    // oxlint's spellings of a rule ESLint runs: a merge reads a team's oxlint statement of any of
    // them as this rule.
    oxlintSpellings: oxlint === null ? [] : oxlintSpellingsOf(oxlint.oxlintName),
    shipped,
  }
}

/** The other names ESLint's version of the rule goes by in its plugin: none where ESLint has no version, or binds it once. */
function sameModuleNamesOf({ eslint }: Readonly<InventoryRule>): Pick<RuleRoute, 'sameModuleAs'> {
  if (eslint?.sameModuleAs === undefined) return {}
  return { sameModuleAs: eslint.sameModuleAs }
}
