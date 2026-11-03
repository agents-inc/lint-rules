import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { oxlintCodeOf } from './oxlint-codes.ts'

describe('oxlintCodeOf', () => {
  it.each([
    { ruleId: 'no-debugger', code: 'eslint(no-debugger)', kind: 'a core rule, which oxlint names bare' },
    { ruleId: 'react-hooks/purity', code: 'react(purity)', kind: "a rule oxlint's react plugin runs under another prefix" },
    { ruleId: 'react-hooks/rules-of-hooks', code: 'react-hooks(rules-of-hooks)', kind: 'a hook rule, printed under react-hooks' },
    { ruleId: 'react-hooks/exhaustive-deps', code: 'react-hooks(exhaustive-deps)', kind: 'a hook rule, printed under react-hooks' },
    { ruleId: '@typescript-eslint/no-inferrable-types', code: 'typescript(no-inferrable-types)', kind: 'a rule ESLint runs for us that oxlint has too' },
    { ruleId: 'jsx-a11y/alt-text', code: 'jsx-a11y(alt-text)', kind: 'a rule whose oxlint name spells its plugin otherwise' },
  ])('is $code for $ruleId, $kind', ({ ruleId, code }) => {
    expect(oxlintCodeOf(ruleId, catalog)).toBe(code)
  })

  it('refuses a rule oxlint has no version of', () => {
    expect(() => oxlintCodeOf('perfectionist/sort-objects', catalog)).toThrow(/oxlint has no version of perfectionist\/sort-objects/u)
  })
})
