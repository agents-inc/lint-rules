import type { Catalog, RuleRoute } from '@workspace/rule-data'
import { optionKeysOxlintRefuses } from '@workspace/rule-data/oxlint-refused-options'
import { currentExtensionsOf, isOxlintRoute, routeOf, twinsOf } from './catalog-lookups.ts'
import { TS_FILES } from './eslint-file-types.ts'
import { isRecord } from './is-record.ts'
import type { LintRulesInput } from './lint-rules-input.ts'
import {
  type FileOverrideLayer,
  type RuleLayers,
  type RuleSetting,
  type RuleSettings,
  resolveRuleLayers,
  shippedScopeOf,
  suppressionRulesOf,
  tsFileRulesOf,
} from './resolve-rule-layers.ts'

// A core rule routed to oxlint and typescript-eslint's current extension of it are one rule to a
// layer of ours (D9, D10; #41, q35): the highest part of the layer stating either name decides the
// pair. Without oxlint, ESLint runs the extension on TS files and the core rule on the rest; beside
// oxlint, oxlint runs the core rule and ESLint's copies are off there (D10). Engine-neutral, so the
// editor parts read it without loading ESLint's side.

/** What one layer of ours states: its settings, its upper part's over its lower's, and every rule its upper part states, at any severity. */
export type LayerStatements = { readonly settings: RuleSettings; readonly statedAbove: ReadonlySet<string> }

/** A rule's two names, as D9 reads them: the core rule routed to oxlint, and typescript-eslint's extension of it. */
export type TwinPair = { readonly core: RuleRoute; readonly extension: RuleRoute }

/** Which names the deciding part of a layer states. */
export type DecidingPart = { readonly decidesTheExtension: boolean; readonly decidesTheCore: boolean }

const OFF_SETTING: RuleSetting = { severity: 'off', options: [], files: null, ignores: null }
// Off in the TS files alone of the layer stating it, which oxlint writes as an override of its own.
const OFF_ON_TS_FILES: RuleSetting = { ...OFF_SETTING, files: [TS_FILES] }

/**
 * The top level as D9 reads it: the rulesets, and above them the consumer's `rules`, which the
 * top-level settings drop where they turn a rule off. Nothing lies below it.
 */
export function topLevelStatements(layers: RuleLayers): LayerStatements {
  return { settings: layers.rules, statedAbove: new Set(layers.statedInRules) }
}

/**
 * An entry as D9 reads it: its ruleset changes and the rules its `allowSuppressions` sets, and above
 * them its own `rules`. The rules `allowSuppressions` sets are disjoint from both, since no ruleset
 * or `rules` sets them.
 */
export function entryStatements(layer: FileOverrideLayer): LayerStatements {
  return { settings: { ...layer.rulesetChanges, ...suppressionRulesOf(layer), ...layer.rules }, statedAbove: new Set(Object.keys(layer.rules)) }
}

/** Each core rule routed to oxlint that the layer states under either name, at any severity, paired with each extension of it. */
export function twinPairsNamedIn(layer: LayerStatements, catalog: Catalog): TwinPair[] {
  const named = [...new Set([...Object.keys(layer.settings), ...layer.statedAbove])].map((id) => routeOf(id, catalog))
  const cores = eachOnce(named.flatMap((route) => coreRulesNamedBy(route, catalog)))
  return cores.flatMap((core) => extensionsOfACoreRuleRoutedToOxlint(core, catalog).map((extension) => ({ core, extension })))
}

/** The layer's setting of the rule, an off its upper part states and its settings drop included: null where it states none. */
export function statedIn({ settings, statedAbove }: LayerStatements, ruleId: string): RuleSetting | null {
  const setting = settings[ruleId]
  if (setting !== undefined) return setting
  return statedAbove.has(ruleId) ? OFF_SETTING : null
}

/** Which names the highest part of the layer stating either one states: its upper part, where that states either, else its lower. */
export function whatTheDecidingPartStates({ core, extension }: TwinPair, layer: LayerStatements): DecidingPart {
  const aboveStatesEither = layer.statedAbove.has(core.id) || layer.statedAbove.has(extension.id)
  if (aboveStatesEither) return { decidesTheExtension: layer.statedAbove.has(extension.id), decidesTheCore: layer.statedAbove.has(core.id) }
  return { decidesTheExtension: Object.hasOwn(layer.settings, extension.id), decidesTheCore: Object.hasOwn(layer.settings, core.id) }
}

/**
 * typescript-eslint's current extensions of a core rule routed to oxlint, which run in its place on
 * TS files where no oxlint runs. None for an ESLint-routed rule (O12).
 */
export function extensionsOfACoreRuleRoutedToOxlint(route: RuleRoute, catalog: Catalog): RuleRoute[] {
  if (!isOxlintRoute(route)) return []
  return currentExtensionsOf(route, catalog).map((id) => routeOf(id, catalog))
}

/** Each rule once, in the order first met. */
function eachOnce(routes: readonly RuleRoute[]): RuleRoute[] {
  return [...new Map(routes.map((route) => [route.id, route])).values()]
}

/** The rule itself, where it is a core rule routed to oxlint with an extension; each such core rule it extends, where it is an extension. */
function coreRulesNamedBy(route: RuleRoute, catalog: Catalog): RuleRoute[] {
  if (extensionsOfACoreRuleRoutedToOxlint(route, catalog).length > 0) return [route]
  return twinsOf(route, catalog)
    .map((id) => routeOf(id, catalog))
    .filter((core) => extensionsOfACoreRuleRoutedToOxlint(core, catalog).some(({ id }) => id === route.id))
}

/** The agent build's layers: sub-agents always run oxlint, so each twin pair is decided as beside oxlint (D10, q35). */
export function agentBuildLayersOf(lintRules: LintRulesInput, catalog: Catalog): RuleLayers {
  return layersWithEachTwinPairDecidedBesideOxlint(resolveRuleLayers(lintRules, catalog), catalog)
}

/**
 * The layers beside oxlint, each twin pair as its deciding part states it in both engines (D10):
 * where that part states the extension alone, oxlint's core rule takes the extension's setting in
 * the layer, its own files and ignores kept, wherever the core rule is in force there; where it
 * states the core rule alone, off, the extension is off in the layer too. Oxlint then runs the pair
 * where it runs the core rule, and the ESLint merge turns the extension off there (D10). Where the
 * extension's setting carries options oxlint's copy refuses or does not honour, ESLint runs it on
 * the layer's TS files and oxlint's copy is off there, the core rule keeping the setting below it
 * elsewhere (D11). Where that part states both names, TS files take the extension's setting and the
 * rest the core rule's (D9): the core rule keeps its own in the layer, and takes the extension's on
 * the layer's TS files alone (`tsFileRules`), but is off there where oxlint refuses or does not
 * honour an option of it (D11); the extension runs on those TS files alone, off in the rest of the
 * layer.
 */
export function layersWithEachTwinPairDecidedBesideOxlint(layers: RuleLayers, catalog: Catalog): RuleLayers {
  const topLevel = topLevelWithEachPairDecided(layers, catalog)
  return { ...layers, ...topLevel, fileOverrides: layers.fileOverrides.map((layer) => entryWithEachPairDecided(layer, topLevel, catalog)) }
}

/** The top level's rules with each pair it names decided, a rule in force where the top level states it. */
function topLevelWithEachPairDecided(layers: RuleLayers, catalog: Catalog): DecidedRules {
  const topLevel = topLevelStatements(layers)
  const inForce = (ruleId: string): boolean => statedIn(topLevel, ruleId) !== null
  return rulesWithEachPairDecided(layers.rules, pairsDecidedIn(topLevel, catalog), { inForce, offs: 'left out' })
}

/** The entry's own rules with each pair it names decided, a rule in force where the entry states it or the top level runs it. */
function entryWithEachPairDecided(layer: FileOverrideLayer, topLevel: DecidedRules, catalog: Catalog): FileOverrideLayer {
  const entry = entryStatements(layer)
  const inForce = (ruleId: string): boolean => statedIn(entry, ruleId) !== null || runsAtTheTopLevel(topLevel, ruleId)
  return { ...layer, ...rulesWithEachPairDecided(layer.rules, pairsDecidedIn(entry, catalog), { inForce, offs: 'stated' }) }
}

/**
 * Whether the top level runs the rule: in all its files, where its rules hold only those turned on,
 * or on its TS files alone, as it runs each name of a pair it states both of.
 */
function runsAtTheTopLevel(topLevel: DecidedRules, ruleId: string): boolean {
  const onTsFiles = tsFileRulesOf(topLevel)[ruleId]
  return Object.hasOwn(topLevel.rules, ruleId) || (onTsFiles !== undefined && onTsFiles.severity !== 'off')
}

/** A layer's rules with each pair decided: for all its files, and for its TS files alone, left out where it gives them none. */
type DecidedRules = Pick<RuleLayers, 'rules' | 'tsFileRules'>

/** A layer's rules as each decision is taken. */
type RulesTaken = { readonly rules: RuleSettings; readonly tsFileRules: RuleSettings }

/** A twin pair one name of which its layer's deciding part states alone, and the setting it states. */
type DecidedByOneName = { readonly pair: TwinPair; readonly by: 'the extension' | 'the core rule'; readonly setting: RuleSetting }

/** A twin pair both names of which its layer's deciding part states, and the extension's setting there, which decides on TS files. */
type DecidedByBothNames = { readonly pair: TwinPair; readonly by: 'both names'; readonly setting: RuleSetting }

type PairDecided = DecidedByOneName | DecidedByBothNames

/** How a layer's settings take a decision: which rules are in force there, and whether an off is stated, as in an entry, or left out, as at the top level. */
type SettingsTaking = { readonly inForce: (ruleId: string) => boolean; readonly offs: 'stated' | 'left out' }

/** Each twin pair the layer names whose deciding part states either name, with the setting deciding it. */
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

/** The names the deciding part states: none where it states neither, as a core rule's other extension in a layer naming one. */
function namesDeciding({ decidesTheExtension, decidesTheCore }: DecidingPart): PairDecided['by'] | null {
  if (decidesTheExtension && decidesTheCore) return 'both names'
  if (decidesTheExtension) return 'the extension'
  return decidesTheCore ? 'the core rule' : null
}

/** The rules with each decision taken: the core rule given the extension's setting, in the layer or on its TS files, or the extension turned off with the core rule. */
function rulesWithEachPairDecided(rules: RuleSettings, decided: readonly PairDecided[], taking: SettingsTaking): DecidedRules {
  const taken = decided.reduce<RulesTaken>((takenSoFar, decision) => rulesTaking(takenSoFar, decision, taking), { rules, tsFileRules: {} })
  return Object.keys(taken.tsFileRules).length === 0 ? { rules: taken.rules } : taken
}

function rulesTaking(taken: RulesTaken, decision: PairDecided, taking: SettingsTaking): RulesTaken {
  if (decision.by === 'both names') return rulesTakingBothNames(taken, decision, taking.offs)
  return { ...taken, rules: settingsTaking(taken.rules, decision, taking) }
}

/**
 * A layer stating both names gives its TS files the extension's setting and the rest the core
 * rule's (D9). The core rule keeps its own setting in the layer and takes the extension's on the
 * layer's TS files. The extension runs on those TS files alone: it is off in the layer's other files,
 * which the core rule's setting decides, though oxlint may run no core rule there to turn ESLint's
 * extension off (fix round 3's review, "Owner decisions" 1).
 */
function rulesTakingBothNames(taken: RulesTaken, { pair: { core, extension }, setting }: DecidedByBothNames, offs: SettingsTaking['offs']): RulesTaken {
  return {
    rules: withSetting(taken.rules, extension.id, OFF_SETTING, offs),
    tsFileRules: { ...taken.tsFileRules, [core.id]: coreSettingOnTsFiles(core, setting), ...extensionOnTsFiles(extension, setting) },
  }
}

/** The extension at its setting on the layer's TS files: none where it is off, as it is in all of the layer's files. */
function extensionOnTsFiles(extension: RuleRoute, setting: RuleSetting): RuleSettings {
  return setting.severity === 'off' ? {} : { [extension.id]: setting }
}

/**
 * The core rule on the TS files of a layer stating both names: at the extension's setting, its own
 * files and ignores kept, but off where oxlint refuses or does not honour an option of it, as ESLint
 * runs the extension there (D11).
 */
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

/**
 * The settings with oxlint's core rule off on the layer's TS files, where ESLint runs the
 * extension's setting, and elsewhere as it is below (D11). The top level, which states only rules
 * turned on, keeps its own setting of the core rule out of the TS files as it keeps it out of its
 * ignores; an entry states the core rule off in its TS files alone.
 */
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

/**
 * Whether an option of the setting holds a key oxlint refuses for the core rule, which would make it
 * load no part of the config, or does not honour, which would drop the setting silently (D11).
 */
function oxlintRefusesAnOptionOf({ options }: RuleSetting, core: RuleRoute): boolean {
  if (!isOxlintRoute(core)) throw new Error(`${core.id}: a core rule of a twin pair is routed to oxlint`)
  const refusedKeys = optionKeysOxlintRefuses(core.oxlintName)
  return options.some((option) => isRecord(option) && Object.keys(option).some((key) => refusedKeys.includes(key)))
}

/** The settings with the rule at the setting given: an off left out where offs are, as the top level holds only rules turned on. */
function withSetting(settings: RuleSettings, ruleId: string, setting: RuleSetting, offs: SettingsTaking['offs']): RuleSettings {
  if (setting.severity === 'off' && offs === 'left out') return Object.fromEntries(Object.entries(settings).filter(([id]) => id !== ruleId))
  return { ...settings, [ruleId]: setting }
}
