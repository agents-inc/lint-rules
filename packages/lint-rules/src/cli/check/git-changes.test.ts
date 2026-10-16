import type { SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportedConstant, moduleText } from '../../__tests__/factories/check-factories.ts'
import { createGitProject } from '../../__tests__/git-projects.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { changedFilesIn, gitRepoAt, gitTopLevelOf, gitTopLevelUnlessGitIsMissing } from './git-changes.ts'

// spec-cli.md "K: check", step 6: check reads the changed files from git, a moved file paired with
// its old path. K-16: a git failure stops check, quoting git's first line; where git prints nothing,
// as when it is killed, check names the command and how it exited; where git cannot be started, as
// where none is installed, check quotes why. Here node:child_process's spawnSync answers the one git
// subcommand a test names as such a git does, and runs every other command.

const silentGit = vi.hoisted(() => {
  const failing: { subcommand: string | null } = { subcommand: null }
  return failing
})

const unstartableGit = vi.hoisted(() => {
  const failing: { subcommand: string | null } = { subcommand: null }
  return failing
})

vi.mock('node:child_process', async (importOriginal) => {
  const childProcess = await importOriginal<typeof import('node:child_process')>()
  // What git's exit with code 128, having printed nothing, gives spawnSync.
  const silentFailure: SpawnSyncReturns<string> = { pid: 0, output: [], stdout: '', stderr: '', status: 128, signal: null }
  // A PATH holding no folder: spawnSync finds no git to start, as where none is installed.
  const pathWithoutGit = ''
  return {
    ...childProcess,
    spawnSync: (command: string, args: readonly string[], options: SpawnSyncOptions) => {
      if (args[0] === unstartableGit.subcommand) return childProcess.spawnSync(command, args, { ...options, env: { ...options.env, PATH: pathWithoutGit } })
      return args[0] === silentGit.subcommand ? silentFailure : childProcess.spawnSync(command, args, options)
    },
  }
})

const tempProjects = setUpTempProjects()

const ADDED = 'src/added.ts'
const MOVED_FROM = 'src/old.ts'
const MOVED_TO = 'src/new.ts'

// What spawnSync's error says where it finds no git to start (measured, Node 22).
const GIT_NOT_STARTED = 'git failed: spawnSync git ENOENT'

afterEach(() => {
  silentGit.subcommand = null
  unstartableGit.subcommand = null
})

describe('the top level of the repository holding a folder', () => {
  it('is the folder git names, where git runs', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: {}, linkedPackages: [] })

    expect(gitTopLevelOf(project.dir)).toBe(project.dir)
  })

  it('is refused for check where git cannot be started, quoting why', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: {}, linkedPackages: [] })
    unstartableGit.subcommand = 'rev-parse'

    expect(() => gitTopLevelOf(project.dir)).toThrowError(new Error(GIT_NOT_STARTED))
  })

  it('is null for init where git cannot be started', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: {}, linkedPackages: [] })
    unstartableGit.subcommand = 'rev-parse'

    expect(gitTopLevelUnlessGitIsMissing(project.dir)).toBeNull()
  })
})

describe('the files git counts as changed', () => {
  it('are those git diff lists, where it runs', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: {}, linkedPackages: [] })
    project.write(ADDED, moduleText(exportedConstant('added')))

    expect(changedFilesIn(gitRepoAt(project.dir))).toStrictEqual([{ path: ADDED, oldPath: null, isNew: true }])
  })

  it('pair a file git mv moved with the path it had', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { [MOVED_FROM]: moduleText(exportedConstant('moved')) }, linkedPackages: [] })
    project.git('mv', MOVED_FROM, MOVED_TO)

    expect(changedFilesIn(gitRepoAt(project.dir))).toStrictEqual([{ path: MOVED_TO, oldPath: MOVED_FROM, isNew: false }])
  })

  it('are refused where git diff fails printing nothing, naming the command and its exit code', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: {}, linkedPackages: [] })
    project.write(ADDED, moduleText(exportedConstant('added')))
    const repo = gitRepoAt(project.dir)
    silentGit.subcommand = 'diff'

    expect(() => changedFilesIn(repo)).toThrowError(new Error('git failed: git diff --name-status -z --no-ext-diff --find-renames=1% --diff-filter=ACMR HEAD exited 128'))
  })

  it('are refused where git cannot be started, quoting why', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: {}, linkedPackages: [] })
    project.write(ADDED, moduleText(exportedConstant('added')))
    const repo = gitRepoAt(project.dir)
    unstartableGit.subcommand = 'diff'

    expect(() => changedFilesIn(repo)).toThrowError(new Error(GIT_NOT_STARTED))
  })
})
