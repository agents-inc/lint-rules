/** The lines of a file a change added: every line where the file is new to git, else the lines its diff adds. */
export type ChangedLines = { readonly wholeFile: true } | { readonly wholeFile: false; readonly lines: ReadonlySet<number> }

// A hunk header of `git diff -U0`: the new side's first line, then its line count, which git leaves
// out where it is 1. Read only from a line that starts with it, never from the text after it.
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(?<start>\d+)(?:,(?<count>\d+))? @@/u
const LINE_END = /\r?\n/u
const ONE_LINE = 1
// A finding about the whole file, which no line holds.
const WHOLE_FILE_LINE = 0

export const WHOLE_FILE_CHANGED: ChangedLines = { wholeFile: true }

/** The lines one file's `git diff -U0` output adds, in order. */
export function addedLinesIn(diffU0: string): number[] {
  return diffU0.split(LINE_END).flatMap(linesAddedByHunkHeader)
}

/** A file of which only the lines given changed. */
export function partlyChanged(lines: Iterable<number>): ChangedLines {
  return { wholeFile: false, lines: new Set(lines) }
}

/** Whether a finding starting at the line counts as the change's (q-c9): line 0, about the whole file, only where the whole file changed. */
export function isOnChangedLines(line: number, changed: ChangedLines): boolean {
  if (changed.wholeFile) return true
  return line !== WHOLE_FILE_LINE && changed.lines.has(line)
}

function linesAddedByHunkHeader(line: string): number[] {
  const groups = HUNK_HEADER.exec(line)?.groups
  if (groups === undefined) return []
  const { start, count } = groups
  if (start === undefined) throw new Error(`a hunk header with no start line: ${line}`)
  const added = count === undefined ? ONE_LINE : Number(count)
  return Array.from({ length: added }, (_unused, offset) => Number(start) + offset)
}
