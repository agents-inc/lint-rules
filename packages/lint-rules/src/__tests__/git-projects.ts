import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, watch, writeFileSync } from 'node:fs'
import { constants, devNull, tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { text } from 'node:stream/consumers'
import { fileURLToPath } from 'node:url'
import { satisfies } from 'semver'
import { afterAll, beforeAll } from 'vitest'
import { INSTALLED_OXLINT, type LinkedPackage, type ProjectFiles, setUpTempProjects, THIS_PACKAGE, type TempProjects } from './temp-projects.ts'

/** The built bin entry, `agents-inc-lint` in package.json's `bin`, which `npx agents-inc-lint` runs. */
export const CLI_FILE = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url))

/** The exit codes the owner chose (q-c2), shared by `check` and `init`. */
export const EXIT = { clean: 0, findings: 1, couldNotRun: 2, interrupted: 130, terminated: 143 } as const

/** What one run of the bin printed, and how it ended: `exitCode` null where a signal ended it. */
export type CliRun = {
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly stdout: string
  readonly stderr: string
}

export type CliOptions = {
  /** Variables set for the run, over the test's own environment. */
  readonly env?: Readonly<Record<string, string>>
  /** The Node that runs the bin: the one running the tests, unless given. */
  readonly node?: string
}

/** A run of the bin started in the background: its process ID, a way to signal it, and its end. */
export type StartedCli = {
  readonly pid: number
  readonly send: (signal: NodeJS.Signals) => void
  readonly ended: Promise<CliRun>
}

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

/** Watches one folder for names that appear in it, as a file created there makes one appear. */
export type FolderWatch = {
  /** Resolves with the first name matching the pattern to appear, one seen already included. */
  readonly appeared: (pattern: RegExp) => Promise<string>
  /** Every name that appeared since the watch began, once each, in order, after every change made before the call has been seen. */
  readonly namesSeen: () => Promise<string[]>
  readonly close: () => void
}

/** A Node older than check's floor, by its path and its version. */
export type OldNode = { readonly path: string; readonly version: string }

/** A run of check started in the background, by its process ID: whether it was sent a signal, and how it ended. */
export type BackgroundRun = { readonly pid: number; readonly signalled: boolean; readonly run: CliRun }

/** The files the oxlint fix run that holds on writes: its process ID as it starts, and a mark once check asked it to stop. */
export type OxlintHoldingOn = { readonly holding: string; readonly askedToStop: string }

/** A run of check signalled twice while its oxlint fix run held on: whether that oxlint still ran as check ended. */
export type RunSignalledTwice = BackgroundRun & { readonly oxlintHeldOnPastTheRun: boolean }

/** A run of check started in the background that another writer wrote beside: whether the writer wrote while it ran, and how it ended. */
export type RunBesideAnotherWriter = { readonly wrote: boolean; readonly run: CliRun }

/** A file, by its absolute path, and a text for it to hold: one a test waits for, or one another writer writes. */
export type FileHolding = { readonly path: string; readonly text: string }

/** As `runsBeforeTheSuite` in consumer-cli-runs.ts: a run that threw is kept as its error, so each test reports it as its own failure. */
type RunsBeforeTheSuite<Runs> =
  | { readonly outcome: 'not made' }
  | { readonly outcome: 'completed'; readonly runs: Runs }
  | { readonly outcome: 'failed'; readonly error: unknown }

// Owner, #59: check needs Node 22.18 or later.
const BELOW_THE_FLOOR = '<22.18.0'
const CLI_TIMEOUT_MS = 240_000
const RUNS_BEFORE_THE_SUITE_TIMEOUT_MS = 600_000
const TEMP_CONFIG_PREFIX = '.agents-inc-check-'
// How often a test reads a file check may be fixing: well inside the time check takes to lint the next file.
const TEXT_POLL_MS = 10
const FLUSH_FILE_PREFIX = '.folder-watch-flush-'
const EMPTY_FOLDER_PREFIX = 'lint-rules-empty-'
const NODE_EXECUTABLE = 'node'
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
const CONSUMER_INSTALL = [THIS_PACKAGE, INSTALLED_OXLINT]
// Imported into each Node process of a check run: it writes the files the variable below names as oxlint's lint run ends.
const WRITER_AS_OXLINT_LINT_RUN_ENDS = new URL('./another-writer-as-oxlint-lint-run-ends.mjs', import.meta.url).href
// Read by another-writer-as-oxlint-lint-run-ends.mjs, under the same name there.
const WRITES_AS_OXLINT_LINT_RUN_ENDS = 'AGENTS_INC_TEST_WRITES_AS_OXLINT_LINT_RUN_ENDS'
// Imported into each Node process of a check run: in oxlint's fix run, it holds on after a stop.
const OXLINT_HOLDING_ON_AFTER_A_STOP = new URL('./oxlint-holding-on-after-a-stop.mjs', import.meta.url).href
// Read by oxlint-holding-on-after-a-stop.mjs, under the same name there.
const OXLINT_HOLDING_ON = 'AGENTS_INC_TEST_OXLINT_HOLDING_ON'
// What signalling a process that has ended gives.
const NO_SUCH_PROCESS = 'ESRCH'

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
    write: (file, content) => writeFileCreatingItsFolder(pathOf(file), content),
    append: (file, content) => writeFileSync(pathOf(file), `${readFileSync(pathOf(file), 'utf8')}${content}`),
    remove: (file) => rmSync(pathOf(file)),
    move: (from, to) => {
      mkdirSync(dirname(pathOf(to)), { recursive: true })
      renameSync(pathOf(from), pathOf(to))
    },
    git: (...args) => gitIn(dir, args),
    writeAbove: (file, content) => writeFileCreatingItsFolder(join(dir, '..', file), content),
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

/** Runs the built bin with the arguments given, from the folder given, to its end. */
export function runCli(cwd: string, args: readonly string[], { env = {}, node = process.execPath }: CliOptions = {}): CliRun {
  const { status, signal, stdout, stderr } = spawnSync(node, [CLI_FILE, ...args], {
    cwd,
    env: testEnv(env),
    encoding: 'utf8',
    timeout: CLI_TIMEOUT_MS,
  })
  return { exitCode: status, signal, stdout, stderr }
}

export function runCheck(cwd: string, options: CliOptions = {}): CliRun {
  return runCli(cwd, ['check'], options)
}

export function runInit(cwd: string, options: CliOptions = {}): CliRun {
  return runCli(cwd, ['init'], options)
}

/** Starts the built bin in the background, from the folder given. */
export function startCli(cwd: string, args: readonly string[], { env = {}, node = process.execPath }: CliOptions = {}): StartedCli {
  const child = spawn(node, [CLI_FILE, ...args], { cwd, env: testEnv(env), stdio: ['ignore', 'pipe', 'pipe'] })
  const { pid } = child
  if (pid === undefined) throw new Error(`${node} could not be started`)
  const ended = Promise.all([text(child.stdout), text(child.stderr), once(child, 'close')]).then(
    ([stdout, stderr, [code, signal]]): CliRun => ({ exitCode: exitCodeOf(code), signal: signalOf(signal), stdout, stderr }),
  )
  return { pid, send: (signal) => child.kill(signal), ended }
}

export function startCheck(cwd: string, options: CliOptions = {}): StartedCli {
  return startCli(cwd, ['check'], options)
}

/**
 * As `setUpRunsBeforeTheSuite` in consumer-cli-runs.ts, for runs made in the background: makes them
 * before the suite, and a run that threw throws as each test's own failure. Call it at the top of a
 * describe block: it registers that scope's hooks.
 */
export function setUpAsyncRunsBeforeTheSuite<Runs>(make: (tempProjects: TempProjects) => Promise<Runs>): () => Runs {
  const tempProjects = setUpTempProjects()
  let runsBeforeTheSuite: RunsBeforeTheSuite<Runs> = { outcome: 'not made' }

  beforeAll(async () => {
    try {
      runsBeforeTheSuite = { outcome: 'completed', runs: await make(tempProjects) }
    } catch (error) {
      runsBeforeTheSuite = { outcome: 'failed', error }
    }
  }, RUNS_BEFORE_THE_SUITE_TIMEOUT_MS)

  return () => {
    if (runsBeforeTheSuite.outcome === 'failed') {
      throw new Error('the runs could not be made before the suite', { cause: runsBeforeTheSuite.error })
    }
    if (runsBeforeTheSuite.outcome === 'not made') throw new Error('the runs were read outside the suite that made them')
    return runsBeforeTheSuite.runs
  }
}

/** Runs check in the background from the folder given, to its end. */
export async function checkInTheBackground(cwd: string, options: CliOptions = {}): Promise<BackgroundRun> {
  const started = startCheck(cwd, options)
  return { pid: started.pid, signalled: false, run: await started.ended }
}

/**
 * Starts check from the folder given and, once its temporary oxlint config appears in the folder
 * watched, sends it the signal. A run that ends before its config appears is not signalled.
 */
export async function checkSignalledOnceItsConfigAppears(
  cwd: string,
  watched: FolderWatch,
  signal: NodeJS.Signals,
  options: CliOptions = {},
): Promise<BackgroundRun> {
  const started = startCheck(cwd, options)
  const first = await Promise.race([
    watched.appeared(tempConfigPatternOf(started.pid)).then(() => 'config appeared' as const),
    started.ended.then(() => 'run ended' as const),
  ])
  if (first === 'config appeared') started.send(signal)
  return { pid: started.pid, signalled: first === 'config appeared', run: await started.ended }
}

/**
 * Starts check from the folder given and, once the file at the path given no longer holds the text
 * it held before the run, as a fix check writes makes it, sends it the signal. A run that ends
 * before the file changes is not signalled.
 */
export async function checkSignalledOnceTheFileChanges(cwd: string, path: string, signal: NodeJS.Signals, options: CliOptions = {}): Promise<BackgroundRun> {
  return checkSignalledAfterAnotherWriter(cwd, path, () => undefined, signal, options)
}

/**
 * As checkSignalledOnceTheFileChanges, with another writer in between: once the file at the path
 * given changes, `anotherWriter` writes, then check is sent the signal.
 */
export async function checkSignalledAfterAnotherWriter(
  cwd: string,
  path: string,
  anotherWriter: () => void,
  signal: NodeJS.Signals,
  options: CliOptions = {},
): Promise<BackgroundRun> {
  const before = readFileSync(path, 'utf8')
  const started = startCheck(cwd, options)
  const first = await firstOf(textChangeOf(path, before), started.ended)
  if (first === 'seen') {
    anotherWriter()
    started.send(signal)
  }
  return { pid: started.pid, signalled: first === 'seen', run: await started.ended }
}

/**
 * As checkSignalledAfterAnotherWriter, with the signal held until check has fixed what that writer
 * wrote: once the file `fixed` names holds the text it gives, check is sent the signal. A run that
 * ends before then is not signalled.
 */
export async function checkSignalledOnceItFixedAnotherWritersText(
  cwd: string,
  path: string,
  anotherWriter: () => void,
  fixed: FileHolding,
  signal: NodeJS.Signals,
  options: CliOptions = {},
): Promise<BackgroundRun> {
  const before = readFileSync(path, 'utf8')
  const started = startCheck(cwd, options)
  if ((await firstOf(textChangeOf(path, before), started.ended)) === 'seen') anotherWriter()
  const first = await firstOf(textWatchOf(fixed.path, (now) => now === fixed.text), started.ended)
  if (first === 'seen') started.send(signal)
  return { pid: started.pid, signalled: first === 'seen', run: await started.ended }
}

/**
 * Starts check from the folder given and, once the file at the path given no longer holds the text
 * it held before the run, has `anotherWriter` write while check runs on to its end, unsignalled.
 */
export async function checkRunningOnBesideAnotherWriter(cwd: string, path: string, anotherWriter: () => void, options: CliOptions = {}): Promise<RunBesideAnotherWriter> {
  const before = readFileSync(path, 'utf8')
  const started = startCheck(cwd, options)
  const first = await firstOf(textChangeOf(path, before), started.ended)
  if (first === 'seen') anotherWriter()
  return { wrote: first === 'seen', run: await started.ended }
}

/**
 * The options of a check run beside another writer who writes each file given, with the text given,
 * as oxlint's lint run ends: after oxlint read it, and before check reads it again to place what
 * oxlint reported. The NODE_OPTIONS the tests run with are kept.
 */
export function anotherWriterAsOxlintsLintRunEnds(writes: readonly FileHolding[]): CliOptions {
  const nodeOptions = [process.env['NODE_OPTIONS'], `--import=${WRITER_AS_OXLINT_LINT_RUN_ENDS}`].filter((option) => option !== undefined && option !== '').join(' ')
  return { env: { NODE_OPTIONS: nodeOptions, [WRITES_AS_OXLINT_LINT_RUN_ENDS]: JSON.stringify(writes) } }
}

/**
 * Starts check from the folder given with its oxlint fix run holding on after a stop (the markers'
 * files are written there): sends the first signal once that run holds on, and the second once
 * check, stopping, asked it to end. Then ends that oxlint, where it still runs.
 */
export async function checkSignalledTwiceWhileOxlintHoldsOn(
  cwd: string,
  markers: OxlintHoldingOn,
  [first, second]: readonly [NodeJS.Signals, NodeJS.Signals],
): Promise<RunSignalledTwice> {
  const started = startCheck(cwd, oxlintHoldingOnAfterAStop(markers))
  const holdingOn = (await firstOf(fileAppearingAt(markers.holding), started.ended)) === 'seen'
  if (holdingOn) started.send(first)
  const askedToStop = holdingOn && (await firstOf(fileAppearingAt(markers.askedToStop), started.ended)) === 'seen'
  if (askedToStop) started.send(second)
  const run = await started.ended
  const oxlintHeldOnPastTheRun = holdingOn && endIfStillRunning(Number(readFileSync(markers.holding, 'utf8')))
  return { pid: started.pid, signalled: askedToStop, run, oxlintHeldOnPastTheRun }
}

/** The options of a check run whose oxlint fix run holds on after a stop, writing the markers given. The NODE_OPTIONS the tests run with are kept. */
function oxlintHoldingOnAfterAStop(markers: OxlintHoldingOn): CliOptions {
  const nodeOptions = [process.env['NODE_OPTIONS'], `--import=${OXLINT_HOLDING_ON_AFTER_A_STOP}`].filter((option) => option !== undefined && option !== '').join(' ')
  return { env: { NODE_OPTIONS: nodeOptions, [OXLINT_HOLDING_ON]: JSON.stringify(markers) } }
}

/** Ends the process where it still runs: whether it did. */
function endIfStillRunning(pid: number): boolean {
  try {
    process.kill(pid, 'SIGKILL')
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === NO_SUCH_PROCESS) return false
    throw error
  }
}

/** A watch that settles once a file is at the path. */
function fileAppearingAt(path: string): TextWatch {
  let poll: ReturnType<typeof setInterval> | undefined
  const seen = new Promise<void>((resolve) => {
    poll = setInterval(() => {
      if (existsSync(path)) resolve()
    }, TEXT_POLL_MS)
  })
  return { seen, stop: () => clearInterval(poll) }
}

/** Whether the watch saw what it waits for first, or the run ended first. */
function firstOf(watch: TextWatch, ended: Promise<CliRun>): Promise<'seen' | 'ended'> {
  return Promise.race([watch.seen.then(() => 'seen' as const), ended.then(() => 'ended' as const)]).finally(watch.stop)
}

/** A watch on a file's text: settles once the file holds text it waits for. Stop it when done. */
type TextWatch = { readonly seen: Promise<void>; readonly stop: () => void }

/** A watch that settles once the file's text differs from the text given. */
function textChangeOf(path: string, before: string): TextWatch {
  return textWatchOf(path, (now) => now !== before)
}

function textWatchOf(path: string, isAwaited: (text: string) => boolean): TextWatch {
  let poll: ReturnType<typeof setInterval> | undefined
  const seen = new Promise<void>((resolve) => {
    poll = setInterval(() => {
      if (isAwaited(readFileSync(path, 'utf8'))) resolve()
    }, TEXT_POLL_MS)
  })
  return { seen, stop: () => clearInterval(poll) }
}

/** The names of check's temporary oxlint configs in the folder, sorted. */
export function tempConfigsIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.startsWith(TEMP_CONFIG_PREFIX))
    .toSorted()
}

/** The name of a temporary oxlint config the process with this ID wrote: `.agents-inc-check-<pid>-<anything>.json`. */
export function tempConfigPatternOf(pid: number): RegExp {
  return new RegExp(`^${escapeForPattern(`${TEMP_CONFIG_PREFIX}${String(pid)}-`)}.+\\.json$`, 'u')
}

/** A file name check's leftover sweep reads as written by the process with this ID. */
export function tempConfigNameOf(pid: number, suffix: string): string {
  return `${TEMP_CONFIG_PREFIX}${String(pid)}-${suffix}.json`
}

/** The ID of a process that has ended. */
export function idOfAnEndedProcess(): number {
  const { pid } = spawnSync(process.execPath, ['--eval', ''])
  return pid
}

/**
 * Empty folders, removed after the suite, for a run to point HOME, XDG_STATE_HOME or TMPDIR at:
 * anything the run writes outside the project shows up in one. Call it at the top of a test file or
 * a describe block: it registers that scope's cleanup.
 */
export function setUpEmptyFolders(): () => string {
  const made: string[] = []
  afterAll(() => {
    made.forEach((folder) => rmSync(folder, { recursive: true, force: true }))
  })
  return () => {
    const folder = realpathSync(mkdtempSync(join(tmpdir(), EMPTY_FOLDER_PREFIX)))
    made.push(folder)
    return folder
  }
}

/** Every entry under the folder, by its path relative to it, sorted. */
export function entriesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).toSorted()
}

/** Watches the folder's own entries, not its subfolders'. Close it when done. */
export function watchFolder(dir: string): FolderWatch {
  const seen: string[] = []
  const waiting: { readonly pattern: RegExp; readonly resolve: (name: string) => void }[] = []
  const watcher = watch(dir, (_event, name) => {
    if (name === null) return
    if (!seen.includes(name)) seen.push(name)
    waiting.filter(({ pattern }) => pattern.test(name)).forEach(({ resolve }) => resolve(name))
  })

  const appeared = (pattern: RegExp): Promise<string> =>
    new Promise((resolve) => {
      const already = seen.find((name) => pattern.test(name))
      if (already === undefined) waiting.push({ pattern, resolve })
      else resolve(already)
    })

  return {
    appeared,
    // The folder's changes are reported in the order they were made, so once a file written now has
    // been seen, so has every change before it.
    namesSeen: async () => {
      const flushFile = `${FLUSH_FILE_PREFIX}${String(process.pid)}-${String(seen.length)}`
      const flushed = appeared(new RegExp(`^${escapeForPattern(flushFile)}$`, 'u'))
      writeFileSync(join(dir, flushFile), '')
      await flushed
      rmSync(join(dir, flushFile))
      return seen.filter((name) => !name.startsWith(FLUSH_FILE_PREFIX))
    },
    close: () => watcher.close(),
  }
}

/** The first Node on PATH older than check's floor, or undefined where PATH has none. */
export function nodeBelowTheFloor(): OldNode | undefined {
  const searchPath = process.env['PATH']
  if (searchPath === undefined) return undefined
  return searchPath
    .split(delimiter)
    .map((folder) => join(folder, NODE_EXECUTABLE))
    .filter((path) => existsSync(path))
    .map((path) => ({ path, version: versionOfNode(path) }))
    .find(({ version }) => satisfies(version, BELOW_THE_FLOOR))
}

function versionOfNode(path: string): string {
  return spawnSync(path, ['--version'], { encoding: 'utf8' }).stdout.trim()
}

function testEnv(variables: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !GIT_REPOSITORY_VARIABLES.includes(name)))
  return { ...inherited, ...GIT_ISOLATION, ...variables }
}

function writeFileCreatingItsFolder(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function escapeForPattern(literal: string): string {
  return literal.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)
}

function exitCodeOf(code: unknown): number | null {
  return typeof code === 'number' ? code : null
}

function signalOf(signal: unknown): NodeJS.Signals | null {
  return typeof signal === 'string' && isSignal(signal) ? signal : null
}

function isSignal(name: string): name is NodeJS.Signals {
  return Object.hasOwn(constants.signals, name)
}
