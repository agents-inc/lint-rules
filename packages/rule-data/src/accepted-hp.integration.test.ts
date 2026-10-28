import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import { ACCEPTED_HP_HELD_CASES, ACCEPTED_HYDRATION_PROOF_CASES } from './__tests__/cases/accepted-hp.ts'
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { rulesetDefinitions } from './ruleset-definitions.ts'

// Each hydration-proof rule the owner accepted runs as it ships, through the real ESLint: it reports code a component
// renders differently on the server and in the browser, and stays silent beside it. Each is to ship in react-ssr, the
// ruleset the owner named on the cards, at the plugin's defaults, untyped (every case reports without type information)
// and on every file. The rules report in an app that never renders on a server, so the owner made react-ssr opt-in (card
// q-lint-react-ssr-in-client-apps, "Make react-ssr opt-in"): init names it in the ui list's comment instead of listing
// it, and a config listing it keeps it. A rule whose build waits on a card has its case held unrun (ACCEPTED_HP_HELD_CASES).

const ENGINES_TIMEOUT_MS = 120_000

const HYDRATION_PROOF_RULE = /^hydration-proof\//u

const UI_DOMAIN = 'ui'

describe('the hydration-proof rules accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_HYDRATION_PROOF_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-hp-${String(index)}` })))(
    '$title, run as the catalog ships it, reports what renders differently on the server and stays silent beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ship, and no other hydration-proof rule does, each in react-ssr, in ESLint, at its defaults, untyped, on every file, assigned by the owner on its card', () => {
    const expectedEntries = ACCEPTED_HYDRATION_PROOF_CASES.map(({ rule }) => {
      const accepted = ACCEPTED_ON_2026_10_24[rule]
      if (accepted === undefined) throw new Error(`${rule} is no rule the owner accepted on 2026-10-24`)
      return { id: rule, ruleset: 'react-ssr', engine: 'eslint', options: [], typed: false, assignment: { confidence: 'high', note: accepted.card, by: 'owner-2026-10-24' } }
    })

    expect(canonicalRules.filter(({ id }) => HYDRATION_PROOF_RULE.test(id))).toStrictEqual(expectedEntries)
  })

  it('whose build waits on a card have a case held unrun only while the rule is accepted and does not ship, the case naming the card its build waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_HP_HELD_CASES, ACCEPTED_ON_2026_10_24, shippedIds)).toStrictEqual([])
  })

  it("ship in react-ssr, the one ui ruleset init leaves for a team to list, by the owner's answer on its card", () => {
    const isOptInByUiRuleset = Object.fromEntries(rulesetDefinitions.filter(({ domain }) => domain === UI_DOMAIN).map(({ name, optIn }) => [name, optIn]))

    expect(isOptInByUiRuleset).toStrictEqual({ react: false, nextjs: false, 'react-ssr': true })
  })
})
