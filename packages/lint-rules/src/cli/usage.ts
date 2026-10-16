// The command line `agents-inc-lint` accepts (q-c16), and its Node floor (#59). The bin entry
// imports this before it knows the Node is new enough, so it imports nothing.

/** A call the bin runs: the command alone, with no flag or argument after it. */
export type Command = 'check' | 'init'

export const USAGE = `usage: agents-inc-lint <command>
  init   add @agents-inc/lint-rules and agents-inc.lint.mts to the package in this folder
  check  lint the JS and TS lines changed since the last commit
`

const COMMANDS: readonly Command[] = ['check', 'init']
// Owner, #59: the oldest Node any rule needs, as engines in package.json gives it.
const NODE_FLOOR = { major: 22, minor: 18 }
const VERSION_PARTS = /^(?<major>\d+)\.(?<minor>\d+)\./u

/** The command the arguments make, or null for any other call, `--help` included. */
export function commandOf(args: readonly string[]): Command | null {
  const [first, ...rest] = args
  if (rest.length > 0) return null
  return COMMANDS.find((command) => command === first) ?? null
}

/** Whether the Node version (`process.versions.node`) is older than the floor. */
export function isBelowTheNodeFloor(version: string): boolean {
  const groups = VERSION_PARTS.exec(version)?.groups
  if (groups === undefined) return true
  const major = Number(groups['major'])
  if (major !== NODE_FLOOR.major) return major < NODE_FLOOR.major
  return Number(groups['minor']) < NODE_FLOOR.minor
}

/** Why the command could not run on this Node, on stderr. */
export function belowTheNodeFloorLine(command: Command, version: string): string {
  return `${command}: could not run: Node ${String(NODE_FLOOR.major)}.${String(NODE_FLOOR.minor)} or later is needed; this is Node ${version}.\n`
}
