import { describe, expect, it } from 'vitest'
import { A_GLOBAL_FLAG_QUERY, TESTS_A_JEST_DOM_FIX_BREAKS } from './__tests__/cases/jest-dom-sources.ts'
import { autofixedFilesIn, findingsIn } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'

// Each of these tests passes as written and fails once its jest-dom rule's fix is applied, so check reports the
// finding and leaves the test as written, while it still applies the fix of a rule listed beside jest-dom.

allowEveryTestForParallelLoad()

const JEST_DOM_BESIDE_TESTING_LIBRARY = { libs: { testing: ['jest-dom', 'testing-library'] } } as const
const REPORTED_FILES = TESTS_A_JEST_DOM_FIX_BREAKS.map(({ file }) => file)
const AS_WRITTEN = Object.fromEntries(TESTS_A_JEST_DOM_FIX_BREAKS.map(({ file, source }) => [file, source]))
const JEST_DOM_FINDINGS = TESTS_A_JEST_DOM_FIX_BREAKS.map(({ file, line, rule }) => `${file}:${line} ${rule}`)

describe('check, run twice, on the tests a jest-dom fix breaks, beside a test a testing-library rule fixes', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(JEST_DOM_BESIDE_TESTING_LIBRARY) })
    for (const { file, source } of [...TESTS_A_JEST_DOM_FIX_BREAKS, A_GLOBAL_FLAG_QUERY]) project.write(file, source)
    const first = runCheck(project.dir)
    const afterFirst = textsOf(project.dir, [...REPORTED_FILES, A_GLOBAL_FLAG_QUERY.file])
    const second = runCheck(project.dir)
    const afterSecond = textsOf(project.dir, [...REPORTED_FILES, A_GLOBAL_FLAG_QUERY.file])
    return { first, afterFirst, second, afterSecond }
  })

  it('reports each test on the line of its assertion, by its jest-dom rule, and exits on the findings', () => {
    const { first } = run()

    expect({ exitCode: first.exitCode, findings: findingsIn(first.stdout) }).toStrictEqual({ exitCode: EXIT.findings, findings: JEST_DOM_FINDINGS })
  })

  it('leaves each test byte for byte and names none of them in the autofixed line', () => {
    const { first, afterFirst } = run()

    expect({
      texts: REPORTED_FILES.map((file) => afterFirst[file]),
      autofixed: autofixedFilesIn(first.stdout).filter((file) => REPORTED_FILES.includes(file)),
    }).toStrictEqual({ texts: REPORTED_FILES.map((file) => AS_WRITTEN[file]), autofixed: [] })
  })

  it('applies the testing-library fix beside them and names that test alone in the autofixed line', () => {
    const { first, afterFirst } = run()

    expect({ text: afterFirst[A_GLOBAL_FLAG_QUERY.file], autofixed: autofixedFilesIn(first.stdout) }).toStrictEqual({
      text: A_GLOBAL_FLAG_QUERY.fixed,
      autofixed: [A_GLOBAL_FLAG_QUERY.file],
    })
  })

  it('reports the same findings on a second run, fixes nothing and changes no file', () => {
    const { second, afterFirst, afterSecond } = run()

    expect({ exitCode: second.exitCode, findings: findingsIn(second.stdout), autofixed: autofixedFilesIn(second.stdout), texts: afterSecond }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: JEST_DOM_FINDINGS,
      autofixed: [],
      texts: afterFirst,
    })
  })
})
