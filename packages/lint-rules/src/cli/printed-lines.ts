const LINE_END = '\n'
const ANY_LINE_END = /\r?\n/u

/** The lines as printed text, each ending in a newline. */
export function textOfLines(lines: readonly string[]): string {
  return lines.map((line) => `${line}${LINE_END}`).join('')
}

/** How many characters the line takes once printed, its newline included. */
export function printedLengthOf(line: string): number {
  return line.length + LINE_END.length
}

/** All the outputs say, taken in order, each trimmed at its ends: `whenNone` where none says anything. */
export function printedTextOf(outputs: readonly string[], whenNone: string): string {
  const printed = outputs.map((output) => output.trim()).filter((output) => output !== '')
  return printed.length === 0 ? whenNone : printed.join(LINE_END)
}

/** The first line with text in the outputs, taken in order, trimmed: `whenNone` where no line has any. */
export function firstPrintedLineOf(outputs: readonly string[], whenNone: string): string {
  const first = outputs
    .flatMap((output) => output.split(ANY_LINE_END))
    .map((line) => line.trim())
    .find((line) => line !== '')
  return first === undefined ? whenNone : first
}
