import { describe, expect, it } from 'vitest'
import { severityOfCalculatedEntry } from './calculated-rule-severity.ts'

const OFF = 0
const WARN = 1
const ERROR = 2

describe('severityOfCalculatedEntry', () => {
  it('names the numeric severity ESLint calculates, whatever options follow it', () => {
    expect(
      [[OFF], [WARN, 'always'], [ERROR, { vars: 'all' }]].map((entry) => severityOfCalculatedEntry(entry)),
    ).toStrictEqual(['off', 'warn', 'error'])
  })

  it('reads a rule no block sets as absent rather than off', () => {
    expect(severityOfCalculatedEntry(undefined)).toBeUndefined()
  })

  it('refuses an entry in a shape ESLint never calculates', () => {
    expect(() => severityOfCalculatedEntry('error')).toThrowError(
      new Error('ESLint calculates a rule entry as [0 | 1 | 2, ...options], not "error"'),
    )
    expect(() => severityOfCalculatedEntry(['warn'])).toThrowError(
      new Error('ESLint calculates a rule entry as [0 | 1 | 2, ...options], not ["warn"]'),
    )
  })
})
