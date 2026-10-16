import { describe, expect, it } from 'vitest'
import { setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import { FILES_WITH_AN_UNUSED_VARIABLE, NO_UNUSED_VARS, UNUSED_VARS_SETTING, unusedVariableFiles } from './__tests__/cases/unused-variables-in-js-and-ts-files.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { EMPTY_TEAM_ESLINT_MODULE_FILE, projectMergingOurEslintPartText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings, REDUNDANCY_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import type { LintRules } from './index.ts'

// q61 (owner): where a consumer's `rules` name typescript-eslint's version of a rule and not the
// plain rule, the plain rule runs on JS files with that setting wherever the layer reaches, our
// ruleset's own file limit aside; each file reports once, under one name. Without oxlint, the
// editor's ESLint part runs the plain rule on JS files itself; beside oxlint, the agent build and
// the editor already report each file once, through ESLint's typescript-eslint version, and stay so.

allowEveryTestForParallelLoad()

const PLAIN_RULE = 'no-unused-vars'
const TYPESCRIPT_VERSION = '@typescript-eslint/no-unused-vars'
const OXLINT_CODE = 'eslint(no-unused-vars)'

/** A project listing no oxlint, with our redundancy ruleset and the rules given, merged into an empty team ESLint config, as the built package loads. */
function projectWithoutOxlintFiles(rules: NonNullable<LintRules['rules']>): Readonly<Record<string, string>> {
  return {
    'package.json': packageJsonText(buildPackageJson()),
    ...projectMergingOurEslintPartText({
      settings: buildConsumerSettings(REDUNDANCY_IN_BOTH_SETS, { rules }),
      team: EMPTY_TEAM_ESLINT_MODULE_FILE,
      teamOxlint: 'setting no rule',
    }),
    ...unusedVariableFiles,
  }
}

describe("an unused variable in TS and JS files, our rules naming typescript-eslint's no-unused-vars alone, in a project whose package.json lists no oxlint, linted by the ESLint CLI through the built package", () => {
  const run = setUpConsumerEslintCliRun(projectWithoutOxlintFiles({ [TYPESCRIPT_VERSION]: UNUSED_VARS_SETTING }))

  it('is linted with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it("is reported once in every file: by typescript-eslint's version in each TS file, and by the plain rule in each JS file, those in scripts/ and a tool's config file included", () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), FILES_WITH_AN_UNUSED_VARIABLE, [NO_UNUSED_VARS])).toStrictEqual({
      'src/a.ts': { [NO_UNUSED_VARS.rule]: [`src/a.ts:1 ${TYPESCRIPT_VERSION}`] },
      'src/a.js': { [NO_UNUSED_VARS.rule]: [`src/a.js:1 ${PLAIN_RULE}`] },
      'scripts/a.ts': { [NO_UNUSED_VARS.rule]: [`scripts/a.ts:1 ${TYPESCRIPT_VERSION}`] },
      'scripts/a.js': { [NO_UNUSED_VARS.rule]: [`scripts/a.js:1 ${PLAIN_RULE}`] },
      'tool.config.js': { [NO_UNUSED_VARS.rule]: [`tool.config.js:1 ${PLAIN_RULE}`] },
    })
  })
})

describe('the same files, our rules naming the plain no-unused-vars, in a project whose package.json lists no oxlint, linted by the ESLint CLI through the built package', () => {
  const run = setUpConsumerEslintCliRun(projectWithoutOxlintFiles({ [PLAIN_RULE]: UNUSED_VARS_SETTING }))

  it('is linted with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it('is reported in src/ alone, the ruleset keeping it out of scripts/ and the config file on TS and JS files alike', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), FILES_WITH_AN_UNUSED_VARIABLE, [NO_UNUSED_VARS])).toStrictEqual({
      'src/a.ts': { [NO_UNUSED_VARS.rule]: [`src/a.ts:1 ${TYPESCRIPT_VERSION}`] },
      'src/a.js': { [NO_UNUSED_VARS.rule]: [`src/a.js:1 ${PLAIN_RULE}`] },
      'scripts/a.ts': { [NO_UNUSED_VARS.rule]: [] },
      'scripts/a.js': { [NO_UNUSED_VARS.rule]: [] },
      'tool.config.js': { [NO_UNUSED_VARS.rule]: [] },
    })
  })
})

// The builds q61 leaves as they were (measured, oxlint 1.87): each file once, oxlint's no-unused-vars
// with our setting where the ruleset ships it, and ESLint's typescript-eslint version in the files it
// ships it ignoring, the JS files among them.
describe("the same files, our rules naming typescript-eslint's no-unused-vars alone, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: unusedVariableFiles,
    ourRulesets: REDUNDANCY_IN_BOTH_SETS,
    ours: { rules: { [TYPESCRIPT_VERSION]: UNUSED_VARS_SETTING } },
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const owed = {
    'src/a.ts': { [NO_UNUSED_VARS.rule]: [`src/a.ts:1 ${OXLINT_CODE}`] },
    'src/a.js': { [NO_UNUSED_VARS.rule]: [`src/a.js:1 ${OXLINT_CODE}`] },
    'scripts/a.ts': { [NO_UNUSED_VARS.rule]: [`scripts/a.ts:1 ${TYPESCRIPT_VERSION}`] },
    'scripts/a.js': { [NO_UNUSED_VARS.rule]: [`scripts/a.js:1 ${TYPESCRIPT_VERSION}`] },
    'tool.config.js': { [NO_UNUSED_VARS.rule]: [`tool.config.js:1 ${TYPESCRIPT_VERSION}`] },
  }

  it('are linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it('are reported once in every file by the agent build', () => {
    expect(findingsByFileAndRule(runs().agent, FILES_WITH_AN_UNUSED_VARIABLE, [NO_UNUSED_VARS])).toStrictEqual(owed)
  })

  it('are reported once in every file merged into empty team configs', () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, FILES_WITH_AN_UNUSED_VARIABLE, [NO_UNUSED_VARS])).toStrictEqual(owed)
  })
})
