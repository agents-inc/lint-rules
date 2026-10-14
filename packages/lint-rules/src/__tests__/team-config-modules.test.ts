import { describe, expect, it } from 'vitest'
import { teamBlockWithFunctionFiles } from './cases/team-eslint-projects.ts'
import { pathsOfFunctionsIn } from './functions-in.ts'
import { importedTeamConfig } from './team-config-modules.ts'
import { setUpTempProjects } from './temp-projects.ts'

// The reading of a team's JS config the function-matcher specs rest on: one that dropped the
// function would hand the merge a block with no files, which applies everywhere.

const MODULE_FILE = 'team-config.mjs'

const tempProjects = setUpTempProjects()

describe('importedTeamConfig', () => {
  it('gives the blocks the module exports, a function in files kept', async () => {
    const projectDir = tempProjects.create({ files: { [MODULE_FILE]: teamBlockWithFunctionFiles } })
    const teamConfig = await importedTeamConfig(projectDir, MODULE_FILE)

    expect({ names: teamConfig.map(({ name }) => name), functions: pathsOfFunctionsIn(teamConfig) }).toStrictEqual({
      names: ['team'],
      functions: ['$[0].files[0]'],
    })
  })

  it('throws on a module that exports no teamConfig array, naming the file', async () => {
    const projectDir = tempProjects.create({ files: { [MODULE_FILE]: 'export const teamConfig = {}\n' } })

    await expect(importedTeamConfig(projectDir, MODULE_FILE)).rejects.toThrowError(MODULE_FILE)
  })
})
