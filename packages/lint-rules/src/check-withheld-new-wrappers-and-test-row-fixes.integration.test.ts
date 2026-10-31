import { describe, expect, it } from 'vitest'
import { CODE_A_WITHHELD_FIX_WOULD_BREAK } from './__tests__/cases/accepted-1011-check-sources.ts'
import { WRAP, WRAP_FIXED } from './__tests__/cases/check-sources.ts'
import { autofixedFilesIn, findingsIn } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles, moduleText } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'

// no-new-wrappers runs in oxlint and sonarjs/no-duplicate-parameterized-test-case in ESLint: one withheld fix per engine.

allowEveryTestForParallelLoad()

const CORRECTNESS_AND_TESTS_BESIDE_MODERN_JS = { quality: ['correctness', 'tests', 'modern-js'] } as const
const FIXED_BESIDE = 'src/wrap.ts'
const REPORTED_FILES = CODE_A_WITHHELD_FIX_WOULD_BREAK.map(({ file }) => file)
const AS_WRITTEN = Object.fromEntries(CODE_A_WITHHELD_FIX_WOULD_BREAK.map(({ file, source }) => [file, source]))
const WITHHELD_FINDINGS = CODE_A_WITHHELD_FIX_WOULD_BREAK.map(({ file, line, rule }) => `${file}:${line} ${rule}`)

describe('check, run twice, on the files a withheld no-new-wrappers or duplicate-test-row fix would break, beside a file a modern-js rule fixes', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(CORRECTNESS_AND_TESTS_BESIDE_MODERN_JS) })
    for (const { file, source } of CODE_A_WITHHELD_FIX_WOULD_BREAK) project.write(file, source)
    project.write(FIXED_BESIDE, moduleText(...WRAP))
    const first = runCheck(project.dir)
    const afterFirst = textsOf(project.dir, [...REPORTED_FILES, FIXED_BESIDE])
    const second = runCheck(project.dir)
    const afterSecond = textsOf(project.dir, [...REPORTED_FILES, FIXED_BESIDE])
    return { first, afterFirst, second, afterSecond }
  })

  it('reports each file on the line its rule names, by that rule, and exits on the findings', () => {
    const { first } = run()

    expect({ exitCode: first.exitCode, findings: findingsIn(first.stdout) }).toStrictEqual({ exitCode: EXIT.findings, findings: WITHHELD_FINDINGS })
  })

  it('leaves each file byte for byte and names none of them in the autofixed line', () => {
    const { first, afterFirst } = run()

    expect({
      texts: REPORTED_FILES.map((file) => afterFirst[file]),
      autofixed: autofixedFilesIn(first.stdout).filter((file) => REPORTED_FILES.includes(file)),
    }).toStrictEqual({ texts: REPORTED_FILES.map((file) => AS_WRITTEN[file]), autofixed: [] })
  })

  it('applies the modern-js fix beside them and names that file alone in the autofixed line', () => {
    const { first, afterFirst } = run()

    expect({ text: afterFirst[FIXED_BESIDE], autofixed: autofixedFilesIn(first.stdout) }).toStrictEqual({
      text: moduleText(...WRAP_FIXED),
      autofixed: [FIXED_BESIDE],
    })
  })

  it('reports the same findings on a second run, fixes nothing and changes no file', () => {
    const { second, afterFirst, afterSecond } = run()

    expect({ exitCode: second.exitCode, findings: findingsIn(second.stdout), autofixed: autofixedFilesIn(second.stdout), texts: afterSecond }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: WITHHELD_FINDINGS,
      autofixed: [],
      texts: afterFirst,
    })
  })
})
