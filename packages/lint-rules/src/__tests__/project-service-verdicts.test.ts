import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { configFileText, standaloneSources } from './factories/tsconfig-layout-factories.ts'
import { PARALLEL_LOAD_TIMEOUT_MS } from './parallel-load.ts'
import { tsFilesTheProjectServiceFindsNoProjectFor, tsFilesUnder } from './project-service-verdicts.ts'
import { setUpTempProjects } from './temp-projects.ts'

const NESTED_PACKAGE = 'packages/app'

const tempProjects = setUpTempProjects()

describe('tsFilesUnder', () => {
  it('lists every TS file by its path from the directory, sorted, and nothing under node_modules or .git or of another kind', () => {
    const root = tempProjects.create({
      files: {
        ...standaloneSources(['z.ts', 'src/a.tsx', 'src/b.mts', 'src/c.cts', 'src/d.d.ts', 'node_modules/pkg/e.ts', '.git/f.ts']),
        'src/g.js': 'export const value = 1\n',
        'tsconfig.json': configFileText(),
      },
    })

    expect(tsFilesUnder(root)).toStrictEqual(['src/a.tsx', 'src/b.mts', 'src/c.cts', 'src/d.d.ts', 'z.ts'])
  })
})

describe('tsFilesTheProjectServiceFindsNoProjectFor', () => {
  it('lists a TS file the tsconfig leaves out, and not one it includes', { timeout: PARALLEL_LOAD_TIMEOUT_MS }, () => {
    const root = tempProjects.create({
      files: { 'tsconfig.json': configFileText({ include: ['src'] }), ...standaloneSources(['src/a.ts', 'scripts/b.ts']) },
    })

    expect(tsFilesTheProjectServiceFindsNoProjectFor(root)).toStrictEqual(['scripts/b.ts'])
  })

  // In one process, a file the service opened from the nested root keeps that verdict when asked
  // again from the project root (measured), so each root gets a process of its own.
  it('decides each root afresh, whichever root asked about the same file first', { timeout: PARALLEL_LOAD_TIMEOUT_MS }, () => {
    const projectDir = tempProjects.create({
      files: { 'tsconfig.json': configFileText(), ...standaloneSources([`${NESTED_PACKAGE}/x.ts`]) },
    })

    expect({
      fromTheNestedPackage: tsFilesTheProjectServiceFindsNoProjectFor(join(projectDir, NESTED_PACKAGE)),
      fromTheProjectRoot: tsFilesTheProjectServiceFindsNoProjectFor(projectDir),
    }).toStrictEqual({ fromTheNestedPackage: ['x.ts'], fromTheProjectRoot: [] })
  })
})
