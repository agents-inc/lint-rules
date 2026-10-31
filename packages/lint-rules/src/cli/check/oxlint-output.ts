import type { Catalog, OxlintRule } from '@workspace/rule-data'
import { ruleNameOf } from '@workspace/rule-data/rule-id-parts'
import { isRecord } from '../../core/is-record.ts'
import { namedGroupOf } from '../../core/named-groups.ts'
import { readOnce } from '../../core/read-once.ts'
import { printedTextOf } from '../printed-lines.ts'
import { textOfFileAt } from './fix-writes.ts'
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

type RawOxlintLabel = { readonly span: OxlintSpan }

/** oxlint leaves `code` out where a diagnostic names no rule (1.87); its type lets it leave `labels` out too. */
type RawOxlintDiagnostic = {
  readonly code?: string
  readonly message: string
  readonly severity: string
  readonly filename: string
  readonly labels?: readonly RawOxlintLabel[]
}

type RawOxlintReport = { readonly diagnostics: readonly RawOxlintDiagnostic[] }

type ReportRead = { readonly report: RawOxlintReport } | Unreadable

type JsonRead = { readonly json: unknown } | Unreadable

type Unreadable = { readonly unreadable: unknown }

const SPAN_PLACES = ['line', 'offset', 'length'] as const satisfies ReadonlyArray<keyof OxlintSpan>
// oxlint names a file it could not open in the message alone, with no `filename`, `code` or place (1.87).
const COULD_NOT_OPEN = /^Failed to open file (?<path>.+) with error "/u
const NO_DIAGNOSTICS_IN_THE_JSON = 'the JSON oxlint printed has no diagnostics'

const ruleIdsByCodeOf = new WeakMap<Catalog, ReadonlyMap<string, string>>()

/** `eslint(no-debugger)` → its RuleId; a code the catalog does not record is printed as oxlint gives it. */
export function labelOfOxlintCode(code: string, catalog: Readonly<Catalog>): string {
  const ruleId = ruleIdsByCode(catalog).get(code)
  return ruleId === undefined ? code : ruleId
}

/**
 * oxlint exits 1 for findings and for a refused config alike (1.87), so only the output tells them
 * apart: anything but the report throws, quoting all oxlint printed. A file gone before oxlint opened
 * it is no failure of oxlint's: check lists that file itself, as it finds it gone.
 */
export function oxlintReportFrom({ stdout, stderr }: OxlintOutput): OxlintReport {
  const read = reportIn(stdout)
  if ('unreadable' in read) throw new Error(oxlintFailed(printedTextOf([stdout, stderr], OXLINT_PRINTED_NOTHING)), { cause: read.unreadable })
  return { diagnostics: read.report.diagnostics.map(diagnosticOf) }
}

function oxlintCodeOfRule({ oxlintName, oxlintPlugin }: OxlintRule): string {
  return `${oxlintPlugin}(${ruleNameOf(oxlintName)})`
}

function ruleIdsByCode(catalog: Readonly<Catalog>): ReadonlyMap<string, string> {
  return readOnce(ruleIdsByCodeOf, catalog, ruleIdsByCodeIn)
}

function ruleIdsByCodeIn({ oxlintRules }: Readonly<Catalog>): ReadonlyMap<string, string> {
  return new Map(oxlintRules.map((rule) => [oxlintCodeOfRule(rule), rule.id]))
}

function diagnosticOf({ code, message, severity, filename, labels = [] }: RawOxlintDiagnostic): OxlintDiagnostic {
  return { code: code === undefined ? null : code, message, severity, filename, spans: labels.map(({ span }) => span) }
}

/** Parse boundary: oxlint's `-f json` output. */
function reportIn(stdout: string): ReportRead {
  const read = jsonIn(stdout)
  if ('unreadable' in read) return read
  const entries = isRecord(read.json) ? read.json.diagnostics : undefined
  if (!isList(entries)) return { unreadable: new Error(NO_DIAGNOSTICS_IN_THE_JSON) }
  const diagnostics = entries.filter((entry) => !isAGoneFileOxlintCouldNotOpen(entry))
  if (!diagnostics.every(isRawOxlintDiagnostic)) return { unreadable: new Error(NO_DIAGNOSTICS_IN_THE_JSON) }
  return { report: { diagnostics } }
}

function jsonIn(stdout: string): JsonRead {
  try {
    const json: unknown = JSON.parse(stdout)
    return { json }
  } catch (error) {
    return { unreadable: error }
  }
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

/** check read each file it names to oxlint, so one oxlint could not open and check now finds no file at went while check ran. */
function isAGoneFileOxlintCouldNotOpen(entry: unknown): boolean {
  const path = pathOxlintCouldNotOpen(entry)
  return path !== null && textOfFileAt(path) === null
}

function pathOxlintCouldNotOpen(entry: unknown): string | null {
  const message = isRecord(entry) ? entry.message : undefined
  const couldNotOpen = isText(message) ? COULD_NOT_OPEN.exec(message) : null
  return couldNotOpen === null ? null : namedGroupOf(couldNotOpen, 'path')
}

function isRawOxlintDiagnostic(diagnostic: unknown): diagnostic is RawOxlintDiagnostic {
  if (!isRecord(diagnostic)) return false
  const { code, message, severity, filename, labels } = diagnostic
  return isOptional(code, isText) && [message, severity, filename].every(isText) && isOptional(labels, isListOfLabels)
}

function isOptional(value: unknown, isGiven: (given: unknown) => boolean): boolean {
  return value === undefined || isGiven(value)
}

function isListOfLabels(labels: unknown): labels is readonly RawOxlintLabel[] {
  return Array.isArray(labels) && labels.every((label) => isRecord(label) && isOxlintSpan(label['span']))
}

function isOxlintSpan(span: unknown): span is OxlintSpan {
  return isRecord(span) && SPAN_PLACES.every((place) => typeof span[place] === 'number')
}

function isText(value: unknown): value is string {
  return typeof value === 'string'
}
