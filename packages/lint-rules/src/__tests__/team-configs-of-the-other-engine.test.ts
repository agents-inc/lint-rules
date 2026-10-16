import { existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defineLintRules } from '../index.ts'
import { buildConsumerLintRules, EMPTY_TSCONFIG_ROOT_DIR } from './factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './factories/package-json-factories.ts'
import { TEAM_OXLINT_CONFIG_SETTING_NO_RULE, TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE, writeTeamOxlintConfigSettingNoRule } from './team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './temp-projects.ts'

// writeTeamOxlintConfigSettingNoRule writes into a temp project alone. Every spec loads the shared
// empty tsconfigRootDir, and refuses to load where it holds a file, so a part rooted there or at the
// temp dir itself, which a broken merge or a mutant hands it beside oxlint, is refused and nothing
// is written: a file left there would stay for every later spec of the test file.

const tempProjects = setUpTempProjects()
const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }, linkedPackages: [INSTALLED_OXLINT] })
const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {})).editorRulesets

describe('writeTeamOxlintConfigSettingNoRule, given an ESLint part beside oxlint', () => {
  it.each([
    { what: 'the shared empty tsconfigRootDir', dir: EMPTY_TSCONFIG_ROOT_DIR },
    { what: 'the temp dir itself', dir: tmpdir() },
  ])('is refused where the part is rooted at $what, writing nothing there', ({ dir }) => {
    expect(() => writeTeamOxlintConfigSettingNoRule({ ...eslint, tsconfigRootDir: dir })).toThrowError(
      new Error(`${dir} is no temp project, so no team oxlint config is written into it`),
    )
    expect(existsSync(join(dir, TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE))).toBe(false)
  })

  it('writes the config into a temp project, and gives its path', () => {
    expect({ given: writeTeamOxlintConfigSettingNoRule(eslint), files: readdirSync(projectDir).toSorted() }).toStrictEqual({
      given: TEAM_OXLINT_CONFIG_SETTING_NO_RULE,
      files: ['package.json', TEAM_OXLINT_CONFIG_SETTING_NO_RULE_FILE],
    })
  })
})
