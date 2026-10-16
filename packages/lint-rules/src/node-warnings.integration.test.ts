import { describe, expect, it } from 'vitest'
import { checkConfigText, checkedPackageFiles, CONFIG_FILE, emittingAWarning, exportedConstant, moduleText } from './__tests__/factories/check-factories.ts'
import { checkInTheBackground, createGitProject, EXIT, setUpAsyncRunsBeforeTheSuite } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'

// spec-cli.md "Output contract": stderr holds the note and why check could not run, and agents read
// it. Node 23 warns there that type stripping is experimental as check imports agents-inc.lint.mts,
// so check drops that one warning and prints every other as the first line of Node's own form. Here
// the config emits Node's warning itself, as the Node the tests run on (22) emits none.

allowEveryTestForParallelLoad()

const REDUNDANCY = { quality: ['redundancy'] } as const
// Node 23.10's own words (measured).
const NODES_TYPE_STRIPPING_WARNING = 'Type Stripping is an experimental feature and might change at any time'
// Experimental, and naming type stripping, but not as Node's warning starts.
const ANOTHER_EXPERIMENT = 'A loader that replaces Type Stripping is experimental'
// Starting as Node's warning does, but no experimental one.
const A_DEPRECATION = 'Type Stripping options in this config are deprecated'

describe('check where the config it imports has Node warn (Output contract)', () => {
  const runs = setUpAsyncRunsBeforeTheSuite(async (tempProjects) => {
    const config = `${checkConfigText(REDUNDANCY)}${moduleText(
      emittingAWarning('ExperimentalWarning', NODES_TYPE_STRIPPING_WARNING),
      emittingAWarning('ExperimentalWarning', ANOTHER_EXPERIMENT),
      emittingAWarning('DeprecationWarning', A_DEPRECATION),
    )}`
    const project = createGitProject(tempProjects, { repo: 'committed', files: { ...checkedPackageFiles(REDUNDANCY), [CONFIG_FILE]: config } })
    project.write('src/a.ts', moduleText(exportedConstant('a')))
    return checkInTheBackground(project.dir)
  })

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
