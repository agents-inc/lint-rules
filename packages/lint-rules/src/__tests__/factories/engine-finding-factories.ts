import type { EngineFinding } from '../engine-clis.ts'
import type { FindingsByFileAndRule, RuleByItsNames } from '../findings-beside-the-team.ts'

const A_MESSAGE = 'a finding'

/** A finding as either engine reports it, under that engine's name for the rule, on line 1 unless given. */
export function buildEngineFinding(engine: EngineFinding['engine'], file: string, rule: string, line = 1, message = A_MESSAGE): EngineFinding {
  return { engine, file, rule, line, message }
}

export function buildRuleByItsNames(rule: string, names: readonly string[]): RuleByItsNames {
  return { rule, names }
}

export function buildFindingsOfAFile(file: string, byRule: Readonly<Record<string, readonly string[]>>): FindingsByFileAndRule {
  return { [file]: byRule }
}
