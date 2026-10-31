import { describe, expect, it } from 'vitest'

import { PROOF_UNICORN_CASES } from './__tests__/cases/proof-unicorn.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

const ENGINES_TIMEOUT_MS = 120_000

describe('the shipped unicorn rules ESLint runs, as the catalog ships them', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(PROOF_UNICORN_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `proof-unicorn-${String(index)}` })))(
    '$title reports its fixture and stays silent on the fixture corrected',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )
})
