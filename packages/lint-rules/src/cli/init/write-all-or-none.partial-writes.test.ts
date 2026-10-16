import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_FILE, exportedConstant, moduleText, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { OUR_PACKAGE, OUR_RANGE } from '../../__tests__/factories/init-factories.ts'
import { buildPackageJson, packageJsonText } from '../../__tests__/factories/package-json-factories.ts'
import { entriesUnder } from '../../__tests__/git-projects.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { type FileWrite, writeAllOrNone } from './write-all-or-none.ts'

// I-14, the first phase (spec-cli.md "I: init", step 5): each text goes to a temporary file first. A
// disk that fills up fails a write part way, after the temporary file was made: here node:fs's
// writeFileSync writes the first half of the text to the temporary file of the one path a test
// names, then fails as a full disk does, and writes every other path whole.

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

const PACKAGE_JSON_BEFORE = packageJsonText(buildPackageJson())
const PACKAGE_JSON_AFTER = packageJsonText(buildPackageJson({ devDependencies: { [OUR_PACKAGE]: OUR_RANGE } }))
const CONFIG_TEXT = moduleText(exportedConstant('writtenByInit'))

afterEach(() => {
  partialWrites.target = null
})

function packageJsonWrite(projectDir: string): FileWrite {
  return { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER }
}

function configWrite(projectDir: string): FileWrite {
  return { path: join(projectDir, CONFIG_FILE), text: CONFIG_TEXT }
}

describe('writing the temporary files of the files init changes', () => {
  it.each([
    { failing: 'the first', writesIn: (projectDir: string) => [configWrite(projectDir), packageJsonWrite(projectDir)] },
    { failing: 'the second', writesIn: (projectDir: string) => [packageJsonWrite(projectDir), configWrite(projectDir)] },
  ])('leaves every file as it was, and no temporary file, where $failing write fails part way', ({ writesIn }) => {
    const projectDir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE } })
    partialWrites.target = join(projectDir, CONFIG_FILE)

    expect(() => writeAllOrNone(writesIn(projectDir))).toThrowError(`could not write ${join(projectDir, CONFIG_FILE)}: ENOSPC`)
    expect({ entries: entriesUnder(projectDir), packageJson: readFileSync(join(projectDir, PACKAGE_JSON_FILE), 'utf8') }).toStrictEqual({
      entries: [PACKAGE_JSON_FILE],
      packageJson: PACKAGE_JSON_BEFORE,
    })
  })
})
