import type { SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process'
import { utimesSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportedConstant, GITIGNORE_FILE, gitignoreText, moduleText } from '../../__tests__/factories/check-factories.ts'
import { createGitProject } from '../../__tests__/git-projects.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { type ChangedLines, partlyChanged, WHOLE_FILE_CHANGED } from './changed-lines.ts'
import { changedFilesIn, changedLinesOf, gitRepoAt, gitTopLevelOf, whereInitRuns } from './git-changes.ts'

// spawnSync answers the one git subcommand a test names as such a git would, and runs every other.

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
  // git exiting 128 having printed nothing.
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
const EDITED = 'src/edited.ts'
const LEFT_AS_COMMITTED = 'src/kept.ts'
const COMMIT_MESSAGE = 'the files, each written in one second'
const GIT_INDEX = '.git/index'
// A whole second, so the times git records and compares are the same at any precision.
const ONE_SECOND = new Date('2020-01-01T00:00:00Z')
const A_DAY_LATER = new Date('2020-01-02T00:00:00Z')
// The line below a one-line committed module.
const THE_LINE_ADDED = 2
const GENERATED_FOLDER = 'src/generated/'
const TRACKED_THEN_IGNORED = `${GENERATED_FOLDER}tracked.ts`
const NEW_AND_IGNORED = `${GENERATED_FOLDER}new.ts`
const FORCE_ADDED = `${GENERATED_FOLDER}forced.ts`
const IGNORING_COMMIT_MESSAGE = 'git leaves the generated folder out'

// spawnSync's error where it finds no git to start (Node 22).
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

  it('is none for init where git cannot be started, which it tells apart from a folder outside any repo and from one inside a repo', () => {
    const inARepo = createGitProject(tempProjects, { repo: 'committed', files: {}, linkedPackages: [] })
    const outside = createGitProject(tempProjects, { repo: 'not a repo', files: {}, linkedPackages: [] })
    const answers = { inARepo: whereInitRuns(inARepo.dir), outside: whereInitRuns(outside.dir) }
    unstartableGit.subcommand = 'rev-parse'

    expect({ ...answers, gitCouldNotRun: whereInitRuns(inARepo.dir) }).toStrictEqual({
      inARepo: { kind: 'in a repo', topLevel: inARepo.dir },
      outside: { kind: 'outside a repo' },
      gitCouldNotRun: { kind: 'git could not run' },
    })
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

  it('include a same-size edit made in the second git last wrote its index in, beside a file left as committed', () => {
    const project = createGitProject(tempProjects, {
      repo: 'no commits',
      files: { [EDITED]: moduleText(exportedConstant('older')), [LEFT_AS_COMMITTED]: moduleText(exportedConstant('kept')) },
      linkedPackages: [],
    })
    // No ctime can be set, so git is told to leave it out: its stat data then matches as after an edit in the commit's own second.
    project.git('config', 'core.trustctime', 'false')
    writtenInOneSecond(project.pathOf(EDITED))
    writtenInOneSecond(project.pathOf(LEFT_AS_COMMITTED))
    project.git('add', '--all')
    project.git('commit', '--quiet', '--message', COMMIT_MESSAGE)
    project.write(EDITED, moduleText(exportedConstant('newer')))
    writtenInOneSecond(project.pathOf(EDITED))
    writtenInOneSecondAndReadLater(project.pathOf(GIT_INDEX))

    expect(changedFilesIn(gitRepoAt(project.dir))).toStrictEqual([{ path: EDITED, oldPath: null, isNew: false }])
  })

  it('include a committed file that a .gitignore line written since matches, edited, as git tracks it still, beside a new file that line leaves out', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { [TRACKED_THEN_IGNORED]: moduleText(exportedConstant('generated')) }, linkedPackages: [] })
    project.write(GITIGNORE_FILE, gitignoreText(GENERATED_FOLDER))
    project.git('add', GITIGNORE_FILE)
    project.git('commit', '--quiet', '--message', IGNORING_COMMIT_MESSAGE)
    project.append(TRACKED_THEN_IGNORED, moduleText(exportedConstant('edited')))
    project.write(NEW_AND_IGNORED, moduleText(exportedConstant('new')))

    expect(changedFilesIn(gitRepoAt(project.dir))).toStrictEqual([{ path: TRACKED_THEN_IGNORED, oldPath: null, isNew: false }])
  })

  it('include a new file a .gitignore line matches that git add --force put in the index, as only git\'s own index holds it, beside a new file that line leaves out', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { [GITIGNORE_FILE]: gitignoreText(GENERATED_FOLDER) }, linkedPackages: [] })
    project.write(FORCE_ADDED, moduleText(exportedConstant('forced')))
    project.git('add', '--force', FORCE_ADDED)
    project.write(NEW_AND_IGNORED, moduleText(exportedConstant('new')))

    expect(changedFilesIn(gitRepoAt(project.dir))).toStrictEqual([{ path: FORCE_ADDED, oldPath: null, isNew: true }])
  })

  it('are read as from an empty index where the repo has a commit but no index file, as `git clone --no-checkout` leaves: an edited file, beside one left as committed', () => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [EDITED]: moduleText(exportedConstant('older')), [LEFT_AS_COMMITTED]: moduleText(exportedConstant('kept')) },
      linkedPackages: [],
    })
    project.remove(GIT_INDEX)
    project.append(EDITED, moduleText(exportedConstant('added')))

    expect(changedFilesIn(gitRepoAt(project.dir))).toStrictEqual([{ path: EDITED, oldPath: null, isNew: false }])
  })

  it('are every file git does not ignore, each new, where the repo has no commit yet, beside one a .gitignore line leaves out', () => {
    const project = createGitProject(tempProjects, {
      repo: 'no commits',
      files: { [GITIGNORE_FILE]: gitignoreText(GENERATED_FOLDER), [ADDED]: moduleText(exportedConstant('added')), [NEW_AND_IGNORED]: moduleText(exportedConstant('new')) },
      linkedPackages: [],
    })

    expect(changedFilesIn(gitRepoAt(project.dir))).toStrictEqual([
      { path: GITIGNORE_FILE, oldPath: null, isNew: true },
      { path: ADDED, oldPath: null, isNew: true },
    ])
  })
})

describe('the lines git counts as changed in each changed file', () => {
  it('are those added since the commit, in a file edited since', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { [EDITED]: moduleText(exportedConstant('older')) }, linkedPackages: [] })
    project.append(EDITED, moduleText(exportedConstant('added')))

    expect(changedLinesOfEachFile(project.dir)).toStrictEqual([partlyChanged([THE_LINE_ADDED])])
  })

  it('are those added beyond the move, in a file git mv moved and then edited', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { [MOVED_FROM]: moduleText(exportedConstant('moved')) }, linkedPackages: [] })
    project.git('mv', MOVED_FROM, MOVED_TO)
    project.append(MOVED_TO, moduleText(exportedConstant('added')))

    expect(changedLinesOfEachFile(project.dir)).toStrictEqual([partlyChanged([THE_LINE_ADDED])])
  })

  it('are the whole file, in a file new since the commit', () => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: {}, linkedPackages: [] })
    project.write(ADDED, moduleText(exportedConstant('added')))

    expect(changedLinesOfEachFile(project.dir)).toStrictEqual([WHOLE_FILE_CHANGED])
  })

  it('are the whole file, in each file of a repo with no commit yet', () => {
    const project = createGitProject(tempProjects, { repo: 'no commits', files: { [EDITED]: moduleText(exportedConstant('edited')) }, linkedPackages: [] })

    expect(changedLinesOfEachFile(project.dir)).toStrictEqual([WHOLE_FILE_CHANGED])
  })
})

function changedLinesOfEachFile(topLevel: string): ChangedLines[] {
  const repo = gitRepoAt(topLevel)
  return changedFilesIn(repo).map((file) => changedLinesOf(repo, file))
}

function writtenInOneSecond(path: string): void {
  utimesSync(path, ONE_SECOND, ONE_SECOND)
}

/** Read since, as any later git command reads it: its access time moves on, and only its modification time is the second git wrote it in. */
function writtenInOneSecondAndReadLater(path: string): void {
  utimesSync(path, A_DAY_LATER, ONE_SECOND)
}
