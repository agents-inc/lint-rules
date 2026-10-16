import { describe, expect, it } from 'vitest'
import { ARRAY_TYPE, NO_VAR, OURS_RUN_BY_ESLINT } from './__tests__/cases/other-engine-configs.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// A rule key whose entry a team's JS config leaves undefined states no rule (eslint-config-reading.ts,
// rulesStatedIn), so ours stands; the same key stated off is the team's, and ours is dropped in every
// file. ESLint refuses an undefined entry in a block that applies to the file it lints ("Expected
// severity of ...", measured, ESLint 10.12), so the team's block here applies only to legacy/**, where
// ESLint lints no file: it reads the block, and validates none of its entries.

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const SOURCE_FILE = 'src/a.ts'
const LEGACY_FILES = ['legacy/**']

describe('mergeEslintConfig, given a team block for legacy files stating one of our rules', () => {
  const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()) } })
  const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: OURS_RUN_BY_ESLINT })).editorRulesets

  it('keeps ours of it in every other file where the block leaves its entry undefined, which states no rule', async () => {
    const merged = mergeEslintConfig([buildTeamEslintBlock('team/legacy', { files: LEGACY_FILES, rules: { [NO_VAR]: undefined } })], eslint, NO_TEAM_OXLINT_CONFIG)

    expect({
      noVar: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, NO_VAR),
      arrayType: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, ARRAY_TYPE),
    }).toStrictEqual({ noVar: 'error', arrayType: 'error' })
  })

  it("drops ours of it in every file where the block states it off, which makes it the team's", async () => {
    const merged = mergeEslintConfig([buildTeamEslintBlock('team/legacy', { files: LEGACY_FILES, rules: { [NO_VAR]: 'off' } })], eslint, NO_TEAM_OXLINT_CONFIG)

    expect({
      noVar: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, NO_VAR),
      arrayType: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, ARRAY_TYPE),
    }).toStrictEqual({ noVar: undefined, arrayType: 'error' })
  })
})
