import { describe, expect, it } from 'vitest'

import { PROOF_OXC_CASES } from './__tests__/cases/proof-oxc.ts'
import { STAND_IN_CASES } from './__tests__/cases/stand-ins.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'
import { pluginPrefixOf } from './rule-id-parts.ts'

// An oxc rule with an ESLint stand-in is proven in oxlint by its stand-in case (changed-settings.integration.test.ts).

const ENGINES_TIMEOUT_MS = 120_000
const OXC = 'oxc'

describe('the shipped oxc rules no ESLint stand-in proves, run in oxlint as the catalog ships them', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it('are each shipped oxc rule without a stand-in case, once', () => {
    const provenByAStandIn = new Set(STAND_IN_CASES.map(({ oxlintRule }) => oxlintRule))
    const shippedOxcRules = catalog.rules
      .values()
      .filter(({ id, shipped }) => shipped !== null && pluginPrefixOf(id) === OXC)
      .map(({ id }) => id)
      .toArray()

    expect(PROOF_OXC_CASES.map(({ rule }) => rule).toSorted()).toStrictEqual(shippedOxcRules.filter((id) => !provenByAStandIn.has(id)).toSorted())
  })

  it.each(PROOF_OXC_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `proof-oxc-${String(index)}` })))(
    '$title reports its code and stays silent beside it, in oxlint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )
})
