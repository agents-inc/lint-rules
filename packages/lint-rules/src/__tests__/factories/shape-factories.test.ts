import { describe, expect, it } from 'vitest'
import { buildConsumerLintRulesFromShape, type OurShapePiece } from './shape-factories.ts'

// The oxlint differentials build our lint rules from a shape's pieces with this: a piece joined in another way would
// change the settings they cover, with every spec still passing.

const PROJECT = '/project'
const EARLIER_PIECE: OurShapePiece = {
  rules: { eqeqeq: 'error', 'no-debugger': 'warn' },
  fileOverrides: [{ files: ['legacy/**'], rules: { eqeqeq: 'off' } }],
  ignores: ['**/vendor/**'],
}
const LATER_PIECE: OurShapePiece = {
  rules: { 'no-debugger': 'off' },
  fileOverrides: [{ files: ['src/**'], rules: { 'no-debugger': 'warn' } }],
  ignores: ['dist/**'],
}

describe('buildConsumerLintRulesFromShape', () => {
  it('joins the rules, a later setting of a rule winning, and the file overrides and ignores in order, suppressions allowed', () => {
    const { rules, fileOverrides, ignores, allowSuppressions } = buildConsumerLintRulesFromShape(PROJECT, [EARLIER_PIECE, LATER_PIECE])

    expect({ rules, fileOverrides, ignores, allowSuppressions }).toStrictEqual({
      rules: { eqeqeq: 'error', 'no-debugger': 'off' },
      fileOverrides: [
        { files: ['legacy/**'], rules: { eqeqeq: 'off' } },
        { files: ['src/**'], rules: { 'no-debugger': 'warn' } },
      ],
      ignores: ['**/vendor/**', 'dist/**'],
      allowSuppressions: true,
    })
  })

  it('gives no ignores where no piece gives any, and gives them where one does', () => {
    expect({
      noneGiven: Object.hasOwn(buildConsumerLintRulesFromShape(PROJECT, [{ rules: { eqeqeq: 'error' } }]), 'ignores'),
      oneGiven: Object.hasOwn(buildConsumerLintRulesFromShape(PROJECT, [{ rules: { eqeqeq: 'error' } }, EARLIER_PIECE]), 'ignores'),
    }).toStrictEqual({ noneGiven: false, oneGiven: true })
  })
})
