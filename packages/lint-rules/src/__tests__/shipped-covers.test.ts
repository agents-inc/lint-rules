import { catalog } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { buildShippedRule } from '@workspace/rule-data/test-support/shipped-rule-factories'
import { describe, expect, it } from 'vitest'
import { buildEslintRoute } from './factories/catalog-factories.ts'
import { isCoveredByAShippedRule, isCoveredInOxlintByAShippedRule } from './shipped-covers.ts'

// The equivalence specs leave out each rule these answer yes for: a wrong yes hides a rule from them, a wrong no
// reports a covered rule as missing. A cover is looked up in the catalog the package ships; a route's own ID is not read.

const ROUTE_ID = 'ours/a-rule-under-test'
const RULESET = 'ours'
const NO_RULE_OF_THE_CATALOG = 'ours/no-rule-of-the-catalog'

const COVERS = [
  { cover: 'a rule the catalog ships', shipped: true, covered: true },
  { cover: 'a rule the catalog holds and does not ship', shipped: false, covered: false },
] as const

/** The first rule of the catalog shipped, or not, as asked. */
function catalogRuleId(isShipped: boolean): string {
  const route = catalog.rules.values().find((candidate) => (candidate.shipped !== null) === isShipped)
  return foundOr(route, `the catalog holds no rule whose shipped is ${isShipped ? 'set' : 'null'}`).id
}

describe('isCoveredByAShippedRule', () => {
  it('answers no for a rule we do not ship', () => {
    expect(isCoveredByAShippedRule(buildEslintRoute(ROUTE_ID, { typed: false, shipped: null }))).toBe(false)
  })

  it('answers no for a shipped rule no other rule covers', () => {
    expect(isCoveredByAShippedRule(buildEslintRoute(ROUTE_ID, { typed: false, shipped: buildShippedRule(RULESET) }))).toBe(false)
  })

  it.each(COVERS)('answers $covered for a rule covered by $cover', ({ shipped, covered }) => {
    const route = buildEslintRoute(ROUTE_ID, { typed: false, shipped: buildShippedRule(RULESET, { coveredBy: catalogRuleId(shipped) }) })

    expect(isCoveredByAShippedRule(route)).toBe(covered)
  })

  it('answers no for a rule covered by a shipped rule only where oxlint runs both', () => {
    const route = buildEslintRoute(ROUTE_ID, { typed: false, shipped: buildShippedRule(RULESET, { coveredInOxlintBy: catalogRuleId(true) }) })

    expect(isCoveredByAShippedRule(route)).toBe(false)
  })

  it('throws, naming the cover, for a cover the catalog does not hold', () => {
    const route = buildEslintRoute(ROUTE_ID, { typed: false, shipped: buildShippedRule(RULESET, { coveredBy: NO_RULE_OF_THE_CATALOG }) })

    expect(() => isCoveredByAShippedRule(route)).toThrow(`${NO_RULE_OF_THE_CATALOG}: a cover the catalog does not hold`)
  })
})

describe('isCoveredInOxlintByAShippedRule', () => {
  it('answers no for a rule we do not ship', () => {
    expect(isCoveredInOxlintByAShippedRule(buildEslintRoute(ROUTE_ID, { typed: false, shipped: null }))).toBe(false)
  })

  it('answers no for a shipped rule no other rule covers', () => {
    expect(isCoveredInOxlintByAShippedRule(buildEslintRoute(ROUTE_ID, { typed: false, shipped: buildShippedRule(RULESET) }))).toBe(false)
  })

  it.each(COVERS)('answers $covered for a rule covered where oxlint runs both by $cover', ({ shipped, covered }) => {
    const route = buildEslintRoute(ROUTE_ID, { typed: false, shipped: buildShippedRule(RULESET, { coveredInOxlintBy: catalogRuleId(shipped) }) })

    expect(isCoveredInOxlintByAShippedRule(route)).toBe(covered)
  })

  it('answers no for a rule covered by a shipped rule wherever it runs, and not only where oxlint runs both', () => {
    const route = buildEslintRoute(ROUTE_ID, { typed: false, shipped: buildShippedRule(RULESET, { coveredBy: catalogRuleId(true) }) })

    expect(isCoveredInOxlintByAShippedRule(route)).toBe(false)
  })

  it('throws, naming the cover, for a cover the catalog does not hold', () => {
    const route = buildEslintRoute(ROUTE_ID, { typed: false, shipped: buildShippedRule(RULESET, { coveredInOxlintBy: NO_RULE_OF_THE_CATALOG }) })

    expect(() => isCoveredInOxlintByAShippedRule(route)).toThrow(`${NO_RULE_OF_THE_CATALOG}: a cover in oxlint the catalog does not hold`)
  })
})
