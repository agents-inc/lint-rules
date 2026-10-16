import { join } from 'node:path'
import { ESLint } from 'eslint'
import { catalog } from '@workspace/rule-data'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTsconfigWithPaths } from './__tests__/factories/tsconfig-factories.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { buildAgentConfigs } from './agent-configs.ts'
import { agentSettingsOf } from './agent-settings.ts'
import { buildOxlintConfig } from './core/build-oxlint-config.ts'
import { defineLintRules } from './index.ts'

// spec-core.md C12 (spec-next-batch E4): one builder of the agent set's two configs, which `check`
// and the tests both call. It reads the project's facts once, by the real walk of tsconfigRootDir:
// here a package's own tsconfig, whose alias the import-x resolver must follow (C1), and a TS file
// no tsconfig takes in, which the typed block must leave out (step 8).

const PACKAGE_TSCONFIG = 'packages/app/tsconfig.json'
const IMPORTER = 'packages/app/src/a.ts'
const STRAY_FILE = 'scripts/stray.ts'
const NAMED = 'import-x/named'
const FLOATING_PROMISES = '@typescript-eslint/no-floating-promises'
const SENTINELS: ReadonlySet<string> = new Set([NAMED, FLOATING_PROMISES])
// `missing` is no export of b.ts: import-x/named reports it only where it resolves the alias to b.ts.
const IMPORTER_SOURCE = "import { missing } from '@app/b'\n\nexport async function run(): Promise<number> {\n  Promise.resolve(missing)\n  return 1\n}\n"
const STRAY_SOURCE = 'export async function run(): Promise<number> {\n  Promise.resolve(1)\n  return 1\n}\n'
const MODULES_AND_CORRECTNESS = { quality: ['correctness', 'modules'] } as const

const tempProjects = setUpTempProjects()

describe('buildAgentConfigs, in a project whose package has a tsconfig of its own and whose root has none', () => {
  let projectDir: string
  let results: readonly ESLint.LintResult[]

  beforeAll(async () => {
    projectDir = tempProjects.create({
      files: {
        'package.json': packageJsonText(buildPackageJsonListingOthers()),
        [PACKAGE_TSCONFIG]: JSON.stringify(buildTsconfigWithPaths({ '@app/*': ['./src/*'] }, { include: ['src'] })),
        [IMPORTER]: IMPORTER_SOURCE,
        'packages/app/src/b.ts': 'export const present = 1\n',
        [STRAY_FILE]: STRAY_SOURCE,
      },
    })
    const { eslint } = buildAgentConfigs(agentSettingsIn(projectDir))
    results = await new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: eslint }).lintFiles(['.'])
  }, 120_000)

  function agentSettingsIn(dir: string): ReturnType<typeof agentSettingsOf> {
    return agentSettingsOf(defineLintRules(buildConsumerLintRules(dir, { agentRulesets: MODULES_AND_CORRECTNESS })).editorRulesets.eslint)
  }

  function sentinelsReportedOn(file: string): string[] {
    const result = results.find(({ filePath }) => filePath === join(projectDir, file))
    if (result === undefined) throw new Error(`ESLint did not lint ${file}`)
    return result.messages.flatMap(({ ruleId, fatal }) => (fatal === true ? ['fatal'] : ruleId !== null && SENTINELS.has(ruleId) ? [ruleId] : []))
  }

  it("gives the import-x resolver the package's tsconfig, so its alias resolves, and runs the typed rules on the package's files", () => {
    expect(sentinelsReportedOn(IMPORTER).toSorted()).toStrictEqual([FLOATING_PROMISES, NAMED])
  })

  it('leaves the TS file outside every tsconfig out of the typed block: no fatal message, and no typed rule there', () => {
    expect(sentinelsReportedOn(STRAY_FILE)).toStrictEqual([])
  })

  it('gives the oxlint config the oxlint builder gives the same settings', () => {
    const settings = agentSettingsIn(projectDir)

    expect(buildAgentConfigs(settings).oxlint).toStrictEqual(buildOxlintConfig(settings, catalog))
  })
})
