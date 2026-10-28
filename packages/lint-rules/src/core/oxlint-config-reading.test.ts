import { catalog } from '@workspace/rule-data'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
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
const EXTENDED_OXLINTRC = 'base.oxlintrc.json'
// V8's text for a property read on null.
const READ_ON_NULL = /^Cannot read properties of null \(reading '/u

const tempProjects = setUpTempProjects()

function setBy(config: Readonly<OxlintConfig>): string[] {
  return ruleIdsTheTeamsOxlintConfigSets(config, catalog)
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

// A team's JSON config is judged by its keys alone (oxlintConfigInJson), so a null where oxlint takes an object, which
// oxlint itself refuses (measured, 1.87: "invalid type: null"), reaches the reading, which stops where it reads into it.
describe('ruleIdsTheTeamsOxlintConfigSets, given a team JSON config holding null where oxlint takes an object', () => {
  it('stops at a TypeError where options is null, reading typeAware in it', () => {
    const optionsNull = readTheTeamsJson({ [TEAM_OXLINTRC]: JSON.stringify({ ...SETTING_NO_DEBUGGER, options: null }) })

    expect(() => setBy(optionsNull)).toThrow(expect.objectContaining({ name: 'TypeError', message: "Cannot read properties of null (reading 'typeAware')" }))
  })

  it('reads its statements where options is an object turning nothing on', () => {
    const optionsEmpty = readTheTeamsJson({ [TEAM_OXLINTRC]: JSON.stringify({ ...SETTING_NO_DEBUGGER, options: {} }) })

    expect(setBy(optionsEmpty)).toStrictEqual([NO_DEBUGGER])
  })

  it('stops at a TypeError where categories is null and it extends no config, reading a category in it', () => {
    const categoriesNull = readTheTeamsJson({ [TEAM_OXLINTRC]: JSON.stringify({ ...SETTING_NO_DEBUGGER, categories: null }) })

    expect(() => setBy(categoriesNull)).toThrow(TypeError)
    expect(() => setBy(categoriesNull)).toThrow(READ_ON_NULL)
  })

  it('reads the categories of a config it extends where its own categories is null', () => {
    const categoriesNullBesideAnExtended = readTheTeamsJson({
      [TEAM_OXLINTRC]: JSON.stringify({ extends: [EXTENDED_OXLINTRC], categories: null }),
      [EXTENDED_OXLINTRC]: JSON.stringify(CORRECTNESS_ON),
    })

    expect(setBy(categoriesNullBesideAnExtended)).toStrictEqual(setBy(CORRECTNESS_ON))
  })
})
