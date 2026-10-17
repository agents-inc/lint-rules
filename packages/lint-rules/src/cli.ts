#!/usr/bin/env node
// Static imports stay dependency-free: one an old Node lacks would fail at link time, before the
// Node floor check runs.

import { EXIT_COULD_NOT_RUN } from './cli/exit-codes.ts'
import { belowTheNodeFloorLine, commandOf, isBelowTheNodeFloor, USAGE } from './cli/usage.ts'

const command = commandOf(process.argv.slice(2))

if (command === null) {
  process.stderr.write(USAGE)
  process.exitCode = EXIT_COULD_NOT_RUN
} else if (isBelowTheNodeFloor(process.versions.node)) {
  process.stderr.write(belowTheNodeFloorLine(command, process.versions.node))
  process.exitCode = EXIT_COULD_NOT_RUN
} else {
  const { runCommand } = await import('./cli/main.ts')
  await runCommand(command)
}
