import { describe, expect, it } from 'vitest'

import candidates from '../data/rule-candidates.json' with { type: 'json' }
import canonicalRules from '../data/rules.json' with { type: 'json' }
import { ACCEPTED_EFFECT_CASES } from './__tests__/cases/accepted-eff.ts'
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

// The Effect rule the owner accepted runs as it ships, through the real ESLint: the house port reports a tag compared
// by hand in a broad Effect catch's callback and stays silent beside it. It ships alone in effect, the libs ruleset the
// owner named on card q-lint-effect-ruleset-name (`libs: { effect: ['effect'] }`), at its defaults and untyped: every
// case reports without type information. The upstream rule it ports never ships, and its waiting entry is gone.

const ENGINES_TIMEOUT_MS = 120_000

const EFFECT_RULESET = 'effect'
const UPSTREAM_RULE = 'anti-slop-effect/no-manual-effect-error-tag'

describe('the Effect rule accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_EFFECT_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-eff-${String(index)}` })))(
    '$title, run as the catalog ships it, reports a tag compared in a broad Effect catch and stays silent on catchTag and outside a handler, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ships alone in effect, in ESLint, at its defaults, untyped, on every file, assigned by the owner on its card', () => {
    const expectedEntries = ACCEPTED_EFFECT_CASES.map(({ rule }) => {
      const accepted = ACCEPTED_ON_2026_10_24[rule]
      if (accepted === undefined) throw new Error(`${rule} is no rule the owner accepted on 2026-10-24`)
      return { id: rule, ruleset: EFFECT_RULESET, engine: 'eslint', options: [], typed: false, assignment: { confidence: 'high', note: accepted.card, by: 'owner-2026-10-24' } }
    })

    expect(canonicalRules.filter(({ ruleset }) => ruleset === EFFECT_RULESET)).toStrictEqual(expectedEntries)
  })

  it('never ships the upstream rule it ports, whose plugin is not installed', () => {
    expect(canonicalRules.filter(({ id }) => id === UPSTREAM_RULE).map(({ id }) => id)).toStrictEqual([])
  })

  it('leaves no entry of the upstream rule waiting in data/rule-candidates.json: the port meets its verdict', () => {
    expect(candidates.filter(({ id }) => id === UPSTREAM_RULE).map(({ id }) => id)).toStrictEqual([])
  })
})
