import { describe, expect, it } from 'vitest'
import { suppressionModeSetBy } from './lint-rules-input.ts'

describe('suppressionModeSetBy', () => {
  it.each([
    { given: true, mode: 'allowed' },
    { given: false, mode: 'banned' },
    { given: undefined, mode: null },
  ])('reads $given as $mode', ({ given, mode }) => {
    expect(suppressionModeSetBy(given)).toBe(mode)
  })
})
