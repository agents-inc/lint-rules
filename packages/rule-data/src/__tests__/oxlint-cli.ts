import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import { isObject } from '../is-object.ts'

// oxlint's package exports no path to its CLI; the CLI sits at bin/oxlint beside its manifest.
const OXLINT_BIN = join(dirname(createRequire(import.meta.url).resolve('oxlint/package.json')), 'bin', 'oxlint')

/** What the installed oxlint printed to each stream, and its exit code, unread. */
export type OxlintCliOutput = { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string }

/** What the installed oxlint made of a config file: the native rule names it resolved, or its refusal. */
export type PrintedOxlintConfig =
  | { readonly status: 'loaded'; readonly ruleNames: readonly string[] }
  | { readonly status: 'refused'; readonly output: string }

/** Where in its file a diagnostic points: the line its span starts on. */
type OxlintJsonLabel = { readonly span: { readonly line: number } }

/** A diagnostic in oxlint's JSON report: a rule's finding links to the rule's page, a parse error links nowhere. */
export type OxlintJsonDiagnostic = { readonly filename: string; readonly url?: string; readonly labels: readonly OxlintJsonLabel[] }

export type OxlintJsonReport = { readonly diagnostics: readonly OxlintJsonDiagnostic[]; readonly number_of_files: number }

/** What the installed oxlint made of a run reporting as JSON: its report, or its refusal to load the config, with what it printed. */
export type OxlintJsonRun = { readonly outcome: 'reported'; readonly report: OxlintJsonReport } | { readonly outcome: 'refused'; readonly output: string }

/** The installed oxlint CLI, from the folder given, over the arguments given. */
export function oxlintCliOutputIn(cwd: string, args: readonly string[]): OxlintCliOutput {
  const { status, stdout, stderr } = spawnSync(process.execPath, [OXLINT_BIN, ...args], { cwd, encoding: 'utf8' })
  return { exitCode: status, stdout, stderr }
}

/** Runs the installed oxlint with `--print-config`, which resolves every rule key without linting. */
export function printOxlintConfig(configPath: string): PrintedOxlintConfig {
  const { exitCode, stdout, stderr } = oxlintCliOutputIn(process.cwd(), ['-c', configPath, '--print-config'])
  if (exitCode !== 0) return { status: 'refused', output: `${stdout}${stderr}` }
  return { status: 'loaded', ruleNames: printedRuleNamesOf(stdout) }
}

/** The rule names a printed config sets, in ascending code-unit order. */
export function printedRuleNamesOf(printed: string): readonly string[] {
  const config: unknown = JSON.parse(printed)
  if (!isObject(config) || !('rules' in config) || !isObject(config.rules)) {
    throw new Error(`oxlint --print-config printed no rules object: ${printed}`)
  }
  return Object.keys(config.rules).toSorted()
}

/** The installed oxlint, from the folder given, with the config file given, over the arguments given (paths, and any flag such as `--fix`), reporting as JSON. */
export function oxlintJsonRun(cwd: string, configFile: string, args: readonly string[]): OxlintJsonRun {
  const { stdout, stderr } = oxlintCliOutputIn(cwd, ['-c', configFile, '-f', 'json', ...args])
  // oxlint prints something other than JSON when it cannot load the config.
  if (!stdout.trimStart().startsWith('{')) return { outcome: 'refused', output: `${stdout}${stderr}` }
  return { outcome: 'reported', report: parseOxlintJsonReport(stdout) }
}

/** oxlint's JSON report, holding every field the tests read. Parse boundary: oxlint's output. */
export function parseOxlintJsonReport(printed: string): OxlintJsonReport {
  const report: unknown = JSON.parse(printed)
  if (!isObject(report) || !('diagnostics' in report) || !Array.isArray(report.diagnostics)) {
    throw new Error(`oxlint's JSON report has no diagnostics: ${printed}`)
  }
  if (!('number_of_files' in report) || typeof report.number_of_files !== 'number') {
    throw new Error(`oxlint's JSON report has no number of files: ${printed}`)
  }
  return { diagnostics: report.diagnostics.map(diagnosticOf), number_of_files: report.number_of_files }
}

function diagnosticOf(diagnostic: unknown): OxlintJsonDiagnostic {
  if (!isObject(diagnostic) || !('filename' in diagnostic) || typeof diagnostic.filename !== 'string') {
    throw new Error(`oxlint reported a diagnostic with no file: ${JSON.stringify(diagnostic)}`)
  }
  const url = 'url' in diagnostic ? diagnostic.url : undefined
  if (url !== undefined && typeof url !== 'string') throw new Error(`oxlint reported a diagnostic whose url is no string: ${JSON.stringify(diagnostic)}`)
  if (!('labels' in diagnostic) || !Array.isArray(diagnostic.labels) || !diagnostic.labels.every(isLabel)) {
    throw new Error(`oxlint reported a diagnostic without labels that each give a line: ${JSON.stringify(diagnostic)}`)
  }
  return { filename: diagnostic.filename, ...(url === undefined ? {} : { url }), labels: diagnostic.labels }
}

function isLabel(label: unknown): label is OxlintJsonLabel {
  return isObject(label) && 'span' in label && isObject(label.span) && 'line' in label.span && typeof label.span.line === 'number'
}
