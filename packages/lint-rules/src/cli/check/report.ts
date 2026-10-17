import { EXIT_CLEAN, EXIT_FINDINGS } from '../exit-codes.ts'
import { NOT_FOUND } from '../not-found.ts'
import { printedLengthOf, textOfLines } from '../printed-lines.ts'
import { autofixedLine, cutLine, MESSAGE_SEPARATOR, summaryLine, WARNING_MARK } from './texts.ts'

/** `file` is relative to the config's folder, with forward slashes. */
export type CheckFinding = {
  readonly file: string
  readonly line: number
  /** The rule's ID, or `parse error` or `unused suppression`. */
  readonly label: string
  readonly severity: 'error' | 'warning'
  readonly message: string
}

export type CheckReportInput = {
  readonly findings: readonly CheckFinding[]
  readonly changedFileCount: number
  readonly autofixedFiles: readonly string[]
}

export type CheckReport = { readonly stdout: string; readonly exitCode: number }

type Severity = CheckFinding['severity']

type CutFindings = { readonly printed: readonly CheckFinding[]; readonly cut: readonly CheckFinding[] }

// The finding lines printed, newlines counted, stay within this many characters.
const PRINTED_FINDINGS_CAP = 8000
// A first finding longer than the cap still prints, whole.
const AT_LEAST_ONE = 1

/** Errors first, then warnings, each by path then line; then the cut; the summary last. */
export function checkReport({ findings, changedFileCount, autofixedFiles }: CheckReportInput): CheckReport {
  const unique = findingsOncePerLine(findings)
  const errors = inPrintOrder(unique, 'error')
  const warnings = inPrintOrder(unique, 'warning')
  const { printed, cut } = cutAtTheCap([...errors, ...warnings])
  const lines = [
    ...autofixedLines(autofixedFiles),
    ...printed.map(findingLine),
    ...cutLines(cut),
    summaryLine({
      errors: errors.length,
      warnings: warnings.length,
      filesWithFindings: filesOf(unique).size,
      changedFiles: changedFileCount,
      list: cut.length > 0 ? 'cut' : 'complete',
    }),
  ]
  return { stdout: textOfLines(lines), exitCode: errors.length > 0 ? EXIT_FINDINGS : EXIT_CLEAN }
}

/** The line a stopped run prints alone. Nothing where it names no file. */
export function autofixedStdout(autofixedFiles: readonly string[]): string {
  return textOfLines(autofixedLines(autofixedFiles))
}

/** `src/cart.ts:30 no-console (warning) — <message>` */
export function findingLine({ file, line, label, severity, message }: CheckFinding): string {
  return `${file}:${String(line)} ${label}${severity === 'warning' ? WARNING_MARK : ''}${MESSAGE_SEPARATOR}${message}`
}

/** Identical findings, from both engines or from two passes, print once. */
function findingsOncePerLine(findings: readonly CheckFinding[]): CheckFinding[] {
  return [...new Map(findings.map((finding) => [findingLine(finding), finding])).values()]
}

function inPrintOrder(findings: readonly CheckFinding[], severity: Severity): CheckFinding[] {
  return findings.filter((finding) => finding.severity === severity).toSorted(byPathThenLine)
}

function cutAtTheCap(ordered: readonly CheckFinding[]): CutFindings {
  const printedCount = countWithinTheCap(ordered.map(findingLine))
  return { printed: ordered.slice(0, printedCount), cut: ordered.slice(printedCount) }
}

/** At least one line, however long. */
function countWithinTheCap(lines: readonly string[]): number {
  const printedSoFar = runningTotalsOf(lines.map(printedLengthOf))
  const firstPastTheCap = printedSoFar.findIndex((printed) => printed > PRINTED_FINDINGS_CAP)
  if (firstPastTheCap === NOT_FOUND) return lines.length
  return Math.max(firstPastTheCap, AT_LEAST_ONE)
}

function runningTotalsOf(sizes: readonly number[]): number[] {
  let total = 0
  return sizes.map((size) => {
    total += size
    return total
  })
}

function autofixedLines(autofixedFiles: readonly string[]): string[] {
  return autofixedFiles.length > 0 ? [autofixedLine(autofixedFiles)] : []
}

function cutLines(cut: readonly CheckFinding[]): string[] {
  return cut.length > 0 ? [cutLine(cut.length, filesOf(cut).size)] : []
}

function filesOf(findings: readonly CheckFinding[]): ReadonlySet<string> {
  return new Set(findings.map(({ file }) => file))
}

function byPathThenLine(first: CheckFinding, second: CheckFinding): number {
  return comparedText(first.file, second.file) || first.line - second.line || comparedText(first.label, second.label)
}

/** Code unit order, the same in every locale. */
function comparedText(first: string, second: string): number {
  if (first === second) return 0
  return first < second ? -1 : 1
}
