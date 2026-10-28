import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import { ACCEPTED_JD_HELD_CASES, ACCEPTED_JEST_DOM_CASES } from './__tests__/cases/accepted-jd.ts'
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { rulesetDefinitions } from './ruleset-definitions.ts'

// Each jest-dom rule the owner accepted runs as it ships, through the real ESLint: it reports a generic matcher and
// stays silent on the jest-dom matcher beside it. Each is to ship in jest-dom, the ruleset the owner named on the
// cards, at the plugin's defaults, untyped (every case reports without type information) and on every file. The rules
// report in a test that never loads jest-dom, so the owner made jest-dom opt-in (card q-lint-jest-dom-without-jest-dom,
// "Make jest-dom opt-in"): init names it in the testing list's comment instead of listing it, and a config listing it
// keeps it. A rule whose build waits on a card has its case held unrun (ACCEPTED_JD_HELD_CASES).

const ENGINES_TIMEOUT_MS = 120_000

const JEST_DOM_RULE = /^jest-dom\//u

const TESTING_DOMAIN = 'testing'

describe('the jest-dom rules accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_JEST_DOM_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-jd-${String(index)}` })))(
    '$title, run as the catalog ships it, reports the generic matcher and stays silent on the jest-dom matcher beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ship, and no other jest-dom rule does, each in jest-dom, in ESLint, at its defaults, untyped, on every file, assigned by the owner on its card', () => {
    const expectedEntries = ACCEPTED_JEST_DOM_CASES.map(({ rule }) => {
      const accepted = ACCEPTED_ON_2026_10_24[rule]
      if (accepted === undefined) throw new Error(`${rule} is no rule the owner accepted on 2026-10-24`)
      return { id: rule, ruleset: 'jest-dom', engine: 'eslint', options: [], typed: false, assignment: { confidence: 'high', note: accepted.card, by: 'owner-2026-10-24' } }
    })

    expect(canonicalRules.filter(({ id }) => JEST_DOM_RULE.test(id))).toStrictEqual(expectedEntries)
  })

  it('whose build waits on a card have a case held unrun only while the rule is accepted and does not ship, the case naming the card its build waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_JD_HELD_CASES, ACCEPTED_ON_2026_10_24, shippedIds)).toStrictEqual([])
  })

  it("ship in jest-dom, the one testing ruleset init leaves for a team to list, by the owner's answer on its card", () => {
    const isOptInByTestingRuleset = Object.fromEntries(rulesetDefinitions.filter(({ domain }) => domain === TESTING_DOMAIN).map(({ name, optIn }) => [name, optIn]))

    expect(isOptInByTestingRuleset).toStrictEqual({ vitest: false, 'testing-library': false, storybook: false, playwright: false, 'jest-dom': true })
  })
})
