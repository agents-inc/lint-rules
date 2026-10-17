import type { Catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import { type ChangedLines, isOnChangedLines, WHOLE_FILE_LINE } from './changed-lines.ts'
import { type OxlintDiagnostic, ruleIdOfOxlintCode } from './oxlint-output.ts'
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
 * One parse error per file, ESLint's where both report one. ESLint's other messages that name no
 * rule are its own notes, and left out.
 */
export function findingsIn(reports: FileReports, catalog: Catalog): CheckFinding[] {
  const parseError = parseErrorIn(reports)
  if (parseError !== null) return [parseError]
  const findings = [...ruleFindingsIn(reports, catalog), ...unusedSuppressionsIn(reports)]
  return findings.filter(({ line }) => isOnChangedLines(line, reports.changed))
}

function parseErrorIn({ file, eslintMessages, oxlintDiagnostics }: FileReports): CheckFinding | null {
  const eslintParseError = eslintMessages.find(({ fatal }) => fatal === true)
  if (eslintParseError !== undefined) return parseErrorFinding(file, eslintParseError.line, eslintParseError.message)
  const oxlintParseError = oxlintDiagnostics.find(isParseError)
  if (oxlintParseError !== undefined) return parseErrorFinding(file, lineOf(oxlintParseError), oxlintParseError.message)
  return null
}

function ruleFindingsIn({ file, changed, eslintMessages, oxlintDiagnostics }: FileReports, catalog: Catalog): CheckFinding[] {
  return [
    ...eslintMessages.flatMap((message) => eslintRuleFindings(file, message)),
    ...oxlintDiagnostics.flatMap((diagnostic) => oxlintRuleFindings(file, diagnostic, changed, catalog)),
  ]
}

function eslintRuleFindings(file: string, { ruleId, line, severity, message }: Linter.LintMessage): CheckFinding[] {
  if (ruleId === null) return []
  return [{ file, line, label: ruleId, severity: severityOfEslint(severity), message }]
}

function oxlintRuleFindings(file: string, diagnostic: OxlintDiagnostic, changed: ChangedLines, catalog: Catalog): CheckFinding[] {
  const { code, severity, message } = diagnostic
  if (code === null || isParseError(diagnostic)) return []
  return [{ file, line: lineOfTheChange(diagnostic, changed), label: ruleIdOfOxlintCode(code, catalog), severity: severityOfOxlint(severity), message }]
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

function lineOf({ spans: [first] }: OxlintDiagnostic): number {
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
