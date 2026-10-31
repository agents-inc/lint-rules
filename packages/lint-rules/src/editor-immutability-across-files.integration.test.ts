import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { A_READONLY_PICK, A_READONLY_REQUIRED, B_MUTABLE_PICK, B_MUTABLE_REQUIRED, NODE_ENV_OUTSIDE_TESTS } from './__tests__/cases/pick-parameter-sources.ts'
import { describeFinding, type EslintCliResult, eslintFindingsIn, fatalMessagesIn, runEslintCli } from './__tests__/engine-clis.ts'
import { moduleText } from './__tests__/factories/check-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { INSTALLED_OXLINT, THIS_PACKAGE } from './__tests__/temp-projects.ts'

// The editor merge, as `npx eslint .` and an editor's ESLint server load it: one process lints every file, so
// is-immutable-type's process-wide cache (5.0.4) let the first Pick or Required parameter answered decide every later one.

const CONSUMER_FILES_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files', import.meta.url))
// The fixture's own, which merges its editorRulesets: declarative among them.
const ESLINT_CONFIG_FILE = 'eslint.config.mjs'
const PREFER_IMMUTABLE_TYPES = 'functional/prefer-immutable-types'
const CLI_RUNS: RunsBeforeTheSuiteOptions = { timeoutMs: 480_000, whatFailed: 'the ESLint CLI could not be run on the fixture project before the suite' }

type CompletedRun = { readonly projectDir: string; readonly results: readonly EslintCliResult[] }

describe('the ESLint CLI over the editor merge, with read-only Pick and Required parameters in files linted before the overwritable ones', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects): CompletedRun => {
    const sources = [A_READONLY_PICK, A_READONLY_REQUIRED, B_MUTABLE_PICK, B_MUTABLE_REQUIRED]
    const projectDir = tempProjects.create({
      fixturesDir: CONSUMER_FILES_DIR,
      files: {
        'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
        ...Object.fromEntries(sources.map(({ file, lines }) => [file, moduleText(...lines)])),
      },
      linkedPackages: [THIS_PACKAGE, INSTALLED_OXLINT],
    })
    return { projectDir, results: runEslintCli(projectDir, ESLINT_CONFIG_FILE, { env: NODE_ENV_OUTSIDE_TESTS }) }
  }, CLI_RUNS)

  it('reports each overwritable parameter and no read-only one, every file parsed', () => {
    const { projectDir, results } = run()

    expect({
      fatal: fatalMessagesIn(results, projectDir),
      reported: eslintFindingsIn(results, projectDir)
        .filter(({ rule }) => rule === PREFER_IMMUTABLE_TYPES)
        .map(describeFinding),
    }).toStrictEqual({
      fatal: [],
      reported: ['src/b-mutable-pick.ts:3 functional/prefer-immutable-types', 'src/b-mutable-required.ts:3 functional/prefer-immutable-types'],
    })
  })
})
