import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { PROOF_SONAR_CASES } from './__tests__/cases/proof-sonar.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

const ENGINES_TIMEOUT_MS = 120_000

const SONARJS_PREFIX = 'sonarjs/'

describe('the sonarjs rules ESLint runs', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(PROOF_SONAR_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `proof-sonar-${String(index)}` })))(
    '$title, run as the catalog ships it, reports its code and stays silent on the corrected form',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('are each a shipped sonarjs rule routed to ESLint, cased once, on a file it reports and a file it leaves', () => {
    const routedToEslint = new Set(canonicalRules.filter(({ id, engine }) => engine === 'eslint' && id.startsWith(SONARJS_PREFIX)).map(({ id }) => id))
    const casedRules = PROOF_SONAR_CASES.map(({ rule }) => rule)

    expect({
      notShippedToEslint: casedRules.filter((rule) => !routedToEslint.has(rule)),
      casedTwice: casedRules.filter((rule, index) => casedRules.indexOf(rule) !== index),
      withNoReportedFile: PROOF_SONAR_CASES.filter(({ reportedIn }) => reportedIn.length === 0).map(({ rule }) => rule),
      withNoSilentFile: PROOF_SONAR_CASES.filter(({ silentIn }) => silentIn.length === 0).map(({ rule }) => rule),
    }).toStrictEqual({ notShippedToEslint: [], casedTwice: [], withNoReportedFile: [], withNoSilentFile: [] })
  })
})
