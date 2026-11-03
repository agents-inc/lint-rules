import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
  ASTRO_GLOBALS,
  FRAMEWORK_FILES,
  JS_FILES_USING_A_FRAMEWORK_GLOBAL,
  SVELTE_COMPONENT_GLOBALS,
  VUE_SCRIPT_SETUP_MACROS,
} from './__tests__/cases/framework-components.ts'
import { NO_UNDEF } from './__tests__/cases/svelte-components.ts'
import { correctnessConfigs } from './__tests__/editor-merges-read-by-eslint.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { namesDefinedIn } from './__tests__/eslint-globals.ts'

// Our ESLint part lints JS and TS files alone, so in ESLint no framework global is ours to give.
// framework-globals.integration.test.ts runs the rules.

const { calculatedConfigFor, globalsFor, ruleSeverityFor } = setUpEslintConfigOracle()

const EVERY_FRAMEWORK_GLOBAL = [...VUE_SCRIPT_SETUP_MACROS, ...ASTRO_GLOBALS, ...SVELTE_COMPONENT_GLOBALS]
const COMPONENTS = [FRAMEWORK_FILES.vueComponent, FRAMEWORK_FILES.astroPage, FRAMEWORK_FILES.svelteLegacyComponent]
const THE_SUPPRESSION_BAN = 'house/no-suppressions'

const CONFIGS = correctnessConfigs()

for (const { config, build } of CONFIGS) {
  describe(`Vue's, Astro's and Svelte's component globals in ESLint, in ${config}`, () => {
    it.each(JS_FILES_USING_A_FRAMEWORK_GLOBAL)('are no global in %s, which is no component', async (file) => {
      expect(namesDefinedIn(await globalsFor(build(), file), EVERY_FRAMEWORK_GLOBAL)).toStrictEqual([])
    })

    // A block of ours naming a component would make ESLint lint it, with no parser that reads one.
    it.each(COMPONENTS)('reach no component: ESLint does not lint %s', async (file) => {
      expect(await calculatedConfigFor(build(), file)).toBeUndefined()
    })
  })
}

// Else each config above would pass in another's place.
describe('the configs above, in a JS file using a framework global', () => {
  it('run no-undef in the editor part of the project listing no oxlint alone, and the ban on suppressions in the agent build alone', async () => {
    const file = FRAMEWORK_FILES.vueMacroInAJsFile
    const rulesOfEach = await Promise.all(
      CONFIGS.map(async ({ config, build }): Promise<[string, Readonly<Record<string, Linter.StringSeverity | undefined>>]> => [
        config,
        { [NO_UNDEF.rule]: await ruleSeverityFor(build(), file, NO_UNDEF.rule), [THE_SUPPRESSION_BAN]: await ruleSeverityFor(build(), file, THE_SUPPRESSION_BAN) },
      ]),
    )

    expect(Object.fromEntries(rulesOfEach)).toStrictEqual({
      'the agent build': { [NO_UNDEF.rule]: 'off', [THE_SUPPRESSION_BAN]: 'error' },
      'the editor part of a project whose package.json lists oxlint, merged into an empty team config': { [NO_UNDEF.rule]: undefined, [THE_SUPPRESSION_BAN]: undefined },
      'the editor part of a project whose package.json lists no oxlint, merged into an empty team config': { [NO_UNDEF.rule]: 'error', [THE_SUPPRESSION_BAN]: undefined },
    })
  })
})
