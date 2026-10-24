// A run given --testFiles turns a static mutant, in code that runs while modules load, on only after the test files
// have loaded, so the code ran unmutated and its Survived is no result.
import { describeMutant, isSurvived, type MutationReport, type ReportedMutant } from './mutants-survived-without-a-test.ts'

export function loadTimeMutantsSurvived(report: MutationReport): string[] {
  return Object.entries(report.files).flatMap(([file, { mutants }]) =>
    mutants.filter(isALoadTimeMutantSurvived).map((mutant) => describeMutant(file, mutant)),
  )
}

function isALoadTimeMutantSurvived(mutant: ReportedMutant): boolean {
  return isSurvived(mutant) && mutant.static === true
}
