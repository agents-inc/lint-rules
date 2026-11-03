import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  describedTsExpectErrorIn,
  HOOK_FILE_NAMES,
  hookCalledAsAGlobalIn,
  NOT_A_SETUP_FILE_NAME,
  OTHER_JS_EXTENSIONS,
  OTHER_TS_EXTENSIONS,
  otherExtensionProjectFiles,
  reportsOfTheStateAClassKeeps,
  reportsOfTheStateAHookKeeps,
  reportsOfTheStateAHookKeepsInAHookFile,
  RULE_TEST_FILES_KEEP,
  RULES_TEST_FILES_SKIP,
  RULES_TEST_FILES_SKIP_IN_JS,
  SETUP_FILE_NAMES,
  setupFileProjectFiles,
  stateAClassKeepsIn,
  stateAHookKeepsIn,
  TEST_FILE_NAME,
  TS_COMMENT_BAN,
  tsIgnoreIn,
  UNDEFINED_NAMES,
} from './__tests__/cases/setup-file-sources.ts'
import { findingMessagesIn, findingsIn, lastLineOf } from './__tests__/check-output.ts'
import { runCheck, setUpCheckAfterTheAgent } from './__tests__/cli-runs.ts'
import { setUpEngineRun } from './__tests__/engine-run.ts'
import { checkedPackageFiles, packageTsconfigText, TAKING_IN_SRC } from './__tests__/factories/check-factories.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { defineLintRules } from './index.ts'

// A test runner's setup file registers hooks and keeps state as a test file does, so a file by one of the
// usual setup-file names gets test files' relaxed rules; a file by any other name gets a source file's.

allowEveryTestForParallelLoad()

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/suppression-ban', import.meta.url))
const RULESETS = { quality: ['correctness', 'type-safety', 'declarative'] } as const
const RULES_READ = [...RULES_TEST_FILES_SKIP, ...RULES_TEST_FILES_SKIP_IN_JS, RULE_TEST_FILES_KEEP, UNDEFINED_NAMES, TS_COMMENT_BAN]
const SETUP_FILES = SETUP_FILE_NAMES.map((name) => ({ name }))
const TEST_AND_SETUP_FILE_NAMES = [TEST_FILE_NAME, ...SETUP_FILE_NAMES]
const IN_OTHER_TS_EXTENSIONS = TEST_AND_SETUP_FILE_NAMES.flatMap((name) => OTHER_TS_EXTENSIONS.map((extension) => ({ name, extension })))
const IN_OTHER_JS_EXTENSIONS = TEST_AND_SETUP_FILE_NAMES.flatMap((name) => OTHER_JS_EXTENSIONS.map((extension) => ({ name, extension })))
const OTHER_TS_EXTENSION_ROWS = OTHER_TS_EXTENSIONS.map((extension) => ({ extension }))
const HOOK_FILES_IN_OTHER_TS_EXTENSIONS = HOOK_FILE_NAMES.flatMap((name) => OTHER_TS_EXTENSIONS.map((extension) => ({ name, extension })))
const OTHER_JS_EXTENSION_ROWS = OTHER_JS_EXTENSIONS.map((extension) => ({ extension }))
const THE_OTHER_COMMENT = '@ts-expect-error'
const FIX_THE_TYPE_ERROR = /\bfix\b.+\btype error\b/iu
const LIST_IS_COMPLETE = /The list is complete/u

function findingsOf(findings: readonly string[], file: string): string[] {
  return findings.filter((finding) => finding.startsWith(`${file}:`) && RULES_READ.some((rule) => finding.endsWith(` ${rule}`))).toSorted()
}

function adviceOf(message: string): { readonly saysToFixTheTypeError: boolean; readonly namesTheOtherComment: boolean } {
  return { saysToFixTheTypeError: FIX_THE_TYPE_ERROR.test(message), namesTheOtherComment: message.includes(THE_OTHER_COMMENT) }
}

describe('check on files an agent wrote, by each usual setup-file name and by another, suppressions banned as shipped', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { ...checkedPackageFiles(RULESETS), 'tsconfig.json': packageTsconfigText(TAKING_IN_SRC) } })
    for (const [file, source] of Object.entries(setupFileProjectFiles())) project.write(file, source)
    return runCheck(project.dir)
  })

  it('prints every finding, so one missing from the list was not made', () => {
    expect(lastLineOf(runs().stdout)).toMatch(LIST_IS_COMPLETE)
  })

  it.each(SETUP_FILES)('reports in a $name file only the rule test files keep, of the rules a source file breaks there', ({ name }) => {
    const { file } = stateAHookKeepsIn(name)

    expect(findingsOf(findingsIn(runs().stdout), file)).toStrictEqual([`${file}:4 ${RULE_TEST_FILES_KEEP}`])
  })

  it('reports in a file named like no setup file every rule a source file breaks there', () => {
    const { file } = stateAHookKeepsIn(NOT_A_SETUP_FILE_NAME)

    expect(findingsOf(findingsIn(runs().stdout), file)).toStrictEqual(reportsOfTheStateAHookKeeps(file).toSorted())
  })

  it.each(SETUP_FILES)("reports no test runner's hook called as a global in a $name JS file", ({ name }) => {
    expect(findingsOf(findingsIn(runs().stdout), hookCalledAsAGlobalIn(name).file)).toStrictEqual([])
  })

  it("reports a test runner's hook called as a global in a JS file named like no setup file, as undefined", () => {
    const { file } = hookCalledAsAGlobalIn(NOT_A_SETUP_FILE_NAME)

    expect(findingsOf(findingsIn(runs().stdout), file)).toStrictEqual([`${file}:1 ${UNDEFINED_NAMES}`])
  })

  it.each(SETUP_FILES)('allows a described @ts-expect-error in a $name file, as in a test file', ({ name }) => {
    expect(findingsOf(findingsIn(runs().stdout), describedTsExpectErrorIn(name).file)).toStrictEqual([])
  })

  it('reports a described @ts-expect-error in a file named like no setup file, as in any source file', () => {
    const { file } = describedTsExpectErrorIn(NOT_A_SETUP_FILE_NAME)

    expect(findingsOf(findingsIn(runs().stdout), file)).toStrictEqual([`${file}:1 ${TS_COMMENT_BAN}`])
  })

  it.each(SETUP_FILES)("answers a @ts-ignore in a $name file with typescript-eslint's advice to use the @ts-expect-error allowed there", ({ name }) => {
    const { file } = tsIgnoreIn(name)
    const message = findingMessagesIn(runs().stdout).get(`${file}:1 ${TS_COMMENT_BAN}`) ?? ''

    expect(adviceOf(message)).toStrictEqual({ saysToFixTheTypeError: false, namesTheOtherComment: true })
  })

  it('tells a @ts-ignore in a file named like no setup file to fix the type error, as @ts-expect-error is banned there too', () => {
    const { file } = tsIgnoreIn(NOT_A_SETUP_FILE_NAME)
    const message = findingMessagesIn(runs().stdout).get(`${file}:1 ${TS_COMMENT_BAN}`) ?? ''

    expect(adviceOf(message)).toStrictEqual({ saysToFixTheTypeError: true, namesTheOtherComment: false })
  })
})

describe('check on test and setup files ending .mts, .cts, .mjs or .cjs, suppressions banned as shipped', () => {
  const runs = setUpCheckAfterTheAgent({ ...checkedPackageFiles(RULESETS), 'tsconfig.json': packageTsconfigText(TAKING_IN_SRC) }, (project) => {
    for (const [file, source] of Object.entries(otherExtensionProjectFiles())) project.write(file, source)
  })

  it('prints every finding, so one missing from the list was not made', () => {
    expect(lastLineOf(runs().stdout)).toMatch(LIST_IS_COMPLETE)
  })

  it.each(IN_OTHER_TS_EXTENSIONS)('reports in a $name file ending .$extension only the rule test files keep, as in its .ts twin', ({ name, extension }) => {
    const { file } = stateAHookKeepsIn(name, extension)

    expect(findingsOf(findingsIn(runs().stdout), file)).toStrictEqual([`${file}:4 ${RULE_TEST_FILES_KEEP}`])
  })

  it.each(OTHER_TS_EXTENSION_ROWS)('reports in a file named like no setup file, ending .$extension, every rule a source file breaks there', ({ extension }) => {
    const { file } = stateAHookKeepsIn(NOT_A_SETUP_FILE_NAME, extension)

    expect(findingsOf(findingsIn(runs().stdout), file)).toStrictEqual(reportsOfTheStateAHookKeeps(file).toSorted())
  })

  it.each(HOOK_FILES_IN_OTHER_TS_EXTENSIONS)('reports in a $name hook file ending .$extension every rule a source file breaks there but the two that skip hook files', ({ name, extension }) => {
    const { file } = stateAHookKeepsIn(name, extension)

    expect(findingsOf(findingsIn(runs().stdout), file)).toStrictEqual(reportsOfTheStateAHookKeepsInAHookFile(file))
  })

  it.each(IN_OTHER_JS_EXTENSIONS)('reports in a $name file ending .$extension none of the rules test files skip, as in its .js twin', ({ name, extension }) => {
    expect(findingsOf(findingsIn(runs().stdout), stateAClassKeepsIn(name, extension).file)).toStrictEqual([])
  })

  it.each(OTHER_JS_EXTENSION_ROWS)('reports in a file named like no setup file, ending .$extension, every rule a source file breaks there', ({ extension }) => {
    const { file } = stateAClassKeepsIn(NOT_A_SETUP_FILE_NAME, extension)

    expect(findingsOf(findingsIn(runs().stdout), file)).toStrictEqual(reportsOfTheStateAClassKeeps(file))
  })

  it.each(IN_OTHER_TS_EXTENSIONS)('allows a described @ts-expect-error in a $name file ending .$extension, as in its .ts twin', ({ name, extension }) => {
    expect(findingsOf(findingsIn(runs().stdout), describedTsExpectErrorIn(name, extension).file)).toStrictEqual([])
  })

  it.each(OTHER_TS_EXTENSION_ROWS)('reports a described @ts-expect-error in a file named like no setup file, ending .$extension', ({ extension }) => {
    const { file } = describedTsExpectErrorIn(NOT_A_SETUP_FILE_NAME, extension)

    expect(findingsOf(findingsIn(runs().stdout), file)).toStrictEqual([`${file}:1 ${TS_COMMENT_BAN}`])
  })
})

describe('the editor merge into empty team configs, on files by each usual setup-file name and by another', () => {
  const editor = setUpEngineRun(FIXTURES_DIR, (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, { editorRulesets: RULESETS })), { ...setupFileProjectFiles(), ...otherExtensionProjectFiles() }, buildEditorBuild())

  function editorFindingsOn(file: string): string[] {
    return findingsOf(
      editor.eslintMessagesOn(file).map(({ ruleId, line }) => `${file}:${String(line)} ${String(ruleId)}`),
      file,
    )
  }

  it.each(SETUP_FILES)('reports in a $name file only the rule test files keep, of the rules a source file breaks there', ({ name }) => {
    const { file } = stateAHookKeepsIn(name)

    expect(editorFindingsOn(file)).toStrictEqual([`${file}:4 ${RULE_TEST_FILES_KEEP}`])
  })

  it('reports in a file named like no setup file every rule a source file breaks there', () => {
    const { file } = stateAHookKeepsIn(NOT_A_SETUP_FILE_NAME)

    expect(editorFindingsOn(file)).toStrictEqual(reportsOfTheStateAHookKeeps(file).toSorted())
  })

  it.each(SETUP_FILES)("reports no test runner's hook called as a global in a $name JS file", ({ name }) => {
    expect(editorFindingsOn(hookCalledAsAGlobalIn(name).file)).toStrictEqual([])
  })

  it("reports a test runner's hook called as a global in a JS file named like no setup file, as undefined", () => {
    const { file } = hookCalledAsAGlobalIn(NOT_A_SETUP_FILE_NAME)

    expect(editorFindingsOn(file)).toStrictEqual([`${file}:1 ${UNDEFINED_NAMES}`])
  })

  it.each(IN_OTHER_TS_EXTENSIONS)('reports in a $name file ending .$extension only the rule test files keep, as in its .ts twin', ({ name, extension }) => {
    const { file } = stateAHookKeepsIn(name, extension)

    expect(editorFindingsOn(file)).toStrictEqual([`${file}:4 ${RULE_TEST_FILES_KEEP}`])
  })

  it.each(OTHER_TS_EXTENSION_ROWS)('reports in a file named like no setup file, ending .$extension, every rule a source file breaks there', ({ extension }) => {
    const { file } = stateAHookKeepsIn(NOT_A_SETUP_FILE_NAME, extension)

    expect(editorFindingsOn(file)).toStrictEqual(reportsOfTheStateAHookKeeps(file).toSorted())
  })

  it.each(HOOK_FILES_IN_OTHER_TS_EXTENSIONS)('reports in a $name hook file ending .$extension every rule a source file breaks there but the two that skip hook files', ({ name, extension }) => {
    const { file } = stateAHookKeepsIn(name, extension)

    expect(editorFindingsOn(file)).toStrictEqual(reportsOfTheStateAHookKeepsInAHookFile(file))
  })

  it.each(IN_OTHER_JS_EXTENSIONS)('reports in a $name file ending .$extension none of the rules test files skip, as in its .js twin', ({ name, extension }) => {
    expect(editorFindingsOn(stateAClassKeepsIn(name, extension).file)).toStrictEqual([])
  })

  it.each(OTHER_JS_EXTENSION_ROWS)('reports in a file named like no setup file, ending .$extension, every rule a source file breaks there', ({ extension }) => {
    const { file } = stateAClassKeepsIn(NOT_A_SETUP_FILE_NAME, extension)

    expect(editorFindingsOn(file)).toStrictEqual(reportsOfTheStateAClassKeeps(file))
  })
})
