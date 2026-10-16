import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { describeFinding, eslintCliOutcomeOf, fatalMessagesIn, oxlintCliOutcomeOf, oxlintFindingsIn } from './__tests__/engine-clis.ts'
import { installedOxlintSchemaTextLacking } from './__tests__/factories/package-json-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { installOxlintReporting } from './__tests__/oxlint-reporting-another-version.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { THIS_PACKAGE } from './__tests__/temp-projects.ts'

// #56 (owner): an installed oxlint outside our peer range is checked against its own rule list, its
// schema, rather than refused for its version. A team's own configs, as test-fixtures/consumer-files
// holds them, loaded by the real engines with the built package installed, beside an oxlint whose
// package.json reports 2.0.0: once with the schema this repo's oxlint ships, which holds every name
// the merge writes, and once with that schema less no-debugger, a rule the merge writes.

allowEveryTestForParallelLoad()

const CONSUMER_FILES_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files', import.meta.url))
const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
const VERSION_OUTSIDE_THE_RANGE = '2.0.0'
const A_RULE_THE_MERGE_WRITES = 'no-debugger'
const OXLINT_SENTINEL = 'src/debugger.ts:2 eslint(no-debugger)'
const PROJECT_FILES = { 'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })) }

/** The message the oxlint merge refuses an install with whose schema lacks a name it writes. */
function lackingTheRuleMessage(projectDir: string): string {
  return `the oxlint installed for ${projectDir} is ${VERSION_OUTSIDE_THE_RANGE}, which has no rule or plugin named ${A_RULE_THE_MERGE_WRITES}`
}

describe('a project with its eslint.config.mjs and oxlint.config.mts, beside an installed oxlint reporting 2.0.0 whose schema holds every name the merge writes', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ fixturesDir: CONSUMER_FILES_DIR, files: PROJECT_FILES, linkedPackages: [THIS_PACKAGE] })
    installOxlintReporting(projectDir, VERSION_OUTSIDE_THE_RANGE)
    return { projectDir, oxlint: oxlintCliOutcomeOf(projectDir, OXLINT_CONFIG_FILE), eslint: eslintCliOutcomeOf(projectDir) }
  })

  it('is loaded by oxlint through -c oxlint.config.mts, which reports no-debugger', () => {
    const { oxlint } = runs()
    if (oxlint.outcome === 'refused') throw new Error(`oxlint refused the config: ${oxlint.output}`)

    expect(oxlintFindingsIn(oxlint.run.report).map(describeFinding)).toContain(OXLINT_SENTINEL)
  })

  it('is loaded by ESLint through its own eslint.config.mjs, with no fatal message on any file', () => {
    const { projectDir, eslint } = runs()
    if (eslint.outcome === 'refused') throw new Error(`ESLint could not lint the project: ${eslint.output}`)

    expect(fatalMessagesIn(eslint.results, projectDir)).toStrictEqual([])
  })
})

describe('the same project, beside an installed oxlint reporting 2.0.0 whose schema lacks no-debugger', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ fixturesDir: CONSUMER_FILES_DIR, files: PROJECT_FILES, linkedPackages: [THIS_PACKAGE] })
    installOxlintReporting(projectDir, VERSION_OUTSIDE_THE_RANGE, installedOxlintSchemaTextLacking({ ruleNames: [A_RULE_THE_MERGE_WRITES], pluginNames: [] }))
    return { projectDir, oxlint: oxlintCliOutcomeOf(projectDir, OXLINT_CONFIG_FILE) }
  })

  it('is refused by oxlint, which prints our message naming the rule the schema lacks and the version', () => {
    const { projectDir, oxlint } = runs()
    if (oxlint.outcome === 'linted') throw new Error('oxlint loaded a config the schema lacks a name of')

    expect(oxlint.output).toContain(lackingTheRuleMessage(projectDir))
  })
})
