import { describe, expect, it } from 'vitest'

import { PROOF_STORYBOOK_CASES, PROOF_TESTING_LIBRARY_CASES } from './__tests__/cases/proof-test.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { pluginPrefixOf } from './rule-id-parts.ts'

const ENGINES_TIMEOUT_MS = 120_000

const CASES_BY_PLUGIN = [
  { plugin: 'testing-library', cases: PROOF_TESTING_LIBRARY_CASES },
  { plugin: 'storybook', cases: PROOF_STORYBOOK_CASES },
]

function isShippedToEslint(rule: string): boolean {
  const route = catalog.rules.get(rule)
  return route?.engine === 'eslint' && route.shipped !== null
}

describe('the shipped testing-library and storybook rules ESLint runs, as the catalog ships them', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(
    CASES_BY_PLUGIN.flatMap(({ plugin, cases }) =>
      cases.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `proof-test-${plugin}-${String(index)}` })),
    ),
  )(
    '$title reports its fixture and stays silent on the fixture corrected',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it.each(CASES_BY_PLUGIN)('are each a shipped $plugin rule routed to ESLint, cased once, on a file it reports and a file it leaves', ({ plugin, cases }) => {
    const casedRules = cases.map(({ rule }) => rule)

    expect({
      notShippedToEslint: casedRules.filter((rule) => !isShippedToEslint(rule)),
      outsideThePlugin: casedRules.filter((rule) => pluginPrefixOf(rule) !== plugin),
      casedTwice: casedRules.filter((rule, index) => casedRules.indexOf(rule) !== index),
      withNoReportedFile: cases.filter(({ reportedIn }) => reportedIn.length === 0).map(({ rule }) => rule),
      withNoSilentFile: cases.filter(({ silentIn }) => silentIn.length === 0).map(({ rule }) => rule),
    }).toStrictEqual({ notShippedToEslint: [], outsideThePlugin: [], casedTwice: [], withNoReportedFile: [], withNoSilentFile: [] })
  })
})
