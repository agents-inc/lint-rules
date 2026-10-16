// Loaded by vitest.mutation.config.ts alone. The integration tests run the real ESLint and oxlint
// CLIs in child processes, which load the instrumented `dist/` Stryker's buildCommand built, but
// Stryker's vitest runner tells only the test worker which mutant is active and reads coverage only
// from it. This file:
// - In a mutant run, hands the active mutant to every child through __STRYKER_ACTIVE_MUTANT__,
//   which the instrumented code reads when its own global names no mutant.
// - In the initial run, has each child write the mutants it covered (child-coverage-hook.mjs), and
//   credits them to the test that spawned it, or, for a child a hook spawned, to every test of the
//   file. Mutants the file's own beforeAll and afterAll hooks cover in this process go to every test
//   of the file too: left as "static" coverage, `ignoreStatic` would skip them.
// - Gives Stryker's copy of the repo a `.git` folder, as the repo has. oxlint honours .gitignore
//   up to the nearest folder holding `.git`; without one, it reads the repo's own .gitignore, which
//   ignores the folder the copy sits in, and finds no file to lint (`oxlint --rules` exits 1).
// Stryker puts its own setup file first, so these before-hooks run after Stryker's and these
// after-hooks before Stryker's.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, inject } from 'vitest'

type Coverage = Record<string, number>
type MutantCoverage = { static: Coverage; perTest: Record<string, Coverage> }
type StrykerNamespace = { activeMutant?: string; currentTestId?: string; mutantCoverage?: MutantCoverage }

declare global {
  // Shared by Stryker's setup file and the instrumented code.
  var __stryker__: StrykerNamespace | undefined
}

declare module 'vitest' {
  interface ProvidedContext {
    // Provided by Stryker's vitest runner before each run.
    mode: 'dry-run' | 'mutant'
  }
}

const ACTIVE_MUTANT_ENV = '__STRYKER_ACTIVE_MUTANT__'
const CHILD_COVERAGE_DIR_ENV = 'STRYKER_CHILD_COVERAGE_DIR'
const CHILD_COVERAGE_DIR_PREFIX = 'stryker-child-coverage-'
const CHILD_COVERAGE_HOOK = new URL('./child-coverage-hook.mjs', import.meta.url).href
const GIT_FOLDER_OF_THE_REPO_COPY = new URL('../../../.git', import.meta.url)

function strykerNamespace(): StrykerNamespace {
  const namespace = globalThis.__stryker__
  if (namespace === undefined) throw new Error("Stryker's setup file has not run: load vitest.mutation.config.ts through Stryker only")
  return namespace
}

function handActiveMutantToChildren(): void {
  const { activeMutant } = strykerNamespace()
  if (activeMutant === undefined) delete process.env[ACTIVE_MUTANT_ENV]
  else process.env[ACTIVE_MUTANT_ENV] = activeMutant
}

function addCoverage(target: Coverage, from: Coverage): void {
  Object.entries(from).forEach(([mutantId, hits]) => {
    target[mutantId] = (target[mutantId] ?? 0) + hits
  })
}

function removeCoverage(target: Coverage, removed: Coverage): void {
  Object.entries(removed).forEach(([mutantId, hits]) => {
    const left = (target[mutantId] ?? 0) - hits
    if (left > 0) target[mutantId] = left
    else delete target[mutantId]
  })
}

function coverageGainedSince(before: Coverage, after: Coverage): Coverage {
  return Object.fromEntries(
    Object.entries(after)
      .map(([mutantId, hits]): [string, number] => [mutantId, hits - (before[mutantId] ?? 0)])
      .filter(([, gained]) => gained > 0),
  )
}

function everyMutantCoveredIn(childCoverage: MutantCoverage): Coverage {
  const covered: Coverage = {}
  const coverages = [childCoverage.static, ...Object.values(childCoverage.perTest)]
  coverages.forEach((coverage) => addCoverage(covered, coverage))
  return covered
}

// The worker holds no coverage until the instrumented code's first hit creates it.
function workerCoverage(): MutantCoverage {
  const namespace = strykerNamespace()
  namespace.mutantCoverage ??= { static: {}, perTest: {} }
  return namespace.mutantCoverage
}

function creditToTest(testId: string, covered: Coverage): void {
  const { perTest } = workerCoverage()
  addCoverage((perTest[testId] ??= {}), covered)
}

function creditChildCoverageToTests(): void {
  const childCoverageDir = mkdtempSync(join(tmpdir(), CHILD_COVERAGE_DIR_PREFIX))
  const filesCredited = new Set<string>()
  const testsRun = new Set<string>()
  const coveredByHooks: Coverage = {}
  let staticBeforeHooks: Coverage = {}

  process.env[CHILD_COVERAGE_DIR_ENV] = childCoverageDir
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--import=${CHILD_COVERAGE_HOOK}`]
    .filter((option) => option !== undefined && option !== '')
    .join(' ')

  function coverageOfChildrenSinceLastRead(): Coverage {
    const covered: Coverage = {}
    readdirSync(childCoverageDir)
      .filter((file) => !filesCredited.has(file))
      .forEach((file) => {
        filesCredited.add(file)
        // Parse boundary: what child-coverage-hook.mjs wrote.
        const childCoverage = JSON.parse(readFileSync(join(childCoverageDir, file), 'utf8')) as MutantCoverage
        addCoverage(covered, everyMutantCoveredIn(childCoverage))
      })
    return covered
  }

  function testNamedByStryker(): string {
    const { currentTestId } = strykerNamespace()
    if (currentTestId === undefined) throw new Error("Stryker's beforeEach named no test: its setup file must run before this one")
    return currentTestId
  }

  beforeAll(() => {
    staticBeforeHooks = { ...workerCoverage().static }
  })

  beforeEach(() => addCoverage(coveredByHooks, coverageOfChildrenSinceLastRead()))

  afterEach(() => {
    const testId = testNamedByStryker()
    testsRun.add(testId)
    creditToTest(testId, coverageOfChildrenSinceLastRead())
  })

  afterAll(() => {
    addCoverage(coveredByHooks, coverageOfChildrenSinceLastRead())
    rmSync(childCoverageDir, { recursive: true, force: true })
    const { static: staticCoverage } = workerCoverage()
    const coveredInProcessByHooks = coverageGainedSince(staticBeforeHooks, staticCoverage)
    removeCoverage(staticCoverage, coveredInProcessByHooks)
    addCoverage(coveredByHooks, coveredInProcessByHooks)
    testsRun.forEach((testId) => creditToTest(testId, coveredByHooks))
  })
}

mkdirSync(GIT_FOLDER_OF_THE_REPO_COPY, { recursive: true })
handActiveMutantToChildren()
beforeAll(handActiveMutantToChildren)
if (inject('mode') === 'dry-run') creditChildCoverageToTests()
