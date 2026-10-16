import { AST_TOKEN_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { lineStartOf, restOfLine } from '../shared/line-bounds.ts'
import type { Replacement } from '../shared/replacement.ts'
import { defaultedOption, stringListOptionSchema } from '../shared/rule-options.ts'

// The schema does not require the key: ESLint fills it from meta.defaultOptions when a config omits it.
type AllowedBlocks = { allowPatterns?: readonly string[] }

type Options = [AllowedBlocks]

const RULE_NAME = 'prefer-line-comments'
// Directives that tooling reads from block comments, which must stay blocks.
const TOOLING_DIRECTIVES: readonly string[] = [
  '^\\s*(eslint|oxlint|ts-|@ts-|prettier|istanbul|c8|v8|webpack|vite|global|globals)',
  '^\\*?\\s*@(ts-|jsx|license|preserve)',
]
const BLOCK_LINE_PREFIX = /^\s*\*?\s?/

// `/** */` is JSDoc: the format editors read, and what prose explaining why is written in.
function isJsDoc(comment: TSESTree.Comment): boolean {
  return comment.value.startsWith('*')
}

// A block comment after code cannot become a line comment without swallowing the rest of the line.
function isAloneOnItsLines(text: string, [start, end]: TSESTree.Range): boolean {
  return text.slice(lineStartOf(text, start), start).trim() === '' && restOfLine(text, end).trim() === ''
}

// Blank lines between text are kept; the blank first and last lines of a `/*⏎ … ⏎*/` block are not.
function lineCommentBodyOf(comment: TSESTree.Comment): string[] {
  return comment.value
    .split('\n')
    .map((line) => line.replace(BLOCK_LINE_PREFIX, '').trimEnd())
    .filter((line, index, lines) => line !== '' || (index > 0 && index < lines.length - 1))
}

// The `//` lines that replace the block, indented as it was.
function lineCommentsReplacing(text: string, comment: TSESTree.Comment): Replacement {
  const [start, end] = comment.range
  const lineStart = lineStartOf(text, start)
  const indent = text.slice(lineStart, start)
  const lines = lineCommentBodyOf(comment).map((line) => (line === '' ? `${indent}//` : `${indent}// ${line}`))
  return { range: [lineStart, end], text: lines.join('\n') }
}

export const preferLineComments = ESLintUtils.RuleCreator.withoutDocs<Options, 'block'>({
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: { description: 'Prefer // line comments over /* */ and /** */ block comments' },
    messages: { block: 'Use // line comments, not a /* */ block.' },
    schema: [stringListOptionSchema('allowPatterns')],
    defaultOptions: [{ allowPatterns: TOOLING_DIRECTIVES }],
  },
  create(context, [options]) {
    const allowed = defaultedOption(RULE_NAME, options.allowPatterns).map((pattern) => new RegExp(pattern))
    const { sourceCode } = context
    const isAllowed = (comment: TSESTree.Comment): boolean => allowed.some((pattern) => pattern.test(comment.value))
    const isConvertible = (comment: TSESTree.Comment): boolean =>
      comment.type === AST_TOKEN_TYPES.Block &&
      !isJsDoc(comment) &&
      !isAllowed(comment) &&
      isAloneOnItsLines(sourceCode.text, comment.range)

    return {
      Program() {
        for (const comment of sourceCode.getAllComments().filter(isConvertible)) {
          const replacement = lineCommentsReplacing(sourceCode.text, comment)
          context.report({
            node: comment,
            messageId: 'block',
            fix: (fixer) => fixer.replaceTextRange(replacement.range, replacement.text),
          })
        }
      },
    }
  },
})
