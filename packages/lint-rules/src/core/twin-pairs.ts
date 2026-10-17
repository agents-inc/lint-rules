import { type Catalog, isOxlintRoute, routeOf, type RuleRoute } from '@workspace/rule-data'
import { optionKeysOxlintRefuses } from '@workspace/rule-data/oxlint-refused-options'
import { currentExtensionsOf, twinsOf } from './catalog-lookups.ts'
import { TS_FILES } from './eslint-file-types.ts'
import { isRecord } from './is-record.ts'
import type { LintRulesInput } from './lint-rules-input.ts'
import {
  type FileOverrideLayer,
  OFF_SETTING,
  type RuleLayers,
  type RuleSetting,
  type RuleSettings,
  resolveRuleLayers,
  settingsWithout,
  shippedScopeOf,
  suppressionRulesOf,
  tsFileRulesOf,
} from './resolve-rule-layers.ts'

// A core rule routed to oxlint and typescript-eslint's extension of it are one rule to a layer: the
// highest part of the layer stating either name decides the pair. Engine-neutral, so the editor parts
// read it without loading ESLint.

/** `statedAbove` is every rule the layer's upper part (the consumer's `rules`) states, at any severity. */
export type LayerStatements = { readonly settings: RuleSettings; readonly statedAbove: ReadonlySet<string> }

export type TwinPair = { readonly core: RuleRoute; readonly extension: RuleRoute }

export type DecidingPart = { readonly decidesTheExtension: boolean; readonly decidesTheCore: boolean }

// Off in the TS files alone of the layer stating it, which oxlint writes as an override of its own.
const OFF_ON_TS_FILES: RuleSetting = { ...OFF_SETTING, files: [TS_FILES] }

/** The rulesets, and above them the consumer's `rules`. Nothing lies below it. */
export function topLevelStatements(layers: RuleLayers): LayerStatements {
  return { settings: layers.rules, statedAbove: new Set(layers.statedInRules) }
}

/** Its ruleset changes and suppression rules, and above them its own `rules`. */
export function entryStatements(layer: FileOverrideLayer): LayerStatements {
  return { settings: { ...layer.rulesetChanges, ...suppressionRulesOf(layer), ...layer.rules }, statedAbove: new Set(Object.keys(layer.rules)) }
}

export function twinPairsNamedIn(layer: LayerStatements, catalog: Catalog): TwinPair[] {
  const named = [...new Set([...Object.keys(layer.settings), ...layer.statedAbove])].map((id) => routeOf(id, catalog))
  const cores = eachOnce(named.flatMap((route) => coreRulesNamedBy(route, catalog)))
  return cores.flatMap((core) => extensionsOfACoreRuleRoutedToOxlint(core, catalog).map((extension) => ({ core, extension })))
}

/** An off its upper part states counts, even where its settings drop it. */
export function statedIn({ settings, statedAbove }: LayerStatements, ruleId: string): RuleSetting | null {
  const setting = settings[ruleId]
  if (setting !== undefined) return setting
  return statedAbove.has(ruleId) ? OFF_SETTING : null
}

/** Its upper part, where that states either name, else its lower. */
export function whatTheDecidingPartStates({ core, extension }: TwinPair, layer: LayerStatements): DecidingPart {
  const aboveStatesEither = layer.statedAbove.has(core.id) || layer.statedAbove.has(extension.id)
  if (aboveStatesEither) return { decidesTheExtension: layer.statedAbove.has(extension.id), decidesTheCore: layer.statedAbove.has(core.id) }
  return { decidesTheExtension: Object.hasOwn(layer.settings, extension.id), decidesTheCore: Object.hasOwn(layer.settings, core.id) }
}

/** None for an ESLint-routed rule. */
export function extensionsOfACoreRuleRoutedToOxlint(route: RuleRoute, catalog: Catalog): RuleRoute[] {
  if (!isOxlintRoute(route)) return []
  return currentExtensionsOf(route, catalog).map((id) => routeOf(id, catalog))
}

function eachOnce(routes: readonly RuleRoute[]): RuleRoute[] {
  return [...new Map(routes.map((route) => [route.id, route])).values()]
}

/** The rule itself where it is such a core rule; each core rule it extends where it is an extension. */
function coreRulesNamedBy(route: RuleRoute, catalog: Catalog): RuleRoute[] {
  if (extensionsOfACoreRuleRoutedToOxlint(route, catalog).length > 0) return [route]
  return twinsOf(route, catalog)
    .map((id) => routeOf(id, catalog))
    .filter((core) => extensionsOfACoreRuleRoutedToOxlint(core, catalog).some(({ id }) => id === route.id))
}

/** Sub-agents always run oxlint, so each twin pair is decided as beside oxlint. */
export function agentBuildLayersOf(lintRules: LintRulesInput, catalog: Catalog): RuleLayers {
  return layersWithEachTwinPairDecidedBesideOxlint(resolveRuleLayers(lintRules, catalog), catalog)
}

/** Beside oxlint, oxlint runs the pair where it runs the core rule. Where the deciding part states one name, the other takes its setting; where it states both, TS files take the extension's setting and the rest the core rule's. Where oxlint refuses or ignores an option, ESLint runs the extension on TS files instead. */
export function layersWithEachTwinPairDecidedBesideOxlint(layers: RuleLayers, catalog: Catalog): RuleLayers {
  const topLevel = topLevelWithEachPairDecided(layers, catalog)
  return { ...layers, ...topLevel, fileOverrides: layers.fileOverrides.map((layer) => entryWithEachPairDecided(layer, topLevel, catalog)) }
}

function topLevelWithEachPairDecided(layers: RuleLayers, catalog: Catalog): DecidedRules {
  const topLevel = topLevelStatements(layers)
  const inForce = (ruleId: string): boolean => statedIn(topLevel, ruleId) !== null
  return rulesWithEachPairDecided(layers.rules, pairsDecidedIn(topLevel, catalog), { inForce, offs: 'left out' })
}

function entryWithEachPairDecided(layer: FileOverrideLayer, topLevel: DecidedRules, catalog: Catalog): FileOverrideLayer {
  const entry = entryStatements(layer)
  const inForce = (ruleId: string): boolean => statedIn(entry, ruleId) !== null || runsAtTheTopLevel(topLevel, ruleId)
  return { ...layer, ...rulesWithEachPairDecided(layer.rules, pairsDecidedIn(entry, catalog), { inForce, offs: 'stated' }) }
}

/** In all its files, or on its TS files alone. */
function runsAtTheTopLevel(topLevel: DecidedRules, ruleId: string): boolean {
  const onTsFiles = tsFileRulesOf(topLevel)[ruleId]
  return Object.hasOwn(topLevel.rules, ruleId) || (onTsFiles !== undefined && onTsFiles.severity !== 'off')
}

type DecidedRules = Pick<RuleLayers, 'rules' | 'tsFileRules'>

type RulesTaken = { readonly rules: RuleSettings; readonly tsFileRules: RuleSettings }

type DecidedByOneName = { readonly pair: TwinPair; readonly by: 'the extension' | 'the core rule'; readonly setting: RuleSetting }

type DecidedByBothNames = { readonly pair: TwinPair; readonly by: 'both names'; readonly setting: RuleSetting }

type PairDecided = DecidedByOneName | DecidedByBothNames

/** `offs` is stated in an entry, left out at the top level. */
type SettingsTaking = { readonly inForce: (ruleId: string) => boolean; readonly offs: 'stated' | 'left out' }

function pairsDecidedIn(layer: LayerStatements, catalog: Catalog): PairDecided[] {
  return twinPairsNamedIn(layer, catalog).flatMap((pair): PairDecided[] => {
    const by = namesDeciding(whatTheDecidingPartStates(pair, layer))
    if (by === null) return []
    const decider = by === 'the core rule' ? pair.core : pair.extension
    const setting = statedIn(layer, decider.id)
    if (setting === null) throw new Error(`${decider.id}: the layer's deciding part states it, so it has a setting there`)
    return [{ pair, by, setting }]
  })
}

/** None where it states neither, as for a core rule's other extension in a layer naming one. */
function namesDeciding({ decidesTheExtension, decidesTheCore }: DecidingPart): PairDecided['by'] | null {
  if (decidesTheExtension && decidesTheCore) return 'both names'
  if (decidesTheExtension) return 'the extension'
  return decidesTheCore ? 'the core rule' : null
}

function rulesWithEachPairDecided(rules: RuleSettings, decided: readonly PairDecided[], taking: SettingsTaking): DecidedRules {
  const taken = decided.reduce<RulesTaken>((takenSoFar, decision) => rulesTaking(takenSoFar, decision, taking), { rules, tsFileRules: {} })
  return Object.keys(taken.tsFileRules).length === 0 ? { rules: taken.rules } : taken
}

function rulesTaking(taken: RulesTaken, decision: PairDecided, taking: SettingsTaking): RulesTaken {
  if (decision.by === 'both names') return rulesTakingBothNames(taken, decision, taking.offs)
  return { ...taken, rules: settingsTaking(taken.rules, decision, taking) }
}

/** The extension runs on the layer's TS files alone and is off in its other files, though oxlint may run no core rule there. */
function rulesTakingBothNames(taken: RulesTaken, { pair: { core, extension }, setting }: DecidedByBothNames, offs: SettingsTaking['offs']): RulesTaken {
  return {
    rules: withSetting(taken.rules, extension.id, OFF_SETTING, offs),
    tsFileRules: { ...taken.tsFileRules, [core.id]: coreSettingOnTsFiles(core, setting), ...extensionOnTsFiles(extension, setting) },
  }
}

/** None where it is off. */
function extensionOnTsFiles(extension: RuleRoute, setting: RuleSetting): RuleSettings {
  return setting.severity === 'off' ? {} : { [extension.id]: setting }
}

/** Off where oxlint refuses or ignores an option of the setting, as ESLint runs the extension there. */
function coreSettingOnTsFiles(core: RuleRoute, extensionSetting: RuleSetting): RuleSetting {
  if (oxlintRefusesAnOptionOf(extensionSetting, core)) return OFF_SETTING
  return { ...extensionSetting, ...shippedScopeOf(core) }
}

function settingsTaking(settings: RuleSettings, { pair: { core, extension }, by, setting }: DecidedByOneName, { inForce, offs }: SettingsTaking): RuleSettings {
  if (by === 'the extension') {
    if (!inForce(core.id)) return settings
    if (oxlintRefusesAnOptionOf(setting, core)) return withTsFilesLeftToEslint(settings, core, offs)
    return withSetting(settings, core.id, { ...setting, ...shippedScopeOf(core) }, offs)
  }
  if (setting.severity !== 'off' || !inForce(extension.id)) return settings
  return withSetting(settings, extension.id, setting, offs)
}

/** The top level holds only rules turned on, so it keeps the core rule out of TS files as it keeps it out of its ignores; an entry states it off there. */
function withTsFilesLeftToEslint(settings: RuleSettings, core: RuleRoute, offs: SettingsTaking['offs']): RuleSettings {
  if (offs === 'stated') return { ...settings, [core.id]: OFF_ON_TS_FILES }
  const topLevelSetting = settings[core.id]
  if (topLevelSetting === undefined) throw new Error(`${core.id}: in force at the top level, so the top level runs it`)
  return { ...settings, [core.id]: withTsFilesIgnored(topLevelSetting) }
}

function withTsFilesIgnored(setting: RuleSetting): RuleSetting {
  const ignores = setting.ignores === null ? [] : setting.ignores
  return { ...setting, ignores: [...ignores, TS_FILES] }
}

/** A refused key makes oxlint load no part of the config; an ignored one would drop the setting silently. */
function oxlintRefusesAnOptionOf({ options }: RuleSetting, core: RuleRoute): boolean {
  if (!isOxlintRoute(core)) throw new Error(`${core.id}: a core rule of a twin pair is routed to oxlint`)
  const refusedKeys = optionKeysOxlintRefuses(core.oxlintName)
  return options.some((option) => isRecord(option) && Object.keys(option).some((key) => refusedKeys.includes(key)))
}

/** At the top level, which holds only rules turned on, an off is left out. */
function withSetting(settings: RuleSettings, ruleId: string, setting: RuleSetting, offs: SettingsTaking['offs']): RuleSettings {
  if (setting.severity === 'off' && offs === 'left out') return settingsWithout(settings, new Set([ruleId]))
  return { ...settings, [ruleId]: setting }
}
