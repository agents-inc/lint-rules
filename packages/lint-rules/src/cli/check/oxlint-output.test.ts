import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import {
  NO_CONSOLE_OPTION_OXLINT_REFUSES,
  OXLINT_REFUSAL_OF_A_RULE,
  OXLINT_REFUSAL_OF_AN_OPTION,
  RULE_OXLINT_DOES_NOT_HAVE,
} from '../../__tests__/cases/oxlint-refusals.ts'
import { moduleText } from '../../__tests__/factories/check-factories.ts'
import { oxlintCodeOfRule } from '../../__tests__/oxlint-codes.ts'
import { rawOxlintOutput } from '../../__tests__/oxlint-raw-output.ts'
import { allowEveryTestForParallelLoad } from '../../__tests__/parallel-load.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { labelOfOxlintCode, oxlintReportFrom } from './oxlint-output.ts'

// oxlint exits 1 for findings and for a refused config alike, so check reads its JSON report, never its exit code.

allowEveryTestForParallelLoad()

const REFUSED_CONFIG = 'refused.json'
const REFUSED_OPTION_CONFIG = 'refused-option.json'
const ACCEPTED_CONFIG = 'accepted.json'
const LINTED_FILE = 'src/a.ts'
// oxlint 1.87 printed its refusals on stdout alone; this stands in for anything it adds on stderr.
const A_LINE_ON_STDERR = 'a line oxlint printed on stderr'
const JSON_HOLDING_NO_REPORT = [JSON.stringify({ number_of_files: 1 }), JSON.stringify({ diagnostics: {} }), JSON.stringify([])]
// oxlint's JSON leaves `code` out where a diagnostic names no rule, and its type lets `labels` be left out too.
const A_DIAGNOSTIC_NAMING_NO_RULE_AND_NO_PLACE = { message: 'a diagnostic tied to no rule and no place', severity: 'error', filename: 'src/a.ts' }
// A place as oxlint 1.87 writes it: offset and length in UTF-8 bytes, then the line and column.
const A_SPAN = { offset: 0, length: 8, line: 1, column: 1 }
const A_WELL_FORMED_DIAGNOSTIC = { code: 'eslint(no-debugger)', message: '`debugger` statement is not allowed', severity: 'error', filename: 'src/a.ts', labels: [{ span: A_SPAN }] }
// Each is read beside the well-formed diagnostic, so a check that passes a report where one diagnostic is well formed fails.
const DIAGNOSTICS_OXLINT_NEVER_WRITES = [
  { shape: 'that is no object', diagnostic: 'src/a.ts' },
  { shape: 'that is null', diagnostic: null },
  { shape: 'with no message', diagnostic: { severity: 'error', filename: 'src/a.ts' } },
  { shape: 'with no severity', diagnostic: { message: 'a message', filename: 'src/a.ts' } },
  { shape: 'with no file name', diagnostic: { message: 'a message', severity: 'error' } },
  { shape: 'whose code is no text', diagnostic: { code: 1, message: 'a message', severity: 'error', filename: 'src/a.ts' } },
  { shape: 'whose labels are no list', diagnostic: { message: 'a message', severity: 'error', filename: 'src/a.ts', labels: {} } },
  { shape: 'whose label is no object', diagnostic: { message: 'a message', severity: 'error', filename: 'src/a.ts', labels: ['a label'] } },
  { shape: 'whose second label has no span', diagnostic: { message: 'a message', severity: 'error', filename: 'src/a.ts', labels: [{ span: A_SPAN }, {}] } },
  { shape: 'whose span is null', diagnostic: { message: 'a message', severity: 'error', filename: 'src/a.ts', labels: [{ span: null }] } },
  { shape: 'whose span has no line', diagnostic: { message: 'a message', severity: 'error', filename: 'src/a.ts', labels: [{ span: { offset: 0, length: 8 } }] } },
  { shape: 'whose span gives its line as text', diagnostic: { message: 'a message', severity: 'error', filename: 'src/a.ts', labels: [{ span: { offset: 0, length: 8, line: '1' } }] } },
]

const tempProjects = setUpTempProjects()
const PROJECT = tempProjects.create({
  files: {
    [REFUSED_CONFIG]: JSON.stringify({ rules: { [RULE_OXLINT_DOES_NOT_HAVE]: 'error' } }),
    [REFUSED_OPTION_CONFIG]: JSON.stringify({ rules: { 'no-console': ['error', NO_CONSOLE_OPTION_OXLINT_REFUSES] } }),
    [ACCEPTED_CONFIG]: JSON.stringify({ rules: { 'no-debugger': 'error' } }),
    [LINTED_FILE]: moduleText('debugger'),
  },
})

describe('labelOfOxlintCode', () => {
  it('gives every rule oxlint has, as the catalog records the oxlint we install, back from its code', () => {
    const misread = catalog.oxlintRules.filter((rule) => labelOfOxlintCode(oxlintCodeOfRule(rule), catalog) !== rule.id)

    expect(misread).toStrictEqual([])
  })

  it('gives a code no rule in the catalog has as oxlint wrote it, beside those rules, which it gives as their IDs', () => {
    expect(labelOfOxlintCode('eslint(no-such-rule)', catalog)).toBe('eslint(no-such-rule)')
  })
})

describe('oxlintReportFrom', () => {
  it("gives the report's diagnostics where oxlint linted, though it exits 1 for the finding", () => {
    const output = rawOxlintOutput(PROJECT, ACCEPTED_CONFIG, [LINTED_FILE])

    expect({ exitCode: output.exitCode, codes: oxlintReportFrom(output).diagnostics.map(({ code }) => code) }).toStrictEqual({
      exitCode: 1,
      codes: ['eslint(no-debugger)'],
    })
  })

  it.each([
    { refused: 'a rule it does not have', config: REFUSED_CONFIG, printed: OXLINT_REFUSAL_OF_A_RULE },
    { refused: 'a rule option it refuses', config: REFUSED_OPTION_CONFIG, printed: OXLINT_REFUSAL_OF_AN_OPTION },
  ])('refuses what oxlint printed for a config naming $refused, quoting all of it, the reason included, though it exits 1 there too', ({ config, printed }) => {
    const output = rawOxlintOutput(PROJECT, config, [LINTED_FILE])

    expect(output.exitCode).toBe(1)
    expect(() => oxlintReportFrom(output)).toThrow(new Error(`oxlint failed: ${printed}`))
  })

  it('quotes what oxlint printed on stdout first, then what it printed on stderr', () => {
    expect(() => oxlintReportFrom({ stdout: OXLINT_REFUSAL_OF_A_RULE, stderr: A_LINE_ON_STDERR })).toThrow(
      new Error(`oxlint failed: ${OXLINT_REFUSAL_OF_A_RULE}\n${A_LINE_ON_STDERR}`),
    )
  })

  it.each(JSON_HOLDING_NO_REPORT)('refuses JSON that holds no list of diagnostics, quoting it: %s', (stdout) => {
    expect(() => oxlintReportFrom({ stdout, stderr: '' })).toThrow(new Error(`oxlint failed: ${stdout}`))
  })

  it('reads a diagnostic that leaves out its code and its places as one naming no rule and no place, not as a report it refuses', () => {
    const { message, severity, filename } = A_DIAGNOSTIC_NAMING_NO_RULE_AND_NO_PLACE

    expect(oxlintReportFrom({ stdout: JSON.stringify({ diagnostics: [A_DIAGNOSTIC_NAMING_NO_RULE_AND_NO_PLACE] }), stderr: '' })).toStrictEqual({
      diagnostics: [{ code: null, message, severity, filename, spans: [] }],
    })
  })

  it.each(DIAGNOSTICS_OXLINT_NEVER_WRITES)('refuses a report holding a diagnostic $shape, quoting it all, beside a well-formed one', ({ diagnostic }) => {
    const stdout = JSON.stringify({ diagnostics: [A_WELL_FORMED_DIAGNOSTIC, diagnostic] })

    expect(() => oxlintReportFrom({ stdout, stderr: '' })).toThrow(new Error(`oxlint failed: ${stdout}`))
  })

  it('reads a report of well-formed diagnostics alone, each place its span, beside those', () => {
    const { code, message, severity, filename } = A_WELL_FORMED_DIAGNOSTIC

    expect(oxlintReportFrom({ stdout: JSON.stringify({ diagnostics: [A_WELL_FORMED_DIAGNOSTIC] }), stderr: '' })).toStrictEqual({
      diagnostics: [{ code, message, severity, filename, spans: [A_SPAN] }],
    })
  })

  it('says oxlint printed nothing where it printed nothing', () => {
    expect(() => oxlintReportFrom({ stdout: '', stderr: '' })).toThrow(new Error('oxlint failed: it printed nothing'))
  })
})
