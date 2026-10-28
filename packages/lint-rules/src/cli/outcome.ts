export type Outcome = { readonly stdout: string; readonly stderr: string; readonly exitCode: number }

/** What stdout says if the command is stopped now: the files it changed, which the agent must act on. */
export type StdoutIfStopped = {
  readonly current: () => string
  // eslint-disable-next-line functional/no-return-void -- the command reports each file it fixes here as it goes, and main reads the last report after the command threw: a value update returned would be lost with the throw
  readonly update: (stdout: string) => void
}

/** The process edge: the one place the CLI writes stdout and stderr and sets its exit code. It imports nothing, so cli.ts can call it before the Node floor check. */
// eslint-disable-next-line functional/no-return-void -- what the CLI says reaches its caller on stdout, stderr and the exit code alone: a value it returned would reach no one
export function endTheRunWith({ stdout, stderr, exitCode }: Outcome): void {
  // eslint-disable-next-line functional/no-expression-statements -- write returns whether Node buffered the text, and the process waits for a buffered write before it ends either way
  process.stdout.write(stdout)
  // eslint-disable-next-line functional/no-expression-statements -- as on the write above
  process.stderr.write(stderr)
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the exit code reaches the caller through process.exitCode alone; process.exit would end the process before a buffered write above
  process.exitCode = exitCode
}

export function stdoutIfStopped(): StdoutIfStopped {
  // eslint-disable-next-line functional/no-let -- TS2588 as a const: update replaces it, and main reads it after the command threw, where no value the command returned exists
  let stdout = ''
  return {
    current() {
      return stdout
    },
    // eslint-disable-next-line functional/no-return-void, functional/no-expression-statements -- TS2588, as on the let above
    update(updated) { stdout = updated },
  }
}
