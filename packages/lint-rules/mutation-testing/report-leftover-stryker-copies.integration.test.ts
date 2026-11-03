import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARALLEL_LOAD_TIMEOUT_MS } from '../src/__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from '../src/__tests__/runs-before-the-suite.ts'
import { fileNamedLike, filesOfABackup, strykerBackup, strykerCopy } from './__tests__/factories/stryker-copy-factories.ts'
import {
  createRepoHoldingCopies,
  createRepoHoldingCopiesBeside,
  createRepoWithNoStrykerFolder,
  processIn,
  type ReportRun,
  runTheReportAfterKillingARunWithAWorkerIn,
  runTheReportWhile,
  runTheReportWhileARunHasAWorkerIn,
  type StandIn,
  strykerRunByHandFrom,
  strykerRunFrom,
} from './__tests__/leftover-copy-runs.ts'

const COPY = strykerCopy('aaaaaa')
const OTHER_COPY = strykerCopy('bbbbbb')
const BACKUP = strykerBackup('cccccc')
const NOTHING_RUNNING: readonly StandIn[] = []
const SUCCEEDED = 0

const WARNING =
  'WARNING: no Stryker run is using these copies of the repo, and every test that walks the repo slows down while they are there. ' +
  'Remove each by hand:'

const SILENT: ReportRun = { exitCode: SUCCEEDED, stdout: '', stderr: '' }

function reportNaming(copies: readonly string[]): ReportRun {
  return { exitCode: SUCCEEDED, stdout: '', stderr: [WARNING, ...copies.map((copy) => `  ${copy}`), ''].join('\n') }
}

describe('the report of copies of the repo Stryker left in .stryker-tmp, run from the repo root as the test gate runs it', () => {
  const runs = setUpRunsBeforeTheSuite(
    async (tempProjects) => {
      const noStrykerFolder = createRepoWithNoStrykerFolder(tempProjects)
      const emptyStrykerFolder = createRepoHoldingCopies(tempProjects, [])
      const oneCopy = createRepoHoldingCopies(tempProjects, [COPY])
      const twoCopies = createRepoHoldingCopies(tempProjects, [OTHER_COPY, COPY])
      const backupBesideACopy = createRepoHoldingCopiesBeside(tempProjects, [COPY], filesOfABackup(BACKUP))
      const fileBesideACopy = createRepoHoldingCopiesBeside(tempProjects, [COPY], fileNamedLike(OTHER_COPY))
      const workerOfAKilledRun = createRepoHoldingCopies(tempProjects, [COPY])
      const workerOfALiveRun = createRepoHoldingCopies(tempProjects, [COPY])
      const otherProcessAtTheRoot = createRepoHoldingCopies(tempProjects, [COPY])
      const strykerStarting = createRepoHoldingCopies(tempProjects, [COPY])
      const thisRepo = createRepoHoldingCopies(tempProjects, [COPY])
      const otherRepo = createRepoHoldingCopies(tempProjects, [COPY])
      const otherReposRun = [strykerRunFrom(otherRepo), processIn(join(otherRepo, COPY))]
      const thisRepoBesideAHandRun = createRepoHoldingCopies(tempProjects, [COPY])
      const handRunRepo = createRepoHoldingCopies(tempProjects, [COPY])
      const handRun = [strykerRunByHandFrom(handRunRepo)]
      return {
        noStrykerFolder: await runTheReportWhile(noStrykerFolder, NOTHING_RUNNING),
        emptyStrykerFolder: await runTheReportWhile(emptyStrykerFolder, NOTHING_RUNNING),
        oneCopy: { ...(await runTheReportWhile(oneCopy, NOTHING_RUNNING)), copyAt: join(oneCopy, COPY) },
        twoCopies: await runTheReportWhile(twoCopies, NOTHING_RUNNING),
        backupBesideACopy: await runTheReportWhile(backupBesideACopy, NOTHING_RUNNING),
        fileBesideACopy: await runTheReportWhile(fileBesideACopy, NOTHING_RUNNING),
        workerOfAKilledRun: await runTheReportAfterKillingARunWithAWorkerIn(workerOfAKilledRun, join(workerOfAKilledRun, COPY)),
        workerOfALiveRun: await runTheReportWhileARunHasAWorkerIn(workerOfALiveRun, join(workerOfALiveRun, COPY)),
        otherProcessAtTheRoot: await runTheReportWhile(otherProcessAtTheRoot, [processIn(otherProcessAtTheRoot)]),
        strykerStarting: await runTheReportWhile(strykerStarting, [strykerRunFrom(strykerStarting)]),
        otherReposRunFromThisRepo: await runTheReportWhile(thisRepo, otherReposRun),
        otherReposRunFromItsOwnRoot: await runTheReportWhile(otherRepo, otherReposRun),
        handRunFromThisRepo: await runTheReportWhile(thisRepoBesideAHandRun, handRun),
        handRunFromItsOwnRoot: await runTheReportWhile(handRunRepo, handRun),
      }
    },
    { timeoutMs: PARALLEL_LOAD_TIMEOUT_MS, whatFailed: 'the report could not be run in a scratch repo before the suite' },
  )

  it('prints nothing where the repo has no .stryker-tmp', () => {
    expect(runs().noStrykerFolder).toStrictEqual(SILENT)
  })

  it('prints nothing where .stryker-tmp holds no copy', () => {
    expect(runs().emptyStrykerFolder).toStrictEqual(SILENT)
  })

  it('names a copy no Stryker run is using and says to remove it by hand, leaving it where it is and the gate going on', () => {
    const { copyAt, ...run } = runs().oneCopy

    expect({ run, isCopyStillThere: existsSync(copyAt) }).toStrictEqual({ run: reportNaming([COPY]), isCopyStillThere: true })
  })

  it('names every copy no Stryker run is using, in name order', () => {
    expect(runs().twoCopies).toStrictEqual(reportNaming([COPY, OTHER_COPY]))
  })

  it("never names a backup- folder, where Stryker's inPlace mode keeps the original files, beside the copy it names", () => {
    expect(runs().backupBesideACopy).toStrictEqual(reportNaming([COPY]))
  })

  it('never names a plain file named as Stryker names a copy, beside the copy it names', () => {
    expect(runs().fileBesideACopy).toStrictEqual(reportNaming([COPY]))
  })

  it('names the copy a worker still runs in after its Stryker run was killed, as workers outlive a killed run', () => {
    expect(runs().workerOfAKilledRun).toStrictEqual(reportNaming([COPY]))
  })

  it('prints nothing while a Stryker run started from the repo root has a worker in its copy', () => {
    expect(runs().workerOfALiveRun).toStrictEqual(SILENT)
  })

  it('still names the copy while a process that is not Stryker runs at the repo root, as the gate itself does', () => {
    expect(runs().otherProcessAtTheRoot).toStrictEqual(reportNaming([COPY]))
  })

  it('prints nothing while a Stryker run started from the repo root has yet to start a worker in its copy', () => {
    expect(runs().strykerStarting).toStrictEqual(SILENT)
  })

  it("names this repo's copy while another folder's Stryker run is live, which keeps that folder's own copy unnamed", () => {
    const { otherReposRunFromThisRepo, otherReposRunFromItsOwnRoot } = runs()

    expect({ fromThisRepo: otherReposRunFromThisRepo, fromTheOtherRepo: otherReposRunFromItsOwnRoot }).toStrictEqual({
      fromThisRepo: reportNaming([COPY]),
      fromTheOtherRepo: SILENT,
    })
  })

  it("names this repo's copy while a Stryker run started by hand in another folder names its bin by a path relative to that folder", () => {
    const { handRunFromThisRepo, handRunFromItsOwnRoot } = runs()

    expect({ fromThisRepo: handRunFromThisRepo, fromTheOtherRepo: handRunFromItsOwnRoot }).toStrictEqual({
      fromThisRepo: reportNaming([COPY]),
      fromTheOtherRepo: SILENT,
    })
  })
})
