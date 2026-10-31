import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findingsIn } from './check-output.ts'
import { checkInTheBackground, checkSignalledOnceTheFileChanges, checkSignalledTwiceWhileOxlintHoldsOn, EXIT, runCheck } from './cli-runs.ts'
import { checkedPackageFiles, DEBUGGER_STATEMENT, moduleText, REPORTED_FILE, REPORTING_RULESETS } from './factories/check-factories.ts'
import { createGitProject } from './git-projects.ts'
import { setUpTempProjects } from './temp-projects.ts'

// The signal specs watch a file while check runs, by a poll the watch stops once the file changed or the run ended. A
// poll left running is invisible to them, so these look at the timers the test file's process holds as the run ends:
// none, as vitest holds none of its own by then (it may as a test starts, so there is no count to take before). Each
// run is check outside a git repository, which ends before anything changes, so each watch ends by the run ending and
// nothing is signalled.

const WATCHED_FILE = 'watched.ts'
const HOLDING_MARKER = 'holding'
const ASKED_TO_STOP_MARKER = 'asked-to-stop'
const TIMER = 'Timeout'
// A check run outside a git repository ends in about two seconds alone, and slower beside the rest of the suite.
const CHECK_RUN_TIMEOUT_MS = 60_000
// Each line takes about 60 of the 8,000 characters check prints findings in.
const DEBUGGERS_PAST_THE_CAP = 200
const CUT_SHORT = /\+\d+ more findings in 1 file\./u

function timersRunning(): string[] {
  return process.getActiveResourcesInfo().filter((resource) => resource === TIMER)
}

describe('the watches signalled check runs wait on', () => {
  const tempProjects = setUpTempProjects()

  it("leave no timer running once a run ends before the file's text changed", { timeout: CHECK_RUN_TIMEOUT_MS }, async () => {
    const dir = tempProjects.create({ files: { [WATCHED_FILE]: 'export {}\n' } })
    const { signalled, run } = await checkSignalledOnceTheFileChanges(dir, join(dir, WATCHED_FILE), 'SIGINT')

    expect({ signalled, exitCode: run.exitCode, timers: timersRunning() }).toStrictEqual({ signalled: false, exitCode: EXIT.couldNotRun, timers: [] })
  })

  it('leave no timer running once a run ends before oxlint held on', { timeout: CHECK_RUN_TIMEOUT_MS }, async () => {
    const dir = tempProjects.create({})
    const { signalled, run, oxlintHeldOnPastTheRun } = await checkSignalledTwiceWhileOxlintHoldsOn(
      dir,
      { holding: join(dir, HOLDING_MARKER), askedToStop: join(dir, ASKED_TO_STOP_MARKER) },
      ['SIGINT', 'SIGINT'],
    )

    expect({ signalled, exitCode: run.exitCode, oxlintHeldOnPastTheRun, timers: timersRunning() }).toStrictEqual({
      signalled: false,
      exitCode: EXIT.couldNotRun,
      oxlintHeldOnPastTheRun: false,
      timers: [],
    })
  })
})

describe('the check runs a spec reads findings from', () => {
  const tempProjects = setUpTempProjects()

  function projectWithDebuggers(count: number): string {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REPORTING_RULESETS) })
    project.write(REPORTED_FILE, moduleText(...Array.from({ length: count }, () => DEBUGGER_STATEMENT)))
    return project.dir
  }

  it('give a run whose findings check printed whole', { timeout: CHECK_RUN_TIMEOUT_MS }, () => {
    const { exitCode, stdout } = runCheck(projectWithDebuggers(1))

    expect({ exitCode, findings: findingsIn(stdout) }).toStrictEqual({ exitCode: EXIT.findings, findings: [`${REPORTED_FILE}:1 no-debugger`] })
  })

  it('refuse a run whose list check cut short', { timeout: CHECK_RUN_TIMEOUT_MS }, () => {
    expect(() => runCheck(projectWithDebuggers(DEBUGGERS_PAST_THE_CAP))).toThrow(CUT_SHORT)
  })

  it('refuse a run in the background whose list check cut short', { timeout: CHECK_RUN_TIMEOUT_MS }, async () => {
    await expect(checkInTheBackground(projectWithDebuggers(DEBUGGERS_PAST_THE_CAP))).rejects.toThrow(CUT_SHORT)
  })
})
