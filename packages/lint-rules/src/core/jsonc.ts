// oxlint reads a JSON config with comments and trailing commas (measured, 1.87). One pass keeps each string
// whole and drops each comment and each trailing comma. After a comma, a comment runs to its line's end or its
// first `*/`, so a bracket inside it never makes the comma trailing, and a long one is read once.
const STRING_COMMENT_OR_TRAILING_COMMA =
  /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\/|,(?=(?:\s|\/\/[^\n]*(?![^\n])|\/\*(?:[^*]|\*(?!\/))*\*\/)*[\]}])/gu

export function parsedJsonc(text: string): unknown {
  return JSON.parse(text.replace(STRING_COMMENT_OR_TRAILING_COMMA, keptWhereAString))
}

function keptWhereAString(_match: string, string: string | undefined): string {
  return string === undefined ? '' : string
}
