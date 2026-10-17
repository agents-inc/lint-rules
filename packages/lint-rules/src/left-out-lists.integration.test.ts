import { describe, expect, it } from 'vitest'
import {
  AS_PLAN_MD_SHOWS,
  type AgentsIncLintKeys,
  consumerFilesAsPlanMdShows,
  OXLINT_CONFIG_FILE,
} from './__tests__/cases/consumer-files-as-plan-md-shows.ts'
import { type ConsumerCliRuns, eslintFatalMessagesOf, eslintReportOf, oxlintReportOf, setUpConsumerCliRuns } from './__tests__/consumer-cli-runs.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'

// A top-level set with a list left out means that list is empty, as in a fileOverrides entry: in each
// engine it owes what the same set giving the lists empty owes.

allowEveryTestForParallelLoad()

const EVERY_LIST_EMPTY = '{ quality: [], libs: {}, runtimes: [] }'
const CORRECTNESS_AND_EVERY_OTHER_LIST_EMPTY = "{ quality: ['correctness'], libs: {}, runtimes: [] }"
const CORRECTNESS_ALONE = "{ quality: ['correctness'] }"
const CORRECTNESS_AND_NO_LIBS = "{ quality: ['correctness'], libs: {} }"
// What the correctness ruleset draws in the planted file and no empty set does: the floating promise
// in ESLint, the prototype builtin called on an object in oxlint.
const A_CORRECTNESS_FINDING_IN_ESLINT = 'src/planted.ts:20 @typescript-eslint/no-floating-promises'
const A_CORRECTNESS_FINDING_IN_OXLINT = 'src/planted.ts:28 eslint(no-prototype-builtins)'
const EDITOR_SET_MISSING = 'agents-inc.lint.mts: editorRulesets: missing'

function runsWithTheEditorSet(editorRulesets: AgentsIncLintKeys['editorRulesets']): () => ConsumerCliRuns {
  return setUpConsumerCliRuns(consumerFilesAsPlanMdShows({ ...AS_PLAN_MD_SHOWS, editorRulesets }), OXLINT_CONFIG_FILE)
}

describe('the editor set of agents-inc.lint.mts, linted by both engines through the built package beside the files plan.md shows', () => {
  const asPlanMdShows = setUpConsumerCliRuns(consumerFilesAsPlanMdShows(AS_PLAN_MD_SHOWS), OXLINT_CONFIG_FILE)
  const everyListEmpty = runsWithTheEditorSet(EVERY_LIST_EMPTY)
  const correctnessAndEveryOtherListEmpty = runsWithTheEditorSet(CORRECTNESS_AND_EVERY_OTHER_LIST_EMPTY)
  const correctnessAlone = runsWithTheEditorSet(CORRECTNESS_ALONE)
  const correctnessAndNoLibs = runsWithTheEditorSet(CORRECTNESS_AND_NO_LIBS)
  const editorSetLeftOut = runsWithTheEditorSet(null)

  it('as plan.md shows init writing it, {}, is loaded by oxlint, which reports what it reports with every list given empty', () => {
    expect(oxlintReportOf(asPlanMdShows())).toStrictEqual(oxlintReportOf(everyListEmpty()))
  })

  it('as plan.md shows init writing it, {}, is loaded by ESLint, which reports what it reports with every list given empty', () => {
    expect(eslintReportOf(asPlanMdShows())).toStrictEqual(eslintReportOf(everyListEmpty()))
  })

  it('as plan.md shows init writing it, {}, is linted by ESLint with no fatal message', () => {
    expect(eslintFatalMessagesOf(asPlanMdShows())).toStrictEqual([])
  })

  // Some lists left out: a fix for a set leaving every list out alone passes the {} tests above
  // and fails these.
  it.each([
    { leftOut: 'libs and runtimes', given: CORRECTNESS_ALONE, runs: correctnessAlone },
    { leftOut: 'runtimes', given: CORRECTNESS_AND_NO_LIBS, runs: correctnessAndNoLibs },
  ])('leaving $leftOut out, $given, is loaded by both engines, which report what they report with those lists given empty', ({ runs }) => {
    const owed = correctnessAndEveryOtherListEmpty()

    expect({ oxlint: oxlintReportOf(runs()), eslint: eslintReportOf(runs()) }).toStrictEqual({
      oxlint: oxlintReportOf(owed),
      eslint: eslintReportOf(owed),
    })
  })

  // The comparisons above can tell a listed ruleset from none: with correctness given, each engine
  // reports a finding that no empty set draws.
  it('giving correctness draws a finding in each engine that every list given empty does not', () => {
    const withCorrectness = correctnessAndEveryOtherListEmpty()
    const withNone = everyListEmpty()

    expect({
      withCorrectness: { oxlint: oxlintReportOf(withCorrectness), eslint: eslintReportOf(withCorrectness) },
      withNone: { oxlint: oxlintReportOf(withNone), eslint: eslintReportOf(withNone) },
    }).toStrictEqual({
      withCorrectness: {
        oxlint: { refused: false, findings: expect.arrayContaining([A_CORRECTNESS_FINDING_IN_OXLINT]) },
        eslint: { refused: false, findings: expect.arrayContaining([A_CORRECTNESS_FINDING_IN_ESLINT]) },
      },
      withNone: {
        oxlint: { refused: false, findings: expect.not.arrayContaining([A_CORRECTNESS_FINDING_IN_OXLINT]) },
        eslint: { refused: false, findings: expect.not.arrayContaining([A_CORRECTNESS_FINDING_IN_ESLINT]) },
      },
    })
  })

  // A set left out altogether is still a config error naming the file, unlike the empty set above.
  it('left out altogether is refused by both engines, which name agents-inc.lint.mts and the set', () => {
    const runs = editorSetLeftOut()

    expect({ oxlint: oxlintReportOf(runs), eslint: eslintReportOf(runs) }).toStrictEqual({
      oxlint: { refused: true, output: expect.stringContaining(EDITOR_SET_MISSING) },
      eslint: { refused: true, output: expect.stringContaining(EDITOR_SET_MISSING) },
    })
  })
})
