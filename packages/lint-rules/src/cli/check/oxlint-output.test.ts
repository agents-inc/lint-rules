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
import { oxlintReportFrom, ruleIdOfOxlintCode } from './oxlint-output.ts'

// spec-cli.md "K: check", steps 13 and 14, K-15 and K-16: check reads oxlint's JSON report, never
// its exit code, which is 1 for findings and for a config oxlint refuses alike; and it names each
// finding by the RuleId oxlint's code stands for.

allowEveryTestForParallelLoad()

const REFUSED_CONFIG = 'refused.json'
const REFUSED_OPTION_CONFIG = 'refused-option.json'
const ACCEPTED_CONFIG = 'accepted.json'
const LINTED_FILE = 'src/a.ts'
// oxlint printed its refusals on stdout alone (measured, 1.87); this stands in for anything it adds on stderr.
const A_LINE_ON_STDERR = 'a line oxlint printed on stderr'
// JSON that is no report: an object without the list of diagnostics, one whose diagnostics are no list, and an array.
const JSON_HOLDING_NO_REPORT = [JSON.stringify({ number_of_files: 1 }), JSON.stringify({ diagnostics: {} }), JSON.stringify([])]

const tempProjects = setUpTempProjects()
const PROJECT = tempProjects.create({
  files: {
    [REFUSED_CONFIG]: JSON.stringify({ rules: { [RULE_OXLINT_DOES_NOT_HAVE]: 'error' } }),
    [REFUSED_OPTION_CONFIG]: JSON.stringify({ rules: { 'no-console': ['error', NO_CONSOLE_OPTION_OXLINT_REFUSES] } }),
    [ACCEPTED_CONFIG]: JSON.stringify({ rules: { 'no-debugger': 'error' } }),
    [LINTED_FILE]: moduleText('debugger'),
  },
})

describe('ruleIdOfOxlintCode', () => {
  it('gives every rule oxlint has, as the catalog records the oxlint we install, back from its code', () => {
    const misread = catalog.oxlintRules.filter((rule) => ruleIdOfOxlintCode(oxlintCodeOfRule(rule), catalog) !== rule.id)

    expect(misread).toStrictEqual([])
  })

  it('refuses a code no rule in the catalog has, naming it', () => {
    expect(() => ruleIdOfOxlintCode('eslint(no-such-rule)', catalog)).toThrowError(/eslint\(no-such-rule\)/u)
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
    expect(() => oxlintReportFrom(output)).toThrowError(new Error(`oxlint failed: ${printed}`))
  })

  it('quotes what oxlint printed on stdout first, then what it printed on stderr', () => {
    expect(() => oxlintReportFrom({ stdout: OXLINT_REFUSAL_OF_A_RULE, stderr: A_LINE_ON_STDERR })).toThrowError(
      new Error(`oxlint failed: ${OXLINT_REFUSAL_OF_A_RULE}\n${A_LINE_ON_STDERR}`),
    )
  })

  it.each(JSON_HOLDING_NO_REPORT)('refuses JSON that holds no list of diagnostics, quoting it: %s', (stdout) => {
    expect(() => oxlintReportFrom({ stdout, stderr: '' })).toThrowError(new Error(`oxlint failed: ${stdout}`))
  })

  it('says oxlint printed nothing where it printed nothing', () => {
    expect(() => oxlintReportFrom({ stdout: '', stderr: '' })).toThrowError(new Error('oxlint failed: it printed nothing'))
  })
})
