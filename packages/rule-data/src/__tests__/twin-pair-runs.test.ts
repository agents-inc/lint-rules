import { describe, expect, it } from 'vitest'

import type { Catalog, RuleRoute } from '../catalog.ts'
import { buildEslintRoute, buildOxlintRoute } from './factories/inventory-factories.ts'
import { buildShippedRule } from './factories/shipped-rule-factories.ts'
import { twinPairsRoutedToOxlint } from './twin-pair-runs.ts'

const CORE_SCOPE = 'eslint'

function coreRuleOxlintRuns(id: string, eslintAliases: readonly string[]): RuleRoute {
  return buildOxlintRoute(id, { oxlintName: id, oxlintPlugin: CORE_SCOPE, eslintAliases, oxlintSpellings: [id], shipped: buildShippedRule('correctness') })
}

function coreRuleEslintRuns(id: string): RuleRoute {
  return buildEslintRoute(id, { typed: false, oxlintSpellings: [], shipped: buildShippedRule('correctness') })
}

function catalogOf(routes: readonly RuleRoute[], coreRuleExtensions: ReadonlyArray<readonly [string, readonly string[]]>): Catalog {
  return {
    rules: new Map(routes.map((route) => [route.id, route])),
    rulesets: [],
    eslintFallbackSkips: new Map(),
    eslintStandIns: new Map(),
    oxlintRules: [],
    coreRuleExtensions: new Map(coreRuleExtensions),
    ruleIdsWithAnEslintVersion: new Set(),
  }
}

describe('twinPairsRoutedToOxlint', () => {
  it('pairs each core rule oxlint runs with each extension of it, leaving out an extension its route records as an alias of it', () => {
    const catalog = catalogOf(
      [coreRuleOxlintRuns('no-shadow', []), coreRuleOxlintRuns('no-loop-func', ['@typescript-eslint/no-loop-func']), coreRuleOxlintRuns('no-unused-vars', ['@typescript-eslint/no-unused-vars-old'])],
      [
        ['no-shadow', ['@typescript-eslint/no-shadow']],
        ['no-loop-func', ['@typescript-eslint/no-loop-func']],
        ['no-unused-vars', ['@typescript-eslint/no-unused-vars', '@typescript-eslint/no-unused-vars-old']],
      ],
    )

    expect(twinPairsRoutedToOxlint(catalog)).toStrictEqual([
      { coreRule: 'no-shadow', extension: '@typescript-eslint/no-shadow', oxlintName: 'no-shadow', oxlintPlugin: CORE_SCOPE },
      { coreRule: 'no-unused-vars', extension: '@typescript-eslint/no-unused-vars', oxlintName: 'no-unused-vars', oxlintPlugin: CORE_SCOPE },
    ])
  })

  it('pairs no core rule ESLint runs, and none that nothing extends', () => {
    const catalog = catalogOf([coreRuleEslintRuns('no-throw-literal'), coreRuleOxlintRuns('no-debugger', [])], [['no-throw-literal', ['@typescript-eslint/only-throw-error']]])

    expect(twinPairsRoutedToOxlint(catalog)).toStrictEqual([])
  })
})
