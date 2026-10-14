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

// Our editor parts, through the built package as a consumer loads it, merged into a team's two
// configs, each naming the other, and linted by the real ESLint and the real oxlint CLI: the oracle is
// the engines, never the merge's own reading of where an engine runs a rule. Our part for each engine
// runs a rule where that engine, reading our ignores and its own file types, leaves it running, so
// where our part runs a rule is where the agent build of our settings reports it, each engine reading
// the config written for it (decisions.md, fix round 1 review). Owed in every file (decisions.md,
// "Owner 2026-10-14"):
// - merged into empty team configs, our rules report exactly where the agent build reports them,
//   per engine;
// - beside a team turning a rule on in either engine, the rule reports as the team's configs alone
//   report it, in every file, whatever our part reports there: never one finding from both engines.

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

  // Both engines parse every file, the team's stand-in parser its .vue, .svelte and .astro files: a
  // file one could not parse would report nothing anywhere, and pass every comparison below. ESLint
  // lints no file in node_modules, and oxlint, given no ignore of the team's, lints them all.
  it('report each rule in every file that can draw it and the engine the team turns it on in lints, in that engine', () => {
    expect(findingsByFileAndRule(runs().teamAlone, GRID_FILES, GRID_RULES)).toStrictEqual(teamAloneFindingsOnTheGrid())
  })
})

// Each row's name in full in its title, which describe.each's $-interpolation would cut short. The
// grid's files in node_modules owe what the agent build reports there, which leaves them out: its
// oxlint config ignores node_modules, and ESLint never lints it (decisions.md, 2026-10-12 "fix round
// 2, after its review": the shared reading takes the ignore list each engine is given).
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

// G2 (fix round 2): our oxlint part lints every file oxlint lints by default, .vue, .svelte and
// .astro among them (measured, oxlint 1.87). The team turns both rules on in ESLint, so both are the
// team's in every file (decisions.md, "Owner 2026-10-14"): its ESLint config reports them, through a
// parser of its own in the component files, and our oxlint part runs neither.
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

// G2 (fix round 2): our ESLint part lints JS and TS files only. The team turns the rule on in oxlint,
// so it is the team's in every file (decisions.md, "Owner 2026-10-14"): the team's oxlint config
// reports it, the TS file included, and our ESLint part does not run it.
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

// ESLint's default ignores leave node_modules out unless a config's global ignores take it back
// (ESLint 10.12), as a team's may. Our ESLint part stays out of it even then, as in the agent build:
// the oxlint merge reads that our ESLint part never runs there, and leaves the team's oxlint copy of
// each rule our ESLint part runs on in node_modules, so ours running there too would report one
// finding from both engines (the review of fix round 2, Must fix 1; decisions.md, 2026-10-12 "fix
// round 2, after its review": the shared reading takes ESLint's default ignores).
describe("our rules on the grid, merged into a team's configs whose ESLint global ignores take node_modules back", () => {
  const runs = setUpBothEnginesRuns({
    sources: nodeModulesSourceFiles,
    ours: { rules: OUR_GRID_RULES },
    teamEslintRules: TEAM_GRID_ESLINT_RULES,
    teamEslintGlobalIgnores: TEAM_GLOBAL_IGNORES_TAKING_NODE_MODULES_BACK,
    teamOxlintConfig: TEAM_GRID_OXLINT_CONFIG,
  })
  const files = Object.keys(nodeModulesSourceFiles)

  // The team's ESLint config lints node_modules, alone and merged, or the test below would pass with
  // our ESLint part running there, as ESLint would lint none of it.
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

// More ways a team's global ignores take files back from ESLint's default ignores than the one
// above: the root .git folder, a basePath inside or outside the project, globs after a function.
// Our ESLint part stays out of each file they take back, as above: ours running there would report
// one finding from both engines, beside the team's oxlint copy (found by breaking the merge's reading
// of the team's global ignores, fix round 2).
TEAM_TAKE_BACK_CASES.forEach(({ how, lintedByTheTeamsEslint, ...takeBack }) => {
  describe(`our rules on the grid, merged into a team's configs whose ESLint global ignores ${how}`, () => {
    const runs = setUpBothEnginesRuns({
      ...takeBack,
      ours: { rules: OUR_GRID_RULES },
      teamEslintRules: TEAM_GRID_ESLINT_RULES,
      teamOxlintConfig: TEAM_GRID_OXLINT_CONFIG,
    })
    const files = Object.keys(takeBack.sources)

    // The team's ESLint config lints the files its global ignores take back, alone and merged, or the
    // test below would pass with our ESLint part running there, as ESLint would lint none of them.
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
  // The runs are read before the test, so a run the engines cannot make fails the file: inside
  // it.fails it would pass as the failure expected. Only the assertion fails inside it.fails.
  let made: BothEnginesRuns | undefined

  beforeAll(() => {
    made = runs()
  })

  function theRuns(): BothEnginesRuns {
    if (made === undefined) throw new Error('no run was made before the tests of a .git folder inside src')
    return made
  }

  // The team's ESLint config lints the .git files, alone and merged, and oxlint's walk skips them, or
  // the test below would fail for another reason than the one it pins.
  it("are linted with no fatal message, the team's ESLint config linting every file alone and merged, and the team's oxlint config reporting in src alone", () => {
    const { eslintFatalMessages, eslintLintedFiles, teamAlone } = theRuns()

    expect({
      fatalMessages: eslintFatalMessages,
      lintedByTheTeamAlone: files.filter((file) => eslintLintedFiles.teamAlone.includes(file)),
      lintedMerged: files.filter((file) => eslintLintedFiles.mergedIntoTheTeamsConfigs.includes(file)),
      reportedByTheTeamsOxlint: files.filter((file) => teamAlone.some((finding) => finding.engine === 'oxlint' && finding.file === file)),
    }).toStrictEqual({ fatalMessages: [], lintedByTheTeamAlone: files, lintedMerged: files, reportedByTheTeamsOxlint: ['src/a.ts'] })
  })

  // Found in fix round 2 as a known gap: the ESLint merge turned the team's copies of the rules our
  // oxlint part runs (eqeqeq then, no-debugger now) and no-unused-vars off in src/.git, where oxlint,
  // walking the project, lints nothing. The team sets both, so they are the team's there too, and
  // nothing turns them off (decisions.md, "Owner 2026-10-14").
  it("report, merged into the team's configs, the team's alone of each rule the team sets, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = theRuns()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, GRID_RULES)).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, GRID_RULES), findingsByFileAndRule(teamAlone, files, GRID_RULES), GRID_RULES_THE_TEAM_SETS),
    )
  })
})

// G3 (decisions.md, D10): D9 holds beside oxlint too, in the editor merge and the agent build alike.
// The highest layer stating either twin decides the setting in both engines, and each file reports
// the pair once: here our rules' max of 2 over the complexity ruleset's max-params at 4, which
// oxlint runs.
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

  // D10 puts the pair in oxlint wherever our oxlint part runs the core rule, our ESLint copy off there
  // (decisions.md, fix round 2, after its tester and developer): a build reporting it once from
  // ESLint instead would pass the two tests above.
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
