import { describe, expect, it } from 'vitest'

import { ACCEPTED_A_CASES } from './__tests__/cases/accepted-a.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

// Each rule the owner accepted from a plugin already installed runs as it ships, through the real engines:
// it reports the card's code and stays silent beside it. A rule oxlint runs is run in ESLint too, which
// runs it without oxlint. A rule whose build waits on a card has its case held unrun (ACCEPTED_A_HELD_CASES).

const ENGINES_TIMEOUT_MS = 120_000

describe('the rules accepted on 2026-10-24 from plugins already installed, run as the catalog ships them', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_A_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-a-${String(index)}` })))(
    '$title reports its code and stays silent beside it, on each engine that may run it',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )
})
