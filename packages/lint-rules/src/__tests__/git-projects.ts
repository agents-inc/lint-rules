import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { devNull } from 'node:os'
import { dirname, join } from 'node:path'
import { CONSUMER_INSTALL, type LinkedPackage, type ProjectFiles, type TempProjects, writeFileCreatingItsDir } from './temp-projects.ts'

/** How the project's folder stands to git before the agent's changes. */
export type RepoState = 'committed' | 'no commits' | 'not a repo'

export type GitProjectSpec = {
  /** The project's files before the agent's changes: the first commit, where the repo has one. */
  readonly files: ProjectFiles
  readonly repo: RepoState
  /** Installed in the folder above the project. A consumer's install unless given: this package and oxlint. */
  readonly linkedPackages?: readonly LinkedPackage[]
}

/** A temp project, by its real path, and the changes an agent makes to it. Every file path is relative to the project. */
export type GitProject = {
  readonly dir: string
  readonly pathOf: (file: string) => string
  readonly read: (file: string) => string
  /** The file's text, or null where there is no such file: for a file the run under test should have written. */
  readonly readIfWritten: (file: string) => string | null
  readonly readBytes: (file: string) => Buffer
  readonly exists: (file: string) => boolean
  readonly write: (file: string, content: string) => void
  readonly append: (file: string, content: string) => void
  readonly remove: (file: string) => void
  /** A plain `mv`, which git does not record. */
  readonly move: (from: string, to: string) => void
  readonly git: (...args: string[]) => string
  /** Writes a file in the folder above the project, which holds its linked packages and is in no repo. */
  readonly writeAbove: (file: string, content: string) => void
}

const FIRST_COMMIT_MESSAGE = 'the project before the agent changed it'
// Variables that point git at another repository or index than the folder's own.
const GIT_REPOSITORY_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR']
// The same git for every developer: no system or global config, and an identity to commit with.
const GIT_ISOLATION = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: devNull,
  GIT_AUTHOR_NAME: 'Check Tests',
  GIT_AUTHOR_EMAIL: 'check-tests@example.com',
  GIT_COMMITTER_NAME: 'Check Tests',
  GIT_COMMITTER_EMAIL: 'check-tests@example.com',
}
// The test's own git commands never refresh the index on the side, so only check could change it.
const NO_OPTIONAL_LOCKS = { GIT_OPTIONAL_LOCKS: '0' }

/** The project, made as the spec says, its repo initialised and committed as `repo` says. */
export function createGitProject(tempProjects: TempProjects, { files, repo, linkedPackages = CONSUMER_INSTALL }: GitProjectSpec): GitProject {
  const dir = realpathSync(tempProjects.create({ files, linkedPackages }))
  if (repo !== 'not a repo') gitIn(dir, ['init', '--quiet'])
  if (repo === 'committed') {
    gitIn(dir, ['add', '--all'])
    gitIn(dir, ['commit', '--quiet', '--allow-empty', '--message', FIRST_COMMIT_MESSAGE])
  }
  const pathOf = (file: string): string => join(dir, file)
  return {
    dir,
    pathOf,
    read: (file) => readFileSync(pathOf(file), 'utf8'),
    readIfWritten: (file) => (existsSync(pathOf(file)) ? readFileSync(pathOf(file), 'utf8') : null),
    readBytes: (file) => readFileSync(pathOf(file)),
    exists: (file) => existsSync(pathOf(file)),
    write: (file, content) => writeFileCreatingItsDir(pathOf(file), content),
    append: (file, content) => writeFileSync(pathOf(file), `${readFileSync(pathOf(file), 'utf8')}${content}`),
    remove: (file) => rmSync(pathOf(file)),
    move: (from, to) => {
      mkdirSync(dirname(pathOf(to)), { recursive: true })
      renameSync(pathOf(from), pathOf(to))
    },
    git: (...args) => gitIn(dir, args),
    writeAbove: (file, content) => writeFileCreatingItsDir(join(dir, '..', file), content),
  }
}

/** Runs git in the folder: its stdout, or throws with what it printed. */
export function gitIn(dir: string, args: readonly string[]): string {
  const { status, stdout, stderr } = spawnSync('git', args, { cwd: dir, env: testEnv(NO_OPTIONAL_LOCKS), encoding: 'utf8' })
  if (status !== 0) throw new Error(`git ${args.join(' ')} failed in ${dir} (exit ${String(status)}): ${stderr}`)
  return stdout
}

/** `git status --porcelain`, one entry per line, sorted. */
export function gitStatusOf(project: GitProject): string[] {
  return project
    .git('status', '--porcelain', '--untracked-files=all')
    .split('\n')
    .filter((line) => line !== '')
    .toSorted()
}

/** The test's own environment for a process it starts, with git kept to the folder it runs in, and the variables given over it. */
export function testEnv(variables: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !GIT_REPOSITORY_VARIABLES.includes(name)))
  return { ...inherited, ...GIT_ISOLATION, ...variables }
}
