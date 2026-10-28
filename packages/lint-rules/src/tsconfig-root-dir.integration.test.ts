import { describe, expect, it } from 'vitest'
import {
  AS_PLAN_MD_SHOWS,
  type AgentsIncLintKeys,
  consumerFilesAsPlanMdShows,
  OXLINT_CONFIG_FILE,
} from './__tests__/cases/consumer-files-as-plan-md-shows.ts'
import { type ConsumerCliRuns, eslintFatalMessagesOf, eslintReportOf, oxlintReportOf, setUpConsumerCliRuns } from './__tests__/consumer-cli-runs.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'

// tsconfigRootDir is checked when the config is defined: an absolute path, an existing folder; otherwise an
// error naming agents-inc.lint.mts. Unchecked, each value below failed with an error blaming something else.

allowEveryTestForParallelLoad()

// The editor set lists correctness, its other lists empty, so the floating promise planted in
// src/ draws a typed rule.
const CORRECTNESS_AND_EVERY_OTHER_LIST_EMPTY = "{ quality: ['correctness'], libs: {}, runtimes: [] }"
const A_TYPED_FINDING = 'src/planted.ts:20 @typescript-eslint/no-floating-promises'
const TSCONFIG_ROOT_DIR_ERROR = 'agents-inc.lint.mts: tsconfigRootDir: '

function runsWithTsconfigRootDir(tsconfigRootDir: AgentsIncLintKeys['tsconfigRootDir']): () => ConsumerCliRuns {
  return setUpConsumerCliRuns(consumerFilesAsPlanMdShows({ tsconfigRootDir, editorRulesets: CORRECTNESS_AND_EVERY_OTHER_LIST_EMPTY }), OXLINT_CONFIG_FILE)
}

describe('tsconfigRootDir in agents-inc.lint.mts, linted by both engines through the built package beside the files plan.md shows', () => {
  const asPlanMdShows = runsWithTsconfigRootDir(AS_PLAN_MD_SHOWS.tsconfigRootDir)
  // The case's name in full in its title, which $-interpolation would cut short.
  const refused = [
    { given: "'.'", runs: runsWithTsconfigRootDir("'.'") },
    { given: 'a folder that does not exist, in the project', runs: runsWithTsconfigRootDir('`${import.meta.dirname}/no-such-folder`') },
    // Beside the project, where no package.json lies above it.
    {
      given: 'a folder that does not exist, under no package.json',
      runs: runsWithTsconfigRootDir("new URL('../no-such-folder', import.meta.url).pathname"),
    },
  ]

  it('as plan.md shows it, import.meta.dirname, is loaded by both engines, ESLint running a typed rule', () => {
    // vitest types its asymmetric matchers as any; held as unknown, each compares as written.
    const anyFindings: unknown = expect.any(Array)
    const holdingTheTypedFinding: unknown = expect.arrayContaining([A_TYPED_FINDING])

    expect({ oxlint: oxlintReportOf(asPlanMdShows()), eslint: eslintReportOf(asPlanMdShows()) }).toStrictEqual({
      oxlint: { refused: false, findings: anyFindings },
      eslint: { refused: false, findings: holdingTheTypedFinding },
    })
  })

  it('as plan.md shows it, import.meta.dirname, is linted by ESLint with no fatal message', () => {
    expect(eslintFatalMessagesOf(asPlanMdShows())).toStrictEqual([])
  })

  for (const { given, runs } of refused) {
    it(`${given} is refused by both engines, which name agents-inc.lint.mts and tsconfigRootDir`, () => {
      // vitest types its asymmetric matchers as any; held as unknown, it compares as written.
      const namingTheOption: unknown = expect.stringContaining(TSCONFIG_ROOT_DIR_ERROR)

      expect({ oxlint: oxlintReportOf(runs()), eslint: eslintReportOf(runs()) }).toStrictEqual({
        oxlint: { refused: true, output: namingTheOption },
        eslint: { refused: true, output: namingTheOption },
      })
    })
  }
})
