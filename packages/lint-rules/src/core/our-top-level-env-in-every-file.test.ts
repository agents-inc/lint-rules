import { describe, expect, it } from 'vitest'
import { buildConsumerLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from '../__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from '../__tests__/factories/team-config-factories.ts'
import { oxlintConfigForFile } from '../__tests__/oxlint-config-oracle.ts'
import { NO_TEAM_ESLINT_CONFIG } from '../__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from '../__tests__/temp-projects.ts'
import { defineLintRules } from '../index.ts'
import { mergeOxlintConfig } from '../oxlint.ts'

// Our top-level env goes with our top-level rules, for every file. An entry of ours turning one of those rules off in
// some files leaves that rule on in fewer files than the others, and the env still reaches every file.

const tempProjects = setUpTempProjects()

// As our oxlint part gives it where no runtime is listed.
const OUR_TOP_LEVEL_ENV = { builtin: true, es2024: true }
// One of the rules our oxlint part runs at its top level for the correctness ruleset.
const CONSTRUCTOR_SUPER = 'constructor-super'
// TS files: the correctness ruleset also runs a rule in every file but TS and Svelte ones, so a JS file is in more of
// our overrides.
const LEGACY_FILE = 'legacy/a.ts'
const OTHER_FILE = 'src/a.ts'

describe('mergeOxlintConfig, given an entry of ours turning one of our top-level rules off under legacy/', () => {
  it('gives a file under legacy/ our top-level env, as it gives a file elsewhere', () => {
    const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }, linkedPackages: [INSTALLED_OXLINT] })
    const lintRules = buildConsumerLintRules(projectDir, { editorRulesets: { quality: ['correctness'] } }, {
      fileOverrides: [{ files: ['legacy/**'], rules: { [CONSTRUCTOR_SUPER]: 'off' } }],
    })
    const merged = mergeOxlintConfig(buildTeamOxlintConfig(), defineLintRules(lintRules).editorRulesets.oxlint, NO_TEAM_ESLINT_CONFIG)

    expect({ legacy: oxlintConfigForFile(merged, LEGACY_FILE).env, elsewhere: oxlintConfigForFile(merged, OTHER_FILE).env }).toStrictEqual({
      legacy: OUR_TOP_LEVEL_ENV,
      elsewhere: OUR_TOP_LEVEL_ENV,
    })
  })
})
