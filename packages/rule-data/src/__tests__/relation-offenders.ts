import { isDeepStrictEqual } from 'node:util'

import { sharedKeys } from '../collections.ts'
import type { CanonicalAllowanceLeftTo, CanonicalRule, RuleRelation } from '../generate/build-routing.ts'
import { isObject } from '../is-object.ts'
import { type Breach, breachesOf } from './breaches.ts'

// "Covered by": each rule and its cover are turned on by rulesets of their own, and the cover is not
// left out in turn. "Covered in oxlint by": the same, both run by oxlint. "Split by types": both rules
// run in ESLint, on every file, turned on by a ruleset. "Left to": an options entry is kept exactly in the
// files where the rule it is left to runs, so that rule is turned on by a ruleset, left out nowhere, run by
// ESLint where oxlint is not, and run wherever types are known when the holder needs none; a holder
// oxlint runs leaves entries only to rules run on every file.

const TURNED_ON_BY_NO_RULESET: Breach<CanonicalRule> = ['is turned on by no ruleset', ({ ruleset, alwaysOn, whenSuppressions }) => ruleset === undefined || alwaysOn === true || whenSuppressions !== undefined]
const RUN_BY_OXLINT: Breach<CanonicalRule> = ['is run by oxlint', ({ engine }) => engine === 'oxlint']
const RUN_BY_ESLINT: Breach<CanonicalRule> = ['is run by ESLint', ({ engine }) => engine === 'eslint']
const SCOPED: Breach<CanonicalRule> = ['is scoped by files or ignores', ({ files, ignores }) => files !== undefined || ignores !== undefined]
const COVERED: Breach<CanonicalRule> = ['is covered by another rule', ({ coveredBy }) => coveredBy !== undefined]
const COVERED_IN_OXLINT: Breach<CanonicalRule> = ['is covered in oxlint by another rule', ({ coveredInOxlintBy }) => coveredInOxlintBy !== undefined]
const SPLIT_BY_TYPES: Breach<CanonicalRule> = ['splits by types with another rule', ({ splitByTypesWith }) => splitByTypesWith !== undefined]
const TYPED: Breach<CanonicalRule> = ['is typed', ({ typed }) => typed]
const UNTYPED: Breach<CanonicalRule> = ['is untyped', ({ typed }) => !typed]

const UNTYPED_RULE_BREACHES: ReadonlyArray<Breach<CanonicalRule>> = [TYPED, RUN_BY_OXLINT, SCOPED, TURNED_ON_BY_NO_RULESET, COVERED]
const TYPED_RULE_BREACHES: ReadonlyArray<Breach<CanonicalRule>> = [UNTYPED, RUN_BY_OXLINT, SCOPED, TURNED_ON_BY_NO_RULESET, COVERED, SPLIT_BY_TYPES]

/** A way a covered rule and its cover can break what is guaranteed of the pair: what is wrong of them, if anything. */
type PairBreach = (rule: Readonly<CanonicalRule>, cover: Readonly<CanonicalRule>) => readonly string[]

/** A way the rule another names can run on fewer files than the rule naming it: where, said of the rule named. */
type FilesLeft = (rule: Readonly<CanonicalRule>, named: Readonly<CanonicalRule>) => readonly string[]

function coversItself(rule: Readonly<CanonicalRule>, cover: Readonly<CanonicalRule>): readonly string[] {
  return cover.id === rule.id ? ['the rule covers itself'] : []
}

function sharesARuleset(rule: Readonly<CanonicalRule>, cover: Readonly<CanonicalRule>): readonly string[] {
  return rule.ruleset !== undefined && cover.ruleset === rule.ruleset ? [`both are in ${rule.ruleset}`] : []
}

function runsOnlyOnItsFiles(rule: Readonly<CanonicalRule>, { files }: Readonly<CanonicalRule>): readonly string[] {
  return files === undefined || isLimitedTo(rule, files) ? [] : [`runs only on ${files.join(', ')}`]
}

function skipsWhatTheRuleRunsOn(rule: Readonly<CanonicalRule>, named: Readonly<CanonicalRule>): readonly string[] {
  return (named.ignores ?? []).filter((glob) => !(rule.ignores ?? []).includes(glob)).map((glob) => `skips ${glob}`)
}

function runsOnlyWhereTypesAreKnown(rule: Readonly<CanonicalRule>, named: Readonly<CanonicalRule>): readonly string[] {
  return named.typed && !rule.typed ? ['runs only where types are known'] : []
}

const KEPT_TO_SOME_FILES_BY_ESLINT_ALONE = 'the rule holding it is run by oxlint, and only our ESLint config keeps an entry to the files the rule it is left to runs on'

// Not counted: files only oxlint lints, such as `.vue`, which a cover ESLint runs never reaches (my-covered-by-components),
// and files a cover's own code skips by name, such as a story in sonarjs/no-debug-commands-in-ui-tests (my-debugging-utils-stories).
const FILES_THE_NAMED_RULE_CAN_LEAVE: readonly FilesLeft[] = [runsOnlyOnItsFiles, skipsWhatTheRuleRunsOn, runsOnlyWhereTypesAreKnown]

/** Without oxlint, ESLint does not take over a rule the skip list names, so nothing runs it there. */
function onTheEslintFallbackSkipList(eslintFallbackSkips: ReadonlyMap<string, string>): Breach<CanonicalRule> {
  return ['is on the ESLint fallback skip list', ({ id }) => eslintFallbackSkips.has(id)]
}

/** A kind of cover: what a finding calls it, the cover a rule names by it, and what the covered rule, its cover and the pair must not be. */
type CoverKind = {
  readonly called: string
  readonly coverOf: (rule: Readonly<CanonicalRule>) => RuleRelation | undefined
  readonly coveredRuleBreaches: ReadonlyArray<Breach<CanonicalRule>>
  readonly coverBreaches: ReadonlyArray<Breach<CanonicalRule>>
  readonly pairBreaches: readonly PairBreach[]
}

const COVERED_BY: CoverKind = {
  called: 'covered by',
  coverOf({ coveredBy }) {
    return coveredBy
  },
  coveredRuleBreaches: [TURNED_ON_BY_NO_RULESET],
  // A cover that is itself left out somewhere would leave nothing reporting there.
  coverBreaches: [TURNED_ON_BY_NO_RULESET, COVERED, SPLIT_BY_TYPES],
  pairBreaches: [coversItself, sharesARuleset],
}

// oxlint runs both, or the relation has nothing to leave out; the pair may share a ruleset, since the
// cover reports every case the covered rule does.
const COVERED_IN_OXLINT_BY: CoverKind = {
  called: 'covered in oxlint by',
  coverOf({ coveredInOxlintBy }) {
    return coveredInOxlintBy
  },
  coveredRuleBreaches: [TURNED_ON_BY_NO_RULESET, RUN_BY_ESLINT],
  coverBreaches: [TURNED_ON_BY_NO_RULESET, RUN_BY_ESLINT, COVERED, COVERED_IN_OXLINT],
  pairBreaches: [coversItself],
}

const COVER_KINDS: readonly CoverKind[] = [COVERED_BY, COVERED_IN_OXLINT_BY]

/** A rule naming the other rule of its relation. */
type Relation = { readonly rule: CanonicalRule; readonly other: string }

/** A rule and the cover it names, labelled as a finding names the pair; the cover is undefined where it does not ship. */
type CoverPair = { readonly label: string; readonly rule: CanonicalRule; readonly cover: CanonicalRule | undefined }

/** A rule holding an options entry left to another rule, labelled as a finding names it; that rule is undefined where it does not ship. */
type AllowanceLeft = {
  readonly label: string
  readonly holder: CanonicalRule
  readonly allowance: CanonicalAllowanceLeftTo
  readonly leftTo: CanonicalRule | undefined
}

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
    if (typedRule === undefined) return `${label}: the typed rule does not ship`
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

/**
 * `holder leaves option entry <JSON> to rule: what is wrong` for each options entry the canonical list
 * leaves to another rule that does not hold: a rule that does not ship, is turned on by no ruleset, is
 * left out for a cover, is on the ESLint fallback skip list or runs only where types are known for a
 * holder that needs none; a rule scoped by files or ignores for a holder oxlint runs; or an entry the
 * holder's shipped options lack.
 */
export function allowancesLeftToOffenders(rules: readonly CanonicalRule[], eslintFallbackSkips: ReadonlyMap<string, string>): string[] {
  const breachesOfTheRuleLeftTo = [TURNED_ON_BY_NO_RULESET, COVERED, COVERED_IN_OXLINT, onTheEslintFallbackSkipList(eslintFallbackSkips)]
  return allowancesLeftIn(rules).flatMap((left) => wrongOfAllowance(left, breachesOfTheRuleLeftTo))
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
  return filesLeftByTheNamedRule(rule, cover).map((where) => `${label}: the cover ${where}`)
}

function filesLeftByTheNamedRule(rule: Readonly<CanonicalRule>, named: Readonly<CanonicalRule>): string[] {
  return FILES_THE_NAMED_RULE_CAN_LEAVE.flatMap((leaves) => leaves(rule, named))
}

function wrongOfAllowance({ label, holder, allowance, leftTo }: AllowanceLeft, breachesOfTheRuleLeftTo: ReadonlyArray<Breach<CanonicalRule>>): string[] {
  return [...wrongOfTheRuleLeftTo(holder, leftTo, breachesOfTheRuleLeftTo), ...wrongOfTheEntry(holder, allowance)].map((wrong) => `${label}: ${wrong}`)
}

function wrongOfTheRuleLeftTo(holder: Readonly<CanonicalRule>, leftTo: Readonly<CanonicalRule> | undefined, breachesOfTheRuleLeftTo: ReadonlyArray<Breach<CanonicalRule>>): string[] {
  if (leftTo === undefined) return ['the rule it is left to does not ship']
  const wrongOfIt = [...breachesOf(leftTo, breachesOfTheRuleLeftTo), ...runsOnlyWhereTypesAreKnown(holder, leftTo)]
  return [...wrongOfIt.map((wrong) => `the rule it is left to ${wrong}`), ...wrongOfAnOxlintHolder(holder, leftTo)]
}

/** Our oxlint config gives a rule one setting in every file. */
function wrongOfAnOxlintHolder(holder: Readonly<CanonicalRule>, leftTo: Readonly<CanonicalRule>): string[] {
  const isKeptToSomeFiles = leftTo.files !== undefined || leftTo.ignores !== undefined
  return isKeptToSomeFiles && holder.engine === 'oxlint' ? [KEPT_TO_SOME_FILES_BY_ESLINT_ALONE] : []
}

function wrongOfTheEntry(holder: Readonly<CanonicalRule>, allowance: CanonicalAllowanceLeftTo): string[] {
  return holdsTheEntry(holder.options, allowance) ? [] : ['the shipped options hold no such entry']
}

function allowancesLeftIn(rules: readonly CanonicalRule[]): AllowanceLeft[] {
  const shippedById = new Map(rules.map((rule) => [rule.id, rule]))
  return rules.flatMap((holder) => allowancesLeftBy(holder, shippedById))
}

function allowancesLeftBy(holder: Readonly<CanonicalRule>, shippedById: ReadonlyMap<string, CanonicalRule>): AllowanceLeft[] {
  const { allowancesLeftTo = [] } = holder
  return allowancesLeftTo.map((allowance) => ({
    label: `${holder.id} leaves ${allowance.option} entry ${JSON.stringify(allowance.entry)} to ${allowance.rule}`,
    holder,
    allowance,
    leftTo: shippedById.get(allowance.rule),
  }))
}

/** Whether an object of the options lists the entry under the option's key. */
function holdsTheEntry(options: readonly unknown[], { option, entry }: CanonicalAllowanceLeftTo): boolean {
  return options.some((given) => entriesListedUnder(given, option).some((listed) => isDeepStrictEqual(listed, entry)))
}

function entriesListedUnder(given: unknown, option: string): readonly unknown[] {
  if (!isObject(given)) return []
  const fields: ReadonlyArray<readonly [string, unknown]> = Object.entries(given)
  return fields.flatMap(([key, value]): readonly unknown[] => (key === option && Array.isArray(value) ? value : []))
}

function isLimitedTo({ files }: Readonly<CanonicalRule>, globs: readonly string[]): boolean {
  return files?.every((glob) => globs.includes(glob)) === true
}

function coverPairsOf(rules: readonly CanonicalRule[], { called, coverOf }: CoverKind): CoverPair[] {
  const shippedById = new Map(rules.map((rule) => [rule.id, rule]))
  return relationsOf(rules, coverOf).map(({ rule, other }) => ({ label: `${rule.id} ${called} ${other}`, rule, cover: shippedById.get(other) }))
}

function relationsOf(rules: readonly CanonicalRule[], relationOf: (rule: Readonly<CanonicalRule>) => { readonly rule: string } | undefined): Relation[] {
  return rules.flatMap((rule) => {
    const relation = relationOf(rule)
    return relation === undefined ? [] : { rule, other: relation.rule }
  })
}
