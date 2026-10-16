#!/usr/bin/env node
// The `agents-inc-lint` bin. It must reach its Node floor check on any Node: a static import of
// something an old Node lacks (`findPackageJSON` from node:module, say) fails at link time, before
// any line runs. So it imports only modules that import nothing but each other, and the rest once
// the floor holds.

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
