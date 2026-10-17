import { describe, expect, it } from 'vitest'

import {
  bareNextLineDisable,
  blockNextLineDisable,
  blockSameLineDisable,
  directiveInAString,
  disabledAsAWord,
  disableInJsx,
  disableNamingRules,
  disableOfTheBan,
  disableThenEnable,
  disableWithReason,
  eslintEnvComment,
  exportedComment,
  fileLevelDisable,
  globalComment,
  inlineConfigOfTheBan,
  inlineRuleConfig,
  jsdocNamingADirective,
  jsdocShapedLikeADirective,
  lineCommentDisable,
  lineCommentEnable,
  multiLineBlockDisable,
  nextLineDisable,
  noteQuotingADirective,
  oxlintBlockNextLineDisable,
  oxlintDisabledAsAWord,
  oxlintDisableThenEnable,
  oxlintFileLevelDisable,
  oxlintLineCommentDisable,
  oxlintNextLineDisable,
  oxlintSameLineDisable,
  pluginPackageName,
  proseAboutEslint,
  proseNamingADirective,
  sameLineDisable,
  typeScriptDirective,
  unspacedBlockDisable,
  unspacedLineDisable,
} from '../__tests__/cases/no-suppressions.ts'
import { lintWithInlineConfigIgnored } from '../__tests__/house-linter.ts'
import { housePlugin } from '../index.ts'

// Through ESLint with inline config ignored: the rule tester applies directives, so
// `/* eslint-disable */` would silence the report under test. The shipped config sets noInlineConfig.

const RULE_NAME = 'no-suppressions'
const RULE_ID = 'house/no-suppressions'
const FILENAME = 'no-suppressions.js'

type CommentSpan = { line: number; column: number; endLine: number; endColumn: number }

const SUPPRESSIONS: { form: string; code: string; comments: CommentSpan[] }[] = [
  { form: 'a file-level /* eslint-disable */', code: fileLevelDisable, comments: [{ line: 1, column: 1, endLine: 1, endColumn: 21 }] },
  {
    form: 'a /* eslint-disable */ naming rules',
    code: disableNamingRules,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 41 }],
  },
  // ESLint ignores it, but oxlint reads it as a file-level disable.
  { form: 'a // eslint-disable line comment', code: lineCommentDisable, comments: [{ line: 1, column: 1, endLine: 1, endColumn: 18 }] },
  { form: 'a // eslint-disable-next-line', code: nextLineDisable, comments: [{ line: 1, column: 1, endLine: 1, endColumn: 40 }] },
  {
    form: 'a /* eslint-disable-next-line */ block',
    code: blockNextLineDisable,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 43 }],
  },
  {
    form: 'an eslint-disable-next-line naming no rule',
    code: bareNextLineDisable,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 28 }],
  },
  {
    form: 'a // eslint-disable-line after code',
    code: sameLineDisable,
    comments: [{ line: 1, column: 10, endLine: 1, endColumn: 44 }],
  },
  {
    form: 'a /* eslint-disable-line */ block after code',
    code: blockSameLineDisable,
    comments: [{ line: 1, column: 10, endLine: 1, endColumn: 47 }],
  },
  {
    form: 'an /* eslint-disable */ and the /* eslint-enable */ closing it, each',
    code: disableThenEnable,
    comments: [
      { line: 1, column: 1, endLine: 1, endColumn: 33 },
      { line: 3, column: 1, endLine: 3, endColumn: 32 },
    ],
  },
  { form: 'a // eslint-enable line comment', code: lineCommentEnable, comments: [{ line: 2, column: 1, endLine: 2, endColumn: 29 }] },
  {
    form: 'an inline rule config, /* eslint no-debugger: off */',
    code: inlineRuleConfig,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 30 }],
  },
  {
    form: 'a suppression giving its reason after --',
    code: disableWithReason,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 68 }],
  },
  {
    form: 'a //eslint-disable-next-line with no space after the slashes',
    code: unspacedLineDisable,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 39 }],
  },
  { form: 'a /*eslint-disable*/ with no spaces', code: unspacedBlockDisable, comments: [{ line: 1, column: 1, endLine: 1, endColumn: 19 }] },
  {
    form: 'an /* eslint-disable */ spread over three lines',
    code: multiLineBlockDisable,
    comments: [{ line: 1, column: 1, endLine: 3, endColumn: 3 }],
  },
  {
    form: 'an /* eslint-disable */ naming this very rule',
    code: disableOfTheBan,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 43 }],
  },
  {
    form: 'an inline config turning this very rule off',
    code: inlineConfigOfTheBan,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 40 }],
  },
  {
    form: 'an eslint-disable-next-line inside a JSX expression',
    code: disableInJsx,
    comments: [{ line: 3, column: 6, endLine: 3, endColumn: 52 }],
  },
  { form: 'a file-level /* oxlint-disable */', code: oxlintFileLevelDisable, comments: [{ line: 1, column: 1, endLine: 1, endColumn: 21 }] },
  {
    form: 'a // oxlint-disable line comment',
    code: oxlintLineCommentDisable,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 18 }],
  },
  {
    form: 'a // oxlint-disable-next-line',
    code: oxlintNextLineDisable,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 40 }],
  },
  {
    form: 'a /* oxlint-disable-next-line */ block',
    code: oxlintBlockNextLineDisable,
    comments: [{ line: 1, column: 1, endLine: 1, endColumn: 43 }],
  },
  {
    form: 'a // oxlint-disable-line after code',
    code: oxlintSameLineDisable,
    comments: [{ line: 1, column: 10, endLine: 1, endColumn: 44 }],
  },
  // oxlint honours oxlint-enable as ESLint honours eslint-enable (measured, oxlint 1.87).
  {
    form: 'an /* oxlint-disable */ and the /* oxlint-enable */ closing it, each',
    code: oxlintDisableThenEnable,
    comments: [
      { line: 1, column: 1, endLine: 1, endColumn: 33 },
      { line: 3, column: 1, endLine: 3, endColumn: 32 },
    ],
  },
]

// Each was measured against ESLint 10.12 and oxlint 1.87: neither reads it as a suppression.
const NOT_SUPPRESSIONS: { comment: string; code: string }[] = [
  { comment: 'prose naming eslint-disable', code: proseNamingADirective },
  { comment: 'a note quoting eslint-disable after other words', code: noteQuotingADirective },
  { comment: 'prose opening with the word eslint-disabled', code: disabledAsAWord },
  { comment: 'prose opening with the word oxlint-disabled', code: oxlintDisabledAsAWord },
  { comment: 'prose opening with an eslint-plugin package name', code: pluginPackageName },
  // Neither engine reads rule config from a line comment.
  { comment: 'a line comment of prose opening with the word eslint', code: proseAboutEslint },
  { comment: 'a JSDoc block naming eslint-disable', code: jsdocNamingADirective },
  { comment: 'a JSDoc block shaped like /* eslint-disable */', code: jsdocShapedLikeADirective },
  // ESLint 10 reports it itself and oxlint ignores it: it suppresses nothing.
  { comment: 'an /* eslint-env */ comment', code: eslintEnvComment },
  { comment: 'a /* global */ comment, which oxlint ignores and runs no-undef regardless', code: globalComment },
  { comment: 'an /* exported */ comment', code: exportedComment },
  // @typescript-eslint/ban-ts-comment bans these, so they are not reported twice.
  { comment: 'a // @ts-expect-error', code: typeScriptDirective },
  { comment: 'a directive inside a string, which is no comment', code: directiveInAString },
]

function reportsOn(code: string) {
  return lintWithInlineConfigIgnored(RULE_NAME, code, FILENAME).map(
    ({ ruleId, messageId, line, column, endLine, endColumn }) => ({ ruleId, messageId, line, column, endLine, endColumn }),
  )
}

function suppressionReportOver(span: CommentSpan) {
  return { ruleId: RULE_ID, messageId: 'suppression', ...span }
}

describe('house/no-suppressions', () => {
  describe('reports every suppression comment, once each, over the whole comment', () => {
    it.each(SUPPRESSIONS)('$form', ({ code, comments }) => {
      expect(reportsOn(code)).toStrictEqual(comments.map(suppressionReportOver))
    })
  })

  describe('stays silent on comments that are not suppressions', () => {
    it.each(NOT_SUPPRESSIONS)('$comment', ({ code }) => {
      expect(reportsOn(code)).toStrictEqual([])
    })
  })

  describe('its report', () => {
    it('has one message', () => {
      expect(Object.keys(housePlugin.rules[RULE_NAME].meta.messages)).toStrictEqual(['suppression'])
    })

    it('offers no fix and no suggestion: removing a suppression needs the code fixed by hand', () => {
      const offeringARemedy = SUPPRESSIONS.flatMap(({ code }) => lintWithInlineConfigIgnored(RULE_NAME, code, FILENAME))
        .filter(({ fix, suggestions }) => fix !== undefined || suggestions !== undefined)
        .map(({ line, message }) => `${line}: ${message}`)

      expect({ fixable: housePlugin.rules[RULE_NAME].meta.fixable, offeringARemedy }).toStrictEqual({
        fixable: undefined,
        offeringARemedy: [],
      })
    })
  })
})
