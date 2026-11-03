import { catalog } from '@workspace/rule-data'
import type { OxlintConfig, OxlintOverride } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { NO_THIS_ALIAS } from '../__tests__/cases/oxlint-categories-and-plugin-names.ts'
import { NO_DEBUGGER } from '../__tests__/cases/other-engine-configs.ts'
import { buildTeamOxlintConfig } from '../__tests__/factories/team-config-factories.ts'
import { type ProjectFiles, setUpTempProjects } from '../__tests__/temp-projects.ts'
import { readTheTeamsOxlintConfig } from './other-engine-config.ts'
import { ruleIdsTheTeamsOxlintConfigSets } from './oxlint-config-reading.ts'

// Measured, oxlint 1.87: a config's own categories win over those of a config it extends, and a later config in its
// extends over an earlier one, whose categories stand where the later one writes none; correctness off in the winner
// reports no debugger statement, on in it reports one.

const CORRECTNESS_ON = buildTeamOxlintConfig({ categories: { correctness: 'error' } })
const CORRECTNESS_OFF = buildTeamOxlintConfig({ categories: { correctness: 'off' } })
const SETTING_NO_DEBUGGER = buildTeamOxlintConfig({ rules: { [NO_DEBUGGER]: 'error' } })
const TEAM_OXLINTRC = '.oxlintrc.json'
const SOURCES = 'src/**'
const LIBRARY = 'lib/**'

type CorrectnessRulesSet = { readonly noDebugger: boolean; readonly noThisAlias: boolean }

const tempProjects = setUpTempProjects()

function setBy(config: Readonly<OxlintConfig>): string[] {
  return ruleIdsTheTeamsOxlintConfigSets(config, catalog)
}

function correctnessOnBeside(rootPlugins: Readonly<NonNullable<OxlintConfig['plugins']>>, overrides: readonly OxlintOverride[], extended: readonly OxlintConfig[] = []): OxlintConfig {
  return buildTeamOxlintConfig({ plugins: [...rootPlugins], categories: { correctness: 'error' }, overrides: [...overrides], extends: [...extended] })
}

function listing(files: string, plugins: Readonly<NonNullable<OxlintOverride['plugins']>>): OxlintOverride {
  return { files: [files], plugins: [...plugins] }
}

/** no-debugger is a core rule, which correctness on runs whatever plugins are listed. */
function correctnessRulesSetBy(config: Readonly<OxlintConfig>): CorrectnessRulesSet {
  const set = setBy(config)
  return { noDebugger: set.includes(NO_DEBUGGER), noThisAlias: set.includes(NO_THIS_ALIAS) }
}

/** As the ESLint merge reads a team's .oxlintrc.json. */
function readTheTeamsJson(files: ProjectFiles): OxlintConfig {
  return readTheTeamsOxlintConfig(TEAM_OXLINTRC, tempProjects.create({ files }))
}

describe('ruleIdsTheTeamsOxlintConfigSets, given a config extending configs that write correctness', () => {
  it('reads correctness on as setting no-debugger, and off as setting it not', () => {
    expect({ on: setBy(CORRECTNESS_ON).includes(NO_DEBUGGER), off: setBy(CORRECTNESS_OFF).includes(NO_DEBUGGER) }).toStrictEqual({ on: true, off: false })
  })

  it("reads the config's own categories over those it extends, and a later extended config's over an earlier one's", () => {
    expect({
      ownOffOverExtendedOn: setBy(buildTeamOxlintConfig({ ...CORRECTNESS_OFF, extends: [CORRECTNESS_ON] })),
      ownOnOverExtendedOff: setBy(buildTeamOxlintConfig({ ...CORRECTNESS_ON, extends: [CORRECTNESS_OFF] })),
      laterOffOverEarlierOn: setBy(buildTeamOxlintConfig({ extends: [CORRECTNESS_ON, CORRECTNESS_OFF] })),
      laterOnOverEarlierOff: setBy(buildTeamOxlintConfig({ extends: [CORRECTNESS_OFF, CORRECTNESS_ON] })),
    }).toStrictEqual({
      ownOffOverExtendedOn: setBy(CORRECTNESS_OFF),
      ownOnOverExtendedOff: setBy(CORRECTNESS_ON),
      laterOffOverEarlierOn: setBy(CORRECTNESS_OFF),
      laterOnOverEarlierOff: setBy(CORRECTNESS_ON),
    })
  })

  it("reads an earlier extended config's categories where a later one it extends writes none", () => {
    const earlierOnBesideALaterWritingNone = buildTeamOxlintConfig({ extends: [CORRECTNESS_ON, buildTeamOxlintConfig()] })

    expect(setBy(earlierOnBesideALaterWritingNone)).toStrictEqual(setBy(CORRECTNESS_ON))
  })
})

// The read refuses a null at any key oxlint refuses it at (merge-other-engine-config.refusals.test.ts), so none
// reaches the reading.
describe('ruleIdsTheTeamsOxlintConfigSets, given a team JSON config holding an empty object where oxlint takes an object', () => {
  it('reads its statements where options is an object turning nothing on', () => {
    const optionsEmpty = readTheTeamsJson({ [TEAM_OXLINTRC]: JSON.stringify({ ...SETTING_NO_DEBUGGER, options: {} }) })

    expect(setBy(optionsEmpty)).toStrictEqual([NO_DEBUGGER])
  })
})

// Measured, oxlint 1.87: in a file, a plugin outside the root's runs its category rules only where an override matching
// the file lists plugins other than the root's and the matching overrides' joined. Lists that differ may match one file
// as far as their globs tell, so there the rules stay the team's.
describe('ruleIdsTheTeamsOxlintConfigSets, given correctness on and typescript listed in overrides alone', () => {
  it.each([
    { how: 'one override lists typescript beside a root listing none', team: correctnessOnBeside([], [listing(SOURCES, ['typescript'])]) },
    { how: 'one override lists import and typescript beside a root listing import', team: correctnessOnBeside(['import'], [listing(SOURCES, ['import', 'typescript'])]) },
    { how: 'one override lists typescript beside a root listing eslint alone', team: correctnessOnBeside(['eslint'], [listing(SOURCES, ['typescript'])]) },
    { how: 'two overrides list typescript alone, for two folders', team: correctnessOnBeside([], [listing(SOURCES, ['typescript']), listing(LIBRARY, ['typescript'])]) },
    { how: 'two overrides list typescript, one with eslint', team: correctnessOnBeside([], [listing(SOURCES, ['typescript']), listing(SOURCES, ['eslint', 'typescript'])]) },
    { how: 'one override lists typescript beside another leaving plugins out', team: correctnessOnBeside([], [listing(SOURCES, ['typescript']), { files: [SOURCES] }]) },
    {
      how: 'an override of a config it extends lists typescript, and no root lists a plugin',
      team: correctnessOnBeside([], [], [buildTeamOxlintConfig({ plugins: [], overrides: [listing(SOURCES, ['typescript'])] })]),
    },
  ])("sets none of typescript's correctness rules where $how, as oxlint then runs them in no file", ({ team }) => {
    expect(correctnessRulesSetBy(team)).toStrictEqual({ noDebugger: true, noThisAlias: false })
  })

  it("sets none of typescript's correctness rules where two overrides list typescript under two of its names, read from JSON", () => {
    const twoNames = readTheTeamsJson({
      [TEAM_OXLINTRC]: JSON.stringify({
        plugins: [],
        categories: { correctness: 'error' },
        overrides: [
          { files: [SOURCES], plugins: ['typescript'] },
          { files: [SOURCES], plugins: ['typescript-eslint'] },
        ],
      }),
    })

    expect(correctnessRulesSetBy(twoNames)).toStrictEqual({ noDebugger: true, noThisAlias: false })
  })

  it.each([
    { how: 'the root lists typescript, and an override lists it too', team: correctnessOnBeside(['typescript'], [listing(SOURCES, ['typescript'])]) },
    // oxlint runs them in src/** alone, and nobody outside it.
    { how: 'one override lists typescript beside a root listing import, which the override leaves out', team: correctnessOnBeside(['import'], [listing(SOURCES, ['typescript'])]) },
    {
      how: 'one override lists typescript beside a root listing none and a config it extends listing import at its root',
      team: correctnessOnBeside([], [listing(SOURCES, ['typescript'])], [buildTeamOxlintConfig({ plugins: ['import'] })]),
    },
    { how: 'two overrides for one folder list typescript and import', team: correctnessOnBeside([], [listing(SOURCES, ['import']), listing(SOURCES, ['typescript'])]) },
    { how: 'two overrides for one folder list typescript and no plugin', team: correctnessOnBeside([], [listing(SOURCES, []), listing(SOURCES, ['typescript'])]) },
    // oxlint runs them in no file: whether the two folders share a file is not read from their globs.
    { how: 'two overrides for two folders list typescript and import', team: correctnessOnBeside([], [listing(SOURCES, ['typescript']), listing(LIBRARY, ['import'])]) },
  ])("sets typescript's correctness rules where $how", ({ team }) => {
    expect(correctnessRulesSetBy(team)).toStrictEqual({ noDebugger: true, noThisAlias: true })
  })
})
