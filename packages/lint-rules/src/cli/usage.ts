// Imported before the Node floor check, so it imports only command-lines.ts.

import { type Command, couldNotRunLine } from './command-lines.ts'

export const USAGE = `usage: agents-inc-lint <command>
  init   add @agents-inc/lint-rules and agents-inc.lint.mts to the package in this folder
  check  lint the JS, TS, Vue, Svelte and Astro lines changed since the last commit
`

const COMMANDS: readonly Command[] = ['check', 'init']
// The oldest Node any rule needs, as `engines` in package.json gives it.
const NODE_FLOOR = { major: 22, minor: 18 }
const VERSION_PARTS = /^(?<major>\d+)\.(?<minor>\d+)\./u

/** Null for any other call, `--help` included. */
export function commandOf(args: readonly string[]): Command | null {
  const [first, ...rest] = args
  if (rest.length > 0) return null
  return COMMANDS.find((command) => command === first) ?? null
}

export function isBelowTheNodeFloor(version: string): boolean {
  const groups = VERSION_PARTS.exec(version)?.groups
  if (groups === undefined) return true
  const major = Number(groups['major'])
  if (major !== NODE_FLOOR.major) return major < NODE_FLOOR.major
  return Number(groups['minor']) < NODE_FLOOR.minor
}

export function belowTheNodeFloorLine(command: Command, version: string): string {
  const reason = `Node ${String(NODE_FLOOR.major)}.${String(NODE_FLOOR.minor)} or later is needed; this is Node ${version}.`
  return `${couldNotRunLine(command, reason)}\n`
}
