import { describe, expect, it } from 'vitest'
import { A_USELESS_RENAME, A_USELESS_RENAME_FIXED, COMPONENT_FILE_KINDS, vueComponentScripting } from './__tests__/cases/check-sources.ts'
import { autofixedFilesIn, findingMessagesIn, findingsIn, findingsInFile } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import {
  checkedPackageFiles,
  DEBUGGER_STATEMENT,
  exportedConstant,
  moduleText,
  REDUNDANCY,
  suppressionOfTheNextLine,
  SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED,
  unusedSuppressionMessageOf,
} from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'

// check lints the changed lines of Vue.js, Svelte and Astro components with oxlint's rules alone: ESLint
// never gets them, so neither its rules nor its suppression ban reach them (written limits).

allowEveryTestForParallelLoad()

const IGNORED_FOLDER = 'src/generated/**'
const NOT_LINTED = { 'src/ext/a.json': '{ "debugger": true }\n', 'src/ext/a.md': moduleText(DEBUGGER_STATEMENT), 'src/ext/a.css': 'a { color: red; }\n' }
const WITH_A_DEBUGGER = [exportedConstant('a'), DEBUGGER_STATEMENT]
// The debugger's line in each kind's script.
const DEBUGGER_SCRIPT_LINE = 2

describe('check on changed Vue, Svelte and Astro components', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: checkedPackageFiles(REDUNDANCY, { ignores: [IGNORED_FOLDER], ...SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED }),
    })
    for (const { extension, scripting } of COMPONENT_FILE_KINDS) {
      project.write(`src/a.${extension}`, moduleText(...scripting(WITH_A_DEBUGGER)))
      project.write(`src/fixed.${extension}`, moduleText(...scripting(A_USELESS_RENAME)))
      project.write(`src/generated/a.${extension}`, moduleText(...scripting(WITH_A_DEBUGGER)))
    }
    for (const [file, text] of Object.entries(NOT_LINTED)) project.write(file, text)
    project.write('src/allowed/unused.vue', moduleText(...vueComponentScripting([suppressionOfTheNextLine('oxlint', 'no-debugger'), exportedConstant('b'), suppressionOfTheNextLine('eslint', 'no-debugger'), exportedConstant('c')])))
    project.write('src/banned.vue', moduleText(...vueComponentScripting([suppressionOfTheNextLine('eslint', 'no-debugger'), DEBUGGER_STATEMENT])))
    project.write('src/banned-unused.vue', moduleText(...vueComponentScripting([suppressionOfTheNextLine('oxlint', 'no-debugger'), exportedConstant('d')])))
    const fixedFiles = COMPONENT_FILE_KINDS.map(({ extension }) => `src/fixed.${extension}`)
    const result = runCheck(project.dir)
    return { result, fixedFiles, fixed: textsOf(project.dir, fixedFiles) }
  })

  it.each(COMPONENT_FILE_KINDS)("reports oxlint's finding on a changed script line at its line in the file, and no parse error: $kind", ({ extension, firstScriptLine }) => {
    const file = `src/a.${extension}`

    expect(findingsInFile(runs().result.stdout, file)).toStrictEqual([`${file}:${String(firstScriptLine + DEBUGGER_SCRIPT_LINE - 1)} no-debugger`])
  })

  it("applies oxlint's fix on a changed script line of each kind, and names each file in the autofixed line", () => {
    const { result, fixedFiles, fixed } = runs()

    expect({ autofixed: autofixedFilesIn(result.stdout), fixed, findings: fixedFiles.flatMap((file) => findingsInFile(result.stdout, file)) }).toStrictEqual({
      autofixed: fixedFiles.toSorted(),
      fixed: Object.fromEntries(COMPONENT_FILE_KINDS.map(({ extension, scripting }) => [`src/fixed.${extension}`, moduleText(...scripting(A_USELESS_RENAME_FIXED))])),
      findings: [],
    })
  })

  it("reports nothing in a component the config's ignores name, and lints no .json, .md or .css file, beside the components it reports", () => {
    const { stdout } = runs().result

    expect({
      ignored: COMPONENT_FILE_KINDS.flatMap(({ extension }) => findingsInFile(stdout, `src/generated/a.${extension}`)),
      notLinted: Object.keys(NOT_LINTED).flatMap((file) => findingsInFile(stdout, file)),
    }).toStrictEqual({ ignored: [], notLinted: [] })
  })

  it("reports an unused suppression in oxlint's form where suppressions are allowed, none in ESLint's form, and bans none where they are banned", () => {
    const { stdout } = runs().result

    expect({
      allowed: findingsInFile(stdout, 'src/allowed/unused.vue'),
      message: findingMessagesIn(stdout).get('src/allowed/unused.vue:5 unused suppression'),
      banned: findingsInFile(stdout, 'src/banned.vue'),
    }).toStrictEqual({ allowed: ['src/allowed/unused.vue:5 unused suppression'], message: unusedSuppressionMessageOf('no-debugger'), banned: [] })
  })

  it("reports no unused suppression in oxlint's form where suppressions are banned, beside the one where they are allowed", () => {
    const { stdout } = runs().result

    expect({ banned: findingsInFile(stdout, 'src/banned-unused.vue'), allowed: findingsInFile(stdout, 'src/allowed/unused.vue') }).toStrictEqual({
      banned: [],
      allowed: ['src/allowed/unused.vue:5 unused suppression'],
    })
  })

  it('reports nothing beyond these, prints nothing on stderr, and exits 1', () => {
    const { exitCode, stderr, stdout } = runs().result

    expect({ exitCode, stderr, findings: findingsIn(stdout) }).toStrictEqual({
      exitCode: EXIT.findings,
      stderr: '',
      findings: ['src/a.astro:3 no-debugger', 'src/a.svelte:3 no-debugger', 'src/a.vue:6 no-debugger', 'src/allowed/unused.vue:5 unused suppression'],
    })
  })
})

describe('check on changed components, where a file override naming a component with no slash allows suppressions', () => {
  // A glob with no slash names the file at any depth, in both engines.
  const ALLOWED_BY_NAME = 'legacy.vue'
  const AN_UNUSED_SUPPRESSION = vueComponentScripting([suppressionOfTheNextLine('oxlint', 'no-debugger'), exportedConstant('value')])

  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: checkedPackageFiles(REDUNDANCY, { fileOverrides: [{ files: [ALLOWED_BY_NAME], allowSuppressions: true }] }),
    })
    project.write(`src/${ALLOWED_BY_NAME}`, moduleText(...AN_UNUSED_SUPPRESSION))
    project.write('src/other.vue', moduleText(...AN_UNUSED_SUPPRESSION))
    return runCheck(project.dir)
  })

  it("reports an unused suppression in oxlint's form in the component it names, a folder down, and none in another component, where they are banned", () => {
    const { exitCode, stderr, stdout } = run()

    expect({ exitCode, stderr, findings: findingsIn(stdout) }).toStrictEqual({ exitCode: EXIT.findings, stderr: '', findings: [`src/${ALLOWED_BY_NAME}:5 unused suppression`] })
  })
})
