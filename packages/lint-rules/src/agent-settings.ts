// `check` sees only the editor parts agents-inc.lint.mts exports; this maps each part back to the agent settings.

import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { configErrorIn } from './core/config-error.ts'
import type { EditorParts, EslintPart, OxlintPart } from './core/editor-parts.ts'
import type { LintRulesInput } from './core/lint-rules-input.ts'

const agentSettingsByPart = new WeakMap<EslintPart | OxlintPart, LintRulesInput>()

export function recordAgentSettings(parts: EditorParts, agentSettings: LintRulesInput): void {
  agentSettingsByPart.set(parts.eslint, agentSettings)
  if (parts.oxlint !== undefined) agentSettingsByPart.set(parts.oxlint, agentSettings)
}

/** Throws on any object `defineLintRules` did not return, an equal copy included. */
export function agentSettingsOf(part: EslintPart | OxlintPart): LintRulesInput {
  const agentSettings = agentSettingsByPart.get(part)
  if (agentSettings === undefined) {
    throw configErrorIn(
      consumerConfigFiles.lintRules,
      'the part given is not one defineLintRules returned: pass `eslint` or `oxlint` exactly as the file exports it',
    )
  }
  return agentSettings
}
