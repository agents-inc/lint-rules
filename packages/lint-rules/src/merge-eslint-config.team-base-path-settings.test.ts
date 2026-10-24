import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { isRecord } from './core/is-record.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// A setting of ours stays out of the files where a team block gives one it yields to, those files read
// from the block's basePath, as ESLint reads them.

const tempProjects = setUpTempProjects()
const { calculatedConfigInProjectFor } = setUpEslintConfigOracle()

const N_SETTINGS = 'n'
const PACKAGE_FILE = 'packages/app/src/a.ts'
const ROOT_FILE = 'src/a.ts'
const TEAM_TRY_EXTENSIONS = ['.js', '.ts']

const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()) } })

/** The file's settings.n, as ESLint calculates it from the project: undefined where no block gives one. */
async function nSettingsFor(merged: Linter.Config[], file: string): Promise<unknown> {
  const calculated = await calculatedConfigInProjectFor(projectDir, merged, file)
  if (calculated === undefined) throw new Error(`ESLint does not lint ${file}`)
  const { settings = {} } = calculated
  return settings[N_SETTINGS]
}

describe("mergeEslintConfig, given a team block for packages/app's TS files, by its basePath, giving settings.node's tryExtensions", () => {
  const teamBlock = buildTeamEslintBlock('team/app', { basePath: 'packages/app', files: ['**/*.ts'], settings: { node: { tryExtensions: TEAM_TRY_EXTENSIONS } } })

  it("keeps our settings.n out of the package's TS files, and in the project's other TS files", async () => {
    const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, { editorRulesets: { quality: ['modules'] } })).editorRulesets
    const merged = mergeEslintConfig([teamBlock], eslint, NO_TEAM_OXLINT_CONFIG)

    expect({ inThePackage: await nSettingsFor(merged, PACKAGE_FILE), elsewhere: isRecord(await nSettingsFor(merged, ROOT_FILE)) }).toStrictEqual({
      inThePackage: undefined,
      elsewhere: true,
    })
  })
})
