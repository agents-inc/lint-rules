import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
  FUNCTION_CASE_MODULE,
  GLOBAL_IGNORES_HOLDING_A_FUNCTION,
  SETTINGS_FOR_FILES_A_FUNCTION_NAMES,
  SETTINGS_FOR_TS_FILES_A_FUNCTION_NAMES,
} from './__tests__/cases/team-functions-in-globs.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { importedTeamConfig } from './__tests__/team-config-modules.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { isRecord } from './core/is-record.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// A function in a team block's files or ignores, which no glob of ours can read (Q-D; merge-eslint-
// config.ts, withGlobsOnly): among global ignores it leaves files out and takes none back, so our
// blocks keep the names they have outside a merge; in `files` it is read as matching every file,
// alone, or ANDed with the globs beside it, so a setting of ours the block's setting overrides
// stays out of every file it may reach. Our settings.n here is the modules ruleset's, which yields
// to the team's settings.node tryExtensions.

const tempProjects = setUpTempProjects()
const { calculatedConfigInProjectFor } = setUpEslintConfigOracle()

const CONFINED_COPY = '/confined/'
const N_SETTINGS = 'n'

/** A project holding the team module given; our ESLint part of the modules ruleset, turning no-var on. */
function projectWith(teamModule: string): { readonly projectDir: string; readonly eslint: ReturnType<typeof defineLintRules>['editorRulesets']['eslint'] } {
  const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()), [FUNCTION_CASE_MODULE]: teamModule } })
  const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, { editorRulesets: { quality: ['modules'] } }, { rules: { 'no-var': 'error' } })).editorRulesets
  return { projectDir, eslint }
}

/** Whether ESLint gives the file a settings.n: ours, the team giving none. */
async function hasOurNSettings(projectDir: string, merged: Linter.Config[], file: string): Promise<boolean> {
  const calculated = await calculatedConfigInProjectFor(projectDir, merged, file)
  if (calculated === undefined) throw new Error(`ESLint does not lint ${file}`)
  const { settings = {} } = calculated
  return isRecord(settings[N_SETTINGS])
}

describe("our blocks, beside a team's global ignores holding a function beside a glob", () => {
  it('keep the names they have outside a merge, a function taking no file back', async () => {
    const { projectDir, eslint } = projectWith(GLOBAL_IGNORES_HOLDING_A_FUNCTION)
    const merged = mergeEslintConfig(await importedTeamConfig(projectDir, FUNCTION_CASE_MODULE), eslint, NO_TEAM_OXLINT_CONFIG)

    expect(merged.map(({ name }) => name).filter((name) => name !== undefined && name.includes(CONFINED_COPY))).toStrictEqual([])
  })
})

describe("our settings.n, beside a team block giving settings.node's tryExtensions to the files a function names", () => {
  it('stays out of every file, the function read as matching any', async () => {
    const { projectDir, eslint } = projectWith(SETTINGS_FOR_FILES_A_FUNCTION_NAMES)
    const merged = mergeEslintConfig(await importedTeamConfig(projectDir, FUNCTION_CASE_MODULE), eslint, NO_TEAM_OXLINT_CONFIG)

    expect({ ts: await hasOurNSettings(projectDir, merged, 'src/a.ts'), js: await hasOurNSettings(projectDir, merged, 'src/a.js') }).toStrictEqual({ ts: false, js: false })
  })

  it('stays out of the TS files alone where the function is ANDed with their glob, and stands in the JS files', async () => {
    const { projectDir, eslint } = projectWith(SETTINGS_FOR_TS_FILES_A_FUNCTION_NAMES)
    const merged = mergeEslintConfig(await importedTeamConfig(projectDir, FUNCTION_CASE_MODULE), eslint, NO_TEAM_OXLINT_CONFIG)

    expect({ ts: await hasOurNSettings(projectDir, merged, 'src/a.ts'), js: await hasOurNSettings(projectDir, merged, 'src/a.js') }).toStrictEqual({ ts: false, js: true })
  })
})
