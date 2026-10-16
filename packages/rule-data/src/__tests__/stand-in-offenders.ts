import type { Catalog, RuleRoute } from '../catalog.ts'
import { sharedKeys } from '../collections.ts'
import { type Breach, breachesOf } from './breaches.ts'

// What data/eslint-stand-ins.json guarantees (docs/work/spec-data.md, 2.6): without oxlint, ESLint
// states each stand-in in place of a shipped oxlint rule ESLint has no version of. So the oxlint
// rule ships and has no ESLint version to take over, and the stand-in is an untyped rule ESLint runs
// that nothing else turns on: not shipped, not under consideration, not skipped, and standing in for
// one rule only.

/** What the walk reads: the catalog's parts, and the IDs of data/rule-candidates.json. */
export type StandInSources = Pick<Catalog, 'eslintFallbackSkips' | 'eslintStandIns' | 'ruleIdsWithAnEslintVersion' | 'rules'> & {
  readonly candidateIds: ReadonlySet<string>
}

/**
 * `stand-in for oxlint rule: what is wrong` for each pair that does not hold, then `stand-in: stands
 * in for …` for each stand-in named for more than one rule.
 */
export function standInOffenders({ eslintStandIns, rules, ruleIdsWithAnEslintVersion, eslintFallbackSkips, candidateIds }: StandInSources): string[] {
  const oxlintRuleBreaches: readonly Breach<RuleRoute>[] = [
    ['does not ship', ({ shipped }) => shipped === null],
    ['is run by ESLint', ({ engine }) => engine === 'eslint'],
    ['has an ESLint version, which ESLint takes over without oxlint', ({ id }) => ruleIdsWithAnEslintVersion.has(id)],
  ]
  const standInBreaches: readonly Breach<RuleRoute>[] = [
    ['is run by oxlint', ({ engine }) => engine === 'oxlint'],
    ['is typed', ({ typed }) => typed],
    ['ships', ({ shipped }) => shipped !== null],
    ['is a candidate in data/rule-candidates.json', ({ id }) => candidateIds.has(id)],
    ['is on the ESLint-fallback skip list', ({ id }) => eslintFallbackSkips.has(id)],
  ]
  const pairs = [...eslintStandIns]
  const broken = pairs.flatMap(([oxlintRule, standIn]) =>
    [
      ...breachesOfSide('the oxlint rule', rules.get(oxlintRule), oxlintRuleBreaches),
      ...breachesOfSide('the stand-in', rules.get(standIn), standInBreaches),
    ].map((wrong) => `${standIn} for ${oxlintRule}: ${wrong}`),
  )
  const shared = sharedKeys(pairs, ([, standIn]) => standIn).map(([standIn, standingIn]) => `${standIn}: stands in for ${standingIn.map(([oxlintRule]) => oxlintRule).join(', ')}`)
  return [...broken, ...shared]
}

function breachesOfSide(side: string, route: RuleRoute | undefined, breaches: readonly Breach<RuleRoute>[]): string[] {
  if (route === undefined) return [`${side} is no RuleId`]
  return breachesOf(route, breaches).map((wrong) => `${side} ${wrong}`)
}
