import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ACCEPTED_TANSTACK_QUERY_CASES, ACCEPTED_TANSTACK_ROUTER_CASES, ACCEPTED_TSQ_HELD_CASES } from './__tests__/cases/accepted-tsq.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

// Each TanStack rule the owner accepted runs as it ships, through the real ESLint: it reports the card's code and stays
// silent beside it. Each ships in the ruleset the owner named on its card, at the plugin's defaults, typed only where
// its report needs type information. A rule whose build waits on a card has its case held unrun (ACCEPTED_TSQ_HELD_CASES).

const ENGINES_TIMEOUT_MS = 120_000

const TANSTACK_RULE = /^@tanstack\//u

// Measured: it reads the query function's return type from the type checker and reports nothing without one.
const RULES_REPORTING_ONLY_WITH_TYPES: ReadonlySet<string> = new Set(['@tanstack/query/no-void-query-fn'])

const RULESETS = [
  { ruleset: 'tanstack-query', prefix: /^@tanstack\/query\//u, cases: ACCEPTED_TANSTACK_QUERY_CASES },
  { ruleset: 'tanstack-router', prefix: /^@tanstack\/router\//u, cases: ACCEPTED_TANSTACK_ROUTER_CASES },
]

describe('the TanStack rules accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(
    [...ACCEPTED_TANSTACK_QUERY_CASES, ...ACCEPTED_TANSTACK_ROUTER_CASES].map((ruleCase, index) => ({
      ...ruleCase,
      title: ruleCaseTitleOf(ruleCase),
      folder: `accepted-tsq-${String(index)}`,
    })),
  )(
    '$title, run as the catalog ships it, reports the code and stays silent beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it.each(RULESETS)(
    'ship in $ruleset, and no other rule of its plugin does, each in ESLint, at its defaults, on every file, assigned by the owner on its card',
    ({ ruleset, prefix, cases }) => {
      const expectedEntries = cases.map(({ rule }) => {
        const accepted = ACCEPTED_ON_2026_10_24[rule]
        if (accepted === undefined) throw new Error(`${rule} is no rule the owner accepted on 2026-10-24`)
        return {
          id: rule,
          ruleset,
          engine: 'eslint',
          options: [],
          typed: RULES_REPORTING_ONLY_WITH_TYPES.has(rule),
          assignment: { confidence: 'high', note: accepted.card, by: 'owner-2026-10-24' },
        }
      })

      expect(canonicalRules.filter(({ id }) => prefix.test(id))).toStrictEqual(expectedEntries)
    },
  )

  it('leave every TanStack rule the owner did not accept unshipped', () => {
    const shippedTanstackRules = canonicalRules.filter(({ id }) => TANSTACK_RULE.test(id)).map(({ id }) => id)

    expect(shippedTanstackRules.filter((id) => ACCEPTED_ON_2026_10_24[id] === undefined)).toStrictEqual([])
  })

  it('whose build waits on a card have a case held unrun only while the rule is accepted and does not ship, the case naming the card its build waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_TSQ_HELD_CASES, ACCEPTED_ON_2026_10_24, shippedIds)).toStrictEqual([])
  })
})
