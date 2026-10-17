import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIG_FILE, exportedConstant, exportedValue, moduleText, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { PACKAGE_JSON_LEFT_MID_MERGE } from '../../__tests__/factories/init-factories.ts'
import { buildPackageJson, packageJsonText } from '../../__tests__/factories/package-json-factories.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { eslintPartExportedBy, type FoundConfig, refuseAnotherCopy } from './config-lookup.ts'

const tempProjects = setUpTempProjects()

function configBeside(packageJson: string, config: string): FoundConfig {
  const folder = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: packageJson, [CONFIG_FILE]: config } })
  return { path: join(folder, CONFIG_FILE), folder }
}

describe('the package the config imports', () => {
  it('is refused as not installed where nothing the config can import provides it', () => {
    const found = configBeside(packageJsonText(buildPackageJson()), moduleText(exportedConstant('config')))

    expect(() => refuseAnotherCopy(found)).toThrowError(
      new Error("@agents-inc/lint-rules is not installed where agents-inc.lint.mts can import it. Run your package manager's install."),
    )
  })

  it("passes on Node's own refusal of a package.json left mid-merge, which no install fixes", () => {
    const found = configBeside(PACKAGE_JSON_LEFT_MID_MERGE, moduleText(exportedConstant('config')))

    expect(() => refuseAnotherCopy(found)).toThrowError(expect.objectContaining({ code: 'ERR_INVALID_PACKAGE_CONFIG' }))
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

    await expect(eslintPartExportedBy(found)).rejects.toThrowError(
      new Error('agents-inc.lint.mts: it exports no `eslint` part that defineLintRules returned: end it with `export const { eslint, oxlint } = config.editorRulesets`'),
    )
  })
})
