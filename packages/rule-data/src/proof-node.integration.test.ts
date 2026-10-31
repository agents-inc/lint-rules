import { describe, expect, it } from 'vitest'

import { PROOF_NODE_CASES } from './__tests__/cases/proof-node.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { pluginPrefixOf } from './rule-id-parts.ts'

const ENGINES_TIMEOUT_MS = 120_000

const LANE_PLUGINS: ReadonlySet<string> = new Set(['n', 'import-x', 'promise', 'check-file', 'no-secrets'])

function isShippedToEslint(rule: string): boolean {
  const route = catalog.rules.get(rule)
  return route?.engine === 'eslint' && route.shipped !== null
}

function isOfTheLane(rule: string): boolean {
  const plugin = pluginPrefixOf(rule)
  return plugin !== null && LANE_PLUGINS.has(plugin)
}

describe('the shipped n, import-x, promise, check-file and no-secrets rules ESLint runs, as the catalog ships them', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(PROOF_NODE_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `proof-node-${String(index)}` })))(
    '$title reports its fixture and stays silent on the fixture corrected',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('are each a shipped rule of these plugins routed to ESLint, cased once, on a file it reports and a file it leaves', () => {
    const casedRules = PROOF_NODE_CASES.map(({ rule }) => rule)

    expect({
      notShippedToEslint: casedRules.filter((rule) => !isShippedToEslint(rule)),
      outsideThePlugins: casedRules.filter((rule) => !isOfTheLane(rule)),
      casedTwice: casedRules.filter((rule, index) => casedRules.indexOf(rule) !== index),
      withNoReportedFile: PROOF_NODE_CASES.filter(({ reportedIn }) => reportedIn.length === 0).map(({ rule }) => rule),
      withNoSilentFile: PROOF_NODE_CASES.filter(({ silentIn }) => silentIn.length === 0).map(({ rule }) => rule),
    }).toStrictEqual({ notShippedToEslint: [], outsideThePlugins: [], casedTwice: [], withNoReportedFile: [], withNoSilentFile: [] })
  })
})
