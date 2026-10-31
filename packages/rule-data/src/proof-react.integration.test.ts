import { describe, expect, it } from 'vitest'

import { PROOF_REACT_CASES } from './__tests__/cases/proof-react.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { pluginPrefixOf } from './rule-id-parts.ts'

const ENGINES_TIMEOUT_MS = 120_000

const REACT_PLUGINS = ['@eslint-react', 'react', 'react-hooks', 'react-you-might-not-need-an-effect', 'react-hook-form', 'css-modules']

describe('the shipped React rules ESLint runs, as the catalog ships them', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(PROOF_REACT_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `proof-react-${String(index)}` })))(
    '$title reports its fixture and stays silent on the fixture corrected',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('are each a shipped rule of a React plugin routed to ESLint, cased once, on a file it reports and a file it leaves', () => {
    const casedRules = PROOF_REACT_CASES.map(({ rule }) => rule)

    expect({
      notShippedToEslint: casedRules.filter((rule) => {
        const route = catalog.rules.get(rule)
        return route === undefined || route.engine !== 'eslint' || route.shipped === null
      }),
      outsideTheReactPlugins: casedRules.filter((rule) => {
        const plugin = pluginPrefixOf(rule)
        return plugin === null || !REACT_PLUGINS.includes(plugin)
      }),
      casedTwice: casedRules.filter((rule, index) => casedRules.indexOf(rule) !== index),
      withNoReportedFile: PROOF_REACT_CASES.filter(({ reportedIn }) => reportedIn.length === 0).map(({ rule }) => rule),
      withNoSilentFile: PROOF_REACT_CASES.filter(({ silentIn }) => silentIn.length === 0).map(({ rule }) => rule),
    }).toStrictEqual({ notShippedToEslint: [], outsideTheReactPlugins: [], casedTwice: [], withNoReportedFile: [], withNoSilentFile: [] })
  })
})
