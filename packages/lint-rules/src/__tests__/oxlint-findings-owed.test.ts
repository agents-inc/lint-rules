import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import type { EditorParts } from '../core/editor-parts.ts'
import { defineLintRules } from '../index.ts'
import { buildConsumerLintRules } from './factories/lint-rules-factories.ts'
import { buildOxlintFinding } from './factories/oxlint-finding-factories.ts'
import { createProjectListingOxlint } from './factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './factories/team-config-factories.ts'
import { ownerOfOxlintFindings, oxlintFindingsOwed, type TeamConfigsRead } from './oxlint-findings-owed.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'

const PROJECT_MADE: RunsBeforeTheSuiteOptions = { timeoutMs: 10_000, whatFailed: 'the project listing oxlint could not be made before the suite' }

const projectWithOxlint = setUpRunsBeforeTheSuite(createProjectListingOxlint, PROJECT_MADE)

const NO_STRING_REFS = 'react(no-string-refs)'
const NO_UNUSED_VARS = 'eslint(no-unused-vars)'
// typescript-eslint's no-this-alias, which ESLint runs for us; oxlint's version is in its correctness category.
const NO_THIS_ALIAS = 'typescript(no-this-alias)'
// A rule of oxlint's correctness category, of a default plugin, that neither part of ours runs.
const NO_DUPLICATE_ENUM_VALUES = 'typescript(no-duplicate-enum-values)'

// Our part runs react/no-string-refs but in lib/** and our ignores, runs no-unused-vars, and turns
// no-debugger off.
function ourParts(): EditorParts {
  return defineLintRules(
    buildConsumerLintRules(
      projectWithOxlint(),
      {},
      {
        rules: { 'react/no-string-refs': 'error', 'no-unused-vars': 'error', 'no-debugger': 'off' },
        fileOverrides: [{ files: ['lib/**'], rules: { 'react/no-string-refs': 'off' } }],
        ignores: ['dist/**'],
      },
    ),
  ).editorRulesets
}

function teamConfigs(oxlint: Readonly<TeamConfigsRead['oxlint']>, eslintRuleKeys: readonly string[] = []): TeamConfigsRead {
  return { oxlint, eslintRuleKeys }
}

// Our ESLint part runs no-this-alias, kept out of dist/**; our oxlint part runs nothing.
function ourPartsRunningNoThisAliasInEslint(): EditorParts {
  return defineLintRules(
    buildConsumerLintRules(projectWithOxlint(), {}, { rules: { '@typescript-eslint/no-this-alias': 'error' }, ignores: ['dist/**'] }),
  ).editorRulesets
}

// Our ESLint part runs typescript-eslint's no-unused-vars, the twin of the core rule oxlint's no-unused-vars is; our oxlint part runs nothing.
function ourPartsRunningTheTypescriptEslintTwinInEslint(): EditorParts {
  return defineLintRules(buildConsumerLintRules(projectWithOxlint(), {}, { rules: { '@typescript-eslint/no-unused-vars': 'error' } })).editorRulesets
}

const TEAM_SETTING_NONE = teamConfigs(buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'off' } }))
const TEAM_SETTING_NO_STRING_REFS_IN_TEST_FILES = teamConfigs(
  buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'off' }, overrides: [{ files: ['**/*.test.tsx'], rules: { 'react/no-string-refs': 'warn' } }] }),
)

describe('ownerOfOxlintFindings, for a rule the team sets', () => {
  it.each([
    { file: 'src/f.test.tsx', why: 'in the files its override sets it in' },
    { file: 'src/f.tsx', why: 'in a file its override does not reach, where our part runs it' },
    { file: 'lib/m.tsx', why: 'where our entry turns it off' },
  ])("gives no-string-refs the team's findings $why", ({ file }) => {
    expect(ownerOfOxlintFindings(ourParts(), TEAM_SETTING_NO_STRING_REFS_IN_TEST_FILES, catalog)(file, NO_STRING_REFS)).toBe('the team')
  })

  it.each([
    { how: 'in its ESLint config alone', team: teamConfigs(TEAM_SETTING_NONE.oxlint, ['react/no-string-refs']) },
    { how: 'by a category its oxlint config turns on, its plugin listed', team: teamConfigs(buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'warn' } })) },
  ])("gives no-string-refs the team's findings where our part runs it, the team setting it $how", ({ team }) => {
    expect(ownerOfOxlintFindings(ourParts(), team, catalog)('src/f.tsx', NO_STRING_REFS)).toBe('the team')
  })

  it("gives no-unused-vars the team's findings where its ESLint config sets typescript-eslint's twin of it alone", () => {
    expect(ownerOfOxlintFindings(ourParts(), teamConfigs(TEAM_SETTING_NONE.oxlint, ['@typescript-eslint/no-unused-vars']), catalog)('src/a.ts', NO_UNUSED_VARS)).toBe('the team')
  })
})

describe('ownerOfOxlintFindings, for a rule the team sets nowhere', () => {
  it.each([
    { file: 'src/f.tsx', code: NO_STRING_REFS, owner: 'ours', why: 'our part runs it there' },
    { file: 'src/a.ts', code: NO_UNUSED_VARS, owner: 'ours', why: 'our part runs it there' },
    { file: 'lib/m.tsx', code: NO_STRING_REFS, owner: 'the team', why: 'our entry turns it off there' },
    { file: 'dist/x.tsx', code: NO_STRING_REFS, owner: 'the team', why: 'our ignores match the file' },
    { file: 'src/a.ts', code: 'eslint(no-debugger)', owner: 'the team', why: 'our part turns it off only' },
    { file: 'src/a.ts', code: 'local(no-direct-fetch)', owner: 'the team', why: "it is a JS plugin's" },
  ])('gives $code in $file to $owner: $why', ({ file, code, owner }) => {
    expect(ownerOfOxlintFindings(ourParts(), TEAM_SETTING_NONE, catalog)(file, code)).toBe(owner)
  })

  // Only what the team writes counts: oxlint's own correctness: warn runs no-string-refs here, but sets no rule.
  it.each([
    { file: 'src/f.tsx', owner: 'ours', why: 'our part runs it there' },
    { file: 'lib/m.tsx', owner: 'the team', why: "our entry turns it off there, which leaves oxlint's own copy, as the team's config alone runs it" },
  ])("gives no-string-refs in $file to $owner where the team lists react and writes no category: $why", ({ file, owner }) => {
    expect(ownerOfOxlintFindings(ourParts(), teamConfigs(buildTeamOxlintConfig({ plugins: ['react'] })), catalog)(file, NO_STRING_REFS)).toBe(owner)
  })

  it('gives no-string-refs our findings where the team turns on a category no-string-refs is not in', () => {
    const team = teamConfigs(buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'off', style: 'warn' } }))

    expect(ownerOfOxlintFindings(ourParts(), team, catalog)('src/f.tsx', NO_STRING_REFS)).toBe('ours')
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

  it.each([
    { team: teamConfigs(buildTeamOxlintConfig()), owner: 'nobody', where: 'writes no category' },
    { team: teamConfigs(buildTeamOxlintConfig({ categories: { correctness: 'warn' } })), owner: 'the team', where: 'writes correctness on' },
  ])("gives oxlint's no-unused-vars to $owner where our ESLint part runs typescript-eslint's twin of it alone and the team $where", ({ team, owner }) => {
    expect(ownerOfOxlintFindings(ourPartsRunningTheTypescriptEslintTwinInEslint(), team, catalog)('src/a.ts', NO_UNUSED_VARS)).toBe(owner)
  })

  it("gives a rule neither part of ours runs to the team where it writes no category, as oxlint's own copy runs it", () => {
    expect(ownerOfOxlintFindings(ourPartsRunningNoThisAliasInEslint(), teamConfigs(buildTeamOxlintConfig()), catalog)('src/a.ts', NO_DUPLICATE_ENUM_VALUES)).toBe('the team')
  })
})

describe('oxlintFindingsOwed', () => {
  it("keeps the team's findings of a rule it sets, in every file, and ours of a rule it does not", () => {
    const teamsInATestFile = buildOxlintFinding('src/f.test.tsx', NO_STRING_REFS, 'warning')
    const oursOfARuleTheTeamDoesNotSet = buildOxlintFinding('src/a.ts', NO_UNUSED_VARS, 'error')
    const teamAlone = [teamsInATestFile, buildOxlintFinding('src/a.ts', NO_UNUSED_VARS, 'warning')]
    const oursAlone = [buildOxlintFinding('src/f.tsx', NO_STRING_REFS, 'error'), oursOfARuleTheTeamDoesNotSet]

    expect(oxlintFindingsOwed({ teamAlone, oursAlone }, ownerOfOxlintFindings(ourParts(), TEAM_SETTING_NO_STRING_REFS_IN_TEST_FILES, catalog))).toStrictEqual([
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
