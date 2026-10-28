import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIG_FILE, exportedConstant, exportedValue, moduleText, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { PACKAGE_JSON_LEFT_MID_MERGE } from '../../__tests__/factories/init-factories.ts'
import { buildPackageJson, packageJsonText } from '../../__tests__/factories/package-json-factories.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { eslintPartExportedBy, type FoundConfig, nearestConfig, refuseAnotherCopy } from './config-lookup.ts'

const tempProjects = setUpTempProjects()

const PACKAGE_FOLDER = join('packages', 'app')
const SOURCE_FOLDER = join(PACKAGE_FOLDER, 'src')
const SOURCE_FILE = join(SOURCE_FOLDER, 'index.ts')

function configBeside(packageJson: string, config: string): FoundConfig {
  const folder = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: packageJson, [CONFIG_FILE]: config } })
  return { path: join(folder, CONFIG_FILE), folder }
}

/** By its real path, as check reads the folder it runs in. */
function repoHoldingConfigsIn(...folders: readonly string[]): string {
  const configs = folders.map((folder): [string, string] => [join(folder, CONFIG_FILE), moduleText(exportedConstant('config'))])
  return realpathSync(tempProjects.create({ files: { [SOURCE_FILE]: moduleText(exportedConstant('source')), ...Object.fromEntries(configs) } }))
}

describe('the config check reads', () => {
  it('is the nearest from the folder check runs in up to the git top level, beside one above it', () => {
    const topLevel = repoHoldingConfigsIn('', PACKAGE_FOLDER)
    const packageFolder = join(topLevel, PACKAGE_FOLDER)

    expect(nearestConfig(join(topLevel, SOURCE_FOLDER), topLevel)).toStrictEqual({ path: join(packageFolder, CONFIG_FILE), folder: packageFolder })
  })

  it('is refused where none is in a folder up to the git top level, though one is above it', () => {
    const repoAbove = repoHoldingConfigsIn('')
    const topLevel = join(repoAbove, PACKAGE_FOLDER)
    const cwd = join(repoAbove, SOURCE_FOLDER)

    expect(() => nearestConfig(cwd, topLevel)).toThrow(
      new Error(`there is no agents-inc.lint.mts in ${cwd} or any folder above it up to ${topLevel}. Run "agents-inc-lint init" in the folder of the package to lint.`),
    )
  })
})

describe('the package the config imports', () => {
  it('is refused as not installed where nothing the config can import provides it', () => {
    const found = configBeside(packageJsonText(buildPackageJson()), moduleText(exportedConstant('config')))

    expect(() => refuseAnotherCopy(found)).toThrow(
      new Error("@agents-inc/lint-rules is not installed where agents-inc.lint.mts can import it. Run your package manager's install."),
    )
  })

  it("passes on Node's own refusal of a package.json left mid-merge, which no install fixes", () => {
    const found = configBeside(PACKAGE_JSON_LEFT_MID_MERGE, moduleText(exportedConstant('config')))

    expect(() => refuseAnotherCopy(found)).toThrow(expect.objectContaining({ code: 'ERR_INVALID_PACKAGE_CONFIG' }))
  })
})

describe('the ESLint part the config exports', () => {
  const AN_ESLINT_PART = { engine: 'eslint' }

  it('is the `eslint` the config exports, where it is the part defineLintRules made', async () => {
    const found = configBeside(packageJsonText(buildPackageJson()), moduleText(exportedValue('eslint', AN_ESLINT_PART)))

    await expect(eslintPartExportedBy(found)).resolves.toStrictEqual(AN_ESLINT_PART)
  })

  it('is refused where the config exports none, the error saying how to end the config', async () => {
    const found = configBeside(packageJsonText(buildPackageJson()), moduleText(exportedConstant('oxlint')))

    await expect(eslintPartExportedBy(found)).rejects.toThrow(
      new Error('agents-inc.lint.mts: it exports no `eslint` part that defineLintRules returned: end it with `export const { eslint, oxlint } = config.editorRulesets`'),
    )
  })
})
