import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ACCEPTED_PLAYWRIGHT_CASES, ACCEPTED_PW_HELD_CASES, PLAYWRIGHT_RULES_IN_TEST_FILES_ONLY, PLAYWRIGHT_RULES_OFF_BY_DEFAULT } from './__tests__/cases/accepted-pw.ts'
import { TEST_FILE_GLOBS } from './__tests__/cases/test-file-globs.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

// Each Playwright rule the owner accepted runs as it ships, through the real ESLint: it reports the card's test and
// stays silent beside it. Each ships at the plugin's defaults, untyped (the plugin reads no type information) and on
// every file, since a page object outside the tests drives the page too, but for the two that take Puppeteer's page for
// Playwright's, which run in test files only (PLAYWRIGHT_RULES_IN_TEST_FILES_ONLY). Each is in the playwright ruleset the
// owner named, but for the five shipped off by default, in no ruleset, which run only where a team names them
// (PLAYWRIGHT_RULES_OFF_BY_DEFAULT). A rule whose build waits on a card has its case held unrun (ACCEPTED_PW_HELD_CASES).

const ENGINES_TIMEOUT_MS = 120_000

const PLAYWRIGHT_RULE = /^playwright\//u

describe('the Playwright rules accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_PLAYWRIGHT_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-pw-${String(index)}` })))(
    '$title, run as the catalog ships it, reports the test and stays silent beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ship, and no other Playwright rule does, each in playwright or off by default, in ESLint, at its defaults, untyped, on every file but those kept to test files, assigned by the owner on its card', () => {
    const expectedEntries = ACCEPTED_PLAYWRIGHT_CASES.map(({ rule }) => {
      const accepted = ACCEPTED_ON_2026_10_24[rule]
      if (accepted === undefined) throw new Error(`${rule} is no rule the owner accepted on 2026-10-24`)
      const turnedOnBy = PLAYWRIGHT_RULES_OFF_BY_DEFAULT.includes(rule) ? { offByDefault: true } : { ruleset: 'playwright' }
      const files = PLAYWRIGHT_RULES_IN_TEST_FILES_ONLY.includes(rule) ? { files: TEST_FILE_GLOBS } : {}
      return { id: rule, ...turnedOnBy, engine: 'eslint', options: [], typed: false, ...files, assignment: { confidence: 'high', note: accepted.card, by: 'owner-2026-10-24' } }
    })

    expect(canonicalRules.filter(({ id }) => PLAYWRIGHT_RULE.test(id))).toStrictEqual(expectedEntries)
  })

  it('whose build waits on a card have a case held unrun only while the rule is accepted and does not ship, the case naming the card its build waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_PW_HELD_CASES, ACCEPTED_ON_2026_10_24, shippedIds)).toStrictEqual([])
  })
})
