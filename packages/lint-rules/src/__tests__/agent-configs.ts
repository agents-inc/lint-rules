import { catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { agentSettingsOf } from '../agent-settings.ts'
import { buildEslintConfig } from '../core/build-eslint-config.ts'
import { buildOxlintConfig } from '../core/build-oxlint-config.ts'
import { tsFilesOutsideEveryTsconfig } from '../core/ts-files-outside-every-tsconfig.ts'
import { eslintPluginRegistry } from '../eslint-plugin-registry.ts'
import type { defineLintRules } from '../index.ts'

/** What `agents-inc.lint.mts` holds once `defineLintRules` has run. */
export type DefinedLintRules = ReturnType<typeof defineLintRules>

export type AgentConfigs = { readonly oxlint: OxlintConfig; readonly eslint: Linter.Config[] }

/**
 * The agent build of a config, as `check` will make it: the agent set, through the internal hook,
 * into both engines' complete configs. oxlint runs its rules whatever the project's package.json lists.
 */
export function agentConfigsOf({ editorRulesets }: DefinedLintRules): AgentConfigs {
  const settings = agentSettingsOf(editorRulesets.eslint)
  return {
    oxlint: buildOxlintConfig(settings, catalog),
    eslint: buildEslintConfig(settings, catalog, eslintPluginRegistry, tsFilesOutsideEveryTsconfig(settings.tsconfigRootDir)),
  }
}
