export type HunkSpan = { readonly start: number; readonly count?: number }

export type DiffHunk = {
  readonly header: string
  readonly removedLines: readonly string[]
  readonly addedLines: readonly string[]
}

const INDEX_LINE = 'index ac9837c..0359803 100644'
const REMOVED = '-'
const ADDED = '+'

/** A side given no count is printed without one, as git prints a one-line side. */
export function hunkHeader(removed: HunkSpan, added: HunkSpan, enclosingLine?: string): string {
  const header = `@@ -${spanText(removed)} +${spanText(added)} @@`
  return enclosingLine === undefined ? header : `${header} ${enclosingLine}`
}

function spanText({ start, count }: HunkSpan): string {
  return count === undefined ? `${start}` : `${start},${count}`
}

export function gitDiffOutputLines(file: string, hunks: readonly DiffHunk[]): string[] {
  return [
    `diff --git a/${file} b/${file}`,
    INDEX_LINE,
    `--- a/${file}`,
    `+++ b/${file}`,
    ...hunks.flatMap(({ header, removedLines, addedLines }) => [
      header,
      ...removedLines.map((line) => `${REMOVED}${line}`),
      ...addedLines.map((line) => `${ADDED}${line}`),
    ]),
  ]
}
