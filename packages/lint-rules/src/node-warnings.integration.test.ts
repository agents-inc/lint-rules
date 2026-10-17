import { describe, expect, it } from 'vitest'
import { checkInTheBackground, EXIT, RUNS_IN_THE_BACKGROUND } from './__tests__/cli-runs.ts'
import {
  checkConfigText,
  checkedPackageFiles,
  CONFIG_FILE,
  emittingAWarning,
  exportedConstant,
  moduleText,
  REDUNDANCY,
} from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'

// Node 23 warns on stderr that type stripping is experimental as check imports agents-inc.lint.mts,
// so check drops that one warning and prints every other in Node's own form. The config here emits
// the warning itself, as Node 22 emits none.

allowEveryTestForParallelLoad()

// Node 23.10's own words (measured).
const NODES_TYPE_STRIPPING_WARNING = 'Type Stripping is an experimental feature and might change at any time'
// Experimental, and naming type stripping, but not as Node's warning starts.
const ANOTHER_EXPERIMENT = 'A loader that replaces Type Stripping is experimental'
// Starting as Node's warning does, but no experimental one.
const A_DEPRECATION = 'Type Stripping options in this config are deprecated'

describe('check where the config it imports has Node warn (Output contract)', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const config = `${checkConfigText(REDUNDANCY)}${moduleText(
      emittingAWarning('ExperimentalWarning', NODES_TYPE_STRIPPING_WARNING),
      emittingAWarning('ExperimentalWarning', ANOTHER_EXPERIMENT),
      emittingAWarning('DeprecationWarning', A_DEPRECATION),
    )}`
    const project = createGitProject(tempProjects, { repo: 'committed', files: { ...checkedPackageFiles(REDUNDANCY), [CONFIG_FILE]: config } })
    project.write('src/a.ts', moduleText(exportedConstant('a')))
    return checkInTheBackground(project.dir)
  }, RUNS_IN_THE_BACKGROUND)

  it("prints every warning but Node's on type stripping, each as the first line Node prints for it", () => {
    const { pid, run } = runs()

    expect(run).toStrictEqual({
      exitCode: EXIT.clean,
      signal: null,
      stdout: 'check: no findings in 1 changed file.\n',
      stderr: `(node:${String(pid)}) ExperimentalWarning: ${ANOTHER_EXPERIMENT}\n(node:${String(pid)}) DeprecationWarning: ${A_DEPRECATION}\n`,
    })
  })
})
