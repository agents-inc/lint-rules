// What `agents-inc.lint.mts` exports. Nothing here may import a plugin, the parser, `globals`, typescript-eslint,
// `@eslint/compat` or import-x: a team's oxlint config imports the parts and must not load ESLint's side.

import { type Catalog, isOxlintRoute, routeOf, type RuleRoute } from '@workspace/rule-data'
import { WITHHELD_FIXES } from '../cli/check/withheld-fixes.ts'
import { isEslintRoute, isSuppressionRoute } from './catalog-lookups.ts'
import { isRecord } from './is-record.ts'
import { type FileOverrideInput, type LintRulesInput, projectedOnto, type TwoSetLintRulesInput } from './lint-rules-input.ts'
import {
  layersKeepingRules,
  layersWithEachRuleMap,
  type RuleLayers,
  type RuleSetting,
  type RuleSettings,
  resolveRuleLayers,
  resolveRuleLayersBesideOxlint,
  ruleIdsOnIn,
  type StatedRule,
} from './resolve-rule-layers.ts'
import { layersWithEachTwinPairDecidedBesideOxlint } from './twin-pairs.ts'

export type EslintPart = {
  /** A team's eslint.config.mjs is untyped JS, so mergeEslintConfig reads this to check it was handed this part. mergeOxlintConfig's part is checked by its type alone. */
  readonly engine: 'eslint'
  readonly tsconfigRootDir: string
  readonly usesOxlint: boolean
  /** Suppressions allowed; every rule map holds the rules ESLint runs here. */
  readonly layers: RuleLayers
  /** Beside oxlint, the oxlint part's layers, so the merge can turn off extensions where oxlint runs their core rule. Without oxlint, empty. */
  readonly oxlintLayers: RuleLayers
}

/** Present only where the project lists oxlint. */
export type OxlintPart = {
  readonly engine: 'oxlint'
  readonly tsconfigRootDir: string
  /** Suppressions allowed; every rule map holds only oxlint-routed rules. */
  readonly layers: RuleLayers
  /** Sorted. Where the team leaves correctness out, oxlint's default would run its copy beside ESLint's, so the merge turns that copy off. */
  readonly turnedOnInEslint: readonly string[]
}

export type EditorParts = { readonly eslint: EslintPart; readonly oxlint: OxlintPart | undefined }

export function isEslintPart(given: unknown): given is EslintPart {
  return isRecord(given) && given['engine'] === 'eslint'
}

export function isOxlintPart(given: unknown): given is OxlintPart {
  return isRecord(given) && given['engine'] === 'oxlint'
}

export function editorPartsOf(lintRules: TwoSetLintRulesInput, catalog: Readonly<Catalog>, usesOxlint: boolean): EditorParts {
  const settings = editorSettingsOf(lintRules)
  const editorCatalog = catalogWithEditorRulesets(catalog)
  const { tsconfigRootDir } = lintRules
  return usesOxlint
    ? partsBesideOxlint(tsconfigRootDir, resolveRuleLayersBesideOxlint(settings, editorCatalog), catalog)
    : partsWithoutOxlint(tsconfigRootDir, resolveRuleLayers(settings, editorCatalog), catalog)
}

/** Nothing is in a team's editor config unless its editor rulesets list it, so the editor parts run a rule `allowSuppressions` decides as a rule of its editor ruleset, where it has one. */
function catalogWithEditorRulesets(catalog: Readonly<Catalog>): Catalog {
  return { ...catalog, rules: new Map(catalog.rules.entries().map(([id, route]) => [id, routeInEditors(route)])) }
}

/** At its setting while suppressions are allowed, as they always are in the editor parts. One that setting turns off stays as it is: off in every editor. */
function routeInEditors(route: RuleRoute): RuleRoute {
  if (!isSuppressionRoute(route)) return route
  const { whenSuppressions: { allowed }, editorRuleset, ...shipped } = route.shipped
  if (editorRuleset === undefined || allowed === 'off') return route
  return { ...route, shipped: { ...shipped, ruleset: editorRuleset, options: allowed.options } }
}

function partsWithoutOxlint(tsconfigRootDir: string, layers: RuleLayers, catalog: Readonly<Catalog>): EditorParts {
  // eslint-disable-next-line sonarjs/no-undefined-assignment -- TS2741 left out and TS2322 as null: EditorParts, which dist declares, holds oxlint as a required OxlintPart | undefined
  return { eslint: eslintPartWithoutOxlint(tsconfigRootDir, layers, catalog), oxlint: undefined }
}

/** Suppressions are allowed everywhere in the editor set: people may keep theirs, only sub-agents may not. */
function editorSettingsOf(lintRules: TwoSetLintRulesInput): LintRulesInput {
  const projected = projectedOnto('editorRulesets', lintRules)
  const { fileOverrides } = projected
  if (fileOverrides === undefined) return { ...projected, allowSuppressions: true }
  return { ...projected, allowSuppressions: true, fileOverrides: fileOverrides.map(withoutItsSuppressionSetting) }
}

function withoutItsSuppressionSetting({ allowSuppressions, ...entry }: FileOverrideInput): FileOverrideInput {
  return entry
}

/** A rule a part only turns off is the team's to set in the other engine: our off removes only ours. */
function partsBesideOxlint(tsconfigRootDir: string, resolved: RuleLayers, catalog: Readonly<Catalog>): EditorParts {
  const layers = layersWithEachTwinPairDecidedBesideOxlint(resolved, catalog)
  const eslintLayers = layersKeepingRules(layers, ({ id }) => runsInEslintBesideOxlint(id, catalog))
  const oxlintLayers = layersKeepingRules(layers, ({ id }) => !runsInEslintBesideOxlint(id, catalog))
  return {
    eslint: { engine: 'eslint', tsconfigRootDir, usesOxlint: true, layers: eslintLayers, oxlintLayers },
    oxlint: { engine: 'oxlint', tsconfigRootDir, layers: oxlintLayers, turnedOnInEslint: ruleIdsOnIn(eslintLayers) },
  }
}

/** Without oxlint, ESLint takes over each oxlint-routed rule it has a version of, unless the skip list names it; some oxlint-only rules get an ESLint stand-in. A rule left unstated keeps the team's setting. */
function eslintPartWithoutOxlint(tsconfigRootDir: string, layers: RuleLayers, catalog: Readonly<Catalog>): EslintPart {
  const standIns = standInsIn(catalog)
  const layersWithStandIns = layersWithEachRuleMap(layers, (settings) => withStandIns(settings, standIns))
  return {
    engine: 'eslint',
    tsconfigRootDir,
    usesOxlint: false,
    layers: layersKeepingRules(layersWithStandIns, (rule) => runsInEslintWithoutOxlint(rule, catalog)),
    oxlintLayers: layersKeepingRules(layers, keepsNoRule),
  }
}

/** A stand-in takes its rule's severity, files and ignores, but not its options, which are the oxc rule's. Where the map states the stand-in itself, that setting stands. */
function withStandIns(settings: RuleSettings, standIns: ReadonlyMap<string, string>): RuleSettings {
  const standInSettings = Object.entries(settings).flatMap(([id, setting]) => standInSettingFor(id, setting, settings, standIns))
  return { ...settings, ...Object.fromEntries(standInSettings) }
}

/** None where the rule has no stand-in, or the map states the stand-in itself. */
function standInSettingFor(id: string, setting: RuleSetting, settings: RuleSettings, standIns: ReadonlyMap<string, string>): Array<[string, RuleSetting]> {
  const standIn = standIns.get(id)
  return standIn === undefined || Object.hasOwn(settings, standIn) ? [] : [[standIn, { ...setting, options: [] }]]
}

/** Throws on bad data: a stand-in must be a rule ESLint runs untyped, that we do not ship, standing in for one rule only, or it would report twice, run nowhere, or take one setting for two rules. */
function standInsIn(catalog: Readonly<Catalog>): ReadonlyMap<string, string> {
  const breach = [...catalog.eslintStandIns].find(([oxlintOnly, standIn]) => !isStandInAsTheDataGuarantees(oxlintOnly, standIn, catalog))
  if (breach !== undefined) {
    const [oxlintOnly, standIn] = breach
    throw new Error(`${oxlintOnly}: stood in for by ${standIn}, so ${oxlintOnly} is a rule oxlint alone runs, and ${standIn} an untyped rule ESLint runs, not shipped, standing in for it alone`)
  }
  return catalog.eslintStandIns
}

function isStandInAsTheDataGuarantees(oxlintOnly: string, standIn: string, catalog: Readonly<Catalog>): boolean {
  return isRunByOxlintAlone(oxlintOnly, catalog) && canStandIn(standIn, catalog) && standsInForOneRule(standIn, catalog)
}

function isRunByOxlintAlone(ruleId: string, catalog: Readonly<Catalog>): boolean {
  return isOxlintRoute(routeOf(ruleId, catalog)) && !catalog.ruleIdsWithAnEslintVersion.has(ruleId)
}

function canStandIn(ruleId: string, catalog: Readonly<Catalog>): boolean {
  const route = routeOf(ruleId, catalog)
  return isEslintRoute(route) && !route.typed && route.shipped === null
}

function standsInForOneRule(standIn: string, catalog: Readonly<Catalog>): boolean {
  return catalog.eslintStandIns.values().filter((each) => each === standIn).toArray().length === 1
}

function keepsNoRule(): boolean {
  return false
}

function runsInEslintWithoutOxlint({ id }: StatedRule, catalog: Readonly<Catalog>): boolean {
  return isEslintRoute(routeOf(id, catalog)) || canEslintTakeOver(id, catalog)
}

/** oxlint's editor integration offers each fix it has, and its config cannot drop one rule's (1.87), so ESLint, whose merge leaves fixes out, takes over each oxlint rule whose fix check withholds. */
function runsInEslintBesideOxlint(ruleId: string, catalog: Readonly<Catalog>): boolean {
  return isEslintRoute(routeOf(ruleId, catalog)) || (WITHHELD_FIXES.has(ruleId) && canEslintTakeOver(ruleId, catalog))
}

function canEslintTakeOver(ruleId: string, catalog: Readonly<Catalog>): boolean {
  return catalog.ruleIdsWithAnEslintVersion.has(ruleId) && !catalog.eslintFallbackSkips.has(ruleId)
}
