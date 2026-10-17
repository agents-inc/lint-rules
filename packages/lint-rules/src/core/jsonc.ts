// oxlint reads a JSON config with comments and trailing commas (measured, 1.87). One pass keeps each string
// whole and drops each comment and each trailing comma.
const STRING_COMMENT_OR_TRAILING_COMMA =
  /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\/|,(?=(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*[\]}])/gu

export function parsedJsonc(text: string): unknown {
  return JSON.parse(text.replace(STRING_COMMENT_OR_TRAILING_COMMA, keptWhereAString))
}

function keptWhereAString(_match: string, string: string | undefined): string {
  return string === undefined ? '' : string
}
