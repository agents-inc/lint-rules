import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { firstPrintedLineOf } from '../printed-lines.ts'
import { addedLinesIn, type ChangedLines, partlyChanged, WHOLE_FILE_CHANGED } from './changed-lines.ts'
import { leftoverToRemove } from './leftovers.ts'
import { gitFailed } from './texts.ts'

/** A file git counts as changed, by its path from the repo's top level, with the path it had at HEAD where git paired it with one. */
export type ChangedFile = { readonly path: string; readonly oldPath: string | null; readonly isNew: boolean }

/** The repo check reads, and how it asks git about it. */
export type GitRepo = {
  readonly topLevel: string
  /** The variables that point git at the scratch index and objects: null where the repo has no commit, and every file is then wholly changed (q-c8). */
  readonly scratch: ScratchGit | null
}

type ScratchGit = { readonly GIT_INDEX_FILE: string; readonly GIT_OBJECT_DIRECTORY: string; readonly GIT_ALTERNATE_OBJECT_DIRECTORIES: string }

// Every git command is an argument array, never a shell string: a file name is data. Each runs from
// the top level, never refreshes the real index on the side, and reads paths literally, so a file
// named `a*.ts` is not a pattern.
const READ_ONLY_GIT = { GIT_OPTIONAL_LOCKS: '0', GIT_LITERAL_PATHSPECS: '1' }
// The gate's measured choice (q-c7): a pairing this weak only drops lines that really are the same.
const FIND_RENAMES = '--find-renames=1%'
const NUL = '\0'
const SCRATCH_PREFIX = 'agents-inc-check-git-'
// The scratch folder holds its index and objects under the names git gives them in the repo.
const INDEX = 'index'
const OBJECTS = 'objects'
// Rename and copy entries carry the old path, then the new one.
const PAIRED_STATUSES = new Set(['R', 'C'])
const ADDED = 'A'
const GIT_OUTPUT_LIMIT = 256 * 1024 * 1024

/** The top level of the git repository holding the folder, or null where no repository does. Throws where git cannot be started. */
export function gitTopLevelOf(cwd: string): string | null {
  return topLevelFrom(askGitForTheTopLevel(cwd))
}

/**
 * As gitTopLevelOf, but null where git cannot be started too, as where none is installed: init
 * writes outside git all the same, and notes that check needs it (q-i8).
 */
export function gitTopLevelUnlessGitIsMissing(cwd: string): string | null {
  const answer = askGitForTheTopLevel(cwd)
  return answer.error === undefined ? topLevelFrom(answer) : null
}

/**
 * The repo, with a scratch index where it has commits: a copy of the real one, in the OS temp
 * folder, with every untracked file added as intent-to-add, so git can pair a plain `mv` with its
 * old path (q-c7). Adding writes the empty blob, so git writes objects into a scratch folder beside
 * it and reads the repo's own as an alternate: the repo is never written. The caller removes both.
 */
export function gitRepoAt(topLevel: string): GitRepo {
  if (!hasCommits(topLevel)) return { topLevel, scratch: null }
  const gitPath = (name: string): string => resolve(topLevel, git(topLevel, null, ['rev-parse', '--git-path', name]).trim())
  const folder = leftoverToRemove(mkdtempSync(join(tmpdir(), SCRATCH_PREFIX)))
  const scratch: ScratchGit = {
    GIT_INDEX_FILE: join(folder, INDEX),
    GIT_OBJECT_DIRECTORY: join(folder, OBJECTS),
    GIT_ALTERNATE_OBJECT_DIRECTORIES: alternateObjectFolders(gitPath(OBJECTS)),
  }
  copyFileSync(gitPath(INDEX), scratch.GIT_INDEX_FILE)
  mkdirSync(scratch.GIT_OBJECT_DIRECTORY)
  git(topLevel, scratch, ['add', '--intent-to-add', '-A', '.'])
  return { topLevel, scratch }
}

/** Every file added, copied, modified or renamed since HEAD, staged or not, untracked included; every file git does not ignore where there is no commit. */
export function changedFilesIn({ topLevel, scratch }: GitRepo): ChangedFile[] {
  if (scratch === null) {
    return entriesOf(git(topLevel, null, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])).map((path) => ({ path, oldPath: null, isNew: true }))
  }
  const entries = entriesOf(git(topLevel, scratch, ['diff', '--name-status', '-z', '--no-ext-diff', FIND_RENAMES, '--diff-filter=ACMR', 'HEAD']))
  return Array.from(changedFilesFrom(entries))
}

/** The lines of the file a change added: all of a file with no old path, else those its diff against HEAD adds. */
export function changedLinesOf(repo: GitRepo, file: ChangedFile): ChangedLines {
  if (repo.scratch === null || file.isNew) return WHOLE_FILE_CHANGED
  const pathspec = file.oldPath === null ? [file.path] : [file.oldPath, file.path]
  const diff = git(repo.topLevel, repo.scratch, ['diff', '--unified=0', '--no-color', '--no-ext-diff', FIND_RENAMES, 'HEAD', '--', ...pathspec])
  return partlyChanged(addedLinesIn(diff))
}

function askGitForTheTopLevel(cwd: string): SpawnSyncReturns<string> {
  return askGit(cwd, null, ['rev-parse', '--show-toplevel'])
}

/** The top level git answered with: null where it found no repository. Throws where git could not be started. */
function topLevelFrom(answer: SpawnSyncReturns<string>): string | null {
  throwWhereGitCouldNotStart(answer)
  return answer.status === 0 ? answer.stdout.trim() : null
}

/** The repo's own objects, then any alternates git is already given. */
function alternateObjectFolders(repoObjects: string): string {
  return [repoObjects, process.env['GIT_ALTERNATE_OBJECT_DIRECTORIES']].filter((path) => path !== undefined).join(delimiter)
}

function hasCommits(topLevel: string): boolean {
  return askGit(topLevel, null, ['rev-parse', '--verify', '--quiet', 'HEAD']).status === 0
}

/**
 * `<status>\0<path>\0`, or `R<score>\0<old>\0<new>\0` for a pair: a pair's entry takes one more path.
 * The loop and nextPathIn share one iterator over the fields, so each path taken inside the loop is
 * one the loop skips, and the loop's next field is the next entry's status.
 */
function* changedFilesFrom(entries: readonly string[]): Generator<ChangedFile> {
  const fields = entries.values()
  for (const status of fields) {
    const kind = status.charAt(0)
    const first = nextPathIn(fields, entries)
    yield PAIRED_STATUSES.has(kind) ? { path: nextPathIn(fields, entries), oldPath: first, isNew: false } : { path: first, oldPath: null, isNew: kind === ADDED }
  }
}

function nextPathIn(fields: Iterator<string>, entries: readonly string[]): string {
  const field = fields.next()
  if (field.done === true) throw new Error(gitFailed(`its --name-status list ends part way through an entry: ${entries.join(' ')}`))
  return field.value
}

function entriesOf(nulSeparated: string): string[] {
  return nulSeparated.split(NUL).filter((entry) => entry !== '')
}

/** Runs git from the top level: its stdout, or throws quoting the first line it printed. */
function git(topLevel: string, scratch: ScratchGit | null, args: readonly string[]): string {
  const answer = askGit(topLevel, scratch, args)
  throwWhereGitCouldNotStart(answer)
  const { status, stdout, stderr } = answer
  if (status !== 0) throw new Error(gitFailed(firstPrintedLineOf([stderr], `git ${args.join(' ')} exited ${String(status)}`)))
  return stdout
}

function askGit(cwd: string, scratch: ScratchGit | null, args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync('git', args, { cwd, env: gitEnv(scratch), encoding: 'utf8', maxBuffer: GIT_OUTPUT_LIMIT })
}

function throwWhereGitCouldNotStart({ error }: SpawnSyncReturns<string>): void {
  if (error !== undefined) throw new Error(gitFailed(error.message), { cause: error })
}

function gitEnv(scratch: ScratchGit | null): NodeJS.ProcessEnv {
  return { ...process.env, ...READ_ONLY_GIT, ...scratch }
}
