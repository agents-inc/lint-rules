import { describe, expect, it } from 'vitest'
import { setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import {
  frameworkSourceFiles,
  OWED_BY_ESLINT_IN_FRAMEWORK_FILES,
  OWED_BY_OXLINT_IN_FRAMEWORK_FILES,
  OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS,
  OWED_IN_THE_STORE_COMPONENT,
  OWED_IN_THE_WRITING_COMPONENT_BESIDE_A_TEAM_TURNING_PROPS_OFF,
  TEAM_OXLINT_CONFIG_TURNING_SVELTE_PROPS_OFF,
} from './__tests__/cases/framework-components.ts'
import { NO_GLOBAL_ASSIGN, NO_UNDEF } from './__tests__/cases/svelte-components.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, eslintLintedFilesOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { EMPTY_TEAM_ESLINT_MODULE_FILE, projectMergingOurEslintPartText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings, CORRECTNESS_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'

// Vue's `<script setup>` macros, Astro's `Astro` and Svelte's `$$props`, `$$restProps` and
// `$$slots`, in their component files. With oxlint, no-undef runs in each but Svelte components, where
// Svelte's own checker reports undeclared names; without it, ESLint lints no component.

allowEveryTestForParallelLoad()

const RULES = [NO_UNDEF]
const WRITE_RULES = [NO_GLOBAL_ASSIGN]
const COMPONENT = /\.(?:vue|astro|svelte)$/u

describe('Vue, Astro and Svelte components, and JS files using their globals, our correctness ruleset on, in a project whose package.json lists oxlint', () => {
  const runs = setUpBothEnginesRuns({
    sources: frameworkSourceFiles,
    ourRulesets: CORRECTNESS_IN_BOTH_SETS,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(OWED_BY_OXLINT_IN_FRAMEWORK_FILES)

  // The team's stand-in for a framework's parser reads a component's script alone, not its markup,
  // so the runs of the team's config are left out.
  it('are linted with no fatal message by ESLint in the agent build and merged into empty team configs', () => {
    const { agent, mergedIntoEmptyTeamConfigs } = runs().eslintFatalMessagesInEachBuild

    expect({ agent, mergedIntoEmptyTeamConfigs }).toStrictEqual({ agent: [], mergedIntoEmptyTeamConfigs: [] })
  })

  // A block of ours naming components would make ESLint lint them, with no parser that reads one.
  it('leave every .vue, .astro and .svelte file out of ESLint, in the agent build and merged into empty team configs', () => {
    const { eslintLintedFiles } = runs()

    expect({
      agent: eslintLintedFiles.agent.filter((file) => COMPONENT.test(file)),
      mergedIntoEmptyTeamConfigs: eslintLintedFiles.mergedIntoEmptyTeamConfigs.filter((file) => COMPONENT.test(file)),
    }).toStrictEqual({ agent: [], mergedIntoEmptyTeamConfigs: [] })
  })

  it("report no framework global in its framework's component by the agent build, and still the name nobody declares there and each framework global in a JS file", () => {
    expect(findingsByFileAndRule(runs().agent, files, RULES)).toStrictEqual(OWED_BY_OXLINT_IN_FRAMEWORK_FILES)
  })

  it("report no framework global in its framework's component merged into empty team configs, and still the name nobody declares there and each framework global in a JS file", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, RULES)).toStrictEqual(OWED_BY_OXLINT_IN_FRAMEWORK_FILES)
  })

  it("report each write to Svelte's legacy globals in a component by the agent build, and no read of them", () => {
    expect(findingsByFileAndRule(runs().agent, Object.keys(OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS), WRITE_RULES)).toStrictEqual(
      OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS,
    )
  })

  it("report each write to Svelte's legacy globals in a component merged into empty team configs, and no read of them", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, Object.keys(OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS), WRITE_RULES)).toStrictEqual(
      OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS,
    )
  })

  // A Svelte component subscribes to any imported store as `$` plus its name, so no globals list holds
  // them all: no-undef is off in .svelte files, where Svelte's own checker reports undeclared names.
  it("report no store subscription in a Svelte component by the agent build, where Svelte declares `$count` from the store's import", () => {
    expect(findingsByFileAndRule(runs().agent, Object.keys(OWED_IN_THE_STORE_COMPONENT), RULES)).toStrictEqual(OWED_IN_THE_STORE_COMPONENT)
  })

  // As above, through the built package.
  it("report no store subscription in a Svelte component merged into empty team configs, where Svelte declares `$count` from the store's import", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, Object.keys(OWED_IN_THE_STORE_COMPONENT), RULES)).toStrictEqual(
      OWED_IN_THE_STORE_COMPONENT,
    )
  })
})

describe("Vue, Astro and Svelte components, and JS files using their globals, our correctness ruleset on, beside a team oxlint config whose root turns Svelte's $$props off, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: frameworkSourceFiles,
    ourRulesets: CORRECTNESS_IN_BOTH_SETS,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: TEAM_OXLINT_CONFIG_TURNING_SVELTE_PROPS_OFF,
  })

  it("report no write to $$props in a Svelte component merged into the team's configs, where the team's root turns it off, and still each write to a legacy global the team leaves to ours", () => {
    expect(
      findingsByFileAndRule(runs().mergedIntoTheTeamsConfigs, Object.keys(OWED_IN_THE_WRITING_COMPONENT_BESIDE_A_TEAM_TURNING_PROPS_OFF), WRITE_RULES),
    ).toStrictEqual(OWED_IN_THE_WRITING_COMPONENT_BESIDE_A_TEAM_TURNING_PROPS_OFF)
  })
})

describe('Vue, Astro and Svelte components, and JS files using their globals, our correctness ruleset on, in a project whose package.json lists no oxlint, linted by the ESLint CLI through the built package', () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    ...projectMergingOurEslintPartText({
      settings: buildConsumerSettings(CORRECTNESS_IN_BOTH_SETS),
      team: EMPTY_TEAM_ESLINT_MODULE_FILE,
      teamOxlint: 'setting no rule',
    }),
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
