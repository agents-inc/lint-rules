import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARALLEL_LOAD_TIMEOUT_MS } from '../src/__tests__/parallel-load.ts'
import { runMadeFor, setUpRunsBeforeTheSuite } from '../src/__tests__/runs-before-the-suite.ts'
import {
  MUTANT_COLUMN,
  MUTATOR_NAME,
  mutationReport,
  staticKilledMutant,
  staticSurvivedMutant,
  survivedMutantNotStatic,
} from './__tests__/factories/mutation-report-factories.ts'
import { gitIgnoreOf, moduleOfLines, moduleWithLinesRewritten, strykerJsonConfig, strykerModuleConfig } from './__tests__/factories/round-repo-factories.ts'
import { TEST_FILES_SPELLINGS } from './__tests__/factories/test-files-spellings.ts'
import { createRoundRepo } from './__tests__/round-script-runs.ts'

const LINT_RULES_CONFIG = 'stryker.config.json'
const RULE_DATA_CONFIG = 'stryker.rule-data.config.mjs'
const HOUSE_CONFIG = 'stryker.eslint-plugin-house.config.mjs'

const LINT_RULES_PATTERNS = ['packages/lint-rules/src/**/*.ts', '!packages/lint-rules/src/**/*.test.ts']
const RULE_DATA_PATTERNS = ['packages/rule-data/src/**/*.ts', '!packages/rule-data/src/**/*.test.ts']
const HOUSE_PATTERNS = ['packages/eslint-plugin-house/src/**/*.ts', '!packages/eslint-plugin-house/src/**/*.test.ts']

const LANE_FILE = 'packages/eslint-plugin-house/src/rules/this-lanes-rule.ts'
const LANE_TEST_FILE = 'packages/eslint-plugin-house/src/rules/this-lanes-rule.test.ts'
const LANE_LINT_RULES_FILE = 'packages/lint-rules/src/core/this-lanes-module.ts'
const OTHER_LANE_FILE = 'packages/eslint-plugin-house/src/rules/other-lanes-rule.ts'
const UNTRACKED_FILE = 'packages/eslint-plugin-house/src/rules/new-rule.ts'
const MISSING_FILE = 'packages/eslint-plugin-house/src/rules/no-such-rule.ts'
const RULES_FOLDER = 'packages/eslint-plugin-house/src/rules'
const HOUSE_PACKAGE_FOLDER = 'packages/eslint-plugin-house'
const UNTRACKED_TEST_FILE = 'packages/eslint-plugin-house/src/rules/new-rule.test.ts'
const MISSPELT_TEST_FILE = 'packages/eslint-plugin-house/src/rules/this-lanes-rule.tset.ts'
const MISSING_TEST_FILE = 'packages/eslint-plugin-house/src/rules/no-such-rule.test.ts'
const DELETED_TEST_FILE = 'packages/eslint-plugin-house/src/rules/deleted-rule.test.ts'
const HOUSE_GIT_IGNORE = 'packages/eslint-plugin-house/.gitignore'
const IGNORED_FOLDER = 'coverage/'
const IGNORED_TEST_FILE = 'packages/eslint-plugin-house/coverage/ignored-rule.test.ts'
const LOCAL_FILES = '*.local.ts'
const IGNORED_FILE = 'packages/eslint-plugin-house/src/rules/new-rule.local.ts'
const LANE_TEST_FILE_FROM_THE_PACKAGE = 'src/rules/this-lanes-rule.test.ts'
const LANE_TEST_FILE_FROM_THE_CURRENT_FOLDER = `./${LANE_TEST_FILE}`
const HOUSE_TEST_FILES_GLOB = 'packages/eslint-plugin-house/src/**/*.test.ts'
const GLOB_MATCHING_NO_FILE = 'packages/eslint-plugin-house/src/**/*.spec.ts'
// Stryker reads all that is attached to -t as its list, `=` and all.
const LANE_TEST_FILE_AFTER_AN_EQUALS_SIGN = `=${LANE_TEST_FILE}`
const NO_ENTRY = ','
const SEPARATORS_ONLY = ',,'
const EMPTY_LIST = ''

const LANE_FILE_LINES = 40
const MODULE_LINES = 20
const TEST_FILE_LINES = 5
const NEW_RULE_LINES = 10

const ONLY = '--only'
const TEST_FILES = '--testFiles'
const TEST_FILES_ASSIGNED = '--testFiles='
const TEST_FILES_SHORT = '-t'
const DRY_RUN_ONLY = '--dryRunOnly'
const CONCURRENCY = '--concurrency'
const TWO_WORKERS = '2'
const RUN_MUTATION = ['run', 'mutation']

const SUCCEEDED = 0
// Node's exit code for an error thrown to the top of the script.
const REFUSED = 1
// The round's exit code when a mutant Survived after running no test.
const FAILED = 1

const TESTS_RUN = 21
const NO_TEST_RUN = 0
const STATIC_SURVIVED_LINE = 10
const OTHER_STATIC_SURVIVED_LINE = 30
const SURVIVED_NOT_STATIC_LINE = 11
const STATIC_KILLED_LINE = 12

const LOAD_TIME_WARNING =
  'WARNING: a run given --testFiles turns a load-time (static) mutant on only after the test files have loaded, ' +
  'so these Survived results prove nothing. Re-run each without --testFiles:'

function testFilesRefusal(entries: readonly string[]): string {
  return `Error: --testFiles finds no file for ${entries.join(', ')}: give each spec or glob from the repo root, as Stryker reads it\n`
}

function emptyTestFilesRefusal(lists: readonly string[]): string {
  const listsAsGiven = lists.map((list) => `"${list}"`).join(', ')
  return `Error: --testFiles holds no spec or glob in ${listsAsGiven}, so Stryker would run every test: give a comma-separated list of them from the repo root\n`
}

function loadTimeWarningNaming(lines: readonly number[]): string {
  return [LOAD_TIME_WARNING, ...lines.map((line) => `  ${LANE_FILE}:${line}:${MUTANT_COLUMN} ${MUTATOR_NAME}`), ''].join('\n')
}

describe('the round script, with Stryker replaced by a stand-in that records how each run was started', () => {
  const runs = setUpRunsBeforeTheSuite(
    (tempProjects) => {
      const repo = createRoundRepo(
        tempProjects,
        {
          [LINT_RULES_CONFIG]: strykerJsonConfig(LINT_RULES_PATTERNS),
          [RULE_DATA_CONFIG]: strykerModuleConfig(RULE_DATA_PATTERNS),
          [HOUSE_CONFIG]: strykerModuleConfig(HOUSE_PATTERNS),
          [LANE_FILE]: moduleOfLines(LANE_FILE_LINES),
          [LANE_TEST_FILE]: moduleOfLines(TEST_FILE_LINES),
          [LANE_LINT_RULES_FILE]: moduleOfLines(MODULE_LINES),
          [OTHER_LANE_FILE]: moduleOfLines(MODULE_LINES),
        },
        (project) => {
          project.write(LANE_FILE, moduleWithLinesRewritten(LANE_FILE_LINES, [10, 11, 12, 30]))
          project.write(LANE_TEST_FILE, moduleWithLinesRewritten(TEST_FILE_LINES, [2]))
          project.write(LANE_LINT_RULES_FILE, moduleWithLinesRewritten(MODULE_LINES, [7, 8]))
          project.write(OTHER_LANE_FILE, moduleWithLinesRewritten(MODULE_LINES, [5]))
          project.write(UNTRACKED_FILE, moduleOfLines(NEW_RULE_LINES))
        },
      )
      const houseConfigByItsAbsolutePath = repo.pathOf(HOUSE_CONFIG)
      return {
        noArguments: repo.runTheRound([]),
        configNamedWithoutOnly: repo.runTheRound([HOUSE_CONFIG, CONCURRENCY, TWO_WORKERS]),
        configNamedByItsAbsolutePath: { config: houseConfigByItsAbsolutePath, ...repo.runTheRound([houseConfigByItsAbsolutePath]) },
        keptToThisLane: repo.runTheRound([ONLY, `${LANE_FILE}:11-40,${LANE_LINT_RULES_FILE}`, DRY_RUN_ONLY]),
        configNamedKeptToARange: repo.runTheRound([HOUSE_CONFIG, ONLY, `${UNTRACKED_FILE}:2-4`, TEST_FILES, LANE_TEST_FILE]),
        keptFromInsideAPackage: repo.runTheRound([ONLY, LANE_FILE, DRY_RUN_ONLY], HOUSE_PACKAGE_FOLDER),
        keptToAFileNotOnDisk: repo.runTheRound([ONLY, `${LANE_FILE},${MISSING_FILE}`]),
        keptToAFolder: repo.runTheRound([ONLY, RULES_FOLDER]),
        keptToAFileTheConfigNamedLeavesOut: repo.runTheRound([LINT_RULES_CONFIG, ONLY, `${LANE_LINT_RULES_FILE},${LANE_FILE}`]),
      }
    },
    { timeoutMs: PARALLEL_LOAD_TIMEOUT_MS, whatFailed: 'the round script could not be run in a scratch repo before the suite' },
  )

  it("with no arguments, hands each config every changed line of the files it mutates, every lane's and untracked files whole, and names a config with none", () => {
    const { exitCode, stdout, strykerRuns } = runs().noArguments

    expect({ exitCode, stdout, strykerRuns }).toStrictEqual({
      exitCode: SUCCEEDED,
      stdout: `No changed lines in the files ${RULE_DATA_CONFIG} mutates.\n`,
      strykerRuns: [
        [...RUN_MUTATION, LINT_RULES_CONFIG, '--mutate', `${LANE_LINT_RULES_FILE}:7-8`],
        [...RUN_MUTATION, HOUSE_CONFIG, '--mutate', `${OTHER_LANE_FILE}:5-5,${LANE_FILE}:10-12,${LANE_FILE}:30-30,${UNTRACKED_FILE}`],
      ],
    })
  })

  it('with a config named first and no --only, hands that config every changed line it mutates, and Stryker the options after it', () => {
    const { exitCode, stdout, strykerRuns } = runs().configNamedWithoutOnly

    expect({ exitCode, stdout, strykerRuns }).toStrictEqual({
      exitCode: SUCCEEDED,
      stdout: '',
      strykerRuns: [
        [...RUN_MUTATION, HOUSE_CONFIG, '--mutate', `${OTHER_LANE_FILE}:5-5,${LANE_FILE}:10-12,${LANE_FILE}:30-30,${UNTRACKED_FILE}`, CONCURRENCY, TWO_WORKERS],
      ],
    })
  })

  it('reads a config named first by its absolute path, and hands Stryker that config, as given, every changed line it mutates', () => {
    const { config, exitCode, stdout, stderr, strykerRuns } = runs().configNamedByItsAbsolutePath

    expect(isAbsolute(config)).toBe(true)
    expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
      exitCode: SUCCEEDED,
      stdout: '',
      stderr: '',
      strykerRuns: [[...RUN_MUTATION, config, '--mutate', `${OTHER_LANE_FILE}:5-5,${LANE_FILE}:10-12,${LANE_FILE}:30-30,${UNTRACKED_FILE}`]],
    })
  })

  it("with --only, hands each config the changed lines inside the files and ranges given and no other lane's, passes Stryker the options but not --only, and names a config left none", () => {
    const { exitCode, stdout, strykerRuns } = runs().keptToThisLane

    expect({ exitCode, stdout, strykerRuns }).toStrictEqual({
      exitCode: SUCCEEDED,
      stdout: `No changed lines in the files given to --only that ${RULE_DATA_CONFIG} mutates.\n`,
      strykerRuns: [
        [...RUN_MUTATION, LINT_RULES_CONFIG, '--mutate', `${LANE_LINT_RULES_FILE}:7-8`, DRY_RUN_ONLY],
        [...RUN_MUTATION, HOUSE_CONFIG, '--mutate', `${LANE_FILE}:11-12,${LANE_FILE}:30-30`, DRY_RUN_ONLY],
      ],
    })
  })

  it('with a config named first and --only, hands that config alone the range kept of an untracked file, and Stryker its --testFiles', () => {
    const { exitCode, stdout, strykerRuns } = runs().configNamedKeptToARange

    expect({ exitCode, stdout, strykerRuns }).toStrictEqual({
      exitCode: SUCCEEDED,
      stdout: '',
      strykerRuns: [[...RUN_MUTATION, HOUSE_CONFIG, '--mutate', `${UNTRACKED_FILE}:2-4`, TEST_FILES, LANE_TEST_FILE]],
    })
  })

  it('reads the paths given to --only from the repo root when run from inside a package', () => {
    const { exitCode, stdout, strykerRuns } = runs().keptFromInsideAPackage

    expect({ exitCode, stdout, strykerRuns }).toStrictEqual({
      exitCode: SUCCEEDED,
      stdout:
        `No changed lines in the files given to --only that ${LINT_RULES_CONFIG} mutates.\n` +
        `No changed lines in the files given to --only that ${RULE_DATA_CONFIG} mutates.\n`,
      strykerRuns: [[...RUN_MUTATION, HOUSE_CONFIG, '--mutate', `${LANE_FILE}:10-12,${LANE_FILE}:30-30`, DRY_RUN_ONLY]],
    })
  })

  it('refuses, before any Stryker run, an --only naming a file not on disk beside one that is, and names the missing one', () => {
    const { exitCode, stdout, stderr, strykerRuns } = runs().keptToAFileNotOnDisk

    expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
    expect(stderr).toContain(`Error: --only names no file at ${MISSING_FILE}: give each path from the repo root, as git diff prints it\n`)
  })

  it('refuses a folder given to --only as naming no file', () => {
    const { exitCode, stdout, stderr, strykerRuns } = runs().keptToAFolder

    expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
    expect(stderr).toContain(`Error: --only names no file at ${RULES_FOLDER}: give each path from the repo root, as git diff prints it\n`)
  })

  it('refuses, before any Stryker run, an --only naming a file only a config outside the round mutates, as the config named first leaves it out', () => {
    const { exitCode, stdout, stderr, strykerRuns } = runs().keptToAFileTheConfigNamedLeavesOut

    expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
    expect(stderr).toContain(`Error: No config of this round mutates ${LANE_FILE}: give source files it mutates, as git diff prints them\n`)
  })
})

describe('the round script given --testFiles, with Stryker replaced by a stand-in that records how each run was started and writes the report given', () => {
  const runs = setUpRunsBeforeTheSuite(
    (tempProjects) => {
      const repo = createRoundRepo(
        tempProjects,
        {
          [LINT_RULES_CONFIG]: strykerJsonConfig(LINT_RULES_PATTERNS),
          [RULE_DATA_CONFIG]: strykerModuleConfig(RULE_DATA_PATTERNS),
          [HOUSE_CONFIG]: strykerModuleConfig(HOUSE_PATTERNS),
          [LANE_FILE]: moduleOfLines(LANE_FILE_LINES),
          [LANE_TEST_FILE]: moduleOfLines(TEST_FILE_LINES),
          [DELETED_TEST_FILE]: moduleOfLines(TEST_FILE_LINES),
          [HOUSE_GIT_IGNORE]: gitIgnoreOf([IGNORED_FOLDER]),
        },
        (project) => {
          project.write(LANE_FILE, moduleWithLinesRewritten(LANE_FILE_LINES, [10, 11, 12, 30]))
          project.write(UNTRACKED_TEST_FILE, moduleOfLines(TEST_FILE_LINES))
          project.write(IGNORED_TEST_FILE, moduleOfLines(TEST_FILE_LINES))
          project.remove(DELETED_TEST_FILE)
        },
      )
      const laneTestFileByItsAbsolutePath = repo.pathOf(LANE_TEST_FILE)
      const missingTestFileByItsAbsolutePath = repo.pathOf(MISSING_TEST_FILE)
      const staticSurvivedBesideOthers = mutationReport({
        [LANE_FILE]: [
          staticSurvivedMutant(STATIC_SURVIVED_LINE, TESTS_RUN),
          survivedMutantNotStatic(SURVIVED_NOT_STATIC_LINE, TESTS_RUN),
          staticKilledMutant(STATIC_KILLED_LINE, TESTS_RUN),
          staticSurvivedMutant(OTHER_STATIC_SURVIVED_LINE, TESTS_RUN),
        ],
      })
      const noStaticSurvived = mutationReport({
        [LANE_FILE]: [survivedMutantNotStatic(SURVIVED_NOT_STATIC_LINE, TESTS_RUN), staticKilledMutant(STATIC_KILLED_LINE, TESTS_RUN)],
      })
      const staticSurvivedBesideOneThatRanNoTest = mutationReport({
        [LANE_FILE]: [staticSurvivedMutant(STATIC_SURVIVED_LINE, TESTS_RUN), survivedMutantNotStatic(SURVIVED_NOT_STATIC_LINE, NO_TEST_RUN)],
      })
      return {
        aSpecGivenAs: TEST_FILES_SPELLINGS.map(({ spelling, given }) => ({ kind: spelling, ...repo.runTheRound(given(LANE_TEST_FILE)) })),
        aMisspeltSpecGivenAs: TEST_FILES_SPELLINGS.map(({ spelling, given }) => ({ kind: spelling, ...repo.runTheRound(given(MISSPELT_TEST_FILE)) })),
        aGlobMatchingASpec: repo.runTheRound([TEST_FILES, HOUSE_TEST_FILES_GLOB]),
        aListWithAnUntrackedSpec: repo.runTheRound([TEST_FILES, `${LANE_TEST_FILE},${UNTRACKED_TEST_FILE}`]),
        aSpecFromTheCurrentFolder: repo.runTheRound([TEST_FILES, LANE_TEST_FILE_FROM_THE_CURRENT_FOLDER]),
        aSpecFromTheRootRunInsideAPackage: repo.runTheRound([TEST_FILES, LANE_TEST_FILE], HOUSE_PACKAGE_FOLDER),
        aListWithEntriesMatchingNoFile: repo.runTheRound([TEST_FILES, `${MISSPELT_TEST_FILE},${LANE_TEST_FILE},${MISSING_TEST_FILE}`]),
        aGlobMatchingNoFile: repo.runTheRound([TEST_FILES, GLOB_MATCHING_NO_FILE]),
        aFolder: repo.runTheRound([TEST_FILES, RULES_FOLDER]),
        aSpecFromThePackageRunInsideIt: repo.runTheRound([TEST_FILES, LANE_TEST_FILE_FROM_THE_PACKAGE], HOUSE_PACKAGE_FOLDER),
        aSpecAttachedToTAfterAnEqualsSign: repo.runTheRound([`${TEST_FILES_SHORT}${LANE_TEST_FILE_AFTER_AN_EQUALS_SIGN}`]),
        aSpecTheWorkTreeHasDeleted: repo.runTheRound([TEST_FILES, DELETED_TEST_FILE]),
        aSpecGitIgnores: repo.runTheRound([TEST_FILES, IGNORED_TEST_FILE]),
        aSpecByItsAbsolutePath: { spec: laneTestFileByItsAbsolutePath, ...repo.runTheRound([TEST_FILES, laneTestFileByItsAbsolutePath]) },
        aMissingSpecByItsAbsolutePath: { spec: missingTestFileByItsAbsolutePath, ...repo.runTheRound([TEST_FILES, missingTestFileByItsAbsolutePath]) },
        aListWithNoEntryGivenAs: TEST_FILES_SPELLINGS.map(({ spelling, given }) => ({ kind: spelling, ...repo.runTheRound(given(NO_ENTRY)) })),
        anEmptyList: repo.runTheRound([TEST_FILES_ASSIGNED]),
        aListWithEmptyEntriesBesideASpec: repo.runTheRound([TEST_FILES, `${NO_ENTRY}${LANE_TEST_FILE}${NO_ENTRY}`]),
        twoListsWithNoEntry: repo.runTheRound([TEST_FILES, NO_ENTRY, TEST_FILES_SHORT, SEPARATORS_ONLY]),
        twoListsEachHoldingASpec: repo.runTheRound([TEST_FILES, LANE_TEST_FILE, TEST_FILES_SHORT, UNTRACKED_TEST_FILE]),
        staticSurvivedGivenAs: TEST_FILES_SPELLINGS.map(({ spelling, given }) => ({
          kind: spelling,
          ...repo.runTheRoundReporting(staticSurvivedBesideOthers, [HOUSE_CONFIG, ...given(LANE_TEST_FILE)]),
        })),
        staticSurvivedWithoutTestFiles: repo.runTheRoundReporting(staticSurvivedBesideOthers, [HOUSE_CONFIG]),
        noStaticSurvivedWithTestFiles: repo.runTheRoundReporting(noStaticSurvived, [HOUSE_CONFIG, TEST_FILES, LANE_TEST_FILE]),
        oneRanNoTestWithoutTestFiles: repo.runTheRoundReporting(staticSurvivedBesideOneThatRanNoTest, [HOUSE_CONFIG]),
        oneRanNoTestWithTestFiles: repo.runTheRoundReporting(staticSurvivedBesideOneThatRanNoTest, [HOUSE_CONFIG, TEST_FILES, LANE_TEST_FILE]),
      }
    },
    { timeoutMs: PARALLEL_LOAD_TIMEOUT_MS, whatFailed: 'the round script could not be run in a scratch repo before the suite' },
  )

  const theLanesHunks = [...RUN_MUTATION, HOUSE_CONFIG, '--mutate', `${LANE_FILE}:10-12,${LANE_FILE}:30-30`]
  const noChangedLinesOutsideHouse = `No changed lines in the files ${LINT_RULES_CONFIG} mutates.\nNo changed lines in the files ${RULE_DATA_CONFIG} mutates.\n`

  describe('a --testFiles entry', () => {
    it.each(TEST_FILES_SPELLINGS)('is refused before any Stryker run, and named, when it matches no file, given as $spelling', ({ spelling }) => {
      const { exitCode, stdout, stderr, strykerRuns } = runMadeFor(runs().aMisspeltSpecGivenAs, spelling)

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(testFilesRefusal([MISSPELT_TEST_FILE]))
    })

    it.each(TEST_FILES_SPELLINGS)('runs as today when it matches a spec, given as $spelling, which Stryker is handed as given', ({ spelling, given }) => {
      const { exitCode, stdout, stderr, strykerRuns } = runMadeFor(runs().aSpecGivenAs, spelling)

      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
        exitCode: SUCCEEDED,
        stdout: noChangedLinesOutsideHouse,
        stderr: '',
        strykerRuns: [[...theLanesHunks, ...given(LANE_TEST_FILE)]],
      })
    })

    it('is refused, and named, when it matches no file, in a list beside an entry that matches, each such entry named', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aListWithEntriesMatchingNoFile

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(testFilesRefusal([MISSPELT_TEST_FILE, MISSING_TEST_FILE]))
    })

    it('runs as today when every entry of a list matches, one of them a spec git does not track yet', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aListWithAnUntrackedSpec

      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
        exitCode: SUCCEEDED,
        stdout: noChangedLinesOutsideHouse,
        stderr: '',
        strykerRuns: [[...theLanesHunks, TEST_FILES, `${LANE_TEST_FILE},${UNTRACKED_TEST_FILE}`]],
      })
    })

    it('is refused when it is a glob that matches no file', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aGlobMatchingNoFile

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(testFilesRefusal([GLOB_MATCHING_NO_FILE]))
    })

    it('runs as today when it is a glob that matches a spec', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aGlobMatchingASpec

      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
        exitCode: SUCCEEDED,
        stdout: noChangedLinesOutsideHouse,
        stderr: '',
        strykerRuns: [[...theLanesHunks, TEST_FILES, HOUSE_TEST_FILES_GLOB]],
      })
    })

    it('is refused when it names a folder, as Stryker matches it against no file', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aFolder

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(testFilesRefusal([RULES_FOLDER]))
    })

    it('runs as today when it names a spec with a leading ./, which Stryker reads from the repo root', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aSpecFromTheCurrentFolder

      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
        exitCode: SUCCEEDED,
        stdout: noChangedLinesOutsideHouse,
        stderr: '',
        strykerRuns: [[...theLanesHunks, TEST_FILES, LANE_TEST_FILE_FROM_THE_CURRENT_FOLDER]],
      })
    })

    it('is refused when it names a spec from inside a package, run from there, as Stryker reads it from the repo root', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aSpecFromThePackageRunInsideIt

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(testFilesRefusal([LANE_TEST_FILE_FROM_THE_PACKAGE]))
    })

    it('is refused, named as Stryker reads it, when given as -t=<spec>, which Stryker reads as a spec that begins with =', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aSpecAttachedToTAfterAnEqualsSign

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(testFilesRefusal([LANE_TEST_FILE_AFTER_AN_EQUALS_SIGN]))
    })

    it('runs as today when it names a spec from the repo root, run from inside a package', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aSpecFromTheRootRunInsideAPackage

      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
        exitCode: SUCCEEDED,
        stdout: noChangedLinesOutsideHouse,
        stderr: '',
        strykerRuns: [[...theLanesHunks, TEST_FILES, LANE_TEST_FILE]],
      })
    })

    it('is refused, and named, when it names a spec git tracks that the work tree has deleted', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aSpecTheWorkTreeHasDeleted

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(testFilesRefusal([DELETED_TEST_FILE]))
    })

    it('is refused, and named, when it names a spec git ignores', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aSpecGitIgnores

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(testFilesRefusal([IGNORED_TEST_FILE]))
    })

    it('runs as today when it names a spec by its absolute path, which Stryker is handed as given', () => {
      const { spec, exitCode, stdout, stderr, strykerRuns } = runs().aSpecByItsAbsolutePath

      expect(isAbsolute(spec)).toBe(true)
      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
        exitCode: SUCCEEDED,
        stdout: noChangedLinesOutsideHouse,
        stderr: '',
        strykerRuns: [[...theLanesHunks, TEST_FILES, spec]],
      })
    })

    it('is refused, and named as given, when it names by its absolute path a spec not on disk', () => {
      const { spec, exitCode, stdout, stderr, strykerRuns } = runs().aMissingSpecByItsAbsolutePath

      expect(isAbsolute(spec)).toBe(true)
      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(testFilesRefusal([spec]))
    })
  })

  describe('a --testFiles list that holds no entry, which Stryker reads as no filter and so runs every test', () => {
    it.each(TEST_FILES_SPELLINGS)('is refused before any Stryker run, and named as given, when given as $spelling', ({ spelling }) => {
      const { exitCode, stdout, stderr, strykerRuns } = runMadeFor(runs().aListWithNoEntryGivenAs, spelling)

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(emptyTestFilesRefusal([NO_ENTRY]))
    })

    it('is refused, and named, when it is empty', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().anEmptyList

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(emptyTestFilesRefusal([EMPTY_LIST]))
    })

    it('is refused before any Stryker run, each named as given, when two such lists are given in one round', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().twoListsWithNoEntry

      expect({ exitCode, stdout, strykerRuns }).toStrictEqual({ exitCode: REFUSED, stdout: '', strykerRuns: [] })
      expect(stderr).toContain(emptyTestFilesRefusal([NO_ENTRY, SEPARATORS_ONLY]))
    })

    it('is not either of two lists in one round that each hold a spec, which run as today, Stryker handed both as given', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().twoListsEachHoldingASpec

      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
        exitCode: SUCCEEDED,
        stdout: noChangedLinesOutsideHouse,
        stderr: '',
        strykerRuns: [[...theLanesHunks, TEST_FILES, LANE_TEST_FILE, TEST_FILES_SHORT, UNTRACKED_TEST_FILE]],
      })
    })

    it('is not a list whose empty entries sit beside a spec, which runs as today', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().aListWithEmptyEntriesBesideASpec

      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
        exitCode: SUCCEEDED,
        stdout: noChangedLinesOutsideHouse,
        stderr: '',
        strykerRuns: [[...theLanesHunks, TEST_FILES, `${NO_ENTRY}${LANE_TEST_FILE}${NO_ENTRY}`]],
      })
    })
  })

  describe('a load-time (static) mutant reported Survived', () => {
    it.each(TEST_FILES_SPELLINGS)(
      'is named in a warning, with each other such mutant and no other mutant, saying to re-run them without --testFiles, after a run given $spelling, which still succeeds',
      ({ spelling, given }) => {
        const { exitCode, stdout, stderr, strykerRuns } = runMadeFor(runs().staticSurvivedGivenAs, spelling)

        expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
          exitCode: SUCCEEDED,
          stdout: '',
          stderr: loadTimeWarningNaming([STATIC_SURVIVED_LINE, OTHER_STATIC_SURVIVED_LINE]),
          strykerRuns: [[...theLanesHunks, ...given(LANE_TEST_FILE)]],
        })
      },
    )

    it('draws no warning after a run given no --testFiles', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().staticSurvivedWithoutTestFiles

      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({ exitCode: SUCCEEDED, stdout: '', stderr: '', strykerRuns: [theLanesHunks] })
    })

    it('is what draws the warning, as a run given --testFiles whose report holds only a static mutant Killed and a Survived one not static draws none', () => {
      const { exitCode, stdout, stderr, strykerRuns } = runs().noStaticSurvivedWithTestFiles

      expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
        exitCode: SUCCEEDED,
        stdout: '',
        stderr: '',
        strykerRuns: [[...theLanesHunks, TEST_FILES, LANE_TEST_FILE]],
      })
    })

    it('is warned of without changing the exit code of a round that fails on a mutant that ran no test, whose failure is printed as without --testFiles', () => {
      const withoutTestFiles = runs().oneRanNoTestWithoutTestFiles
      const { exitCode, stderr } = runs().oneRanNoTestWithTestFiles

      expect([withoutTestFiles.exitCode, exitCode]).toStrictEqual([FAILED, FAILED])
      expect(withoutTestFiles.stderr).toContain(`  ${LANE_FILE}:${SURVIVED_NOT_STATIC_LINE}:${MUTANT_COLUMN} ${MUTATOR_NAME}\n`)
      expect(withoutTestFiles.stderr).not.toContain(LOAD_TIME_WARNING)
      expect(stderr).toContain(withoutTestFiles.stderr)
      expect(stderr).toContain(loadTimeWarningNaming([STATIC_SURVIVED_LINE]))
    })
  })
})

describe('the round script, where git ignores one of two untracked files a config mutates, with Stryker replaced by a stand-in that records how each run was started', () => {
  const runs = setUpRunsBeforeTheSuite(
    (tempProjects) => {
      const repo = createRoundRepo(
        tempProjects,
        { [HOUSE_CONFIG]: strykerModuleConfig(HOUSE_PATTERNS), [HOUSE_GIT_IGNORE]: gitIgnoreOf([LOCAL_FILES]) },
        (project) => {
          project.write(UNTRACKED_FILE, moduleOfLines(NEW_RULE_LINES))
          project.write(IGNORED_FILE, moduleOfLines(NEW_RULE_LINES))
        },
      )
      return { ignoredFileOnDisk: existsSync(repo.pathOf(IGNORED_FILE)), ...repo.runTheRound([HOUSE_CONFIG]) }
    },
    { timeoutMs: PARALLEL_LOAD_TIMEOUT_MS, whatFailed: 'the round script could not be run in a scratch repo before the suite' },
  )

  it('hands Stryker the untracked file git does not ignore whole, and never the one it ignores', () => {
    const { ignoredFileOnDisk, exitCode, stdout, stderr, strykerRuns } = runs()

    expect(ignoredFileOnDisk).toBe(true)
    expect({ exitCode, stdout, stderr, strykerRuns }).toStrictEqual({
      exitCode: SUCCEEDED,
      stdout: '',
      stderr: '',
      strykerRuns: [[...RUN_MUTATION, HOUSE_CONFIG, '--mutate', UNTRACKED_FILE]],
    })
  })
})
