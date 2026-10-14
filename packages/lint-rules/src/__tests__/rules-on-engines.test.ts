import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { ruleIdsStatedInEslint, rulesOnInEslint, rulesOnInOxlint } from './rules-on-engines.ts'

// The readers the equivalence specs compare: one that dropped a place a rule is turned on would let
// a rule run twice unseen.

const oxlintConfig: OxlintConfig = {
  rules: { 'no-debugger': ['error'], eqeqeq: 'off' },
  overrides: [
    { files: ['**/*'], env: { node: true } },
    { files: ['**/*'], rules: { 'typescript/ban-ts-comment': ['error', { 'ts-ignore': true }], 'typescript/array-type': 'off' } },
  ],
}

const eslintConfig: Linter.Config[] = [
  { name: 'first', rules: { 'no-console': ['error'], 'no-alert': 'off' } },
  { name: 'second' },
  { name: 'third', rules: { 'max-lines': ['warn', { max: 200 }], 'no-console': [0] } },
]

describe('rulesOnInOxlint', () => {
  it('reads the rules turned on at the top level and in every override, under their canonical IDs, with options', () => {
    expect(rulesOnInOxlint(oxlintConfig)).toStrictEqual([
      { id: 'no-debugger', engine: 'oxlint', options: [] },
      { id: '@typescript-eslint/ban-ts-comment', engine: 'oxlint', options: [{ 'ts-ignore': true }] },
    ])
  })

  it('reads a config with neither top-level rules nor overrides as turning nothing on', () => {
    expect(rulesOnInOxlint({})).toStrictEqual([])
  })
})

describe('rulesOnInEslint', () => {
  it('reads the rules each block turns on, with options, leaving out those turned off', () => {
    expect(rulesOnInEslint(eslintConfig)).toStrictEqual([
      { id: 'no-console', engine: 'eslint', options: [] },
      { id: 'max-lines', engine: 'eslint', options: [{ max: 200 }] },
    ])
  })
})

describe('ruleIdsStatedInEslint', () => {
  it('reads every rule a block sets, to any severity, once and sorted', () => {
    expect(ruleIdsStatedInEslint(eslintConfig)).toStrictEqual(['max-lines', 'no-alert', 'no-console'])
  })
})
