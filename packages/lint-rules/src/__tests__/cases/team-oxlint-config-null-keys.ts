import { join } from 'node:path'
import { CONSUMER_CONFIG_FILES, EMPTY_TEAM_ESLINT_MODULE_FILE, mergedEslintConfigText } from '../factories/consumer-project-factories.ts'
import { buildTeamOxlintConfig } from '../factories/team-config-factories.ts'
import { jsonFileText, moduleExportingByDefaultText } from '../factories/team-config-file-factories.ts'
import type { ProjectFiles } from '../temp-projects.ts'
import { type ConfigFile, NO_DEBUGGER } from './other-engine-configs.ts'

// A team's oxlint config holding null where oxlint itself refuses it (measured, 1.87), for
// merge-other-engine-config.refusals.test.ts and team-oxlint-config-null-keys.integration.test.ts: at every key of a
// config but $schema, jsPlugins and plugins, and below a key wherever oxlint refuses it whatever the rule or plugin, in
// the config and in each config it extends. Each merge refuses it, naming the file, the file extended by path or the
// path to the object extended that holds it, and the path to the null. A null oxlint takes is read, and so is one
// among a rule's options or in a plugin's settings, which oxlint refuses for some rules and settings and not others.
//
// plugins null is no refusal: oxlint takes it, at a root, in a config extended and in an override, and lints exactly
// as with plugins left out, its default plugins included, where plugins [] runs none of them (measured, 1.87). Each
// merge reads it so. Each config listing plugins below writes correctness on, so the plugins it runs decide whether it
// runs no-this-alias, under typescript, one of oxlint's default plugins; each null sits beside its twin leaving plugins
// out and one listing other plugins.

/** A key oxlint refuses null at, in a config and in each config it extends (measured, 1.87). */
export type NullKey = 'categories' | 'env' | 'extends' | 'globals' | 'ignorePatterns' | 'options' | 'overrides' | 'rules' | 'settings'

/** Where the null sits below the root of the config named: in a file it extends by path, or at the path to an object it extends, as `extends[0].`. */
type HeldBelowTheRoot = { readonly heldIn?: string; readonly at?: string }

export type FileHoldingANullKey = ConfigFile & HeldBelowTheRoot & { readonly what: string; readonly key: NullKey }

export type FileRead = ConfigFile & { readonly what: string }

/** A config handed to mergeOxlintConfig, typed unknown as an oxlint.config.mts nobody type-checks may write it. */
export type TheirsGiven = { readonly what: string; readonly theirs: unknown }

export type TheirsHoldingANullKey = TheirsGiven & Pick<HeldBelowTheRoot, 'at'> & { readonly key: NullKey }

/** The path a refusal names to a null below a key, as `overrides[0].rules["no-debugger"]`. */
type PathToTheNull = { readonly location: string }

/** Written as a JSON config, a module and a config handed to mergeOxlintConfig; `slug` names its files. */
type ConfigHoldingANull = { readonly what: string; readonly slug: string; readonly config: Readonly<Record<string, unknown>> }

type NullBelowAKey = ConfigHoldingANull & PathToTheNull

export type FileHoldingANullBelowAKey = ConfigFile & HeldBelowTheRoot & PathToTheNull & { readonly what: string }

export type TheirsHoldingANullBelowAKey = TheirsGiven & Pick<HeldBelowTheRoot, 'at'> & PathToTheNull

// What oxlint takes at each key in place of the null, in the refusal's words.
const WHAT_OXLINT_TAKES_AT: Readonly<Record<NullKey, string>> = {
  categories: 'an object',
  env: 'an object',
  extends: 'an array',
  globals: 'an object',
  ignorePatterns: 'an array',
  options: 'an object',
  overrides: 'an array',
  rules: 'an object',
  settings: 'an object',
}

const CORRECTNESS_ON = buildTeamOxlintConfig({ categories: { correctness: 'error' } })
const CORRECTNESS_ON_LISTING_IMPORT = buildTeamOxlintConfig({ ...CORRECTNESS_ON, plugins: ['import'] })
const CORRECTNESS_ON_LISTING_NO_PLUGIN = buildTeamOxlintConfig({ ...CORRECTNESS_ON, plugins: [] })
const SOURCES = 'src/**'
// Each null oxlint takes in an override (measured, 1.87).
const OVERRIDE_HOLDING_NULLS_OXLINT_TAKES = { files: [SOURCES], env: null, globals: null, plugins: null, jsPlugins: null }
const RULE_ENTRY_NULL = { [NO_DEBUGGER]: null }
const ENV_ENTRY_NULL = { browser: null }
const GLOBAL_NULL = { jQuery: null }
const JS_PLUGIN = './local-plugin.mjs'
// Where an extended object holds the null, the path to it leads.
const IN_THE_FIRST_OBJECT_EXTENDED = 'extends[0].'
// Each null oxlint takes below a key (measured, 1.87): every option, a key of no plugin's in settings, and these settings.
const NULLS_OXLINT_TAKES_BELOW_A_KEY = {
  options: { denyWarnings: null, maxWarnings: null, reportUnusedDisableDirectives: null, respectEslintDisableDirectives: null, typeAware: null, typeCheck: null },
  settings: { custom: null, jest: { version: null }, 'jsx-a11y': { polymorphicPropName: null }, react: { version: null } },
}

const OVERRIDE_FILES_NULL: NullBelowAKey = { what: "an override's files null", slug: 'override-files-null', config: { overrides: [{ files: null }] }, location: 'overrides[0].files' }
const OVERRIDE_RULES_NULL: NullBelowAKey = {
  what: "an override's rules null",
  slug: 'override-rules-null',
  config: { overrides: [{ files: [SOURCES], rules: null }] },
  location: 'overrides[0].rules',
}
const RULE_NULL: NullBelowAKey = { what: "a rule's entry null", slug: 'rule-null', config: { rules: RULE_ENTRY_NULL }, location: 'rules["no-debugger"]' }
const CORRECTNESS_NULL: NullBelowAKey = {
  what: 'correctness null in categories',
  slug: 'correctness-null',
  config: { categories: { correctness: null } },
  location: 'categories["correctness"]',
}
const ENV_NULL: NullBelowAKey = { what: 'an env entry null', slug: 'env-entry-null', config: { env: ENV_ENTRY_NULL }, location: 'env["browser"]' }
const EXTENDS_SLOT_NULL: NullBelowAKey = { what: 'a null in extends', slug: 'extends-slot-null', config: { extends: [null] }, location: 'extends[0]' }
const OVERRIDES_SLOT_NULL: NullBelowAKey = { what: 'a null in overrides', slug: 'overrides-slot-null', config: { overrides: [null] }, location: 'overrides[0]' }
const PLUGINS_SECOND_SLOT_NULL: NullBelowAKey = {
  what: 'a null after a plugin in plugins',
  slug: 'plugins-second-slot-null',
  config: { plugins: ['import', null] },
  location: 'plugins[1]',
}

const JS_PLUGIN_NAME_NULL: NullBelowAKey = {
  what: "a JS plugin's name null",
  slug: 'js-plugin-name-null',
  config: { jsPlugins: [{ name: null, specifier: JS_PLUGIN }] },
  location: 'jsPlugins[0].name',
}
const JS_PLUGIN_SPECIFIER_NULL: NullBelowAKey = {
  what: "a JS plugin's specifier null",
  slug: 'js-plugin-specifier-null',
  config: { jsPlugins: [{ name: 'local', specifier: null }] },
  location: 'jsPlugins[0].specifier',
}

function pluginSettingsNull(plugin: string): NullBelowAKey {
  return { what: `${plugin}'s settings null`, slug: `${plugin}-settings-null`, config: { settings: { [plugin]: null } }, location: `settings["${plugin}"]` }
}

const NULLS_OXLINT_REFUSES_BELOW_A_KEY: readonly NullBelowAKey[] = [
  OVERRIDE_FILES_NULL,
  {
    what: "an override's excludeFiles null",
    slug: 'override-exclude-files-null',
    config: { overrides: [{ files: [SOURCES], excludeFiles: null }] },
    location: 'overrides[0].excludeFiles',
  },
  OVERRIDE_RULES_NULL,
  {
    what: "the second override's rules null",
    slug: 'second-override-rules-null',
    config: { overrides: [{ files: [SOURCES] }, { files: [SOURCES], rules: null }] },
    location: 'overrides[1].rules',
  },
  {
    what: "a null after a glob in an override's files",
    slug: 'override-files-slot-null',
    config: { overrides: [{ files: [SOURCES, null] }] },
    location: 'overrides[0].files[1]',
  },
  {
    what: "a null in an override's excludeFiles",
    slug: 'override-exclude-files-slot-null',
    config: { overrides: [{ files: [SOURCES], excludeFiles: [null] }] },
    location: 'overrides[0].excludeFiles[0]',
  },
  {
    what: "a rule's entry null in an override",
    slug: 'override-rule-null',
    config: { overrides: [{ files: [SOURCES], rules: RULE_ENTRY_NULL }] },
    location: 'overrides[0].rules["no-debugger"]',
  },
  {
    what: "a rule's severity null in an override",
    slug: 'override-rule-severity-null',
    config: { overrides: [{ files: [SOURCES], rules: { [NO_DEBUGGER]: [null] } }] },
    location: 'overrides[0].rules["no-debugger"][0]',
  },
  {
    what: 'an env entry null in an override',
    slug: 'override-env-entry-null',
    config: { overrides: [{ files: [SOURCES], env: ENV_ENTRY_NULL }] },
    location: 'overrides[0].env["browser"]',
  },
  {
    what: 'a global null in an override',
    slug: 'override-global-null',
    config: { overrides: [{ files: [SOURCES], globals: GLOBAL_NULL }] },
    location: 'overrides[0].globals["jQuery"]',
  },
  {
    what: "a null in an override's plugins",
    slug: 'override-plugins-slot-null',
    config: { overrides: [{ files: [SOURCES], plugins: [null] }] },
    location: 'overrides[0].plugins[0]',
  },
  {
    what: "a null in an override's jsPlugins",
    slug: 'override-js-plugins-slot-null',
    config: { overrides: [{ files: [SOURCES], jsPlugins: [null] }] },
    location: 'overrides[0].jsPlugins[0]',
  },
  RULE_NULL,
  { what: "a rule's severity null", slug: 'rule-severity-null', config: { rules: { [NO_DEBUGGER]: [null] } }, location: 'rules["no-debugger"][0]' },
  CORRECTNESS_NULL,
  { what: 'style null in categories', slug: 'style-null', config: { categories: { style: null } }, location: 'categories["style"]' },
  ENV_NULL,
  { what: 'a global null', slug: 'global-null', config: { globals: GLOBAL_NULL }, location: 'globals["jQuery"]' },
  ...['jest', 'jsdoc', 'jsx-a11y', 'next', 'react', 'vitest'].map(pluginSettingsNull),
  EXTENDS_SLOT_NULL,
  OVERRIDES_SLOT_NULL,
  PLUGINS_SECOND_SLOT_NULL,
  { what: 'a null in ignorePatterns', slug: 'ignore-patterns-slot-null', config: { ignorePatterns: [null] }, location: 'ignorePatterns[0]' },
  { what: 'a null in jsPlugins', slug: 'js-plugins-slot-null', config: { jsPlugins: [null] }, location: 'jsPlugins[0]' },
  JS_PLUGIN_NAME_NULL,
  JS_PLUGIN_SPECIFIER_NULL,
]

// oxlint refuses each, but whether it refuses a null among a rule's options or in a plugin's settings depends on the rule
// or setting (measured, 1.87: no-unused-vars takes ["error", null], and react's version takes null).
const NULLS_OXLINT_REFUSES_FOR_SOME_RULES_OR_SETTINGS: readonly ConfigHoldingANull[] = [
  { what: "a null among a rule's options", slug: 'rule-options-null', config: { rules: { [NO_DEBUGGER]: ['error', null] } } },
  {
    what: "a null among a rule's options in an override",
    slug: 'override-rule-options-null',
    config: { overrides: [{ files: [SOURCES], rules: { [NO_DEBUGGER]: ['error', null] } }] },
  },
  { what: "a null in jsdoc's settings", slug: 'jsdoc-setting-null', config: { settings: { jsdoc: { ignoreInternal: null } } } },
  { what: "a null in react's formComponents", slug: 'react-form-components-slot-null', config: { settings: { react: { formComponents: [null] } } } },
]

function oxlintrcHolding({ what, slug, config, location }: NullBelowAKey): FileHoldingANullBelowAKey {
  return { what, file: `${slug}.oxlintrc.json`, text: jsonFileText(config), location }
}

function fileExtendedHolding({ slug, config }: NullBelowAKey): ConfigFile {
  return { file: `${slug}.base.oxlintrc.json`, text: jsonFileText(config) }
}

function oxlintrcExtendingAFileHolding(row: NullBelowAKey): FileHoldingANullBelowAKey {
  const extended = fileExtendedHolding(row)
  return {
    what: `${row.what} in a file it extends`,
    file: `extending-${row.slug}.oxlintrc.json`,
    text: jsonFileText({ extends: [`./${extended.file}`] }),
    location: row.location,
    heldIn: extended.file,
  }
}

function moduleHolding({ what, slug, config, location }: NullBelowAKey): FileHoldingANullBelowAKey {
  return { what, file: `${slug}.oxlint.config.mjs`, text: moduleExportingByDefaultText(config), location }
}

function moduleExtendingAnObjectHolding({ what, slug, config, location }: NullBelowAKey): FileHoldingANullBelowAKey {
  return {
    what: `${what} in an object it extends`,
    file: `extending-${slug}.oxlint.config.mjs`,
    text: moduleExportingByDefaultText({ extends: [config] }),
    location,
    at: IN_THE_FIRST_OBJECT_EXTENDED,
  }
}

function theirsHolding({ what, config, location }: NullBelowAKey): TheirsHoldingANullBelowAKey {
  return { what, theirs: config, location }
}

function theirsExtendingAnObjectHolding({ what, config, location }: NullBelowAKey): TheirsHoldingANullBelowAKey {
  return { what: `${what} in an object it extends`, theirs: { extends: [config] }, location, at: IN_THE_FIRST_OBJECT_EXTENDED }
}

/** JSON, read by mergeEslintConfig. */
export const OXLINTRCS_HOLDING_A_NULL_BELOW_A_KEY: readonly FileHoldingANullBelowAKey[] = NULLS_OXLINT_REFUSES_BELOW_A_KEY.flatMap((row) => [
  oxlintrcHolding(row),
  oxlintrcExtendingAFileHolding(row),
])

/** A module exporting a plain object by default, read by mergeEslintConfig. */
export const MODULES_HOLDING_A_NULL_BELOW_A_KEY: readonly FileHoldingANullBelowAKey[] = NULLS_OXLINT_REFUSES_BELOW_A_KEY.flatMap((row) => [
  moduleHolding(row),
  moduleExtendingAnObjectHolding(row),
])

export const THEIRS_HOLDING_A_NULL_BELOW_A_KEY: readonly TheirsHoldingANullBelowAKey[] = NULLS_OXLINT_REFUSES_BELOW_A_KEY.flatMap((row) => [
  theirsHolding(row),
  theirsExtendingAnObjectHolding(row),
])

/** At a key oxlint refuses left out as well (measured, 1.87), so what to write there cannot be to leave it out. */
export const THEIRS_HOLDING_A_NULL_AT_A_KEY_OXLINT_REQUIRES: readonly TheirsHoldingANullBelowAKey[] = [OVERRIDE_FILES_NULL, JS_PLUGIN_NAME_NULL, JS_PLUGIN_SPECIFIER_NULL].map(
  theirsHolding,
)

export const OXLINTRC_OVERRIDE_FILES_NULL = oxlintrcHolding(OVERRIDE_FILES_NULL)

export const OXLINTRC_OVERRIDE_RULES_NULL = oxlintrcHolding(OVERRIDE_RULES_NULL)

export const OXLINTRC_OVERRIDES_SLOT_NULL = oxlintrcHolding(OVERRIDES_SLOT_NULL)

export const OXLINTRC_EXTENDING_A_FILE_HOLDING_A_RULE_NULL = oxlintrcExtendingAFileHolding(RULE_NULL)

export const THEIRS_EXTENDS_SLOT_NULL = theirsHolding(EXTENDS_SLOT_NULL)

export const THEIRS_PLUGINS_SECOND_SLOT_NULL = theirsHolding(PLUGINS_SECOND_SLOT_NULL)

export const THEIRS_CORRECTNESS_NULL = theirsHolding(CORRECTNESS_NULL)

export const THEIRS_EXTENDING_AN_OBJECT_HOLDING_AN_ENV_NULL = theirsExtendingAnObjectHolding(ENV_NULL)

export const OXLINTRC_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY: FileRead = {
  what: 'null at each option and at settings oxlint takes it at',
  file: 'nulls-taken-below-a-key.oxlintrc.json',
  text: jsonFileText(NULLS_OXLINT_TAKES_BELOW_A_KEY),
}

export const THEIRS_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY: TheirsGiven = {
  what: 'null at each option and at settings oxlint takes it at',
  theirs: NULLS_OXLINT_TAKES_BELOW_A_KEY,
}

const EXTENDED_WRITING_CORRECTNESS: ConfigFile = { file: 'correctness.base.oxlintrc.json', text: jsonFileText(CORRECTNESS_ON) }
const EXTENDED_HOLDING_OPTIONS_NULL: ConfigFile = { file: 'options-null.base.oxlintrc.json', text: jsonFileText({ options: null }) }
const EXTENDED_HOLDING_CATEGORIES_NULL: ConfigFile = { file: 'categories-null.base.oxlintrc.json', text: jsonFileText({ categories: null }) }
const EXTENDED_HOLDING_ENV_NULL: ConfigFile = { file: 'env-null.base.oxlintrc.json', text: jsonFileText({ env: null }) }
const EXTENDED_HOLDING_EXTENDS_NULL: ConfigFile = { file: 'extends-null.base.oxlintrc.json', text: jsonFileText({ extends: null }) }
const EXTENDED_HOLDING_RULES_NULL: ConfigFile = { file: 'rules-null.base.oxlintrc.json', text: jsonFileText({ rules: null }) }
const EXTENDED_EXTENDING_RULES_NULL: ConfigFile = { file: 'extending-rules-null.base.oxlintrc.json', text: jsonFileText({ extends: [`./${EXTENDED_HOLDING_RULES_NULL.file}`] }) }
const EXTENDED_HOLDING_JS_PLUGINS_NULL: ConfigFile = { file: 'js-plugins-null.base.oxlintrc.json', text: jsonFileText({ jsPlugins: null }) }
const EXTENDED_HOLDING_PLUGINS_NULL: ConfigFile = { file: 'plugins-null.base.oxlintrc.json', text: jsonFileText({ plugins: null }) }
const EXTENDED_LEAVING_PLUGINS_OUT: ConfigFile = { file: 'plugins-left-out.base.oxlintrc.json', text: jsonFileText(buildTeamOxlintConfig()) }
const EXTENDED_LISTING_NO_PLUGIN: ConfigFile = { file: 'no-plugin.base.oxlintrc.json', text: jsonFileText(buildTeamOxlintConfig({ plugins: [] })) }

/** Written beside the configs below, which extend them by path. */
export const FILES_THE_TEAMS_OXLINT_CONFIGS_EXTEND: readonly ConfigFile[] = [
  EXTENDED_WRITING_CORRECTNESS,
  EXTENDED_HOLDING_OPTIONS_NULL,
  EXTENDED_HOLDING_CATEGORIES_NULL,
  EXTENDED_HOLDING_ENV_NULL,
  EXTENDED_HOLDING_EXTENDS_NULL,
  EXTENDED_HOLDING_RULES_NULL,
  EXTENDED_EXTENDING_RULES_NULL,
  EXTENDED_HOLDING_JS_PLUGINS_NULL,
  EXTENDED_HOLDING_PLUGINS_NULL,
  EXTENDED_LEAVING_PLUGINS_OUT,
  EXTENDED_LISTING_NO_PLUGIN,
  ...NULLS_OXLINT_REFUSES_BELOW_A_KEY.map(fileExtendedHolding),
]

function oxlintrcHoldingNullAt(key: NullKey): FileHoldingANullKey {
  return { what: `${key} null`, file: `${key}-null.oxlintrc.json`, text: jsonFileText({ [key]: null }), key }
}

function theirsHoldingNullAt(key: NullKey): TheirsHoldingANullKey {
  return { what: `${key} null`, theirs: { [key]: null }, key }
}

export const OXLINTRC_OPTIONS_NULL: FileHoldingANullKey = {
  what: 'options null',
  file: 'options-null.oxlintrc.json',
  text: jsonFileText({ options: null }),
  key: 'options',
}

export const OXLINTRC_CATEGORIES_NULL: FileHoldingANullKey = {
  what: 'categories null, extends left out',
  file: 'categories-null.oxlintrc.json',
  text: jsonFileText({ categories: null }),
  key: 'categories',
}

export const OXLINTRC_CATEGORIES_NULL_BESIDE_EXTENDS: FileHoldingANullKey = {
  what: 'categories null, extending a file',
  file: 'categories-null-beside-extends.oxlintrc.json',
  text: jsonFileText({ extends: [`./${EXTENDED_WRITING_CORRECTNESS.file}`], categories: null }),
  key: 'categories',
}

export const OXLINTRC_ENV_NULL = oxlintrcHoldingNullAt('env')

export const OXLINTRC_EXTENDING_OPTIONS_NULL: FileHoldingANullKey = {
  what: 'options null in a file it extends',
  file: 'extending-options-null.oxlintrc.json',
  text: jsonFileText({ extends: [`./${EXTENDED_HOLDING_OPTIONS_NULL.file}`] }),
  key: 'options',
  heldIn: EXTENDED_HOLDING_OPTIONS_NULL.file,
}

export const OXLINTRC_EMPTY_OBJECTS: FileRead = {
  what: 'options and categories as empty objects',
  file: 'empty-objects.oxlintrc.json',
  text: jsonFileText({ options: {}, categories: {} }),
}

/** JSON, read by mergeEslintConfig. */
export const OXLINTRCS_HOLDING_A_NULL_KEY: readonly FileHoldingANullKey[] = [
  OXLINTRC_OPTIONS_NULL,
  {
    what: 'options null, extending a file',
    file: 'options-null-beside-extends.oxlintrc.json',
    text: jsonFileText({ extends: [`./${EXTENDED_WRITING_CORRECTNESS.file}`], options: null }),
    key: 'options',
  },
  OXLINTRC_CATEGORIES_NULL,
  {
    what: 'categories null beside an empty extends',
    file: 'categories-null-extends-empty.oxlintrc.json',
    text: jsonFileText({ extends: [], categories: null }),
    key: 'categories',
  },
  OXLINTRC_CATEGORIES_NULL_BESIDE_EXTENDS,
  {
    what: 'options and categories both null',
    file: 'both-null.oxlintrc.json',
    text: jsonFileText({ options: null, categories: null }),
    key: 'options',
  },
  OXLINTRC_ENV_NULL,
  ...(['extends', 'globals', 'ignorePatterns', 'overrides', 'rules', 'settings'] as const).map(oxlintrcHoldingNullAt),
  OXLINTRC_EXTENDING_OPTIONS_NULL,
  {
    what: 'categories null in a file it extends',
    file: 'extending-categories-null.oxlintrc.json',
    text: jsonFileText({ extends: [`./${EXTENDED_HOLDING_CATEGORIES_NULL.file}`] }),
    key: 'categories',
    heldIn: EXTENDED_HOLDING_CATEGORIES_NULL.file,
  },
  {
    what: 'env null in a file it extends',
    file: 'extending-env-null.oxlintrc.json',
    text: jsonFileText({ extends: [`./${EXTENDED_HOLDING_ENV_NULL.file}`] }),
    key: 'env',
    heldIn: EXTENDED_HOLDING_ENV_NULL.file,
  },
  {
    what: 'extends null in a file it extends',
    file: 'extending-extends-null.oxlintrc.json',
    text: jsonFileText({ extends: [`./${EXTENDED_HOLDING_EXTENDS_NULL.file}`] }),
    key: 'extends',
    heldIn: EXTENDED_HOLDING_EXTENDS_NULL.file,
  },
  {
    what: 'rules null in a file extended by a file it extends',
    file: 'extending-rules-null-deeper.oxlintrc.json',
    text: jsonFileText({ extends: [`./${EXTENDED_EXTENDING_RULES_NULL.file}`] }),
    key: 'rules',
    heldIn: EXTENDED_HOLDING_RULES_NULL.file,
  },
]

/** JSON, read by mergeEslintConfig: the allowed pair, and the nulls oxlint takes. */
export const OXLINTRCS_READ: readonly FileRead[] = [
  OXLINTRC_EMPTY_OBJECTS,
  { what: 'options and categories left out', file: 'keys-left-out.oxlintrc.json', text: jsonFileText(buildTeamOxlintConfig()) },
  { what: '$schema and jsPlugins null', file: 'schema-and-js-plugins-null.oxlintrc.json', text: jsonFileText({ $schema: null, jsPlugins: null }) },
  {
    what: 'jsPlugins null in a file it extends',
    file: 'extending-js-plugins-null.oxlintrc.json',
    text: jsonFileText({ extends: [`./${EXTENDED_HOLDING_JS_PLUGINS_NULL.file}`] }),
  },
  {
    what: 'an override holding env, globals, plugins and jsPlugins null',
    file: 'override-holding-nulls-oxlint-takes.oxlintrc.json',
    text: jsonFileText({ overrides: [OVERRIDE_HOLDING_NULLS_OXLINT_TAKES] }),
  },
  OXLINTRC_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY,
]

/** JSON, read by mergeEslintConfig: oxlint refuses each, and the merges leave that to oxlint. */
export const OXLINTRCS_LEFT_TO_OXLINT: readonly FileRead[] = NULLS_OXLINT_REFUSES_FOR_SOME_RULES_OR_SETTINGS.map(({ what, slug, config }) => ({
  what,
  file: `${slug}.oxlintrc.json`,
  text: jsonFileText(config),
}))

/** A module exporting a plain object by default, calling no merge of ours, read by mergeEslintConfig. */
export const MODULES_HOLDING_A_NULL_KEY: readonly FileHoldingANullKey[] = [
  { what: 'options null', file: 'options-null.oxlint.config.mjs', text: moduleExportingByDefaultText({ options: null }), key: 'options' },
  { what: 'categories null', file: 'categories-null.oxlint.config.mjs', text: moduleExportingByDefaultText({ categories: null }), key: 'categories' },
  // oxlint refuses a path in a module's extends, so the module extends no config object.
  {
    what: 'categories null, extends only a path',
    file: 'categories-null-beside-a-path.oxlint.config.mjs',
    text: moduleExportingByDefaultText({ extends: [`./${EXTENDED_WRITING_CORRECTNESS.file}`], categories: null }),
    key: 'categories',
  },
  {
    what: 'categories null, extending an object',
    file: 'categories-null-beside-an-object.oxlint.config.mjs',
    text: moduleExportingByDefaultText({ extends: [CORRECTNESS_ON], categories: null }),
    key: 'categories',
  },
  { what: 'env null', file: 'env-null.oxlint.config.mjs', text: moduleExportingByDefaultText({ env: null }), key: 'env' },
  { what: 'extends null', file: 'extends-null.oxlint.config.mjs', text: moduleExportingByDefaultText({ extends: null }), key: 'extends' },
  {
    what: 'options null in an object it extends',
    file: 'extending-options-null.oxlint.config.mjs',
    text: moduleExportingByDefaultText({ extends: [{ options: null }] }),
    key: 'options',
    at: 'extends[0].',
  },
  {
    what: 'rules null in an object extended by an object it extends',
    file: 'extending-rules-null-deeper.oxlint.config.mjs',
    text: moduleExportingByDefaultText({ extends: [{ extends: [{ rules: null }] }] }),
    key: 'rules',
    at: 'extends[0].extends[0].',
  },
]

export const MODULES_READ: readonly FileRead[] = [
  { what: 'options and categories as empty objects', file: 'empty-objects.oxlint.config.mjs', text: moduleExportingByDefaultText({ options: {}, categories: {} }) },
  { what: 'options and categories left out', file: 'keys-left-out.oxlint.config.mjs', text: moduleExportingByDefaultText(buildTeamOxlintConfig()) },
  {
    what: 'jsPlugins null, and in an object it extends',
    file: 'js-plugins-null.oxlint.config.mjs',
    text: moduleExportingByDefaultText({ jsPlugins: null, extends: [{ jsPlugins: null }] }),
  },
  {
    what: 'null at each option and at settings oxlint takes it at, and in an object it extends',
    file: 'nulls-taken-below-a-key.oxlint.config.mjs',
    text: moduleExportingByDefaultText({ ...NULLS_OXLINT_TAKES_BELOW_A_KEY, extends: [NULLS_OXLINT_TAKES_BELOW_A_KEY] }),
  },
]

export const THEIRS_OPTIONS_NULL: TheirsHoldingANullKey = { what: 'options null', theirs: { options: null }, key: 'options' }

export const THEIRS_RULES_NULL = theirsHoldingNullAt('rules')

export const THEIRS_EXTENDING_CATEGORIES_NULL: TheirsHoldingANullKey = {
  what: 'categories null in an object it extends',
  theirs: { extends: [{ categories: null }] },
  key: 'categories',
  at: 'extends[0].',
}

export const THEIRS_HOLDING_A_NULL_KEY: readonly TheirsHoldingANullKey[] = [
  THEIRS_OPTIONS_NULL,
  { what: 'options null, extending an object', theirs: { extends: [CORRECTNESS_ON], options: null }, key: 'options' },
  { what: 'categories null, extends left out', theirs: { categories: null }, key: 'categories' },
  { what: 'categories null beside an empty extends', theirs: { extends: [], categories: null }, key: 'categories' },
  { what: 'categories null, extending an object', theirs: { extends: [CORRECTNESS_ON], categories: null }, key: 'categories' },
  { what: 'options and categories both null', theirs: { options: null, categories: null }, key: 'options' },
  THEIRS_RULES_NULL,
  ...(['env', 'extends', 'globals', 'ignorePatterns', 'overrides', 'settings'] as const).map(theirsHoldingNullAt),
  { what: 'options null in an object it extends', theirs: { extends: [{ options: null }] }, key: 'options', at: 'extends[0].' },
  THEIRS_EXTENDING_CATEGORIES_NULL,
  { what: 'settings null in an object it extends', theirs: { extends: [{ settings: null }] }, key: 'settings', at: 'extends[0].' },
  { what: 'extends null in an object it extends', theirs: { extends: [{ extends: null }] }, key: 'extends', at: 'extends[0].' },
  { what: 'rules null in the second object it extends', theirs: { extends: [buildTeamOxlintConfig(), { rules: null }] }, key: 'rules', at: 'extends[1].' },
  {
    what: 'overrides null in an object extended by an object it extends',
    theirs: { extends: [{ extends: [{ overrides: null }] }] },
    key: 'overrides',
    at: 'extends[0].extends[0].',
  },
]

/** As OXLINTRCS_READ. */
export const THEIRS_MERGED: readonly TheirsGiven[] = [
  { what: 'options and categories as empty objects', theirs: { options: {}, categories: {} } },
  { what: 'options and categories left out', theirs: buildTeamOxlintConfig() },
  { what: '$schema and jsPlugins null', theirs: { $schema: null, jsPlugins: null } },
  { what: 'jsPlugins null in an object it extends', theirs: { extends: [{ jsPlugins: null }] } },
  { what: 'an override holding env, globals, plugins and jsPlugins null', theirs: { overrides: [OVERRIDE_HOLDING_NULLS_OXLINT_TAKES] } },
  THEIRS_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY,
]

/** As OXLINTRCS_LEFT_TO_OXLINT. */
export const THEIRS_LEFT_TO_OXLINT: readonly TheirsGiven[] = NULLS_OXLINT_REFUSES_FOR_SOME_RULES_OR_SETTINGS.map(({ what, config }) => ({ what, theirs: config }))

/** Refused for the path: a path in extends keeps its own refusal, which comes first. */
export const THEIRS_HOLDING_A_PATH_BESIDE_OPTIONS_NULL: TheirsGiven = {
  what: 'a path in extends beside options null',
  theirs: { extends: [`./${EXTENDED_WRITING_CORRECTNESS.file}`], options: null },
}

/** What each refusal says after the file it names: `at`, the path to the object extended holding the null, where it is one. */
export function nullKeyProblem(key: NullKey, at = ''): string {
  return `${at}${key} is null, which oxlint refuses: leave it out or give it ${WHAT_OXLINT_TAKES_AT[key]}`
}

/** What the ESLint merge's refusal says after the team's file it names: first the file extended by path holding the null, where that is another. */
export function readRefusalProblem({ key, heldIn, at }: Pick<FileHoldingANullKey, 'key' | 'heldIn' | 'at'>, projectDir: string): string {
  const problem = nullKeyProblem(key, at)
  return heldIn === undefined ? problem : `${join(projectDir, heldIn)}: ${problem}`
}

/** How each refusal of a null below a key starts after the file it names, `at` leading to the object extended that holds it; what to do instead follows. */
export function nullBelowAKeyRefusalStart(location: string, at = ''): string {
  return `${at}${location} is null, which oxlint refuses: `
}

/** As readRefusalProblem, for a null below a key. */
export function readRefusalOfANullBelowAKeyStart({ location, heldIn, at }: PathToTheNull & HeldBelowTheRoot, projectDir: string): string {
  const start = nullBelowAKeyRefusalStart(location, at)
  return heldIn === undefined ? start : `${join(projectDir, heldIn)}: ${start}`
}

/** The JSON config the end-to-end projects' eslint.config.mjs names, in place of the fixture's oxlint.config.mts. */
export const TEAM_OXLINTRC = '.oxlintrc.json'

/** An eslint.config.mjs naming TEAM_OXLINTRC, beside the empty team module it imports. */
export const ESLINT_CONFIG_NAMING_THE_TEAMS_OXLINTRC: ProjectFiles = {
  [CONSUMER_CONFIG_FILES.eslint]: mergedEslintConfigText(CONSUMER_CONFIG_FILES.lintRules, EMPTY_TEAM_ESLINT_MODULE_FILE.file, { oxlintConfig: TEAM_OXLINTRC }),
  [EMPTY_TEAM_ESLINT_MODULE_FILE.file]: EMPTY_TEAM_ESLINT_MODULE_FILE.text,
}

/** As THEIRS_OPTIONS_NULL's allowed twin, for an oxlint.config.mts both engines load. */
export const THEIRS_OPTIONS_EMPTY: TheirsGiven = { what: 'options as an empty object', theirs: { options: {} } }

export const OXLINTRC_PLUGINS_NULL: FileRead = { what: 'plugins null', file: 'plugins-null.oxlintrc.json', text: jsonFileText({ ...CORRECTNESS_ON, plugins: null }) }

export const OXLINTRC_LISTING_NO_PLUGIN: FileRead = { what: 'plugins []', file: 'no-plugin.oxlintrc.json', text: jsonFileText(CORRECTNESS_ON_LISTING_NO_PLUGIN) }

/** JSON, read by mergeEslintConfig: oxlint runs its no-this-alias under each. */
export const OXLINTRCS_RUNNING_NO_THIS_ALIAS: readonly FileRead[] = [
  OXLINTRC_PLUGINS_NULL,
  { what: 'plugins left out', file: 'plugins-left-out.oxlintrc.json', text: jsonFileText(CORRECTNESS_ON) },
  {
    what: 'plugins import, extending a file holding plugins null',
    file: 'extending-plugins-null.oxlintrc.json',
    text: jsonFileText({ ...CORRECTNESS_ON_LISTING_IMPORT, extends: [`./${EXTENDED_HOLDING_PLUGINS_NULL.file}`] }),
  },
  {
    what: 'plugins import, extending a file leaving plugins out',
    file: 'extending-plugins-left-out.oxlintrc.json',
    text: jsonFileText({ ...CORRECTNESS_ON_LISTING_IMPORT, extends: [`./${EXTENDED_LEAVING_PLUGINS_OUT.file}`] }),
  },
  {
    what: 'plugins import and an override listing typescript',
    file: 'override-listing-typescript.oxlintrc.json',
    text: jsonFileText({ ...CORRECTNESS_ON_LISTING_IMPORT, overrides: [{ files: [SOURCES], plugins: ['typescript'] }] }),
  },
]

/** As OXLINTRCS_RUNNING_NO_THIS_ALIAS: oxlint runs its no-this-alias under none. */
export const OXLINTRCS_LEAVING_NO_THIS_ALIAS_OUT: readonly FileRead[] = [
  OXLINTRC_LISTING_NO_PLUGIN,
  {
    what: 'plugins import, extending a file holding plugins []',
    file: 'extending-no-plugin.oxlintrc.json',
    text: jsonFileText({ ...CORRECTNESS_ON_LISTING_IMPORT, extends: [`./${EXTENDED_LISTING_NO_PLUGIN.file}`] }),
  },
  {
    what: 'plugins import and an override holding plugins null',
    file: 'override-plugins-null.oxlintrc.json',
    text: jsonFileText({ ...CORRECTNESS_ON_LISTING_IMPORT, overrides: [{ files: [SOURCES], plugins: null }] }),
  },
  {
    what: 'plugins import and an override leaving plugins out',
    file: 'override-plugins-left-out.oxlintrc.json',
    text: jsonFileText({ ...CORRECTNESS_ON_LISTING_IMPORT, overrides: [{ files: [SOURCES] }] }),
  },
]

/** As OXLINTRCS_RUNNING_NO_THIS_ALIAS, for a module exporting a plain object by default. */
export const MODULES_RUNNING_NO_THIS_ALIAS: readonly FileRead[] = [
  { what: 'plugins null', file: 'plugins-null.oxlint.config.mjs', text: moduleExportingByDefaultText({ ...CORRECTNESS_ON, plugins: null }) },
  { what: 'plugins left out', file: 'plugins-left-out.oxlint.config.mjs', text: moduleExportingByDefaultText(CORRECTNESS_ON) },
  {
    what: 'plugins import, extending an object holding plugins null',
    file: 'extending-plugins-null.oxlint.config.mjs',
    text: moduleExportingByDefaultText({ ...CORRECTNESS_ON_LISTING_IMPORT, extends: [{ plugins: null }] }),
  },
]

/** As OXLINTRCS_LEAVING_NO_THIS_ALIAS_OUT, for a module exporting a plain object by default. */
export const MODULES_LEAVING_NO_THIS_ALIAS_OUT: readonly FileRead[] = [
  { what: 'plugins []', file: 'no-plugin.oxlint.config.mjs', text: moduleExportingByDefaultText(CORRECTNESS_ON_LISTING_NO_PLUGIN) },
  {
    what: 'plugins import and an override holding plugins null',
    file: 'override-plugins-null.oxlint.config.mjs',
    text: moduleExportingByDefaultText({ ...CORRECTNESS_ON_LISTING_IMPORT, overrides: [{ files: [SOURCES], plugins: null }] }),
  },
]

export const THEIRS_PLUGINS_NULL: TheirsGiven = { what: 'plugins null', theirs: { ...CORRECTNESS_ON, plugins: null } }

export const THEIRS_LISTING_NO_PLUGIN: TheirsGiven = { what: 'plugins []', theirs: CORRECTNESS_ON_LISTING_NO_PLUGIN }

/** Handed to mergeOxlintConfig: the team's config alone runs no-this-alias under each. */
export const THEIRS_RUNNING_NO_THIS_ALIAS: readonly TheirsGiven[] = [
  THEIRS_PLUGINS_NULL,
  { what: 'plugins left out', theirs: CORRECTNESS_ON },
  { what: 'plugins import, extending an object holding plugins null', theirs: { ...CORRECTNESS_ON_LISTING_IMPORT, extends: [{ plugins: null }] } },
  { what: 'plugins import, extending an object leaving plugins out', theirs: { ...CORRECTNESS_ON_LISTING_IMPORT, extends: [buildTeamOxlintConfig()] } },
]

/** As THEIRS_RUNNING_NO_THIS_ALIAS: the team's config alone runs it under none. */
export const THEIRS_LEAVING_NO_THIS_ALIAS_OUT: readonly TheirsGiven[] = [
  THEIRS_LISTING_NO_PLUGIN,
  { what: 'plugins import, extending an object holding plugins []', theirs: { ...CORRECTNESS_ON_LISTING_IMPORT, extends: [buildTeamOxlintConfig({ plugins: [] })] } },
  { what: 'plugins import and an override holding plugins null', theirs: { ...CORRECTNESS_ON_LISTING_IMPORT, overrides: [{ files: [SOURCES], plugins: null }] } },
  { what: 'plugins import and an override leaving plugins out', theirs: { ...CORRECTNESS_ON_LISTING_IMPORT, overrides: [{ files: [SOURCES] }] } },
]
