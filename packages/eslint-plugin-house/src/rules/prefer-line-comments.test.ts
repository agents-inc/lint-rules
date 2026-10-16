import {
  blockComment,
  blockCommentBeforeLastLineBrace,
  blockCommentOnLastLine,
  blockCommentPattern,
  jsdocComment,
  lineComment,
  lineCommentOnLastLine,
  toolingDirectiveBlockComment,
} from '../__tests__/cases/prefer-line-comments.ts'
import { caseBuildersFor } from '../__tests__/factories/rule-case-factories.ts'
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
  ],
})
