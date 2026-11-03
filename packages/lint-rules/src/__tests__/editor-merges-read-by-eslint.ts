import type { Linter } from 'eslint'
import { mergeEslintConfig } from '../eslint.ts'
import { defineLintRules, type LintRules } from '../index.ts'
import { agentConfigsOf } from './agent-configs.ts'
import type { EslintConfigOracle } from './eslint-config-oracle.ts'
import { N_SETTINGS_KEY } from './eslint-plugin-n-settings.ts'
import { createProjectListingOxlint } from './factories/package-json-factories.ts'
import { buildConsumerLintRules, CORRECTNESS_IN_BOTH_SETS, emptyTsconfigRootDir, MODULES_IN_BOTH_SETS } from './factories/lint-rules-factories.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import { writeTeamOxlintConfigSettingNoRule } from './team-configs-of-the-other-engine.ts'

/** `tsconfigRootDir` gives the folder as a test reads it, none made while vitest collects. */
export type EditorProject = { readonly project: string; readonly tsconfigRootDir: () => string }

type BuiltConfig = { readonly config: string; readonly build: () => Linter.Config[] }

const PROJECT_MADE: RunsBeforeTheSuiteOptions = { timeoutMs: 10_000, whatFailed: 'the project listing oxlint could not be made before the suite' }

/** Names a team oxlint config that sets no rule where the project uses oxlint. */
export function ourEditorEslintPartMergedInto(teamBlocks: readonly Linter.Config[], lintRules: LintRules): Linter.Config[] {
  const { eslint } = defineLintRules(lintRules).editorRulesets
  return mergeEslintConfig([...teamBlocks], eslint, writeTeamOxlintConfigSettingNoRule(eslint))
}

/**
* One listing oxlint, made before the suite, and one not, each named in full for a title, which $-interpolation
* would cut short. Registers hooks: call it where vitest collects.
*/
export function editorProjects(): readonly EditorProject[] {
  return [
    { project: 'a project whose package.json lists oxlint', tsconfigRootDir: setUpRunsBeforeTheSuite(createProjectListingOxlint, PROJECT_MADE) },
    { project: 'a project whose package.json lists no oxlint', tsconfigRootDir: emptyTsconfigRootDir },
  ]
}

/** The modules ruleset ships import-x's and eslint-plugin-n's rules. */
export function modulesRulesetMergedInto(teamBlocks: readonly Linter.Config[], tsconfigRootDir: () => string): Linter.Config[] {
  return ourEditorEslintPartMergedInto(teamBlocks, buildConsumerLintRules(tsconfigRootDir(), MODULES_IN_BOTH_SETS))
}

/** Reads a file's settings.n, undefined where no block gives one. */
export function nSettingsReaderOf(settingsFor: EslintConfigOracle['settingsFor']): (config: readonly Linter.Config[], file: string) => Promise<unknown> {
  return async (config, file) => (await settingsFor(config, file))[N_SETTINGS_KEY]
}

/**
* With the ruleset that ships no-undef and no-global-assign; each named in full for a title, which $-interpolation
* would cut short. Registers hooks: call it where vitest collects.
*/
export function correctnessConfigs(): readonly BuiltConfig[] {
  const projectListingOxlint = setUpRunsBeforeTheSuite(createProjectListingOxlint, PROJECT_MADE)
  return [
    { config: 'the agent build', build() { return agentConfigsOf(defineLintRules(correctnessIn(projectListingOxlint()))).eslint } },
    { config: 'the editor part of a project whose package.json lists oxlint, merged into an empty team config', build() { return mergedIntoAnEmptyTeamConfig(projectListingOxlint()) } },
    { config: 'the editor part of a project whose package.json lists no oxlint, merged into an empty team config', build() { return mergedIntoAnEmptyTeamConfig(emptyTsconfigRootDir()) } },
  ]
}

function correctnessIn(tsconfigRootDir: string): LintRules {
  return buildConsumerLintRules(tsconfigRootDir, CORRECTNESS_IN_BOTH_SETS)
}

function mergedIntoAnEmptyTeamConfig(tsconfigRootDir: string): Linter.Config[] {
  return ourEditorEslintPartMergedInto([], correctnessIn(tsconfigRootDir))
}
