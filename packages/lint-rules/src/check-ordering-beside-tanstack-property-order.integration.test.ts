import { describe, expect, it } from 'vitest'
import { OPTIONS_OF_CALLS_THE_PROPERTY_ORDER_RULES_NAME, OPTIONS_PASSED_TO_ANOTHER_CALL, OPTIONS_SPREADING_A_CONDITION_OR_A_CALL } from './__tests__/cases/tanstack-zod-check-sources.ts'
import { autofixedFilesIn, findingsIn, notCheckedIn } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'

// The two TanStack property-order rules are left out, so check runs sort-objects alone on the options of the calls they
// would order: it reports them as any other call's and withholds its fix, so a second run finds the same and changes
// nothing.

allowEveryTestForParallelLoad()

const ORDERING_BESIDE_TANSTACK = { quality: ['ordering'], libs: { data: ['tanstack-query'], routing: ['tanstack-router'] } } as const
const FILES = [OPTIONS_PASSED_TO_ANOTHER_CALL, ...OPTIONS_OF_CALLS_THE_PROPERTY_ORDER_RULES_NAME, ...OPTIONS_SPREADING_A_CONDITION_OR_A_CALL]
const PATHS = FILES.map(({ file }) => file)
const AS_WRITTEN = Object.fromEntries(FILES.map(({ file, source }) => [file, source]))
// In path order, as check prints its findings: the other call's file sorts before the rest.
const FINDINGS = [
  ...OPTIONS_PASSED_TO_ANOTHER_CALL.linesReported.map((line) => `${OPTIONS_PASSED_TO_ANOTHER_CALL.file}:${String(line)} ${OPTIONS_PASSED_TO_ANOTHER_CALL.rule}`),
  ...OPTIONS_OF_CALLS_THE_PROPERTY_ORDER_RULES_NAME.flatMap(({ file, linesSortObjectsReports }) =>
    linesSortObjectsReports.map((line) => `${file}:${String(line)} ${OPTIONS_PASSED_TO_ANOTHER_CALL.rule}`),
  ),
]

describe("check, run twice with the ordering ruleset beside TanStack Query and TanStack Router, on options out of alphabetical order passed to the calls the property-order rules would order, to Hono's createRoute and to another call, and on route options spreading a condition's or a call's result", () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(ORDERING_BESIDE_TANSTACK) })
    for (const { file, source } of FILES) project.write(file, source)
    const first = runCheck(project.dir)
    const afterFirst = textsOf(project.dir, PATHS)
    const second = runCheck(project.dir)
    const afterSecond = textsOf(project.dir, PATHS)
    return { first, afterFirst, second, afterSecond }
  })

  it('checks every file, each route spreading a condition or a call included', () => {
    const { first } = run()

    expect(notCheckedIn(first.stdout)).toStrictEqual([])
  })

  it("reports by sort-objects the options passed to each call, Hono's createRoute and the other call included, and exits on the findings", () => {
    const { first } = run()

    expect({ exitCode: first.exitCode, findings: findingsIn(first.stdout) }).toStrictEqual({ exitCode: EXIT.findings, findings: FINDINGS })
  })

  it('leaves every file byte for byte, since check withholds the sort-objects fix, and names none in the autofixed line', () => {
    const { first, afterFirst } = run()

    expect({ texts: afterFirst, autofixed: autofixedFilesIn(first.stdout) }).toStrictEqual({ texts: AS_WRITTEN, autofixed: [] })
  })

  it('reports the same findings on a second run, fixes nothing and changes no file', () => {
    const { second, afterSecond } = run()

    expect({ exitCode: second.exitCode, findings: findingsIn(second.stdout), autofixed: autofixedFilesIn(second.stdout), texts: afterSecond }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: FINDINGS,
      autofixed: [],
      texts: AS_WRITTEN,
    })
  })
})
