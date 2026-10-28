// A test file of the runs bridge-runs.ts makes whose test spawns a child that leaves, where children write their
// coverage, a file holding null: no maps to read a hit count from.
import { expect, it } from 'vitest'
import { EXITED_CLEANLY, spawnChildWritingNoCoverageMap } from './spawn-children.mjs'

it('leaves a file holding null where children write their coverage', () => {
  expect(spawnChildWritingNoCoverageMap('nullInPlaceOfTheMaps')).toStrictEqual(EXITED_CLEANLY)
})
