import { NOT_FOUND } from '../not-found.ts'
import { linesOf } from '../text-lines.ts'
import { type ChangedLines, isOnChangedLines } from './changed-lines.ts'

const FIRST_LINE = 1

/**
 * Every unchanged line must stay, in order; lines may be inserted anywhere, and changed lines
 * modified, moved or deleted. `changed` gives the lines of `before`.
 */
export function keepsUnchangedLines(before: string, after: string, changed: ChangedLines): boolean {
  if (changed.wholeFile) return true
  const unchanged = linesOf(before).filter((_line, index) => !isOnChangedLines(index + FIRST_LINE, changed))
  return isInOrderWithin(unchanged, linesOf(after))
}

function isInOrderWithin(wanted: readonly string[], lines: readonly string[]): boolean {
  let searchFrom = 0
  for (const line of wanted) {
    const found = lines.indexOf(line, searchFrom)
    if (found === NOT_FOUND) return false
    searchFrom = found + 1
  }
  return true
}
