import type { Catalog, RuleRoute, SuppressionMode } from '@workspace/rule-data'
import { pluginPrefixOf } from '@workspace/rule-data/rule-id-parts'
import { type ESLint, Linter, type Rule } from 'eslint'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { isEslintRoute, isOxlintRoute, routeOf, twinsOf } from './catalog-lookups.ts'
import { withCompatLayerWhereNeeded } from './eslint-compat.ts'
import { CONSUMER_CONFIG_FILES, eslintGlobalIgnoresOf, filesMatchingAll, JS_AND_TS_FILES, matchesOnlyJsAndTs, TS_FILES } from './eslint-file-types.ts'
import { type NamesOffWhere, offBlocksOf, rulesOff, twinsOffName } from './eslint-off-blocks.ts'
import { buildEslintSettings } from './eslint-settings.ts'
import { eitherOf, type FilesCondition, type FilesEntry, globsOf, NO_FILE } from './file-conditions.ts'
import { SVELTE_RUNES } from './framework-globals.ts'
import { literalGlobOf } from './globs.ts'
import type { LintRulesInput } from './lint-rules-input.ts'
import {
  type EnvChanges,
  type FileOverrideLayer,
  layersKeepingRules,
  type RuleLayers,
  type RuleSetting,
  type RuleSettings,
  ruleIdsOnIn,
  shippedScopeOf,
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

/** Whether a team block gives its files type information, or takes it away again. */
export type TypeInformationSwitch = 'on' | 'off'

/**
 * A team block that switches type information on or off in its files: those its `files` match
 * (every file, where null), less its `ignores`, each glob read from the project root.
 */
export type TeamTypeInformationBlock = {
  readonly switches: TypeInformationSwitch
  readonly files: readonly FilesEntry[] | null
  readonly ignores: readonly string[]
}

/** Where our typed rules get their type information: our project service, or the team's own setup. */
export type TypeInformation =
  | {
      readonly from: 'ours'
      readonly tsconfigRootDir: string
      /** Each TS file our project service finds no tsconfig for, relative to tsconfigRootDir: none of our typed rules runs there. */
      readonly tsFilesOutsideEveryTsconfig: readonly string[]
    }
  /** Each team block that switches it on or off, in the team's order. */
  | { readonly from: 'the team'; readonly blocks: readonly TeamTypeInformationBlock[] }

/** The block that comes last, stating each of its rules off, so no block before it can run one. */
type OffSwitch = { readonly name: string; readonly ruleIds: readonly string[] }

/** What our blocks are built from. Every rule map of `layers` holds only the rules ESLint is to state. */
export type EslintBlocksSource = {
  readonly layers: RuleLayers
  /** Registered in the base block: one object per prefix, the very one any other block registers there. */
  readonly plugins: ReadonlyMap<string, ESLint.Plugin>
  /** For every JS and TS file; null leaves ESLint's own setting, and any a team gives, in force. */
  readonly linterOptions: Linter.LinterOptions | null
  readonly typeInformation: TypeInformation
  /**
   * Whether a core rule ESLint takes over from oxlint runs on TS files as typescript-eslint's
   * extension of it, which reads TypeScript syntax the core rule misreads: only where no oxlint runs.
   */
  readonly twinsOnTsFiles: boolean
  readonly offSwitch: OffSwitch
}

/** Our blocks in order, but the off-switch. */
export type BlocksBeforeTheOffSwitch = {
  readonly globalIgnores: readonly Linter.Config[]
  readonly base: Linter.Config
  readonly afterTheBase: readonly Linter.Config[]
}

/** What the plugin of each prefix must hold besides its own rules. */
export type PluginNeeds = {
  /** Under each prefix, the rule names our blocks run, whose module must be ours. */
  readonly ruleNamesRun: ReadonlyMap<string, readonly string[]>
  /** Under each prefix, the rule names a suppression may name that need at least a do-nothing definition. */
  readonly ruleNamesStubbed: ReadonlyMap<string, readonly string[]>
}

type EslintSetting = { readonly route: RuleRoute; readonly setting: RuleSetting }

/**
 * Which block a rule goes in. A rule with its own files or ignores gets a block of its own, and a
 * typed rule is kept to TS files, the only ones the project service parses.
 */
type Placement = 'plain' | 'typed' | 'scoped'

type PluginRule = { readonly prefix: string; readonly ruleName: string }

type Globs = readonly string[]

/** A block of ours with its files, ignores and rules always given, so the team's typed files can narrow them. */
type ScopedBlock = Linter.Config & {
  readonly name: string
  readonly files: FilesEntry[]
  readonly ignores: string[]
  readonly rules: Linter.RulesRecord
}

/** A block's name and the files it applies to: those its files match, less those its ignores match. */
type BlockScope = Pick<ScopedBlock, 'name' | 'files' | 'ignores'>

/** A block that can run a typed rule, and what it states instead within a team block that takes type information away. */
type TypedBlock = { readonly block: ScopedBlock; readonly rulesWithoutTypes: Linter.RulesRecord }

/**
 * A core rule ESLint takes over from oxlint where no oxlint runs, and typescript-eslint's extension
 * of it that runs in its place on TS files, as one layer of ours states the two (D9).
 */
type Takeover = {
  readonly core: RuleRoute
  readonly extension: RuleRoute
  /** The extension's setting on TS files. */
  readonly onTsFiles: RuleSetting
  /** The core rule's setting where the extension does not run: null where the layer below's stands. */
  readonly elsewhere: RuleSetting | null
  /** The core rule's setting where a team takes type information away again: null where no layer of ours runs it. */
  readonly withoutTypes: RuleSetting | null
  /**
   * Whether the layer's statement of the extension decides the pair: the extension then runs on
   * every TS file the layer's plain rules reach, as its own statement would, not only within the
   * core rule's own files.
   */
  readonly decidedByTheExtension: boolean
}

/** A layer's rules as its blocks state them: its settings with each twin pair resolved, and the takeovers on TS files. */
type LayerRules = { readonly settings: readonly EslintSetting[]; readonly takeovers: readonly Takeover[] }

/** An entry's rules as its blocks state them, and the settings it gives its TS files alone. */
type EntryRules = { readonly rules: LayerRules; readonly onTsFiles: readonly EslintSetting[] }

/** What our blocks but the off-switch are built from. */
type BlocksSource = Omit<EslintBlocksSource, 'offSwitch'>

type InlineConfigGuard = Pick<Linter.Config, 'linterOptions'>

const BLOCK = 'agents-inc'
const BASE_BLOCK = `${BLOCK}/base`
const SVELTE_RUNES_BLOCK = `${BLOCK}/svelte-runes`
/** The off-switch's name where oxlint runs the rules it turns off. */
const OXLINT_RULES_OFF = 'oxlint-rules-off'
/** The name a copy of a typed block takes where a team block switches type information off. */
const WITHOUT_TYPES = 'without-types'
/** What a block of extensions taking over core rules on TS files adds to the name of the core rules' block. */
const TS_EXTENSIONS = 'ts-extensions'
const TYPED_TS_EXTENSIONS = 'typed-ts-extensions'
// A plugin holding one rule of another's meta that runs nothing, for ESLint to check options against.
const OPTIONS_PROBE_PLUGIN = 'options-probe'
const OPTIONS_PROBE_RULE = 'rule'
const OPTIONS_PROBE_ID = `${OPTIONS_PROBE_PLUGIN}/${OPTIONS_PROBE_RULE}`
const OPTIONS_PROBE_FILE = 'options-probe.js'

const DO_NOTHING_RULE: Rule.RuleModule = { meta: { schema: false }, create: () => ({}) }

const NO_TEAM_PLUGINS: ReadonlyMap<string, ESLint.Plugin> = new Map()
const NO_RULE_NAMES: ReadonlyMap<string, readonly string[]> = new Map()
// A layer's settings for its TS files alone exist only beside oxlint, where no core rule is taken over.
const NO_LAYER_RULES: LayerRules = { settings: [], takeovers: [] }

/**
 * The agent build's complete ESLint config. Blocks in order: global ignores, base, typed, built-in
 * scopes, file overrides, the blocks turning typescript-eslint's extensions off where oxlint runs
 * the core rule they extend, and last the block that turns off ESLint's copy of every rule oxlint
 * runs. `tsFilesOutsideEveryTsconfig` lists, relative to tsconfigRootDir, the TS files our typed
 * rules leave out.
 */
export function buildEslintConfig(
  lintRules: LintRulesInput,
  catalog: Catalog,
  plugins: EslintPluginRegistry,
  tsFilesOutsideEveryTsconfig: readonly string[],
): Linter.Config[] {
  const layers = agentBuildLayersOf(lintRules, catalog)
  const source: EslintBlocksSource = {
    layers: layersKeepingRules(layers, ({ id }) => isEslintRoute(routeOf(id, catalog))),
    // No team registers a plugin in the agent build, so no module of ours has a team's to replace.
    plugins: pluginsForEveryBlock(plugins, NO_TEAM_PLUGINS, {
      ruleNamesRun: NO_RULE_NAMES,
      ruleNamesStubbed: oxlintRuleNamesByPrefix(catalog),
    }),
    // The runner checks unused suppressions itself: each engine flags the other's as unused.
    linterOptions: { reportUnusedDisableDirectives: 'off', noInlineConfig: readsNoDirectivesIn(layers.suppressionMode) },
    typeInformation: { from: 'ours', tsconfigRootDir: lintRules.tsconfigRootDir, tsFilesOutsideEveryTsconfig },
    // Sub-agents always run oxlint, which runs every core rule ESLint would otherwise take over.
    twinsOnTsFiles: false,
    offSwitch: { name: OXLINT_RULES_OFF, ruleIds: oxlintRoutedRuleIdsAndAliases(catalog) },
  }
  const { globalIgnores, base, afterTheBase } = eslintBlocksBeforeTheOffSwitch(source, catalog)
  return [...globalIgnores, base, ...afterTheBase, ...extensionsOffWhereOxlintRunsTheirCore(layers, source.layers, catalog), offSwitchBlock(source.offSwitch)]
}

/**
 * oxlint runs a core rule and typescript-eslint's extension of it as one rule (D10): each extension
 * the ESLint layers run is off wherever our oxlint part of the layers given runs a core rule it
 * extends, as oxlint reads our ignores and its file types. Any other rule is off in no file, which
 * writes no block. Sub-agents always run oxlint; the ESLint merge states these offs beside it too.
 */
export function extensionsOffWhereOxlintRunsTheirCore(layers: RuleLayers, eslintLayers: RuleLayers, catalog: Catalog): Linter.Config[] {
  const whereOxlintRuns = whereOurOxlintPartRunsEach(layers, catalog)
  const offs = ruleIdsOnIn(eslintLayers).map((ruleId) => offWhereOxlintRunsACoreItExtends(ruleId, whereOxlintRuns, catalog))
  return offBlocksOf(offs, twinsOffName)
}

/** The rule off where our oxlint part runs a core rule it extends. */
function offWhereOxlintRunsACoreItExtends(ruleId: string, whereOxlintRuns: (ruleId: string) => FilesCondition, catalog: Catalog): NamesOffWhere {
  const coresItExtends = twinsOf(routeOf(ruleId, catalog), catalog)
  return { names: [ruleId], where: eitherOf(...coresItExtends.map(whereOxlintRuns)) }
}

/** Where our oxlint part, of the layers given, runs each rule, as oxlint reads it: in no file for a rule it does not turn on. */
function whereOurOxlintPartRunsEach(layers: RuleLayers, catalog: Catalog): (ruleId: string) => FilesCondition {
  const oxlintLayers = layersKeepingRules(layers, ({ id }) => isOxlintRoute(routeOf(id, catalog)))
  const ourOxlintPart = ourOxlintPartOf(oxlintLayers, catalog)
  const turnedOn = ruleIdsOnIn(oxlintLayers)
  return (ruleId) => (turnedOn.includes(ruleId) ? whereOurOxlintPartRuns(ruleId, ourOxlintPart, catalog) : NO_FILE)
}

/** Our blocks but the off-switch, which comes after them all. The base block applies to every JS and TS file. */
export function eslintBlocksBeforeTheOffSwitch(source: BlocksSource, catalog: Catalog): BlocksBeforeTheOffSwitch {
  const { layers, typeInformation } = source
  const topLevelStated = topLevelStatements(layers)
  const topLevel = layerRulesOf(topLevelStated, null, source, catalog)
  const topLevelOnTsFiles = eslintSettingsOf(tsFileRulesOf(layers), catalog)
  const entries = layers.fileOverrides.map((layer) => ({
    layer,
    rules: layerRulesOf(entryStatements(layer), topLevelStated, source, catalog),
    onTsFiles: eslintSettingsOf(tsFileRulesOf(layer), catalog),
  }))
  const runsTypedRule =
    [topLevel, ...entries.map(({ rules }) => rules)].some(runsATypedRule) ||
    [topLevelOnTsFiles, ...entries.map(({ onTsFiles }) => onTsFiles)].some(runsATypedSetting)
  return {
    globalIgnores: globalIgnoresBlocks(eslintGlobalIgnoresOf(layers)),
    base: baseBlock(layers.env, eslintRuleMap(settingsPlaced('plain', topLevel.settings)), source),
    afterTheBase: [
      svelteRunesBlock(),
      ...blocksTakingOverOnTsFiles({ name: BASE_BLOCK, files: [JS_AND_TS_FILES], ignores: [] }, takeoversAfterThePlainBlock(topLevel), typeInformation),
      ...typedBlocks(typeInformation, settingsPlaced('typed', topLevel.settings), runsTypedRule),
      ...settingsPlaced('scoped', topLevel.settings).flatMap((scoped) => scopeBlocks(`${BLOCK}/scope`, [], scoped, topLevel, typeInformation)),
      ...blocksOnTsFilesAlone(`${BLOCK}/scope`, [], topLevelOnTsFiles, typeInformation),
      ...entries.flatMap(({ layer, rules, onTsFiles }, index) => fileOverrideBlocks(layer, index, { rules, onTsFiles }, source)),
    ],
  }
}

/** The block that comes last, stating each of its rules off, so no block before it can run one. */
function offSwitchBlock({ name, ruleIds }: OffSwitch): Linter.Config {
  return { name: `${BLOCK}/${name}`, rules: rulesOff(ruleIds) }
}

/**
 * One plugin object per prefix, for our base block and for every block of a team's that registers
 * the prefix, since ESLint throws "Cannot redefine plugin" on two objects under one prefix. Where
 * the team registers a prefix, its object is the base: our module replaces its own for each rule
 * we run. Wherever a rule name a suppression may need is still missing, a do-nothing stub fills
 * it. Plugins are copied, never changed: the registry and the team's objects are shared.
 */
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

/** Each oxlint-routed rule ID, listed or not, by the prefix ESLint would look it up under. */
export function oxlintRuleNamesByPrefix(catalog: Catalog): ReadonlyMap<string, readonly string[]> {
  return ruleNamesByPrefix([...catalog.rules.values()].filter(isOxlintRoute).map(({ id }) => id))
}

/** The rule IDs given, plugin rules only, grouped by prefix: a core rule has no plugin. */
export function ruleNamesByPrefix(ruleIds: readonly string[]): ReadonlyMap<string, readonly string[]> {
  const pluginRules = ruleIds.flatMap(pluginRuleOf)
  return new Map(prefixesOf(pluginRules).map((prefix) => [prefix, ruleNamesUnder(prefix, pluginRules)]))
}

/**
 * Where suppressions are banned, ESLint reads no directive. It applies one before any rule runs, so
 * a blanket `eslint-disable` or an inline rule config would switch the ban off for its own file
 * (measured, ESLint 10.12). Where they are allowed, it reads them again.
 */
function readsNoDirectivesIn(mode: SuppressionMode): boolean {
  return mode === 'banned'
}

function oxlintRoutedRuleIdsAndAliases(catalog: Catalog): string[] {
  return [...catalog.rules.values()].filter(isOxlintRoute).flatMap((route) => [route.id, ...route.eslintAliases])
}

function globalIgnoresBlocks(ignores: Globs): Linter.Config[] {
  if (ignores.length === 0) return []
  return [{ name: `${BLOCK}/ignores`, ignores: [...ignores] }]
}

function baseBlock(
  env: readonly string[],
  rules: Linter.RulesRecord,
  { plugins, linterOptions }: Pick<EslintBlocksSource, 'plugins' | 'linterOptions'>,
): Linter.Config {
  return {
    name: BASE_BLOCK,
    files: [JS_AND_TS_FILES],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module' },
      globals: globalsOf(env),
    },
    ...(linterOptions === null ? {} : { linterOptions }),
    plugins: Object.fromEntries(plugins),
    settings: buildEslintSettings(),
    rules,
  }
}

/**
 * Svelte's runes as globals in its rune modules, whatever rulesets are listed. Of Svelte's files, it
 * names only the JS and TS ones: a block naming .svelte files would make ESLint lint them, which our
 * parser cannot read.
 */
function svelteRunesBlock(): Linter.Config {
  return { name: SVELTE_RUNES_BLOCK, files: SVELTE_RUNES.files.filter(matchesOnlyJsAndTs), languageOptions: { globals: globalsOfEnv(SVELTE_RUNES.env) } }
}

// One config rather than a second pass. Every block that can run a typed rule leaves out the files
// without type information, as this one does. typescript-eslint builds one project service per
// process, so where the team gives type information this block gives none: beside the team's, ours
// would make its setup fatal (measured).
function typedBlocks(
  typeInformation: TypeInformation,
  rules: readonly EslintSetting[],
  runsTypedRule: boolean,
): Linter.Config[] {
  if (!runsTypedRule) return []
  const block: ScopedBlock = {
    name: `${BLOCK}/typed`,
    files: [TS_FILES],
    ignores: [...filesWithoutTypeInformation(typeInformation)],
    rules: eslintRuleMap(rules),
  }
  if (typeInformation.from === 'the team') return keptToTypedFiles(typedBlockOf(block), typeInformation)
  const { tsconfigRootDir } = typeInformation
  return [{ ...block, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir } } }]
}

/**
 * What a block that can run a typed rule leaves out, since a typed rule on a file without type
 * information is a fatal parse error that switches off every rule in the file: the consumer's
 * config files, and where the type information is ours, each TS file our project service finds no
 * tsconfig for, as a glob matching that path alone.
 */
function filesWithoutTypeInformation(typeInformation: TypeInformation): Globs {
  if (typeInformation.from === 'the team') return CONSUMER_CONFIG_FILES
  return [...CONSUMER_CONFIG_FILES, ...typeInformation.tsFilesOutsideEveryTsconfig.map(literalGlobOf)]
}

/** A block of typed rules, which states each of them off where a team block takes type information away. */
function typedBlockOf(block: ScopedBlock): TypedBlock {
  return { block, rulesWithoutTypes: rulesOff(Object.keys(block.rules)) }
}

/**
 * A block that can run a typed rule, as it is where the type information is ours, since our project
 * service parses every TS file. Where it is the team's, a copy within the files of each team block
 * that switches it on or off, in the team's order, so the last to apply to a file decides there as
 * it does for the team: in a file without types a typed rule throws and ends the whole ESLint run
 * (measured).
 */
function keptToTypedFiles(typed: TypedBlock, typeInformation: TypeInformation): Linter.Config[] {
  if (typeInformation.from === 'ours') return [typed.block]
  return typeInformation.blocks.map((teamBlock) => copyWithin(typed, teamBlock))
}

/** Where the team block switches type information off, the copy states what the block states without it. */
function copyWithin({ block, rulesWithoutTypes }: TypedBlock, teamBlock: TeamTypeInformationBlock): Linter.Config {
  const within = withinTeamFiles(block, teamBlock)
  if (teamBlock.switches === 'on') return within
  return { ...within, name: `${block.name}/${WITHOUT_TYPES}`, rules: rulesWithoutTypes }
}

/**
 * ESLint ANDs the globs inside a nested array, so each of the block's entries is paired with each
 * of the team's. The team's ignores come first: our globs negate nothing, so a negation of the
 * team's cannot take back a file ours leave out.
 */
function withinTeamFiles(block: ScopedBlock, { files, ignores }: TeamTypeInformationBlock): ScopedBlock {
  return { ...block, files: filesMatchedByBoth(block.files, files), ignores: [...ignores, ...block.ignores] }
}

/** Each of our entries ANDed with each of the team's; the team's null, a block naming no files, leaves ours as they are. */
export function filesMatchedByBoth(ours: readonly FilesEntry[], theirs: readonly FilesEntry[] | null): FilesEntry[] {
  if (theirs === null) return [...ours]
  return ours.flatMap((ourEntry) => theirs.map((theirEntry) => [...globsOf(ourEntry), ...globsOf(theirEntry)]))
}

/** The rule's own block; a typed rule's kept to the files that have type information. */
function scopeBlocks(
  namePrefix: string,
  layerFiles: readonly Globs[],
  scoped: EslintSetting,
  { takeovers }: LayerRules,
  typeInformation: TypeInformation,
): Linter.Config[] {
  const { route, setting } = scoped
  const block: ScopedBlock = {
    name: `${namePrefix}/${route.id}`,
    files: filesMatchingAll([...layerFiles, ...ruleFilesOf(scoped)]),
    ignores: [...ruleIgnoresOf(scoped, typeInformation)],
    rules: { [route.id]: eslintEntryOf(setting) },
  }
  if (route.typed) return keptToTypedFiles(typedBlockOf(block), typeInformation)
  const takeoversOfTheRule = takeovers.filter(({ core }) => core.id === route.id)
  return [withoutEmptyIgnores(block), ...blocksTakingOverOnTsFiles(block, takeoversOfTheRule, typeInformation)]
}

function withoutEmptyIgnores(block: ScopedBlock): Linter.Config {
  const { ignores, ...withoutIgnores } = block
  return ignores.length === 0 ? withoutIgnores : block
}

/** The globs a rule's own block must match as well as its layer's: its shipped files, and TS if typed. */
function ruleFilesOf({ route, setting }: EslintSetting): Globs[] {
  const shippedFiles = setting.files === null ? [] : [setting.files]
  const typedFiles = route.typed ? [[TS_FILES]] : []
  return [...shippedFiles, ...typedFiles]
}

/** The globs a rule's own block must not match: its shipped ignores, and the files without type information if typed. */
function ruleIgnoresOf({ route, setting }: EslintSetting, typeInformation: TypeInformation): Globs {
  const shippedIgnores = setting.ignores === null ? [] : setting.ignores
  const typedIgnores = route.typed ? filesWithoutTypeInformation(typeInformation) : []
  return [...shippedIgnores, ...typedIgnores]
}

/**
 * An entry's rules win over its ruleset changes and apply to exactly its files, so the two are
 * merged before placing (`entryStatements`): a rule the entry sets never also lands in a scope block
 * after it.
 */
function fileOverrideBlocks(layer: FileOverrideLayer, index: number, { rules, onTsFiles }: EntryRules, source: BlocksSource): Linter.Config[] {
  const entry: BlockScope = { name: `${BLOCK}/file-overrides/${index}`, files: filesMatchingAll([layer.files]), ignores: [] }
  const { settings } = rules
  return [
    ...entryBlockIfNotEmpty(entry, globalsChangeOf(layer.env, source.layers.env), inlineConfigGuardOf(layer), entryRuleMap(rules)),
    ...blocksTakingOverOnTsFiles(entry, takeoversAfterThePlainBlock(rules), source.typeInformation),
    ...entryTypedBlocksIfNotEmpty(`${entry.name}/typed`, layer.files, settingsPlaced('typed', settings), source.typeInformation),
    ...settingsPlaced('scoped', settings).flatMap((scoped) => scopeBlocks(`${entry.name}/scope`, [layer.files], scoped, rules, source.typeInformation)),
    ...blocksOnTsFilesAlone(`${entry.name}/scope`, [layer.files], onTsFiles, source.typeInformation),
  ]
}

/**
 * Beside oxlint, a layer stating both names of a twin pair gives typescript-eslint's extension its
 * setting on the layer's TS files alone (D9; `tsFileRules`): after the layer's other blocks, a block
 * of its own per rule, within the layer's files, the rule's own and the TS files.
 */
function blocksOnTsFilesAlone(namePrefix: string, layerFiles: readonly Globs[], onTsFiles: readonly EslintSetting[], typeInformation: TypeInformation): Linter.Config[] {
  return onTsFiles.flatMap((setting) => scopeBlocks(namePrefix, [...layerFiles, [TS_FILES]], setting, NO_LAYER_RULES, typeInformation))
}

/** The entry's every JS and TS file, so its inline config guard reaches each file the entry names. */
function entryBlockIfNotEmpty(
  { name, files }: BlockScope,
  globalsChange: Linter.Globals,
  guard: InlineConfigGuard,
  rules: Linter.RulesRecord,
): Linter.Config[] {
  const changesGlobals = Object.keys(globalsChange).length > 0
  if (!changesGlobals && guard.linterOptions === undefined && Object.keys(rules).length === 0) return []
  return [
    {
      name,
      files: [...files],
      ...(changesGlobals ? { languageOptions: { globals: globalsChange } } : {}),
      ...guard,
      rules,
    },
  ]
}

function entryTypedBlocksIfNotEmpty(
  name: string,
  files: Globs,
  rules: readonly EslintSetting[],
  typeInformation: TypeInformation,
): Linter.Config[] {
  if (rules.length === 0) return []
  return keptToTypedFiles(
    typedBlockOf({
      name,
      files: filesMatchingAll([files, [TS_FILES]]),
      ignores: [...filesWithoutTypeInformation(typeInformation)],
      rules: eslintRuleMap(rules),
    }),
    typeInformation,
  )
}

/**
 * The layer's settings, and where no oxlint runs, its takeovers (#39). A core rule ESLint takes over
 * and typescript-eslint's extension of it are then one rule to the layer (D9; #41, q35): the
 * extension runs on TS files and the core rule on the rest, never both in one file, so the
 * extension is in none of the settings, and the core rule is as it runs where the extension does
 * not. The top level, below which nothing lies, states no rule off.
 */
function layerRulesOf(layer: LayerStatements, below: LayerStatements | null, source: BlocksSource, catalog: Catalog): LayerRules {
  const takeovers = twinPairsStatedIn(layer, source, catalog).flatMap((pair) => takeoverOf(pair, layer, below, source))
  const takenOver = new Set(takeovers.map(({ extension }) => extension.id))
  const settings = { ...settingsWithout(layer.settings, takenOver), ...coreRulesRestatedBy(takeovers) }
  if (below !== null) return { settings: eslintSettingsOf(settings, catalog), takeovers }
  return { settings: eslintSettingsOf(settingsOn(settings), catalog), takeovers: takeovers.filter(runsEitherName) }
}

/** Each core rule ESLint takes over that the layer states under either name, at any severity, paired with each extension running in its place: none beside oxlint. */
function twinPairsStatedIn(layer: LayerStatements, source: BlocksSource, catalog: Catalog): TwinPair[] {
  return source.twinsOnTsFiles ? twinPairsNamedIn(layer, catalog) : []
}

/** Each core rule the takeovers give a setting where its extension does not run. */
function coreRulesRestatedBy(takeovers: readonly Takeover[]): RuleSettings {
  return Object.fromEntries(takeovers.flatMap(({ core, elsewhere }) => (elsewhere === null ? [] : [[core.id, elsewhere]])))
}

/**
 * How the layer states the pair (D9): the highest part of the layer stating either name decides,
 * the consumer's `rules` over the rulesets. The extension takes that part's setting of it on TS
 * files, or of the core rule where it states that alone. The core rule keeps that part's setting
 * of it, or takes the extension's where the part states the extension alone, unless its schema
 * refuses those options, when the setting below stands. None where the layer states neither name,
 * or the extension alone with no core rule below to run in its place; and none where the extension
 * refuses the core rule's options, which would be a config error (D-e): the core rule then runs on
 * TS files too.
 */
function takeoverOf({ core, extension }: TwinPair, layer: LayerStatements, below: LayerStatements | null, source: BlocksSource): Takeover[] {
  const coreHere = statedIn(layer, core.id)
  const extensionHere = statedIn(layer, extension.id)
  const coreBelow = below === null ? null : statedIn(below, core.id)
  if (coreHere === null && (extensionHere === null || coreBelow === null)) return []
  const { decidesTheExtension, decidesTheCore } = whatTheDecidingPartStates({ core, extension }, layer)
  const onTsFiles = decidesTheExtension ? extensionHere : coreHere
  if (onTsFiles === null) throw new Error(`${core.id}: the layer states it or ${extension.id}, so one decides the extension's setting`)
  if (!decidesTheExtension && !acceptsEntry(extension.id, eslintEntryOf(onTsFiles), source.plugins)) return []
  const elsewhere = decidesTheCore ? coreHere : coreSettingTakenFrom(extensionHere, core, source.plugins) ?? coreHere
  return [{ core, extension, onTsFiles, elsewhere, withoutTypes: elsewhere ?? coreBelow, decidedByTheExtension: decidesTheExtension }]
}

/** The extension's setting given to the core rule, within the core rule's own files: null where there is none, or the core rule refuses its options. */
function coreSettingTakenFrom(extensionSetting: RuleSetting | null, core: RuleRoute, plugins: ReadonlyMap<string, ESLint.Plugin>): RuleSetting | null {
  if (extensionSetting === null || !acceptsEntry(core.id, eslintEntryOf(extensionSetting), plugins)) return null
  return { ...extensionSetting, ...shippedScopeOf(core) }
}

/** A takeover the top level states only to run neither name changes nothing, since nothing lies below it. */
function runsEitherName({ onTsFiles, elsewhere }: Takeover): boolean {
  return onTsFiles.severity !== 'off' || (elsewhere !== null && elsewhere.severity !== 'off')
}

/**
 * The takeovers after a layer's block of plain rules: those whose core rule runs from that block or
 * from none of the layer's, and those the extension's own statement decides, which runs wherever
 * that block reaches. A takeover of a core rule with files of its own follows the core rule's block.
 */
function takeoversAfterThePlainBlock({ takeovers }: LayerRules): Takeover[] {
  return takeovers.filter(followsThePlainBlock)
}

function followsThePlainBlock({ core, elsewhere, decidedByTheExtension }: Takeover): boolean {
  return decidedByTheExtension || elsewhere === null || placementOf({ route: core, setting: elsewhere }) === 'plain'
}

/**
 * Where no oxlint runs, typescript-eslint's extensions of the core rules ESLint takes over run in
 * their place on TS files (#39): blocks after the block stating the core rules, within its files and
 * TS files, turning each core rule off and running its extension with the takeover's setting. A
 * typed extension's block is kept to the files with type information, so the core rule runs on in
 * the rest (D-f).
 */
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

/** On TS files: each core rule off, and each extension taking it over with its setting there. */
function rulesOnTsFiles(takeovers: readonly Takeover[]): Linter.RulesRecord {
  return Object.fromEntries(
    takeovers.flatMap(({ core, extension, onTsFiles }): [string, Linter.RuleEntry][] => [
      [core.id, 'off'],
      [extension.id, eslintEntryOf(onTsFiles)],
    ]),
  )
}

/** Where a team block takes type information away: each typed extension off, and its core rule back as ours runs it there. */
function rulesBackToTheCore(takeovers: readonly Takeover[]): Linter.RulesRecord {
  return Object.fromEntries(takeovers.flatMap(({ core, extension, withoutTypes }) => [[extension.id, 'off'], ...coreEntryWhere(core, withoutTypes)]))
}

/** The core rule's entry at the setting given: none where ours does not run it. */
function coreEntryWhere(core: RuleRoute, setting: RuleSetting | null): [string, Linter.RuleEntry][] {
  return setting === null ? [] : [[core.id, eslintEntryOf(setting)]]
}

/**
 * An entry's plain rules. Each extension one of its takeovers runs is off first, in every file of
 * the entry, since it runs on TS files only, from the blocks after: a statement of it below, on JS
 * files, must not run beside the core rule.
 */
function entryRuleMap({ settings, takeovers }: LayerRules): Linter.RulesRecord {
  return { ...rulesOff(takeovers.map(({ extension }) => extension.id)), ...eslintRuleMap(settingsPlaced('plain', settings)) }
}

/** The project service parses every TS file, so it is set up only when some typed rule runs, an extension taking over included. */
function runsATypedRule({ settings, takeovers }: LayerRules): boolean {
  return runsATypedSetting(settings) || takeovers.some(({ extension, onTsFiles }) => extension.typed && onTsFiles.severity !== 'off')
}

function runsATypedSetting(settings: readonly EslintSetting[]): boolean {
  return settings.some(({ route, setting }) => route.typed && setting.severity !== 'off')
}

/**
 * Whether ESLint takes the entry for the rule. It refuses options the rule's schema does not take,
 * with a config error that ends its whole run (measured: typescript-eslint's max-params given 5), so
 * it is asked first: a core rule itself, a plugin's of a rule with the same meta that runs nothing.
 * Any other failure is a defect of its own, which must not pass for a refusal.
 */
function acceptsEntry(ruleId: string, entry: Linter.RuleEntry, plugins: ReadonlyMap<string, ESLint.Plugin>): boolean {
  const isCoreRule = pluginRuleOf(ruleId).length === 0
  const probedId = isCoreRule ? ruleId : OPTIONS_PROBE_ID
  const probe: Linter.Config[] = isCoreRule ? [{ rules: { [ruleId]: entry } }] : optionsProbeOf(registeredRuleModule(ruleId, plugins), entry)
  try {
    new Linter().verify('', probe, { filename: OPTIONS_PROBE_FILE })
    return true
  } catch (error) {
    if (refusesOptions(error, probedId)) return false
    throw new Error(`${ruleId}: ESLint failed to check its options for another reason than refusing them`, { cause: error })
  }
}

/** ESLint refuses a rule's options with a plain error naming the rule under `rules`, then each value refused (measured, ESLint 10.12). */
function refusesOptions(error: unknown, probedId: string): boolean {
  return error instanceof Error && error.message.startsWith(`Key "rules": Key "${probedId}":\n\tValue `)
}

/** A config running, with the entry, a rule of the given rule's meta that runs nothing. */
function optionsProbeOf(ruleModule: Rule.RuleModule, entry: Linter.RuleEntry): Linter.Config[] {
  const plugin: ESLint.Plugin = { rules: { [OPTIONS_PROBE_RULE]: runningNothingWithMetaOf(ruleModule) } }
  return [{ plugins: { [OPTIONS_PROBE_PLUGIN]: plugin }, rules: { [OPTIONS_PROBE_ID]: entry } }]
}

function runningNothingWithMetaOf({ meta }: Rule.RuleModule): Rule.RuleModule {
  return { create: DO_NOTHING_RULE.create, ...(meta === undefined ? {} : { meta }) }
}

function registeredRuleModule(ruleId: string, plugins: ReadonlyMap<string, ESLint.Plugin>): Rule.RuleModule {
  const [pluginRule] = pluginRuleOf(ruleId)
  if (pluginRule === undefined) throw new Error(`${ruleId}: a core rule, which no plugin registers`)
  return ruleModuleOf(plugins.get(pluginRule.prefix), pluginRule.prefix, pluginRule.ruleName)
}

function settingsPlaced(placement: Placement, settings: readonly EslintSetting[]): EslintSetting[] {
  return settings.filter((setting) => placementOf(setting) === placement)
}

function placementOf({ route, setting }: EslintSetting): Placement {
  if (setting.severity === 'off') return 'plain'
  if (setting.files !== null || setting.ignores !== null) return 'scoped'
  return route.typed ? 'typed' : 'plain'
}

function settingsWithout(settings: RuleSettings, ruleIds: ReadonlySet<string>): RuleSettings {
  return Object.fromEntries(Object.entries(settings).filter(([id]) => !ruleIds.has(id)))
}

function settingsOn(settings: RuleSettings): RuleSettings {
  return Object.fromEntries(Object.entries(settings).filter(([, { severity }]) => severity !== 'off'))
}

function eslintSettingsOf(settings: RuleSettings, catalog: Catalog): EslintSetting[] {
  return Object.entries(settings).map(([id, setting]) => ({ route: routeOf(id, catalog), setting }))
}

function eslintRuleMap(settings: readonly EslintSetting[]): Linter.RulesRecord {
  return Object.fromEntries(
    settings.map(({ route, setting }): [string, Linter.RuleEntry] => [route.id, eslintEntryOf(setting)]),
  )
}

/**
 * An entry that gives `allowSuppressions` sets whether ESLint reads directives in its files, as it
 * sets the rules it decides. One that leaves it out sets neither, so the setting before it stands.
 */
function inlineConfigGuardOf({ suppressions }: FileOverrideLayer): InlineConfigGuard {
  if (suppressions === undefined) return {}
  return { linterOptions: { noInlineConfig: readsNoDirectivesIn(suppressions.mode) } }
}

function eslintEntryOf({ severity, options }: RuleSetting): Linter.RuleEntry {
  return severity === 'off' ? 'off' : [severity, ...options]
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
  const known = Object.entries(globals).find(([name]) => name === env)
  if (known === undefined) throw new Error(`the globals package defines no env "${env}"`)
  return known[1]
}

/**
 * ESLint refuses a suppression comment for a rule it has no definition of, so each oxlint-routed
 * rule ESLint lacks gets a do-nothing twin: in a copy of the plugin under its prefix, or in a stub
 * plugin under a prefix nobody registers.
 */
function pluginUnder(
  prefix: string,
  registry: EslintPluginRegistry,
  teamPlugin: ESLint.Plugin | undefined,
  { ruleNamesRun, ruleNamesStubbed }: PluginNeeds,
): ESLint.Plugin {
  const ours = registry[prefix]
  const stubbed = namesUnder(prefix, ruleNamesStubbed)
  if (teamPlugin !== undefined) {
    const withOurModules = withRulesOf(teamPlugin, ours, prefix, namesUnder(prefix, ruleNamesRun))
    return withCompatLayerWhereNeeded(prefix, withStubsFor(withOurModules, stubbed))
  }
  return ours === undefined ? stubPlugin(stubbed) : withStubsFor(ours, stubbed)
}

/** The team's plugin with our module for each rule we run under its prefix: a copy, the team's object untouched. */
function withRulesOf(
  teamPlugin: ESLint.Plugin,
  ours: ESLint.Plugin | undefined,
  prefix: string,
  ruleNames: readonly string[],
): ESLint.Plugin {
  const ourModules = ruleNames.map((ruleName): [string, Rule.RuleModule] => [ruleName, ruleModuleOf(ours, prefix, ruleName)])
  return { ...teamPlugin, rules: { ...teamPlugin.rules, ...Object.fromEntries(ourModules) } }
}

function ruleModuleOf(plugin: ESLint.Plugin | undefined, prefix: string, ruleName: string): Rule.RuleModule {
  const ruleModule = plugin?.rules?.[ruleName]
  if (ruleModule === undefined) throw new Error(`${prefix}/${ruleName}: run in ESLint, yet our plugin under ${prefix} lacks it`)
  return ruleModule
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

/**
 * The plugin plus a stub for each of the names it lacks: a copy, since the plugin object is shared
 * with whoever else imports it, and the plugin itself when it lacks none.
 */
function withStubsFor(plugin: ESLint.Plugin, ruleNames: readonly string[]): ESLint.Plugin {
  const lackedNames = ruleNames.filter((ruleName) => !definesRule(plugin, ruleName))
  if (lackedNames.length === 0) return plugin
  return { ...plugin, rules: { ...plugin.rules, ...stubRulesNamed(lackedNames) } }
}

function definesRule(plugin: ESLint.Plugin, ruleName: string): boolean {
  return plugin.rules !== undefined && Object.hasOwn(plugin.rules, ruleName)
}

function stubPlugin(ruleNames: readonly string[]): ESLint.Plugin {
  return { rules: stubRulesNamed(ruleNames) }
}

function stubRulesNamed(ruleNames: readonly string[]): Record<string, Rule.RuleModule> {
  return Object.fromEntries(ruleNames.map((ruleName): [string, Rule.RuleModule] => [ruleName, DO_NOTHING_RULE]))
}

/** The rule's prefix and its name under it: none for a core rule, which has no plugin (and so no stub). */
function pluginRuleOf(id: string): PluginRule[] {
  const prefix = pluginPrefixOf(id)
  return prefix === null ? [] : [{ prefix, ruleName: id.slice(`${prefix}/`.length) }]
}
