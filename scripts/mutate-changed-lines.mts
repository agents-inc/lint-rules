// Runs Stryker on lines changed since HEAD (staged, unstaged, and untracked files whole), or on those
// of them in the files and line ranges given to --only.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, matchesGlob, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
/* eslint-disable import-x/no-relative-packages -- the published package's `exports` name only its built entries, and mutation-testing/ must not join them: a consumer would see it */
import { changedLineRanges } from '../packages/lint-rules/mutation-testing/changed-line-ranges.ts'
import {
  changedEntryOf,
  changedLinesKeptTo,
  linesTheRoundIsKeptTo,
  type MutateEntry,
  refuseKeptFilesNoConfigMutates,
} from '../packages/lint-rules/mutation-testing/kept-lines.ts'
import { loadTimeMutantsSurvived } from '../packages/lint-rules/mutation-testing/load-time-mutants-survived.ts'
import {
  mutantsNotCaught,
  mutantsSurvivedWithoutATest,
  parseMutationReport,
  reportOfTheLinesMutated,
} from '../packages/lint-rules/mutation-testing/mutants-survived-without-a-test.ts'
import { configsOfTheRound, exitCodeOfTheRound, isMutated, mutatePatternsOf } from '../packages/lint-rules/mutation-testing/stryker-round.ts'
import { testFilesGiven, testFilesListsWithNoEntry } from '../packages/lint-rules/mutation-testing/test-files-given.ts'
/* eslint-enable import-x/no-relative-packages */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
// Stryker's default json reporter path.
const MUTATION_REPORT = join(REPO_ROOT, 'reports/mutation/mutation.json')
const LAST_COMMIT = 'HEAD'
const MUTATE_LIST_SEPARATOR = ','
// A dry run tests no mutant and writes no report.
const DRY_RUN_ONLY = '--dryRunOnly'
const STRYKER_SUCCEEDED = 0
const EXIT_WHEN_STRYKER_WAS_KILLED = 1
const EXIT_WHEN_A_MUTANT_SURVIVED_WITHOUT_A_TEST = 1
const SURVIVED_WITHOUT_A_TEST =
  'FAILED: these mutants were reported Survived after running no test, so they are no result. A test file ' +
  'failed to load, or a mutant broke something the tests share. Fix that, then re-run with --force: ' +
  'incremental mode would reuse these results.'
const LOAD_TIME_SURVIVED =
  'WARNING: a run given --testFiles turns a load-time (static) mutant on only after the test files have loaded, ' +
  'so these Survived results prove nothing. Re-run each without --testFiles and with --force:'
const NOT_CAUGHT = 'Not caught in the lines this run mutated (Survived or NoCoverage):'

function gitOutputLines(...args: readonly string[]): string[] {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: Infinity })
    .split('\n')
    .filter((line) => line !== '')
}

function changedLineRangesOf(file: string): string[] {
  return changedLineRanges(file, gitOutputLines('diff', '-U0', '--no-color', '--no-ext-diff', LAST_COMMIT, '--', file))
}

// Tracked files changed since the last commit, staged or not.
function changedFilesNotDeleted(): string[] {
  return gitOutputLines('diff', '--name-only', '--diff-filter=d', LAST_COMMIT)
}

function untrackedFilesGitDoesNotIgnore(): string[] {
  return gitOutputLines('ls-files', '--others', '--exclude-standard')
}

function mutateArgument(patterns: readonly string[], keptTo: readonly MutateEntry[] | null): string {
  const changedLines = changedFilesNotDeleted()
    .filter((file) => isMutated(file, patterns))
    .flatMap(changedLineRangesOf)
  const untrackedFiles = untrackedFilesGitDoesNotIgnore().filter((file) => isMutated(file, patterns))
  return changedLinesKeptTo([...changedLines, ...untrackedFiles], keptTo).join(MUTATE_LIST_SEPARATOR)
}

function mutateEntriesOf(toMutate: string): MutateEntry[] {
  return toMutate.split(MUTATE_LIST_SEPARATOR).map(changedEntryOf)
}

function isAFileInTheRepo(file: string): boolean {
  return statSync(join(REPO_ROOT, file), { throwIfNoEntry: false })?.isFile() === true
}

async function mutatePatternsOfTheConfig(configFile: string): Promise<readonly string[]> {
  return mutatePatternsOf(resolve(REPO_ROOT, configFile))
}

async function refuseKeptFilesTheRoundCannotMutate(configFiles: readonly string[], keptTo: readonly MutateEntry[]): Promise<void> {
  const patternsOfEachConfig = await Promise.all(configFiles.map(mutatePatternsOfTheConfig))
  refuseKeptFilesNoConfigMutates(keptTo, patternsOfEachConfig, isAFileInTheRepo)
}

// Stryker drops a --testFiles entry that matches no file, so its spec never runs, and reads a list left with no entry as
// no filter, so every test does.
// eslint-disable-next-line functional/no-return-void -- a refusal: what it finds must stop the round script before Stryker starts, so it throws, and where it finds nothing it has nothing to give back
function refuseTestFilesMatchingNoFile(strykerArguments: readonly string[]): void {
  const listsWithNoEntry = testFilesListsWithNoEntry(strykerArguments)
  if (listsWithNoEntry.length > 0) throw testFilesListsWithNoEntryRefused(listsWithNoEntry)
  const entriesMatchingNoFile = testFilesMatchingNoFile(testFilesGiven(strykerArguments))
  if (entriesMatchingNoFile.length > 0) throw testFilesMatchingNoFileRefused(entriesMatchingNoFile)
}

function testFilesMatchingNoFile(entries: readonly string[]): string[] {
  const files = filesInTheRepo()
  return entries.filter((entry) => !matchesAFile(entry, files))
}

// Untracked files too, but none git ignores: Stryker's configs leave out much the same (node_modules, dist, reports).
function filesInTheRepo(): string[] {
  return gitOutputLines('ls-files', '--cached', '--others', '--exclude-standard').filter(isAFileInTheRepo)
}

// Read as Stryker 10's ProjectReader reads a --testFiles entry: a glob from the folder Stryker runs in, the repo root.
function matchesAFile(entry: string, files: readonly string[]): boolean {
  const pattern = resolve(REPO_ROOT, entry)
  return files.some((file) => matchesGlob(join(REPO_ROOT, file), pattern))
}

function testFilesListsWithNoEntryRefused(lists: readonly string[]): Error {
  const listsAsGiven = lists.map((list) => `"${list}"`).join(', ')
  return new Error(`--testFiles holds no spec or glob in ${listsAsGiven}, so Stryker would run every test: give a comma-separated list of them from the repo root`)
}

function testFilesMatchingNoFileRefused(entries: readonly string[]): Error {
  return new Error(`--testFiles finds no file for ${entries.join(', ')}: give each spec or glob from the repo root, as Stryker reads it`)
}

function runStryker(configFile: string, toMutate: string, strykerArguments: readonly string[]): number {
  const { status } = spawnSync('bun', ['run', 'mutation', configFile, '--mutate', toMutate, ...strykerArguments], { cwd: REPO_ROOT, stdio: 'inherit' })
  return status ?? EXIT_WHEN_STRYKER_WAS_KILLED
}

// File times come from a clock coarser than Date.now(), so a report is new when its time has changed.
function reportModifiedAt(): number | undefined {
  return existsSync(MUTATION_REPORT) ? statSync(MUTATION_REPORT).mtimeMs : undefined
}

function reportWrittenSince(modifiedBefore: number | undefined): string {
  const modifiedAfter = reportModifiedAt()
  if (modifiedAfter === undefined || modifiedAfter === modifiedBefore) {
    throw new Error(`Stryker wrote no report to ${MUTATION_REPORT} in this run, so no mutant was checked for running no test: keep the "json" reporter`)
  }
  return readFileSync(MUTATION_REPORT, 'utf8')
}

function mutantsListedUnder(heading: string, mutants: readonly string[]): string {
  return [heading, ...mutants.map((mutant) => `  ${mutant}`)].join('\n')
}

function failOnMutantsSurvivedWithoutATest(survivedWithoutATest: readonly string[]): number {
  if (survivedWithoutATest.length === 0) return STRYKER_SUCCEEDED
  console.error(mutantsListedUnder(SURVIVED_WITHOUT_A_TEST, survivedWithoutATest))
  return EXIT_WHEN_A_MUTANT_SURVIVED_WITHOUT_A_TEST
}

// eslint-disable-next-line functional/no-return-void -- it warns on stderr, where the person running the round reads it: a value it returned would reach no one
function warnOfLoadTimeMutantsSurvived(loadTimeSurvived: readonly string[]): void {
  if (loadTimeSurvived.length === 0) return
  console.warn(mutantsListedUnder(LOAD_TIME_SURVIVED, loadTimeSurvived))
}

// eslint-disable-next-line functional/no-return-void -- it lists on stdout, where the person running the round reads it: a value it returned would reach no one
function listMutantsNotCaught(notCaught: readonly string[]): void {
  if (notCaught.length === 0) return
  console.log(mutantsListedUnder(NOT_CAUGHT, notCaught))
}

function mutateAndCheckTheReport(configFile: string, toMutate: string, strykerArguments: readonly string[]): number {
  const reportModifiedBefore = reportModifiedAt()
  const strykerExit = runStryker(configFile, toMutate, strykerArguments)
  if (strykerExit !== STRYKER_SUCCEEDED || strykerArguments.includes(DRY_RUN_ONLY)) return strykerExit
  const reportWritten = parseMutationReport(reportWrittenSince(reportModifiedBefore))
  const report = reportOfTheLinesMutated(reportWritten, mutateEntriesOf(toMutate))
  if (testFilesGiven(strykerArguments).length > 0) warnOfLoadTimeMutantsSurvived(loadTimeMutantsSurvived(report))
  const exitCode = failOnMutantsSurvivedWithoutATest(mutantsSurvivedWithoutATest(report))
  listMutantsNotCaught(mutantsNotCaught(report))
  return exitCode
}

function noChangedLinesMessage(configFile: string, keptTo: readonly MutateEntry[] | null): string {
  return keptTo === null
    ? `No changed lines in the files ${configFile} mutates.`
    : `No changed lines in the files given to --only that ${configFile} mutates.`
}

async function mutateTheChangedLinesOf(configFile: string, keptTo: readonly MutateEntry[] | null, strykerArguments: readonly string[]): Promise<number> {
  const patterns = await mutatePatternsOfTheConfig(configFile)
  const toMutate = mutateArgument(patterns, keptTo)
  if (toMutate === '') {
    console.log(noChangedLinesMessage(configFile, keptTo))
    return STRYKER_SUCCEEDED
  }
  return mutateAndCheckTheReport(configFile, toMutate, strykerArguments)
}

/** One run at a time: the runs share Stryker's working copy and its report. */
async function exitCodesOfEachConfigInTurn(
  [configFile, ...rest]: readonly string[],
  keptTo: readonly MutateEntry[] | null,
  strykerArguments: readonly string[],
): Promise<readonly number[]> {
  if (configFile === undefined) return []
  const exitCode = await mutateTheChangedLinesOf(configFile, keptTo, strykerArguments)
  return [exitCode, ...(await exitCodesOfEachConfigInTurn(rest, keptTo, strykerArguments))]
}

const { configFiles, strykerArguments: argumentsAfterTheConfig } = configsOfTheRound(process.argv.slice(2))
const { keptTo, strykerArguments } = linesTheRoundIsKeptTo(argumentsAfterTheConfig)
if (keptTo !== null) await refuseKeptFilesTheRoundCannotMutate(configFiles, keptTo)
refuseTestFilesMatchingNoFile(strykerArguments)
// eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the round's exit code reaches the caller through process.exitCode alone; process.exit would end the process before a buffered write above
process.exitCode = exitCodeOfTheRound(await exitCodesOfEachConfigInTurn(configFiles, keptTo, strykerArguments))
