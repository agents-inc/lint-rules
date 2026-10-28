import { describe, expect, it } from 'vitest'

import {
  allowPatternEscapingAHyphen,
  allowPatternOfOneCharacter,
  blockComment,
  blockCommentAfterCode,
  blockCommentBeforeBlanks,
  blockCommentBeforeLastLineBrace,
  blockCommentOfOneCharacterOutsideTheBasicPlane,
  blockCommentOnLastLine,
  blockCommentPattern,
  blockCommentToKeep,
  indentedLineComments,
  indentedMultiLineBlockComment,
  jsdocComment,
  lineComment,
  lineCommentBeforeBlanks,
  lineCommentOfOneCharacterOutsideTheBasicPlane,
  lineCommentOnLastLine,
  toolingDirectiveBlockComment,
} from '../__tests__/cases/prefer-line-comments.ts'
import { caseBuildersFor } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

const { invalidCase, validCase } = caseBuildersFor('prefer-line-comments.ts')

houseRuleTester.run('prefer-line-comments', housePlugin.rules['prefer-line-comments'], {
  valid: [
    validCase('stays silent on a JSDoc block', jsdocComment),
    validCase('stays silent on a /* */ block comment matching one of its allowPatterns', blockComment, {
      options: [{ allowPatterns: [blockCommentPattern] }],
    }),
    validCase(
      'stays silent on a tooling directive block comment when its options object leaves allowPatterns out, so the default patterns apply',
      toolingDirectiveBlockComment,
      { options: [{}] },
    ),
    validCase(
      "stays silent on a block comment followed by code on the file's last line, with no line break after it",
      blockCommentBeforeLastLineBrace,
    ),
    validCase(
      'stays silent on a block comment matching an allowPattern that escapes a hyphen, which a pattern read without the u flag accepts',
      blockCommentToKeep,
      { options: [{ allowPatterns: [allowPatternEscapingAHyphen] }] },
    ),
    validCase('stays silent on a // line comment', lineComment),
    validCase('stays silent on a block comment after code on its line', blockCommentAfterCode),
  ],
  invalid: [
    invalidCase('reports a /* */ block comment and rewrites it as a line comment', blockComment, {
      errors: [{ messageId: 'block', line: 1 }],
      output: lineComment,
    }),
    invalidCase(
      "reports a block comment alone on the file's last line, with no line break after it, and rewrites it",
      blockCommentOnLastLine,
      {
        errors: [{ messageId: 'block', line: 2 }],
        output: lineCommentOnLastLine,
      },
    ),
    invalidCase(
      'reports a block comment of one character outside the basic plane that an allowPattern of one character does not match, as it reads the character as two',
      blockCommentOfOneCharacterOutsideTheBasicPlane,
      {
        options: [{ allowPatterns: [allowPatternOfOneCharacter] }],
        errors: [{ messageId: 'block', line: 1 }],
        output: lineCommentOfOneCharacterOutsideTheBasicPlane,
      },
    ),
    invalidCase(
      'reports an indented block comment of starred lines and rewrites each as a line comment at its indent, a blank line between paragraphs kept',
      indentedMultiLineBlockComment,
      {
        errors: [{ messageId: 'block', line: 2 }],
        output: indentedLineComments,
      },
    ),
    invalidCase('reports a block comment followed by blanks on its line and rewrites it', blockCommentBeforeBlanks, {
      errors: [{ messageId: 'block', line: 2 }],
      output: lineCommentBeforeBlanks,
    }),
  ],
})

describe('prefer-line-comments options, as ESLint checks them', () => {
  it('accepts an allowPatterns option and applies it: a tooling directive it does not match is reported', () => {
    const messages = lintWithHouseRule(
      'prefer-line-comments',
      [{ allowPatterns: [blockCommentPattern] }],
      toolingDirectiveBlockComment,
      'prefer-line-comments.js',
    )

    expect(messages.map(({ ruleId }) => ruleId)).toStrictEqual(['house/prefer-line-comments'])
  })

  it('refuses an option key other than allowPatterns', () => {
    expect(() =>
      lintWithHouseRule(
        'prefer-line-comments',
        [{ allowPattern: [blockCommentPattern] }],
        toolingDirectiveBlockComment,
        'prefer-line-comments.js',
      ),
    ).toThrow(/Unexpected property "allowPattern"/u)
  })
})

describe('prefer-line-comments messages, as a user reads them', () => {
  it('asks for line comments', () => {
    const messages = lintWithHouseRule('prefer-line-comments', [], blockComment, 'prefer-line-comments.js')

    expect(messages.map(({ message }) => message)).toStrictEqual(['Use // line comments, not a /* */ block.'])
  })
})
