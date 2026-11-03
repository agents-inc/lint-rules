import { describe, expect, it } from 'vitest'
import { setUpBothEnginesRuns } from './both-engines-runs.ts'
import { CORRECTNESS_IN_BOTH_SETS } from './factories/lint-rules-factories.ts'
import { allowEveryTestForParallelLoad } from './parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './team-configs-of-the-other-engine.ts'

allowEveryTestForParallelLoad()

const FILES = {
  module: 'src/one.js',
  nestedModule: 'src/nested/two.mjs',
  // ESLint's Node API gives it after src/, which its walk enters first; sorted, it comes before.
  besideTheFolder: 'src-tools.js',
  markdown: 'notes.md',
  json: 'src/data.json',
} as const

const sources = {
  [FILES.module]: 'export const one = 1\n',
  [FILES.nestedModule]: 'export const two = 2\n',
  [FILES.besideTheFolder]: 'export const tools = 3\n',
  [FILES.markdown]: '# Notes\n',
  [FILES.json]: '{}\n',
}

// The team's ESLint config names no .mts file, so linting with it alone leaves the TS ones out.
const JS_CONFIGS_THE_RUNS_WRITE = ['empty-team.eslint.mjs', 'eslint.merged-into-empty.mjs', 'eslint.merged.mjs', 'eslint.team-alone.mjs', 'team.eslint.mjs']
const TS_CONFIGS_THE_RUNS_WRITE = ['agents-inc.lint.mts', 'oxlint.merged-into-empty.mts', 'oxlint.merged.mts']
const JS_SOURCES = [FILES.module, FILES.nestedModule, FILES.besideTheFolder]

const LINTED_WITH_OUR_PART = [...JS_CONFIGS_THE_RUNS_WRITE, ...TS_CONFIGS_THE_RUNS_WRITE, ...JS_SOURCES].toSorted()
const LINTED_WITH_THE_TEAMS_CONFIG_ALONE = [...JS_CONFIGS_THE_RUNS_WRITE, ...JS_SOURCES].toSorted()

describe('a project of three JS modules, a Markdown file and a JSON file, our correctness ruleset on, linted by each build', () => {
  const runs = setUpBothEnginesRuns({ sources, ourRulesets: CORRECTNESS_IN_BOTH_SETS, ours: {}, teamEslintRules: {}, teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG })

  it("lists each file each build's ESLint run linted by its path in the project, sorted, the configs included, and no Markdown or JSON file", () => {
    expect(runs().eslintLintedFiles).toStrictEqual({
      agent: LINTED_WITH_OUR_PART,
      mergedIntoEmptyTeamConfigs: LINTED_WITH_OUR_PART,
      mergedIntoTheTeamsConfigs: LINTED_WITH_OUR_PART,
      teamAlone: LINTED_WITH_THE_TEAMS_CONFIG_ALONE,
    })
  })
})
