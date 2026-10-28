// oxlint reads a JSON config with comments and trailing commas (measured, 1.87). One pass keeps each string
// whole and drops each comment and each trailing comma. After a comma, a comment runs to its line's end or its
// first `*/`, so a bracket inside it never makes the comma trailing, and a long one is read once.
const STRING = String.raw`"(?:[^"\\]|\\.)*"`
const LINE_COMMENT = String.raw`\/\/[^\n]*`
const BLOCK_COMMENT = String.raw`\/\*[\s\S]*?\*\/`
const LINE_COMMENT_TO_ITS_END = String.raw`\/\/[^\n]*(?![^\n])`
const BLOCK_COMMENT_TO_ITS_FIRST_END = String.raw`\/\*(?:[^*]|\*(?!\/))*\*\/`
const TRAILING_COMMA = String.raw`,(?=(?:\s|${LINE_COMMENT_TO_ITS_END}|${BLOCK_COMMENT_TO_ITS_FIRST_END})*[\]}])`
const STRING_COMMENT_OR_TRAILING_COMMA = new RegExp(`(?<string>${STRING})|${LINE_COMMENT}|${BLOCK_COMMENT}|${TRAILING_COMMA}`, 'gu')

export function parsedJsonc(text: string): unknown {
  return JSON.parse(text.replaceAll(STRING_COMMENT_OR_TRAILING_COMMA, keptWhereAString))
}

function keptWhereAString(_match: string, string: string | undefined): string {
  return string === undefined ? '' : string
}
