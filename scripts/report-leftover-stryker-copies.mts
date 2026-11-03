// Warns of the copies of the repo a killed Stryker run left in .stryker-tmp, run from the repo root. It
// removes nothing. It tells a live run by the processes /proc lists, so it reports
// only on Linux; elsewhere it prints nothing.
import { existsSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
// eslint-disable-next-line import-x/no-relative-packages -- the published package's `exports` name only its built entries, never src/core
import { hasErrorCode } from '../packages/lint-rules/src/core/caught-errors.ts'

const STRYKER_TEMP_FOLDER = '.stryker-tmp'
const COPY_NAME_PREFIX = 'sandbox-'
// Stryker's launcher sets this as its process title before it makes a copy. Linux then lists that title, padded with
// NULs, as the process's whole command line, so the command that started it no longer shows.
const STRYKER_TITLE = 'stryker'
const PROCESS_TABLE = '/proc'
const WORKING_FOLDER_LINK = 'cwd'
const COMMAND_LINE_FILE = 'cmdline'
const COMMAND_LINE_PADDING = /\0+$/u
const PROCESS_ID = /^\d+$/u
const NO_FOLDER_THERE = ['ENOENT', 'ENOTDIR'] as const
// A process that ended while the table was read, or another user's.
const UNREADABLE_PROCESS = ['ENOENT', 'ESRCH', 'EACCES', 'EPERM'] as const
const WARNING =
  'WARNING: no Stryker run is using these copies of the repo, and every test that walks the repo slows down while they are there. ' +
  'Remove each by hand:'

type RunningProcess = { readonly workingFolder: string; readonly commandLine: string }

// eslint-disable-next-line functional/no-return-void -- it warns on stderr, where the person running the tests reads it: a value it returned would reach no one
function reportLeftoverCopies(root: string): void {
  const copies = copiesIn(root)
  if (copies.length === 0 || !existsSync(PROCESS_TABLE)) return
  if (runningProcesses().some((each) => isStrykerRunFrom(root, each))) return
  // eslint-disable-next-line functional/no-expression-statements -- write returns whether Node buffered the text, and the process waits for a buffered write before it ends either way
  process.stderr.write(warningNaming(copies.map((copy) => relative(root, copy))))
}

function copiesIn(root: string): readonly string[] {
  const folder = join(root, STRYKER_TEMP_FOLDER)
  return entryNamesIn(folder)
    .filter((name) => name.startsWith(COPY_NAME_PREFIX))
    // Node lists a folder in name order on Linux already; Bun does not.
    .toSorted()
    .map((name) => join(folder, name))
}

function entryNamesIn(folder: string): readonly string[] {
  try {
    return readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name)
  } catch (error) {
    if (isAnyOf(error, NO_FOLDER_THERE)) return []
    throw error
  }
}

function runningProcesses(): readonly RunningProcess[] {
  return readdirSync(PROCESS_TABLE)
    .filter((name) => PROCESS_ID.test(name))
    .flatMap(processListedAs)
}

function processListedAs(id: string): readonly RunningProcess[] {
  try {
    return [{ workingFolder: readlinkSync(join(PROCESS_TABLE, id, WORKING_FOLDER_LINK)), commandLine: commandLineOf(id) }]
  } catch (error) {
    if (isAnyOf(error, UNREADABLE_PROCESS)) return []
    throw error
  }
}

function commandLineOf(id: string): string {
  return readFileSync(join(PROCESS_TABLE, id, COMMAND_LINE_FILE), 'utf8').replace(COMMAND_LINE_PADDING, '')
}

// Its workers outlive a killed run in its copy, so only its main process shows the run is live.
function isStrykerRunFrom(root: string, { workingFolder, commandLine }: RunningProcess): boolean {
  return workingFolder === root && commandLine === STRYKER_TITLE
}

function warningNaming(copiesFromTheRoot: readonly string[]): string {
  return [WARNING, ...copiesFromTheRoot.map((copy) => `  ${copy}`), ''].join('\n')
}

function isAnyOf(error: unknown, codes: readonly string[]): boolean {
  return codes.some((code) => hasErrorCode(error, code))
}

reportLeftoverCopies(process.cwd())
