import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildInstalledPackageExportingItsEntryAlone, buildPackageJsonFile, PACKAGE_JSON_FILE_PATH } from '../__tests__/factories/package-json-factories.ts'
import { setUpTempProjects } from '../__tests__/temp-projects.ts'
import { readPackageJsonFile, resolvedFrom, versionOf } from './package-json-files.ts'

const PACKAGE = 'installed'
const NOT_INSTALLED = 'not-installed'
const PATH_NOT_EXPORTED = `${PACKAGE}/package.json`
const ENTRY = `node_modules/${PACKAGE}/index.js`
const VERSION = '1.2.3'
const NOT_JSON = '{\n'

const tempProjects = setUpTempProjects()

describe('resolvedFrom', () => {
  const projectDir = tempProjects.create({ files: buildInstalledPackageExportingItsEntryAlone(PACKAGE) })

  it('gives the file a request resolves to', () => {
    expect(resolvedFrom(projectDir, PACKAGE)).toBe(realpathSync(join(projectDir, ENTRY)))
  })

  it('gives null where no module resolves', () => {
    expect(resolvedFrom(projectDir, NOT_INSTALLED)).toBeNull()
  })

  it('throws where the package does not export the path asked for', () => {
    expect(() => resolvedFrom(projectDir, PATH_NOT_EXPORTED)).toThrowError(expect.objectContaining({ code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }))
  })
})

// An error that follows a type check is a TypeError, its message unchanged.
describe('versionOf', () => {
  it('gives the version the file gives', () => {
    expect(versionOf(buildPackageJsonFile({ version: VERSION }))).toBe(VERSION)
  })

  it.each([
    { version: 'none', given: undefined },
    { version: 'one that is no string', given: 1 },
  ])('throws a TypeError naming the file where it gives $version', ({ given }) => {
    expect(() => versionOf(buildPackageJsonFile({ version: given }))).toThrowError(new TypeError(`${PACKAGE_JSON_FILE_PATH}: gives no version`))
  })
})

describe('readPackageJsonFile', () => {
  // No type check comes before this error, so it stays an Error.
  it('throws an Error naming the file where it is not valid JSON', () => {
    const projectDir = tempProjects.create({ files: { 'package.json': NOT_JSON } })
    const path = join(projectDir, 'package.json')

    expect(() => readPackageJsonFile(path)).toThrowError(expect.objectContaining({ name: 'Error', message: `${path}: not valid JSON` }))
  })
})
