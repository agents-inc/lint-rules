import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import { INSTALLED_OXLINT, setUpEmptyFolders, setUpTempProjects } from './temp-projects.ts'

// The runner removes each test file's temp dir however the file ends (temp-projects.integration.test.ts), which hides
// whether these helpers remove what they made. Seen from inside one file, what a suite made is gone once that suite
// has finished, before the next test runs: each describe below makes what it needs in suites of its own, then looks.

const PROJECT_ROOT_PREFIX = 'lint-rules-project-'
const EMPTY_FOLDER_PREFIX = 'lint-rules-empty-'
const NODE_MODULES = 'node_modules'
const FIXTURE_FILES = { 'given-by-both.txt': 'from the fixtures', 'fixture-only.txt': 'kept' }
const GIVEN_FILES = { 'given-by-both.txt': 'from the files', 'nested/folder/file.txt': 'written with its folders' }
const OUTER_PROJECT: RunsBeforeTheSuiteOptions = { timeoutMs: 10_000, whatFailed: 'the outer suite could not make its project' }

function namesUnderTheTempDir(prefix: string): string[] {
  return readdirSync(tmpdir())
    .filter((name) => name.startsWith(prefix))
    .toSorted()
}

describe('setUpTempProjects', () => {
  describe('in a suite making two projects', () => {
    const tempProjects = setUpTempProjects()

    it('makes each below a folder of its own in the temp dir', () => {
      const made = [tempProjects.create({}), tempProjects.create({})]

      expect(namesUnderTheTempDir(PROJECT_ROOT_PREFIX)).toStrictEqual(made.map((dir) => basename(dirname(dir))).toSorted())
    })
  })

  describe('in a suite making projects from fixtures, files and packages', () => {
    const tempProjects = setUpTempProjects()

    it('copies the fixtures, then writes the files over them, each in its folder', () => {
      const fixturesDir = tempProjects.create({ files: FIXTURE_FILES })
      const project = tempProjects.create({ fixturesDir, files: GIVEN_FILES })

      expect({
        entries: readdirSync(project, { recursive: true, encoding: 'utf8' }).toSorted(),
        givenByBoth: readFileSync(join(project, 'given-by-both.txt'), 'utf8'),
        fixtureOnly: readFileSync(join(project, 'fixture-only.txt'), 'utf8'),
        nested: readFileSync(join(project, 'nested/folder/file.txt'), 'utf8'),
      }).toStrictEqual({
        entries: ['fixture-only.txt', 'given-by-both.txt', 'nested', 'nested/folder', 'nested/folder/file.txt'],
        givenByBoth: 'from the files',
        fixtureOnly: 'kept',
        nested: 'written with its folders',
      })
    })

    it("links each package in the node_modules beside the project, where Node finds it, and leaves the project's folder empty", () => {
      const project = tempProjects.create({ linkedPackages: [INSTALLED_OXLINT] })

      expect({
        linkedTo: realpathSync(join(dirname(project), NODE_MODULES, INSTALLED_OXLINT.name)),
        inTheProject: readdirSync(project),
      }).toStrictEqual({ linkedTo: realpathSync(INSTALLED_OXLINT.dir), inTheProject: [] })
    })
  })

  it('has removed every project those suites made once each has finished', () => {
    expect(namesUnderTheTempDir(PROJECT_ROOT_PREFIX)).toStrictEqual([])
  })
})

describe('setUpEmptyFolders', () => {
  describe('in a suite making two folders', () => {
    const emptyFolder = setUpEmptyFolders()

    it('makes each in the temp dir', () => {
      const made = [emptyFolder(), emptyFolder()]

      expect(namesUnderTheTempDir(EMPTY_FOLDER_PREFIX)).toStrictEqual(made.map((folder) => basename(folder)).toSorted())
    })
  })

  it('has removed every folder that suite made once it has finished', () => {
    expect(namesUnderTheTempDir(EMPTY_FOLDER_PREFIX)).toStrictEqual([])
  })
})

describe('setUpTempProjects, in a suite inside one that made a project of its own', () => {
  const outerProject = setUpRunsBeforeTheSuite((tempProjects) => tempProjects.create({}), OUTER_PROJECT)

  describe('the inner suite', () => {
    const innerProjects = setUpTempProjects()

    it('makes a project of its own', () => {
      expect(existsSync(innerProjects.create({}))).toBe(true)
    })
  })

  it("leaves the outer suite's project once the inner suite has removed its own", () => {
    expect(existsSync(outerProject())).toBe(true)
  })
})
