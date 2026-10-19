// `check` sees only the editor parts agents-inc.lint.mts exports; this maps each part back to the agent settings.

import { foundOr } from '@workspace/rule-data/collections'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { configProblemIn } from './core/config-error.ts'
import type { EditorParts, EslintPart, OxlintPart } from './core/editor-parts.ts'
import type { LintRulesInput } from './core/lint-rules-input.ts'

const agentSettingsByPart = new WeakMap<EslintPart | OxlintPart, LintRulesInput>()

const NOT_A_PART_DEFINE_LINT_RULES_RETURNED = configProblemIn(
  consumerConfigFiles.lintRules,
  'the part given is not one defineLintRules returned: pass `eslint` or `oxlint` exactly as the file exports it',
)

export function recordAgentSettings(parts: EditorParts, agentSettings: LintRulesInput): void {
  agentSettingsByPart.set(parts.eslint, agentSettings)
  if (parts.oxlint !== undefined) agentSettingsByPart.set(parts.oxlint, agentSettings)
}

/** Throws on any object `defineLintRules` did not return, an equal copy included. */
export function agentSettingsOf(part: EslintPart | OxlintPart): LintRulesInput {
  return foundOr(agentSettingsByPart.get(part), NOT_A_PART_DEFINE_LINT_RULES_RETURNED)
}
