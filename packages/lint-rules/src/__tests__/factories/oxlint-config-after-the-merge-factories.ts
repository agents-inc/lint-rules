import type { DummyRuleMap, OxlintConfig } from 'oxlint'
import type { TeamEslintConfigPath } from '../team-configs-of-the-other-engine.ts'

// A team's oxlint.config.mts that hands our merge one config and exports another: the rules it adds after the
// merge are never handed to it.

/** As mergedOxlintConfigText, then adds the rule statements given to the merged config's root. */
export function oxlintConfigAddingRulesAfterTheMergeText(
  lintRulesModule: string,
  teamConfig: OxlintConfig,
  teamEslintConfig: TeamEslintConfigPath,
  rulesAdded: DummyRuleMap,
): string {
  return `import { mergeOxlintConfig } from '@agents-inc/lint-rules/oxlint'
import { oxlint } from './${lintRulesModule}'

const merged = mergeOxlintConfig(${JSON.stringify(teamConfig, null, 2)}, oxlint, ${JSON.stringify(teamEslintConfig)})

export default { ...merged, rules: { ...merged.rules, ...${JSON.stringify(rulesAdded)} } }
`
}
