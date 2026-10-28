#!/usr/bin/env node
// Static imports stay dependency-free: one an old Node lacks would fail at link time, before the
// Node floor check runs.

import { EXIT_COULD_NOT_RUN } from './cli/exit-codes.ts'
import { endTheRunWith, type Outcome } from './cli/outcome.ts'
import { belowTheNodeFloorLine, commandOf, isBelowTheNodeFloor, USAGE } from './cli/usage.ts'

const command = commandOf(process.argv.slice(2))

if (command === null) {
  endTheRunWith(couldNotRunWith(USAGE))
} else if (isBelowTheNodeFloor(process.versions.node)) {
  endTheRunWith(couldNotRunWith(belowTheNodeFloorLine(command, process.versions.node)))
} else {
  const { runCommand } = await import('./cli/main.ts')
  await runCommand(command)
}

function couldNotRunWith(stderr: string): Outcome {
  return { stdout: '', stderr, exitCode: EXIT_COULD_NOT_RUN }
}
