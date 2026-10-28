import { existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defineLintRules } from '../index.ts'
import { buildConsumerLintRules, emptyTsconfigRootDir } from './factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './factories/package-json-factories.ts'
import { TEAM_OXLINT_CONFIG_SETTING_NO_RULE, TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE, writeTeamOxlintConfigSettingNoRule } from './team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './temp-projects.ts'

// writeTeamOxlintConfigSettingNoRule refuses to write outside a temp project, as a broken merge or a mutant might
// ask: a file left in the shared empty tsconfigRootDir would stay for every later spec of the test file.

const tempProjects = setUpTempProjects()
const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }, linkedPackages: [INSTALLED_OXLINT] })

describe('writeTeamOxlintConfigSettingNoRule, given an ESLint part beside oxlint', () => {
  it.each([
    { what: 'the shared empty tsconfigRootDir', rootedAt: emptyTsconfigRootDir },
    { what: 'the temp dir itself', rootedAt: tmpdir },
  ])('is refused where the part is rooted at $what, writing nothing there', ({ rootedAt }) => {
    const dir = rootedAt()
    const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {})).editorRulesets

    expect(() => writeTeamOxlintConfigSettingNoRule({ ...eslint, tsconfigRootDir: dir })).toThrow(
      new Error(`${dir} is no temp project, so no team oxlint config is written into it`),
    )
    expect(existsSync(join(dir, TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE))).toBe(false)
  })

  it('writes the config into a temp project, and gives its path', () => {
    const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {})).editorRulesets

    expect({ given: writeTeamOxlintConfigSettingNoRule(eslint), files: readdirSync(projectDir).toSorted() }).toStrictEqual({
      given: TEAM_OXLINT_CONFIG_SETTING_NO_RULE,
      files: ['package.json', TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE],
    })
  })
})
