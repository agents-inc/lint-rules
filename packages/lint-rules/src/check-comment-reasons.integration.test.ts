import { describe, expect, it } from 'vitest'
import {
  DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_BY_ESLINTS_LINE_COMMENT,
  DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_BY_ESLINTS_LINE_COMMENT_WITH_A_REASON,
  DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING,
  DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING_WITH_A_REASON,
  DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING,
  DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING_WITH_A_REASON,
  EQEQEQ_SWITCHED_OFF_FOR_THE_FILE,
  EQEQEQ_SWITCHED_OFF_FOR_THE_FILE_WITH_A_REASON,
  EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE,
  EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE_WITH_A_REASON,
  EQEQEQS_OPTION_CHANGED_FOR_THE_FILE,
  EQEQEQS_OPTION_CHANGED_FOR_THE_FILE_WITH_A_REASON,
} from './__tests__/cases/comment-reason-sources.ts'
import { findingsInFile } from './__tests__/check-output.ts'
import { setUpCheckAfterTheAgent } from './__tests__/cli-runs.ts'
import { checkedPackageFiles, moduleText, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED } from './__tests__/factories/check-factories.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'

allowEveryTestForParallelLoad()

const CORRECTNESS_AND_REDUNDANCY = { quality: ['correctness', 'redundancy'] } as const
const REASON_RULE = '@eslint-community/eslint-comments/require-description'

describe('check on directive comments with and without a reason after `--`', () => {
  const run = setUpCheckAfterTheAgent(checkedPackageFiles(CORRECTNESS_AND_REDUNDANCY, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED), (project) => {
    project.write('src/allowed/switched-off.ts', moduleText(...EQEQEQ_SWITCHED_OFF_FOR_THE_FILE))
    project.write('src/allowed/option-changed.ts', moduleText(...EQEQEQS_OPTION_CHANGED_FOR_THE_FILE))
    project.write('src/allowed/next-line-switched-off.ts', moduleText(...EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE))
    project.write('src/allowed/oxlint-next-line-switched-off.ts', moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING))
    project.write('src/allowed/oxlint-switched-off.ts', moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING))
    project.write('src/allowed/eslint-line-comment-switched-off.ts', moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_BY_ESLINTS_LINE_COMMENT))
    project.write('src/allowed/switched-off-with-a-reason.ts', moduleText(...EQEQEQ_SWITCHED_OFF_FOR_THE_FILE_WITH_A_REASON))
    project.write('src/allowed/option-changed-with-a-reason.ts', moduleText(...EQEQEQS_OPTION_CHANGED_FOR_THE_FILE_WITH_A_REASON))
    project.write('src/allowed/next-line-switched-off-with-a-reason.ts', moduleText(...EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE_WITH_A_REASON))
    project.write(
      'src/allowed/oxlint-next-line-switched-off-with-a-reason.ts',
      moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING_WITH_A_REASON),
    )
    project.write('src/allowed/oxlint-switched-off-with-a-reason.ts', moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING_WITH_A_REASON))
    project.write(
      'src/allowed/eslint-line-comment-switched-off-with-a-reason.ts',
      moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_BY_ESLINTS_LINE_COMMENT_WITH_A_REASON),
    )
    project.write('src/banned-switched-off.ts', moduleText(...EQEQEQ_SWITCHED_OFF_FOR_THE_FILE))
    project.write('src/banned-oxlint-switched-off.ts', moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING))
  })

  it('reports a comment that switches a rule off for its file and one that only changes its option, each at the comment, where suppressions are allowed', () => {
    const { stdout } = run()

    expect({
      switchedOff: findingsInFile(stdout, 'src/allowed/switched-off.ts'),
      optionChanged: findingsInFile(stdout, 'src/allowed/option-changed.ts'),
    }).toStrictEqual({
      switchedOff: [`src/allowed/switched-off.ts:1 ${REASON_RULE}`],
      optionChanged: [`src/allowed/option-changed.ts:1 ${REASON_RULE}`],
    })
  })

  it('reports a next-line disable comment at the comment, where suppressions are allowed', () => {
    expect(findingsInFile(run().stdout, 'src/allowed/next-line-switched-off.ts')).toStrictEqual([`src/allowed/next-line-switched-off.ts:1 ${REASON_RULE}`])
  })

  it("reports a next-line and a whole-file disable comment in oxlint's spelling, each at the comment, and not the line oxlint skips for it, where suppressions are allowed", () => {
    const { stdout } = run()

    expect({
      nextLine: findingsInFile(stdout, 'src/allowed/oxlint-next-line-switched-off.ts'),
      wholeFile: findingsInFile(stdout, 'src/allowed/oxlint-switched-off.ts'),
    }).toStrictEqual({
      nextLine: [`src/allowed/oxlint-next-line-switched-off.ts:1 ${REASON_RULE}`],
      wholeFile: [`src/allowed/oxlint-switched-off.ts:1 ${REASON_RULE}`],
    })
  })

  it("reports ESLint's whole-file disable written as a line comment, which oxlint obeys, at the comment, and not the line oxlint skips for it, where suppressions are allowed", () => {
    expect(findingsInFile(run().stdout, 'src/allowed/eslint-line-comment-switched-off.ts')).toStrictEqual([
      `src/allowed/eslint-line-comment-switched-off.ts:1 ${REASON_RULE}`,
    ])
  })

  it("reports none of the same comments given a reason after `--`, in either engine's spelling, and no line they silence", () => {
    const { stdout } = run()

    expect([
      ...findingsInFile(stdout, 'src/allowed/switched-off-with-a-reason.ts'),
      ...findingsInFile(stdout, 'src/allowed/option-changed-with-a-reason.ts'),
      ...findingsInFile(stdout, 'src/allowed/next-line-switched-off-with-a-reason.ts'),
      ...findingsInFile(stdout, 'src/allowed/oxlint-next-line-switched-off-with-a-reason.ts'),
      ...findingsInFile(stdout, 'src/allowed/oxlint-switched-off-with-a-reason.ts'),
      ...findingsInFile(stdout, 'src/allowed/eslint-line-comment-switched-off-with-a-reason.ts'),
    ]).toStrictEqual([])
  })

  it("reports no missing reason where suppressions are banned, in either engine's spelling, only the ban of the comment and any finding ESLint no longer lets it silence", () => {
    const { stdout } = run()

    expect({
      eslints: findingsInFile(stdout, 'src/banned-switched-off.ts'),
      oxlints: findingsInFile(stdout, 'src/banned-oxlint-switched-off.ts'),
    }).toStrictEqual({
      eslints: ['src/banned-switched-off.ts:1 house/no-suppressions', 'src/banned-switched-off.ts:2 eqeqeq'],
      oxlints: ['src/banned-oxlint-switched-off.ts:1 house/no-suppressions'],
    })
  })
})
