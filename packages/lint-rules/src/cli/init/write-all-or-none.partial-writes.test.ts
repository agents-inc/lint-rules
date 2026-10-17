import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_FILE, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { filesStateOf, type InitWriteOrder, initWritesIn, PACKAGE_JSON_BEFORE_INIT } from '../../__tests__/factories/init-factories.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { writeAllOrNone } from './write-all-or-none.ts'

// writeFileSync writes half the text to the named path's temporary file, then fails as a full disk does.

const partialWrites = vi.hoisted(() => {
  const failing: { target: string | null } = { target: null }
  return failing
})

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return {
    ...fs,
    writeFileSync: (path: string, text: string): void => {
      if (partialWrites.target === null || !path.startsWith(`${partialWrites.target}.`)) {
        fs.writeFileSync(path, text)
        return
      }
      fs.writeFileSync(path, text.slice(0, text.length / 2))
      throw Object.assign(new Error(`ENOSPC: no space left on device, write '${path}'`), { code: 'ENOSPC' })
    },
  }
})

const tempProjects = setUpTempProjects()

afterEach(() => {
  partialWrites.target = null
})

describe('writing the temporary files of the files init changes', () => {
  it.each<{ readonly failing: string; readonly order: InitWriteOrder }>([
    { failing: 'the first', order: 'config first' },
    { failing: 'the second', order: 'package.json first' },
  ])('leaves every file as it was, and no temporary file, where $failing write fails part way', ({ order }) => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT } })
    partialWrites.target = join(projectDir, CONFIG_FILE)

    expect(() => writeAllOrNone(initWritesIn(projectDir, order))).toThrowError(`could not write ${join(projectDir, CONFIG_FILE)}: ENOSPC`)
    expect(filesStateOf(projectDir)).toStrictEqual({
      entries: [PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_BEFORE_INIT,
    })
  })
})
