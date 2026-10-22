import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { constants } from 'node:os'
import { delimiter, join } from 'node:path'
import { text } from 'node:stream/consumers'
import { fileURLToPath } from 'node:url'
import { satisfies } from 'semver'
import { hasErrorCode } from '../core/caught-errors.ts'
import { escapeForPattern, type FolderWatch } from './folder-watch.ts'
import { createGitProject, type GitProject, testEnv } from './git-projects.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import type { ProjectFiles } from './temp-projects.ts'

/** The built bin, which `npx agents-inc-lint` runs. */
export const CLI_FILE = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url))

/** Shared by `check` and `init`. */
export const EXIT = { clean: 0, findings: 1, couldNotRun: 2, interrupted: 130, terminated: 143 } as const

/** `exitCode` null where a signal ended it. */
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

type StartedCli = {
  readonly pid: number
  readonly send: (signal: NodeJS.Signals) => void
  readonly ended: Promise<CliRun>
}

export type OldNode = { readonly path: string; readonly version: string }

export type BackgroundRun = { readonly pid: number; readonly signalled: boolean; readonly run: CliRun }

/** Marker files: the oxlint fix run's process ID as it starts, and a mark once check asked it to stop. */
export type OxlintHoldingOn = { readonly holding: string; readonly askedToStop: string }

export type RunSignalledTwice = BackgroundRun & { readonly oxlintHeldOnPastTheRun: boolean }

type RunActedOn = { readonly pid: number; readonly acted: boolean; readonly run: CliRun }

export type RunBesideAnotherWriter = { readonly wrote: boolean; readonly run: CliRun }

export type FileHolding = { readonly path: string; readonly text: string }

// check needs Node 22.18 or later.
const BELOW_THE_FLOOR = '<22.18.0'
const CLI_TIMEOUT_MS = 240_000
// A run held by a loop in a rule never gets to handle SIGTERM, and spawnSync would wait on it for good.
const KILLED_PAST_THE_TIMEOUT: NodeJS.Signals = 'SIGKILL'
const TEMP_CONFIG_PREFIX = '.agents-inc-check-'
// How often a test reads a file check may be fixing: well inside the time check takes to lint the next file.
const TEXT_POLL_MS = 10

const NODE_EXECUTABLE = 'node'
const OUR_BIN = 'agents-inc-lint'
const WORD_SEPARATOR = ' '

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

export function runCli(cwd: string, args: readonly string[], { env = {}, node = process.execPath }: CliOptions = {}): CliRun {
  const { status, signal, stdout, stderr } = spawnSync(node, [CLI_FILE, ...args], {
    cwd,
    env: testEnv(env),
    encoding: 'utf8',
    timeout: CLI_TIMEOUT_MS,
    killSignal: KILLED_PAST_THE_TIMEOUT,
  })
  return { exitCode: status, signal, stdout, stderr }
}

/** A command line's words, then the arguments given, run as an agent's shell runs them: by the name on PATH. */
export function runCommandLine(cwd: string, commandLine: string, args: readonly string[], { env = {} }: Pick<CliOptions, 'env'> = {}): CliRun {
  const [command, ...words] = commandLine.split(WORD_SEPARATOR)
  if (command === undefined || command === '') throw new Error(`the command line "${commandLine}" names no command`)
  const { status, signal, stdout, stderr } = spawnSync(command, [...words, ...args], {
    cwd,
    env: testEnv(env),
    encoding: 'utf8',
    timeout: CLI_TIMEOUT_MS,
    killSignal: KILLED_PAST_THE_TIMEOUT,
  })
  return { exitCode: status, signal, stdout, stderr }
}

export function runCheck(cwd: string, options: CliOptions = {}): CliRun {
  return runCli(cwd, ['check'], options)
}

export function runInit(cwd: string, options: CliOptions = {}): CliRun {
  return runCli(cwd, ['init'], options)
}

/** A committed project, the agent's edits, then check run from its folder. Registers hooks: call it in a describe block. */
export function setUpCheckAfterTheAgent(committed: ProjectFiles, agentEdits: (project: GitProject) => void): () => CliRun {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: committed })
    agentEdits(project)
    return runCheck(project.dir)
  })
}

function startCli(cwd: string, args: readonly string[], { env = {}, node = process.execPath }: CliOptions = {}): StartedCli {
  const child = spawn(node, [CLI_FILE, ...args], { cwd, env: testEnv(env), stdio: ['ignore', 'pipe', 'pipe'] })
  const { pid } = child
  if (pid === undefined) throw new Error(`${node} could not be started`)
  const ended = Promise.all([text(child.stdout), text(child.stderr), once(child, 'close')]).then(
    ([stdout, stderr, [code, signal]]): CliRun => ({ exitCode: exitCodeOf(code), signal: signalOf(signal), stdout, stderr }),
  )
  return { pid, send: (signal) => child.kill(signal), ended }
}

function startCheck(cwd: string, options: CliOptions = {}): StartedCli {
  return startCli(cwd, ['check'], options)
}

export const RUNS_IN_THE_BACKGROUND: RunsBeforeTheSuiteOptions = { timeoutMs: 600_000, whatFailed: 'the runs could not be made before the suite' }

export async function checkInTheBackground(cwd: string, options: CliOptions = {}): Promise<BackgroundRun> {
  const started = startCheck(cwd, options)
  return { pid: started.pid, signalled: false, run: await started.ended }
}

/** A run that ends before its temporary oxlint config appears is not signalled. */
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

/** Signals once the file changes, as a fix check writes makes it; a run that ends first is not signalled. */
export async function checkSignalledOnceTheFileChanges(cwd: string, path: string, signal: NodeJS.Signals, options: CliOptions = {}): Promise<BackgroundRun> {
  return checkSignalledAfterAnotherWriter(cwd, path, () => undefined, signal, options)
}

/** As checkSignalledOnceTheFileChanges, with `anotherWriter` writing before the signal. */
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

/** As checkSignalledAfterAnotherWriter, signalling once check has fixed what that writer wrote. */
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

/** Once the file changes, `anotherWriter` writes while check runs on, unsignalled. */
export async function checkRunningOnBesideAnotherWriter(cwd: string, path: string, anotherWriter: () => void, options: CliOptions = {}): Promise<RunBesideAnotherWriter> {
  const before = readFileSync(path, 'utf8')
  const { acted, run } = await checkActingWhen(cwd, () => textChangeOf(path, before), anotherWriter, options)
  return { wrote: acted, run }
}

/** The writer writes after oxlint read each file, and before check reads it again to place what oxlint reported. */
export function anotherWriterAsOxlintsLintRunEnds(writes: readonly FileHolding[]): CliOptions {
  const nodeOptions = [process.env['NODE_OPTIONS'], `--import=${WRITER_AS_OXLINT_LINT_RUN_ENDS}`].filter((option) => option !== undefined && option !== '').join(' ')
  return { env: { NODE_OPTIONS: nodeOptions, [WRITES_AS_OXLINT_LINT_RUN_ENDS]: JSON.stringify(writes) } }
}

/** First signal once oxlint's fix run holds on after a stop, the second once check asked it to end; then ends that oxlint. */
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
    if (hasErrorCode(error, NO_SUCH_PROCESS)) return false
    throw error
  }
}

function fileAppearingAt(path: string): Watch {
  let poll: ReturnType<typeof setInterval> | undefined
  const seen = new Promise<void>((resolve) => {
    poll = setInterval(() => {
      if (existsSync(path)) resolve()
    }, TEXT_POLL_MS)
  })
  return { seen, stop: () => clearInterval(poll) }
}

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

async function actOnceSeen(started: StartedCli, watch: Watch, act: () => void): Promise<boolean> {
  const seen = (await firstOf(watch, started.ended)) === 'seen'
  if (seen) act()
  return seen
}

function firstOf(watch: Watch, ended: Promise<CliRun>): Promise<'seen' | 'ended'> {
  return Promise.race([watch.seen.then(() => 'seen' as const), ended.then(() => 'ended' as const)]).finally(watch.stop)
}

/** Stop it when done. */
type Watch = { readonly seen: Promise<unknown>; readonly stop: () => void }

/** The folder's own watch stops it. */
function appearanceIn(watched: FolderWatch, pattern: RegExp): Watch {
  return { seen: watched.appeared(pattern), stop: () => undefined }
}

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

export function idOfAnEndedProcess(): number {
  const { pid } = spawnSync(process.execPath, ['--eval', ''])
  return pid
}

/** PATH less the folders holding a bin of our name, as a workspace install or `bun run` puts this repo's own there. */
export function searchPathWithoutOurBin(): string {
  const searchPath = process.env['PATH']
  if (searchPath === undefined) throw new Error('the tests run with no PATH')
  return searchPath
    .split(delimiter)
    .filter((folder) => !existsSync(join(folder, OUR_BIN)))
    .join(delimiter)
}

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
