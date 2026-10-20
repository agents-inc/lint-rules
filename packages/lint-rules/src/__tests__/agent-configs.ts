import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { type AgentConfigs, buildAgentConfigs } from '../agent-configs.ts'
import { agentSettingsOf } from '../agent-settings.ts'
import type { EditorParts, OxlintPart } from '../core/editor-parts.ts'
import type { defineLintRules } from '../index.ts'

export type DefinedLintRules = ReturnType<typeof defineLintRules>

type EslintBlockSettings = { readonly [key in 'name' | 'files' | 'ignores' | 'rules' | 'linterOptions']: Linter.Config[key] }

/** What the agent build sets: never equal across two builds whole, as each makes its plugin objects anew. */
export type AgentBuildSettings = { readonly oxlint: OxlintConfig; readonly eslint: readonly EslintBlockSettings[] }

/** As `check` makes it, through the internal hook; oxlint runs its rules whatever the project's package.json lists. */
export function agentConfigsOf({ editorRulesets }: DefinedLintRules): AgentConfigs {
  return buildAgentConfigs(agentSettingsOf(editorRulesets.eslint))
}

/** The oxlint config and each ESLint block's name, files, ignores, rules and linterOptions: the keys left out hold objects each build makes anew. */
export function agentBuildSettingsOf(defined: DefinedLintRules): AgentBuildSettings {
  const { oxlint, eslint } = agentConfigsOf(defined)
  return { oxlint, eslint: eslint.map(({ name, files, ignores, rules, linterOptions }) => ({ name, files, ignores, rules, linterOptions })) }
}

/** Throws where there is none, as for a project whose package.json lists no oxlint. */
export function oxlintPartOf({ oxlint }: EditorParts): OxlintPart {
  if (oxlint === undefined) throw new Error('the project lists oxlint, so it has an oxlint part')
  return oxlint
}
