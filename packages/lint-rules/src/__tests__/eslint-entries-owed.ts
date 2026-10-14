import type { Catalog } from '@workspace/rule-data'
import type { CalculatedRules } from './eslint-config-oracle.ts'
import { eslintNamesOf, typescriptEslintTwinsOf, withTheTeamsPrefixes } from './other-eslint-names.ts'

// The ESLint merge's precedence contract (decisions.md, "Owner 2026-10-14"; spec-merge-model.md,
// 1.1) as an oracle: what each ESLint name of a rule is owed in one file, read from the team's
// config alone and our part alone, never from the merge. Same-rule names and twins come from
// other-eslint-names.ts.

/** A rule entry as ESLint calculates it for a file, `[severity, ...options]`, or ABSENT where no block sets it. */
export type CalculatedEntry = readonly unknown[] | typeof ABSENT

/**
 * A rule the merge is checked over: every ESLint name it goes by, its own ID and the team's prefixes
 * included, and typescript-eslint's twins of it, each a rule ID.
 */
export type RuleInPlay = { readonly rule: string; readonly names: readonly string[]; readonly twins: readonly string[] }

/**
 * Our rule and typescript-eslint's twins of it, which count as one rule, and whether the team sets
 * any of them, under any of its names, anywhere in either of its configs.
 */
export type RulesInPlay = { readonly rules: readonly RuleInPlay[]; readonly setByTheTeam: boolean }

/** One file as each side gives it: calculated entries of the team's config alone and of our part alone. */
export type SidesOfAFile = { readonly team: CalculatedRules; readonly ours: CalculatedRules }

export const ABSENT = 'absent'

const OFF_SEVERITY = 0

/**
 * The entry the name is owed in the file: the team's config alone decides every name of our rule and
 * of its twins, in every file, wherever the team sets any of them, at any severity and in whatever
 * files; our part alone decides them everywhere where the team sets none. Our `off`, our ignores and
 * the files a team block applies to change nothing in who decides.
 */
export function owedEntry(name: string, sides: SidesOfAFile, inPlay: RulesInPlay): CalculatedEntry {
  refuseANameOutOfPlay(name, inPlay)
  return calculatedEntryOf(inPlay.setByTheTeam ? sides.team : sides.ours, name)
}

/**
 * Our rule and each of typescript-eslint's twins of it, each under every ESLint name it goes by, the
 * team's prefixes for our plugins included (`teamsPrefixes`, keyed by our prefix); set by the team
 * where any of those names is among the rule keys the team's configs state.
 */
export function rulesInPlayOf(
  ruleId: string,
  teamsPrefixes: ReadonlyMap<string, readonly string[]>,
  keysTheTeamStates: ReadonlySet<string>,
  catalog: Catalog,
): RulesInPlay {
  const rules = [ruleId, ...typescriptEslintTwinsOf(ruleId)].map(
    (rule): RuleInPlay => ({
      rule,
      names: withTheTeamsPrefixes(eslintNamesOf(rule, catalog), teamsPrefixes),
      twins: typescriptEslintTwinsOf(rule),
    }),
  )
  return { rules, setByTheTeam: rules.some(({ names }) => names.some((name) => keysTheTeamStates.has(name))) }
}

/** The names in play on in the merged config's file that the team's config alone does not run there, sorted. */
export function namesOnBeyondTheTeams(merged: CalculatedRules, teamAlone: CalculatedRules, inPlay: RulesInPlay): string[] {
  return namesInPlay(inPlay).filter((name) => isOn(calculatedEntryOf(merged, name)) && !isOn(calculatedEntryOf(teamAlone, name)))
}

/** The rule's calculated entry, or ABSENT; ESLint always calculates one as `[severity, ...options]`. */
export function calculatedEntryOf(rules: CalculatedRules, name: string): CalculatedEntry {
  const entry = rules[name]
  if (entry === undefined) return ABSENT
  if (!Array.isArray(entry)) throw new Error(`ESLint calculates a rule entry as [severity, ...options], not ${JSON.stringify(entry)}`)
  return entry
}

/** Every name of every rule in play, sorted: the names the merge is checked over. */
export function namesInPlay({ rules }: RulesInPlay): string[] {
  return [...new Set(rules.flatMap(({ names }) => names))].toSorted()
}

function isOn(entry: CalculatedEntry): boolean {
  return entry !== ABSENT && entry[0] !== OFF_SEVERITY
}

/** A name is owed an entry only as a name of exactly one rule in play. */
function refuseANameOutOfPlay(name: string, { rules }: RulesInPlay): void {
  const named = rules.filter(({ names }) => names.includes(name))
  if (named.length !== 1) throw new Error(`${name} must be a name of exactly one rule in play, and is one of ${String(named.length)}`)
}
