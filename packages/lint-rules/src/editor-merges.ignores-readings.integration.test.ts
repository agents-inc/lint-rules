import { beforeAll, describe, expect, it } from 'vitest'
import { type BothEnginesRuns, setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import {
  CORPUS_RULES,
  type CorpusCase,
  corpusRulesTheTeamSets,
  NO_RULESETS,
  NO_UNUSED_VARS,
  NO_VAR,
  OUR_CORPUS_RULES,
  OUR_CORPUS_RULES_BUT_PREFER_CONST,
  PREFER_CONST,
} from './__tests__/cases/both-engines-corpus.ts'
import {
  OURS_TAKING_A_PACKAGE_BACK_FROM_ESLINT_DEFAULTS,
  packageTakenBackSourceFiles,
  TEAM_GRID_ESLINT_RULES,
  TEAM_OXLINT_CONFIG_TURNING_NO_VAR_ON,
} from './__tests__/cases/both-engines-grid.ts'
import { setUpCorpusRuns } from './__tests__/corpus-runs.ts'
import { filesReportingIn, findingsByFileAndRule, owedBesideTheTeam } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'

// Our ignores as each engine reads them: ESLint as global ignores, oxlint as ignorePatterns, negated
// lines taking files back. Each shape here is one a break of either engine's reading changes.

allowEveryTestForParallelLoad()

/** Our corpus rules, beside the ignores given. */
function oursWithIgnores(ignores: readonly string[]): CorpusCase['ours'] {
  return { rules: OUR_CORPUS_RULES, ignores: [...ignores] }
}

const READING_CASES: readonly CorpusCase[] = [
  {
    how: 'a negated line names src/legacy/ before a line naming it: !src/legacy/, src/legacy/',
    ourRulesets: NO_RULESETS,
    ours: oursWithIgnores(['!src/legacy/', 'src/legacy/']),
    files: ['src/legacy/a.ts', 'src/legacy/keep/index.js', 'src/a.ts'],
    rules: CORPUS_RULES,
  },
  {
    how: 'they name lib/** and take back lib/sub/**, and an entry of ours sets eqeqeq in lib/**',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES, ignores: ['lib/**', '!lib/sub/**'], fileOverrides: [{ files: ['lib/**'], rules: { eqeqeq: ['error', 'smart'] } }] },
    files: ['lib/sub/c.js', 'lib/a.ts', 'src/lib/a.js'],
    rules: CORPUS_RULES,
  },
  {
    how: 'they name every legacy folder with a trailing slash and take back src/legacy/keep/: **/legacy/, !src/legacy/keep/',
    ourRulesets: NO_RULESETS,
    ours: oursWithIgnores(['**/legacy/', '!src/legacy/keep/']),
    files: ['src/legacy/keep/index.js', 'src/legacy/a.ts', 'legacy/a.ts', 'legacy/keep/index.js'],
    rules: CORPUS_RULES,
  },
  {
    how: 'they name every file in a legacy folder and take back every file in a keep folder: **/legacy/**, !**/keep/**',
    ourRulesets: NO_RULESETS,
    ours: oursWithIgnores(['**/legacy/**', '!**/keep/**']),
    files: ['legacy/keep/index.js', 'legacy/keep/deep/b.js', 'src/legacy/keep/index.js', 'legacy/a.ts', 'src/legacy/a.ts'],
    rules: CORPUS_RULES,
  },
  {
    how: 'they name legacy/ and take back every keep folder: legacy/, !**/keep/',
    ourRulesets: NO_RULESETS,
    ours: oursWithIgnores(['legacy/', '!**/keep/']),
    files: ['legacy/keep/index.js', 'legacy/keep/deep/b.js', 'legacy/a.ts'],
    rules: CORPUS_RULES,
  },
  {
    how: 'they name a file with a leading slash: /src/a.js',
    ourRulesets: NO_RULESETS,
    ours: oursWithIgnores(['/src/a.js']),
    files: ['src/a.js', 'a.js', 'src/a.ts'],
    rules: CORPUS_RULES,
  },
  {
    how: 'they name legacy/ and take back one file in it: legacy/, !legacy/keep/index.js',
    ourRulesets: NO_RULESETS,
    ours: oursWithIgnores(['legacy/', '!legacy/keep/index.js']),
    files: ['legacy/keep/index.js', 'legacy/keep/deep/b.js', 'legacy/a.ts'],
    rules: CORPUS_RULES,
  },
  {
    how: 'they name legacy/, take back legacy/keep/, and name legacy/keep/deep/ again',
    ourRulesets: NO_RULESETS,
    ours: oursWithIgnores(['legacy/', '!legacy/keep/', 'legacy/keep/deep/']),
    files: ['legacy/keep/deep/b.js', 'legacy/keep/index.js', 'legacy/a.ts'],
    rules: CORPUS_RULES,
  },
  {
    how: 'they name every legacy file or folder bare and take back src/keep: legacy, !src/keep',
    ourRulesets: NO_RULESETS,
    ours: oursWithIgnores(['legacy', '!src/keep']),
    files: ['src/keep/legacy/x.js', 'src/keep/a.js', 'legacy/a.ts'],
    rules: CORPUS_RULES,
  },
  {
    how: 'an entry of ours alone turns prefer-const on, in src/*/keep/**, beside ignores naming src/legacy/ and taking back src/legacy/keep/',
    ourRulesets: NO_RULESETS,
    ours: {
      rules: OUR_CORPUS_RULES_BUT_PREFER_CONST,
      ignores: ['src/legacy/', '!src/legacy/keep/'],
      fileOverrides: [{ files: ['src/*/keep/**'], rules: { 'prefer-const': 'error' } }],
    },
    files: ['a.js', 'src/a.ts', 'src/legacy/keep/index.js', 'src/keep/a.js'],
    rules: [PREFER_CONST],
  },
]

// Each case's name in full in its title, which describe.each's $-interpolation would cut short.
READING_CASES.forEach((corpusCase) => {
  describe(`our rules in the corpus, where our ignores are read by each engine and ${corpusCase.how}`, () => {
    const runs = setUpCorpusRuns(corpusCase)
    const { files, rules } = corpusCase

    it('are linted by every ESLint run with no fatal message', () => {
      expect(runs().eslintFatalMessages).toStrictEqual([])
    })

    it('report, merged into empty team configs, in exactly the files the agent build reports them in, per engine', () => {
      const { agent, mergedIntoEmptyTeamConfigs } = runs()

      expect(findingsByFileAndRule(mergedIntoEmptyTeamConfigs, files, rules)).toStrictEqual(findingsByFileAndRule(agent, files, rules))
    })

    it("report, merged into the team's configs, the team's alone of each rule the team sets, from one engine", () => {
      const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

      expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, rules)).toStrictEqual(
        owedBesideTheTeam(findingsByFileAndRule(agent, files, rules), findingsByFileAndRule(teamAlone, files, rules), corpusRulesTheTeamSets(rules)),
      )
    })
  })
})

// ESLint takes keep/legacy/a.js back from **/legacy/** with !**/keep/**, so our ESLint part runs our
// rules there; the shared ESLint reading of our ignores must agree.
describe('our rules in the corpus, where our ignores name every file in a legacy folder and take back every file in a keep folder, in a legacy folder inside a keep folder', () => {
  const corpusCase: CorpusCase = {
    how: 'every file in a legacy folder, less every file in a keep folder',
    ourRulesets: NO_RULESETS,
    ours: oursWithIgnores(['**/legacy/**', '!**/keep/**']),
    files: ['keep/legacy/a.js', 'src/keep/legacy/x.js'],
    rules: CORPUS_RULES,
  }
  const runs = setUpCorpusRuns(corpusCase)
  const { files, rules } = corpusCase

  it('report, merged into empty team configs, in exactly the files the agent build reports them in, per engine', () => {
    const { agent, mergedIntoEmptyTeamConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoEmptyTeamConfigs, files, rules)).toStrictEqual(findingsByFileAndRule(agent, files, rules))
  })

  it("report, merged into the team's configs, the team's alone of each rule the team sets, from one engine", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, rules)).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, rules), findingsByFileAndRule(teamAlone, files, rules), corpusRulesTheTeamSets(rules)),
    )
  })
})

/**
 * Ignores oxlint's reading takes more files back from than oxlint does, and the files only the reading
 * takes back (measured).
 */
type OxlintReadingLimit = { readonly ignores: readonly string[]; readonly takenBackByTheReadingOnly: readonly string[] }

// Files in and out of every folder the limits name.
const LIMIT_FILES = [
  'a.js',
  'src/a.js',
  'legacy/a.ts',
  'legacy/keep/index.js',
  'legacy/keep/deep/b.js',
  'legacy/keep/legacy/c.js',
  'src/legacy/a.ts',
  'src/legacy/keep/index.js',
  'keep/a.js',
  'keep/legacy/a.js',
  'src/keep/a.js',
  'src/keep/legacy/x.js',
]

const OXLINT_READING_LIMITS: readonly OxlintReadingLimit[] = [
  { ignores: ['legacy/', '!legacy/keep/'], takenBackByTheReadingOnly: ['legacy/keep/legacy/c.js'] },
  { ignores: ['legacy/', '!keep/'], takenBackByTheReadingOnly: ['legacy/keep/legacy/c.js', 'keep/legacy/a.js', 'src/keep/legacy/x.js'] },
  { ignores: ['legacy', '!legacy/keep'], takenBackByTheReadingOnly: ['legacy/keep/legacy/c.js'] },
  { ignores: ['legacy/', '!legacy/keep/', 'legacy/keep/deep/'], takenBackByTheReadingOnly: ['legacy/keep/legacy/c.js'] },
  { ignores: ['legacy', '!keep'], takenBackByTheReadingOnly: ['legacy/keep/legacy/c.js', 'keep/legacy/a.js', 'src/keep/legacy/x.js'] },
  { ignores: ['keep/', '!legacy/'], takenBackByTheReadingOnly: ['legacy/keep/index.js', 'legacy/keep/deep/b.js', 'src/legacy/keep/index.js'] },
  { ignores: ['legacy/', '!**/keep/'], takenBackByTheReadingOnly: ['legacy/keep/legacy/c.js', 'keep/legacy/a.js', 'src/keep/legacy/x.js'] },
  { ignores: ['!legacy/keep/', 'legacy/'], takenBackByTheReadingOnly: ['legacy/keep/legacy/c.js'] },
  { ignores: ['**/legacy', '!legacy/keep', '!keep'], takenBackByTheReadingOnly: ['legacy/keep/legacy/c.js', 'keep/legacy/a.js', 'src/keep/legacy/x.js'] },
]

OXLINT_READING_LIMITS.forEach(({ ignores, takenBackByTheReadingOnly }) => {
  describe(`prefer-const, which our oxlint part runs, where our ignores are ${JSON.stringify(ignores)}`, () => {
    const runs = setUpCorpusRuns({ how: JSON.stringify(ignores), ourRulesets: NO_RULESETS, ours: oursWithIgnores(ignores), files: LIMIT_FILES, rules: [PREFER_CONST] })
    // Read before the tests, so only the assertion can fail inside it.fails.
    let made: BothEnginesRuns | undefined

    beforeAll(() => {
      made = runs()
    })

    function theRuns(): BothEnginesRuns {
      if (made === undefined) throw new Error(`no run was made before the tests for ${JSON.stringify(ignores)}`)
      return made
    }

    // KNOWN GAP: under a negated folder line, oxlint decides a file by a deeper left-out folder, which
    // override globs cannot tell, so our oxlint rules run there in the editor but not in the agent build.
    it.fails('reports it, merged into empty team configs, in exactly the files the agent build reports it in', () => {
      const { agent, mergedIntoEmptyTeamConfigs } = theRuns()

      expect(findingsByFileAndRule(mergedIntoEmptyTeamConfigs, LIMIT_FILES, [PREFER_CONST])).toStrictEqual(findingsByFileAndRule(agent, LIMIT_FILES, [PREFER_CONST]))
    })

    it('reports it, merged into empty team configs, from oxlint in the files the agent build reports it in, and in the files only the reading takes back', () => {
      const { agent, mergedIntoEmptyTeamConfigs } = theRuns()
      const inTheAgentBuild = filesReportingIn(agent, LIMIT_FILES, PREFER_CONST, 'oxlint')
      const merged = filesReportingIn(mergedIntoEmptyTeamConfigs, LIMIT_FILES, PREFER_CONST, 'oxlint')

      expect({
        mergedOnly: merged.filter((file) => !inTheAgentBuild.includes(file)).toSorted(),
        agentBuildOnly: inTheAgentBuild.filter((file) => !merged.includes(file)),
      }).toStrictEqual({ mergedOnly: [...takenBackByTheReadingOnly].toSorted(), agentBuildOnly: [] })
    })
  })
})

// The agent build gives ESLint our ignores as global ignores, so it reports our no-var in
// node_modules/mylib; in the editor they are not global, so our ESLint part never lints node_modules.
// Our oxlint part runs nowhere there: a negated folder line cannot take back **/node_modules/**.
describe("our rules, where our ignores take node_modules/mylib back from ESLint's default ignores: !node_modules/, node_modules/*, !node_modules/mylib/", () => {
  const runs = setUpBothEnginesRuns({
    sources: packageTakenBackSourceFiles,
    ours: OURS_TAKING_A_PACKAGE_BACK_FROM_ESLINT_DEFAULTS,
    teamEslintRules: TEAM_GRID_ESLINT_RULES,
    teamOxlintConfig: TEAM_OXLINT_CONFIG_TURNING_NO_VAR_ON,
  })
  const files = Object.keys(packageTakenBackSourceFiles)
  const rules = [NO_VAR, NO_UNUSED_VARS]
  // Read before the tests, so only the assertion can fail inside it.fails.
  let made: BothEnginesRuns | undefined

  beforeAll(() => {
    made = runs()
  })

  function theRuns(): BothEnginesRuns {
    if (made === undefined) throw new Error('no run was made before the tests of our ignores taking node_modules/mylib back')
    return made
  }

  it('are linted by every ESLint run with no fatal message', () => {
    expect(theRuns().eslintFatalMessages).toStrictEqual([])
  })

  it("report, merged into the team's configs, the team's alone: its oxlint no-var in every file, and its ESLint twin of no-unused-vars where ESLint lints, from one engine", () => {
    expect(findingsByFileAndRule(theRuns().mergedIntoTheTeamsConfigs, files, rules)).toStrictEqual({
      'src/a.js': { 'no-var': ['src/a.js:5 eslint(no-var)'], 'no-unused-vars': ['src/a.js:2 @typescript-eslint/no-unused-vars'] },
      'node_modules/mylib/a.js': { 'no-var': ['node_modules/mylib/a.js:5 eslint(no-var)'], 'no-unused-vars': [] },
      'node_modules/other/a.js': { 'no-var': ['node_modules/other/a.js:5 eslint(no-var)'], 'no-unused-vars': [] },
    })
  })

  // KNOWN GAP: the agent build's ESLint reports our no-var in node_modules/mylib/a.js, which no editor
  // merge can lint while ESLint's default ignores hold there.
  it.fails('report, merged into empty team configs, in exactly the files the agent build reports them in, per engine', () => {
    const { agent, mergedIntoEmptyTeamConfigs } = theRuns()

    expect(findingsByFileAndRule(mergedIntoEmptyTeamConfigs, files, rules)).toStrictEqual(findingsByFileAndRule(agent, files, rules))
  })

  it('report, merged into empty team configs, as the agent build does but for its ESLint no-var in node_modules/mylib/a.js', () => {
    const { agent, mergedIntoEmptyTeamConfigs } = theRuns()

    expect({
      agentBuild: findingsByFileAndRule(agent, files, rules),
      mergedIntoEmptyTeamConfigs: findingsByFileAndRule(mergedIntoEmptyTeamConfigs, files, rules),
    }).toStrictEqual({
      agentBuild: {
        'src/a.js': { 'no-var': ['src/a.js:5 no-var'], 'no-unused-vars': ['src/a.js:2 eslint(no-unused-vars)'] },
        'node_modules/mylib/a.js': { 'no-var': ['node_modules/mylib/a.js:5 no-var'], 'no-unused-vars': [] },
        'node_modules/other/a.js': { 'no-var': [], 'no-unused-vars': [] },
      },
      mergedIntoEmptyTeamConfigs: {
        'src/a.js': { 'no-var': ['src/a.js:5 no-var'], 'no-unused-vars': ['src/a.js:2 eslint(no-unused-vars)'] },
        'node_modules/mylib/a.js': { 'no-var': [], 'no-unused-vars': [] },
        'node_modules/other/a.js': { 'no-var': [], 'no-unused-vars': [] },
      },
    })
  })
})
