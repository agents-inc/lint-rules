// How the test files of the runs bridge-runs.ts makes spawn children, as a test of this repo spawns ESLint or oxlint.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const CHILD = fileURLToPath(new URL('./child-loading-instrumented-code.mjs', import.meta.url))
const CHILD_WRITING_NO_COVERAGE_MAP = fileURLToPath(new URL('./child-writing-no-coverage-map.mjs', import.meta.url))
const RECORDS_DIR = fileURLToPath(new URL('./records', import.meta.url))
const LOADING_NOTHING = ['--eval', '']

/** How a child that ran as it should ends. */
export const EXITED_CLEANLY = { status: 0, stderr: '' }

/** How the child ended: its exit status and what it printed to stderr. */
function spawnChild(args) {
  const { status, stderr } = spawnSync(process.execPath, args, { encoding: 'utf8' })
  return { status, stderr }
}

/** A child loading instrumented code, which covers the mutants given and records what it saw under the label. */
export function spawnChildCovering(label, ...mutantIds) {
  return spawnChild([CHILD, RECORDS_DIR, label, ...mutantIds])
}

/** A child that never loads instrumented code, so holds no Stryker namespace. */
export function spawnChildLoadingNothing() {
  return spawnChild(LOADING_NOTHING)
}

/** A child that leaves a file that is not a coverage map where children write their coverage, of the shape named (child-writing-no-coverage-map.mjs). */
export function spawnChildWritingNoCoverageMap(shape) {
  return spawnChild([CHILD_WRITING_NO_COVERAGE_MAP, shape])
}

/** For a child spawned outside a test, where no assertion runs: throws with how it ended where it did not exit cleanly. */
export function throwUnlessExitedCleanly({ status, stderr }) {
  if (status !== EXITED_CLEANLY.status || stderr !== EXITED_CLEANLY.stderr) throw new Error(`a child exited ${String(status)}: ${stderr}`)
}
