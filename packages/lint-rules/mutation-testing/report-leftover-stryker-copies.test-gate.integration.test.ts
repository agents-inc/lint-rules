import { describe, expect, it } from 'vitest'
import { PARALLEL_LOAD_TIMEOUT_MS } from '../src/__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from '../src/__tests__/runs-before-the-suite.ts'
import { reportNaming, silentReport } from './__tests__/factories/report-run-factories.ts'
import { strykerCopy } from './__tests__/factories/stryker-copy-factories.ts'
import { createRepoHoldingCopies, createRepoWithNoStrykerFolder } from './__tests__/leftover-copy-runs.ts'
import {
  isTheReportCached,
  linkTheReportInto,
  packagesWhoseTestRuns,
  planOfTheTestGate,
  REPORT_TASK,
  runTheRootReportScriptFrom,
  tasksBeforeTheTestOf,
} from './__tests__/test-gate-runs.ts'

const COPY = strykerCopy('aaaaaa')
// Held to the packages turbo runs a test in by a test below.
const PACKAGES_WITH_A_TEST = ['@agents-inc/lint-rules', '@workspace/eslint-plugin-house', '@workspace/rule-data']

describe('bun run test, the test gate, as turbo plans it from the repo root', () => {
  const plan = setUpRunsBeforeTheSuite(() => planOfTheTestGate(), {
    timeoutMs: PARALLEL_LOAD_TIMEOUT_MS,
    whatFailed: 'turbo could not plan the test gate before the suite',
  })

  it.each(PACKAGES_WITH_A_TEST)('runs the report of copies Stryker left in .stryker-tmp before the tests of %s start', (packageName) => {
    expect(tasksBeforeTheTestOf(plan(), packageName)).toContain(REPORT_TASK)
  })

  it('runs a test in these packages and no other', () => {
    expect(packagesWhoseTestRuns(plan())).toStrictEqual(PACKAGES_WITH_A_TEST)
  })

  it("runs the report every time, never replaying an earlier run's output from turbo's cache", () => {
    expect(isTheReportCached(plan())).toBe(false)
  })
})

describe('the root script turbo runs the report through, run from the repo root as turbo runs it', () => {
  const runs = setUpRunsBeforeTheSuite(
    (tempProjects) => {
      const noStrykerFolder = createRepoWithNoStrykerFolder(tempProjects)
      const oneCopy = createRepoHoldingCopies(tempProjects, [COPY])
      linkTheReportInto(noStrykerFolder)
      linkTheReportInto(oneCopy)
      return { noStrykerFolder: runTheRootReportScriptFrom(noStrykerFolder), oneCopy: runTheRootReportScriptFrom(oneCopy) }
    },
    { timeoutMs: PARALLEL_LOAD_TIMEOUT_MS, whatFailed: 'the root script could not be run in a scratch repo before the suite' },
  )

  it("prints nothing at all where Stryker left no copy, Node's own type-stripping warning included", () => {
    expect(runs().noStrykerFolder).toStrictEqual(silentReport())
  })

  it('names the copy Stryker left and exits 0, so the tests after it still run', () => {
    expect(runs().oneCopy).toStrictEqual(reportNaming([COPY]))
  })
})
