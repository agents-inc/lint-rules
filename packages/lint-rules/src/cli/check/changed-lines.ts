import { foundOr } from '@workspace/rule-data/collections'
import { linesOf } from '../text-lines.ts'

/** `wholeFile` where the file is new to git. */
export type ChangedLines = { readonly wholeFile: true } | { readonly wholeFile: false; readonly lines: ReadonlySet<number> }

export type AddedSpan = { readonly start: number; readonly count: number }

// git omits the count where it is 1. Matched only at a line's start.
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(?<start>\d+)(?:,(?<count>\d+))? @@/u
const ONE_LINE = 1

export const WHOLE_FILE_LINE = 0

export const WHOLE_FILE_CHANGED: ChangedLines = { wholeFile: true }

export function addedLinesIn(diffU0: string): number[] {
  return linesOf(diffU0).flatMap(linesAddedByHunkHeader)
}

export function partlyChanged(lines: Iterable<number>): ChangedLines {
  return { wholeFile: false, lines: new Set(lines) }
}

/** Line 0, a whole-file finding, counts only where the whole file changed. */
export function isOnChangedLines(line: number, changed: ChangedLines): boolean {
  if (changed.wholeFile) return true
  return line !== WHOLE_FILE_LINE && changed.lines.has(line)
}

export function addedSpanOf(line: string): AddedSpan | null {
  const groups = HUNK_HEADER.exec(line)?.groups
  if (groups === undefined) return null
  const { start, count } = groups
  const startLine = foundOr(start, `a hunk header with no start line: ${line}`)
  return { start: Number(startLine), count: count === undefined ? ONE_LINE : Number(count) }
}

function linesAddedByHunkHeader(line: string): number[] {
  const added = addedSpanOf(line)
  return added === null ? [] : linesIn(added)
}

function linesIn({ start, count }: AddedSpan): number[] {
  return Array.from({ length: count }, (_unused, offset) => start + offset)
}
