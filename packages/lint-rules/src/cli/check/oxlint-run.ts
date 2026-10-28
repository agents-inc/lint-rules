import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { text } from 'node:stream/consumers'
import { type Catalog, isOxlintRoute, routeOf } from '@workspace/rule-data'
import type { DummyRule, DummyRuleMap, OxlintConfig, OxlintOverride } from 'oxlint'
import { hasErrorCode } from '../../core/caught-errors.ts'
import { namedGroupOf } from '../../core/named-groups.ts'
import { leftoverToRemove, removeLeftover } from './leftovers.ts'
import { type NotChecked, oxlintRulesFailed } from './not-checked.ts'
import { type OxlintReport, oxlintReportFrom } from './oxlint-output.ts'

/** Written in the git top level, which oxlint runs in and reads every glob of the config from. */
export type TempOxlintConfig = { readonly path: string; readonly folder: string }

/** oxlint's report, with no diagnostic where its run failed. */
type OxlintLintRun = { readonly report: OxlintReport; readonly notChecked: readonly NotChecked[] }

type RuleEntry = DummyRuleMap[string]

// Never `.oxlintrc.json` or `oxlint.config.*`, which oxlint would find by itself.
const TEMP_CONFIG_PREFIX = '.agents-inc-check-'
const TEMP_CONFIG_SUFFIX = '.json'
const TEMP_CONFIG_NAME = /^\.agents-inc-check-(?<pid>\d+)-.+\.json$/u
const RANDOM_BYTES = 8
const OXLINT_MANIFEST = 'oxlint/package.json'
const OXLINT_BIN = join('bin', 'oxlint')
// The process exists, but belongs to another user.
const NOT_PERMITTED = 'EPERM'
const EVERY_FILE: readonly string[] = ['**/*']
const OFF = 'off'
const WARN = 'warn'
const REPORTED = 'error'
const NO_DIAGNOSTICS: OxlintReport = { diagnostics: [] }

/** Removes the temp configs of ended check runs, keeps live ones', and reserves this run's name. */
export function tempOxlintConfigIn(folder: string): TempOxlintConfig {
  const leftByEndedRuns = readdirSync(folder).filter(isLeftByAnEndedProcess)
  for (const name of leftByEndedRuns) removeLeftover(join(folder, name))
  return { path: leftoverToRemove(join(folder, tempConfigNameOfThisRun())), folder }
}

/** Rules set to warn and withheld-fix rules are off, so oxlint's `--fix` applies neither: check fixes errors alone. */
export function fixRunConfigOf(config: Readonly<OxlintConfig>, withheld: ReadonlyMap<string, string>, catalog: Readonly<Catalog>): OxlintConfig {
  return withheldRulesOff(withWarnedRulesOff(config), withheld, catalog)
}

function withheldRulesOff(config: Readonly<OxlintConfig>, withheld: ReadonlyMap<string, string>, catalog: Readonly<Catalog>): OxlintConfig {
  const withheldInOxlint = withheld
    .keys()
    .map((id) => routeOf(id, catalog))
    .filter(isOxlintRoute)
    .toArray()
  if (withheldInOxlint.length === 0) return config
  const off = Object.fromEntries(withheldInOxlint.map(({ oxlintName }): [string, DummyRule] => [oxlintName, OFF]))
  // The last override wins, so the rule is off in every file whatever turned it on.
  return { ...config, overrides: [...(config.overrides ?? []), { files: [...EVERY_FILE], rules: off }] }
}

/** At the top and in each override: where an override sets a rule to error, it is fixed in that override's files. */
function withWarnedRulesOff(config: Readonly<OxlintConfig>): OxlintConfig {
  const { rules, overrides } = config
  return {
    ...config,
    ...(rules !== undefined && { rules: warnedRulesOff(rules) }),
    ...(overrides !== undefined && { overrides: overrides.map(overrideWithWarnedRulesOff) }),
  }
}

function overrideWithWarnedRulesOff(override: Readonly<OxlintOverride>): OxlintOverride {
  const { rules } = override
  return rules === undefined ? override : { ...override, rules: warnedRulesOff(rules) }
}

function warnedRulesOff(rules: Readonly<DummyRuleMap>): DummyRuleMap {
  return Object.fromEntries(Object.entries(rules).map(([name, rule]): [string, RuleEntry] => [name, isSetToWarn(rule) ? OFF : rule]))
}

/** The build writes a severity alone, or first before the options. */
function isSetToWarn(rule: Readonly<RuleEntry>): boolean {
  return (Array.isArray(rule) ? rule[0] : rule) === WARN
}

export function lintRunConfigOf(config: Readonly<OxlintConfig>): OxlintConfig {
  return { ...config, options: { ...config.options, reportUnusedDisableDirectives: REPORTED } }
}

/** A failure the signal caused stops check; any other leaves oxlint's rules unchecked. */
export async function oxlintLintRun(config: TempOxlintConfig, lintRunConfig: Readonly<OxlintConfig>, paths: readonly string[], signal: Readonly<AbortSignal>): Promise<OxlintLintRun> {
  try {
    return { report: await runOxlint(config, lintRunConfig, paths, { fix: false, signal }), notChecked: [] }
  } catch (error) {
    if (signal.aborted) throw error
    return { report: NO_DIAGNOSTICS, notChecked: [oxlintRulesFailed(error)] }
  }
}

/** The project's own oxlint configs are never read: `-c` names the only one. */
export async function runOxlint(
  { path, folder }: TempOxlintConfig,
  config: Readonly<OxlintConfig>,
  files: readonly string[],
  { fix, signal }: { readonly fix: boolean; readonly signal: AbortSignal },
): Promise<OxlintReport> {
  writeFileSync(path, JSON.stringify(config))
  const args = [oxlintBin(), '-c', path, '-f', 'json', ...(fix ? ['--fix'] : []), ...files]
  const child = spawn(process.execPath, args, { cwd: folder, signal, stdio: ['ignore', 'pipe', 'pipe'] })
  // `once` rejects where the child emits an error first, as it does when the signal stops it.
  const [stdout, stderr] = await Promise.all([text(child.stdout), text(child.stderr), once(child, 'close')])
  return oxlintReportFrom({ stdout, stderr })
}

/** Names this run's process, so a later run can tell whether it has ended. */
function tempConfigNameOfThisRun(): string {
  return `${TEMP_CONFIG_PREFIX}${String(process.pid)}-${randomBytes(RANDOM_BYTES).toString('hex')}${TEMP_CONFIG_SUFFIX}`
}

function oxlintBin(): string {
  return join(dirname(createRequire(import.meta.url).resolve(OXLINT_MANIFEST)), OXLINT_BIN)
}

function isLeftByAnEndedProcess(name: string): boolean {
  const tempConfig = TEMP_CONFIG_NAME.exec(name)
  if (tempConfig === null) return false
  const pid = Number(namedGroupOf(tempConfig, 'pid'))
  if (pid === process.pid) return false
  return !isRunning(pid)
}

/** Signal 0 sends nothing: kill answers true where the process exists, and throws where it does not or belongs to another user. */
function isRunning(pid: number): boolean {
  try {
    return process.kill(pid, 0)
  } catch (error) {
    return hasErrorCode(error, NOT_PERMITTED)
  }
}
