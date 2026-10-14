import type { OxlintConfig } from 'oxlint'
import type { LintRules } from '../../index.ts'
import type { Dimension } from '../pairwise-shapes.ts'
import { buildConsumerLintRules, type LintRulesPiece } from './lint-rules-factories.ts'

/** The settings a value of a shape adds to our editor parts: rules, entries, and ignores. */
export type OurShapePiece = LintRulesPiece & Pick<LintRules, 'ignores'>

/** One value of a dimension the oxlint merge's shapes vary along: what it adds to the team's config, and to ours. */
export type OxlintMergeShapeValue = {
  readonly name: string
  readonly team: OxlintConfig
  readonly ours: OurShapePiece
}

/** A dimension whose values are their own names: `buildDimension('size', ['small', 'large'])`. */
export function buildDimension(name: string, values: readonly string[]): Dimension<string> {
  return { name, values }
}

/** A value adding to the team's oxlint config, and nothing to ours. */
export function buildTeamShapeValue(name: string, team: OxlintConfig): OxlintMergeShapeValue {
  return { name, team, ours: {} }
}

/** A value adding to the settings our editor parts are made from, and nothing to the team's config. */
export function buildOurShapeValue(name: string, ours: OurShapePiece): OxlintMergeShapeValue {
  return { name, team: {}, ours }
}

/**
 * A consumer's file listing no ruleset, joined from the pieces of a shape in order: a later piece's
 * setting of a rule wins, and entries and ignores keep the order given. Suppressions are allowed,
 * as the editor set always allows them, so the agent build of the file states the editor set's
 * rules: the differentials read where our ESLint part runs a rule from it.
 */
export function buildConsumerLintRulesFromShape(tsconfigRootDir: string, pieces: readonly OurShapePiece[]): LintRules {
  const rules = pieces.reduce<NonNullable<LintRules['rules']>>((joined, { rules: pieceRules = {} }) => ({ ...joined, ...pieceRules }), {})
  const fileOverrides = pieces.flatMap(({ fileOverrides: entries = [] }) => entries)
  const ignores = pieces.flatMap(({ ignores: globs = [] }) => globs)
  return buildConsumerLintRules(tsconfigRootDir, {}, { rules, fileOverrides, allowSuppressions: true, ...(ignores.length === 0 ? {} : { ignores }) })
}

/**
 * A team's `.oxlintrc.json` extending the configs at the paths given, with the other keys given, as
 * its oxlint.config.mts reads it. Only a JSON config extends by path: oxlint refuses a path in a TS
 * config's `extends` (measured, 1.87).
 */
export function buildTeamOxlintrcExtending(paths: readonly string[], fields: Omit<OxlintConfig, 'extends'> = {}): OxlintConfig {
  // Parse boundary: a .oxlintrc.json's `extends` holds paths, which oxlint's types for a TS config refuse.
  return JSON.parse(JSON.stringify({ ...fields, extends: paths })) as OxlintConfig
}
