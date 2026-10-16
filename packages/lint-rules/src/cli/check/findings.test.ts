import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { A_RULE_REPORTING_NOTHING, A_SYNTAX_ERROR, aSuppressionPartlyUnused, movedDownByAnotherWriter } from '../../__tests__/cases/check-sources.ts'
import { SUPPRESSION_PAIR_CASES, type UnusedAt } from '../../__tests__/cases/suppression-pairs.ts'
import {
  A_SUPPRESSION_REASON,
  blockDisable,
  blockEnable,
  buildCheckFinding,
  buildFileReports,
  buildLintMessage,
  buildLintWarning,
  buildOxlintDiagnostic,
  buildOxlintWarning,
  DEBUGGER_STATEMENT,
  type EnableComment,
  ESLINT_FINDING_MESSAGE,
  eslintUnusedSuppression,
  eslintUnusedSuppressionText,
  exportedConstant,
  exportedElement,
  exportedString,
  linesChanged,
  moduleText,
  OXLINT_FINDING_MESSAGE,
  oxlintParseError,
  oxlintPartlyUnusedSuppression,
  oxlintUnusedEnable,
  oxlintUnusedSuppression,
  spanOfLine,
  spanOfTextOnLine,
  type SuppressionForm,
  suppressionOfTheNextLine,
  suppressionOfTheNextLineWithAReason,
  wholeFileChanged,
} from '../../__tests__/factories/check-factories.ts'
import { oxlintCodeOf } from '../../__tests__/oxlint-codes.ts'
import { type FileReports, findingsIn } from './findings.ts'
import type { OxlintDiagnostic } from './oxlint-output.ts'
import type { CheckFinding } from './report.ts'

// spec-cli.md "K: check", steps 14 and 15 (q-c9, q-c10, q-c15): of what both engines report on a
// file, check keeps what the change made. A finding counts by the line it starts on, and oxlint
// gives some findings at several places: a duplicate key at the first key and at its duplicate.

// A committed object an agent added a duplicate key to: oxlint's no-dupe-keys gives the first key
// (line 2) as its first place and the duplicate (line 4) as its second (measured, oxlint 1.87).
const WITH_A_DUPLICATE_KEY = ['export const LIMITS = {', '  small: 1,', '  large: 9,', '  small: 2,', '}']
const FIRST_KEY_LINE = 2
const UNCHANGED_LINE = 3
const DUPLICATE_LINE = 4
const DUPLICATE_KEY_TEXT = moduleText(...WITH_A_DUPLICATE_KEY)
const AT_BOTH_KEYS = buildOxlintDiagnostic(
  oxlintCodeOf('no-dupe-keys', catalog),
  spanOfLine(DUPLICATE_KEY_TEXT, FIRST_KEY_LINE),
  spanOfLine(DUPLICATE_KEY_TEXT, DUPLICATE_LINE),
)

/** The finding check prints for the duplicate key, at the line given. */
function duplicateKeyAt(line: number): CheckFinding {
  return buildCheckFinding({ line, label: 'no-dupe-keys', message: OXLINT_FINDING_MESSAGE })
}

describe('a finding oxlint gives at several places (q-c9)', () => {
  it('is kept where only a later place is on a changed line, and printed at that place', () => {
    const reports = buildFileReports({ lines: WITH_A_DUPLICATE_KEY, changed: linesChanged(DUPLICATE_LINE), oxlintDiagnostics: [AT_BOTH_KEYS] })

    expect(findingsIn(reports, catalog)).toStrictEqual([duplicateKeyAt(DUPLICATE_LINE)])
  })

  it('is printed at its first place where that one is on a changed line', () => {
    const reports = buildFileReports({ lines: WITH_A_DUPLICATE_KEY, changed: linesChanged(FIRST_KEY_LINE), oxlintDiagnostics: [AT_BOTH_KEYS] })

    expect(findingsIn(reports, catalog)).toStrictEqual([duplicateKeyAt(FIRST_KEY_LINE)])
  })

  it("is printed once, at its first place, where every place is the change's", () => {
    const reports = buildFileReports({ lines: WITH_A_DUPLICATE_KEY, changed: wholeFileChanged(), oxlintDiagnostics: [AT_BOTH_KEYS] })

    expect(findingsIn(reports, catalog)).toStrictEqual([duplicateKeyAt(FIRST_KEY_LINE)])
  })

  it('is dropped where none of its places is on a changed line, beside the change', () => {
    const reports = buildFileReports({ lines: WITH_A_DUPLICATE_KEY, changed: linesChanged(UNCHANGED_LINE), oxlintDiagnostics: [AT_BOTH_KEYS] })

    expect(findingsIn(reports, catalog)).toStrictEqual([])
  })
})

describe('findings of a rule a team set to warn (P4)', () => {
  // Each engine marks a finding of a rule set to warn as a warning, which check prints as one and
  // which alone does not fail the run; every other finding is an error.
  const LINES = [exportedConstant('before'), DEBUGGER_STATEMENT]
  const TEXT = moduleText(...LINES)

  it("reports each engine's warning as a warning, beside its error", () => {
    const reports = buildFileReports({
      lines: LINES,
      changed: wholeFileChanged(),
      eslintMessages: [buildLintWarning({ ruleId: 'object-shorthand', line: 1 }), buildLintMessage({ ruleId: 'no-var', line: 1 })],
      oxlintDiagnostics: [buildOxlintWarning(oxlintCodeOf('no-debugger', catalog), spanOfLine(TEXT, 2)), buildOxlintDiagnostic(oxlintCodeOf('no-empty', catalog), spanOfLine(TEXT, 2))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([
      buildCheckFinding({ line: 1, label: 'object-shorthand', severity: 'warning', message: ESLINT_FINDING_MESSAGE }),
      buildCheckFinding({ line: 1, label: 'no-var', severity: 'error', message: ESLINT_FINDING_MESSAGE }),
      buildCheckFinding({ line: 2, label: 'no-debugger', severity: 'warning', message: OXLINT_FINDING_MESSAGE }),
      buildCheckFinding({ line: 2, label: 'no-empty', severity: 'error', message: OXLINT_FINDING_MESSAGE }),
    ])
  })
})

describe("oxlint's own TypeScript syntax checks (step 14)", () => {
  // `TS(1036)`: a statement in a `.d.ts` file (measured, oxlint 1.87). The code names no rule.
  const TYPESCRIPT_SYNTAX_CODE = 'TS(1036)'
  const LINES = [exportedConstant('declared'), DEBUGGER_STATEMENT]
  const TEXT = moduleText(...LINES)

  it('reports one as a parse error of the file, whichever lines changed', () => {
    const reports = buildFileReports({ lines: LINES, changed: linesChanged(1), oxlintDiagnostics: [buildOxlintDiagnostic(TYPESCRIPT_SYNTAX_CODE, spanOfLine(TEXT, 2))] })

    expect(findingsIn(reports, catalog)).toStrictEqual([buildCheckFinding({ line: 2, label: 'parse error', message: OXLINT_FINDING_MESSAGE })])
  })

  it("reports a rule's code at the same place as that rule's finding, beside it", () => {
    const reports = buildFileReports({
      lines: LINES,
      changed: wholeFileChanged(),
      oxlintDiagnostics: [buildOxlintDiagnostic(oxlintCodeOf('no-debugger', catalog), spanOfLine(TEXT, 2))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([buildCheckFinding({ line: 2, label: 'no-debugger', message: OXLINT_FINDING_MESSAGE })])
  })
})

describe('unused suppressions, where suppressions are allowed (q-c15)', () => {
  const COMMENT_LINE = 2

  /** The file: a suppression comment on line 2, in the form given, of the rule named, then the line given. */
  function suppressingLines(form: SuppressionForm, ruleName: string, nextLine: string): string[] {
    return [exportedConstant('before'), suppressionOfTheNextLine(form, ruleName), nextLine]
  }

  function unusedSuppressionOf(ruleName: string): CheckFinding {
    return buildCheckFinding({ line: COMMENT_LINE, label: 'unused suppression', message: `suppresses ${ruleName}, which reported nothing here` })
  }

  it('reports an `oxlint-disable` comment oxlint calls unused, which ESLint never reads', () => {
    const lines = suppressingLines('oxlint', 'no-debugger', exportedConstant('after'))
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      oxlintDiagnostics: [oxlintUnusedSuppression('oxlint', spanOfLine(moduleText(...lines), COMMENT_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([unusedSuppressionOf('no-debugger')])
  })

  // oxlint spans the whole comment, its reason included (measured, 1.87).
  it('reads the names of an `oxlint-disable` comment oxlint calls unused up to the reason it gives after `--`', () => {
    const lines = [exportedConstant('before'), suppressionOfTheNextLineWithAReason('oxlint', 'no-debugger', A_SUPPRESSION_REASON), exportedConstant('after')]
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      oxlintDiagnostics: [oxlintUnusedSuppression('oxlint', spanOfLine(moduleText(...lines), COMMENT_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([unusedSuppressionOf('no-debugger')])
  })

  it("reports none where suppressions are banned, though oxlint calls an `oxlint-disable` comment unused there too, beside where they are allowed", () => {
    const lines = suppressingLines('oxlint', 'no-debugger', exportedConstant('after'))
    const unusedComment = oxlintUnusedSuppression('oxlint', spanOfLine(moduleText(...lines), COMMENT_LINE))
    const reportsWhereSuppressions = (suppressionsAllowed: boolean): CheckFinding[] =>
      findingsIn(buildFileReports({ lines, changed: wholeFileChanged(), suppressionsAllowed, oxlintDiagnostics: [unusedComment] }), catalog)

    expect({ banned: reportsWhereSuppressions(false), allowed: reportsWhereSuppressions(true) }).toStrictEqual({
      banned: [],
      allowed: [unusedSuppressionOf('no-debugger')],
    })
  })

  it('reports an `eslint-disable` comment both engines call unused', () => {
    const lines = suppressingLines('eslint', 'no-debugger', exportedConstant('after'))
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      eslintMessages: [eslintUnusedSuppression('no-debugger', COMMENT_LINE)],
      oxlintDiagnostics: [oxlintUnusedSuppression('eslint', spanOfLine(moduleText(...lines), COMMENT_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([unusedSuppressionOf('no-debugger')])
  })

  it('reports no `eslint-disable` comment only oxlint calls unused: ESLint, which runs the rule, used it', () => {
    const lines = suppressingLines('eslint', 'no-var', 'var after = 1')
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      oxlintDiagnostics: [oxlintUnusedSuppression('eslint', spanOfLine(moduleText(...lines), COMMENT_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([])
  })

  it("reads no rule's finding on a suppression comment as oxlint calling the comment unused", () => {
    // no-warning-comments, oxlint-run, reports the comment's "todo"; no-debugger, which oxlint runs,
    // used the comment; ESLint, which does not run no-debugger, calls it unused.
    const lines = [exportedConstant('before'), '// eslint-disable-next-line no-debugger -- todo: drop it', DEBUGGER_STATEMENT]
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      eslintMessages: [eslintUnusedSuppression('no-debugger', COMMENT_LINE)],
      oxlintDiagnostics: [buildOxlintDiagnostic(oxlintCodeOf('no-warning-comments', catalog), spanOfLine(moduleText(...lines), COMMENT_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([buildCheckFinding({ line: COMMENT_LINE, label: 'no-warning-comments', message: OXLINT_FINDING_MESSAGE })])
  })

  it("reads no rule's finding as oxlint calling a comment unused, whatever its message", () => {
    const lines = suppressingLines('oxlint', 'no-debugger', exportedConstant('after'))
    const span = spanOfLine(moduleText(...lines), COMMENT_LINE)
    const aRulesFinding = { ...buildOxlintDiagnostic(oxlintCodeOf('no-warning-comments', catalog), span), message: oxlintUnusedSuppression('oxlint', span).message }
    const reports = buildFileReports({ lines, changed: wholeFileChanged(), oxlintDiagnostics: [aRulesFinding] })

    expect(findingsIn(reports, catalog)).toStrictEqual([buildCheckFinding({ line: COMMENT_LINE, label: 'no-warning-comments', message: aRulesFinding.message })])
  })

  it("reads no rule's message as ESLint calling a comment unused, whatever its text", () => {
    const lines = suppressingLines('eslint', 'no-debugger', exportedConstant('after'))
    const aRulesMessage = { ...buildLintMessage({ ruleId: 'unicorn/comment-content', line: COMMENT_LINE }), message: eslintUnusedSuppressionText('no-debugger') }
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      eslintMessages: [aRulesMessage],
      oxlintDiagnostics: [oxlintUnusedSuppression('eslint', spanOfLine(moduleText(...lines), COMMENT_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([
      buildCheckFinding({ line: COMMENT_LINE, label: 'unicorn/comment-content', message: eslintUnusedSuppressionText('no-debugger') }),
    ])
  })
})

describe('enable comments oxlint calls unused (q-c10, q-c15)', () => {
  // oxlint reports an enable comment that turns back on nothing with no code, as it reports an
  // unused suppression (measured, 1.87). It is a report about a comment, never a parse error, so the
  // findings in the file stand. Only a disable comment suppresses anything, so it is no unused
  // suppression either. Whether check reports such a comment at all is an owner card: until it is
  // answered, check reports nothing on it.
  const ENABLE_LINE = 2
  const DEBUGGER_LINE = 3
  const STRAY_ENABLES: readonly { readonly enable: EnableComment; readonly naming: string }[] = (['eslint', 'oxlint'] as const).flatMap((form) => [
    { enable: { form, ruleName: 'no-debugger' }, naming: `${form} form, naming a rule` },
    { enable: { form, ruleName: null }, naming: `${form} form, naming no rule` },
  ])

  /** The file: an enable comment on line 2 that turns back on nothing, then a `debugger`, with oxlint's report of both. */
  function reportsBelowAStrayEnable(enable: EnableComment, suppressionsAllowed: boolean): FileReports {
    const lines = [exportedConstant('before'), blockEnable(enable), DEBUGGER_STATEMENT]
    const text = moduleText(...lines)
    return buildFileReports({
      lines,
      changed: wholeFileChanged(),
      suppressionsAllowed,
      oxlintDiagnostics: [oxlintUnusedEnable(enable, text, ENABLE_LINE), buildOxlintDiagnostic(oxlintCodeOf('no-debugger', catalog), spanOfLine(text, DEBUGGER_LINE))],
    })
  }

  const DEBUGGER_FINDING = buildCheckFinding({ line: DEBUGGER_LINE, label: 'no-debugger', message: OXLINT_FINDING_MESSAGE })

  it.each(STRAY_ENABLES)("reads one ($naming) as no parse error: reports the rule's finding below it, and nothing on the comment, where suppressions are allowed", ({ enable }) => {
    expect(findingsIn(reportsBelowAStrayEnable(enable, true), catalog)).toStrictEqual([DEBUGGER_FINDING])
  })

  it('reads one as no parse error where suppressions are banned too, beside a parse error, which it still reports', () => {
    // oxlint reports A_SYNTAX_ERROR's line 2 at its `=`.
    const BROKEN_LINE = 2
    const parseError = oxlintParseError(spanOfTextOnLine(moduleText(...A_SYNTAX_ERROR), BROKEN_LINE, '='))
    const broken = buildFileReports({ lines: A_SYNTAX_ERROR, changed: wholeFileChanged(), suppressionsAllowed: false, oxlintDiagnostics: [parseError] })

    expect({
      strayEnable: findingsIn(reportsBelowAStrayEnable({ form: 'eslint', ruleName: 'no-debugger' }, false), catalog),
      broken: findingsIn(broken, catalog),
    }).toStrictEqual({
      strayEnable: [DEBUGGER_FINDING],
      broken: [buildCheckFinding({ line: BROKEN_LINE, label: 'parse error', message: parseError.message })],
    })
  })
})

describe('unused block pairs, where suppressions are allowed (q-c15)', () => {
  // oxlint gives a `/* eslint-disable x */` … `/* eslint-enable x */` pair that silenced nothing at
  // its enable comment, and ESLint at its disable comment (measured, oxlint 1.87, ESLint 10.12). The
  // comment that suppresses is the disable one: each engine's report is read at its line, where the
  // two then agree, and the finding is printed there.
  const DISABLE_LINE = 1
  const ENABLE_LINE = 3
  const SECOND_DISABLE_LINE = 4
  const SECOND_ENABLE_LINE = 6

  function pairAround(form: SuppressionForm, ruleName: string, between: string): string[] {
    return [blockDisable(form, ruleName), between, blockEnable({ form, ruleName })]
  }

  function unusedSuppressionAt(line: number, ruleName: string): CheckFinding {
    return buildCheckFinding({ line, label: 'unused suppression', message: `suppresses ${ruleName}, which reported nothing here` })
  }

  it('reports an `eslint-disable` … `eslint-enable` pair both engines call unused once, at its disable comment', () => {
    const lines = pairAround('eslint', 'no-debugger', exportedConstant('between'))
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      eslintMessages: [eslintUnusedSuppression('no-debugger', DISABLE_LINE)],
      oxlintDiagnostics: [oxlintUnusedSuppression('eslint', spanOfLine(moduleText(...lines), ENABLE_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([unusedSuppressionAt(DISABLE_LINE, 'no-debugger')])
  })

  it('reports an `oxlint-disable` … `oxlint-enable` pair oxlint calls unused at its disable comment', () => {
    const lines = pairAround('oxlint', 'no-debugger', exportedConstant('between'))
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      oxlintDiagnostics: [oxlintUnusedSuppression('oxlint', spanOfLine(moduleText(...lines), ENABLE_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([unusedSuppressionAt(DISABLE_LINE, 'no-debugger')])
  })

  it('reports each of two pairs at its own disable comment', () => {
    const lines = [...pairAround('eslint', 'no-debugger', exportedConstant('first')), ...pairAround('eslint', 'no-debugger', exportedConstant('second'))]
    const text = moduleText(...lines)
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      eslintMessages: [eslintUnusedSuppression('no-debugger', DISABLE_LINE), eslintUnusedSuppression('no-debugger', SECOND_DISABLE_LINE)],
      oxlintDiagnostics: [oxlintUnusedSuppression('eslint', spanOfLine(text, ENABLE_LINE)), oxlintUnusedSuppression('eslint', spanOfLine(text, SECOND_ENABLE_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([unusedSuppressionAt(DISABLE_LINE, 'no-debugger'), unusedSuppressionAt(SECOND_DISABLE_LINE, 'no-debugger')])
  })

  it('reports no `eslint-disable` … `eslint-enable` pair only oxlint calls unused: ESLint, which runs the rule, used it', () => {
    const lines = pairAround('eslint', 'no-var', 'var between = 1')
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      oxlintDiagnostics: [oxlintUnusedSuppression('eslint', spanOfLine(moduleText(...lines), ENABLE_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([])
  })
})

describe('unused suppressions oxlint reports at an enable comment, read at the disable comment that turned the rule off (q-c15)', () => {
  // A comment that holds no directive.
  const A_PLAIN_COMMENT = '// the limits below are measured'
  // The line of aSuppressionPartlyUnused's comment.
  const PARTLY_UNUSED_LINE = 2
  // ESLint reads an `eslint-disable` comment and calls the name unused at its line; it never reads an `oxlint-disable` one.
  const MOVED_DOWN_CASES: readonly { readonly form: SuppressionForm; readonly eslintMessages: FileReports['eslintMessages'] }[] = [
    { form: 'eslint', eslintMessages: [eslintUnusedSuppression(A_RULE_REPORTING_NOTHING, PARTLY_UNUSED_LINE)] },
    { form: 'oxlint', eslintMessages: [] },
  ]

  // oxlint gives a disable comment an enable comment closes at the enable comment: the whole of it,
  // or the rule's name in it where another rule silenced something (measured, 1.87). The disable
  // comment is the first naming the rule since the last enable comment naming it above, whatever
  // the form of either.
  function unusedSuppressionsOf(unused: readonly UnusedAt[]): CheckFinding[] {
    return unused.map(({ line, ruleName }) =>
      buildCheckFinding({ line, label: 'unused suppression', message: `suppresses ${ruleName}, which reported nothing here` }),
    )
  }

  it.each(SUPPRESSION_PAIR_CASES)('reports $shape at the disable comment', ({ lines, oxlintReport, unusedInEslint, reported }) => {
    const reports = buildFileReports({
      lines,
      changed: wholeFileChanged(),
      eslintMessages: unusedInEslint.map(({ line, ruleName }) => eslintUnusedSuppression(ruleName, line)),
      oxlintDiagnostics: oxlintReport(moduleText(...lines)),
    })

    expect(findingsIn(reports, catalog)).toStrictEqual(unusedSuppressionsOf(reported))
  })

  // The pairing never refuses the run (decided 2026-10-15): oxlint's report and the text check reads can
  // disagree, as where another writer changed the file after oxlint linted it, and a refusal would
  // hide every finding of the run. A pair whose disable comment cannot be found is reported where
  // oxlint reports it.
  it("reports a name at oxlint's line where oxlint says an enable comment closes a disable comment of it, and none above names it", () => {
    const ENABLE_LINE = 3
    const lines = [blockDisable('oxlint', 'no-console'), exportedConstant('between'), blockEnable({ form: 'oxlint', ruleName: 'no-debugger' })]
    const reports = buildFileReports({ lines, changed: wholeFileChanged(), oxlintDiagnostics: [oxlintUnusedSuppression('oxlint', spanOfLine(moduleText(...lines), ENABLE_LINE))] })

    expect(findingsIn(reports, catalog)).toStrictEqual(unusedSuppressionsOf([{ line: ENABLE_LINE, ruleName: 'no-debugger' }]))
  })

  // The parser reads the file as the kind its path names: JSX in a `.tsx` file, which does not parse
  // as a `.ts` one.
  it('reads the comments of a `.tsx` file holding JSX, and reports its pair at the disable comment', () => {
    const TSX_FILE = 'src/view.tsx'
    const DISABLE_LINE = 1
    const ENABLE_LINE = 3
    const lines = [blockDisable('eslint', 'no-debugger'), exportedElement('view'), blockEnable({ form: 'eslint', ruleName: 'no-debugger' })]
    const reports = buildFileReports({
      file: TSX_FILE,
      lines,
      changed: wholeFileChanged(),
      eslintMessages: [eslintUnusedSuppression('no-debugger', DISABLE_LINE)],
      oxlintDiagnostics: [oxlintUnusedSuppression('eslint', spanOfLine(moduleText(...lines), ENABLE_LINE))],
    })

    expect(findingsIn(reports, catalog)).toStrictEqual([
      buildCheckFinding({ file: TSX_FILE, line: DISABLE_LINE, label: 'unused suppression', message: 'suppresses no-debugger, which reported nothing here' }),
    ])
  })

  // The engines may read a text check's parser cannot, as their parsers and options differ, though
  // no such text is known: each of 4 shapes the parser refused, oxlint refused too (measured, 1.87, 8.71).
  it("reports a name at oxlint's line where check's parser cannot read the text, rather than refusing the run", () => {
    const ENABLE_LINE = 5
    const lines = [blockDisable('oxlint', 'no-debugger, no-console'), DEBUGGER_STATEMENT, ...A_SYNTAX_ERROR, blockEnable({ form: 'oxlint', ruleName: 'no-debugger, no-console' })]
    const unused = oxlintPartlyUnusedSuppression('oxlint', 'no-console', spanOfTextOnLine(moduleText(...lines), ENABLE_LINE, 'no-console'))
    const reports = buildFileReports({ lines, changed: wholeFileChanged(), oxlintDiagnostics: [unused] })

    expect(findingsIn(reports, catalog)).toStrictEqual(unusedSuppressionsOf([{ line: ENABLE_LINE, ruleName: 'no-console' }]))
  })

  // oxlint reports on the text it read, which another writer may have changed since.
  it('reads a span covering the text of a whole comment as that comment where the text there is no comment now, and reports it at its line', () => {
    const QUOTED_LINE = 1
    const lines = [exportedString('quoted', blockDisable('oxlint', 'no-debugger'))]
    const span = spanOfTextOnLine(moduleText(...lines), QUOTED_LINE, blockDisable('oxlint', 'no-debugger'))
    const reports = buildFileReports({ lines, changed: wholeFileChanged(), oxlintDiagnostics: [oxlintUnusedSuppression('oxlint', span)] })

    expect(findingsIn(reports, catalog)).toStrictEqual(unusedSuppressionsOf([{ line: QUOTED_LINE, ruleName: 'no-debugger' }]))
  })

  it('reports no name where the whole comment at the span is no suppression comment now, as where another writer put a plain comment there', () => {
    const PLAIN_LINE = 2
    const lines = [exportedConstant('before'), A_PLAIN_COMMENT, exportedConstant('after')]
    const reports = buildFileReports({ lines, changed: wholeFileChanged(), oxlintDiagnostics: [oxlintUnusedSuppression('oxlint', spanOfLine(moduleText(...lines), PLAIN_LINE))] })

    expect(findingsIn(reports, catalog)).toStrictEqual([])
  })

  // oxlint's span on one name of a comment can fall where no comment is in the text check reads, as
  // where another writer changed the file after oxlint read it (cli review n3). ESLint's report
  // decides an `eslint-disable` comment's names, so the name there is read at oxlint's line; an
  // `oxlint-disable` comment's has only oxlint's word for it, on a text the file no longer holds, so
  // it is dropped (decided 2026-10-15). Neither refuses the run.
  it("reads a name no comment holds at oxlint's line in an `eslint-disable` comment's report: reports it where ESLint calls it unused on that line too, and nothing where ESLint does not", () => {
    const NAME_LINE = 1
    const lines = [exportedString('rule', A_RULE_REPORTING_NOTHING)]
    const unheld = oxlintPartlyUnusedSuppression('eslint', A_RULE_REPORTING_NOTHING, spanOfTextOnLine(moduleText(...lines), NAME_LINE, A_RULE_REPORTING_NOTHING))
    const reportsWhereEslintGives = (eslintMessages: FileReports['eslintMessages']): CheckFinding[] =>
      findingsIn(buildFileReports({ lines, changed: wholeFileChanged(), eslintMessages, oxlintDiagnostics: [unheld] }), catalog)

    expect({
      eslintCallsItUnused: reportsWhereEslintGives([eslintUnusedSuppression(A_RULE_REPORTING_NOTHING, NAME_LINE)]),
      eslintDoesNot: reportsWhereEslintGives([]),
    }).toStrictEqual({
      eslintCallsItUnused: unusedSuppressionsOf([{ line: NAME_LINE, ruleName: A_RULE_REPORTING_NOTHING }]),
      eslintDoesNot: [],
    })
  })

  it("drops a name no comment holds in an `oxlint-disable` comment's report, beside the name a comment holds, which it reports at its line", () => {
    const COMMENT_LINE = 1
    const STRING_LINE = 3
    const lines = [suppressionOfTheNextLine('oxlint', `no-debugger, ${A_RULE_REPORTING_NOTHING}`), DEBUGGER_STATEMENT, exportedString('rule', A_RULE_REPORTING_NOTHING)]
    const text = moduleText(...lines)
    const unusedAt = (line: number): OxlintDiagnostic =>
      oxlintPartlyUnusedSuppression('oxlint', A_RULE_REPORTING_NOTHING, spanOfTextOnLine(text, line, A_RULE_REPORTING_NOTHING))
    const reports = buildFileReports({ lines, changed: wholeFileChanged(), oxlintDiagnostics: [unusedAt(COMMENT_LINE), unusedAt(STRING_LINE)] })

    expect(findingsIn(reports, catalog)).toStrictEqual(unusedSuppressionsOf([{ line: COMMENT_LINE, ruleName: A_RULE_REPORTING_NOTHING }]))
  })

  // ESLint read the file in the fix step and oxlint in its last run, both before the writer: their
  // reports are on the comment at line 2, and check reads the text with the writer's line above it.
  it.each(MOVED_DOWN_CASES)(
    'reports nothing on a partly unused comment in the $form form another writer moved down after oxlint read it, refusing nothing, beside the same comment where it is, which it reports at its line',
    ({ form, eslintMessages }) => {
      const asOxlintReadIt = aSuppressionPartlyUnused(form)
      const unused = oxlintPartlyUnusedSuppression(form, A_RULE_REPORTING_NOTHING, spanOfTextOnLine(moduleText(...asOxlintReadIt), PARTLY_UNUSED_LINE, A_RULE_REPORTING_NOTHING))
      const reportsOn = (lines: readonly string[]): CheckFinding[] =>
        findingsIn(buildFileReports({ lines, changed: wholeFileChanged(), eslintMessages, oxlintDiagnostics: [unused] }), catalog)

      expect({ moved: reportsOn(movedDownByAnotherWriter(asOxlintReadIt)), inPlace: reportsOn(asOxlintReadIt) }).toStrictEqual({
        moved: [],
        inPlace: unusedSuppressionsOf([{ line: PARTLY_UNUSED_LINE, ruleName: A_RULE_REPORTING_NOTHING }]),
      })
    },
  )
})
