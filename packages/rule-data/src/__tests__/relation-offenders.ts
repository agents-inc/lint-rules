import { sharedKeys } from '../collections.ts'
import type { CanonicalRule } from '../generate/build-routing.ts'
import { type Breach, breachesOf } from './breaches.ts'

// What the canonical list guarantees the two relations the core applies between shipped rules
// (docs/work/spec-data.md, 2.6). "Covered by": the narrow rule is left out wherever the rule covering
// it is on, so each must be turned on by a ruleset of its own, and the cover must not be left out in
// turn. "Split by types": the untyped rule is off where its typed partner runs with type information,
// so both run in ESLint, on every file, turned on by a ruleset.

const TURNED_ON_BY_NO_RULESET: Breach<CanonicalRule> = ['is turned on by no ruleset', ({ ruleset, alwaysOn, whenSuppressions }) => ruleset === undefined || alwaysOn === true || whenSuppressions !== undefined]
const RUN_BY_OXLINT: Breach<CanonicalRule> = ['is run by oxlint', ({ engine }) => engine === 'oxlint']
const SCOPED: Breach<CanonicalRule> = ['is scoped by files or ignores', ({ files, ignores }) => files !== undefined || ignores !== undefined]
const COVERED: Breach<CanonicalRule> = ['is covered by another rule', ({ coveredBy }) => coveredBy !== undefined]
const SPLIT_BY_TYPES: Breach<CanonicalRule> = ['splits by types with another rule', ({ splitByTypesWith }) => splitByTypesWith !== undefined]
const TYPED: Breach<CanonicalRule> = ['is typed', ({ typed }) => typed]
const UNTYPED: Breach<CanonicalRule> = ['is untyped', ({ typed }) => !typed]

const COVERED_RULE_BREACHES: readonly Breach<CanonicalRule>[] = [TURNED_ON_BY_NO_RULESET]
// A cover that is itself left out somewhere would leave nothing reporting there.
const COVER_BREACHES: readonly Breach<CanonicalRule>[] = [TURNED_ON_BY_NO_RULESET, COVERED, SPLIT_BY_TYPES]
const UNTYPED_RULE_BREACHES: readonly Breach<CanonicalRule>[] = [TYPED, RUN_BY_OXLINT, SCOPED, TURNED_ON_BY_NO_RULESET, COVERED]
const TYPED_RULE_BREACHES: readonly Breach<CanonicalRule>[] = [UNTYPED, RUN_BY_OXLINT, SCOPED, TURNED_ON_BY_NO_RULESET, COVERED, SPLIT_BY_TYPES]

/** A rule naming the other rule of its relation. */
type Relation = { readonly rule: CanonicalRule; readonly other: string }

/**
 * `rule covered by cover: what is wrong` for each "covered by" the canonical list records that does
 * not hold: a cover that does not ship, a rule or cover turned on by no ruleset, both in one ruleset
 * (a drop, not a cover), a rule covering itself, a cover left out in turn or split by types.
 */
export function coveredByOffenders(rules: readonly CanonicalRule[]): string[] {
  const shippedById = new Map(rules.map((rule) => [rule.id, rule]))
  return relationsOf(rules, ({ coveredBy }) => coveredBy).flatMap(({ rule, other }) => {
    const label = `${rule.id} covered by ${other}`
    const cover = shippedById.get(other)
    if (cover === undefined) return [`${label}: the cover does not ship`]
    return [
      ...breachesOf(rule, COVERED_RULE_BREACHES).map((wrong) => `${label}: the covered rule ${wrong}`),
      ...breachesOf(cover, COVER_BREACHES).map((wrong) => `${label}: the cover ${wrong}`),
      ...(cover.id === rule.id ? [`${label}: the rule covers itself`] : []),
      ...(rule.ruleset !== undefined && cover.ruleset === rule.ruleset ? [`${label}: both are in ${rule.ruleset}`] : []),
    ]
  })
}

/**
 * `untyped rule split by types with typed rule: what is wrong` for each "split by types" the
 * canonical list records that does not hold, then `typed rule: the typed partner of …` for each typed
 * rule more than one untyped rule names.
 */
export function splitByTypesOffenders(rules: readonly CanonicalRule[]): string[] {
  const shippedById = new Map(rules.map((rule) => [rule.id, rule]))
  const relations = relationsOf(rules, ({ splitByTypesWith }) => splitByTypesWith)
  const broken = relations.flatMap(({ rule, other }) => {
    const label = `${rule.id} split by types with ${other}`
    const typedRule = shippedById.get(other)
    if (typedRule === undefined) return [`${label}: the typed rule does not ship`]
    return [
      ...breachesOf(rule, UNTYPED_RULE_BREACHES).map((wrong) => `${label}: the untyped rule ${wrong}`),
      ...breachesOf(typedRule, TYPED_RULE_BREACHES).map((wrong) => `${label}: the typed rule ${wrong}`),
    ]
  })
  const shared = sharedKeys(relations, ({ other }) => other).map(
    ([typedRule, naming]) => `${typedRule}: the typed partner of ${naming.map(({ rule }) => rule.id).join(', ')}`,
  )
  return [...broken, ...shared]
}

function relationsOf(rules: readonly CanonicalRule[], relationOf: (rule: CanonicalRule) => { readonly rule: string } | undefined): Relation[] {
  return rules.flatMap((rule) => {
    const relation = relationOf(rule)
    return relation === undefined ? [] : [{ rule, other: relation.rule }]
  })
}
