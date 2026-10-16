// The exit codes `check` and `init` share (owner, q-c2). Imported by the bin entry before its Node
// floor check, so this module imports nothing.

export const EXIT_CLEAN = 0
/** `check`: an error is left after the fixes. `init`: it refused, as the config exists. */
export const EXIT_FINDINGS = 1
export const EXIT_COULD_NOT_RUN = 2
/** 128 + SIGINT's number, as a shell reports a process Ctrl+C ended. */
export const EXIT_INTERRUPTED = 130
/** 128 + SIGTERM's number. */
export const EXIT_TERMINATED = 143
