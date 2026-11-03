import { catalog, routeOf } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { severityOfCalculatedEntry } from './__tests__/calculated-rule-severity.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import {
  buildConsumerLintRules,
  buildEveryRulesetLintRules,
  emptyTsconfigRootDir,
} from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { oxlintConfigForFile, oxlintSeverityFor } from './__tests__/oxlint-config-oracle.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, NO_TEAM_ESLINT_CONFIG, writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { isList } from './core/is-record.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules, type LintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// allowSuppressions decides the suppression rules and whether ESLint reads directives in the agent
// build; the editor parts always behave as with true, but run a suppression rule of a ruleset only where
// the editor rulesets list it. With false, unicorn/no-abusive-eslint-disable is off so a bare
// /* eslint-disable */ is not reported twice.

type SuppressionSettings = {
  /** house/no-suppressions, as ESLint runs it. */
  readonly suppressionBan: Linter.StringSeverity
  readonly eslintReadsDirectives: boolean
  /** @typescript-eslint/ban-ts-comment's entry, from the engine the catalog routes it to. */
  readonly tsCommentBan: unknown
  /** unicorn/no-abusive-eslint-disable's severity, from the engine the catalog routes it to. */
  readonly blanketDisableRule: Linter.StringSeverity
  /** @eslint-community/eslint-comments/disable-enable-pair's severity, from the engine the catalog routes it to. */
  readonly disableEnablePairRule: Linter.StringSeverity
  /** @eslint-community/eslint-comments/no-duplicate-disable's severity, from the engine the catalog routes it to. */
  readonly duplicateDisableRule: Linter.StringSeverity
  /** react-hooks/rule-suppression's severity, from the engine the catalog routes it to. */
  readonly hooksSuppressionRule: Linter.StringSeverity
}

type BuiltConfigs = { readonly eslint: Linter.Config[]; readonly oxlint: OxlintConfig | null }

type SharedFields = Partial<Omit<LintRules, 'tsconfigRootDir' | 'agentRulesets' | 'editorRulesets'>>

/** A config's shared settings, the file a spec reads, and what the agent build sets there. */
type SharedSettingsCase = {
  readonly config: string
  readonly fields: SharedFields
  readonly agentExpected: SuppressionSettings
  readonly file: string
}

/** A config as a title names it, built in the folder a test gives, and what the agent build sets in src/a.ts. */
type TopLevelCase = { readonly config: string; readonly lintRulesIn: (tsconfigRootDir: string) => LintRules; readonly expected: SuppressionSettings }

/** A project as a title names it, its folder as a test reads it, and what the editor parts set there. */
type EditorProjectCase = { readonly project: string; readonly projectDir: () => string; readonly editorExpected: SuppressionSettings }

type EditorListingCase = {
  readonly config: string
  readonly lintRulesIn: (tsconfigRootDir: string) => LintRules
  readonly file: string
  readonly besideOxlint: SuppressionSettings
  readonly withoutOxlint: SuppressionSettings
}

const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'
const BLANKET_DISABLE_RULE = 'unicorn/no-abusive-eslint-disable'
const DISABLE_ENABLE_PAIR_RULE = '@eslint-community/eslint-comments/disable-enable-pair'
const DUPLICATE_DISABLE_RULE = '@eslint-community/eslint-comments/no-duplicate-disable'
const HOOKS_SUPPRESSION_RULE = 'react-hooks/rule-suppression'
const BAN_TS_COMMENTS_OUTRIGHT = { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true }
const BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR = {
  'ts-expect-error': 'allow-with-description',
  'ts-ignore': true,
  'ts-nocheck': true,
}

const BANNED: SuppressionSettings = {
  suppressionBan: 'error',
  eslintReadsDirectives: false,
  tsCommentBan: ['error', BAN_TS_COMMENTS_OUTRIGHT],
  blanketDisableRule: 'off',
  disableEnablePairRule: 'off',
  duplicateDisableRule: 'off',
  hooksSuppressionRule: 'off',
}

const ALLOWED: SuppressionSettings = {
  suppressionBan: 'off',
  eslintReadsDirectives: true,
  tsCommentBan: ['error', BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR],
  blanketDisableRule: 'error',
  disableEnablePairRule: 'error',
  duplicateDisableRule: 'error',
  hooksSuppressionRule: 'error',
}

// A test or type test may still assert a type error, with a description; every other suppression stays banned.
const BANNED_IN_TEST_FILES: SuppressionSettings = { ...BANNED, tsCommentBan: ['error', BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR] }

/** ESLint does not run the hooks rule without oxlint (eslint-fallback-skips.json); it runs the comments ruleset's rules either way. */
const ALLOWED_WITHOUT_OXLINT: SuppressionSettings = { ...ALLOWED, hooksSuppressionRule: 'off' }

// The blanket-disable, disable-enable-pair and duplicate-disable rules are in the comments ruleset, the hooks rule
// in react and ban-ts-comment in type-safety: in the editor parts each runs only where the editor rulesets list its ruleset.
const THE_COMMENTS_RULES_OFF = { blanketDisableRule: 'off', disableEnablePairRule: 'off', duplicateDisableRule: 'off' } as const
const THE_HOOKS_RULE_OFF = { hooksSuppressionRule: 'off' } as const
const THE_TS_COMMENT_BAN_OFF = { tsCommentBan: 'off' } as const
const ALLOWED_WITH_THE_COMMENTS_RULES_ALONE: SuppressionSettings = { ...ALLOWED, ...THE_HOOKS_RULE_OFF, ...THE_TS_COMMENT_BAN_OFF }
const ALLOWED_WITH_THE_HOOKS_RULE_ALONE: SuppressionSettings = { ...ALLOWED, ...THE_COMMENTS_RULES_OFF, ...THE_TS_COMMENT_BAN_OFF }
const ALLOWED_WITH_THE_TS_COMMENT_BAN_ALONE: SuppressionSettings = { ...ALLOWED, ...THE_COMMENTS_RULES_OFF, ...THE_HOOKS_RULE_OFF }
const ALLOWED_WITH_NO_RULESETS_RULES: SuppressionSettings = { ...ALLOWED, ...THE_COMMENTS_RULES_OFF, ...THE_HOOKS_RULE_OFF, ...THE_TS_COMMENT_BAN_OFF }

/** ESLint still reads no directive, so it still ignores the comments the ban no longer reports. */
const BANNED_BUT_THE_BAN_OFF: SuppressionSettings = { ...BANNED, suppressionBan: 'off' }

// Typed with an index signature: the types let a rule allowSuppressions sets into rules in this shape.
const THE_BAN_OFF: Record<string, 'off'> = { 'house/no-suppressions': 'off' }
const TS_COMMENTS_BANNED_OUTRIGHT: Record<string, readonly ['error', typeof BAN_TS_COMMENTS_OUTRIGHT]> = {
  [TS_COMMENT_BAN]: ['error', BAN_TS_COMMENTS_OUTRIGHT],
}

const NO_RULESETS = { quality: [], libs: {}, runtimes: [] }
const THE_THREE_RULESETS = { quality: ['comments', 'type-safety'], libs: { ui: ['react'] } } as const satisfies Partial<LintRules['editorRulesets']>

const { lintedConfigFor } = setUpEslintConfigOracle()
const tempProjects = setUpTempProjects()

const PROJECT_WITH_OXLINT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) },
  linkedPackages: [INSTALLED_OXLINT],
})

function agentConfigsFor(lintRules: LintRules): BuiltConfigs {
  return agentConfigsOf(defineLintRules(lintRules))
}

/** The editor parts merged into the team's configs: its ESLint config as given, and an oxlint one setting no rule. */
function editorConfigsFor(lintRules: LintRules, teamEslintConfig: Linter.Config[] = []): BuiltConfigs {
  const { eslint, oxlint } = defineLintRules(lintRules).editorRulesets
  return {
    eslint: mergeEslintConfig(teamEslintConfig, eslint, writeTeamOxlintConfigSettingNoRule(eslint)),
    oxlint: oxlint === undefined ? null : mergeOxlintConfig(EMPTY_TEAM_OXLINT_CONFIG, oxlint, NO_TEAM_ESLINT_CONFIG),
  }
}

async function suppressionSettingsFor(configs: BuiltConfigs, file: string): Promise<SuppressionSettings> {
  const calculated = await lintedConfigFor(configs.eslint, file)
  return {
    suppressionBan: calculatedSeverityOf(calculated, 'house/no-suppressions'),
    eslintReadsDirectives: readsDirectives(calculated),
    tsCommentBan: tsCommentBanIn(configs, calculated, file),
    blanketDisableRule: routedSeverityIn(configs, calculated, file, BLANKET_DISABLE_RULE),
    disableEnablePairRule: routedSeverityIn(configs, calculated, file, DISABLE_ENABLE_PAIR_RULE),
    duplicateDisableRule: routedSeverityIn(configs, calculated, file, DUPLICATE_DISABLE_RULE),
    hooksSuppressionRule: routedSeverityIn(configs, calculated, file, HOOKS_SUPPRESSION_RULE),
  }
}

/** The ban's entry from the routed engine, ESLint's numeric severity read by name so both compare alike; off, with whatever options, is off. */
function tsCommentBanIn({ oxlint }: BuiltConfigs, calculated: Readonly<Linter.Config>, file: string): unknown {
  const { engine, oxlintName } = routeOf(TS_COMMENT_BAN, catalog)
  if (oxlint !== null && engine === 'oxlint') return oxlintConfigForFile(oxlint, file).rules[oxlintName]
  if (calculatedSeverityOf(calculated, TS_COMMENT_BAN) === 'off') return 'off'
  const entry = calculatedEntryOf(calculated, TS_COMMENT_BAN)
  if (!isList(entry)) throw new TypeError(`ESLint calculates ${TS_COMMENT_BAN} as [severity, ...options], not ${JSON.stringify(entry)}`)
  const [, ...options] = entry
  return [severityOfCalculatedEntry(entry), ...options]
}

function routedSeverityIn({ oxlint }: BuiltConfigs, calculated: Readonly<Linter.Config>, file: string, ruleId: string): Linter.StringSeverity {
  const { engine, oxlintName } = routeOf(ruleId, catalog)
  if (oxlint === null || engine !== 'oxlint') return calculatedSeverityOf(calculated, ruleId)
  const severity = oxlintSeverityFor(oxlint, file, oxlintName)
  return severity === undefined ? 'off' : severity
}

function calculatedEntryOf({ rules }: Readonly<Linter.Config>, ruleId: string): unknown {
  if (rules === undefined) throw new Error('no rules apply to the file')
  return rules[ruleId]
}

/** A rule no block sets does not run, which is what off means. */
function calculatedSeverityOf(calculated: Readonly<Linter.Config>, ruleId: string): Linter.StringSeverity {
  const severity = severityOfCalculatedEntry(calculatedEntryOf(calculated, ruleId))
  return severity === undefined ? 'off' : severity
}

/** ESLint reads directives unless noInlineConfig is true; it leaves the option out when no block sets it. */
function readsDirectives({ linterOptions }: Readonly<Linter.Config>): boolean {
  if (linterOptions === undefined) throw new Error('ESLint calculated no linterOptions for the file')
  return linterOptions.noInlineConfig !== true
}

function nothingListedSuppressionsAllowed(tsconfigRootDir: string): LintRules {
  return buildConsumerLintRules(tsconfigRootDir, {}, { allowSuppressions: true })
}

function allThreeListedForAgentsAloneSuppressionsAllowed(tsconfigRootDir: string): LintRules {
  return buildConsumerLintRules(tsconfigRootDir, { agentRulesets: THE_THREE_RULESETS }, { allowSuppressions: true })
}

function allThreeListedInAnEntryForLegacy(tsconfigRootDir: string): LintRules {
  return buildConsumerLintRules(tsconfigRootDir, {}, { fileOverrides: [{ files: ['legacy/**'], editorRulesets: THE_THREE_RULESETS }] })
}

function allThreeListedThenNoneInAnEntryForBare(tsconfigRootDir: string): LintRules {
  return buildConsumerLintRules(
    tsconfigRootDir,
    { editorRulesets: THE_THREE_RULESETS },
    { fileOverrides: [{ files: ['bare/**'], editorRulesets: NO_RULESETS }] },
  )
}

describe('allowSuppressions at the top level, in the agent build', () => {
  it.each<TopLevelCase>([
    {
      config: 'every ruleset listed, allowSuppressions left out',
      lintRulesIn(tsconfigRootDir) {
        return buildEveryRulesetLintRules(tsconfigRootDir)
      },
      expected: BANNED,
    },
    {
      config: 'every ruleset listed, allowSuppressions: false',
      lintRulesIn(tsconfigRootDir) {
        return buildEveryRulesetLintRules(tsconfigRootDir, { allowSuppressions: false })
      },
      expected: BANNED,
    },
    {
      config: 'every ruleset listed, allowSuppressions: true',
      lintRulesIn(tsconfigRootDir) {
        return buildEveryRulesetLintRules(tsconfigRootDir, { allowSuppressions: true })
      },
      expected: ALLOWED,
    },
    {
      config: 'no ruleset listed, allowSuppressions left out',
      lintRulesIn(tsconfigRootDir) {
        return buildConsumerLintRules(tsconfigRootDir, { agentRulesets: NO_RULESETS })
      },
      expected: BANNED,
    },
    {
      config: 'no ruleset listed, allowSuppressions: true',
      lintRulesIn(tsconfigRootDir) {
        return buildConsumerLintRules(tsconfigRootDir, { agentRulesets: NO_RULESETS }, { allowSuppressions: true })
      },
      expected: ALLOWED,
    },
  ])('sets the suppression rules for $config', async ({ lintRulesIn, expected }) => {
    const lintRules = lintRulesIn(emptyTsconfigRootDir())

    expect(await suppressionSettingsFor(agentConfigsFor(lintRules), 'src/a.ts')).toStrictEqual(expected)
  })
})

describe('allowSuppressions at the top level, in the agent build, in test and type-test files', () => {
  const banned: SharedFields = {}
  const allowed: SharedFields = { allowSuppressions: true }

  it.each([
    { file: 'src/a.test.ts', config: 'banned', fields: banned, expected: BANNED_IN_TEST_FILES },
    { file: 'src/a.spec.tsx', config: 'banned', fields: banned, expected: BANNED_IN_TEST_FILES },
    { file: 'src/__tests__/a.ts', config: 'banned', fields: banned, expected: BANNED_IN_TEST_FILES },
    { file: 'src/a.test-d.ts', config: 'banned', fields: banned, expected: BANNED_IN_TEST_FILES },
    { file: 'src/a-test.ts', config: 'banned, in a file that only ends like a test', fields: banned, expected: BANNED },
    { file: 'src/a.test.ts', config: 'allowed', fields: allowed, expected: ALLOWED },
  ])('sets the suppression rules for $file, $config', async ({ fields, file, expected }) => {
    const lintRules = buildEveryRulesetLintRules(emptyTsconfigRootDir(), fields)

    expect(await suppressionSettingsFor(agentConfigsFor(lintRules), file)).toStrictEqual(expected)
  })
})

describe('allowSuppressions in file overrides, in the agent build', () => {
  const allowedForLegacy: SharedFields = {
    fileOverrides: [{ files: ['legacy/**'], allowSuppressions: true }],
  }
  const bannedForStrict: SharedFields = {
    allowSuppressions: true,
    fileOverrides: [{ files: ['strict/**'], allowSuppressions: false }],
  }
  const otherKeysOnlyUnderAllowed: SharedFields = {
    allowSuppressions: true,
    fileOverrides: [{ files: ['web/**'], agentRulesets: { runtimes: ['browser'] }, rules: { 'no-debugger': 'off' } }],
  }
  const allowedForAppsThenBannedForWeb: SharedFields = {
    fileOverrides: [
      { files: ['apps/**'], allowSuppressions: true },
      { files: ['apps/web/**'], allowSuppressions: false },
    ],
  }
  const allowedForAppsThenOtherKeysForWeb: SharedFields = {
    fileOverrides: [
      { files: ['apps/**'], allowSuppressions: true },
      { files: ['apps/web/**'], agentRulesets: { runtimes: ['browser'] } },
    ],
  }
  const emptyRulesetsUnderAllowed: SharedFields = {
    allowSuppressions: true,
    fileOverrides: [{ files: ['bare/**'], agentRulesets: NO_RULESETS }],
  }
  const emptyRulesetsUnderBanned: SharedFields = {
    fileOverrides: [{ files: ['bare/**'], agentRulesets: NO_RULESETS }],
  }

  it.each([
    { file: 'legacy/a.ts', config: 'an entry allowing them under a top level banning them', fields: allowedForLegacy, expected: ALLOWED },
    { file: 'src/a.ts', config: 'an entry allowing them under a top level banning them', fields: allowedForLegacy, expected: BANNED },
    { file: 'strict/a.ts', config: 'an entry banning them under a top level allowing them', fields: bannedForStrict, expected: BANNED },
    { file: 'src/a.ts', config: 'an entry banning them under a top level allowing them', fields: bannedForStrict, expected: ALLOWED },
    {
      file: 'web/a.ts',
      config: 'an entry leaving allowSuppressions out, which inherits the top level',
      fields: otherKeysOnlyUnderAllowed,
      expected: ALLOWED,
    },
    {
      file: 'apps/api/a.ts',
      config: 'apps/** allowing them, then apps/web/** banning them',
      fields: allowedForAppsThenBannedForWeb,
      expected: ALLOWED,
    },
    {
      file: 'apps/web/a.ts',
      config: 'apps/** allowing them, then apps/web/** banning them: the later entry wins',
      fields: allowedForAppsThenBannedForWeb,
      expected: BANNED,
    },
    {
      file: 'apps/web/a.ts',
      config: 'apps/** allowing them, then apps/web/** leaving allowSuppressions out: the earlier entry stands',
      fields: allowedForAppsThenOtherKeysForWeb,
      expected: ALLOWED,
    },
    {
      file: 'bare/a.ts',
      config: 'an entry listing no rulesets under a top level allowing them',
      fields: emptyRulesetsUnderAllowed,
      expected: ALLOWED,
    },
    {
      file: 'bare/a.ts',
      config: 'an entry listing no rulesets under a top level banning them',
      fields: emptyRulesetsUnderBanned,
      expected: BANNED,
    },
    { file: 'legacy/a.test.ts', config: 'an entry allowing them under a top level banning them', fields: allowedForLegacy, expected: ALLOWED },
    { file: 'strict/a.test.ts', config: 'an entry banning them under a top level allowing them', fields: bannedForStrict, expected: BANNED_IN_TEST_FILES },
    { file: 'src/a.test.ts', config: 'an entry banning them under a top level allowing them', fields: bannedForStrict, expected: ALLOWED },
    {
      file: 'apps/web/a.test.ts',
      config: 'apps/** allowing them, then apps/web/** banning them: the later entry wins',
      fields: allowedForAppsThenBannedForWeb,
      expected: BANNED_IN_TEST_FILES,
    },
  ])('sets the suppression rules for $file under $config', async ({ fields, file, expected }) => {
    const lintRules = buildEveryRulesetLintRules(emptyTsconfigRootDir(), fields)

    expect(await suppressionSettingsFor(agentConfigsFor(lintRules), file)).toStrictEqual(expected)
  })
})

// An entry's rules naming a rule allowSuppressions sets set it in the entry's files, which the owner accepts
// (docs/plan.md, Open, "Written limit of the config's types"). At the top level, allowSuppressions wins.
describe('house/no-suppressions named in rules, in the agent build', () => {
  const banOffForLegacy: SharedFields = {
    fileOverrides: [{ files: ['legacy/**'], rules: THE_BAN_OFF }],
  }
  const banOffForLegacyWhileBanned: SharedFields = {
    fileOverrides: [{ files: ['legacy/**'], allowSuppressions: false, rules: THE_BAN_OFF }],
  }
  const banOffAtTheTopLevel: SharedFields = { rules: THE_BAN_OFF }

  it.each([
    { file: 'legacy/a.ts', config: "an entry's rules turning it off", fields: banOffForLegacy, expected: BANNED_BUT_THE_BAN_OFF },
    { file: 'src/a.ts', config: "an entry's rules turning it off", fields: banOffForLegacy, expected: BANNED },
    {
      file: 'legacy/a.ts',
      config: "an entry's rules turning it off, the entry also setting allowSuppressions: false",
      fields: banOffForLegacyWhileBanned,
      expected: BANNED_BUT_THE_BAN_OFF,
    },
    { file: 'src/a.ts', config: 'the top-level rules turning it off', fields: banOffAtTheTopLevel, expected: BANNED },
  ])('sets the suppression rules for $file under $config', async ({ fields, file, expected }) => {
    const lintRules = buildEveryRulesetLintRules(emptyTsconfigRootDir(), fields)

    expect(await suppressionSettingsFor(agentConfigsFor(lintRules), file)).toStrictEqual(expected)
  })
})

describe("@typescript-eslint/ban-ts-comment named in an entry's rules, in the agent build, in test files", () => {
  const tsCommentsBannedOutrightForSrc: SharedFields = {
    fileOverrides: [{ files: ['src/**'], rules: TS_COMMENTS_BANNED_OUTRIGHT }],
  }
  const tsCommentsBannedOutrightForSrcWhileBanned: SharedFields = {
    fileOverrides: [{ files: ['src/**'], allowSuppressions: false, rules: TS_COMMENTS_BANNED_OUTRIGHT }],
  }

  it.each([
    {
      file: 'src/a.test.ts',
      config: "an entry's rules banning ts comments outright: the test-file allowance undone",
      fields: tsCommentsBannedOutrightForSrc,
      expected: BANNED,
    },
    {
      file: 'lib/a.test.ts',
      config: "an entry's rules for src/** banning ts comments outright",
      fields: tsCommentsBannedOutrightForSrc,
      expected: BANNED_IN_TEST_FILES,
    },
    {
      file: 'src/a.test.ts',
      config: "an entry's rules banning ts comments outright, the entry also setting allowSuppressions: false: the allowance kept",
      fields: tsCommentsBannedOutrightForSrcWhileBanned,
      expected: BANNED_IN_TEST_FILES,
    },
  ])('sets the suppression rules for $file under $config', async ({ fields, file, expected }) => {
    const lintRules = buildEveryRulesetLintRules(emptyTsconfigRootDir(), fields)

    expect(await suppressionSettingsFor(agentConfigsFor(lintRules), file)).toStrictEqual(expected)
  })
})

describe('the editor parts, merged into a team config, beside the agent build of the same config', () => {
  const projects: readonly EditorProjectCase[] = [
    {
      project: 'whose package.json lists oxlint',
      projectDir() {
        return PROJECT_WITH_OXLINT
      },
      editorExpected: ALLOWED,
    },
    { project: 'whose package.json lists no oxlint', projectDir: emptyTsconfigRootDir, editorExpected: ALLOWED_WITHOUT_OXLINT },
  ]
  const configs: readonly SharedSettingsCase[] = [
    { config: 'allowSuppressions left out', fields: {}, agentExpected: BANNED, file: 'src/a.ts' },
    { config: 'allowSuppressions: false', fields: { allowSuppressions: false }, agentExpected: BANNED, file: 'src/a.ts' },
    { config: 'allowSuppressions: true', fields: { allowSuppressions: true }, agentExpected: ALLOWED, file: 'src/a.ts' },
    {
      config: 'allowSuppressions: true, and false in an entry for strict/**',
      fields: { allowSuppressions: true, fileOverrides: [{ files: ['strict/**'], allowSuppressions: false }] },
      agentExpected: BANNED,
      file: 'strict/a.ts',
    },
  ]
  const cases = projects.flatMap((project) => configs.map((config) => ({ ...project, ...config })))

  it.each(cases)(
    'allow suppressions in $file of a project $project, with $config',
    async ({ projectDir, fields, editorExpected, file }) => {
      const lintRules = buildEveryRulesetLintRules(projectDir(), fields)

      expect(await suppressionSettingsFor(editorConfigsFor(lintRules), file)).toStrictEqual(editorExpected)
    },
  )

  it.each(cases)(
    'leave the agent build of $file in a project $project as allowSuppressions sets it, with $config',
    async ({ projectDir, fields, agentExpected, file }) => {
      const lintRules = buildEveryRulesetLintRules(projectDir(), fields)

      expect(await suppressionSettingsFor(agentConfigsFor(lintRules), file)).toStrictEqual(agentExpected)
    },
  )
})

// A team's editor config holds only what its editor rulesets list: a rule allowSuppressions turns on that
// belongs to a ruleset joins the editor parts where the editor rulesets list that ruleset, and nowhere else.
describe('the suppression rules of the comments, react and type-safety rulesets (all three), in the editor parts merged into a team config', () => {
  const projects: ReadonlyArray<Omit<EditorProjectCase, 'editorExpected'> & { readonly usesOxlint: boolean }> = [
    {
      project: 'whose package.json lists oxlint',
      projectDir() {
        return PROJECT_WITH_OXLINT
      },
      usesOxlint: true,
    },
    { project: 'whose package.json lists no oxlint', projectDir: emptyTsconfigRootDir, usesOxlint: false },
  ]
  const listings: readonly EditorListingCase[] = [
    {
      config: 'nothing listed, suppressions allowed',
      lintRulesIn: nothingListedSuppressionsAllowed,
      file: 'src/a.ts',
      besideOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
      withoutOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
    },
    {
      config: 'comments alone listed',
      lintRulesIn(tsconfigRootDir) {
        return buildConsumerLintRules(tsconfigRootDir, { editorRulesets: { quality: ['comments'] } })
      },
      file: 'src/a.ts',
      besideOxlint: ALLOWED_WITH_THE_COMMENTS_RULES_ALONE,
      withoutOxlint: ALLOWED_WITH_THE_COMMENTS_RULES_ALONE,
    },
    {
      config: 'react alone listed',
      lintRulesIn(tsconfigRootDir) {
        return buildConsumerLintRules(tsconfigRootDir, { editorRulesets: { libs: { ui: ['react'] } } })
      },
      file: 'src/a.ts',
      besideOxlint: ALLOWED_WITH_THE_HOOKS_RULE_ALONE,
      withoutOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
    },
    {
      config: 'type-safety alone listed',
      lintRulesIn(tsconfigRootDir) {
        return buildConsumerLintRules(tsconfigRootDir, { editorRulesets: { quality: ['type-safety'] } })
      },
      file: 'src/a.ts',
      besideOxlint: ALLOWED_WITH_THE_TS_COMMENT_BAN_ALONE,
      withoutOxlint: ALLOWED_WITH_THE_TS_COMMENT_BAN_ALONE,
    },
    {
      config: 'all three listed',
      lintRulesIn(tsconfigRootDir) {
        return buildConsumerLintRules(tsconfigRootDir, { editorRulesets: THE_THREE_RULESETS })
      },
      file: 'src/a.ts',
      besideOxlint: ALLOWED,
      withoutOxlint: ALLOWED_WITHOUT_OXLINT,
    },
    {
      config: 'all three for agents, suppressions allowed',
      lintRulesIn: allThreeListedForAgentsAloneSuppressionsAllowed,
      file: 'src/a.ts',
      besideOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
      withoutOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
    },
    {
      config: 'all three listed in an entry for legacy/**',
      lintRulesIn: allThreeListedInAnEntryForLegacy,
      file: 'legacy/a.ts',
      besideOxlint: ALLOWED,
      withoutOxlint: ALLOWED_WITHOUT_OXLINT,
    },
    {
      config: 'all three listed in an entry for legacy/**',
      lintRulesIn: allThreeListedInAnEntryForLegacy,
      file: 'src/a.ts',
      besideOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
      withoutOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
    },
    {
      config: 'all three listed for agents in legacy/**',
      lintRulesIn(tsconfigRootDir) {
        return buildConsumerLintRules(tsconfigRootDir, {}, { fileOverrides: [{ files: ['legacy/**'], agentRulesets: THE_THREE_RULESETS }] })
      },
      file: 'legacy/a.ts',
      besideOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
      withoutOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
    },
    {
      config: 'all three listed, then none for bare/**',
      lintRulesIn: allThreeListedThenNoneInAnEntryForBare,
      file: 'bare/a.ts',
      besideOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
      withoutOxlint: ALLOWED_WITH_NO_RULESETS_RULES,
    },
    {
      config: 'all three listed, then none for bare/**',
      lintRulesIn: allThreeListedThenNoneInAnEntryForBare,
      file: 'src/a.ts',
      besideOxlint: ALLOWED,
      withoutOxlint: ALLOWED_WITHOUT_OXLINT,
    },
  ]
  const cases = projects.flatMap(({ usesOxlint, ...project }) =>
    listings.map(({ besideOxlint, withoutOxlint, ...listing }) => ({ ...project, ...listing, editorExpected: usesOxlint ? besideOxlint : withoutOxlint })),
  )

  it.each(cases)('sets the suppression rules in $file of a project $project, with $config', async ({ projectDir, lintRulesIn, file, editorExpected }) => {
    const lintRules = lintRulesIn(projectDir())

    expect(await suppressionSettingsFor(editorConfigsFor(lintRules), file)).toStrictEqual(editorExpected)
  })

  // The agent build sets the suppression rules whatever rulesets are listed.
  it.each([
    { config: 'nothing listed, suppressions allowed', lintRulesIn: nothingListedSuppressionsAllowed },
    { config: 'all three for agents, suppressions allowed', lintRulesIn: allThreeListedForAgentsAloneSuppressionsAllowed },
    {
      config: 'all three for editors, suppressions allowed',
      lintRulesIn(tsconfigRootDir: string) {
        return buildConsumerLintRules(tsconfigRootDir, { editorRulesets: THE_THREE_RULESETS }, { allowSuppressions: true })
      },
    },
  ])('leaves the agent build allowing them in src/a.ts, with $config', async ({ lintRulesIn }) => {
    const lintRules = lintRulesIn(emptyTsconfigRootDir())

    expect(await suppressionSettingsFor(agentConfigsFor(lintRules), 'src/a.ts')).toStrictEqual(ALLOWED)
  })
})

describe("a team ESLint config's own noInlineConfig, merged with the editor part", () => {
  const lintRules = buildEveryRulesetLintRules(PROJECT_WITH_OXLINT)

  it('stands when it is true: ESLint reads no directive', async () => {
    const teamEslintConfig = [buildTeamEslintBlock('team', { linterOptions: { noInlineConfig: true } })]

    expect((await suppressionSettingsFor(editorConfigsFor(lintRules, teamEslintConfig), 'src/a.ts')).eslintReadsDirectives).toBe(
      false,
    )
  })

  it('is not set by the editor part when the team leaves it out: ESLint reads directives', async () => {
    const teamEslintConfig = [buildTeamEslintBlock('team', { rules: {} })]

    expect((await suppressionSettingsFor(editorConfigsFor(lintRules, teamEslintConfig), 'src/a.ts')).eslintReadsDirectives).toBe(
      true,
    )
  })
})
