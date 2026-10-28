import { describe, expect, it } from 'vitest'
import { buildEngineFinding, buildFindingsOfAFile, buildRuleByItsNames } from './factories/engine-finding-factories.ts'
import { filesReportingIn, findingsByFileAndRule, messagesByFile, owedBesideTheTeam } from './findings-beside-the-team.ts'

const EQEQEQ = buildRuleByItsNames('eqeqeq', ['eqeqeq', 'eslint(eqeqeq)'])
const NO_VAR = buildRuleByItsNames('no-var', ['no-var', 'eslint(no-var)'])

describe('findingsByFileAndRule', () => {
  it("puts each finding under its rule, by any of the rule's names, from either engine", () => {
    const findings = [buildEngineFinding('eslint', 'a.ts', 'eqeqeq', { line: 4 }), buildEngineFinding('oxlint', 'a.ts', 'eslint(eqeqeq)', { line: 4 })]

    expect(findingsByFileAndRule(findings, ['a.ts'], [EQEQEQ])).toStrictEqual({ 'a.ts': { eqeqeq: ['a.ts:4 eqeqeq', 'a.ts:4 eslint(eqeqeq)'] } })
  })

  it('leaves out a finding of a rule not given, and one in a file not given, and gives a rule with no finding none', () => {
    const findings = [buildEngineFinding('oxlint', 'a.ts', 'eslint(no-debugger)'), buildEngineFinding('eslint', 'b.ts', 'eqeqeq')]

    expect(findingsByFileAndRule(findings, ['a.ts'], [EQEQEQ, NO_VAR])).toStrictEqual({ 'a.ts': { eqeqeq: [], 'no-var': [] } })
  })
})

describe('owedBesideTheTeam', () => {
  // The team's configs alone report eqeqeq in a.ts only, and ours in both files: owing the team's
  // only where the team reports it would owe ours in b.ts, where the team's setting decides too.
  it("owes the team's alone for a rule the team sets, in every file, those where our part alone reports it and the team's does not included", () => {
    const oursAlone = { ...buildFindingsOfAFile('a.ts', { eqeqeq: ['a.ts:4 eslint(eqeqeq)'] }), ...buildFindingsOfAFile('b.ts', { eqeqeq: ['b.ts:2 eslint(eqeqeq)'] }) }
    const teamAlone = { ...buildFindingsOfAFile('a.ts', { eqeqeq: ['a.ts:4 eqeqeq'] }), ...buildFindingsOfAFile('b.ts', { eqeqeq: [] }) }

    expect(owedBesideTheTeam(oursAlone, teamAlone, [EQEQEQ.rule])).toStrictEqual({ 'a.ts': { eqeqeq: ['a.ts:4 eqeqeq'] }, 'b.ts': { eqeqeq: [] } })
  })

  it("owes our part alone's for a rule the team does not set, none included, beside one it sets", () => {
    const oursAlone = buildFindingsOfAFile('a.ts', { eqeqeq: ['a.ts:4 eslint(eqeqeq)'], 'no-var': [] })
    const teamAlone = buildFindingsOfAFile('a.ts', { eqeqeq: ['a.ts:4 eqeqeq'], 'no-var': ['a.ts:6 eslint(no-var)'] })

    expect(owedBesideTheTeam(oursAlone, teamAlone, [EQEQEQ.rule])).toStrictEqual({ 'a.ts': { eqeqeq: ['a.ts:4 eqeqeq'], 'no-var': [] } })
  })

  it('refuses a file the team alone was not read in', () => {
    const oursAlone = buildFindingsOfAFile('a.ts', { eqeqeq: [] })

    expect(() => owedBesideTheTeam(oursAlone, buildFindingsOfAFile('b.ts', { eqeqeq: [] }), [])).toThrow(/the team alone was not read in a\.ts/u)
  })

  it('refuses a rule the team sets that the team alone was not read for', () => {
    const oursAlone = buildFindingsOfAFile('a.ts', { eqeqeq: [] })

    expect(() => owedBesideTheTeam(oursAlone, buildFindingsOfAFile('a.ts', { 'no-var': [] }), [EQEQEQ.rule])).toThrow(/the team alone was not read for eqeqeq/u)
  })

  // A misspelt rule would otherwise owe nothing of the team's, and pass beside a merge that ignores the team.
  it('refuses a rule the team sets that our part alone was not read for', () => {
    const oursAlone = buildFindingsOfAFile('a.ts', { eqeqeq: [] })

    expect(() => owedBesideTheTeam(oursAlone, buildFindingsOfAFile('a.ts', { eqeqeq: [] }), ['eqeqqe'])).toThrow(
      new Error('our part alone was not read for eqeqqe, which the team sets'),
    )
  })
})

describe('messagesByFile', () => {
  it("gives each file the messages of the rule's findings under any of its names, and none of another rule's", () => {
    const findings = [
      buildEngineFinding('oxlint', 'a.ts', 'eslint(eqeqeq)', { message: 'expected ===' }),
      buildEngineFinding('eslint', 'a.ts', 'eqeqeq', { message: "Expected '===' and instead saw '=='." }),
      buildEngineFinding('eslint', 'a.ts', 'no-var', { message: 'Unexpected var.' }),
    ]

    expect(messagesByFile(findings, ['a.ts', 'b.ts'], EQEQEQ.names)).toStrictEqual({
      'a.ts': ["Expected '===' and instead saw '=='.", 'expected ==='],
      'b.ts': [],
    })
  })
})

describe('filesReportingIn', () => {
  it("gives the files given, in their order, that hold a finding of the rule under any of its names from the engine given", () => {
    const findings = [
      buildEngineFinding('oxlint', 'b.js', 'eslint(eqeqeq)'),
      buildEngineFinding('oxlint', 'a.ts', 'eslint(eqeqeq)'),
      buildEngineFinding('eslint', 'c.ts', 'eqeqeq'),
      buildEngineFinding('oxlint', 'd.ts', 'eslint(no-var)'),
      buildEngineFinding('oxlint', 'e.ts', 'eslint(eqeqeq)'),
    ]

    expect(filesReportingIn(findings, ['a.ts', 'b.js', 'c.ts', 'd.ts'], EQEQEQ, 'oxlint')).toStrictEqual(['a.ts', 'b.js'])
  })
})
