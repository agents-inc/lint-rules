import { NOT_FOUND } from '../not-found.ts'
import { linesOf } from '../text-lines.ts'
import { type ChangedLines, isOnChangedLines } from './changed-lines.ts'

const FIRST_LINE = 1
const FIRST_INDEX = 0

/**
 * Every unchanged line must stay, in order; lines may be inserted anywhere, and changed lines
 * modified, moved or deleted. `changed` gives the lines of `before`.
 */
export function keepsUnchangedLines(before: string, after: string, changed: ChangedLines): boolean {
  if (changed.wholeFile) return true
  const unchanged = linesOf(before).filter((_line, index) => !isOnChangedLines(index + FIRST_LINE, changed))
  return isInOrderWithin(unchanged, linesOf(after))
}

/** Each wanted line is looked for after the one found before it, so two identical lines need two. */
function isInOrderWithin(wanted: readonly string[], lines: readonly string[]): boolean {
  return wanted.reduce((searchFrom, line) => searchFromPast(line, lines, searchFrom), FIRST_INDEX) !== NOT_FOUND
}

/** Where the search goes on from once `line` is found, past it; not found once a line is missing, for every line after it too. */
function searchFromPast(line: string, lines: readonly string[], searchFrom: number): number {
  if (searchFrom === NOT_FOUND) return NOT_FOUND
  const found = lines.indexOf(line, searchFrom)
  return found === NOT_FOUND ? NOT_FOUND : found + 1
}
