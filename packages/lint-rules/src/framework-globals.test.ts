import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import {
  ASTRO_GLOBALS,
  FRAMEWORK_FILES,
  JS_FILES_USING_A_FRAMEWORK_GLOBAL,
  SVELTE_COMPONENT_GLOBALS,
  VUE_SCRIPT_SETUP_MACROS,
} from './__tests__/cases/framework-components.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { namesDefinedIn } from './__tests__/eslint-globals.ts'
import { buildConsumerLintRules, EMPTY_TSCONFIG_ROOT_DIR } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules, type LintRules } from './index.ts'

// Framework globals reach a framework's own component files alone (decisions.md, 2026-10-14 "fix
// round 4 closed"), and our ESLint part lints none of them: it lints JS and TS files alone, so in
// ESLint no framework global is ours to give. Read from ESLint's own merge of each config for the
// file; framework-globals.integration.test.ts runs the rules, oxlint's among them.

const { calculatedConfigFor, globalsFor } = setUpEslintConfigOracle()
const tempProjects = setUpTempProjects()
const projectListingOxlint = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) } })

const EVERY_FRAMEWORK_GLOBAL = [...VUE_SCRIPT_SETUP_MACROS, ...ASTRO_GLOBALS, ...SVELTE_COMPONENT_GLOBALS]
const COMPONENTS = [FRAMEWORK_FILES.vueComponent, FRAMEWORK_FILES.astroPage, FRAMEWORK_FILES.svelteLegacyComponent]

/** Our settings with the ruleset that ships no-undef in both sets, rooted where given. */
function correctnessIn(tsconfigRootDir: string): LintRules {
  return buildConsumerLintRules(tsconfigRootDir, { agentRulesets: { quality: ['correctness'] }, editorRulesets: { quality: ['correctness'] } })
}

/** The editor ESLint part merged into a team config with no block. */
function mergedIntoAnEmptyTeamConfig(tsconfigRootDir: string): Linter.Config[] {
  const { eslint } = defineLintRules(correctnessIn(tsconfigRootDir)).editorRulesets
  return mergeEslintConfig([], eslint, writeTeamOxlintConfigSettingNoRule(eslint))
}

// The config's name in full in its title, which $-interpolation would cut short.
const CONFIGS = [
  { config: 'the agent build', build: () => agentConfigsOf(defineLintRules(correctnessIn(projectListingOxlint))).eslint },
  { config: 'the editor part of a project whose package.json lists oxlint, merged into an empty team config', build: () => mergedIntoAnEmptyTeamConfig(projectListingOxlint) },
  { config: 'the editor part of a project whose package.json lists no oxlint, merged into an empty team config', build: () => mergedIntoAnEmptyTeamConfig(EMPTY_TSCONFIG_ROOT_DIR) },
]

CONFIGS.forEach(({ config, build }) => {
  describe(`Vue's, Astro's and Svelte's component globals in ESLint, in ${config}`, () => {
    it.each(JS_FILES_USING_A_FRAMEWORK_GLOBAL)('are no global in %s, which is no component', async (file) => {
      expect(namesDefinedIn(await globalsFor(build(), file), EVERY_FRAMEWORK_GLOBAL)).toStrictEqual([])
    })

    // A block of ours naming a component would make ESLint lint it, with no parser that reads one.
    it.each(COMPONENTS)('reach no component: ESLint does not lint %s', async (file) => {
      expect(await calculatedConfigFor(build(), file)).toBeUndefined()
    })
  })
})
