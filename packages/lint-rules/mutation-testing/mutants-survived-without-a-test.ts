// A mutant Stryker reports Survived after running no test is not a result: a test file failed to load,
// at the start or after an earlier mutant broke something the tests share, and Stryker counts the
// mutant as uncaught without saying why.

/** The parts of a mutant in Stryker's JSON report (mutation-testing-report-schema) read here. */
export type ReportedMutant = {
  readonly mutatorName: string
  readonly status: string
  readonly testsCompleted?: number
  readonly location: { readonly start: { readonly line: number; readonly column: number } }
}

export type MutationReport = {
  readonly files: Readonly<Record<string, { readonly mutants: readonly ReportedMutant[] }>>
}

const SURVIVED = 'Survived'

export function parseMutationReport(json: string): MutationReport {
  // Parse boundary: the JSON report Stryker wrote.
  return JSON.parse(json) as MutationReport
}

/** Each mutant reported Survived after running no test, as `<file>:<line>:<column> <mutator>`. */
export function mutantsSurvivedWithoutATest(report: MutationReport): string[] {
  return Object.entries(report.files).flatMap(([file, { mutants }]) =>
    mutants
      .filter((mutant) => mutant.status === SURVIVED && testsRunFor(file, mutant) === 0)
      .map((mutant) => describeMutant(file, mutant)),
  )
}

function testsRunFor(file: string, mutant: ReportedMutant): number {
  if (mutant.testsCompleted === undefined) {
    throw new Error(`Stryker's report gives no test count for the Survived mutant ${describeMutant(file, mutant)}`)
  }
  return mutant.testsCompleted
}

function describeMutant(file: string, { location: { start }, mutatorName }: ReportedMutant): string {
  return `${file}:${start.line}:${start.column} ${mutatorName}`
}
