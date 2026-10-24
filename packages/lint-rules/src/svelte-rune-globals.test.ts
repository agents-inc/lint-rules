import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import {
  MODULE_RUNES,
  RUNE_TEST_MODULES,
  SVELTE_RUNES,
  SVELTE_SOURCE_FILES,
  TEST_FILES_OF_NO_RUNE_MODULE,
} from './__tests__/cases/svelte-components.ts'
import { ourEditorEslintPartMergedInto } from './__tests__/editor-merges-read-by-eslint.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { namesDefinedIn } from './__tests__/eslint-globals.ts'
import { buildConsumerLintRules, CORRECTNESS_IN_BOTH_SETS, emptyTsconfigRootDir } from './__tests__/factories/lint-rules-factories.ts'
import { createProjectListingOxlint } from './__tests__/factories/package-json-factories.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { defineLintRules, type LintRules } from './index.ts'

// Svelte 5's runes are globals in .svelte.js and .svelte.ts modules, in every config we write, and in no
// other JS or TS file. svelte-runes.integration.test.ts runs the rules.

const { globalsFor } = setUpEslintConfigOracle()
const tempProjects = setUpTempProjects()
const projectListingOxlint = createProjectListingOxlint(tempProjects)

const RUNE_MODULES = [SVELTE_SOURCE_FILES.jsModule, SVELTE_SOURCE_FILES.tsModule]
const NO_SVELTE_FILES = [SVELTE_SOURCE_FILES.notARuneModule, SVELTE_SOURCE_FILES.tsFileWritingToARune]

/** Our settings with the ruleset that ships no-undef and no-global-assign in both sets, rooted where given. */
function correctnessIn(tsconfigRootDir: string): LintRules {
  return buildConsumerLintRules(tsconfigRootDir, CORRECTNESS_IN_BOTH_SETS)
}

/** The editor ESLint part merged into a team config with no block. */
function mergedIntoAnEmptyTeamConfig(tsconfigRootDir: string): Linter.Config[] {
  return ourEditorEslintPartMergedInto([], correctnessIn(tsconfigRootDir))
}

async function runesDefinedIn(config: Linter.Config[], file: string, runes: readonly string[]): Promise<string[]> {
  return namesDefinedIn(await globalsFor(config, file), runes)
}

// The config's name in full in its title, which $-interpolation would cut short.
const CONFIGS = [
  { config: 'the agent build', build: () => agentConfigsOf(defineLintRules(correctnessIn(projectListingOxlint))).eslint },
  { config: 'the editor part of a project whose package.json lists oxlint, merged into an empty team config', build: () => mergedIntoAnEmptyTeamConfig(projectListingOxlint) },
  { config: 'the editor part of a project whose package.json lists no oxlint, merged into an empty team config', build: () => mergedIntoAnEmptyTeamConfig(emptyTsconfigRootDir()) },
]

CONFIGS.forEach(({ config, build }) => {
  describe(`Svelte 5's runes in ESLint, in ${config}`, () => {
    it.each(RUNE_MODULES)('are each a global in the rune module %s, every rune a module may use', async (file) => {
      expect(await runesDefinedIn(build(), file, MODULE_RUNES)).toStrictEqual(MODULE_RUNES)
    })

    it.each(NO_SVELTE_FILES)('are no global in %s, which is no Svelte file', async (file) => {
      expect(await runesDefinedIn(build(), file, SVELTE_RUNES)).toStrictEqual([])
    })
  })
})

// Svelte's tests of runes are rune modules too, by vite-plugin-svelte's rule: `.svelte.` in the file's
// name, then a name ending in js or ts. A file meeting one half alone, or holding `.svelte.` in a
// folder's name, is no rune module.
CONFIGS.forEach(({ config, build }) => {
  describe(`Svelte 5's runes in ESLint, in Svelte's tests of runes and files named like them, in ${config}`, () => {
    it.each(RUNE_TEST_MODULES)('are each a global in the test %s, a rune module, every rune a module may use', async (file) => {
      expect(await runesDefinedIn(build(), file, MODULE_RUNES)).toStrictEqual(MODULE_RUNES)
    })

    it.each(TEST_FILES_OF_NO_RUNE_MODULE)('are no global in %s, which is no rune module', async (file) => {
      expect(await runesDefinedIn(build(), file, SVELTE_RUNES)).toStrictEqual([])
    })
  })
})
