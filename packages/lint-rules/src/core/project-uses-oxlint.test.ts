import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildPackageJson,
  buildPackageJsonListingOthers,
  buildPackageJsonListingOxlint,
  packageJsonText,
} from '../__tests__/factories/package-json-factories.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from '../__tests__/temp-projects.ts'
import { doesProjectUseOxlint } from './project-uses-oxlint.ts'

// Only the nearest package.json is read, skipping directories without one; node_modules never is, since
// our package brings its own oxlint for `check`.

const NESTED_PACKAGE = 'packages/app'
const DIR_WITHOUT_A_PACKAGE_JSON = 'packages/app/config'
const MALFORMED_PACKAGE_JSON = '{ "name": "consumer-project", '

const tempProjects = setUpTempProjects()

describe('projectUsesOxlint', () => {
  it('answers yes when the package.json in tsconfigRootDir lists oxlint under devDependencies', () => {
    const projectDir = tempProjects.create({
      files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint('devDependencies')) },
    })

    expect(doesProjectUseOxlint(projectDir)).toBe(true)
  })

  it('answers yes when it lists oxlint under dependencies', () => {
    const projectDir = tempProjects.create({
      files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint('dependencies')) },
    })

    expect(doesProjectUseOxlint(projectDir)).toBe(true)
  })

  // A monorepo package whose own package.json lists no oxlint uses ESLint only.
  it('answers no when only a parent package.json lists it, above the nearest one listing other packages', () => {
    const projectDir = tempProjects.create({
      files: {
        'package.json': packageJsonText(buildPackageJsonListingOxlint()),
        [`${NESTED_PACKAGE}/package.json`]: packageJsonText(buildPackageJsonListingOthers()),
      },
    })

    expect(doesProjectUseOxlint(join(projectDir, NESTED_PACKAGE))).toBe(false)
  })

  it('answers no when the nearest package.json lies above tsconfigRootDir and lists no oxlint, though one above it does', () => {
    const projectDir = tempProjects.create({
      files: {
        'package.json': packageJsonText(buildPackageJsonListingOxlint()),
        [`${NESTED_PACKAGE}/package.json`]: packageJsonText(buildPackageJsonListingOthers()),
        [`${DIR_WITHOUT_A_PACKAGE_JSON}/tsconfig.json`]: '{}\n',
      },
    })

    expect(doesProjectUseOxlint(join(projectDir, DIR_WITHOUT_A_PACKAGE_JSON))).toBe(false)
  })

  it('answers yes when the nearest package.json lists it, above a parent listing other packages', () => {
    const projectDir = tempProjects.create({
      files: {
        'package.json': packageJsonText(buildPackageJsonListingOthers()),
        [`${NESTED_PACKAGE}/package.json`]: packageJsonText(buildPackageJsonListingOxlint()),
      },
    })

    expect(doesProjectUseOxlint(join(projectDir, NESTED_PACKAGE))).toBe(true)
  })

  it('passes over a directory with no package.json on the way up', () => {
    const projectDir = tempProjects.create({
      files: {
        'package.json': packageJsonText(buildPackageJsonListingOxlint()),
        [`${DIR_WITHOUT_A_PACKAGE_JSON}/tsconfig.json`]: '{}\n',
      },
    })

    expect(doesProjectUseOxlint(join(projectDir, DIR_WITHOUT_A_PACKAGE_JSON))).toBe(true)
  })

  it('answers no when no package.json lists it, though oxlint resolves through node_modules', () => {
    const projectDir = tempProjects.create({
      files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) },
      linkedPackages: [INSTALLED_OXLINT],
    })

    expect(doesProjectUseOxlint(projectDir)).toBe(false)
  })

  it('answers no when there is no package.json from tsconfigRootDir up', () => {
    const projectDir = tempProjects.create({ files: { 'tsconfig.json': '{}\n' } })

    expect(doesProjectUseOxlint(projectDir)).toBe(false)
  })

  it('answers no when the package.json lists no dependency at all', () => {
    const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()) } })

    expect(doesProjectUseOxlint(projectDir)).toBe(false)
  })

  it('throws on a malformed package.json in tsconfigRootDir, naming that file', () => {
    const projectDir = tempProjects.create({ files: { 'package.json': MALFORMED_PACKAGE_JSON } })

    expect(() => doesProjectUseOxlint(projectDir)).toThrow(join(projectDir, 'package.json'))
  })

  // Nothing above the nearest package.json is read, so a malformed one there goes unseen.
  it('answers no, without reading it, when a malformed package.json lies above the nearest one', () => {
    const projectDir = tempProjects.create({
      files: {
        'package.json': MALFORMED_PACKAGE_JSON,
        [`${NESTED_PACKAGE}/package.json`]: packageJsonText(buildPackageJsonListingOthers()),
      },
    })

    expect(doesProjectUseOxlint(join(projectDir, NESTED_PACKAGE))).toBe(false)
  })

  it('throws on a malformed nearest package.json that lies above tsconfigRootDir, naming that file', () => {
    const projectDir = tempProjects.create({
      files: {
        [`${NESTED_PACKAGE}/package.json`]: MALFORMED_PACKAGE_JSON,
        [`${DIR_WITHOUT_A_PACKAGE_JSON}/tsconfig.json`]: '{}\n',
      },
    })

    expect(() => doesProjectUseOxlint(join(projectDir, DIR_WITHOUT_A_PACKAGE_JSON))).toThrow(
      join(projectDir, NESTED_PACKAGE, 'package.json'),
    )
  })
})
