import { describe, expect, it } from 'vitest'
import { setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import {
  type CorpusCase,
  corpusRulesTheTeamSets,
  MAX_PARAMS,
  NO_UNUSED_VARS,
  OUR_CORPUS_RULES,
  type OurRulesets,
  TEAM_CORPUS_OXLINT_CONFIG_TURNING_TWIN_CORE_RULES_ON,
} from './__tests__/cases/both-engines-corpus.ts'
import {
  DEFAULT_PARAM_LAST,
  defaultParamFirstSourceFiles,
  NO_REDECLARE,
  OURS_SETTING_NO_REDECLARE_WITH_AN_OPTION_OXLINT_REFUSES,
  OURS_SETTING_THE_DEFAULT_PARAM_LAST_EXTENSION,
  redeclaringSourceFiles,
  TEAM_ESLINT_RULES_TURNING_NO_REDECLARE_ON,
  TEAM_OXLINT_CONFIG_TURNING_DEFAULT_PARAM_LAST_ON,
  TEAM_OXLINT_CONFIG_TURNING_NO_REDECLARE_ON,
} from './__tests__/cases/both-engines-grid.ts'
import {
  maxParamsAndEmptyFunctionSourceFiles,
  maxParamsSourceFiles,
  maxParamsSourceFilesAtTheRootAndInSrc,
  maxParamsSourceFilesAtTheRootInSrcAndBelowIt,
  maxParamsSourceFilesInLegacyAndSrc,
  maxParamsSourceFilesUnderEachEntry,
  NO_EMPTY_FUNCTION,
  OURS_STATING_BOTH_MAX_PARAMS_NAMES,
  OURS_STATING_BOTH_MAX_PARAMS_NAMES_BESIDE_AN_ENTRY_TURNING_MAX_PARAMS_OFF,
  OURS_STATING_BOTH_MAX_PARAMS_NAMES_BESIDE_ONE_ALONE,
  OURS_STATING_BOTH_MAX_PARAMS_NAMES_IN_AN_ENTRY_OVER_THE_ROOT_SRC_FOLDERS_TS_FILES,
  OURS_STATING_BOTH_MAX_PARAMS_NAMES_IN_AN_ENTRY_OVER_THE_ROOTS_TS_FILES,
  OURS_STATING_BOTH_NAMES_OF_TWO_PAIRS,
  OURS_STATING_BOTH_NO_REDECLARE_NAMES_THE_EXTENSION_WITH_AN_OPTION_OXLINT_REFUSES,
  OURS_STATING_BOTH_NO_UNUSED_VARS_NAMES,
  OURS_TURNING_MAX_PARAMS_OFF_AND_TYPESCRIPT_ESLINTS_ON,
  OURS_TURNING_MAX_PARAMS_OFF_AND_TYPESCRIPT_ESLINTS_ON_IN_AN_ENTRY,
  OURS_TURNING_NO_REDECLARE_OFF_AND_TYPESCRIPT_ESLINTS_ON,
  OURS_TURNING_NO_REDECLARE_OFF_AND_TYPESCRIPT_ESLINTS_ON_BESIDE_AN_ENTRY_STATING_TYPESCRIPT_ESLINTS_ALONE,
  OURS_TURNING_NO_REDECLARE_OFF_AND_TYPESCRIPT_ESLINTS_ON_IN_AN_ENTRY,
  TEAM_ESLINT_RULES_TURNING_MAX_PARAMS_AND_NO_EMPTY_FUNCTION_ON,
  unusedParameterSourceFiles,
} from './__tests__/cases/twin-pairs-both-named.ts'
import { setUpCorpusRuns } from './__tests__/corpus-runs.ts'
import {
  type FindingsByFileAndRule,
  filesReportingIn,
  findingsByFileAndRule,
  owedBesideTheTeam,
} from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'

// Twin pairs beside oxlint (decisions.md, D9, D10 and D11), in the agent build and the editor merges
// through the built package, linted by the real ESLint and oxlint. The highest layer stating either
// name decides the pair's setting; oxlint runs the core rule where our oxlint part runs it, and our
// ESLint copies are off there (D10); each file reports the pair once. The agent build's reports are
// owed outright, since the same decision makes both builds; the editor merges owe the agent build's
// merged into empty team configs, and beside a team setting the pair, the team's alone, as on the grid.

allowEveryTestForParallelLoad()

const COMPLEXITY: OurRulesets = { agentRulesets: { quality: ['complexity'] }, editorRulesets: { quality: ['complexity'] } }
const REDUNDANCY: OurRulesets = { agentRulesets: { quality: ['redundancy'] }, editorRulesets: { quality: ['redundancy'] } }

/** A corpus case of twins, and what the agent build owes in its files. */
type TwinCase = CorpusCase & { readonly agentBuildOwes: FindingsByFileAndRule }

const TWIN_CASES: readonly TwinCase[] = [
  {
    how: "the redundancy ruleset ships no-unused-vars, which its own ignores keep out of stories, and our rules turn typescript-eslint's on",
    ourRulesets: REDUNDANCY,
    ours: {
      rules: {
        eqeqeq: 'error',
        '@typescript-eslint/array-type': 'error',
        'no-var': 'error',
        'prefer-const': 'error',
        'getter-return': 'error',
        '@typescript-eslint/no-unused-vars': 'error',
      },
    },
    files: ['stories/x.stories.ts', 'src/types.d.ts', 'src/a.ts', 'src/a.js'],
    rules: [NO_UNUSED_VARS],
    // oxlint runs the core rule under the setting our rules decide, within the core rule's own
    // ignores and outside declaration files, which its no-unused-vars skips; ESLint's
    // typescript-eslint copy runs where oxlint does not.
    agentBuildOwes: {
      'stories/x.stories.ts': { 'no-unused-vars': ['stories/x.stories.ts:4 @typescript-eslint/no-unused-vars'] },
      'src/types.d.ts': { 'no-unused-vars': ['src/types.d.ts:1 @typescript-eslint/no-unused-vars', 'src/types.d.ts:2 @typescript-eslint/no-unused-vars'] },
      'src/a.ts': { 'no-unused-vars': ['src/a.ts:4 eslint(no-unused-vars)'] },
      'src/a.js': { 'no-unused-vars': ['src/a.js:4 eslint(no-unused-vars)'] },
    },
  },
  {
    how: "the complexity ruleset ships max-params, our rules set typescript-eslint's, and an entry of ours turns max-params off in legacy/**",
    ourRulesets: COMPLEXITY,
    ours: {
      rules: { ...OUR_CORPUS_RULES, '@typescript-eslint/max-params': ['error', { max: 2 }] },
      fileOverrides: [{ files: ['legacy/**'], rules: { 'max-params': 'off' } }],
    },
    files: ['legacy/a.ts', 'legacy/keep/index.js', 'src/a.ts', 'src/a.js'],
    rules: [MAX_PARAMS],
    // The entry is the highest layer stating either name in legacy/**: the pair is off there.
    agentBuildOwes: {
      'legacy/a.ts': { 'max-params': [] },
      'legacy/keep/index.js': { 'max-params': [] },
      'src/a.ts': { 'max-params': ['src/a.ts:10 eslint(max-params)'] },
      'src/a.js': { 'max-params': ['src/a.js:10 eslint(max-params)'] },
    },
  },
  {
    how: "the complexity ruleset ships max-params, our rules set typescript-eslint's, and our ignores name legacy/, every folder of that name",
    ourRulesets: COMPLEXITY,
    ours: { rules: { ...OUR_CORPUS_RULES, '@typescript-eslint/max-params': ['error', { max: 2 }] }, ignores: ['legacy/'] },
    files: ['src/legacy/a.ts', 'legacy/a.ts', 'src/a.ts'],
    rules: [MAX_PARAMS],
    // Both engines leave out every folder named legacy, as a .gitignore line does (questions.md #62):
    // neither engine's copy reports the pair in src/legacy/a.ts.
    agentBuildOwes: {
      'src/legacy/a.ts': { 'max-params': [] },
      'legacy/a.ts': { 'max-params': [] },
      'src/a.ts': { 'max-params': ['src/a.ts:10 eslint(max-params)'] },
    },
  },
]

// Each case's name in full in its title, which describe.each's $-interpolation would cut short.
TWIN_CASES.forEach((twinCase) => {
  describe(`a twin pair in the corpus, where ${twinCase.how}`, () => {
    const runs = setUpCorpusRuns(twinCase)
    const { files, rules, agentBuildOwes } = twinCase

    it('is linted by every ESLint run with no fatal message', () => {
      expect(runs().eslintFatalMessages).toStrictEqual([])
    })

    it('is reported once in each file by the agent build, by the engine running it there', () => {
      expect(findingsByFileAndRule(runs().agent, files, rules)).toStrictEqual(agentBuildOwes)
    })

    it('is reported, merged into empty team configs, in exactly the files the agent build reports it in, per engine', () => {
      const { agent, mergedIntoEmptyTeamConfigs } = runs()

      expect(findingsByFileAndRule(mergedIntoEmptyTeamConfigs, files, rules)).toStrictEqual(findingsByFileAndRule(agent, files, rules))
    })

    it("is reported, merged into the team's configs, the team's alone, the team setting it, from one engine", () => {
      const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

      expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, rules)).toStrictEqual(
        owedBesideTheTeam(findingsByFileAndRule(agent, files, rules), findingsByFileAndRule(teamAlone, files, rules), corpusRulesTheTeamSets(rules)),
      )
    })
  })
})

// Fix round 2, defect 1, under D11 (decisions.md, 2026-10-12 "fix round 2, after its developer"): no
// config we write gives oxlint options its rule refuses. The entry decides the pair in legacy/**
// with an option only typescript-eslint's no-redeclare has, so ESLint runs that setting on the TS
// files there and oxlint's copy is off; on the JS files there the core rule keeps the top level's
// setting (D9's refusal clause), which oxlint runs. Each file reports the pair once: under the
// entry's ignoreDeclarationMerge, the interface declared twice in legacy/a.ts is no finding.
describe("no-redeclare in every file, and typescript-eslint's in legacy/** with an option oxlint's refuses, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: redeclaringSourceFiles,
    ours: OURS_SETTING_NO_REDECLARE_WITH_AN_OPTION_OXLINT_REFUSES,
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
    keepsOxlintRefusals: true,
  })
  const files = Object.keys(redeclaringSourceFiles)
  const owed = {
    'legacy/a.ts': { 'no-redeclare': ['legacy/a.ts:4 @typescript-eslint/no-redeclare'] },
    'legacy/b.js': { 'no-redeclare': ['legacy/b.js:1 eslint(no-redeclare)'] },
    'src/a.ts': { 'no-redeclare': ['src/a.ts:1 eslint(no-redeclare)', 'src/a.ts:3 eslint(no-redeclare)'] },
    'src/b.js': { 'no-redeclare': ['src/b.js:1 eslint(no-redeclare)'] },
  }

  it('is in configs oxlint loads, in the agent build and the editor merges', () => {
    expect(runs().oxlintRefusals).toStrictEqual([])
  })

  it('is reported once in each file by the agent build, with the setting the highest layer stating either name gives', () => {
    expect(findingsByFileAndRule(runs().agent, files, [NO_REDECLARE])).toStrictEqual(owed)
  })

  it('is reported once in each file merged into empty team configs, with the setting the highest layer stating either name gives', () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, [NO_REDECLARE])).toStrictEqual(owed)
  })
})

// A twin pair is one rule (D9's reading): the team turns the core rule of each pair on in oxlint, and
// its typescript-eslint twin in ESLint, so the pair is the team's in every file, reported once as the
// team's configs alone report it (decisions.md, "Owner 2026-10-14").
TWIN_CASES.forEach((twinCase) => {
  describe(`a twin pair in the corpus, beside a team oxlint config turning its core rule on, where ${twinCase.how}`, () => {
    const runs = setUpCorpusRuns({ ...twinCase, teamOxlintConfig: TEAM_CORPUS_OXLINT_CONFIG_TURNING_TWIN_CORE_RULES_ON })
    const { files, rules } = twinCase

    it('is linted by every ESLint run with no fatal message', () => {
      expect(runs().eslintFatalMessages).toStrictEqual([])
    })

    it("is reported, merged into the team's configs, the team's alone, the team setting it, from one engine", () => {
      const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

      expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, rules)).toStrictEqual(
        owedBesideTheTeam(findingsByFileAndRule(agent, files, rules), findingsByFileAndRule(teamAlone, files, rules), corpusRulesTheTeamSets(rules)),
      )
    })
  })
})

// A core rule the catalog routes to ESLint (the review of fix round 2, Must fix 1): with
// typescript-eslint's default-param-last ours, our ESLint part runs it in JS and TS files alike
// (measured). The team turns the core rule on in oxlint, so the pair is the team's in every file
// (decisions.md, "Owner 2026-10-14").
describe("typescript-eslint's default-param-last, set in our rules beside ignores naming legacy/, and a team oxlint config turning default-param-last on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: defaultParamFirstSourceFiles,
    ours: OURS_SETTING_THE_DEFAULT_PARAM_LAST_EXTENSION,
    teamEslintRules: {},
    teamOxlintConfig: TEAM_OXLINT_CONFIG_TURNING_DEFAULT_PARAM_LAST_ON,
  })
  const files = Object.keys(defaultParamFirstSourceFiles)

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  // Our part reports the pair in src, so the test below cannot pass by the team's findings alone.
  it("is reported once in each file of src by the agent build, by typescript-eslint's extension in ESLint", () => {
    expect(findingsByFileAndRule(runs().agent, files, [DEFAULT_PARAM_LAST])).toStrictEqual({
      'src/a.ts': { 'default-param-last': ['src/a.ts:1 @typescript-eslint/default-param-last'] },
      'src/b.js': { 'default-param-last': ['src/b.js:1 @typescript-eslint/default-param-last'] },
      'legacy/a.ts': { 'default-param-last': [] },
    })
  })

  it("is reported, merged into the team's configs, the team's alone, the team setting it, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, [DEFAULT_PARAM_LAST])).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, [DEFAULT_PARAM_LAST]), findingsByFileAndRule(teamAlone, files, [DEFAULT_PARAM_LAST]), [DEFAULT_PARAM_LAST.rule]),
    )
  })
})

// Under D11, in legacy/a.ts our ESLint part runs typescript-eslint's no-redeclare, with an option
// oxlint's copy refuses. The team turns no-redeclare on in both engines, so the pair is the team's in
// every file (decisions.md, "Owner 2026-10-14").
describe("no-redeclare in every file, and typescript-eslint's in legacy/** with an option oxlint's refuses, beside a team turning no-redeclare on in both engines", () => {
  const runs = setUpBothEnginesRuns({
    sources: redeclaringSourceFiles,
    ours: OURS_SETTING_NO_REDECLARE_WITH_AN_OPTION_OXLINT_REFUSES,
    teamEslintRules: TEAM_ESLINT_RULES_TURNING_NO_REDECLARE_ON,
    teamOxlintConfig: TEAM_OXLINT_CONFIG_TURNING_NO_REDECLARE_ON,
  })
  const files = Object.keys(redeclaringSourceFiles)

  it("is reported, merged into the team's configs, the team's alone, the team setting it, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, [NO_REDECLARE])).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, [NO_REDECLARE]), findingsByFileAndRule(teamAlone, files, [NO_REDECLARE]), [NO_REDECLARE.rule]),
    )
  })
})

// Both names of a twin pair in one layer, with different settings (decisions.md, 2026-10-14 "real
// run 3 ... triage", from D9 and D10): TS files keep typescript-eslint's version's setting and JS
// files the core rule's, oxlint running the core rule where our oxlint part runs it (D10). Real run
// 3, case O2d: oxlint ran max-params at max 3 on every file, so the three-parameter TS function went
// unreported. Each file reports the pair once, in the agent build and merged into empty team configs.
describe("max-params at max 3 and typescript-eslint's at max 2 in our top level, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: maxParamsSourceFiles,
    ourRulesets: COMPLEXITY,
    ours: OURS_STATING_BOTH_MAX_PARAMS_NAMES,
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(maxParamsSourceFiles)
  const owed = {
    'src/a.ts': { 'max-params': ['src/a.ts:4 eslint(max-params)', 'src/a.ts:7 eslint(max-params)'] },
    'src/b.js': { 'max-params': ['src/b.js:7 eslint(max-params)'] },
  }

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it("is reported once in each file by the agent build, at typescript-eslint's max on the TS file and max-params' on the JS file", () => {
    expect(findingsByFileAndRule(runs().agent, files, [MAX_PARAMS])).toStrictEqual(owed)
  })

  it("is reported once in each file merged into empty team configs, at typescript-eslint's max on the TS file and max-params' on the JS file", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, [MAX_PARAMS])).toStrictEqual(owed)
  })
})

// The same in an entry, beside an entry stating each name alone, which decides the pair in every file
// of its own (D9): only where both are named do the TS and JS files differ.
describe("max-params and typescript-eslint's in an entry of ours, beside an entry stating each alone, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: maxParamsSourceFilesUnderEachEntry,
    ourRulesets: COMPLEXITY,
    ours: OURS_STATING_BOTH_MAX_PARAMS_NAMES_BESIDE_ONE_ALONE,
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(maxParamsSourceFilesUnderEachEntry)
  const owed = {
    'both/a.ts': { 'max-params': ['both/a.ts:4 eslint(max-params)', 'both/a.ts:7 eslint(max-params)'] },
    'both/b.js': { 'max-params': ['both/b.js:7 eslint(max-params)'] },
    'core/a.ts': { 'max-params': ['core/a.ts:7 eslint(max-params)'] },
    'core/b.js': { 'max-params': ['core/b.js:7 eslint(max-params)'] },
    'extension/a.ts': { 'max-params': ['extension/a.ts:4 eslint(max-params)', 'extension/a.ts:7 eslint(max-params)'] },
    'extension/b.js': { 'max-params': ['extension/b.js:4 eslint(max-params)', 'extension/b.js:7 eslint(max-params)'] },
  }

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it('is reported once in each file by the agent build, at the setting the entry gives the file', () => {
    expect(findingsByFileAndRule(runs().agent, files, [MAX_PARAMS])).toStrictEqual(owed)
  })

  it('is reported once in each file merged into empty team configs, at the setting the entry gives the file', () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, [MAX_PARAMS])).toStrictEqual(owed)
  })
})

// Both names in an entry over the TS files in the project's root folder alone: the core rule runs at
// the extension's setting there, and in no TS file of a folder below.
describe("max-params and typescript-eslint's in an entry over ./*.ts, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: maxParamsSourceFilesAtTheRootAndInSrc,
    ours: OURS_STATING_BOTH_MAX_PARAMS_NAMES_IN_AN_ENTRY_OVER_THE_ROOTS_TS_FILES,
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(maxParamsSourceFilesAtTheRootAndInSrc)
  const owed = {
    'a.ts': { 'max-params': ['a.ts:4 eslint(max-params)', 'a.ts:7 eslint(max-params)'] },
    'src/a.ts': { 'max-params': [] },
  }

  it("is reported once in each file by the agent build, at typescript-eslint's max in the root's TS file alone", () => {
    expect(findingsByFileAndRule(runs().agent, files, [MAX_PARAMS])).toStrictEqual(owed)
  })

  it("is reported once in each file merged into empty team configs, at typescript-eslint's max in the root's TS file alone", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, [MAX_PARAMS])).toStrictEqual(owed)
  })
})

// Both names in an entry over the TS files of the root's src folder alone, written from the root: the
// core rule runs at the extension's setting there, and in no TS file of the root or below src.
describe("max-params and typescript-eslint's in an entry over ./src/*.ts, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: maxParamsSourceFilesAtTheRootInSrcAndBelowIt,
    ours: OURS_STATING_BOTH_MAX_PARAMS_NAMES_IN_AN_ENTRY_OVER_THE_ROOT_SRC_FOLDERS_TS_FILES,
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(maxParamsSourceFilesAtTheRootInSrcAndBelowIt)
  const owed = {
    'a.ts': { 'max-params': [] },
    'src/a.ts': { 'max-params': ['src/a.ts:4 eslint(max-params)', 'src/a.ts:7 eslint(max-params)'] },
    'src/deep/a.ts': { 'max-params': [] },
  }

  it("is reported once in each file by the agent build, at typescript-eslint's max in src's TS file alone", () => {
    expect(findingsByFileAndRule(runs().agent, files, [MAX_PARAMS])).toStrictEqual(owed)
  })

  it("is reported once in each file merged into empty team configs, at typescript-eslint's max in src's TS file alone", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, [MAX_PARAMS])).toStrictEqual(owed)
  })
})

// Both names in our top level, typescript-eslint's with an option oxlint's copy refuses (D11): ESLint
// runs that setting on the TS files, where under ignoreDeclarationMerge the interface declared twice
// is no finding, and oxlint's copy is off there; oxlint runs the core rule's setting on the JS files.
describe("no-redeclare and typescript-eslint's in our top level, typescript-eslint's with an option oxlint's refuses, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: redeclaringSourceFiles,
    ours: OURS_STATING_BOTH_NO_REDECLARE_NAMES_THE_EXTENSION_WITH_AN_OPTION_OXLINT_REFUSES,
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
    keepsOxlintRefusals: true,
  })
  const files = Object.keys(redeclaringSourceFiles)
  const owed = {
    'legacy/a.ts': { 'no-redeclare': ['legacy/a.ts:4 @typescript-eslint/no-redeclare'] },
    'legacy/b.js': { 'no-redeclare': ['legacy/b.js:1 eslint(no-redeclare)'] },
    'src/a.ts': { 'no-redeclare': ['src/a.ts:4 @typescript-eslint/no-redeclare'] },
    'src/b.js': { 'no-redeclare': ['src/b.js:1 eslint(no-redeclare)'] },
  }

  it('is in configs oxlint loads, in the agent build and the editor merges', () => {
    expect(runs().oxlintRefusals).toStrictEqual([])
  })

  it("is reported once in each file by the agent build, with typescript-eslint's setting on the TS files and no-redeclare's on the JS files", () => {
    expect(findingsByFileAndRule(runs().agent, files, [NO_REDECLARE])).toStrictEqual(owed)
  })

  it("is reported once in each file merged into empty team configs, with typescript-eslint's setting on the TS files and no-redeclare's on the JS files", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, [NO_REDECLARE])).toStrictEqual(owed)
  })
})

// Both names of two twin pairs in our top level (D9, real run 3's triage): each pair takes
// typescript-eslint's setting on the TS file, max-params' max of 2 and no-empty-function's off, and
// the core rule's on the JS file, max 3 and on, oxlint running both core rules (D10). Beside the
// team's ESLint config turning both core rules on, each pair is the team's in every file (decisions.md,
// "Owner 2026-10-14").
describe("max-params at max 3 and typescript-eslint's at max 2, and no-empty-function on and typescript-eslint's off, in our top level, beside a team ESLint config turning both core rules on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: maxParamsAndEmptyFunctionSourceFiles,
    ourRulesets: COMPLEXITY,
    ours: OURS_STATING_BOTH_NAMES_OF_TWO_PAIRS,
    teamEslintRules: TEAM_ESLINT_RULES_TURNING_MAX_PARAMS_AND_NO_EMPTY_FUNCTION_ON,
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(maxParamsAndEmptyFunctionSourceFiles)
  const rules = [MAX_PARAMS, NO_EMPTY_FUNCTION]
  const owed = {
    'src/a.ts': { 'max-params': ['src/a.ts:4 eslint(max-params)', 'src/a.ts:7 eslint(max-params)'], 'no-empty-function': [] },
    'src/b.js': { 'max-params': ['src/b.js:7 eslint(max-params)'], 'no-empty-function': ['src/b.js:10 eslint(no-empty-function)'] },
  }

  it('are linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it("are each reported once in each file by the agent build, at typescript-eslint's setting on the TS file and the core rule's on the JS file", () => {
    expect(findingsByFileAndRule(runs().agent, files, rules)).toStrictEqual(owed)
  })

  it("are each reported once in each file merged into empty team configs, at typescript-eslint's setting on the TS file and the core rule's on the JS file", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, rules)).toStrictEqual(owed)
  })

  it("are each reported, merged into the team's configs, the team's alone, the team setting each, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, rules)).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, rules), findingsByFileAndRule(teamAlone, files, rules), rules.map(({ rule }) => rule)),
    )
  })
})

// Our top level turning max-params off and typescript-eslint's on, over the complexity ruleset's
// max-params (D9): the TS file takes typescript-eslint's max of 2, which oxlint runs as max-params,
// ESLint's copy off there (D10), so the file reports the pair once; the JS file takes the core rule's
// off, so neither engine reports it there (fix round 3's review: ESLint ran typescript-eslint's
// there). Beside the team's ESLint config turning max-params on, the pair is the team's in every file
// (decisions.md, "Owner 2026-10-14").
describe("max-params off and typescript-eslint's at max 2 in our top level, over the complexity ruleset, beside a team ESLint config turning max-params on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: maxParamsSourceFiles,
    ourRulesets: COMPLEXITY,
    ours: OURS_TURNING_MAX_PARAMS_OFF_AND_TYPESCRIPT_ESLINTS_ON,
    teamEslintRules: TEAM_ESLINT_RULES_TURNING_MAX_PARAMS_AND_NO_EMPTY_FUNCTION_ON,
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const owedInTheTsFile = { 'src/a.ts': { 'max-params': ['src/a.ts:4 eslint(max-params)', 'src/a.ts:7 eslint(max-params)'] } }
  const owedInTheJsFile = { 'src/b.js': { 'max-params': [] } }

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it("is reported once in the TS file by the agent build, at typescript-eslint's max", () => {
    expect(findingsByFileAndRule(runs().agent, Object.keys(owedInTheTsFile), [MAX_PARAMS])).toStrictEqual(owedInTheTsFile)
  })

  it("is reported once in the TS file merged into empty team configs, at typescript-eslint's max", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, Object.keys(owedInTheTsFile), [MAX_PARAMS])).toStrictEqual(owedInTheTsFile)
  })

  it("is reported, merged into the team's configs, the team's alone, the team setting it, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, Object.keys(maxParamsSourceFiles), [MAX_PARAMS])).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, Object.keys(maxParamsSourceFiles), [MAX_PARAMS]), findingsByFileAndRule(teamAlone, Object.keys(maxParamsSourceFiles), [MAX_PARAMS]), [MAX_PARAMS.rule]),
    )
  })

  it('is not reported in the JS file by the agent build, where max-params is off', () => {
    expect(findingsByFileAndRule(runs().agent, Object.keys(owedInTheJsFile), [MAX_PARAMS])).toStrictEqual(owedInTheJsFile)
  })

  it('is not reported in the JS file merged into empty team configs, where max-params is off', () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, Object.keys(owedInTheJsFile), [MAX_PARAMS])).toStrictEqual(owedInTheJsFile)
  })
})

// The same in an entry of ours on legacy/**, no ruleset listed: the entry's TS file takes
// typescript-eslint's max of 2, which oxlint runs as max-params, ESLint's copy off there, so it
// reports the pair once, and its JS file the core rule's off; outside the entry nothing of ours
// turns the pair on, and the team's max-params stands there alone.
describe("max-params off and typescript-eslint's at max 2 in an entry of ours on legacy/**, no ruleset listed, beside a team ESLint config turning max-params on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: maxParamsSourceFilesInLegacyAndSrc,
    ours: OURS_TURNING_MAX_PARAMS_OFF_AND_TYPESCRIPT_ESLINTS_ON_IN_AN_ENTRY,
    teamEslintRules: TEAM_ESLINT_RULES_TURNING_MAX_PARAMS_AND_NO_EMPTY_FUNCTION_ON,
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const owedButInTheEntrysJsFile = {
    'legacy/a.ts': { 'max-params': ['legacy/a.ts:4 eslint(max-params)', 'legacy/a.ts:7 eslint(max-params)'] },
    'src/a.ts': { 'max-params': [] },
    'src/b.js': { 'max-params': [] },
  }
  const owedInTheEntrysJsFile = { 'legacy/b.js': { 'max-params': [] } }

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it("is reported once in the entry's TS file by the agent build, at typescript-eslint's max, and nowhere outside the entry", () => {
    expect(findingsByFileAndRule(runs().agent, Object.keys(owedButInTheEntrysJsFile), [MAX_PARAMS])).toStrictEqual(owedButInTheEntrysJsFile)
  })

  it("is reported once in the entry's TS file merged into empty team configs, at typescript-eslint's max, and nowhere outside the entry", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, Object.keys(owedButInTheEntrysJsFile), [MAX_PARAMS])).toStrictEqual(
      owedButInTheEntrysJsFile,
    )
  })

  it("is reported, merged into the team's configs, the team's alone, the team setting it, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, Object.keys(maxParamsSourceFilesInLegacyAndSrc), [MAX_PARAMS])).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, Object.keys(maxParamsSourceFilesInLegacyAndSrc), [MAX_PARAMS]), findingsByFileAndRule(teamAlone, Object.keys(maxParamsSourceFilesInLegacyAndSrc), [MAX_PARAMS]), [MAX_PARAMS.rule]),
    )
  })

  it("is not reported in the entry's JS file by the agent build, where max-params is off", () => {
    expect(findingsByFileAndRule(runs().agent, Object.keys(owedInTheEntrysJsFile), [MAX_PARAMS])).toStrictEqual(owedInTheEntrysJsFile)
  })

  it("is not reported in the entry's JS file merged into empty team configs, where max-params is off", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, Object.keys(owedInTheEntrysJsFile), [MAX_PARAMS])).toStrictEqual(
      owedInTheEntrysJsFile,
    )
  })
})

// Both max-params names in our top level, and an entry of ours on legacy/** turning max-params off
// (D9): the entry is the highest layer stating either name there, so the pair is off in its TS file
// too; outside it the TS file takes typescript-eslint's max of 2 and the JS file max-params' 3. Beside
// the team's ESLint config turning max-params on, the pair is the team's in every file.
describe("max-params at max 3 and typescript-eslint's at max 2 in our top level, and an entry of ours on legacy/** turning max-params off, beside a team ESLint config turning max-params on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: maxParamsSourceFilesInLegacyAndSrc,
    ourRulesets: COMPLEXITY,
    ours: OURS_STATING_BOTH_MAX_PARAMS_NAMES_BESIDE_AN_ENTRY_TURNING_MAX_PARAMS_OFF,
    teamEslintRules: TEAM_ESLINT_RULES_TURNING_MAX_PARAMS_AND_NO_EMPTY_FUNCTION_ON,
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(maxParamsSourceFilesInLegacyAndSrc)
  const owed = {
    'legacy/a.ts': { 'max-params': [] },
    'legacy/b.js': { 'max-params': [] },
    'src/a.ts': { 'max-params': ['src/a.ts:4 eslint(max-params)', 'src/a.ts:7 eslint(max-params)'] },
    'src/b.js': { 'max-params': ['src/b.js:7 eslint(max-params)'] },
  }

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it('is reported by the agent build nowhere in the entry, and once in each file outside it at the setting our top level gives the file', () => {
    expect(findingsByFileAndRule(runs().agent, files, [MAX_PARAMS])).toStrictEqual(owed)
  })

  it('is reported merged into empty team configs nowhere in the entry, and once in each file outside it at the setting our top level gives the file', () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, [MAX_PARAMS])).toStrictEqual(owed)
  })

  it("is reported, merged into the team's configs, the team's alone, the team setting it, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, [MAX_PARAMS])).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, [MAX_PARAMS]), findingsByFileAndRule(teamAlone, files, [MAX_PARAMS]), [MAX_PARAMS.rule]),
    )
  })
})

// Both no-unused-vars names in our top level, over the redundancy ruleset, which ships no-unused-vars
// with ignores leaving scripts/ out: on TS files oxlint runs no-unused-vars at typescript-eslint's
// args all, within the core rule's own ignores, as everywhere else. Which engine reports the pair in
// scripts/ is left open here (fix round 3's developer, open items): these tests pin oxlint's part.
describe("no-unused-vars under args none and typescript-eslint's under args all in our top level, over the redundancy ruleset, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: unusedParameterSourceFiles,
    ourRulesets: REDUNDANCY,
    ours: OURS_STATING_BOTH_NO_UNUSED_VARS_NAMES,
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(unusedParameterSourceFiles)

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it("is reported by oxlint, in the agent build, in the TS file of src alone: never in scripts/, which no-unused-vars' own ignores leave out", () => {
    expect(filesReportingIn(runs().agent, files, NO_UNUSED_VARS, 'oxlint')).toStrictEqual(['src/a.ts'])
  })

  it("is reported by oxlint, merged into empty team configs, in the TS file of src alone: never in scripts/, which no-unused-vars' own ignores leave out", () => {
    expect(filesReportingIn(runs().mergedIntoEmptyTeamConfigs, files, NO_UNUSED_VARS, 'oxlint')).toStrictEqual(['src/a.ts'])
  })
})

// Our top level turning no-redeclare off and typescript-eslint's on, with an option oxlint's copy
// refuses (D9, D11): ESLint runs typescript-eslint's on the TS files alone, and no rule of ours runs
// on the JS files. Beside a team turning no-redeclare on in both engines, the pair is the team's in
// every file (decisions.md, "Owner 2026-10-14").
describe("no-redeclare off and typescript-eslint's on in our top level, typescript-eslint's with an option oxlint's refuses, beside a team turning no-redeclare on in both engines, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: redeclaringSourceFiles,
    ours: OURS_TURNING_NO_REDECLARE_OFF_AND_TYPESCRIPT_ESLINTS_ON,
    teamEslintRules: TEAM_ESLINT_RULES_TURNING_NO_REDECLARE_ON,
    teamOxlintConfig: TEAM_OXLINT_CONFIG_TURNING_NO_REDECLARE_ON,
  })
  const files = Object.keys(redeclaringSourceFiles)

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  // Our part reports the pair in the TS files alone, so the test below reads both sides of the merge.
  it("is reported by the agent build once in each TS file, at typescript-eslint's setting, and in no JS file", () => {
    expect(findingsByFileAndRule(runs().agent, files, [NO_REDECLARE])).toStrictEqual({
      'legacy/a.ts': { 'no-redeclare': ['legacy/a.ts:4 @typescript-eslint/no-redeclare'] },
      'legacy/b.js': { 'no-redeclare': [] },
      'src/a.ts': { 'no-redeclare': ['src/a.ts:4 @typescript-eslint/no-redeclare'] },
      'src/b.js': { 'no-redeclare': [] },
    })
  })

  it("is reported, merged into the team's configs, the team's alone, the team setting it", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, [NO_REDECLARE])).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, [NO_REDECLARE]), findingsByFileAndRule(teamAlone, files, [NO_REDECLARE]), [NO_REDECLARE.rule]),
    )
  })
})

// The same in an entry of ours on legacy/**, no rule of ours outside it: ESLint runs
// typescript-eslint's on the entry's TS file alone. Beside a team turning no-redeclare on in both
// engines, the pair is the team's in every file.
describe("no-redeclare off and typescript-eslint's on in an entry of ours on legacy/**, typescript-eslint's with an option oxlint's refuses, beside a team turning no-redeclare on in both engines, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: redeclaringSourceFiles,
    ours: OURS_TURNING_NO_REDECLARE_OFF_AND_TYPESCRIPT_ESLINTS_ON_IN_AN_ENTRY,
    teamEslintRules: TEAM_ESLINT_RULES_TURNING_NO_REDECLARE_ON,
    teamOxlintConfig: TEAM_OXLINT_CONFIG_TURNING_NO_REDECLARE_ON,
  })
  const files = Object.keys(redeclaringSourceFiles)

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it("is reported by the agent build once in the entry's TS file, at typescript-eslint's setting, and in no other file", () => {
    expect(findingsByFileAndRule(runs().agent, files, [NO_REDECLARE])).toStrictEqual({
      'legacy/a.ts': { 'no-redeclare': ['legacy/a.ts:4 @typescript-eslint/no-redeclare'] },
      'legacy/b.js': { 'no-redeclare': [] },
      'src/a.ts': { 'no-redeclare': [] },
      'src/b.js': { 'no-redeclare': [] },
    })
  })

  it("is reported, merged into the team's configs, the team's alone, the team setting it", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, [NO_REDECLARE])).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, [NO_REDECLARE]), findingsByFileAndRule(teamAlone, files, [NO_REDECLARE]), [NO_REDECLARE.rule]),
    )
  })
})

// Our top level turning no-redeclare off and typescript-eslint's on, and an entry of ours on
// legacy/** stating typescript-eslint's alone, with an option oxlint's copy honours (D10): our top
// level runs no-redeclare nowhere, its TS files included, so oxlint's copy takes no setting in the
// entry, and ESLint runs typescript-eslint's on every file there, its JS file included, where under
// its default ignoreDeclarationMerge the interface declared twice is no finding.
describe("no-redeclare off and typescript-eslint's on in our top level, and an entry of ours on legacy/** stating typescript-eslint's alone, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: redeclaringSourceFiles,
    ours: OURS_TURNING_NO_REDECLARE_OFF_AND_TYPESCRIPT_ESLINTS_ON_BESIDE_AN_ENTRY_STATING_TYPESCRIPT_ESLINTS_ALONE,
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = Object.keys(redeclaringSourceFiles)
  const owed = {
    'legacy/a.ts': { 'no-redeclare': ['legacy/a.ts:4 @typescript-eslint/no-redeclare'] },
    'legacy/b.js': { 'no-redeclare': ['legacy/b.js:2 @typescript-eslint/no-redeclare'] },
    'src/a.ts': { 'no-redeclare': ['src/a.ts:4 @typescript-eslint/no-redeclare'] },
    'src/b.js': { 'no-redeclare': [] },
  }

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it("is reported by the agent build by typescript-eslint's, once in each file of the entry and in the TS file outside it, and not in the JS file outside it", () => {
    expect(findingsByFileAndRule(runs().agent, files, [NO_REDECLARE])).toStrictEqual(owed)
  })

  it("is reported merged into empty team configs by typescript-eslint's, once in each file of the entry and in the TS file outside it, and not in the JS file outside it", () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, [NO_REDECLARE])).toStrictEqual(owed)
  })
})
