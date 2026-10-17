import { describe, expect, it } from 'vitest'

import standIns from '../data/eslint-stand-ins.json' with { type: 'json' }
import candidates from '../data/rule-candidates.json' with { type: 'json' }
import { ESLINT_STAND_INS } from './__tests__/cases/rule-relations.ts'
import { standInOffenders } from './__tests__/stand-in-offenders.ts'
import { catalog } from './catalog.ts'

// For a shipped oxlint rule ESLint has no version of, ESLint states a stand-in that reports the same
// code; changed-settings.integration.test.ts runs each pair on that code.

describe('the ESLint stand-ins, data/eslint-stand-ins.json, read through the catalog', () => {
  it('stand in for exactly the oxlint rules the owner chose one for, each with the reason that starts with its card or questions.md number', () => {
    expect(Object.fromEntries(Object.entries(standIns).map(([oxlintRule, { standIn, because }]) => [oxlintRule, { standIn, card: because.split(':')[0] }]))).toStrictEqual(
      ESLINT_STAND_INS,
    )
  })

  it('are keyed in ascending order', () => {
    const keys = Object.keys(standIns)

    expect(keys).toStrictEqual(keys.toSorted())
  })

  it('are what the catalog gives as eslintStandIns', () => {
    expect(catalog.eslintStandIns).toStrictEqual(new Map(Object.entries(standIns).map(([oxlintRule, { standIn }]) => [oxlintRule, standIn])))
  })

  it('pair each shipped oxlint rule ESLint has no version of with an unshipped untyped ESLint rule nothing else turns on, one each', () => {
    expect(standInOffenders({ ...catalog, candidateIds: new Set(candidates.map(({ id }) => id)) })).toStrictEqual([])
  })
})
