import type { MutationReport, ReportedMutant } from '../../mutants-survived-without-a-test.ts'

export const MUTANT_COLUMN = 7
export const MUTATOR_NAME = 'ConditionalExpression'
const NO_TESTS = 0
const A_NUMBER_WHERE_STRYKER_WRITES_TEXT = 1

/** A report of mutants typed as given, which may be shapes Stryker never writes. */
type ReportOf<Mutant> = { readonly files: Readonly<Record<string, { readonly mutants: readonly Mutant[] }>> }

/** A reported mutant whose field `Field` holds a value of another type than Stryker writes there. */
type MutantWith<Field extends keyof ReportedMutant, Value> = Omit<ReportedMutant, Field> & { readonly [Key in Field]: Value }

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

/** Stryker's report always has a `files` field; this one has none. */
export function reportWithoutAFilesField(): Readonly<Record<string, never>> {
  return {}
}

/** Stryker's report is an object; this one is null. */
export function reportThatIsNull(): null {
  return null
}

/** Stryker gives each file of its report its mutants; this report gives its one file null. */
export function reportOfAFileThatIsNull(file: string): { readonly files: Readonly<Record<string, null>> } {
  return { files: { [file]: null } }
}

/** Stryker lists each file's mutants under `mutants`; this report's one file has no such field. */
export function reportOfAFileWithoutAMutantsField(file: string): { readonly files: Readonly<Record<string, Readonly<Record<string, never>>>> } {
  return { files: { [file]: {} } }
}

/** Stryker reports each mutant as an object; this report's one mutant is null. */
export function reportOfAMutantThatIsNull(file: string): ReportOf<null> {
  return reportOfOne(file, null)
}

/** Stryker places each mutant it reports in its file; this report's one mutant has no place. */
export function reportOfAMutantWithoutAPlace(file: string): { readonly files: Readonly<Record<string, { readonly mutants: ReadonlyArray<Omit<ReportedMutant, 'location'>> }>> } {
  return { files: { [file]: { mutants: [{ mutatorName: MUTATOR_NAME, status: 'Survived', testsCompleted: 0 }] } } }
}

/** Stryker's location of each mutant starts at a place in its file; this report's one mutant has a location with no start. */
export function reportOfAMutantWhoseLocationHasNoStart(file: string): ReportOf<MutantWith<'location', Readonly<Record<string, never>>>> {
  return reportOfOne(file, { mutatorName: MUTATOR_NAME, status: 'Survived', testsCompleted: NO_TESTS, location: {} })
}

/** Stryker names each mutant's mutator in text; this report's one mutant names it by a number. */
export function reportOfAMutantWhoseMutatorIsANumber(file: string, line: number): ReportOf<MutantWith<'mutatorName', number>> {
  return reportOfOne(file, { ...survivedMutant(line, NO_TESTS), mutatorName: A_NUMBER_WHERE_STRYKER_WRITES_TEXT })
}

/** Stryker gives each mutant's status in text; this report's one mutant gives it as a number. */
export function reportOfAMutantWhoseStatusIsANumber(file: string, line: number): ReportOf<MutantWith<'status', number>> {
  return reportOfOne(file, { ...survivedMutant(line, NO_TESTS), status: A_NUMBER_WHERE_STRYKER_WRITES_TEXT })
}

/** Stryker numbers the line it places each mutant on; this report's one mutant is on a line given as text. */
export function reportOfAMutantOnALineGivenAsText(
  file: string,
  line: number,
): ReportOf<MutantWith<'location', { readonly start: { readonly line: string; readonly column: number } }>> {
  return reportOfOne(file, { ...survivedMutant(line, NO_TESTS), location: { start: { line: String(line), column: MUTANT_COLUMN } } })
}

/** Stryker numbers the column it places each mutant at; this report's one mutant is at a column given as text. */
export function reportOfAMutantAtAColumnGivenAsText(
  file: string,
  line: number,
): ReportOf<MutantWith<'location', { readonly start: { readonly line: number; readonly column: string } }>> {
  return reportOfOne(file, { ...survivedMutant(line, NO_TESTS), location: { start: { line, column: String(MUTANT_COLUMN) } } })
}

/** Stryker counts the tests a mutant ran in a number; this report's one Survived mutant, which ran none, counts them in text. */
export function reportOfAMutantWhoseTestCountIsText(file: string, line: number): ReportOf<MutantWith<'testsCompleted', string>> {
  return reportOfOne(file, { ...survivedMutant(line, NO_TESTS), testsCompleted: String(NO_TESTS) })
}

/** Stryker marks each mutant static or not with a boolean; this report's one Survived mutant marks it in text. */
export function reportOfAMutantWhoseStaticFlagIsText(file: string, line: number): ReportOf<MutantWith<'static', string>> {
  return reportOfOne(file, { ...survivedMutant(line, NO_TESTS), static: String(true) })
}

function reportOfOne<Mutant>(file: string, mutant: Mutant): ReportOf<Mutant> {
  return { files: { [file]: { mutants: [mutant] } } }
}
