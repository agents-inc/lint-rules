import type { OxlintConfig } from 'oxlint'
import type { LintRules } from '../../index.ts'
import { laidOver } from '../laid-over.ts'
import type { Dimension } from '../pairwise-shapes.ts'
import { buildConsumerLintRules, type LintRulesPiece } from './lint-rules-factories.ts'

export type OurShapePiece = LintRulesPiece & Pick<LintRules, 'ignores'>

/** One value of a dimension the oxlint merge's shapes vary along. */
export type OxlintMergeShapeValue = {
  readonly name: string
  readonly team: OxlintConfig
  readonly ours: OurShapePiece
}

/** A dimension whose values are their own names: `buildDimension('size', ['small', 'large'])`. */
export function buildDimension(name: string, values: readonly string[]): Dimension<string> {
  return { name, values }
}

export function buildTeamShapeValue(name: string, team: Readonly<OxlintConfig>): OxlintMergeShapeValue {
  return { name, team, ours: {} }
}

export function buildOurShapeValue(name: string, ours: OurShapePiece): OxlintMergeShapeValue {
  return { name, team: {}, ours }
}

/**
* Pieces joined in order, a later setting of a rule winning. Suppressions allowed, as the editor set allows them,
* so the agent build states the editor set's rules, which the differentials read.
*/
export function buildConsumerLintRulesFromShape(tsconfigRootDir: string, pieces: readonly OurShapePiece[]): LintRules {
  const rules = laidOver<NonNullable<LintRules['rules']>>({}, pieces.map(({ rules: pieceRules = {} }) => pieceRules))
  const fileOverrides = pieces.flatMap(({ fileOverrides: entries = [] }) => entries)
  const ignores = pieces.flatMap(({ ignores: globs = [] }) => globs)
  return buildConsumerLintRules(tsconfigRootDir, {}, { rules, fileOverrides, allowSuppressions: true, ...(ignores.length !== 0 && { ignores }) })
}

/** Only a JSON config extends by path: oxlint refuses a path in a TS config's `extends` (measured, 1.87). */
export function buildTeamOxlintrcExtending(paths: readonly string[], fields: Omit<OxlintConfig, 'extends'> = {}): OxlintConfig {
  // Parse boundary: a .oxlintrc.json's `extends` holds paths, which oxlint's types for a TS config refuse.
  return JSON.parse(JSON.stringify({ ...fields, extends: paths })) as OxlintConfig
}
