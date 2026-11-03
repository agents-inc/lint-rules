import { describe, expect, it } from 'vitest'

import { MOVED_TO_OXLINT, OXLINT_VERSION_CASES, OXLINT_VERSION_GAPS } from './__tests__/cases/oxlint-versions.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog, routeOf } from './catalog.ts'
import { foundOr } from './collections.ts'

const ENGINES_TIMEOUT_MS = 120_000

function oxlintVersionNameOf(id: string): string {
  return foundOr(catalog.oxlintRules.find((rule) => rule.id === id), `${id} has no oxlint version`).oxlintName
}

describe('the shipped rules ESLint ran that oxlint has a version of without type information', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(OXLINT_VERSION_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `oxlint-versions-${String(index)}` })))(
    '$title reports its code and stays silent beside it on oxlint and on ESLint alike, with the shipped settings',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it.each(OXLINT_VERSION_GAPS.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `oxlint-version-gaps-${String(index)}` })))(
    '$title holds on the engine it names',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it("routes each rule measured the same on both engines to oxlint, under oxlint's name for it", () => {
    const routes = MOVED_TO_OXLINT.map((id) => {
      const { engine, oxlintName } = routeOf(id, catalog)
      return { id, engine, oxlintName }
    })

    expect(routes).toStrictEqual(MOVED_TO_OXLINT.map((id) => ({ id, engine: 'oxlint', oxlintName: oxlintVersionNameOf(id) })))
  })
})
