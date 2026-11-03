import type { ReportRun } from '../leftover-copy-runs.ts'

const SUCCEEDED = 0
const WARNING =
  'WARNING: no Stryker run is using these copies of the repo, and every test that walks the repo slows down while they are there. ' +
  'Remove each by hand:'

export function silentReport(): ReportRun {
  return { exitCode: SUCCEEDED, stdout: '', stderr: '' }
}

export function reportNaming(copies: readonly string[]): ReportRun {
  return { exitCode: SUCCEEDED, stdout: '', stderr: [WARNING, ...copies.map((copy) => `  ${copy}`), ''].join('\n') }
}
