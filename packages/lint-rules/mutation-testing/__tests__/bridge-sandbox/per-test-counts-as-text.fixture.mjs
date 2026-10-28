// A test file of the runs bridge-runs.ts makes whose test spawns a child that leaves, where children write their
// coverage, a file whose static map counts in numbers but whose map for a test counts in text. Read as coverage, that
// count adds up into text and is credited to the test, with nothing failing.
import { expect, it } from 'vitest'
import { EXITED_CLEANLY, spawnChildWritingNoCoverageMap } from './spawn-children.mjs'

it('leaves a file whose map for a test counts in text where children write their coverage', () => {
  expect(spawnChildWritingNoCoverageMap('perTest')).toStrictEqual(EXITED_CLEANLY)
})
