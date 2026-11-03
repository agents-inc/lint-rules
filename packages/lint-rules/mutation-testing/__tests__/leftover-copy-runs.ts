import { type ChildProcess, type ChildProcessByStdio, spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { type ProjectFiles, type TempProjects, writeFileCreatingItsDir } from '../../src/__tests__/temp-projects.ts'
import { hasErrorCode } from '../../src/core/caught-errors.ts'
import { filesOfCopies, repoFiles, STRYKER_TEMP_FOLDER } from './factories/stryker-copy-factories.ts'

export type ReportRun = { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string }

/** Starts a process that prints a line once it is up, and stays up until the run that started it stops it. */
export type StandIn = () => PrintingProcess

type PrintingProcess = ChildProcessByStdio<null, Readable, null>

const REPORT_SCRIPT = fileURLToPath(new URL('../../../../scripts/report-leftover-stryker-copies.mts', import.meta.url))
const STRYKER_BIN = 'node_modules/.bin/stryker'
const STRYKER_ARGUMENTS = ['run', 'stryker.config.json']
// As Stryker's launcher does before it makes a copy, so /proc lists the process as `stryker`, not by how it was started.
const STRYKER_TITLE_SCRIPT = "process.title = 'stryker'\n"
const IDLE_SCRIPT = 'setInterval(() => {}, 3_600_000)\n'
// The report waits for its line: a launcher's title is set only once Node has started, well after the process is spawned.
const UP_SCRIPT = `console.log('up')\n${IDLE_SCRIPT}`
const RUN_WITH_A_WORKER_SCRIPT = `const { spawn } = require('node:child_process')
const worker = spawn(process.execPath, ['-e', ${JSON.stringify(IDLE_SCRIPT)}], { cwd: process.argv.at(-1), stdio: 'ignore' })
worker.on('spawn', () => console.log(worker.pid))
${IDLE_SCRIPT}`
const REPORT_TIMEOUT_MS = 30_000
// Node's own warnings (type stripping) are not the report's output, so stderr holds only what it prints.
const NODE_WARNINGS_OFF = { NODE_NO_WARNINGS: '1' }
const NO_SIGNAL = 0
const NO_SUCH_PROCESS = 'ESRCH'

export function createRepoWithNoStrykerFolder(tempProjects: TempProjects): string {
  return tempProjects.create({ files: repoFiles() })
}

/** A repo whose `.stryker-tmp` holds the copies given; given none, it is there and empty. */
export function createRepoHoldingCopies(tempProjects: TempProjects, copies: readonly string[]): string {
  return createRepoHoldingCopiesBeside(tempProjects, copies, {})
}

export function createRepoHoldingCopiesBeside(tempProjects: TempProjects, copies: readonly string[], otherFiles: ProjectFiles): string {
  const root = tempProjects.create({ files: { ...repoFiles(), ...filesOfCopies(copies), ...otherFiles } })
  mkdirSync(join(root, STRYKER_TEMP_FOLDER), { recursive: true })
  return root
}

/** A process that is not Stryker, running in the folder given, as a Stryker worker runs in the copy it was handed. */
export function processIn(folder: string): StandIn {
  return () => spawn(process.execPath, ['-e', UP_SCRIPT], { cwd: folder, stdio: ['ignore', 'pipe', 'ignore'] })
}

/** Stryker's main process, started from the folder given, before it has started a worker in its copy. */
export function strykerRunFrom(folder: string): StandIn {
  return () =>
    spawn(process.execPath, [strykerBinRunning(folder, UP_SCRIPT), ...STRYKER_ARGUMENTS], { cwd: folder, stdio: ['ignore', 'pipe', 'ignore'] })
}

/** Stryker's main process started by hand from the folder given, naming its bin by a path relative to that folder. */
export function strykerRunByHandFrom(folder: string): StandIn {
  return () => {
    strykerBinRunning(folder, UP_SCRIPT)
    return spawn(process.execPath, [STRYKER_BIN, ...STRYKER_ARGUMENTS], { cwd: folder, stdio: ['ignore', 'pipe', 'ignore'] })
  }
}

export async function runTheReportWhile(root: string, standIns: readonly StandIn[]): Promise<ReportRun> {
  const running = standIns.map((start) => start())
  try {
    await Promise.all(running.map(async (child) => firstLinePrintedBy(child, 'a stand-in stopped before it was up')))
    const run = runTheReportFrom(root)
    throwWhereAStandInStopped(running)
    return run
  } finally {
    await Promise.all(running.map(stop))
  }
}

export async function runTheReportWhileARunHasAWorkerIn(root: string, copy: string): Promise<ReportRun> {
  return runTheReportBesideARunWithAWorkerIn(root, copy, leaveTheRunGoing)
}

export async function runTheReportAfterKillingARunWithAWorkerIn(root: string, copy: string): Promise<ReportRun> {
  return runTheReportBesideARunWithAWorkerIn(root, copy, stop)
}

async function runTheReportBesideARunWithAWorkerIn(
  root: string,
  copy: string,
  beforeTheReport: (main: Readonly<ChildProcess>) => Promise<void>,
): Promise<ReportRun> {
  const main = startStrykerWithAWorkerIn(root, copy)
  try {
    const workerId = await workerIdPrintedBy(main)
    await beforeTheReport(main)
    const run = runTheReportFrom(root)
    throwWhereTheWorkerStopped(workerId)
    return run
  } finally {
    stopTheProcessGroupOf(main)
    await stop(main)
  }
}

async function leaveTheRunGoing(): Promise<void> {
  // Nothing to do: the report runs while the run is live.
}

// In a process group of its own, which its worker joins and stays in once the main process is killed.
function startStrykerWithAWorkerIn(root: string, copy: string): PrintingProcess {
  const bin = strykerBinRunning(root, RUN_WITH_A_WORKER_SCRIPT)
  return spawn(process.execPath, [bin, ...STRYKER_ARGUMENTS, copy], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], detached: true })
}

function strykerBinRunning(folder: string, script: string): string {
  const bin = join(folder, STRYKER_BIN)
  writeFileCreatingItsDir(bin, `${STRYKER_TITLE_SCRIPT}${script}`)
  return bin
}

async function workerIdPrintedBy(main: Readonly<PrintingProcess>): Promise<number> {
  return Number(await firstLinePrintedBy(main, 'the stand-in Stryker run stopped before it started its worker'))
}

async function firstLinePrintedBy(child: Readonly<PrintingProcess>, whatStopped: string): Promise<string> {
  const lines = createInterface({ input: child.stdout })
  const firstLine = await lines[Symbol.asyncIterator]().next()
  lines.close()
  if (firstLine.done === true) throw new Error(whatStopped)
  return firstLine.value
}

// The report would then have run with no worker in the copy.
function throwWhereTheWorkerStopped(workerId: number): void {
  if (!isThere(workerId)) throw new Error('the stand-in worker stopped before the report finished')
}

function isThere(processId: number): boolean {
  try {
    process.kill(processId, NO_SIGNAL)
    return true
  } catch (error) {
    if (hasErrorCode(error, NO_SUCH_PROCESS)) return false
    throw error
  }
}

// Stops the worker too, which killing the main process leaves running.
function stopTheProcessGroupOf(main: Readonly<ChildProcess>): void {
  if (main.pid === undefined) return
  try {
    process.kill(-main.pid, 'SIGKILL')
  } catch (error) {
    if (!hasErrorCode(error, NO_SUCH_PROCESS)) throw error
  }
}

function runTheReportFrom(root: string): ReportRun {
  const { status, stdout, stderr } = spawnSync(process.execPath, [REPORT_SCRIPT], {
    cwd: root,
    env: { ...process.env, ...NODE_WARNINGS_OFF },
    encoding: 'utf8',
    timeout: REPORT_TIMEOUT_MS,
  })
  return { exitCode: status, stdout, stderr }
}

// The report would then have run without it.
function throwWhereAStandInStopped(running: ReadonlyArray<Readonly<ChildProcess>>): void {
  if (running.some(hasStopped)) throw new Error('a stand-in stopped before the report finished')
}

function hasStopped(child: Readonly<ChildProcess>): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

// One that never started has no pid, and will never exit.
async function stop(child: Readonly<ChildProcess>): Promise<void> {
  if (child.pid === undefined || hasStopped(child)) return
  const exited = once(child, 'exit')
  child.kill('SIGKILL')
  await exited
}
