// Imported before the Node floor check, so it imports nothing.

export const COMMANDS = ['check', 'init'] as const

export type Command = (typeof COMMANDS)[number]

export function couldNotRunLine(command: Command, reason: string): string {
  return `${command}: could not run: ${reason}`
}

export function interruptedLine(command: Command): string {
  return `${command}: interrupted`
}

/** A note on stderr, which leaves the exit code as it is. */
export function noteLine(command: Command, note: string): string {
  return `${command}: note: ${note}`
}
