import type { Catalog } from '@workspace/rule-data'
import { type CalculatedRules, type CalculatedRulesOrNotLinted, NOT_LINTED } from './eslint-config-oracle.ts'
import { eslintNamesOf, typescriptEslintTwinsOf, withTheTeamsPrefixes } from './other-eslint-names.ts'

// The ESLint merge's precedence contract as an oracle: what each ESLint name of a rule is owed in a file, read
// from the team's config alone and our part alone, never from the merge.

/** A rule entry as ESLint calculates it for a file, `[severity, ...options]`, or ABSENT where no block sets it. */
export type CalculatedEntry = readonly unknown[] | typeof ABSENT

/** Every ESLint name of the rule, the team's prefixes included, and typescript-eslint's twins of it. */
export type RuleInPlay = { readonly rule: string; readonly names: readonly string[]; readonly twins: readonly string[] }

/** Our rule and its twins count as one rule; `setByTheTeam` where the team sets any of them anywhere. */
export type RulesInPlay = { readonly rules: readonly RuleInPlay[]; readonly setByTheTeam: boolean }

export type SidesOfAFile = { readonly team: CalculatedRules; readonly ours: CalculatedRules }

export const ABSENT = 'absent'

const OFF_SEVERITY = 0

/**
* The team's config alone decides every name of our rule and its twins everywhere it sets any of them, at any
* severity and in any files; otherwise our part alone does.
*/
export function owedEntry(name: string, sides: SidesOfAFile, inPlay: RulesInPlay): CalculatedEntry {
  refuseANameOutOfPlay(name, inPlay)
  return calculatedEntryOf(inPlay.setByTheTeam ? sides.team : sides.ours, name)
}

/** `teamsPrefixes` is keyed by our prefix; set by the team where any name is among the rule keys its configs state. */
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

export function namesOnBeyondTheTeams(merged: CalculatedRules, teamAlone: CalculatedRules, inPlay: RulesInPlay): string[] {
  return namesInPlay(inPlay).filter((name) => isOn(calculatedEntryOf(merged, name)) && !isOn(calculatedEntryOf(teamAlone, name)))
}

/** ESLint always calculates an entry as `[severity, ...options]`. */
export function calculatedEntryOf(rules: CalculatedRules, name: string): CalculatedEntry {
  const entry = rules[name]
  if (entry === undefined) return ABSENT
  if (!Array.isArray(entry)) throw new Error(`ESLint calculates a rule entry as [severity, ...options], not ${JSON.stringify(entry)}`)
  return entry
}

/** NOT_LINTED where ESLint lints no such file. */
export function entriesOfEachFileIn(
  rulesByFile: Readonly<Record<string, CalculatedRulesOrNotLinted>>,
  ruleIds: readonly string[],
  files: readonly string[],
): Record<string, Record<string, CalculatedEntry> | typeof NOT_LINTED> {
  return Object.fromEntries(
    files.map((file): [string, Record<string, CalculatedEntry> | typeof NOT_LINTED] => {
      const rules = rulesByFile[file]
      if (rules === undefined) throw new Error(`ESLint calculated nothing for ${file}`)
      return [file, rules === NOT_LINTED ? NOT_LINTED : Object.fromEntries(ruleIds.map((id) => [id, calculatedEntryOf(rules, id)]))]
    }),
  )
}

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
