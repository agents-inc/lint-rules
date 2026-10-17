import { describe, expect, it } from 'vitest'
import { EXIT } from '../__tests__/cli-runs.ts'
import { EXIT_CLEAN, EXIT_COULD_NOT_RUN, EXIT_FINDINGS, EXIT_INTERRUPTED, EXIT_TERMINATED } from './exit-codes.ts'

// The numbers are a contract, so they are pinned.
describe('the exit codes check and init share', () => {
  it('are 0, 1, 2, 130 and 143, as the owner chose', () => {
    expect({
      clean: EXIT_CLEAN,
      findings: EXIT_FINDINGS,
      couldNotRun: EXIT_COULD_NOT_RUN,
      interrupted: EXIT_INTERRUPTED,
      terminated: EXIT_TERMINATED,
    }).toStrictEqual(EXIT)
  })
})
