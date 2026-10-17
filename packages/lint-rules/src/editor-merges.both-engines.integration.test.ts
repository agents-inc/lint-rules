import { beforeAll, describe, expect, it } from 'vitest'
import { type BothEnginesRuns, setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import {
  ARRAY_TYPE,
  arrayTypeSourceFiles,
  COMPONENT_FILES,
  DEBUGGER_RULES,
  debuggerSourceFiles,
  fiveParameterSourceFiles,
  GRID_FILES,
  GRID_JS_AND_TS_FILES,
  GRID_ROWS,
  GRID_RULES,
  GRID_RULES_THE_TEAM_SETS,
  gridSourceFiles,
  MAX_PARAMS,
  nestedGitSourceFiles,
  NO_DEBUGGER,
  NO_UNUSED_VARS,
  nodeModulesSourceFiles,
  OUR_GRID_RULES,
  OURS_SETTING_THE_MAX_PARAMS_EXTENSION,
  OURS_TURNING_ARRAY_TYPE_ON,
  TEAM_GLOBAL_IGNORES_TAKING_NODE_MODULES_BACK,
  TEAM_GRID_ESLINT_RULES,
  TEAM_GRID_OXLINT_CONFIG,
  TEAM_OXLINT_CONFIG_TURNING_ARRAY_TYPE_ON,
  TEAM_TAKE_BACK_CASES,
  teamAloneFindingsOnTheGrid,
} from './__tests__/cases/both-engines-grid.ts'
import { findingsByFileAndRule, messagesByFile, owedBesideTheTeam } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'

// The oracle is the real engines, never the merge's own reading. Merged into empty team configs, our
// rules report where the agent build does; beside a team turning a rule on, only the team's configs
// report it, never both engines.

allowEveryTestForParallelLoad()

const FIVE_PARAMETERS_UNDER_A_MAX_OF_2 = "Function 'five' has too many parameters (5). Maximum allowed is 2."
const DEBUGGER_FILES = Object.keys(debuggerSourceFiles)
const ARRAY_TYPE_FILES = Object.keys(arrayTypeSourceFiles)
const FIVE_PARAMETER_FILES = Object.keys(fiveParameterSourceFiles)

describe("the team's configs alone, on the grid's files", () => {
  const runs = setUpBothEnginesRuns({
    sources: gridSourceFiles,
    ours: {},
    teamEslintRules: TEAM_GRID_ESLINT_RULES,
    teamOxlintConfig: TEAM_GRID_OXLINT_CONFIG,
  })

  // A file an engine could not parse would report nothing and pass every comparison. ESLint lints nothing
  // in node_modules; oxlint, given no team ignore, lints all of it.
  it('report each rule in every file that can draw it and the engine the team turns it on in lints, in that engine', () => {
    expect(findingsByFileAndRule(runs().teamAlone, GRID_FILES, GRID_RULES)).toStrictEqual(teamAloneFindingsOnTheGrid())
  })
})

// Each row's full name in its title, which describe.each's $-interpolation would cut short.
GRID_ROWS.forEach(({ how, ours }) => {
  describe(`our rules on the grid, where ${how}`, () => {
    const runs = setUpBothEnginesRuns({
      sources: gridSourceFiles,
      ours: { rules: OUR_GRID_RULES, ...ours },
      teamEslintRules: TEAM_GRID_ESLINT_RULES,
      teamOxlintConfig: TEAM_GRID_OXLINT_CONFIG,
    })

    it('are linted by every ESLint run with no fatal message', () => {
      expect(runs().eslintFatalMessages).toStrictEqual([])
    })

    it('report, merged into empty team configs, in exactly the files the agent build reports them in, per engine', () => {
      const { agent, mergedIntoEmptyTeamConfigs } = runs()

      expect(findingsByFileAndRule(mergedIntoEmptyTeamConfigs, GRID_FILES, GRID_RULES)).toStrictEqual(
        findingsByFileAndRule(agent, GRID_FILES, GRID_RULES),
      )
    })

    it.each([
      { kind: 'JS and TS file', files: GRID_JS_AND_TS_FILES },
      { kind: '.vue, .svelte and .astro file', files: COMPONENT_FILES },
    ])(
      "report, merged into the team's configs, in each $kind the team's alone of each rule the team sets, from one engine",
      ({ files }) => {
        const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

        expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, GRID_RULES)).toStrictEqual(
          owedBesideTheTeam(findingsByFileAndRule(agent, files, GRID_RULES), findingsByFileAndRule(teamAlone, files, GRID_RULES), GRID_RULES_THE_TEAM_SETS),
        )
      },
    )
  })
})

// Our oxlint part lints .vue, .svelte and .astro files too (measured, oxlint 1.87). The team turns both
// rules on in ESLint, so only its config reports them.
describe('rules our oxlint part runs, merged into a team ESLint config that runs them in its .vue, .svelte and .astro files through a parser of its own', () => {
  const runs = setUpBothEnginesRuns({
    sources: debuggerSourceFiles,
    ours: { rules: DEBUGGER_RULES },
    teamEslintRules: DEBUGGER_RULES,
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })

  it("report no-debugger once in each file, from the team's ESLint config", () => {
    expect(findingsByFileAndRule(runs().mergedIntoTheTeamsConfigs, DEBUGGER_FILES, [NO_DEBUGGER])).toStrictEqual({
      'src/a.ts': { 'no-debugger': ['src/a.ts:2 no-debugger'] },
      'src/c.vue': { 'no-debugger': ['src/c.vue:3 no-debugger'] },
      'src/c.svelte': { 'no-debugger': ['src/c.svelte:3 no-debugger'] },
      'src/c.astro': { 'no-debugger': ['src/c.astro:3 no-debugger'] },
    })
  })

  it("report no-unused-vars once in each file, from the team's ESLint config", () => {
    expect(findingsByFileAndRule(runs().mergedIntoTheTeamsConfigs, DEBUGGER_FILES, [NO_UNUSED_VARS])).toStrictEqual({
      'src/a.ts': { 'no-unused-vars': ['src/a.ts:3 no-unused-vars'] },
      'src/c.vue': { 'no-unused-vars': ['src/c.vue:4 no-unused-vars'] },
      'src/c.svelte': { 'no-unused-vars': ['src/c.svelte:4 no-unused-vars'] },
      'src/c.astro': { 'no-unused-vars': ['src/c.astro:4 no-unused-vars'] },
    })
  })
})

// Our ESLint part lints JS and TS files only.
describe('a rule our ESLint part runs, merged into a team oxlint config that turns it on, beside .vue, .svelte and .astro files', () => {
  const runs = setUpBothEnginesRuns({
    sources: arrayTypeSourceFiles,
    ours: { rules: OURS_TURNING_ARRAY_TYPE_ON },
    teamEslintRules: {},
    teamOxlintConfig: TEAM_OXLINT_CONFIG_TURNING_ARRAY_TYPE_ON,
  })

  it("reports it once in each file, from the team's oxlint config", () => {
    expect(findingsByFileAndRule(runs().mergedIntoTheTeamsConfigs, ARRAY_TYPE_FILES, [ARRAY_TYPE])).toStrictEqual({
      'src/a.ts': { '@typescript-eslint/array-type': ['src/a.ts:1 typescript(array-type)'] },
      'src/c.vue': { '@typescript-eslint/array-type': ['src/c.vue:2 typescript(array-type)'] },
      'src/c.svelte': { '@typescript-eslint/array-type': ['src/c.svelte:2 typescript(array-type)'] },
      'src/c.astro': { '@typescript-eslint/array-type': ['src/c.astro:2 typescript(array-type)'] },
    })
  })
})

// ESLint's default ignores leave node_modules out unless global ignores take it back (ESLint 10.12).
// Ours must stay out even then: the team's oxlint copy runs there, so ours would add a second finding.
describe("our rules on the grid, merged into a team's configs whose ESLint global ignores take node_modules back", () => {
  const runs = setUpBothEnginesRuns({
    sources: nodeModulesSourceFiles,
    ours: { rules: OUR_GRID_RULES },
    teamEslintRules: TEAM_GRID_ESLINT_RULES,
    teamEslintGlobalIgnores: TEAM_GLOBAL_IGNORES_TAKING_NODE_MODULES_BACK,
    teamOxlintConfig: TEAM_GRID_OXLINT_CONFIG,
  })
  const files = Object.keys(nodeModulesSourceFiles)

  // Without this, the test below would pass vacuously: ESLint would lint none of node_modules.
  it("are linted with no fatal message, the team's ESLint config linting every file, node_modules included, alone and merged", () => {
    const { eslintFatalMessages, eslintLintedFiles } = runs()

    expect({
      fatalMessages: eslintFatalMessages,
      lintedByTheTeamAlone: files.filter((file) => eslintLintedFiles.teamAlone.includes(file)),
      lintedMerged: files.filter((file) => eslintLintedFiles.mergedIntoTheTeamsConfigs.includes(file)),
    }).toStrictEqual({ fatalMessages: [], lintedByTheTeamAlone: files, lintedMerged: files })
  })

  it("report, merged into the team's configs, the team's alone of each rule the team sets, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, GRID_RULES)).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, GRID_RULES), findingsByFileAndRule(teamAlone, files, GRID_RULES), GRID_RULES_THE_TEAM_SETS),
    )
  })
})

// Other ways global ignores take files back: the root .git folder, a basePath inside or outside the
// project, globs after a function.
TEAM_TAKE_BACK_CASES.forEach(({ how, lintedByTheTeamsEslint, ...takeBack }) => {
  describe(`our rules on the grid, merged into a team's configs whose ESLint global ignores ${how}`, () => {
    const runs = setUpBothEnginesRuns({
      ...takeBack,
      ours: { rules: OUR_GRID_RULES },
      teamEslintRules: TEAM_GRID_ESLINT_RULES,
      teamOxlintConfig: TEAM_GRID_OXLINT_CONFIG,
    })
    const files = Object.keys(takeBack.sources)

    // Without this, the test below would pass vacuously: ESLint would lint none of those files.
    it("are linted with no fatal message, the team's ESLint config linting the files owed, those its global ignores take back included, alone and merged", () => {
      const { eslintFatalMessages, eslintLintedFiles } = runs()

      expect({
        fatalMessages: eslintFatalMessages,
        lintedByTheTeamAlone: files.filter((file) => eslintLintedFiles.teamAlone.includes(file)),
        lintedMerged: files.filter((file) => eslintLintedFiles.mergedIntoTheTeamsConfigs.includes(file)),
      }).toStrictEqual({ fatalMessages: [], lintedByTheTeamAlone: lintedByTheTeamsEslint, lintedMerged: lintedByTheTeamsEslint })
    })

    it("report, merged into the team's configs, the team's alone of each rule the team sets, from one engine", () => {
      const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

      expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, GRID_RULES)).toStrictEqual(
        owedBesideTheTeam(findingsByFileAndRule(agent, files, GRID_RULES), findingsByFileAndRule(teamAlone, files, GRID_RULES), GRID_RULES_THE_TEAM_SETS),
      )
    })
  })
})

describe("our rules on the grid, merged into a team's configs, in a .git folder inside src, which ESLint lints and oxlint walking the project skips", () => {
  const runs = setUpBothEnginesRuns({
    sources: nestedGitSourceFiles,
    ours: { rules: OUR_GRID_RULES },
    teamEslintRules: TEAM_GRID_ESLINT_RULES,
    teamOxlintConfig: TEAM_GRID_OXLINT_CONFIG,
  })
  const files = Object.keys(nestedGitSourceFiles)
  // Read before the test, so only the assertion can fail inside it.fails.
  let made: BothEnginesRuns | undefined

  beforeAll(() => {
    made = runs()
  })

  function theRuns(): BothEnginesRuns {
    if (made === undefined) throw new Error('no run was made before the tests of a .git folder inside src')
    return made
  }

  // Without this, the test below would fail for another reason than the one it pins.
  it("are linted with no fatal message, the team's ESLint config linting every file alone and merged, and the team's oxlint config reporting in src alone", () => {
    const { eslintFatalMessages, eslintLintedFiles, teamAlone } = theRuns()

    expect({
      fatalMessages: eslintFatalMessages,
      lintedByTheTeamAlone: files.filter((file) => eslintLintedFiles.teamAlone.includes(file)),
      lintedMerged: files.filter((file) => eslintLintedFiles.mergedIntoTheTeamsConfigs.includes(file)),
      reportedByTheTeamsOxlint: files.filter((file) => teamAlone.some((finding) => finding.engine === 'oxlint' && finding.file === file)),
    }).toStrictEqual({ fatalMessages: [], lintedByTheTeamAlone: files, lintedMerged: files, reportedByTheTeamsOxlint: ['src/a.ts'] })
  })

  // The team sets both rules, so they are the team's in src/.git too, where oxlint lints nothing.
  it("report, merged into the team's configs, the team's alone of each rule the team sets, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = theRuns()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, GRID_RULES)).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, GRID_RULES), findingsByFileAndRule(teamAlone, files, GRID_RULES), GRID_RULES_THE_TEAM_SETS),
    )
  })
})

// The highest layer stating either twin decides both engines, and each file reports the pair once:
// here our max of 2 over the complexity ruleset's 4.
describe('max-params, which the complexity ruleset ships at 4, and @typescript-eslint/max-params, which our rules set to 2, in a project whose package.json lists oxlint', () => {
  const runs = setUpBothEnginesRuns({
    sources: fiveParameterSourceFiles,
    ourRulesets: { agentRulesets: { quality: ['complexity'] }, editorRulesets: { quality: ['complexity'] } },
    ours: { rules: OURS_SETTING_THE_MAX_PARAMS_EXTENSION },
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })

  it('report a five-parameter function once in each file, with our setting, merged into empty team configs', () => {
    expect(messagesByFile(runs().mergedIntoEmptyTeamConfigs, FIVE_PARAMETER_FILES, MAX_PARAMS.names)).toStrictEqual({
      'src/a.ts': [FIVE_PARAMETERS_UNDER_A_MAX_OF_2],
      'src/b.js': [FIVE_PARAMETERS_UNDER_A_MAX_OF_2],
    })
  })

  it('report a five-parameter function once in each file, with our setting, in the agent build', () => {
    expect(messagesByFile(runs().agent, FIVE_PARAMETER_FILES, MAX_PARAMS.names)).toStrictEqual({
      'src/a.ts': [FIVE_PARAMETERS_UNDER_A_MAX_OF_2],
      'src/b.js': [FIVE_PARAMETERS_UNDER_A_MAX_OF_2],
    })
  })

  // The pair runs in oxlint wherever our oxlint part runs the core rule; a build reporting it once from
  // ESLint would pass the two tests above.
  it.each([
    { build: 'the agent build', runOf: (made: BothEnginesRuns) => made.agent },
    { build: 'the merge into empty team configs', runOf: (made: BothEnginesRuns) => made.mergedIntoEmptyTeamConfigs },
  ])('report a five-parameter function from oxlint alone in each file, in $build', ({ runOf }) => {
    expect(findingsByFileAndRule(runOf(runs()), FIVE_PARAMETER_FILES, [MAX_PARAMS])).toStrictEqual({
      'src/a.ts': { 'max-params': ['src/a.ts:1 eslint(max-params)'] },
      'src/b.js': { 'max-params': ['src/b.js:1 eslint(max-params)'] },
    })
  })
})
