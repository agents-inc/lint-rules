/** What Stryker's vitest runner provides a run: a dry run, or a mutant run turning its mutant on as files load (static) or before the tests (runtime). */
export type StrykerProvided =
  | { readonly mode: 'dry-run' }
  | { readonly mode: 'mutant'; readonly mutantActivation: 'static' | 'runtime'; readonly activeMutant: string }

/** In a dry run, whether the stand-in for Stryker's setup file names each test while it runs, as Stryker's does, or none. */
export type TestsNamed = 'each' | 'none'

/** The test files a run collects, the setup files loaded before each in order, what is provided them, and the environment the run's worker starts with. */
type SandboxVitestConfig = {
  readonly include: readonly string[]
  readonly setupFiles: readonly string[]
  readonly provided: StrykerProvided
  readonly testsNamed: TestsNamed
  readonly env: Readonly<Record<string, string>>
}

/** A vitest config module, running its tests in one worker thread, as Stryker's vitest runner does. */
export function sandboxVitestConfig({ include, setupFiles, provided, testsNamed, env }: SandboxVitestConfig): string {
  const test = { include, setupFiles, provide: { ...provided, testsNamed }, env, pool: 'threads', maxWorkers: 1 }
  return `export default ${JSON.stringify({ test })}\n`
}
