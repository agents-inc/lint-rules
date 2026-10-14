import type { RulesetDefinition } from '../../catalog.ts'

/**
 * One entry of `data/ruleset-definitions.json`. The list and domain decide where the ruleset is
 * rendered, so both are required; `env` is read only by the config factories.
 */
export function buildRulesetDefinition(
  name: string,
  fields: Pick<RulesetDefinition, 'domain' | 'list'> & Partial<Pick<RulesetDefinition, 'env'>>,
): RulesetDefinition {
  return { name, env: null, ...fields }
}
