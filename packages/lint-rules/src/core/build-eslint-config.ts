import { type Catalog, isOxlintRoute, type OxlintRoute, routeOf, type RuleRoute, type SuppressionMode } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { pluginPrefixOf, ruleNameOf } from '@workspace/rule-data/rule-id-parts'
import { type ESLint, Linter, type Rule } from 'eslint'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { isEslintRoute, isSuppressionRoute, type SuppressionRoute, twinsOf } from './catalog-lookups.ts'
import { withCompatLayerWhereNeeded } from './eslint-compat.ts'
import {
  asFilesEntry,
  CONSUMER_CONFIG_FILES,
  eslintGlobalIgnoresOf,
  type FileTest,
  filesEntryAlsoMatching,
  filesMatchingAll,
  JS_AND_TS_FILES,
  matchesOnlyJsAndTs,
  TS_FILES,
} from './eslint-file-types.ts'
import { type NamesOffWhere, offBlocksOf, rulesOff, twinsOffName } from './eslint-off-blocks.ts'
import { buildEslintSettings } from './eslint-settings.ts'
import { bothOf, EVERY_FILE, eitherOf, type FilesCondition, type FilesEntry, filesAndIgnoresOf, filesInScopeOf, globsOf, NO_FILE } from './file-conditions.ts'
import { SVELTE_RUNES, TEST_RUNNER_GLOBALS } from './framework-globals.ts'
import { normalizeGlob } from './globs.ts'
import type { LintRulesInput } from './lint-rules-input.ts'
import type { ProjectFacts } from './project-facts.ts'
import {
  type EnvChanges,
  type FileOverrideLayer,
  layersKeepingRules,
  OFF_SETTING,
  type OptionsInFiles,
  type RuleLayers,
  type RuleSetting,
  type RuleSettings,
  ruleEntryOf,
  ruleIdsOnIn,
  settingsOn,
  settingsWithout,
  type SuppressionLayer,
  tsFileRulesOf,
} from './resolve-rule-layers.ts'
import {
  agentBuildLayersOf,
  entryStatements,
  type LayerStatements,
  statedIn,
  topLevelStatements,
  type TwinPair,
  twinPairsNamedIn,
  whatTheDecidingPartStates,
} from './twin-pairs.ts'
import { ourOxlintPartOf, whereOurOxlintPartRuns } from './where-our-parts-run.ts'

/** ESLint plugins keyed by rule-ID prefix. */
export type EslintPluginRegistry = Readonly<Record<string, ESLint.Plugin>>

export type EslintSettings = NonNullable<Linter.Config['settings']>

export type TypeInformationSwitch = 'on' | 'off'

/** `files` null matches every file; globs are read from the project root. */
export type TeamTypeInformationBlock = {
  readonly switches: TypeInformationSwitch
  readonly files: readonly FilesEntry[] | null
  readonly ignores: readonly string[]
}

export type TypeInformation =
  | {
      readonly from: 'ours'
      readonly tsconfigRootDir: string
      /** By absolute path, asked as ESLint lints the file: a TS file our project service finds no tsconfig for. */
      readonly isOutsideEveryTsconfig: FileTest
    }
  | { readonly from: 'the team'; readonly blocks: readonly TeamTypeInformationBlock[] }

/** Comes last and turns each of its rules off, so no earlier block can run one. */
type OffSwitch = { readonly name: string; readonly ruleIds: readonly string[] }

/** Every rule map of `layers` holds only the rules ESLint is to state. */
export type EslintBlocksSource = {
  readonly layers: RuleLayers
  /** One object per prefix, the same one any other block registers there. */
  readonly plugins: ReadonlyMap<string, ESLint.Plugin>
  /** null leaves ESLint's own setting, and any the team gives, in force. */
  readonly linterOptions: Linter.LinterOptions | null
  readonly settings: EslintSettings
  readonly typeInformation: TypeInformation
  /** Whether typescript-eslint's extension replaces its core rule on TS files: only where no oxlint runs. */
  readonly twinsOnTsFiles: boolean
  readonly offSwitch: OffSwitch
}

export type BlocksBeforeTheOffSwitch = {
  readonly globalIgnores: readonly Linter.Config[]
  readonly base: Linter.Config
  readonly afterTheBase: readonly Linter.Config[]
}

export type PluginNeeds = {
  /** Rule names our blocks run, whose module must be ours. */
  readonly ruleNamesRun: ReadonlyMap<string, readonly string[]>
  /** Rule names a suppression may name, which need at least a do-nothing definition. */
  readonly ruleNamesStubbed: ReadonlyMap<string, readonly string[]>
}

type EslintSetting = { readonly route: RuleRoute; readonly setting: RuleSetting }

/** A rule with its own files or ignores gets its own block; a typed rule is kept to TS files. */
type Placement = 'plain' | 'typed' | 'scoped'

type PluginRule = { readonly prefix: string; readonly ruleName: string }

type Globs = readonly string[]

/** Files, ignores and rules always given, so the team's typed files can narrow them. */
type ScopedBlock = Linter.Config & {
  readonly name: string
  readonly files: FilesEntry[]
  readonly ignores: string[]
  readonly rules: Linter.RulesRecord
}

type BlockScope = Pick<ScopedBlock, 'name' | 'files' | 'ignores'>

/** `rulesWithoutTypes` is what it states within a team block that takes type information away. */
type TypedBlock = { readonly block: ScopedBlock; readonly rulesWithoutTypes: Linter.RulesRecord }

/** A core rule ESLint takes over from oxlint, and the typescript-eslint extension that replaces it on TS files. */
type Takeover = {
  readonly core: RuleRoute
  readonly extension: RuleRoute
  readonly onTsFiles: RuleSetting
  /** null where the layer below's stands. */
  readonly elsewhere: RuleSetting | null
  /** Where a team takes type information away; null where no layer of ours runs the core rule. */
  readonly withoutTypes: RuleSetting | null
  /** When set, the extension runs on every TS file the layer's plain rules reach, not only the core rule's files. */
  readonly decidedByTheExtension: boolean
}

type LayerRules = { readonly settings: readonly EslintSetting[]; readonly takeovers: readonly Takeover[] }

/** An untyped rule the catalog splits by types with a typed one (`splitByTypesWith`). */
type SplitByTypes = { readonly untyped: RuleRoute; readonly typed: RuleRoute }

/** Off where the typed partner runs, and at its setting where a team block takes type information away. */
type UntypedStatement = { readonly route: RuleRoute; readonly withTypes: RuleSetting; readonly withoutTypes: RuleSetting }

type EntryRules = { readonly rules: LayerRules; readonly onTsFiles: readonly EslintSetting[]; readonly untyped: readonly UntypedStatement[] }

type EntryBlocksSource = EntryRules & { readonly layer: FileOverrideLayer }

type LayerRulesAndTsFiles = Pick<EntryRules, 'rules' | 'onTsFiles'>

/** What each entry is resolved against: the top level's statements and rules, and the rules the catalog splits by types. */
type BelowEachEntry = { readonly stated: LayerStatements; readonly rules: LayerRules; readonly splits: readonly SplitByTypes[] }

/** The names of a layer's blocks start with the prefix, and each block is kept to the layer's files. */
type BlockPlace = { readonly namePrefix: string; readonly layerFiles: readonly Globs[] }

/** Whether the top level's typed block is needed, and the settings each layer banning suppressions takes in test files. */
type AcrossTheLayers = { readonly runsTypedRule: boolean; readonly inTestFiles: readonly SettingInTestFiles[] }

type BlocksSource = Omit<EslintBlocksSource, 'offSwitch'>

type InlineConfigGuard = Pick<Linter.Config, 'linterOptions'>

type GlobalsChange = { readonly name: string; readonly files: FilesCondition; readonly globals: Linter.Globals }

/** The config ESLint checks a rule entry's options in, and the ID its refusal names. */
type OptionsProbe = { readonly probedId: string; readonly config: Linter.Config[] }

/** A rule `allowSuppressions` decides, and the options it takes in test files while suppressions are banned. */
type SettingInTestFiles = { readonly route: RuleRoute; readonly files: Globs; readonly options: readonly unknown[] }

const BLOCK = 'agents-inc'
const BASE_BLOCK = `${BLOCK}/base`
const SVELTE_RUNES_BLOCK = `${BLOCK}/svelte-runes`
const TEST_RUNNER_GLOBALS_BLOCK = `${BLOCK}/test-runner-globals`
const RUNTIME_GLOBALS = 'runtime-globals'
const RUNTIME_GLOBALS_BLOCK = `${BLOCK}/${RUNTIME_GLOBALS}`
const NO_ENV_CHANGES: EnvChanges = { enabled: [], disabled: [] }
const OXLINT_RULES_OFF = 'oxlint-rules-off'
const WITHOUT_TYPES = 'without-types'
const TS_EXTENSIONS = 'ts-extensions'
const TYPED_TS_EXTENSIONS = 'typed-ts-extensions'
const TEST_FILES = 'test-files'
const OPTIONS_IN_FILES = 'options-in-files'
// A plugin holding a do-nothing rule with another rule's meta, for ESLint to check options against.
const OPTIONS_PROBE_PLUGIN = 'options-probe'
const OPTIONS_PROBE_RULE = 'rule'
const OPTIONS_PROBE_ID = `${OPTIONS_PROBE_PLUGIN}/${OPTIONS_PROBE_RULE}`
const OPTIONS_PROBE_FILE = 'options-probe.js'
const RULE_NAME_SEPARATOR = '/'

const DO_NOTHING_RULE: Rule.RuleModule = { meta: { schema: false }, create: listeningToNothing }

const NO_TEAM_PLUGINS: ReadonlyMap<string, ESLint.Plugin> = new Map()
const NO_UNTYPED_STATEMENT: readonly UntypedStatement[] = []
const NO_RULE_NAMES: ReadonlyMap<string, readonly string[]> = new Map()
// Settings for TS files alone exist only beside oxlint, where no core rule is taken over.
const NO_LAYER_RULES: LayerRules = { settings: [], takeovers: [] }

/** Blocks in order: global ignores, base, Svelte runes, test globals, typed, scopes, file overrides, extension offs, then the oxlint off-switch. */
export function buildEslintConfig(
  lintRules: LintRulesInput,
  catalog: Readonly<Catalog>,
  plugins: EslintPluginRegistry,
  projectFacts: ProjectFacts,
): Linter.Config[] {
  const layers = agentBuildLayersOf(lintRules, catalog)
  const source: EslintBlocksSource = {
    layers: layersKeepingRules(layers, ({ id }) => isEslintRoute(routeOf(id, catalog))),
    plugins: agentPluginsOf(plugins, catalog),
    linterOptions: agentLinterOptionsOf(layers.suppressionMode),
    settings: buildEslintSettings(projectFacts),
    typeInformation: { from: 'ours', tsconfigRootDir: lintRules.tsconfigRootDir, isOutsideEveryTsconfig: projectFacts.isOutsideEveryTsconfig },
    // Sub-agents always run oxlint, which runs every core rule ESLint would otherwise take over.
    twinsOnTsFiles: false,
    offSwitch: { name: OXLINT_RULES_OFF, ruleIds: oxlintRoutedRuleIdsAndAliases(catalog) },
  }
  const { globalIgnores, base, afterTheBase } = eslintBlocksBeforeTheOffSwitch(source, catalog)
  return [...globalIgnores, base, ...afterTheBase, ...extensionsOffWhereOxlintRunsTheirCore(layers, source.layers, catalog), offSwitchBlock(source.offSwitch)]
}

/** The agent build reads no team config, so each plugin is ours, with a stub for each oxlint-run rule's names. */
function agentPluginsOf(plugins: EslintPluginRegistry, catalog: Readonly<Catalog>): ReadonlyMap<string, ESLint.Plugin> {
  return pluginsForEveryBlock(plugins, NO_TEAM_PLUGINS, { ruleNamesRun: NO_RULE_NAMES, ruleNamesStubbed: oxlintRuleNamesByPrefix(catalog) })
}

/** oxlint runs a core rule and its typescript-eslint extension as one rule, so the extension is off wherever our oxlint part runs that core rule. */
export function extensionsOffWhereOxlintRunsTheirCore(layers: RuleLayers, eslintLayers: RuleLayers, catalog: Readonly<Catalog>): Linter.Config[] {
  const whereOxlintRuns = whereOurOxlintPartRunsEach(layers, catalog)
  const offs = ruleIdsOnIn(eslintLayers).map((ruleId) => offWhereOxlintRunsACoreItExtends(ruleId, whereOxlintRuns, catalog))
  return offBlocksOf(offs, twinsOffName)
}

function offWhereOxlintRunsACoreItExtends(ruleId: string, whereOxlintRuns: (ruleId: string) => FilesCondition, catalog: Readonly<Catalog>): NamesOffWhere {
  const coresItExtends = twinsOf(routeOf(ruleId, catalog), catalog)
  return { names: [ruleId], where: eitherOf(...coresItExtends.map(whereOxlintRuns)) }
}

function whereOurOxlintPartRunsEach(layers: RuleLayers, catalog: Readonly<Catalog>): (ruleId: string) => FilesCondition {
  const oxlintLayers = layersKeepingRules(layers, ({ id }) => isOxlintRoute(routeOf(id, catalog)))
  const ourOxlintPart = ourOxlintPartOf(oxlintLayers, catalog)
  const turnedOn = ruleIdsOnIn(oxlintLayers)
  return (ruleId) => (turnedOn.includes(ruleId) ? whereOurOxlintPartRuns(ruleId, ourOxlintPart, catalog) : NO_FILE)
}

export function eslintBlocksBeforeTheOffSwitch(source: BlocksSource, catalog: Readonly<Catalog>): BlocksBeforeTheOffSwitch {
  const { layers } = source
  const topLevelStated = topLevelStatements(layers)
  const topLevelRules = layerRulesOf(topLevelStated, null, source, catalog)
  const topLevelOnTsFiles = eslintSettingsOf(tsFileRulesOf(layers), catalog)
  const splits = splitsByTypesIn(catalog)
  const entries = layers.fileOverrides.map((layer) => entryBlocksSourceOf(layer, { stated: topLevelStated, rules: topLevelRules, splits }, source, catalog))
  const topLevel: EntryRules = { rules: topLevelRules, onTsFiles: topLevelOnTsFiles, untyped: untypedStatementsAtTheTopLevel(splits, topLevelRules) }
  const across: AcrossTheLayers = { runsTypedRule: runsAnyTypedRule([topLevel, ...entries]), inTestFiles: settingsInTestFilesWhileBanned(catalog) }
  return {
    globalIgnores: globalIgnoresBlocks(eslintGlobalIgnoresOf(layers)),
    base: baseBlock(layers.env, eslintRuleMap(settingsPlaced('plain', topLevelRules.settings)), source),
    afterTheBase: [
      svelteRunesBlock(),
      testRunnerGlobalsBlock(),
      ...topLevelBlocksAfterTheBase(topLevel, across, source),
      ...entries.flatMap((entry, index) => fileOverrideBlocks(entry, index, source, across.inTestFiles)),
    ],
  }
}

/** In order: the base block's takeovers, the typed block, then the top level's scoped rules, rules on TS files alone, options in files and settings in test files. */
function topLevelBlocksAfterTheBase({ rules, onTsFiles, untyped }: EntryRules, { runsTypedRule, inTestFiles }: AcrossTheLayers, { layers, typeInformation }: BlocksSource): Linter.Config[] {
  const suppressions: SuppressionLayer = { mode: layers.suppressionMode, rules: layers.rules }
  return [
    ...blocksTakingOverOnTsFiles({ name: BASE_BLOCK, files: [JS_AND_TS_FILES], ignores: [] }, takeoversAfterThePlainBlock(rules), typeInformation),
    ...typedBlocks(typeInformation, settingsPlaced('typed', rules.settings), untyped, runsTypedRule),
    ...blocksOfScopedRules(`${BLOCK}/scope`, [], rules, typeInformation),
    ...blocksOnTsFilesAlone(`${BLOCK}/scope`, [], onTsFiles, typeInformation),
    ...blocksOfOptionsInFiles(`${BLOCK}/${OPTIONS_IN_FILES}`, [], rules.settings, typeInformation),
    ...blocksInTestFilesWhileBanned({ namePrefix: `${BLOCK}/${TEST_FILES}`, layerFiles: [] }, suppressions, inTestFiles, typeInformation),
  ]
}

function entryBlocksSourceOf(layer: FileOverrideLayer, below: BelowEachEntry, source: BlocksSource, catalog: Readonly<Catalog>): EntryBlocksSource {
  const rules = layerRulesOf(entryStatements(layer), below.stated, source, catalog)
  return { layer, rules, onTsFiles: eslintSettingsOf(tsFileRulesOf(layer), catalog), untyped: untypedStatementsOfAnEntry(below.splits, rules, below.rules) }
}

function runsAnyTypedRule(layers: readonly LayerRulesAndTsFiles[]): boolean {
  return layers.some(({ rules, onTsFiles }) => runsATypedRule(rules) || runsATypedSetting(onTsFiles))
}

function offSwitchBlock({ name, ruleIds }: OffSwitch): Linter.Config {
  return { name: `${BLOCK}/${name}`, rules: rulesOff(ruleIds) }
}

/** One plugin object per prefix, since ESLint throws "Cannot redefine plugin" on two. A team's object is the base, with our modules for the rules we run and do-nothing stubs for names a suppression may need. Plugins are copied, never mutated. */
export function pluginsForEveryBlock(
  registry: EslintPluginRegistry,
  teamPlugins: ReadonlyMap<string, ESLint.Plugin>,
  needs: PluginNeeds,
): ReadonlyMap<string, ESLint.Plugin> {
  const prefixes = [...new Set([...Object.keys(registry), ...needs.ruleNamesStubbed.keys()])]
  return new Map(
    prefixes.map((prefix): [string, ESLint.Plugin] => [
      prefix,
      pluginUnder(prefix, registry, teamPlugins.get(prefix), needs),
    ]),
  )
}

/** oxlint honours a suppression only under its own name (measured, 1.87), so that name is listed too, even where the ID's plugin does not define it. */
export function oxlintRuleNamesByPrefix(catalog: Readonly<Catalog>): ReadonlyMap<string, readonly string[]> {
  const oxlintRoutes = catalog.rules.values().toArray().filter(isOxlintRoute)
  return ruleNamesByPrefix(oxlintRoutes.flatMap((route) => [route.id, ...oxlintsNameUnderTheIdsPrefix(route)]))
}

function oxlintsNameUnderTheIdsPrefix({ id, oxlintName }: Readonly<OxlintRoute>): string[] {
  const prefix = pluginPrefixOf(id)
  if (prefix === null) return []
  const underTheIdsPrefix = `${prefix}${RULE_NAME_SEPARATOR}${ruleNameOf(oxlintName)}`
  return underTheIdsPrefix === id ? [] : [underTheIdsPrefix]
}

export function ruleNamesByPrefix(ruleIds: readonly string[]): ReadonlyMap<string, readonly string[]> {
  const pluginRules = ruleIds.flatMap(pluginRuleOf)
  return new Map(prefixesOf(pluginRules).map((prefix) => [prefix, ruleNamesUnder(prefix, pluginRules)]))
}

/** The base block's, which every JS and TS file of the agent build has unless an entry sets its own. The runner checks unused suppressions itself: each engine flags the other's as unused. */
export function agentLinterOptionsOf(mode: SuppressionMode): Linter.LinterOptions {
  return { reportUnusedDisableDirectives: 'off', noInlineConfig: readsNoDirectivesIn(mode) }
}

/** ESLint applies directives before any rule runs, so a blanket `eslint-disable` would switch the suppression ban off for its file (measured, ESLint 10.12). */
function readsNoDirectivesIn(mode: SuppressionMode): boolean {
  return mode === 'banned'
}

function oxlintRoutedRuleIdsAndAliases(catalog: Readonly<Catalog>): string[] {
  return catalog.rules.values().toArray().filter(isOxlintRoute).flatMap((route) => [route.id, ...route.eslintAliases])
}

function globalIgnoresBlocks(ignores: Globs): Linter.Config[] {
  if (ignores.length === 0) return []
  return [{ name: `${BLOCK}/ignores`, ignores: [...ignores] }]
}

function baseBlock(
  env: readonly string[],
  rules: Readonly<Linter.RulesRecord>,
  { plugins, linterOptions, settings }: Pick<EslintBlocksSource, 'plugins' | 'linterOptions' | 'settings'>,
): Linter.Config {
  return {
    name: BASE_BLOCK,
    files: [JS_AND_TS_FILES],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module' },
      globals: globalsOf(env),
    },
    ...(linterOptions !== null && { linterOptions }),
    plugins: Object.fromEntries(plugins),
    settings,
    rules,
  }
}

/** Names only Svelte's JS and TS files: naming .svelte files would make ESLint lint them, which our parser cannot read. */
function svelteRunesBlock(): Linter.Config {
  return { name: SVELTE_RUNES_BLOCK, files: SVELTE_RUNES.files.filter(matchesOnlyJsAndTs), languageOptions: { globals: globalsOfEnv(SVELTE_RUNES.env) } }
}

/** Names JS and TS files alone, so ESLint lints no file it would not lint without it. */
function testRunnerGlobalsBlock(): Linter.Config {
  return { name: TEST_RUNNER_GLOBALS_BLOCK, files: [...TEST_RUNNER_GLOBALS.files], languageOptions: { globals: globalsOf(TEST_RUNNER_GLOBALS.envs) } }
}

function typedBlocks(
  typeInformation: TypeInformation,
  rules: readonly EslintSetting[],
  untyped: readonly UntypedStatement[],
  runsTypedRule: boolean,
): Linter.Config[] {
  if (!runsTypedRule) return []
  const block: ScopedBlock = {
    name: `${BLOCK}/typed`,
    files: [TS_FILES],
    ignores: [...filesWithoutTypeInformation(typeInformation)],
    rules: eslintRuleMap(rules),
  }
  return typedBlocksGiven(typeInformation, typedBlockOf(block, untyped))
}

// typescript-eslint builds one project service per process (measured, typescript-estree 8.71): beside the team's
// type information ours would be fatal, and a default project would break later packages in a monorepo.
function typedBlocksGiven(typeInformation: TypeInformation, typed: TypedBlock): Linter.Config[] {
  switch (typeInformation.from) {
    case 'the team':
      return keptToTypedFiles(typed, typeInformation)
    case 'ours':
      return [withOurProjectService(keptToFilesATsconfigTakesIn(typed.block, typeInformation.isOutsideEveryTsconfig), typeInformation.tsconfigRootDir)]
    default: {
      const unhandled: never = typeInformation
      return unhandled
    }
  }
}

function withOurProjectService(block: Readonly<ScopedBlock>, tsconfigRootDir: string): Linter.Config {
  return { ...block, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir } } }
}

/** A typed rule on a file without type information is a fatal parse error, so those files are left out. With team type information, the consumer's config files are left out at any depth; with ours, the files of each typed block keep them out (keptToFilesATsconfigTakesIn). */
function filesWithoutTypeInformation(typeInformation: TypeInformation): Globs {
  switch (typeInformation.from) {
    case 'the team':
      return CONSUMER_CONFIG_FILES
    case 'ours':
      return []
    default: {
      const unhandled: never = typeInformation
      return unhandled
    }
  }
}

function typedBlockOf(block: Readonly<ScopedBlock>, untyped: readonly UntypedStatement[]): TypedBlock {
  return {
    block: { ...block, rules: { ...block.rules, ...untypedEntries(untyped, 'withTypes') } },
    rulesWithoutTypes: { ...rulesOff(Object.keys(block.rules)), ...untypedEntries(untyped, 'withoutTypes') },
  }
}

function untypedEntries(untyped: readonly UntypedStatement[], where: 'withTypes' | 'withoutTypes'): Linter.RulesRecord {
  return Object.fromEntries(untyped.map((statement): [string, Linter.RuleEntry] => [statement.route.id, ruleEntryOf(statement[where])]))
}

/** With team type information, one copy per team block that switches it, in the team's order, so the last to apply decides: in a file without types a typed rule ends the whole ESLint run (measured). */
function keptToTypedFiles(typed: TypedBlock, typeInformation: TypeInformation): Linter.Config[] {
  switch (typeInformation.from) {
    case 'ours':
      return [keptToFilesATsconfigTakesIn(typed.block, typeInformation.isOutsideEveryTsconfig)]
    case 'the team':
      return typeInformation.blocks.map((teamBlock) => copyWithin(typed, teamBlock))
    default: {
      const unhandled: never = typeInformation
      return unhandled
    }
  }
}

/** ESLint asks, as it lints each file, whether a tsconfig takes it in, so a TS file made after the config loaded is read as the disk then holds it. */
function keptToFilesATsconfigTakesIn(block: Readonly<ScopedBlock>, isOutsideEveryTsconfig: FileTest): ScopedBlock {
  const isTakenInByATsconfig: FileTest = (file) => !isOutsideEveryTsconfig(file)
  return { ...block, files: block.files.map((entry) => filesEntryAlsoMatching(entry, isTakenInByATsconfig)) }
}

function copyWithin({ block, rulesWithoutTypes }: TypedBlock, teamBlock: TeamTypeInformationBlock): Linter.Config {
  const within = withinTeamFiles(block, teamBlock)
  if (teamBlock.switches === 'on') return within
  return { ...within, name: `${block.name}/${WITHOUT_TYPES}`, rules: rulesWithoutTypes }
}

/** ESLint ANDs the globs inside a nested array. The team's ignores come first: ours negate nothing, so a team negation cannot take back a file ours leave out. */
function withinTeamFiles(block: Readonly<ScopedBlock>, { files, ignores }: TeamTypeInformationBlock): ScopedBlock {
  return { ...block, files: filesMatchedByBoth(block.files, files), ignores: [...ignores, ...block.ignores] }
}

export function filesMatchedByBoth(ours: readonly FilesEntry[], theirs: readonly FilesEntry[] | null): FilesEntry[] {
  if (theirs === null) return [...ours]
  return ours.flatMap((ourEntry) => theirs.map((theirEntry) => [...globsOf(ourEntry), ...globsOf(theirEntry)]))
}

function blocksOfScopedRules(namePrefix: string, layerFiles: readonly Globs[], rules: LayerRules, typeInformation: TypeInformation): Linter.Config[] {
  return settingsPlaced('scoped', rules.settings).flatMap((scoped) => scopeBlocks({ namePrefix, layerFiles }, scoped, rules, typeInformation))
}

function scopeBlocks({ namePrefix, layerFiles }: BlockPlace, scoped: EslintSetting, { takeovers }: LayerRules, typeInformation: TypeInformation): Linter.Config[] {
  const { route, setting } = scoped
  const block: ScopedBlock = {
    name: `${namePrefix}/${route.id}`,
    files: filesMatchingAll([...layerFiles, ...ruleFilesOf(scoped)]),
    ignores: [...ruleIgnoresOf(scoped, typeInformation)],
    rules: { [route.id]: ruleEntryOf(setting) },
  }
  if (route.typed) return keptToTypedFiles(typedBlockOf(block, NO_UNTYPED_STATEMENT), typeInformation)
  const takeoversOfTheRule = takeovers.filter(({ core }) => core.id === route.id)
  return [withoutEmptyIgnores(block), ...blocksTakingOverOnTsFiles(block, takeoversOfTheRule, typeInformation)]
}

function withoutEmptyIgnores(block: Readonly<ScopedBlock>): Linter.Config {
  const { ignores, ...withoutIgnores } = block
  return ignores.length === 0 ? withoutIgnores : block
}

function ruleFilesOf({ route, setting }: EslintSetting): Globs[] {
  const shippedFiles = setting.files === null ? [] : [setting.files]
  const typedFiles = route.typed ? [[TS_FILES]] : []
  return [...shippedFiles, ...typedFiles]
}

function ruleIgnoresOf({ route, setting }: EslintSetting, typeInformation: TypeInformation): Globs {
  const shippedIgnores = setting.ignores === null ? [] : setting.ignores
  const typedIgnores = route.typed ? filesWithoutTypeInformation(typeInformation) : []
  return [...shippedIgnores, ...typedIgnores]
}

/** The entry's rules and ruleset changes are merged first (`entryStatements`), so a rule the entry sets never also lands in a later scope block. */
function fileOverrideBlocks({ layer, rules, onTsFiles, untyped }: EntryBlocksSource, index: number, source: BlocksSource, inTestFiles: readonly SettingInTestFiles[]): Linter.Config[] {
  const entry: BlockScope = { name: `${BLOCK}/file-overrides/${index}`, files: filesMatchingAll([layer.files]), ignores: [] }
  const { settings } = rules
  return [
    ...entryBlockIfNotEmpty(entry, globalsChangeOf(layer.env, source.layers.env), inlineConfigGuardOf(layer), entryRuleMap(rules)),
    ...blocksTakingOverOnTsFiles(entry, takeoversAfterThePlainBlock(rules), source.typeInformation),
    ...entryTypedBlocksIfNotEmpty(`${entry.name}/typed`, layer.files, { rules: settingsPlaced('typed', settings), untyped }, source.typeInformation),
    ...blocksOfScopedRules(`${entry.name}/scope`, [layer.files], rules, source.typeInformation),
    ...blocksOnTsFilesAlone(`${entry.name}/scope`, [layer.files], onTsFiles, source.typeInformation),
    ...blocksOfOptionsInFiles(`${entry.name}/${OPTIONS_IN_FILES}`, [layer.files], settings, source.typeInformation),
    ...blocksInTestFilesWhileBanned({ namePrefix: `${entry.name}/${TEST_FILES}`, layerFiles: [layer.files] }, layer.suppressions, inTestFiles, source.typeInformation),
  ]
}

/** While suppressions are banned a test may still assert a type error: each rule with a setting for test files takes it there, after the layer's other blocks. */
function blocksInTestFilesWhileBanned(
  { namePrefix, layerFiles }: BlockPlace,
  suppressions: SuppressionLayer | undefined,
  inTestFiles: readonly SettingInTestFiles[],
  typeInformation: TypeInformation,
): Linter.Config[] {
  if (suppressions?.mode !== 'banned') return []
  return inTestFiles.flatMap((inTests) =>
    scopeBlocks({ namePrefix, layerFiles: [...layerFiles, inTests.files] }, layerSettingInTestFiles(inTests, suppressions.rules), NO_LAYER_RULES, typeInformation),
  )
}

/** The layer's own setting of the rule, at the options it takes in test files. */
function layerSettingInTestFiles({ route, options }: SettingInTestFiles, layerRules: RuleSettings): EslintSetting {
  const setting = foundOr(layerRules[route.id], `${route.id}: allowSuppressions decides it, so the layer banning suppressions states it`)
  return { route, setting: { ...setting, options } }
}

function settingsInTestFilesWhileBanned(catalog: Readonly<Catalog>): SettingInTestFiles[] {
  return catalog.rules.values().toArray().filter(isSuppressionRoute).flatMap(settingInTestFilesWhileBannedOf)
}

/** Only this build writes a setting for test files, so a rule with one must be routed to ESLint. */
function settingInTestFilesWhileBannedOf(route: Readonly<SuppressionRoute>): SettingInTestFiles[] {
  const { bannedInTestFiles } = route.shipped.whenSuppressions
  if (bannedInTestFiles === undefined) return []
  if (!isEslintRoute(route)) throw new Error(`${route.id}: given a setting for test files while suppressions are banned, which only the ESLint build writes, so the catalog must route it to ESLint`)
  return [{ route, files: bannedInTestFiles.files.map(normalizeGlob), options: bannedInTestFiles.options }]
}

/** A rule with other options in some of its files restates them there, in a block each after the layer's others, in order, within its own files and ignores. */
function blocksOfOptionsInFiles(namePrefix: string, layerFiles: readonly Globs[], settings: readonly EslintSetting[], typeInformation: TypeInformation): Linter.Config[] {
  return settings.flatMap((setting) => blocksOfItsOptionsInFiles(namePrefix, layerFiles, setting, typeInformation))
}

function blocksOfItsOptionsInFiles(namePrefix: string, layerFiles: readonly Globs[], { route, setting }: EslintSetting, typeInformation: TypeInformation): Linter.Config[] {
  return optionsInFilesOf(setting).flatMap((inFiles, index) => {
    const restated: EslintSetting = { route, setting: settingInFiles(setting, inFiles) }
    return scopeBlocks({ namePrefix: `${namePrefix}/${String(index)}`, layerFiles: [...layerFiles, ...inFiles.files] }, restated, NO_LAYER_RULES, typeInformation)
  })
}

function optionsInFilesOf({ optionsInFiles }: RuleSetting): readonly OptionsInFiles[] {
  return optionsInFiles === undefined ? [] : optionsInFiles
}

function settingInFiles({ severity, files, ignores }: RuleSetting, inFiles: OptionsInFiles): RuleSetting {
  const ownIgnores = ignores === null ? [] : ignores
  return { severity, options: inFiles.options, files, ignores: [...ownIgnores, ...inFiles.ignores] }
}

/** Beside oxlint, a layer stating both names of a twin pair gives the extension its setting on TS files alone, in a block per rule after the layer's others. */
function blocksOnTsFilesAlone(namePrefix: string, layerFiles: readonly Globs[], onTsFiles: readonly EslintSetting[], typeInformation: TypeInformation): Linter.Config[] {
  return onTsFiles.flatMap((setting) => scopeBlocks({ namePrefix, layerFiles: [...layerFiles, [TS_FILES]] }, setting, NO_LAYER_RULES, typeInformation))
}

/** Names every JS and TS file of the entry, so its inline config guard reaches them all. */
function entryBlockIfNotEmpty(
  { name, files }: BlockScope,
  globalsChange: Readonly<Linter.Globals>,
  guard: InlineConfigGuard,
  rules: Readonly<Linter.RulesRecord>,
): Linter.Config[] {
  const changesGlobals = Object.keys(globalsChange).length > 0
  if (!changesGlobals && guard.linterOptions === undefined && Object.keys(rules).length === 0) return []
  return [
    {
      name,
      files: [...files],
      ...(changesGlobals && { languageOptions: { globals: globalsChange } }),
      ...guard,
      rules,
    },
  ]
}

function entryTypedBlocksIfNotEmpty(
  name: string,
  files: Globs,
  { rules, untyped }: Pick<EntryRules, 'untyped'> & { readonly rules: readonly EslintSetting[] },
  typeInformation: TypeInformation,
): Linter.Config[] {
  if (rules.length === 0 && untyped.length === 0) return []
  const block: ScopedBlock = {
    name,
    files: filesMatchingAll([files, [TS_FILES]]),
    ignores: [...filesWithoutTypeInformation(typeInformation)],
    rules: eslintRuleMap(rules),
  }
  return keptToTypedFiles(typedBlockOf(block, untyped), typeInformation)
}

function splitsByTypesIn(catalog: Readonly<Catalog>): SplitByTypes[] {
  return catalog.rules.values().flatMap((route) => splitOf(route, catalog)).toArray()
}

function splitOf(untyped: Readonly<RuleRoute>, catalog: Readonly<Catalog>): SplitByTypes[] {
  const typedId = typedPartnerOf(untyped)
  if (typedId === null) return []
  const split = { untyped, typed: routeOf(typedId, catalog) }
  if (!isSplitAsTheDataGuarantees(split)) {
    throw new Error(`${untyped.id}: split by types with ${split.typed.id}, so both run in ESLint on every file it lints, ${split.typed.id} with type information and ${untyped.id} without`)
  }
  return [split]
}

function typedPartnerOf({ shipped }: Readonly<RuleRoute>): string | null {
  return shipped === null ? null : shipped.splitByTypesWith
}

/** A rule oxlint runs, or one kept to some files, would report beside its partner or leave files to neither. */
function isSplitAsTheDataGuarantees({ untyped, typed }: SplitByTypes): boolean {
  return !untyped.typed && typed.typed && [untyped, typed].every((route) => isEslintRoute(route) && shipsForEveryFile(route))
}

function shipsForEveryFile({ shipped }: Readonly<RuleRoute>): boolean {
  return shipped === null || (shipped.files === null && shipped.ignores === null)
}

function untypedStatementsAtTheTopLevel(splits: readonly SplitByTypes[], topLevel: LayerRules): UntypedStatement[] {
  return splits.flatMap(({ untyped, typed }) => {
    const untypedSetting = settingOn(topLevel, untyped)
    if (untypedSetting === null || settingOn(topLevel, typed) === null) return []
    return { route: untyped, withTypes: OFF_SETTING, withoutTypes: untypedSetting }
  })
}

/** An entry's blocks come after the top level's, so restating the untyped rule would run it beside the typed one, and turning the typed one off would leave the untyped one off from the top level's typed block. */
function untypedStatementsOfAnEntry(splits: readonly SplitByTypes[], entry: LayerRules, topLevel: LayerRules): UntypedStatement[] {
  return splits.flatMap(({ untyped, typed }) => {
    const statesEither = settingIn(entry, untyped) !== null || settingIn(entry, typed) !== null
    const untypedSetting = settingInForce(untyped, entry, topLevel)
    if (!statesEither || untypedSetting === null) return []
    const withTypes = settingInForce(typed, entry, topLevel) === null ? untypedSetting : OFF_SETTING
    return { route: untyped, withTypes, withoutTypes: untypedSetting }
  })
}

function settingInForce(route: Readonly<RuleRoute>, entry: LayerRules, topLevel: LayerRules): RuleSetting | null {
  const stated = settingIn(entry, route)
  return stated === null ? settingOn(topLevel, route) : settingIfOn(stated)
}

function settingOn(layer: LayerRules, route: Readonly<RuleRoute>): RuleSetting | null {
  return settingIfOn(settingIn(layer, route))
}

function settingIfOn(setting: RuleSetting | null): RuleSetting | null {
  return setting === null || setting.severity === 'off' ? null : setting
}

function settingIn({ settings }: LayerRules, route: Readonly<RuleRoute>): RuleSetting | null {
  const found = settings.find((setting) => setting.route.id === route.id)
  return found === undefined ? null : found.setting
}

/** Where no oxlint runs, a core rule and its typescript-eslint extension are one rule: the extension runs on TS files, the core rule elsewhere, never both in one file. */
function layerRulesOf(layer: LayerStatements, below: LayerStatements | null, source: BlocksSource, catalog: Readonly<Catalog>): LayerRules {
  const twinPairs = source.twinsOnTsFiles ? twinPairsNamedIn(layer, catalog) : []
  const takeovers = twinPairs.flatMap((pair) => takeoverOf(pair, layer, below, source))
  const settings = settingsAfterTakeovers(layer.settings, takeovers)
  if (below !== null) return { settings: eslintSettingsOf(settings, catalog), takeovers }
  return { settings: eslintSettingsOf(settingsOn(settings), catalog), takeovers: takeovers.filter(runsEitherName) }
}

/** An extension taken over leaves the layer's settings for its blocks on TS files; its core rule takes the setting it has on the other files. */
function settingsAfterTakeovers(settings: RuleSettings, takeovers: readonly Takeover[]): RuleSettings {
  const takenOver = new Set(takeovers.map(({ extension }) => extension.id))
  return { ...settingsWithout(settings, takenOver), ...coreRulesRestatedBy(takeovers) }
}

function coreRulesRestatedBy(takeovers: readonly Takeover[]): RuleSettings {
  return Object.fromEntries(takeovers.flatMap(({ core, elsewhere }) => (elsewhere === null ? [] : [[core.id, elsewhere]])))
}

/** The highest part of the layer stating either name decides, the consumer's `rules` over the rulesets. None where the extension refuses the core rule's options, which would be a config error; the core rule then runs on TS files too. */
function takeoverOf({ core, extension }: TwinPair, layer: LayerStatements, below: LayerStatements | null, source: BlocksSource): Takeover[] {
  const coreHere = statedIn(layer, core.id)
  const extensionHere = statedIn(layer, extension.id)
  const coreBelow = below === null ? null : statedIn(below, core.id)
  const statesEitherName = coreHere !== null || extensionHere !== null
  const isCoreStatedHereOrBelow = coreHere !== null || coreBelow !== null
  if (!statesEitherName || !isCoreStatedHereOrBelow) return []
  const { decidesTheExtension, decidesTheCore } = whatTheDecidingPartStates({ core, extension }, layer)
  const onTsFiles = decidesTheExtension ? extensionHere : coreHere
  if (onTsFiles === null) throw new Error(`${core.id}: the layer states it or ${extension.id}, so one decides the extension's setting`)
  if (!decidesTheExtension && !acceptsEntry(extension.id, onTsFiles, source.plugins)) return []
  const elsewhere = decidesTheCore ? coreHere : coreSettingTakenFrom(extensionHere, core, source.plugins) ?? coreHere
  return [{ core, extension, onTsFiles, elsewhere, withoutTypes: elsewhere ?? coreBelow, decidedByTheExtension: decidesTheExtension }]
}

function coreSettingTakenFrom(extensionSetting: RuleSetting | null, core: Readonly<RuleRoute>, plugins: ReadonlyMap<string, ESLint.Plugin>): RuleSetting | null {
  if (extensionSetting === null || !acceptsEntry(core.id, extensionSetting, plugins)) return null
  return extensionSetting
}

function runsEitherName({ onTsFiles, elsewhere }: Takeover): boolean {
  return onTsFiles.severity !== 'off' || (elsewhere !== null && elsewhere.severity !== 'off')
}

/** A takeover of a core rule with files of its own follows that rule's block instead. */
function takeoversAfterThePlainBlock({ takeovers }: LayerRules): Takeover[] {
  return takeovers.filter(followsThePlainBlock)
}

function followsThePlainBlock({ core, elsewhere, decidedByTheExtension }: Takeover): boolean {
  return decidedByTheExtension || elsewhere === null || placementOf({ route: core, setting: elsewhere }) === 'plain'
}

/** Blocks after the core rules' block that turn each core rule off on TS files and run its extension. A typed extension is kept to files with type information, so the core rule runs on in the rest. */
function blocksTakingOverOnTsFiles(coreBlock: BlockScope, takeovers: readonly Takeover[], typeInformation: TypeInformation): Linter.Config[] {
  const onTsFiles: BlockScope = { ...coreBlock, files: filesMatchedByBoth(coreBlock.files, [TS_FILES]) }
  return [
    ...untypedTakeoverBlocks(onTsFiles, takeovers.filter(({ extension }) => !extension.typed)),
    ...typedTakeoverBlocks(onTsFiles, takeovers.filter(({ extension }) => extension.typed), typeInformation),
  ]
}

function untypedTakeoverBlocks(onTsFiles: BlockScope, takeovers: readonly Takeover[]): Linter.Config[] {
  if (takeovers.length === 0) return []
  const { name, files, ignores } = onTsFiles
  return [withoutEmptyIgnores({ name: `${name}/${TS_EXTENSIONS}`, files: [...files], ignores: [...ignores], rules: rulesOnTsFiles(takeovers) })]
}

function typedTakeoverBlocks(onTsFiles: BlockScope, takeovers: readonly Takeover[], typeInformation: TypeInformation): Linter.Config[] {
  if (takeovers.length === 0) return []
  const { name, files, ignores } = onTsFiles
  const block: ScopedBlock = {
    name: `${name}/${TYPED_TS_EXTENSIONS}`,
    files: [...files],
    ignores: [...ignores, ...filesWithoutTypeInformation(typeInformation)],
    rules: rulesOnTsFiles(takeovers),
  }
  return keptToTypedFiles({ block, rulesWithoutTypes: rulesBackToTheCore(takeovers) }, typeInformation)
}

function rulesOnTsFiles(takeovers: readonly Takeover[]): Linter.RulesRecord {
  return Object.fromEntries(
    takeovers.flatMap(({ core, extension, onTsFiles }): Array<[string, Linter.RuleEntry]> => [
      [core.id, 'off'],
      [extension.id, ruleEntryOf(onTsFiles)],
    ]),
  )
}

function rulesBackToTheCore(takeovers: readonly Takeover[]): Linter.RulesRecord {
  return Object.fromEntries(takeovers.flatMap(({ core, extension, withoutTypes }) => [[extension.id, 'off'], ...coreEntryWhere(core, withoutTypes)]))
}

function coreEntryWhere(core: Readonly<RuleRoute>, setting: RuleSetting | null): Array<[string, Linter.RuleEntry]> {
  return setting === null ? [] : [[core.id, ruleEntryOf(setting)]]
}

/** Each taken-over extension is off first in every file: it runs on TS files only, from the blocks after, and a statement of it below must not run on JS files beside the core rule. */
function entryRuleMap({ settings, takeovers }: LayerRules): Linter.RulesRecord {
  return { ...rulesOff(takeovers.map(({ extension }) => extension.id)), ...eslintRuleMap(settingsPlaced('plain', settings)) }
}

/** The project service parses every TS file, so it is set up only when some typed rule runs. */
function runsATypedRule({ settings, takeovers }: LayerRules): boolean {
  return runsATypedSetting(settings) || takeovers.some(({ extension, onTsFiles }) => extension.typed && onTsFiles.severity !== 'off')
}

function runsATypedSetting(settings: readonly EslintSetting[]): boolean {
  return settings.some(({ route, setting }) => route.typed && setting.severity !== 'off')
}

/** ESLint refuses options a rule's schema rejects with a config error that ends the whole run (measured), so they are checked first against a do-nothing rule with the same meta. Any other failure is rethrown. */
function acceptsEntry(ruleId: string, setting: RuleSetting, plugins: ReadonlyMap<string, ESLint.Plugin>): boolean {
  const { probedId, config } = optionsProbeOf(ruleId, setting, plugins)
  try {
    // eslint-disable-next-line functional/no-expression-statements -- it is run for the config error ESLint throws on options the rule's schema refuses; on the empty text it lints, it returns no message
    new Linter().verify('', config, { filename: OPTIONS_PROBE_FILE })
    return true
  } catch (error) {
    if (refusesOptions(error, probedId)) return false
    throw new Error(`${ruleId}: ESLint failed to check its options for another reason than refusing them`, { cause: error })
  }
}

/** ESLint's refusal message (measured, ESLint 10.12). */
function refusesOptions(error: unknown, probedId: string): boolean {
  return error instanceof Error && error.message.startsWith(`Key "rules": Key "${probedId}":\n\tValue `)
}

function optionsProbeOf(ruleId: string, setting: RuleSetting, plugins: ReadonlyMap<string, ESLint.Plugin>): OptionsProbe {
  const entry = ruleEntryOf(setting)
  const isCoreRule = pluginRuleOf(ruleId).length === 0
  if (isCoreRule) return { probedId: ruleId, config: [{ rules: { [ruleId]: entry } }] }
  const plugin: ESLint.Plugin = { rules: { [OPTIONS_PROBE_RULE]: runningNothingWithMetaOf(registeredRuleModule(ruleId, plugins)) } }
  return { probedId: OPTIONS_PROBE_ID, config: [{ plugins: { [OPTIONS_PROBE_PLUGIN]: plugin }, rules: { [OPTIONS_PROBE_ID]: entry } }] }
}

function runningNothingWithMetaOf({ meta }: Readonly<Rule.RuleModule>): Rule.RuleModule {
  return { create: listeningToNothing, ...(meta !== undefined && { meta }) }
}

function listeningToNothing(): Rule.RuleListener {
  return {}
}

function registeredRuleModule(ruleId: string, plugins: ReadonlyMap<string, ESLint.Plugin>): Rule.RuleModule {
  const { prefix, ruleName } = foundOr(pluginRuleOf(ruleId).at(0), `${ruleId}: a core rule, which no plugin registers`)
  return ruleModuleOf(plugins.get(prefix), prefix, ruleName)
}

function settingsPlaced(placement: Placement, settings: readonly EslintSetting[]): EslintSetting[] {
  return settings.filter((setting) => placementOf(setting) === placement)
}

function placementOf({ route, setting }: EslintSetting): Placement {
  if (setting.severity === 'off') return 'plain'
  if (setting.files !== null || setting.ignores !== null) return 'scoped'
  return route.typed ? 'typed' : 'plain'
}

function eslintSettingsOf(settings: RuleSettings, catalog: Readonly<Catalog>): EslintSetting[] {
  return Object.entries(settings).map(([id, setting]) => ({ route: routeOf(id, catalog), setting }))
}

function eslintRuleMap(settings: readonly EslintSetting[]): Linter.RulesRecord {
  return Object.fromEntries(
    settings.map(({ route, setting }): [string, Linter.RuleEntry] => [route.id, ruleEntryOf(setting)]),
  )
}

/** An entry that leaves out `allowSuppressions` sets nothing, so the earlier setting stands. */
function inlineConfigGuardOf({ suppressions }: FileOverrideLayer): InlineConfigGuard {
  if (suppressions === undefined) return {}
  return { linterOptions: { noInlineConfig: readsNoDirectivesIn(suppressions.mode) } }
}

/** The ESLint merge gives runtime globals only where a rule of ours that reads them runs, so they are blocks of their own. */
export function runtimeGlobalsBlocksWithin(layers: RuleLayers, where: FilesCondition): Linter.Config[] {
  const changes: GlobalsChange[] = [
    { name: RUNTIME_GLOBALS_BLOCK, files: EVERY_FILE, globals: globalsOf(layers.env) },
    ...layers.fileOverrides.map((layer, index) => entryGlobalsChange(layer, index, layers.env)),
  ]
  return changes.filter(changesAGlobal).flatMap((change) => globalsBlocksWithin(change, bothOf(where, change.files)))
}

function entryGlobalsChange(layer: FileOverrideLayer, index: number, topLevelEnv: readonly string[]): GlobalsChange {
  return {
    name: `${BLOCK}/file-overrides/${String(index)}/${RUNTIME_GLOBALS}`,
    files: filesInScopeOf(layer.files, []),
    globals: globalsChangeOf(layer.env, topLevelEnv),
  }
}

function changesAGlobal({ globals: changed }: GlobalsChange): boolean {
  return Object.keys(changed).length > 0
}

export function layersWithoutRuntimeGlobals(layers: RuleLayers): RuleLayers {
  return { ...layers, env: [], fileOverrides: layers.fileOverrides.map((layer) => ({ ...layer, env: NO_ENV_CHANGES })) }
}

function globalsBlocksWithin({ name, globals: changed }: GlobalsChange, where: FilesCondition): Linter.Config[] {
  return filesAndIgnoresOf(where).map(({ files, ignores }, index) => ({
    name: `${name}/${String(index)}`,
    files: files === null ? [JS_AND_TS_FILES] : files.map(asFilesEntry),
    ...(ignores.length > 0 && { ignores: [...ignores] }),
    languageOptions: { globals: changed },
  }))
}

function globalsOf(envs: readonly string[]): Linter.Globals {
  return Object.fromEntries(envs.flatMap((env) => Object.entries(globalsOfEnv(env))))
}

/** Dropping a runtime switches off only the globals no remaining runtime defines: node and browser share `console`. */
function globalsChangeOf({ enabled, disabled }: EnvChanges, topLevelEnv: readonly string[]): Linter.Globals {
  const remainingEnvs = [...topLevelEnv.filter((env) => !disabled.includes(env)), ...enabled]
  return { ...globalsSwitchedOff(disabled, remainingEnvs), ...globalsOf(enabled) }
}

function globalsSwitchedOff(droppedEnvs: readonly string[], remainingEnvs: readonly string[]): Linter.Globals {
  const stillDefined = globalsOf(remainingEnvs)
  const orphaned = Object.keys(globalsOf(droppedEnvs)).filter((name) => !Object.hasOwn(stillDefined, name))
  return Object.fromEntries(orphaned.map((name): [string, Linter.GlobalConf] => [name, 'off']))
}

function globalsOfEnv(env: string): Readonly<Record<string, boolean>> {
  const [, envGlobals] = foundOr(Object.entries(globals).find(([name]) => name === env), `the globals package defines no env "${env}"`)
  return envGlobals
}

/** ESLint refuses a suppression comment for a rule it has no definition of, so each oxlint-routed rule ESLint lacks gets a do-nothing stub. */
function pluginUnder(
  prefix: string,
  registry: EslintPluginRegistry,
  teamPlugin: Readonly<ESLint.Plugin> | undefined,
  { ruleNamesRun, ruleNamesStubbed }: PluginNeeds,
): ESLint.Plugin {
  const ours = registry[prefix]
  const stubbed = namesUnder(prefix, ruleNamesStubbed)
  if (teamPlugin !== undefined) {
    const withOurModules = withRulesOf(teamPlugin, ours, prefix, namesUnder(prefix, ruleNamesRun))
    return withCompatLayerWhereNeeded(prefix, withStubsFor(withOurModules, stubbed))
  }
  return ours === undefined ? { rules: stubRulesNamed(stubbed) } : withStubsFor(ours, stubbed)
}

function withRulesOf(
  teamPlugin: Readonly<ESLint.Plugin>,
  ours: Readonly<ESLint.Plugin> | undefined,
  prefix: string,
  ruleNames: readonly string[],
): ESLint.Plugin {
  const ourModules = ruleNames.map((ruleName): [string, Rule.RuleModule] => [ruleName, ruleModuleOf(ours, prefix, ruleName)])
  return { ...teamPlugin, rules: { ...teamPlugin.rules, ...Object.fromEntries(ourModules) } }
}

function ruleModuleOf(plugin: Readonly<ESLint.Plugin> | undefined, prefix: string, ruleName: string): Rule.RuleModule {
  return foundOr(plugin?.rules?.[ruleName], `${prefix}/${ruleName}: run in ESLint, yet our plugin under ${prefix} lacks it`)
}

function namesUnder(prefix: string, namesByPrefix: ReadonlyMap<string, readonly string[]>): readonly string[] {
  const names = namesByPrefix.get(prefix)
  return names === undefined ? [] : names
}

function prefixesOf(pluginRules: readonly PluginRule[]): string[] {
  return [...new Set(pluginRules.map(({ prefix }) => prefix))]
}

function ruleNamesUnder(prefix: string, pluginRules: readonly PluginRule[]): string[] {
  return pluginRules.filter((pluginRule) => pluginRule.prefix === prefix).map(({ ruleName }) => ruleName)
}

/** A copy, since the plugin object is shared with whoever else imports it. */
function withStubsFor(plugin: Readonly<ESLint.Plugin>, ruleNames: readonly string[]): ESLint.Plugin {
  const lackedNames = ruleNames.filter((ruleName) => !definesRule(plugin, ruleName))
  if (lackedNames.length === 0) return plugin
  return { ...plugin, rules: { ...plugin.rules, ...stubRulesNamed(lackedNames) } }
}

function definesRule(plugin: Readonly<ESLint.Plugin>, ruleName: string): boolean {
  return plugin.rules !== undefined && Object.hasOwn(plugin.rules, ruleName)
}

function stubRulesNamed(ruleNames: readonly string[]): Record<string, Rule.RuleModule> {
  return Object.fromEntries(ruleNames.map((ruleName): [string, Rule.RuleModule] => [ruleName, DO_NOTHING_RULE]))
}

function pluginRuleOf(id: string): PluginRule[] {
  const prefix = pluginPrefixOf(id)
  return prefix === null ? [] : [{ prefix, ruleName: ruleNameOf(id) }]
}
