import { messageOf } from './caught-errors.ts'
import { removeLeftovers } from './check/leftovers.ts'
import { checkIn } from './check/run-check.ts'
import { couldNotRun as checkCouldNotRun, INTERRUPTED as CHECK_INTERRUPTED } from './check/texts.ts'
import { EXIT_COULD_NOT_RUN, EXIT_INTERRUPTED, EXIT_TERMINATED } from './exit-codes.ts'
import { initIn } from './init/run-init.ts'
import { couldNotRun as initCouldNotRun, INTERRUPTED as INIT_INTERRUPTED } from './init/texts.ts'
import { type Outcome, stdoutIfStopped } from './outcome.ts'
import { textOfLines } from './printed-lines.ts'
import type { Command } from './usage.ts'

type Interruption = { readonly signal: AbortSignal; readonly exitCode: () => number }

const EXIT_CODE_OF_SIGNAL = { SIGINT: EXIT_INTERRUPTED, SIGTERM: EXIT_TERMINATED } as const
const SIGNALS = ['SIGINT', 'SIGTERM'] as const

const COULD_NOT_RUN_LINE = { check: checkCouldNotRun, init: initCouldNotRun } as const
const INTERRUPTED_LINE = { check: CHECK_INTERRUPTED, init: INIT_INTERRUPTED } as const
const EXPERIMENTAL_WARNING = 'ExperimentalWarning'
const TYPE_STRIPPING = /^Type Stripping /u

/**
 * Runs the command from the current folder and exits as it says (q-c2). Any error is a run that
 * could not finish: exit 2, never 0. A first SIGINT or SIGTERM lets the command stop what it was
 * doing and exit 130 or 143; a second exits at once. A command a signal or a failure stops prints
 * to stdout what it changed before it stopped.
 */
export async function runCommand(command: Command): Promise<void> {
  printWarningsButTypeStripping()
  const interruption = interruptionOnSignals()
  const outcome = await outcomeOf(command, interruption)
  process.stdout.write(outcome.stdout)
  process.stderr.write(outcome.stderr)
  process.exitCode = outcome.exitCode
}

async function outcomeOf(command: Command, { signal, exitCode }: Interruption): Promise<Outcome> {
  const cwd = process.cwd()
  const ifStopped = stdoutIfStopped()
  try {
    const outcome = command === 'check' ? await checkIn(cwd, signal, ifStopped) : initIn(cwd, signal)
    if (!signal.aborted) return outcome
  } catch (error) {
    if (!signal.aborted) return couldNotRunOutcome(command, error, ifStopped.current())
  }
  return interruptedOutcome(command, exitCode(), ifStopped.current())
}

function interruptedOutcome(command: Command, exitCode: number, stdout: string): Outcome {
  return { stdout, stderr: textOfLines([INTERRUPTED_LINE[command]]), exitCode }
}

function couldNotRunOutcome(command: Command, error: unknown, stdout: string): Outcome {
  return { stdout, stderr: textOfLines([COULD_NOT_RUN_LINE[command](messageOf(error))]), exitCode: EXIT_COULD_NOT_RUN }
}

/** Aborts on the first SIGINT or SIGTERM; on a second, removes what check left and exits at once. */
function interruptionOnSignals(): Interruption {
  const controller = new AbortController()
  let firstSignal: (typeof SIGNALS)[number] | null = null
  SIGNALS.forEach((name) =>
    process.on(name, () => {
      if (firstSignal !== null) {
        removeLeftovers()
        process.exit(EXIT_CODE_OF_SIGNAL[firstSignal])
      }
      firstSignal = name
      controller.abort()
    }),
  )
  return {
    signal: controller.signal,
    exitCode: () => {
      if (firstSignal === null) throw new Error('the run was aborted with no signal received')
      return EXIT_CODE_OF_SIGNAL[firstSignal]
    },
  }
}

/**
 * Node 23 warns, on stderr, that type stripping is experimental when check imports
 * agents-inc.lint.mts (measured, 23.10; 22.23 does not). Agents read stderr, so check prints every
 * warning but that one, as the first line of Node's own form.
 */
function printWarningsButTypeStripping(): void {
  process.removeAllListeners('warning')
  process.on('warning', (warning) => {
    if (!isTypeStrippingWarning(warning)) process.stderr.write(nodeWarningText(warning))
  })
}

function isTypeStrippingWarning({ name, message }: Error): boolean {
  return name === EXPERIMENTAL_WARNING && TYPE_STRIPPING.test(message)
}

/** The first line Node itself prints for a warning. */
function nodeWarningText({ name, message }: Error): string {
  return textOfLines([`(node:${String(process.pid)}) ${name}: ${message}`])
}
