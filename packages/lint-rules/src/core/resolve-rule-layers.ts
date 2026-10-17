import { type Catalog, routeOf, type RuleRoute, type RulesetList, type ShippedRule, type SuppressionMode } from '@workspace/rule-data'
import { envOfRulesets, isSuppressionRoute, readsRuntimeGlobals, rulesetNamed, type SuppressionRoute } from './catalog-lookups.ts'
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
import { readOnce } from './read-once.ts'

export type RuleSetting = {
  readonly severity: Severity
  readonly options: readonly unknown[]
  readonly files: readonly string[] | null
  readonly ignores: readonly string[] | null
}

export type RuleSettings = Readonly<Record<string, RuleSetting>>

/** Off alone, else its severity and options. */
export type RuleEntryWritten = 'off' | [Severity, ...unknown[]]

export type StatedRule = { readonly id: string; readonly setting: RuleSetting }

export type EnvChanges = { readonly enabled: readonly string[]; readonly disabled: readonly string[] }

export type SuppressionLayer = {
  readonly mode: SuppressionMode
  /** Every rule `allowSuppressions` decides, on or off by the mode. */
  readonly rules: RuleSettings
}

export type FileOverrideLayer = {
  readonly files: readonly string[]
  readonly env: EnvChanges
  /** Dropped rules off and added rules on, against the top level's; plus each rule an earlier entry changed in a list this entry gives. */
  readonly rulesetChanges: RuleSettings
  /** Applied within the entry's files, after its ruleset changes. */
  readonly rules: RuleSettings
  /** Only where the entry gives `allowSuppressions`; otherwise the earlier mode stands. */
  readonly suppressions?: SuppressionLayer
  /** See `RuleLayers.tsFileRules`. */
  readonly tsFileRules?: RuleSettings
}

/** The consumer's config resolved against the catalog, still engine-neutral. Every glob is normalised. */
export type RuleLayers = {
  /** Each ignores value in the forms both engines read as the .gitignore line. */
  readonly ignores: readonly string[]
  readonly env: readonly string[]
  readonly suppressionMode: SuppressionMode
  readonly rules: RuleSettings
  /** The rules the consumer's top-level `rules` state, sorted: they decide a core rule and its typescript-eslint extension where they state either. */
  readonly statedInRules: readonly string[]
  /** Beside oxlint, where a layer states both names of a twin pair: the core rule on TS files at the extension's setting. Left out where there are none. */
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

type RulesetDrivenChanges = { readonly ruleIds: readonly string[]; readonly envs: ReadonlySet<string> }

const RUNTIMES_LIST: RulesetList = 'runtimes'
export const OFF_SETTING: RuleSetting = { severity: 'off', options: [], files: null, ignores: null }
const UNSCOPED = { files: null, ignores: null } as const
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
    rules: { ...topLevel.rulesOn, ...settingsOn(suppressionRulesIn(suppressionMode, catalog)) },
    statedInRules: Object.keys(rules).toSorted(),
    fileOverrides: resolveFileOverrides(fileOverrides, topLevel, catalog),
  }
}

export function ruleSettingsOfEveryLayer(layers: RuleLayers): RuleSettings[] {
  return [
    layers.rules,
    tsFileRulesOf(layers),
    ...layers.fileOverrides.flatMap((layer) => [layer.rulesetChanges, suppressionRulesOf(layer), layer.rules, tsFileRulesOf(layer)]),
  ]
}

export function layersKeepingRules(layers: RuleLayers, keeps: KeepsRule): RuleLayers {
  return layersWithEachRuleMap(layers, (settings) => settingsKeeping(settings, keeps))
}

export function layersWithEachRuleMap(layers: RuleLayers, change: ChangesRuleMap): RuleLayers {
  return {
    ...layers,
    rules: change(layers.rules),
    ...tsFileRulesChanged(layers, change),
    fileOverrides: layers.fileOverrides.map((layer) => fileOverrideLayerChanged(layer, change)),
  }
}

export function tsFileRulesOf({ tsFileRules }: Pick<RuleLayers, 'tsFileRules'>): RuleSettings {
  return tsFileRules === undefined ? {} : tsFileRules
}

export function layersOfRulesOn(layers: RuleLayers): RuleLayers {
  return layersWithEachRuleMap(layers, settingsOn)
}

export function ruleIdsStatedIn(layers: RuleLayers): string[] {
  return [...new Set(ruleSettingsOfEveryLayer(layers).flatMap((settings) => Object.keys(settings)))].toSorted()
}

export function ruleIdsOnIn(layers: RuleLayers): string[] {
  return ruleIdsStatedIn(layersOfRulesOn(layers))
}

export function runtimeGlobalReadersOnIn(layers: RuleLayers, catalog: Catalog): string[] {
  return ruleIdsOnIn(layers).filter((ruleId) => readsRuntimeGlobals(routeOf(ruleId, catalog)))
}

export function suppressionRulesOf(layer: FileOverrideLayer): RuleSettings {
  return layer.suppressions === undefined ? {} : layer.suppressions.rules
}

function topLevelSuppressionMode(allowSuppressions: unknown): SuppressionMode {
  const modeSet = suppressionModeSetBy(allowSuppressions)
  return modeSet === null ? SUPPRESSION_MODE_BY_DEFAULT : modeSet
}

/** Each entry is resolved knowing what the entries before it changed. */
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

/** States every rule it decides, so it wins over the top level and earlier entries. */
function suppressionsSetBy(allowSuppressions: unknown, catalog: Catalog): Pick<FileOverrideLayer, 'suppressions'> {
  const mode = suppressionModeSetBy(allowSuppressions)
  if (mode === null) return {}
  return { suppressions: { mode, rules: suppressionRulesIn(mode, catalog) } }
}

function suppressionRulesIn(mode: SuppressionMode, catalog: Catalog): RuleSettings {
  return Object.fromEntries(
    [...catalog.rules.values()]
      .filter(isSuppressionRoute)
      .map((route): SettingEntry => [route.id, settingInSuppressionMode(route, mode)]),
  )
}

function settingInSuppressionMode(route: SuppressionRoute, mode: SuppressionMode): RuleSetting {
  const setting = route.shipped.whenSuppressions[mode]
  if (setting === 'off') return OFF_SETTING
  return { severity: 'error', options: setting.options, ...shippedScopeOf(route) }
}

function changesMadeBy(earlierLayers: readonly FileOverrideLayer[]): RulesetDrivenChanges {
  return {
    ruleIds: [...new Set(earlierLayers.flatMap((layer) => Object.keys(layer.rulesetChanges)))],
    envs: new Set(earlierLayers.flatMap(({ env }) => [...env.enabled, ...env.disabled])),
  }
}

/** Where globs overlap the later entry wins, so an entry restates what an earlier entry changed in a list this entry gives. */
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

/** A covered rule's cover's list counts too, since listing that ruleset leaves the covered rule out. */
function listsChanging(id: string, catalog: Catalog): RulesetList[] {
  const cover = coverOf(id, catalog)
  return [listOfRulesetRule(id, catalog), ...(cover === null ? [] : [listOfRulesetRule(cover, catalog)])]
}

/** Only rules shipped in a ruleset change with it: an always-on rule is on under every ruleset, and `allowSuppressions` decides its own. */
function listOfRulesetRule(id: string, catalog: Catalog): RulesetList {
  const { shipped } = routeOf(id, catalog)
  if (shipped === null || shipped.ruleset === undefined) throw new Error(`${id}: changed by a ruleset, yet shipped in none`)
  const ruleset = rulesetNamed(shipped.ruleset, catalog)
  if (ruleset === undefined) throw new Error(`${id}: shipped in unknown ruleset "${shipped.ruleset}"`)
  return ruleset.list
}

function rulesOnUnder(rulesets: RulesetsInput, rules: RuleSettingsInput, catalog: Catalog): RuleSettings {
  const shippedRules = shippedRulesOnUnder(listedRulesetNames(rulesets), catalog)
  const settingsGiven = Object.entries(rules).map(([id, entry]): SettingEntry => [
    id,
    scopedSettingOf(id, entry, shippedRules, catalog),
  ])
  return withoutCoveredRules(settingsOn({ ...shippedRules, ...Object.fromEntries(settingsGiven) }), rules, catalog)
}

/** A rule is left out where the broader rule covering it is on, unless the top-level `rules` state it. A cover running in only some files still leaves the rule out of the whole layer (a known limit). */
function withoutCoveredRules(rulesOn: RuleSettings, statedInRules: RuleSettingsInput, catalog: Catalog): RuleSettings {
  return settingsKeeping(rulesOn, ({ id }) => !isLeftOutForItsCover(id, rulesOn, statedInRules, catalog))
}

function isLeftOutForItsCover(id: string, rulesOn: RuleSettings, statedInRules: RuleSettingsInput, catalog: Catalog): boolean {
  const cover = coverOf(id, catalog)
  return cover !== null && Object.hasOwn(rulesOn, cover) && !Object.hasOwn(statedInRules, id)
}

function coverOf(id: string, catalog: Catalog): string | null {
  const cover = coversIn(catalog).get(id)
  return cover === undefined ? null : cover
}

/** Read once per catalog; every covered rule is checked, and bad data throws. */
function coversIn(catalog: Catalog): ReadonlyMap<string, string> {
  return readOnce(coversRead, catalog, coversCheckedIn)
}

function coversCheckedIn(catalog: Catalog): ReadonlyMap<string, string> {
  return new Map([...catalog.rules.values()].flatMap((route) => coverEntryOf(route, catalog)))
}

function coverEntryOf(covered: RuleRoute, catalog: Catalog): [string, string][] {
  if (covered.shipped === null || covered.shipped.coveredBy === null) return []
  const cover = routeOf(covered.shipped.coveredBy, catalog)
  if (!isCoverAsTheDataGuarantees(covered, cover)) {
    throw new Error(`${covered.id}: covered by ${cover.id}, so both ship in a ruleset and ${cover.id} is another rule, covered by none`)
  }
  return [[covered.id, cover.id]]
}

/** An always-on or suppression rule would be on whatever is listed, and a chain would leave a rule out for a cover that is left out itself. */
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

function isTurnedOnUnder(listed: ReadonlySet<string>, { shipped }: ShippedRoute): boolean {
  if (shipped.ruleset !== undefined) return listed.has(shipped.ruleset)
  return 'alwaysOn' in shipped
}

function shippedSettingOf(route: ShippedRoute): RuleSetting {
  return { severity: 'error', options: route.shipped.options, ...shippedScopeOf(route) }
}

function scopedSettingOf(id: string, entry: RuleEntryInput, inForce: RuleSettings, catalog: Catalog): RuleSetting {
  return { ...severityAndOptions(id, entry, inForce, catalog), ...shippedScopeOf(routeOf(id, catalog)) }
}

/** Softening a rule never widens where it runs. */
export function shippedScopeOf({ shipped }: RuleRoute): Pick<RuleSetting, 'files' | 'ignores'> {
  if (shipped === null) return UNSCOPED
  return { files: normalizeGlobs(shipped.files), ignores: normalizeGlobs(shipped.ignores) }
}

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

function settingUnder(entryRulesOn: RuleSettings, id: string): RuleSetting {
  return entryRulesOn[id] ?? OFF_SETTING
}

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

function fileOverrideLayerChanged({ suppressions, ...layer }: FileOverrideLayer, change: ChangesRuleMap): FileOverrideLayer {
  return {
    ...layer,
    rulesetChanges: change(layer.rulesetChanges),
    rules: change(layer.rules),
    ...(suppressions === undefined ? {} : { suppressions: { ...suppressions, rules: change(suppressions.rules) } }),
    ...tsFileRulesChanged(layer, change),
  }
}

function tsFileRulesChanged({ tsFileRules }: Pick<RuleLayers, 'tsFileRules'>, change: ChangesRuleMap): Pick<RuleLayers, 'tsFileRules'> {
  return tsFileRules === undefined ? {} : { tsFileRules: change(tsFileRules) }
}

function settingsKeeping(settings: RuleSettings, keeps: KeepsRule): RuleSettings {
  return Object.fromEntries(Object.entries(settings).filter(([id, setting]) => keeps({ id, setting })))
}

export function settingsOn(settings: RuleSettings): RuleSettings {
  return settingsKeeping(settings, ({ setting }) => setting.severity !== 'off')
}

export function settingsWithout(settings: RuleSettings, ruleIds: ReadonlySet<string>): RuleSettings {
  return settingsKeeping(settings, ({ id }) => !ruleIds.has(id))
}

/** A severity alone resets an oxlint rule's options to its defaults, so every rule turned on carries its options. */
export function ruleEntryOf({ severity, options }: RuleSetting): RuleEntryWritten {
  return severity === 'off' ? 'off' : [severity, ...options]
}

function isShippedRoute(route: RuleRoute): route is ShippedRoute {
  return route.shipped !== null
}
