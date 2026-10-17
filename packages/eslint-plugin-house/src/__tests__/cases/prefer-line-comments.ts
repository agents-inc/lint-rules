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
