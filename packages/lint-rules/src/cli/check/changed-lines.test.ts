import { describe, expect, it } from 'vitest'
import {
  A_HUNK_OF_MANY_LINES,
  A_NEW_FILE,
  ADDS_REPLACES_AND_DELETES,
  HEADER_LOOKALIKES,
  NO_NEWLINE_AT_THE_END,
  ONLY_DELETES,
} from '../../__tests__/cases/git-diffs.ts'
import { linesChanged, wholeFileChanged } from '../../__tests__/factories/check-factories.ts'
import { addedLinesIn, isOnChangedLines } from './changed-lines.ts'

// spec-cli.md "K: check", steps 7 and 15 (q-c9): a file's changed lines are the lines its
// `git diff -U0` adds; a finding counts by its start line, and one at line 0, about the whole file,
// only where the whole file changed.

describe('addedLinesIn', () => {
  it('reads each hunk by the new side of its header: a count of 2 adds two lines, a count left out adds one, a count of 0 none', () => {
    expect(addedLinesIn(ADDS_REPLACES_AND_DELETES)).toStrictEqual([3, 4, 12])
  })

  it('reads a hunk whose counts have two digits', () => {
    expect(addedLinesIn(A_HUNK_OF_MANY_LINES)).toStrictEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44])
  })

  it('reads every line of a new file', () => {
    expect(addedLinesIn(A_NEW_FILE)).toStrictEqual([1, 2, 3])
  })

  it('reads no line from a change that only deletes', () => {
    expect(addedLinesIn(ONLY_DELETES)).toStrictEqual([])
  })

  it("reads only the hunk header's own numbers, not a header written in its context or in a changed line", () => {
    expect(addedLinesIn(HEADER_LOOKALIKES)).toStrictEqual([1])
  })

  it('reads a change to a last line that ends without a newline', () => {
    expect(addedLinesIn(NO_NEWLINE_AT_THE_END)).toStrictEqual([3])
  })
})

describe('isOnChangedLines', () => {
  it('keeps a finding on any line of a wholly changed file, line 0 included', () => {
    expect([0, 1, 7].map((line) => isOnChangedLines(line, wholeFileChanged()))).toStrictEqual([true, true, true])
  })

  it('keeps a finding whose start line changed, and drops one on a line that did not', () => {
    expect([2, 3, 4, 5].map((line) => isOnChangedLines(line, linesChanged(3, 4)))).toStrictEqual([false, true, true, false])
  })

  it('keeps a finding on the first line, where that line changed', () => {
    expect(isOnChangedLines(1, linesChanged(1, 2))).toBe(true)
  })

  it('drops a finding at line 0 in a file only part of which changed, even where its first line changed', () => {
    expect(isOnChangedLines(0, linesChanged(1, 2))).toBe(false)
  })
})
