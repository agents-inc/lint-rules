import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIG_FILE, exportedConstant, moduleText, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { OUR_PACKAGE, OUR_RANGE } from '../../__tests__/factories/init-factories.ts'
import { buildPackageJson, packageJsonText } from '../../__tests__/factories/package-json-factories.ts'
import { entriesUnder } from '../../__tests__/git-projects.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { writeAllOrNone } from './write-all-or-none.ts'

// I-14 (spec-cli.md "I: init", step 5): init writes both files or neither. Each write goes through a
// temporary file in the same folder; if a later write fails, each file written before it is put back
// as it was, and the folder holds no temporary file.

const tempProjects = setUpTempProjects()

const PACKAGE_JSON_BEFORE = packageJsonText(buildPackageJson())
const PACKAGE_JSON_AFTER = packageJsonText(buildPackageJson({ devDependencies: { [OUR_PACKAGE]: OUR_RANGE } }))
const CONFIG_TEXT = moduleText(exportedConstant('writtenByInit'))
const AN_EXISTING_CONFIG = moduleText(exportedConstant('writtenByTheTeam'))
// A folder that does not exist, so no temporary file can be made in it.
const MISSING_FOLDER = 'missing-folder'

describe('writing the files init changes', () => {
  it('writes every file', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE } })
    writeAllOrNone([
      { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER },
      { path: join(projectDir, CONFIG_FILE), text: CONFIG_TEXT },
    ])

    expect({
      packageJson: readFileSync(join(projectDir, PACKAGE_JSON_FILE), 'utf8'),
      config: readFileSync(join(projectDir, CONFIG_FILE), 'utf8'),
    }).toStrictEqual({ packageJson: PACKAGE_JSON_AFTER, config: CONFIG_TEXT })
  })

  it('puts a file it wrote back as it was when a later write fails, leaving nothing else behind', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE } })
    const entriesBefore = entriesUnder(projectDir)
    const failingPath = join(projectDir, MISSING_FOLDER, CONFIG_FILE)

    expect(() =>
      writeAllOrNone([
        { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER },
        { path: failingPath, text: CONFIG_TEXT },
      ]),
    ).toThrowError(failingPath)
    expect({ packageJson: readFileSync(join(projectDir, PACKAGE_JSON_FILE), 'utf8'), entries: entriesUnder(projectDir) }).toStrictEqual({
      packageJson: PACKAGE_JSON_BEFORE,
      entries: entriesBefore,
    })
  })

  it('removes a file it created when a later write fails', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE } })
    const entriesBefore = entriesUnder(projectDir)

    expect(() =>
      writeAllOrNone([
        { path: join(projectDir, CONFIG_FILE), text: CONFIG_TEXT },
        { path: join(projectDir, MISSING_FOLDER, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER },
      ]),
    ).toThrowError(MISSING_FOLDER)
    expect({ configExists: existsSync(join(projectDir, CONFIG_FILE)), entries: entriesUnder(projectDir) }).toStrictEqual({
      configExists: false,
      entries: entriesBefore,
    })
  })

  // A failed write may or may not have made its temporary file (write-all-or-none.partial-writes.test.ts makes one).
  it('says it could not write the path it failed on, and why, where that write made no temporary file', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE } })
    const failingPath = join(projectDir, MISSING_FOLDER, CONFIG_FILE)

    expect(() =>
      writeAllOrNone([
        { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER },
        { path: failingPath, text: CONFIG_TEXT },
      ]),
    ).toThrowError(`could not write ${failingPath}: ENOENT`)
  })

  it('overwrites a file that existed, when every write succeeds', () => {
    const projectDir = tempProjects.create({ files: { [CONFIG_FILE]: AN_EXISTING_CONFIG } })
    writeAllOrNone([{ path: join(projectDir, CONFIG_FILE), text: CONFIG_TEXT }])

    expect(readFileSync(join(projectDir, CONFIG_FILE), 'utf8')).toBe(CONFIG_TEXT)
  })
})
