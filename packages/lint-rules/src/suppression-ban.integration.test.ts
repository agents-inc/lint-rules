import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  bareTsExpectError,
  CLASSIC_LOOP_LINE,
  describedTsExpectError,
  disableOfTheBanOverAClassicLoop,
  disableOverAClassicLoop,
  inlineConfigTurningTheBanOff,
  namedDisableOverAClassicLoop,
  SAME_LINE_DISABLE_LINE,
  sameLineDisableOfTheBan,
  suppressionOfARuleNobodyDefines,
  tsIgnore,
} from './__tests__/cases/suppression-comments.ts'
import { setUpEngineRun } from './__tests__/engine-run.ts'
import { buildErrorOnItsRoutedEngine, buildEslintError } from './__tests__/factories/engine-error-factories.ts'
import { buildConsumerLintRules, buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { defineLintRules } from './index.ts'

// Owner, 2026-10-10: suppression comments are banned unless allowSuppressions is true, top level
// or for a file override's files. house/no-suppressions (ESLint) reports every eslint-* and
// oxlint-* suppression; @typescript-eslint/ban-ts-comment, on the engine the catalog routes it to,
// every @ts- one. allowSuppressions
// is the only way to change either: neither can be set in rules.
//
// Measured (ESLint 10.12): with inline config read, a file-level /* eslint-disable */, an
// eslint-disable naming the ban, an eslint-disable-line naming it on its own line, and
// /* eslint house/no-suppressions: off */ each silence the ban. So wherever the ban is on, ESLint
// must read no inline config at all (linterOptions.noInlineConfig): each directive then draws the
// ban's error, plus ESLint's own warning that the comment has no effect.

// errorsOn and eslintMessagesOn include fatal messages (rule ID null), so a file asserted silent
// cannot pass because it failed to parse. Where ESLint reads inline config, the fixture's
// not-suppressions/eslint-env.ts is fatal by design, so those runs expect exactly that fatal.
const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/suppression-ban', import.meta.url))

const THE_BAN = 'house/no-suppressions'
const THE_LOOP_RULE = 'house/no-classic-loops'
const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'
const BLANKET_DISABLE_RULE = 'unicorn/no-abusive-eslint-disable'
const NOBODYS_RULE = 'nobody/rule'
const ESLINT_WARNING = 1
const ESLINT_ERROR = 2
const ESLINT_ENV_FATAL = 'not-suppressions/eslint-env.ts: /* eslint-env */ comments are no longer supported.'

const BAN_REPORT_ON_LINE_1 = [buildEslintError(THE_BAN, 1)]
const BLANKET_DISABLE_ON_LINE_1 = [buildEslintError(BLANKET_DISABLE_RULE, 1)]
const BAN_AND_LOOP = [buildEslintError(THE_BAN, 1), buildEslintError(THE_LOOP_RULE, CLASSIC_LOOP_LINE)]

// One file per form, in test-fixtures/suppression-ban/forms; each comment opens a line of clean code.
// A bare /* eslint-disable */ draws the ban alone: unicorn/no-abusive-eslint-disable is off while
// suppressions are banned, so the comment is not reported twice.
const ONE_ERROR_PER_SUPPRESSION_COMMENT = [
  { file: 'forms/eslint-disable.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/eslint-disable-line-comment.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/eslint-disable-naming-a-rule.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/eslint-disable-next-line.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/eslint-disable-line.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/eslint-enable.ts', errors: [buildEslintError(THE_BAN, 1), buildEslintError(THE_BAN, 3)] },
  { file: 'forms/eslint-rule-config.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/eslint-disable-of-the-ban.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/eslint-rule-config-of-the-ban.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/oxlint-disable.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/oxlint-disable-next-line.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/oxlint-disable-line.ts', errors: BAN_REPORT_ON_LINE_1 },
  { file: 'forms/oxlint-enable.ts', errors: [buildEslintError(THE_BAN, 1), buildEslintError(THE_BAN, 3)] },
  { file: 'forms/ts-expect-error.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
  { file: 'forms/ts-ignore.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
  { file: 'forms/ts-nocheck.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
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
    expect(shipped.errorsOn(file)).toStrictEqual(errors)
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
    expect(banOn.errorsOn('src/suppression-of-a-rule-nobody-defines.ts')).toStrictEqual(BAN_REPORT_ON_LINE_1)
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

// Owner, 2026-10-10: allowSuppressions: true turns the ban off, so ESLint reads directives again,
// and turns unicorn/no-abusive-eslint-disable on, so a blanket disable still draws one error.
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
    { comment: 'a blanket /* eslint-disable */ over clean code', file: 'forms/eslint-disable.ts', errors: BLANKET_DISABLE_ON_LINE_1 },
    {
      comment: 'a blanket /* eslint-disable */ once, and not the loop it silences',
      file: 'src/disable-over-a-loop.ts',
      errors: BLANKET_DISABLE_ON_LINE_1,
    },
    { comment: 'nothing for an /* eslint-disable */ naming the rule it silences', file: 'src/named-disable-over-a-loop.ts', errors: [] },
    { comment: 'a // @ts-ignore', file: 'src/ts-ignore.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
    { comment: 'a // @ts-nocheck', file: 'forms/ts-nocheck.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
    { comment: 'a // @ts-expect-error with no description', file: 'src/bare-ts-expect-error.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
    { comment: 'nothing for a // @ts-expect-error with a description', file: 'src/described-ts-expect-error.ts', errors: [] },
  ])('reports $comment', ({ file, errors }) => {
    expect(allowed.errorsOn(file)).toStrictEqual(errors)
  })

  it('adds no warning of its own to a blanket /* eslint-disable */: ESLint reads the directive', () => {
    expect(allowed.eslintMessagesOn('src/disable-over-a-loop.ts')).toStrictEqual([
      { ruleId: BLANKET_DISABLE_RULE, severity: ESLINT_ERROR, line: 1 },
    ])
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
    { file: 'legacy/named-disable-over-a-loop.ts', errors: [] },
    { file: 'src/named-disable-over-a-loop.ts', errors: BAN_AND_LOOP },
    { file: 'legacy/disable-over-a-loop.ts', errors: BLANKET_DISABLE_ON_LINE_1 },
    { file: 'src/disable-over-a-loop.ts', errors: BAN_AND_LOOP },
    { file: 'legacy/described-ts-expect-error.ts', errors: [] },
    { file: 'src/described-ts-expect-error.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
    { file: 'legacy/ts-ignore.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
  ])('allows suppressions in legacy/** only: $file', ({ file, errors }) => {
    expect(legacyAllowed.errorsOn(file)).toStrictEqual(errors)
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
    { file: 'src/named-disable-over-a-loop.ts', errors: [] },
    { file: 'strict/named-disable-over-a-loop.ts', errors: BAN_AND_LOOP },
    { file: 'strict/disable-over-a-loop.ts', errors: BAN_AND_LOOP },
    { file: 'src/described-ts-expect-error.ts', errors: [] },
    { file: 'strict/described-ts-expect-error.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
  ])('bans suppressions in strict/** only: $file', ({ file, errors }) => {
    expect(strictBanned.errorsOn(file)).toStrictEqual(errors)
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
    { file: 'bare/disable-over-a-loop.ts', errors: BAN_REPORT_ON_LINE_1 },
    { file: 'bare/ts-ignore.ts', errors: [buildErrorOnItsRoutedEngine(TS_COMMENT_BAN, 1)] },
  ])('drops its rulesets\' rules but keeps both bans: $file', ({ file, errors }) => {
    expect(bare.errorsOn(file)).toStrictEqual(errors)
  })

  it('leaves the loop rule on outside it, beside the ban', () => {
    expect(
      bare.errorsOn('src/disable-over-a-loop.ts').filter(({ rule }) => rule === THE_BAN || rule === THE_LOOP_RULE),
    ).toStrictEqual([buildEslintError(THE_BAN, 1), buildEslintError(THE_LOOP_RULE, CLASSIC_LOOP_LINE)])
  })
})
