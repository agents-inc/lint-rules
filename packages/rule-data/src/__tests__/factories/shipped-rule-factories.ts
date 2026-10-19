import type { ShippedRule } from '../../catalog.ts'
import type { SettingBySuppressionMode } from '../../turned-on-by.ts'

// A route's `shipped`. lint-rules' tests take these through rule-data's test-support export.

/** Every field but what turns the rule on. */
export type ShippedRuleFields = Partial<Omit<ShippedRule, 'ruleset'>>

const SHIPPED_RULE_DEFAULTS: Required<ShippedRuleFields> = {
  options: [],
  files: null,
  ignores: null,
  coveredBy: null,
  coveredInOxlintBy: null,
  splitByTypesWith: null,
  readsRuntimeGlobals: false,
}

/** Turned on by its ruleset, with no options, on every file, related to no other rule, served by none of our runtime globals, unless given. */
export function buildShippedRule(ruleset: string, fields: ShippedRuleFields = {}): ShippedRule {
  return { ruleset, ...SHIPPED_RULE_DEFAULTS, ...fields }
}

/** On whatever rulesets are listed. */
export function buildAlwaysOnShippedRule(fields: ShippedRuleFields = {}): ShippedRule {
  return { alwaysOn: true, ...SHIPPED_RULE_DEFAULTS, ...fields }
}

/** A rule `allowSuppressions` decides: its setting in each mode. */
export function buildShippedRuleDecidedBySuppressions(whenSuppressions: SettingBySuppressionMode, fields: ShippedRuleFields = {}): ShippedRule {
  return { whenSuppressions, ...SHIPPED_RULE_DEFAULTS, ...fields }
}
