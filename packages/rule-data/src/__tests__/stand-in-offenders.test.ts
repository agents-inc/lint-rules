import { describe, expect, it } from 'vitest'

import type { RuleRoute } from '../catalog.ts'
import { buildEslintRoute, buildOxlintRoute, buildShippedRule } from './factories/inventory-factories.ts'
import { type StandInSources, standInOffenders } from './stand-in-offenders.ts'

const SKIP_REASON = 'its fixture does not fire in ESLint'

/** A shipped oxlint rule ESLint has no version of: what a stand-in stands in for. */
function shippedOxlintRule(id: string): RuleRoute {
  return buildOxlintRoute(id, { oxlintName: id, oxlintPlugin: 'oxc', eslintAliases: [], oxlintSpellings: [id], shipped: buildShippedRule('correctness') })
}

/** An unshipped untyped rule ESLint runs: what a stand-in is. */
function unshippedEslintRule(id: string): RuleRoute {
  return buildEslintRoute(id, { typed: false, oxlintSpellings: [], shipped: null })
}

/** The walk's sources: the pairs and routes given, and nothing else recorded unless given. */
function sourcesOf(
  pairs: readonly (readonly [string, string])[],
  routes: readonly RuleRoute[],
  recorded: Partial<Pick<StandInSources, 'candidateIds' | 'eslintFallbackSkips' | 'ruleIdsWithAnEslintVersion'>> = {},
): StandInSources {
  return {
    eslintStandIns: new Map(pairs),
    rules: new Map(routes.map((route) => [route.id, route])),
    ruleIdsWithAnEslintVersion: new Set(),
    eslintFallbackSkips: new Map(),
    candidateIds: new Set(),
    ...recorded,
  }
}

describe('standInOffenders', () => {
  it('names nothing for an unshipped untyped ESLint rule standing in for a shipped oxlint rule ESLint has no version of', () => {
    const sources = sourcesOf([['oxc/a', 'unicorn/a']], [shippedOxlintRule('oxc/a'), unshippedEslintRule('unicorn/a')])

    expect(standInOffenders(sources)).toStrictEqual([])
  })

  it('names an oxlint rule that is no RuleId, does not ship, runs in ESLint or has an ESLint version, beside one that holds', () => {
    const sources = sourcesOf(
      [
        ['oxc/gone', 'unicorn/a'],
        ['oxc/unshipped', 'unicorn/b'],
        ['plugin/in-eslint', 'unicorn/c'],
        ['oxc/with-eslint-version', 'unicorn/d'],
        ['oxc/holds', 'unicorn/e'],
      ],
      [
        buildOxlintRoute('oxc/unshipped', { oxlintName: 'oxc/unshipped', oxlintPlugin: 'oxc', eslintAliases: [], oxlintSpellings: ['oxc/unshipped'], shipped: null }),
        buildEslintRoute('plugin/in-eslint', { typed: false, oxlintSpellings: [], shipped: buildShippedRule('correctness') }),
        shippedOxlintRule('oxc/with-eslint-version'),
        shippedOxlintRule('oxc/holds'),
        ...['unicorn/a', 'unicorn/b', 'unicorn/c', 'unicorn/d', 'unicorn/e'].map(unshippedEslintRule),
      ],
      { ruleIdsWithAnEslintVersion: new Set(['oxc/with-eslint-version', 'plugin/in-eslint']) },
    )

    expect(standInOffenders(sources)).toStrictEqual([
      'unicorn/a for oxc/gone: the oxlint rule is no RuleId',
      'unicorn/b for oxc/unshipped: the oxlint rule does not ship',
      'unicorn/c for plugin/in-eslint: the oxlint rule is run by ESLint',
      'unicorn/c for plugin/in-eslint: the oxlint rule has an ESLint version, which ESLint takes over without oxlint',
      'unicorn/d for oxc/with-eslint-version: the oxlint rule has an ESLint version, which ESLint takes over without oxlint',
    ])
  })

  it('names a stand-in that is no RuleId, runs in oxlint, is typed, ships, is a candidate or is skipped, beside one that holds', () => {
    const sources = sourcesOf(
      [
        ['oxc/a', 'unicorn/gone'],
        ['oxc/b', 'unicorn/in-oxlint'],
        ['oxc/c', 'unicorn/typed'],
        ['oxc/d', 'unicorn/shipped'],
        ['oxc/e', 'unicorn/candidate'],
        ['oxc/f', 'unicorn/skipped'],
        ['oxc/g', 'unicorn/holds'],
      ],
      [
        ...['oxc/a', 'oxc/b', 'oxc/c', 'oxc/d', 'oxc/e', 'oxc/f', 'oxc/g'].map(shippedOxlintRule),
        buildOxlintRoute('unicorn/in-oxlint', { oxlintName: 'unicorn/in-oxlint', oxlintPlugin: 'unicorn', eslintAliases: [], oxlintSpellings: ['unicorn/in-oxlint'], shipped: null }),
        buildEslintRoute('unicorn/typed', { typed: true, oxlintSpellings: [], shipped: null }),
        buildEslintRoute('unicorn/shipped', { typed: false, oxlintSpellings: [], shipped: buildShippedRule('correctness') }),
        ...['unicorn/candidate', 'unicorn/skipped', 'unicorn/holds'].map(unshippedEslintRule),
      ],
      { candidateIds: new Set(['unicorn/candidate']), eslintFallbackSkips: new Map([['unicorn/skipped', SKIP_REASON]]) },
    )

    expect(standInOffenders(sources)).toStrictEqual([
      'unicorn/gone for oxc/a: the stand-in is no RuleId',
      'unicorn/in-oxlint for oxc/b: the stand-in is run by oxlint',
      'unicorn/typed for oxc/c: the stand-in is typed',
      'unicorn/shipped for oxc/d: the stand-in ships',
      'unicorn/candidate for oxc/e: the stand-in is a candidate in data/rule-candidates.json',
      'unicorn/skipped for oxc/f: the stand-in is on the ESLint-fallback skip list',
    ])
  })

  it('names a stand-in two oxlint rules share, and none one oxlint rule has', () => {
    const sources = sourcesOf(
      [
        ['oxc/a', 'unicorn/shared'],
        ['oxc/b', 'unicorn/shared'],
        ['oxc/c', 'unicorn/own'],
      ],
      [...['oxc/a', 'oxc/b', 'oxc/c'].map(shippedOxlintRule), unshippedEslintRule('unicorn/shared'), unshippedEslintRule('unicorn/own')],
    )

    expect(standInOffenders(sources)).toStrictEqual(['unicorn/shared: stands in for oxc/a, oxc/b'])
  })
})
