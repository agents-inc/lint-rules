import type { MutationReport, ReportedMutant } from '../../mutants-survived-without-a-test.ts'

export const MUTANT_COLUMN = 7
export const MUTATOR_NAME = 'ConditionalExpression'

function mutantAt(line: number, status: string): ReportedMutant {
  return { mutatorName: MUTATOR_NAME, status, location: { start: { line, column: MUTANT_COLUMN } } }
}

export function survivedMutant(line: number, testsCompleted: number): ReportedMutant {
  return { ...mutantAt(line, 'Survived'), testsCompleted }
}

export function killedMutant(line: number, testsCompleted: number): ReportedMutant {
  return { ...mutantAt(line, 'Killed'), testsCompleted }
}

/** Stryker writes no test count for a mutant no test covers. */
export function noCoverageMutant(line: number): ReportedMutant {
  return mutantAt(line, 'NoCoverage')
}

export function survivedMutantWithoutATestCount(line: number): ReportedMutant {
  return mutantAt(line, 'Survived')
}

/** In code that runs while modules load, which Stryker marks `static`. */
export function staticSurvivedMutant(line: number, testsCompleted: number): ReportedMutant {
  return { ...survivedMutant(line, testsCompleted), static: true }
}

export function staticKilledMutant(line: number, testsCompleted: number): ReportedMutant {
  return { ...killedMutant(line, testsCompleted), static: true }
}

/** Stryker marks each mutant static or not; this one it marks not. */
export function survivedMutantNotStatic(line: number, testsCompleted: number): ReportedMutant {
  return { ...survivedMutant(line, testsCompleted), static: false }
}

export function mutationReport(mutantsByFile: Readonly<Record<string, readonly ReportedMutant[]>>): MutationReport {
  return {
    files: Object.fromEntries(Object.entries(mutantsByFile).map(([file, mutants]) => [file, { mutants }])),
  }
}
