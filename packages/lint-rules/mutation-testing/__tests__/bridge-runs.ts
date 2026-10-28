import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { installedPackage, type TempProjects } from '../../src/__tests__/temp-projects.ts'
import { runVitestCli, type TestFileOutcome } from '../../src/__tests__/vitest-cli.ts'
import { sandboxVitestConfig, type StrykerProvided, type TestsNamed } from './factories/bridge-sandbox-factories.ts'

type Coverage = Readonly<Record<string, number>>

/** Stryker's coverage after a dry run: what ran outside every test, and what each test covered, by the test's name. */
type MutantCoverage = { readonly static: Coverage; readonly perTest: Readonly<Record<string, Coverage>> }

/** What a child found as it ran: the mutant on in it, null where none was, and whether the run's own NODE_OPTIONS reached it. */
export type ChildSaw = { readonly activeMutant: string | null; readonly hasTheRunsNodeOptions: boolean }

/** Whether the stand-in for Stryker's setup file loads before the bridge, and whether, in a dry run, it names each test. */
type StrykerSetup = 'loaded first' | 'loaded first, naming no test' | 'not loaded'

/** The test file a run collects: one covering code in its own process and in children, one covering code in children only, or one leaving a child coverage file that is not a coverage map: its count in text in the static map or in a test's, null, its static map a list, or its per-test maps a number. */
type SandboxTestFile =
  | 'children-spawned.fixture.mjs'
  | 'children-only.fixture.mjs'
  | 'no-coverage-map.fixture.mjs'
  | 'per-test-counts-as-text.fixture.mjs'
  | 'null-coverage-file.fixture.mjs'
  | 'static-counts-in-a-list.fixture.mjs'
  | 'per-test-maps-a-number.fixture.mjs'

/** What a run is given: its test file, what Stryker provides, how its setup file loads, and the environment the run's worker starts with. */
export type BridgeRunGiven = {
  readonly testFile: SandboxTestFile
  readonly provided: StrykerProvided
  readonly strykerSetup: StrykerSetup
  readonly env: Readonly<Record<string, string>>
}

/** How the run's test file ended, the coverage Stryker would read, what each child saw, and what the run left. */
type BridgeRun = {
  readonly files: readonly TestFileOutcome[]
  /** As the Stryker stand-in read it once every other after-hook had run; null where it wrote none. */
  readonly coverage: MutantCoverage | null
  /** By the label each child was spawned with. */
  readonly children: Readonly<Record<string, ChildSaw>>
  readonly hasGitFolderBefore: boolean
  readonly hasGitFolderAfter: boolean
  /** In the temp dir the run and every process it starts are given. */
  readonly leftInTempDir: readonly string[]
}

// Where the bridge sits in the copy of the repo Stryker runs in, so the .git folder it makes lands at the copy's root.
const BRIDGE_IN_THE_COPY = 'packages/lint-rules/mutation-testing/child-process-bridge.ts'
const BRIDGE = `./${BRIDGE_IN_THE_COPY}`
const STRYKER_SETUP_STAND_IN = './stryker-setup-stand-in.mjs'
// The bridge and its hook as they stand, beside the stand-ins for what Stryker loads around them and the test file.
const SANDBOX_FILES = {
  [BRIDGE_IN_THE_COPY]: new URL('../child-process-bridge.ts', import.meta.url),
  'packages/lint-rules/mutation-testing/child-coverage-hook.mjs': new URL('../child-coverage-hook.mjs', import.meta.url),
  [STRYKER_SETUP_STAND_IN]: new URL('./bridge-sandbox/stryker-setup-stand-in.mjs', import.meta.url),
  'instrumented-module-stand-in.mjs': new URL('./bridge-sandbox/instrumented-module-stand-in.mjs', import.meta.url),
  'child-loading-instrumented-code.mjs': new URL('./bridge-sandbox/child-loading-instrumented-code.mjs', import.meta.url),
  'child-writing-no-coverage-map.mjs': new URL('./bridge-sandbox/child-writing-no-coverage-map.mjs', import.meta.url),
  'spawn-children.mjs': new URL('./bridge-sandbox/spawn-children.mjs', import.meta.url),
  'children-spawned.fixture.mjs': new URL('./bridge-sandbox/children-spawned.fixture.mjs', import.meta.url),
  'children-only.fixture.mjs': new URL('./bridge-sandbox/children-only.fixture.mjs', import.meta.url),
  'no-coverage-map.fixture.mjs': new URL('./bridge-sandbox/no-coverage-map.fixture.mjs', import.meta.url),
  'per-test-counts-as-text.fixture.mjs': new URL('./bridge-sandbox/per-test-counts-as-text.fixture.mjs', import.meta.url),
  'null-coverage-file.fixture.mjs': new URL('./bridge-sandbox/null-coverage-file.fixture.mjs', import.meta.url),
  'static-counts-in-a-list.fixture.mjs': new URL('./bridge-sandbox/static-counts-in-a-list.fixture.mjs', import.meta.url),
  'per-test-maps-a-number.fixture.mjs': new URL('./bridge-sandbox/per-test-maps-a-number.fixture.mjs', import.meta.url),
}
const CONFIG = 'vitest.config.mjs'
const REPORT = 'vitest-report.json'
// Written by the stand-ins, under the same names there.
const FINAL_COVERAGE = 'final-coverage.json'
const RECORDS_DIR = 'records'
const RECORD_EXTENSION = '.json'
const GIT_FOLDER = '.git'
const NO_COVERAGE = null

/** Copies the bridge into a scratch copy of the repo and runs the test file there, under vitest's CLI. */
export function runTheBridge(tempProjects: TempProjects, { testFile, provided, strykerSetup, env }: BridgeRunGiven): BridgeRun {
  const config = sandboxVitestConfig({ include: [testFile], provided, env, ...setupFilesLoadedFor(strykerSetup) })
  const sandbox = tempProjects.create({ files: { ...sandboxFileTexts(), [CONFIG]: config }, linkedPackages: [installedPackage('vitest')] })
  const hasGitFolderBefore = existsSync(join(sandbox, GIT_FOLDER))
  const tempDir = tempProjects.create({})
  const files = runVitestCli({ configFile: join(sandbox, CONFIG), args: [], tempDir, reportFile: join(sandbox, REPORT) })
  return {
    files,
    coverage: coverageIn(join(sandbox, FINAL_COVERAGE)),
    children: childrenRecordedIn(join(sandbox, RECORDS_DIR)),
    hasGitFolderBefore,
    hasGitFolderAfter: existsSync(join(sandbox, GIT_FOLDER)),
    leftInTempDir: readdirSync(tempDir),
  }
}

function setupFilesLoadedFor(strykerSetup: StrykerSetup): { readonly setupFiles: readonly string[]; readonly testsNamed: TestsNamed } {
  switch (strykerSetup) {
    case 'loaded first': {
      return { setupFiles: [STRYKER_SETUP_STAND_IN, BRIDGE], testsNamed: 'each' }
    }
    case 'loaded first, naming no test': {
      return { setupFiles: [STRYKER_SETUP_STAND_IN, BRIDGE], testsNamed: 'none' }
    }
    case 'not loaded': {
      return { setupFiles: [BRIDGE], testsNamed: 'each' }
    }
    default: {
      const unhandled: never = strykerSetup
      return unhandled
    }
  }
}

function sandboxFileTexts(): Record<string, string> {
  return Object.fromEntries(Object.entries(SANDBOX_FILES).map(([file, url]) => [file, readFileSync(url, 'utf8')]))
}

function coverageIn(file: string): MutantCoverage | null {
  // Parse boundary: what stryker-setup-stand-in.mjs wrote.
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as MutantCoverage | null) : NO_COVERAGE
}

/** None where no child recorded what it saw. */
function childrenRecordedIn(dir: string): Record<string, ChildSaw> {
  const records = existsSync(dir) ? readdirSync(dir) : []
  // Parse boundary: what child-loading-instrumented-code.mjs wrote.
  return Object.fromEntries(records.map((record) => [basename(record, RECORD_EXTENSION), JSON.parse(readFileSync(join(dir, record), 'utf8')) as ChildSaw]))
}
