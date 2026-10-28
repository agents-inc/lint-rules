import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_FILE, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { filesStateOf, initWritesIn, PACKAGE_JSON_AFTER_INIT, PACKAGE_JSON_BEFORE_INIT } from '../../__tests__/factories/init-factories.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { writeAllOrNone } from './write-all-or-none.ts'

// No file a test can make fails a rename in the folder just written to, so renameSync fails for the
// one path a test names.

const renames = vi.hoisted(() => {
  const failing: { target: string | null } = { target: null }
  return failing
})

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return {
    ...fs,
    renameSync(from: string, to: string): void {
      if (to === renames.target) throw new Error(`EACCES: permission denied, rename '${from}' -> '${to}'`)
      fs.renameSync(from, to)
    },
  }
})

const tempProjects = setUpTempProjects()

afterEach(() => {
  // eslint-disable-next-line functional/immutable-data -- the mocked renameSync reads which path to fail from here: vi.mock's factory runs before any test and takes nothing a test passes
  renames.target = null
})

describe('replacing the files init changes, each by its temporary file', () => {
  it('replaces every file where every rename succeeds', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT } })
    writeAllOrNone(initWritesIn(projectDir, 'package.json first'))

    expect(filesStateOf(projectDir)).toStrictEqual({
      entries: [CONFIG_FILE, PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_AFTER_INIT,
    })
  })

  it('puts back the file it replaced first, as it was, where the second rename fails, and leaves no temporary file', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT } })
    // eslint-disable-next-line functional/immutable-data -- as in afterEach
    renames.target = join(projectDir, CONFIG_FILE)

    expect(() =>
      writeAllOrNone(initWritesIn(projectDir, 'package.json first')),
    ).toThrow(`could not write ${join(projectDir, CONFIG_FILE)}: EACCES`)
    expect(filesStateOf(projectDir)).toStrictEqual({
      entries: [PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_BEFORE_INIT,
    })
  })

  it('removes the file it created first where the second rename fails', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT } })
    // eslint-disable-next-line functional/immutable-data -- as in afterEach
    renames.target = join(projectDir, PACKAGE_JSON_FILE)

    expect(() =>
      writeAllOrNone(initWritesIn(projectDir, 'config first')),
    ).toThrow(`could not write ${join(projectDir, PACKAGE_JSON_FILE)}: EACCES`)
    expect(filesStateOf(projectDir)).toStrictEqual({
      entries: [PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_BEFORE_INIT,
    })
  })
})
