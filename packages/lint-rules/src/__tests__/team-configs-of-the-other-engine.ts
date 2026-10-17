import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OxlintConfig } from 'oxlint'
import type { EslintPart } from '../core/editor-parts.ts'
import { isATempProject } from './temp-projects.ts'

// Each merge takes the path of the team's other engine config, relative to tsconfigRootDir or null, so it can
// see the rules set only there.

export type TeamOxlintConfigPath = { readonly oxlintConfig: string | null }

export type TeamEslintConfigPath = { readonly eslintConfig: string | null }

/** Turns nothing on, not even oxlint's default correctness category. */
export const EMPTY_TEAM_OXLINT_CONFIG: OxlintConfig = { categories: { correctness: 'off' } }

/** JSON, which a merge parses rather than loads, under a name oxlint never finds by itself. */
export const TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE = 'team.oxlintrc.json'

/** For a project written whole whose oxlint config is not under test. */
export const teamOxlintConfigSettingNoRuleFiles: Readonly<Record<string, string>> = {
  [TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE]: `${JSON.stringify(EMPTY_TEAM_OXLINT_CONFIG)}\n`,
}

/** Without oxlint, no merge reads it. */
export const TEAM_OXLINT_CONFIG_SETTING_NO_RULE: TeamOxlintConfigPath = { oxlintConfig: TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE }

export const NO_TEAM_ESLINT_CONFIG: TeamEslintConfigPath = { eslintConfig: null }

/** A module exporting no block, calling no merge of ours. */
export const TEAM_ESLINT_CONFIG_SETTING_NO_RULE_FILE = 'team.eslint.config.mjs'

/** For a project whose ESLint config is not under test. */
export const teamEslintConfigSettingNoRuleFiles: Readonly<Record<string, string>> = { [TEAM_ESLINT_CONFIG_SETTING_NO_RULE_FILE]: 'export default []\n' }

/** The merge still switches off oxlint's correctness: warn copies of our ESLint-run rules, knowing them from our part. */
export const TEAM_ESLINT_CONFIG_SETTING_NO_RULE: TeamEslintConfigPath = { eslintConfig: TEAM_ESLINT_CONFIG_SETTING_NO_RULE_FILE }

/** For a merge of our ESLint part beside an oxlint config setting none, or with no oxlint. */
export const NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG: readonly string[] = []

/** Writes nothing: beside oxlint it sets no rule, whatever oxlint's own categories run. */
export const NO_TEAM_OXLINT_CONFIG: TeamOxlintConfigPath = { oxlintConfig: null }

/** Beside oxlint, writes it into the part's temp project and gives its path; without oxlint, null. */
export function writeTeamOxlintConfigSettingNoRule({ tsconfigRootDir, usesOxlint }: EslintPart): TeamOxlintConfigPath {
  if (!usesOxlint) return NO_TEAM_OXLINT_CONFIG
  if (!isATempProject(tsconfigRootDir)) {
    throw new Error(`${tsconfigRootDir} is no temp project, so no team oxlint config is written into it`)
  }
  Object.entries(teamOxlintConfigSettingNoRuleFiles).forEach(([file, text]) => writeFileSync(join(tsconfigRootDir, file), text))
  return TEAM_OXLINT_CONFIG_SETTING_NO_RULE
}
