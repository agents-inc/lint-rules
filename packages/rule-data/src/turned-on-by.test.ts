import { describe, expect, it } from 'vitest'

import { TEST_FILE_GLOBS } from './__tests__/cases/test-file-globs.ts'
import { parseSuppressionModeSetting, parseTurnedOnBy } from './turned-on-by.ts'

const RULE_ID = '@typescript-eslint/ban-ts-comment'
const RULESET = 'comments'
const BANNED_OPTIONS: readonly unknown[] = [{ 'ts-expect-error': true }]
const ALLOWED_OPTIONS: readonly unknown[] = [{ 'ts-expect-error': 'allow-with-description' }]
const NOT_EXACTLY_ONE_WAY = new Error(`${RULE_ID} needs exactly one of a ruleset, alwaysOn: true, offByDefault: true and whenSuppressions`)

describe('parseTurnedOnBy', () => {
  it('takes a ruleset as what turns the rule on', () => {
    expect(parseTurnedOnBy(RULE_ID, { ruleset: RULESET })).toStrictEqual({ ruleset: RULESET })
  })

  it('takes alwaysOn: true as a rule on whatever rulesets are listed', () => {
    expect(parseTurnedOnBy(RULE_ID, { alwaysOn: true })).toStrictEqual({ alwaysOn: true })
  })

  it('takes offByDefault: true as a rule shipped off, on only where a team names it', () => {
    expect(parseTurnedOnBy(RULE_ID, { offByDefault: true })).toStrictEqual({ offByDefault: true })
  })

  it.each([
    { beside: 'a ruleset', fields: { ruleset: RULESET } },
    { beside: 'alwaysOn: true', fields: { alwaysOn: true } },
  ])('refuses offByDefault: true beside $beside', ({ fields }) => {
    expect(() => parseTurnedOnBy(RULE_ID, { ...fields, offByDefault: true })).toThrow(NOT_EXACTLY_ONE_WAY)
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

  it('keeps an editor ruleset beside whenSuppressions', () => {
    const whenSuppressions = { banned: 'off', allowed: { options: ALLOWED_OPTIONS } }

    expect(parseTurnedOnBy(RULE_ID, { whenSuppressions, editorRuleset: RULESET })).toStrictEqual({ whenSuppressions, editorRuleset: RULESET })
  })

  it.each([
    { beside: 'a ruleset', fields: { ruleset: RULESET } },
    { beside: 'alwaysOn: true', fields: { alwaysOn: true } },
    { beside: 'offByDefault: true', fields: { offByDefault: true } },
  ])('refuses an editor ruleset beside $beside, naming the rule', ({ fields }) => {
    expect(() => parseTurnedOnBy(RULE_ID, { ...fields, editorRuleset: RULESET })).toThrow(
      new Error(`${RULE_ID}: an editor ruleset goes only beside whenSuppressions`),
    )
  })

  it('refuses a ruleset beside alwaysOn: true', () => {
    expect(() => parseTurnedOnBy(RULE_ID, { ruleset: RULESET, alwaysOn: true })).toThrow(NOT_EXACTLY_ONE_WAY)
  })

  it.each([
    { way: 'alwaysOn: false', fields: { alwaysOn: false } },
    { way: 'offByDefault: false', fields: { offByDefault: false } },
  ])('refuses a rule nothing turns on: $way is no way', ({ fields }) => {
    expect(() => parseTurnedOnBy(RULE_ID, fields)).toThrow(NOT_EXACTLY_ONE_WAY)
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
