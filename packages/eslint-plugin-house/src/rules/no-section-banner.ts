import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { lineStartOf, restOfLine } from '../shared/line-bounds.ts'
import type { Replacement } from '../shared/replacement.ts'

const BANNER = /^\s*[-=*_#~]{4,}\s*$/
// A title between two runs of one banner character each: `--- Setup ---`, `=== Section ===`.
const TITLED_BANNER = /^\s*([-=*_#~])\1+\s+\S(?:.*\S)?\s+([-=*_#~])\2+\s*$/
// At least one run is three long: `--` is a dash in prose, too weak a signal to delete on.
const LONG_EDGE_RUN = /^\s*([-=*_#~])\1{2,}|([-=*_#~])\2{2,}\s*$/
const LABEL =
  /^\s*(component|components|config|constants?|effects?|exports?|handlers?|helpers?|hooks?|imports?|interfaces?|internal|main|private|props|public api|render|setup|state|styles?|types?|utils?)\s*(?::\s*)?$/i
const TRAILING_BLANKS = /[ \t]+$/
// What a name, keyword or number is made of, and the backslash of a `\u` escape starting a name.
const WORD_CHARACTER = /[\p{ID_Continue}$\\]/u
const DIGIT = /\d/u
// A word after it reads as the regular expression's flags.
const REGULAR_EXPRESSION_END = '/'
const DOT = '.'
// Operators code can hold apart that read as one when they touch: `+ +a` as `++a`, `/ /re/` as a `//`
// comment, TypeScript's `a! = 1` as `a != 1`, `1 < <T>a` as a shift, and `a < !--b` or `a <! --b` as
// `<!--`, which opens a comment in CommonJS.
const OPERATOR_PAIRS_READ_AS_ONE = new Set(['++', '--', '//', '!=', '<<', '<!', '!-'])
const SEPARATOR = ' '

function isBlank(line: string): boolean {
  return line.trim() === ''
}

function isBanner(lines: readonly string[]): boolean {
  return lines.some((line) => BANNER.test(line)) && lines.every((line) => BANNER.test(line) || isBlank(line))
}

function onlyLineOf(lines: readonly string[]): string | null {
  const [onlyLine, ...otherLines] = lines
  return onlyLine !== undefined && otherLines.length === 0 ? onlyLine : null
}

// One line only: a framed line inside a longer comment is a heading among its prose.
function isTitledBanner(lines: readonly string[]): boolean {
  const onlyLine = onlyLineOf(lines)
  return onlyLine !== null && TITLED_BANNER.test(onlyLine) && LONG_EDGE_RUN.test(onlyLine)
}

function isLabel(lines: readonly string[]): boolean {
  const onlyLine = onlyLineOf(lines.filter((line) => !isBlank(line)))
  return onlyLine !== null && LABEL.test(onlyLine)
}

function findingOf(comment: TSESTree.Comment): 'banner' | 'label' | null {
  const lines = comment.value.split('\n')
  if (isBanner(lines) || isTitledBanner(lines)) return 'banner'
  if (isLabel(lines)) return 'label'
  return null
}

function indentationOf(line: string): string {
  return line.slice(0, line.length - line.trimStart().length)
}

function spansLines(comment: TSESTree.Comment): boolean {
  return comment.loc.start.line !== comment.loc.end.line
}

/** Whether the lexer would read the characters either side of a deleted comment as one token. */
function areReadAsOneToken(lastBefore: string, firstAfter: string): boolean {
  if (WORD_CHARACTER.test(firstAfter)) return WORD_CHARACTER.test(lastBefore) || lastBefore === REGULAR_EXPRESSION_END
  if (firstAfter === DOT) return DIGIT.test(lastBefore)
  return OPERATOR_PAIRS_READ_AS_ONE.has(lastBefore + firstAfter)
}

/**
 * A space where the code either side of a deleted comment would otherwise run together. Each side is
 * read a whole character at a time: one outside Unicode's basic plane, `𝑎` say, is two UTF-16 units,
 * and neither unit alone is a word character.
 */
function separatorBetween(codeBefore: string, textAfter: string): string {
  const lastBefore = Array.from(codeBefore).at(-1)
  const [firstAfter] = textAfter
  if (lastBefore === undefined || firstAfter === undefined) throw new Error('A comment inside a line was deleted with no code on one side')
  return areReadAsOneToken(lastBefore, firstAfter) ? SEPARATOR : ''
}

/**
 * The comment goes with the blanks before it, and with its line break when alone on its line. One
 * spanning lines between code is a line break to the parser (it can end a `return`), so it becomes one;
 * one inside a line is a separator to the lexer, so it becomes a space where the code either side would
 * otherwise run together.
 */
function replacementOf(text: string, comment: TSESTree.Comment): Replacement {
  const [commentStart, commentEnd] = comment.range
  const lineStart = lineStartOf(text, commentStart)
  const lineBefore = text.slice(lineStart, commentStart)
  const codeBefore = lineBefore.replace(TRAILING_BLANKS, '')
  const start = lineStart + codeBefore.length
  if (codeBefore === '') {
    const takesLineBreak = text[commentEnd] === '\n'
    return { range: [start, takesLineBreak ? commentEnd + 1 : commentEnd], text: '' }
  }
  const lineAfter = restOfLine(text, commentEnd)
  const codeAfter = lineAfter.trimStart()
  if (codeAfter === '') return { range: [start, commentEnd], text: '' }
  if (!spansLines(comment)) return { range: [start, commentEnd], text: separatorBetween(codeBefore, lineAfter) }
  const codeAfterStart = commentEnd + lineAfter.length - codeAfter.length
  return { range: [start, codeAfterStart], text: `\n${indentationOf(lineBefore)}` }
}

export const noSectionBanner = ESLintUtils.RuleCreator.withoutDocs<[], 'banner' | 'label'>({
  meta: {
    type: 'suggestion',
    fixable: 'whitespace',
    docs: { description: 'Disallow section banner and label comments' },
    messages: {
      banner: 'Section banner comments are noise. Delete it.',
      label:
        'A comment that only labels the next declaration is noise. If the file needs these to be navigable, split the file.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const { sourceCode } = context
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          const messageId = findingOf(comment)
          if (messageId === null) continue
          const replacement = replacementOf(sourceCode.text, comment)
          context.report({
            node: comment,
            messageId,
            fix: (fixer) => fixer.replaceTextRange(replacement.range, replacement.text),
          })
        }
      },
    }
  },
})
