import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { ABSENT, calculatedEntryOf, namesInPlay, namesOnBeyondTheTeams, owedEntry, rulesInPlayOf } from './eslint-entries-owed.ts'
import { buildRuleInPlay, buildRulesInPlay, buildSidesOfAFile } from './factories/eslint-merge-factories.ts'

// The oracle the ESLint differential compares the merge with: a wrong owner here would hide ours running beside
// the team's, one rule decided twice, or ours lost.

const RULE = 'import-x/first'
const ALIAS = 'import/first'
const CORE_RULE = 'no-unused-vars'
const TWIN = '@typescript-eslint/no-unused-vars'
const OURS_ON: readonly unknown[] = [2]
const OURS_OFF: readonly unknown[] = [0]
const OURS_OFF_WITH_OUR_OPTIONS: readonly unknown[] = [0, 'absolute-first']
const TEAMS_ENTRY: readonly unknown[] = [1, 'disable-absolute-first']
const TEAMS_OFF: readonly unknown[] = [0]
const TEAMS_TWIN: readonly unknown[] = [2, { args: 'none' }]

const RULES = [buildRuleInPlay(RULE, { names: [ALIAS, RULE] })]
const TWINS = [buildRuleInPlay(CORE_RULE, { twins: [TWIN] }), buildRuleInPlay(TWIN, { twins: [CORE_RULE] })]
const SET_BY_THE_TEAM = buildRulesInPlay(RULES, { setByTheTeam: true })
const SET_NOWHERE_BY_THE_TEAM = buildRulesInPlay(RULES)

describe('owedEntry, for a rule the team sets anywhere', () => {
  it("owes every name of it the team's config alone in the file, at off included, though ours runs it there", () => {
    const sides = buildSidesOfAFile({ team: { [ALIAS]: TEAMS_OFF }, ours: { [RULE]: OURS_ON } })

    expect({ rule: owedEntry(RULE, sides, SET_BY_THE_TEAM), alias: owedEntry(ALIAS, sides, SET_BY_THE_TEAM) }).toStrictEqual({ rule: ABSENT, alias: TEAMS_OFF })
  })

  // The team sets it in other files only: its config alone states it nowhere here.
  it("owes every name of it the team's config alone in a file the team's setting does not reach, so none where ours runs it", () => {
    const sides = buildSidesOfAFile({ ours: { [RULE]: OURS_ON } })

    expect({ rule: owedEntry(RULE, sides, SET_BY_THE_TEAM), alias: owedEntry(ALIAS, sides, SET_BY_THE_TEAM) }).toStrictEqual({ rule: ABSENT, alias: ABSENT })
  })

  it("owes each twin the team's config alone, where the team sets the other twin, though ours runs it", () => {
    const sides = buildSidesOfAFile({ team: { [TWIN]: TEAMS_TWIN }, ours: { [CORE_RULE]: OURS_ON } })
    const inPlay = buildRulesInPlay(TWINS, { setByTheTeam: true })

    expect({ core: owedEntry(CORE_RULE, sides, inPlay), twin: owedEntry(TWIN, sides, inPlay) }).toStrictEqual({ core: ABSENT, twin: TEAMS_TWIN })
  })
})

describe('owedEntry, for a rule the team sets nowhere', () => {
  it('owes every name of it ours, its off and options included', () => {
    const sides = buildSidesOfAFile({ ours: { [RULE]: OURS_OFF_WITH_OUR_OPTIONS } })

    expect({ rule: owedEntry(RULE, sides, SET_NOWHERE_BY_THE_TEAM), alias: owedEntry(ALIAS, sides, SET_NOWHERE_BY_THE_TEAM) }).toStrictEqual({
      rule: OURS_OFF_WITH_OUR_OPTIONS,
      alias: ABSENT,
    })
  })

  it('owes each twin ours, where ours runs one twin and turns the other off', () => {
    const sides = buildSidesOfAFile({ ours: { [TWIN]: OURS_ON, [CORE_RULE]: OURS_OFF } })
    const inPlay = buildRulesInPlay(TWINS)

    expect({ core: owedEntry(CORE_RULE, sides, inPlay), twin: owedEntry(TWIN, sides, inPlay) }).toStrictEqual({ core: OURS_OFF, twin: OURS_ON })
  })
})

describe('owedEntry, given a name of no rule in play', () => {
  it('throws, naming it', () => {
    expect(() => owedEntry('eqeqeq', buildSidesOfAFile(), SET_BY_THE_TEAM)).toThrow('eqeqeq')
  })
})

describe('namesOnBeyondTheTeams', () => {
  it("names each name on in the merged file that the team's config alone has absent or off there, and none it runs too", () => {
    const merged = { [RULE]: OURS_ON, [ALIAS]: TEAMS_ENTRY, [CORE_RULE]: OURS_ON }
    const teamAlone = { [ALIAS]: TEAMS_ENTRY, [CORE_RULE]: TEAMS_OFF }

    expect(namesOnBeyondTheTeams(merged, teamAlone, buildRulesInPlay([...RULES, ...TWINS]))).toStrictEqual([RULE, CORE_RULE])
  })
})

describe('calculatedEntryOf', () => {
  it('gives the entry, ABSENT where no block sets the rule, and throws on an entry ESLint never calculates', () => {
    expect({ given: calculatedEntryOf({ [RULE]: OURS_ON }, RULE), absent: calculatedEntryOf({}, RULE) }).toStrictEqual({ given: OURS_ON, absent: ABSENT })
    expect(() => calculatedEntryOf({ [RULE]: 'error' }, RULE)).toThrow('"error"')
  })
})

describe('namesInPlay', () => {
  it('names every name of every rule in play, once each and sorted', () => {
    expect(namesInPlay(buildRulesInPlay([...RULES, ...TWINS]))).toStrictEqual([TWIN, RULE, ALIAS, CORE_RULE])
  })
})

describe('rulesInPlayOf, read from the catalog and the installed plugins', () => {
  it("puts our rule and each of typescript-eslint's twins of it in play, each under every name, the team's prefix for our plugin included, set by the team where it states one of them", () => {
    const teamsPrefixes = new Map([['@typescript-eslint', ['ts']]])

    expect(rulesInPlayOf('prefer-promise-reject-errors', teamsPrefixes, new Set(['ts/prefer-promise-reject-errors', 'eqeqeq']), catalog)).toStrictEqual({
      rules: [
        { rule: 'prefer-promise-reject-errors', names: ['prefer-promise-reject-errors'], twins: ['@typescript-eslint/prefer-promise-reject-errors'] },
        {
          rule: '@typescript-eslint/prefer-promise-reject-errors',
          names: ['@typescript-eslint/prefer-promise-reject-errors', 'ts/prefer-promise-reject-errors'],
          twins: ['prefer-promise-reject-errors'],
        },
      ],
      setByTheTeam: true,
    })
  })

  it('sets none of them by the team where it states a key of another rule only', () => {
    expect(rulesInPlayOf('prefer-promise-reject-errors', new Map(), new Set(['eqeqeq', 'prefer-promise-reject-error']), catalog).setByTheTeam).toBe(false)
  })

  it("puts a rule in play under its alias, its old name and the other name its plugin binds it to", () => {
    const noPrefixes = new Map<string, readonly string[]>()

    expect(
      ['import-x/first', 'unicorn/no-for-each', '@eslint-react/x-no-missing-key'].map((ruleId) => rulesInPlayOf(ruleId, noPrefixes, new Set(), catalog).rules),
    ).toStrictEqual([
      [{ rule: 'import-x/first', names: ['import-x/first', 'import/first'], twins: [] }],
      [{ rule: 'unicorn/no-for-each', names: ['unicorn/no-array-for-each', 'unicorn/no-for-each'], twins: [] }],
      [{ rule: '@eslint-react/x-no-missing-key', names: ['@eslint-react/no-missing-key', '@eslint-react/x-no-missing-key'], twins: [] }],
    ])
  })
})
