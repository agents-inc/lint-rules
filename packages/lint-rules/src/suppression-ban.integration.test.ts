import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  bareTsExpectError,
  CLASSIC_LOOP_LINE,
  DEBUGGER_LINE,
  describedTsExpectError,
  disableNextLineOverADebugger,
  disableOfTheBanOverAClassicLoop,
  disableOverAClassicLoop,
  inlineConfigTurningTheBanOff,
  namedDisableOverAClassicLoop,
  SAME_LINE_DISABLE_LINE,
  sameLineDisableOfTheBan,
  suppressionOfARuleNobodyDefines,
  tsIgnore,
  tsNocheck,
  unsuppressedDebugger,
} from './__tests__/cases/suppression-comments.ts'
import { type ErrorAt, setUpEngineRun } from './__tests__/engine-run.ts'
import { buildErrorOnItsRoutedEngine, buildEslintError } from './__tests__/factories/engine-error-factories.ts'
import { buildConsumerLintRules, buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { defineLintRules } from './index.ts'

// Measured (ESLint 10.12): with inline config read, a file-level /* eslint-disable */, a disable comment
// naming the ban, a disable-line comment on its own line, and /* eslint house/no-suppressions: off */
// each silence the ban. So wherever the ban is on, ESLint reads no inline config (noInlineConfig):
// each directive then draws the ban's error, plus ESLint's warning that it has no effect.

// errorsOn and eslintMessagesOn include fatal messages (rule ID null), so a file asserted silent
// cannot pass because it failed to parse. Where ESLint reads inline config, the fixture's
// not-suppressions/eslint-env.ts is fatal by design, so those runs expect exactly that fatal.
const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/suppression-ban', import.meta.url))

const THE_BAN = 'house/no-suppressions'
const THE_LOOP_RULE = 'house/no-classic-loops'
const THE_DEBUGGER_RULE = 'no-debugger'
const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'
const BLANKET_DISABLE_RULE = 'unicorn/no-abusive-eslint-disable'
const NOBODYS_RULE = 'nobody/rule'
const ESLINT_WARNING = 1
const ESLINT_ERROR = 2
const ESLINT_ENV_FATAL = 'not-suppressions/eslint-env.ts: /* eslint-env */ comments are no longer supported.'

// The errors a file draws, each made as a test reads it: the catalog routes some, and its lookup throws on a miss.
function banReportOnLine1(): ErrorAt[] {
  return [buildEslintError(THE_BAN, 1)]
}

function banReportsOnLines1And3(): ErrorAt[] {
  return [buildEslintError(THE_BAN, 1), buildEslintError(THE_BAN, 3)]
}

function blanketDisableOnLine1(): ErrorAt[] {
  return [buildErrorOnItsRoutedEngine(BLANKET_DISABLE_RULE, 1)]
}

function banAndLoop(): ErrorAt[] {
  return [buildEslintError(THE_BAN, 1), buildEslintError(THE_LOOP_RULE, CLASSIC_LOOP_LINE)]
}

function tsCommentBanOnLine1(): ErrorAt[] {
  return [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)]
}

function debuggerReport(): ErrorAt[] {
  return [buildErrorOnItsRoutedEngine(THE_DEBUGGER_RULE, DEBUGGER_LINE)]
}

function loopReport(): ErrorAt[] {
  return [buildEslintError(THE_LOOP_RULE, CLASSIC_LOOP_LINE)]
}

function noErrors(): ErrorAt[] {
  return []
}

// Typed with an index signature: the types let a rule allowSuppressions sets into rules in this shape.
const THE_BAN_OFF: Record<string, 'off'> = { [THE_BAN]: 'off' }

// One file per form in test-fixtures/suppression-ban/forms. A bare /* eslint-disable */ draws the ban
// alone: unicorn/no-abusive-eslint-disable is off while suppressions are banned.
const ONE_ERROR_PER_SUPPRESSION_COMMENT = [
  { file: 'forms/eslint-disable.ts', errors: banReportOnLine1 },
  { file: 'forms/eslint-disable-line-comment.ts', errors: banReportOnLine1 },
  { file: 'forms/eslint-disable-naming-a-rule.ts', errors: banReportOnLine1 },
  { file: 'forms/eslint-disable-next-line.ts', errors: banReportOnLine1 },
  { file: 'forms/eslint-disable-line.ts', errors: banReportOnLine1 },
  { file: 'forms/eslint-enable.ts', errors: banReportsOnLines1And3 },
  { file: 'forms/eslint-rule-config.ts', errors: banReportOnLine1 },
  { file: 'forms/eslint-disable-of-the-ban.ts', errors: banReportOnLine1 },
  { file: 'forms/eslint-rule-config-of-the-ban.ts', errors: banReportOnLine1 },
  { file: 'forms/oxlint-disable.ts', errors: banReportOnLine1 },
  { file: 'forms/oxlint-disable-next-line.ts', errors: banReportOnLine1 },
  { file: 'forms/oxlint-disable-line.ts', errors: banReportOnLine1 },
  { file: 'forms/oxlint-enable.ts', errors: banReportsOnLines1And3 },
  { file: 'forms/ts-expect-error.ts', errors: tsCommentBanOnLine1 },
  { file: 'forms/ts-ignore.ts', errors: tsCommentBanOnLine1 },
  { file: 'forms/ts-nocheck.ts', errors: tsCommentBanOnLine1 },
]

// eslint-env.ts is a fatal ESLint message whenever ESLint reads inline config ("no longer supported").
const NOT_SUPPRESSIONS = ['not-suppressions/prose.ts', 'not-suppressions/eslint-env.ts']

describe('a consumer project listing every ruleset, as init writes it', () => {
  const shipped = setUpEngineRun(FIXTURES_DIR, (projectDir) => defineLintRules(buildEveryRulesetLintRules(projectDir)))

  it('is loaded by oxlint: exits 0 or 1 and prints a JSON report', () => {
    expect([0, 1]).toContain(shipped.oxlintLint().exitCode)
    expect(() => shipped.oxlintReport()).not.toThrow()
  })

  // Checked first: a fatal message stops every rule on its file, so a silent file could pass vacuously.
  it('is loaded by ESLint with no fatal message on any file', () => {
    expect(shipped.eslintFatalMessages()).toStrictEqual([])
  })

  // Without it, a directive naming the ban would pass the table below on ESLint's "Definition for
  // rule 'house/no-suppressions' was not found", which carries the ban's rule ID.
  it('looks up no rule a directive names: ESLint reads no directive while the ban is on', () => {
    expect(shipped.eslintRulesNotFound()).toStrictEqual([])
  })

  it.each(ONE_ERROR_PER_SUPPRESSION_COMMENT)('reports one error per suppression comment in $file', ({ file, errors }) => {
    expect(shipped.errorsOn(file)).toStrictEqual(errors())
  })

  it.each(NOT_SUPPRESSIONS)('reports no error on %s, which suppresses nothing', (file) => {
    expect(shipped.errorsOn(file)).toStrictEqual([])
  })

  // oxlint honours the ESLint directive, so the @ts-ignore under it goes unreported (measured,
  // oxlint 1.87); the directive's own error is what keeps the file failing.
  it('fails a file that suppresses the ts-comment ban, on the suppressing comment', () => {
    const suppressingLine = 1

    expect(
      shipped.errorsOn('forms/ts-comment-ban-suppressed.ts').filter(({ line }) => line === suppressingLine),
    ).toStrictEqual([buildEslintError(THE_BAN, suppressingLine)])
  })
})

describe('the ban, on as shipped, against comments that would silence it', () => {
  const banOn = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { 'house/no-classic-loops': 'error' } })),
    {
      'src/disable-over-a-loop.ts': disableOverAClassicLoop,
      'src/disable-of-the-ban.ts': disableOfTheBanOverAClassicLoop,
      'src/inline-config-of-the-ban.ts': inlineConfigTurningTheBanOff,
      'src/same-line-disable-of-the-ban.ts': sameLineDisableOfTheBan,
      'src/suppression-of-a-rule-nobody-defines.ts': suppressionOfARuleNobodyDefines,
    },
  )

  it('is loaded by ESLint with no fatal message on any file', () => {
    expect(banOn.eslintFatalMessages()).toStrictEqual([])
  })

  it.each([
    { comment: 'a file-level /* eslint-disable */', file: 'src/disable-over-a-loop.ts' },
    { comment: 'an /* eslint-disable */ naming the ban', file: 'src/disable-of-the-ban.ts' },
    { comment: 'an inline config turning the ban off', file: 'src/inline-config-of-the-ban.ts' },
  ])('reports $comment, and the loop it tried to hide', ({ file }) => {
    expect(banOn.errorsOn(file)).toStrictEqual([
      buildEslintError(THE_BAN, 1),
      buildEslintError(THE_LOOP_RULE, CLASSIC_LOOP_LINE),
    ])
  })

  it('reports an eslint-disable-line naming the ban on its own line, and the loop on that line', () => {
    expect(banOn.errorsOn('src/same-line-disable-of-the-ban.ts')).toStrictEqual([
      buildEslintError(THE_LOOP_RULE, SAME_LINE_DISABLE_LINE),
      buildEslintError(THE_BAN, SAME_LINE_DISABLE_LINE),
    ])
  })

  // ESLint reads no directive, so it never looks the named rule up.
  it('reports a suppression of a rule nobody defines as a suppression, with no "Definition for rule" error', () => {
    expect(banOn.errorsOn('src/suppression-of-a-rule-nobody-defines.ts')).toStrictEqual(banReportOnLine1())
  })

  it("adds ESLint's own warning, and nothing else, beside the ban's error on an ESLint directive", () => {
    expect(
      banOn.eslintMessagesOn('src/disable-over-a-loop.ts').filter(({ ruleId }) => ruleId !== THE_LOOP_RULE),
    ).toStrictEqual([
      { ruleId: null, severity: ESLINT_WARNING, line: 1 },
      { ruleId: THE_BAN, severity: ESLINT_ERROR, line: 1 },
    ])
  })
})

// allowSuppressions: true turns the ban off, so ESLint reads directives again, and turns
// unicorn/no-abusive-eslint-disable on, so a blanket disable still draws one error, from oxlint.
// @ts-ignore and @ts-nocheck stay banned; @ts-expect-error passes with a description.
describe('suppressions allowed by allowSuppressions: true', () => {
  const allowed = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) =>
      defineLintRules(
        buildConsumerLintRules(projectDir, {}, { allowSuppressions: true, rules: { 'house/no-classic-loops': 'error' } }),
      ),
    {
      'src/disable-over-a-loop.ts': disableOverAClassicLoop,
      'src/named-disable-over-a-loop.ts': namedDisableOverAClassicLoop,
      'src/ts-ignore.ts': tsIgnore,
      'src/described-ts-expect-error.ts': describedTsExpectError,
      'src/bare-ts-expect-error.ts': bareTsExpectError,
      'src/suppression-of-a-rule-nobody-defines.ts': suppressionOfARuleNobodyDefines,
    },
  )

  it('is loaded by ESLint with a fatal message on the eslint-env fixture only, which ESLint reads here', () => {
    expect(allowed.eslintFatalMessages()).toStrictEqual([ESLINT_ENV_FATAL])
  })

  // The stubs for oxlint-only names exist for this case: ESLint looks up every rule a directive names.
  it('looks up the rule each directive names: only the one nobody defines is "not found"', () => {
    expect(allowed.eslintRulesNotFound()).toStrictEqual([`src/suppression-of-a-rule-nobody-defines.ts: ${NOBODYS_RULE}`])
  })

  it.each([
    { comment: 'a blanket /* eslint-disable */ over clean code', file: 'forms/eslint-disable.ts', errors: blanketDisableOnLine1 },
    {
      comment: 'a blanket /* eslint-disable */ once, and not the loop it silences',
      file: 'src/disable-over-a-loop.ts',
      errors: blanketDisableOnLine1,
    },
    { comment: 'nothing for an /* eslint-disable */ naming the rule it silences', file: 'src/named-disable-over-a-loop.ts', errors: noErrors },
    { comment: 'a // @ts-ignore', file: 'src/ts-ignore.ts', errors: tsCommentBanOnLine1 },
    { comment: 'a // @ts-nocheck', file: 'forms/ts-nocheck.ts', errors: tsCommentBanOnLine1 },
    { comment: 'a // @ts-expect-error with no description', file: 'src/bare-ts-expect-error.ts', errors: tsCommentBanOnLine1 },
    { comment: 'nothing for a // @ts-expect-error with a description', file: 'src/described-ts-expect-error.ts', errors: noErrors },
  ])('reports $comment', ({ file, errors }) => {
    expect(allowed.errorsOn(file)).toStrictEqual(errors())
  })

  // The blanket disable's report is oxlint's, so ESLint reports nothing on the file: not the loop the
  // directive silences, and no warning that it has no effect.
  it('adds no warning of its own to a blanket /* eslint-disable */: ESLint reads the directive', () => {
    expect(allowed.eslintMessagesOn('src/disable-over-a-loop.ts')).toStrictEqual([])
  })
})

// A type test asserts a type error with @ts-expect-error, so in test and type-test files it passes with a
// description while suppressions are banned. An entry's rules naming the rule undo that, unless the entry
// also sets allowSuppressions: false; the types do not refuse it in every shape (docs/plan.md, Open,
// "Written limit of the config's types").
describe('suppressions banned, in test and type-test files', () => {
  const EACH_KIND_OF_TEST_FILE = ['src/a.test.ts', 'src/a.spec.ts', 'src/__tests__/a.ts', 'src/a.test-d.ts']
  const testFiles = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { 'house/no-classic-loops': 'error' } })),
    {
      ...Object.fromEntries(EACH_KIND_OF_TEST_FILE.map((file) => [file, describedTsExpectError])),
      'src/a.ts': describedTsExpectError,
      'src/bare-ts-expect-error.test.ts': bareTsExpectError,
      'src/ts-ignore.test.ts': tsIgnore,
      'src/ts-nocheck.test.ts': tsNocheck,
      'src/disable-next-line.test.ts': disableNextLineOverADebugger,
      'src/named-disable-over-a-loop.test.ts': namedDisableOverAClassicLoop,
    },
  )

  it('is loaded by ESLint with no fatal message on any file', () => {
    expect(testFiles.eslintFatalMessages()).toStrictEqual([])
  })

  it.each(EACH_KIND_OF_TEST_FILE)('reports nothing for a // @ts-expect-error with a description in %s', (file) => {
    expect(testFiles.errorsOn(file)).toStrictEqual([])
  })

  it('reports a // @ts-expect-error with a description in a file that is no test', () => {
    expect(testFiles.errorsOn('src/a.ts')).toStrictEqual([buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)])
  })

  // The loop under the named disable is reported too, so ESLint reads no inline config in test files either.
  it.each([
    { comment: 'a // @ts-expect-error with no description', file: 'src/bare-ts-expect-error.test.ts', errors: tsCommentBanOnLine1 },
    { comment: 'a // @ts-ignore', file: 'src/ts-ignore.test.ts', errors: tsCommentBanOnLine1 },
    { comment: 'a // @ts-nocheck', file: 'src/ts-nocheck.test.ts', errors: tsCommentBanOnLine1 },
    { comment: 'an // eslint-disable-next-line', file: 'src/disable-next-line.test.ts', errors: banReportOnLine1 },
    { comment: 'an /* eslint-disable */ naming the loop rule, and the loop', file: 'src/named-disable-over-a-loop.test.ts', errors: banAndLoop },
  ])('reports $comment in a test file', ({ file, errors }) => {
    expect(testFiles.errorsOn(file)).toStrictEqual(errors())
  })
})

describe('suppressions allowed for legacy/** only, by a file override', () => {
  const legacyAllowed = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) =>
      defineLintRules(
        buildConsumerLintRules(
          projectDir,
          {},
          {
            rules: { 'house/no-classic-loops': 'error' },
            fileOverrides: [{ files: ['legacy/**'], allowSuppressions: true }],
          },
        ),
      ),
    {
      'src/disable-over-a-loop.ts': disableOverAClassicLoop,
      'legacy/disable-over-a-loop.ts': disableOverAClassicLoop,
      'src/named-disable-over-a-loop.ts': namedDisableOverAClassicLoop,
      'legacy/named-disable-over-a-loop.ts': namedDisableOverAClassicLoop,
      'src/described-ts-expect-error.ts': describedTsExpectError,
      'legacy/described-ts-expect-error.ts': describedTsExpectError,
      'legacy/ts-ignore.ts': tsIgnore,
    },
  )

  it('is loaded by ESLint with no fatal message on any file', () => {
    expect(legacyAllowed.eslintFatalMessages()).toStrictEqual([])
  })

  it('looks up no rule a directive names that ESLint lacks', () => {
    expect(legacyAllowed.eslintRulesNotFound()).toStrictEqual([])
  })

  it.each([
    { file: 'legacy/named-disable-over-a-loop.ts', errors: noErrors },
    { file: 'src/named-disable-over-a-loop.ts', errors: banAndLoop },
    { file: 'legacy/disable-over-a-loop.ts', errors: blanketDisableOnLine1 },
    { file: 'src/disable-over-a-loop.ts', errors: banAndLoop },
    { file: 'legacy/described-ts-expect-error.ts', errors: noErrors },
    { file: 'src/described-ts-expect-error.ts', errors: tsCommentBanOnLine1 },
    { file: 'legacy/ts-ignore.ts', errors: tsCommentBanOnLine1 },
  ])('allows suppressions in legacy/** only: $file', ({ file, errors }) => {
    expect(legacyAllowed.errorsOn(file)).toStrictEqual(errors())
  })
})

// An entry's rules naming the ban set it in the entry's files, which the owner accepts (docs/plan.md, Open, "Written
// limit of the config's types"). Disable comments there then go unreported: oxlint honours them for its own rules, and
// ESLint, still reading no inline config, ignores them. @ts- comments stay banned.
describe("the ban turned off for legacy/** by an entry's rules", () => {
  const banOffForLegacy = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) =>
      defineLintRules(
        buildConsumerLintRules(
          projectDir,
          {},
          {
            rules: { 'house/no-classic-loops': 'error', 'no-debugger': 'error' },
            fileOverrides: [{ files: ['legacy/**'], rules: THE_BAN_OFF }],
          },
        ),
      ),
    {
      'legacy/disable-next-line.ts': disableNextLineOverADebugger,
      'src/disable-next-line.ts': disableNextLineOverADebugger,
      'legacy/unsuppressed-debugger.ts': unsuppressedDebugger,
      'legacy/named-disable-over-a-loop.ts': namedDisableOverAClassicLoop,
      'src/named-disable-over-a-loop.ts': namedDisableOverAClassicLoop,
      'legacy/ts-ignore.ts': tsIgnore,
    },
  )

  it('is loaded by ESLint with no fatal message on any file', () => {
    expect(banOffForLegacy.eslintFatalMessages()).toStrictEqual([])
  })

  it.each([
    {
      outcome: 'nothing for a disable comment, nor for the debugger oxlint lets it hide',
      file: 'legacy/disable-next-line.ts',
      errors: noErrors,
    },
    { outcome: 'the same disable comment outside the entry', file: 'src/disable-next-line.ts', errors: banReportOnLine1 },
    {
      outcome: 'a debugger no comment hides',
      file: 'legacy/unsuppressed-debugger.ts',
      errors: debuggerReport,
    },
    {
      outcome: 'the loop ESLint does not let a disable comment hide, and not the comment',
      file: 'legacy/named-disable-over-a-loop.ts',
      errors: loopReport,
    },
    { outcome: 'the same comment and loop outside the entry', file: 'src/named-disable-over-a-loop.ts', errors: banAndLoop },
    { outcome: 'a // @ts-ignore', file: 'legacy/ts-ignore.ts', errors: tsCommentBanOnLine1 },
  ])('reports $outcome: $file', ({ file, errors }) => {
    expect(banOffForLegacy.errorsOn(file)).toStrictEqual(errors())
  })
})

describe('suppressions allowed at the top level and banned for strict/** by a file override', () => {
  const strictBanned = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) =>
      defineLintRules(
        buildConsumerLintRules(
          projectDir,
          {},
          {
            allowSuppressions: true,
            rules: { 'house/no-classic-loops': 'error' },
            fileOverrides: [{ files: ['strict/**'], allowSuppressions: false }],
          },
        ),
      ),
    {
      'src/named-disable-over-a-loop.ts': namedDisableOverAClassicLoop,
      'strict/named-disable-over-a-loop.ts': namedDisableOverAClassicLoop,
      'strict/disable-over-a-loop.ts': disableOverAClassicLoop,
      'src/described-ts-expect-error.ts': describedTsExpectError,
      'strict/described-ts-expect-error.ts': describedTsExpectError,
    },
  )

  it('is loaded by ESLint with a fatal message on the eslint-env fixture only, which ESLint reads outside strict/**', () => {
    expect(strictBanned.eslintFatalMessages()).toStrictEqual([ESLINT_ENV_FATAL])
  })

  it('looks up no rule a directive names that ESLint lacks', () => {
    expect(strictBanned.eslintRulesNotFound()).toStrictEqual([])
  })

  // strict/disable-over-a-loop.ts: the ban's error and not unicorn's beside it.
  it.each([
    { file: 'src/named-disable-over-a-loop.ts', errors: noErrors },
    { file: 'strict/named-disable-over-a-loop.ts', errors: banAndLoop },
    { file: 'strict/disable-over-a-loop.ts', errors: banAndLoop },
    { file: 'src/described-ts-expect-error.ts', errors: noErrors },
    { file: 'strict/described-ts-expect-error.ts', errors: tsCommentBanOnLine1 },
  ])('bans suppressions in strict/** only: $file', ({ file, errors }) => {
    expect(strictBanned.errorsOn(file)).toStrictEqual(errors())
  })
})

describe('a file override whose rulesets list none', () => {
  const bare = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) =>
      defineLintRules(
        buildConsumerLintRules(
          projectDir,
          { agentRulesets: { quality: ['declarative'] } },
          { fileOverrides: [{ files: ['bare/**'], agentRulesets: { quality: [], libs: {}, runtimes: [] } }] },
        ),
      ),
    {
      'bare/disable-over-a-loop.ts': disableOverAClassicLoop,
      'bare/ts-ignore.ts': tsIgnore,
      'src/disable-over-a-loop.ts': disableOverAClassicLoop,
    },
  )

  it.each([
    { file: 'bare/disable-over-a-loop.ts', errors: banReportOnLine1 },
    { file: 'bare/ts-ignore.ts', errors: tsCommentBanOnLine1 },
  ])('drops its rulesets\' rules but keeps both bans: $file', ({ file, errors }) => {
    expect(bare.errorsOn(file)).toStrictEqual(errors())
  })

  it('leaves the loop rule on outside it, beside the ban', () => {
    expect(
      bare.errorsOn('src/disable-over-a-loop.ts').filter(({ rule }) => rule === THE_BAN || rule === THE_LOOP_RULE),
    ).toStrictEqual([buildEslintError(THE_BAN, 1), buildEslintError(THE_LOOP_RULE, CLASSIC_LOOP_LINE)])
  })
})
