import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING,
  DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING_WITH_A_REASON,
  DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING,
  DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING_WITH_A_REASON,
  EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE,
  EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE_WITH_A_REASON,
} from './__tests__/cases/comment-reason-sources.ts'
import { type EngineRun, setUpEngineRun } from './__tests__/engine-run.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { moduleText } from './__tests__/factories/check-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { defineLintRules } from './index.ts'

// The editor shows what check prints (check-comment-reasons.integration.test.ts) wherever its rulesets list comments:
// the editor parts allow suppressions everywhere.

allowEveryTestForParallelLoad()

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/suppression-ban', import.meta.url))
const REASON_RULE = '@eslint-community/eslint-comments/require-description'
const COMMENTS_LISTED = { editorRulesets: { quality: ['comments'] } } as const
const COMMENTS_UNLISTED = { editorRulesets: { quality: ['correctness'] } } as const

const UNDESCRIBED_FILES = ['src/eslint-next-line.ts', 'src/oxlint-next-line.ts', 'src/oxlint-whole-file.ts']
const DESCRIBED_FILES = ['src/eslint-next-line-with-a-reason.ts', 'src/oxlint-next-line-with-a-reason.ts', 'src/oxlint-whole-file-with-a-reason.ts']

const WRITTEN_FILES = {
  'src/eslint-next-line.ts': moduleText(...EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE),
  'src/oxlint-next-line.ts': moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING),
  'src/oxlint-whole-file.ts': moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING),
  'src/eslint-next-line-with-a-reason.ts': moduleText(...EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE_WITH_A_REASON),
  'src/oxlint-next-line-with-a-reason.ts': moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING_WITH_A_REASON),
  'src/oxlint-whole-file-with-a-reason.ts': moduleText(...DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING_WITH_A_REASON),
}

function reasonReportLinesOn(editor: EngineRun, files: readonly string[]): Array<{ readonly file: string; readonly lines: number[] }> {
  return files.map((file) => ({
    file,
    lines: editor
      .eslintMessagesOn(file)
      .filter(({ ruleId }) => ruleId === REASON_RULE)
      .map(({ line }) => line),
  }))
}

describe("the editor merge into empty team configs listing the comments ruleset, on switch-off comments in both engines' spellings", () => {
  const editor = setUpEngineRun(FIXTURES_DIR, (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, COMMENTS_LISTED)), WRITTEN_FILES, buildEditorBuild())

  it("reports each comment that gives no reason, in ESLint's spelling or oxlint's, at the comment", () => {
    expect(reasonReportLinesOn(editor, UNDESCRIBED_FILES)).toStrictEqual(UNDESCRIBED_FILES.map((file) => ({ file, lines: [1] })))
  })

  it('reports none of the same comments given a reason after `--`', () => {
    expect(reasonReportLinesOn(editor, DESCRIBED_FILES)).toStrictEqual(DESCRIBED_FILES.map((file) => ({ file, lines: [] })))
  })
})

describe('the editor merge into empty team configs not listing the comments ruleset, on the same comments', () => {
  const editor = setUpEngineRun(FIXTURES_DIR, (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, COMMENTS_UNLISTED)), WRITTEN_FILES, buildEditorBuild())

  it('asks no comment for a reason', () => {
    expect(reasonReportLinesOn(editor, UNDESCRIBED_FILES)).toStrictEqual(UNDESCRIBED_FILES.map((file) => ({ file, lines: [] })))
  })
})
