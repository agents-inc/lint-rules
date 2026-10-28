import type { Catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import { type ChangedLines, isOnChangedLines, WHOLE_FILE_LINE } from './changed-lines.ts'
import { labelOfOxlintCode, type OxlintDiagnostic } from './oxlint-output.ts'
import type { CheckFinding } from './report.ts'
import { PARSE_ERROR_LABEL, UNUSED_SUPPRESSION_LABEL, unusedSuppressionMessage } from './texts.ts'
import { isAboutADirectiveComment, namesSuppressingNothing } from './unused-suppressions.ts'

export type FileReports = {
  /** Relative to the config's folder, with forward slashes. */
  readonly file: string
  readonly text: string
  readonly changed: ChangedLines
  readonly suppressionsAllowed: boolean
  readonly eslintMessages: readonly Linter.LintMessage[]
  readonly oxlintDiagnostics: readonly OxlintDiagnostic[]
}

type Severity = CheckFinding['severity']

const ESLINT_WARNING = 1
const OXLINT_WARNING = 'warning'
// oxlint's own TypeScript syntax checks report under a TS code and no rule: `TS(1036)` (oxlint 1.87).
const TYPESCRIPT_SYNTAX_CODE = /^TS\(\d+\)$/u

/**
 * One parse error per file, ESLint's where both report one. Where oxlint read a file ESLint could not,
 * oxlint's findings follow ESLint's parse error. ESLint's other messages that name no rule are its own
 * notes, and left out.
 */
export function findingsIn(reports: FileReports, catalog: Readonly<Catalog>): CheckFinding[] {
  const eslintParseError = eslintParseErrorIn(reports)
  const oxlintParseError = oxlintParseErrorIn(reports)
  if (oxlintParseError !== null) return [eslintParseError ?? oxlintParseError]
  const findings = findingsOnChangedLines(reports, catalog)
  return eslintParseError === null ? findings : [eslintParseError, ...findings]
}

function findingsOnChangedLines(reports: FileReports, catalog: Readonly<Catalog>): CheckFinding[] {
  return [...ruleFindingsIn(reports, catalog), ...unusedSuppressionsIn(reports)].filter(({ line }) => isOnChangedLines(line, reports.changed))
}

function eslintParseErrorIn({ file, eslintMessages }: FileReports): CheckFinding | null {
  const parseError = eslintMessages.find(({ fatal }) => fatal === true)
  return parseError === undefined ? null : parseErrorFinding(file, lineOfEslintsParseError(parseError), parseError.message)
}

function oxlintParseErrorIn({ file, oxlintDiagnostics }: FileReports): CheckFinding | null {
  const parseError = oxlintDiagnostics.find(isParseError)
  return parseError === undefined ? null : parseErrorFinding(file, lineOf(parseError), parseError.message)
}

function ruleFindingsIn({ file, changed, eslintMessages, oxlintDiagnostics }: FileReports, catalog: Readonly<Catalog>): CheckFinding[] {
  return [
    ...eslintMessages.flatMap((message) => eslintRuleFindings(file, message)),
    ...oxlintDiagnostics.flatMap((diagnostic) => oxlintRuleFindings(file, diagnostic, changed, catalog)),
  ]
}

function eslintRuleFindings(file: string, { ruleId, line, severity, message }: Readonly<Linter.LintMessage>): CheckFinding[] {
  if (ruleId === null) return []
  return [{ file, line, label: ruleId, severity: severityOfEslint(severity), message }]
}

function oxlintRuleFindings(file: string, diagnostic: OxlintDiagnostic, changed: ChangedLines, catalog: Readonly<Catalog>): CheckFinding[] {
  const { code, severity, message } = diagnostic
  if (code === null || isParseError(diagnostic)) return []
  return [{ file, line: lineOfTheChange(diagnostic, changed), label: labelOfOxlintCode(code, catalog), severity: severityOfOxlint(severity), message }]
}

function unusedSuppressionsIn({ file, text, suppressionsAllowed, eslintMessages, oxlintDiagnostics }: FileReports): CheckFinding[] {
  if (!suppressionsAllowed) return []
  return namesSuppressingNothing(eslintMessages, oxlintDiagnostics, { file, text }).map(({ line, ruleName }) => unusedSuppressionFinding(file, line, ruleName))
}

function isParseError({ code, message }: OxlintDiagnostic): boolean {
  return code === null ? !isAboutADirectiveComment(message) : TYPESCRIPT_SYNTAX_CODE.test(code)
}

function parseErrorFinding(file: string, line: number, message: string): CheckFinding {
  return { file, line, label: PARSE_ERROR_LABEL, severity: 'error', message }
}

function unusedSuppressionFinding(file: string, line: number, ruleName: string): CheckFinding {
  return { file, line, label: UNUSED_SUPPRESSION_LABEL, severity: 'error', message: unusedSuppressionMessage(ruleName) }
}

/**
 * Parse boundary: for a TS file the project service finds in no tsconfig, ESLint's parse error has no
 * line, though its type gives one (measured, ESLint 10.12). It is then about the whole file.
 */
function lineOfEslintsParseError({ line }: Pick<Partial<Linter.LintMessage>, 'line'>): number {
  return line === undefined ? WHOLE_FILE_LINE : line
}

function lineOf({ spans }: OxlintDiagnostic): number {
  const [first] = spans
  return first === undefined ? WHOLE_FILE_LINE : first.line
}

/**
 * oxlint reports a duplicate at the code it repeats too, older code first, so the first place on a
 * changed line is the agent's.
 */
function lineOfTheChange(diagnostic: OxlintDiagnostic, changed: ChangedLines): number {
  const changedPlace = diagnostic.spans.find(({ line }) => isOnChangedLines(line, changed))
  return changedPlace === undefined ? lineOf(diagnostic) : changedPlace.line
}

function severityOfEslint(severity: Linter.LintMessage['severity']): Severity {
  return severity === ESLINT_WARNING ? 'warning' : 'error'
}

/** Anything oxlint does not call a warning is an error: check fails closed. */
function severityOfOxlint(severity: string): Severity {
  return severity === OXLINT_WARNING ? 'warning' : 'error'
}
