import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildInstalledPackageExportingItsEntryAlone } from '../__tests__/factories/package-json-factories.ts'
import { setUpTempProjects } from '../__tests__/temp-projects.ts'
import { resolvedFrom } from './package-json-files.ts'

// resolvedFrom resolves a request as a module in the folder given requires it: null where no module
// resolves, and any other failure to resolve thrown as it is, as a package refusing the path asked for.

const PACKAGE = 'installed'
const NOT_INSTALLED = 'not-installed'
const PATH_NOT_EXPORTED = `${PACKAGE}/package.json`
const ENTRY = `node_modules/${PACKAGE}/index.js`

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
