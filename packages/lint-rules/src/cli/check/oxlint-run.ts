import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { text } from 'node:stream/consumers'
import type { Catalog } from '@workspace/rule-data'
import type { DummyRule, OxlintConfig } from 'oxlint'
import { isOxlintRoute, routeOf } from '../../core/catalog-lookups.ts'
import { hasErrorCode } from '../caught-errors.ts'
import { leftoverToRemove, removeLeftover } from './leftovers.ts'
import { type OxlintReport, oxlintReportFrom } from './oxlint-output.ts'

/** The temporary oxlint config check writes in the config's folder, where its rooted globs resolve. */
export type TempOxlintConfig = { readonly path: string; readonly folder: string }

// my-check-temp-config: never `.oxlintrc.json` or `oxlint.config.*`, which oxlint would find by itself.
const TEMP_CONFIG_PREFIX = '.agents-inc-check-'
const TEMP_CONFIG_SUFFIX = '.json'
const TEMP_CONFIG_NAME = /^\.agents-inc-check-(?<pid>\d+)-.+\.json$/u
const RANDOM_BYTES = 8
const OXLINT_MANIFEST = 'oxlint/package.json'
const OXLINT_BIN = join('bin', 'oxlint')
// The process exists, but belongs to another user.
const NOT_PERMITTED = 'EPERM'
const EVERY_FILE = ['**/*']
const OFF = 'off'
const REPORTED = 'error'

/**
 * Removes the temporary configs of check runs whose process has ended, keeps those of live ones,
 * and reserves this run's name: the caller writes it, and it is removed however the run ends.
 */
export function tempOxlintConfigIn(folder: string): TempOxlintConfig {
  readdirSync(folder)
    .filter(isLeftByAnEndedProcess)
    .forEach((name) => removeLeftover(join(folder, name)))
  return { path: leftoverToRemove(join(folder, tempConfigNameOfThisRun())), folder }
}

/** The agent build for the fix run: the rules whose fixes check withholds are off, so oxlint's `--fix` cannot apply them. */
export function fixRunConfigOf(config: OxlintConfig, withheld: ReadonlyMap<string, string>, catalog: Catalog): OxlintConfig {
  const withheldInOxlint = [...withheld.keys()]
    .map((id) => routeOf(id, catalog))
    .filter(isOxlintRoute)
    .filter(({ engine }) => engine === 'oxlint')
  if (withheldInOxlint.length === 0) return config
  const off = Object.fromEntries(withheldInOxlint.map(({ oxlintName }): [string, DummyRule] => [oxlintName, OFF]))
  // The last override wins, so the rule is off in every file whatever turned it on.
  return { ...config, overrides: [...(config.overrides ?? []), { files: EVERY_FILE, rules: off }] }
}

/** The agent build for the last run: suppression comments that silenced nothing are reported, for check to keep the unused ones (q-c15). */
export function lintRunConfigOf(config: OxlintConfig): OxlintConfig {
  return { ...config, options: { ...config.options, reportUnusedDisableDirectives: REPORTED } }
}

/**
 * Runs the oxlint this package resolves over the files with the config given, from the config's
 * folder, and reads its JSON report. A signal kills it. The project's own oxlint configs are never
 * read: `-c` names the only one.
 */
export async function runOxlint(
  { path, folder }: TempOxlintConfig,
  config: OxlintConfig,
  files: readonly string[],
  { fix, signal }: { readonly fix: boolean; readonly signal: AbortSignal },
): Promise<OxlintReport> {
  writeFileSync(path, JSON.stringify(config))
  const args = [oxlintBin(), '-c', path, '-f', 'json', ...(fix ? ['--fix'] : []), ...files]
  const child = spawn(process.execPath, args, { cwd: folder, signal, stdio: ['ignore', 'pipe', 'pipe'] })
  const [stdout, stderr] = await Promise.all([text(child.stdout), text(child.stderr), endOf(child)])
  return oxlintReportFrom({ stdout, stderr })
}

function endOf(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', () => resolve())
  })
}

/** Names this run's process, for a later run to tell whether it has ended, and is unique to the run. */
function tempConfigNameOfThisRun(): string {
  return `${TEMP_CONFIG_PREFIX}${String(process.pid)}-${randomBytes(RANDOM_BYTES).toString('hex')}${TEMP_CONFIG_SUFFIX}`
}

function oxlintBin(): string {
  return join(dirname(createRequire(import.meta.url).resolve(OXLINT_MANIFEST)), OXLINT_BIN)
}

function isLeftByAnEndedProcess(name: string): boolean {
  const pid = TEMP_CONFIG_NAME.exec(name)?.groups?.['pid']
  if (pid === undefined || Number(pid) === process.pid) return false
  return !isRunning(Number(pid))
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return hasErrorCode(error, NOT_PERMITTED)
  }
}
