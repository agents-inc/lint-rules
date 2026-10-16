import { type AgentConfigs, buildAgentConfigs } from '../agent-configs.ts'
import { agentSettingsOf } from '../agent-settings.ts'
import type { EditorParts, OxlintPart } from '../core/editor-parts.ts'
import type { defineLintRules } from '../index.ts'

/** What `agents-inc.lint.mts` holds once `defineLintRules` has run. */
export type DefinedLintRules = ReturnType<typeof defineLintRules>

/**
 * The agent build of a config, as `check` makes it: the agent set, through the internal hook, into
 * both engines' complete configs. oxlint runs its rules whatever the project's package.json lists.
 */
export function agentConfigsOf({ editorRulesets }: DefinedLintRules): AgentConfigs {
  return buildAgentConfigs(agentSettingsOf(editorRulesets.eslint))
}

/** The editor oxlint part: throws where there is none, as for a project whose package.json lists no oxlint. */
export function oxlintPartOf({ oxlint }: EditorParts): OxlintPart {
  if (oxlint === undefined) throw new Error('the project lists oxlint, so it has an oxlint part')
  return oxlint
}
