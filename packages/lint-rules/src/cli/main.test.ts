import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHECK_INTERRUPTED } from '../__tests__/factories/check-factories.ts'
import { EXIT_FINDINGS, EXIT_INTERRUPTED } from './exit-codes.ts'
import { runCommand } from './main.ts'
import type { Outcome } from './outcome.ts'

// The stand-in command ends with its own outcome as a signal reaches the run, a timing no signal sent
// from outside can hit; the integration tests send real ones.

const command = vi.hoisted(() => ({ checkIn: vi.fn<() => Promise<Outcome>>() }))

vi.mock('./check/run-check.ts', () => ({ checkIn: command.checkIn }))

const FINDINGS_LEFT: Outcome = { stdout: 'a finding\n', stderr: '', exitCode: EXIT_FINDINGS }

type Signal = 'SIGINT' | 'SIGTERM'

type ProcessListeners = {
  readonly SIGINT: readonly NodeJS.SignalsListener[]
  readonly SIGTERM: readonly NodeJS.SignalsListener[]
  readonly warning: readonly NodeJS.WarningListener[]
}

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

function signalTheRun(signal: Signal): void {
  process
    .listeners(signal)
    .filter((listener) => !listenersBefore[signal].includes(listener))
    .forEach((listener) => {
      listener(signal)
    })
}

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

    expect(await checkRun()).toStrictEqual({ stdout: '', stderr: CHECK_INTERRUPTED, exitCode: EXIT_INTERRUPTED })
  })
})
