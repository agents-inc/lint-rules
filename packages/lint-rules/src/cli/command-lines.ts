// The lines any command prints under its own name. The bin entry imports this, through usage.ts,
// before it knows the Node is new enough, so it imports nothing.

/** A call the bin runs: the command alone, with no flag or argument after it. */
export type Command = 'check' | 'init'

/** Why the command could not run, on stderr: its exit code is EXIT_COULD_NOT_RUN. */
export function couldNotRunLine(command: Command, reason: string): string {
  return `${command}: could not run: ${reason}`
}

/** What the command prints, on stderr, where a signal stopped it. */
export function interruptedLine(command: Command): string {
  return `${command}: interrupted`
}

/** A note on stderr, which leaves the exit code as it is. */
export function noteLine(command: Command, note: string): string {
  return `${command}: note: ${note}`
}
