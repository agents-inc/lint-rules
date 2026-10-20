import { describe, expect, it } from 'vitest'
import { TSC_STDOUT_OPENING_ON_A_CHAINED_LINE, TSC_STDOUT_WITH_AN_ERROR_OF_NO_FILE, TSC_STDOUT_WITH_CHAINED_ERRORS, TSC_STDOUT_WITH_ONE_LINE_ERRORS } from './cases/tsc-stdouts.ts'
import { tscErrorsIn } from './tsc-errors.ts'

describe('tscErrorsIn', () => {
  it("gives each error's file, line, column, code and message, in the order printed", () => {
    expect(tscErrorsIn(TSC_STDOUT_WITH_ONE_LINE_ERRORS)).toStrictEqual([
      {
        file: 'agents-inc.lint.mts',
        line: 9,
        column: 34,
        code: 'TS2353',
        message: "Object literal may only specify known properties, and ''not-a/rule'' does not exist in type 'RuleSettings'.",
      },
      { file: 'agents-inc.lint.mts', line: 10, column: 52, code: 'TS2322', message: `Type '"nope"' is not assignable to type 'QualityRulesetName'.` },
    ])
  })

  it('joins each indented line to the message of the error above it, one line each', () => {
    expect(tscErrorsIn(TSC_STDOUT_WITH_CHAINED_ERRORS)).toStrictEqual([
      { file: 'agents-inc.lint.mts', line: 10, column: 7, code: 'TS2322', message: "Type 'number[]' is not assignable to type 'readonly string[]'.\nType 'number' is not assignable to type 'string'." },
      { file: 'agents-inc.lint.mts', line: 13, column: 7, code: 'TS2322', message: "Type '[]' is not assignable to type '[number]'.\nSource has 0 element(s) but target requires 1." },
    ])
  })

  it('gives none where tsc printed nothing', () => {
    expect(tscErrorsIn('')).toStrictEqual([])
  })

  it.each([
    { kind: 'an indented line before any error', stdout: TSC_STDOUT_OPENING_ON_A_CHAINED_LINE, line: '  Source has 0 element(s) but target requires 1.' },
    { kind: 'an error tsc gives no file', stdout: TSC_STDOUT_WITH_AN_ERROR_OF_NO_FILE, line: "error TS18003: No inputs were found in config file 'tsconfig.json'." },
  ])('throws on $kind, naming the line, so no output goes unread', ({ stdout, line }) => {
    expect(() => tscErrorsIn(stdout)).toThrow(new Error(`tsc printed a line that is part of no error: ${line}`))
  })
})
