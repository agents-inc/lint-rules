import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { isRecord } from '../core/is-record.ts'

/** What a process printed, both streams, and how it exited. */
export type ProcessRun = { readonly exitCode: number | null; readonly stdout: string; readonly output: string }

const NPM = 'npm'
// Room for each engine's JSON report: spawnSync cuts its output at 1 MiB by default.
const OUTPUT_BUFFER_BYTES = 256 * 1024 * 1024
// `npm publish --dry-run` hands it to prepublishOnly, and so to this suite: under it npm pack writes no tarball and
// npm install installs nothing, each exiting 0. npm reads it in upper or lower case.
const DRY_RUN_VARIABLE = /^npm_config_dry_run$/iu

export function runIn(cwd: string, command: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env): ProcessRun {
  const { status, stdout, stderr } = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: OUTPUT_BUFFER_BYTES })
  return { exitCode: status, stdout, output: `${stdout}${stderr}` }
}

/** By its path in `destination`, as npm publishes the package. */
export function tarballPackedFrom(packageDir: string, destination: string): string {
  return join(destination, tarballNamedBy(npmRunIn(packageDir, ['pack', '--json', '--pack-destination', destination])))
}

/** As a consumer installs: no lifecycle scripts, and no audit or funding notes in the output. */
export function npmInstallIn(projectDir: string): ProcessRun {
  return npmRunIn(projectDir, ['install', '--ignore-scripts', '--no-audit', '--no-fund'])
}

/** For real, even inside `npm publish --dry-run`. */
function npmRunIn(cwd: string, args: readonly string[]): ProcessRun {
  return runIn(cwd, NPM, args, environmentWithoutDryRun())
}

function environmentWithoutDryRun(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !DRY_RUN_VARIABLE.test(name)))
}

/** The file name from the one entry `npm pack --json` prints. */
function tarballNamedBy({ exitCode, stdout, output }: ProcessRun): string {
  if (exitCode !== 0) throw new Error(`npm pack failed: ${output}`)
  // Parse boundary: npm's JSON report of what it packed.
  const packed: unknown = JSON.parse(stdout)
  const entry: unknown = Array.isArray(packed) ? packed[0] : undefined
  if (!isRecord(entry) || typeof entry['filename'] !== 'string') throw new Error(`npm pack printed no tarball: ${stdout}`)
  return entry['filename']
}
