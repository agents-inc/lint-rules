// A Survived mutant that ran no test is no result: a test file failed to load, and Stryker doesn't say so.
import { mapValues } from '@workspace/rule-data/collections'
import { isRecord } from '../src/core/is-record.ts'
import type { MutateEntry } from './kept-lines.ts'

type PlaceInAFile = { readonly line: number; readonly column: number }

type PlaceOfAMutant = { readonly start: PlaceInAFile; readonly end: PlaceInAFile }

export type ReportedMutant = {
  readonly mutatorName: string
  readonly status: string
  readonly testsCompleted?: number
  /** In code that runs while modules load. */
  readonly static?: boolean
  readonly location: PlaceOfAMutant
}

export type MutationReport = {
  readonly files: Readonly<Record<string, { readonly mutants: readonly ReportedMutant[] }>>
}

type LineSpan = NonNullable<MutateEntry['lines']>

const SURVIVED = 'Survived'
const NO_COVERAGE = 'NoCoverage'

/** Parse boundary: the JSON report Stryker wrote, read as far as the round reads it. */
export function parseMutationReport(json: string): MutationReport {
  const parsed: unknown = JSON.parse(json)
  if (!isMutationReport(parsed)) throw new Error("Stryker's report is not one the round reads: it lists no file's mutants, each with its mutator, status and place")
  return parsed
}

/**
 * The run's own results, which incremental mode mixes with earlier ones from outside its `--mutate` entries: those lying
 * wholly inside an entry, as Stryker mutates only such code.
 */
export function reportOfTheLinesMutated(report: MutationReport, mutated: readonly MutateEntry[]): MutationReport {
  return { files: mapValues(report.files, ({ mutants }, file) => ({ mutants: mutants.filter((mutant) => isInAnEntry(file, mutant, mutated)) })) }
}

/** Each Survived or NoCoverage mutant, with its status. */
export function mutantsNotCaught(report: MutationReport): string[] {
  return Object.entries(report.files).flatMap(([file, { mutants }]) =>
    mutants.filter(isNotCaught).map((mutant) => `${describeMutant(file, mutant)} ${mutant.status}`),
  )
}

export function mutantsSurvivedWithoutATest(report: MutationReport): string[] {
  return Object.entries(report.files).flatMap(([file, { mutants }]) =>
    mutants
      .filter((mutant) => isSurvived(mutant) && testsRunFor(file, mutant) === 0)
      .map((mutant) => describeMutant(file, mutant)),
  )
}

export function isSurvived(mutant: ReportedMutant): boolean {
  return mutant.status === SURVIVED
}

function isNotCaught(mutant: ReportedMutant): boolean {
  return isSurvived(mutant) || mutant.status === NO_COVERAGE
}

function isInAnEntry(file: string, { location }: ReportedMutant, mutated: readonly MutateEntry[]): boolean {
  return mutated.some((entry) => entry.file === file && (entry.lines === undefined || isWithin(location, entry.lines)))
}

function isWithin({ start, end }: PlaceOfAMutant, lines: LineSpan): boolean {
  return isOnALineOf(start.line, lines) && isOnALineOf(end.line, lines)
}

function isOnALineOf(line: number, { start, end }: LineSpan): boolean {
  return start <= line && line <= end
}

function testsRunFor(file: string, mutant: ReportedMutant): number {
  if (mutant.testsCompleted === undefined) {
    throw new Error(`Stryker's report gives no test count for the Survived mutant ${describeMutant(file, mutant)}`)
  }
  return mutant.testsCompleted
}

export function describeMutant(file: string, { location: { start }, mutatorName }: ReportedMutant): string {
  return `${file}:${start.line}:${start.column} ${mutatorName}`
}

function isMutationReport(value: unknown): value is MutationReport {
  return isRecord(value) && isRecord(value.files) && Object.values(value.files).every((file) => isFileOfMutants(file))
}

function isFileOfMutants(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.mutants) && value.mutants.every((mutant) => isReportedMutant(mutant))
}

function isReportedMutant(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.mutatorName === 'string' &&
    typeof value.status === 'string' &&
    isAbsentOrA(value.testsCompleted, 'number') &&
    isAbsentOrA(value.static, 'boolean') &&
    isLocationInAFile(value.location)
  )
}

function isLocationInAFile(value: unknown): boolean {
  return isRecord(value) && isPlaceInAFile(value.start) && isPlaceInAFile(value.end)
}

function isPlaceInAFile(value: unknown): boolean {
  return isRecord(value) && typeof value.line === 'number' && typeof value.column === 'number'
}

function isAbsentOrA(value: unknown, type: 'number' | 'boolean'): boolean {
  return value === undefined || typeof value === type
}
