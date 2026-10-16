import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import type { OxlintConfig } from 'oxlint'
import { rawOxlintOutput } from './oxlint-raw-output.ts'
import { projectPathOf } from './project-paths.ts'

/** One ESLint message as `eslint -f json` prints it: `ruleId` null for a parse error or ESLint's own. */
export type EslintCliMessage = {
  readonly ruleId: string | null
  readonly fatal?: boolean | undefined
  readonly message: string
  readonly line: number
}

export type EslintCliResult = { readonly filePath: string; readonly messages: readonly EslintCliMessage[] }

/** A finding a rule reports, by file relative to the project. */
export type Finding = { readonly file: string; readonly rule: string; readonly line: number | null }

/** A finding either engine reports, under the engine's own name for the rule, and its message. */
export type EngineFinding = Finding & { readonly engine: 'eslint' | 'oxlint'; readonly message: string }

/** A finding oxlint reports, under oxlint's code for the rule (`eslint(no-debugger)`), at `warning` or `error`. */
export type OxlintFinding = Finding & { readonly severity: string }

/** One diagnostic as `oxlint -f json` prints it. */
export type OxlintCliDiagnostic = {
  readonly code: string
  readonly filename: string
  /** `warning` or `error`. */
  readonly severity: string
  readonly message: string
  readonly labels: readonly { readonly span: { readonly line: number } }[]
}

export type OxlintCliReport = { readonly diagnostics: readonly OxlintCliDiagnostic[] }

export type OxlintCliRun = { readonly exitCode: number | null; readonly report: OxlintCliReport }

const ESLINT_BIN = join(dirname(createRequire(import.meta.url).resolve('eslint/package.json')), 'bin', 'eslint.js')
// ESLint exits 2 when it cannot run at all: a config that fails to load, or a crash.
const ESLINT_COULD_NOT_RUN = 2
const ESLINT_CLI_TIMEOUT_MS = 240_000
const JSON_EXTENSION = '.json'
// A finding without a line is about the whole file, so it sorts before line 1.
const WHOLE_FILE_LINE = 0

/**
 * The real ESLint CLI over the whole project, in a process of its own: typescript-eslint keeps one
 * project service per process, so two configs linted in one process would share it. With no
 * config file named, ESLint looks up the project's own `eslint.config.mjs`.
 */
export function runEslintCli(projectDir: string, configFile?: string): readonly EslintCliResult[] {
  const linting = eslintCliOutcomeOf(projectDir, configFile)
  if (linting.outcome === 'refused') throw new Error(`ESLint could not lint ${projectDir}: ${linting.output}`)
  return linting.results
}

/** What the real ESLint CLI made of the project: its results, or, where it could not run at all, what it printed. */
export type EslintCliOutcome =
  | { readonly outcome: 'linted'; readonly results: readonly EslintCliResult[]; readonly stderr: string }
  | { readonly outcome: 'refused'; readonly output: string }

/** As `runEslintCli`, keeping a run ESLint could not make, a config that fails to load included, as its refusal. */
export function eslintCliOutcomeOf(projectDir: string, configFile?: string): EslintCliOutcome {
  const configArgs = configFile === undefined ? [] : ['-c', configFile]
  const { status, stdout, stderr } = spawnSync(process.execPath, [ESLINT_BIN, ...configArgs, '-f', 'json', '.'], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: ESLINT_CLI_TIMEOUT_MS,
  })
  if (status === null || status === ESLINT_COULD_NOT_RUN) return { outcome: 'refused', output: `(exit ${String(status)}) ${stderr}` }
  // Parse boundary: ESLint's JSON report.
  return { outcome: 'linted', results: JSON.parse(stdout) as EslintCliResult[], stderr }
}

/** `file: message` for every fatal message, a parse error included. */
export function fatalMessagesIn(results: readonly EslintCliResult[], projectDir: string): string[] {
  return results.flatMap((result) =>
    result.messages
      .filter((message) => message.fatal === true)
      .map((message) => `${projectPathOf(result.filePath, projectDir)}: ${message.message}`),
  )
}

/** Every finding a rule reports in ESLint, by the file's path in the project, with its message. */
export function eslintEngineFindingsIn(results: readonly EslintCliResult[], projectDir: string): EngineFinding[] {
  return results.flatMap((result) =>
    result.messages.flatMap(({ ruleId, line, message }): EngineFinding[] =>
      ruleId === null ? [] : [{ engine: 'eslint', file: projectPathOf(result.filePath, projectDir), rule: ruleId, line, message }],
    ),
  )
}

/** Every finding a rule reports, sorted by file, line and rule. */
export function eslintFindingsIn(results: readonly EslintCliResult[], projectDir: string): Finding[] {
  return results
    .flatMap((result) =>
      result.messages.flatMap((message): Finding[] =>
        message.ruleId === null ? [] : [{ file: relative(projectDir, result.filePath), rule: message.ruleId, line: message.line }],
      ),
    )
    .toSorted(byFileLineThenRule)
}

/** What the real oxlint CLI made of a config file: its run, or its refusal to load the config, with what it printed. */
export type OxlintCliOutcome = { readonly outcome: 'linted'; readonly run: OxlintCliRun } | { readonly outcome: 'refused'; readonly output: string }

/** The real oxlint CLI over the paths given, with the config file given, its report parsed: throws where oxlint refuses the config. */
export function runOxlintCli(projectDir: string, configFile: string, paths: readonly string[] = ['.']): OxlintCliRun {
  const linting = oxlintCliOutcomeOf(projectDir, configFile, paths)
  if (linting.outcome === 'refused') throw new Error(`oxlint could not lint with ${configFile}: ${linting.output}`)
  return linting.run
}

/** The real oxlint CLI over the paths given, with the config file given: its report parsed, or its refusal to load the config. */
export function oxlintCliOutcomeOf(projectDir: string, configFile: string, paths: readonly string[] = ['.']): OxlintCliOutcome {
  const { exitCode, stdout, stderr } = rawOxlintOutput(projectDir, configFile, paths)
  // oxlint prints something other than JSON when the config fails to load.
  if (!stdout.trimStart().startsWith('{')) return { outcome: 'refused', output: `${stdout}${stderr}` }
  // Parse boundary: oxlint's JSON report.
  return { outcome: 'linted', run: { exitCode, report: JSON.parse(stdout) as OxlintCliReport } }
}

/** Every diagnostic, under oxlint's code for it (`eslint(no-debugger)`), sorted by file, line and code. */
export function oxlintFindingsIn({ diagnostics }: OxlintCliReport): Finding[] {
  return diagnostics.map(findingOf).toSorted(byFileLineThenRule)
}

/** Every diagnostic, under oxlint's code for it (`eslint(no-debugger)`), with its message. */
export function oxlintEngineFindingsIn({ diagnostics }: OxlintCliReport): EngineFinding[] {
  return diagnostics.map((diagnostic) => ({ engine: 'oxlint', ...findingOf(diagnostic), message: diagnostic.message }))
}

/** Every diagnostic, with the severity oxlint reports it at. */
export function oxlintFindingsWithSeverityIn({ diagnostics }: OxlintCliReport): OxlintFinding[] {
  return diagnostics.map((diagnostic) => ({ ...findingOf(diagnostic), severity: diagnostic.severity }))
}

/** Each finding as `file:line code severity`, sorted by file, line, code, then severity. */
export function describeOxlintFindings(findings: readonly OxlintFinding[]): string[] {
  return findings
    .toSorted((first, second) => byFileLineThenRule(first, second) || first.severity.localeCompare(second.severity))
    .map((finding) => `${describeFinding(finding)} ${finding.severity}`)
}

/**
 * Writes an oxlint config as the file kind its name gives: a TypeScript module, whose `extends`
 * holds configs, or JSON, whose `extends` holds paths.
 */
export function writeOxlintConfigFile(projectDir: string, file: string, config: OxlintConfig): void {
  const json = JSON.stringify(config, null, 2)
  writeFileSync(join(projectDir, file), file.endsWith(JSON_EXTENSION) ? `${json}\n` : `export default ${json}\n`)
}

export function describeFinding({ file, rule, line }: Finding): string {
  return `${file}:${String(line)} ${rule}`
}

function findingOf({ code, filename, labels: [firstLabel] }: OxlintCliDiagnostic): Finding {
  return { file: filename, rule: code, line: firstLabel === undefined ? null : firstLabel.span.line }
}

function byFileLineThenRule(first: Finding, second: Finding): number {
  return (
    first.file.localeCompare(second.file) ||
    sortableLineOf(first) - sortableLineOf(second) ||
    first.rule.localeCompare(second.rule)
  )
}

function sortableLineOf({ line }: Finding): number {
  return line === null ? WHOLE_FILE_LINE : line
}
