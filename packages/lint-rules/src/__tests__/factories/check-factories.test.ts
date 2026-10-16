import { describe, expect, it } from 'vitest'
import { type OxlintDiagnostic, oxlintReportFrom } from '../../cli/check/oxlint-output.ts'
import { A_SYNTAX_ERROR } from '../cases/check-sources.ts'
import { SUPPRESSION_PAIR_CASES } from '../cases/suppression-pairs.ts'
import { rawOxlintOutput } from '../oxlint-raw-output.ts'
import { setUpTempProjects } from '../temp-projects.ts'
import {
  A_SUPPRESSION_REASON,
  blockDisable,
  blockEnable,
  type EnableComment,
  exportedConstant,
  moduleText,
  oxlintParseError,
  oxlintUnusedEnable,
  oxlintUnusedSuppression,
  REPORTED_FILE,
  spanOfLine,
  spanOfTextOnLine,
  type SuppressionForm,
  suppressionOfTheNextLine,
  suppressionOfTheNextLineWithAReason,
} from './check-factories.ts'

// The factories that stand in for oxlint's report in check's unit tests are test data themselves:
// each is checked here against what the real oxlint reports for the same text.

const CONFIG = 'unused-reported.json'
const COMMENT_LINE = 2
const FORMS: readonly { readonly form: SuppressionForm }[] = [{ form: 'eslint' }, { form: 'oxlint' }]

const ENABLE_COMMENTS: readonly { readonly enable: EnableComment; readonly naming: string }[] = FORMS.flatMap(({ form }) => [
  { enable: { form, ruleName: 'no-debugger' }, naming: `${form} form, naming no-debugger` },
  { enable: { form, ruleName: null }, naming: `${form} form, naming no rule` },
])
const PAIR_ENABLE_LINE = 3
const BROKEN_LINE = 2

const tempProjects = setUpTempProjects()

/** oxlint's report on the text, as check reads it, each span as oxlint gives it. */
function oxlintReportOn(text: string): OxlintDiagnostic[] {
  const projectDir = tempProjects.create({
    files: {
      [CONFIG]: JSON.stringify({ rules: { 'no-debugger': 'error' }, options: { reportUnusedDisableDirectives: 'error' } }),
      [REPORTED_FILE]: text,
    },
  })
  return oxlintReportFrom(rawOxlintOutput(projectDir, CONFIG, [REPORTED_FILE])).diagnostics.map(({ spans, ...diagnostic }) => ({
    ...diagnostic,
    spans: spans.map(({ line, offset, length }) => ({ line, offset, length })),
  }))
}

describe("oxlint's report of a suppression comment that silenced nothing", () => {
  it.each(FORMS)('is what oxlintUnusedSuppression and spanOfLine give, in the $form form', ({ form }) => {
    const text = moduleText(exportedConstant('before'), suppressionOfTheNextLine(form, 'no-debugger'), exportedConstant('after'))

    expect(oxlintReportOn(text)).toStrictEqual([oxlintUnusedSuppression(form, spanOfLine(text, COMMENT_LINE))])
  })

  it.each(FORMS)('is what oxlintUnusedSuppression and spanOfLine give for a comment giving a reason, in the $form form', ({ form }) => {
    const text = moduleText(exportedConstant('before'), suppressionOfTheNextLineWithAReason(form, 'no-debugger', A_SUPPRESSION_REASON), exportedConstant('after'))

    expect(oxlintReportOn(text)).toStrictEqual([oxlintUnusedSuppression(form, spanOfLine(text, COMMENT_LINE))])
  })

  it.each(FORMS)("is what oxlintUnusedSuppression and spanOfLine give at a block pair's enable comment, in the $form form", ({ form }) => {
    const text = moduleText(blockDisable(form, 'no-debugger'), exportedConstant('between'), blockEnable({ form, ruleName: 'no-debugger' }))

    expect(oxlintReportOn(text)).toStrictEqual([oxlintUnusedSuppression(form, spanOfLine(text, PAIR_ENABLE_LINE))])
  })
})

describe("oxlint's report of disable comments, one closed by an enable comment, that silenced nothing", () => {
  it.each(SUPPRESSION_PAIR_CASES)('is what the case gives for $shape', ({ lines, oxlintReport }) => {
    const text = moduleText(...lines)

    expect(oxlintReportOn(text)).toStrictEqual(oxlintReport(text))
  })
})

describe("oxlint's report of an enable comment that turns back on nothing", () => {
  it.each(ENABLE_COMMENTS)('is what oxlintUnusedEnable gives, in the $naming', ({ enable }) => {
    const text = moduleText(exportedConstant('before'), blockEnable(enable), exportedConstant('after'))

    expect(oxlintReportOn(text)).toStrictEqual([oxlintUnusedEnable(enable, text, COMMENT_LINE)])
  })
})

describe("oxlint's report of a parse error", () => {
  it('is what oxlintParseError gives, at the token it could not read', () => {
    const text = moduleText(...A_SYNTAX_ERROR)

    expect(oxlintReportOn(text)).toStrictEqual([oxlintParseError(spanOfTextOnLine(text, BROKEN_LINE, '='))])
  })
})
