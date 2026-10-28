import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { buildTeamOxlintConfigFrom } from './team-config-factories.ts'

// The oxlint differentials build each team config from a shape's pieces with this, and check our merge of it against
// oxlint's own reading: a piece joined in another way would change the configs they cover, with every spec still passing.

const EARLIER_PIECE: OxlintConfig = {
  plugins: ['unicorn'],
  rules: { eqeqeq: 'error', 'no-debugger': 'warn' },
  overrides: [{ files: ['legacy/**'], rules: { eqeqeq: 'off' } }],
  extends: [{ rules: { 'no-console': 'warn' } }],
}
const LATER_PIECE: OxlintConfig = {
  plugins: ['import'],
  rules: { 'no-debugger': 'off' },
  overrides: [{ files: ['src/**'], rules: { 'no-debugger': 'warn' } }],
  extends: [{ rules: { 'no-alert': 'warn' } }],
}

describe('buildTeamOxlintConfigFrom', () => {
  it("takes a later piece's key over an earlier one's, and joins extends, overrides and rules in order, a later statement of a rule winning", () => {
    expect(buildTeamOxlintConfigFrom([EARLIER_PIECE, LATER_PIECE])).toStrictEqual({
      plugins: ['import'],
      rules: { eqeqeq: 'error', 'no-debugger': 'off' },
      overrides: [
        { files: ['legacy/**'], rules: { eqeqeq: 'off' } },
        { files: ['src/**'], rules: { 'no-debugger': 'warn' } },
      ],
      extends: [{ rules: { 'no-console': 'warn' } }, { rules: { 'no-alert': 'warn' } }],
    })
  })

  it('gives no extends, overrides or rules where no piece gives any', () => {
    expect(buildTeamOxlintConfigFrom([{ plugins: ['unicorn'] }, { env: { browser: true } }])).toStrictEqual({ plugins: ['unicorn'], env: { browser: true } })
  })
})
