import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import {
  ACCEPTED_1011_CORE_CASES,
  ACCEPTED_1011_CORE_HELD_CASES,
  ACCEPTED_1011_CORE_RULES_SKIPPING_TEST_FILES,
  ACCEPTED_1011_CORE_RULESETS,
} from './__tests__/cases/accepted-1011-core.ts'
import { ACCEPTED_ON_2026_10_11 } from './__tests__/cases/accepted-on-2026-10-11.ts'
import { placementMovedTo } from './__tests__/cases/ruleset-moves.ts'
import { TEST_AND_SETUP_FILE_GLOBS } from './__tests__/cases/test-file-globs.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { compareCodeUnits } from './collections.ts'

// Each core rule oxlint runs that the owner accepted on the old candidates page on 2026-10-11 runs as it ships, through
// the real engines: it reports the page's code and stays silent beside it, in oxlint and in ESLint, which runs it without
// oxlint. Each ships in oxlint under its own name, in the ruleset the page proposed or the owner moved it to, at its defaults, accessor-pairs
// outside test files as the page proposed. A rule whose build waits on a card has its case held unrun
// (ACCEPTED_1011_CORE_HELD_CASES).

const ENGINES_TIMEOUT_MS = 120_000

const ASSIGNED_BY_THE_SPEC = { note: 'owner-2026-10-11, candidates page', by: 'accepted-spec-2026-10-26' }

function rulesetProposedFor(rule: string): string {
  const ruleset = ACCEPTED_1011_CORE_RULESETS[rule]
  if (ruleset === undefined) throw new Error(`${rule} is no core rule oxlint runs that the owner accepted on 2026-10-11`)
  return ruleset
}

function ignoresProposedFor(rule: string): { readonly ignores?: readonly string[] } {
  return ACCEPTED_1011_CORE_RULES_SKIPPING_TEST_FILES.includes(rule) ? { ignores: TEST_AND_SETUP_FILE_GLOBS } : {}
}

describe('the core rules oxlint runs, accepted on 2026-10-11', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_1011_CORE_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-1011-core-${String(index)}` })))(
    "$title, run as the catalog ships it, reports the page's code and stays silent beside it, in oxlint and in ESLint without oxlint",
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ship in oxlint under their own names, each in the ruleset the candidates page proposed or the one the owner moved it to, at its defaults, untyped, accessor-pairs outside test files, assigned by the spec or the move', () => {
    const casedRules = new Set(ACCEPTED_1011_CORE_CASES.map(({ rule }) => rule))
    const expectedEntries = [...casedRules].toSorted(compareCodeUnits).map((rule) => ({
      id: rule,
      ruleset: rulesetProposedFor(rule),
      engine: 'oxlint',
      oxlintName: rule,
      options: [],
      typed: false,
      ...ignoresProposedFor(rule),
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

    expect(heldCasesOutOfPlace(ACCEPTED_1011_CORE_HELD_CASES, ACCEPTED_ON_2026_10_11, shippedIds)).toStrictEqual([])
  })

  it('are each run as a case or held on a card, and are each a rule the owner accepted on 2026-10-11', () => {
    const coveredRules = [...ACCEPTED_1011_CORE_CASES, ...ACCEPTED_1011_CORE_HELD_CASES.map(({ ruleCase }) => ruleCase)].map(({ rule }) => rule)
    const proposedRules = Object.keys(ACCEPTED_1011_CORE_RULESETS)

    expect({
      covered: coveredRules.toSorted(compareCodeUnits),
      notAccepted: proposedRules.filter((rule) => !Object.hasOwn(ACCEPTED_ON_2026_10_11, rule)),
    }).toStrictEqual({ covered: proposedRules.toSorted(compareCodeUnits), notAccepted: [] })
  })
})
