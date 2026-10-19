import type { Linter } from 'eslint'
import { type ChangedLines, isOnChangedLines } from './changed-lines.ts'

const ESLINT_ERROR = 2

/**
 * check fixes errors alone: a rule a team set to warn is listed, not fixed. ESLint's own fixes, which
 * name no rule, never apply: removing an unused suppression would leave nothing to report. Later fix
 * passes can shift lines, so the guard on the result has the last word.
 */
export function eslintFixFilter(changed: ChangedLines, withheld: ReadonlyMap<string, string>): (message: Linter.LintMessage) => boolean {
  return ({ ruleId, severity, line }) => ruleId !== null && severity === ESLINT_ERROR && !withheld.has(ruleId) && isOnChangedLines(line, changed)
}
