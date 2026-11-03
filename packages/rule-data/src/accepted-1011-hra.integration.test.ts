import { describe, expect, it } from 'vitest'

import candidates from '../data/rule-candidates.json' with { type: 'json' }
import canonicalRules from '../data/rules.json' with { type: 'json' }
import { ACCEPTED_1011_HRA_CASES, HOUSE_REDUCE_RULE } from './__tests__/cases/accepted-1011-hra.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

const ENGINES_TIMEOUT_MS = 120_000

const UPSTREAM_RULE = 'anti-slop/no-reduce-accumulator-copy'

describe('the reduce-accumulator rule accepted on 2026-10-11', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_1011_HRA_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-1011-hra-${String(index)}` })))(
    "$title, run as the catalog ships it, reports the page's code and stays silent beside it, in ESLint",
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ships in performance, in ESLint, at its defaults, untyped, assigned by the spec', () => {
    // The page proposed no confidence or alternative ruleset, so the pin leaves them to the data.
    const shippedEntries = canonicalRules
      .filter(({ id }) => id === HOUSE_REDUCE_RULE)
      .map(({ assignment: { note, by }, ...entry }) => ({ ...entry, assignment: { note, by } }))

    expect(shippedEntries).toStrictEqual([
      {
        id: HOUSE_REDUCE_RULE,
        ruleset: 'performance',
        engine: 'eslint',
        options: [],
        typed: false,
        assignment: { note: 'owner-2026-10-11, candidates page', by: 'accepted-spec-2026-10-26' },
      },
    ])
  })

  it('never ships the upstream rule it ports, whose plugin is not installed', () => {
    expect(canonicalRules.filter(({ id }) => id === UPSTREAM_RULE).map(({ id }) => id)).toStrictEqual([])
  })

  it('leaves no entry of the upstream rule waiting in data/rule-candidates.json: the port meets its verdict', () => {
    expect(candidates.filter(({ id }) => id === UPSTREAM_RULE).map(({ id }) => id)).toStrictEqual([])
  })
})
