import {
  A_SUPPRESSION_REASON,
  blockDisable,
  DEBUGGER_STATEMENT,
  suppressionOfTheNextLine,
  suppressionOfTheNextLineWithAReason,
} from '../factories/check-factories.ts'
import { A_LOOSE_EQUALITY } from './check-sources.ts'

// The lines of the files check's run on comment reasons writes: a directive comment on line 1 over a finding on line
// 2, a loose equality with null, which eqeqeq reports in ESLint, or a `debugger`, which no-debugger reports in oxlint.

const SWITCH_EQEQEQ_OFF = 'eqeqeq: "off"'
// "smart" lets `== null` pass, so the comment silences the line without switching the rule off.
const ONLY_CHANGE_EQEQEQS_OPTION = 'eqeqeq: ["error", "smart"]'

export const EQEQEQ_SWITCHED_OFF_FOR_THE_FILE = [`/* eslint ${SWITCH_EQEQEQ_OFF} */`, A_LOOSE_EQUALITY]

export const EQEQEQS_OPTION_CHANGED_FOR_THE_FILE = [`/* eslint ${ONLY_CHANGE_EQEQEQS_OPTION} */`, A_LOOSE_EQUALITY]

export const EQEQEQ_SWITCHED_OFF_FOR_THE_FILE_WITH_A_REASON = [`/* eslint ${SWITCH_EQEQEQ_OFF} -- ${A_SUPPRESSION_REASON} */`, A_LOOSE_EQUALITY]

export const EQEQEQS_OPTION_CHANGED_FOR_THE_FILE_WITH_A_REASON = [`/* eslint ${ONLY_CHANGE_EQEQEQS_OPTION} -- ${A_SUPPRESSION_REASON} */`, A_LOOSE_EQUALITY]

export const EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE = [suppressionOfTheNextLine('eslint', 'eqeqeq'), A_LOOSE_EQUALITY]

export const EQEQEQ_SWITCHED_OFF_FOR_THE_NEXT_LINE_WITH_A_REASON = [suppressionOfTheNextLineWithAReason('eslint', 'eqeqeq', A_SUPPRESSION_REASON), A_LOOSE_EQUALITY]

export const DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING = [suppressionOfTheNextLine('oxlint', 'no-debugger'), DEBUGGER_STATEMENT]

export const DEBUGGER_SWITCHED_OFF_FOR_THE_NEXT_LINE_IN_OXLINTS_SPELLING_WITH_A_REASON = [
  suppressionOfTheNextLineWithAReason('oxlint', 'no-debugger', A_SUPPRESSION_REASON),
  DEBUGGER_STATEMENT,
]

export const DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING = [blockDisable('oxlint', 'no-debugger'), DEBUGGER_STATEMENT]

export const DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_IN_OXLINTS_SPELLING_WITH_A_REASON = [`/* oxlint-disable no-debugger -- ${A_SUPPRESSION_REASON} */`, DEBUGGER_STATEMENT]

/** Line 1 switches no-debugger off for the file in ESLint's spelling, as a line comment ESLint ignores and oxlint obeys, giving no reason. */
export const DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_BY_ESLINTS_LINE_COMMENT = ['// eslint-disable no-debugger', DEBUGGER_STATEMENT]

export const DEBUGGER_SWITCHED_OFF_FOR_THE_FILE_BY_ESLINTS_LINE_COMMENT_WITH_A_REASON = [`// eslint-disable no-debugger -- ${A_SUPPRESSION_REASON}`, DEBUGGER_STATEMENT]
