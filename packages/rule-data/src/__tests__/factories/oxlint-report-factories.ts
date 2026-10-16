import type { OxlintJsonDiagnostic, OxlintJsonReport } from '../oxlint-cli.ts'

const RULE_PAGES = 'https://oxc.rs/docs/guide/usage/linter/rules'
// Every diagnostic oxlint reports points somewhere; none of the outcomes read where.
const FIRST_LINE = [{ span: { line: 1 } }]

/** A rule's finding in the file, as oxlint's JSON report gives it: with a link to the rule's page. */
export function buildRuleFinding(filename: string, rule = 'eslint/no-debugger'): OxlintJsonDiagnostic {
  return { filename, url: `${RULE_PAGES}/${rule}.html`, labels: FIRST_LINE }
}

/** A parse error in the file, as oxlint's JSON report gives it: with no link. */
export function buildParseError(filename: string): OxlintJsonDiagnostic {
  return { filename, labels: FIRST_LINE }
}

/** oxlint's JSON report holding the diagnostics, over the number of files given. */
export function buildOxlintJsonReport(diagnostics: readonly OxlintJsonDiagnostic[], numberOfFiles = 1): OxlintJsonReport {
  return { diagnostics, number_of_files: numberOfFiles }
}

/** What oxlint prints for a report: the report as JSON, whatever its diagnostics hold. */
export function buildPrintedOxlintJsonReport(diagnostics: readonly unknown[], numberOfFiles = 1): string {
  return JSON.stringify({ diagnostics, number_of_files: numberOfFiles })
}

/** A printed report with no diagnostics lacking the field given, which a report oxlint printed never lacks. */
export function buildPrintedOxlintJsonReportWithout(field: keyof OxlintJsonReport): string {
  return JSON.stringify(Object.fromEntries(Object.entries(buildOxlintJsonReport([])).filter(([key]) => key !== field)))
}
