import { type AddedSpan, addedSpanOf } from '../src/cli/check/changed-lines.ts'

/**
 * The `<file>:<start>-<end>` range Stryker's `--mutate` takes for each hunk in the lines `git diff -U0`
 * printed for `file`. A hunk that only deletes lines gives none: it leaves no line to mutate.
 */
export function changedLineRanges(file: string, diffLines: readonly string[]): string[] {
  return diffLines.flatMap((line) => {
    const added = addedSpanOf(line)
    return added === null || added.count === 0 ? [] : [mutateRangeOf(file, added)]
  })
}

function mutateRangeOf(file: string, { start, count }: AddedSpan): string {
  return `${file}:${String(start)}-${String(start + count - 1)}`
}
