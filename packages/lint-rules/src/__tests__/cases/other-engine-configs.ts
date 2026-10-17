import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import type { LintRules } from '../../index.ts'
import { CONSUMER_CONFIG_FILES } from '../factories/consumer-project-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from '../factories/package-json-factories.ts'
import { buildTeamOxlintrcExtending } from '../factories/shape-factories.ts'
import {
  buildTeamBlockHoldingEslintrcEnv,
  buildTeamEslintBlock,
  buildTeamEslintBlockHoldingEveryKey,
  buildTeamOxlintConfig,
  buildTeamOxlintConfigHoldingEveryKey,
  buildTeamOxlintrcHoldingEveryKey,
} from '../factories/team-config-factories.ts'
import { jsonFileText, jsonFileTextUnderAComment, moduleExportingByDefaultText } from '../factories/team-config-file-factories.ts'
import { buildTsconfig, buildTsconfigExtending } from '../factories/tsconfig-factories.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from '../team-configs-of-the-other-engine.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// Files a merge's third argument is pointed at, rightly or wrongly, for merge-other-engine-config.test.ts.

type OurRules = NonNullable<LintRules['rules']>

export type ConfigFile = { readonly file: string; readonly text: string }

/** `foreignKeys`: the keys no config of that engine holds, in file order. */
export type NotAConfigFile = ConfigFile & { readonly what: string; readonly foreignKeys: string }

export const NO_VAR = 'no-var'
export const ARRAY_TYPE = '@typescript-eslint/array-type'
export const NO_DEBUGGER = 'no-debugger'
export const NO_EMPTY_PATTERN = 'no-empty-pattern'
export const NO_EXPLICIT_ANY = '@typescript-eslint/no-explicit-any'
export const NO_WARNING_COMMENTS = 'no-warning-comments'
export const MAX_LINES = 'max-lines'

const PACKAGE_JSON_FILE = 'package.json'
const PACKAGE_JSON_TEXT = packageJsonText(buildPackageJsonListingOxlint())
const TSCONFIG_FILE = 'tsconfig.json'
const TSCONFIG_TEXT = jsonFileText(buildTsconfig({ include: ['src'] }))
// A monorepo package's tsconfig.json extending shared configs by package name. Both engines take `extends`,
// so only its other keys are foreign to either.
const TSCONFIGS_EXTENDING_SHARED_ONES: readonly NotAConfigFile[] = [
  {
    what: 'a tsconfig.json with a string extends',
    file: 'packages/app/tsconfig.json',
    text: jsonFileText(buildTsconfigExtending('@workspace/typescript-config/node.json', { include: ['src'], exclude: ['node_modules', 'dist'] })),
    foreignKeys: 'include, exclude',
  },
  {
    what: 'a tsconfig.json with an array extends',
    file: 'packages/lib/tsconfig.json',
    text: jsonFileText(buildTsconfigExtending(['@tsconfig/strictest/tsconfig.json', '@tsconfig/node22/tsconfig.json'], { compilerOptions: { noEmit: true }, include: ['src'] })),
    foreignKeys: 'compilerOptions, include',
  },
]

/** Our no-var and array-type, which ESLint runs for us. */
export const OURS_RUN_BY_ESLINT: OurRules = { [NO_VAR]: 'error', [ARRAY_TYPE]: 'error' }

/** Our no-debugger and no-empty-pattern, which oxlint runs for us. */
export const OURS_RUN_BY_OXLINT: OurRules = { [NO_DEBUGGER]: 'error', [NO_EMPTY_PATTERN]: 'error' }

/** Files named as the team's oxlint config that are none, each holding keys an oxlint config holds beside ones it does not. */
export const FILES_THAT_ARE_NO_OXLINT_CONFIG: readonly NotAConfigFile[] = [
  { what: "the project's package.json", file: PACKAGE_JSON_FILE, text: PACKAGE_JSON_TEXT, foreignKeys: 'name, private, type, devDependencies' },
  { what: "the project's tsconfig.json", file: TSCONFIG_FILE, text: TSCONFIG_TEXT, foreignKeys: 'compilerOptions, include' },
  ...TSCONFIGS_EXTENDING_SHARED_ONES,
  {
    what: 'an ESLint config module',
    file: 'team.eslint.config.mts',
    text: moduleExportingByDefaultText(buildTeamEslintBlock('team/ts', { files: ['**/*.ts'], rules: { [NO_DEBUGGER]: 'off' } })),
    foreignKeys: 'name, files',
  },
]

/** Files named as the team's ESLint config that are none, each holding keys an ESLint config holds beside ones it does not. */
export const FILES_THAT_ARE_NO_ESLINT_CONFIG: readonly NotAConfigFile[] = [
  { what: "the project's package.json", file: PACKAGE_JSON_FILE, text: PACKAGE_JSON_TEXT, foreignKeys: 'private, type, devDependencies' },
  { what: "the project's tsconfig.json", file: TSCONFIG_FILE, text: TSCONFIG_TEXT, foreignKeys: 'compilerOptions, include' },
  ...TSCONFIGS_EXTENDING_SHARED_ONES,
  {
    what: 'an oxlint config module',
    file: 'team.oxlint.config.mts',
    text: moduleExportingByDefaultText(buildTeamOxlintConfig({ categories: { correctness: 'off' }, rules: { [NO_DEBUGGER]: 'off' } })),
    foreignKeys: 'categories',
  },
  {
    what: 'a module whose second block holds env',
    file: 'team-half-migrated.eslint.config.mjs',
    text: moduleExportingByDefaultText([
      buildTeamEslintBlock('team/ts', { files: ['**/*.ts'], rules: { [NO_DEBUGGER]: 'off' } }),
      buildTeamBlockHoldingEslintrcEnv('team/node', { node: true }),
    ]),
    foreignKeys: 'env',
  },
]

export function filesOf(configFiles: readonly ConfigFile[]): ProjectFiles {
  return Object.fromEntries(configFiles.map(({ file, text }) => [file, text]))
}

/** As JSON, `$schema` too; as a module, every key oxlint's type gives, which leaves `$schema` out. */
export const OXLINT_CONFIGS_HOLDING_EVERY_KEY: readonly (ConfigFile & { readonly form: string })[] = [
  { form: 'a JSON config with every schema key', file: 'team-every-key.oxlintrc.json', text: jsonFileText(buildTeamOxlintrcHoldingEveryKey(NO_VAR)) },
  { form: 'a module with every key its type gives', file: 'team-every-key.oxlint.config.mts', text: moduleExportingByDefaultText(buildTeamOxlintConfigHoldingEveryKey(NO_VAR)) },
]

export const ESLINT_CONFIG_HOLDING_EVERY_KEY: ConfigFile = {
  file: 'team-every-key.eslint.config.mjs',
  text: moduleExportingByDefaultText([buildTeamEslintBlockHoldingEveryKey('team/every-key', NO_DEBUGGER)]),
}

export const OXLINT_CONFIG_SETTING_NO_RULE_TEXT = moduleExportingByDefaultText(buildTeamOxlintConfig())

const NO_BLOCK: readonly Linter.Config[] = []

export const ESLINT_CONFIG_SETTING_NO_RULE_TEXT = moduleExportingByDefaultText(NO_BLOCK)

/** JSON oxlint configs beside oxlint's own correctness: warn: correctness off, none, on, and extending the on one by path. */
export const TEAM_OXLINTRC_WRITING_CORRECTNESS_OFF = 'team.oxlintrc.json'
export const TEAM_OXLINTRC_WRITING_NO_CATEGORY = 'team-writing-no-category.oxlintrc.json'
export const TEAM_OXLINTRC_WRITING_CORRECTNESS_ON = 'team-writing-correctness-on.oxlintrc.json'
export const TEAM_OXLINTRC_EXTENDING_ONE_WRITING_CORRECTNESS_ON = 'team-extending.oxlintrc.json'

export const teamOxlintrcsBesideOxlintsOwnCorrectnessFiles: ProjectFiles = {
  [TEAM_OXLINTRC_WRITING_CORRECTNESS_OFF]: jsonFileText(EMPTY_TEAM_OXLINT_CONFIG),
  [TEAM_OXLINTRC_WRITING_NO_CATEGORY]: jsonFileText(buildTeamOxlintConfig()),
  [TEAM_OXLINTRC_WRITING_CORRECTNESS_ON]: jsonFileText(buildTeamOxlintConfig({ categories: { correctness: 'warn' } })),
  [TEAM_OXLINTRC_EXTENDING_ONE_WRITING_CORRECTNESS_ON]: jsonFileText(buildTeamOxlintrcExtending([`./${TEAM_OXLINTRC_WRITING_CORRECTNESS_ON}`])),
}

/** Extends by path a config in its own folder, which extends a sibling by path turning no-var on. */
export const TEAM_OXLINTRC_EXTENDING_THROUGH_A_FOLDER = 'team.oxlintrc.json'

export const teamOxlintrcExtendingThroughAFolderFiles: ProjectFiles = {
  [TEAM_OXLINTRC_EXTENDING_THROUGH_A_FOLDER]: jsonFileTextUnderAComment(buildTeamOxlintrcExtending(['./config/base.json'], EMPTY_TEAM_OXLINT_CONFIG), "the team's own config"),
  'config/base.json': jsonFileText(buildTeamOxlintrcExtending(['./deeper.json'])),
  'config/deeper.json': jsonFileText(buildTeamOxlintConfig({ rules: { [NO_VAR]: 'warn' } })),
}

/** The team's eslint.config.mjs, calling no merge of ours, and its JSON oxlint config, each setting one rule in legacy/ alone. */
export const TEAM_ESLINT_BLOCKS_IN_LEGACY: Linter.Config[] = [
  buildTeamEslintBlock('team/legacy', { files: ['legacy/**'], rules: { [NO_WARNING_COMMENTS]: 'off', [MAX_LINES]: 'off' } }),
]
export const TEAM_OXLINT_CONFIG_IN_LEGACY: OxlintConfig = buildTeamOxlintConfig({
  ...EMPTY_TEAM_OXLINT_CONFIG,
  overrides: [{ files: ['legacy/**'], rules: { [NO_DEBUGGER]: 'off', [NO_VAR]: 'off' } }],
})
export const TEAM_OXLINTRC_SETTING_RULES_IN_LEGACY = 'team.oxlintrc.json'

export const teamConfigsSettingRulesInLegacyFiles: ProjectFiles = {
  [CONSUMER_CONFIG_FILES.eslint]: moduleExportingByDefaultText(TEAM_ESLINT_BLOCKS_IN_LEGACY),
  [TEAM_OXLINTRC_SETTING_RULES_IN_LEGACY]: jsonFileText(TEAM_OXLINT_CONFIG_IN_LEGACY),
}

/** Ours beside them: oxlint runs no-warning-comments, no-debugger and no-empty-pattern for us; ESLint max-lines, no-var and array-type. */
export const OURS_BESIDE_THE_LEGACY_CONFIGS: OurRules = {
  [NO_WARNING_COMMENTS]: 'error',
  [NO_DEBUGGER]: 'error',
  [NO_EMPTY_PATTERN]: 'error',
  [MAX_LINES]: 'error',
  [NO_VAR]: 'error',
  [ARRAY_TYPE]: 'error',
}

/** Our no-explicit-any and no-debugger: oxlint runs both. */
export const OURS_NO_EXPLICIT_ANY_AND_DEBUGGER: OurRules = { [NO_EXPLICIT_ANY]: 'error', [NO_DEBUGGER]: 'error' }

/** Registers typescript-eslint under ts, as antfu's config does: only the plugins we register make that prefix's rule ours. */
export const TEAMS_ESLINT_NO_EXPLICIT_ANY_OFF_UNDER_TS = "{ files: ['**/*.{js,ts}'], plugins: { ts: tseslint.plugin }, rules: { 'ts/no-explicit-any': 'off' } }"
