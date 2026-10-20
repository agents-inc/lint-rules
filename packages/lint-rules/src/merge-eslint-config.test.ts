import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { catalog } from '@workspace/rule-data'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { pluginPrefixOf } from '@workspace/rule-data/rule-id-parts'
import type { ESLint, Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import { beforeAll, describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { severityOfCalculatedEntry } from './__tests__/calculated-rule-severity.ts'
import {
  buttonWithoutAType,
  cleanModule,
  commentAsJsxText,
  genericArrayOfASimpleType,
  innerHtmlSetDangerously,
  looseNullCheck,
  looseNumberCheck,
  propertyReadIntoAVariable,
  simpleTypeArrayInBrackets,
  stringLiteralInBracesAsAProp,
  suppressionOfAnOxcRule,
  thrownStringLiteral,
} from './__tests__/cases/editor-merge-sources.ts'
import { listItemWithoutAKey } from './__tests__/cases/eslint-merge-sources.ts'
import { suppressionOfARuleNobodyDefines } from './__tests__/cases/suppression-comments.ts'
import { SVELTE_RUNES_ESLINT_BLOCK_NAME, TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME } from './__tests__/cases/svelte-components.ts'
import { TEAM_CONFIG_MODULE, teamBlockWithFunctionFiles, teamBlockWithFunctionIgnores, unusedVariable } from './__tests__/cases/team-eslint-projects.ts'
import { NOT_LINTED, type RuleIdsReportedByFile, setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { blockNamed } from './__tests__/eslint-config-reads.ts'
import { ABSENT, type CalculatedEntry, calculatedEntryOf, entriesOfEachFileIn } from './__tests__/eslint-entries-owed.ts'
import { buildCatalog, buildEslintRoute, buildFakePlugin, buildPluginRegistry, buildReportingPlugin } from './__tests__/factories/catalog-factories.ts'
import {
  buildPluginNamedAtTopLevel,
  buildTeamConfigAloneLintingEveryJsAndTsFile,
  buildTeamEslintBlockTurningOnWithin,
  installedEslintPlugin,
  type TeamBlockScope,
} from './__tests__/factories/eslint-merge-factories.ts'
import { buildConsumerLintRules, buildEveryRulesetLintRules, buildTwoSetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import {
  buildPackageJsonListingOthers,
  buildPackageJsonListingOxlint,
  lintRulesPackageVersion,
  packageJsonText,
} from './__tests__/factories/package-json-factories.ts'
import {
  buildTeamBlockSwitchingTypesOffAsDisableTypeCheckedDoes,
  buildTeamDisableTypeCheckedBlock,
  buildTeamEslintBlock,
  buildTeamEslintBlockSetting,
  buildTeamEslintBlockSettingParserOptions,
  buildTeamEslintBlockTurningOn,
  buildTeamEslintConfigExtending,
  buildTeamParser,
  buildTeamTypedEslintBlock,
  type TeamTypeInformation,
} from './__tests__/factories/team-config-factories.ts'
import { pathsOfFunctionsIn } from './__tests__/functions-in.ts'
import { resolversImportXReads } from './__tests__/import-x-settings.ts'
import { sameModuleNamesOfEach, sameRuleNamesOfEach, type TwinPair, twinPairsOf } from './__tests__/other-eslint-names.ts'
import { changesSince, snapshotOf } from './__tests__/plugin-snapshots.ts'
import { rulesNotFoundAmong } from './__tests__/rules-not-found.ts'
import { rulesOnInEslint } from './__tests__/rules-on-engines.ts'
import { importedTeamConfig } from './__tests__/team-config-modules.ts'
import { NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG, writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { editorPartsOf } from './core/editor-parts.ts'
import { isRecord } from './core/is-record.ts'
import { mergeEslintPart } from './core/merge-eslint-config.ts'
import { ruleIdsStatedIn } from './core/resolve-rule-layers.ts'
import { mergeEslintConfig } from './eslint.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'
import { defineLintRules, type LintRules } from './index.ts'

// One plugin object per prefix both configs register, built from the team's with our rule modules;
// ours first, then the team's blocks, whose setting of a rule anywhere, under any name or a twin's,
// makes it the team's in every file. The team's plugins are fakes, so a spec sees whose rule module
// ran. Each config turns on exactly the rules its spec reads, so no typed rule asks for a project service.

type TeamEslintConfig = Parameters<typeof mergeEslintConfig>[0]
type SharedFields = Partial<Omit<LintRules, 'tsconfigRootDir' | 'agentRulesets' | 'editorRulesets'>>
type EditorParts = ReturnType<typeof defineLintRules>['editorRulesets']

/** A later team block that switches type information off again, and how the team gave it. */
type SwitchingTypesOff = { readonly how: string; readonly typedThrough: TeamTypeInformation; readonly switchingOff: Linter.Config }

/**
 * typescript-eslint's extension of a core rule, and what becomes of the core rule without oxlint: ESLint
 * runs it, or, where oxlint would run it and the extension is current, ESLint runs the extension on
 * TS files and the core rule on JS files.
 */
type TwinOfACoreRule = {
  readonly twin: string
  readonly coreRule: string
  readonly withoutOxlint: 'run by ESLint' | 'run by ESLint, as the extension on TS files'
}

/**
 * A rule of ours and typescript-eslint's twin of it, which the team runs, with options of the
 * twin's own: our core rule beside the team's typescript-eslint rule, or the other way round.
 */
type TwinBesideOurs = TwinPair & { readonly direction: string; readonly teamOptions: Readonly<Record<string, unknown>> }

/** Our settings and a team config, and the blocks of ours owed before the team's, by name and the rules of ours each states, beside oxlint and without it. */
type BlockNamesShape = {
  readonly how: string
  readonly fields: SharedFields
  readonly teamConfig: TeamEslintConfig
  readonly owedBesideOxlint: readonly OurBlockStating[]
  readonly owedWithoutOxlint: readonly OurBlockStating[]
}

/** A block of ours, by its name, and the rules of ours it states, sorted. */
type OurBlockStating = { readonly name: string; readonly states: readonly string[] }

/** A severity by rule ID, by file. */
type SeveritiesByFile = Record<string, Record<string, string>>

/** A rule's calculated entry by file: ABSENT where no block sets it, NOT_LINTED where ESLint lints no such file. */
type EntriesByFile = Record<string, CalculatedEntry | typeof NOT_LINTED>

/**
 * A name a team's block states one of our rules by, the plugins it registers to do so, its entry,
 * and the projects whose merge decides that name by the team's setting.
 */
type NameKind = {
  readonly kind: string
  readonly ours: string
  readonly teams: string
  readonly plugins: () => Readonly<Record<string, ESLint.Plugin>>
  readonly entry: Linter.RuleEntry
  readonly projects: readonly { readonly project: string; readonly projectDir: string }[]
}

/** A team registration under one of our prefixes, and the rule of ours its source draws. */
type Registration = {
  readonly registers: string
  readonly teamConfig: Linter.Config[]
  readonly fields: SharedFields
  readonly ourRule: string
  readonly source: string
  readonly file: string
}

const ARRAY_TYPE = '@typescript-eslint/array-type'
const FLOATING_PROMISES = '@typescript-eslint/no-floating-promises'
const TYPED_RULE_ON = { rules: { [FLOATING_PROMISES]: 'error' } } satisfies SharedFields
// Files a team lints without type information, as a scripts folder outside its tsconfig.
const SCRIPT_FILES = ['scripts/**']
// typescript-eslint's extensions of core rules, which oxlint does not spell under its typescript
// scope. The first two core rules are routed to ESLint; without oxlint, ESLint runs each other one's
// current extension on TS files in its place. No ruleset ships require-await, but `rules` can.
const TWINS_OXLINT_DOES_NOT_SPELL: readonly TwinOfACoreRule[] = [
  { twin: '@typescript-eslint/only-throw-error', coreRule: 'no-throw-literal', withoutOxlint: 'run by ESLint' },
  { twin: '@typescript-eslint/prefer-promise-reject-errors', coreRule: 'prefer-promise-reject-errors', withoutOxlint: 'run by ESLint' },
  { twin: '@typescript-eslint/prefer-destructuring', coreRule: 'prefer-destructuring', withoutOxlint: 'run by ESLint, as the extension on TS files' },
  {
    twin: '@typescript-eslint/no-unused-private-class-members',
    coreRule: 'no-unused-private-class-members',
    withoutOxlint: 'run by ESLint, as the extension on TS files',
  },
  { twin: '@typescript-eslint/require-await', coreRule: 'require-await', withoutOxlint: 'run by ESLint, as the extension on TS files' },
]
// A rule of the team's own under typescript-eslint's prefix, which must keep firing beside a twin turned off.
const TEAM_RULE_OF_TYPESCRIPT_ESLINT = '@typescript-eslint/team-rule'
// One rule of ours that ESLint runs, and typescript-eslint's twin of it, which the team runs.
const OUR_CORE_RULE_WITH_A_TWIN = 'prefer-promise-reject-errors'
const TEAMS_TWIN_OF_OUR_CORE_RULE = '@typescript-eslint/prefer-promise-reject-errors'
// A core rule our oxlint part runs in every file, no ruleset shipping it with files of its own, and its twin.
const CORE_RULE_OXLINT_RUNS_EVERYWHERE = 'require-await'
const TWIN_OF_THE_CORE_RULE_OXLINT_RUNS_EVERYWHERE = '@typescript-eslint/require-await'
const OFF = 0
const WARN = 1
const ERROR = 2
const TYPESCRIPT_ESLINT_PARSER_NAME = 'typescript-eslint/parser'
// Three same-rule names the catalog walk must reach in either project: typescript-eslint's
// deprecated no-loop-func, which points back to the core rule, import-x/first's alias, and
// unicorn's old name of no-for-each.
const SAME_RULE_NAMES_THE_WALK_REACHES = ['@typescript-eslint/no-loop-func', 'import/first', 'unicorn/no-array-for-each']
// Files the twin walk reads: TS, JS, a folder and a story no-unused-vars ships ignoring, and a file
// our typed blocks leave out, a consumer config file.
const TWIN_WALK_FILES = ['src/a.ts', 'src/a.js', 'scripts/a.ts', 'src/a.stories.tsx', 'agents-inc.lint.mts']
// Our typed typescript-eslint rule, whose core twin the team runs.
const TYPED_EXTENSION = '@typescript-eslint/consistent-return'
const CORE_TWIN_OF_THE_TYPED_EXTENSION = 'consistent-return'
const NO_UNUSED_VARS = 'no-unused-vars'
const TWIN_OF_NO_UNUSED_VARS = '@typescript-eslint/no-unused-vars'
// Core rules oxlint runs for us, which ESLint takes over without oxlint, and typescript-eslint's
// extensions of them: max-params's untyped, prefer-destructuring's typed.
const MAX_PARAMS = 'max-params'
const TWIN_OF_MAX_PARAMS = '@typescript-eslint/max-params'
const PREFER_DESTRUCTURING = 'prefer-destructuring'
const TWIN_OF_PREFER_DESTRUCTURING = '@typescript-eslint/prefer-destructuring'
// A core rule oxlint runs for us, shipped with no files or ignores of its own.
const NO_DEBUGGER = 'no-debugger'
// A core rule oxlint runs for us, which a team sets with terms of its own.
const NO_WARNING_COMMENTS = 'no-warning-comments'
// A core rule ESLint runs for us in either project.
const NO_THROW_LITERAL = 'no-throw-literal'
// One rule of ours that ESLint runs in either project, beside its twin the team runs, each way.
const TWINS_BOTH_WAYS: readonly TwinBesideOurs[] = [
  {
    direction: "our core rule, the team's typescript-eslint rule",
    ours: 'prefer-promise-reject-errors',
    theirs: '@typescript-eslint/prefer-promise-reject-errors',
    teamOptions: { allowEmptyReject: true },
  },
  {
    direction: "our typescript-eslint rule, the team's core rule",
    ours: '@typescript-eslint/no-invalid-this',
    theirs: 'no-invalid-this',
    teamOptions: { capIsConstructor: false },
  },
]
const LEGACY_FILES: [string, ...string[]] = ['legacy/**']
// A file a team block naming LEGACY_FILES applies to, and one it does not: TSX, where max-lines ships.
const A1_FILES = ['legacy/a.tsx', 'src/a.tsx']
const LEGACY_OLD_FILES: [string, ...string[]] = ['legacy/old/**']
// ~3.4 s alone and ~5.3 s in the full suite (measured), past vitest's 5 s default.
const TWIN_WALK_TIMEOUT_MS = 20_000
// A TS file a tsconfig including src takes in, and one no tsconfig does, both on disk.
const TS_FILE_A_TSCONFIG_INCLUDES = 'src/a.ts'
const TS_FILE_OUTSIDE_EVERY_TSCONFIG = 'scripts/stray.ts'
// ESLint registers its own core rules under this namespace in every calculated config.
const ESLINT_CORE_NAMESPACE = '@'
const OUR_VERSION = '1.0.0'
const OUR_NEXT_VERSION = '1.0.1'
const TEAM_PLUGIN_VERSION = '1.0.0'
const TEAM_NEXT_PLUGIN_VERSION = '2.0.0'
const TYPESCRIPT_ESLINT_PREFIX = '@typescript-eslint'
const TYPESCRIPT_ESLINT_PLUGIN_NAME = '@typescript-eslint/eslint-plugin'
// The prefix antfu's eslint-config registers typescript-eslint under, and two rules under it: our
// array-type under another name, and typescript-eslint's twin of the core prefer-promise-reject-errors.
const TEAM_TS_PREFIX = 'ts'
const TEAM_TS_RULE_NAMES = ['array-type', 'prefer-promise-reject-errors']
const TEAM_TS_ARRAY_TYPE = 'ts/array-type'
const TEAM_TS_TWIN = 'ts/prefer-promise-reject-errors'
const TEAM_OWN_PLUGIN_NAME = 'eslint-plugin-team-ts'
// Rules only our off-switch states, under the team's `ts`: typescript-eslint's no-explicit-any, which
// oxlint runs for us where the project lists it, and its deprecated no-loop-func, another name of the
// core rule, which either engine runs for us.
const TEAM_TS_RULES_ONLY_OUR_OFF_SWITCH_STATES = ['ts/no-explicit-any', 'ts/no-loop-func']
// eslint-plugin-promise carries no name, so only the very object is recognised as ours.
const PROMISE_PREFIX = 'promise'
const OUR_PROMISE_RULE = 'promise/param-names'
const TEAM_PROMISE_PREFIX = 'promise-x'
const TEAM_PROMISE_RULE = 'promise-x/param-names'
const TEAM_LOCAL_PREFIX = 'local'
const TEAM_LOCAL_PROMISE_NAMED_RULE = 'local/param-names'
// regexp's prefer-regexp-exec, and typescript-eslint's rule of that name under the team's `ts`: another rule.
const OUR_REGEXP_RULE = 'regexp/prefer-regexp-exec'
const TEAM_TS_RULE_NAMED_AS_OUR_REGEXP_RULE = 'ts/prefer-regexp-exec'
// A prefix oxlint reads typescript-eslint's rules under, which no ESLint plugin of ours is registered
// under, and a team plugin of its own registered there.
const TEAM_TYPESCRIPT_PREFIX = 'typescript'
const TEAM_TYPESCRIPT_RULE = 'typescript/no-explicit-any'
const TEAM_TYPESCRIPT_PLUGIN_NAME = 'eslint-plugin-team-typescript'
// typescript-eslint's no-loop-func extends the core rule and is deprecated in its favour: the catalog
// records it as an alias of the core rule, not a twin.
const CORE_RULE_WITH_A_DEPRECATED_EXTENSION = 'no-loop-func'
const DEPRECATED_EXTENSION = '@typescript-eslint/no-loop-func'
// antfu's eslint-config registers @eslint-react under `react`, the prefix our eslint-plugin-react
// rules take, and names @eslint-react's rules under it: `react/x` for our `@eslint-react/x`.
const ESLINT_REACT_PREFIX = '@eslint-react'
const ESLINT_REACT_PLUGIN_NAME = '@eslint-react/eslint-plugin'
const REACT_PREFIX = 'react'
const OUR_INNER_HTML = '@eslint-react/dom-no-dangerously-set-innerhtml'
const TEAM_INNER_HTML = 'react/dom-no-dangerously-set-innerhtml'
const TEAM_BUTTON_TYPE = 'react/dom-no-missing-button-type'
const ESLINT_REACT_RULE_NAMES = ['dom-no-dangerously-set-innerhtml', 'dom-no-missing-button-type', 'jsx-no-comment-textnodes']
// A rule name eslint-plugin-react and @eslint-react both have: under `react` it is either plugin's,
// as the team registers one or the other there.
const OUR_COMMENT_TEXTNODES = '@eslint-react/jsx-no-comment-textnodes'
const COMMENT_TEXTNODES_UNDER_REACT = 'react/jsx-no-comment-textnodes'
const CURLY_BRACE_PRESENCE = 'react/jsx-curly-brace-presence'
// @eslint-react binds one rule module to both of these names, so they are one rule: the second is
// ours under another name, and the third that one under the prefix antfu's config registers it under.
const OUR_MISSING_KEY = '@eslint-react/x-no-missing-key'
const MISSING_KEY_UNDER_ITS_OTHER_NAME = '@eslint-react/no-missing-key'
const MISSING_KEY_UNDER_REACT = 'react/no-missing-key'
const MISSING_KEY_RULE_NAMES = ['no-missing-key', 'x-no-missing-key']
// A rule @eslint-react binds to a module of its own, named like no-missing-key.
const DUPLICATE_KEY = '@eslint-react/no-duplicate-key'
// The other name of an @eslint-react rule our part does not state: x-no-unused-state.
const UNUSED_STATE_UNDER_ITS_OTHER_NAME = '@eslint-react/no-unused-state'
// A same-module name the walk from the installed plugins must reach in either project.
const SAME_MODULE_NAMES_THE_WALK_REACHES = [MISSING_KEY_UNDER_ITS_OTHER_NAME]

const tempProjects = setUpTempProjects()
// The oxlint it installs lets the twin walk merge our oxlint part too: only one whose schema holds
// every name the merge writes merges.
const PROJECT_WITH_OXLINT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) },
  linkedPackages: [INSTALLED_OXLINT],
})
const PROJECT_WITHOUT_OXLINT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) },
})
const PROJECTS = [
  { project: 'whose package.json lists oxlint', projectDir: PROJECT_WITH_OXLINT },
  { project: 'whose package.json lists no oxlint', projectDir: PROJECT_WITHOUT_OXLINT },
]
/** A project listing no oxlint whose tsconfig includes its one TS file, on disk, so a typed rule can lint it. */
function typedProjectWithoutOxlint(source: string): string {
  return tempProjects.create({
    files: {
      'package.json': packageJsonText(buildPackageJsonListingOthers()),
      'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
      [TS_FILE_A_TSCONFIG_INCLUDES]: source,
    },
  })
}
// Twins the walk must reach: each the twin of a rule we state, and not stated by us. Not
// consistent-return or no-implied-eval, shipped beside their typed twins, nor no-invalid-this, whose
// twin functional/no-this-expressions covers.
const PROJECTS_THE_TWIN_WALK_READS = [
  {
    project: 'whose package.json lists oxlint',
    projectDir: PROJECT_WITH_OXLINT,
    reaches: [TWIN_OF_NO_UNUSED_VARS, '@typescript-eslint/prefer-promise-reject-errors'],
  },
  {
    project: 'whose package.json lists no oxlint',
    projectDir: PROJECT_WITHOUT_OXLINT,
    reaches: ['@typescript-eslint/prefer-promise-reject-errors'],
  },
]

const {
  calculatedConfigFor,
  calculatedConfigInProjectFor,
  calculatedRulesOfEach,
  globalsFor,
  linterOptionsFor,
  lintedConfigFor,
  messagesReportedOn,
  parserOptionsFor,
  ruleEntryFor,
  ruleIdsReportedInProjectByFile,
  ruleIdsReportedOn,
  ruleSeverityFor,
  ruleSeverityInProjectFor,
  serializedPluginsFor,
} = setUpEslintConfigOracle()

/** Our editor ESLint part for a config listing no ruleset, with these shared settings, merged into the team's config, the team's oxlint config setting no rule. */
function mergedEditorEslintConfig(projectDir: string, fields: SharedFields, teamConfig: TeamEslintConfig): Linter.Config[] {
  const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {}, fields)).editorRulesets
  return mergedBesideATeamOxlintConfigSettingNoRule(teamConfig, eslint)
}

/** The ESLint part merged into the team's config, beside a team oxlint config setting no rule where the project lists oxlint. */
function mergedBesideATeamOxlintConfigSettingNoRule(teamConfig: TeamEslintConfig, eslint: EditorParts['eslint']): Linter.Config[] {
  return mergeEslintConfig(teamConfig, eslint, writeTeamOxlintConfigSettingNoRule(eslint))
}

/** A rule no block sets does not run, which is what off means. */
async function severitiesOf(config: Linter.Config[], ruleId: string, files: readonly string[]): Promise<Record<string, string>> {
  const severities = await Promise.all(
    files.map(async (file): Promise<[string, string]> => [file, (await ruleSeverityFor(config, file, ruleId)) ?? 'off']),
  )
  return Object.fromEntries(severities)
}

/** The rule IDs given that ESLint runs in the file, at any severity but off. */
async function ruleIdsOnIn(config: Linter.Config[], file: string, ruleIds: readonly string[]): Promise<string[]> {
  const calculated = await calculatedConfigFor(config, file)
  if (calculated?.rules === undefined) throw new Error(`ESLint calculated no rules for ${file}`)
  const { rules } = calculated
  return ruleIds.filter((id) => {
    const severity = severityOfCalculatedEntry(rules[id])
    return severity !== undefined && severity !== 'off'
  })
}

/** Every rule ID either editor part states, to any severity. */
function ruleIdsStatedByEitherPart({ eslint, oxlint }: EditorParts): string[] {
  return [...ruleIdsStatedIn(eslint.layers), ...(oxlint === undefined ? [] : ruleIdsStatedIn(oxlint.layers))]
}

/** Every rule given, by file: its severity there, off where no block sets it. */
async function severitiesOfEach(config: Linter.Config[], ruleIds: readonly string[], files: readonly string[]): Promise<SeveritiesByFile> {
  const byFile = await Promise.all(
    files.map(async (file): Promise<[string, Record<string, string>]> => [file, await severitiesIn(config, ruleIds, file)]),
  )
  return Object.fromEntries(byFile)
}

async function severitiesIn(config: Linter.Config[], ruleIds: readonly string[], file: string): Promise<Record<string, string>> {
  const severities = await Promise.all(
    ruleIds.map(async (ruleId): Promise<[string, string]> => [ruleId, (await ruleSeverityFor(config, file, ruleId)) ?? 'off']),
  )
  return Object.fromEntries(severities)
}

/** The rule's full calculated entry in each file, options filled in as ESLint fills them. */
async function entriesOf(config: Linter.Config[], ruleId: string, files: readonly string[]): Promise<EntriesByFile> {
  const rulesByFile = await calculatedRulesOfEach(config, files)
  return Object.fromEntries(
    files.map((file): [string, CalculatedEntry | typeof NOT_LINTED] => {
      const rules = rulesByFile[file]
      if (rules === undefined) throw new Error(`ESLint calculated nothing for ${file}`)
      return [file, rules === NOT_LINTED ? NOT_LINTED : calculatedEntryOf(rules, ruleId)]
    }),
  )
}

/** Each file's calculated entry of each rule given, by rule ID. */
async function entriesByFileOf(
  config: Linter.Config[],
  ruleIds: readonly string[],
  files: readonly string[],
): Promise<Record<string, Record<string, CalculatedEntry> | typeof NOT_LINTED>> {
  return entriesOfEachFileIn(await calculatedRulesOfEach(config, files), ruleIds, files)
}

/** The rule's entries as the team's config alone gives them, linting every JS and TS file, as merged beside our base block it does. */
async function teamAloneEntriesOf(teamConfig: TeamEslintConfig, ruleId: string, files: readonly string[]): Promise<EntriesByFile> {
  return entriesOf(buildTeamConfigAloneLintingEveryJsAndTsFile(teamConfig), ruleId, files)
}

/**
 * The entry ESLint calculates for the rule given the entry alone, in a TS file, a plugin rule's
 * plugin registered as installed: it fills in the default options a rule declares.
 */
async function entryEslintCalculatesFor(ruleId: string, entry: Linter.RuleEntry): Promise<unknown> {
  const prefix = pluginPrefixOf(ruleId)
  const plugins = prefix === null ? {} : { plugins: { [prefix]: installedEslintPlugin(prefix) } }
  return ruleEntryFor([{ files: ['**/*.ts'], ...plugins, rules: { [ruleId]: entry } }], 'src/a.ts', ruleId)
}

/** The files, sorted, on which ESLint reports the rule. */
function filesReporting(byFile: RuleIdsReportedByFile, ruleId: string): string[] {
  return Object.entries(byFile)
    .filter(([, ruleIds]) => ruleIds.includes(ruleId))
    .map(([file]) => file)
    .toSorted()
}

function entryIn(entries: EntriesByFile, file: string): CalculatedEntry | typeof NOT_LINTED {
  const entry = entries[file]
  if (entry === undefined) throw new Error(`no entry was read in ${file}`)
  return entry
}

/** The very plugin object our base block registers under the prefix: eslint-plugin-react carries no name to know it by. */
function ourRegisteredPlugin(prefix: string): ESLint.Plugin {
  const plugin = eslintPluginRegistry[prefix]
  if (plugin === undefined) throw new Error(`we register no plugin under ${prefix}`)
  return plugin
}

/** The block with each plugin object read as the prefix it is registered under, so blocks compare by everything else. */
function withPluginPrefixesOnly({ plugins, ...block }: Linter.Config): Record<string, unknown> {
  return plugins === undefined ? block : { ...block, plugins: Object.keys(plugins).toSorted() }
}

/** Whether a team block's plugin under a prefix is the very object our base block registers there, or the team's own. */
function whosePlugin(plugin: ESLint.Plugin, prefix: string, { plugins = {} }: Linter.Config): string {
  return plugins[prefix] === plugin ? 'the one our base block registers' : "the team's own"
}

/** The parser's name, one parser option, one global and one setting ESLint calculates for the file. */
async function languageOptionsAndSettingsIn(config: Linter.Config[], file: string): Promise<Record<string, unknown>> {
  const { languageOptions, settings } = await lintedConfigFor(config, file)
  if (languageOptions === undefined || settings === undefined) throw new Error(`ESLint calculated no language options or settings for ${file}`)
  const parser: unknown = languageOptions['parser']
  const parserOptions: unknown = languageOptions['parserOptions']
  const globals: unknown = languageOptions['globals']
  const react: unknown = settings['react']
  return {
    parser: isRecord(parser) && isRecord(parser['meta']) ? parser['meta']['name'] : undefined,
    jsx: isRecord(parserOptions) && isRecord(parserOptions['ecmaFeatures']) ? parserOptions['ecmaFeatures']['jsx'] : undefined,
    $state: isRecord(globals) ? globals['$state'] : undefined,
    reactVersion: isRecord(react) ? react['version'] : undefined,
  }
}

describe('a team block registering, under the prefix of a rule we run, a plugin object of its own', () => {
  const registrations: readonly Registration[] = [
    {
      registers: 'a different object holding the rule, with a module of its own for it',
      teamConfig: [buildTeamEslintBlock('team', { plugins: { '@typescript-eslint': buildFakePlugin(['array-type']) } })],
      fields: { rules: { [ARRAY_TYPE]: 'error' } },
      ourRule: ARRAY_TYPE,
      source: genericArrayOfASimpleType,
      file: 'src/a.ts',
    },
    {
      registers: 'an object lacking the rule',
      teamConfig: [buildTeamEslintBlock('team', { plugins: { '@typescript-eslint': buildFakePlugin(['team-only']) } })],
      fields: { rules: { [ARRAY_TYPE]: 'error' } },
      ourRule: ARRAY_TYPE,
      source: genericArrayOfASimpleType,
      file: 'src/a.ts',
    },
    {
      registers: 'a raw object under a prefix whose plugin needs the compat layer',
      teamConfig: [buildTeamEslintBlock('team', { plugins: { react: buildFakePlugin(['jsx-key']) } })],
      fields: { rules: { 'react/jsx-curly-brace-presence': 'error' } },
      ourRule: 'react/jsx-curly-brace-presence',
      source: stringLiteralInBracesAsAProp,
      file: 'src/a.tsx',
    },
  ]
  const cases = PROJECTS.flatMap((project) => registrations.map((registration) => ({ ...project, ...registration })))

  it.each(cases)(
    'loads, and runs our module of the rule with our options, when it is $registers, in a project $project',
    async ({ projectDir, fields, teamConfig, source, file, ourRule }) => {
      const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)

      expect(await ruleIdsReportedOn(config, source, file)).toStrictEqual([ourRule])
    },
  )

  it.each(PROJECTS)("keeps the team's own rule under that prefix firing beside ours, in a project $project", async ({ projectDir }) => {
    const teamConfig = [
      buildTeamEslintBlock('team', {
        plugins: { '@typescript-eslint': buildReportingPlugin(['team-rule']) },
        rules: { '@typescript-eslint/team-rule': 'error' },
      }),
    ]
    const config = mergedEditorEslintConfig(projectDir, { rules: { [ARRAY_TYPE]: 'error' } }, teamConfig)

    expect((await ruleIdsReportedOn(config, genericArrayOfASimpleType, 'src/a.ts')).toSorted()).toStrictEqual([
      ARRAY_TYPE,
      '@typescript-eslint/team-rule',
    ])
  })
})

// Ours is left out of the team's files rather than put before the team's block: a later bare severity
// keeps an earlier block's options, and an `off` block between does not reset them (measured).
describe('a rule our part states, which the team sets too', () => {
  const teamRegistering = (rules: Linter.RulesRecord): Linter.Config[] => [
    buildTeamEslintBlock('team', { plugins: { '@typescript-eslint': buildFakePlugin(['array-type']) }, rules }),
  ]

  it.each(PROJECTS)('is off where the team turned it off, ours not running, in a project $project', async ({ projectDir }) => {
    const config = mergedEditorEslintConfig(projectDir, { rules: { [ARRAY_TYPE]: 'error' } }, teamRegistering({ [ARRAY_TYPE]: 'off' }))

    expect(await ruleIdsReportedOn(config, genericArrayOfASimpleType, 'src/a.ts')).toStrictEqual([])
  })

  // The team registers typescript-eslint's own plugin: generic reports what our array-simple leaves,
  // and leaves what ours reports.
  it.each(PROJECTS)("runs with the team's options where the team gave others, in a project $project", async ({ projectDir }) => {
    const teamConfig = [
      buildTeamEslintBlock('team', {
        plugins: { [TYPESCRIPT_ESLINT_PREFIX]: installedEslintPlugin(TYPESCRIPT_ESLINT_PREFIX) },
        rules: { [ARRAY_TYPE]: ['error', { default: 'generic' }] },
      }),
    ]
    const config = mergedEditorEslintConfig(projectDir, { rules: { [ARRAY_TYPE]: 'error' } }, teamConfig)

    expect({
      whatOursReports: await ruleIdsReportedOn(config, genericArrayOfASimpleType, 'src/a.ts'),
      whatTheTeamsReports: await ruleIdsReportedOn(config, simpleTypeArrayInBrackets, 'src/a.ts'),
    }).toStrictEqual({ whatOursReports: [], whatTheTeamsReports: [ARRAY_TYPE] })
  })

  // A key under a prefix both register names our rule, so the rule is the team's, on the team's module:
  // the team's reports every file, where our array-simple would report the first alone.
  it.each(PROJECTS)("runs on the team's own module where the team registers a plugin of its own under the prefix, in a project $project", async ({ projectDir }) => {
    const teamConfig = [buildTeamEslintBlock('team', { plugins: { [TYPESCRIPT_ESLINT_PREFIX]: buildReportingPlugin(['array-type']) }, rules: { [ARRAY_TYPE]: 'error' } })]
    const config = mergedEditorEslintConfig(projectDir, { rules: { [ARRAY_TYPE]: 'error' } }, teamConfig)

    expect({
      whatOursReports: await ruleIdsReportedOn(config, genericArrayOfASimpleType, 'src/a.ts'),
      whatOursLeaves: await ruleIdsReportedOn(config, simpleTypeArrayInBrackets, 'src/a.ts'),
    }).toStrictEqual({ whatOursReports: [ARRAY_TYPE], whatOursLeaves: [ARRAY_TYPE] })
  })

  it("runs eqeqeq with the team's smart where the team gave it, in a project whose package.json lists no oxlint, where ESLint runs it", async () => {
    const teamConfig = [buildTeamEslintBlock('team', { rules: { eqeqeq: ['error', 'smart'] } })]
    const config = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, { rules: { eqeqeq: 'error' } }, teamConfig)

    expect({
      nullCheck: await ruleIdsReportedOn(config, looseNullCheck, 'src/a.ts'),
      numberCheck: await ruleIdsReportedOn(config, looseNumberCheck, 'src/a.ts'),
    }).toStrictEqual({ nullCheck: [], numberCheck: ['eqeqeq'] })
  })

  // The team's setting decides the rule in both engines: no copy of ours runs in either, and nothing
  // turns the team's off.
  it("runs eqeqeq with the team's smart where the team gave it, in a project whose package.json lists oxlint", async () => {
    const teamConfig = [buildTeamEslintBlock('team', { rules: { eqeqeq: ['error', 'smart'] } })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, { rules: { eqeqeq: 'error' } }, teamConfig)

    expect({
      nullCheck: await ruleIdsReportedOn(config, looseNullCheck, 'src/a.ts'),
      numberCheck: await ruleIdsReportedOn(config, looseNumberCheck, 'src/a.ts'),
    }).toStrictEqual({ nullCheck: [], numberCheck: ['eqeqeq'] })
  })

  // The team's max-lines stands on .ts, where ours does not run, and on .tsx, where it would.
  it.each(PROJECTS)("is the team's, options included, in every file the team sets it in, in a project $project", async ({ projectDir }) => {
    const teamConfig = [buildTeamEslintBlock('team', { files: ['**/*.{ts,tsx}'], rules: { 'max-lines': ['error', { max: 1 }] } })]
    const config = mergedEditorEslintConfig(projectDir, { rules: { 'max-lines': 'error' } }, teamConfig)
    const files = ['src/a.ts', 'src/a.tsx']

    expect(await entriesOf(config, 'max-lines', files)).toStrictEqual(await teamAloneEntriesOf(teamConfig, 'max-lines', files))
  })

  it.each(PROJECTS)("is the team's, options included, in every file, where only an entry of ours states it, in a project $project", async ({ projectDir }) => {
    const teamConfig = [buildTeamEslintBlock('team', { rules: { 'max-lines': ['error', { max: 1 }] } })]
    const fields = { fileOverrides: [{ files: ['legacy/**'], rules: { 'max-lines': 'error' } }] } satisfies SharedFields
    const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)
    const files = ['src/a.tsx', 'legacy/a.tsx']

    expect(await entriesOf(config, 'max-lines', files)).toStrictEqual(await teamAloneEntriesOf(teamConfig, 'max-lines', files))
  })

  // Our `off` removes only ours.
  it.each(PROJECTS)("is the team's, options included, in every file, where our top-level rules turn it off, in a project $project", async ({ projectDir }) => {
    const teamConfig = [buildTeamEslintBlock('team', { rules: { 'max-lines': ['error', { max: 1 }] } })]
    const config = mergedEditorEslintConfig(projectDir, { rules: { 'max-lines': 'off' } }, teamConfig)
    const files = ['src/a.ts', 'src/a.tsx']

    expect(await entriesOf(config, 'max-lines', files)).toStrictEqual(await teamAloneEntriesOf(teamConfig, 'max-lines', files))
  })
})

// In every file, inside the block's files or out, every name of the rule has the entry the team's
// config alone gives it, and ours does not run.
describe('a rule our part states, which a team block sets in some files under one of its names', () => {
  const kinds: readonly NameKind[] = [
    {
      kind: 'its own ID',
      ours: ARRAY_TYPE,
      teams: ARRAY_TYPE,
      plugins: () => ({ [TYPESCRIPT_ESLINT_PREFIX]: installedEslintPlugin(TYPESCRIPT_ESLINT_PREFIX) }),
      entry: ['error', { default: 'generic' }],
      projects: PROJECTS,
    },
    {
      kind: 'its alias',
      ours: 'import-x/first',
      teams: 'import/first',
      plugins: () => ({ import: buildReportingPlugin(['first']) }),
      entry: ['error', 'disable-absolute-first'],
      projects: PROJECTS,
    },
    {
      kind: 'its old name',
      ours: 'unicorn/no-for-each',
      teams: 'unicorn/no-array-for-each',
      plugins: () => ({ unicorn: buildReportingPlugin(['no-array-for-each']) }),
      entry: ['error', { teamOption: true }],
      projects: PROJECTS,
    },
    {
      kind: 'the other name its plugin binds it to',
      ours: OUR_MISSING_KEY,
      teams: MISSING_KEY_UNDER_ITS_OTHER_NAME,
      plugins: () => ({ [ESLINT_REACT_PREFIX]: installedEslintPlugin(ESLINT_REACT_PREFIX) }),
      entry: ['warn'],
      projects: PROJECTS,
    },
    {
      kind: "its name under the team's ts prefix for typescript-eslint",
      ours: ARRAY_TYPE,
      teams: TEAM_TS_ARRAY_TYPE,
      plugins: () => ({ [TEAM_TS_PREFIX]: installedEslintPlugin(TYPESCRIPT_ESLINT_PREFIX) }),
      entry: ['error', { default: 'generic' }],
      projects: PROJECTS,
    },
    {
      kind: "its name under the team's react prefix for @eslint-react",
      ours: OUR_INNER_HTML,
      teams: TEAM_INNER_HTML,
      plugins: () => ({ [REACT_PREFIX]: installedEslintPlugin(ESLINT_REACT_PREFIX) }),
      entry: ['warn'],
      projects: PROJECTS,
    },
  ]
  const cases = kinds.flatMap(({ projects, ...kind }) => projects.map((project) => ({ ...project, ...kind })))

  it.each(cases)(
    "is the team's under every name in every file, those outside the team block's included, where the team states $kind, in a project $project",
    async ({ projectDir, ours, teams, plugins, entry }) => {
      const teamConfig = [buildTeamEslintBlock('team', { files: LEGACY_FILES, plugins: plugins(), rules: { [teams]: entry } })]
      const fields = { rules: { [ours]: 'error' } } satisfies SharedFields
      const names = [ours, teams]

      expect(await entriesByFileOf(mergedEditorEslintConfig(projectDir, fields, teamConfig), names, A1_FILES)).toStrictEqual(
        await entriesByFileOf(buildTeamConfigAloneLintingEveryJsAndTsFile(teamConfig), names, A1_FILES),
      )
    },
  )
})

// The team's block sets the rule in the files our off and ignores cover, so the rule is the team's in
// every file, whatever our layer says.
describe("our off and our ignores, beside a team block setting the rule in the files they cover", () => {
  const teamConfig = [
    buildTeamEslintBlock('team', {
      files: LEGACY_FILES,
      plugins: { unicorn: buildReportingPlugin(['no-array-for-each']) },
      rules: { 'max-lines': ['error', { max: 1 }], 'unicorn/no-array-for-each': ['error', { teamOption: true }] },
    }),
  ]
  const names = ['max-lines', 'unicorn/no-for-each', 'unicorn/no-array-for-each']
  const bothOn = { 'max-lines': 'error', 'unicorn/no-for-each': 'error' } satisfies SharedFields['rules']
  const bothOff = { 'max-lines': 'off', 'unicorn/no-for-each': 'off' } satisfies SharedFields['rules']
  const layers: readonly { readonly layer: string; readonly lintRules: (projectDir: string) => LintRules }[] = [
    { layer: 'none: our top-level rules turn it on, the allowed case', lintRules: (projectDir) => buildConsumerLintRules(projectDir, {}, { rules: bothOn }) },
    { layer: 'our top-level rules turning it off', lintRules: (projectDir) => buildConsumerLintRules(projectDir, {}, { rules: bothOff }) },
    {
      layer: 'an entry of ours turning it off in those files',
      lintRules: (projectDir) => buildConsumerLintRules(projectDir, {}, { rules: bothOn, fileOverrides: [{ files: LEGACY_FILES, rules: bothOff }] }),
    },
    {
      layer: 'an entry of ours dropping the rulesets that ship it in those files',
      lintRules: (projectDir) =>
        buildConsumerLintRules(
          projectDir,
          { editorRulesets: { quality: ['complexity', 'modern-js'] } },
          { fileOverrides: [{ files: LEGACY_FILES, editorRulesets: { quality: [] } }] },
        ),
    },
    { layer: 'our ignores naming those files', lintRules: (projectDir) => buildConsumerLintRules(projectDir, {}, { rules: bothOn, ignores: LEGACY_FILES }) },
  ]
  const cases = PROJECTS.flatMap((project) => layers.map((layer) => ({ ...project, ...layer })))

  it.each(cases)(
    "leaves every name of the rule as the team's config alone gives it, in those files and outside them, where the layer is $layer, in a project $project",
    async ({ projectDir, lintRules }) => {
      const { eslint } = defineLintRules(lintRules(projectDir)).editorRulesets

      expect(await entriesByFileOf(mergedBesideATeamOxlintConfigSettingNoRule(teamConfig, eslint), names, A1_FILES)).toStrictEqual(
        await entriesByFileOf(buildTeamConfigAloneLintingEveryJsAndTsFile(teamConfig), names, A1_FILES),
      )
    },
  )

  // Global ignores would silence the team's own rules in those files too.
  it.each(PROJECTS)(
    "leave a rule we do not state as the team's config gives it in the files our ignores name, ours running elsewhere, in a project $project",
    async ({ projectDir }) => {
      const teamRules = [buildTeamEslintBlock('team', { rules: { 'no-console': ['warn', { allow: ['error'] }] } })]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [ARRAY_TYPE]: 'error' }, ignores: LEGACY_FILES }, teamRules)
      const ruleIds = ['no-console', ARRAY_TYPE]

      expect(await entriesByFileOf(config, ruleIds, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual({
        'legacy/a.ts': { 'no-console': [1, { allow: ['error'] }], [ARRAY_TYPE]: ABSENT },
        'src/a.ts': { 'no-console': [1, { allow: ['error'] }], [ARRAY_TYPE]: [2, { default: 'array-simple' }] },
      })
    },
  )
})

describe('a team rule our part does not state', () => {
  it.each(PROJECTS)('keeps the setting the team gives it, in a project $project', async ({ projectDir }) => {
    const teamConfig = [buildTeamEslintBlock('team', { rules: { 'no-console': ['warn'] } })]
    const config = mergedEditorEslintConfig(projectDir, { rules: { [ARRAY_TYPE]: 'error' } }, teamConfig)

    expect(await severitiesOf(config, 'no-console', ['src/a.ts'])).toStrictEqual({ 'src/a.ts': 'warn' })
  })

  // react/react-in-jsx-scope is routed to oxlint but not shipped; our oxlint part runs react/jsx-key. The
  // team sets both, so both are the team's and nothing turns either off.
  it("keeps firing in ESLint when we route it to oxlint but do not run it, and so does one our oxlint part runs, in a project whose package.json lists oxlint", async () => {
    const teamConfig = [
      buildTeamEslintBlock('team', {
        plugins: { react: buildReportingPlugin(['react-in-jsx-scope', 'jsx-key']) },
        rules: { 'react/react-in-jsx-scope': 'error', 'react/jsx-key': 'error' },
      }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, { rules: { 'react/jsx-key': 'error' } }, teamConfig)

    expect((await ruleIdsReportedOn(config, cleanModule, 'src/a.tsx')).toSorted()).toStrictEqual(['react/jsx-key', 'react/react-in-jsx-scope'])
  })
})

// No copy of a rule is turned off across engines: oxlint runs it in the entry's files, and ESLint
// states nothing of it.
describe('a rule our oxlint part runs with options of an entry of ours, in a project whose package.json lists oxlint', () => {
  it("states nothing of it in ESLint, in the entry's files or elsewhere", async () => {
    const fields = { fileOverrides: [{ files: LEGACY_FILES, rules: { [NO_UNUSED_VARS]: ['error', { args: 'none' }] } }] } satisfies SharedFields
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, [])

    expect({
      inTheEntrysFiles: await ruleEntryFor(config, 'legacy/a.ts', NO_UNUSED_VARS),
      elsewhere: await ruleEntryFor(config, 'src/a.ts', NO_UNUSED_VARS),
    }).toStrictEqual({ inTheEntrysFiles: undefined, elsewhere: undefined })
  })
})

// Our off removes only ours, and where our oxlint part runs the rule, nothing turns the team's ESLint
// copy off.
describe('a rule our oxlint part states, which the team sets in ESLint, in a project whose package.json lists oxlint', () => {
  const teamConfig = [buildTeamEslintBlock('team', { rules: { [NO_WARNING_COMMENTS]: ['error', { terms: ['hack'] }] } })]
  const files = ['legacy/a.ts', 'src/a.ts']

  it.each([
    { layer: 'our top-level rules turn it off', fields: { rules: { [NO_WARNING_COMMENTS]: 'off' } } satisfies SharedFields },
    { layer: 'only an entry of ours turns it off', fields: { fileOverrides: [{ files: LEGACY_FILES, rules: { [NO_WARNING_COMMENTS]: 'off' } }] } satisfies SharedFields },
    { layer: 'only an entry of ours runs it', fields: { fileOverrides: [{ files: LEGACY_FILES, rules: { [NO_WARNING_COMMENTS]: 'error' } }] } satisfies SharedFields },
  ])("is the team's in every file, options included, where $layer", async ({ fields }) => {
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)

    expect(await entriesOf(config, NO_WARNING_COMMENTS, files)).toStrictEqual(await teamAloneEntriesOf(teamConfig, NO_WARNING_COMMENTS, files))
  })
})

// The team sets the rule, so it is the team's in every file: one our ignores match, one where our
// settings turn it off, one it ships ignoring, and one our oxlint part would run it in.
describe('a rule our oxlint part runs in some files only, which the team sets in ESLint, in a project whose package.json lists oxlint', () => {
  const cases: readonly { readonly where: string; readonly ruleId: string; readonly teamEntry: Linter.RuleEntry; readonly fields: SharedFields; readonly file: string }[] = [
    { where: 'our ignores match', ruleId: NO_DEBUGGER, teamEntry: ['error'], fields: { rules: { [NO_DEBUGGER]: 'error' }, ignores: LEGACY_FILES }, file: 'legacy/a.ts' },
    { where: 'our ignores match, naming its folder bare', ruleId: NO_DEBUGGER, teamEntry: ['error'], fields: { rules: { [NO_DEBUGGER]: 'error' }, ignores: ['legacy'] }, file: 'legacy/a.ts' },
    {
      where: 'an entry of ours turns it off',
      ruleId: NO_DEBUGGER,
      teamEntry: ['error'],
      fields: { rules: { [NO_DEBUGGER]: 'error' }, fileOverrides: [{ files: LEGACY_FILES, rules: { [NO_DEBUGGER]: 'off' } }] },
      file: 'legacy/a.ts',
    },
    // no-unused-vars ships ignoring scripts folders.
    { where: 'it ships ignoring', ruleId: NO_UNUSED_VARS, teamEntry: ['error', { args: 'none' }], fields: { rules: { [NO_UNUSED_VARS]: 'error' } }, file: 'scripts/a.ts' },
  ]

  it.each(cases)("is the team's, options included, in a file $where, and in one our oxlint part would run it in", async ({ ruleId, teamEntry, fields, file }) => {
    const teamConfig = [buildTeamEslintBlock('team', { rules: { [ruleId]: teamEntry } })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)
    const files = [file, 'src/a.ts']

    expect(await entriesOf(config, ruleId, files)).toStrictEqual(await teamAloneEntriesOf(teamConfig, ruleId, files))
  })
})

// import-x/first is oxlint's where the project lists oxlint, ESLint's without; either way the team's
// alias of it is the team's, and nothing turns it off across engines.
describe('an alias of a rule our part runs', () => {
  it.each(PROJECTS)("is the team's where the team turns it on, in a project $project", async ({ projectDir }) => {
    const teamConfig = [
      buildTeamEslintBlock('team', { plugins: { import: buildReportingPlugin(['first']) }, rules: { 'import/first': 'error' } }),
    ]
    const config = mergedEditorEslintConfig(projectDir, { rules: { 'import-x/first': 'error' } }, teamConfig)

    expect(await severitiesOf(config, 'import/first', ['src/a.ts'])).toStrictEqual({ 'src/a.ts': 'error' })
  })

  // The team registers our very import-x object under `import`, a prefix of its own for our plugin:
  // its import/first is a name of our rule, and the team's entry decides it.
  it.each(PROJECTS)("keeps the team's entry where the team registers our import-x under import, in a project $project", async ({ projectDir }) => {
    const config = mergedEditorEslintConfig(projectDir, { rules: { 'import-x/first': 'error' } }, importXUnderImport())

    expect(await entriesOf(config, 'import/first', ['src/a.ts'])).toStrictEqual(await teamAloneEntriesOf(importXUnderImport(), 'import/first', ['src/a.ts']))
  })

  it.each(PROJECTS)("holds the team's own entry, options included, in a project $project", async ({ projectDir }) => {
    const teamConfig = [buildTeamEslintBlockSetting('team', { 'import/first': ['error', 'disable-absolute-first'] })]
    const config = mergedEditorEslintConfig(projectDir, { rules: { 'import-x/first': 'error' } }, teamConfig)

    expect(await entriesOf(config, 'import/first', ['src/a.ts'])).toStrictEqual(await teamAloneEntriesOf(teamConfig, 'import/first', ['src/a.ts']))
  })
})

function importXUnderImport(): Linter.Config[] {
  return [buildTeamEslintBlock('team', { plugins: { import: installedEslintPlugin('import-x') }, rules: { 'import/first': ['error', 'disable-absolute-first'] } })]
}

// Another ESLint name of the same rule (an alias, an old name, a deprecated extension) would run beside
// ours and report each finding twice, so the team's setting of one decides the rule. The names are
// walked from the catalog (other-eslint-names.ts). A core rule and its typescript-eslint twin count as one.
describe('another ESLint name of a rule either editor part states', () => {
  it.each(PROJECTS)("is the team's in every file where the team turns it on, in a project $project", async ({ projectDir }) => {
    const parts = defineLintRules(buildEveryRulesetLintRules(projectDir)).editorRulesets
    const runByOurEslintPart = new Set(rulesOnInEslint(mergedBesideATeamOxlintConfigSettingNoRule([], parts.eslint)).map(({ id }) => id))
    const sameRuleNames = sameRuleNamesOfEach(ruleIdsStatedByEitherPart(parts), catalog).filter((name) => !runByOurEslintPart.has(name))
    const config = mergedBesideATeamOxlintConfigSettingNoRule([buildTeamEslintBlockTurningOn('team', sameRuleNames)], parts.eslint)

    expect({
      walked: SAME_RULE_NAMES_THE_WALK_REACHES.filter((name) => sameRuleNames.includes(name)),
      stillOn: await ruleIdsOnIn(config, 'src/a.tsx', sameRuleNames),
    }).toStrictEqual({ walked: SAME_RULE_NAMES_THE_WALK_REACHES, stillOn: sameRuleNames })
  })

  // oxlint does not spell these extensions under its typescript scope, so each one's
  // meta.docs.extendsBaseRule names its core rule. The team's twin runs on its own module, and our core
  // rule runs in neither engine.
  it.each(TWINS_OXLINT_DOES_NOT_SPELL)(
    "is the team's for $twin, typescript-eslint's twin of $coreRule, which our rules turn on, in a project whose package.json lists oxlint",
    async ({ twin, coreRule }) => {
      const teamConfig = [buildTeamEslintBlockTurningOn('team', [twin, TEAM_RULE_OF_TYPESCRIPT_ESLINT])]
      const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, { rules: { [coreRule]: 'error' } }, teamConfig)

      expect((await ruleIdsReportedOn(config, cleanModule, 'src/a.ts')).toSorted()).toStrictEqual([TEAM_RULE_OF_TYPESCRIPT_ESLINT, twin].toSorted())
    },
  )

  it.each(TWINS_OXLINT_DOES_NOT_SPELL.filter(({ withoutOxlint }) => withoutOxlint === 'run by ESLint'))(
    "is the team's for $twin, typescript-eslint's twin of $coreRule, which ESLint runs for us, in a project whose package.json lists no oxlint",
    async ({ twin, coreRule }) => {
      const teamConfig = [buildTeamEslintBlockTurningOn('team', [twin, TEAM_RULE_OF_TYPESCRIPT_ESLINT])]
      const config = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, { rules: { [coreRule]: 'error' } }, teamConfig)

      expect((await ruleIdsReportedOn(config, cleanModule, 'src/a.ts')).toSorted()).toStrictEqual([TEAM_RULE_OF_TYPESCRIPT_ESLINT, twin].toSorted())
    },
  )

  // Without the team, our part would run $twin on TS files and $coreRule on JS files: the team's
  // statement of the twin decides both.
  it.each(TWINS_OXLINT_DOES_NOT_SPELL.filter(({ withoutOxlint }) => withoutOxlint === 'run by ESLint, as the extension on TS files'))(
    "is the team's on TS and JS files alike, where our part would run $twin itself on TS files and $coreRule on JS files, in a project whose package.json lists no oxlint",
    async ({ twin, coreRule }) => {
      const teamConfig = [buildTeamEslintBlockTurningOn('team', [twin, TEAM_RULE_OF_TYPESCRIPT_ESLINT])]
      const config = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, { rules: { [coreRule]: 'error' } }, teamConfig)

      expect({
        skipped: catalog.eslintFallbackSkips.has(coreRule),
        twin: await severitiesOf(config, twin, ['src/a.ts', 'src/a.js']),
        coreRule: await severitiesOf(config, coreRule, ['src/a.ts', 'src/a.js']),
      }).toStrictEqual({ skipped: false, twin: { 'src/a.ts': 'error', 'src/a.js': 'error' }, coreRule: { 'src/a.ts': 'off', 'src/a.js': 'off' } })
    },
  )

  // A typed extension lints a TS file only with a tsconfig's type information, so the file is on disk
  // under tsconfigRootDir and the tsconfig includes it.
  const typedLintProject = typedProjectWithoutOxlint(cleanModule)

  it.each(TWINS_OXLINT_DOES_NOT_SPELL.filter(({ withoutOxlint }) => withoutOxlint === 'run by ESLint, as the extension on TS files'))(
    "lints a TS file a tsconfig includes with no fatal message, reporting the team's rules alone, where the team turns on $twin and our rules $coreRule, in a project whose package.json lists no oxlint",
    async ({ twin, coreRule }) => {
      const teamConfig = [buildTeamEslintBlockTurningOn('team', [twin, TEAM_RULE_OF_TYPESCRIPT_ESLINT])]
      const config = mergedEditorEslintConfig(typedLintProject, { rules: { [coreRule]: 'error' } }, teamConfig)

      const reported = await ruleIdsReportedInProjectByFile(typedLintProject, config)

      expect(Object.fromEntries(Object.entries(reported).map(([file, ruleIds]) => [file, ruleIds.toSorted()]))).toStrictEqual({
        [TS_FILE_A_TSCONFIG_INCLUDES]: [TEAM_RULE_OF_TYPESCRIPT_ESLINT, twin].toSorted(),
      })
    },
  )

  // Our part runs both no-throw-literal and typescript-eslint's only-throw-error.
  it.each(PROJECTS)(
    "runs where our rules turn that name on too: typescript-eslint's only-throw-error beside no-throw-literal, in a project $project",
    async ({ projectDir }) => {
      const fields = { rules: { 'no-throw-literal': 'error', '@typescript-eslint/only-throw-error': 'error' } } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, [])

      expect(await severitiesOf(config, '@typescript-eslint/only-throw-error', ['src/a.ts'])).toStrictEqual({ 'src/a.ts': 'error' })
    },
  )

  it.each(PROJECTS)(
    "is the team's for unicorn's old name of no-for-each, which we run, beside the team's other rules of that plugin, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = [buildTeamEslintBlockTurningOn('team', ['unicorn/no-array-for-each', 'unicorn/team-rule'])]
      const config = mergedEditorEslintConfig(projectDir, { rules: { 'unicorn/no-for-each': 'error' } }, teamConfig)

      expect((await ruleIdsReportedOn(config, cleanModule, 'src/a.ts')).toSorted()).toStrictEqual(['unicorn/no-array-for-each', 'unicorn/team-rule'])
    },
  )

  // The team's statement of typescript-eslint's twin of no-unused-vars makes the pair the team's: it
  // runs on the team's own module, which reports every file, and our core rule runs nowhere.
  it.each(PROJECTS)("is the team's for typescript-eslint's twin of no-unused-vars, which our rules turn on, in a project $project", async ({ projectDir }) => {
    const teamConfig = [buildTeamEslintBlockTurningOn('team', ['@typescript-eslint/no-unused-vars', '@typescript-eslint/team-rule'])]
    const config = mergedEditorEslintConfig(projectDir, { rules: { 'no-unused-vars': 'error' } }, teamConfig)

    expect((await ruleIdsReportedOn(config, cleanModule, 'src/a.ts')).toSorted()).toStrictEqual(['@typescript-eslint/no-unused-vars', '@typescript-eslint/team-rule'])
  })

  // Without oxlint our part runs the core rule on JS files and the twin on TS files; the team's statement
  // of the twin makes the pair the team's, reported once in either.
  it("is the team's on TS and JS files alike, where our core rule would run, in a project whose package.json lists no oxlint", async () => {
    const teamConfig = [buildTeamEslintBlockTurningOn('team', [TWIN_OF_NO_UNUSED_VARS])]
    const config = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, { rules: { [NO_UNUSED_VARS]: 'error' } }, teamConfig)

    expect({
      severities: await severitiesOf(config, TWIN_OF_NO_UNUSED_VARS, ['src/a.ts', 'src/a.js']),
      reportedOnTs: await ruleIdsReportedOn(config, unusedVariable, 'src/a.ts'),
      reportedOnJs: await ruleIdsReportedOn(config, unusedVariable, 'src/a.js'),
    }).toStrictEqual({
      severities: { 'src/a.ts': 'error', 'src/a.js': 'error' },
      reportedOnTs: [TWIN_OF_NO_UNUSED_VARS],
      reportedOnJs: [TWIN_OF_NO_UNUSED_VARS],
    })
  })

  // An alias is the same rule: the team's statement of it decides the rule in every file, inside the
  // entry and out.
  it.each(PROJECTS.map((project) => ({ ...project, severities: { 'legacy/a.ts': 'error', 'src/a.ts': 'error' } })))(
    "is the team's for typescript-eslint's deprecated no-loop-func, the core rule's alias, where an entry turns ours off too, in a project $project",
    async ({ projectDir, severities }) => {
      const fields = {
        rules: { [CORE_RULE_WITH_A_DEPRECATED_EXTENSION]: 'error' },
        fileOverrides: [{ files: LEGACY_FILES, rules: { [CORE_RULE_WITH_A_DEPRECATED_EXTENSION]: 'off' } }],
      } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, [buildTeamEslintBlockTurningOn('team', [DEPRECATED_EXTENSION])])

      expect(await severitiesOf(config, DEPRECATED_EXTENSION, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual(severities)
    },
  )

  // The allowed case beside it: a spelling only oxlint reads is no ESLint name of our rule, so a
  // plugin of the team's own registered under that prefix keeps its rule of the name.
  it.each(PROJECTS)(
    "leaves as the team set it a rule of a plugin of its own under typescript, a prefix only oxlint reads our rule by, in a project $project",
    async ({ projectDir }) => {
      const teamPlugin = buildFakePlugin(['no-explicit-any'], { meta: { name: TEAM_TYPESCRIPT_PLUGIN_NAME, version: TEAM_PLUGIN_VERSION } })
      const teamConfig = [buildTeamEslintBlock('team', { plugins: { [TEAM_TYPESCRIPT_PREFIX]: teamPlugin }, rules: { [TEAM_TYPESCRIPT_RULE]: 'error' } })]
      const config = mergedEditorEslintConfig(projectDir, { rules: { '@typescript-eslint/no-explicit-any': 'error' } }, teamConfig)

      expect(await severitiesOf(config, TEAM_TYPESCRIPT_RULE, ['src/a.ts'])).toStrictEqual({ 'src/a.ts': 'error' })
    },
  )

  // A spelling of our rule that is another rule ID of the catalog, under another prefix, names the
  // same rule; today's catalog has none, so a small catalog states one.
  describe('in a catalog where an oxlint spelling of our rule is another rule ID, under another prefix', () => {
    const smallCatalog = buildCatalog({
      rulesets: [],
      rules: [
        buildEslintRoute('n/no-process-exit', { typed: false, shipped: null, oxlintSpellings: ['n/no-process-exit', 'node/no-process-exit'] }),
        buildEslintRoute('node/no-process-exit', { typed: false, shipped: null }),
      ],
    })
    const smallRegistry = buildPluginRegistry({ n: ['no-process-exit'], node: ['no-process-exit'] })

    it.each([
      { project: 'whose package.json lists oxlint', usesOxlint: true },
      { project: 'whose package.json lists no oxlint', usesOxlint: false },
    ])("is the team's in every file where the team turns it on, ESLint running ours, in a project $project", async ({ usesOxlint }) => {
      const lintRules = buildTwoSetLintRules({}, { tsconfigRootDir: PROJECT_WITH_OXLINT, rules: { 'n/no-process-exit': 'error' } })
      const { eslint } = editorPartsOf(lintRules, smallCatalog, usesOxlint)
      const config = mergeEslintPart(
        [buildTeamEslintBlockTurningOn('team', ['node/no-process-exit'])],
        eslint,
        smallCatalog,
        smallRegistry,
        OUR_VERSION,
        NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG,
      )

      expect(await severitiesOf(config, 'node/no-process-exit', ['src/a.ts'])).toStrictEqual({ 'src/a.ts': 'error' })
    })
  })

  // Where our rules turn on both no-unused-vars and its twin, the pair runs once per file: without oxlint
  // ESLint runs the twin on TS files; beside oxlint, oxlint runs the pair there and ESLint's copies are off.
  it.each([
    { project: 'whose package.json lists oxlint, which runs the pair for us: off', projectDir: PROJECT_WITH_OXLINT, severities: { 'src/a.ts': 'off' } },
    { project: 'whose package.json lists no oxlint: ours', projectDir: PROJECT_WITHOUT_OXLINT, severities: { 'src/a.ts': 'error' } },
  ])(
    "is decided for typescript-eslint's no-unused-vars, where our rules turn that name on too, beside the core rule, in a project $project",
    async ({ projectDir, severities }) => {
      const fields = { rules: { 'no-unused-vars': 'error', '@typescript-eslint/no-unused-vars': 'error' } } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, [])

      expect(await severitiesOf(config, '@typescript-eslint/no-unused-vars', ['src/a.ts'])).toStrictEqual(severities)
    },
  )
})

// @eslint-react 5.24.10 binds one rule module to two names, `x-no-missing-key` and `no-missing-key`,
// for many rules: a team running the other name beside ours would report each finding twice, so the
// team's setting of it decides. The names are walked from the installed plugins (other-eslint-names.ts).
describe('another name a plugin of ours binds to the module of a rule either editor part states', () => {
  const teamRunning = (rules: Linter.RulesRecord): Linter.Config[] => [
    buildTeamEslintBlock('team', { plugins: { [ESLINT_REACT_PREFIX]: installedEslintPlugin(ESLINT_REACT_PREFIX) }, rules }),
  ]

  it.each(PROJECTS)("is the team's in every file where the team turns it on, in a project $project", async ({ projectDir }) => {
    const parts = defineLintRules(buildEveryRulesetLintRules(projectDir)).editorRulesets
    const runByOurEslintPart = new Set(rulesOnInEslint(mergedBesideATeamOxlintConfigSettingNoRule([], parts.eslint)).map(({ id }) => id))
    const sameModuleNames = sameModuleNamesOfEach(ruleIdsStatedByEitherPart(parts)).filter((name) => !runByOurEslintPart.has(name))
    const config = mergedBesideATeamOxlintConfigSettingNoRule([buildTeamEslintBlockTurningOn('team', sameModuleNames)], parts.eslint)

    expect({
      walked: SAME_MODULE_NAMES_THE_WALK_REACHES.filter((name) => sameModuleNames.includes(name)),
      stillOn: await ruleIdsOnIn(config, 'src/a.tsx', sameModuleNames),
    }).toStrictEqual({ walked: SAME_MODULE_NAMES_THE_WALK_REACHES, stillOn: sameModuleNames })
  })

  it.each(PROJECTS)("reports a finding of that rule once, under the team's name, in a project $project", async ({ projectDir }) => {
    const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_MISSING_KEY]: 'error' } }, teamRunning({ [MISSING_KEY_UNDER_ITS_OTHER_NAME]: 'error' }))

    expect(await ruleIdsReportedOn(config, listItemWithoutAKey, 'src/a.tsx')).toStrictEqual([MISSING_KEY_UNDER_ITS_OTHER_NAME])
  })

  it.each(PROJECTS)("is the team's in every file where our top-level rules turn our name off, in a project $project", async ({ projectDir }) => {
    const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_MISSING_KEY]: 'off' } }, teamRunning({ [MISSING_KEY_UNDER_ITS_OTHER_NAME]: 'error' }))

    expect(await severitiesOf(config, MISSING_KEY_UNDER_ITS_OTHER_NAME, ['src/a.tsx', 'src/a.ts'])).toStrictEqual({
      'src/a.tsx': 'error',
      'src/a.ts': 'error',
    })
  })

  // Beside it: a rule bound to a module of its own is another rule, however alike its name, and the
  // other name of a rule we do not state is the team's to decide.
  it.each(PROJECTS)(
    "leaves as the team set them the other name of our rule, a rule of that plugin named alike but bound to a module of its own, and the other name of a rule we do not state, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = teamRunning({
        [MISSING_KEY_UNDER_ITS_OTHER_NAME]: 'error',
        [DUPLICATE_KEY]: 'error',
        [UNUSED_STATE_UNDER_ITS_OTHER_NAME]: 'error',
      })
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_MISSING_KEY]: 'error' } }, teamConfig)

      expect(
        await severitiesOfEach(config, [MISSING_KEY_UNDER_ITS_OTHER_NAME, DUPLICATE_KEY, UNUSED_STATE_UNDER_ITS_OTHER_NAME], ['src/a.tsx']),
      ).toStrictEqual({
        'src/a.tsx': { [MISSING_KEY_UNDER_ITS_OTHER_NAME]: 'error', [DUPLICATE_KEY]: 'error', [UNUSED_STATE_UNDER_ITS_OTHER_NAME]: 'error' },
      })
    },
  )
})

// typescript-eslint's version of a rule and the core rule it extends count as one rule: where the team
// turns the twin on, the pair is the team's in every file and both engines, however ours would run.
// The pairs are walked from typescript-eslint's own metadata (other-eslint-names.ts).
describe("typescript-eslint's twin of a rule either editor part states, which the team turns on", () => {
  it.each(PROJECTS_THE_TWIN_WALK_READS)(
    "is the team's in every file, whichever side is ours, in a project $project",
    { timeout: TWIN_WALK_TIMEOUT_MS },
    async ({ projectDir, reaches }) => {
      const parts = defineLintRules(buildEveryRulesetLintRules(projectDir)).editorRulesets
      const statedByUs = ruleIdsStatedByEitherPart(parts)
      const runByOurEslintPart = new Set(rulesOnInEslint(mergedBesideATeamOxlintConfigSettingNoRule([], parts.eslint)).map(({ id }) => id))
      const pairs = twinPairsOf(statedByUs).filter(({ theirs }) => !statedByUs.includes(theirs) && !runByOurEslintPart.has(theirs))
      const theirs = [...new Set(pairs.map((pair) => pair.theirs))].toSorted()
      const teamConfig = [buildTeamEslintBlockTurningOn('team', theirs)]
      const config = mergedBesideATeamOxlintConfigSettingNoRule(teamConfig, parts.eslint)

      expect({
        walked: reaches.filter((twin) => theirs.includes(twin)),
        severities: await severitiesOfEach(config, theirs, TWIN_WALK_FILES),
      }).toStrictEqual({ walked: reaches, severities: await severitiesOfEach(buildTeamConfigAloneLintingEveryJsAndTsFile(teamConfig), theirs, TWIN_WALK_FILES) })
    },
  )

  const casesBothWays = PROJECTS.flatMap((project) => TWINS_BOTH_WAYS.map((twins) => ({ ...project, ...twins })))

  it.each(casesBothWays)("is the team's where our top-level rules run $ours, in a project $project: $direction", async ({ projectDir, ours, theirs }) => {
    const config = mergedEditorEslintConfig(projectDir, { rules: { [ours]: 'error' } }, [buildTeamEslintBlockTurningOn('team', [theirs])])

    expect(await severitiesOf(config, theirs, ['src/a.ts', 'src/a.js'])).toStrictEqual({ 'src/a.ts': 'error', 'src/a.js': 'error' })
  })

  it.each(casesBothWays)(
    "is the team's in the files of the entry that alone runs $ours and outside them, in a project $project: $direction",
    async ({ projectDir, ours, theirs }) => {
      const fields = { fileOverrides: [{ files: LEGACY_FILES, rules: { [ours]: 'error' } }] } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, [buildTeamEslintBlockTurningOn('team', [theirs])])

      expect(await severitiesOf(config, theirs, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual({ 'legacy/a.ts': 'error', 'src/a.ts': 'error' })
    },
  )

  it.each(casesBothWays)(
    "is the team's in the files of an entry turning $ours off and outside them, in a project $project: $direction",
    async ({ projectDir, ours, theirs }) => {
      const fields = { rules: { [ours]: 'error' }, fileOverrides: [{ files: LEGACY_FILES, rules: { [ours]: 'off' } }] } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, [buildTeamEslintBlockTurningOn('team', [theirs])])

      expect(await severitiesOf(config, theirs, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual({ 'legacy/a.ts': 'error', 'src/a.ts': 'error' })
    },
  )

  // The team sets $ours itself in some files only: the pair is the team's in every file all the same.
  it.each(casesBothWays)(
    "is the team's in the files where the team sets $ours too and outside them, in a project $project: $direction",
    async ({ projectDir, ours, theirs }) => {
      const teamConfig = [
        buildTeamEslintBlockTurningOn('team-twin', [theirs]),
        buildTeamEslintBlockTurningOnWithin('team-ours', [ours], { files: LEGACY_FILES }),
      ]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [ours]: 'error' } }, teamConfig)

      expect(await severitiesOf(config, theirs, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual({ 'legacy/a.ts': 'error', 'src/a.ts': 'error' })
    },
  )

  it.each(casesBothWays)(
    "is the team's in the files of an entry running $ours, those of a later entry turning it off again and the rest, in a project $project: $direction",
    async ({ projectDir, ours, theirs }) => {
      const fields = {
        fileOverrides: [
          { files: LEGACY_FILES, rules: { [ours]: 'error' } },
          { files: LEGACY_OLD_FILES, rules: { [ours]: 'off' } },
        ],
      } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, [buildTeamEslintBlockTurningOn('team', [theirs])])

      expect(await severitiesOf(config, theirs, ['legacy/old/a.ts', 'legacy/a.ts', 'src/a.ts'])).toStrictEqual({
        'legacy/old/a.ts': 'error',
        'legacy/a.ts': 'error',
        'src/a.ts': 'error',
      })
    },
  )

  // The team's own blocks scope the twin: within their files and ignores, read from their basePath,
  // each block in its order, the twin is as the team's config alone gives it, in every file.
  const teamBlocksScopingTheTwin: readonly { readonly scope: string; readonly teamConfig: Linter.Config[]; readonly files: readonly string[] }[] = [
    {
      scope: 'naming its files',
      teamConfig: [buildTeamEslintBlockTurningOnWithin('team', [TEAMS_TWIN_OF_OUR_CORE_RULE], { files: ['legacy/team/**'] })],
      files: ['legacy/team/a.ts', 'legacy/a.ts', 'src/team/a.ts'],
    },
    {
      scope: 'with ignores',
      teamConfig: [buildTeamEslintBlockTurningOnWithin('team', [TEAMS_TWIN_OF_OUR_CORE_RULE], { ignores: ['legacy/vendor/**'] })],
      files: ['legacy/a.ts', 'legacy/vendor/a.ts', 'src/a.ts'],
    },
    {
      scope: 'under a basePath, its files read from there',
      teamConfig: [buildTeamEslintBlockTurningOnWithin('team', [TEAMS_TWIN_OF_OUR_CORE_RULE], { basePath: 'legacy', files: ['team/**'] })],
      files: ['legacy/team/a.ts', 'legacy/a.ts', 'team/a.ts'],
    },
    {
      scope: "after a block of the team's setting other rules",
      teamConfig: [
        buildTeamEslintBlockSetting('team-other', { 'no-console': 'warn' }),
        buildTeamEslintBlockTurningOn('team', [TEAMS_TWIN_OF_OUR_CORE_RULE]),
      ],
      files: ['legacy/a.ts', 'src/a.ts'],
    },
    {
      scope: 'and a later block setting it again in some of its files',
      teamConfig: [
        buildTeamEslintBlockSetting('team-all', { [TEAMS_TWIN_OF_OUR_CORE_RULE]: 'warn' }),
        buildTeamEslintBlock('team-sub', { files: ['legacy/sub/**'], rules: { [TEAMS_TWIN_OF_OUR_CORE_RULE]: 'error' } }),
      ],
      files: ['legacy/a.ts', 'legacy/sub/a.ts', 'src/a.ts'],
    },
  ]
  const teamScopesInEachProject = PROJECTS.flatMap((project) => teamBlocksScopingTheTwin.map((scoped) => ({ ...project, ...scoped })))

  it.each(teamScopesInEachProject)(
    "is the team's in every file, as a team block $scope gives it, beside an entry turning our rule off, in a project $project",
    async ({ projectDir, teamConfig, files }) => {
      const fields = {
        rules: { [OUR_CORE_RULE_WITH_A_TWIN]: 'error' },
        fileOverrides: [{ files: LEGACY_FILES, rules: { [OUR_CORE_RULE_WITH_A_TWIN]: 'off' } }],
      } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)

      expect(await entriesOf(config, TEAMS_TWIN_OF_OUR_CORE_RULE, files)).toStrictEqual(await teamAloneEntriesOf(teamConfig, TEAMS_TWIN_OF_OUR_CORE_RULE, files))
    },
  )

  // ESLint takes an absolute basePath as it is; the merge is told one directory of the project.
  it("is the team's in the files of an entry turning our rule off, as a team block under an absolute basePath into the project gives it", async () => {
    const teamScope: TeamBlockScope = { basePath: join(PROJECT_WITH_OXLINT, 'legacy') }
    const teamConfig = [buildTeamEslintBlockTurningOnWithin('team', [TEAMS_TWIN_OF_OUR_CORE_RULE], teamScope)]
    const fields = {
      rules: { [OUR_CORE_RULE_WITH_A_TWIN]: 'error' },
      fileOverrides: [{ files: LEGACY_FILES, rules: { [OUR_CORE_RULE_WITH_A_TWIN]: 'off' } }],
    } satisfies SharedFields
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)
    const severityIn = async (file: string): Promise<string> =>
      (await ruleSeverityInProjectFor(PROJECT_WITH_OXLINT, config, file, TEAMS_TWIN_OF_OUR_CORE_RULE)) ?? 'off'

    expect({ underIt: await severityIn('legacy/a.ts'), outsideIt: await severityIn('src/a.ts') }).toStrictEqual({ underIt: 'error', outsideIt: 'off' })
  })

  // require-await ships in no ruleset, so our oxlint part would run it in every file it lints.
  it("is the team's in the files of an entry turning off a core rule our oxlint part runs in every file, and outside them, in a project whose package.json lists oxlint", async () => {
    const teamConfig = [buildTeamEslintBlockTurningOn('team', [TWIN_OF_THE_CORE_RULE_OXLINT_RUNS_EVERYWHERE])]
    const fields = {
      rules: { [CORE_RULE_OXLINT_RUNS_EVERYWHERE]: 'error' },
      fileOverrides: [{ files: LEGACY_FILES, rules: { [CORE_RULE_OXLINT_RUNS_EVERYWHERE]: 'off' } }],
    } satisfies SharedFields
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)

    expect(await severitiesOf(config, TWIN_OF_THE_CORE_RULE_OXLINT_RUNS_EVERYWHERE, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual({
      'legacy/a.ts': 'error',
      'src/a.ts': 'error',
    })
  })

  it("is the team's in the files of an entry turning off the core rule our oxlint part runs, and outside them, in a project whose package.json lists oxlint", async () => {
    const teamConfig = [buildTeamEslintBlockTurningOn('team', [TWIN_OF_NO_UNUSED_VARS])]
    const fields = {
      rules: { [NO_UNUSED_VARS]: 'error' },
      fileOverrides: [{ files: LEGACY_FILES, rules: { [NO_UNUSED_VARS]: 'off' } }],
    } satisfies SharedFields
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)

    expect(await severitiesOf(config, TWIN_OF_NO_UNUSED_VARS, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual({
      'legacy/a.ts': 'error',
      'src/a.ts': 'error',
    })
  })

  // Stating our rule off is not running it.
  it.each(casesBothWays)(
    "is the team's in every file where our top-level rules turn $ours off, in a project $project: $direction",
    async ({ projectDir, ours, theirs }) => {
      const config = mergedEditorEslintConfig(projectDir, { rules: { [ours]: 'off' } }, [buildTeamEslintBlockTurningOn('team', [theirs])])

      expect(await severitiesOf(config, theirs, ['src/a.ts', 'src/a.js'])).toStrictEqual({ 'src/a.ts': 'error', 'src/a.js': 'error' })
    },
  )

  it.each(casesBothWays)(
    "keeps the team's options where $ours does not run, as the team's config alone gives them, in a project $project: $direction",
    async ({ projectDir, ours, theirs, teamOptions }) => {
      const teamConfig = [buildTeamEslintBlockSetting('team', { [theirs]: ['warn', teamOptions] })]
      const fields = { fileOverrides: [{ files: LEGACY_FILES, rules: { [ours]: 'error' } }] } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)

      expect(await ruleEntryFor(config, 'src/a.js', theirs)).toStrictEqual(await ruleEntryFor(teamConfig, 'src/a.js', theirs))
    },
  )

  // The alias beside it is the team's too: our rule is off-only, so nothing of ours reaches across engines.
  it.each(PROJECTS)(
    "is the team's where our top-level rules turn our rule off, and so is the same rule's alias, in a project $project",
    async ({ projectDir }) => {
      const fields = { rules: { 'prefer-promise-reject-errors': 'off', 'import-x/first': 'off' } } satisfies SharedFields
      const teamConfig = [buildTeamEslintBlockTurningOn('team', ['@typescript-eslint/prefer-promise-reject-errors', 'import/first'])]
      const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)

      expect(
        await severitiesOfEach(config, ['@typescript-eslint/prefer-promise-reject-errors', 'import/first'], ['src/a.ts']),
      ).toStrictEqual({ 'src/a.ts': { '@typescript-eslint/prefer-promise-reject-errors': 'error', 'import/first': 'error' } })
    },
  )

  // A typed rule of ours would run in TS files only, never in a consumer config file.
  it.each(PROJECTS)(
    "is the team's in a TS file, where our typed typescript-eslint rule would run, a JS file and a consumer config file, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = [buildTeamEslintBlockTurningOn('team', [CORE_TWIN_OF_THE_TYPED_EXTENSION])]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [TYPED_EXTENSION]: 'error' } }, teamConfig)

      expect(await severitiesOf(config, CORE_TWIN_OF_THE_TYPED_EXTENSION, ['src/a.ts', 'src/a.js', 'agents-inc.lint.mts'])).toStrictEqual({
        'src/a.ts': 'error',
        'src/a.js': 'error',
        'agents-inc.lint.mts': 'error',
      })
    },
  )

  // Beside a team that gives type information, our typed rules would run only where it does.
  it.each(PROJECTS)(
    "is the team's in the files the team gives types to, where our typed typescript-eslint rule would run, and elsewhere, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = [
        buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['src/**/*.ts'] }),
        buildTeamEslintBlockTurningOn('team', [CORE_TWIN_OF_THE_TYPED_EXTENSION]),
      ]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [TYPED_EXTENSION]: 'error' } }, teamConfig)

      expect(await severitiesOf(config, CORE_TWIN_OF_THE_TYPED_EXTENSION, ['src/a.ts', 'scripts/a.ts'])).toStrictEqual({
        'src/a.ts': 'error',
        'scripts/a.ts': 'error',
      })
    },
  )

  // no-unused-vars ships ignoring stories, config files and scripts folders, which oxlint keeps.
  it("is the team's where our oxlint part would run the core rule and in the files it ships ignoring, in a project whose package.json lists oxlint", async () => {
    const teamConfig = [buildTeamEslintBlockTurningOn('team', [TWIN_OF_NO_UNUSED_VARS])]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, { rules: { [NO_UNUSED_VARS]: 'error' } }, teamConfig)

    expect(await severitiesOf(config, TWIN_OF_NO_UNUSED_VARS, ['src/a.ts', 'scripts/a.ts', 'src/a.stories.tsx', 'vite.config.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'scripts/a.ts': 'error',
      'src/a.stories.tsx': 'error',
      'vite.config.ts': 'error',
    })
  })

  // Our ignores keep only ours out of their files, a folder named bare as much as a glob.
  it.each([
    { ignoresAre: 'a glob under the folder', ignores: LEGACY_FILES },
    { ignoresAre: 'the folder named bare', ignores: ['legacy'] },
  ])(
    "is the team's in the files our ignores match, where they are $ignoresAre, and where our oxlint part would run the core rule, in a project whose package.json lists oxlint",
    async ({ ignores }) => {
      const teamConfig = [buildTeamEslintBlockTurningOn('team', [TWIN_OF_NO_UNUSED_VARS])]
      const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, { rules: { [NO_UNUSED_VARS]: 'error' }, ignores }, teamConfig)

      expect(await severitiesOf(config, TWIN_OF_NO_UNUSED_VARS, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual({ 'legacy/a.ts': 'error', 'src/a.ts': 'error' })
    },
  )

  it("is the team's in the files of the entry whose rule our oxlint part would run, and elsewhere, in a project whose package.json lists oxlint", async () => {
    const teamConfig = [buildTeamEslintBlockTurningOn('team', [TWIN_OF_NO_UNUSED_VARS])]
    const fields = { fileOverrides: [{ files: LEGACY_FILES, rules: { [NO_UNUSED_VARS]: 'error' } }] } satisfies SharedFields
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)

    expect(await severitiesOf(config, TWIN_OF_NO_UNUSED_VARS, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual({
      'legacy/a.ts': 'error',
      'src/a.ts': 'error',
    })
  })
})

// antfu's eslint-config registers typescript-eslint under `ts`. Measured: in one install, the plugin it
// imports is the very object typescript-eslint exports as `plugin`; a team's install of another
// version holds another object, named as ours in its meta. Either way its `ts/` rules are ours.
describe('a plugin of ours, which the team registers under a prefix of its own', () => {
  const registrations = [
    { registers: 'the very object installed beside us', plugin: () => installedEslintPlugin(TYPESCRIPT_ESLINT_PREFIX) },
    {
      registers: 'another object named as ours in its meta, as another install of it is',
      plugin: () => buildFakePlugin(TEAM_TS_RULE_NAMES, { meta: { name: TYPESCRIPT_ESLINT_PLUGIN_NAME, version: TEAM_NEXT_PLUGIN_VERSION } }),
    },
  ]
  const cases = PROJECTS.flatMap((project) => registrations.map((registration) => ({ ...project, ...registration })))

  it.each(cases)(
    "is the team's in every file under its name for a rule our part states, ours not running, when it is $registers, in a project $project",
    async ({ projectDir, plugin }) => {
      const teamConfig = [
        buildTeamEslintBlock('team', { plugins: { [TEAM_TS_PREFIX]: plugin() }, rules: { [TEAM_TS_ARRAY_TYPE]: ['error', { default: 'generic' }] } }),
      ]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [ARRAY_TYPE]: 'error' } }, teamConfig)

      expect(await severitiesOfEach(config, [TEAM_TS_ARRAY_TYPE, ARRAY_TYPE], ['src/a.ts', 'src/a.js'])).toStrictEqual({
        'src/a.ts': { [TEAM_TS_ARRAY_TYPE]: 'error', [ARRAY_TYPE]: 'off' },
        'src/a.js': { [TEAM_TS_ARRAY_TYPE]: 'error', [ARRAY_TYPE]: 'off' },
      })
    },
  )

  it.each(PROJECTS)(
    "is the team's in every file under its name for a rule our top-level rules turn off, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = [
        buildTeamEslintBlock('team', {
          plugins: { [TEAM_TS_PREFIX]: installedEslintPlugin(TYPESCRIPT_ESLINT_PREFIX) },
          rules: { [TEAM_TS_ARRAY_TYPE]: ['error', { default: 'generic' }] },
        }),
      ]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [ARRAY_TYPE]: 'off' } }, teamConfig)

      expect(await severitiesOf(config, TEAM_TS_ARRAY_TYPE, ['src/a.ts', 'src/a.js'])).toStrictEqual({ 'src/a.ts': 'error', 'src/a.js': 'error' })
    },
  )

  it.each(cases)(
    "has its twin of a rule of ours the team's in the files where ours would run and elsewhere, when it is $registers, in a project $project",
    async ({ projectDir, plugin }) => {
      const teamConfig = [buildTeamEslintBlock('team', { plugins: { [TEAM_TS_PREFIX]: plugin() }, rules: { [TEAM_TS_TWIN]: 'error' } })]
      const fields = { fileOverrides: [{ files: LEGACY_FILES, rules: { 'prefer-promise-reject-errors': 'error' } }] } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)

      expect(await severitiesOf(config, TEAM_TS_TWIN, ['legacy/a.ts', 'src/a.ts'])).toStrictEqual({ 'legacy/a.ts': 'error', 'src/a.ts': 'error' })
    },
  )

  // oxlint runs no-explicit-any and no-loop-func for us beside it, ESLint without it; either way the
  // team's statements under its prefix decide them. no-loop-func's typescript-eslint name is another
  // name of the core rule.
  it.each(PROJECTS.map((project) => ({ ...project, severity: 'error' })))(
    "is the team's in every file under its name for a rule oxlint runs for us beside it, in a project $project",
    async ({ projectDir, severity }) => {
      const teamConfig = [
        buildTeamEslintBlock('team', {
          plugins: { [TEAM_TS_PREFIX]: installedEslintPlugin(TYPESCRIPT_ESLINT_PREFIX) },
          rules: Object.fromEntries(TEAM_TS_RULES_ONLY_OUR_OFF_SWITCH_STATES.map((ruleId) => [ruleId, 'error'])),
        }),
      ]
      const fields = { rules: { '@typescript-eslint/no-explicit-any': 'error', 'no-loop-func': 'error' } } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)

      expect(await severitiesOfEach(config, TEAM_TS_RULES_ONLY_OUR_OFF_SWITCH_STATES, ['src/a.ts'])).toStrictEqual({
        'src/a.ts': { 'ts/no-explicit-any': severity, 'ts/no-loop-func': severity },
      })
    },
  )

  it.each(PROJECTS)(
    "is the team's in every file under its name for a rule our part states, when it is another object named as ours at its top level, as a plugin written before meta is, in a project $project",
    async ({ projectDir }) => {
      const plugin = buildPluginNamedAtTopLevel(TEAM_TS_RULE_NAMES, { name: TYPESCRIPT_ESLINT_PLUGIN_NAME, version: TEAM_NEXT_PLUGIN_VERSION })
      const teamConfig = [buildTeamEslintBlock('team', { plugins: { [TEAM_TS_PREFIX]: plugin }, rules: { [TEAM_TS_ARRAY_TYPE]: 'error' } })]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [ARRAY_TYPE]: 'error' } }, teamConfig)

      expect(await severitiesOfEach(config, [TEAM_TS_ARRAY_TYPE, ARRAY_TYPE], ['src/a.ts'])).toStrictEqual({
        'src/a.ts': { [TEAM_TS_ARRAY_TYPE]: 'error', [ARRAY_TYPE]: 'off' },
      })
    },
  )

  it.each(PROJECTS)(
    'leaves a rule of that plugin as the team set it, though another plugin of ours has a rule of that name our part states, in a project $project',
    async ({ projectDir }) => {
      const teamConfig = [
        buildTeamEslintBlock('team', {
          plugins: { [TEAM_TS_PREFIX]: installedEslintPlugin(TYPESCRIPT_ESLINT_PREFIX) },
          rules: { [TEAM_TS_RULE_NAMED_AS_OUR_REGEXP_RULE]: 'error' },
        }),
      ]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_REGEXP_RULE]: 'error' } }, teamConfig)

      expect(await severitiesOf(config, TEAM_TS_RULE_NAMED_AS_OUR_REGEXP_RULE, ['src/a.ts'])).toStrictEqual({ 'src/a.ts': 'error' })
    },
  )

  // eslint-plugin-promise carries no name: the very object is recognised, and a plugin of the team's
  // own that carries none either is not taken for it.
  it.each(PROJECTS)(
    "is the team's in every file under its name for a rule our part states, when it is the very object installed beside us, which carries no name, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = [
        buildTeamEslintBlock('team', { plugins: { [TEAM_PROMISE_PREFIX]: installedEslintPlugin(PROMISE_PREFIX) }, rules: { [TEAM_PROMISE_RULE]: 'error' } }),
      ]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_PROMISE_RULE]: 'error' } }, teamConfig)

      expect(await severitiesOfEach(config, [TEAM_PROMISE_RULE, OUR_PROMISE_RULE], ['src/a.ts'])).toStrictEqual({
        'src/a.ts': { [TEAM_PROMISE_RULE]: 'error', [OUR_PROMISE_RULE]: 'off' },
      })
    },
  )

  it.each(PROJECTS)(
    "leaves a plugin of the team's own that carries no name as the team set it, though its rules are named as those of a plugin of ours that carries none, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = [
        buildTeamEslintBlock('team', {
          plugins: { [TEAM_LOCAL_PREFIX]: buildFakePlugin(['param-names']) },
          rules: { [TEAM_LOCAL_PROMISE_NAMED_RULE]: 'error' },
        }),
      ]
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_PROMISE_RULE]: 'error' } }, teamConfig)

      expect(await severitiesOf(config, TEAM_LOCAL_PROMISE_NAMED_RULE, ['src/a.ts'])).toStrictEqual({ 'src/a.ts': 'error' })
    },
  )

  // The allowed case beside it: a plugin that is not ours, though its rules are named as ours are.
  it.each(PROJECTS)(
    "leaves a different plugin's rules under that prefix as the team set them, though they are named as ours, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = [
        buildTeamEslintBlock('team', {
          plugins: { [TEAM_TS_PREFIX]: buildFakePlugin(TEAM_TS_RULE_NAMES, { meta: { name: TEAM_OWN_PLUGIN_NAME, version: TEAM_PLUGIN_VERSION } }) },
          rules: { [TEAM_TS_ARRAY_TYPE]: 'error', [TEAM_TS_TWIN]: 'error' },
        }),
      ]
      const fields = { rules: { [ARRAY_TYPE]: 'error', 'prefer-promise-reject-errors': 'error' } } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)

      expect(await severitiesOfEach(config, [TEAM_TS_ARRAY_TYPE, TEAM_TS_TWIN], ['src/a.ts'])).toStrictEqual({
        'src/a.ts': { [TEAM_TS_ARRAY_TYPE]: 'error', [TEAM_TS_TWIN]: 'error' },
      })
    },
  )
})

// antfu's eslint-config registers our @eslint-react plugin, the very object installed beside us, under
// `react`, which our blocks register for eslint-plugin-react (measured, antfu 9.5.1, @eslint-react
// 5.24.10). The team's `react/x` is then our `@eslint-react/x` and, by the literal key, our
// eslint-plugin-react `react/x`: both are the team's where it sets them.
describe('our @eslint-react plugin, which the team registers under react, the prefix our eslint-plugin-react rules take', () => {
  const registrations = [
    { registers: 'the very object installed beside us', plugin: () => installedEslintPlugin(ESLINT_REACT_PREFIX) },
    {
      registers: 'another object named as ours in its meta, as another install of it is',
      plugin: () => buildFakePlugin(ESLINT_REACT_RULE_NAMES, { meta: { name: ESLINT_REACT_PLUGIN_NAME, version: TEAM_NEXT_PLUGIN_VERSION } }),
    },
  ]
  const cases = PROJECTS.flatMap((project) => registrations.map((registration) => ({ ...project, ...registration })))
  const teamRegisteringOurs = (plugin: ESLint.Plugin, rules: Linter.RulesRecord): Linter.Config[] => [
    buildTeamEslintBlock('team', { plugins: { [REACT_PREFIX]: plugin }, rules }),
  ]

  it.each(cases)(
    "is the team's in every file under its name for an @eslint-react rule our part states, ours not running, when it is $registers, in a project $project",
    async ({ projectDir, plugin }) => {
      const teamConfig = teamRegisteringOurs(plugin(), { [TEAM_INNER_HTML]: 'error' })
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_INNER_HTML]: 'warn' } }, teamConfig)

      expect(await severitiesOfEach(config, [TEAM_INNER_HTML, OUR_INNER_HTML], ['src/a.tsx', 'src/a.ts'])).toStrictEqual({
        'src/a.tsx': { [TEAM_INNER_HTML]: 'error', [OUR_INNER_HTML]: 'off' },
        'src/a.ts': { [TEAM_INNER_HTML]: 'error', [OUR_INNER_HTML]: 'off' },
      })
    },
  )

  it.each(PROJECTS)("reports a finding of that rule once, under the team's name, in a project $project", async ({ projectDir }) => {
    const teamConfig = teamRegisteringOurs(installedEslintPlugin(ESLINT_REACT_PREFIX), { [TEAM_INNER_HTML]: 'error' })
    const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_INNER_HTML]: 'error' } }, teamConfig)

    expect(await ruleIdsReportedOn(config, innerHtmlSetDangerously, 'src/a.tsx')).toStrictEqual([TEAM_INNER_HTML])
  })

  it.each(PROJECTS)("is the team's in every file under its name for an @eslint-react rule our top-level rules turn off, in a project $project", async ({ projectDir }) => {
    const teamConfig = teamRegisteringOurs(installedEslintPlugin(ESLINT_REACT_PREFIX), { [TEAM_INNER_HTML]: 'error' })
    const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_INNER_HTML]: 'off' } }, teamConfig)

    expect(await severitiesOf(config, TEAM_INNER_HTML, ['src/a.tsx', 'src/a.ts'])).toStrictEqual({ 'src/a.tsx': 'error', 'src/a.ts': 'error' })
  })

  it.each(PROJECTS)(
    "keeps the team's own @eslint-react rule under react, which our part does not state, as the team set it, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = teamRegisteringOurs(installedEslintPlugin(ESLINT_REACT_PREFIX), { [TEAM_INNER_HTML]: 'error', [TEAM_BUTTON_TYPE]: 'error' })
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_INNER_HTML]: 'error' } }, teamConfig)

      expect(await severitiesOf(config, TEAM_BUTTON_TYPE, ['src/a.tsx'])).toStrictEqual({ 'src/a.tsx': 'error' })
      expect(await ruleIdsReportedOn(config, buttonWithoutAType, 'src/a.tsx')).toStrictEqual([TEAM_BUTTON_TYPE])
    },
  )

  it.each(PROJECTS)(
    "runs our eslint-plugin-react rule under react with our settings, beside the team's @eslint-react rules there, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = teamRegisteringOurs(installedEslintPlugin(ESLINT_REACT_PREFIX), { [TEAM_INNER_HTML]: 'error', [TEAM_BUTTON_TYPE]: 'error' })
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_INNER_HTML]: 'error', [CURLY_BRACE_PRESENCE]: 'warn' } }, teamConfig)

      expect(await severitiesOf(config, CURLY_BRACE_PRESENCE, ['src/a.tsx'])).toStrictEqual({ 'src/a.tsx': 'warn' })
      expect(await ruleIdsReportedOn(config, stringLiteralInBracesAsAProp, 'src/a.tsx')).toStrictEqual([CURLY_BRACE_PRESENCE])
    },
  )

  // The team's key under `react` names both of ours: the @eslint-react rule through the team's prefix,
  // and the eslint-plugin-react rule by the literal key. Both are the team's, and ours runs in neither engine.
  it.each(PROJECTS)(
    "is the team's for both our rules a key of the team's under react names, the eslint-plugin-react rule and the @eslint-react one, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = teamRegisteringOurs(installedEslintPlugin(ESLINT_REACT_PREFIX), { [COMMENT_TEXTNODES_UNDER_REACT]: 'error' })
      const fields = { rules: { [COMMENT_TEXTNODES_UNDER_REACT]: 'warn', [OUR_COMMENT_TEXTNODES]: 'warn' } } satisfies SharedFields
      const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)

      expect({
        severities: await severitiesOfEach(config, [COMMENT_TEXTNODES_UNDER_REACT, OUR_COMMENT_TEXTNODES], ['src/a.tsx']),
        reported: await ruleIdsReportedOn(config, commentAsJsxText, 'src/a.tsx'),
      }).toStrictEqual({
        severities: { 'src/a.tsx': { [COMMENT_TEXTNODES_UNDER_REACT]: 'error', [OUR_COMMENT_TEXTNODES]: 'off' } },
        reported: [COMMENT_TEXTNODES_UNDER_REACT],
      })
    },
  )

  // The mirror of antfu's registration: our eslint-plugin-react under @eslint-react, where the team sets
  // no rule. Our oxlint part runs eslint-plugin-react's jsx-no-comment-textnodes, whose name under that
  // prefix is @eslint-react's rule our blocks state: it stays ours.
  it("keeps running our @eslint-react rule whose name under @eslint-react is that of an eslint-plugin-react rule our oxlint part runs, where the team registers eslint-plugin-react there, in a project whose package.json lists oxlint", async () => {
    const teamConfig = [buildTeamEslintBlock('team', { plugins: { [ESLINT_REACT_PREFIX]: ourRegisteredPlugin(REACT_PREFIX) } })]
    const fields = { rules: { [COMMENT_TEXTNODES_UNDER_REACT]: 'warn', [OUR_COMMENT_TEXTNODES]: 'warn' } } satisfies SharedFields
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)

    expect({
      oxlintsRuleInEslint: entryIn(await entriesOf(config, COMMENT_TEXTNODES_UNDER_REACT, ['src/a.tsx']), 'src/a.tsx'),
      ourEslintReactRule: (await severitiesOf(config, OUR_COMMENT_TEXTNODES, ['src/a.tsx']))['src/a.tsx'],
    }).toStrictEqual({ oxlintsRuleInEslint: ABSENT, ourEslintReactRule: 'warn' })
  })

  it.each(PROJECTS)(
    "is the team's under its name for an @eslint-react rule our part states whose name eslint-plugin-react has too, reporting the finding once under its name, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = teamRegisteringOurs(installedEslintPlugin(ESLINT_REACT_PREFIX), { [COMMENT_TEXTNODES_UNDER_REACT]: 'error' })
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_COMMENT_TEXTNODES]: 'warn' } }, teamConfig)

      expect(await severitiesOf(config, COMMENT_TEXTNODES_UNDER_REACT, ['src/a.tsx'])).toStrictEqual({ 'src/a.tsx': 'error' })
      expect(await ruleIdsReportedOn(config, commentAsJsxText, 'src/a.tsx')).toStrictEqual([COMMENT_TEXTNODES_UNDER_REACT])
    },
  )

  // @eslint-react binds x-no-missing-key and no-missing-key to one module, so under `react` the team's
  // react/no-missing-key is our rule. Which names are one rule is read from the plugin we install.
  const registrationsNamingBoth = [
    { registers: 'the very object installed beside us', plugin: () => installedEslintPlugin(ESLINT_REACT_PREFIX) },
    {
      registers: 'another object named as ours in its meta, as another install of it is',
      plugin: () => buildFakePlugin(MISSING_KEY_RULE_NAMES, { meta: { name: ESLINT_REACT_PLUGIN_NAME, version: TEAM_NEXT_PLUGIN_VERSION } }),
    },
  ]
  const casesNamingBoth = PROJECTS.flatMap((project) => registrationsNamingBoth.map((registration) => ({ ...project, ...registration })))

  it.each(casesNamingBoth)(
    "is the team's in every file under its name for the other name of an @eslint-react rule our part states, when it is $registers, in a project $project",
    async ({ projectDir, plugin }) => {
      const teamConfig = teamRegisteringOurs(plugin(), { [MISSING_KEY_UNDER_REACT]: 'error' })
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_MISSING_KEY]: 'error' } }, teamConfig)

      expect(await severitiesOf(config, MISSING_KEY_UNDER_REACT, ['src/a.tsx', 'src/a.ts'])).toStrictEqual({ 'src/a.tsx': 'error', 'src/a.ts': 'error' })
    },
  )

  it.each(PROJECTS)("reports a finding of that rule once, under the team's name, where the team names its other name under react, in a project $project", async ({ projectDir }) => {
    const teamConfig = teamRegisteringOurs(installedEslintPlugin(ESLINT_REACT_PREFIX), { [MISSING_KEY_UNDER_REACT]: 'error' })
    const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_MISSING_KEY]: 'error' } }, teamConfig)

    expect(await ruleIdsReportedOn(config, listItemWithoutAKey, 'src/a.tsx')).toStrictEqual([MISSING_KEY_UNDER_REACT])
  })

  it.each(PROJECTS)(
    "is the team's in every file under its name for the other name of an @eslint-react rule our top-level rules turn off, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = teamRegisteringOurs(installedEslintPlugin(ESLINT_REACT_PREFIX), { [MISSING_KEY_UNDER_REACT]: 'error' })
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_MISSING_KEY]: 'off' } }, teamConfig)

      expect(await severitiesOf(config, MISSING_KEY_UNDER_REACT, ['src/a.tsx', 'src/a.ts'])).toStrictEqual({ 'src/a.tsx': 'error', 'src/a.ts': 'error' })
    },
  )

  // The allowed case beside it: under `react` the team registers eslint-plugin-react, whose rule of that
  // name is another rule, so it stays the team's.
  it.each(PROJECTS)(
    "leaves eslint-plugin-react's rule of that name as the team set it, where the team registers eslint-plugin-react under react, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = teamRegisteringOurs(installedEslintPlugin(REACT_PREFIX), { [COMMENT_TEXTNODES_UNDER_REACT]: 'error' })
      const config = mergedEditorEslintConfig(projectDir, { rules: { [OUR_COMMENT_TEXTNODES]: 'warn' } }, teamConfig)

      expect(await severitiesOf(config, COMMENT_TEXTNODES_UNDER_REACT, ['src/a.tsx'])).toStrictEqual({ 'src/a.tsx': 'error' })
      expect((await ruleIdsReportedOn(config, commentAsJsxText, 'src/a.tsx')).toSorted()).toStrictEqual([
        OUR_COMMENT_TEXTNODES,
        COMMENT_TEXTNODES_UNDER_REACT,
      ])
    },
  )
})

// ESLint itself throws on this once both blocks apply to one file.
describe('a team config registering under one prefix', () => {
  it('two different objects is refused, the error naming the prefix', () => {
    const teamConfig = [
      buildTeamEslintBlock('team-a', { plugins: { unicorn: buildFakePlugin(['team-only']) } }),
      buildTeamEslintBlock('team-b', { plugins: { unicorn: buildFakePlugin(['team-only']) } }),
    ]

    expect(() => mergedEditorEslintConfig(PROJECT_WITH_OXLINT, {}, teamConfig)).toThrowError(/unicorn/u)
  })

  it('one object in two blocks is accepted', () => {
    const teamUnicorn = buildFakePlugin(['team-only'])
    const teamConfig = [
      buildTeamEslintBlock('team-a', { plugins: { unicorn: teamUnicorn } }),
      buildTeamEslintBlock('team-b', { plugins: { unicorn: teamUnicorn } }),
    ]

    expect(() => mergedEditorEslintConfig(PROJECT_WITH_OXLINT, {}, teamConfig)).not.toThrow()
  })
})

describe('the team config, in any shape defineConfig takes', () => {
  const teamBlock = buildTeamEslintBlock('team', { rules: { 'no-console': ['warn'] } })

  it.each([
    { shape: 'one object', teamConfig: teamBlock },
    { shape: 'an array', teamConfig: [teamBlock] },
    { shape: 'nested arrays', teamConfig: [[teamBlock], []] },
    { shape: 'one block extending another', teamConfig: buildTeamEslintConfigExtending('team', [teamBlock]) },
  ])('keeps its own rules when it is $shape', async ({ teamConfig }) => {
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, { rules: { [ARRAY_TYPE]: 'error' } }, teamConfig)

    expect(await severitiesOf(config, 'no-console', ['src/a.ts'])).toStrictEqual({ 'src/a.ts': 'warn' })
  })

  it("keeps its setting of our rule IDs in a config it extends: the team's off decides them", async () => {
    const extended = buildTeamEslintBlock('team-base', {
      plugins: { '@typescript-eslint': buildFakePlugin(['array-type']) },
      rules: { [ARRAY_TYPE]: 'off' },
    })
    const config = mergedEditorEslintConfig(
      PROJECT_WITH_OXLINT,
      { rules: { [ARRAY_TYPE]: 'error' } },
      buildTeamEslintConfigExtending('team', [extended]),
    )

    expect(await ruleIdsReportedOn(config, genericArrayOfASimpleType, 'src/a.ts')).toStrictEqual([])
  })
})

// Ours first, then the team's blocks as defineConfig returns them, then only the off of
// typescript-eslint's extensions our part runs where oxlint runs their core rule. Our ignores go on
// our own blocks, so the team's rules still run in the files they match.
describe('the merged blocks', () => {
  const teamConfig = [buildTeamEslintBlock('team-first'), buildTeamEslintBlock('team-second')]
  const fields = {
    ignores: ['dist/**'],
    rules: { 'max-lines': 'error', 'no-debugger': 'error' },
    fileOverrides: [{ files: ['legacy/**'], rules: { 'max-lines': 'off' } }],
  } satisfies SharedFields

  // Beside oxlint, nothing turns the team's copies off after its blocks: only typescript-eslint's
  // extensions our part runs ever follow them, and these rules hold none.
  it.each(PROJECTS.map((project) => ({ ...project, afterTheTeams: [] })))(
    "are ours, starting with the base block, then the team's in its order, and nothing after them, and no global ignores, in a project $project",
    ({ projectDir, afterTheTeams }) => {
      const names = mergedEditorEslintConfig(projectDir, fields, teamConfig).map((block) => block.name)
      const teamsFirst = names.indexOf('team-first')

      expect({
        first: names[0],
        notOursBeforeTheTeams: names.slice(0, teamsFirst).filter((name) => name?.startsWith('agents-inc/') !== true),
        theTeams: names.slice(teamsFirst, teamsFirst + teamConfig.length),
        afterTheTeams: names.slice(teamsFirst + teamConfig.length),
        globalIgnores: names.filter((name) => name === 'agents-inc/ignores'),
      }).toStrictEqual({
        first: 'agents-inc/base',
        notOursBeforeTheTeams: [],
        theTeams: ['team-first', 'team-second'],
        afterTheTeams,
        globalIgnores: [],
      })
    },
  )

  // Our off removes only ours, so no other ESLint name of a rule ESLint runs for us is stated off.
  it('hold no block turning off the other ESLint names of our rules, and end with the team\'s, in a project whose package.json lists no oxlint', () => {
    const names = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, { rules: { 'import-x/first': 'error' } }, teamConfig).map((block) => block.name)

    expect({ last: names.at(-1), aliasesOff: names.filter((name) => name === 'agents-inc/aliases-off') }).toStrictEqual({
      last: 'team-second',
      aliasesOff: [],
    })
  })
})

// ESLint applies its default ignores before any block, so where the team takes nothing back our blocks
// keep the names they have outside a merge; a rule moves into a numbered copy only where our own
// ignores keep it out of some files.
describe("our blocks, beside a team config that takes nothing back from ESLint's default ignores", () => {
  // Four rules of ours: no-var and array-type in the base block, a typed rule in the typed block, and
  // no-debugger, which our oxlint part runs where the project lists oxlint, and our base block elsewhere.
  const rules = { 'no-var': 'error', [NO_DEBUGGER]: 'error', [ARRAY_TYPE]: 'error', [FLOATING_PROMISES]: 'error' } satisfies SharedFields['rules']
  const noVarOffInLegacy = { files: LEGACY_FILES, rules: { 'no-var': 'off' } } satisfies NonNullable<SharedFields['fileOverrides']>[number]
  const teamBlockStatingNoneOfOurs = buildTeamEslintBlock('team', { rules: { 'no-console': 'error' } })
  // Our base, Svelte runes and typed blocks under their own names, where no entry of ours, no ignores of ours and no team block moves a rule.
  const ourBlocksUnmovedBesideOxlint: readonly OurBlockStating[] = [
    { name: 'agents-inc/base', states: [ARRAY_TYPE, 'no-var'] },
    { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
    { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
    { name: 'agents-inc/typed', states: [FLOATING_PROMISES] },
  ]
  const ourBlocksUnmovedWithoutOxlint: readonly OurBlockStating[] = [
    { name: 'agents-inc/base', states: [ARRAY_TYPE, NO_DEBUGGER, 'no-var'] },
    { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
    { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
    { name: 'agents-inc/typed', states: [FLOATING_PROMISES] },
  ]
  const shapes: readonly BlockNamesShape[] = [
    {
      how: 'the team gives global ignores of its own and a block stating none of our rules, and an entry of ours turns no-var off in legacy/**',
      fields: { rules, fileOverrides: [noVarOffInLegacy] },
      teamConfig: [buildTeamEslintBlock('team/global-ignores', { ignores: ['dist/'] }), teamBlockStatingNoneOfOurs],
      owedBesideOxlint: [
        { name: 'agents-inc/base', states: [ARRAY_TYPE, 'no-var'] },
        { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
        { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
        { name: 'agents-inc/typed', states: [FLOATING_PROMISES] },
        { name: 'agents-inc/file-overrides/0', states: ['no-var'] },
      ],
      owedWithoutOxlint: [
        { name: 'agents-inc/base', states: [ARRAY_TYPE, NO_DEBUGGER, 'no-var'] },
        { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
        { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
        { name: 'agents-inc/typed', states: [FLOATING_PROMISES] },
        { name: 'agents-inc/file-overrides/0', states: ['no-var'] },
      ],
    },
    // The team's setting makes array-type the team's in every file, so no block of ours states it.
    {
      how: 'a team block turns array-type off in scripts/**, which leaves our base block without it',
      fields: { rules },
      teamConfig: [buildTeamEslintBlock('team', { files: SCRIPT_FILES, rules: { [ARRAY_TYPE]: 'off' } })],
      owedBesideOxlint: [
        { name: 'agents-inc/base', states: ['no-var'] },
        { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
        { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
        { name: 'agents-inc/typed', states: [FLOATING_PROMISES] },
      ],
      owedWithoutOxlint: [
        { name: 'agents-inc/base', states: [NO_DEBUGGER, 'no-var'] },
        { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
        { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
        { name: 'agents-inc/typed', states: [FLOATING_PROMISES] },
      ],
    },
    {
      how: 'our ignores name dist/**, which every rule of ours moves out of, into a copy of its block',
      fields: { rules, fileOverrides: [noVarOffInLegacy], ignores: ['dist/**'] },
      teamConfig: [teamBlockStatingNoneOfOurs],
      owedBesideOxlint: [
        { name: 'agents-inc/base', states: [] },
        { name: 'agents-inc/base/confined/0', states: [ARRAY_TYPE, 'no-var'] },
        { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
        { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
        { name: 'agents-inc/typed', states: [] },
        { name: 'agents-inc/typed/confined/0', states: [FLOATING_PROMISES] },
        { name: 'agents-inc/file-overrides/0/confined/0', states: ['no-var'] },
      ],
      owedWithoutOxlint: [
        { name: 'agents-inc/base', states: [] },
        { name: 'agents-inc/base/confined/0', states: [ARRAY_TYPE, NO_DEBUGGER, 'no-var'] },
        { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
        { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
        { name: 'agents-inc/typed', states: [] },
        { name: 'agents-inc/typed/confined/0', states: [FLOATING_PROMISES] },
        { name: 'agents-inc/file-overrides/0/confined/0', states: ['no-var'] },
      ],
    },
    // Three more team configs taking nothing back, each read as taking files back if one "and", "or",
    // "some" or "every" in the merge were swapped: global ignores from a basePath outside the project with
    // no negated glob; a negated glob taking back no file a default leaves out; and a negated glob in a
    // block holding more than ignores, which ESLint reads as no global ignores.
    {
      how: "the team's global ignores, read from a basePath outside the project, its parent, leave dist/ out and take nothing back",
      fields: { rules },
      teamConfig: [buildTeamEslintBlock('team/global-ignores', { basePath: '..', ignores: ['dist/'] }), teamBlockStatingNoneOfOurs],
      owedBesideOxlint: ourBlocksUnmovedBesideOxlint,
      owedWithoutOxlint: ourBlocksUnmovedWithoutOxlint,
    },
    // Read from the project's parent, as ESLint reads it, the negated glob takes back only a sibling
    // folder's node_modules.
    {
      how: "the team's global ignores, read from a basePath outside the project, its parent, leave dist/ out and take back a sibling folder's node_modules alone",
      fields: { rules },
      teamConfig: [buildTeamEslintBlock('team/global-ignores', { basePath: '..', ignores: ['dist/', '!sibling/node_modules/'] }), teamBlockStatingNoneOfOurs],
      owedBesideOxlint: ourBlocksUnmovedBesideOxlint,
      owedWithoutOxlint: ourBlocksUnmovedWithoutOxlint,
    },
    {
      how: "the team's global ignores leave lib/** out and take lib/a.ts back, which no default ignore leaves out",
      fields: { rules },
      teamConfig: [buildTeamEslintBlock('team/global-ignores', { ignores: ['lib/**', '!lib/a.ts'] }), teamBlockStatingNoneOfOurs],
      owedBesideOxlint: ourBlocksUnmovedBesideOxlint,
      owedWithoutOxlint: ourBlocksUnmovedWithoutOxlint,
    },
    {
      how: 'a team block stating no-console in src/** takes every node_modules folder back in its own ignores, which are no global ignores',
      fields: { rules },
      teamConfig: [buildTeamEslintBlock('team', { files: ['src/**'], ignores: ['!**/node_modules/'], rules: { 'no-console': 'error' } })],
      owedBesideOxlint: ourBlocksUnmovedBesideOxlint,
      owedWithoutOxlint: ourBlocksUnmovedWithoutOxlint,
    },
  ]
  const cases = shapes.flatMap(({ owedBesideOxlint, owedWithoutOxlint, ...shape }) => [
    { ...shape, project: 'whose package.json lists oxlint', projectDir: PROJECT_WITH_OXLINT, owed: owedBesideOxlint },
    { ...shape, project: 'whose package.json lists no oxlint', projectDir: PROJECT_WITHOUT_OXLINT, owed: owedWithoutOxlint },
  ])

  // Each case's name in full in its title, which it.each's $-interpolation would cut short.
  cases.forEach(({ how, project, projectDir, fields, teamConfig, owed }) => {
    it(`keep the names they have outside a merge, each stating the rules owed, where ${how}, in a project ${project}`, () => {
      const merged = mergedEditorEslintConfig(projectDir, fields, teamConfig)
      const theTeamsFirst = merged.findIndex(({ name }) => name?.startsWith('agents-inc/') !== true)
      if (theTeamsFirst === -1) throw new Error("the merged config holds none of the team's blocks")

      expect(
        merged.slice(0, theTeamsFirst).map(({ name, rules: stated = {} }) => ({
          name,
          states: Object.keys(stated).filter((ruleId) => ruleId in rules).toSorted(),
        })),
      ).toStrictEqual(owed)
    })
  })
})

// Our blocks are still split here, each rule moving into a copy kept out of the files our part never
// lints: ignores on the base block would also stop our parser and plugins there.
describe("our blocks, beside a team config whose global ignores take every node_modules folder back from ESLint's default ignores", () => {
  const rules = { 'no-var': 'error', [NO_DEBUGGER]: 'error', [ARRAY_TYPE]: 'error', [FLOATING_PROMISES]: 'error' } satisfies SharedFields['rules']
  const takingNodeModulesBack = [
    { how: 'from the project root', globalIgnores: buildTeamEslintBlock('team/global-ignores', { ignores: ['!**/node_modules/'] }) },
    {
      how: 'from a basePath outside the project, its parent, after leaving dist/ out',
      globalIgnores: buildTeamEslintBlock('team/global-ignores', { basePath: '..', ignores: ['dist/', '!**/node_modules/'] }),
    },
  ]
  const cases = takingNodeModulesBack.flatMap(({ how, globalIgnores }) => [
    {
      how,
      globalIgnores,
      project: 'whose package.json lists oxlint',
      projectDir: PROJECT_WITH_OXLINT,
      owed: [
        { name: 'agents-inc/base', states: [] },
        { name: 'agents-inc/base/confined/0', states: [ARRAY_TYPE, 'no-var'] },
        { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
        { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
        { name: 'agents-inc/typed', states: [] },
        { name: 'agents-inc/typed/confined/0', states: [FLOATING_PROMISES] },
      ],
    },
    {
      how,
      globalIgnores,
      project: 'whose package.json lists no oxlint',
      projectDir: PROJECT_WITHOUT_OXLINT,
      owed: [
        { name: 'agents-inc/base', states: [] },
        { name: 'agents-inc/base/confined/0', states: [ARRAY_TYPE, NO_DEBUGGER, 'no-var'] },
        { name: SVELTE_RUNES_ESLINT_BLOCK_NAME, states: [] },
        { name: TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, states: [] },
        { name: 'agents-inc/typed', states: [] },
        { name: 'agents-inc/typed/confined/0', states: [FLOATING_PROMISES] },
      ],
    },
  ])

  // Each case's name in full in its title, which it.each's $-interpolation would cut short.
  cases.forEach(({ how, globalIgnores, project, projectDir, owed }) => {
    it(`move each rule into a copy of its block, where the team takes them back ${how}, in a project ${project}`, () => {
      const merged = mergedEditorEslintConfig(projectDir, { rules }, [globalIgnores])
      const theTeamsFirst = merged.findIndex(({ name }) => name?.startsWith('agents-inc/') !== true)
      if (theTeamsFirst === -1) throw new Error("the merged config holds none of the team's blocks")

      expect(
        merged.slice(0, theTeamsFirst).map(({ name, rules: stated = {} }) => ({
          name,
          states: Object.keys(stated).filter((ruleId) => ruleId in rules).toSorted(),
        })),
      ).toStrictEqual(owed)
    })
  })
})

// The team's blocks are defineConfig's own, in order, no rule entry deleted: only each plugin object is
// swapped for the one shared under its prefix, which ESLint needs.
describe("the team's blocks in the merged config", () => {
  const teamConfig: TeamEslintConfig = [
    buildTeamEslintBlock('team-a', {
      files: ['src/**'],
      ignores: ['src/vendor/**'],
      plugins: { [TYPESCRIPT_ESLINT_PREFIX]: buildFakePlugin(['array-type']), [TEAM_LOCAL_PREFIX]: buildFakePlugin(['team-only']) },
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: false } } },
      settings: { team: { setting: true } },
      rules: { [ARRAY_TYPE]: ['error', { default: 'generic' }], 'local/team-only': 'warn' },
    }),
    buildTeamEslintConfigExtending('team-b', [
      buildTeamEslintBlock('team-b-base', { files: LEGACY_FILES, rules: { 'max-lines': 'off', [OUR_CORE_RULE_WITH_A_TWIN]: 'error' } }),
    ]),
    // defineConfig refuses a basePath in a config another extends.
    buildTeamEslintBlock('team-c', { basePath: 'legacy', rules: { [ARRAY_TYPE]: 'off' } }),
  ]
  const fields = { rules: { [ARRAY_TYPE]: 'error', 'max-lines': 'error', [OUR_CORE_RULE_WITH_A_TWIN]: 'error' } } satisfies SharedFields

  it.each(PROJECTS)(
    "are defineConfig's own, in its order, every rule entry kept, each plugin object the one our base block registers under its prefix, and the team's own elsewhere, in a project $project",
    ({ projectDir }) => {
      const merged = mergedEditorEslintConfig(projectDir, fields, teamConfig)
      const theTeams = merged.filter(({ name }) => name?.startsWith('agents-inc/') !== true)
      const ourBase = blockNamed(merged, 'agents-inc/base')

      expect({
        blocks: theTeams.map(withPluginPrefixesOnly),
        plugins: theTeams.flatMap(({ plugins = {} }) => Object.entries(plugins).map(([prefix, plugin]) => [prefix, whosePlugin(plugin, prefix, ourBase)])),
      }).toStrictEqual({
        blocks: defineConfig(teamConfig).map(withPluginPrefixesOnly),
        plugins: [
          [TYPESCRIPT_ESLINT_PREFIX, 'the one our base block registers'],
          [TEAM_LOCAL_PREFIX, "the team's own"],
        ],
      })
    },
  )
})

// Every reading of a team block's files and ignores under a basePath outside the project reads them
// from that path, as ESLint does. ESLint's own calculated config for the team's block alone is the oracle.
describe('a team block giving types whose basePath lies outside the project', () => {
  const PROJECT_FOLDER = basename(PROJECT_WITH_OXLINT)
  const FILES_READ = ['src/a.ts', 'src/legacy/a.ts', 'src/legacy/keep/a.ts', 'scripts/b.ts']
  const EVERY_TS_FILE = ['**/*.ts']
  // An absolute basePath here lies in the test file's temp dir, whose name changes every run, so the
  // title names each basePath by `basePathNamed`: Stryker picks a mutant's tests by the titles of an earlier run.
  const blocks: readonly { readonly basePath: string; readonly basePathNamed: string; readonly files: readonly string[]; readonly ignores?: readonly string[] }[] = [
    { basePath: '..', basePathNamed: '..', files: EVERY_TS_FILE },
    { basePath: '../elsewhere', basePathNamed: '../elsewhere', files: EVERY_TS_FILE },
    { basePath: dirname(PROJECT_WITH_OXLINT), basePathNamed: "the project's parent", files: EVERY_TS_FILE },
    { basePath: join(tmpdir(), 'lint-rules-a-folder-outside-every-project'), basePathNamed: 'a folder outside every project', files: EVERY_TS_FILE },
    { basePath: '..', basePathNamed: '..', files: [`${PROJECT_FOLDER}/src/**`] },
    { basePath: '..', basePathNamed: '..', files: ['*/src/**'] },
    { basePath: '..', basePathNamed: '..', files: ['sibling/**'] },
    { basePath: '..', basePathNamed: '..', files: EVERY_TS_FILE, ignores: ['**/legacy/**', '!**/legacy/keep/**'] },
  ]

  // ESLint lints a file only where a block's files match it by a glob not ending in `/**`: our base
  // block does for every TS file, so the oracle reads the team's block beside one that does the same.
  const BLOCK_LINTING_EVERY_TS_FILE: Linter.Config = { name: 'oracle/every-ts-file', files: EVERY_TS_FILE }

  /** Where ESLint, run from the project, gives types from the team's config, every TS file linted: error where it does, off where not. */
  async function typedByTheTeamAlone(teamConfig: Linter.Config[]): Promise<Record<string, string>> {
    const typed = await Promise.all(
      FILES_READ.map(async (file): Promise<[string, string]> => {
        const calculated = await calculatedConfigInProjectFor(PROJECT_WITH_OXLINT, [BLOCK_LINTING_EVERY_TS_FILE, ...teamConfig], file)
        const parserOptions: unknown = calculated === undefined || calculated.languageOptions === undefined ? undefined : calculated.languageOptions['parserOptions']
        return [file, isRecord(parserOptions) && parserOptions['projectService'] === true ? 'error' : 'off']
      }),
    )
    return Object.fromEntries(typed)
  }

  async function ourTypedRuleIn(config: Linter.Config[]): Promise<Record<string, string>> {
    const severities = await Promise.all(
      FILES_READ.map(async (file): Promise<[string, string]> => [file, (await ruleSeverityInProjectFor(PROJECT_WITH_OXLINT, config, file, FLOATING_PROMISES)) ?? 'off']),
    )
    return Object.fromEntries(severities)
  }

  it.each(blocks)('runs our typed rule where ESLint gives types from it: basePath $basePathNamed, files $files, ignores $ignores', async ({ basePath, files, ignores = [] }) => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath, files: [...files], ignores: [...ignores] })]

    expect(await ourTypedRuleIn(mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig))).toStrictEqual(await typedByTheTeamAlone(teamConfig))
  })

  // The oracle reads the project's files as types given somewhere: a case reaching none would make
  // every expectation off, which an off-everywhere merge passes too.
  it("gives each file read types where the block names its parent's every TS file, in ESLint's own reading", async () => {
    expect(await typedByTheTeamAlone([buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: '..', files: EVERY_TS_FILE })])).toStrictEqual({
      'src/a.ts': 'error',
      'src/legacy/a.ts': 'error',
      'src/legacy/keep/a.ts': 'error',
      'scripts/b.ts': 'error',
    })
  })
})

// The same reading for the team's settings: an import-x resolver set from the project's parent is the
// team's in the files it reaches, so ours leaves them.
describe('a team block setting an import-x resolver whose basePath lies outside the project', () => {
  const resolverSetting = { 'import-x/resolver': { node: { extensions: ['.ts', '.js'] } } }

  async function resolverKeyReadIn(teamConfig: Linter.Config[], file: string): Promise<string> {
    const merged = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, { rules: { 'import-x/named': 'error' } }, teamConfig)
    const calculated = await calculatedConfigInProjectFor(PROJECT_WITH_OXLINT, merged, file)
    if (calculated === undefined) throw new Error(`ESLint does not lint ${file}`)
    return resolversImportXReads(calculated.settings).key
  }

  it("is the team's where it reaches the file from the project's parent, and ours where it reaches a sibling folder alone", async () => {
    expect({
      fromTheParent: await resolverKeyReadIn([buildTeamEslintBlock('team/resolver', { basePath: '..', files: ['**/*.ts'], settings: resolverSetting })], 'src/a.ts'),
      fromASibling: await resolverKeyReadIn([buildTeamEslintBlock('team/resolver', { basePath: '../elsewhere', files: ['**/*.ts'], settings: resolverSetting })], 'src/a.ts'),
    }).toStrictEqual({ fromTheParent: 'import-x/resolver', fromASibling: 'import-x/resolver-next' })
  })
})

// The team's language options, settings and linter options stand, key by key, in the files of the team
// block setting them; ours apply elsewhere. The probed global is a Svelte rune, ours in every rune
// module, as beside oxlint our runtime globals are nowhere in ESLint.
describe("the team's language options, settings and linter options", () => {
  const teamParser = buildTeamParser('team-parser')
  const teamConfig = [
    buildTeamEslintBlock('team', {
      files: LEGACY_FILES,
      languageOptions: { parser: teamParser, parserOptions: { ecmaFeatures: { jsx: false } }, globals: { $state: 'off' } },
      settings: { react: { version: '18.3' } },
    }),
  ]

  it.each(PROJECTS)(
    "stand in the team block's files, and ours elsewhere: the parser, a parser option, a global and a setting, in a project $project",
    async ({ projectDir }) => {
      const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, { editorRulesets: { runtimes: ['browser'] } })).editorRulesets
      const config = mergedBesideATeamOxlintConfigSettingNoRule(teamConfig, eslint)

      expect({
        inTheTeamsFiles: await languageOptionsAndSettingsIn(config, 'legacy/a.svelte.ts'),
        elsewhere: await languageOptionsAndSettingsIn(config, 'src/a.svelte.ts'),
      }).toStrictEqual({
        inTheTeamsFiles: { parser: 'team-parser', jsx: false, $state: 'off', reactVersion: '18.3' },
        elsewhere: { parser: TYPESCRIPT_ESLINT_PARSER_NAME, jsx: true, $state: false, reactVersion: '18.3.0' },
      })
    },
  )

  // Beside oxlint ours turns unused disable directives off, as each engine flags the other's
  // suppressions; without it ours leaves ESLint's own warn.
  it.each([
    { project: 'whose package.json lists oxlint', projectDir: PROJECT_WITH_OXLINT, oursElsewhere: OFF },
    { project: 'whose package.json lists no oxlint', projectDir: PROJECT_WITHOUT_OXLINT, oursElsewhere: WARN },
  ])(
    "stand in the team block's files, and ours elsewhere: reporting unused disable directives and reading no inline config, in a project $project",
    async ({ projectDir, oursElsewhere }) => {
      const teamLinterOptions = [
        buildTeamEslintBlock('team', { files: LEGACY_FILES, linterOptions: { reportUnusedDisableDirectives: 'error', noInlineConfig: true } }),
      ]
      const config = mergedEditorEslintConfig(projectDir, {}, teamLinterOptions)

      expect({ inTheTeamsFiles: await linterOptionsFor(config, 'legacy/a.ts'), elsewhere: await linterOptionsFor(config, 'src/a.ts') }).toStrictEqual({
        inTheTeamsFiles: { reportUnusedDisableDirectives: ERROR, noInlineConfig: true },
        elsewhere: { reportUnusedDisableDirectives: oursElsewhere },
      })
    },
  )
})

// ESLint 10.12 accepts a function in a block's files or ignores, though its types do not, and no glob
// of ours can match exactly the files one matches.
describe('a team block whose files are a function', () => {
  const projectDir = tempProjects.create({ files: { [TEAM_CONFIG_MODULE]: teamBlockWithFunctionFiles } })
  const fields = { rules: { 'max-lines': 'error' } } satisfies SharedFields
  let entries: { readonly merged: EntriesByFile; readonly owed: EntriesByFile; readonly teamAlone: EntriesByFile } | undefined

  // Made before the test, so only the assertion can fail inside it.fails.
  beforeAll(async () => {
    const teamConfig = await importedTeamConfig(projectDir, TEAM_CONFIG_MODULE)
    const merged = await entriesOf(mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, fields, teamConfig), 'max-lines', A1_FILES)
    const teamAlone = await teamAloneEntriesOf(teamConfig, 'max-lines', A1_FILES)
    const oursAlone = await entriesOf(mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, fields, []), 'max-lines', A1_FILES)
    entries = { merged, owed: { 'legacy/a.tsx': entryIn(teamAlone, 'legacy/a.tsx'), 'src/a.tsx': entryIn(oursAlone, 'src/a.tsx') }, teamAlone }
  })

  // KNOWN GAP: the team's bare warn keeps the options of any block of ours left in the function's files,
  // and leaving ours out of every file loses it where the team does not set the rule.
  it.fails("is the team's in the files the function matches, options included, and ours elsewhere", () => {
    if (entries === undefined) throw new Error('the run was not made before the test')

    expect(entries.merged).toStrictEqual(entries.owed)
  })

  // KNOWN GAP: of the two ways to fall short above, the merge keeps our options out of the team's: ours
  // stays out of every file the function might match. Pinned, so a change of choice is made on purpose.
  it("leaves ours out of every file the function might match: the team's entry where it matches, and none where it does not", () => {
    if (entries === undefined) throw new Error('the run was not made before the test')

    expect(entries.merged).toStrictEqual({ 'legacy/a.tsx': entryIn(entries.teamAlone, 'legacy/a.tsx'), 'src/a.tsx': ABSENT })
  })

  it('puts no function in the files or ignores of any block of ours', async () => {
    const teamConfig = await importedTeamConfig(projectDir, TEAM_CONFIG_MODULE)
    const ours = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, fields, teamConfig).filter(({ name }) => name?.startsWith('agents-inc/') === true)

    expect(pathsOfFunctionsIn(ours.map(({ files, ignores }) => ({ files, ignores })))).toStrictEqual([])
  })
})

// ESLint 10.12 takes a function in a block's ignores too (measured), which no glob of ours can read.
describe('a team block whose ignores hold a function', () => {
  const projectDir = tempProjects.create({ files: { [TEAM_CONFIG_MODULE]: teamBlockWithFunctionIgnores } })
  const fields = { rules: { 'max-lines': 'error' } } satisfies SharedFields

  it("merges without throwing, the team's setting standing where the block applies", async () => {
    const teamConfig = await importedTeamConfig(projectDir, TEAM_CONFIG_MODULE)
    const config = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, fields, teamConfig)

    expect(entryIn(await entriesOf(config, 'max-lines', ['src/a.tsx']), 'src/a.tsx')).toStrictEqual(
      entryIn(await teamAloneEntriesOf(teamConfig, 'max-lines', ['src/a.tsx']), 'src/a.tsx'),
    )
  })
})

describe('the base block', () => {
  // Each engine flags the other's suppressions as unused (measured).
  it('stops ESLint reporting unused disable directives in a project whose package.json lists oxlint', async () => {
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, {}, [])

    expect((await linterOptionsFor(config, 'src/a.ts')).reportUnusedDisableDirectives).toBe(OFF)
  })

  it("leaves ESLint's own setting of unused disable directives in a project whose package.json lists no oxlint", async () => {
    const config = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, {}, [])

    expect((await linterOptionsFor(config, 'src/a.ts')).reportUnusedDisableDirectives).toBe(WARN)
  })

  it('lets a suppression of a rule only oxlint has load, through its stub, in a project whose package.json lists oxlint', async () => {
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, {}, [])

    expect(rulesNotFoundAmong(await messagesReportedOn(config, suppressionOfAnOxcRule, 'src/a.ts'))).toStrictEqual([])
  })

  it('still reads and looks up a suppression of a rule nobody defines, in a project whose package.json lists oxlint', async () => {
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, {}, [])

    expect(rulesNotFoundAmong(await messagesReportedOn(config, suppressionOfARuleNobodyDefines, 'src/a.ts'))).toStrictEqual([
      'nobody/rule',
    ])
  })

  it('registers no stub in a project whose package.json lists no oxlint: a suppression of a rule only oxlint has is not found', async () => {
    const config = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, {}, [])

    expect(rulesNotFoundAmong(await messagesReportedOn(config, suppressionOfAnOxcRule, 'src/a.ts'))).toStrictEqual([
      'oxc/approx-constant',
    ])
  })

  // Our runtime globals go only where our own no-undef runs: without oxlint, in the JS files the
  // correctness ruleset ships it for.
  it.each([
    { runtime: 'browser', defined: 'window', undefinedGlobal: 'process' },
    { runtime: 'node', defined: 'process', undefinedGlobal: 'window' },
  ] as const)('defines the globals of $runtime, listed in the editor set, and not those of another, where our no-undef runs', async ({ runtime, defined, undefinedGlobal }) => {
    const globals = await globalsFor(mergedWithoutOxlint({ editorRulesets: { quality: ['correctness'], runtimes: [runtime] } }, {}), 'src/a.js')

    expect({ defined: globals[defined] !== undefined, undefinedGlobal: globals[undefinedGlobal] }).toStrictEqual({
      defined: true,
      undefinedGlobal: undefined,
    })
  })
})

// ESLint's --cache keys each file's result on its calculated config, naming each plugin by its meta's
// name@version, so an upgrade of this package must change that key for every plugin our part
// registers, though some carry no meta and house carries no version.
describe('the plugins our ESLint part registers, as ESLint names them in its cache key', () => {
  const fields = { rules: { [ARRAY_TYPE]: 'error', 'react/jsx-curly-brace-presence': 'error' } } satisfies SharedFields

  /** Under @typescript-eslint, a team plugin of the version given; under react, a raw one with no meta; and one under a prefix of the team's own. */
  function teamConfigWith(teamTypescriptEslintVersion: string): Linter.Config[] {
    return [
      buildTeamEslintBlock('team', {
        plugins: {
          '@typescript-eslint': buildFakePlugin(['team-only'], {
            meta: { name: 'team-typescript-eslint', version: teamTypescriptEslintVersion },
          }),
          react: buildFakePlugin(['jsx-key']),
          local: buildFakePlugin(['team-only'], { meta: { name: 'team-local', version: TEAM_PLUGIN_VERSION } }),
        },
      }),
    ]
  }

  function mergedAt(projectDir: string, teamConfig: Linter.Config[], ourVersion: string): Linter.Config[] {
    const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {}, fields)).editorRulesets
    return mergeEslintPart(teamConfig, eslint, catalog, eslintPluginRegistry, ourVersion, NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG)
  }

  it.each(PROJECTS)(
    "each change when our version changes, merged with the team's plugin or not; the team's own and ESLint's stay as they were, in a project $project",
    async ({ projectDir }) => {
      const teamConfig = teamConfigWith(TEAM_PLUGIN_VERSION)
      const before = await serializedPluginsFor(mergedAt(projectDir, teamConfig, OUR_VERSION), 'src/a.tsx')
      const after = await serializedPluginsFor(mergedAt(projectDir, teamConfig, OUR_NEXT_VERSION), 'src/a.tsx')

      expect({
        unchanged: Object.keys(after)
          .filter((namespace) => after[namespace] === before[namespace])
          .toSorted(),
        teamOwn: after['local'],
      }).toStrictEqual({ unchanged: [ESLINT_CORE_NAMESPACE, 'local'], teamOwn: `local:team-local@${TEAM_PLUGIN_VERSION}` })
    },
  )

  it.each(PROJECTS)(
    "change where merged with the team's plugin, and only there, when the team's plugin version changes, in a project $project",
    async ({ projectDir }) => {
      const before = await serializedPluginsFor(mergedAt(projectDir, teamConfigWith(TEAM_PLUGIN_VERSION), OUR_VERSION), 'src/a.tsx')
      const after = await serializedPluginsFor(mergedAt(projectDir, teamConfigWith(TEAM_NEXT_PLUGIN_VERSION), OUR_VERSION), 'src/a.tsx')

      expect(Object.keys(after).filter((namespace) => after[namespace] !== before[namespace])).toStrictEqual(['@typescript-eslint'])
    },
  )

  // The key names the plugin by its own name: a team swapping one plugin for another of the same
  // version under our prefix must not be served the other's results.
  it.each(PROJECTS)(
    "change where merged with the team's plugin, and only there, when the team registers another plugin of the same version there, in a project $project",
    async ({ projectDir }) => {
      const teamRegistering = (name: string): Linter.Config[] => [
        buildTeamEslintBlock('team', { plugins: { '@typescript-eslint': buildFakePlugin(['team-only'], { meta: { name, version: TEAM_PLUGIN_VERSION } }) } }),
      ]
      const before = await serializedPluginsFor(mergedAt(projectDir, teamRegistering('team-typescript-eslint'), OUR_VERSION), 'src/a.tsx')
      const after = await serializedPluginsFor(mergedAt(projectDir, teamRegistering('other-typescript-eslint'), OUR_VERSION), 'src/a.tsx')

      expect(Object.keys(after).filter((namespace) => after[namespace] !== before[namespace])).toStrictEqual(['@typescript-eslint'])
    },
  )

  // ESLint reads a plugin's top-level name and version before its meta, and takes an empty name for
  // none, keying the plugin by its namespace alone, without a version.
  it.each([
    { gives: 'its name and version at its top level', plugin: () => buildPluginNamedAtTopLevel(['team-only'], { name: 'team-typescript-eslint', version: TEAM_PLUGIN_VERSION }) },
    { gives: 'an empty name', plugin: () => buildFakePlugin(['team-only'], { meta: { name: '', version: TEAM_PLUGIN_VERSION } }) },
  ])("each change when our version changes, where the team's plugin under our prefix gives $gives", async ({ plugin }) => {
    const teamConfig = [buildTeamEslintBlock('team', { plugins: { '@typescript-eslint': plugin() } })]
    const before = await serializedPluginsFor(mergedAt(PROJECT_WITH_OXLINT, teamConfig, OUR_VERSION), 'src/a.tsx')
    const after = await serializedPluginsFor(mergedAt(PROJECT_WITH_OXLINT, teamConfig, OUR_NEXT_VERSION), 'src/a.tsx')

    expect(Object.keys(after).filter((namespace) => after[namespace] === before[namespace])).toStrictEqual([ESLINT_CORE_NAMESPACE])
  })

  it('are named by mergeEslintConfig with the version in this package\'s package.json', async () => {
    const { eslint } = defineLintRules(buildConsumerLintRules(PROJECT_WITH_OXLINT, {}, fields)).editorRulesets
    const teamConfig = teamConfigWith(TEAM_PLUGIN_VERSION)

    expect(await serializedPluginsFor(mergedBesideATeamOxlintConfigSettingNoRule(teamConfig, eslint), 'src/a.tsx')).toStrictEqual(
      await serializedPluginsFor(
        mergeEslintPart(teamConfig, eslint, catalog, eslintPluginRegistry, lintRulesPackageVersion(), NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG),
        'src/a.tsx',
      ),
    )
  })
})

// typescript-eslint builds one project service per process, so where the team gives type
// information our typed rules use it, and so only within the files the team gives it to: in any
// other file a typed rule has no types, throws, and ends the whole ESLint run (measured).
describe('a typed rule of ours, beside a team that gives type information', () => {
  const throughEither: readonly { readonly typeInformation: TeamTypeInformation }[] = [
    { typeInformation: 'projectService' },
    { typeInformation: 'project' },
  ]
  const cases = PROJECTS.flatMap((project) => throughEither.map((through) => ({ ...project, ...through })))

  it.each(cases)(
    'runs only in the files the team gives types to, through $typeInformation, in a project $project',
    async ({ projectDir, typeInformation }) => {
      const teamConfig = [buildTeamTypedEslintBlock('team-typed', typeInformation, { files: ['**/*.{ts,tsx}'] })]
      const config = mergedEditorEslintConfig(projectDir, TYPED_RULE_ON, teamConfig)

      expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'src/a.tsx', 'src/a.mts', 'scripts/build.cts'])).toStrictEqual({
        'src/a.ts': 'error',
        'src/a.tsx': 'error',
        'src/a.mts': 'off',
        'scripts/build.cts': 'off',
      })
    },
  )

  it('runs in no file the team block giving types ignores', async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'], ignores: ['legacy/**'] })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'legacy/a.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'legacy/a.ts': 'off',
    })
  })

  it('runs within each of two team blocks giving types, and outside both in none', async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed-src', 'projectService', { files: ['src/**/*.ts'] }),
      buildTeamTypedEslintBlock('team-typed-scripts', 'projectService', { files: ['scripts/**/*.mts'] }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'scripts/build.mts', 'tools/a.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'scripts/build.mts': 'error',
      'tools/a.ts': 'off',
    })
  })

  it("runs in every TS file, and in no JS file, where the team's block gives types to every file it applies to", async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService')]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'src/a.mts', 'src/a.js'])).toStrictEqual({
      'src/a.ts': 'error',
      'src/a.mts': 'error',
      'src/a.js': 'off',
    })
  })

  it("runs, when turned on by a file override entry, only where the entry's files and the team's typed files meet", async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.{ts,tsx}'] })]
    const fields = { fileOverrides: [{ files: ['apps/**'], rules: { [FLOATING_PROMISES]: 'error' } }] } satisfies SharedFields
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['apps/a.ts', 'apps/a.mts', 'src/a.ts'])).toStrictEqual({
      'apps/a.ts': 'error',
      'apps/a.mts': 'off',
      'src/a.ts': 'off',
    })
  })

  // functional/no-expression-statements ships with files **/*.ts, so ESLint states it in a block of its own.
  it("runs, when it ships with files of its own, only where those and the team's typed files meet", async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['src/**/*.ts'] })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, { rules: { 'functional/no-expression-statements': 'error' } }, teamConfig)

    expect(await severitiesOf(config, 'functional/no-expression-statements', ['src/a.ts', 'scripts/a.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'scripts/a.ts': 'off',
    })
  })

  it.each(PROJECTS)('runs in every TS file, on our own type information, beside a team that gives none, in a project $project', async ({ projectDir }) => {
    const teamConfig = [buildTeamEslintBlock('team', { files: ['**/*.{ts,tsx}'], rules: { 'no-console': 'warn' } })]
    const config = mergedEditorEslintConfig(projectDir, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'src/a.mts', 'scripts/build.cts'])).toStrictEqual({
      'src/a.ts': 'error',
      'src/a.mts': 'error',
      'scripts/build.cts': 'error',
    })
  })
})

// Where the team gives no type information, ours goes only to the TS files a tsconfig includes:
// elsewhere our project service would make a fatal parse error switching off every rule, so no block
// that can run a typed rule applies there.
describe('a typed rule of ours, in a project with a TS file outside every tsconfig', () => {
  const TYPED_AND_UNTYPED_RULES_ON = { rules: { [FLOATING_PROMISES]: 'error', [ARRAY_TYPE]: 'error' } } satisfies SharedFields
  const projectFiles = {
    'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
    [TS_FILE_A_TSCONFIG_INCLUDES]: cleanModule,
    [TS_FILE_OUTSIDE_EVERY_TSCONFIG]: cleanModule,
  }
  const projectsWithAStrayFile = [
    {
      project: 'whose package.json lists oxlint',
      projectDir: tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...projectFiles } }),
    },
    {
      project: 'whose package.json lists no oxlint',
      projectDir: tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()), ...projectFiles } }),
    },
  ]

  async function typeInformationAndRulesIn(projectDir: string, config: Linter.Config[], file: string): Promise<Record<string, unknown>> {
    const calculated = await calculatedConfigInProjectFor(projectDir, config, file)
    if (calculated?.rules === undefined || calculated.languageOptions === undefined) throw new Error(`ESLint calculated no rules or language options for ${file}`)
    const parserOptions: unknown = calculated.languageOptions['parserOptions']
    return {
      projectService: isRecord(parserOptions) ? parserOptions['projectService'] : undefined,
      typed: severityOfCalculatedEntry(calculated.rules[FLOATING_PROMISES]) ?? 'off',
      untyped: severityOfCalculatedEntry(calculated.rules[ARRAY_TYPE]) ?? 'off',
    }
  }

  it.each(projectsWithAStrayFile)(
    'runs, beside a team that gives none, in a TS file a tsconfig includes, and gives no type information to one outside every tsconfig, where the untyped rules run, in a project $project',
    async ({ projectDir }) => {
      const teamConfig = [buildTeamEslintBlock('team', { rules: { 'no-console': 'warn' } })]
      const config = mergedEditorEslintConfig(projectDir, TYPED_AND_UNTYPED_RULES_ON, teamConfig)

      expect({
        included: await typeInformationAndRulesIn(projectDir, config, TS_FILE_A_TSCONFIG_INCLUDES),
        outside: await typeInformationAndRulesIn(projectDir, config, TS_FILE_OUTSIDE_EVERY_TSCONFIG),
      }).toStrictEqual({
        included: { projectService: true, typed: 'error', untyped: 'error' },
        outside: { projectService: undefined, typed: 'off', untyped: 'error' },
      })
    },
  )

  // Beside it: type information the team gives is the team's to give, a file outside every tsconfig included.
  it.each(projectsWithAStrayFile)(
    'runs, beside a team that gives type information, in every file the team gives it to, one outside every tsconfig included, in a project $project',
    async ({ projectDir }) => {
      const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] })]
      const config = mergedEditorEslintConfig(projectDir, TYPED_AND_UNTYPED_RULES_ON, teamConfig)

      expect({
        included: (await typeInformationAndRulesIn(projectDir, config, TS_FILE_A_TSCONFIG_INCLUDES))['typed'],
        outside: (await typeInformationAndRulesIn(projectDir, config, TS_FILE_OUTSIDE_EVERY_TSCONFIG))['typed'],
      }).toStrictEqual({ included: 'error', outside: 'error' })
    },
  )
})

// A later team block may switch type information off again for some files, as typescript-eslint's
// disableTypeChecked does: a file has types when, after every team block, project or
// projectService is still on. In a file without them a typed rule of ours throws and ends the
// whole ESLint run (measured), so it runs in none of the files such a block applies to.
describe('a typed rule of ours, beside a team block that switches type information off again for some files', () => {
  const switchingTypesOff: readonly SwitchingTypesOff[] = [
    {
      how: "the language options of typescript-eslint's disableTypeChecked, and none of its rules",
      typedThrough: 'projectService',
      switchingOff: buildTeamBlockSwitchingTypesOffAsDisableTypeCheckedDoes('team-untyped', { files: SCRIPT_FILES }),
    },
    {
      how: 'projectService: false',
      typedThrough: 'projectService',
      switchingOff: buildTeamEslintBlockSettingParserOptions('team-untyped', { projectService: false }, { files: SCRIPT_FILES }),
    },
    {
      how: 'projectService: null',
      typedThrough: 'projectService',
      switchingOff: buildTeamEslintBlockSettingParserOptions('team-untyped', { projectService: null }, { files: SCRIPT_FILES }),
    },
    {
      how: 'project: false',
      typedThrough: 'project',
      switchingOff: buildTeamEslintBlockSettingParserOptions('team-untyped', { project: false }, { files: SCRIPT_FILES }),
    },
    {
      how: 'project: null',
      typedThrough: 'project',
      switchingOff: buildTeamEslintBlockSettingParserOptions('team-untyped', { project: null }, { files: SCRIPT_FILES }),
    },
  ]
  const leavingTypesOn: readonly { readonly how: string; readonly later: Linter.Config }[] = [
    {
      how: 'program: null alone',
      later: buildTeamEslintBlockSettingParserOptions('team-scripts', { program: null }, { files: SCRIPT_FILES }),
    },
    {
      how: 'parser options that name no type information',
      later: buildTeamEslintBlockSettingParserOptions('team-scripts', { ecmaFeatures: { jsx: false } }, { files: SCRIPT_FILES }),
    },
  ]
  const turnedOnEachWay: readonly { readonly how: string; readonly ruleId: string; readonly fields: SharedFields }[] = [
    {
      how: 'by a file override entry',
      ruleId: FLOATING_PROMISES,
      fields: { fileOverrides: [{ files: ['**/*.ts'], rules: { [FLOATING_PROMISES]: 'error' } }] },
    },
    {
      how: 'with files of its own, as functional/no-expression-statements ships',
      ruleId: 'functional/no-expression-statements',
      fields: { rules: { 'functional/no-expression-statements': 'error' } },
    },
  ]

  it.each(switchingTypesOff)(
    'runs in none of its files where it sets $how, and still in the files the team types through $typedThrough',
    async ({ typedThrough, switchingOff }) => {
      const teamConfig = [buildTeamTypedEslintBlock('team-typed', typedThrough, { files: ['**/*.ts'] }), switchingOff]
      const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

      expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'scripts/b.ts'])).toStrictEqual({
        'src/a.ts': 'error',
        'scripts/b.ts': 'off',
      })
    },
  )

  // disableTypeChecked turns every typed typescript-eslint rule off, and a rule the team sets anywhere,
  // off included, is the team's in every file, so ours runs nowhere.
  it("runs in no file where the team's block spreads typescript-eslint's disableTypeChecked whole, which turns it off", async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] }),
      buildTeamDisableTypeCheckedBlock('team-untyped', { files: SCRIPT_FILES }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'scripts/b.ts'])).toStrictEqual({ 'src/a.ts': 'off', 'scripts/b.ts': 'off' })
  })

  it.each(turnedOnEachWay)('runs in none of its files when turned on $how', async ({ ruleId, fields }) => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] }),
      buildTeamBlockSwitchingTypesOffAsDisableTypeCheckedDoes('team-untyped', { files: SCRIPT_FILES }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)

    expect(await severitiesOf(config, ruleId, ['src/a.ts', 'scripts/b.ts'])).toStrictEqual({ 'src/a.ts': 'error', 'scripts/b.ts': 'off' })
  })

  it("runs in a file that block's ignores leave out, where the team's types stay on", async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] }),
      buildTeamBlockSwitchingTypesOffAsDisableTypeCheckedDoes('team-untyped', { files: SCRIPT_FILES, ignores: ['scripts/typed/**'] }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'scripts/b.ts', 'scripts/typed/c.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'scripts/b.ts': 'off',
      'scripts/typed/c.ts': 'error',
    })
  })

  it("runs in none of the files under that block's basePath, and still outside it", async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] }),
      buildTeamBlockSwitchingTypesOffAsDisableTypeCheckedDoes('team-untyped', { basePath: 'scripts' }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'scripts/b.ts', 'src/scripts/c.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'scripts/b.ts': 'off',
      'src/scripts/c.ts': 'error',
    })
  })

  it.each(leavingTypesOn)('runs where a later team block for those files sets $how, which leaves type information on', async ({ later }) => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] }), later]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'scripts/b.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'scripts/b.ts': 'error',
    })
  })

  it("runs typescript-eslint's typed extension of a core rule we turn on where the team gives types, and the core rule where it takes them away, in a project whose package.json lists no oxlint", async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] }),
      buildTeamEslintBlockSettingParserOptions('team-untyped', { projectService: false }, { files: ['generated/**'] }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITHOUT_OXLINT, { rules: { [PREFER_DESTRUCTURING]: 'error' } }, teamConfig)

    expect(await severitiesOfEach(config, [PREFER_DESTRUCTURING, TWIN_OF_PREFER_DESTRUCTURING], ['generated/a.ts', 'src/a.ts'])).toStrictEqual({
      'generated/a.ts': { [PREFER_DESTRUCTURING]: 'error', [TWIN_OF_PREFER_DESTRUCTURING]: 'off' },
      'src/a.ts': { [PREFER_DESTRUCTURING]: 'off', [TWIN_OF_PREFER_DESTRUCTURING]: 'error' },
    })
  })

  // Switching off the option a later block turns on leaves the types an earlier block gave through
  // the other option.
  it('runs where a later block sets to false the option no earlier block turned on, beside types an earlier block gives through the other', async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed-scripts', 'project', { files: ['scripts/**/*.ts'] }),
      buildTeamEslintBlockSettingParserOptions('team-scripts', { projectService: false }, { files: SCRIPT_FILES }),
      buildTeamTypedEslintBlock('team-typed-src', 'projectService', { files: ['src/**/*.ts'] }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['scripts/b.ts', 'src/a.ts', 'tools/a.ts'])).toStrictEqual({
      'scripts/b.ts': 'error',
      'src/a.ts': 'error',
      'tools/a.ts': 'off',
    })
  })

  // The earlier block only switches type information off in its parser options, so it states no typed
  // rule off itself, as typescript-eslint's disableTypeChecked would.
  it('runs where the block switching type information off comes before the block that gives it', async () => {
    const teamConfig = [
      buildTeamEslintBlockSettingParserOptions('team-untyped', { projectService: false }),
      buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'scripts/b.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'scripts/b.ts': 'error',
    })
  })
})

// ESLint reads a block's files and ignores from its basePath. Our copies of a typed rule keep to
// the files a team block types, so they read the team's globs from the same place; our own globs,
// a file override entry's included, stay read from the project root.
describe('a typed rule of ours, beside a team block that gives type information under a basePath', () => {
  it('runs only in the files that block types under its basePath', async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: 'src', files: ['**/*.ts'] })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'src/nested/c.ts', 'scripts/b.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'src/nested/c.ts': 'error',
      'scripts/b.ts': 'off',
    })
  })

  it('runs in every TS file under its basePath where the block names no files, and in none outside it', async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: 'src' })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'src/a.mts', 'scripts/b.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'src/a.mts': 'error',
      'scripts/b.ts': 'off',
    })
  })

  it("runs in none of the files that block's ignores leave out, read from its basePath", async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: 'src', files: ['**/*.ts'], ignores: ['legacy/**'] }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'src/legacy/a.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'src/legacy/a.ts': 'off',
    })
  })

  it("runs, when turned on by a file override entry, where the entry's files, read from the project root, and the typed files meet", async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: 'src', files: ['**/*.ts'] })]
    const fields = { fileOverrides: [{ files: ['src/feature/**'], rules: { [FLOATING_PROMISES]: 'error' } }] } satisfies SharedFields
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, fields, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/feature/a.ts', 'src/other/a.ts', 'scripts/feature/a.ts'])).toStrictEqual({
      'src/feature/a.ts': 'error',
      'src/other/a.ts': 'off',
      'scripts/feature/a.ts': 'off',
    })
  })

  // Next.js names folders with glob syntax: a dynamic segment and a catch-all segment, each a
  // character class to minimatch. ESLint reads a basePath as a path, so the folder alone is meant,
  // and not the files its glob reading matches. (A route group, `(marketing)`, decides nothing here:
  // minimatch reads bare parentheses literally.)
  it.each([
    { basePath: 'app/[slug]', underIt: 'app/[slug]/a.ts', globReadingMatches: 'app/s/a.ts' },
    { basePath: 'app/[...slug]', underIt: 'app/[...slug]/a.ts', globReadingMatches: 'app/u/a.ts' },
  ])(
    'runs in the files under a basePath named with glob syntax, $basePath, read as a path, and in no other',
    async ({ basePath, underIt, globReadingMatches }) => {
      const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath, files: ['**/*.ts'] })]
      const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

      expect(await severitiesOf(config, FLOATING_PROMISES, [underIt, globReadingMatches, 'scripts/b.ts'])).toStrictEqual({
        [underIt]: 'error',
        [globReadingMatches]: 'off',
        'scripts/b.ts': 'off',
      })
    },
  )

  // ESLint takes an absolute basePath as it is; the merge is told one directory of the project.
  it('runs in the files under an absolute basePath into the project, read against tsconfigRootDir, and in none outside it', async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: join(PROJECT_WITH_OXLINT, 'packages/a'), files: ['**/*.ts'] }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)
    const severityIn = async (file: string): Promise<string> =>
      (await ruleSeverityInProjectFor(PROJECT_WITH_OXLINT, config, file, FLOATING_PROMISES)) ?? 'off'

    expect({
      underIt: await severityIn('packages/a/x.ts'),
      outsideIt: await severityIn('packages/b/x.ts'),
    }).toStrictEqual({ underIt: 'error', outsideIt: 'off' })
  })

  // More of what minimatch reads as glob syntax, which a directory may be named with: wildcards,
  // braces, an extglob, and a backslash; at the start of the path, a comment mark and a negation.
  it.each([
    { basePath: 'app/*', underIt: 'app/*/a.ts', globReadingMatches: 'app/x/a.ts' },
    { basePath: 'app/?', underIt: 'app/?/a.ts', globReadingMatches: 'app/x/a.ts' },
    { basePath: 'app/{a,b}', underIt: 'app/{a,b}/a.ts', globReadingMatches: 'app/a/a.ts' },
    { basePath: 'app/@(x)', underIt: 'app/@(x)/a.ts', globReadingMatches: 'app/x/a.ts' },
    { basePath: 'app/a\\b', underIt: 'app/a\\b/a.ts', globReadingMatches: 'app/ab/a.ts' },
    { basePath: '#private', underIt: '#private/a.ts', globReadingMatches: 'src/a.ts' },
    { basePath: '!private', underIt: '!private/a.ts', globReadingMatches: 'src/a.ts' },
  ])(
    'runs in the files under a basePath named with other glob syntax, $basePath, read as a path, and in no other',
    async ({ basePath, underIt, globReadingMatches }) => {
      const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath, files: ['**/*.ts'] })]
      const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

      expect(await severitiesOf(config, FLOATING_PROMISES, [underIt, globReadingMatches])).toStrictEqual({
        [underIt]: 'error',
        [globReadingMatches]: 'off',
      })
    },
  )

  it('runs in the files that block types where its basePath is the project root itself', async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: '.', files: ['src/**/*.ts'] })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'scripts/b.ts'])).toStrictEqual({ 'src/a.ts': 'error', 'scripts/b.ts': 'off' })
  })

  // ESLint reads a block whose basePath lies outside the project from there, so its parent's `**/*.ts`
  // gives every TS file of the project types, and a sibling folder's none.
  it.each([
    { basePath: '..', owed: 'error' },
    { basePath: '../elsewhere', owed: 'off' },
  ])('runs where ESLint gives types from the only block giving them, whose basePath lies outside the project: $basePath, $owed', async ({ basePath, owed }) => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath, files: ['**/*.ts'] })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts'])).toStrictEqual({ 'src/a.ts': owed })
  })

  it("runs in a file a negated ignore of that block takes back, read from its basePath", async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: 'src', files: ['**/*.ts'], ignores: ['legacy/**', '!legacy/keep/**'] }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'src/legacy/a.ts', 'src/legacy/keep/a.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'src/legacy/a.ts': 'off',
      'src/legacy/keep/a.ts': 'error',
    })
  })

  it("reads that block's globs written with a leading ./ from its basePath", async () => {
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: 'src', files: ['./**/*.ts'], ignores: ['./legacy/**'] }),
    ]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'src/legacy/a.ts', 'scripts/b.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'src/legacy/a.ts': 'off',
      'scripts/b.ts': 'off',
    })
  })

  // A files entry of negations alone matches, read from the basePath, every file under it but those.
  it('runs, where a files entry of that block is a negation alone, in the files under its basePath it leaves in, and in none outside it', async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { basePath: 'src', files: [['!**/*.test.ts']] })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'src/a.test.ts', 'scripts/a.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'src/a.test.ts': 'off',
      'scripts/a.ts': 'off',
    })
  })

  it('runs in every file its files match from the project root, where the block has no basePath', async () => {
    const teamConfig = [buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] })]
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, TYPED_RULE_ON, teamConfig)

    expect(await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts', 'scripts/b.ts'])).toStrictEqual({
      'src/a.ts': 'error',
      'scripts/b.ts': 'error',
    })
  })
})

// ESLint reads a files entry of negations alone as every file but those it names (measured). The team's
// bare severity would keep the options of any block of ours before it, so none of ours may apply there.
describe('a team block whose files are a negation alone, stating our rule by a bare severity', () => {
  const teamConfig = [
    buildTeamEslintBlock('team', {
      files: ['!legacy/**'],
      plugins: { [TYPESCRIPT_ESLINT_PREFIX]: installedEslintPlugin(TYPESCRIPT_ESLINT_PREFIX) },
      rules: { [ARRAY_TYPE]: 'warn' },
    }),
  ]
  const fields = { rules: { [ARRAY_TYPE]: 'error' } } satisfies SharedFields
  const files = ['src/a.ts', 'legacy/a.ts']

  it.each(PROJECTS)(
    "is the team's in every file: its entry, none of our options with it, in the files the negation leaves in, and no entry in the files it takes out, in a project $project",
    async ({ projectDir }) => {
      const config = mergedEditorEslintConfig(projectDir, fields, teamConfig)

      expect(await entriesOf(config, ARRAY_TYPE, files)).toStrictEqual({
        'src/a.ts': entryIn(await teamAloneEntriesOf(teamConfig, ARRAY_TYPE, files), 'src/a.ts'),
        'legacy/a.ts': ABSENT,
      })
    },
  )
})

// A team typed block's negated ignore takes a folder back into the block, where a team block sets our
// rule by a bare severity: none of our options may stay there.
describe("a typed rule of ours, beside a team typed block whose negated ignore takes back a folder the team sets the rule in", () => {
  const teamConfig = [
    buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'], ignores: ['legacy/**', '!legacy/keep/**'] }),
    buildTeamEslintBlock('team-keep', {
      files: ['legacy/keep/**'],
      plugins: { [TYPESCRIPT_ESLINT_PREFIX]: installedEslintPlugin(TYPESCRIPT_ESLINT_PREFIX) },
      rules: { [FLOATING_PROMISES]: 'warn' },
    }),
  ]

  it("is the team's there, none of our options with it, and in the rest of the files the team types, where it runs nowhere", async () => {
    const config = mergedEditorEslintConfig(PROJECT_WITH_OXLINT, { rules: { [FLOATING_PROMISES]: ['error', { ignoreVoid: false }] } }, teamConfig)

    expect({
      takenBack: entryIn(await entriesOf(config, FLOATING_PROMISES, ['legacy/keep/a.ts']), 'legacy/keep/a.ts'),
      typedByTheTeam: (await severitiesOf(config, FLOATING_PROMISES, ['src/a.ts']))['src/a.ts'],
    }).toStrictEqual({
      takenBack: entryIn(await teamAloneEntriesOf(teamConfig, FLOATING_PROMISES, ['legacy/keep/a.ts']), 'legacy/keep/a.ts'),
      typedByTheTeam: 'off',
    })
  })
})

// Without oxlint our part runs a core rule's typed extension on TS files, so the project service must be
// set up for it: a typed rule without type information throws and ends the ESLint run (measured).
describe('a core rule whose typed extension our part runs in its place, the only rule we turn on, in a project whose package.json lists no oxlint', () => {
  const projectDir = typedProjectWithoutOxlint(propertyReadIntoAVariable)

  it('lints a TS file a tsconfig includes, the extension reporting what the core rule would', async () => {
    const config = mergedEditorEslintConfig(projectDir, { rules: { [PREFER_DESTRUCTURING]: 'error' } }, [])

    expect(await ruleIdsReportedInProjectByFile(projectDir, config)).toStrictEqual({ [TS_FILE_A_TSCONFIG_INCLUDES]: [TWIN_OF_PREFER_DESTRUCTURING] })
  })
})

// Our off states nothing in ESLint, so a team that does not set the rule has no entry of it, rather
// than an off with our options.
describe('a rule a listed ruleset ships, which our top-level rules turn off, beside a team config that does not set it', () => {
  it.each(PROJECTS)('has no entry in any file, in a project $project', async ({ projectDir }) => {
    const { eslint } = defineLintRules(
      buildConsumerLintRules(projectDir, { editorRulesets: { quality: ['complexity'] } }, { rules: { 'max-lines': 'off' } }),
    ).editorRulesets

    expect(await entriesOf(mergedBesideATeamOxlintConfigSettingNoRule([], eslint), 'max-lines', ['src/a.tsx', 'src/a.ts'])).toStrictEqual({ 'src/a.tsx': ABSENT, 'src/a.ts': ABSENT })
  })
})

// Where our own layers state a core rule ESLint takes over from oxlint and its typescript-eslint
// extension, the highest layer stating either name decides; the extension runs on TS files and the
// core rule on JS files, never both in one file.
describe("a core rule a listed ruleset ships, and typescript-eslint's extension of it our rules set, in a project whose package.json lists no oxlint", () => {
  it("runs the extension on TS files and the core rule on JS files, each with our rules' setting, never both in one file", async () => {
    const { eslint } = defineLintRules(
      buildConsumerLintRules(PROJECT_WITHOUT_OXLINT, { editorRulesets: { quality: ['complexity'] } }, { rules: { [TWIN_OF_MAX_PARAMS]: ['error', { max: 2 }] } }),
    ).editorRulesets
    const config = mergedBesideATeamOxlintConfigSettingNoRule([], eslint)

    expect({
      tsFile: {
        extension: entryIn(await entriesOf(config, TWIN_OF_MAX_PARAMS, ['src/a.ts']), 'src/a.ts'),
        coreRule: (await severitiesOf(config, MAX_PARAMS, ['src/a.ts']))['src/a.ts'],
      },
      jsFile: {
        coreRule: entryIn(await entriesOf(config, MAX_PARAMS, ['src/a.js']), 'src/a.js'),
        extension: (await severitiesOf(config, TWIN_OF_MAX_PARAMS, ['src/a.js']))['src/a.js'],
      },
    }).toStrictEqual({
      tsFile: { extension: [ERROR, { max: 2 }], coreRule: 'off' },
      jsFile: { coreRule: [ERROR, { max: 2 }], extension: 'off' },
    })
  })
})

/** Each rule given, by file: its calculated entry where ESLint runs it, and off where it does not, whether stated off or not at all. */
async function runningEntriesOf(config: Linter.Config[], ruleIds: readonly string[], files: readonly string[]): Promise<Record<string, Record<string, unknown>>> {
  const byFile = await entriesByFileOf(config, ruleIds, files)
  return Object.fromEntries(
    files.map((file) => {
      const entries = byFile[file]
      if (entries === undefined || entries === NOT_LINTED) throw new Error(`ESLint lints no ${file}`)
      return [file, Object.fromEntries(Object.entries(entries).map(([ruleId, entry]) => [ruleId, entry === ABSENT || entry[0] === OFF ? 'off' : entry]))]
    }),
  )
}

/** Our editor ESLint part, for the rulesets and shared settings given, merged into the team's config, in a project whose package.json lists no oxlint. */
function mergedWithoutOxlint(rulesets: Parameters<typeof buildConsumerLintRules>[1], fields: SharedFields, teamConfig: TeamEslintConfig = []): Linter.Config[] {
  return mergedBesideATeamOxlintConfigSettingNoRule(teamConfig, defineLintRules(buildConsumerLintRules(PROJECT_WITHOUT_OXLINT, rulesets, fields)).editorRulesets.eslint)
}

/** The rule's entry as its ruleset ships it: at error, with its shipped options. */
function shippedEntryOf(ruleId: string): Linter.RuleEntry {
  const route = catalog.rules.get(ruleId)
  if (route === undefined || route.shipped === null) throw new Error(`${ruleId} is not a rule we ship`)
  return ['error', ...route.shipped.options]
}

// The highest layer stating either twin decides, wherever in the layer. On JS files the core rule runs
// with that setting wherever the layer reaches if the layer names the extension alone, and within its
// own shipped files and ignores if it names the core rule; on a TS file without types it replaces a
// typed extension, with the layer below's setting where it refuses the extension's options. A layer
// turning the pair off leaves no entry of either name: a later bare severity would bring back its options.
describe("typescript-eslint's extension of a core rule a listed ruleset ships, set in our own layers, in a project whose package.json lists no oxlint", () => {
  // no-unused-vars ships ignoring **/scripts/** and **/*.config.{ts,js,mjs,cjs}, among others.
  it("runs the extension our rules set in every TS file, and the core rule with that setting in every JS file, those the ruleset ships it ignoring included", async () => {
    const setting = ['error', { args: 'none' }] satisfies Linter.RuleEntry
    const config = mergedWithoutOxlint({ editorRulesets: { quality: ['redundancy'] } }, { rules: { [TWIN_OF_NO_UNUSED_VARS]: setting } })
    const extension = await entryEslintCalculatesFor(TWIN_OF_NO_UNUSED_VARS, setting)
    const coreRule = await entryEslintCalculatesFor(NO_UNUSED_VARS, setting)

    expect(
      await runningEntriesOf(config, [NO_UNUSED_VARS, TWIN_OF_NO_UNUSED_VARS], ['src/a.ts', 'src/a.js', 'scripts/a.ts', 'scripts/a.js', 'tool.config.js', 'src/a.stories.tsx']),
    ).toStrictEqual({
      'src/a.ts': { [NO_UNUSED_VARS]: 'off', [TWIN_OF_NO_UNUSED_VARS]: extension },
      'src/a.js': { [NO_UNUSED_VARS]: coreRule, [TWIN_OF_NO_UNUSED_VARS]: 'off' },
      'scripts/a.ts': { [NO_UNUSED_VARS]: 'off', [TWIN_OF_NO_UNUSED_VARS]: extension },
      'scripts/a.js': { [NO_UNUSED_VARS]: coreRule, [TWIN_OF_NO_UNUSED_VARS]: 'off' },
      'tool.config.js': { [NO_UNUSED_VARS]: coreRule, [TWIN_OF_NO_UNUSED_VARS]: 'off' },
      'src/a.stories.tsx': { [NO_UNUSED_VARS]: 'off', [TWIN_OF_NO_UNUSED_VARS]: extension },
    })
  })

  it("runs the core rule with an entry's setting of the extension in every JS file of the entry, those the ruleset ships it ignoring included, and keeps the ruleset's limit outside the entry", async () => {
    const setting = ['error', { args: 'none' }] satisfies Linter.RuleEntry
    const config = mergedWithoutOxlint(
      { editorRulesets: { quality: ['redundancy'] } },
      { fileOverrides: [{ files: ['scripts/**', 'src/**'], rules: { [TWIN_OF_NO_UNUSED_VARS]: setting } }] },
    )
    const extension = await entryEslintCalculatesFor(TWIN_OF_NO_UNUSED_VARS, setting)
    const coreRule = await entryEslintCalculatesFor(NO_UNUSED_VARS, setting)

    expect(await runningEntriesOf(config, [NO_UNUSED_VARS, TWIN_OF_NO_UNUSED_VARS], ['scripts/a.js', 'scripts/a.ts', 'src/a.js', 'tool.config.js'])).toStrictEqual({
      'scripts/a.js': { [NO_UNUSED_VARS]: coreRule, [TWIN_OF_NO_UNUSED_VARS]: 'off' },
      'scripts/a.ts': { [NO_UNUSED_VARS]: 'off', [TWIN_OF_NO_UNUSED_VARS]: extension },
      'src/a.js': { [NO_UNUSED_VARS]: coreRule, [TWIN_OF_NO_UNUSED_VARS]: 'off' },
      'tool.config.js': { [NO_UNUSED_VARS]: 'off', [TWIN_OF_NO_UNUSED_VARS]: 'off' },
    })
  })

  it("keeps the ruleset's limit on the core rule, leaving the JS files it ships ignoring with neither name, where our rules set the core rule itself", async () => {
    const setting = ['error', { args: 'none' }] satisfies Linter.RuleEntry
    const config = mergedWithoutOxlint({ editorRulesets: { quality: ['redundancy'] } }, { rules: { [NO_UNUSED_VARS]: setting } })

    expect(await runningEntriesOf(config, [NO_UNUSED_VARS, TWIN_OF_NO_UNUSED_VARS], ['src/a.js', 'scripts/a.js', 'tool.config.js'])).toStrictEqual({
      'src/a.js': { [NO_UNUSED_VARS]: await entryEslintCalculatesFor(NO_UNUSED_VARS, setting), [TWIN_OF_NO_UNUSED_VARS]: 'off' },
      'scripts/a.js': { [NO_UNUSED_VARS]: 'off', [TWIN_OF_NO_UNUSED_VARS]: 'off' },
      'tool.config.js': { [NO_UNUSED_VARS]: 'off', [TWIN_OF_NO_UNUSED_VARS]: 'off' },
    })
  })

  // A written limit: the core rule refuses an option only the extension takes, so it keeps the ruleset's
  // setting within the ruleset's limit, and the JS files outside it get neither name.
  it("runs the core rule with the ruleset's setting within its limit, and leaves the JS files outside it with neither name, where our rules give the extension options the core rule refuses", async () => {
    const setting = ['error', { enableAutofixRemoval: { imports: true } }] satisfies Linter.RuleEntry
    const config = mergedWithoutOxlint({ editorRulesets: { quality: ['redundancy'] } }, { rules: { [TWIN_OF_NO_UNUSED_VARS]: setting } })

    expect(await runningEntriesOf(config, [NO_UNUSED_VARS, TWIN_OF_NO_UNUSED_VARS], ['src/a.js', 'scripts/a.js', 'tool.config.js'])).toStrictEqual({
      'src/a.js': { [NO_UNUSED_VARS]: await entryEslintCalculatesFor(NO_UNUSED_VARS, shippedEntryOf(NO_UNUSED_VARS)), [TWIN_OF_NO_UNUSED_VARS]: 'off' },
      'scripts/a.js': { [NO_UNUSED_VARS]: 'off', [TWIN_OF_NO_UNUSED_VARS]: 'off' },
      'tool.config.js': { [NO_UNUSED_VARS]: 'off', [TWIN_OF_NO_UNUSED_VARS]: 'off' },
    })
  })

  it("runs the core rule with the ruleset's setting where the team takes type information away, under an entry stating the typed extension with options the core rule refuses", async () => {
    const setting = ['error', { object: false }, { enforceForDeclarationWithTypeAnnotation: true }] satisfies Linter.RuleEntry
    const teamConfig = [
      buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] }),
      buildTeamEslintBlockSettingParserOptions('team-untyped', { projectService: false }, { files: ['**/generated/**'] }),
    ]
    const config = mergedWithoutOxlint(
      { editorRulesets: { quality: ['modern-js'] } },
      { fileOverrides: [{ files: LEGACY_FILES, rules: { [TWIN_OF_PREFER_DESTRUCTURING]: setting } }] },
      teamConfig,
    )

    expect(await runningEntriesOf(config, [PREFER_DESTRUCTURING, TWIN_OF_PREFER_DESTRUCTURING], ['legacy/generated/a.ts', 'legacy/a.ts'])).toStrictEqual({
      'legacy/generated/a.ts': { [PREFER_DESTRUCTURING]: await entryEslintCalculatesFor(PREFER_DESTRUCTURING, 'error'), [TWIN_OF_PREFER_DESTRUCTURING]: 'off' },
      'legacy/a.ts': { [PREFER_DESTRUCTURING]: 'off', [TWIN_OF_PREFER_DESTRUCTURING]: await entryEslintCalculatesFor(TWIN_OF_PREFER_DESTRUCTURING, setting) },
    })
  })

  it('states neither name in any file, where our rules turn the extension off over the ruleset shipping the core rule', async () => {
    const config = mergedWithoutOxlint({ editorRulesets: { quality: ['complexity'] } }, { rules: { [TWIN_OF_MAX_PARAMS]: 'off' } })

    expect(await entriesByFileOf(config, [MAX_PARAMS, TWIN_OF_MAX_PARAMS], ['src/a.ts', 'src/a.js'])).toStrictEqual({
      'src/a.ts': { [MAX_PARAMS]: ABSENT, [TWIN_OF_MAX_PARAMS]: ABSENT },
      'src/a.js': { [MAX_PARAMS]: ABSENT, [TWIN_OF_MAX_PARAMS]: ABSENT },
    })
  })

  it("runs the core rule an entry sets on its JS files and the extension with that setting on its TS files, never both, where our rules set the extension alone", async () => {
    const entrySetting = ['error', { max: 3 }] satisfies Linter.RuleEntry
    const config = mergedWithoutOxlint({}, { rules: { [TWIN_OF_MAX_PARAMS]: ['error', { max: 2 }] }, fileOverrides: [{ files: LEGACY_FILES, rules: { [MAX_PARAMS]: entrySetting } }] })

    expect(await runningEntriesOf(config, [MAX_PARAMS, TWIN_OF_MAX_PARAMS], ['legacy/a.js', 'legacy/a.ts'])).toStrictEqual({
      'legacy/a.js': { [MAX_PARAMS]: await entryEslintCalculatesFor(MAX_PARAMS, entrySetting), [TWIN_OF_MAX_PARAMS]: 'off' },
      'legacy/a.ts': { [MAX_PARAMS]: 'off', [TWIN_OF_MAX_PARAMS]: await entryEslintCalculatesFor(TWIN_OF_MAX_PARAMS, entrySetting) },
    })
  })
})

// The agent build writes our ignores as ESLint global ignores, where a folder name covers every file
// under it, so the editor part merged into an empty team config must run our rules in exactly the
// agent build's files. Both are linted as `eslint .` lints the project.
describe('our ignores, written as each form a folder or file is named in, beside an empty team config', () => {
  const FILES = [
    'src/index.js',
    'a.js',
    'src/a.js',
    'generated/index.js',
    'src/generated/index.js',
    'legacy/index.js',
    'src/legacy/index.js',
    'gen/index.js',
    'src/gen/index.js',
    'vendor/index.js',
    'src/vendor/index.js',
  ]
  const IGNORE_VALUES: readonly { readonly ignore: string; readonly leftOut: readonly string[] }[] = [
    { ignore: 'generated', leftOut: ['generated/index.js', 'src/generated/index.js'] },
    { ignore: 'legacy/', leftOut: ['legacy/index.js', 'src/legacy/index.js'] },
    { ignore: '**/gen', leftOut: ['gen/index.js', 'src/gen/index.js'] },
    { ignore: 'vendor/**', leftOut: ['vendor/index.js'] },
    { ignore: 'a.js', leftOut: ['a.js', 'src/a.js'] },
  ]
  const projectFiles = Object.fromEntries(FILES.map((file) => [file, thrownStringLiteral]))
  const projects = [
    { project: 'whose package.json lists oxlint', projectDir: tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...projectFiles } }) },
    { project: 'whose package.json lists no oxlint', projectDir: tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()), ...projectFiles } }) },
  ]
  const cases = projects.flatMap((project) => IGNORE_VALUES.map((value) => ({ ...project, ...value })))

  it.each(cases)(
    'keep our rules out of exactly the files the agent build leaves out, where the value is $ignore, in a project $project',
    async ({ projectDir, ignore, leftOut }) => {
      const defined = defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { [NO_THROW_LITERAL]: 'error' }, ignores: [ignore] }))
      const owed = FILES.filter((file) => !leftOut.includes(file)).toSorted()

      expect({
        editor: filesReporting(await ruleIdsReportedInProjectByFile(projectDir, mergedBesideATeamOxlintConfigSettingNoRule([], defined.editorRulesets.eslint)), NO_THROW_LITERAL),
        agent: filesReporting(await ruleIdsReportedInProjectByFile(projectDir, agentConfigsOf(defined).eslint), NO_THROW_LITERAL),
      }).toStrictEqual({ editor: owed, agent: owed })
    },
  )
})

// ESLint reads global ignores in order, a negated value taking back a folder an earlier value leaves
// out (measured, ESLint 10.12); the editor part owes the agent build's files.
describe('our ignores, a folder by its name and a negated value taking a folder within it back, beside an empty team config', () => {
  const FILES = ['src/index.js', 'legacy/index.js', 'legacy/keep/index.js', 'src/legacy/index.js', 'src/legacy/keep/index.js']
  const projectFiles = Object.fromEntries(FILES.map((file) => [file, thrownStringLiteral]))
  const projects = [
    { project: 'whose package.json lists oxlint', projectDir: tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...projectFiles } }) },
    { project: 'whose package.json lists no oxlint', projectDir: tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()), ...projectFiles } }) },
  ]

  /** The files our rule reports in, merged into an empty team config and in the agent build, both linted as `eslint .` lints them. */
  async function filesReportingOurRule(projectDir: string, ignores: readonly string[]): Promise<{ editor: string[]; agent: string[] }> {
    const defined = defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { [NO_THROW_LITERAL]: 'error' }, ignores: [...ignores] }))
    return {
      editor: filesReporting(await ruleIdsReportedInProjectByFile(projectDir, mergedBesideATeamOxlintConfigSettingNoRule([], defined.editorRulesets.eslint)), NO_THROW_LITERAL),
      agent: filesReporting(await ruleIdsReportedInProjectByFile(projectDir, agentConfigsOf(defined).eslint), NO_THROW_LITERAL),
    }
  }

  it.each(projects)(
    'keep our rules out of exactly the files the agent build leaves out, where legacy is taken back by !src/legacy, in a project $project',
    async ({ projectDir }) => {
      const owed = ['src/index.js', 'src/legacy/index.js', 'src/legacy/keep/index.js']

      expect(await filesReportingOurRule(projectDir, ['legacy', '!src/legacy'])).toStrictEqual({ editor: owed, agent: owed })
    },
  )

  // ESLint keeps a negated folder inside an ignored one left out with the outer folder (measured, ESLint
  // 10.12), so the editor merge owes the agent build's files there too. legacy/ names every legacy folder.
  it('keep our rules out of exactly the files the agent build leaves out, where the negated value names a folder inside the one legacy/ names', async () => {
    const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()), ...projectFiles } })
    const owed = ['src/index.js']

    expect(await filesReportingOurRule(projectDir, ['legacy/', '!legacy/keep/'])).toStrictEqual({ editor: owed, agent: owed })
  })
})

// The registry's plugins are shared by every config this process builds, and a team's plugins by
// every config the team builds, so the merge works on copies.
describe('merging', () => {
  it.each(PROJECTS)(
    "changes no plugin object it is given: none of ours, of the installed plugins, or of the team's, in a project $project",
    ({ projectDir }) => {
      const teamPlugins = {
        '@typescript-eslint': installedEslintPlugin('@typescript-eslint'),
        react: installedEslintPlugin('react'),
        unicorn: installedEslintPlugin('unicorn'),
        'react-hooks': buildFakePlugin(['rules-of-hooks'], { meta: { name: 'team-react-hooks', version: TEAM_PLUGIN_VERSION } }),
        local: buildFakePlugin(['team-only']),
      }
      const watched = [
        ...Object.entries(eslintPluginRegistry).map(([prefix, plugin]) => ({ label: `ours under ${prefix}`, snapshot: snapshotOf(plugin) })),
        ...Object.entries(eslintPlugins).map(([prefix, plugin]) => ({ label: `installed under ${prefix}`, snapshot: snapshotOf(plugin) })),
        ...Object.entries(teamPlugins).map(([prefix, plugin]) => ({ label: `the team's under ${prefix}`, snapshot: snapshotOf(plugin) })),
      ]
      const { eslint } = defineLintRules(buildEveryRulesetLintRules(projectDir)).editorRulesets
      mergedBesideATeamOxlintConfigSettingNoRule([buildTeamEslintBlock('team', { plugins: teamPlugins })], eslint)

      expect(watched.flatMap(({ label, snapshot }) => changesSince(snapshot).map((change) => `${label}: ${change}`))).toStrictEqual([])
    },
  )
})
