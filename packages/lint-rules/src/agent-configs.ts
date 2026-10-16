// The agent set's two complete configs, which `check` runs and the tests lint with: one builder, so
// both build exactly the same thing. Internal: no package.json export and no declaration file names it.

import { catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { buildEslintConfig } from './core/build-eslint-config.ts'
import { buildOxlintConfig } from './core/build-oxlint-config.ts'
import type { LintRulesInput } from './core/lint-rules-input.ts'
import { projectFactsOf } from './core/project-facts.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

export type AgentConfigs = { readonly oxlint: OxlintConfig; readonly eslint: Linter.Config[] }

/** Both engines' configs for the agent settings given, the project's facts read once from its tsconfigRootDir. */
export function buildAgentConfigs(agentSettings: LintRulesInput): AgentConfigs {
  return {
    oxlint: buildOxlintConfig(agentSettings, catalog),
    eslint: buildEslintConfig(agentSettings, catalog, eslintPluginRegistry, projectFactsOf(agentSettings.tsconfigRootDir)),
  }
}
