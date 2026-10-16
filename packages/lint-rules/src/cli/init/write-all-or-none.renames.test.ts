import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_FILE, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { filesStateOf, initWritesIn, PACKAGE_JSON_AFTER_INIT, PACKAGE_JSON_BEFORE_INIT } from '../../__tests__/factories/init-factories.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { writeAllOrNone } from './write-all-or-none.ts'

// I-14, the second phase (spec-cli.md "I: init", step 5): once every temporary file is written, each
// replaces its file by a rename, and a rename that fails puts back each file replaced before it. A
// rename in the folder the temporary file was just written to fails for no file a test can make, so
// here node:fs's renameSync fails for the one path a test names, and renames every other path.

const renames = vi.hoisted(() => {
  const failing: { target: string | null } = { target: null }
  return failing
})

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return {
    ...fs,
    renameSync: (from: string, to: string): void => {
      if (to === renames.target) throw new Error(`EACCES: permission denied, rename '${from}' -> '${to}'`)
      fs.renameSync(from, to)
    },
  }
})

const tempProjects = setUpTempProjects()

afterEach(() => {
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
    renames.target = join(projectDir, CONFIG_FILE)

    expect(() =>
      writeAllOrNone(initWritesIn(projectDir, 'package.json first')),
    ).toThrowError(`could not write ${join(projectDir, CONFIG_FILE)}: EACCES`)
    expect(filesStateOf(projectDir)).toStrictEqual({
      entries: [PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_BEFORE_INIT,
    })
  })

  it('removes the file it created first where the second rename fails', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT } })
    renames.target = join(projectDir, PACKAGE_JSON_FILE)

    expect(() =>
      writeAllOrNone(initWritesIn(projectDir, 'config first')),
    ).toThrowError(`could not write ${join(projectDir, PACKAGE_JSON_FILE)}: EACCES`)
    expect(filesStateOf(projectDir)).toStrictEqual({
      entries: [PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_BEFORE_INIT,
    })
  })
})
