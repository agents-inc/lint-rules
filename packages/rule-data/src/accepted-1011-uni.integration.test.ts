import { describe, expect, it } from 'vitest'

import candidates from '../data/rule-candidates.json' with { type: 'json' }
import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import {
  ACCEPTED_1011_UNI_CASES,
  ACCEPTED_1011_UNI_DROPS,
  ACCEPTED_1011_UNI_ENTRIES,
  ACCEPTED_1011_UNI_HELD_CASES,
  IGNORED_RETURN_BESIDE_THE_UNUSED_RETURN_RULE,
  ROUTED_TO_ESLINT_BY_CARD,
} from './__tests__/cases/accepted-1011-uni.ts'
import { ACCEPTED_ON_2026_10_11 } from './__tests__/cases/accepted-on-2026-10-11.ts'
import { placementMovedTo } from './__tests__/cases/ruleset-moves.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { compareCodeUnits } from './collections.ts'

// The unicorn rules beyond the guard rules that the owner accepted on 2026-10-11 ship as the candidates page proposed or the owner moved them,
// each proven on the engines that may run it, prefer-at and prefer-single-call in ESLint as the owner answered; the rule
// prefer-literal-ascii replaces stops shipping in the same step.

const ENGINES_TIMEOUT_MS = 120_000
const ASSIGNED_BY_THE_SPEC = { note: 'owner-2026-10-11, candidates page', by: 'accepted-spec-2026-10-26' }

function entryProposedFor(rule: string): (typeof ACCEPTED_1011_UNI_ENTRIES)[string] {
  const entry = ACCEPTED_1011_UNI_ENTRIES[rule]
  if (entry === undefined) throw new Error(`${rule} is no unicorn rule the owner accepted on 2026-10-11`)
  return entry
}

function eslintBecauseNaming(card: string | undefined): { readonly eslintBecause?: unknown } {
  return card === undefined ? {} : { eslintBecause: expect.stringContaining(card) }
}

describe('the unicorn rules beyond the guard rules accepted on 2026-10-11', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_1011_UNI_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-1011-uni-${String(index)}` })))(
    "$title, run as the catalog ships it, reports the page's code and stays silent beside it, on each engine that may run it",
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it(
    'leave a discarded .map() of a mutable array in TypeScript reported by sonarjs/no-ignored-return too, which is silent on the loop',
    async () => {
      const { actual, expected } = await outcomesOfCase('accepted-1011-uni-ignored-return', IGNORED_RETURN_BESIDE_THE_UNUSED_RETURN_RULE)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ship each in the ruleset the candidates page proposed or the one the owner moved it to, with no options, in ESLint, typed only where the rule needs types, assigned by the spec or the move, those oxlint also runs giving the card that routed them to ESLint', () => {
    const casedRules = new Set(ACCEPTED_1011_UNI_CASES.map(({ rule }) => rule))
    const expectedEntries = [...casedRules].toSorted(compareCodeUnits).map((rule) => ({
      id: rule,
      ...entryProposedFor(rule),
      ...eslintBecauseNaming(ROUTED_TO_ESLINT_BY_CARD[rule]),
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

    expect(heldCasesOutOfPlace(ACCEPTED_1011_UNI_HELD_CASES, ACCEPTED_ON_2026_10_11, shippedIds)).toStrictEqual([])
  })

  it('are each run as a case or held on a card, and are each a rule the owner accepted on 2026-10-11', () => {
    const coveredRules = [...ACCEPTED_1011_UNI_CASES, ...ACCEPTED_1011_UNI_HELD_CASES.map(({ ruleCase }) => ruleCase)].map(({ rule }) => rule)
    const proposedRules = Object.keys(ACCEPTED_1011_UNI_ENTRIES)

    expect({
      covered: coveredRules.toSorted(compareCodeUnits),
      notAccepted: proposedRules.filter((rule) => !Object.hasOwn(ACCEPTED_ON_2026_10_11, rule)),
    }).toStrictEqual({ covered: proposedRules.toSorted(compareCodeUnits), notAccepted: [] })
  })

  it('stop shipping the rule prefer-literal-ascii replaces, which is recorded as dropped by the decision that dropped it', () => {
    const dropped = Object.keys(ACCEPTED_1011_UNI_DROPS)
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect({
      shipped: dropped.filter((id) => shippedIds.has(id)),
      recorded: Object.fromEntries(
        candidates
          .filter(({ id }) => Object.hasOwn(ACCEPTED_1011_UNI_DROPS, id))
          .map((entry) => [entry.id, { status: entry.status, decidedBy: 'decidedBy' in entry ? entry.decidedBy : 'no card named' }]),
      ),
    }).toStrictEqual({
      shipped: [],
      recorded: Object.fromEntries(Object.entries(ACCEPTED_1011_UNI_DROPS).map(([id, decidedBy]) => [id, { status: 'dropped', decidedBy }])),
    })
  })
})
