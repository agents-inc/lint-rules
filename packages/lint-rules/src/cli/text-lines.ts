const ANY_LINE_END = /\r?\n/u

/** The text's lines, split at each line end, LF or CRLF. */
export function linesOf(text: string): string[] {
  return text.split(ANY_LINE_END)
}
