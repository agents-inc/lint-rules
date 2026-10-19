import { catalog, type RuleRoute } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { severityOfCalculatedEntry } from './__tests__/calculated-rule-severity.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import {
  buildConsumerLintRules,
  buildEveryRulesetLintRules,
  EMPTY_TSCONFIG_ROOT_DIR,
} from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { oxlintConfigForFile, oxlintSeverityFor } from './__tests__/oxlint-config-oracle.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, NO_TEAM_ESLINT_CONFIG, writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules, type LintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// allowSuppressions decides the suppression rules and whether ESLint reads directives in the agent
// build; the editor parts always behave as with true. With false, unicorn/no-abusive-eslint-disable is
// off so a bare /* eslint-disable */ is not reported twice.

type SuppressionSettings = {
  /** house/no-suppressions, as ESLint runs it. */
  readonly suppressionBan: Linter.StringSeverity
  readonly eslintReadsDirectives: boolean
  /** @typescript-eslint/ban-ts-comment's entry, from the engine the catalog routes it to. */
  readonly tsCommentBan: unknown
  /** unicorn/no-abusive-eslint-disable's severity, from the engine the catalog routes it to. */
  readonly blanketDisableRule: Linter.StringSeverity
  /** react-hooks/rule-suppression's severity, from the engine the catalog routes it to. */
  readonly hooksSuppressionRule: Linter.StringSeverity
}

type BuiltConfigs = { readonly eslint: Linter.Config[]; readonly oxlint: OxlintConfig | null }

/** A config's shared settings, the file a spec reads, and what the agent build sets there. */
type SharedSettingsCase = {
  readonly config: string
  readonly fields: Partial<Omit<LintRules, 'tsconfigRootDir' | 'agentRulesets' | 'editorRulesets'>>
  readonly agentExpected: SuppressionSettings
  readonly file: string
}

const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'
const BLANKET_DISABLE_RULE = 'unicorn/no-abusive-eslint-disable'
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
  hooksSuppressionRule: 'off',
}

const ALLOWED: SuppressionSettings = {
  suppressionBan: 'off',
  eslintReadsDirectives: true,
  tsCommentBan: ['error', BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR],
  blanketDisableRule: 'error',
  hooksSuppressionRule: 'error',
}

// A test or type test may still assert a type error, with a description; every other suppression stays banned.
const BANNED_IN_TEST_FILES: SuppressionSettings = { ...BANNED, tsCommentBan: ['error', BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR] }

/** ESLint does not run the hooks rule without oxlint (eslint-fallback-skips.json). */
const ALLOWED_WITHOUT_OXLINT: SuppressionSettings = { ...ALLOWED, hooksSuppressionRule: 'off' }

const NO_RULESETS = { quality: [], libs: {}, runtimes: [] }

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
    hooksSuppressionRule: routedSeverityIn(configs, calculated, file, HOOKS_SUPPRESSION_RULE),
  }
}

/** The ban's entry from the routed engine, ESLint's numeric severity read by name so both compare alike. */
function tsCommentBanIn({ oxlint }: BuiltConfigs, calculated: Linter.Config, file: string): unknown {
  const { engine, oxlintName } = routeOfTheTsCommentBan()
  if (oxlint !== null && engine === 'oxlint' && oxlintName !== null) return oxlintConfigForFile(oxlint, file).rules[oxlintName]
  const entry = calculatedEntryOf(calculated, TS_COMMENT_BAN)
  if (!Array.isArray(entry)) throw new Error(`ESLint calculates ${TS_COMMENT_BAN} as [severity, ...options], not ${JSON.stringify(entry)}`)
  const [, ...options] = entry
  return [severityOfCalculatedEntry(entry), ...options]
}

function routeOfTheTsCommentBan(): RuleRoute {
  return routeOf(TS_COMMENT_BAN)
}

function routedSeverityIn({ oxlint }: BuiltConfigs, calculated: Linter.Config, file: string, ruleId: string): Linter.StringSeverity {
  const { engine, oxlintName } = routeOf(ruleId)
  if (oxlint === null || engine !== 'oxlint' || oxlintName === null) return calculatedSeverityOf(calculated, ruleId)
  const severity = oxlintSeverityFor(oxlint, file, oxlintName)
  return severity === undefined ? 'off' : severity
}

function routeOf(ruleId: string): RuleRoute {
  const route = catalog.rules.get(ruleId)
  if (route === undefined) throw new Error(`${ruleId} is not in the catalog`)
  return route
}

function calculatedEntryOf({ rules }: Linter.Config, ruleId: string): unknown {
  if (rules === undefined) throw new Error('no rules apply to the file')
  return rules[ruleId]
}

/** A rule no block sets does not run, which is what off means. */
function calculatedSeverityOf(calculated: Linter.Config, ruleId: string): Linter.StringSeverity {
  const severity = severityOfCalculatedEntry(calculatedEntryOf(calculated, ruleId))
  return severity === undefined ? 'off' : severity
}

/** ESLint reads directives unless noInlineConfig is true; it leaves the option out when no block sets it. */
function readsDirectives({ linterOptions }: Linter.Config): boolean {
  if (linterOptions === undefined) throw new Error('ESLint calculated no linterOptions for the file')
  return linterOptions.noInlineConfig !== true
}

describe('allowSuppressions at the top level, in the agent build', () => {
  it.each([
    {
      config: 'every ruleset listed, allowSuppressions left out',
      lintRules: buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR),
      expected: BANNED,
    },
    {
      config: 'every ruleset listed, allowSuppressions: false',
      lintRules: buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, { allowSuppressions: false }),
      expected: BANNED,
    },
    {
      config: 'every ruleset listed, allowSuppressions: true',
      lintRules: buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, { allowSuppressions: true }),
      expected: ALLOWED,
    },
    {
      config: 'no ruleset listed, allowSuppressions left out',
      lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, { agentRulesets: NO_RULESETS }),
      expected: BANNED,
    },
    {
      config: 'no ruleset listed, allowSuppressions: true',
      lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, { agentRulesets: NO_RULESETS }, { allowSuppressions: true }),
      expected: ALLOWED,
    },
  ])('sets the suppression rules for $config', async ({ lintRules, expected }) => {
    expect(await suppressionSettingsFor(agentConfigsFor(lintRules), 'src/a.ts')).toStrictEqual(expected)
  })
})

describe('allowSuppressions at the top level, in the agent build, in test and type-test files', () => {
  const banned = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR)
  const allowed = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, { allowSuppressions: true })

  it.each([
    { file: 'src/a.test.ts', config: 'banned', lintRules: banned, expected: BANNED_IN_TEST_FILES },
    { file: 'src/a.spec.tsx', config: 'banned', lintRules: banned, expected: BANNED_IN_TEST_FILES },
    { file: 'src/__tests__/a.ts', config: 'banned', lintRules: banned, expected: BANNED_IN_TEST_FILES },
    { file: 'src/a.test-d.ts', config: 'banned', lintRules: banned, expected: BANNED_IN_TEST_FILES },
    { file: 'src/a-test.ts', config: 'banned, in a file that only ends like a test', lintRules: banned, expected: BANNED },
    { file: 'src/a.test.ts', config: 'allowed', lintRules: allowed, expected: ALLOWED },
  ])('sets the suppression rules for $file, $config', async ({ lintRules, file, expected }) => {
    expect(await suppressionSettingsFor(agentConfigsFor(lintRules), file)).toStrictEqual(expected)
  })
})

describe('allowSuppressions in file overrides, in the agent build', () => {
  const allowedForLegacy = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, {
    fileOverrides: [{ files: ['legacy/**'], allowSuppressions: true }],
  })
  const bannedForStrict = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, {
    allowSuppressions: true,
    fileOverrides: [{ files: ['strict/**'], allowSuppressions: false }],
  })
  const otherKeysOnlyUnderAllowed = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, {
    allowSuppressions: true,
    fileOverrides: [{ files: ['web/**'], agentRulesets: { runtimes: ['browser'] }, rules: { 'no-debugger': 'off' } }],
  })
  const allowedForAppsThenBannedForWeb = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, {
    fileOverrides: [
      { files: ['apps/**'], allowSuppressions: true },
      { files: ['apps/web/**'], allowSuppressions: false },
    ],
  })
  const allowedForAppsThenOtherKeysForWeb = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, {
    fileOverrides: [
      { files: ['apps/**'], allowSuppressions: true },
      { files: ['apps/web/**'], agentRulesets: { runtimes: ['browser'] } },
    ],
  })
  const emptyRulesetsUnderAllowed = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, {
    allowSuppressions: true,
    fileOverrides: [{ files: ['bare/**'], agentRulesets: NO_RULESETS }],
  })
  const emptyRulesetsUnderBanned = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, {
    fileOverrides: [{ files: ['bare/**'], agentRulesets: NO_RULESETS }],
  })

  it.each([
    { file: 'legacy/a.ts', config: 'an entry allowing them under a top level banning them', lintRules: allowedForLegacy, expected: ALLOWED },
    { file: 'src/a.ts', config: 'an entry allowing them under a top level banning them', lintRules: allowedForLegacy, expected: BANNED },
    { file: 'strict/a.ts', config: 'an entry banning them under a top level allowing them', lintRules: bannedForStrict, expected: BANNED },
    { file: 'src/a.ts', config: 'an entry banning them under a top level allowing them', lintRules: bannedForStrict, expected: ALLOWED },
    {
      file: 'web/a.ts',
      config: 'an entry leaving allowSuppressions out, which inherits the top level',
      lintRules: otherKeysOnlyUnderAllowed,
      expected: ALLOWED,
    },
    {
      file: 'apps/api/a.ts',
      config: 'apps/** allowing them, then apps/web/** banning them',
      lintRules: allowedForAppsThenBannedForWeb,
      expected: ALLOWED,
    },
    {
      file: 'apps/web/a.ts',
      config: 'apps/** allowing them, then apps/web/** banning them: the later entry wins',
      lintRules: allowedForAppsThenBannedForWeb,
      expected: BANNED,
    },
    {
      file: 'apps/web/a.ts',
      config: 'apps/** allowing them, then apps/web/** leaving allowSuppressions out: the earlier entry stands',
      lintRules: allowedForAppsThenOtherKeysForWeb,
      expected: ALLOWED,
    },
    {
      file: 'bare/a.ts',
      config: 'an entry listing no rulesets under a top level allowing them',
      lintRules: emptyRulesetsUnderAllowed,
      expected: ALLOWED,
    },
    {
      file: 'bare/a.ts',
      config: 'an entry listing no rulesets under a top level banning them',
      lintRules: emptyRulesetsUnderBanned,
      expected: BANNED,
    },
    { file: 'legacy/a.test.ts', config: 'an entry allowing them under a top level banning them', lintRules: allowedForLegacy, expected: ALLOWED },
    { file: 'strict/a.test.ts', config: 'an entry banning them under a top level allowing them', lintRules: bannedForStrict, expected: BANNED_IN_TEST_FILES },
    { file: 'src/a.test.ts', config: 'an entry banning them under a top level allowing them', lintRules: bannedForStrict, expected: ALLOWED },
    {
      file: 'apps/web/a.test.ts',
      config: 'apps/** allowing them, then apps/web/** banning them: the later entry wins',
      lintRules: allowedForAppsThenBannedForWeb,
      expected: BANNED_IN_TEST_FILES,
    },
  ])('sets the suppression rules for $file under $config', async ({ lintRules, file, expected }) => {
    expect(await suppressionSettingsFor(agentConfigsFor(lintRules), file)).toStrictEqual(expected)
  })
})

describe('the editor parts, merged into a team config, beside the agent build of the same config', () => {
  const projects = [
    { project: 'whose package.json lists oxlint', projectDir: PROJECT_WITH_OXLINT, editorExpected: ALLOWED },
    { project: 'whose package.json lists no oxlint', projectDir: EMPTY_TSCONFIG_ROOT_DIR, editorExpected: ALLOWED_WITHOUT_OXLINT },
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
      const lintRules = buildEveryRulesetLintRules(projectDir, fields)

      expect(await suppressionSettingsFor(editorConfigsFor(lintRules), file)).toStrictEqual(editorExpected)
    },
  )

  it.each(cases)(
    'leave the agent build of $file in a project $project as allowSuppressions sets it, with $config',
    async ({ projectDir, fields, agentExpected, file }) => {
      const lintRules = buildEveryRulesetLintRules(projectDir, fields)

      expect(await suppressionSettingsFor(agentConfigsFor(lintRules), file)).toStrictEqual(agentExpected)
    },
  )
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
