import { describe, expect, it } from 'vitest'
import { setUpRunsBeforeTheSuite } from '../src/__tests__/runs-before-the-suite.ts'
import type { TestFileOutcome } from '../src/__tests__/vitest-cli.ts'
import { type BridgeRunGiven, type ChildSaw, runTheBridge } from './__tests__/bridge-runs.ts'

// No Stryker config mutates the bridge, so each run copies it as it stands into a scratch copy of the repo and runs a
// test file there that covers code in its own process and spawns children covering more, loading a stand-in for
// Stryker's setup file first, as Stryker's vitest runner does. Each mutant the file names is covered at one point
// alone (while the file loads, in a hook, in a test, in a child of each), so a credit to the wrong test shows.

const FIXTURE = 'children-spawned.fixture.mjs'
const FIXTURE_COVERING_IN_CHILDREN_ONLY = 'children-only.fixture.mjs'
const ONLY_TEST_OF_THE_FIXTURE_COVERING_IN_CHILDREN_ONLY = 'covers code only in a child it spawns'
const FIXTURE_LEAVING_NO_COVERAGE_MAP = 'no-coverage-map.fixture.mjs'
const ONLY_TEST_OF_THE_FIXTURE_LEAVING_NO_COVERAGE_MAP = 'leaves a file that is not a coverage map where children write their coverage'
const FIXTURE_LEAVING_A_TESTS_COUNTS_AS_TEXT = 'per-test-counts-as-text.fixture.mjs'
const ONLY_TEST_OF_THE_FIXTURE_LEAVING_A_TESTS_COUNTS_AS_TEXT = 'leaves a file whose map for a test counts in text where children write their coverage'
const FIXTURE_LEAVING_NULL = 'null-coverage-file.fixture.mjs'
const ONLY_TEST_OF_THE_FIXTURE_LEAVING_NULL = 'leaves a file holding null where children write their coverage'
const FIXTURE_LEAVING_STATIC_COUNTS_IN_A_LIST = 'static-counts-in-a-list.fixture.mjs'
const ONLY_TEST_OF_THE_FIXTURE_LEAVING_STATIC_COUNTS_IN_A_LIST = 'leaves a file whose static map is a list of counts where children write their coverage'
const FIXTURE_LEAVING_PER_TEST_MAPS_A_NUMBER = 'per-test-maps-a-number.fixture.mjs'
const ONLY_TEST_OF_THE_FIXTURE_LEAVING_PER_TEST_MAPS_A_NUMBER = 'leaves a file whose per-test maps are a number where children write their coverage'
const FIRST_TEST = 'covers code in its own process and in a child it spawns'
const SECOND_TEST = 'spawns two children covering the same code, and one loading no instrumented code'
const ACTIVE_MUTANT = '7'
const MUTANT_ALREADY_IN_THE_ENVIRONMENT = '3'
const NO_NAMESPACE_REFUSAL = "Stryker's setup file has not run: load vitest.mutation.config.ts through Stryker only"
const NO_COVERAGE_MAP_REFUSAL = 'holds no coverage map, as child-coverage-hook.mjs writes'
const BRIDGE_RUNS_TIMEOUT_MS = 600_000

// Each run's worker starts with NODE_OPTIONS of its own, which its children must keep, and a mutant in its
// environment, which no child may see unless Stryker turns that mutant on. The option is one a worker thread accepts
// (Node refuses a process-wide one such as --title there) and a child can see: process.noDeprecation.
const RUN_ENV = { NODE_OPTIONS: '--no-deprecation', __STRYKER_ACTIVE_MUTANT__: MUTANT_ALREADY_IN_THE_ENVIRONMENT }

const DRY_RUN: BridgeRunGiven = { testFile: FIXTURE, provided: { mode: 'dry-run' }, strykerSetup: 'loaded first', env: RUN_ENV }
const STATIC_MUTANT_RUN: BridgeRunGiven = {
  testFile: FIXTURE,
  provided: { mode: 'mutant', mutantActivation: 'static', activeMutant: ACTIVE_MUTANT },
  strykerSetup: 'loaded first',
  env: RUN_ENV,
}
const RUNTIME_MUTANT_RUN: BridgeRunGiven = {
  testFile: FIXTURE,
  provided: { mode: 'mutant', mutantActivation: 'runtime', activeMutant: ACTIVE_MUTANT },
  strykerSetup: 'loaded first',
  env: RUN_ENV,
}
const RUN_WITHOUT_STRYKER: BridgeRunGiven = { testFile: FIXTURE, provided: { mode: 'dry-run' }, strykerSetup: 'not loaded', env: RUN_ENV }
const DRY_RUN_NAMING_NO_TEST: BridgeRunGiven = {
  testFile: FIXTURE,
  provided: { mode: 'dry-run' },
  strykerSetup: 'loaded first, naming no test',
  env: RUN_ENV,
}
const DRY_RUN_COVERING_IN_CHILDREN_ONLY: BridgeRunGiven = {
  testFile: FIXTURE_COVERING_IN_CHILDREN_ONLY,
  provided: { mode: 'dry-run' },
  strykerSetup: 'loaded first',
  env: RUN_ENV,
}
const DRY_RUN_READING_NO_COVERAGE_MAP: BridgeRunGiven = {
  testFile: FIXTURE_LEAVING_NO_COVERAGE_MAP,
  provided: { mode: 'dry-run' },
  strykerSetup: 'loaded first',
  env: RUN_ENV,
}
const DRY_RUN_READING_A_TESTS_COUNTS_AS_TEXT: BridgeRunGiven = {
  testFile: FIXTURE_LEAVING_A_TESTS_COUNTS_AS_TEXT,
  provided: { mode: 'dry-run' },
  strykerSetup: 'loaded first',
  env: RUN_ENV,
}
const DRY_RUN_READING_NULL: BridgeRunGiven = {
  testFile: FIXTURE_LEAVING_NULL,
  provided: { mode: 'dry-run' },
  strykerSetup: 'loaded first',
  env: RUN_ENV,
}
const DRY_RUN_READING_STATIC_COUNTS_IN_A_LIST: BridgeRunGiven = {
  testFile: FIXTURE_LEAVING_STATIC_COUNTS_IN_A_LIST,
  provided: { mode: 'dry-run' },
  strykerSetup: 'loaded first',
  env: RUN_ENV,
}
const DRY_RUN_READING_PER_TEST_MAPS_A_NUMBER: BridgeRunGiven = {
  testFile: FIXTURE_LEAVING_PER_TEST_MAPS_A_NUMBER,
  provided: { mode: 'dry-run' },
  strykerSetup: 'loaded first',
  env: RUN_ENV,
}

function bothTestsEnding(status: 'passed' | 'failed'): readonly TestFileOutcome[] {
  return [
    {
      file: FIXTURE,
      status,
      message: '',
      tests: [
        { title: FIRST_TEST, status },
        { title: SECOND_TEST, status },
      ],
    },
  ]
}

// In the test file's own process and in children, while the file loads and in its beforeAll and afterAll.
const COVERED_BY_THE_FILES_HOOKS = {
  'covered-by-a-child-spawned-while-the-file-loads': 1,
  'covered-while-the-file-loads-and-in-a-hook': 1,
  'covered-before-all': 1,
  'covered-by-a-child-spawned-before-all': 1,
  'covered-after-all': 1,
  'covered-by-a-child-spawned-after-all': 1,
}

// Covered while the file loads, before any hook of its own runs.
const COVERED_WHILE_THE_FILE_LOADS = { 'covered-while-the-file-loads': 1, 'covered-while-the-file-loads-and-in-a-hook': 1 }

function seeing(activeMutant: string | null): ChildSaw {
  return { activeMutant, hasTheRunsNodeOptions: true }
}

function namingTheRefusal(): unknown {
  return expect.stringContaining(NO_NAMESPACE_REFUSAL)
}

function namingTheCoverageMapRefusal(): unknown {
  return expect.stringContaining(NO_COVERAGE_MAP_REFUSAL)
}

describe("the child-process bridge, loaded after a stand-in for Stryker's setup file, in a run of a test file that spawns children", () => {
  const runs = setUpRunsBeforeTheSuite(
    (tempProjects) => ({
      dryRun: runTheBridge(tempProjects, DRY_RUN),
      staticMutantRun: runTheBridge(tempProjects, STATIC_MUTANT_RUN),
      runtimeMutantRun: runTheBridge(tempProjects, RUNTIME_MUTANT_RUN),
      runWithoutStryker: runTheBridge(tempProjects, RUN_WITHOUT_STRYKER),
      dryRunNamingNoTest: runTheBridge(tempProjects, DRY_RUN_NAMING_NO_TEST),
      dryRunCoveringInChildrenOnly: runTheBridge(tempProjects, DRY_RUN_COVERING_IN_CHILDREN_ONLY),
      dryRunReadingNoCoverageMap: runTheBridge(tempProjects, DRY_RUN_READING_NO_COVERAGE_MAP),
      dryRunReadingATestsCountsAsText: runTheBridge(tempProjects, DRY_RUN_READING_A_TESTS_COUNTS_AS_TEXT),
      dryRunReadingNull: runTheBridge(tempProjects, DRY_RUN_READING_NULL),
      dryRunReadingStaticCountsInAList: runTheBridge(tempProjects, DRY_RUN_READING_STATIC_COUNTS_IN_A_LIST),
      dryRunReadingPerTestMapsANumber: runTheBridge(tempProjects, DRY_RUN_READING_PER_TEST_MAPS_A_NUMBER),
    }),
    { timeoutMs: BRIDGE_RUNS_TIMEOUT_MS, whatFailed: 'the bridge could not be run in a scratch copy of the repo before the suite' },
  )

  it("in a dry run, credits each test with what its children covered, and every test with what the file's hooks and their children covered, leaving as static only what loading the file covered", () => {
    const { files, coverage } = runs().dryRun

    expect({ files, coverage }).toStrictEqual({
      files: bothTestsEnding('passed'),
      coverage: {
        static: COVERED_WHILE_THE_FILE_LOADS,
        perTest: {
          [FIRST_TEST]: { 'covered-by-the-first-test': 1, 'covered-by-a-child-of-the-first-test': 1, ...COVERED_BY_THE_FILES_HOOKS },
          [SECOND_TEST]: { 'covered-by-two-children-of-the-second-test': 2, ...COVERED_BY_THE_FILES_HOOKS },
        },
      },
    })
  })

  it('in a dry run of a test file whose own process covers nothing, so Stryker holds no coverage before the bridge makes it, credits the test with what its children covered and what the child of its hook covered', () => {
    const { files, coverage } = runs().dryRunCoveringInChildrenOnly

    expect({ files, coverage }).toStrictEqual({
      files: [
        {
          file: FIXTURE_COVERING_IN_CHILDREN_ONLY,
          status: 'passed',
          message: '',
          tests: [{ title: ONLY_TEST_OF_THE_FIXTURE_COVERING_IN_CHILDREN_ONLY, status: 'passed' }],
        },
      ],
      coverage: {
        static: {},
        perTest: {
          [ONLY_TEST_OF_THE_FIXTURE_COVERING_IN_CHILDREN_ONLY]: { 'covered-by-a-child-of-the-test': 1, 'covered-by-a-child-spawned-before-all': 1 },
        },
      },
    })
  })

  it("in a dry run where a file in its children's coverage folder holds no coverage map, fails the test rather than crediting it what the file holds", () => {
    const { files, coverage } = runs().dryRunReadingNoCoverageMap

    expect({ files, coverage }).toStrictEqual({
      files: [
        {
          file: FIXTURE_LEAVING_NO_COVERAGE_MAP,
          status: 'failed',
          message: namingTheCoverageMapRefusal(),
          tests: [{ title: ONLY_TEST_OF_THE_FIXTURE_LEAVING_NO_COVERAGE_MAP, status: 'failed' }],
        },
      ],
      coverage: null,
    })
  })

  it("in a dry run where a file in its children's coverage folder counts in numbers in its static map but in text in a test's map, fails the test rather than crediting it what the file holds", () => {
    const { files, coverage } = runs().dryRunReadingATestsCountsAsText

    expect({ files, coverage }).toStrictEqual({
      files: [
        {
          file: FIXTURE_LEAVING_A_TESTS_COUNTS_AS_TEXT,
          status: 'failed',
          message: namingTheCoverageMapRefusal(),
          tests: [{ title: ONLY_TEST_OF_THE_FIXTURE_LEAVING_A_TESTS_COUNTS_AS_TEXT, status: 'failed' }],
        },
      ],
      coverage: null,
    })
  })

  it("in a dry run where a file in its children's coverage folder holds null, fails the test, saying the file holds no coverage map", () => {
    const { files, coverage } = runs().dryRunReadingNull

    expect({ files, coverage }).toStrictEqual({
      files: [
        {
          file: FIXTURE_LEAVING_NULL,
          status: 'failed',
          message: namingTheCoverageMapRefusal(),
          tests: [{ title: ONLY_TEST_OF_THE_FIXTURE_LEAVING_NULL, status: 'failed' }],
        },
      ],
      coverage: null,
    })
  })

  it("in a dry run where a file in its children's coverage folder holds its static map as a list of counts, fails the test rather than crediting it a mutant for each place in the list", () => {
    const { files, coverage } = runs().dryRunReadingStaticCountsInAList

    expect({ files, coverage }).toStrictEqual({
      files: [
        {
          file: FIXTURE_LEAVING_STATIC_COUNTS_IN_A_LIST,
          status: 'failed',
          message: namingTheCoverageMapRefusal(),
          tests: [{ title: ONLY_TEST_OF_THE_FIXTURE_LEAVING_STATIC_COUNTS_IN_A_LIST, status: 'failed' }],
        },
      ],
      coverage: null,
    })
  })

  it("in a dry run where a file in its children's coverage folder holds a number for its per-test maps, fails the test rather than crediting it the file's static map", () => {
    const { files, coverage } = runs().dryRunReadingPerTestMapsANumber

    expect({ files, coverage }).toStrictEqual({
      files: [
        {
          file: FIXTURE_LEAVING_PER_TEST_MAPS_A_NUMBER,
          status: 'failed',
          message: namingTheCoverageMapRefusal(),
          tests: [{ title: ONLY_TEST_OF_THE_FIXTURE_LEAVING_PER_TEST_MAPS_A_NUMBER, status: 'failed' }],
        },
      ],
      coverage: null,
    })
  })

  it('in a dry run, leaves nothing in the temp dir it was given, the folder its children wrote their coverage to included', () => {
    expect(runs().dryRun.leftInTempDir).toStrictEqual([])
  })

  it('in a dry run, hands no child the mutant the run started with in its environment, and keeps the NODE_OPTIONS the run gave them', () => {
    const { files, children } = runs().dryRun

    expect({ files, children }).toStrictEqual({
      files: bothTestsEnding('passed'),
      children: {
        'spawned-while-the-file-loads': seeing(null),
        'spawned-before-all': seeing(null),
        'spawned-by-the-first-test': seeing(null),
        'spawned-by-the-second-test': seeing(null),
        'spawned-again-by-the-second-test': seeing(null),
        'spawned-after-all': seeing(null),
      },
    })
  })

  it('in a mutant run turning its mutant on as files load (static), hands it to every child, the one spawned while the test file loads included', () => {
    const { files, children } = runs().staticMutantRun

    expect({ files, children }).toStrictEqual({
      files: bothTestsEnding('passed'),
      children: {
        'spawned-while-the-file-loads': seeing(ACTIVE_MUTANT),
        'spawned-before-all': seeing(ACTIVE_MUTANT),
        'spawned-by-the-first-test': seeing(ACTIVE_MUTANT),
        'spawned-by-the-second-test': seeing(ACTIVE_MUTANT),
        'spawned-again-by-the-second-test': seeing(ACTIVE_MUTANT),
        'spawned-after-all': seeing(ACTIVE_MUTANT),
      },
    })
  })

  it('in a mutant run turning its mutant on before the tests (runtime), hands it to every child spawned from then on, and none to the one spawned while the test file loads', () => {
    const { files, children } = runs().runtimeMutantRun

    expect({ files, children }).toStrictEqual({
      files: bothTestsEnding('passed'),
      children: {
        'spawned-while-the-file-loads': seeing(null),
        'spawned-before-all': seeing(ACTIVE_MUTANT),
        'spawned-by-the-first-test': seeing(ACTIVE_MUTANT),
        'spawned-by-the-second-test': seeing(ACTIVE_MUTANT),
        'spawned-again-by-the-second-test': seeing(ACTIVE_MUTANT),
        'spawned-after-all': seeing(ACTIVE_MUTANT),
      },
    })
  })

  it('gives the copy of the repo it runs from a .git folder, where it had none', () => {
    const { hasGitFolderBefore, hasGitFolderAfter } = runs().dryRun

    expect({ hasGitFolderBefore, hasGitFolderAfter }).toStrictEqual({ hasGitFolderBefore: false, hasGitFolderAfter: true })
  })

  it("refuses to run where Stryker's setup file has not loaded before it, naming the config to run through Stryker, so no test runs and no child is spawned", () => {
    const { files, coverage, children } = runs().runWithoutStryker

    expect({ files, coverage, children }).toStrictEqual({
      files: [{ file: FIXTURE, status: 'failed', message: namingTheRefusal(), tests: [] }],
      coverage: null,
      children: {},
    })
  })

  it("in a dry run where Stryker's setup file names no test, fails each test rather than crediting coverage to a test it cannot name", () => {
    const { files, coverage } = runs().dryRunNamingNoTest

    expect({ files, coverage }).toStrictEqual({
      files: bothTestsEnding('failed'),
      coverage: { static: COVERED_WHILE_THE_FILE_LOADS, perTest: {} },
    })
  })
})
