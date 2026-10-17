import { describe, expect, it } from 'vitest'
import { gitDiffOutputLines, hunkHeader } from './__tests__/factories/git-diff-factories.ts'
import { changedLineRanges } from './changed-line-ranges.ts'

// Headers as git 2.34 prints them: a one-line side has no count, an empty side has count 0.

const FILE = 'packages/lint-rules/src/core/editor-parts.ts'
const ENCLOSING_LINE = 'export function eslintPartGiven(part: unknown) {'

describe('changedLineRanges', () => {
  it('gives a hunk the lines from its start through its count', () => {
    const diff = [hunkHeader({ start: 10, count: 2 }, { start: 12, count: 3 })]

    expect(changedLineRanges(FILE, diff)).toStrictEqual([`${FILE}:12-14`])
  })

  it('gives a hunk whose count git leaves out one line', () => {
    const diff = [hunkHeader({ start: 57 }, { start: 57 })]

    expect(changedLineRanges(FILE, diff)).toStrictEqual([`${FILE}:57-57`])
  })

  it('gives a hunk that only deletes lines no range, beside a hunk that only adds lines', () => {
    const diff = [
      hunkHeader({ start: 5, count: 2 }, { start: 4, count: 0 }),
      hunkHeader({ start: 22, count: 0 }, { start: 21, count: 2 }),
    ]

    expect(changedLineRanges(FILE, diff)).toStrictEqual([`${FILE}:21-22`])
  })

  it('gives a new file every line it holds', () => {
    const diff = [hunkHeader({ start: 0, count: 0 }, { start: 1, count: 20 })]

    expect(changedLineRanges(FILE, diff)).toStrictEqual([`${FILE}:1-20`])
  })

  it('reads a hunk header that ends in the line git adds as context', () => {
    const diff = [hunkHeader({ start: 12 }, { start: 10, count: 2 }, ENCLOSING_LINE)]

    expect(changedLineRanges(FILE, diff)).toStrictEqual([`${FILE}:10-11`])
  })

  it('gives one range per hunk, in order, and reads only hunk headers, not a changed line that looks like one', () => {
    const diff = gitDiffOutputLines(FILE, [
      { header: hunkHeader({ start: 1 }, { start: 1 }), removedLines: ['const a = 1'], addedLines: [hunkHeader({ start: 3 }, { start: 3 })] },
      { header: hunkHeader({ start: 12 }, { start: 10, count: 2 }), removedLines: ['const b = 2'], addedLines: ['const b = 3', 'const c = 4'] },
    ])

    expect(changedLineRanges(FILE, diff)).toStrictEqual([`${FILE}:1-1`, `${FILE}:10-11`])
  })

  it('gives no range for diff output that holds no hunk', () => {
    expect(changedLineRanges(FILE, gitDiffOutputLines(FILE, []))).toStrictEqual([])
  })
})
