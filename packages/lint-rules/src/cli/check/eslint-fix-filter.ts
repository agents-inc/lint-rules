import type { Linter } from 'eslint'
import { type ChangedLines, isOnChangedLines } from './changed-lines.ts'

/**
 * ESLint's `fix` predicate for one file (q-c11): a rule's fix on a changed line, unless check
 * withholds that rule's fix. A fix of ESLint's own, which names no rule, never: removing an unused
 * suppression would leave nothing for check to report (q-c15). ESLint's later fix passes report on
 * the text earlier passes fixed, so the lines can shift: the guard on the result has the last word.
 */
export function eslintFixFilter(changed: ChangedLines, withheld: ReadonlyMap<string, string>): (message: Linter.LintMessage) => boolean {
  return ({ ruleId, line }) => ruleId !== null && !withheld.has(ruleId) && isOnChangedLines(line, changed)
}
