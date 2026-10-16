import { linesOf } from '../text-lines.ts'

/** The lines of a file a change added: every line where the file is new to git, else the lines its diff adds. */
export type ChangedLines = { readonly wholeFile: true } | { readonly wholeFile: false; readonly lines: ReadonlySet<number> }

/** The lines a hunk adds: the first, and how many. */
export type AddedSpan = { readonly start: number; readonly count: number }

// A hunk header of `git diff -U0`: the new side's first line, then its line count, which git leaves
// out where it is 1. Read only from a line that starts with it, never from the text after it.
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(?<start>\d+)(?:,(?<count>\d+))? @@/u
const ONE_LINE = 1

/** The line of a finding about the whole file, which no line holds. */
export const WHOLE_FILE_LINE = 0

export const WHOLE_FILE_CHANGED: ChangedLines = { wholeFile: true }

/** The lines one file's `git diff -U0` output adds, in order. */
export function addedLinesIn(diffU0: string): number[] {
  return linesOf(diffU0).flatMap(linesAddedByHunkHeader)
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

/** The lines the hunk a `git diff -U0` hunk header starts adds: null for any other line. */
export function addedSpanOf(line: string): AddedSpan | null {
  const groups = HUNK_HEADER.exec(line)?.groups
  if (groups === undefined) return null
  const { start, count } = groups
  if (start === undefined) throw new Error(`a hunk header with no start line: ${line}`)
  return { start: Number(start), count: count === undefined ? ONE_LINE : Number(count) }
}

function linesAddedByHunkHeader(line: string): number[] {
  const added = addedSpanOf(line)
  return added === null ? [] : linesIn(added)
}

function linesIn({ start, count }: AddedSpan): number[] {
  return Array.from({ length: count }, (_unused, offset) => start + offset)
}
