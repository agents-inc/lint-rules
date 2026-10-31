import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PREFER_IMMEDIATE_RETURN,
  RETURNED_USING_RESOURCES,
  THROWN_USING_RESOURCES,
  USING_RESOURCE_ESCAPE,
  VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED,
} from './__tests__/cases/using-resource-sources.ts'
import { setUpEngineRun } from './__tests__/engine-run.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { projectPathOf } from './__tests__/project-paths.ts'
import { defineLintRules } from './index.ts'

// The editor shows what check prints (check-immediate-return-of-a-using-resource.integration.test.ts).

allowEveryTestForParallelLoad()

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/using-resources', import.meta.url))
const CORRECTNESS_AND_REDUNDANCY = { editorRulesets: { quality: ['correctness', 'redundancy'] } } as const
const ESLINT_ERROR = 2
const ALL_FILES = [...RETURNED_USING_RESOURCES, ...THROWN_USING_RESOURCES, ...VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED]

describe('the editor merge into empty team configs, on a returned or thrown `using` resource beside a returned and a thrown const', () => {
  const editor = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, CORRECTNESS_AND_REDUNDANCY)),
    Object.fromEntries(ALL_FILES.map(({ file, source }) => [file, source])),
    buildEditorBuild(),
  )

  function immediateReturnReportsOn(file: string): Array<{ readonly line: number; readonly offersAFix: boolean }> {
    const projectDir = editor.projectDir()
    return editor
      .eslintResults()
      .filter(({ filePath }) => projectPathOf(filePath, projectDir) === file)
      .flatMap(({ messages }) => messages)
      .filter(({ ruleId }) => ruleId === PREFER_IMMEDIATE_RETURN)
      .map(({ line, fix }) => ({ line, offersAFix: fix !== undefined }))
  }

  it('reports the escape of each returned `using` resource on its return line, in TypeScript and JavaScript, and nothing else there', () => {
    expect(RETURNED_USING_RESOURCES.map(({ file }) => ({ file, messages: editor.eslintMessagesOn(file) }))).toStrictEqual(
      RETURNED_USING_RESOURCES.map(({ file, line }) => ({ file, messages: [{ ruleId: USING_RESOURCE_ESCAPE, severity: ESLINT_ERROR, line }] })),
    )
  })

  it('reports nothing in each thrown `using` resource, in TypeScript and JavaScript', () => {
    expect(THROWN_USING_RESOURCES.map(({ file }) => ({ file, messages: editor.eslintMessagesOn(file) }))).toStrictEqual(
      THROWN_USING_RESOURCES.map(({ file }) => ({ file, messages: [] })),
    )
  })

  it('reports the returned const, the const returned beside a `using` resource and the thrown const by prefer-immediate-return, and offers its fix', () => {
    expect(VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED.map(({ file }) => ({ file, reports: immediateReturnReportsOn(file) }))).toStrictEqual(
      VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED.map(({ file, line }) => ({ file, reports: [{ line, offersAFix: true }] })),
    )
  })
})
