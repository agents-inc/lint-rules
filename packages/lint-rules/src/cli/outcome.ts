/** What a command printed to each stream, and how it exits. */
export type Outcome = { readonly stdout: string; readonly stderr: string; readonly exitCode: number }

/**
 * What stdout says if a signal or a failure stops the command now: what it changed before it
 * stopped, which the agent must act on (P2). The command updates it as it changes files.
 */
export type StdoutIfStopped = { readonly current: () => string; readonly update: (stdout: string) => void }

/** Nothing, until the command updates it. */
export function stdoutIfStopped(): StdoutIfStopped {
  let stdout = ''
  return {
    current: () => stdout,
    update: (updated) => {
      stdout = updated
    },
  }
}
