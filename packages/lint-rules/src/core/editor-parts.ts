// The editor set as plain data, one part per engine: what `agents-inc.lint.mts` exports. Nothing
// here may import a plugin, the parser, `globals`, typescript-eslint, `@eslint/compat` or
// import-x: a team's oxlint config imports the parts, and must not load ESLint's side to do it.

import type { Catalog } from '@workspace/rule-data'
import { isEslintRoute, isOxlintRoute, routeOf } from './catalog-lookups.ts'
import { isRecord } from './is-record.ts'
import { type FileOverrideInput, type LintRulesInput, projectedOnto, type TwoSetLintRulesInput } from './lint-rules-input.ts'
import { layersKeepingRules, type RuleLayers, resolveRuleLayers, ruleIdsOnIn, type StatedRule } from './resolve-rule-layers.ts'
import { layersWithEachTwinPairDecidedBesideOxlint } from './twin-pairs.ts'

/** The editor set's ESLint side. The merge turns it into blocks before the team's. */
export type EslintPart = {
  /** A team's config is untyped JS, so each merge checks it was handed its own engine's part. */
  readonly engine: 'eslint'
  readonly tsconfigRootDir: string
  /** Whether the project lists oxlint, which then runs the oxlint-routed rules. */
  readonly usesOxlint: boolean
  /** The editor set resolved, suppressions allowed: every rule map holds the rules ESLint runs here. */
  readonly layers: RuleLayers
  /**
   * Beside oxlint, the oxlint part's layers: after the team's blocks the merge turns each
   * typescript-eslint extension this part runs off where they run a core rule it extends (D10).
   * Without oxlint, layers stating no rule.
   */
  readonly oxlintLayers: RuleLayers
}

/** The editor set's oxlint side, present only where the project lists oxlint. */
export type OxlintPart = {
  readonly engine: 'oxlint'
  readonly tsconfigRootDir: string
  /** The editor set resolved, suppressions allowed: every rule map holds only oxlint-routed rules. */
  readonly layers: RuleLayers
  /**
   * Each rule the ESLint part turns on, in any file, sorted. Where the team's config leaves
   * correctness out, oxlint's own `correctness: warn` would run its copy of one beside ESLint's, so
   * the merge turns that copy off.
   */
  readonly turnedOnInEslint: readonly string[]
}

export type EditorParts = { readonly eslint: EslintPart; readonly oxlint: OxlintPart | undefined }

/** Whether a value a team's config hands a merge is the ESLint part `defineLintRules` made. */
export function isEslintPart(given: unknown): given is EslintPart {
  return isRecord(given) && given['engine'] === 'eslint'
}

/** Whether a value a team's config hands a merge is the oxlint part `defineLintRules` made. */
export function isOxlintPart(given: unknown): given is OxlintPart {
  return isRecord(given) && given['engine'] === 'oxlint'
}

/** What a team's config handed a merge instead of its part, for the error that refuses it. */
export function describePartGiven(given: unknown): string {
  if (isEslintPart(given)) return 'its eslint part'
  if (isOxlintPart(given)) return 'its oxlint part'
  return 'a value that is neither of its parts'
}

export function editorPartsOf(lintRules: TwoSetLintRulesInput, catalog: Catalog, usesOxlint: boolean): EditorParts {
  const layers = resolveRuleLayers(editorSettingsOf(lintRules), catalog)
  const { tsconfigRootDir } = lintRules
  return usesOxlint
    ? partsBesideOxlint(tsconfigRootDir, layers, catalog)
    : { eslint: eslintPartWithoutOxlint(tsconfigRootDir, layers, catalog), oxlint: undefined }
}

/**
 * The editor set as the core's single set, with suppressions allowed everywhere, whatever
 * `allowSuppressions` says: people may keep their suppressions, only sub-agents may not (owner,
 * 2026-10-11).
 */
function editorSettingsOf(lintRules: TwoSetLintRulesInput): LintRulesInput {
  const projected = projectedOnto('editorRulesets', lintRules)
  const { fileOverrides } = projected
  if (fileOverrides === undefined) return { ...projected, allowSuppressions: true }
  return { ...projected, allowSuppressions: true, fileOverrides: fileOverrides.map(withoutItsSuppressionSetting) }
}

/** An entry's `allowSuppressions` decides for sub-agents only, so the editor set drops it. */
function withoutItsSuppressionSetting({ allowSuppressions, ...entry }: FileOverrideInput): FileOverrideInput {
  return entry
}

/**
 * oxlint runs the oxlint-routed rules and ESLint the rest. A rule a part only turns off is the
 * team's to set in the other engine: our off removes only ours (questions.md #42). A core rule and
 * typescript-eslint's extension of it are one rule to each layer, its deciding part setting both (D10).
 */
function partsBesideOxlint(tsconfigRootDir: string, resolved: RuleLayers, catalog: Catalog): EditorParts {
  const layers = layersWithEachTwinPairDecidedBesideOxlint(resolved, catalog)
  const eslintLayers = layersKeepingRules(layers, ({ id }) => isEslintRoute(routeOf(id, catalog)))
  const oxlintLayers = layersKeepingRules(layers, ({ id }) => isOxlintRoute(routeOf(id, catalog)))
  return {
    eslint: { engine: 'eslint', tsconfigRootDir, usesOxlint: true, layers: eslintLayers, oxlintLayers },
    oxlint: { engine: 'oxlint', tsconfigRootDir, layers: oxlintLayers, turnedOnInEslint: ruleIdsOnIn(eslintLayers) },
  }
}

/**
 * Without oxlint, ESLint also takes over each oxlint-routed rule it has a version of, unless the
 * skip list names it: one whose fixture does not fire in ESLint, or one the owner decided against.
 * A rule ESLint has no version of, or a skipped one, is not stated, so the team's setting stands.
 * No rule runs in another engine, so nothing is stated off after the team's blocks.
 */
function eslintPartWithoutOxlint(tsconfigRootDir: string, layers: RuleLayers, catalog: Catalog): EslintPart {
  return {
    engine: 'eslint',
    tsconfigRootDir,
    usesOxlint: false,
    layers: layersKeepingRules(layers, (rule) => runsInEslintWithoutOxlint(rule, catalog)),
    oxlintLayers: layersKeepingRules(layers, keepsNoRule),
  }
}

function keepsNoRule(): boolean {
  return false
}

function runsInEslintWithoutOxlint({ id }: StatedRule, catalog: Catalog): boolean {
  if (isEslintRoute(routeOf(id, catalog))) return true
  return catalog.ruleIdsWithAnEslintVersion.has(id) && !catalog.eslintFallbackSkips.has(id)
}
