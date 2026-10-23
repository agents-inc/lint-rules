import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { type AgentConfigs, buildAgentConfigs } from '../agent-configs.ts'
import { agentSettingsOf } from '../agent-settings.ts'
import type { EditorParts, OxlintPart } from '../core/editor-parts.ts'
import type { defineLintRules } from '../index.ts'

export type DefinedLintRules = ReturnType<typeof defineLintRules>

const A_FILE_TEST = '(a file test)'

type EslintBlockSettings = { readonly [key in 'name' | 'files' | 'ignores' | 'rules' | 'linterOptions']: Linter.Config[key] }

/** What the agent build sets: never equal across two builds whole, as each makes its plugin objects anew. */
export type AgentBuildSettings = { readonly oxlint: OxlintConfig; readonly eslint: readonly EslintBlockSettings[] }

/** As `check` makes it, through the internal hook; oxlint runs its rules whatever the project's package.json lists. */
export function agentConfigsOf({ editorRulesets }: DefinedLintRules): AgentConfigs {
  return buildAgentConfigs(agentSettingsOf(editorRulesets.eslint))
}

/** The oxlint config and each ESLint block's name, files, ignores, rules and linterOptions: the keys left out hold objects each build makes anew, as does the tsconfig test in the files of a typed block, which is named instead. */
export function agentBuildSettingsOf(defined: DefinedLintRules): AgentBuildSettings {
  const { oxlint, eslint } = agentConfigsOf(defined)
  return {
    oxlint,
    eslint: eslint.map(({ name, files, ignores, rules, linterOptions }) => ({ name, files: withEachFileTestNamed(files), ignores, rules, linterOptions })),
  }
}

function withEachFileTestNamed(files: Readonly<Linter.Config['files']>): Linter.Config['files'] {
  if (files === undefined) return undefined
  return files.map((entry) => (typeof entry === 'string' ? entry : entry.map(namedWhereAFileTest)))
}

function namedWhereAFileTest(matcher: string): string {
  // Parse boundary: ESLint's types give globs alone, and our typed blocks AND a function with them.
  const given: unknown = matcher
  return typeof given === 'function' ? A_FILE_TEST : matcher
}

/** Throws where there is none, as for a project whose package.json lists no oxlint. */
export function oxlintPartOf({ oxlint }: EditorParts): OxlintPart {
  if (oxlint === undefined) throw new Error('the project lists oxlint, so it has an oxlint part')
  return oxlint
}
