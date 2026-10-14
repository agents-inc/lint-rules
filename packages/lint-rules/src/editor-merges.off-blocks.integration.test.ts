import { describe, expect, it } from 'vitest'
import { type CorpusCase, corpusRulesTheTeamSets, NO_RULESETS, OUR_CORPUS_RULES_BUT_PREFER_CONST, PREFER_CONST } from './__tests__/cases/both-engines-corpus.ts'
import { setUpCorpusRuns } from './__tests__/corpus-runs.ts'
import { findingsByFileAndRule, owedBesideTheTeam } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'

// An entry of ours alone turning a rule on in files given by negated globs and file types, in the
// editor merges through the built package, linted by the real ESLint and oxlint. These cases once
// pinned the ESLint merge's cross-engine off of the team's copy of eqeqeq, which the owner's
// 2026-10-14 model removed, and which ESLint now runs for us (spec-merge-model.md, 3.2): here
// prefer-const, which oxlint runs for us and the team sets in its ESLint config, so beside it the
// rule is the team's in every file. Owed in every file, as on the grid: merged into empty team configs, our rules report where
// the agent build reports them; beside the team, the team's alone, never from both engines, and
// never lost.

allowEveryTestForParallelLoad()

const OFF_BLOCK_CASES: readonly CorpusCase[] = [
  {
    how: 'an entry of ours turns prefer-const on in every file but src/**, written as a negated glob alone: !src/**',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES_BUT_PREFER_CONST, fileOverrides: [{ files: ['!src/**'], rules: { 'prefer-const': 'error' } }] },
    files: ['a.js', 'keep/a.js', 'src/a.js', 'src/a.ts', 'src/b.mjs', 'src/c.vue'],
    rules: [PREFER_CONST],
  },
  // Two globs, one negated: the off block cannot say both entries in one list of ignores, as one
  // asks a negated glob, so each gets a block of its own (found by breaking that decision, fix round 2).
  {
    how: 'an entry of ours turns prefer-const on in every file but src/**, and in src/keep/**, written as a negated glob and a glob: !src/**, src/keep/**',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES_BUT_PREFER_CONST, fileOverrides: [{ files: ['!src/**', 'src/keep/**'], rules: { 'prefer-const': 'error' } }] },
    files: ['a.js', 'keep/a.js', 'src/a.js', 'src/a.ts', 'src/keep/a.js', 'src/keep/legacy/x.js', 'src/c.vue'],
    rules: [PREFER_CONST],
  },
  {
    how: 'an entry of ours turns prefer-const on in TS and .vue files alone, written as two globs: **/*.ts, **/*.vue',
    ourRulesets: NO_RULESETS,
    ours: { rules: OUR_CORPUS_RULES_BUT_PREFER_CONST, fileOverrides: [{ files: ['**/*.ts', '**/*.vue'], rules: { 'prefer-const': 'error' } }] },
    files: ['a.js', 'keep/a.js', 'src/a.js', 'src/b.cjs', 'src/a.ts', 'src/c.vue', 'src/c.svelte'],
    rules: [PREFER_CONST],
  },
]

// Each case's name in full in its title, which describe.each's $-interpolation would cut short.
OFF_BLOCK_CASES.forEach((corpusCase) => {
  describe(`our prefer-const in the corpus, where ${corpusCase.how}`, () => {
    const runs = setUpCorpusRuns(corpusCase)
    const { files, rules } = corpusCase

    it('is linted by every ESLint run with no fatal message', () => {
      expect(runs().eslintFatalMessages).toStrictEqual([])
    })

    it('reports, merged into empty team configs, in exactly the files the agent build reports it in, per engine', () => {
      const { agent, mergedIntoEmptyTeamConfigs } = runs()

      expect(findingsByFileAndRule(mergedIntoEmptyTeamConfigs, files, rules)).toStrictEqual(findingsByFileAndRule(agent, files, rules))
    })

    it("reports, merged into the team's configs, the team's alone in every file, from one engine", () => {
      const { agent, teamAlone, mergedIntoTheTeamsConfigs } = runs()

      expect(findingsByFileAndRule(mergedIntoTheTeamsConfigs, files, rules)).toStrictEqual(
        owedBesideTheTeam(findingsByFileAndRule(agent, files, rules), findingsByFileAndRule(teamAlone, files, rules), corpusRulesTheTeamSets(rules)),
      )
    })
  })
})
