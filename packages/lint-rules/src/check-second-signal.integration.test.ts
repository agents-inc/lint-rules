import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkSignalledTwiceWhileOxlintHoldsOn, EXIT, RUNS_IN_THE_BACKGROUND, tempConfigsIn } from './__tests__/cli-runs.ts'
import { CHECK_INTERRUPTED, checkedPackageFiles, DEBUGGER_STATEMENT, exportedConstant, moduleText, REDUNDANCY } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'

// spec-cli.md "Signals and leftovers", q-c2: a first SIGINT or SIGTERM lets check stop what it was
// doing and exit 130 or 143; a second exits at once, removing what check left. Here the oxlint fix
// run that the first signal stops holds on, as a hung child would, so only the second ends check.

allowEveryTestForParallelLoad()

describe('check signalled again while a child it asked to stop holds on', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY) })
    project.write('src/a.ts', moduleText(exportedConstant('a'), DEBUGGER_STATEMENT))
    const markers = { holding: join(project.dir, '..', 'oxlint-holding-on'), askedToStop: join(project.dir, '..', 'oxlint-asked-to-stop') }
    const signalledTwice = await checkSignalledTwiceWhileOxlintHoldsOn(project.dir, markers, ['SIGINT', 'SIGTERM'])
    return { signalledTwice, leftovers: tempConfigsIn(project.dir) }
  }, RUNS_IN_THE_BACKGROUND)

  it('exits at once, with 130 for the first signal, having said it was interrupted, while the child still holds on, and leaves no temporary config', () => {
    const { signalledTwice, leftovers } = runs()

    expect({ signalled: signalledTwice.signalled, run: signalledTwice.run, oxlintHeldOnPastTheRun: signalledTwice.oxlintHeldOnPastTheRun, leftovers }).toStrictEqual({
      signalled: true,
      run: { exitCode: EXIT.interrupted, signal: null, stdout: '', stderr: CHECK_INTERRUPTED },
      oxlintHeldOnPastTheRun: true,
      leftovers: [],
    })
  })
})
