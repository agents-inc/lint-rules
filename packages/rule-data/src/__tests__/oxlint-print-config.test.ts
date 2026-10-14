import { describe, expect, it } from 'vitest'

import { buildPrintedOutputWithoutRules, buildPrintedOxlintConfig } from './factories/oxlint-config-factories.ts'
import { printedRuleNamesOf } from './oxlint-print-config.ts'

describe('printedRuleNamesOf', () => {
  it('names every rule a printed config sets, in ascending code-unit order', () => {
    const printed = buildPrintedOxlintConfig(['typescript/no-explicit-any', 'eqeqeq', 'jsx_a11y/alt-text'])

    expect(printedRuleNamesOf(printed)).toStrictEqual(['eqeqeq', 'jsx_a11y/alt-text', 'typescript/no-explicit-any'])
  })

  it('names no rule for a printed config that sets none', () => {
    expect(printedRuleNamesOf(buildPrintedOxlintConfig([]))).toStrictEqual([])
  })

  it('throws on printed output without a rules object, quoting the output', () => {
    expect(() => printedRuleNamesOf(buildPrintedOutputWithoutRules())).toThrow(/no rules object: \{"plugins"/)
  })
})
