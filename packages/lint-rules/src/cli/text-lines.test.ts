import { describe, expect, it } from 'vitest'
import { linesOf } from './text-lines.ts'

// git, the engines and a file's text may end lines with CRLF or LF, and check reads either as one line end.

describe('linesOf', () => {
  it('splits at each line end, CRLF or LF, leaving no carriage return on a line', () => {
    expect(linesOf('first\r\nsecond\nthird')).toStrictEqual(['first', 'second', 'third'])
  })

  it('gives an empty last line where the text ends with a line end', () => {
    expect(linesOf('only\n')).toStrictEqual(['only', ''])
  })
})
