// Integration tests run ESLint and oxlint in child processes on the instrumented `dist/`, but Stryker
// tells only the test worker the active mutant and reads coverage only from it. This file:
// - in a mutant run, passes the active mutant to each child through __STRYKER_ACTIVE_MUTANT__;
// - in the initial run, credits each child's coverage (child-coverage-hook.mjs) to the test that
//   spawned it, or to every test of the file for a hook's child. The file's own beforeAll/afterAll
//   coverage goes to every test too, which `ignoreStatic` would otherwise skip;
// - gives Stryker's copy a `.git` folder: without one, oxlint reads the repo's .gitignore, which
//   ignores the copy, and finds no file to lint.
// Stryker's setup file runs first: these before-hooks run after its own, these after-hooks before.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, inject } from 'vitest'

type Coverage = Record<string, number>
type MutantCoverage = { static: Coverage; perTest: Record<string, Coverage> }
type StrykerNamespace = { activeMutant?: string; currentTestId?: string; mutantCoverage?: MutantCoverage }

declare global {
  var __stryker__: StrykerNamespace | undefined
}

declare module 'vitest' {
  interface ProvidedContext {
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

/** What the file's own hooks covered in the worker since `before`, moved out of its static coverage. */
function staticCoverageTakenSince(before: Coverage): Coverage {
  const { static: staticCoverage } = workerCoverage()
  const coveredInProcessByHooks = coverageGainedSince(before, staticCoverage)
  removeCoverage(staticCoverage, coveredInProcessByHooks)
  return coveredInProcessByHooks
}

function withTheChildCoverageHook(nodeOptions: string | undefined): string {
  return [nodeOptions, `--import=${CHILD_COVERAGE_HOOK}`].filter((option) => option !== undefined && option !== '').join(' ')
}

function creditChildCoverageToTests(): void {
  const childCoverageDir = mkdtempSync(join(tmpdir(), CHILD_COVERAGE_DIR_PREFIX))
  const filesCredited = new Set<string>()
  const testsRun = new Set<string>()
  const coveredByHooks: Coverage = {}
  let staticBeforeHooks: Coverage = {}

  process.env[CHILD_COVERAGE_DIR_ENV] = childCoverageDir
  process.env.NODE_OPTIONS = withTheChildCoverageHook(process.env.NODE_OPTIONS)

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
    addCoverage(coveredByHooks, staticCoverageTakenSince(staticBeforeHooks))
    testsRun.forEach((testId) => creditToTest(testId, coveredByHooks))
  })
}

mkdirSync(GIT_FOLDER_OF_THE_REPO_COPY, { recursive: true })
handActiveMutantToChildren()
beforeAll(handActiveMutantToChildren)
if (inject('mode') === 'dry-run') creditChildCoverageToTests()
