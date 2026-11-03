import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { tsIgnore } from './__tests__/cases/suppression-comments.ts'
import { setUpEngineRun } from './__tests__/engine-run.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { projectPathOf } from './__tests__/project-paths.ts'
import { defineLintRules } from './index.ts'

// Editors allow a described @ts-expect-error, so typescript-eslint's advice to use one leads to code that passes
// there. Editors run ban-ts-comment only where their rulesets list type-safety.

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/suppression-ban', import.meta.url))
const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'
const THE_OTHER_COMMENT = '@ts-expect-error'
const FIX_THE_TYPE_ERROR = /\bfix\b.+\btype error\b/iu
const TS_IGNORE_FILE = 'src/ts-ignore.ts'
const ESLINT_ERROR = 2
const TYPE_SAFETY_FOR_EDITORS = { editorRulesets: { quality: ['type-safety'] } } as const

describe('the editor merge into empty team configs, on a @ts-ignore outside test files, with no editor ruleset listed', () => {
  const editor = setUpEngineRun(FIXTURES_DIR, (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, {})), { [TS_IGNORE_FILE]: tsIgnore }, buildEditorBuild())

  it('reports nothing on it', () => {
    expect(editor.eslintMessagesOn(TS_IGNORE_FILE)).toStrictEqual([])
  })
})

describe('the editor merge into empty team configs, on a @ts-ignore outside test files, type-safety listed for editors', () => {
  const editor = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, TYPE_SAFETY_FOR_EDITORS)),
    { [TS_IGNORE_FILE]: tsIgnore },
    buildEditorBuild(),
  )

  function banMessagesOn(file: string): string[] {
    const projectDir = editor.projectDir()
    return editor
      .eslintResults()
      .filter(({ filePath }) => projectPathOf(filePath, projectDir) === file)
      .flatMap(({ messages }) => messages)
      .filter(({ ruleId }) => ruleId === TS_COMMENT_BAN)
      .map(({ message }) => message)
  }

  it('reports it once, on its line, under the ban', () => {
    expect(editor.eslintMessagesOn(TS_IGNORE_FILE)).toStrictEqual([{ ruleId: TS_COMMENT_BAN, severity: ESLINT_ERROR, line: 1 }])
  })

  it("answers it with typescript-eslint's advice to use @ts-expect-error, which editors allow with a description", () => {
    const [message = ''] = banMessagesOn(TS_IGNORE_FILE)

    expect({ saysToFixTheTypeError: FIX_THE_TYPE_ERROR.test(message), namesTheOtherComment: message.includes(THE_OTHER_COMMENT) }).toStrictEqual({
      saysToFixTheTypeError: false,
      namesTheOtherComment: true,
    })
  })
})
