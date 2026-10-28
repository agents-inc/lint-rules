import { describe, expect, it } from 'vitest'
import {
  JSONC_TEXT_UNCLOSED,
  JSONC_TEXTS_A_BACKTRACKING_READ_TOOK_SECONDS_ON,
  JSONC_TEXTS_AND_WHAT_THEY_HOLD,
  JSONC_TEXTS_OXLINT_READS_WITH_A_COMMENT_AFTER_A_COMMA,
} from '../__tests__/cases/jsonc-texts.ts'
import { parsedJsonc } from './jsonc.ts'

// A ceiling far above the microseconds a read of these takes, and far below the seconds a backtracking one did.
const READ_CEILING_MS = 100
// So a slow read fails on the time it took, not on vitest's 5 s.
const SLOW_READ_TIMEOUT_MS = 60_000

type TimedRead = { readonly parsed: unknown; readonly ms: number }

function timedRead(text: string): TimedRead {
  const start = performance.now()
  const parsed = parsedJsonc(text)
  return { parsed, ms: performance.now() - start }
}

describe('parsedJsonc', () => {
  it.each(JSONC_TEXTS_AND_WHAT_THEY_HOLD)('reads $how', ({ text, holds }) => {
    expect(parsedJsonc(text)).toStrictEqual(holds)
  })

  it.each(JSONC_TEXTS_OXLINT_READS_WITH_A_COMMENT_AFTER_A_COMMA)('keeps a comma before a value where $how', ({ text, holds }) => {
    expect(parsedJsonc(text)).toStrictEqual(holds)
  })

  it('throws for text that is not JSON once its comments and trailing commas are gone', () => {
    expect(() => parsedJsonc(JSONC_TEXT_UNCLOSED)).toThrow(SyntaxError)
  })

  it.each(JSONC_TEXTS_A_BACKTRACKING_READ_TOOK_SECONDS_ON)(`reads $how in under ${String(READ_CEILING_MS)} ms`, { timeout: SLOW_READ_TIMEOUT_MS }, ({ text, holds }) => {
    const { parsed, ms } = timedRead(text)

    expect(parsed).toStrictEqual(holds)
    expect(ms).toBeLessThan(READ_CEILING_MS)
  })
})
