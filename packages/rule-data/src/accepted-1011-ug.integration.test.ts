import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import {
  ACCEPTED_1011_UG_CASES,
  ACCEPTED_1011_UG_ENTRIES,
  ACCEPTED_1011_UG_HELD_CASES,
  ACCESSOR_PAIRS_BESIDE_THE_OVERRIDE_RULE,
} from './__tests__/cases/accepted-1011-ug.ts'
import { ACCEPTED_ON_2026_10_11 } from './__tests__/cases/accepted-on-2026-10-11.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { compareCodeUnits } from './collections.ts'

// Each unicorn guard rule the owner accepted on the old candidates page on 2026-10-11 runs as it ships, through ESLint
// without type information: it reports the page's code and stays silent beside it. Each ships in the ruleset the page
// proposed, with no options. A rule whose build waits on a card has its case held unrun (ACCEPTED_1011_UG_HELD_CASES).

const ENGINES_TIMEOUT_MS = 120_000

const ASSIGNED_BY_THE_SPEC = { note: 'owner-2026-10-11, candidates page', by: 'accepted-spec-2026-10-26' }

function entryProposedFor(rule: string): (typeof ACCEPTED_1011_UG_ENTRIES)[string] {
  const entry = ACCEPTED_1011_UG_ENTRIES[rule]
  if (entry === undefined) throw new Error(`${rule} is no unicorn guard rule the owner accepted on 2026-10-11`)
  return entry
}

describe('the unicorn guard rules accepted on 2026-10-11', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_1011_UG_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-1011-ug-${String(index)}` })))(
    "$title, run as the catalog ships it, reports the page's code and stays silent beside it",
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it(
    'leave a setter-only override in a source file reported by accessor-pairs too, which is silent on it in a test file',
    async () => {
      const { actual, expected } = await outcomesOfCase('accepted-1011-ug-accessor-pairs', ACCESSOR_PAIRS_BESIDE_THE_OVERRIDE_RULE)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ship each in the ruleset the candidates page proposed, in ESLint with no options, typed only where the rule needs types, assigned by the spec', () => {
    const casedRules = new Set(ACCEPTED_1011_UG_CASES.map(({ rule }) => rule))
    const expectedEntries = [...casedRules].toSorted(compareCodeUnits).map((rule) => ({ id: rule, ...entryProposedFor(rule), assignment: ASSIGNED_BY_THE_SPEC }))
    // The page proposed no confidence or alternative ruleset, so the pin leaves them to the data.
    const shippedEntries = canonicalRules
      .filter(({ id }) => casedRules.has(id))
      .map(({ assignment: { note, by }, ...entry }) => ({ ...entry, assignment: { note, by } }))

    expect(shippedEntries).toStrictEqual(expectedEntries)
  })

  it('whose build waits on a card have a case held unrun only while the rule is accepted and does not ship, the case naming the card its build waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_1011_UG_HELD_CASES, ACCEPTED_ON_2026_10_11, shippedIds)).toStrictEqual([])
  })

  it('are each run as a case or held on a card, and are each a rule the owner accepted on 2026-10-11', () => {
    const coveredRules = [...ACCEPTED_1011_UG_CASES, ...ACCEPTED_1011_UG_HELD_CASES.map(({ ruleCase }) => ruleCase)].map(({ rule }) => rule)
    const proposedRules = Object.keys(ACCEPTED_1011_UG_ENTRIES)

    expect({
      covered: coveredRules.toSorted(compareCodeUnits),
      notAccepted: proposedRules.filter((rule) => !Object.hasOwn(ACCEPTED_ON_2026_10_11, rule)),
    }).toStrictEqual({ covered: proposedRules.toSorted(compareCodeUnits), notAccepted: [] })
  })
})
