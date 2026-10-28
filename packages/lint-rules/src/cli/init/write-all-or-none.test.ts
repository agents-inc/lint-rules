import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIG_FILE, exportedConstant, moduleText, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { CONFIG_INIT_WRITES, filesStateOf, initWritesIn, PACKAGE_JSON_AFTER_INIT, PACKAGE_JSON_BEFORE_INIT } from '../../__tests__/factories/init-factories.ts'
import { entriesUnder, setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { writeAllOrNone } from './write-all-or-none.ts'

const tempProjects = setUpTempProjects()

const AN_EXISTING_CONFIG = moduleText(exportedConstant('writtenByTheTeam'))
const MISSING_FOLDER = 'missing-folder'

describe('writing the files init changes', () => {
  it('writes every file', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT } })
    writeAllOrNone(initWritesIn(projectDir, 'package.json first'))

    expect({
      packageJson: readFileSync(join(projectDir, PACKAGE_JSON_FILE), 'utf8'),
      config: readFileSync(join(projectDir, CONFIG_FILE), 'utf8'),
    }).toStrictEqual({ packageJson: PACKAGE_JSON_AFTER_INIT, config: CONFIG_INIT_WRITES })
  })

  it('puts a file it wrote back as it was when a later write fails, leaving nothing else behind', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT } })
    const entriesBefore = entriesUnder(projectDir)
    const failingPath = join(projectDir, MISSING_FOLDER, CONFIG_FILE)

    expect(() =>
      writeAllOrNone([
        { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER_INIT },
        { path: failingPath, text: CONFIG_INIT_WRITES },
      ]),
    ).toThrow(failingPath)
    expect(filesStateOf(projectDir)).toStrictEqual({
      packageJson: PACKAGE_JSON_BEFORE_INIT,
      entries: entriesBefore,
    })
  })

  it('removes a file it created when a later write fails', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT } })
    const entriesBefore = entriesUnder(projectDir)

    expect(() =>
      writeAllOrNone([
        { path: join(projectDir, CONFIG_FILE), text: CONFIG_INIT_WRITES },
        { path: join(projectDir, MISSING_FOLDER, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER_INIT },
      ]),
    ).toThrow(MISSING_FOLDER)
    expect({ configExists: existsSync(join(projectDir, CONFIG_FILE)), entries: entriesUnder(projectDir) }).toStrictEqual({
      configExists: false,
      entries: entriesBefore,
    })
  })

  // write-all-or-none.partial-writes.test.ts covers a write that made its temporary file.
  it('says it could not write the path it failed on, and why, where that write made no temporary file', () => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT } })
    const failingPath = join(projectDir, MISSING_FOLDER, CONFIG_FILE)

    expect(() =>
      writeAllOrNone([
        { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER_INIT },
        { path: failingPath, text: CONFIG_INIT_WRITES },
      ]),
    ).toThrow(`could not write ${failingPath}: ENOENT`)
  })

  it('overwrites a file that existed, when every write succeeds', () => {
    const projectDir = tempProjects.create({ files: { [CONFIG_FILE]: AN_EXISTING_CONFIG } })
    writeAllOrNone([{ path: join(projectDir, CONFIG_FILE), text: CONFIG_INIT_WRITES }])

    expect(readFileSync(join(projectDir, CONFIG_FILE), 'utf8')).toBe(CONFIG_INIT_WRITES)
  })
})
