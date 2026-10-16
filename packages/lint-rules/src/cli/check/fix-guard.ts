import { type ChangedLines, isOnChangedLines } from './changed-lines.ts'

const LINE_END = /\r?\n/u
const FIRST_LINE = 1
const NOT_FOUND = -1

/**
 * Whether an engine's fixes in one file left every line nobody changed as it was (q-c11, P1): each
 * unchanged line of the text before the fixes is still there, in the same order. Lines may be
 * inserted anywhere, and changed lines modified, moved or deleted. `changed` gives the lines of
 * `before`.
 */
export function keepsUnchangedLines(before: string, after: string, changed: ChangedLines): boolean {
  if (changed.wholeFile) return true
  const unchanged = before.split(LINE_END).filter((_line, index) => !isOnChangedLines(index + FIRST_LINE, changed))
  return isInOrderWithin(unchanged, after.split(LINE_END))
}

/** Whether each of `wanted` appears in `lines`, in order, with any lines between. */
function isInOrderWithin(wanted: readonly string[], lines: readonly string[]): boolean {
  let searchFrom = 0
  for (const line of wanted) {
    const found = lines.indexOf(line, searchFrom)
    if (found === NOT_FOUND) return false
    searchFrom = found + 1
  }
  return true
}
