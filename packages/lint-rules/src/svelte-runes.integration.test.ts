import { describe, expect, it } from 'vitest'
import { setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
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
import { EMPTY_TEAM_ESLINT_MODULE_FILE, projectMergingOurEslintPartText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings, CORRECTNESS_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'

// Svelte 5's runes are globals in .svelte files and .svelte.js and .svelte.ts modules, in both engines
// and builds. Beside oxlint, oxlint runs no-undef and no-global-assign; without it, ESLint runs both in
// the JS and TS files it lints. no-undef is off in .svelte files, where Svelte's own checker reports
// undeclared names.

allowEveryTestForParallelLoad()

const RULES = [NO_UNDEF, NO_GLOBAL_ASSIGN]
const SVELTE_EXTENSION = '.svelte'
const SOURCES_THAT_ARE_NO_COMPONENT = Object.keys(svelteSourceFiles)
  .filter((file) => !file.endsWith(SVELTE_EXTENSION))
  .toSorted()
const TEST_SOURCES = Object.keys(svelteTestFiles).toSorted()

describe('Svelte 5 components and rune modules, our correctness ruleset on, in a project whose package.json lists oxlint', () => {
  const runs = setUpBothEnginesRuns({
    sources: svelteSourceFiles,
    ourRulesets: CORRECTNESS_IN_BOTH_SETS,
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
      agent: eslintLintedFiles.agent.filter((file) => file.endsWith(SVELTE_EXTENSION)),
      mergedIntoEmptyTeamConfigs: eslintLintedFiles.mergedIntoEmptyTeamConfigs.filter((file) => file.endsWith(SVELTE_EXTENSION)),
    }).toStrictEqual({ agent: [], mergedIntoEmptyTeamConfigs: [] })
  })

  // Else a rune drawing no no-undef in a rune module would pass where ESLint lints none.
  it('lint every rune module and JS or TS file that is no component, in the agent build and merged into empty team configs', () => {
    const { eslintLintedFiles } = runs()

    expect({
      agent: eslintLintedFiles.agent.filter((file) => Object.hasOwn(svelteSourceFiles, file)),
      mergedIntoEmptyTeamConfigs: eslintLintedFiles.mergedIntoEmptyTeamConfigs.filter((file) => Object.hasOwn(svelteSourceFiles, file)),
    }).toStrictEqual({ agent: SOURCES_THAT_ARE_NO_COMPONENT, mergedIntoEmptyTeamConfigs: SOURCES_THAT_ARE_NO_COMPONENT })
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
    ...projectMergingOurEslintPartText({
      settings: buildConsumerSettings(CORRECTNESS_IN_BOTH_SETS),
      team: EMPTY_TEAM_ESLINT_MODULE_FILE,
      teamOxlint: 'setting no rule',
    }),
    ...svelteSourceFiles,
  })

  it('are linted with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it('leave every .svelte file out of ESLint', () => {
    expect(eslintLintedFilesOf(run()).filter((file) => file.endsWith(SVELTE_EXTENSION))).toStrictEqual([])
  })

  it('lint every rune module and JS or TS file that is no component', () => {
    expect(eslintLintedFilesOf(run()).filter((file) => Object.hasOwn(svelteSourceFiles, file))).toStrictEqual(SOURCES_THAT_ARE_NO_COMPONENT)
  })

  it('report no rune in a rune module, and still the name nobody declares there, the rune in the JS file that is no Svelte file, and the write to a rune', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), Object.keys(OWED_BY_ESLINT), RULES)).toStrictEqual(OWED_BY_ESLINT)
  })
})

// Svelte's tests of runes, `*.svelte.test.js` and the like, are rune modules too, by
// vite-plugin-svelte's rule: `.svelte.` in the file's name, then a name ending in js or ts.
describe("Svelte's tests of runes and files named like them, our correctness ruleset on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: svelteTestFiles,
    ourRulesets: CORRECTNESS_IN_BOTH_SETS,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(OWED_IN_TEST_FILES_BY_OXLINT)

  it('are linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  // Else a rune drawing no no-undef in a test would pass where ESLint lints no test at all.
  it('lint every test and file named like one, in the agent build and merged into empty team configs', () => {
    const { eslintLintedFiles } = runs()

    expect({
      agent: eslintLintedFiles.agent.filter((file) => Object.hasOwn(svelteTestFiles, file)),
      mergedIntoEmptyTeamConfigs: eslintLintedFiles.mergedIntoEmptyTeamConfigs.filter((file) => Object.hasOwn(svelteTestFiles, file)),
    }).toStrictEqual({ agent: TEST_SOURCES, mergedIntoEmptyTeamConfigs: TEST_SOURCES })
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
    ...projectMergingOurEslintPartText({
      settings: buildConsumerSettings(CORRECTNESS_IN_BOTH_SETS),
      team: EMPTY_TEAM_ESLINT_MODULE_FILE,
      teamOxlint: 'setting no rule',
    }),
    ...svelteTestFiles,
  })

  it('are linted with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it('lint every test and file named like one', () => {
    expect(eslintLintedFilesOf(run()).filter((file) => Object.hasOwn(svelteTestFiles, file))).toStrictEqual(TEST_SOURCES)
  })

  it('report no rune in a rune module, and still the name nobody declares there, every rune where the name is no rune module, and the write to a rune', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), Object.keys(OWED_IN_TEST_FILES_BY_ESLINT), RULES)).toStrictEqual(OWED_IN_TEST_FILES_BY_ESLINT)
  })
})
