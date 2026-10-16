import type { Catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import { type ChangedLines, isOnChangedLines } from './changed-lines.ts'
import { type OxlintDiagnostic, ruleIdOfOxlintCode } from './oxlint-output.ts'
import type { CheckFinding } from './report.ts'
import { PARSE_ERROR_LABEL, UNUSED_SUPPRESSION_LABEL, unusedSuppressionMessage } from './texts.ts'
import { isAboutADirectiveComment, namesSuppressingNothing } from './unused-suppressions.ts'

/** What both engines reported on one file, as it is after the fixes, and the lines of it that changed. */
export type FileReports = {
  /** The path check prints: relative to the config's folder, with forward slashes. */
  readonly file: string
  readonly text: string
  readonly changed: ChangedLines
  /** Whether the agent build allows suppression comments in the file (`allowSuppressions`). */
  readonly suppressionsAllowed: boolean
  readonly eslintMessages: readonly Linter.LintMessage[]
  readonly oxlintDiagnostics: readonly OxlintDiagnostic[]
}

type Severity = CheckFinding['severity']

const ESLINT_WARNING = 1
const OXLINT_WARNING = 'warning'
// oxlint's own TypeScript syntax checks report under TypeScript's error code, which names no rule:
// `TS(1036)` for a statement in a `.d.ts` file (measured, 1.87). Its other syntax errors have no code.
const TYPESCRIPT_SYNTAX_CODE = /^TS\(\d+\)$/u
// A finding no span places is about the whole file.
const WHOLE_FILE_LINE = 0

/**
 * The findings in one file that are the change's (q-c9): each rule's on a changed line; one parse
 * error, wherever it is, ESLint's where both report one (q-c10); each unused suppression on a
 * changed line, where suppressions are allowed (q-c15). ESLint's other messages that name no rule
 * are its own notes, and left out.
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

/** The ESLint message as a finding, where a rule reported it. */
function eslintRuleFindings(file: string, { ruleId, line, severity, message }: Linter.LintMessage): CheckFinding[] {
  if (ruleId === null) return []
  return [{ file, line, label: ruleId, severity: severityOfEslint(severity), message }]
}

/** The oxlint diagnostic as a finding under the rule's ID, where a rule reported it. */
function oxlintRuleFindings(file: string, diagnostic: OxlintDiagnostic, changed: ChangedLines, catalog: Catalog): CheckFinding[] {
  const { code, severity, message } = diagnostic
  if (code === null || isParseError(diagnostic)) return []
  return [{ file, line: lineOfTheChange(diagnostic, changed), label: ruleIdOfOxlintCode(code, catalog), severity: severityOfOxlint(severity), message }]
}

function unusedSuppressionsIn({ file, text, suppressionsAllowed, eslintMessages, oxlintDiagnostics }: FileReports): CheckFinding[] {
  if (!suppressionsAllowed) return []
  return namesSuppressingNothing(eslintMessages, oxlintDiagnostics, { file, text }).map(({ line, ruleName }) => unusedSuppressionFinding(file, line, ruleName))
}

/** A diagnostic of oxlint's parser or of its own TypeScript syntax checks: not a rule's, and not one on a suppression or enable comment. */
function isParseError({ code, message }: OxlintDiagnostic): boolean {
  return code === null ? !isAboutADirectiveComment(message) : TYPESCRIPT_SYNTAX_CODE.test(code)
}

function parseErrorFinding(file: string, line: number, message: string): CheckFinding {
  return { file, line, label: PARSE_ERROR_LABEL, severity: 'error', message }
}

function unusedSuppressionFinding(file: string, line: number, ruleName: string): CheckFinding {
  return { file, line, label: UNUSED_SUPPRESSION_LABEL, severity: 'error', message: unusedSuppressionMessage(ruleName) }
}

/** The line of the diagnostic's first place: the whole file's where it gives none. */
function lineOf({ spans: [first] }: OxlintDiagnostic): number {
  return first === undefined ? WHOLE_FILE_LINE : first.line
}

/**
 * The line a finding is printed at: the first of its places on a changed line, else its first
 * (q-c9). oxlint gives a duplicate at the code it repeats too, the older code first, so a duplicate
 * an agent adds beside older code is the agent's, at the agent's line.
 */
function lineOfTheChange(diagnostic: OxlintDiagnostic, changed: ChangedLines): number {
  const changedPlace = diagnostic.spans.find(({ line }) => isOnChangedLines(line, changed))
  return changedPlace === undefined ? lineOf(diagnostic) : changedPlace.line
}

function severityOfEslint(severity: Linter.LintMessage['severity']): Severity {
  return severity === ESLINT_WARNING ? 'warning' : 'error'
}

/** Anything oxlint does not call a warning counts as an error: check fails closed. */
function severityOfOxlint(severity: string): Severity {
  return severity === OXLINT_WARNING ? 'warning' : 'error'
}
