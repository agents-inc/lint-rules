import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { autofixedLineOf } from '../__tests__/check-output.ts'
import { CHECK_INTERRUPTED } from '../__tests__/factories/check-factories.ts'
import { setUpTempProjects } from '../__tests__/temp-projects.ts'
import { leftoverToRemove } from './check/leftovers.ts'
import type { checkIn } from './check/run-check.ts'
import { EXIT_COULD_NOT_RUN, EXIT_FINDINGS, EXIT_INTERRUPTED, EXIT_TERMINATED } from './exit-codes.ts'
import { runCommand } from './main.ts'
import type { Outcome } from './outcome.ts'

// The stand-in command ends with its own outcome as a signal reaches the run, a timing no signal sent
// from outside can hit; the integration tests send real ones.

const command = vi.hoisted(() => ({ checkIn: vi.fn<typeof checkIn>() }))

vi.mock('./check/run-check.ts', () => ({ checkIn: command.checkIn }))

const FINDINGS_LEFT: Outcome = { stdout: 'a finding\n', stderr: '', exitCode: EXIT_FINDINGS }

type Signal = 'SIGINT' | 'SIGTERM'

type ProcessListeners = {
  readonly SIGINT: readonly NodeJS.SignalsListener[]
  readonly SIGTERM: readonly NodeJS.SignalsListener[]
  readonly warning: readonly NodeJS.WarningListener[]
}

type RunWrote = { readonly stdout: string; readonly stderr: string; readonly exitCode: typeof process.exitCode }

/** What the run had left on disk as it asked Node to exit. */
type ExitAsked = { readonly code: Parameters<typeof process.exit>[0]; readonly hasLeftoverOnDisk: boolean }

const SIGNALS: readonly Signal[] = ['SIGINT', 'SIGTERM']

const FIXED_FIRST = ['src/a.ts']
const FIXED_BY_THE_FAILURE = ['src/a.ts', 'src/b.ts']
const A_FAILURE = 'git failed: fatal: Unable to create the index lock'
const A_TEMP_CONFIG = '.agents-inc-check-1-left.json'
// process.exit never returns, so its stand-in throws where Node would end the process.
const NODE_EXITED = 'process.exit was called'

const tempProjects = setUpTempProjects()

// eslint-disable-next-line functional/no-let -- TS2588 as a const: beforeEach saves the listeners here before each test and afterEach puts them back after it; setUpRunsBeforeTheSuite makes a value once before the suite, not once per test
let listenersBefore = processListeners()
// eslint-disable-next-line functional/no-let -- TS2588, as on the let above: the exit code
let exitCodeBefore = process.exitCode

beforeEach(() => {
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- the save the let above is for
  listenersBefore = processListeners()
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- the save the let above is for
  exitCodeBefore = process.exitCode
})

afterEach(() => {
  for (const signal of SIGNALS) {
    const listeners = listenersBefore[signal]
    process.removeAllListeners(signal)
    for (const listener of listeners) process.on(signal, listener)
  }
  process.removeAllListeners('warning')
  for (const listener of listenersBefore.warning) process.on('warning', listener)
  // eslint-disable-next-line functional/immutable-data -- puts back the exit code the run set on process, which vitest's worker would otherwise end with
  process.exitCode = exitCodeBefore
  vi.restoreAllMocks()
})

function processListeners(): ProcessListeners {
  return { SIGINT: process.listeners('SIGINT'), SIGTERM: process.listeners('SIGTERM'), warning: process.listeners('warning') }
}

function signalTheRun(signal: Signal): void {
  const addedByTheRun = process.listeners(signal).filter((listener) => !listenersBefore[signal].includes(listener))
  for (const listener of addedByTheRun) listener(signal)
}

async function checkRun(): Promise<RunWrote> {
  const writesToStdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  const writesToStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  await runCommand('check')
  return {
    stdout: writesToStdout.mock.calls.map(([chunk]) => String(chunk)).join(''),
    stderr: writesToStderr.mock.calls.map(([chunk]) => String(chunk)).join(''),
    exitCode: process.exitCode,
  }
}

/** A leftover of this run, as check registers its temporary config. */
function aLeftoverOfTheRun(): string {
  return leftoverToRemove(join(tempProjects.create({ files: { [A_TEMP_CONFIG]: '{}' } }), A_TEMP_CONFIG))
}

function exitsAskedFor(leftover: string): Mock<(exit: ExitAsked) => void> {
  const asked = vi.fn<(exit: ExitAsked) => void>()
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    asked({ code, hasLeftoverOnDisk: existsSync(leftover) })
    throw new Error(NODE_EXITED)
  })
  return asked
}

describe('the outcome of a run', () => {
  it("is the command's own where no signal reached the run", async () => {
    command.checkIn.mockResolvedValue(FINDINGS_LEFT)

    expect(await checkRun()).toStrictEqual({ stdout: FINDINGS_LEFT.stdout, stderr: '', exitCode: EXIT_FINDINGS })
  })

  it('says the run was interrupted, exiting 130, where SIGINT reached it as the command ended with its own outcome', async () => {
    command.checkIn.mockImplementation(async () => {
      signalTheRun('SIGINT')
      return FINDINGS_LEFT
    })

    expect(await checkRun()).toStrictEqual({ stdout: '', stderr: CHECK_INTERRUPTED, exitCode: EXIT_INTERRUPTED })
  })

  it('says the run was interrupted, exiting 143, where SIGTERM reached it as the command ended with its own outcome', async () => {
    command.checkIn.mockImplementation(async () => {
      signalTheRun('SIGTERM')
      return FINDINGS_LEFT
    })

    expect(await checkRun()).toStrictEqual({ stdout: '', stderr: CHECK_INTERRUPTED, exitCode: EXIT_TERMINATED })
  })
})

describe('a run the command fails part way through', () => {
  it('names the files the command last said it fixed, says check could not run, quoting the failure, and exits 2', async () => {
    command.checkIn.mockImplementation(async (_cwd, _signal, ifStopped) => {
      ifStopped.update(autofixedLineOf(FIXED_FIRST))
      ifStopped.update(autofixedLineOf(FIXED_BY_THE_FAILURE))
      throw new Error(A_FAILURE)
    })

    expect(await checkRun()).toStrictEqual({ stdout: autofixedLineOf(FIXED_BY_THE_FAILURE), stderr: `check: could not run: ${A_FAILURE}\n`, exitCode: EXIT_COULD_NOT_RUN })
  })

  it('prints nothing on stdout where the command failed before it fixed a file, beside that run', async () => {
    command.checkIn.mockRejectedValue(new Error(A_FAILURE))

    expect(await checkRun()).toStrictEqual({ stdout: '', stderr: `check: could not run: ${A_FAILURE}\n`, exitCode: EXIT_COULD_NOT_RUN })
  })
})

describe('a signal that reaches the run after the command fixed a file', () => {
  it.each([
    { sent: 'SIGINT', exitCode: EXIT_INTERRUPTED },
    { sent: 'SIGTERM', exitCode: EXIT_TERMINATED },
  ] as const)('names the files fixed by then, says the run was interrupted, not that it could not run, and exits $exitCode on $sent, as the command stops on it', async ({ sent, exitCode }) => {
    command.checkIn.mockImplementation(async (_cwd, signal, ifStopped) => {
      ifStopped.update(autofixedLineOf(FIXED_FIRST))
      signalTheRun(sent)
      signal.throwIfAborted()
      return FINDINGS_LEFT
    })

    expect(await checkRun()).toStrictEqual({ stdout: autofixedLineOf(FIXED_FIRST), stderr: CHECK_INTERRUPTED, exitCode })
  })
})

describe('a second signal', () => {
  it.each([
    { first: 'SIGINT', second: 'SIGTERM', exitCode: EXIT_INTERRUPTED },
    { first: 'SIGTERM', second: 'SIGINT', exitCode: EXIT_TERMINATED },
    { first: 'SIGINT', second: 'SIGINT', exitCode: EXIT_INTERRUPTED },
  ] as const)("exits at once with $exitCode, the first signal's code, having removed the run's leftovers: $first, then $second", async ({ first, second, exitCode }) => {
    const leftover = aLeftoverOfTheRun()
    const exits = exitsAskedFor(leftover)
    command.checkIn.mockImplementation(async () => {
      signalTheRun(first)
      signalTheRun(second)
      return FINDINGS_LEFT
    })

    await checkRun()

    expect(exits.mock.calls).toStrictEqual([[{ code: exitCode, hasLeftoverOnDisk: false }]])
  })

  it('is what ends a run at once: one signal leaves the run to end with the command, beside those', async () => {
    const exits = exitsAskedFor(aLeftoverOfTheRun())
    command.checkIn.mockImplementation(async () => {
      signalTheRun('SIGINT')
      return FINDINGS_LEFT
    })

    expect({ run: await checkRun(), exits: exits.mock.calls }).toStrictEqual({ run: { stdout: '', stderr: CHECK_INTERRUPTED, exitCode: EXIT_INTERRUPTED }, exits: [] })
  })
})
