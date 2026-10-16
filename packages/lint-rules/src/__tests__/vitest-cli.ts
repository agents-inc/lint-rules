import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'

/** A test by its title, and how it ended: `passed`, `failed` or `skipped`. */
export type TestOutcome = { readonly title: string; readonly status: string }

/** A test file by its name, and how it ended. A file that fails while it is collected runs no test, and its error is the message. */
export type TestFileOutcome = {
  readonly file: string
  readonly status: string
  readonly message: string
  readonly tests: readonly TestOutcome[]
}

export type VitestCliRun = {
  readonly configFile: string
  /** File filters and options: `-t`, `--bail`, `--pool`. */
  readonly args: readonly string[]
  /** The temp dir the run and every process it starts are given, as `TMPDIR`. */
  readonly tempDir: string
  readonly reportFile: string
}

/** The part of vitest's JSON report read here. */
type VitestJsonReport = {
  readonly testResults: readonly {
    readonly name: string
    readonly status: string
    readonly message: string
    readonly assertionResults: readonly TestOutcome[]
  }[]
}

const VITEST_BIN = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs')
const VITEST_CLI_TIMEOUT_MS = 120_000

/**
 * The vitest CLI run from the config's folder, with the temp dir given: how each test file it ran
 * ended, from its JSON report. A run that wrote no report throws with what it printed.
 */
export function runVitestCli({ configFile, args, tempDir, reportFile }: VitestCliRun): readonly TestFileOutcome[] {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    // No results cache, which vitest would write into node_modules in the config's folder.
    [VITEST_BIN, 'run', '--config', configFile, '--no-cache', '--reporter=json', `--outputFile=${reportFile}`, ...args],
    { cwd: dirname(configFile), encoding: 'utf8', env: { ...process.env, TMPDIR: tempDir }, timeout: VITEST_CLI_TIMEOUT_MS },
  )
  if (!existsSync(reportFile)) throw new Error(`vitest wrote no report (exit ${String(status)}): ${stdout}${stderr}`)
  // Parse boundary: vitest's JSON report.
  const report = JSON.parse(readFileSync(reportFile, 'utf8')) as VitestJsonReport
  return report.testResults.map(({ name, status: fileStatus, message, assertionResults }) => ({
    file: basename(name),
    status: fileStatus,
    message,
    tests: assertionResults.map(({ title, status: testStatus }) => ({ title, status: testStatus })),
  }))
}
