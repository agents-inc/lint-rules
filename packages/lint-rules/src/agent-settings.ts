// `check` imports agents-inc.lint.mts and sees only the editor parts it exports. This registry,
// keyed by each part `defineLintRules` returned, gives it back the agent set's settings, from which
// the agent builders make both complete configs. Internal: no package.json export and no
// declaration file names it, and index and `check` share this one module.

import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { configErrorIn } from './core/config-error.ts'
import type { EditorParts, EslintPart, OxlintPart } from './core/editor-parts.ts'
import type { LintRulesInput } from './core/lint-rules-input.ts'

const agentSettingsByPart = new WeakMap<EslintPart | OxlintPart, LintRulesInput>()

/** Records the agent settings under each part, so either part leads back to them. */
export function recordAgentSettings(parts: EditorParts, agentSettings: LintRulesInput): void {
  agentSettingsByPart.set(parts.eslint, agentSettings)
  if (parts.oxlint !== undefined) agentSettingsByPart.set(parts.oxlint, agentSettings)
}

/**
 * The agent settings of the config whose part this is: the shared keys, with the agent set as the
 * core's single `rulesets`. Throws on any object `defineLintRules` did not return, an equal copy
 * included: only the part itself proves it came from a validated config.
 */
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
