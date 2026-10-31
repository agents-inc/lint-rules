import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalog, type Engine, pluginPrefixOf, type RuleRoute, routeOf } from '@workspace/rule-data'
import { ruleNameOf } from '@workspace/rule-data/rule-id-parts'
import type { RuleCase } from '@workspace/rule-data/test-support/changed-settings-cases'
import { PROOF_CASES } from '@workspace/rule-data/test-support/proof-cases'
import { ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON } from '@workspace/rule-data/test-support/routed-to-eslint-for-a-reason'
import { STAND_IN_CASES } from '@workspace/rule-data/test-support/stand-in-cases'
import { describe, expect, it } from 'vitest'
import { movedRules, oxlintOnlyRules, provenMovedRules } from './__tests__/eslint-versions.ts'

// A shipped rule is owed a proof on each engine that runs it for a project: the one it is routed to, and ESLint without
// oxlint for an oxlint rule ESLint takes over or stands in for. A house rule is proven by its own test in
// eslint-plugin-house, which plugin.test.ts does not check exists.

const FALLBACK_FIXTURE_INDEX = fileURLToPath(new URL('../test-fixtures/eslint-fallback/fixtures.json', import.meta.url))
const HOUSE_RULES_DIR = fileURLToPath(new URL('../../eslint-plugin-house/src/rules', import.meta.url))
const HOUSE = 'house'

// KNOWN GAP: a case has no field for a file no engine lints, and the first three report only beside one: the stylesheet
// a component imports (engines.integration.test.ts proves css-modules beside one), a package.json naming a bin or
// listing the library imported. e18e/prefer-get-or-insert has no case yet; check-rules-shipped-off.integration.test.ts
// proves check reports it where a team turns it on.
const UNPROVEN_ON_AN_ENGINE_THAT_RUNS_THEM: readonly string[] = [
  'css-modules/no-undef-class on eslint',
  'e18e/prefer-get-or-insert on eslint',
  'n/no-unpublished-bin on eslint',
  'sonarjs/no-default-utility-imports on eslint',
]

/** A shipped rule on an engine that runs it: what a proof is owed for, and what a test proves. */
function onEngine(rule: string, engine: Engine): string {
  return `${rule} on ${engine}`
}

function shippedRoutes(): RuleRoute[] {
  return catalog.rules
    .values()
    .filter(({ shipped }) => shipped !== null)
    .toArray()
}

function owedProofs(): string[] {
  const standingIn = oxlintOnlyRules()
    .map(({ id }) => id)
    .filter((id) => catalog.eslintStandIns.has(id))
  const runByEslintWithoutOxlint = new Set([...provenMovedRules().map(({ id }) => id), ...standingIn])
  return shippedRoutes().flatMap(({ id, engine }) => (runByEslintWithoutOxlint.has(id) ? [onEngine(id, 'oxlint'), onEngine(id, 'eslint')] : onEngine(id, engine)))
}

/** As the case runner reads a case: the engines it names, or each that may run its rule. */
function enginesACaseRunsOn({ rule, engines }: RuleCase): readonly Engine[] {
  if (engines !== undefined) return engines
  return routeOf(rule, catalog).engine === 'oxlint' ? ['oxlint', 'eslint'] : ['eslint']
}

/** A case proves its rule on each engine it runs on that reads a file it owes a finding. */
function provenByCases(): string[] {
  return PROOF_CASES.flatMap((ruleCase) =>
    enginesACaseRunsOn(ruleCase)
      .filter((engine) => ruleCase.reportedIn.some(({ onlyIn }) => onlyIn === undefined || onlyIn === engine))
      .map((engine) => onEngine(ruleCase.rule, engine)),
  )
}

/** A stand-in case proves the oxc rule in oxlint and, by its stand-in, in ESLint without oxlint. */
function provenByStandInCases(): string[] {
  return STAND_IN_CASES.filter(({ reportedIn }) => reportedIn.length > 0).flatMap(({ oxlintRule }) => [onEngine(oxlintRule, 'oxlint'), onEngine(oxlintRule, 'eslint')])
}

/** Parse boundary: the ESLint-fallback fixture index, rule ID to fixture file. */
function rulesWithAFallbackFixture(): ReadonlySet<string> {
  return new Set(Object.keys(JSON.parse(readFileSync(FALLBACK_FIXTURE_INDEX, 'utf8')) as Readonly<Record<string, string>>))
}

/**
 * A fixture proves a moved rule in oxlint (oxlint-routed-rules.integration.test.ts), and in ESLint where the fallback
 * runs it or the rule is routed to ESLint for a measured reason (eslint-fallback.integration.test.ts).
 */
function provenByFallbackFixtures(): string[] {
  const withAFixture = rulesWithAFallbackFixture()
  const firedInOxlint = movedRules().map(({ id }) => id)
  const firedInEslint = [...provenMovedRules().map(({ id }) => id), ...ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON]
  return [
    ...firedInOxlint.filter((id) => withAFixture.has(id)).map((id) => onEngine(id, 'oxlint')),
    ...firedInEslint.filter((id) => withAFixture.has(id)).map((id) => onEngine(id, 'eslint')),
  ]
}

function provenByHouseRuleTests(): string[] {
  return shippedRoutes()
    .filter(({ id }) => pluginPrefixOf(id) === HOUSE && existsSync(join(HOUSE_RULES_DIR, `${ruleNameOf(id)}.test.ts`)))
    .map(({ id }) => onEngine(id, 'eslint'))
}

describe('the shipped rules', () => {
  it('are each proven on every engine that runs them for a project, by a case, a stand-in case, an ESLint-fallback fixture or their own house test, but the known gaps', () => {
    const proven = new Set([...provenByCases(), ...provenByStandInCases(), ...provenByFallbackFixtures(), ...provenByHouseRuleTests()])

    expect(owedProofs().filter((owed) => !proven.has(owed)).toSorted()).toStrictEqual(UNPROVEN_ON_AN_ENGINE_THAT_RUNS_THEM)
  })
})
