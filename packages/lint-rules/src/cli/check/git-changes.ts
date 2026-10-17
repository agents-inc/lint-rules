import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { firstPrintedLineOf } from '../printed-lines.ts'
import { addedLinesIn, type ChangedLines, partlyChanged, WHOLE_FILE_CHANGED } from './changed-lines.ts'
import { leftoverToRemove } from './leftovers.ts'
import { gitFailed } from './texts.ts'

/** `oldPath`: its path at HEAD where git paired it as a rename or copy. */
export type ChangedFile = { readonly path: string; readonly oldPath: string | null; readonly isNew: boolean }

export type GitRepo = {
  readonly topLevel: string
  /** Null where the repo has no commit: every file is then wholly changed. */
  readonly scratch: ScratchGit | null
}

type ScratchGit = { readonly GIT_INDEX_FILE: string; readonly GIT_OBJECT_DIRECTORY: string; readonly GIT_ALTERNATE_OBJECT_DIRECTORIES: string }

// Argument arrays, never a shell string: a file name is data. No real-index refresh, and literal
// pathspecs, so `a*.ts` is no pattern.
const READ_ONLY_GIT = { GIT_OPTIONAL_LOCKS: '0', GIT_LITERAL_PATHSPECS: '1' }
// A pairing this weak only drops lines that really are the same.
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

/** Null outside a repository; throws where git cannot be started. */
export function gitTopLevelOf(cwd: string): string | null {
  return topLevelFrom(askGitForTheTopLevel(cwd))
}

/** Null where git is missing too: init writes outside git all the same. */
export function gitTopLevelUnlessGitIsMissing(cwd: string): string | null {
  const answer = askGitForTheTopLevel(cwd)
  return answer.error === undefined ? topLevelFrom(answer) : null
}

/**
 * The scratch index is a copy of the real one with untracked files intent-to-add, so git pairs a
 * plain `mv` with its old path. Its objects go to a scratch folder with the repo's as an alternate:
 * the repo is never written. The caller removes both.
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

/** Untracked files included; with no commit, every file git does not ignore. */
export function changedFilesIn({ topLevel, scratch }: GitRepo): ChangedFile[] {
  if (scratch === null) {
    return entriesOf(git(topLevel, null, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])).map((path) => ({ path, oldPath: null, isNew: true }))
  }
  const entries = entriesOf(git(topLevel, scratch, ['diff', '--name-status', '-z', '--no-ext-diff', FIND_RENAMES, '--diff-filter=ACMR', 'HEAD']))
  return Array.from(changedFilesFrom(entries))
}

export function changedLinesOf(repo: GitRepo, file: ChangedFile): ChangedLines {
  if (repo.scratch === null || file.isNew) return WHOLE_FILE_CHANGED
  const pathspec = file.oldPath === null ? [file.path] : [file.oldPath, file.path]
  const diff = git(repo.topLevel, repo.scratch, ['diff', '--unified=0', '--no-color', '--no-ext-diff', FIND_RENAMES, 'HEAD', '--', ...pathspec])
  return partlyChanged(addedLinesIn(diff))
}

function askGitForTheTopLevel(cwd: string): SpawnSyncReturns<string> {
  return askGit(cwd, null, ['rev-parse', '--show-toplevel'])
}

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
 * `<status>\0<path>\0`, or `R<score>\0<old>\0<new>\0` for a pair. nextPathIn shares the loop's
 * iterator, so a pair's extra path is one the loop skips.
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

/** Throws quoting the first line git printed. */
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
