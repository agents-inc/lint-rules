import { sharedKeys } from '../collections.ts'
import type { CanonicalRule, RuleRelation } from '../generate/build-routing.ts'
import { type Breach, breachesOf } from './breaches.ts'

// "Covered by": each rule and its cover are turned on by rulesets of their own, and the cover is not
// left out in turn. "Covered in oxlint by": the same, both run by oxlint. "Split by types": both rules
// run in ESLint, on every file, turned on by a ruleset.

const TURNED_ON_BY_NO_RULESET: Breach<CanonicalRule> = ['is turned on by no ruleset', ({ ruleset, alwaysOn, whenSuppressions }) => ruleset === undefined || alwaysOn === true || whenSuppressions !== undefined]
const RUN_BY_OXLINT: Breach<CanonicalRule> = ['is run by oxlint', ({ engine }) => engine === 'oxlint']
const RUN_BY_ESLINT: Breach<CanonicalRule> = ['is run by ESLint', ({ engine }) => engine === 'eslint']
const SCOPED: Breach<CanonicalRule> = ['is scoped by files or ignores', ({ files, ignores }) => files !== undefined || ignores !== undefined]
const COVERED: Breach<CanonicalRule> = ['is covered by another rule', ({ coveredBy }) => coveredBy !== undefined]
const COVERED_IN_OXLINT: Breach<CanonicalRule> = ['is covered in oxlint by another rule', ({ coveredInOxlintBy }) => coveredInOxlintBy !== undefined]
const SPLIT_BY_TYPES: Breach<CanonicalRule> = ['splits by types with another rule', ({ splitByTypesWith }) => splitByTypesWith !== undefined]
const TYPED: Breach<CanonicalRule> = ['is typed', ({ typed }) => typed]
const UNTYPED: Breach<CanonicalRule> = ['is untyped', ({ typed }) => !typed]

const UNTYPED_RULE_BREACHES: readonly Breach<CanonicalRule>[] = [TYPED, RUN_BY_OXLINT, SCOPED, TURNED_ON_BY_NO_RULESET, COVERED]
const TYPED_RULE_BREACHES: readonly Breach<CanonicalRule>[] = [UNTYPED, RUN_BY_OXLINT, SCOPED, TURNED_ON_BY_NO_RULESET, COVERED, SPLIT_BY_TYPES]

/** A way a covered rule and its cover can break what is guaranteed of the pair: what is wrong of them, if anything. */
type PairBreach = (rule: CanonicalRule, cover: CanonicalRule) => readonly string[]

const COVERS_ITSELF: PairBreach = (rule, cover) => (cover.id === rule.id ? ['the rule covers itself'] : [])
const SHARES_A_RULESET: PairBreach = (rule, cover) => (rule.ruleset !== undefined && cover.ruleset === rule.ruleset ? [`both are in ${rule.ruleset}`] : [])

const RUNS_ONLY_ON_ITS_FILES: PairBreach = (rule, { files }) =>
  files === undefined || isLimitedTo(rule, files) ? [] : [`the cover runs only on ${files.join(', ')}`]
const SKIPS_WHAT_THE_RULE_RUNS_ON: PairBreach = (rule, cover) =>
  (cover.ignores ?? []).filter((glob) => !(rule.ignores ?? []).includes(glob)).map((glob) => `the cover skips ${glob}`)
const RUNS_ONLY_WHERE_TYPES_ARE_KNOWN: PairBreach = (rule, cover) => (cover.typed && !rule.typed ? ['the cover runs only where types are known'] : [])

// Not counted: files only oxlint lints, such as `.vue`, which a cover ESLint runs never reaches (my-covered-by-components),
// and files a cover's own code skips by name, such as a story in sonarjs/no-debug-commands-in-ui-tests (my-debugging-utils-stories).
const FILES_A_COVER_CAN_LEAVE: readonly PairBreach[] = [RUNS_ONLY_ON_ITS_FILES, SKIPS_WHAT_THE_RULE_RUNS_ON, RUNS_ONLY_WHERE_TYPES_ARE_KNOWN]

/** A kind of cover: what a finding calls it, the cover a rule names by it, and what the covered rule, its cover and the pair must not be. */
type CoverKind = {
  readonly called: string
  readonly coverOf: (rule: CanonicalRule) => RuleRelation | undefined
  readonly coveredRuleBreaches: readonly Breach<CanonicalRule>[]
  readonly coverBreaches: readonly Breach<CanonicalRule>[]
  readonly pairBreaches: readonly PairBreach[]
}

const COVERED_BY: CoverKind = {
  called: 'covered by',
  coverOf: ({ coveredBy }) => coveredBy,
  coveredRuleBreaches: [TURNED_ON_BY_NO_RULESET],
  // A cover that is itself left out somewhere would leave nothing reporting there.
  coverBreaches: [TURNED_ON_BY_NO_RULESET, COVERED, SPLIT_BY_TYPES],
  pairBreaches: [COVERS_ITSELF, SHARES_A_RULESET],
}

// oxlint runs both, or the relation has nothing to leave out; the pair may share a ruleset, since the
// cover reports every case the covered rule does.
const COVERED_IN_OXLINT_BY: CoverKind = {
  called: 'covered in oxlint by',
  coverOf: ({ coveredInOxlintBy }) => coveredInOxlintBy,
  coveredRuleBreaches: [TURNED_ON_BY_NO_RULESET, RUN_BY_ESLINT],
  coverBreaches: [TURNED_ON_BY_NO_RULESET, RUN_BY_ESLINT, COVERED, COVERED_IN_OXLINT],
  pairBreaches: [COVERS_ITSELF],
}

const COVER_KINDS: readonly CoverKind[] = [COVERED_BY, COVERED_IN_OXLINT_BY]

/** A rule naming the other rule of its relation. */
type Relation = { readonly rule: CanonicalRule; readonly other: string }

/** A rule and the cover it names, labelled as a finding names the pair; the cover is undefined where it does not ship. */
type CoverPair = { readonly label: string; readonly rule: CanonicalRule; readonly cover: CanonicalRule | undefined }

/**
 * `rule covered by cover: what is wrong` for each "covered by" the canonical list records that does
 * not hold: a cover that does not ship, a rule or cover turned on by no ruleset, both in one ruleset
 * (a drop, not a cover), a rule covering itself, a cover left out in turn or split by types.
 */
export function coveredByOffenders(rules: readonly CanonicalRule[]): string[] {
  return coverOffendersOf(rules, COVERED_BY)
}

/**
 * `rule covered in oxlint by cover: what is wrong` for each "covered in oxlint by" the canonical list
 * records that does not hold: a cover that does not ship, a rule or cover turned on by no ruleset or
 * run by ESLint, a rule covering itself, a cover left out in turn.
 */
export function coveredInOxlintByOffenders(rules: readonly CanonicalRule[]): string[] {
  return coverOffendersOf(rules, COVERED_IN_OXLINT_BY)
}

/**
 * `rule <kind> cover: where the cover does not run` for each set of files the covered rule runs on and its
 * cover does not, of either kind: there, nothing reports what the covered rule would.
 */
export function filesLeftUncovered(rules: readonly CanonicalRule[]): string[] {
  return COVER_KINDS.flatMap((kind) => coverPairsOf(rules, kind)).flatMap(filesLeftBy)
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

/** `rule <kind> cover: what is wrong` for each cover of the kind the canonical list records that does not hold. */
function coverOffendersOf(rules: readonly CanonicalRule[], kind: CoverKind): string[] {
  return coverPairsOf(rules, kind).flatMap((pair) => wrongOfPair(pair, kind))
}

function wrongOfPair({ label, rule, cover }: CoverPair, { coveredRuleBreaches, coverBreaches, pairBreaches }: CoverKind): string[] {
  if (cover === undefined) return [`${label}: the cover does not ship`]
  return [
    ...breachesOf(rule, coveredRuleBreaches).map((wrong) => `${label}: the covered rule ${wrong}`),
    ...breachesOf(cover, coverBreaches).map((wrong) => `${label}: the cover ${wrong}`),
    ...pairBreaches.flatMap((breaks) => breaks(rule, cover)).map((wrong) => `${label}: ${wrong}`),
  ]
}

function filesLeftBy({ label, rule, cover }: CoverPair): string[] {
  if (cover === undefined) return []
  return FILES_A_COVER_CAN_LEAVE.flatMap((leaves) => leaves(rule, cover)).map((where) => `${label}: ${where}`)
}

function isLimitedTo({ files }: CanonicalRule, globs: readonly string[]): boolean {
  return files !== undefined && files.every((glob) => globs.includes(glob))
}

function coverPairsOf(rules: readonly CanonicalRule[], { called, coverOf }: CoverKind): CoverPair[] {
  const shippedById = new Map(rules.map((rule) => [rule.id, rule]))
  return relationsOf(rules, coverOf).map(({ rule, other }) => ({ label: `${rule.id} ${called} ${other}`, rule, cover: shippedById.get(other) }))
}

function relationsOf(rules: readonly CanonicalRule[], relationOf: (rule: CanonicalRule) => { readonly rule: string } | undefined): Relation[] {
  return rules.flatMap((rule) => {
    const relation = relationOf(rule)
    return relation === undefined ? [] : [{ rule, other: relation.rule }]
  })
}
