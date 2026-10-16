import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXIT_FINDINGS, EXIT_INTERRUPTED } from './exit-codes.ts'
import { runCommand } from './main.ts'
import type { Outcome } from './outcome.ts'

// q-c2 (spec-cli.md "Signals and leftovers"): a first SIGINT or SIGTERM lets the command stop what
// it was doing, and the run then says it was interrupted and exits 130 or 143, however the command
// ended. check-second-signal.integration.test.ts and check.integration.test.ts send the bin real
// signals, which stop a command part way; here the command, a stand-in, ends with its own outcome
// though a signal reached the run as it ended, which no signal sent from outside can time.

const command = vi.hoisted(() => ({ checkIn: vi.fn<() => Promise<Outcome>>() }))

vi.mock('./check/run-check.ts', () => ({ checkIn: command.checkIn }))

const FINDINGS_LEFT: Outcome = { stdout: 'a finding\n', stderr: '', exitCode: EXIT_FINDINGS }

type Signal = 'SIGINT' | 'SIGTERM'

/** The listeners the run adds to, and removes, as the test's process had them. */
type ProcessListeners = {
  readonly SIGINT: readonly NodeJS.SignalsListener[]
  readonly SIGTERM: readonly NodeJS.SignalsListener[]
  readonly warning: readonly NodeJS.WarningListener[]
}

/** What the run wrote to a stream, by the calls to its `write`, in order, and the exit code it set. */
type RunWrote = { readonly stdout: string; readonly stderr: string; readonly exitCode: typeof process.exitCode }

const SIGNALS: readonly Signal[] = ['SIGINT', 'SIGTERM']

let listenersBefore = processListeners()
let exitCodeBefore = process.exitCode

beforeEach(() => {
  listenersBefore = processListeners()
  exitCodeBefore = process.exitCode
})

afterEach(() => {
  SIGNALS.forEach((signal) => {
    process.removeAllListeners(signal)
    listenersBefore[signal].forEach((listener) => process.on(signal, listener))
  })
  process.removeAllListeners('warning')
  listenersBefore.warning.forEach((listener) => process.on('warning', listener))
  process.exitCode = exitCodeBefore
  vi.restoreAllMocks()
})

function processListeners(): ProcessListeners {
  return { SIGINT: process.listeners('SIGINT'), SIGTERM: process.listeners('SIGTERM'), warning: process.listeners('warning') }
}

/** Has the listeners the run added for the signal hear it, as Node's own signal handling would call them. */
function signalTheRun(signal: Signal): void {
  process
    .listeners(signal)
    .filter((listener) => !listenersBefore[signal].includes(listener))
    .forEach((listener) => {
      listener(signal)
    })
}

/** Runs check with the stand-in command: what it wrote, and the exit code it set. */
async function checkRun(): Promise<RunWrote> {
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  await runCommand('check')
  return { stdout: stdout.mock.calls.map(([chunk]) => String(chunk)).join(''), stderr: stderr.mock.calls.map(([chunk]) => String(chunk)).join(''), exitCode: process.exitCode }
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

    expect(await checkRun()).toStrictEqual({ stdout: '', stderr: 'check: interrupted\n', exitCode: EXIT_INTERRUPTED })
  })
})
