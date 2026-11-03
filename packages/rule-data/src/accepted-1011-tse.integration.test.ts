import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import {
  ACCEPTED_1011_TSE_CASES,
  ACCEPTED_1011_TSE_ENTRIES,
  ACCEPTED_1011_TSE_HELD_CASES,
  TYPE_IMPORTS_BESIDE_DECORATORS_CASES,
} from './__tests__/cases/accepted-1011-tse.ts'
import { ACCEPTED_ON_2026_10_11 } from './__tests__/cases/accepted-on-2026-10-11.ts'
import { ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON } from './__tests__/cases/routed-to-eslint-for-a-reason.ts'
import { placementMovedTo } from './__tests__/cases/ruleset-moves.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { compareCodeUnits, foundOr } from './collections.ts'

const ENGINES_TIMEOUT_MS = 120_000

const ASSIGNED_BY_THE_SPEC = { note: 'owner-2026-10-11, candidates page', by: 'accepted-spec-2026-10-26' }

function entryProposedFor(rule: string): (typeof ACCEPTED_1011_TSE_ENTRIES)[string] {
  return foundOr(ACCEPTED_1011_TSE_ENTRIES[rule], `${rule} is no typescript-eslint rule the owner accepted on 2026-10-11`)
}

function eslintBecauseWhereMeasured(rule: string): { readonly eslintBecause?: unknown } {
  return ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON.includes(rule) ? { eslintBecause: expect.any(String) } : {}
}

describe('the typescript-eslint rules accepted on 2026-10-11', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_1011_TSE_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-1011-tse-${String(index)}` })))(
    "$title, run as the catalog ships it, reports the page's code and stays silent beside it, on each engine that may run it",
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it.each(
    TYPE_IMPORTS_BESIDE_DECORATORS_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-1011-tse-decorators-${String(index)}` })),
  )(
    '$title, run as the catalog ships it, leaves an import the emitted decorator metadata reads and reports one it does not',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ship each in the ruleset the candidates page proposed or the one the owner moved it to, with the options it proposed, in oxlint under its oxlint name where that runs it untyped, else typed in ESLint, consistent-type-imports typed in ESLint with its reason, assigned by the spec or the move', () => {
    const casedRules = new Set(ACCEPTED_1011_TSE_CASES.map(({ rule }) => rule))
    const expectedEntries = [...casedRules].toSorted(compareCodeUnits).map((rule) => ({
      id: rule,
      ...entryProposedFor(rule),
      ...eslintBecauseWhereMeasured(rule),
      assignment: ASSIGNED_BY_THE_SPEC,
      ...placementMovedTo(rule),
    }))
    // The page proposed no confidence or alternative ruleset, so the pin leaves them to the data.
    const shippedEntries = canonicalRules
      .filter(({ id }) => casedRules.has(id))
      .map(({ assignment: { note, by }, ...entry }) => ({ ...entry, assignment: { note, by } }))

    expect(shippedEntries).toStrictEqual(expectedEntries)
  })

  it('whose build waits on a card have a case held unrun only while the rule is accepted and does not ship, the case naming the card its build waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_1011_TSE_HELD_CASES, ACCEPTED_ON_2026_10_11, shippedIds)).toStrictEqual([])
  })

  it('are each run as a case or held on a card, and are each a rule the owner accepted on 2026-10-11', () => {
    const coveredRules = [...ACCEPTED_1011_TSE_CASES, ...ACCEPTED_1011_TSE_HELD_CASES.map(({ ruleCase }) => ruleCase)].map(({ rule }) => rule)
    const proposedRules = Object.keys(ACCEPTED_1011_TSE_ENTRIES)

    expect({
      covered: coveredRules.toSorted(compareCodeUnits),
      notAccepted: proposedRules.filter((rule) => !Object.hasOwn(ACCEPTED_ON_2026_10_11, rule)),
    }).toStrictEqual({ covered: proposedRules.toSorted(compareCodeUnits), notAccepted: [] })
  })
})
