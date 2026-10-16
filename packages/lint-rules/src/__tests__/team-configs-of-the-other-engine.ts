import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OxlintConfig } from 'oxlint'
import type { EslintPart } from '../core/editor-parts.ts'
import { isATempProject } from './temp-projects.ts'

// Each merge takes the path of the team's other engine config, so it can see the rules set only
// there (spec-merge-model.md, 1.3): mergeEslintConfig(theirs, eslint, { oxlintConfig }) and
// mergeOxlintConfig(theirs, oxlint, { eslintConfig }), each a path relative to tsconfigRootDir, or
// null where the project has no such config.

/** mergeEslintConfig's third argument: the path of the team's oxlint config, or null where the project has none. */
export type TeamOxlintConfigPath = { readonly oxlintConfig: string | null }

/** mergeOxlintConfig's third argument: the path of the team's ESLint config, or null where the project has none. */
export type TeamEslintConfigPath = { readonly eslintConfig: string | null }

/** A team oxlint config turning nothing on, not even oxlint's default correctness category. */
export const EMPTY_TEAM_OXLINT_CONFIG: OxlintConfig = { categories: { correctness: 'off' } }

/**
 * The file a team oxlint config setting no rule is written to: JSON, which a merge parses rather than
 * loads, under a name oxlint never finds by itself.
 */
export const TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE = 'team.oxlintrc.json'

/** That file, for a project written whole whose oxlint config is not under test. */
export const teamOxlintConfigSettingNoRuleFiles: Readonly<Record<string, string>> = {
  [TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE]: `${JSON.stringify(EMPTY_TEAM_OXLINT_CONFIG)}\n`,
}

/** mergeEslintConfig's third argument naming that file: without oxlint, no merge reads it. */
export const TEAM_OXLINT_CONFIG_SETTING_NO_RULE: TeamOxlintConfigPath = { oxlintConfig: TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE }

/** The project has no ESLint config, so the team sets no rule there. */
export const NO_TEAM_ESLINT_CONFIG: TeamEslintConfigPath = { eslintConfig: null }

/** The file a team ESLint config setting no rule is written to: a module exporting no block, which calls no merge of ours. */
export const TEAM_ESLINT_CONFIG_SETTING_NO_RULE_FILE = 'team.eslint.config.mjs'

/** That file, for a project whose ESLint config is not under test. */
export const teamEslintConfigSettingNoRuleFiles: Readonly<Record<string, string>> = { [TEAM_ESLINT_CONFIG_SETTING_NO_RULE_FILE]: 'export default []\n' }

/**
 * mergeOxlintConfig's third argument naming that file: the project has an ESLint config, which sets
 * no rule. Where oxlint's own correctness: warn would run its copy of a rule our ESLint part runs,
 * the merge switches that copy off, knowing from our part which rules those are, whatever the ESLint
 * config holds.
 */
export const TEAM_ESLINT_CONFIG_SETTING_NO_RULE: TeamEslintConfigPath = { eslintConfig: TEAM_ESLINT_CONFIG_SETTING_NO_RULE_FILE }

/**
 * The rules a team's oxlint config sets, as mergeEslintPart takes them, for a merge of our ESLint
 * part beside one that sets none, or in a project with no oxlint.
 */
export const NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG: readonly string[] = []

/** The project has no oxlint config, which writes nothing: beside oxlint, it sets no rule, whatever oxlint's own categories run. */
export const NO_TEAM_OXLINT_CONFIG: TeamOxlintConfigPath = { oxlintConfig: null }

/**
 * Beside oxlint, writes a team oxlint config setting no rule into the part's project and gives its
 * path; without oxlint, null, which no merge reads there. For a test of anything but the rules the
 * team sets. Only a temp project is written to.
 */
export function writeTeamOxlintConfigSettingNoRule({ tsconfigRootDir, usesOxlint }: EslintPart): TeamOxlintConfigPath {
  if (!usesOxlint) return NO_TEAM_OXLINT_CONFIG
  if (!isATempProject(tsconfigRootDir)) {
    throw new Error(`${tsconfigRootDir} is no temp project, so no team oxlint config is written into it`)
  }
  Object.entries(teamOxlintConfigSettingNoRuleFiles).forEach(([file, text]) => writeFileSync(join(tsconfigRootDir, file), text))
  return TEAM_OXLINT_CONFIG_SETTING_NO_RULE
}
