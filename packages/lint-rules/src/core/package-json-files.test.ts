import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildInstalledPackageExportingItsEntryAlone, buildPackageJsonFile, PACKAGE_JSON_FILE_PATH } from '../__tests__/factories/package-json-factories.ts'
import { setUpTempProjects } from '../__tests__/temp-projects.ts'
import { rangeListedIn, readPackageJsonFile, resolvedFrom, versionOf } from './package-json-files.ts'

const PACKAGE = 'installed'
const NOT_INSTALLED = 'not-installed'
const PATH_NOT_EXPORTED = `${PACKAGE}/package.json`
const ENTRY = `node_modules/${PACKAGE}/index.js`
const LISTED_PACKAGE = 'oxlint'
const LISTED_RANGE = '^1.86.0'
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
describe('rangeListedIn', () => {
  it('gives the range the field lists for the package', () => {
    expect(rangeListedIn(buildPackageJsonFile(), { [LISTED_PACKAGE]: LISTED_RANGE }, LISTED_PACKAGE)).toBe(LISTED_RANGE)
  })

  it.each([
    { field: 'lists no range for it', given: {} },
    { field: 'lists a range that is no string', given: { [LISTED_PACKAGE]: 1 } },
    { field: 'is no object', given: undefined },
  ])('throws a TypeError naming the file where the field $field', ({ given }) => {
    expect(() => rangeListedIn(buildPackageJsonFile(), given, LISTED_PACKAGE)).toThrowError(
      new TypeError(`${PACKAGE_JSON_FILE_PATH}: lists no version range for ${LISTED_PACKAGE}`),
    )
  })
})

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
