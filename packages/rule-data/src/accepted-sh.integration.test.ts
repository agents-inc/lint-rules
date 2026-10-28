import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ACCEPTED_SHADCN_CASES } from './__tests__/cases/accepted-sh.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

// The shadcn rule the owner accepted runs as it ships, through the real ESLint: it reports a raw colour and stays
// silent beside it. It ships in tailwind, the opt-in ruleset the owner named on the card, at the plugin's defaults
// and untyped: every case reports without type information.

const ENGINES_TIMEOUT_MS = 120_000

const SHADCN_RULE = /^shadcn\//u

describe('the shadcn rule accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_SHADCN_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-sh-${String(index)}` })))(
    '$title run as the catalog ships it, reports the raw colour and stays silent beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ships, and no other shadcn rule does, in tailwind, in ESLint, at its defaults, untyped, on every file, assigned by the owner on its card', () => {
    const expectedEntries = [...new Set(ACCEPTED_SHADCN_CASES.map(({ rule }) => rule))].map((rule) => {
      const accepted = ACCEPTED_ON_2026_10_24[rule]
      if (accepted === undefined) throw new Error(`${rule} is no rule the owner accepted on 2026-10-24`)
      return { id: rule, ruleset: 'tailwind', engine: 'eslint', options: [], typed: false, assignment: { confidence: 'high', note: accepted.card, by: 'owner-2026-10-24' } }
    })

    expect(canonicalRules.filter(({ id }) => SHADCN_RULE.test(id))).toStrictEqual(expectedEntries)
  })
})
