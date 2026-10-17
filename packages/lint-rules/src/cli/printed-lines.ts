import { linesOf } from './text-lines.ts'

const LINE_END = '\n'

export function textOfLines(lines: readonly string[]): string {
  return lines.map((line) => `${line}${LINE_END}`).join('')
}

/** Its newline included. */
export function printedLengthOf(line: string): number {
  return line.length + LINE_END.length
}

/** Each trimmed at its ends; `whenNone` where none says anything. */
export function printedTextOf(outputs: readonly string[], whenNone: string): string {
  const printed = outputs.map((output) => output.trim()).filter((output) => output !== '')
  return printed.length === 0 ? whenNone : printed.join(LINE_END)
}

/** Trimmed; `whenNone` where no line has any text. */
export function firstPrintedLineOf(outputs: readonly string[], whenNone: string): string {
  const first = outputs
    .flatMap(linesOf)
    .map((line) => line.trim())
    .find((line) => line !== '')
  return first === undefined ? whenNone : first
}
