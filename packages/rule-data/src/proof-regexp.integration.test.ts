import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { PROOF_PERFECTIONIST_CASES, PROOF_REGEXP_CASES } from './__tests__/cases/proof-regexp.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

const ENGINES_TIMEOUT_MS = 120_000

const CASES_BY_PLUGIN = [
  { plugin: 'regexp', cases: PROOF_REGEXP_CASES },
  { plugin: 'perfectionist', cases: PROOF_PERFECTIONIST_CASES },
]

describe.each(CASES_BY_PLUGIN)('the $plugin rules ESLint runs', ({ plugin, cases }) => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(cases.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `proof-${plugin}-${String(index)}` })))(
    '$title, run as the catalog ships it, reports its fixture and stays silent on the corrected form',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it(`are each a shipped ${plugin} rule routed to ESLint, cased once, on a file it reports and a file it leaves`, () => {
    const routedToEslint = new Set(canonicalRules.filter(({ id, engine }) => engine === 'eslint' && id.startsWith(`${plugin}/`)).map(({ id }) => id))
    const casedRules = cases.map(({ rule }) => rule)

    expect({
      notShippedToEslint: casedRules.filter((rule) => !routedToEslint.has(rule)),
      casedTwice: casedRules.filter((rule, index) => casedRules.indexOf(rule) !== index),
      withNoReportedFile: cases.filter(({ reportedIn }) => reportedIn.length === 0).map(({ rule }) => rule),
      withNoSilentFile: cases.filter(({ silentIn }) => silentIn.length === 0).map(({ rule }) => rule),
    }).toStrictEqual({ notShippedToEslint: [], casedTwice: [], withNoReportedFile: [], withNoSilentFile: [] })
  })
})
