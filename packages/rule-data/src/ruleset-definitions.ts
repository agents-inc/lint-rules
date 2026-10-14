import definitions from '../data/ruleset-definitions.json' with { type: 'json' }

import type { RulesetDefinition } from './catalog.ts'
import { parseRulesetList } from './parse-names.ts'

/** Every ruleset, in the order a consumer's config lists them. */
export const rulesetDefinitions: readonly RulesetDefinition[] = definitions.map((definition) => ({
  ...definition,
  list: parseRulesetList(definition.list),
}))
