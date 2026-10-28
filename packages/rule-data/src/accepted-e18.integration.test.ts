import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { ACCEPTED_E18E_CASES } from './__tests__/cases/accepted-e18.ts'
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

// The e18e rule the owner accepted runs as it ships, through the real ESLint: it reports the card's stat call and stays
// silent beside it. It ships in node, since it is about a Node built-in, at the plugin's defaults and untyped: every case
// reports without type information. The other e18e rule the owner accepted waits, parked, for the Node-version category.

const ENGINES_TIMEOUT_MS = 120_000

const E18E_RULE = /^e18e\//u

describe('the e18e rule accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_E18E_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-e18-${String(index)}` })))(
    '$title, run as the catalog ships it, reports a sync stat call a catch answers for and stays silent beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ships, and no other e18e rule does, in node, in ESLint, at its defaults, untyped, on every file, assigned by the spec with correctness as the alternative', () => {
    const expectedEntries = ACCEPTED_E18E_CASES.map(({ rule }) => {
      const accepted = ACCEPTED_ON_2026_10_24[rule]
      if (accepted === undefined) throw new Error(`${rule} is no rule the owner accepted on 2026-10-24`)
      return {
        id: rule,
        ruleset: 'node',
        engine: 'eslint',
        options: [],
        typed: false,
        assignment: { confidence: 'high', alternative: 'correctness', note: accepted.card, by: 'accepted-spec-2026-10-24' },
      }
    })

    expect(canonicalRules.filter(({ id }) => E18E_RULE.test(id))).toStrictEqual(expectedEntries)
  })

  it('leave every other e18e rule unshipped: the one parked for the Node-version category, and each the owner did not accept', () => {
    const casedRules = new Set(ACCEPTED_E18E_CASES.map(({ rule }) => rule))

    expect(canonicalRules.filter(({ id }) => E18E_RULE.test(id) && !casedRules.has(id)).map(({ id }) => id)).toStrictEqual([])
  })
})
