import type { Catalog, OxlintRule } from '@workspace/rule-data'
import { ruleNameOf } from '@workspace/rule-data/rule-id-parts'

/** As the catalog records the oxlint we install: throws where it has none. */
export function oxlintRuleWithId(ruleId: string, catalog: Readonly<Catalog>): OxlintRule {
  const rule = catalog.oxlintRules.find(({ id }) => id === ruleId)
  if (rule === undefined) throw new Error(`oxlint has no version of ${ruleId}`)
  return rule
}

/** Its plugin, then its rule name in parentheses: `eslint(no-debugger)`; `react(rules-of-hooks)` for react-hooks/rules-of-hooks. */
export function oxlintCodeOf(ruleId: string, catalog: Readonly<Catalog>): string {
  return oxlintCodeOfRule(oxlintRuleWithId(ruleId, catalog))
}

export function oxlintCodeOfRule({ oxlintName, oxlintPlugin }: OxlintRule): string {
  return `${oxlintPlugin}(${ruleNameOf(oxlintName)})`
}
