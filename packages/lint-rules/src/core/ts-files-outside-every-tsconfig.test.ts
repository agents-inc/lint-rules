import { chmodSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, onTestFinished } from 'vitest'
import { IMPORTED_ONLY_LAYOUT, TSCONFIG_LAYOUTS } from '../__tests__/cases/tsconfig-layouts.ts'
import { configFileText, standaloneSources } from '../__tests__/factories/tsconfig-layout-factories.ts'
import { PARALLEL_LOAD_TIMEOUT_MS } from '../__tests__/parallel-load.ts'
import { tsFilesTheProjectServiceFindsNoProjectFor } from '../__tests__/project-service-verdicts.ts'
import { setUpTempProjects } from '../__tests__/temp-projects.ts'
import { tsFilesOutsideEveryTsconfig } from './ts-files-outside-every-tsconfig.ts'

// Spec C3: a typed rule on a TS file the project service finds no project for is a fatal parse
// error that switches off every rule in the file, so our typed blocks leave such files out. The
// computation copies the project service's own search, and each case compares it, file for file,
// with what the real service decides (typescript-eslint's, with the TypeScript it resolves).

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const LOCKED_DIRECTORY = 'locked'
const NO_PERMISSIONS = 0o000
const OWNER_ONLY_PERMISSIONS = 0o700

const tempProjects = setUpTempProjects()

describe('tsFilesOutsideEveryTsconfig, beside the real project service', () => {
  it.each(TSCONFIG_LAYOUTS)(
    'lists exactly the TS files the project service finds no project for: $shape',
    { timeout: PARALLEL_LOAD_TIMEOUT_MS },
    ({ files, tsconfigRootDir, outside }) => {
      const root = join(tempProjects.create({ files }), tsconfigRootDir)

      expect({
        computed: tsFilesOutsideEveryTsconfig(root).toSorted(),
        projectService: tsFilesTheProjectServiceFindsNoProjectFor(root),
      }).toStrictEqual({ computed: outside, projectService: outside })
    },
  )

  it(
    "lists a TS file no tsconfig lists though the project service finds it through an importer's program (D-h)",
    { timeout: PARALLEL_LOAD_TIMEOUT_MS },
    () => {
      const { files, tsconfigRootDir, importedOnly, outsideForBoth } = IMPORTED_ONLY_LAYOUT
      const root = join(tempProjects.create({ files }), tsconfigRootDir)

      expect({
        computed: tsFilesOutsideEveryTsconfig(root).toSorted(),
        projectService: tsFilesTheProjectServiceFindsNoProjectFor(root),
      }).toStrictEqual({ computed: [importedOnly, ...outsideForBoth].toSorted(), projectService: [...outsideForBoth] })
    },
  )

  it('matches the project service on this repo, file for file', { timeout: PARALLEL_LOAD_TIMEOUT_MS }, () => {
    expect(tsFilesOutsideEveryTsconfig(REPO_ROOT).toSorted()).toStrictEqual(tsFilesTheProjectServiceFindsNoProjectFor(REPO_ROOT))
  })
})

// R2's own walk threw EACCES on a real project; a directory it cannot read is passed over.
describe('tsFilesOutsideEveryTsconfig, given a directory it cannot read', () => {
  it('passes over it and still lists the TS files outside every tsconfig elsewhere', () => {
    const root = tempProjects.create({
      files: {
        'tsconfig.json': configFileText({ include: ['src'] }),
        ...standaloneSources(['src/a.ts', 'scripts/b.ts', `${LOCKED_DIRECTORY}/c.ts`]),
      },
    })
    chmodSync(join(root, LOCKED_DIRECTORY), NO_PERMISSIONS)
    onTestFinished(() => {
      chmodSync(join(root, LOCKED_DIRECTORY), OWNER_ONLY_PERMISSIONS)
    })

    expect(tsFilesOutsideEveryTsconfig(root).toSorted()).toStrictEqual(['scripts/b.ts'])
  })
})
