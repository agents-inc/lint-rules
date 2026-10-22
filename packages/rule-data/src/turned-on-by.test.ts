import { describe, expect, it } from 'vitest'

import { TEST_FILE_GLOBS } from './__tests__/cases/test-file-globs.ts'
import { parseSuppressionModeSetting, parseTurnedOnBy } from './turned-on-by.ts'

const RULE_ID = '@typescript-eslint/ban-ts-comment'
const RULESET = 'comments'
const BANNED_OPTIONS: readonly unknown[] = [{ 'ts-expect-error': true }]
const ALLOWED_OPTIONS: readonly unknown[] = [{ 'ts-expect-error': 'allow-with-description' }]
const NOT_EXACTLY_ONE_WAY = new Error(`${RULE_ID} needs exactly one of a ruleset, alwaysOn: true and whenSuppressions`)

describe('parseTurnedOnBy', () => {
  it('takes a ruleset as what turns the rule on', () => {
    expect(parseTurnedOnBy(RULE_ID, { ruleset: RULESET })).toStrictEqual({ ruleset: RULESET })
  })

  it('takes alwaysOn: true as a rule on whatever rulesets are listed', () => {
    expect(parseTurnedOnBy(RULE_ID, { alwaysOn: true })).toStrictEqual({ alwaysOn: true })
  })

  it("takes whenSuppressions as given: each mode's setting, and the test-file setting", () => {
    const whenSuppressions = {
      banned: 'off',
      allowed: { options: ALLOWED_OPTIONS },
      bannedInTestFiles: { files: TEST_FILE_GLOBS, options: ALLOWED_OPTIONS },
    }

    expect(parseTurnedOnBy(RULE_ID, { whenSuppressions })).toStrictEqual({ whenSuppressions })
  })

  it('refuses a ruleset beside whenSuppressions, as the canonical list gives them: routing keeps whenSuppressions alone', () => {
    expect(() =>
      parseTurnedOnBy(RULE_ID, { ruleset: RULESET, whenSuppressions: { banned: 'off', allowed: { options: ALLOWED_OPTIONS } } }),
    ).toThrow(NOT_EXACTLY_ONE_WAY)
  })

  it('refuses a ruleset beside alwaysOn: true', () => {
    expect(() => parseTurnedOnBy(RULE_ID, { ruleset: RULESET, alwaysOn: true })).toThrow(NOT_EXACTLY_ONE_WAY)
  })

  it('refuses a rule nothing turns on: alwaysOn: false is no way', () => {
    expect(() => parseTurnedOnBy(RULE_ID, { alwaysOn: false })).toThrow(NOT_EXACTLY_ONE_WAY)
  })
})

describe('parseSuppressionModeSetting', () => {
  it('takes off, and options, as themselves', () => {
    expect([parseSuppressionModeSetting(RULE_ID, 'off'), parseSuppressionModeSetting(RULE_ID, { options: BANNED_OPTIONS })]).toStrictEqual([
      'off',
      { options: BANNED_OPTIONS },
    ])
  })

  it("refuses any other word, quoting it: the canonical list's on included, which routing gives as options", () => {
    expect(() => parseSuppressionModeSetting(RULE_ID, 'on')).toThrow(
      new Error(`${RULE_ID}: "on" is not a suppression-mode setting (off, or { options })`),
    )
  })
})
