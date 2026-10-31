import { catalog, routeOf } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { unshippedRuleRefusal } from './__tests__/cases/rules-we-do-not-ship.ts'
import { buildConsumerLintRules, emptyTsconfigRootDir } from './__tests__/factories/lint-rules-factories.ts'
import { twinsOf } from './core/catalog-lookups.ts'
import { defineLintRules, type LintRules } from './index.ts'

const TYPESCRIPT_ESLINTS_COPY_OF_A_RULE_WE_SHIP = '@typescript-eslint/no-unused-vars'
const CORE_RULE_A_COPY_WE_SHIP_EXTENDS = 'no-invalid-this'
const TYPESCRIPT_ESLINTS_COPY_OF_A_RULE_WE_DO_NOT_SHIP = '@typescript-eslint/no-redeclare'
const CORE_RULE_WHOSE_COPY_WE_DO_NOT_SHIP = 'no-redeclare'

function shippedWithItsTwins(id: string): { readonly shipped: boolean; readonly twins: Readonly<Record<string, boolean>> } {
  const route = routeOf(id, catalog)
  return { shipped: route.shipped !== null, twins: Object.fromEntries(twinsOf(route, catalog).map((twin) => [twin, routeOf(twin, catalog).shipped !== null])) }
}

function namedInOurRules(id: string): LintRules {
  return buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [id]: 'error' } })
}

// A rule shipped later would turn a refusal below into an accepted rule; this names that cause first.
describe('the rules this file names', () => {
  it('are unshipped, two beside a twin we ship and two beside a twin we do not ship', () => {
    expect(
      [TYPESCRIPT_ESLINTS_COPY_OF_A_RULE_WE_SHIP, CORE_RULE_A_COPY_WE_SHIP_EXTENDS, TYPESCRIPT_ESLINTS_COPY_OF_A_RULE_WE_DO_NOT_SHIP, CORE_RULE_WHOSE_COPY_WE_DO_NOT_SHIP].map(
        shippedWithItsTwins,
      ),
    ).toStrictEqual([
      { shipped: false, twins: { 'no-unused-vars': true } },
      { shipped: false, twins: { '@typescript-eslint/no-invalid-this': true } },
      { shipped: false, twins: { 'no-redeclare': false } },
      { shipped: false, twins: { '@typescript-eslint/no-redeclare': false } },
    ])
  })
})

describe('a twin of a rule we ship, named in the rules of agents-inc.lint.mts', () => {
  it("is accepted where it is typescript-eslint's copy", () => {
    expect(() => defineLintRules(namedInOurRules(TYPESCRIPT_ESLINTS_COPY_OF_A_RULE_WE_SHIP))).not.toThrow()
  })

  it('is accepted where it is the core rule the copy we ship extends', () => {
    expect(() => defineLintRules(namedInOurRules(CORE_RULE_A_COPY_WE_SHIP_EXTENDS))).not.toThrow()
  })
})

describe('a twin of a rule we do not ship, named in the rules of agents-inc.lint.mts', () => {
  it("is refused where it is typescript-eslint's copy", () => {
    expect(() => defineLintRules(namedInOurRules(TYPESCRIPT_ESLINTS_COPY_OF_A_RULE_WE_DO_NOT_SHIP))).toThrow(
      new Error(unshippedRuleRefusal('rules', TYPESCRIPT_ESLINTS_COPY_OF_A_RULE_WE_DO_NOT_SHIP)),
    )
  })

  it('is refused where it is the core rule', () => {
    expect(() => defineLintRules(namedInOurRules(CORE_RULE_WHOSE_COPY_WE_DO_NOT_SHIP))).toThrow(new Error(unshippedRuleRefusal('rules', CORE_RULE_WHOSE_COPY_WE_DO_NOT_SHIP)))
  })
})
