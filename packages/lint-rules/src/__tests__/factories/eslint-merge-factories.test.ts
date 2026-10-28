import { describe, expect, it } from 'vitest'
import { buildEslintMergeShape, buildEslintMergeShapeValue, type EslintMergeShapeValue } from './eslint-merge-factories.ts'

// The ESLint differentials build each shape from its values with this, and check our merge of it against ESLint's
// own calculated config: values joined in another way would change the shapes they cover, with every spec still passing.

const PROJECT = '/project'
const STATING_EQEQEQ: NonNullable<EslintMergeShapeValue['team']['stating']> = {
  ours: 'eqeqeq',
  teams: 'eqeqeq',
  plugins() {
    return {}
  },
  options: [],
  teamsPrefixes: new Map(),
}
const EARLIER_VALUE = buildEslintMergeShapeValue('the earlier value', {
  team: {
    stating: STATING_EQEQEQ,
    scope: { files: ['legacy/**'] },
    entryOf() {
      return 'warn'
    },
  },
  ours: { topLevel: 'warn', ignores: ['**/vendor/**'] },
})
const LATER_VALUE = buildEslintMergeShapeValue('the later value', {
  team: {
    scope: { files: ['src/**'] },
    entryOf() {
      return 'error'
    },
  },
  ours: { topLevel: 'off' },
})

describe('buildEslintMergeShape', () => {
  it("takes a later value's key over an earlier one's, and keeps an earlier key the later value leaves out", () => {
    const { teamConfig, lintRules } = buildEslintMergeShape(PROJECT, [EARLIER_VALUE, LATER_VALUE])

    expect({ teamConfig, rules: lintRules.rules, ignores: lintRules.ignores, fileOverrides: lintRules.fileOverrides }).toStrictEqual({
      teamConfig: [{ name: 'team', files: ['src/**'], plugins: {}, rules: { eqeqeq: 'error' } }],
      rules: { eqeqeq: 'off' },
      ignores: ['**/vendor/**'],
      fileOverrides: undefined,
    })
  })

  it("throws where no value gives the team's name for the rule, where its block applies, or its entry", () => {
    expect(() => buildEslintMergeShape(PROJECT, [LATER_VALUE])).toThrow("a shape gives the name the team states, where the team's block applies, and its entry")
  })
})
