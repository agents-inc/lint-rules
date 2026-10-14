import { beforeAll, describe, expect, it } from 'vitest'
import type { BothEnginesRuns } from './__tests__/both-engines-runs.ts'
import {
  ARRAY_TYPE,
  BAN_TS_COMMENT,
  CORPUS_RULES,
  type CorpusCase,
  corpusRulesTheTeamSets,
  EQEQEQ,
  GETTER_RETURN,
  NO_RULESETS,
  NO_UNUSED_VARS,
  NO_VAR,
  OUR_CORPUS_RULES,
  OUR_CORPUS_RULES_BUT_ARRAY_TYPE,
  OUR_CORPUS_RULES_BUT_EQEQEQ,
  PREFER_CONST,
} from './__tests__/cases/both-engines-corpus.ts'
import { setUpCorpusRuns } from './__tests__/corpus-runs.ts'
import { findingsByFileAndRule, owedBesideTheTeam } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'

// The file types oxlint runs each rule in (rule-data's data/oxlint-file-types.json), in the editor
// merges through the built package, linted by the real ESLint and oxlint. Our ESLint part lints JS
// and TS files only, and our oxlint part runs each rule in the file types oxlint runs it in. Owed in
// every file, as on the grid: merged into empty team configs, our rules report where the agent build
// reports them, per engine; beside the team, which sets every corpus rule, the team's alone in every
// file, never from both engines (decisions.md, "Owner 2026-10-14"). The team lints .mjs, .cjs and
// .tsx files too, and its .vue, .svelte and .astro files through a parser of its own.

allowEveryTestForParallelLoad()

// Every file type the corpus holds but a .vue file with a plain script.
const FILES_OF_EVERY_TYPE = ['a.ts', 'a.js', 'src/b.mjs', 'src/b.cjs', 'src/c.tsx', 'src/types.d.ts', 'src/c.vue', 'src/c.svelte', 'src/c.astro']

const FILE_TYPE_CASES: readonly CorpusCase[] = [
  {
    how: 'our settings turn the corpus rules on in every file, ban-ts-comment always on beside them',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES },
    files: FILES_OF_EVERY_TYPE,
    rules: [...CORPUS_RULES, BAN_TS_COMMENT],
  },
  {
    how: 'our ignores name every .js file and take back src/: **/*.js, !src/',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES, ignores: ['**/*.js', '!src/'] },
    files: ['src/b.mjs', 'src/b.cjs', 'src/a.js', 'src/a.ts', 'a.js'],
    rules: [BAN_TS_COMMENT, EQEQEQ, NO_VAR],
  },
  {
    how: 'our ignores name every .vue file in src and take back src/c.vue: src/*.vue, !src/c.vue',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES, ignores: ['src/*.vue', '!src/c.vue'] },
    files: ['src/c.vue', 'src/a.ts'],
    rules: [ARRAY_TYPE, NO_VAR, PREFER_CONST],
  },
  {
    how: 'an entry of ours turns array-type on in TS and .vue files alone, written as one glob: **/*.{ts,vue}',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES_BUT_ARRAY_TYPE, fileOverrides: [{ files: ['**/*.{ts,vue}'], rules: { '@typescript-eslint/array-type': 'error' } }] },
    files: ['src/c.tsx', 'src/a.ts', 'src/c.vue'],
    rules: [ARRAY_TYPE],
  },
  {
    how: 'an entry of ours turns array-type on in every file but src/**, written as a negated glob alone: !src/**',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES_BUT_ARRAY_TYPE, fileOverrides: [{ files: ['!src/**'], rules: { '@typescript-eslint/array-type': 'error' } }] },
    files: ['src/c.vue', 'src/c.svelte', 'src/c.astro', 'src/a.ts', 'src/c.tsx', 'a.ts'],
    rules: [ARRAY_TYPE],
  },
  {
    how: 'our ignores name a folder bare, beside a declaration file: generated',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES, ignores: ['generated'] },
    files: ['src/types.d.ts', 'src/a.ts', 'generated/a.ts'],
    rules: [NO_UNUSED_VARS],
  },
]

// Each case's name in full in its title, which describe.each's $-interpolation would cut short.
FILE_TYPE_CASES.forEach((corpusCase) => {
  describe(`our rules in the corpus, beside the file types oxlint runs each in, where ${corpusCase.how}`, () => {
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

// Fix round 2, defect 2 (decisions.md, 2026-10-12 "fix round 2, after its developer"): no block we
// write makes ESLint lint a file it would not lint without our part. Our eqeqeq is on only in an
// entry for **/*.ts and **/*.vue; a block written with `files` for two globs of different
// extensions once handed ESLint the .vue files, which it cannot parse without a parser of the
// team's.
describe('our eqeqeq, on only in an entry of ours for **/*.ts and **/*.vue, beside .vue files', () => {
  const runs = setUpCorpusRuns({
    how: 'eqeqeq only in an entry for TS and .vue files',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES_BUT_EQEQEQ, fileOverrides: [{ files: ['**/*.ts', '**/*.vue'], rules: { eqeqeq: 'error' } }] },
    files: ['src/a.ts', 'src/c.vue', 'src/d.vue', 'a.js'],
    rules: [EQEQEQ],
  })

  it('is linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it("is merged into ESLint configs that lint exactly the files the agent build's and the team's configs alone lint between them", () => {
    const { eslintLintedFiles } = runs()

    expect({
      mergedIntoEmptyTeamConfigs: eslintLintedFiles.mergedIntoEmptyTeamConfigs,
      mergedIntoTheTeamsConfigs: eslintLintedFiles.mergedIntoTheTeamsConfigs,
    }).toStrictEqual({
      mergedIntoEmptyTeamConfigs: eslintLintedFiles.agent,
      mergedIntoTheTeamsConfigs: [...new Set([...eslintLintedFiles.agent, ...eslintLintedFiles.teamAlone])].toSorted(),
    })
  })
})

describe("our rules in the corpus, beside a .vue file with a plain script and the team's configs", () => {
  const files = ['src/d.vue']
  const rules = [BAN_TS_COMMENT, GETTER_RETURN]
  const runs = setUpCorpusRuns({ how: 'a .vue file with a plain script', ourRulesets: NO_RULESETS, ours: { rules: OUR_CORPUS_RULES }, files: ['src/c.vue', ...files], rules })
  // The runs are read before the test, so a run the engines cannot make fails the file: inside
  // it.fails it would pass as the failure expected. Only the assertion fails inside it.fails.
  let made: BothEnginesRuns | undefined

  beforeAll(() => {
    made = runs()
  })

  function theRuns(): BothEnginesRuns {
    if (made === undefined) throw new Error('no run was made before the test for a .vue file with a plain script')
    return made
  }

  // Once a known gap (questions.md #63): no glob can tell a .vue file's script language, and the
  // ESLint merge turned the team's copy of ban-ts-comment off in every .vue file, where oxlint's,
  // TS only, reports nothing for a plain script; and left the team's getter-return on beside
  // oxlint's. The team sets both rules, so both are the team's there, and nothing turns either off
  // (decisions.md, "Owner 2026-10-14").
  it("reports, merged into the team's configs, each rule once, as the team's configs alone report it", () => {
    const { agent, teamAlone, mergedIntoTheTeamsConfigs } = theRuns()

    expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, rules)).toStrictEqual(
      owedBesideTheTeam(findingsByFileAndRule(agent, files, rules), findingsByFileAndRule(teamAlone, files, rules), corpusRulesTheTeamSets(rules)),
    )
  })
})
