import { describe, expect, it } from 'vitest'
import { linesOf } from '../../__tests__/check-output.ts'
import { EXIT } from '../../__tests__/cli-runs.ts'
import {
  buildCheckFinding,
  ERRORS_SUMMARY_TAIL,
  ERRORS_SUMMARY_TAIL_AFTER_A_CUT,
  findingLineOf,
  buildNotCheckedEntry,
  findingsOfLineLength,
  LINE_LENGTH_FILLING_THE_CAP_IN_80,
  NOT_EVERYTHING_CHECKED_SUMMARY,
  notCheckedAsGone,
  notCheckedByOxlint,
} from '../../__tests__/factories/check-factories.ts'
import { type CheckFinding, checkReport } from './report.ts'

function stdoutLinesOf(input: Parameters<typeof checkReport>[0]): string[] {
  return linesOf(checkReport(input).stdout)
}

describe('the report of findings', () => {
  it('prints errors sorted by path then line, a line 10 after a line 9, then the warnings sorted the same way, and exits 1', () => {
    const report = checkReport({
      findings: [
        buildCheckFinding({ file: 'src/b.ts', line: 3, label: 'no-console', severity: 'warning', message: 'w-b3' }),
        buildCheckFinding({ file: 'src/b.ts', line: 1, label: 'no-debugger', message: 'e-b1' }),
        buildCheckFinding({ file: 'src/a.ts', line: 10, label: 'no-debugger', message: 'e-a10' }),
        buildCheckFinding({ file: 'src/a.ts', line: 2, label: 'no-console', severity: 'warning', message: 'w-a2' }),
        buildCheckFinding({ file: 'src/a.ts', line: 9, label: 'no-var', message: 'e-a9' }),
      ],
      changedFileCount: 4,
      autofixedFiles: [], notChecked: [],
    })

    expect({ lines: linesOf(report.stdout), exitCode: report.exitCode }).toStrictEqual({
      lines: [
        'src/a.ts:9 no-var — e-a9',
        'src/a.ts:10 no-debugger — e-a10',
        'src/b.ts:1 no-debugger — e-b1',
        'src/a.ts:2 no-console (warning) — w-a2',
        'src/b.ts:3 no-console (warning) — w-b3',
        `check: 3 errors and 2 warnings in 2 of 4 changed files. ${ERRORS_SUMMARY_TAIL}`,
      ],
      exitCode: EXIT.findings,
    })
  })

  it('counts every error and warning in the summary, zero warnings included', () => {
    expect(
      stdoutLinesOf({
        findings: [buildCheckFinding({ file: 'src/a.ts', line: 1 }), buildCheckFinding({ file: 'src/b.ts', line: 1 })],
        changedFileCount: 3,
        autofixedFiles: [], notChecked: [],
      }).at(-1),
    ).toBe(`check: 2 errors and 0 warnings in 2 of 3 changed files. ${ERRORS_SUMMARY_TAIL}`)
  })

  it('uses the singular where a count is 1', () => {
    expect(
      stdoutLinesOf({
        findings: [buildCheckFinding({ line: 1 }), buildCheckFinding({ line: 2, severity: 'warning' })],
        changedFileCount: 1,
        autofixedFiles: [], notChecked: [],
      }).at(-1),
    ).toBe(`check: 1 error and 1 warning in 1 of 1 changed file. ${ERRORS_SUMMARY_TAIL}`)
  })

  it('prints a parse error as its own label and counts it as an error', () => {
    const report = checkReport({
      findings: [buildCheckFinding({ file: 'src/broken.ts', line: 4, label: 'parse error', message: 'Parsing error: Variable declaration expected.' })],
      changedFileCount: 1,
      autofixedFiles: [], notChecked: [],
    })

    expect({ lines: linesOf(report.stdout), exitCode: report.exitCode }).toStrictEqual({
      lines: [
        'src/broken.ts:4 parse error — Parsing error: Variable declaration expected.',
        `check: 1 error and 0 warnings in 1 of 1 changed file. ${ERRORS_SUMMARY_TAIL}`,
      ],
      exitCode: EXIT.findings,
    })
  })

  it('prints a finding about the whole file at line 0', () => {
    expect(
      stdoutLinesOf({
        findings: [buildCheckFinding({ file: 'src/empty.test.ts', line: 0, label: 'sonarjs/no-empty-test-file', message: 'm' })],
        changedFileCount: 1,
        autofixedFiles: [], notChecked: [],
      })[0],
    ).toBe('src/empty.test.ts:0 sonarjs/no-empty-test-file — m')
  })

  it('prints identical findings once and counts them once', () => {
    const finding = buildCheckFinding({ file: 'src/a.ts', line: 3, label: 'no-debugger', message: 'm' })

    expect(stdoutLinesOf({ findings: [finding, { ...finding }], changedFileCount: 1, autofixedFiles: [], notChecked: [] })).toStrictEqual([
      'src/a.ts:3 no-debugger — m',
      `check: 1 error and 0 warnings in 1 of 1 changed file. ${ERRORS_SUMMARY_TAIL}`,
    ])
  })

  it('prints two findings on one line of one file that differ only in rule, both', () => {
    expect(
      stdoutLinesOf({
        findings: [
          buildCheckFinding({ file: 'src/a.ts', line: 3, label: 'no-debugger', message: 'm' }),
          buildCheckFinding({ file: 'src/a.ts', line: 3, label: 'no-var', message: 'm' }),
        ],
        changedFileCount: 1,
        autofixedFiles: [], notChecked: [],
      }),
    ).toStrictEqual([
      'src/a.ts:3 no-debugger — m',
      'src/a.ts:3 no-var — m',
      `check: 2 errors and 0 warnings in 1 of 1 changed file. ${ERRORS_SUMMARY_TAIL}`,
    ])
  })
})

describe('the report without errors', () => {
  it('lists the warnings, exits 0, and says there are no errors', () => {
    const report = checkReport({
      findings: [
        buildCheckFinding({ file: 'src/a.ts', line: 5, severity: 'warning', message: 'w5' }),
        buildCheckFinding({ file: 'src/a.ts', line: 1, severity: 'warning', message: 'w1' }),
      ],
      changedFileCount: 3,
      autofixedFiles: [], notChecked: [],
    })

    expect({ lines: linesOf(report.stdout), exitCode: report.exitCode }).toStrictEqual({
      lines: [
        'src/a.ts:1 no-console (warning) — w1',
        'src/a.ts:5 no-console (warning) — w5',
        'check: no errors; 2 warnings in 1 of 3 changed files. The list is complete.',
      ],
      exitCode: EXIT.clean,
    })
  })

  it('uses the singular in the warnings-only summary where a count is 1', () => {
    expect(
      stdoutLinesOf({ findings: [buildCheckFinding({ severity: 'warning' })], changedFileCount: 1, autofixedFiles: [], notChecked: [] }).at(-1),
    ).toBe('check: no errors; 1 warning in 1 of 1 changed file. The list is complete.')
  })

  it('says there are no findings and exits 0 when there are none', () => {
    const report = checkReport({ findings: [], changedFileCount: 3, autofixedFiles: [], notChecked: [] })

    expect({ stdout: report.stdout, exitCode: report.exitCode }).toStrictEqual({
      stdout: 'check: no findings in 3 changed files.\n',
      exitCode: EXIT.clean,
    })
  })

  it('uses the singular when one file changed and nothing was found', () => {
    expect(checkReport({ findings: [], changedFileCount: 1, autofixedFiles: [], notChecked: [] }).stdout).toBe('check: no findings in 1 changed file.\n')
  })
})

describe('the autofixed line', () => {
  it('comes first, naming each file check changed', () => {
    expect(stdoutLinesOf({ findings: [], changedFileCount: 2, autofixedFiles: ['src/a.ts', 'src/b.ts'], notChecked: [] })).toStrictEqual([
      'check: autofixed src/a.ts, src/b.ts; read them again before editing them.',
      'check: no findings in 2 changed files.',
    ])
  })

  it('is left out when check changed no file', () => {
    expect(stdoutLinesOf({ findings: [], changedFileCount: 2, autofixedFiles: [], notChecked: [] })).toStrictEqual(['check: no findings in 2 changed files.'])
  })
})

describe('the cut', () => {
  // Each finding line is 99 characters, 100 with its newline: 80 lines fill 8,000 characters whether
  // or not the newlines count, and an 81st passes it either way.
  it('prints the findings that fit in 8,000 characters, then the +N line, and the summary still counts every finding', () => {
    const inA = findingsOfLineLength('src/a.ts', 100, LINE_LENGTH_FILLING_THE_CAP_IN_80)
    const inB = findingsOfLineLength('src/b.ts', 100, LINE_LENGTH_FILLING_THE_CAP_IN_80)

    expect(stdoutLinesOf({ findings: [...inB, ...inA], changedFileCount: 2, autofixedFiles: [], notChecked: [] })).toStrictEqual([
      ...inA.slice(0, 80).map(findingLineOf),
      '+120 more findings in 2 files. Fix the ones above, then run check again to see them.',
      `check: 200 errors and 0 warnings in 2 of 2 changed files. ${ERRORS_SUMMARY_TAIL_AFTER_A_CUT}`,
    ])
  })

  it('prints every finding, with no +N line, when they fill exactly 8,000 characters', () => {
    const findings = findingsOfLineLength('src/a.ts', 80, LINE_LENGTH_FILLING_THE_CAP_IN_80)

    expect(stdoutLinesOf({ findings, changedFileCount: 1, autofixedFiles: [], notChecked: [] })).toStrictEqual([
      ...findings.map(findingLineOf),
      `check: 80 errors and 0 warnings in 1 of 1 changed file. ${ERRORS_SUMMARY_TAIL}`,
    ])
  })

  it('counts the files of the findings it cuts, not of all of them, in the +N line', () => {
    const inA = findingsOfLineLength('src/a.ts', 81, LINE_LENGTH_FILLING_THE_CAP_IN_80)
    const inB = findingsOfLineLength('src/b.ts', 1, LINE_LENGTH_FILLING_THE_CAP_IN_80)

    expect(stdoutLinesOf({ findings: [...inA, ...inB], changedFileCount: 2, autofixedFiles: [], notChecked: [] }).at(-2)).toBe(
      '+2 more findings in 2 files. Fix the ones above, then run check again to see them.',
    )
  })

  it('still prints a first finding longer than 8,000 characters whole, and counts the rest as one more finding in one file', () => {
    const longMessage = 'x'.repeat(9_000)
    const lines = stdoutLinesOf({
      findings: [
        buildCheckFinding({ file: 'src/a.ts', line: 1, message: longMessage }),
        buildCheckFinding({ file: 'src/b.ts', line: 1, message: 'short' }),
      ],
      changedFileCount: 2,
      autofixedFiles: [], notChecked: [],
    })

    expect(lines).toStrictEqual([
      `src/a.ts:1 no-console — ${longMessage}`,
      '+1 more finding in 1 file. Fix the ones above, then run check again to see them.',
      `check: 2 errors and 0 warnings in 2 of 2 changed files. ${ERRORS_SUMMARY_TAIL_AFTER_A_CUT}`,
    ])
  })

  it('does not call the list complete under a cut where only warnings are left, and still exits 0', () => {
    // Each warning line is 109 characters, 110 with its newline: 72 fit in 8,000, and 28 are cut.
    const warnings = findingsOfLineLength('src/a.ts', 100, LINE_LENGTH_FILLING_THE_CAP_IN_80).map((finding): CheckFinding => ({ ...finding, severity: 'warning' }))
    const report = checkReport({ findings: warnings, changedFileCount: 1, autofixedFiles: [], notChecked: [] })

    expect({ lastLines: linesOf(report.stdout).slice(-2), exitCode: report.exitCode }).toStrictEqual({
      lastLines: ['+28 more findings in 1 file. Fix the ones above, then run check again to see them.', 'check: no errors; 100 warnings in 1 of 1 changed file.'],
      exitCode: EXIT.clean,
    })
  })
})

/** A run that autofixed a file and left no finding. */
function autofixOnlyReportWhereNotChecked(notChecked: Parameters<typeof checkReport>[0]['notChecked']): { readonly lines: string[]; readonly exitCode: number } {
  const report = checkReport({ findings: [], changedFileCount: 2, autofixedFiles: ['src/a.ts'], notChecked })
  return { lines: linesOf(report.stdout), exitCode: report.exitCode }
}

describe('what check could not check', () => {
  const GONE = buildNotCheckedEntry({ subject: 'src/b.ts', reason: 'it was deleted or replaced while check ran' })
  const OXLINT_CRASHED = 'it crashed'
  const OXLINT_FAILED = buildNotCheckedEntry({ subject: "oxlint's rules", reason: `oxlint failed: ${OXLINT_CRASHED}` })
  const LISTED = [notCheckedAsGone('src/b.ts'), notCheckedByOxlint(OXLINT_CRASHED)]

  it('lists each entry after the findings and the cut line, in the order given, before the summary, and exits 1 where an error is left', () => {
    const findings = findingsOfLineLength('src/a.ts', 81, LINE_LENGTH_FILLING_THE_CAP_IN_80)
    const report = checkReport({ findings, changedFileCount: 2, autofixedFiles: [], notChecked: [GONE, OXLINT_FAILED] })

    expect({ lines: linesOf(report.stdout), exitCode: report.exitCode }).toStrictEqual({
      lines: [
        ...findings.slice(0, 80).map(findingLineOf),
        '+1 more finding in 1 file. Fix the ones above, then run check again to see them.',
        ...LISTED,
        `check: 81 errors and 0 warnings in 1 of 2 changed files. ${ERRORS_SUMMARY_TAIL_AFTER_A_CUT}`,
      ],
      exitCode: EXIT.findings,
    })
  })

  it('does not call the list of errors complete where something was not checked, beside the list with nothing left unchecked, which it does', () => {
    const findings = [buildCheckFinding({ file: 'src/a.ts', line: 1 })]
    function summaryWhereNotChecked(notChecked: Parameters<typeof checkReport>[0]['notChecked']): string | undefined {
      return stdoutLinesOf({ findings, changedFileCount: 2, autofixedFiles: [], notChecked }).at(-1)
    }

    expect({ notChecked: summaryWhereNotChecked([GONE]), allChecked: summaryWhereNotChecked([]) }).toStrictEqual({
      notChecked: `check: 1 error and 0 warnings in 1 of 2 changed files. ${ERRORS_SUMMARY_TAIL_AFTER_A_CUT}`,
      allChecked: `check: 1 error and 0 warnings in 1 of 2 changed files. ${ERRORS_SUMMARY_TAIL}`,
    })
  })

  it('exits 2 where only warnings are left, not calling the list complete, beside the same warnings with everything checked, which exit 0', () => {
    const findings = [buildCheckFinding({ file: 'src/a.ts', line: 1, severity: 'warning' })]
    function reportWhereNotChecked(notChecked: Parameters<typeof checkReport>[0]['notChecked']): { readonly summary: string | undefined; readonly exitCode: number } {
      const report = checkReport({ findings, changedFileCount: 2, autofixedFiles: [], notChecked })
      return { summary: linesOf(report.stdout).at(-1), exitCode: report.exitCode }
    }

    expect({ notChecked: reportWhereNotChecked([OXLINT_FAILED]), allChecked: reportWhereNotChecked([]) }).toStrictEqual({
      notChecked: { summary: 'check: no errors; 1 warning in 1 of 2 changed files.', exitCode: EXIT.couldNotRun },
      allChecked: { summary: 'check: no errors; 1 warning in 1 of 2 changed files. The list is complete.', exitCode: EXIT.clean },
    })
  })

  it('says not everything was checked and exits 2 where no finding is left, beside the run with everything checked, which exits 0', () => {
    expect({ notChecked: autofixOnlyReportWhereNotChecked([GONE, OXLINT_FAILED]), allChecked: autofixOnlyReportWhereNotChecked([]) }).toStrictEqual({
      notChecked: {
        lines: ['check: autofixed src/a.ts; read them again before editing them.', ...LISTED, NOT_EVERYTHING_CHECKED_SUMMARY],
        exitCode: EXIT.couldNotRun,
      },
      allChecked: { lines: ['check: autofixed src/a.ts; read them again before editing them.', 'check: no findings in 2 changed files.'], exitCode: EXIT.clean },
    })
  })
})
