import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ACCEPTED_ZOD_CASES } from './__tests__/cases/accepted-zod.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { foundOr } from './collections.ts'

const ENGINES_TIMEOUT_MS = 120_000

const ZOD_PREFIX = 'zod/'

describe('the zod rules accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_ZOD_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-zod-${String(index)}` })))(
    '$title, run as the catalog ships it, reports the schema and stays silent beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ship, and no other zod rule does, each in zod, in ESLint, at its defaults, untyped, on every file, assigned by the owner on its card', () => {
    const expectedEntries = ACCEPTED_ZOD_CASES.map(({ rule }) => {
      const accepted = foundOr(ACCEPTED_ON_2026_10_24[rule], `${rule} is no rule the owner accepted on 2026-10-24`)
      return { id: rule, ruleset: 'zod', engine: 'eslint', options: [], typed: false, assignment: { confidence: 'high', note: accepted.card, by: 'owner-2026-10-24' } }
    })

    expect(canonicalRules.filter(({ id }) => id.startsWith(ZOD_PREFIX))).toStrictEqual(expectedEntries)
  })
})
