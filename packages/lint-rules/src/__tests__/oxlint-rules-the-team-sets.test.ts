import { catalog } from '@workspace/rule-data'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { buildTeamOxlintrcExtending } from './factories/shape-factories.ts'
import { buildTeamOxlintConfig } from './factories/team-config-factories.ts'
import { ruleIdsTheTeamsOxlintConfigSets } from './oxlint-rules-the-team-sets.ts'

// Which of a team oxlint config's statements and categories oxlint counts was measured with oxlint
// 1.87 in merge-oxlint-config.integration.test.ts and the differential tests; this spec pins the
// model the oracles read them through. Each refusal sits beside the case it is told from.

const JSX_KEY = 'react/jsx-key'
const NO_DEBUGGER = 'no-debugger'
const CONSISTENT_TYPE_IMPORTS = '@typescript-eslint/consistent-type-imports'
const ARRAY_TYPE = '@typescript-eslint/array-type'
const PREFER_INCLUDES = 'unicorn/prefer-includes'
const FLOATING_PROMISES = '@typescript-eslint/no-floating-promises'
// A nursery rule of oxlint's import plugin.
const NURSERY_RULE = 'import-x/named'
// A rule of ours oxlint has no version of, which a team may run in oxlint through the plugin's JS version.
const SONARJS_RULE = 'sonarjs/anchor-precedence'
const PATH_BASE = './base.json'

/** Of the rules given, those the team's config sets. */
function setAmong(team: OxlintConfig, ruleIds: readonly string[]): string[] {
  const set = new Set(ruleIdsTheTeamsOxlintConfigSets(team, catalog))
  return ruleIds.filter((id) => set.has(id))
}

describe('ruleIdsTheTeamsOxlintConfigSets, given statements at a root', () => {
  it('sets a rule the root states, of a plugin the root lists, under any key oxlint reads as it, off included', () => {
    const team = buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'off' }, rules: { 'react-hooks/jsx-key': 'off' } })

    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual([JSX_KEY])
  })

  it('sets no rule the root states of a plugin the root does not list, which oxlint ignores, and a core rule, which always runs', () => {
    const team = buildTeamOxlintConfig({ plugins: ['oxc'], categories: { correctness: 'off' }, rules: { 'react/jsx-key': 'warn', 'no-debugger': 'off' } })

    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual([NO_DEBUGGER])
  })

  it.each([
    {
      how: 'leaves plugins out everywhere',
      team: buildTeamOxlintConfig({ categories: { correctness: 'off' }, rules: { 'typescript/consistent-type-imports': 'warn' } }),
      ruleIds: [CONSISTENT_TYPE_IMPORTS],
    },
    {
      how: 'lists [oxc] and extends a config leaving plugins out, which adds the defaults',
      team: buildTeamOxlintConfig({ plugins: ['oxc'], categories: { correctness: 'off' }, extends: [{}], rules: { 'typescript/consistent-type-imports': 'warn' } }),
      ruleIds: [CONSISTENT_TYPE_IMPORTS],
    },
    {
      how: 'lists [oxc] and extends a config listing []',
      team: buildTeamOxlintConfig({
        plugins: ['oxc'],
        categories: { correctness: 'off' },
        extends: [{ plugins: [] }],
        rules: { 'typescript/consistent-type-imports': 'warn' },
      }),
      ruleIds: [],
    },
  ])("reads oxlint's default plugins where the root $how", ({ team, ruleIds }) => {
    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual(ruleIds)
  })

  it('sets a rule the root of a config it extends states, of a plugin the merged root lists', () => {
    const team = buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'off' }, extends: [{ plugins: [], rules: { 'react/jsx-key': 'warn' } }] })

    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual([JSX_KEY])
  })

  it("sets no rule by a key under a JS plugin's prefix that names no rule of ours, though oxlint has one so named", () => {
    const team = buildTeamOxlintConfig({ categories: { correctness: 'off' }, jsPlugins: ['./lint/local-plugin.js'], rules: { 'local/jsx-no-duplicate-props': 'error' } })

    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual([])
  })
})

describe('ruleIdsTheTeamsOxlintConfigSets, given statements in overrides', () => {
  // The override reaches lib/** alone: a model reading the files it applies to would set nothing
  // elsewhere, where the team's setting decides too.
  it('sets a rule an override states, of a plugin the root lists, whatever files the override applies to', () => {
    const team = buildTeamOxlintConfig({ plugins: ['react'], categories: { correctness: 'off' }, overrides: [{ files: ['lib/**'], rules: { 'react/jsx-key': 'off' } }] })

    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual([JSX_KEY])
  })

  it('sets a rule an override states of a plugin that override lists', () => {
    const team = buildTeamOxlintConfig({ plugins: [], categories: { correctness: 'off' }, overrides: [{ files: ['**/*.tsx'], plugins: ['react'], rules: { 'react/jsx-key': 'warn' } }] })

    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual([JSX_KEY])
  })

  it('sets no rule an override states of a plugin only another override lists, which oxlint ignores', () => {
    const team = buildTeamOxlintConfig({
      plugins: [],
      categories: { correctness: 'off' },
      overrides: [
        { files: ['**/*.tsx'], plugins: ['react'] },
        { files: ['**/*.tsx'], rules: { 'react/jsx-key': 'warn' } },
      ],
    })

    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual([])
  })

  it('sets a rule an override of a config it extends states', () => {
    const team = buildTeamOxlintConfig({
      plugins: ['react'],
      categories: { correctness: 'off' },
      extends: [{ plugins: [], overrides: [{ files: ['lib/**'], rules: { 'react/jsx-key': 'off' } }] }],
    })

    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual([JSX_KEY])
  })
})

describe('ruleIdsTheTeamsOxlintConfigSets, given categories', () => {
  it('sets the rules a category on runs of a plugin the root lists, and none of a plugin listed nowhere', () => {
    expect({
      typescript: setAmong(buildTeamOxlintConfig({ plugins: ['typescript'], categories: { correctness: 'off', style: 'warn' } }), [ARRAY_TYPE, PREFER_INCLUDES]),
      unicorn: setAmong(buildTeamOxlintConfig({ plugins: ['unicorn'], categories: { correctness: 'off', style: 'warn' } }), [ARRAY_TYPE, PREFER_INCLUDES]),
    }).toStrictEqual({ typescript: [ARRAY_TYPE], unicorn: [PREFER_INCLUDES] })
  })

  // typescript is listed for one folder alone: the category runs its rules there only, and they are the team's everywhere.
  it('sets the rules a category on runs of a plugin one override lists, beside a root listing none', () => {
    const team = buildTeamOxlintConfig({ plugins: [], categories: { correctness: 'off', style: 'warn' }, overrides: [{ files: ['legacy/**'], plugins: ['typescript'] }] })

    expect(setAmong(team, [ARRAY_TYPE, PREFER_INCLUDES])).toStrictEqual([ARRAY_TYPE])
  })

  it('sets no rule of a category the config turns off, nor one a category on leaves out', () => {
    const team = buildTeamOxlintConfig({ plugins: ['typescript', 'unicorn'], categories: { correctness: 'off', style: 'off', pedantic: 'warn' } })

    expect(setAmong(team, [ARRAY_TYPE, PREFER_INCLUDES, NO_DEBUGGER])).toStrictEqual([])
  })

  // Measured, oxlint 1.87: `nursery: 'warn'` beside plugins [import] reports import/named, no-undef
  // and no-unreachable-loop, all nursery rules.
  it('sets the nursery rules the nursery category on runs, and none where it is off', () => {
    expect({
      on: setAmong(buildTeamOxlintConfig({ plugins: ['import'], categories: { correctness: 'off', nursery: 'error' } }), [NURSERY_RULE]),
      off: setAmong(buildTeamOxlintConfig({ plugins: ['import'], categories: { correctness: 'off', nursery: 'off' } }), [NURSERY_RULE]),
    }).toStrictEqual({ on: [NURSERY_RULE], off: [] })
  })

  it('sets a type-aware rule its category runs only where the options turn type-aware rules on', () => {
    expect({
      left: setAmong(buildTeamOxlintConfig({ plugins: ['typescript'], categories: { correctness: 'error' } }), [FLOATING_PROMISES, NO_DEBUGGER]),
      on: setAmong(buildTeamOxlintConfig({ plugins: ['typescript'], categories: { correctness: 'error' }, options: { typeAware: true } }), [FLOATING_PROMISES, NO_DEBUGGER]),
    }).toStrictEqual({ left: [NO_DEBUGGER], on: [FLOATING_PROMISES, NO_DEBUGGER] })
  })

  // Only what the team writes counts (decisions.md, "Owner 2026-10-14 (questions on the merge rework
  // spec", point 1): oxlint's own correctness: warn, which runs where every config leaves correctness
  // out, sets no rule; correctness written on, by the config or one it extends, sets its rules.
  it("sets no rule oxlint's own correctness category runs where the configs leave correctness out, and its rules where a config writes it on", () => {
    expect({
      leftOut: setAmong(buildTeamOxlintConfig({}), [NO_DEBUGGER]),
      otherCategoryWritten: setAmong(buildTeamOxlintConfig({ plugins: ['typescript'], categories: { style: 'warn' } }), [NO_DEBUGGER, ARRAY_TYPE]),
      writtenOn: setAmong(buildTeamOxlintConfig({ categories: { correctness: 'warn' } }), [NO_DEBUGGER]),
      writtenOnInAConfigItExtends: setAmong(buildTeamOxlintConfig({ extends: [{ categories: { correctness: 'error' } }] }), [NO_DEBUGGER]),
      writtenOff: setAmong(buildTeamOxlintConfig({ categories: { correctness: 'off' } }), [NO_DEBUGGER]),
    }).toStrictEqual({ leftOut: [], otherCategoryWritten: [ARRAY_TYPE], writtenOn: [NO_DEBUGGER], writtenOnInAConfigItExtends: [NO_DEBUGGER], writtenOff: [] })
  })

  it("reads a config's categories over those of a config it extends", () => {
    expect({
      ownOff: setAmong(buildTeamOxlintConfig({ plugins: ['typescript'], categories: { correctness: 'off', style: 'off' }, extends: [{ categories: { style: 'warn' } }] }), [ARRAY_TYPE]),
      extendedOn: setAmong(buildTeamOxlintConfig({ plugins: ['typescript'], categories: { correctness: 'off' }, extends: [{ categories: { style: 'warn' } }] }), [ARRAY_TYPE]),
    }).toStrictEqual({ ownOff: [], extendedOn: [ARRAY_TYPE] })
  })
})

describe('ruleIdsTheTeamsOxlintConfigSets, given a JS plugin', () => {
  it("sets a rule of ours a key names under the prefix the JS plugin is given, and none under a path's plugin, which names itself", () => {
    expect({
      named: ruleIdsTheTeamsOxlintConfigSets(
        buildTeamOxlintConfig({ categories: { correctness: 'off' }, jsPlugins: [{ name: 'sonarjs', specifier: 'eslint-plugin-sonarjs' }], rules: { [SONARJS_RULE]: 'error' } }),
        catalog,
      ),
      byPath: ruleIdsTheTeamsOxlintConfigSets(buildTeamOxlintConfig({ categories: { correctness: 'off' }, jsPlugins: ['./sonarjs.js'], rules: { [SONARJS_RULE]: 'error' } }), catalog),
    }).toStrictEqual({ named: [SONARJS_RULE], byPath: [] })
  })

  it("sets a rule of ours a key names under its package's prefix, in an override", () => {
    const team = buildTeamOxlintConfig({ categories: { correctness: 'off' }, jsPlugins: ['eslint-plugin-sonarjs'], overrides: [{ files: ['src/**'], rules: { [SONARJS_RULE]: 'off' } }] })

    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toStrictEqual([SONARJS_RULE])
  })
})

describe('ruleIdsTheTeamsOxlintConfigSets, given a config extended by path', () => {
  const team = buildTeamOxlintrcExtending([PATH_BASE], { plugins: ['oxc'], categories: { correctness: 'off' }, rules: { 'typescript/consistent-type-imports': 'warn' } })

  it.each([
    { base: 'leaves plugins out, which adds the defaults', config: buildTeamOxlintConfig(), ruleIds: [CONSISTENT_TYPE_IMPORTS] },
    { base: 'lists []', config: buildTeamOxlintConfig({ plugins: [] }), ruleIds: [] },
  ])('reads the plugins of the config at the path, where it $base', ({ config, ruleIds }) => {
    expect(ruleIdsTheTeamsOxlintConfigSets(team, catalog, new Map([[PATH_BASE, config]]))).toStrictEqual(ruleIds)
  })

  it('refuses a path it was not given the config of', () => {
    expect(() => ruleIdsTheTeamsOxlintConfigSets(team, catalog)).toThrowError(`the team's config extends ${PATH_BASE}, which the model was not given`)
  })
})
