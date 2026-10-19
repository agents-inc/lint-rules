import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
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
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { INSTALLED_OXLINT, THIS_PACKAGE } from './__tests__/temp-projects.ts'

// One sentinel per engine: a typed rule in ESLint, no-debugger in oxlint, or in ESLint without oxlint.
// Each project's copy of its debugger source outside the tsconfig must draw no typed rule.

const CONSUMER_FILES_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files', import.meta.url))
const WITHOUT_OXLINT_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files-without-oxlint', import.meta.url))
const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
const CLI_RUNS: RunsBeforeTheSuiteOptions = { timeoutMs: 480_000, whatFailed: "the engines' CLIs could not be run on the fixture project before the suite" }

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

/** Copies the fixture project beside the built package and oxlint, writes its tsconfig, and runs the engines its configs name. */
function setUpProjectRuns(fixturesDir: string, runsOxlint: boolean): () => CompletedRuns {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({
      fixturesDir,
      files: {
        'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
        [OUTSIDE_THE_TSCONFIG]: readFileSync(join(fixturesDir, DEBUGGER_SOURCE), 'utf8'),
      },
      linkedPackages: [THIS_PACKAGE, INSTALLED_OXLINT],
    })
    return {
      projectDir,
      eslint: runEslintCli(projectDir),
      oxlint: runsOxlint ? runOxlintCli(projectDir, OXLINT_CONFIG_FILE) : null,
    }
  }, CLI_RUNS)
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
