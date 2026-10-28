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
const BLOCK_LINE_PREFIX = /^\s*\*?\s?/u

// `/** */` is JSDoc: the format editors read, and what prose explaining why is written in.
function isJsDoc(comment: Readonly<TSESTree.Comment>): boolean {
  return comment.value.startsWith('*')
}

// A block comment after code cannot become a line comment without swallowing the rest of the line.
function isAloneOnItsLines(text: string, [start, end]: Readonly<TSESTree.Range>): boolean {
  return text.slice(lineStartOf(text, start), start).trim() === '' && restOfLine(text, end).trim() === ''
}

// Blank lines between text are kept; the blank first and last lines of a `/*⏎ … ⏎*/` block are not.
function lineCommentBodyOf(comment: Readonly<TSESTree.Comment>): string[] {
  return comment.value
    .split('\n')
    .map((line) => line.replace(BLOCK_LINE_PREFIX, '').trimEnd())
    .filter((line, index, lines) => line !== '' || (index > 0 && index < lines.length - 1))
}

function lineCommentsReplacing(text: string, comment: Readonly<TSESTree.Comment>): Replacement {
  const [start, end] = comment.range
  const lineStart = lineStartOf(text, start)
  const indent = text.slice(lineStart, start)
  const lines = lineCommentBodyOf(comment).map((line) => (line === '' ? `${indent}//` : `${indent}// ${line}`))
  return { range: [lineStart, end], text: lines.join('\n') }
}

function allowPatternOf(pattern: string): RegExp {
  // oxlint-disable-next-line require-unicode-regexp -- a team's pattern is read as written: under u, one escaping a hyphen as `\-` throws, and `.` reads a character outside the basic plane whole where it read half (both pinned in prefer-line-comments.test.ts)
  return new RegExp(pattern)
}

function isAllowed(comment: Readonly<TSESTree.Comment>, allowed: readonly RegExp[]): boolean {
  return allowed.some((pattern) => pattern.test(comment.value))
}

function isConvertible(comment: Readonly<TSESTree.Comment>, text: string, allowed: readonly RegExp[]): boolean {
  return (
    comment.type === AST_TOKEN_TYPES.Block &&
    !isJsDoc(comment) &&
    !isAllowed(comment, allowed) &&
    isAloneOnItsLines(text, comment.range)
  )
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
    const allowed = defaultedOption(RULE_NAME, options.allowPatterns).map(allowPatternOf)
    const { sourceCode } = context

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (!isConvertible(comment, sourceCode.text, allowed)) continue
          const replacement = lineCommentsReplacing(sourceCode.text, comment)
          context.report({
            node: comment,
            messageId: 'block',
            fix(fixer) {
              return fixer.replaceTextRange(replacement.range, replacement.text)
            },
          })
        }
      },
    }
  },
})
