export const blockComment = `/* Total of everything. */
export const total = 1
`

export const lineComment = `// Total of everything.
export const total = 1
`

export const jsdocComment = `/** Total of everything. */
export const total = 1
`

// Matches the value of `blockComment`, which starts after the `/*`.
export const blockCommentPattern = '^ Total'

// Matches one of the rule's default allowPatterns, which keep tooling directives as blocks.
export const toolingDirectiveBlockComment = `/* istanbul ignore next */
export const total = 1
`

// No line break after the comment.
export const blockCommentOnLastLine = `export const total = 1
/* Total of everything. */`

export const lineCommentOnLastLine = `export const total = 1
// Total of everything.`

// One character of code follows the comment, with no line break after it.
export const blockCommentBeforeLastLineBrace = `export function total() {
  return 1
/* end of total */ }`

// A team's allowPatterns are read without the u flag, so `\-` is a hyphen; with it, the pattern is a syntax error.
export const allowPatternEscapingAHyphen = '^ keep\\-me'

export const blockCommentToKeep = `/* keep-me */
export const total = 1
`

// Without the u flag `.` matches one UTF-16 unit, and a character outside Unicode's basic plane is two.
export const allowPatternOfOneCharacter = '^.$'

export const blockCommentOfOneCharacterOutsideTheBasicPlane = `/*😀*/
export const total = 1
`

export const lineCommentOfOneCharacterOutsideTheBasicPlane = `// 😀
export const total = 1
`

export const blockCommentAfterCode = `export const total = 1 /* Total of everything. */
`

export const blockCommentBeforeBlanks = 'export const total = 1\n/* Total of everything. */   \n'

export const lineCommentBeforeBlanks = 'export const total = 1\n// Total of everything.   \n'

// Indented, starred lines, one with no space after its star, and a blank line between paragraphs.
export const indentedMultiLineBlockComment = `export function total() {
  /*
   * First line.
   *
   *Second paragraph.
   */
  return 1
}
`

export const indentedLineComments = `export function total() {
  // First line.
  //
  // Second paragraph.
  return 1
}
`
