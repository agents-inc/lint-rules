import type { Catalog, OxlintRule } from '@workspace/rule-data'
import { ruleNameOf } from '@workspace/rule-data/rule-id-parts'

// oxlint prints these two of its react plugin's rules under react-hooks, and the rest of them under react (1.87).
const RULES_OXLINT_PRINTS_UNDER_REACT_HOOKS: ReadonlySet<string> = new Set(['react/rules-of-hooks', 'react/exhaustive-deps'])
const REACT_HOOKS = 'react-hooks'

/** As the catalog records the oxlint we install: throws where it has none. */
export function oxlintRuleWithId(ruleId: string, catalog: Readonly<Catalog>): OxlintRule {
  const rule = catalog.oxlintRules.find(({ id }) => id === ruleId)
  if (rule === undefined) throw new Error(`oxlint has no version of ${ruleId}`)
  return rule
}

/** Its plugin, then its rule name in parentheses: `eslint(no-debugger)`; `react(purity)` for react-hooks/purity. */
export function oxlintCodeOf(ruleId: string, catalog: Readonly<Catalog>): string {
  return oxlintCodeOfRule(oxlintRuleWithId(ruleId, catalog))
}

export function oxlintCodeOfRule({ oxlintName, oxlintPlugin }: OxlintRule): string {
  const plugin = RULES_OXLINT_PRINTS_UNDER_REACT_HOOKS.has(oxlintName) ? REACT_HOOKS : oxlintPlugin
  return `${plugin}(${ruleNameOf(oxlintName)})`
}
