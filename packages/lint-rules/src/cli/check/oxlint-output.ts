import type { Catalog, OxlintRule } from '@workspace/rule-data'
import { isRecord } from '../../core/is-record.ts'
import { NOT_FOUND } from '../not-found.ts'
import { printedTextOf } from '../printed-lines.ts'
import { OXLINT_PRINTED_NOTHING, oxlintFailed } from './texts.ts'

/** Where a diagnostic is: its line, and its place in the file's text. */
export type OxlintSpan = { readonly line: number; readonly offset: number; readonly length: number }

/** One diagnostic of oxlint's JSON report: `code` null for a parse error or an unused suppression, which name no rule. */
export type OxlintDiagnostic = {
  readonly code: string | null
  readonly message: string
  readonly severity: string
  readonly filename: string
  readonly spans: readonly OxlintSpan[]
}

export type OxlintReport = { readonly diagnostics: readonly OxlintDiagnostic[] }

/** What the oxlint CLI printed to each stream. */
export type OxlintOutput = { readonly stdout: string; readonly stderr: string }

type RawOxlintDiagnostic = {
  readonly code?: string
  readonly message: string
  readonly severity: string
  readonly filename: string
  readonly labels?: readonly { readonly span: OxlintSpan }[]
}

type RawOxlintReport = { readonly diagnostics: readonly RawOxlintDiagnostic[] }

/** The report, or why oxlint's output is not one. */
type ReportRead = { readonly report: RawOxlintReport } | { readonly unreadable: unknown }

const PLUGIN_SEPARATOR = '/'

const ruleIdsByCodeOf = new WeakMap<Catalog, ReadonlyMap<string, string>>()

/** The RuleId oxlint reports under the code (`eslint(no-debugger)`), as the catalog records the oxlint we install: throws on a code it does not record. */
export function ruleIdOfOxlintCode(code: string, catalog: Catalog): string {
  const ruleId = ruleIdsByCode(catalog).get(code)
  if (ruleId === undefined) throw new Error(`oxlint reported the code ${code}, which no rule in the catalog has`)
  return ruleId
}

/**
 * oxlint's JSON report. oxlint exits 1 for findings and for a config it refuses alike (measured,
 * 1.87), so only the output tells them apart: anything but the report throws, quoting all oxlint
 * printed. A refusal gives its reason after a header line, and the reason is what tells a team which
 * of its settings oxlint refuses (read-q64).
 */
export function oxlintReportFrom({ stdout, stderr }: OxlintOutput): OxlintReport {
  const read = reportIn(stdout)
  if ('unreadable' in read) throw new Error(oxlintFailed(printedTextOf([stdout, stderr], OXLINT_PRINTED_NOTHING)), { cause: read.unreadable })
  return { diagnostics: read.report.diagnostics.map(diagnosticOf) }
}

/** The code oxlint reports a rule's findings under: its plugin, then its rule name in parentheses. */
function oxlintCodeOfRule({ oxlintName, oxlintPlugin }: OxlintRule): string {
  return `${oxlintPlugin}(${ruleNameWithoutPlugin(oxlintName)})`
}

/** The rule's name after its plugin's, where oxlint's name for it starts with one. */
function ruleNameWithoutPlugin(oxlintName: string): string {
  const separator = oxlintName.indexOf(PLUGIN_SEPARATOR)
  return separator === NOT_FOUND ? oxlintName : oxlintName.slice(separator + PLUGIN_SEPARATOR.length)
}

function ruleIdsByCode(catalog: Catalog): ReadonlyMap<string, string> {
  const known = ruleIdsByCodeOf.get(catalog)
  if (known !== undefined) return known
  const made = new Map(catalog.oxlintRules.map((rule) => [oxlintCodeOfRule(rule), rule.id]))
  ruleIdsByCodeOf.set(catalog, made)
  return made
}

function diagnosticOf({ code, message, severity, filename, labels = [] }: RawOxlintDiagnostic): OxlintDiagnostic {
  return { code: code === undefined ? null : code, message, severity, filename, spans: labels.map(({ span }) => span) }
}

/** Parse boundary: oxlint's `-f json` output. */
function reportIn(stdout: string): ReportRead {
  try {
    const parsed: unknown = JSON.parse(stdout)
    if (!hasDiagnostics(parsed)) return { unreadable: new Error('the JSON oxlint printed has no diagnostics') }
    return { report: parsed as RawOxlintReport }
  } catch (error) {
    return { unreadable: error }
  }
}

function hasDiagnostics(parsed: unknown): boolean {
  return isRecord(parsed) && Array.isArray(parsed['diagnostics'])
}
