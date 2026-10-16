import { describe, expect, it } from 'vitest'

import { buildPrintedOutputWithoutRules, buildPrintedOxlintConfig } from './factories/oxlint-config-factories.ts'
import {
  buildOxlintJsonReport,
  buildParseError,
  buildPrintedOxlintJsonReport,
  buildPrintedOxlintJsonReportWithout,
  buildRuleFinding,
} from './factories/oxlint-report-factories.ts'
import { parseOxlintJsonReport, printedRuleNamesOf } from './oxlint-cli.ts'

describe('printedRuleNamesOf', () => {
  it('names every rule a printed config sets, in ascending code-unit order', () => {
    const printed = buildPrintedOxlintConfig(['typescript/no-explicit-any', 'eqeqeq', 'jsx_a11y/alt-text'])

    expect(printedRuleNamesOf(printed)).toStrictEqual(['eqeqeq', 'jsx_a11y/alt-text', 'typescript/no-explicit-any'])
  })

  it('names no rule for a printed config that sets none', () => {
    expect(printedRuleNamesOf(buildPrintedOxlintConfig([]))).toStrictEqual([])
  })

  it('throws on printed output without a rules object, quoting the output', () => {
    expect(() => printedRuleNamesOf(buildPrintedOutputWithoutRules())).toThrow(/no rules object: \{"plugins"/)
  })
})

describe('parseOxlintJsonReport', () => {
  it("gives each diagnostic's file, its link where it has one and its labels, and the number of files linted", () => {
    const diagnostics = [buildRuleFinding('a.ts'), buildParseError('b.js')]

    expect(parseOxlintJsonReport(buildPrintedOxlintJsonReport(diagnostics, 2))).toStrictEqual(buildOxlintJsonReport(diagnostics, 2))
  })

  it('throws on a report without diagnostics, or without the number of files, quoting the output', () => {
    expect(() => parseOxlintJsonReport(buildPrintedOxlintJsonReportWithout('diagnostics'))).toThrow(/has no diagnostics: \{"number_of_files"/)
    expect(() => parseOxlintJsonReport(buildPrintedOxlintJsonReportWithout('number_of_files'))).toThrow(/has no number of files: \{"diagnostics"/)
  })

  it('throws on a diagnostic with no file, with a link that is no string, or with a label giving no line, quoting the diagnostic', () => {
    const finding = buildRuleFinding('a.ts')

    expect(() => parseOxlintJsonReport(buildPrintedOxlintJsonReport([{ ...finding, filename: 1 }]))).toThrow(/with no file: \{"filename":1,/)
    expect(() => parseOxlintJsonReport(buildPrintedOxlintJsonReport([{ ...finding, url: 1 }]))).toThrow(/url is no string: \{"filename":"a\.ts","url":1,/)
    expect(() => parseOxlintJsonReport(buildPrintedOxlintJsonReport([{ ...finding, labels: [{ span: {} }] }]))).toThrow(/labels that each give a line: \{"filename":"a\.ts"/)
  })
})
