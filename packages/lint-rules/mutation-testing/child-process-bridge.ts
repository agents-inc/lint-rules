// Integration tests run ESLint and oxlint in child processes on the instrumented `dist/`, but Stryker
// tells only the test worker the active mutant and reads coverage only from it. This file:
// - in a mutant run, passes the active mutant to each child through __STRYKER_ACTIVE_MUTANT__;
// - in the initial run, credits each child's coverage (child-coverage-hook.mjs) to the test that
//   spawned it, or to every test of the file for a hook's child. The file's own beforeAll/afterAll
//   coverage goes to every test too, which `ignoreStatic` would otherwise skip;
// - gives Stryker's copy a `.git` folder: without one, oxlint reads the repo's .gitignore, which
//   ignores the copy, and finds no file to lint.
// Stryker's setup file runs first: these before-hooks run after its own, these after-hooks before.
// It works only by what it writes: Stryker reads coverage from its namespace alone, a child reads its
// environment alone, and vitest hands nothing a hook returns to another hook. Stryker's instrumented code holds
// the namespace's coverage object and looks each map up in it on every hit, so the bridge writes into that object
// and never replaces it. It imports nothing of the repo's: bridge-runs.ts runs it alone in a scratch copy.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, inject } from 'vitest'

type HitCounts = Record<string, number>
type Coverage = Readonly<HitCounts>
type MutantCoverage = { readonly static: HitCounts; readonly perTest: Record<string, HitCounts> }
type StrykerNamespace = { activeMutant?: string; currentTestId?: string; mutantCoverage?: MutantCoverage }

declare global {
  // eslint-disable-next-line sonarjs/variable-name -- Stryker's name for its namespace (INSTRUMENTER_CONSTANTS.NAMESPACE, @stryker-mutator/api); declared under another, globalThis.__stryker__ does not compile: TS7017
  var __stryker__: StrykerNamespace | undefined
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- adds `mode` to vitest's own ProvidedContext by declaration merging, which a type alias cannot do: TS2300
  interface ProvidedContext {
    mode: 'dry-run' | 'mutant'
  }
}

const ACTIVE_MUTANT_ENV = '__STRYKER_ACTIVE_MUTANT__'
const CHILD_COVERAGE_DIR_ENV = 'STRYKER_CHILD_COVERAGE_DIR'
const NODE_OPTIONS_ENV = 'NODE_OPTIONS'
const CHILD_COVERAGE_DIR_PREFIX = 'stryker-child-coverage-'
const CHILD_COVERAGE_HOOK = new URL('./child-coverage-hook.mjs', import.meta.url).href
const GIT_FOLDER_OF_THE_REPO_COPY = new URL('../../../.git', import.meta.url)

// eslint-disable-next-line functional/no-expression-statements -- without a .git folder in Stryker's copy, oxlint reads the repo's .gitignore, which ignores the copy, and finds no file to lint
mkdirSync(GIT_FOLDER_OF_THE_REPO_COPY, { recursive: true })
handActiveMutantToChildren()
beforeAll(handActiveMutantToChildren)
if (inject('mode') === 'dry-run') creditChildCoverageToTests()

// eslint-disable-next-line functional/no-return-void -- it hands the mutant over in the environment, which is all a child inherits: a value it returned would reach no child
function handActiveMutantToChildren(): void {
  handToChildren(ACTIVE_MUTANT_ENV, strykerNamespace().activeMutant)
}

// eslint-disable-next-line functional/no-return-void -- it registers vitest's hooks, whose credits reach Stryker only written to its namespace
function creditChildCoverageToTests(): void {
  const childCoverageDir = folderChildrenWriteTheirCoverageTo()
  const staticBeforeHooks = staticCoverageAsTheSuiteStarts()
  const testsRun = new Set<string>()
  const coveredByHooks: Coverage[] = []

  // eslint-disable-next-line functional/no-return-void -- what the children of the file's hooks covered must reach afterAll, and vitest hands nothing a hook returns to another hook
  beforeEach(() => {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- afterAll credits it to every test, and vitest's hooks share nothing but this closure
    coveredByHooks.push(coverageChildrenWroteSinceLastRead(childCoverageDir))
  })
  // eslint-disable-next-line functional/no-return-void -- the credit reaches Stryker only written to its namespace: vitest reads nothing an afterEach returns
  afterEach(() => {
    const testId = testNamedByStryker()
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- afterAll credits every test that ran, and vitest's hooks share nothing but this closure
    testsRun.add(testId)
    creditToTest(testId, coverageChildrenWroteSinceLastRead(childCoverageDir))
  })
  // eslint-disable-next-line functional/no-return-void -- the credit reaches Stryker only written to its namespace: vitest reads nothing an afterAll returns
  afterAll(() => {
    const coveredByTheFilesHooks = coverageSum([...coveredByHooks, coverageChildrenWroteLast(childCoverageDir), staticCoverageTakenSince(staticBeforeHooks())])
    for (const testId of testsRun) creditToTest(testId, coveredByTheFilesHooks)
  })
}

/** A new folder each child writes its coverage to, handed to the children with the hook that writes it. */
function folderChildrenWriteTheirCoverageTo(): string {
  const childCoverageDir = mkdtempSync(join(tmpdir(), CHILD_COVERAGE_DIR_PREFIX))
  handToChildren(CHILD_COVERAGE_DIR_ENV, childCoverageDir)
  handToChildren(NODE_OPTIONS_ENV, withTheChildCoverageHook(process.env[NODE_OPTIONS_ENV]))
  return childCoverageDir
}

/** The worker's static coverage as the suite starts, before the file's own hooks run: what loading the file covered. */
function staticCoverageAsTheSuiteStarts(): () => Coverage {
  // eslint-disable-next-line functional/no-let -- TS2588: a const cannot be assigned in the beforeAll that takes the snapshot. setUpRunsBeforeTheSuite (src/__tests__/runs-before-the-suite.ts) has this shape but sets up temp projects too, and the bridge imports nothing of the repo's
  let staticBeforeHooks: Coverage = {}
  // eslint-disable-next-line functional/no-return-void -- the snapshot must reach afterAll, and vitest hands nothing a hook returns to another hook
  beforeAll(() => {
    // eslint-disable-next-line functional/no-expression-statements -- TS2588, as on the let above
    staticBeforeHooks = { ...workerCoverage().static }
  })
  return () => staticBeforeHooks
}

// eslint-disable-next-line functional/no-return-void -- it writes the credit where Stryker reads it, its namespace: a credit it returned would reach no one
function creditToTest(testId: string, covered: Coverage): void {
  const { perTest } = workerCoverage()
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- Stryker reads each test's coverage from its namespace alone, and a test that covered nothing in the worker has no map there yet
  perTest[testId] ??= {}
  writeInPlace(perTest[testId], coverageSum([perTest[testId], covered]))
}

/** What the file's own hooks covered in the worker since `before`, moved out of Stryker's static coverage. */
function staticCoverageTakenSince(before: Coverage): Coverage {
  const { static: staticCoverage } = workerCoverage()
  const coveredInProcessByHooks = coverageBeyond(before, staticCoverage)
  writeInPlace(staticCoverage, coverageBeyond(coveredInProcessByHooks, staticCoverage))
  return coveredInProcessByHooks
}

/** Leaves one of Stryker's maps holding exactly the counts given, a mutant it no longer counts left out. */
// eslint-disable-next-line functional/no-return-void, functional/prefer-immutable-types -- the counts reach Stryker only written into its namespace, where its instrumented code looks this map up again on every hit; a Readonly map takes no write: TS2542
function writeInPlace(strykersCounts: HitCounts, counts: Coverage): void {
  for (const mutantId of Object.keys(strykersCounts)) {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, @typescript-eslint/no-dynamic-delete -- in Stryker's map, a plain object, which only delete takes a key out of
    if (!Object.hasOwn(counts, mutantId)) delete strykersCounts[mutantId]
  }
  for (const [mutantId, hits] of Object.entries(counts)) {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- in Stryker's map, which its instrumented code keeps writing to
    strykersCounts[mutantId] = hits
  }
}

/** Stryker's coverage map. The worker holds none until the instrumented code's first hit makes one. */
function workerCoverage(): MutantCoverage {
  const namespace = strykerNamespace()
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- a map made here and not kept in the namespace is one Stryker never reads: a test file whose own process covers nothing would credit no test
  namespace.mutantCoverage ??= { static: {}, perTest: {} }
  return namespace.mutantCoverage
}

function strykerNamespace(): StrykerNamespace {
  const namespace = globalThis.__stryker__
  if (namespace === undefined) throw new Error("Stryker's setup file has not run: load vitest.mutation.config.ts through Stryker only")
  return namespace
}

function testNamedByStryker(): string {
  const { currentTestId } = strykerNamespace()
  if (currentTestId === undefined) throw new Error("Stryker's beforeEach named no test: its setup file must run before this one")
  return currentTestId
}

// eslint-disable-next-line functional/no-return-void -- it writes the environment, which is all a child inherits: a value it returned would reach no child
function handToChildren(variable: string, value: string | undefined): void {
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, @typescript-eslint/no-dynamic-delete -- assigning undefined stores the string "undefined", which a child would read as a mutant id
  if (value === undefined) delete process.env[variable]
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- a child inherits the environment and nothing else of the worker's
  else process.env[variable] = value
}

function withTheChildCoverageHook(nodeOptions: string | undefined): string {
  return [nodeOptions, `--import=${CHILD_COVERAGE_HOOK}`].filter((option) => option !== undefined && option !== '').join(' ')
}

/** What the children wrote since the last read. Each file is removed once read, so no child is credited twice. */
function coverageChildrenWroteSinceLastRead(childCoverageDir: string): Coverage {
  const files = readdirSync(childCoverageDir).map((file) => join(childCoverageDir, file))
  const covered = coverageSum(files.map((file) => everyMutantCoveredIn(coverageWrittenTo(file))))
  for (const file of files) rmSync(file)
  return covered
}

/** What the children wrote since the last read, with the folder they wrote it to removed. */
function coverageChildrenWroteLast(childCoverageDir: string): Coverage {
  const covered = coverageChildrenWroteSinceLastRead(childCoverageDir)
  rmSync(childCoverageDir, { recursive: true, force: true })
  return covered
}

/** Parse boundary: what child-coverage-hook.mjs wrote, Stryker's coverage map in that child. */
function coverageWrittenTo(file: string): MutantCoverage {
  const written: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!isMutantCoverage(written)) throw new Error(`${file} holds no coverage map, as child-coverage-hook.mjs writes`)
  return written
}

function everyMutantCoveredIn(childCoverage: Readonly<MutantCoverage>): Coverage {
  return coverageSum([childCoverage.static, ...Object.values(childCoverage.perTest)])
}

/** Each mutant's hits, added up over the coverages given. */
function coverageSum(coverages: readonly Coverage[]): Coverage {
  const mutantIds = new Set(coverages.flatMap((coverage) => Object.keys(coverage)))
  return Object.fromEntries(mutantIds.values().map((mutantId) => [mutantId, hitsOf(mutantId, coverages)]))
}

function hitsOf(mutantId: string, coverages: readonly Coverage[]): number {
  return coverages.reduce((hits, coverage) => hits + (coverage[mutantId] ?? 0), 0)
}

/** What `coverage` counts beyond `baseline`, mutant by mutant: a mutant it counts no more often than that is left out. */
function coverageBeyond(baseline: Coverage, coverage: Coverage): Coverage {
  return Object.fromEntries(
    Object.entries(coverage)
      .map(([mutantId, hits]): [string, number] => [mutantId, hits - (baseline[mutantId] ?? 0)])
      .filter(([, beyond]) => beyond > 0),
  )
}

function isMutantCoverage(value: unknown): value is MutantCoverage {
  return isRecord(value) && isCoverage(value['static']) && isRecord(value['perTest']) && Object.values(value['perTest']).every((coverage) => isCoverage(coverage))
}

function isCoverage(value: unknown): value is Coverage {
  return isRecord(value) && Object.values(value).every((hits) => typeof hits === 'number')
}

/** As `isRecord` in src/core/is-record.ts, which the bridge does not import. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
