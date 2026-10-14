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
