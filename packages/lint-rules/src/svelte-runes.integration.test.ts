import { describe, expect, it } from 'vitest'
import { setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import type { OurRulesets } from './__tests__/cases/both-engines-corpus.ts'
import {
  NO_GLOBAL_ASSIGN,
  NO_UNDEF,
  OWED_BY_ESLINT,
  OWED_BY_OXLINT,
  OWED_IN_TEST_FILES_BY_ESLINT,
  OWED_IN_TEST_FILES_BY_OXLINT,
  svelteSourceFiles,
  svelteTestFiles,
} from './__tests__/cases/svelte-components.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, eslintLintedFilesOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { agentsIncLintModuleTextRootedAtItsFolder, emptyTeamEslintModuleText, mergedEslintConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, TEAM_OXLINT_CONFIG_SETTING_NO_RULE, teamOxlintConfigSettingNoRuleFiles } from './__tests__/team-configs-of-the-other-engine.ts'

// Svelte 5's runes are globals in .svelte files and in .svelte.js and .svelte.ts modules, in both
// engines and both builds (decisions.md, 2026-10-14 "real run 3, scale lane"). Real run 3, case
// R-INT-2: oxlint's no-undef reported $state, $props, $derived, $effect and $bindable in every
// Svelte 5 component, 30 of its 31 findings in .svelte files. Beside oxlint, oxlint runs no-undef and
// no-global-assign, in the agent build and the editor merges through the built package; without it,
// ESLint runs both in the JS and TS files it lints, which a .svelte file is not. The name nobody
// declares in each rune module, and the rune in the JS file that is no Svelte file, stay reported;
// no-undef is off in .svelte files, where Svelte's own checker reports an undeclared name (owner, q79).

allowEveryTestForParallelLoad()

// The ruleset that ships no-undef and no-global-assign, in both sets.
const CORRECTNESS: OurRulesets = { agentRulesets: { quality: ['correctness'] }, editorRulesets: { quality: ['correctness'] } }
const RULES = [NO_UNDEF, NO_GLOBAL_ASSIGN]
const SVELTE_COMPONENT = /\.svelte$/u
const LINT_RULES_MODULE = 'agents-inc.lint.mts'
const EMPTY_TEAM_ESLINT_MODULE = 'empty-team.eslint.mjs'

describe('Svelte 5 components and rune modules, our correctness ruleset on, in a project whose package.json lists oxlint', () => {
  const runs = setUpBothEnginesRuns({
    sources: svelteSourceFiles,
    ourRulesets: CORRECTNESS,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(OWED_BY_OXLINT)

  // The team's stand-in for a Svelte parser reads a component's script alone, not its markup, so the
  // runs of the team's config are left out.
  it('are linted with no fatal message by ESLint in the agent build and merged into empty team configs', () => {
    const { agent, mergedIntoEmptyTeamConfigs } = runs().eslintFatalMessagesInEachBuild

    expect({ agent, mergedIntoEmptyTeamConfigs }).toStrictEqual({ agent: [], mergedIntoEmptyTeamConfigs: [] })
  })

  // A block of ours naming .svelte files would make ESLint lint them, with no parser that reads one.
  it('leave every .svelte file out of ESLint, in the agent build and merged into empty team configs', () => {
    const { eslintLintedFiles } = runs()

    expect({
      agent: eslintLintedFiles.agent.filter((file) => SVELTE_COMPONENT.test(file)),
      mergedIntoEmptyTeamConfigs: eslintLintedFiles.mergedIntoEmptyTeamConfigs.filter((file) => SVELTE_COMPONENT.test(file)),
    }).toStrictEqual({ agent: [], mergedIntoEmptyTeamConfigs: [] })
  })

  it('report no rune in a Svelte file by the agent build, and still the name nobody declares there, the rune in the JS file that is no Svelte file, and the write to a rune', () => {
    expect(findingsByFileAndRule(runs().agent, files, RULES)).toStrictEqual(OWED_BY_OXLINT)
  })

  it('report no rune in a Svelte file merged into empty team configs, and still the name nobody declares there, the rune in the JS file that is no Svelte file, and the write to a rune', () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, RULES)).toStrictEqual(OWED_BY_OXLINT)
  })
})

describe('Svelte 5 components and rune modules, our correctness ruleset on, in a project whose package.json lists no oxlint, linted by the ESLint CLI through the built package', () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    [LINT_RULES_MODULE]: agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings(CORRECTNESS)),
    'eslint.config.mjs': mergedEslintConfigText(LINT_RULES_MODULE, EMPTY_TEAM_ESLINT_MODULE, TEAM_OXLINT_CONFIG_SETTING_NO_RULE),
    ...teamOxlintConfigSettingNoRuleFiles,
    [EMPTY_TEAM_ESLINT_MODULE]: emptyTeamEslintModuleText(),
    ...svelteSourceFiles,
  })

  it('are linted with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it('leave every .svelte file out of ESLint', () => {
    expect(eslintLintedFilesOf(run()).filter((file) => SVELTE_COMPONENT.test(file))).toStrictEqual([])
  })

  it('report no rune in a rune module, and still the name nobody declares there, the rune in the JS file that is no Svelte file, and the write to a rune', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), Object.keys(OWED_BY_ESLINT), RULES)).toStrictEqual(OWED_BY_ESLINT)
  })
})

// Svelte's tests of runes, `*.svelte.test.js` and the like, are rune modules too (decisions.md,
// 2026-10-14 "fix round 4 closed"), by vite-plugin-svelte's own rule: `.svelte.` in the file's name,
// then a name ending in js or ts. Fix round 4's review: oxlint's no-undef reported
// `src/counter.svelte.test.js:3 '$state' is not defined` with the shipped globs. The name nobody
// declares stays reported, and every rune in each file that meets only one half of the rule.
describe("Svelte's tests of runes and files named like them, our correctness ruleset on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: svelteTestFiles,
    ourRulesets: CORRECTNESS,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(OWED_IN_TEST_FILES_BY_OXLINT)

  it('are linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it('report no rune in a rune module by the agent build, and still the name nobody declares there, every rune where the name is no rune module, and the write to a rune', () => {
    expect(findingsByFileAndRule(runs().agent, files, RULES)).toStrictEqual(OWED_IN_TEST_FILES_BY_OXLINT)
  })

  it('report no rune in a rune module merged into empty team configs, and still the name nobody declares there, every rune where the name is no rune module, and the write to a rune', () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, RULES)).toStrictEqual(OWED_IN_TEST_FILES_BY_OXLINT)
  })
})

describe("Svelte's tests of runes and files named like them, our correctness ruleset on, in a project whose package.json lists no oxlint, linted by the ESLint CLI through the built package", () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    [LINT_RULES_MODULE]: agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings(CORRECTNESS)),
    'eslint.config.mjs': mergedEslintConfigText(LINT_RULES_MODULE, EMPTY_TEAM_ESLINT_MODULE, TEAM_OXLINT_CONFIG_SETTING_NO_RULE),
    ...teamOxlintConfigSettingNoRuleFiles,
    [EMPTY_TEAM_ESLINT_MODULE]: emptyTeamEslintModuleText(),
    ...svelteTestFiles,
  })

  it('are linted with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it('report no rune in a rune module, and still the name nobody declares there, every rune where the name is no rune module, and the write to a rune', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), Object.keys(OWED_IN_TEST_FILES_BY_ESLINT), RULES)).toStrictEqual(OWED_IN_TEST_FILES_BY_ESLINT)
  })
})
