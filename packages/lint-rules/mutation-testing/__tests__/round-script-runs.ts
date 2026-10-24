import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGitProject, type GitProject, testEnv } from '../../src/__tests__/git-projects.ts'
import type { ProjectFiles, TempProjects } from '../../src/__tests__/temp-projects.ts'
import type { MutationReport } from '../mutants-survived-without-a-test.ts'
import { mutationReport } from './factories/mutation-report-factories.ts'

/** How a run of the round script ended, what it printed, and the arguments of each Stryker run it started, in order. */
type RoundRun = {
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
  readonly strykerRuns: readonly string[][]
}

/** What one run of the round script is given: its arguments, the folder it runs from, and the report Stryker's stand-in writes. */
type RoundRunGiven = { readonly argumentsGiven: readonly string[]; readonly fromFolder: string; readonly report: MutationReport }

/** A scratch repo holding a copy of the round script, whose `bun run mutation` runs a stand-in rather than Stryker. */
export type RoundRepo = {
  /** Runs the script with the arguments given, from the repo root or from the folder given, relative to it. */
  readonly runTheRound: (argumentsGiven: readonly string[], fromFolder?: string) => RoundRun
  /** Runs the script from the repo root, each Stryker run writing the report given rather than one with no mutant. */
  readonly runTheRoundReporting: (report: MutationReport, argumentsGiven: readonly string[]) => RoundRun
  /** The absolute path of a file in the repo, from the folder the script takes for the repo root. */
  readonly pathOf: (file: string) => string
}

const ROUND_SCRIPT = fileURLToPath(new URL('../../../../scripts/mutate-changed-lines.mts', import.meta.url))
// The script takes the repo root to be the folder above its own, so its copy sits where it sits in this repo.
const ROUND_SCRIPT_IN_THE_REPO = 'scripts/mutate-changed-lines.mts'
// The script imports its helpers from this folder, which the scratch repo links to this package's.
const HELPERS_IN_THE_REPO = 'packages/lint-rules/mutation-testing'
const HELPERS = fileURLToPath(new URL('..', import.meta.url))
const STRYKER_STAND_IN = fileURLToPath(new URL('./stryker-stand-in.mjs', import.meta.url))
const GIT_IGNORE = '.gitignore'
// Stryker's report folder and the link to the helpers: neither is a lane's change.
const IGNORED_BY_GIT = ['reports/', `/${HELPERS_IN_THE_REPO}`]
const FAKE_BIN_DIR = 'bin'
// The script starts Stryker as `bun run mutation`.
const BUN = 'bun'
const EXECUTABLE = 0o755
const RUN_DIR_PREFIX = 'round-run-'
const RUNS_FILE = 'stryker-runs.json'
// Read by stryker-stand-in.mjs, under the same names there.
const RUNS_VARIABLE = 'STRYKER_STAND_IN_RUNS'
const REPORT_VARIABLE = 'STRYKER_STAND_IN_REPORT'
const ROUND_TIMEOUT_MS = 60_000
const THE_REPO_ROOT = '.'
// Node's own warnings (type stripping, glob) are not the script's output, so stderr holds only what the script prints.
const NODE_WARNINGS_OFF = { NODE_NO_WARNINGS: '1' }

/** Commits the files given beside the script's copy, then makes the lanes' edits, which the round reads as changed lines. */
export function createRoundRepo(tempProjects: TempProjects, committed: ProjectFiles, lanesEdits: (project: GitProject) => void): RoundRepo {
  const project = createGitProject(tempProjects, {
    repo: 'committed',
    files: { ...committed, [ROUND_SCRIPT_IN_THE_REPO]: readFileSync(ROUND_SCRIPT, 'utf8'), [GIT_IGNORE]: IGNORED_BY_GIT.join('\n') },
    linkedPackages: [],
  })
  const helpersLink = project.pathOf(HELPERS_IN_THE_REPO)
  mkdirSync(dirname(helpersLink), { recursive: true })
  symlinkSync(HELPERS, helpersLink, 'dir')
  lanesEdits(project)
  project.writeAbove(join(FAKE_BIN_DIR, BUN), bunRunningTheStandIn())
  const binDir = join(project.dir, '..', FAKE_BIN_DIR)
  chmodSync(join(binDir, BUN), EXECUTABLE)
  return {
    runTheRound(argumentsGiven, fromFolder = THE_REPO_ROOT) {
      return runTheRoundScript(project, binDir, { argumentsGiven, fromFolder, report: mutationReport({}) })
    },
    runTheRoundReporting(report, argumentsGiven) {
      return runTheRoundScript(project, binDir, { argumentsGiven, fromFolder: THE_REPO_ROOT, report })
    },
    pathOf: project.pathOf,
  }
}

function bunRunningTheStandIn(): string {
  return `#!/bin/sh\nexec '${process.execPath}' '${STRYKER_STAND_IN}' "$@"\n`
}

function runTheRoundScript(project: GitProject, binDir: string, { argumentsGiven, fromFolder, report }: RoundRunGiven): RoundRun {
  const runsFile = join(mkdtempSync(join(project.dir, '..', RUN_DIR_PREFIX)), RUNS_FILE)
  const { status, stdout, stderr } = spawnSync(process.execPath, [project.pathOf(ROUND_SCRIPT_IN_THE_REPO), ...argumentsGiven], {
    cwd: project.pathOf(fromFolder),
    env: testEnv({
      PATH: [binDir, pathTheTestsRunWith()].join(delimiter),
      [RUNS_VARIABLE]: runsFile,
      [REPORT_VARIABLE]: JSON.stringify(report),
      ...NODE_WARNINGS_OFF,
    }),
    encoding: 'utf8',
    timeout: ROUND_TIMEOUT_MS,
  })
  return { exitCode: status, stdout, stderr, strykerRuns: strykerRunsIn(runsFile) }
}

// The round script finds git on it.
function pathTheTestsRunWith(): string {
  const { PATH } = process.env
  if (PATH === undefined) throw new Error('the tests run with no PATH, so the round script could not find git')
  return PATH
}

/** None where the stand-in never ran. */
function strykerRunsIn(runsFile: string): string[][] {
  // Parse boundary: what stryker-stand-in.mjs wrote.
  return existsSync(runsFile) ? (JSON.parse(readFileSync(runsFile, 'utf8')) as string[][]) : []
}
