import { spawnSync } from 'node:child_process'
import { mkdirSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readManifest } from '../../src/__tests__/package-manifests.ts'
import type { ReportRun } from './leftover-copy-runs.ts'

/** One task of `turbo run test --dry=json`, by the fields the gate's order is read from. */
type GateTask = {
  readonly taskId: string
  readonly task: string
  readonly package: string
  readonly command: string
  readonly dependencies: readonly string[]
  readonly resolvedTaskDefinition: { readonly cache: boolean }
}

type TestGatePlan = { readonly tasks: readonly GateTask[] }

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const TURBO_BIN = join(REPO_ROOT, 'node_modules/.bin/turbo')
// `bun run test` is `turbo test`; a dry run plans its tasks and runs none.
const TEST_GATE_DRY_RUN = ['run', 'test', '--dry=json']
const TEST_TASK = 'test'
// What a dry run gives as the command of a package with no script of the task's name.
const NO_SCRIPT = '<NONEXISTENT>'
const REPORT_SCRIPT_NAME = 'report-leftover-stryker-copies'
/** turbo names a script of the root package.json `//#<script>`. */
export const REPORT_TASK = `//#${REPORT_SCRIPT_NAME}`
const REPORT_FILE = 'scripts/report-leftover-stryker-copies.mts'
const RUN_TIMEOUT_MS = 30_000
// Switches every Node warning off, so a shell that sets it would hide the one the root script must switch off itself.
const NODE_WARNINGS_SWITCH = 'NODE_NO_WARNINGS'

export function planOfTheTestGate(): TestGatePlan {
  const { status, stdout, stderr } = spawnSync(TURBO_BIN, TEST_GATE_DRY_RUN, { cwd: REPO_ROOT, encoding: 'utf8', timeout: RUN_TIMEOUT_MS })
  if (status !== 0) throw new Error(`turbo could not plan the test gate (exit ${String(status)}): ${stderr}`)
  // Parse boundary: turbo's dry-run report.
  return JSON.parse(stdout) as TestGatePlan
}

export function packagesWhoseTestRuns({ tasks }: TestGatePlan): readonly string[] {
  return tasks
    .filter((each) => each.task === TEST_TASK && each.command !== NO_SCRIPT)
    .map((each) => each.package)
    .toSorted()
}

export function tasksBeforeTheTestOf({ tasks }: TestGatePlan, packageName: string): readonly string[] {
  const test = tasks.find((each) => each.task === TEST_TASK && each.package === packageName)
  if (test === undefined) throw new Error(`the test gate runs no test in ${packageName}`)
  return test.dependencies
}

export function isTheReportCached({ tasks }: TestGatePlan): boolean {
  const report = tasks.find((each) => each.taskId === REPORT_TASK)
  if (report === undefined) throw new Error(`the test gate never runs ${REPORT_TASK}`)
  return report.resolvedTaskDefinition.cache
}

export function linkTheReportInto(root: string): void {
  const link = join(root, REPORT_FILE)
  mkdirSync(dirname(link), { recursive: true })
  symlinkSync(join(REPO_ROOT, REPORT_FILE), link)
}

/** Through the shell, as the package manager that turbo starts runs it. */
export function runTheRootReportScriptFrom(root: string): ReportRun {
  const { status, stdout, stderr } = spawnSync(rootReportScript(), {
    cwd: root,
    shell: true,
    env: environmentWithoutNodeWarningsSwitch(),
    encoding: 'utf8',
    timeout: RUN_TIMEOUT_MS,
  })
  return { exitCode: status, stdout, stderr }
}

function rootReportScript(): string {
  const script = readManifest(join(REPO_ROOT, 'package.json')).scripts?.[REPORT_SCRIPT_NAME]
  if (script === undefined) throw new Error(`the root package.json has no script ${REPORT_SCRIPT_NAME}`)
  return script
}

function environmentWithoutNodeWarningsSwitch(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== NODE_WARNINGS_SWITCH))
}
