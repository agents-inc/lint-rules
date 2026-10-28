import { type AddedSpan, addedSpanOf } from '../src/cli/check/changed-lines.ts'

/** A hunk that only deletes lines gives no range: it leaves no line to mutate. */
export function changedLineRanges(file: string, diffLines: readonly string[]): string[] {
  return diffLines
    .map((line) => addedSpanOf(line))
    .filter((added) => hasAddedLines(added))
    .map((added) => mutateRangeOf(file, added))
}

function hasAddedLines(added: AddedSpan | null): added is AddedSpan {
  return added !== null && added.count !== 0
}

function mutateRangeOf(file: string, { start, count }: AddedSpan): string {
  return `${file}:${String(start)}-${String(start + count - 1)}`
}
