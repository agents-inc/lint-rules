// `@@ -<old lines> +<start>[,<count>] @@`: no count means one line, 0 a deletion alone.
const HUNK_HEADER = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/
const LINES_WHEN_NO_COUNT = '1'

/**
 * The `<file>:<start>-<end>` range Stryker's `--mutate` takes for each hunk in the lines `git diff -U0`
 * printed for `file`. A hunk that only deletes lines gives none: it leaves no line to mutate.
 */
export function changedLineRanges(file: string, diffLines: readonly string[]): string[] {
  return diffLines.flatMap((line) => {
    const hunk = HUNK_HEADER.exec(line)
    if (hunk === null) return []
    const [, start, count = LINES_WHEN_NO_COUNT] = hunk
    if (start === undefined) throw new Error(`git diff printed a hunk with no start line: ${line}`)
    const end = Number(start) + Number(count) - 1
    return Number(count) === 0 ? [] : [`${file}:${start}-${end}`]
  })
}
