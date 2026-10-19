import { describe, expect, it } from 'vitest'
import { VALUES_DESCRIBED_BY_KIND } from '../__tests__/cases/values-described-by-kind.ts'
import { suppressionModeSetBy } from './lint-rules-input.ts'

// The layers read it again after the config is checked, so a value that check let through still throws here.
describe('suppressionModeSetBy', () => {
  it.each([
    { given: true, mode: 'allowed' },
    { given: false, mode: 'banned' },
    { given: undefined, mode: null },
  ])('reads $given as $mode', ({ given, mode }) => {
    expect(suppressionModeSetBy(given)).toBe(mode)
  })

  it.each([...VALUES_DESCRIBED_BY_KIND, { given: 'a string', value: 'false', described: '"false"' }])('throws on $given, describing it', ({ value, described }) => {
    expect(() => suppressionModeSetBy(value)).toThrowError(new Error(`allowSuppressions: ${described} is not true or false`))
  })
})
