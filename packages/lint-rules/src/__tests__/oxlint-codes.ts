import type { Catalog, OxlintRule } from '@workspace/rule-data'

const PLUGIN_SEPARATOR = '/'
const NOT_FOUND = -1

/** As the catalog records the oxlint we install: throws where it has none. */
export function oxlintRuleWithId(ruleId: string, catalog: Catalog): OxlintRule {
  const rule = catalog.oxlintRules.find(({ id }) => id === ruleId)
  if (rule === undefined) throw new Error(`oxlint has no version of ${ruleId}`)
  return rule
}

/** Its plugin, then its rule name in parentheses: `eslint(no-debugger)`; `react(rules-of-hooks)` for react-hooks/rules-of-hooks. */
export function oxlintCodeOf(ruleId: string, catalog: Catalog): string {
  return oxlintCodeOfRule(oxlintRuleWithId(ruleId, catalog))
}

export function oxlintCodeOfRule({ oxlintName, oxlintPlugin }: OxlintRule): string {
  const separator = oxlintName.indexOf(PLUGIN_SEPARATOR)
  return `${oxlintPlugin}(${separator === NOT_FOUND ? oxlintName : oxlintName.slice(separator + 1)})`
}
