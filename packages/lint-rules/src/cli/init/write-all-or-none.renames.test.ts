import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_FILE, exportedConstant, moduleText, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { OUR_PACKAGE, OUR_RANGE } from '../../__tests__/factories/init-factories.ts'
import { buildPackageJson, packageJsonText } from '../../__tests__/factories/package-json-factories.ts'
import { entriesUnder } from '../../__tests__/git-projects.ts'
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

const PACKAGE_JSON_BEFORE = packageJsonText(buildPackageJson())
const PACKAGE_JSON_AFTER = packageJsonText(buildPackageJson({ devDependencies: { [OUR_PACKAGE]: OUR_RANGE } }))
const CONFIG_TEXT = moduleText(exportedConstant('writtenByInit'))

afterEach(() => {
  renames.target = null
})

describe('replacing the files init changes, each by its temporary file', () => {
  it('replaces every file where every rename succeeds', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE } })
    writeAllOrNone([
      { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER },
      { path: join(projectDir, CONFIG_FILE), text: CONFIG_TEXT },
    ])

    expect({ entries: entriesUnder(projectDir), packageJson: readFileSync(join(projectDir, PACKAGE_JSON_FILE), 'utf8') }).toStrictEqual({
      entries: [CONFIG_FILE, PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_AFTER,
    })
  })

  it('puts back the file it replaced first, as it was, where the second rename fails, and leaves no temporary file', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE } })
    renames.target = join(projectDir, CONFIG_FILE)

    expect(() =>
      writeAllOrNone([
        { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER },
        { path: join(projectDir, CONFIG_FILE), text: CONFIG_TEXT },
      ]),
    ).toThrowError(`could not write ${join(projectDir, CONFIG_FILE)}: EACCES`)
    expect({ entries: entriesUnder(projectDir), packageJson: readFileSync(join(projectDir, PACKAGE_JSON_FILE), 'utf8') }).toStrictEqual({
      entries: [PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_BEFORE,
    })
  })

  it('removes the file it created first where the second rename fails', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE } })
    renames.target = join(projectDir, PACKAGE_JSON_FILE)

    expect(() =>
      writeAllOrNone([
        { path: join(projectDir, CONFIG_FILE), text: CONFIG_TEXT },
        { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER },
      ]),
    ).toThrowError(`could not write ${join(projectDir, PACKAGE_JSON_FILE)}: EACCES`)
    expect({ entries: entriesUnder(projectDir), packageJson: readFileSync(join(projectDir, PACKAGE_JSON_FILE), 'utf8') }).toStrictEqual({
      entries: [PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_BEFORE,
    })
  })
})
