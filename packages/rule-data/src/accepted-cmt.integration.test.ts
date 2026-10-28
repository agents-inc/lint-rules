import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import { ACCEPTED_CMT_CASES, ACCEPTED_CMT_HELD_CASES } from './__tests__/cases/accepted-cmt.ts'
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

// Each eslint-comments rule the owner accepted runs as it ships where suppressions are allowed, the only place it
// runs, through the real ESLint: it reports the card's comment and stays silent beside it. Where suppressions are
// banned it is off: allow-suppressions.test.ts in packages/lint-rules pins that. A rule whose build waits on a card
// has its case held unrun (ACCEPTED_CMT_HELD_CASES). One describe holds both, since vitest fails a describe left
// with no test, as the shipped cases' is while every rule waits.

const ENGINES_TIMEOUT_MS = 120_000

describe('the eslint-comments rules accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_CMT_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-cmt-${String(index)}` })))(
    '$title, run as the catalog ships it where suppressions are allowed, reports its comment and stays silent beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('whose build waits on a card have a case held unrun only while the rule is accepted and does not ship, the case naming the card its build waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_CMT_HELD_CASES, ACCEPTED_ON_2026_10_24, shippedIds)).toStrictEqual([])
  })
})
