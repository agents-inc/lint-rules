export type Outcome = { readonly stdout: string; readonly stderr: string; readonly exitCode: number }

/** What stdout says if the command is stopped now: the files it changed, which the agent must act on. */
export type StdoutIfStopped = { readonly current: () => string; readonly update: (stdout: string) => void }

export function stdoutIfStopped(): StdoutIfStopped {
  let stdout = ''
  return {
    current: () => stdout,
    update: (updated) => {
      stdout = updated
    },
  }
}
