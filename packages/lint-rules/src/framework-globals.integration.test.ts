import { beforeAll, describe, expect, it } from 'vitest'
import { type BothEnginesRuns, setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import type { OurRulesets } from './__tests__/cases/both-engines-corpus.ts'
import {
  frameworkSourceFiles,
  OWED_BY_ESLINT_IN_FRAMEWORK_FILES,
  OWED_BY_OXLINT_IN_FRAMEWORK_FILES,
  OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS,
  OWED_IN_THE_LEGACY_COMPONENT_BESIDE_A_TEAM_TURNING_PROPS_OFF,
  OWED_IN_THE_STORE_COMPONENT,
  TEAM_OXLINT_CONFIG_TURNING_SVELTE_PROPS_OFF,
} from './__tests__/cases/framework-components.ts'
import { NO_GLOBAL_ASSIGN, NO_UNDEF } from './__tests__/cases/svelte-components.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, eslintLintedFilesOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { agentsIncLintModuleTextRootedAtItsFolder, emptyTeamEslintModuleText, mergedEslintConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, TEAM_OXLINT_CONFIG_SETTING_NO_RULE, teamOxlintConfigSettingNoRuleFiles } from './__tests__/team-configs-of-the-other-engine.ts'

// Framework globals, the same class as Svelte's runes, in both engines and both builds (decisions.md,
// 2026-10-14 "fix round 4 closed"): Vue's `<script setup>` compiler macros in .vue files, Astro's
// `Astro` in .astro files, and Svelte's `$$props`, `$$restProps` and `$$slots` in .svelte files.
// Fix round 4's developer measured oxlint's no-undef reporting each of them. Beside oxlint, oxlint
// runs no-undef in every one of these files, in the agent build and the editor merges through the
// built package; without it, ESLint runs it in the JS and TS files it lints, which no component is.
// The name nobody declares in each component stays reported, and each framework global in a JS file
// that does not have it. Each framework global is read-only, so a write to one is reported; and a
// team's root globals stand where they set one, as its root env does (Q-E).

allowEveryTestForParallelLoad()

// The ruleset that ships no-undef, in both sets.
const CORRECTNESS: OurRulesets = { agentRulesets: { quality: ['correctness'] }, editorRulesets: { quality: ['correctness'] } }
const RULES = [NO_UNDEF]
const WRITE_RULES = [NO_GLOBAL_ASSIGN]
const COMPONENT = /\.(?:vue|astro|svelte)$/u
const LINT_RULES_MODULE = 'agents-inc.lint.mts'
const EMPTY_TEAM_ESLINT_MODULE = 'empty-team.eslint.mjs'

describe('Vue, Astro and Svelte components, and JS files using their globals, our correctness ruleset on, in a project whose package.json lists oxlint', () => {
  const runs = setUpBothEnginesRuns({
    sources: frameworkSourceFiles,
    ourRulesets: CORRECTNESS,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(OWED_BY_OXLINT_IN_FRAMEWORK_FILES)
  // The runs are read before the tests, so a run the engines cannot make fails the file: inside
  // it.fails it would pass as the failure expected. Only the assertion fails inside it.fails.
  let made: BothEnginesRuns | undefined

  beforeAll(() => {
    made = runs()
  })

  function theRuns(): BothEnginesRuns {
    if (made === undefined) throw new Error('no run was made before the tests of the framework components')
    return made
  }

  // The team's stand-in for a framework's parser reads a component's script alone, not its markup,
  // so the runs of the team's config are left out.
  it('are linted with no fatal message by ESLint in the agent build and merged into empty team configs', () => {
    const { agent, mergedIntoEmptyTeamConfigs } = theRuns().eslintFatalMessagesInEachBuild

    expect({ agent, mergedIntoEmptyTeamConfigs }).toStrictEqual({ agent: [], mergedIntoEmptyTeamConfigs: [] })
  })

  // A block of ours naming components would make ESLint lint them, with no parser that reads one.
  it('leave every .vue, .astro and .svelte file out of ESLint, in the agent build and merged into empty team configs', () => {
    const { eslintLintedFiles } = theRuns()

    expect({
      agent: eslintLintedFiles.agent.filter((file) => COMPONENT.test(file)),
      mergedIntoEmptyTeamConfigs: eslintLintedFiles.mergedIntoEmptyTeamConfigs.filter((file) => COMPONENT.test(file)),
    }).toStrictEqual({ agent: [], mergedIntoEmptyTeamConfigs: [] })
  })

  it("report no framework global in its framework's component by the agent build, and still the name nobody declares there and each framework global in a JS file", () => {
    expect(findingsByFileAndRule(theRuns().agent, files, RULES)).toStrictEqual(OWED_BY_OXLINT_IN_FRAMEWORK_FILES)
  })

  it("report no framework global in its framework's component merged into empty team configs, and still the name nobody declares there and each framework global in a JS file", () => {
    expect(findingsByFileAndRule(theRuns().mergedIntoEmptyTeamConfigs, files, RULES)).toStrictEqual(OWED_BY_OXLINT_IN_FRAMEWORK_FILES)
  })

  it("report each write to Svelte's legacy globals in a component by the agent build, and no read of them", () => {
    expect(findingsByFileAndRule(theRuns().agent, Object.keys(OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS), WRITE_RULES)).toStrictEqual(
      OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS,
    )
  })

  it("report each write to Svelte's legacy globals in a component merged into empty team configs, and no read of them", () => {
    expect(findingsByFileAndRule(theRuns().mergedIntoEmptyTeamConfigs, Object.keys(OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS), WRITE_RULES)).toStrictEqual(
      OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS,
    )
  })

  // KNOWN GAP (decisions.md, 2026-10-14 "fix round 4 closed": measured, then fixed or recorded as a
  // limit). A Svelte component subscribes to a store it imports as `$` and the store's name, any
  // name, so no list of globals holds them all. oxlint 1.87's no-undef takes no option but `typeof`
  // (it refuses `ignorePattern` by name), and its `globals` match names, not patterns: a `$*` key
  // matches nothing. Turning no-undef off in .svelte files would lose the name nobody declares,
  // which the test above keeps (measured, oxlint 1.87).
  it.fails("report no store subscription in a Svelte component by the agent build, where Svelte declares `$count` from the store's import", () => {
    expect(findingsByFileAndRule(theRuns().agent, Object.keys(OWED_IN_THE_STORE_COMPONENT), RULES)).toStrictEqual(OWED_IN_THE_STORE_COMPONENT)
  })

  // KNOWN GAP: as above, through the built package.
  it.fails("report no store subscription in a Svelte component merged into empty team configs, where Svelte declares `$count` from the store's import", () => {
    expect(findingsByFileAndRule(theRuns().mergedIntoEmptyTeamConfigs, Object.keys(OWED_IN_THE_STORE_COMPONENT), RULES)).toStrictEqual(
      OWED_IN_THE_STORE_COMPONENT,
    )
  })
})

describe("Vue, Astro and Svelte components, and JS files using their globals, our correctness ruleset on, beside a team oxlint config whose root turns Svelte's $$props off, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: frameworkSourceFiles,
    ourRulesets: CORRECTNESS,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: TEAM_OXLINT_CONFIG_TURNING_SVELTE_PROPS_OFF,
  })

  it("report $$props in a Svelte component merged into the team's configs, where the team's root turns it off, and still no legacy global the team leaves to ours", () => {
    expect(
      findingsByFileAndRule(runs().mergedIntoTheTeamsConfigs, Object.keys(OWED_IN_THE_LEGACY_COMPONENT_BESIDE_A_TEAM_TURNING_PROPS_OFF), RULES),
    ).toStrictEqual(OWED_IN_THE_LEGACY_COMPONENT_BESIDE_A_TEAM_TURNING_PROPS_OFF)
  })
})

describe('Vue, Astro and Svelte components, and JS files using their globals, our correctness ruleset on, in a project whose package.json lists no oxlint, linted by the ESLint CLI through the built package', () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    [LINT_RULES_MODULE]: agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings(CORRECTNESS)),
    'eslint.config.mjs': mergedEslintConfigText(LINT_RULES_MODULE, EMPTY_TEAM_ESLINT_MODULE, TEAM_OXLINT_CONFIG_SETTING_NO_RULE),
    ...teamOxlintConfigSettingNoRuleFiles,
    [EMPTY_TEAM_ESLINT_MODULE]: emptyTeamEslintModuleText(),
    ...frameworkSourceFiles,
  })

  it('are linted with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it('leave every .vue, .astro and .svelte file out of ESLint', () => {
    expect(eslintLintedFilesOf(run()).filter((file) => COMPONENT.test(file))).toStrictEqual([])
  })

  it('report each framework global in a JS file, which does not have it', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), Object.keys(OWED_BY_ESLINT_IN_FRAMEWORK_FILES), RULES)).toStrictEqual(OWED_BY_ESLINT_IN_FRAMEWORK_FILES)
  })
})
