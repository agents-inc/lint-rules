import { beforeAll } from 'vitest'
import { setUpTempProjects, type TempProjects } from './temp-projects.ts'

/** How long the runs before a suite may take, and what a test says where they could not be made. */
export type RunsBeforeTheSuiteOptions = { readonly timeoutMs: number; readonly whatFailed: string }

/** The runs made before the suite. A run that threw is kept as its error, so each test reports it as its own failure. */
type RunsBeforeTheSuite<Runs> =
  | { readonly outcome: 'not made' }
  | { readonly outcome: 'completed'; readonly runs: Runs }
  | { readonly outcome: 'failed'; readonly error: unknown }

export type RunOfAKind = { readonly kind: string }

/** Runs of the engines' CLIs, or of the bin, each over one project. */
const ENGINE_RUNS: RunsBeforeTheSuiteOptions = { timeoutMs: 300_000, whatFailed: 'the engines could not be run on the project before the suite' }

/**
* A run that threw throws as each test's own failure, since vitest reports a test whose beforeAll threw as
* skipped. Registers hooks: call it in a describe block.
*/
export function setUpRunsBeforeTheSuite<Runs>(
  make: (tempProjects: TempProjects) => Runs | Promise<Runs>,
  { timeoutMs, whatFailed }: RunsBeforeTheSuiteOptions = ENGINE_RUNS,
): () => Runs {
  const tempProjects = setUpTempProjects()
  let runsBeforeTheSuite: RunsBeforeTheSuite<Runs> = { outcome: 'not made' }

  beforeAll(async () => {
    try {
      runsBeforeTheSuite = { outcome: 'completed', runs: await make(tempProjects) }
    } catch (error) {
      runsBeforeTheSuite = { outcome: 'failed', error }
    }
  }, timeoutMs)

  return () => {
    if (runsBeforeTheSuite.outcome === 'failed') throw new Error(whatFailed, { cause: runsBeforeTheSuite.error })
    if (runsBeforeTheSuite.outcome === 'not made') throw new Error('the runs were read outside the suite that made them')
    return runsBeforeTheSuite.runs
  }
}

/** Throws where none was made. */
export function runMadeFor<Run extends RunOfAKind>(runs: readonly Run[], kind: string): Run {
  const made = runs.find((run) => run.kind === kind)
  if (made === undefined) throw new Error(`no run was made for ${kind}`)
  return made
}
