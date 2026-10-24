import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type CollectTimeThrow, collectTimeThrowsIn } from './__tests__/collect-time-throws.ts'
import { PARALLEL_LOAD_TIMEOUT_MS } from './__tests__/parallel-load.ts'
import { projectPathOf } from './__tests__/project-paths.ts'
import { isRepoSource, repoSourceFiles } from './__tests__/repo-programs.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
// A throw while vitest collects a file fails the whole file: a plain run reports a file error naming no
// assertion, and Stryker reads the mutant behind it as Survived. So nothing that can throw runs then.
const TEST_FILE = /\.test\.ts$/u

// The finder names a helper module as the program holds it, by its path on this machine.
function withTheModuleByRepoPath({ module, ...found }: CollectTimeThrow): CollectTimeThrow {
  return module === undefined ? found : { ...found, module: projectPathOf(module, REPO_ROOT) }
}

describe("the repo's test files, as vitest collects them", () => {
  const collectTimeThrows = setUpRunsBeforeTheSuite(
    () =>
      repoSourceFiles()
        .filter(({ path }) => TEST_FILE.test(path))
        .flatMap(({ path, sourceFile, checker }) =>
          collectTimeThrowsIn(sourceFile, checker, isRepoSource).map((found) => ({ file: path, ...withTheModuleByRepoPath(found) })),
        ),
    { timeoutMs: PARALLEL_LOAD_TIMEOUT_MS, whatFailed: "the repo's TypeScript could not be read" },
  )

  it('make no call that can throw at the top level, in a describe body, in an .each table or at the top level of a helper they load', () => {
    expect(collectTimeThrows()).toStrictEqual([])
  })
})
