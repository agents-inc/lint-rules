import {
  blockComment,
  blockCommentPattern,
  jsdocComment,
  lineComment,
  toolingDirectiveBlockComment,
} from '../__tests__/cases/prefer-line-comments.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('prefer-line-comments', housePlugin.rules['prefer-line-comments'], {
  valid: [
    buildValidCase('stays silent on a JSDoc block', jsdocComment, {
      filename: 'prefer-line-comments.ts',
    }),
    buildValidCase('stays silent on a /* */ block comment matching one of its allowPatterns', blockComment, {
      filename: 'prefer-line-comments.ts',
      options: [{ allowPatterns: [blockCommentPattern] }],
    }),
    buildValidCase(
      'stays silent on a tooling directive block comment when its options object leaves allowPatterns out, so the default patterns apply',
      toolingDirectiveBlockComment,
      {
        filename: 'prefer-line-comments.ts',
        options: [{}],
      },
    ),
  ],
  invalid: [
    buildInvalidCase('reports a /* */ block comment and rewrites it as a line comment', blockComment, {
      filename: 'prefer-line-comments.ts',
      errors: [{ messageId: 'block', line: 1 }],
      output: lineComment,
    }),
  ],
})
