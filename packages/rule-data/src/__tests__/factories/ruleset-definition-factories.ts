import type { RulesetDefinition } from '../../catalog.ts'

/**
 * One entry of `data/ruleset-definitions.json`. The list and domain decide where the ruleset is
 * rendered, so both are required; `env` is read only by the config factories, and `optIn` and
 * `sortsCode` by `init`.
 */
export function buildRulesetDefinition(
  name: string,
  fields: Readonly<Pick<RulesetDefinition, 'domain' | 'list'> & Partial<Pick<RulesetDefinition, 'env' | 'optIn' | 'sortsCode'>>>,
): RulesetDefinition {
  return { name, env: null, optIn: false, sortsCode: false, ...fields }
}
