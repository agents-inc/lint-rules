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

// The team configs and our settings merge-other-engine-config.test.ts reads each merge's third
// argument with: the files a merge is pointed at, rightly or wrongly, and the rules each sets.

type OurRules = NonNullable<LintRules['rules']>

/** A file of a project, by its path in the project and its text. */
export type ConfigFile = { readonly file: string; readonly text: string }

/** A file a merge may be pointed at in place of the team's config for the other engine, and the keys in it no config of that engine holds, in the order the file gives them. */
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
// A monorepo package's tsconfig.json, as this repo's own are written, extending shared configs: by a
// string, and by an array of packages, so no path in it names a file beside it. An oxlint config holds
// `extends` and ESLint's defineConfig takes it, so only its other keys are foreign to either.
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

/**
 * Files named as the team's oxlint config that are none (spec-merge-model.md, 1.3): the project's
 * package.json and tsconfig.json, each JSON, so read as a JSON oxlint config is; a package's
 * tsconfig.json extending shared configs, each holding `extends`, which an oxlint config holds too,
 * beside keys one does not; and a team ESLint config, a module, holding rules, which an oxlint config
 * holds too, beside keys one does not.
 */
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

/**
 * Files named as the team's ESLint config that are none: the project's package.json, whose name an
 * ESLint block holds too, beside keys one does not; its tsconfig.json; a package's tsconfig.json
 * extending shared configs, each holding `extends`, which ESLint's defineConfig takes too, beside
 * keys no block holds; a team oxlint config, a module, holding rules, which an ESLint block holds
 * too, beside keys one does not; and a team ESLint config, a module, whose first block an ESLint
 * config can hold and whose second holds eslintrc's `env`, which no block holds.
 */
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

/** The files given, as a project holds them. */
export function filesOf(configFiles: readonly ConfigFile[]): ProjectFiles {
  return Object.fromEntries(configFiles.map(({ file, text }) => [file, text]))
}

/** A team oxlint config turning no-var off: as JSON, holding every key oxlint's schema lists, `$schema` too; and as a module, every key oxlint's type for one gives, which leaves `$schema` out. */
export const OXLINT_CONFIGS_HOLDING_EVERY_KEY: readonly (ConfigFile & { readonly form: string })[] = [
  { form: 'a JSON config with every schema key', file: 'team-every-key.oxlintrc.json', text: jsonFileText(buildTeamOxlintrcHoldingEveryKey(NO_VAR)) },
  { form: 'a module with every key its type gives', file: 'team-every-key.oxlint.config.mts', text: moduleExportingByDefaultText(buildTeamOxlintConfigHoldingEveryKey(NO_VAR)) },
]

/** A team ESLint config, a module, whose one block holds every key an ESLint block can hold, turning no-debugger off. */
export const ESLINT_CONFIG_HOLDING_EVERY_KEY: ConfigFile = {
  file: 'team-every-key.eslint.config.mjs',
  text: moduleExportingByDefaultText([buildTeamEslintBlockHoldingEveryKey('team/every-key', NO_DEBUGGER)]),
}

/** An oxlint config module setting no rule. */
export const OXLINT_CONFIG_SETTING_NO_RULE_TEXT = moduleExportingByDefaultText(buildTeamOxlintConfig())

const NO_BLOCK: readonly Linter.Config[] = []

/** An ESLint config module setting no rule. */
export const ESLINT_CONFIG_SETTING_NO_RULE_TEXT = moduleExportingByDefaultText(NO_BLOCK)

/**
 * JSON oxlint configs beside oxlint's own correctness: warn: one writing correctness off, one writing
 * no category, one writing correctness on, and one extending that one by path.
 */
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

/**
 * A team's JSON oxlint config under a comment, writing correctness off and extending by path a
 * config in a folder of its own, which extends another beside it by path, which turns no-var on.
 */
export const TEAM_OXLINTRC_EXTENDING_THROUGH_A_FOLDER = 'team.oxlintrc.json'

export const teamOxlintrcExtendingThroughAFolderFiles: ProjectFiles = {
  [TEAM_OXLINTRC_EXTENDING_THROUGH_A_FOLDER]: jsonFileTextUnderAComment(buildTeamOxlintrcExtending(['./config/base.json'], EMPTY_TEAM_OXLINT_CONFIG), "the team's own config"),
  'config/base.json': jsonFileText(buildTeamOxlintrcExtending(['./deeper.json'])),
  'config/deeper.json': jsonFileText(buildTeamOxlintConfig({ rules: { [NO_VAR]: 'warn' } })),
}

/**
 * The team's two configs, each setting one rule each engine runs for us, in legacy/** alone: its
 * eslint.config.mjs, which calls no merge of ours, and its JSON oxlint config.
 */
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

/**
 * The team's ESLint block registering typescript-eslint under ts, as antfu's config does, and
 * turning no-explicit-any off there, by its source: only the plugins we register name the rule
 * under that prefix ours.
 */
export const TEAMS_ESLINT_NO_EXPLICIT_ANY_OFF_UNDER_TS = "{ files: ['**/*.{js,ts}'], plugins: { ts: tseslint.plugin }, rules: { 'ts/no-explicit-any': 'off' } }"
