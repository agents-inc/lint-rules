import type { Catalog, OxlintRule } from '@workspace/rule-data'
import { ruleNameOf } from '@workspace/rule-data/rule-id-parts'
import { isRecord } from '../../core/is-record.ts'
import { readOnce } from '../../core/read-once.ts'
import { printedTextOf } from '../printed-lines.ts'
import { OXLINT_PRINTED_NOTHING, oxlintFailed } from './texts.ts'

export type OxlintSpan = { readonly line: number; readonly offset: number; readonly length: number }

/** `code` is null for a parse error or an unused suppression, which name no rule. */
export type OxlintDiagnostic = {
  readonly code: string | null
  readonly message: string
  readonly severity: string
  readonly filename: string
  readonly spans: readonly OxlintSpan[]
}

export type OxlintReport = { readonly diagnostics: readonly OxlintDiagnostic[] }

type OxlintOutput = { readonly stdout: string; readonly stderr: string }

type RawOxlintDiagnostic = {
  readonly code?: string
  readonly message: string
  readonly severity: string
  readonly filename: string
  readonly labels?: readonly { readonly span: OxlintSpan }[]
}

type RawOxlintReport = { readonly diagnostics: readonly RawOxlintDiagnostic[] }

type ReportRead = { readonly report: RawOxlintReport } | { readonly unreadable: unknown }

const ruleIdsByCodeOf = new WeakMap<Catalog, ReadonlyMap<string, string>>()

/** `eslint(no-debugger)` → its RuleId; a code the catalog does not record is printed as oxlint gives it. */
export function labelOfOxlintCode(code: string, catalog: Catalog): string {
  const ruleId = ruleIdsByCode(catalog).get(code)
  return ruleId === undefined ? code : ruleId
}

/**
 * oxlint exits 1 for findings and for a refused config alike (1.87), so only the output tells them
 * apart: anything but the report throws, quoting all oxlint printed.
 */
export function oxlintReportFrom({ stdout, stderr }: OxlintOutput): OxlintReport {
  const read = reportIn(stdout)
  if ('unreadable' in read) throw new Error(oxlintFailed(printedTextOf([stdout, stderr], OXLINT_PRINTED_NOTHING)), { cause: read.unreadable })
  return { diagnostics: read.report.diagnostics.map(diagnosticOf) }
}

function oxlintCodeOfRule({ oxlintName, oxlintPlugin }: OxlintRule): string {
  return `${oxlintPlugin}(${ruleNameOf(oxlintName)})`
}

function ruleIdsByCode(catalog: Catalog): ReadonlyMap<string, string> {
  return readOnce(ruleIdsByCodeOf, catalog, ruleIdsByCodeIn)
}

function ruleIdsByCodeIn({ oxlintRules }: Catalog): ReadonlyMap<string, string> {
  return new Map(oxlintRules.map((rule) => [oxlintCodeOfRule(rule), rule.id]))
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
