import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import type { EditorParts } from '../core/editor-parts.ts'
import { defineLintRules } from '../index.ts'
import { buildConsumerLintRules } from './factories/lint-rules-factories.ts'
import { buildOxlintFinding } from './factories/oxlint-finding-factories.ts'
import { createProjectListingOxlint } from './factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './factories/team-config-factories.ts'
import { ownerOfOxlintFindings, oxlintFindingsOwed, type TeamConfigsRead } from './oxlint-findings-owed.ts'
import { setUpTempProjects } from './temp-projects.ts'

const PROJECT_WITH_OXLINT = createProjectListingOxlint(setUpTempProjects())

const JSX_KEY = 'react(jsx-key)'
const NO_UNUSED_VARS = 'eslint(no-unused-vars)'
// typescript-eslint's no-this-alias, which ESLint runs for us; oxlint's version is in its correctness category.
const NO_THIS_ALIAS = 'typescript(no-this-alias)'
// A rule of oxlint's correctness category, of a default plugin, that neither part of ours runs.
const NO_DUPLICATE_ENUM_VALUES = 'typescript(no-duplicate-enum-values)'

// Our part runs react/jsx-key but in lib/** and our ignores, runs no-unused-vars, and turns
// no-debugger off.
function ourParts(): EditorParts {
  return defineLintRules(
    buildConsumerLintRules(
      PROJECT_WITH_OXLINT,
      {},
      {
        rules: { 'react/jsx-key': 'error', 'no-unused-vars': 'error', 'no-debugger': 'off' },
        fileOverrides: [{ files: ['lib/**'], rules: { 'react/jsx-key': 'off' } }],
        ignores: ['dist/**'],
      },
    ),
  ).editorRulesets
}

function teamConfigs(oxlint: TeamConfigsRead['oxlint'], eslintRuleKeys: readonly string[] = []): TeamConfigsRead {
  return { oxlint, eslintRuleKeys }
}

// Our ESLint part runs no-this-alias, kept out of dist/**; our oxlint part runs nothing.
function ourPartsRunningNoThisAliasInEslint(): EditorParts {
  return defineLintRules(
    buildConsumerLintRules(PROJECT_WITH_OXLINT, {}, { rules: { '@typescript-eslint/no-this-alias': 'error' }, ignores: ['dist/**'] }),
  ).editorRulesets
}

const TEAM_SETTING_NONE = teamConfigs(buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'off' } }))
const TEAM_SETTING_JSX_KEY_IN_TEST_FILES = teamConfigs(
  buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'off' }, overrides: [{ files: ['**/*.test.tsx'], rules: { 'react/jsx-key': 'warn' } }] }),
)

describe('ownerOfOxlintFindings, for a rule the team sets', () => {
  it.each([
    { file: 'src/f.test.tsx', why: 'in the files its override sets it in' },
    { file: 'src/f.tsx', why: 'in a file its override does not reach, where our part runs it' },
    { file: 'lib/m.tsx', why: 'where our entry turns it off' },
  ])("gives jsx-key the team's findings $why", ({ file }) => {
    expect(ownerOfOxlintFindings(ourParts(), TEAM_SETTING_JSX_KEY_IN_TEST_FILES, catalog)(file, JSX_KEY)).toBe('the team')
  })

  it.each([
    { how: 'in its ESLint config alone', team: teamConfigs(TEAM_SETTING_NONE.oxlint, ['react/jsx-key']) },
    { how: 'by a category its oxlint config turns on, its plugin listed', team: teamConfigs(buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'warn' } })) },
  ])("gives jsx-key the team's findings where our part runs it, the team setting it $how", ({ team }) => {
    expect(ownerOfOxlintFindings(ourParts(), team, catalog)('src/f.tsx', JSX_KEY)).toBe('the team')
  })

  it("gives no-unused-vars the team's findings where its ESLint config sets typescript-eslint's twin of it alone", () => {
    expect(ownerOfOxlintFindings(ourParts(), teamConfigs(TEAM_SETTING_NONE.oxlint, ['@typescript-eslint/no-unused-vars']), catalog)('src/a.ts', NO_UNUSED_VARS)).toBe('the team')
  })
})

describe('ownerOfOxlintFindings, for a rule the team sets nowhere', () => {
  it.each([
    { file: 'src/f.tsx', code: JSX_KEY, owner: 'ours', why: 'our part runs it there' },
    { file: 'src/a.ts', code: NO_UNUSED_VARS, owner: 'ours', why: 'our part runs it there' },
    { file: 'lib/m.tsx', code: JSX_KEY, owner: 'the team', why: 'our entry turns it off there' },
    { file: 'dist/x.tsx', code: JSX_KEY, owner: 'the team', why: 'our ignores match the file' },
    { file: 'src/a.ts', code: 'eslint(no-debugger)', owner: 'the team', why: 'our part turns it off only' },
    { file: 'src/a.ts', code: 'local(no-direct-fetch)', owner: 'the team', why: "it is a JS plugin's" },
  ])('gives $code in $file to $owner: $why', ({ file, code, owner }) => {
    expect(ownerOfOxlintFindings(ourParts(), TEAM_SETTING_NONE, catalog)(file, code)).toBe(owner)
  })

  // Only what the team writes counts: oxlint's own correctness: warn runs jsx-key here, but sets no rule.
  it.each([
    { file: 'src/f.tsx', owner: 'ours', why: 'our part runs it there' },
    { file: 'lib/m.tsx', owner: 'the team', why: "our entry turns it off there, which leaves oxlint's own copy, as the team's config alone runs it" },
  ])("gives jsx-key in $file to $owner where the team lists react and writes no category: $why", ({ file, owner }) => {
    expect(ownerOfOxlintFindings(ourParts(), teamConfigs(buildTeamOxlintConfig({ plugins: ['react'] })), catalog)(file, JSX_KEY)).toBe(owner)
  })

  it('gives jsx-key our findings where the team turns on a category jsx-key is not in', () => {
    const team = teamConfigs(buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'off', style: 'warn' } }))

    expect(ownerOfOxlintFindings(ourParts(), team, catalog)('src/f.tsx', JSX_KEY)).toBe('ours')
  })
})

// The merge switches off oxlint's silent correctness: warn copy of a rule our ESLint part runs, so ESLint alone reports it.
describe('ownerOfOxlintFindings, for a rule our ESLint part runs', () => {
  it.each([
    { file: 'src/a.ts', why: 'a file our ESLint part runs it in' },
    { file: 'dist/x.ts', why: 'a file our ignores keep our part out of' },
  ])("gives oxlint's no-this-alias to nobody in $file, where the team writes no category: $why", ({ file }) => {
    expect(ownerOfOxlintFindings(ourPartsRunningNoThisAliasInEslint(), teamConfigs(buildTeamOxlintConfig()), catalog)(file, NO_THIS_ALIAS)).toBe('nobody')
  })

  it.each([
    { how: 'writes correctness on in its oxlint config', team: teamConfigs(buildTeamOxlintConfig({ categories: { correctness: 'warn' } })) },
    { how: 'sets it in its ESLint config', team: teamConfigs(buildTeamOxlintConfig(), ['@typescript-eslint/no-this-alias']) },
  ])("gives oxlint's no-this-alias to the team where the team $how", ({ team }) => {
    expect(ownerOfOxlintFindings(ourPartsRunningNoThisAliasInEslint(), team, catalog)('src/a.ts', NO_THIS_ALIAS)).toBe('the team')
  })

  it("gives a rule neither part of ours runs to the team where it writes no category, as oxlint's own copy runs it", () => {
    expect(ownerOfOxlintFindings(ourPartsRunningNoThisAliasInEslint(), teamConfigs(buildTeamOxlintConfig()), catalog)('src/a.ts', NO_DUPLICATE_ENUM_VALUES)).toBe('the team')
  })
})

describe('oxlintFindingsOwed', () => {
  it("keeps the team's findings of a rule it sets, in every file, and ours of a rule it does not", () => {
    const teamsInATestFile = buildOxlintFinding('src/f.test.tsx', JSX_KEY, 'warning')
    const oursOfARuleTheTeamDoesNotSet = buildOxlintFinding('src/a.ts', NO_UNUSED_VARS, 'error')
    const teamAlone = [teamsInATestFile, buildOxlintFinding('src/a.ts', NO_UNUSED_VARS, 'warning')]
    const oursAlone = [buildOxlintFinding('src/f.tsx', JSX_KEY, 'error'), oursOfARuleTheTeamDoesNotSet]

    expect(oxlintFindingsOwed({ teamAlone, oursAlone }, ownerOfOxlintFindings(ourParts(), TEAM_SETTING_JSX_KEY_IN_TEST_FILES, catalog))).toStrictEqual([
      teamsInATestFile,
      oursOfARuleTheTeamDoesNotSet,
    ])
  })

  it("keeps no finding of a rule that is nobody's, and the team's of a rule neither part of ours runs", () => {
    const teamsOfARuleNeitherPartRuns = buildOxlintFinding('src/a.ts', NO_DUPLICATE_ENUM_VALUES, 'warning')
    const teamAlone = [buildOxlintFinding('src/a.ts', NO_THIS_ALIAS, 'warning'), teamsOfARuleNeitherPartRuns]

    expect(
      oxlintFindingsOwed({ teamAlone, oursAlone: [] }, ownerOfOxlintFindings(ourPartsRunningNoThisAliasInEslint(), teamConfigs(buildTeamOxlintConfig()), catalog)),
    ).toStrictEqual([teamsOfARuleNeitherPartRuns])
  })
})
