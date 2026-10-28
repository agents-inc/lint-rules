// A test file of the runs bridge-runs.ts makes that loads no instrumented code in its own process and covers mutants
// only in the children it spawns, as a test of this repo running only the built engines does: Stryker's namespace
// then holds no coverage until the bridge makes it.
import { beforeAll, expect, it } from 'vitest'
import { EXITED_CLEANLY, spawnChildCovering, throwUnlessExitedCleanly } from './spawn-children.mjs'

beforeAll(() => {
  throwUnlessExitedCleanly(spawnChildCovering('spawned-before-all', 'covered-by-a-child-spawned-before-all'))
})

it('covers code only in a child it spawns', () => {
  expect(spawnChildCovering('spawned-by-the-test', 'covered-by-a-child-of-the-test')).toStrictEqual(EXITED_CLEANLY)
})
