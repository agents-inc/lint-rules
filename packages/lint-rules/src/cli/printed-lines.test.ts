import { describe, expect, it } from 'vitest'
import { firstPrintedLineOf } from './printed-lines.ts'

// check.integration.test.ts covers git's usual first line; these pin the others it can start with.

const WHEN_NONE = 'git exited 128'
const FIRST_LINE = 'fatal: not a git repository'
const SECOND_LINE = 'hint: run git init'
const BLANK_LINES = '\n   \n'

describe('the first printed line of some outputs', () => {
  it('skips the outputs and lines that hold only spaces, and trims the first line with text', () => {
    expect(firstPrintedLineOf(['', `${BLANK_LINES}  ${FIRST_LINE}  \n${SECOND_LINE}`], WHEN_NONE)).toBe(FIRST_LINE)
  })

  it('ends the line at a newline alone and at a carriage return and newline alike', () => {
    expect([`${FIRST_LINE}\n${SECOND_LINE}`, `${FIRST_LINE}\r\n${SECOND_LINE}`].map((output) => firstPrintedLineOf([output], WHEN_NONE))).toStrictEqual([
      FIRST_LINE,
      FIRST_LINE,
    ])
  })

  it('gives the text for none where no line has any', () => {
    expect(firstPrintedLineOf(['', BLANK_LINES], WHEN_NONE)).toBe(WHEN_NONE)
  })
})
