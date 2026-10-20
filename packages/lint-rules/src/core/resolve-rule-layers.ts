import { isDeepStrictEqual } from 'node:util'
import {
  type AllowanceLeftTo,
  type Catalog,
  type Engine,
  routeOf,
  type RuleRoute,
  type RulesetList,
  type ShippedRule,
  type SuppressionMode,
} from '@workspace/rule-data'
import { foundOr, groupBy } from '@workspace/rule-data/collections'
import { envOfRulesets, isSuppressionRoute, readsRuntimeGlobals, rulesetNamed, type SuppressionRoute } from './catalog-lookups.ts'
import { formsOfAnIgnoresValue, normalizeGlob, normalizeGlobs } from './globs.ts'
import { isRecord } from './is-record.ts'
import {
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
import { type ReadsKept, readOnce } from './read-once.ts'

export type RuleSetting = {
  readonly severity: Severity
  /** In every file the rule runs on, but those `optionsInFiles` gives others. */
  readonly options: readonly unknown[]
  readonly files: readonly string[] | null
  readonly ignores: readonly string[] | null
  /** Where an options entry is left to a rule that runs on some files alone: the options there, in order, the later winning in a file both name. Left out where there are none. */
  readonly optionsInFiles?: readonly OptionsInFiles[]
}

type Globs = readonly string[]

/** A rule's options in the files of its own that match a glob of every list and none of the ignores. */
export type OptionsInFiles = {
  readonly files: readonly Globs[]
  readonly ignores: Globs
  readonly options: readonly unknown[]
}

export type RuleSettings = Readonly<Record<string, RuleSetting>>

/** Off alone, else its severity and options. */
type RuleEntryWritten = 'off' | [Severity, ...unknown[]]

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
  /** Dropped rules off, added rules on and rules whose options change, against the top level's; plus each rule an earlier entry changed in a list this entry gives. */
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

/** Whether a rule's options are settled for the layer already: as a `rules` entry writes them, or as the layer resolved them. */
type HasOptionsSettled = (id: string) => boolean

type OptionsOfASetting = Pick<RuleSetting, 'options' | 'optionsInFiles'>

type Scope = Pick<RuleSetting, 'files' | 'ignores'>

/** The options entries left to rules a layer runs in the same files of their own. */
type EntriesKeptTo = { readonly scope: Scope; readonly allowances: readonly AllowanceLeftTo[] }

type AllowanceInScope = { readonly allowance: AllowanceLeftTo; readonly scope: Scope }

type ShippedRoute = RuleRoute & { readonly shipped: ShippedRule }

type TopLevel = {
  readonly rulesets: RulesetsInput
  readonly rules: RuleSettingsInput
  readonly rulesOn: RuleSettings
  readonly env: readonly string[]
}

type RulesetDrivenChanges = { readonly ruleIds: readonly string[]; readonly envs: ReadonlySet<string> }

/** Each covered rule's covers: it is left out of a layer wherever one of them is on there. */
type Covers = ReadonlyMap<string, readonly string[]>

type CoverPair = { readonly covered: string; readonly cover: string }

/** `bothRoutedTo`: the engine both rules must be routed to, null where either will do. */
type CoverRelation = {
  readonly named: string
  readonly coverOf: (shipped: ShippedRule) => string | null
  readonly bothRoutedTo: Engine | null
}

/** The relations in force where a part is built, and the covers they give, read once per catalog. */
type CoverReading = { readonly inForce: readonly CoverRelation[]; readonly reads: ReadsKept<Catalog, Covers> }

const RUNTIMES_LIST: RulesetList = 'runtimes'
export const OFF_SETTING: RuleSetting = { severity: 'off', options: [], files: null, ignores: null }
const UNSCOPED = { files: null, ignores: null } as const
const SUPPRESSION_MODE_BY_DEFAULT: SuppressionMode = 'banned'

const COVERED_BY: CoverRelation = { named: 'covered by', coverOf: ({ coveredBy }) => coveredBy, bothRoutedTo: null }
const COVERED_IN_OXLINT_BY: CoverRelation = { named: 'covered in oxlint by', coverOf: ({ coveredInOxlintBy }) => coveredInOxlintBy, bothRoutedTo: 'oxlint' }
const WITHOUT_OXLINT: CoverReading = { inForce: [COVERED_BY], reads: new WeakMap<Catalog, Covers>() }
const BESIDE_OXLINT: CoverReading = { inForce: [COVERED_BY, COVERED_IN_OXLINT_BY], reads: new WeakMap<Catalog, Covers>() }

/** For an ESLint part without oxlint: a rule covered in oxlint by another stays, as ESLint's version of the cover reports less. */
export function resolveRuleLayers(lintRules: LintRulesInput, catalog: Catalog): RuleLayers {
  return resolveRuleLayersLeavingOut(lintRules, catalog, coversIn(catalog, WITHOUT_OXLINT))
}

/** oxlint reports every case of a rule covered in oxlint by another, so where it runs that rule is left out too. */
export function resolveRuleLayersBesideOxlint(lintRules: LintRulesInput, catalog: Catalog): RuleLayers {
  return resolveRuleLayersLeavingOut(lintRules, catalog, coversIn(catalog, BESIDE_OXLINT))
}

function resolveRuleLayersLeavingOut(lintRules: LintRulesInput, catalog: Catalog, covers: Covers): RuleLayers {
  const { rulesets, ignores = [], allowSuppressions, rules = {}, fileOverrides = [] } = lintRules
  const suppressionMode = topLevelSuppressionMode(allowSuppressions)
  const topLevel: TopLevel = {
    rulesets,
    rules,
    rulesOn: rulesOnUnder(rulesets, rules, covers, catalog),
    env: envOfRulesets(listedRulesetNames(rulesets), catalog),
  }
  return {
    ignores: ignores.flatMap(formsOfAnIgnoresValue),
    env: topLevel.env,
    suppressionMode,
    rules: { ...topLevel.rulesOn, ...settingsOn(suppressionRulesIn(suppressionMode, catalog)) },
    statedInRules: Object.keys(rules).toSorted(),
    fileOverrides: resolveFileOverrides(fileOverrides, topLevel, covers, catalog),
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

function layersOfRulesOn(layers: RuleLayers): RuleLayers {
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

export function topLevelSuppressionMode(allowSuppressions: boolean | undefined): SuppressionMode {
  const modeSet = suppressionModeSetBy(allowSuppressions)
  return modeSet === null ? SUPPRESSION_MODE_BY_DEFAULT : modeSet
}

/** Each entry is resolved knowing what the entries before it changed. */
function resolveFileOverrides(
  fileOverrides: readonly FileOverrideInput[],
  topLevel: TopLevel,
  covers: Covers,
  catalog: Catalog,
): FileOverrideLayer[] {
  return fileOverrides.reduce<FileOverrideLayer[]>(
    (earlierLayers, fileOverride) => [
      ...earlierLayers,
      resolveFileOverride(fileOverride, topLevel, changesMadeBy(earlierLayers), covers, catalog),
    ],
    [],
  )
}

function resolveFileOverride(
  { files, rulesets = {}, allowSuppressions, rules = {} }: FileOverrideInput,
  topLevel: TopLevel,
  earlierChanges: RulesetDrivenChanges,
  covers: Covers,
  catalog: Catalog,
): FileOverrideLayer {
  // A list the entry gives replaces the top-level one whole (libs included); one it omits is inherited.
  const entryRulesets: RulesetsInput = { ...topLevel.rulesets, ...rulesets }
  const entryRulesOn = rulesOnUnder(entryRulesets, topLevel.rules, covers, catalog)
  const restated = restatedBy(listsGivenBy(rulesets), earlierChanges, covers, catalog)
  return {
    files: files.map(normalizeGlob),
    env: envChanges(topLevel.env, envOfRulesets(listedRulesetNames(entryRulesets), catalog), restated.envs),
    rulesetChanges: rulesetChanges(topLevel.rulesOn, entryRulesOn, restated.ruleIds),
    rules: entryRulesOf(rules, entryRulesOn, catalog),
    ...suppressionsSetBy(allowSuppressions, catalog),
  }
}

/** States every rule it decides, so it wins over the top level and earlier entries. */
function suppressionsSetBy(allowSuppressions: boolean | undefined, catalog: Catalog): Pick<FileOverrideLayer, 'suppressions'> {
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
  covers: Covers,
  catalog: Catalog,
): RulesetDrivenChanges {
  return {
    ruleIds: earlierChanges.ruleIds.filter((id) => listsChanging(id, covers, catalog).some((list) => listsGiven.has(list))),
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
 * A covered rule's covers' lists count too, since listing their rulesets leaves the covered rule out, and so
 * do the lists of the rules a rule's options entries are left to, since listing them keeps the entries.
 */
function listsChanging(id: string, covers: Covers, catalog: Catalog): RulesetList[] {
  return [id, ...coversOf(id, covers), ...rulesAllowancesAreLeftTo(id, catalog)].map((ruleId) => listOfRulesetRule(ruleId, catalog))
}

function rulesAllowancesAreLeftTo(id: string, catalog: Catalog): string[] {
  return allowancesLeftToBy(routeOf(id, catalog)).map(({ rule }) => rule)
}

function allowancesLeftToBy({ shipped }: RuleRoute): readonly AllowanceLeftTo[] {
  return shipped === null ? [] : shipped.allowancesLeftTo
}

/** Only rules shipped in a ruleset change with it: an always-on rule is on under every ruleset, and `allowSuppressions` decides its own. */
function listOfRulesetRule(id: string, catalog: Catalog): RulesetList {
  const { shipped } = routeOf(id, catalog)
  const rulesetName = foundOr(shipped?.ruleset, `${id}: changed by a ruleset, yet shipped in none`)
  const ruleset = foundOr(rulesetNamed(rulesetName, catalog), `${id}: shipped in unknown ruleset "${rulesetName}"`)
  return ruleset.list
}

function rulesOnUnder(rulesets: RulesetsInput, rules: RuleSettingsInput, covers: Covers, catalog: Catalog): RuleSettings {
  const shippedRules = shippedRulesOnUnder(listedRulesetNames(rulesets), catalog)
  const settingsGiven = Object.entries(rules).map(([id, entry]): SettingEntry => [
    id,
    scopedSettingOf(id, entry, shippedRules, catalog),
  ])
  const rulesOn = withoutCoveredRules(settingsOn({ ...shippedRules, ...Object.fromEntries(settingsGiven) }), rules, covers)
  return withAllowancesWhereTheirRulesRun(rulesOn, (id) => isWrittenWithOptions(rules, id), rulesOn, catalog)
}

/**
 * Each options entry left to another rule is kept in the files where that rule runs in the layer, turned on
 * by its lists or the top-level `rules`, and dropped elsewhere; options settled for the layer are used as
 * they are. An entry's own `rules` turning that rule on or off do not move it (a known limit, as for a cover).
 */
function withAllowancesWhereTheirRulesRun(settings: RuleSettings, hasOptionsSettled: HasOptionsSettled, layerRulesOn: RuleSettings, catalog: Catalog): RuleSettings {
  const trimmed = Object.entries(settings)
    .filter(([id]) => !hasOptionsSettled(id))
    .map(([id, setting]): SettingEntry => [id, settingWithAllowancesWhereTheirRulesRun(setting, allowancesLeftToBy(routeOf(id, catalog)), layerRulesOn)])
  return { ...settings, ...Object.fromEntries(trimmed) }
}

function isWrittenWithOptions(written: RuleSettingsInput, id: string): boolean {
  const entry = written[id]
  return entry !== undefined && optionsGivenBy(entry) !== null
}

/** An entry whose rule runs in every file stays in the options, one whose rule runs in some files moves to the options in those files, and one whose rule is off goes. */
function settingWithAllowancesWhereTheirRulesRun(setting: RuleSetting, allowances: readonly AllowanceLeftTo[], layerRulesOn: RuleSettings): RuleSetting {
  if (setting.severity === 'off' || allowances.length === 0) return setting
  const notKeptEverywhere = allowances.filter(({ rule }) => !runsInEveryFile(rule, layerRulesOn))
  const keptToSomeFiles = entriesKeptToSomeFiles(allowances, layerRulesOn)
  const optionsInFiles = nonEmptySetsOf(keptToSomeFiles).map((kept) => optionsWhereEachRuns(kept, setting.options, notKeptEverywhere))
  return { ...setting, options: optionsWithout(setting.options, notKeptEverywhere), ...optionsInFilesUnlessNone(optionsInFiles) }
}

function runsInEveryFile(ruleId: string, layerRulesOn: RuleSettings): boolean {
  const scope = scopeWhereOn(ruleId, layerRulesOn)
  return scope !== null && isEveryFile(scope)
}

/** null where the layer leaves the rule off. */
function scopeWhereOn(ruleId: string, layerRulesOn: RuleSettings): Scope | null {
  const ruleSetting = layerRulesOn[ruleId]
  if (ruleSetting === undefined) return null
  return { files: ruleSetting.files, ignores: ruleSetting.ignores }
}

function isEveryFile({ files, ignores }: Scope): boolean {
  return files === null && ignores === null
}

/** Grouped by the files their rules run in, in the order the entries come. */
function entriesKeptToSomeFiles(allowances: readonly AllowanceLeftTo[], layerRulesOn: RuleSettings): EntriesKeptTo[] {
  const inScopes = allowances.flatMap((allowance) => inScopeOfItsRule(allowance, layerRulesOn))
  return eachOnce(inScopes.map(({ scope }) => scope)).map((scope) => ({ scope, allowances: allowancesIn(scope, inScopes) }))
}

function inScopeOfItsRule(allowance: AllowanceLeftTo, layerRulesOn: RuleSettings): AllowanceInScope[] {
  const scope = scopeWhereOn(allowance.rule, layerRulesOn)
  if (scope === null || isEveryFile(scope)) return []
  return [{ allowance, scope }]
}

function allowancesIn(scope: Scope, inScopes: readonly AllowanceInScope[]): AllowanceLeftTo[] {
  return inScopes.filter((inScope) => isDeepStrictEqual(inScope.scope, scope)).map(({ allowance }) => allowance)
}

/** Equal values once, in the order they first come. */
function eachOnce<Item>(items: readonly Item[]): Item[] {
  return items.filter((item, index) => items.findIndex((other) => isDeepStrictEqual(other, item)) === index)
}

/** Smallest first: of the sets naming a file, the last to apply is the largest, which holds every rule running there. */
function nonEmptySetsOf<Item>(items: readonly Item[]): Item[][] {
  const everySet = items.reduce<Item[][]>((setsSoFar, item) => setsSoFar.flatMap((set) => [set, [...set, item]]), [[]])
  return everySet.filter((set) => set.length > 0).toSorted((set, other) => set.length - other.length)
}

/** In the files where every rule of the set runs, the entries left to them are kept. */
function optionsWhereEachRuns(kept: readonly EntriesKeptTo[], options: readonly unknown[], notKeptEverywhere: readonly AllowanceLeftTo[]): OptionsInFiles {
  const keptHere = new Set(kept.flatMap(({ allowances }) => allowances))
  const droppedHere = notKeptEverywhere.filter((allowance) => !keptHere.has(allowance))
  return { files: fileListsOf(kept), ignores: ignoresOf(kept), options: optionsWithout(options, droppedHere) }
}

/** A file is in the set's files where it matches a glob of each list. */
function fileListsOf(kept: readonly EntriesKeptTo[]): Globs[] {
  return eachOnce(kept.flatMap(({ scope: { files } }) => (files === null ? [] : [files])))
}

function ignoresOf(kept: readonly EntriesKeptTo[]): string[] {
  return [...new Set(kept.flatMap(({ scope: { ignores } }) => (ignores === null ? [] : ignores)))]
}

function optionsInFilesUnlessNone(optionsInFiles: readonly OptionsInFiles[]): Pick<RuleSetting, 'optionsInFiles'> {
  return optionsInFiles.length === 0 ? {} : { optionsInFiles }
}

function optionsWithout(options: readonly unknown[], allowances: readonly AllowanceLeftTo[]): readonly unknown[] {
  return options.map((given) => allowances.reduce(optionWithoutTheEntry, given))
}

/** An object of the options without the entry in the list under the allowance's key; anything else as given. */
function optionWithoutTheEntry(given: unknown, { option, entry }: AllowanceLeftTo): unknown {
  if (!isRecord(given)) return given
  const listed = given[option]
  if (!Array.isArray(listed)) return given
  return { ...given, [option]: listed.filter((held: unknown) => !isDeepStrictEqual(held, entry)) }
}

/** A rule is left out where a broader rule covering it is on, unless the top-level `rules` state it. A cover running in only some files still leaves the rule out of the whole layer (a known limit). */
function withoutCoveredRules(rulesOn: RuleSettings, statedInRules: RuleSettingsInput, covers: Covers): RuleSettings {
  return settingsKeeping(rulesOn, ({ id }) => !isLeftOutForItsCover(id, rulesOn, statedInRules, covers))
}

function isLeftOutForItsCover(id: string, rulesOn: RuleSettings, statedInRules: RuleSettingsInput, covers: Covers): boolean {
  return coversOf(id, covers).some((cover) => Object.hasOwn(rulesOn, cover)) && !Object.hasOwn(statedInRules, id)
}

function coversOf(id: string, covers: Covers): readonly string[] {
  const found = covers.get(id)
  return found === undefined ? [] : found
}

/** Read once per catalog; every covered rule is checked, and bad data throws. */
function coversIn(catalog: Catalog, { inForce, reads }: CoverReading): Covers {
  return readOnce(reads, catalog, () => coversCheckedIn(catalog, inForce))
}

function coversCheckedIn(catalog: Catalog, inForce: readonly CoverRelation[]): Covers {
  return coversByCoveredRule([...catalog.rules.values()].flatMap((covered) => coverPairsOf(covered, inForce, catalog)))
}

function coversByCoveredRule(pairs: readonly CoverPair[]): Covers {
  const byCovered = groupBy(pairs, ({ covered }) => covered)
  return new Map([...byCovered].map(([covered, pairsOfIt]) => [covered, pairsOfIt.map(({ cover }) => cover)]))
}

function coverPairsOf(covered: RuleRoute, inForce: readonly CoverRelation[], catalog: Catalog): CoverPair[] {
  return inForce.flatMap((relation) => coverPairOf(covered, relation, inForce, catalog))
}

function coverPairOf(covered: RuleRoute, relation: CoverRelation, inForce: readonly CoverRelation[], catalog: Catalog): CoverPair[] {
  const coverId = covered.shipped === null ? null : relation.coverOf(covered.shipped)
  if (coverId === null) return []
  const cover = routeOf(coverId, catalog)
  if (!isCoverAsTheDataGuarantees(covered, cover, relation, inForce)) {
    throw new Error(`${covered.id}: ${relation.named} ${cover.id}, so both ship in a ruleset${routingRequiredBy(relation)} and ${cover.id} is another rule, covered by none`)
  }
  return [{ covered: covered.id, cover: cover.id }]
}

/** An always-on or suppression rule would be on whatever is listed, and a chain would leave a rule out for a cover that is left out itself. */
function isCoverAsTheDataGuarantees(covered: RuleRoute, cover: RuleRoute, relation: CoverRelation, inForce: readonly CoverRelation[]): boolean {
  return areRoutedAsTheRelationRequires(covered, cover, relation) && shipsInARuleset(covered) && shipsInARuleset(cover) && isCoveredByNone(cover, inForce)
}

function areRoutedAsTheRelationRequires(covered: RuleRoute, cover: RuleRoute, { bothRoutedTo }: CoverRelation): boolean {
  return bothRoutedTo === null || [covered, cover].every(({ engine }) => engine === bothRoutedTo)
}

function routingRequiredBy({ bothRoutedTo }: CoverRelation): string {
  return bothRoutedTo === null ? '' : `, ${bothRoutedTo} runs both,`
}

function shipsInARuleset({ shipped }: RuleRoute): boolean {
  return shipped !== null && shipped.ruleset !== undefined
}

function isCoveredByNone({ shipped }: RuleRoute, inForce: readonly CoverRelation[]): boolean {
  return shipped === null || inForce.every(({ coverOf }) => coverOf(shipped) === null)
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

/**
 * Options the entry writes are used as written. A severity alone takes the options in force in its files,
 * settled there already (as the top-level `rules` write them, or trimmed); only a rule off there falls back
 * to its shipped options, which are trimmed for those files.
 */
function entryRulesOf(rules: RuleSettingsInput, entryRulesOn: RuleSettings, catalog: Catalog): RuleSettings {
  function hasOptionsSettled(id: string): boolean {
    return isWrittenWithOptions(rules, id) || Object.hasOwn(entryRulesOn, id)
  }
  return withAllowancesWhereTheirRulesRun(entryRuleSettings(rules, entryRulesOn, catalog), hasOptionsSettled, entryRulesOn, catalog)
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
): Pick<RuleSetting, 'severity'> & OptionsOfASetting {
  const severity = severityOf(entry)
  if (severity === 'off') return { severity, options: [] }
  const optionsGiven = optionsGivenBy(entry)
  if (optionsGiven === null) return { severity, ...optionsInForce(id, inForce, catalog) }
  return { severity, options: optionsGiven }
}

/** What a severity alone keeps: the options already set for the rule, in each of its files, else its shipped ones. */
function optionsInForce(id: string, inForce: RuleSettings, catalog: Catalog): OptionsOfASetting {
  const current = inForce[id]
  if (current !== undefined) return optionsOf(current)
  const { shipped } = routeOf(id, catalog)
  return { options: shipped === null ? [] : shipped.options }
}

function optionsOf({ options, optionsInFiles }: RuleSetting): OptionsOfASetting {
  return optionsInFiles === undefined ? { options } : { options, optionsInFiles }
}

function rulesetChanges(
  topLevelRulesOn: RuleSettings,
  entryRulesOn: RuleSettings,
  restatedRuleIds: readonly string[],
): RuleSettings {
  const changed = ruleIdsSetDifferently(topLevelRulesOn, entryRulesOn)
  return Object.fromEntries(
    [...changed, ...restatedRuleIds].map((id): SettingEntry => [id, settingUnder(entryRulesOn, id)]),
  )
}

/** Each rule on in one layer alone, or on in both with other options: an entry left to a rule the lists switch. */
function ruleIdsSetDifferently(topLevelRulesOn: RuleSettings, entryRulesOn: RuleSettings): string[] {
  const ruleIdsOnInEither = new Set([...Object.keys(topLevelRulesOn), ...Object.keys(entryRulesOn)])
  return [...ruleIdsOnInEither].filter((id) => !isDeepStrictEqual(topLevelRulesOn[id], entryRulesOn[id]))
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
