import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { tsIgnore } from './__tests__/cases/suppression-comments.ts'
import { AGENT_BUILD, type EngineRun, setUpEngineRun } from './__tests__/engine-run.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { projectPathOf } from './__tests__/project-paths.ts'
import { defineLintRules } from './index.ts'

// An editor lists a rule's suggestions as quick fixes. Where @ts-expect-error is banned too, typescript-eslint's
// suggestion to swap a @ts-ignore for one leads straight to a second report.

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/suppression-ban', import.meta.url))
const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'
const REPLACE_WITH_TS_EXPECT_ERROR = 'Replace "@ts-ignore" with "@ts-expect-error".: // @ts-expect-error the total is a string here'
const SOURCE_FILE = 'src/ts-ignore.ts'
const TEST_FILE = 'src/ts-ignore.test.ts'
const SETUP_FILE = 'src/vitest.setup.ts'
const FILES = { [SOURCE_FILE]: tsIgnore, [TEST_FILE]: tsIgnore, [SETUP_FILE]: tsIgnore }
const TYPE_SAFETY_FOR_EDITORS = { editorRulesets: { quality: ['type-safety'] } } as const

/** ban-ts-comment's reports on the file, each with the suggestions an editor would list for it. */
function suggestionsOn(run: EngineRun, file: string): Array<{ readonly line: number; readonly suggestions: readonly string[] }> {
  const projectDir = run.projectDir()
  return run
    .eslintResults()
    .filter(({ filePath }) => projectPathOf(filePath, projectDir) === file)
    .flatMap(({ messages }) => messages)
    .filter(({ ruleId }) => ruleId === TS_COMMENT_BAN)
    .map(({ line, suggestions }) => ({ line, suggestions: suggestions === undefined ? [] : suggestions.map(({ desc, fix }) => `${desc}: ${fix.text}`) }))
}

describe('the agent build, as check runs it, on a @ts-ignore, suppressions banned as shipped', () => {
  const agent = setUpEngineRun(FIXTURES_DIR, (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, {})), FILES, AGENT_BUILD)

  it('suggests no rewrite of it outside test files, where @ts-expect-error is banned too', () => {
    expect(suggestionsOn(agent, SOURCE_FILE)).toStrictEqual([{ line: 1, suggestions: [] }])
  })

  it.each([{ file: TEST_FILE }, { file: SETUP_FILE }])('suggests replacing it with a @ts-expect-error in $file, where a described one is allowed', ({ file }) => {
    expect(suggestionsOn(agent, file)).toStrictEqual([{ line: 1, suggestions: [REPLACE_WITH_TS_EXPECT_ERROR] }])
  })
})

describe('the editor merge into empty team configs, on a @ts-ignore outside test files, type-safety listed for editors', () => {
  const editor = setUpEngineRun(FIXTURES_DIR, (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, TYPE_SAFETY_FOR_EDITORS)), FILES, buildEditorBuild())

  it('suggests replacing it with a @ts-expect-error, which editors allow with a description', () => {
    expect(suggestionsOn(editor, SOURCE_FILE)).toStrictEqual([{ line: 1, suggestions: [REPLACE_WITH_TS_EXPECT_ERROR] }])
  })
})
