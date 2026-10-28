// A test file of the runs bridge-runs.ts makes, after the Stryker stand-in and the bridge. It covers mutants in its own
// process and spawns children covering others: while it loads, in its hooks and in each test. Each mutant it names is
// covered at one of those points alone, so the coverage the bridge credits to each test tells where it came from.
// The spawn while the file loads is on purpose: only the bridge's hand-over as it loads reaches that child.
import { afterAll, beforeAll, expect, it } from 'vitest'
import { cover } from './instrumented-module-stand-in.mjs'
import { EXITED_CLEANLY, spawnChildCovering, spawnChildLoadingNothing, throwUnlessExitedCleanly } from './spawn-children.mjs'

cover('covered-while-the-file-loads', 'covered-while-the-file-loads-and-in-a-hook')
throwUnlessExitedCleanly(spawnChildCovering('spawned-while-the-file-loads', 'covered-by-a-child-spawned-while-the-file-loads'))

beforeAll(() => {
  cover('covered-while-the-file-loads-and-in-a-hook', 'covered-before-all')
  throwUnlessExitedCleanly(spawnChildCovering('spawned-before-all', 'covered-by-a-child-spawned-before-all'))
})

afterAll(() => {
  cover('covered-after-all')
  throwUnlessExitedCleanly(spawnChildCovering('spawned-after-all', 'covered-by-a-child-spawned-after-all'))
})

it('covers code in its own process and in a child it spawns', () => {
  cover('covered-by-the-first-test')
  expect(spawnChildCovering('spawned-by-the-first-test', 'covered-by-a-child-of-the-first-test')).toStrictEqual(EXITED_CLEANLY)
})

it('spawns two children covering the same code, and one loading no instrumented code', () => {
  expect([
    spawnChildCovering('spawned-by-the-second-test', 'covered-by-two-children-of-the-second-test'),
    spawnChildCovering('spawned-again-by-the-second-test', 'covered-by-two-children-of-the-second-test'),
    spawnChildLoadingNothing(),
  ]).toStrictEqual([EXITED_CLEANLY, EXITED_CLEANLY, EXITED_CLEANLY])
})
