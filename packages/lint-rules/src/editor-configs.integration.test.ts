import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  describeFinding,
  type EslintCliResult,
  eslintFindingsIn,
  fatalMessagesIn,
  type OxlintCliRun,
  oxlintFindingsIn,
  runEslintCli,
  runOxlintCli,
} from './__tests__/engine-clis.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { INSTALLED_OXLINT, setUpTempProjects, THIS_PACKAGE } from './__tests__/temp-projects.ts'

// A team's own engine configs, as the fixture projects hold them, loaded by the real engines
// with the built package installed: ESLint through the project's eslint.config.mjs, oxlint through
// `-c oxlint.config.mts`. consumer-files lists oxlint in its package.json; the other lists none and
// has no oxlint config. One sentinel per engine: a typed rule in ESLint, no-debugger in oxlint, and
// without oxlint no-debugger moves to ESLint. Each project also holds a copy of its debugger source
// outside its tsconfig, which our typed rules must leave alone (spec C3).

const CONSUMER_FILES_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files', import.meta.url))
const WITHOUT_OXLINT_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files-without-oxlint', import.meta.url))
const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
const CLI_RUNS_TIMEOUT_MS = 480_000

const TYPED_SENTINEL = 'src/floating-promise.ts:3 @typescript-eslint/no-floating-promises'
const OXLINT_SENTINEL = 'src/debugger.ts:2 eslint(no-debugger)'
const MOVED_SENTINEL = 'src/debugger.ts:2 no-debugger'
const DEBUGGER_SOURCE = 'src/debugger.ts'
const OUTSIDE_THE_TSCONFIG = 'scripts/debugger.ts'
const MOVED_SENTINEL_OUTSIDE_THE_TSCONFIG = 'scripts/debugger.ts:2 no-debugger'
const NO_DEBUGGER = 'no-debugger'
const OXLINT_EXIT_CODES = [0, 1]

type CompletedRuns = {
  readonly projectDir: string
  readonly eslint: readonly EslintCliResult[]
  readonly oxlint: OxlintCliRun | null
}

const tempProjects = setUpTempProjects()

/** Copies the fixture project beside the built package and oxlint, writes its tsconfig, and runs the engines its configs name. */
function setUpProjectRuns(fixturesDir: string, runsOxlint: boolean): () => CompletedRuns {
  let runs: CompletedRuns | undefined

  beforeAll(() => {
    const projectDir = tempProjects.create({
      fixturesDir,
      files: {
        'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
        [OUTSIDE_THE_TSCONFIG]: readFileSync(join(fixturesDir, DEBUGGER_SOURCE), 'utf8'),
      },
      linkedPackages: [THIS_PACKAGE, INSTALLED_OXLINT],
    })
    runs = {
      projectDir,
      eslint: runEslintCli(projectDir),
      oxlint: runsOxlint ? runOxlintCli(projectDir, OXLINT_CONFIG_FILE) : null,
    }
  }, CLI_RUNS_TIMEOUT_MS)

  return () => {
    if (runs === undefined) throw new Error('the runs were read outside the suite that made them')
    return runs
  }
}

function eslintFindings({ eslint, projectDir }: CompletedRuns): string[] {
  return eslintFindingsIn(eslint, projectDir).map(describeFinding)
}

function oxlintRunOf({ oxlint }: CompletedRuns): OxlintCliRun {
  if (oxlint === null) throw new Error('oxlint did not run on this project')
  return oxlint
}

describe('a project whose package.json lists oxlint, with its eslint.config.mjs and oxlint.config.mts', () => {
  const completedRuns = setUpProjectRuns(CONSUMER_FILES_DIR, true)

  it('is loaded by ESLint through its own eslint.config.mjs, with no fatal message on any file', () => {
    const runs = completedRuns()

    expect(fatalMessagesIn(runs.eslint, runs.projectDir)).toStrictEqual([])
  })

  it('is loaded by oxlint through -c oxlint.config.mts: exits 0 or 1 with a JSON report', () => {
    expect(OXLINT_EXIT_CODES).toContain(oxlintRunOf(completedRuns()).exitCode)
  })

  it('fires the typed sentinel in ESLint', () => {
    expect(eslintFindings(completedRuns())).toContain(TYPED_SENTINEL)
  })

  it('fires no-debugger in oxlint, and leaves it off in ESLint', () => {
    const runs = completedRuns()

    expect({
      oxlint: oxlintFindingsIn(oxlintRunOf(runs).report).map(describeFinding).includes(OXLINT_SENTINEL),
      eslint: eslintFindings(runs).filter((finding) => finding.endsWith(` ${NO_DEBUGGER}`)),
    }).toStrictEqual({ oxlint: true, eslint: [] })
  })
})

describe('a project whose package.json lists no oxlint, with its eslint.config.mjs alone', () => {
  const completedRuns = setUpProjectRuns(WITHOUT_OXLINT_DIR, false)

  it('is loaded by ESLint through its own eslint.config.mjs, with no fatal message on any file', () => {
    const runs = completedRuns()

    expect(fatalMessagesIn(runs.eslint, runs.projectDir)).toStrictEqual([])
  })

  it('fires the typed sentinel in ESLint', () => {
    expect(eslintFindings(completedRuns())).toContain(TYPED_SENTINEL)
  })

  it('fires no-debugger in ESLint, a moved rule', () => {
    expect(eslintFindings(completedRuns())).toContain(MOVED_SENTINEL)
  })

  it('fires no-debugger in ESLint on the copy outside the tsconfig too, an untyped rule', () => {
    expect(eslintFindings(completedRuns())).toContain(MOVED_SENTINEL_OUTSIDE_THE_TSCONFIG)
  })
})
