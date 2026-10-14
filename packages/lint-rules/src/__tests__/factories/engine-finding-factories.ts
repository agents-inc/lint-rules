import type { EngineFinding, FindingsByFileAndRule, RuleByItsNames } from '../findings-beside-the-team.ts'

const A_MESSAGE = 'a finding'

/** A finding as either engine reports it, under that engine's name for the rule, on line 1 unless given. */
export function buildEngineFinding(engine: EngineFinding['engine'], file: string, rule: string, line = 1, message = A_MESSAGE): EngineFinding {
  return { engine, file, rule, line, message }
}

/** A rule known by the names given. */
export function buildRuleByItsNames(rule: string, names: readonly string[]): RuleByItsNames {
  return { rule, names }
}

/** One file's findings of each rule given. */
export function buildFindingsOfAFile(file: string, byRule: Readonly<Record<string, readonly string[]>>): FindingsByFileAndRule {
  return { [file]: byRule }
}
