import { catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { buildEslintConfig } from './core/build-eslint-config.ts'
import { buildOxlintConfig } from './core/build-oxlint-config.ts'
import type { LintRulesInput } from './core/lint-rules-input.ts'
import { projectFactsOf } from './core/project-facts.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

export type AgentConfigs = { readonly oxlint: OxlintConfig; readonly eslint: Linter.Config[] }

export function buildAgentConfigs(agentSettings: LintRulesInput): AgentConfigs {
  return {
    oxlint: buildOxlintConfig(agentSettings, catalog),
    eslint: buildEslintConfig(agentSettings, catalog, eslintPluginRegistry, projectFactsOf(agentSettings.tsconfigRootDir)),
  }
}
