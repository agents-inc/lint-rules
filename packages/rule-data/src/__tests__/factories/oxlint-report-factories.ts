import type { OxlintJsonDiagnostic, OxlintJsonReport } from '../oxlint-trigger-runs.ts'

const RULE_PAGES = 'https://oxc.rs/docs/guide/usage/linter/rules'

/** A rule's finding in the file, as oxlint's JSON report gives it: with a link to the rule's page. */
export function buildRuleFinding(filename: string, rule = 'eslint/no-debugger'): OxlintJsonDiagnostic {
  return { filename, url: `${RULE_PAGES}/${rule}.html` }
}

/** A parse error in the file, as oxlint's JSON report gives it: with no link. */
export function buildParseError(filename: string): OxlintJsonDiagnostic {
  return { filename }
}

/** oxlint's JSON report holding the diagnostics, over the number of files given. */
export function buildOxlintJsonReport(diagnostics: readonly OxlintJsonDiagnostic[], numberOfFiles = 1): OxlintJsonReport {
  return { diagnostics, number_of_files: numberOfFiles }
}
