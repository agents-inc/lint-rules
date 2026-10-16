import type { Catalog, RuleRoute, RulesetList, ShippedRule, SuppressionMode } from '@workspace/rule-data'
import { envOfRulesets, isSuppressionRoute, readsRuntimeGlobals, routeOf, rulesetNamed, type SuppressionRoute } from './catalog-lookups.ts'
import { formsOfAnIgnoresValue, normalizeGlob, normalizeGlobs } from './globs.ts'
import {
  describeSeverity,
  type FileOverrideInput,
  type LintRulesInput,
  listedRulesetNames,
  optionsGivenBy,
  type RuleEntryInput,
  type RuleSettingsInput,
  type RulesetsInput,
  type Severity,
  severityOf,
  suppressionModeSetBy,
} from './lint-rules-input.ts'

export type RuleSetting = {
  readonly severity: Severity
  readonly options: readonly unknown[]
  readonly files: readonly string[] | null
  readonly ignores: readonly string[] | null
}

export type RuleSettings = Readonly<Record<string, RuleSetting>>

/** One rule a layer states, with its setting there. */
export type StatedRule = { readonly id: string; readonly setting: RuleSetting }

export type EnvChanges = { readonly enabled: readonly string[]; readonly disabled: readonly string[] }

/** What an entry's `allowSuppressions` sets for its files. */
export type SuppressionLayer = {
  readonly mode: SuppressionMode
  /** Every rule `allowSuppressions` decides, at its setting in the mode: on, or off. */
  readonly rules: RuleSettings
}

export type FileOverrideLayer = {
  readonly files: readonly string[]
  readonly env: EnvChanges
  /**
   * The entry's rulesets against the top level's: dropped rules off, added rules on. Also every
   * rule an earlier entry changed in a list this entry gives, at this entry's setting.
   */
  readonly rulesetChanges: RuleSettings
  /** The entry's own `rules`: they apply within its files, after its ruleset changes. */
  readonly rules: RuleSettings
  /** Only where the entry gives `allowSuppressions`. Where it leaves it out, the mode before the entry stands. */
  readonly suppressions?: SuppressionLayer
  /** The settings the entry gives its TS files alone, over its others: see `RuleLayers.tsFileRules`. */
  readonly tsFileRules?: RuleSettings
}

/** The consumer's config resolved against the catalog, still engine-neutral. Every glob is normalised. */
export type RuleLayers = {
  /** Each value of our ignores in the forms both engines read as the .gitignore line (`formsOfAnIgnoresValue`). */
  readonly ignores: readonly string[]
  readonly env: readonly string[]
  readonly suppressionMode: SuppressionMode
  /** Every rule on at the top level, the ones `allowSuppressions` decides among them. */
  readonly rules: RuleSettings
  /**
   * Each rule the consumer's top-level `rules` state, at any severity, sorted: the layer above the
   * rulesets, which decides a core rule and typescript-eslint's extension of it where it states
   * either (D9).
   */
  readonly statedInRules: readonly string[]
  /**
   * The settings the top level gives its TS files alone, over its others. Beside oxlint, only where a
   * layer states both names of a twin pair: its core rule on TS files, at the extension's setting,
   * and the extension itself where it is on (`layersWithEachTwinPairDecidedBesideOxlint`). Left out
   * where there are none.
   */
  readonly tsFileRules?: RuleSettings
  readonly fileOverrides: readonly FileOverrideLayer[]
}

type SettingEntry = [id: string, setting: RuleSetting]

type KeepsRule = (rule: StatedRule) => boolean

type ChangesRuleMap = (settings: RuleSettings) => RuleSettings

type ShippedRoute = RuleRoute & { readonly shipped: ShippedRule }

type TopLevel = {
  readonly rulesets: RulesetsInput
  readonly rules: RuleSettingsInput
  readonly rulesOn: RuleSettings
  readonly env: readonly string[]
}

/** Rules and runtime envs that file-override entries changed through their rulesets. */
type RulesetDrivenChanges = { readonly ruleIds: readonly string[]; readonly envs: ReadonlySet<string> }

const RUNTIMES_LIST: RulesetList = 'runtimes'
const OFF: RuleSetting = { severity: 'off', options: [], files: null, ignores: null }
const UNSCOPED = { files: null, ignores: null } as const
// Owner, 2026-10-10: suppression comments are banned unless the consumer's config allows them.
const SUPPRESSION_MODE_BY_DEFAULT: SuppressionMode = 'banned'

const coversRead = new WeakMap<Catalog, ReadonlyMap<string, string>>()

export function resolveRuleLayers(lintRules: LintRulesInput, catalog: Catalog): RuleLayers {
  const { rulesets, ignores = [], allowSuppressions, rules = {}, fileOverrides = [] } = lintRules
  const suppressionMode = topLevelSuppressionMode(allowSuppressions)
  const topLevel: TopLevel = {
    rulesets,
    rules,
    rulesOn: rulesOnUnder(rulesets, rules, catalog),
    env: envOfRulesets(listedRulesetNames(rulesets), catalog),
  }
  return {
    ignores: ignores.flatMap(formsOfAnIgnoresValue),
    env: topLevel.env,
    suppressionMode,
    rules: { ...topLevel.rulesOn, ...withoutOff(suppressionRulesIn(suppressionMode, catalog)) },
    statedInRules: Object.keys(rules).toSorted(),
    fileOverrides: resolveFileOverrides(fileOverrides, topLevel, catalog),
  }
}

/** Every rule map the layers emit: the top level's and its TS files', then each entry's ruleset changes, suppression rules, own rules and TS files'. */
export function ruleSettingsOfEveryLayer(layers: RuleLayers): RuleSettings[] {
  return [
    layers.rules,
    tsFileRulesOf(layers),
    ...layers.fileOverrides.flatMap((layer) => [layer.rulesetChanges, suppressionRulesOf(layer), layer.rules, tsFileRulesOf(layer)]),
  ]
}

/** The layers with only the rules `keeps` answers yes for, in every rule map. */
export function layersKeepingRules(layers: RuleLayers, keeps: KeepsRule): RuleLayers {
  return layersWithEachRuleMap(layers, (settings) => settingsKeeping(settings, keeps))
}

/** The layers with every rule map changed as given: the top level's and its TS files', and each entry's. */
export function layersWithEachRuleMap(layers: RuleLayers, change: ChangesRuleMap): RuleLayers {
  return {
    ...layers,
    rules: change(layers.rules),
    ...tsFileRulesChanged(layers, change),
    fileOverrides: layers.fileOverrides.map((layer) => fileOverrideLayerChanged(layer, change)),
  }
}

/** The settings a layer gives its TS files alone: none where it gives them none. */
export function tsFileRulesOf({ tsFileRules }: Pick<RuleLayers, 'tsFileRules'>): RuleSettings {
  return tsFileRules === undefined ? {} : tsFileRules
}

/** The layers without the rules they state off. */
export function layersOfRulesOn(layers: RuleLayers): RuleLayers {
  return layersKeepingRules(layers, ({ setting }) => setting.severity !== 'off')
}

/** Every rule a layer states, at any severity, once each and sorted. */
export function ruleIdsStatedIn(layers: RuleLayers): string[] {
  return [...new Set(ruleSettingsOfEveryLayer(layers).flatMap((settings) => Object.keys(settings)))].toSorted()
}

/** Every rule a layer turns on, once each and sorted. */
export function ruleIdsOnIn(layers: RuleLayers): string[] {
  return ruleIdsStatedIn(layersOfRulesOn(layers))
}

/** Every rule a layer turns on that reads our runtimes' globals (`readsRuntimeGlobals`), once each and sorted. */
export function runtimeGlobalReadersOnIn(layers: RuleLayers, catalog: Catalog): string[] {
  return ruleIdsOnIn(layers).filter((ruleId) => readsRuntimeGlobals(routeOf(ruleId, catalog)))
}

/** The rules an entry's `allowSuppressions` sets: none where the entry leaves it out. */
export function suppressionRulesOf(layer: FileOverrideLayer): RuleSettings {
  return layer.suppressions === undefined ? {} : layer.suppressions.rules
}

function topLevelSuppressionMode(allowSuppressions: unknown): SuppressionMode {
  const modeSet = suppressionModeSetBy(allowSuppressions)
  return modeSet === null ? SUPPRESSION_MODE_BY_DEFAULT : modeSet
}

/** Entries keep their order, and each is resolved knowing what the entries before it changed. */
function resolveFileOverrides(
  fileOverrides: readonly FileOverrideInput[],
  topLevel: TopLevel,
  catalog: Catalog,
): FileOverrideLayer[] {
  return fileOverrides.reduce<FileOverrideLayer[]>(
    (earlierLayers, fileOverride) => [
      ...earlierLayers,
      resolveFileOverride(fileOverride, topLevel, changesMadeBy(earlierLayers), catalog),
    ],
    [],
  )
}

function resolveFileOverride(
  { files, rulesets = {}, allowSuppressions, rules = {} }: FileOverrideInput,
  topLevel: TopLevel,
  earlierChanges: RulesetDrivenChanges,
  catalog: Catalog,
): FileOverrideLayer {
  // A list the entry gives replaces the top-level one whole (libs included); one it omits is inherited.
  const entryRulesets: RulesetsInput = { ...topLevel.rulesets, ...rulesets }
  const entryRulesOn = rulesOnUnder(entryRulesets, topLevel.rules, catalog)
  const restated = restatedBy(listsGivenBy(rulesets), earlierChanges, catalog)
  return {
    files: files.map(normalizeGlob),
    env: envChanges(topLevel.env, envOfRulesets(listedRulesetNames(entryRulesets), catalog), restated.envs),
    rulesetChanges: rulesetChanges(topLevel.rulesOn, entryRulesOn, restated.ruleIds),
    rules: entryRuleSettings(rules, entryRulesOn, catalog),
    ...suppressionsSetBy(allowSuppressions, catalog),
  }
}

/**
 * An entry that gives `allowSuppressions` states every rule it decides, at the entry's setting, so
 * it wins over the top level and every earlier entry. One that leaves it out says nothing of them.
 */
function suppressionsSetBy(allowSuppressions: unknown, catalog: Catalog): Pick<FileOverrideLayer, 'suppressions'> {
  const mode = suppressionModeSetBy(allowSuppressions)
  if (mode === null) return {}
  return { suppressions: { mode, rules: suppressionRulesIn(mode, catalog) } }
}

/** Every rule `allowSuppressions` decides, at its setting in the mode: on at error with the mode's options, or off. */
function suppressionRulesIn(mode: SuppressionMode, catalog: Catalog): RuleSettings {
  return Object.fromEntries(
    [...catalog.rules.values()]
      .filter(isSuppressionRoute)
      .map((route): SettingEntry => [route.id, settingInSuppressionMode(route, mode)]),
  )
}

function settingInSuppressionMode(route: SuppressionRoute, mode: SuppressionMode): RuleSetting {
  const setting = route.shipped.whenSuppressions[mode]
  if (setting === 'off') return OFF
  return { severity: 'error', options: setting.options, ...shippedScopeOf(route) }
}

function changesMadeBy(earlierLayers: readonly FileOverrideLayer[]): RulesetDrivenChanges {
  return {
    ruleIds: [...new Set(earlierLayers.flatMap((layer) => Object.keys(layer.rulesetChanges)))],
    envs: new Set(earlierLayers.flatMap(({ env }) => [...env.enabled, ...env.disabled])),
  }
}

/**
 * Where globs overlap the later entry wins, so an entry states again, at its own setting, what an
 * earlier entry changed in a list this entry gives. A list it leaves out says nothing about those
 * files, so the earlier entry's change stands there.
 */
function restatedBy(
  listsGiven: ReadonlySet<string>,
  earlierChanges: RulesetDrivenChanges,
  catalog: Catalog,
): RulesetDrivenChanges {
  return {
    ruleIds: earlierChanges.ruleIds.filter((id) => listsChanging(id, catalog).some((list) => listsGiven.has(list))),
    envs: listsGiven.has(RUNTIMES_LIST) ? earlierChanges.envs : new Set(),
  }
}

function listsGivenBy(rulesets: Partial<RulesetsInput>): ReadonlySet<string> {
  return new Set(
    Object.entries(rulesets)
      .filter(([, names]) => names !== undefined)
      .map(([list]) => list),
  )
}

/**
 * The lists whose rulesets change a rule: its own ruleset's, and a covered rule's cover's, since
 * listing that ruleset leaves the covered rule out (C2).
 */
function listsChanging(id: string, catalog: Catalog): RulesetList[] {
  const cover = coverOf(id, catalog)
  return [listOfRulesetRule(id, catalog), ...(cover === null ? [] : [listOfRulesetRule(cover, catalog)])]
}

/**
 * The list of the ruleset a rule ships in. Rulesets change only rules shipped in one: an always-on
 * rule is on under every ruleset, and `allowSuppressions` alone decides the rules it names.
 */
function listOfRulesetRule(id: string, catalog: Catalog): RulesetList {
  const { shipped } = routeOf(id, catalog)
  if (shipped === null || shipped.ruleset === undefined) throw new Error(`${id}: changed by a ruleset, yet shipped in none`)
  const ruleset = rulesetNamed(shipped.ruleset, catalog)
  if (ruleset === undefined) throw new Error(`${id}: shipped in unknown ruleset "${shipped.ruleset}"`)
  return ruleset.list
}

/**
 * Every always-on rule and every rule of a listed ruleset at error, then the top-level `rules` on
 * top, less each rule covered by one of those (C2). The rules `allowSuppressions` decides are left
 * to it (`suppressionRulesIn`).
 */
function rulesOnUnder(rulesets: RulesetsInput, rules: RuleSettingsInput, catalog: Catalog): RuleSettings {
  const shippedRules = shippedRulesOnUnder(listedRulesetNames(rulesets), catalog)
  const settingsGiven = Object.entries(rules).map(([id, entry]): SettingEntry => [
    id,
    scopedSettingOf(id, entry, shippedRules, catalog),
  ])
  return withoutCoveredRules(withoutOff({ ...shippedRules, ...Object.fromEntries(settingsGiven) }), rules, catalog)
}

/**
 * "Covered by" (S; spec-core.md C2): a rule is left out where the broader rule covering it is on,
 * at any severity, unless the top-level `rules` state it themselves. Where the cover runs in some
 * files alone, the rule is still left out of the whole layer (a limit), and naming the covered
 * rule's typescript-eslint twin is not naming it.
 */
function withoutCoveredRules(rulesOn: RuleSettings, statedInRules: RuleSettingsInput, catalog: Catalog): RuleSettings {
  return Object.fromEntries(Object.entries(rulesOn).filter(([id]) => !isLeftOutForItsCover(id, rulesOn, statedInRules, catalog)))
}

/** Whether the rule's cover is on, and the top-level `rules` do not state the rule themselves. */
function isLeftOutForItsCover(id: string, rulesOn: RuleSettings, statedInRules: RuleSettingsInput, catalog: Catalog): boolean {
  const cover = coverOf(id, catalog)
  return cover !== null && Object.hasOwn(rulesOn, cover) && !Object.hasOwn(statedInRules, id)
}

/** The rule covering the one given: none where it ships with no `coveredBy`. */
function coverOf(id: string, catalog: Catalog): string | null {
  const cover = coversIn(catalog).get(id)
  return cover === undefined ? null : cover
}

/**
 * Each covered rule's cover, read once per catalog. Every covered rule is checked, whether a layer
 * turns it on or not: throws where the data breaks what S needs (spec-core.md 2.6).
 */
function coversIn(catalog: Catalog): ReadonlyMap<string, string> {
  const read = coversRead.get(catalog)
  if (read !== undefined) return read
  const covers = new Map([...catalog.rules.values()].flatMap((route) => coverEntryOf(route, catalog)))
  coversRead.set(catalog, covers)
  return covers
}

/** The rule and the rule covering it, where it ships with a `coveredBy`: throws where the data breaks what S needs. */
function coverEntryOf(covered: RuleRoute, catalog: Catalog): [string, string][] {
  if (covered.shipped === null || covered.shipped.coveredBy === null) return []
  const cover = routeOf(covered.shipped.coveredBy, catalog)
  if (!isCoverAsTheDataGuarantees(covered, cover)) {
    throw new Error(`${covered.id}: covered by ${cover.id}, so both ship in a ruleset and ${cover.id} is another rule, covered by none`)
  }
  return [[covered.id, cover.id]]
}

/**
 * Only then does listing rulesets move S: an always-on rule, or one `allowSuppressions` decides, is on
 * whatever rulesets are listed, and a chain would leave a rule out for a cover that is left out itself.
 * A rule covering itself is covered, so the last check refuses it too.
 */
function isCoverAsTheDataGuarantees(covered: RuleRoute, cover: RuleRoute): boolean {
  return shipsInARuleset(covered) && shipsInARuleset(cover) && isCoveredByNone(cover)
}

function shipsInARuleset({ shipped }: RuleRoute): boolean {
  return shipped !== null && shipped.ruleset !== undefined
}

function isCoveredByNone({ shipped }: RuleRoute): boolean {
  return shipped === null || shipped.coveredBy === null
}

function shippedRulesOnUnder(listed: ReadonlySet<string>, catalog: Catalog): RuleSettings {
  const routesOn = [...catalog.rules.values()].filter(isShippedRoute).filter((route) => isTurnedOnUnder(listed, route))
  return Object.fromEntries(routesOn.map((route): SettingEntry => [route.id, shippedSettingOf(route)]))
}

/** A rule is on when its ruleset is listed, and an always-on rule whatever is listed. */
function isTurnedOnUnder(listed: ReadonlySet<string>, { shipped }: ShippedRoute): boolean {
  if (shipped.ruleset !== undefined) return listed.has(shipped.ruleset)
  return 'alwaysOn' in shipped
}

function shippedSettingOf(route: ShippedRoute): RuleSetting {
  return { severity: 'error', options: route.shipped.options, ...shippedScopeOf(route) }
}

/** A rule set through `rules`, top level or entry, keeping the files and ignores it ships with. */
function scopedSettingOf(id: string, entry: RuleEntryInput, inForce: RuleSettings, catalog: Catalog): RuleSetting {
  return { ...severityAndOptions(id, entry, inForce, catalog), ...shippedScopeOf(routeOf(id, catalog)) }
}

/**
 * A shipped rule keeps its files and ignores wherever it is set: softening a rule never widens where
 * it runs, but for a core rule ESLint runs at its typescript-eslint version's setting
 * (`coreSettingTakenFrom` in `build-eslint-config.ts`).
 */
export function shippedScopeOf({ shipped }: RuleRoute): Pick<RuleSetting, 'files' | 'ignores'> {
  if (shipped === null) return UNSCOPED
  return { files: normalizeGlobs(shipped.files), ignores: normalizeGlobs(shipped.ignores) }
}

/** An entry's own rules apply within its files, ANDed with the rule's shipped scope. */
function entryRuleSettings(rules: RuleSettingsInput, entryRulesOn: RuleSettings, catalog: Catalog): RuleSettings {
  return Object.fromEntries(
    Object.entries(rules).map(([id, entry]): SettingEntry => [id, scopedSettingOf(id, entry, entryRulesOn, catalog)]),
  )
}

function severityAndOptions(
  id: string,
  entry: RuleEntryInput,
  inForce: RuleSettings,
  catalog: Catalog,
): Pick<RuleSetting, 'severity' | 'options'> {
  const severity = severityOf(entry)
  if (severity === null) throw new Error(`invalid severity "${describeSeverity(entry)}" for "${id}"`)
  if (severity === 'off') return { severity, options: [] }
  const optionsGiven = optionsGivenBy(entry)
  if (optionsGiven === null) return { severity, options: optionsInForce(id, inForce, catalog) }
  return { severity, options: optionsGiven }
}

/** What a severity alone keeps: the options already set for the rule, else its shipped ones. */
function optionsInForce(id: string, inForce: RuleSettings, catalog: Catalog): readonly unknown[] {
  const current = inForce[id]
  if (current !== undefined) return current.options
  const { shipped } = routeOf(id, catalog)
  return shipped === null ? [] : shipped.options
}

/** Each rule the entry's rulesets switch on or off against the top level's, and each one restated. */
function rulesetChanges(
  topLevelRulesOn: RuleSettings,
  entryRulesOn: RuleSettings,
  restatedRuleIds: readonly string[],
): RuleSettings {
  const switched = [...Object.keys(topLevelRulesOn), ...Object.keys(entryRulesOn)].filter(
    (id) => Object.hasOwn(topLevelRulesOn, id) !== Object.hasOwn(entryRulesOn, id),
  )
  return Object.fromEntries(
    [...switched, ...restatedRuleIds].map((id): SettingEntry => [id, settingUnder(entryRulesOn, id)]),
  )
}

/** A rule's setting for the entry's files: as its rulesets turn it on, and off where they leave it out. */
function settingUnder(entryRulesOn: RuleSettings, id: string): RuleSetting {
  return entryRulesOn[id] ?? OFF
}

/** The envs the entry switches against the top level's, and each restated env at the entry's setting. */
function envChanges(
  topLevelEnv: readonly string[],
  entryEnv: readonly string[],
  restatedEnvs: ReadonlySet<string>,
): EnvChanges {
  const mayBeOnBeforeTheEntry = new Set([...topLevelEnv, ...restatedEnvs])
  return {
    enabled: entryEnv.filter((env) => !topLevelEnv.includes(env) || restatedEnvs.has(env)),
    disabled: [...mayBeOnBeforeTheEntry].filter((env) => !entryEnv.includes(env)),
  }
}

/** An entry's layer with its ruleset changes, own rules, suppression rules and TS files' rules changed as given. */
function fileOverrideLayerChanged({ suppressions, ...layer }: FileOverrideLayer, change: ChangesRuleMap): FileOverrideLayer {
  return {
    ...layer,
    rulesetChanges: change(layer.rulesetChanges),
    rules: change(layer.rules),
    ...(suppressions === undefined ? {} : { suppressions: { ...suppressions, rules: change(suppressions.rules) } }),
    ...tsFileRulesChanged(layer, change),
  }
}

/** A layer's TS files' rules changed as given, left out where it gives its TS files none. */
function tsFileRulesChanged({ tsFileRules }: Pick<RuleLayers, 'tsFileRules'>, change: ChangesRuleMap): Pick<RuleLayers, 'tsFileRules'> {
  return tsFileRules === undefined ? {} : { tsFileRules: change(tsFileRules) }
}

function settingsKeeping(settings: RuleSettings, keeps: KeepsRule): RuleSettings {
  return Object.fromEntries(Object.entries(settings).filter(([id, setting]) => keeps({ id, setting })))
}

function withoutOff(settings: RuleSettings): RuleSettings {
  return Object.fromEntries(Object.entries(settings).filter(([, setting]) => setting.severity !== 'off'))
}

function isShippedRoute(route: RuleRoute): route is ShippedRoute {
  return route.shipped !== null
}
