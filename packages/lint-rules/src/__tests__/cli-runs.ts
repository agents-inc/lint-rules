import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { constants } from 'node:os'
import { delimiter, join } from 'node:path'
import { text } from 'node:stream/consumers'
import { fileURLToPath } from 'node:url'
import { satisfies } from 'semver'
import { escapeForPattern, type FolderWatch } from './folder-watch.ts'
import { createGitProject, type GitProject, testEnv } from './git-projects.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import type { ProjectFiles } from './temp-projects.ts'

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

/** A Node older than check's floor, by its path and its version. */
export type OldNode = { readonly path: string; readonly version: string }

/** A run of check started in the background, by its process ID: whether it was sent a signal, and how it ended. */
export type BackgroundRun = { readonly pid: number; readonly signalled: boolean; readonly run: CliRun }

/** The files the oxlint fix run that holds on writes: its process ID as it starts, and a mark once check asked it to stop. */
export type OxlintHoldingOn = { readonly holding: string; readonly askedToStop: string }

/** A run of check signalled twice while its oxlint fix run held on: whether that oxlint still ran as check ended. */
export type RunSignalledTwice = BackgroundRun & { readonly oxlintHeldOnPastTheRun: boolean }

/** A run of check a test acted on as it ran: whether the test acted before check ended, and how check ended. */
type RunActedOn = { readonly pid: number; readonly acted: boolean; readonly run: CliRun }

/** A run of check started in the background that another writer wrote beside: whether the writer wrote while it ran, and how it ended. */
export type RunBesideAnotherWriter = { readonly wrote: boolean; readonly run: CliRun }

/** A file, by its absolute path, and a text for it to hold: one a test waits for, or one another writer writes. */
export type FileHolding = { readonly path: string; readonly text: string }

// Owner, #59: check needs Node 22.18 or later.
const BELOW_THE_FLOOR = '<22.18.0'
const CLI_TIMEOUT_MS = 240_000
const TEMP_CONFIG_PREFIX = '.agents-inc-check-'
// How often a test reads a file check may be fixing: well inside the time check takes to lint the next file.
const TEXT_POLL_MS = 10

const NODE_EXECUTABLE = 'node'

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

/**
 * Before the suite: a committed project of the files given, the agent's edits made to it, then
 * check run from its folder. Call it at the top of a describe block: it registers that scope's hooks.
 */
export function setUpCheckAfterTheAgent(committed: ProjectFiles, agentEdits: (project: GitProject) => void): () => CliRun {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: committed })
    agentEdits(project)
    return runCheck(project.dir)
  })
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

/** For runs of the bin in the background, which a test watches and signals as they run. */
export const RUNS_IN_THE_BACKGROUND: RunsBeforeTheSuiteOptions = { timeoutMs: 600_000, whatFailed: 'the runs could not be made before the suite' }

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
  const itsConfigAppearing = (started: StartedCli): Watch => appearanceIn(watched, tempConfigPatternOf(started.pid))
  const { pid, acted, run } = await checkActingWhen(cwd, itsConfigAppearing, (started) => started.send(signal), options)
  return { pid, signalled: acted, run }
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
  const writingThenSignalling = (started: StartedCli): void => {
    anotherWriter()
    started.send(signal)
  }
  const { pid, acted, run } = await checkActingWhen(cwd, () => textChangeOf(path, before), writingThenSignalling, options)
  return { pid, signalled: acted, run }
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
  await actOnceSeen(started, textChangeOf(path, before), anotherWriter)
  const signalled = await actOnceSeen(started, textWatchOf(fixed.path, (now) => now === fixed.text), () => started.send(signal))
  return { pid: started.pid, signalled, run: await started.ended }
}

/**
 * Starts check from the folder given and, once the file at the path given no longer holds the text
 * it held before the run, has `anotherWriter` write while check runs on to its end, unsignalled.
 */
export async function checkRunningOnBesideAnotherWriter(cwd: string, path: string, anotherWriter: () => void, options: CliOptions = {}): Promise<RunBesideAnotherWriter> {
  const before = readFileSync(path, 'utf8')
  const { acted, run } = await checkActingWhen(cwd, () => textChangeOf(path, before), anotherWriter, options)
  return { wrote: acted, run }
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
  const holdingOn = await actOnceSeen(started, fileAppearingAt(markers.holding), () => started.send(first))
  const askedToStop = holdingOn && (await actOnceSeen(started, fileAppearingAt(markers.askedToStop), () => started.send(second)))
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
function fileAppearingAt(path: string): Watch {
  let poll: ReturnType<typeof setInterval> | undefined
  const seen = new Promise<void>((resolve) => {
    poll = setInterval(() => {
      if (existsSync(path)) resolve()
    }, TEXT_POLL_MS)
  })
  return { seen, stop: () => clearInterval(poll) }
}

/**
 * Starts check from the folder given and, once the watch it keeps on the run sees what it waits for,
 * acts on the run, unless check ended first: whether it acted, and how the run ended.
 */
async function checkActingWhen(
  cwd: string,
  watchOn: (started: StartedCli) => Watch,
  act: (started: StartedCli) => void,
  options: CliOptions,
): Promise<RunActedOn> {
  const started = startCheck(cwd, options)
  const acted = await actOnceSeen(started, watchOn(started), () => act(started))
  return { pid: started.pid, acted, run: await started.ended }
}

/** Acts once the watch sees what it waits for, unless the run ended first: whether it acted. */
async function actOnceSeen(started: StartedCli, watch: Watch, act: () => void): Promise<boolean> {
  const seen = (await firstOf(watch, started.ended)) === 'seen'
  if (seen) act()
  return seen
}

/** Whether the watch saw what it waits for first, or the run ended first. */
function firstOf(watch: Watch, ended: Promise<CliRun>): Promise<'seen' | 'ended'> {
  return Promise.race([watch.seen.then(() => 'seen' as const), ended.then(() => 'ended' as const)]).finally(watch.stop)
}

/** A watch on a file or a folder: settles once it holds what the watch waits for. Stop it when done. */
type Watch = { readonly seen: Promise<unknown>; readonly stop: () => void }

/** A watch that settles once a name matching the pattern appears in the folder watched. The folder's own watch stops it. */
function appearanceIn(watched: FolderWatch, pattern: RegExp): Watch {
  return { seen: watched.appeared(pattern), stop: () => undefined }
}

/** A watch that settles once the file's text differs from the text given. */
function textChangeOf(path: string, before: string): Watch {
  return textWatchOf(path, (now) => now !== before)
}

function textWatchOf(path: string, isAwaited: (text: string) => boolean): Watch {
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

function exitCodeOf(code: unknown): number | null {
  return typeof code === 'number' ? code : null
}

function signalOf(signal: unknown): NodeJS.Signals | null {
  return typeof signal === 'string' && isSignal(signal) ? signal : null
}

function isSignal(name: string): name is NodeJS.Signals {
  return Object.hasOwn(constants.signals, name)
}
