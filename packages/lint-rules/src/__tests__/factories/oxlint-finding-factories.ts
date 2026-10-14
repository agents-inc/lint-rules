import type { OxlintFinding } from '../engine-clis.ts'

/** The severities oxlint reports a finding at. */
type OxlintReportedSeverity = 'warning' | 'error'

/** A finding as the real oxlint CLI reports it: by file, under oxlint's code for the rule, on line 1 unless given. */
export function buildOxlintFinding(file: string, code: string, severity: OxlintReportedSeverity, line = 1): OxlintFinding {
  return { file, rule: code, line, severity }
}
