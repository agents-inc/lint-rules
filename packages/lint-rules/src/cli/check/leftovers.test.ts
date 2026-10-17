import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { entriesUnder, setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { removeLeftover } from './leftovers.ts'

// Two checks in one folder sweep the same ended run's config, so one may find it already gone.

const tempProjects = setUpTempProjects()

const A_TEMP_CONFIG = '.agents-inc-check-1-left.json'
const A_SCRATCH_FOLDER = 'agents-inc-check-git-left'
const REMOVED_BY_ANOTHER_RUN = '.agents-inc-check-2-gone.json'

describe('removing a leftover', () => {
  it('removes a file and a folder with what it holds, and passes over one another run removed first', () => {
    const dir = tempProjects.create({ files: { [A_TEMP_CONFIG]: '{}', [join(A_SCRATCH_FOLDER, 'index')]: '' } })
    for (const name of [A_TEMP_CONFIG, A_SCRATCH_FOLDER, REMOVED_BY_ANOTHER_RUN]) removeLeftover(join(dir, name))

    expect(entriesUnder(dir)).toStrictEqual([])
  })
})
