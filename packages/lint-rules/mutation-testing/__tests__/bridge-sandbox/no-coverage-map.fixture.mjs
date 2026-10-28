// A test file of the runs bridge-runs.ts makes whose test spawns a child that leaves, where children write their
// coverage, a file that is no coverage map: its hit count is text. Read as coverage, it adds up into text and is
// credited to the test, with nothing failing.
import { expect, it } from 'vitest'
import { EXITED_CLEANLY, spawnChildWritingNoCoverageMap } from './spawn-children.mjs'

it('leaves a file that is not a coverage map where children write their coverage', () => {
  expect(spawnChildWritingNoCoverageMap('static')).toStrictEqual(EXITED_CLEANLY)
})
