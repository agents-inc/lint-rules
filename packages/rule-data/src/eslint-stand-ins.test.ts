import { describe, expect, it } from 'vitest'

import standIns from '../data/eslint-stand-ins.json' with { type: 'json' }
import candidates from '../data/rule-candidates.json' with { type: 'json' }
import withoutAStandIn from '../data/without-an-eslint-stand-in.json' with { type: 'json' }
import { CANDIDATE_STATUSES } from './__tests__/cases/candidate-states.ts'
import { ESLINT_STAND_INS, WITHOUT_AN_ESLINT_STAND_IN } from './__tests__/cases/rule-relations.ts'
import { standInOffenders } from './__tests__/stand-in-offenders.ts'
import { catalog } from './catalog.ts'

// For a shipped oxlint rule ESLint has no version of, ESLint states a stand-in that reports the same
// code; changed-settings.integration.test.ts runs each pair on that code. Where no ESLint rule does,
// data/without-an-eslint-stand-in.json records the search.

/** The shipped rules oxlint runs that ESLint has no version of, so nothing checks without oxlint but a stand-in. */
const OXLINT_ONLY_RULES: readonly string[] = [...catalog.rules.values()]
  .filter(({ engine, shipped, id }) => engine === 'oxlint' && shipped !== null && !catalog.ruleIdsWithAnEslintVersion.has(id))
  .map(({ id }) => id)

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

  // A rule we decided against or have not reviewed has an entry in data/rule-candidates.json too; only
  // one we may still ship would be turned on beside its stand-in.
  it('pair each shipped oxlint rule ESLint has no version of with an unshipped untyped ESLint rule nothing else turns on, one each', () => {
    const candidateIds = new Set(candidates.filter(({ status }) => CANDIDATE_STATUSES.includes(status)).map(({ id }) => id))

    expect(standInOffenders({ ...catalog, candidateIds })).toStrictEqual([])
  })
})

describe('the oxlint rules no ESLint rule stands in for, data/without-an-eslint-stand-in.json', () => {
  it('are exactly the ones the search found none for, each with the reason that starts with its card', () => {
    expect(Object.fromEntries(Object.entries(withoutAStandIn).map(([oxlintRule, because]) => [oxlintRule, because.split(':')[0]]))).toStrictEqual(WITHOUT_AN_ESLINT_STAND_IN)
  })

  it('are keyed in ascending order', () => {
    const keys = Object.keys(withoutAStandIn)

    expect(keys).toStrictEqual(keys.toSorted())
  })

  it('say, past the card, what was searched', () => {
    expect(Object.entries(withoutAStandIn).filter(([, because]) => because.slice(because.indexOf(':') + 1).trim() === '').map(([oxlintRule]) => oxlintRule)).toStrictEqual([])
  })

  // A plugin upgrade that ships a new oxc rule, or gives one an ESLint version, fails here with the rule named.
  it('leave no shipped oxlint rule ESLint has no version of with neither a stand-in nor a recorded search, and none with both', () => {
    const recordedNone = new Set(Object.keys(withoutAStandIn))

    expect({
      neither: OXLINT_ONLY_RULES.filter((id) => !catalog.eslintStandIns.has(id) && !recordedNone.has(id)),
      both: OXLINT_ONLY_RULES.filter((id) => catalog.eslintStandIns.has(id) && recordedNone.has(id)),
      notOxlintOnly: [...recordedNone].filter((id) => !OXLINT_ONLY_RULES.includes(id)),
    }).toStrictEqual({ neither: [], both: [], notOxlintOnly: [] })
  })
})
