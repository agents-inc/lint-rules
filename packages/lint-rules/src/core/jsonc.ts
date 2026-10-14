// oxlint reads a JSON config with line and block comments and trailing commas (measured, oxlint
// 1.87 --print-config). One pass over the text keeps each string whole, and drops each comment and
// each comma that only whitespace and comments separate from a closing bracket or brace.
const STRING_COMMENT_OR_TRAILING_COMMA =
  /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\/|,(?=(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*[\]}])/gu

/** The value a JSON text holds, comments and trailing commas allowed. */
export function parsedJsonc(text: string): unknown {
  return JSON.parse(text.replace(STRING_COMMENT_OR_TRAILING_COMMA, keptWhereAString))
}

/** A string is kept as it is; a comment or a trailing comma goes. */
function keptWhereAString(_match: string, string: string | undefined): string {
  return string === undefined ? '' : string
}
