// Runs Stryker on lines changed since HEAD (staged, unstaged, and untracked files whole).
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { changedLineRanges } from '../packages/lint-rules/mutation-testing/changed-line-ranges.ts'
import { mutantsSurvivedWithoutATest, parseMutationReport } from '../packages/lint-rules/mutation-testing/mutants-survived-without-a-test.ts'
import { configsOfTheRound, exitCodeOfTheRound, isMutated, mutatePatternsOf } from '../packages/lint-rules/mutation-testing/stryker-round.ts'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
// Stryker's default json reporter path.
const MUTATION_REPORT = join(REPO_ROOT, 'reports/mutation/mutation.json')
const LAST_COMMIT = 'HEAD'
// A dry run tests no mutant and writes no report.
const DRY_RUN_ONLY = '--dryRunOnly'
const STRYKER_SUCCEEDED = 0
const EXIT_WHEN_STRYKER_WAS_KILLED = 1
const EXIT_WHEN_A_MUTANT_SURVIVED_WITHOUT_A_TEST = 1

function gitOutputLines(...args: readonly string[]): string[] {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: Number.POSITIVE_INFINITY })
    .split('\n')
    .filter((line) => line !== '')
}

function changedLineRangesOf(file: string): string[] {
  return changedLineRanges(file, gitOutputLines('diff', '-U0', '--no-color', '--no-ext-diff', LAST_COMMIT, '--', file))
}

function mutateArgument(patterns: readonly string[]): string {
  const changedLines = gitOutputLines('diff', '--name-only', '--diff-filter=d', LAST_COMMIT)
    .filter((file) => isMutated(file, patterns))
    .flatMap(changedLineRangesOf)
  const untrackedFiles = gitOutputLines('ls-files', '--others', '--exclude-standard').filter((file) => isMutated(file, patterns))
  return [...changedLines, ...untrackedFiles].join(',')
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

function failOnMutantsSurvivedWithoutATest(survivedWithoutATest: readonly string[]): number {
  if (survivedWithoutATest.length === 0) return STRYKER_SUCCEEDED
  console.error(
    'FAILED: these mutants were reported Survived after running no test, so they are no result. A test file ' +
      'failed to load, or a mutant broke something the tests share. Fix that, then re-run with --force: ' +
      'incremental mode would reuse these results.',
  )
  survivedWithoutATest.forEach((mutant) => console.error(`  ${mutant}`))
  return EXIT_WHEN_A_MUTANT_SURVIVED_WITHOUT_A_TEST
}

function mutateAndCheckTheReport(configFile: string, toMutate: string, strykerArguments: readonly string[]): number {
  const reportModifiedBefore = reportModifiedAt()
  const strykerExit = runStryker(configFile, toMutate, strykerArguments)
  if (strykerExit !== STRYKER_SUCCEEDED || strykerArguments.includes(DRY_RUN_ONLY)) return strykerExit
  return failOnMutantsSurvivedWithoutATest(mutantsSurvivedWithoutATest(parseMutationReport(reportWrittenSince(reportModifiedBefore))))
}

async function mutateTheChangedLinesOf(configFile: string, strykerArguments: readonly string[]): Promise<number> {
  const toMutate = mutateArgument(await mutatePatternsOf(resolve(REPO_ROOT, configFile)))
  if (toMutate === '') {
    console.log(`No changed lines in the files ${configFile} mutates.`)
    return STRYKER_SUCCEEDED
  }
  return mutateAndCheckTheReport(configFile, toMutate, strykerArguments)
}

const { configFiles, strykerArguments } = configsOfTheRound(process.argv.slice(2))
const exitCodes: number[] = []
// One run at a time: the runs share Stryker's working copy and its report.
for (const configFile of configFiles) exitCodes.push(await mutateTheChangedLinesOf(configFile, strykerArguments))
process.exitCode = exitCodeOfTheRound(exitCodes)
