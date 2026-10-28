// A test file of the runs bridge-runs.ts makes whose test spawns a child that leaves, where children write their
// coverage, a file whose static map counts in numbers but whose per-test maps are a number. Read as coverage, the number
// holds no test's map, and the static map is credited to the test, with nothing failing.
import { expect, it } from 'vitest'
import { EXITED_CLEANLY, spawnChildWritingNoCoverageMap } from './spawn-children.mjs'

it('leaves a file whose per-test maps are a number where children write their coverage', () => {
  expect(spawnChildWritingNoCoverageMap('perTestMapsANumber')).toStrictEqual(EXITED_CLEANLY)
})
