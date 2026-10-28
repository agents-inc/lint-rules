import type { OxlintDiagnostic } from '../../cli/check/oxlint-output.ts'
import {
  blockDisable,
  blockEnable,
  DEBUGGER_STATEMENT,
  exportedConstant,
  exportedString,
  exportedTemplate,
  oxlintPartlyUnusedSuppression,
  oxlintUnusedSuppression,
  spanOfLine,
  spanOfTextOnLine,
  suppressionOfTheNextLine,
} from '../factories/check-factories.ts'

export type UnusedAt = { readonly line: number; readonly ruleName: string }

/**
* Disable comments that silenced nothing, one of which oxlint reports at the enable comment closing it: oxlint's
* report (checked in check-factories.test.ts), ESLint's (measured, ESLint 10.12), and what check reports.
*/
export type SuppressionPairCase = {
  readonly shape: string
  readonly lines: readonly string[]
  readonly oxlintReport: (text: string) => OxlintDiagnostic[]
  readonly unusedInEslint: readonly UnusedAt[]
  readonly reported: readonly UnusedAt[]
}

const NO_DEBUGGER = 'no-debugger'
const NO_CONSOLE = 'no-console'
// A rule whose name is longer than the start of an enable comment, `/* eslint-enable `.
const A_LONG_NAME = 'no-unused-private-class-members'
const ENABLE_NO_DEBUGGER = blockEnable({ form: 'eslint', ruleName: NO_DEBUGGER })
// oxlint spans a line comment that silenced nothing up to the line's end, its trailing spaces included (measured, 1.87).
const TRAILING_SPACES = ' '.repeat(3)

// Comment-like text in a string or template is no comment to the engines (measured, oxlint 1.87, ESLint 10.12).
// Each pair below silenced nothing.

/** A pair around a string that holds the text of an enable comment (line 2): oxlint reports the pair at line 3. */
export const A_PAIR_AROUND_A_STRING_HOLDING_AN_ENABLE = [blockDisable('eslint', NO_DEBUGGER), exportedString('between', ENABLE_NO_DEBUGGER), ENABLE_NO_DEBUGGER]

/** A pair around a template literal whose line 3 is the text of an enable comment: oxlint reports the pair at line 5. */
export const A_PAIR_AROUND_A_TEMPLATE_HOLDING_AN_ENABLE = [blockDisable('eslint', NO_DEBUGGER), ...exportedTemplate('between', ENABLE_NO_DEBUGGER), ENABLE_NO_DEBUGGER]

/** A pair (lines 2 to 4) below a string that holds the text of a disable comment: oxlint reports the pair at line 4. */
export const A_PAIR_BELOW_A_STRING_HOLDING_A_DISABLE = [
  exportedString('above', blockDisable('eslint', NO_DEBUGGER)),
  blockDisable('eslint', NO_DEBUGGER),
  exportedConstant('between'),
  ENABLE_NO_DEBUGGER,
]

/** The control beside the one above. */
export const A_PAIR_BELOW_A_STRING_HOLDING_NO_COMMENT = [exportedString('above', 'no comment here'), blockDisable('eslint', NO_DEBUGGER), exportedConstant('between'), ENABLE_NO_DEBUGGER]

export const SUPPRESSION_PAIR_CASES: readonly SuppressionPairCase[] = [
  {
    shape: 'a block pair whose second rule silenced nothing, which oxlint spans in the enable comment',
    lines: ['/* eslint-disable no-debugger, no-console */', DEBUGGER_STATEMENT, '/* eslint-enable no-debugger, no-console */'],
    oxlintReport(text) {
      return [oxlintPartlyUnusedSuppression('eslint', NO_CONSOLE, spanOfTextOnLine(text, 3, NO_CONSOLE))]
    },
    unusedInEslint: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 1, ruleName: NO_CONSOLE },
    ],
    reported: [{ line: 1, ruleName: NO_CONSOLE }],
  },
  {
    shape: "a line-comment pair in oxlint's form whose second rule silenced nothing",
    lines: ['// oxlint-disable no-debugger, no-console', DEBUGGER_STATEMENT, '// oxlint-enable no-debugger, no-console'],
    oxlintReport(text) {
      return [oxlintPartlyUnusedSuppression('oxlint', NO_CONSOLE, spanOfTextOnLine(text, 3, NO_CONSOLE))]
    },
    unusedInEslint: [],
    reported: [{ line: 1, ruleName: NO_CONSOLE }],
  },
  {
    shape: 'an `eslint-disable` comment closed by an `oxlint-enable` one, which oxlint reports in the form of the disable comment',
    lines: [blockDisable('eslint', NO_DEBUGGER), exportedConstant('between'), blockEnable({ form: 'oxlint', ruleName: NO_DEBUGGER })],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 3))]
    },
    unusedInEslint: [{ line: 1, ruleName: NO_DEBUGGER }],
    reported: [{ line: 1, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'two disable comments, then an enable comment of the rule of the first',
    lines: [blockDisable('eslint', NO_DEBUGGER), blockDisable('eslint', NO_CONSOLE), exportedConstant('between'), blockEnable({ form: 'eslint', ruleName: NO_DEBUGGER })],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 4)), oxlintUnusedSuppression('eslint', spanOfLine(text, 2))]
    },
    unusedInEslint: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 2, ruleName: NO_CONSOLE },
    ],
    reported: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 2, ruleName: NO_CONSOLE },
    ],
  },
  {
    shape: 'two disable comments of one rule, then one enable comment, which closes what the first opened',
    lines: [
      blockDisable('eslint', NO_DEBUGGER),
      exportedConstant('first'),
      blockDisable('eslint', NO_DEBUGGER),
      exportedConstant('second'),
      blockEnable({ form: 'eslint', ruleName: NO_DEBUGGER }),
    ],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 5))]
    },
    unusedInEslint: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 3, ruleName: NO_DEBUGGER },
    ],
    reported: [{ line: 1, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a pair below next-line comments of the same rule, a block one and a line one, which open no region',
    lines: [
      '/* eslint-disable-next-line no-debugger */',
      exportedConstant('first'),
      suppressionOfTheNextLine('eslint', NO_DEBUGGER),
      exportedConstant('second'),
      blockDisable('eslint', NO_DEBUGGER),
      exportedConstant('third'),
      blockEnable({ form: 'eslint', ruleName: NO_DEBUGGER }),
    ],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 1)), oxlintUnusedSuppression('eslint', spanOfLine(text, 3)), oxlintUnusedSuppression('eslint', spanOfLine(text, 7))]
    },
    unusedInEslint: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 3, ruleName: NO_DEBUGGER },
      { line: 5, ruleName: NO_DEBUGGER },
    ],
    reported: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 3, ruleName: NO_DEBUGGER },
      { line: 5, ruleName: NO_DEBUGGER },
    ],
  },
  {
    shape: 'a pair whose disable comment runs over three lines',
    lines: ['/* eslint-disable', '   no-debugger', '*/', exportedConstant('between'), blockEnable({ form: 'eslint', ruleName: NO_DEBUGGER })],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 5))]
    },
    unusedInEslint: [{ line: 1, ruleName: NO_DEBUGGER }],
    reported: [{ line: 1, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a pair below a line holding a letter of two UTF-8 bytes',
    lines: [exportedConstant('é'), blockDisable('eslint', NO_DEBUGGER), exportedConstant('between'), blockEnable({ form: 'eslint', ruleName: NO_DEBUGGER })],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 4))]
    },
    unusedInEslint: [{ line: 2, ruleName: NO_DEBUGGER }],
    reported: [{ line: 2, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a pair around a string holding the text of an enable comment',
    lines: A_PAIR_AROUND_A_STRING_HOLDING_AN_ENABLE,
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 3))]
    },
    unusedInEslint: [{ line: 1, ruleName: NO_DEBUGGER }],
    reported: [{ line: 1, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a pair around a template literal holding the text of an enable comment on a line of its own',
    lines: A_PAIR_AROUND_A_TEMPLATE_HOLDING_AN_ENABLE,
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 5))]
    },
    unusedInEslint: [{ line: 1, ruleName: NO_DEBUGGER }],
    reported: [{ line: 1, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a pair below a string holding the text of a disable comment',
    lines: A_PAIR_BELOW_A_STRING_HOLDING_A_DISABLE,
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 4))]
    },
    unusedInEslint: [{ line: 2, ruleName: NO_DEBUGGER }],
    reported: [{ line: 2, ruleName: NO_DEBUGGER }],
  },
  {
    shape: "a pair in oxlint's form below a string holding the text of a disable comment in that form",
    lines: [exportedString('above', blockDisable('oxlint', NO_DEBUGGER)), blockDisable('oxlint', NO_DEBUGGER), exportedConstant('between'), blockEnable({ form: 'oxlint', ruleName: NO_DEBUGGER })],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('oxlint', spanOfLine(text, 4))]
    },
    unusedInEslint: [],
    reported: [{ line: 2, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a pair written with no space inside its delimiters',
    lines: ['/*eslint-disable no-debugger*/', exportedConstant('between'), '/*eslint-enable no-debugger*/'],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 3))]
    },
    unusedInEslint: [{ line: 1, ruleName: NO_DEBUGGER }],
    reported: [{ line: 1, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a pair whose disable comment gives a reason quoting an enable comment',
    lines: ['/* eslint-disable no-debugger -- until the // eslint-enable below */', exportedConstant('between'), ENABLE_NO_DEBUGGER],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 3))]
    },
    unusedInEslint: [{ line: 1, ruleName: NO_DEBUGGER }],
    reported: [{ line: 1, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a pair below a next-line comment whose reason quotes a disable comment',
    lines: [
      '// eslint-disable-next-line no-debugger -- not a // eslint-disable no-debugger region',
      exportedConstant('first'),
      blockDisable('eslint', NO_DEBUGGER),
      exportedConstant('between'),
      ENABLE_NO_DEBUGGER,
    ],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 1)), oxlintUnusedSuppression('eslint', spanOfLine(text, 5))]
    },
    unusedInEslint: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 3, ruleName: NO_DEBUGGER },
    ],
    reported: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 3, ruleName: NO_DEBUGGER },
    ],
  },
  {
    shape: 'a pair whose disable comment, starting a line above, ends where its enable comment starts',
    lines: ['/* eslint-disable', '   no-debugger *//* eslint-enable no-debugger */', exportedConstant('after')],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfTextOnLine(text, 2, ENABLE_NO_DEBUGGER))]
    },
    unusedInEslint: [{ line: 1, ruleName: NO_DEBUGGER }],
    reported: [{ line: 1, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a block pair whose rule of a long name silenced nothing, which oxlint spans first in the enable comment',
    lines: [`/* eslint-disable no-debugger, ${A_LONG_NAME} */`, DEBUGGER_STATEMENT, `/* eslint-enable ${A_LONG_NAME}, no-debugger */`],
    oxlintReport(text) {
      return [oxlintPartlyUnusedSuppression('eslint', A_LONG_NAME, spanOfTextOnLine(text, 3, A_LONG_NAME))]
    },
    unusedInEslint: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 1, ruleName: A_LONG_NAME },
    ],
    reported: [{ line: 1, ruleName: A_LONG_NAME }],
  },
  {
    shape: 'a pair below a string holding no comment text',
    lines: A_PAIR_BELOW_A_STRING_HOLDING_NO_COMMENT,
    oxlintReport(text) {
      return [oxlintUnusedSuppression('eslint', spanOfLine(text, 4))]
    },
    unusedInEslint: [{ line: 2, ruleName: NO_DEBUGGER }],
    reported: [{ line: 2, ruleName: NO_DEBUGGER }],
  },
  {
    shape: 'a pair below a `-line` comment ending in `*/` and spaces, which oxlint spans whole, spaces included',
    lines: [
      `// oxlint-disable-line ${NO_DEBUGGER} */${TRAILING_SPACES}`,
      exportedConstant('first'),
      blockDisable('oxlint', NO_DEBUGGER),
      exportedConstant('between'),
      blockEnable({ form: 'oxlint', ruleName: NO_DEBUGGER }),
    ],
    oxlintReport(text) {
      return [oxlintUnusedSuppression('oxlint', spanOfLine(text, 1)), oxlintUnusedSuppression('oxlint', spanOfLine(text, 5))]
    },
    unusedInEslint: [],
    // oxlint reads the `*/` closing no block as a name too (1.87).
    reported: [
      { line: 1, ruleName: NO_DEBUGGER },
      { line: 1, ruleName: '*/' },
      { line: 3, ruleName: NO_DEBUGGER },
    ],
  },
]
