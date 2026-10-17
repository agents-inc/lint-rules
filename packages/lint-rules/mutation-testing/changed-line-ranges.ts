import { type AddedSpan, addedSpanOf } from '../src/cli/check/changed-lines.ts'

/** A hunk that only deletes lines gives no range: it leaves no line to mutate. */
export function changedLineRanges(file: string, diffLines: readonly string[]): string[] {
  return diffLines.flatMap((line) => {
    const added = addedSpanOf(line)
    return added === null || added.count === 0 ? [] : [mutateRangeOf(file, added)]
  })
}

function mutateRangeOf(file: string, { start, count }: AddedSpan): string {
  return `${file}:${String(start)}-${String(start + count - 1)}`
}
