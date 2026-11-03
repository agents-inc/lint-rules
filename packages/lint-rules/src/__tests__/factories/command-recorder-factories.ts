const LINE_FEED = '\n'

/** A shell script printing the name it was run under, then each argument it was given, a line to each. */
export const COMMAND_RECORDER_SCRIPT = `#!/bin/sh
printf '%s\\n' "$(basename "$0")" "$@"
`

/** What COMMAND_RECORDER_SCRIPT prints, run under the command given with the arguments given. */
export function commandRecorded(command: string, args: readonly string[]): string {
  return [command, ...args].map((word) => `${word}${LINE_FEED}`).join('')
}
