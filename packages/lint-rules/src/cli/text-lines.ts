const ANY_LINE_END = /\r?\n/u

export function linesOf(text: string): string[] {
  return text.split(ANY_LINE_END)
}
