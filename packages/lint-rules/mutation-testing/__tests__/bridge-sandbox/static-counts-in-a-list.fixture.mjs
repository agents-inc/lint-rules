// A test file of the runs bridge-runs.ts makes whose test spawns a child that leaves, where children write their
// coverage, a file whose static map is a list of counts. Read as coverage, each count is credited to the test under a
// mutant named by its place in the list, with nothing failing.
import { expect, it } from 'vitest'
import { EXITED_CLEANLY, spawnChildWritingNoCoverageMap } from './spawn-children.mjs'

it('leaves a file whose static map is a list of counts where children write their coverage', () => {
  expect(spawnChildWritingNoCoverageMap('staticCountsInAList')).toStrictEqual(EXITED_CLEANLY)
})
