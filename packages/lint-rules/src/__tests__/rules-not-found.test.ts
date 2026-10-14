import { describe, expect, it } from 'vitest'
import { rulesNotFoundAmong } from './rules-not-found.ts'

describe('rulesNotFoundAmong', () => {
  it('reads the rule of each "Definition for rule" message, and of no other message', () => {
    expect(
      rulesNotFoundAmong([
        { ruleId: 'nobody/rule', message: "Definition for rule 'nobody/rule' was not found." },
        { ruleId: 'eqeqeq', message: "Expected '===' and instead saw '=='." },
        { ruleId: null, message: "Unused eslint-disable directive (no problems were reported from 'nobody/rule')." },
      ]),
    ).toStrictEqual(['nobody/rule'])
  })
})
