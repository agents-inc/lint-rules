import { relative, resolve, sep } from 'node:path'
import { type Catalog, isOxlintRoute, routeOf } from '@workspace/rule-data'
import type { ESLint, Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import {
  type BlocksBeforeTheOffSwitch,
  type EslintBlocksSource,
  type EslintPluginRegistry,
  type EslintSettings,
  eslintBlocksBeforeTheOffSwitch,
  extensionsOffWhereOxlintRunsTheirCore,
  filesMatchedByBoth,
  layersWithoutRuntimeGlobals,
  oxlintRuleNamesByPrefix,
  type PluginNeeds,
  pluginsForEveryBlock,
  ruleNamesByPrefix,
  runtimeGlobalsBlocksWithin,
  type TeamTypeInformationBlock,
  type TypeInformation,
  type TypeInformationSwitch,
} from './build-eslint-config.ts'
import { currentExtensionsOf } from './catalog-lookups.ts'
import type { EslintPart } from './editor-parts.ts'
import { firstGiven, pluginsRegisteredBy, ruleIdsTheTeamsEslintConfigSets, rulesStatedIn } from './eslint-config-reading.ts'
import { asFilesEntry, eslintDefaultIgnoresHoldUnder } from './eslint-file-types.ts'
import { eachWithin, groupedByWhere, type Where, type Within, whereOf } from './eslint-off-blocks.ts'
import { buildEslintSettings, givesTheSetting, type SettingOfOurs, type SettingPath, settingsGiving, settingsOfOurs } from './eslint-settings.ts'
import { bothOf, eitherOf, type FilesAndIgnores, type FilesCondition, type FilesEntry, filesInScopeOf, globsOf, matchesEveryFile, notOf } from './file-conditions.ts'
import { keepingNegation, literalGlobOf, withoutLeadingDotSlash } from './globs.ts'
import { globsReadFromTheRoot } from './globs-read-from-above.ts'
import { isRecord } from './is-record.ts'
import { liesOutside } from './lies-outside.ts'
import { type ProjectFacts, projectFactsOf } from './project-facts.ts'
import { type RuleLayers, ruleIdsOnIn, runtimeGlobalReadersOnIn } from './resolve-rule-layers.ts'
import { ourLayersLeavingOut, rulesTheTeamSets } from './rules-the-team-sets.ts'
import { type OurEslintPart, ourEslintPartOf, whereOurEslintPartRuns } from './where-our-parts-run.ts'

/** A team's whole ESLint config: whatever ESLint's `defineConfig` takes. */
export type TeamEslintConfig = Parameters<typeof defineConfig>[number]

type PluginMeta = NonNullable<ESLint.Plugin['meta']>

/** A team block's files and ignores, read from the project root. */
type TeamFiles = Pick<TeamTypeInformationBlock, 'files' | 'ignores'>

/** The two parser options through which typescript-eslint gives a file type information. */
type TypeInformationOption = (typeof TYPE_INFORMATION_OPTIONS)[number]

/** Our blocks but the off-switch, in order: base, typed, scopes, entries. */
type OurBlocks = readonly Linter.Config[]

/** Rules of one block of ours that may run in the same files. */
type RulesWhere = Where & { readonly rules: Linter.RulesRecord }

/** A setting of ours, and the files it is ours in. */
type SettingWhere = Where & SettingOfOurs

/** Settings of ours that are ours in the same files, as a block gives them. */
type SettingsWhere = Where & { readonly settings: NonNullable<Linter.Config['settings']> }

/** Our base block, holding the settings that are ours everywhere, and blocks holding the others, each kept to its files. */
type SettingsBesideTheTeam = { readonly base: Linter.Config; readonly keptToTheirFiles: readonly Linter.Config[] }

const TYPE_INFORMATION_OPTIONS = ['project', 'projectService'] as const
// Joined to a plugin's own version as semver build metadata, so its cache key carries ours too.
const OUR_BUILD_TAG = 'agents-inc-lint-rules'
const GLOB_SEPARATOR = '/'
const EVERY_FILE_UNDER = '/**'
const CONFINED = 'confined'
const SETTINGS = 'settings'
// The keys of a block that only states rules. One holding any other key, language options or
// plugins, still gives something once its rules are gone.
const KEYS_OF_A_RULES_BLOCK: ReadonlySet<string> = new Set(['name', 'files', 'ignores', 'rules'])
// A block holding ignores and no key but these is global ignores: the others name it and place its
// globs (@eslint/config-array 0.23, META_FIELDS).
const KEYS_OF_GLOBAL_IGNORES: ReadonlySet<string> = new Set(['name', 'basePath', 'ignores'])

/**
 * Ours first, then the team's blocks as `defineConfig` gives them (decisions.md, "Owner
 * 2026-10-14"; spec-merge-model.md, 1.4). A rule the team's ESLint config or its oxlint config sets
 * anywhere, at any severity and under any name of it or of its typescript-eslint twin, is the team's
 * in every file: no block of ours states it. Our ignores keep only our rules out of the files they
 * match (D-a), and our rules stay out of the files ESLint's default ignores leave out, which a team's
 * global ignores may take back. Beside oxlint, after the team's blocks, each typescript-eslint
 * extension our blocks run is off where our oxlint part runs a core rule it extends (D10). Each
 * prefix both register gets one plugin object, used in every block. `ourVersion` is this package's
 * version; `setByTheTeamsOxlintConfig` the rules the team's oxlint config sets.
 */
export function mergeEslintPart(
  theirs: TeamEslintConfig,
  partGiven: EslintPart,
  catalog: Catalog,
  registry: EslintPluginRegistry,
  ourVersion: string,
  setByTheTeamsOxlintConfig: readonly string[],
): Linter.Config[] {
  const teamBlocks = defineConfig(theirs)
  const setByTheTeam = rulesTheTeamSets([...ruleIdsTheTeamsEslintConfigSets(teamBlocks, registry, catalog), ...setByTheTeamsOxlintConfig], catalog)
  const part = ourPartLeavingOut(setByTheTeam, partGiven)
  const projectFacts = projectFactsOf(part.tsconfigRootDir)
  const plugins = withOurVersionInEachCacheKey(pluginsForEveryBlock(registry, pluginsRegisteredBy(teamBlocks), pluginNeedsOf(part, catalog)), ourVersion)
  const source = ourBlocksSource(part, plugins, buildEslintSettings(projectFacts), typeInformationFor(part, teamBlocks, projectFacts))
  const blocks = eslintBlocksBeforeTheOffSwitch(source, catalog)
  const settings = ourSettingsBeside(blocks.base, teamBlocks, part.tsconfigRootDir)
  const whereOurBlocksMayRun = whereOurBlocksMayRunBeside(teamBlocks, part)
  const runtimeGlobals = runtimeGlobalsBlocksWithin(part.layers, bothOf(whereOurRuntimeGlobalsAreRead(part.layers, catalog), whereOurBlocksMayRun))
  return [
    ...blocksInOrder({ ...blocks, base: settings.base }, runtimeGlobals).flatMap((block) => confinedBeside(block, whereOurBlocksMayRun)),
    ...settings.keptToTheirFiles,
    ...teamBlocks.map((block) => teamBlockBeside(block, plugins)),
    ...extensionsOffWhereOxlintRunsTheirCore(part.oxlintLayers, part.layers, catalog),
  ]
}

/** Our part stating none of the team's rules, in either engine's layers. */
function ourPartLeavingOut(setByTheTeam: ReadonlySet<string>, part: EslintPart): EslintPart {
  return { ...part, layers: ourLayersLeavingOut(setByTheTeam, part.layers), oxlintLayers: ourLayersLeavingOut(setByTheTeam, part.oxlintLayers) }
}

/** The files our blocks may run our rules in: all but those they are kept out of. */
function whereOurBlocksMayRunBeside(teamBlocks: readonly Linter.Config[], { layers, tsconfigRootDir }: EslintPart): FilesCondition {
  return notOf(filesOurBlocksAreKeptOutOf(ourEslintPartOf(layers), eslintDefaultIgnoresHoldBeside(teamBlocks, tsconfigRootDir)))
}

/**
 * The files our blocks are kept out of: every file our ESLint part does not lint in an editor merge
 * (ourEslintPartOf). Where the team's global ignores take nothing back from ESLint's default ones,
 * ESLint keeps each file of those out of every block itself, so ours are kept out of the files our
 * ignores leave out alone, and keep the names they have outside a merge (decisions.md, 2026-10-12
 * "fix round 2, after its second review").
 */
function filesOurBlocksAreKeptOutOf({ leftOut, leftOutByOurIgnores }: OurEslintPart, eslintDefaultIgnoresHold: boolean): FilesCondition {
  return eslintDefaultIgnoresHold ? leftOutByOurIgnores : leftOut
}

/**
 * Whether ESLint's default ignores hold beside the team's global ignores, which it reads after them,
 * in order: none takes a file back. Their globs are read from the project root, as ESLint reads them
 * from each block's basePath; a function among them leaves files out and takes none back, so it adds
 * no glob.
 */
function eslintDefaultIgnoresHoldBeside(teamBlocks: readonly Linter.Config[], tsconfigRootDir: string): boolean {
  const globalIgnores = teamBlocks.filter(isGlobalIgnores).map(withGlobsOnly)
  return eslintDefaultIgnoresHoldUnder(globalIgnores.flatMap((block) => teamFilesFromTheRoot(block, tsconfigRootDir).flatMap(({ ignores }) => ignores)))
}

/** Whether ESLint reads the block as global ignores. One holding a name or basePath alone counts too, and gives no glob. */
function isGlobalIgnores(block: Linter.Config): boolean {
  return Object.keys(block).every((key) => KEYS_OF_GLOBAL_IGNORES.has(key))
}

/**
 * Our blocks in order, our runtime globals' right after the base block. Our ignores keep our rules
 * out of their files, and nothing else: no global ignores (D-a).
 */
function blocksInOrder({ base, afterTheBase }: BlocksBeforeTheOffSwitch, runtimeGlobals: OurBlocks): OurBlocks {
  return [base, ...runtimeGlobals, ...afterTheBase]
}

/**
 * Where a rule of ours that reads our runtimes' globals runs in our ESLint part, which beside oxlint
 * runs none (#68, read-q68): our runtime globals are given there alone, so a team's own no-undef
 * stays its own elsewhere. A rule the team sets is not ours, so it reads none of ours.
 */
function whereOurRuntimeGlobalsAreRead(layers: RuleLayers, catalog: Catalog): FilesCondition {
  return eitherOf(...runtimeGlobalReadersOnIn(layers, catalog).map((ruleId) => whereOurEslintPartRuns(ruleId, layers)))
}

/**
 * The block with its rules kept to the files our blocks may run in: as it is where that is every
 * file it applies to, or in a copy after it kept to those files. A block with nothing left to give
 * is dropped.
 */
function confinedBeside(block: Linter.Config, whereOurBlocksMayRun: FilesCondition): Linter.Config[] {
  if (matchesEveryFile(whereOurBlocksMayRun)) return keptWhereItGivesAnything(block)
  const copies = eachWithin(rulesKeptTo(whereOurBlocksMayRun, rulesStatedIn(block)))
  return [
    ...keptWhereItGivesAnything({ ...block, rules: {} }),
    ...copies.map((copy, index) => ourBlockWithin(block, copy, `${nameOf(block)}/${CONFINED}/${String(index)}`)),
  ]
}

/** The rules, kept to the files given: none where there are none. */
function rulesKeptTo(where: FilesCondition, rules: Linter.RulesRecord): RulesWhere[] {
  return Object.keys(rules).length === 0 ? [] : [{ where, rules }]
}

/** The block, or none where it gives nothing. */
function keptWhereItGivesAnything(block: Linter.Config): Linter.Config[] {
  return givesAnything(block) ? [block] : []
}

/** A copy of our block holding the rules given, kept to the files given within its own. */
function ourBlockWithin(block: Linter.Config, { within, rules }: Within<RulesWhere>, name: string): Linter.Config {
  return { ...scopeWithin(block, within, name), rules }
}

/** A block of the name given, kept to the files given within our block's: their globs ANDed with its own, their ignores after its own. */
function scopeWithin(block: Linter.Config, { files, ignores }: FilesAndIgnores, name: string): Linter.Config {
  const { files: ourFiles, ignores: ourIgnores = [] } = block
  if (ourFiles === undefined) throw new Error(`${name}: every block of ours names its files`)
  const allIgnores = [...ourIgnores, ...ignores]
  return {
    name,
    files: files === null ? [...ourFiles] : filesMatchedByBoth(ourFiles, files.map((globs) => [...globs])),
    ...(allIgnores.length === 0 ? {} : { ignores: allIgnores }),
  }
}

/**
 * A setting of ours, in a block before the team's, can hide one of the team's from the plugin
 * reading it: eslint-plugin-n reads settings.n before the older settings.node, and import-x reads
 * import-x/resolver-next before import-x/resolver; and ESLint merges `settings` key by key, so ours
 * would merge into an object the team gives. Each is ours only in the files where no team block gives
 * a setting it yields to (settingsOfOurs, eslint-settings.ts; O8): our base block keeps those that
 * are ours in every file, and the others go into blocks of their own after ours, kept to their files
 * within the base block's, those ours in the same files together.
 */
function ourSettingsBeside(base: Linter.Config, teamBlocks: readonly Linter.Config[], tsconfigRootDir: string): SettingsBesideTheTeam {
  const placed = settingsOfOurs(ourSettingsIn(base)).map(
    (setting): SettingWhere => ({ ...setting, where: notOf(whereTheTeamGivesAnyOf(setting.yieldsTo, teamBlocks, tsconfigRootDir)) }),
  )
  const oursEverywhere = placed.filter(({ where }) => matchesEveryFile(where))
  if (oursEverywhere.length === placed.length) return { base, keptToTheirFiles: [] }
  const byWhere = groupedByWhere(placed.filter(({ where }) => !matchesEveryFile(where))).map(
    (sharing): SettingsWhere => ({ where: whereOf(sharing), settings: settingsGiving(sharing) }),
  )
  return {
    base: { ...base, settings: settingsGiving(oursEverywhere) },
    keptToTheirFiles: eachWithin(byWhere).map(({ within, settings }, index) => ({
      ...scopeWithin(base, within, `${nameOf(base)}/${SETTINGS}/${String(index)}`),
      settings,
    })),
  }
}

/** Our base block's settings, which it always gives. */
function ourSettingsIn(base: Linter.Config): NonNullable<Linter.Config['settings']> {
  const { settings } = base
  if (settings === undefined) throw new Error(`${nameOf(base)}: our base block gives our settings`)
  return settings
}

/** The files of each team block giving any of the settings. */
function whereTheTeamGivesAnyOf(paths: readonly SettingPath[], teamBlocks: readonly Linter.Config[], tsconfigRootDir: string): FilesCondition {
  const giving = teamBlocks.filter(({ settings = {} }) => paths.some((path) => givesTheSetting(settings, path)))
  return eitherOf(...giving.map((block) => filesTheTeamBlockAppliesTo(block, tsconfigRootDir)))
}

/** A block of rules alone gives nothing once its rules are gone; one with language options, plugins or the like still does. */
function givesAnything(block: Linter.Config): boolean {
  const { rules = {} } = block
  return Object.keys(rules).length > 0 || Object.keys(block).some((key) => !KEYS_OF_A_RULES_BLOCK.has(key))
}

/** Every block of ours is named. */
function nameOf({ name }: Linter.Config): string {
  if (name === undefined) throw new Error('a block of ours has no name')
  return name
}

/**
 * The files a team block applies to, read from the project root. A team's eslint.config.mjs is
 * untyped, so its `files` or `ignores` may hold a function, which no glob can stand for (Q-D, a known
 * gap): the block is read as applying wherever it may, a function in `files` matching every file and
 * one in `ignores` leaving none out, so ours stays out of every file the team's setting may reach.
 */
function filesTheTeamBlockAppliesTo(block: Linter.Config, tsconfigRootDir: string): FilesCondition {
  return eitherOf(...teamFilesFromTheRoot(withGlobsOnly(block), tsconfigRootDir).map(({ files, ignores }) => filesInScopeOf(files, ignores)))
}

function withGlobsOnly({ basePath, files, ignores }: Linter.Config): Linter.Config {
  // Parse boundary: ESLint's types give globs, and the team's JS may hold functions.
  const filesGiven: readonly unknown[] | undefined = files
  const ignoresGiven: readonly unknown[] = ignores === undefined ? [] : ignores
  return {
    ...(basePath === undefined ? {} : { basePath }),
    ...(filesGiven === undefined ? {} : { files: filesGiven.map(globsOfEntry) }),
    ignores: ignoresGiven.filter(isGlob),
  }
}

/** An entry's globs: a function among them reads as matching every file, so it adds no glob. */
function globsOfEntry(entry: unknown): FilesEntry {
  if (isGlob(entry)) return entry
  return Array.isArray(entry) ? entry.filter(isGlob) : []
}

function isGlob(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Our module for each rule we run, and a stub for each rule a suppression may name. ESLint refuses
 * a suppression of a rule it has no definition of; only beside oxlint do suppressions name rules
 * ESLint does not run.
 */
function pluginNeedsOf(part: EslintPart, catalog: Catalog): PluginNeeds {
  const ruleIdsRun = ruleIdsOnIn(part.layers)
  return {
    ruleNamesRun: ruleNamesByPrefix([...ruleIdsRun, ...extensionsTakingOverOnTsFiles(ruleIdsRun, part, catalog)]),
    ruleNamesStubbed: part.usesOxlint ? oxlintRuleNamesByPrefix(catalog) : new Map(),
  }
}

/**
 * Without oxlint, typescript-eslint's current extension of each core rule ESLint takes over from
 * oxlint runs on TS files in its place (#39), on our module whatever object the team registers.
 */
function extensionsTakingOverOnTsFiles(ruleIdsRun: readonly string[], { usesOxlint }: EslintPart, catalog: Catalog): string[] {
  if (usesOxlint) return []
  return ruleIdsRun.flatMap((ruleId) => {
    const route = routeOf(ruleId, catalog)
    return isOxlintRoute(route) ? currentExtensionsOf(route, catalog) : []
  })
}

function ourBlocksSource(
  part: EslintPart,
  plugins: ReadonlyMap<string, ESLint.Plugin>,
  settings: EslintSettings,
  typeInformation: TypeInformation,
): Omit<EslintBlocksSource, 'offSwitch'> {
  return {
    // Our runtime globals go in blocks of their own, kept to where our rules read them (`runtimeGlobalsBlocksWithin`).
    layers: layersWithoutRuntimeGlobals(part.layers),
    plugins,
    // The team's noInlineConfig stands either way. Beside oxlint, each engine flags the other's
    // suppressions as unused (measured 2026-10-04).
    linterOptions: part.usesOxlint ? { reportUnusedDisableDirectives: 'off' } : null,
    settings,
    typeInformation,
    twinsOnTsFiles: !part.usesOxlint,
  }
}

/**
 * ESLint's --cache keys each file's results on its calculated config, which names each plugin by
 * its name@version. A merged object keeps the team's, and some installed plugins carry none, so an
 * upgrade of this package would leave the key as it was and serve results from our old rules
 * (measured). Every plugin our blocks register carries our version beside its own instead: copies,
 * since the registry's objects and the team's are shared.
 */
function withOurVersionInEachCacheKey(
  plugins: ReadonlyMap<string, ESLint.Plugin>,
  ourVersion: string,
): ReadonlyMap<string, ESLint.Plugin> {
  return new Map(
    [...plugins].map(([prefix, plugin]): [string, ESLint.Plugin] => [prefix, withOurVersion(prefix, plugin, ourVersion)]),
  )
}

/**
 * ESLint takes a plugin's name and version from its top level before its meta, skipping an empty
 * one, so both move into the meta. A plugin with no name takes the prefix it is registered under.
 */
function withOurVersion(prefix: string, plugin: ESLint.Plugin, ourVersion: string): ESLint.Plugin {
  const { name: topLevelName, version: topLevelVersion, meta = {}, ...rest } = plugin
  const ownName = firstGiven([topLevelName, meta.name])
  const ownVersion = firstGiven([topLevelVersion, meta.version])
  const ours = `${OUR_BUILD_TAG}.${ourVersion}`
  const cacheKeyMeta: PluginMeta = {
    name: ownName === undefined ? prefix : ownName,
    version: ownVersion === undefined ? ours : `${ownVersion}+${ours}`,
  }
  return { ...rest, meta: { ...meta, ...cacheKeyMeta } }
}

/**
 * typescript-eslint builds one project service per process, so where the team gives type
 * information ours would collide with it: `project` beside `projectService` is fatal, and our
 * `projectService: true` over the team's `allowDefaultProject` made a root file fatal (measured).
 * Our typed rules then run only in the files the team's blocks give types to, and in none a later
 * team block takes them away from again, as typescript-eslint's disableTypeChecked does.
 */
function typeInformationFor({ tsconfigRootDir }: EslintPart, teamBlocks: readonly Linter.Config[], { tsFilesOutsideEveryTsconfig }: ProjectFacts): TypeInformation {
  if (!teamBlocks.some(givesTypeInformation)) return { from: 'ours', tsconfigRootDir, tsFilesOutsideEveryTsconfig }
  return {
    from: 'the team',
    blocks: teamBlocks.flatMap((block, index) => typeInformationBlocksOf(block, teamBlocks.slice(0, index), tsconfigRootDir)),
  }
}

function typeInformationBlocksOf(
  block: Linter.Config,
  earlierBlocks: readonly Linter.Config[],
  tsconfigRootDir: string,
): TeamTypeInformationBlock[] {
  const switches = typeInformationSwitchOf(block, earlierBlocks)
  if (switches === null) return []
  return teamFilesFromTheRoot(block, tsconfigRootDir).map((teamFiles) => ({ switches, ...teamFiles }))
}

/**
 * On where the block turns either option on. Off where it sets to false or null an option an
 * earlier block turned on: types given through the other one stay (`program: null` alone leaves
 * them, measured). Null where it leaves type information as it was.
 */
function typeInformationSwitchOf(block: Linter.Config, earlierBlocks: readonly Linter.Config[]): TypeInformationSwitch | null {
  if (givesTypeInformation(block)) return 'on'
  const turnedOnEarlier = new Set(earlierBlocks.flatMap(optionsTurnedOnBy))
  return optionsSwitchedOffBy(block).some((option) => turnedOnEarlier.has(option)) ? 'off' : null
}

function givesTypeInformation(block: Linter.Config): boolean {
  return optionsTurnedOnBy(block).length > 0
}

function optionsTurnedOnBy(block: Linter.Config): TypeInformationOption[] {
  const parserOptions = parserOptionsOf(block)
  return TYPE_INFORMATION_OPTIONS.filter((option) => turnsOn(parserOptions[option]))
}

function optionsSwitchedOffBy(block: Linter.Config): TypeInformationOption[] {
  const parserOptions = parserOptionsOf(block)
  return TYPE_INFORMATION_OPTIONS.filter((option) => switchesOff(parserOptions[option]))
}

/** A block giving no parser options leaves each as it was. */
function parserOptionsOf({ languageOptions = {} }: Linter.Config): Readonly<Record<string, unknown>> {
  const { parserOptions } = languageOptions
  return isRecord(parserOptions) ? parserOptions : {}
}

/** A parser option left out, or set to false or null, gives no type information. */
function turnsOn(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false
}

/** ESLint keeps an earlier block's value where a later one leaves the option out or sets it undefined. */
function switchesOff(value: unknown): boolean {
  return value === false || value === null
}

/**
 * ESLint reads a block's files and ignores from its basePath and ours from the project root, so the
 * team's are read from the root: put under a basePath inside it, or read past the root's folders
 * from one above it (spec-core.md C8). A block without `files` applies to every file under its
 * basePath. None where the basePath holds no file of the project, as a sibling folder does.
 */
function teamFilesFromTheRoot({ basePath, files, ignores = [] }: Linter.Config, tsconfigRootDir: string): TeamFiles[] {
  const asWritten: TeamFiles = { files: files === undefined ? null : files, ignores }
  if (basePath === undefined) return [asWritten]
  const basePathFromTheRoot = pathFromTheRoot(basePath, tsconfigRootDir)
  if (basePathFromTheRoot === null) return teamFilesReadFromAbove(asWritten, rootFromTheBasePath(basePath, tsconfigRootDir))
  return basePathFromTheRoot === '' ? [asWritten] : [teamFilesUnder(literalGlobOf(basePathFromTheRoot), asWritten)]
}

/**
 * The root's folders from a basePath above it, one each, as ESLint reads a relative basePath from
 * the root (`pathFromTheRoot`): null where the basePath is not above the root, which then holds no
 * file of the project.
 */
function rootFromTheBasePath(basePath: string, tsconfigRootDir: string): string[] | null {
  const fromTheBasePath = relative(resolve(tsconfigRootDir, basePath), tsconfigRootDir)
  return liesOutside(fromTheBasePath) ? null : fromTheBasePath.split(sep)
}

/**
 * A block's files and ignores read from a folder above the root, as globs read from the root: each
 * `files` entry once for each way its globs read past the root's folders, and each ignore as each
 * of its readings. None where no entry reaches the root's files, or the basePath is not above it.
 */
function teamFilesReadFromAbove({ files, ignores }: TeamFiles, folders: readonly string[] | null): TeamFiles[] {
  if (folders === null) return []
  const ignoresFromTheRoot = ignores.flatMap((glob) => globsReadFromTheRoot(glob, folders))
  if (files === null) return [{ files: null, ignores: ignoresFromTheRoot }]
  const entries = files.flatMap((entry) => entriesReadFromTheRoot(globsOf(entry), folders))
  return entries.length === 0 ? [] : [{ files: entries, ignores: ignoresFromTheRoot }]
}

/** An entry, whose globs a file must match each, read from the root: one entry for each choice of a reading of each glob. */
function entriesReadFromTheRoot(globs: readonly string[], folders: readonly string[]): FilesEntry[] {
  const readingsOfEachGlob = globs.map((glob) => globsReadFromTheRoot(glob, folders))
  return cartesianProductOf(readingsOfEachGlob).map(asFilesEntry)
}

/** Every list made of one member of each list given, in their order: one empty list where none is given, and none where one is empty. */
function cartesianProductOf<Member>(lists: readonly (readonly Member[])[]): Member[][] {
  return lists.reduce<Member[][]>((sofar, list) => sofar.flatMap((combination) => list.map((member) => [...combination, member])), [[]])
}

/**
 * ESLint resolves a relative basePath against the config file's directory, which our globs are read
 * from too, so it is the same path from the root whatever that directory is. An absolute one is
 * read against tsconfigRootDir, the one directory of the project the merge is told. Null where the
 * path lies outside it.
 */
function pathFromTheRoot(basePath: string, tsconfigRootDir: string): string | null {
  const fromTheRoot = relative(tsconfigRootDir, resolve(tsconfigRootDir, basePath))
  return liesOutside(fromTheRoot) ? null : fromTheRoot.split(sep).join(GLOB_SEPARATOR)
}

/** Every entry ANDs every file under the basePath, as the block applies to no other: a negated glob alone would match outside it. */
function teamFilesUnder(under: string, { files, ignores }: TeamFiles): TeamFiles {
  const everyFileUnder = `${under}${EVERY_FILE_UNDER}`
  return {
    files: files === null ? [everyFileUnder] : files.map((entry) => [everyFileUnder, ...globsOf(entry).map((glob) => globUnder(under, glob))]),
    ignores: ignores.map((glob) => globUnder(under, glob)),
  }
}

/** ESLint drops a glob's leading `./` itself, which it cannot do once the glob is put under a path. */
function globUnder(under: string, glob: string): string {
  return keepingNegation(glob, (pattern) => `${under}${GLOB_SEPARATOR}${withoutLeadingDotSlash(pattern)}`)
}

/** The team's block as it is, but each plugin object the one shared under its prefix. */
function teamBlockBeside(block: Linter.Config, plugins: ReadonlyMap<string, ESLint.Plugin>): Linter.Config {
  const { plugins: teamPlugins } = block
  return teamPlugins === undefined ? block : { ...block, plugins: withSharedPlugins(teamPlugins, plugins) }
}

/** The team's registrations, each prefix our base block registers too given the one object both use. */
function withSharedPlugins(
  teamPlugins: Readonly<Record<string, ESLint.Plugin>>,
  plugins: ReadonlyMap<string, ESLint.Plugin>,
): Record<string, ESLint.Plugin> {
  return Object.fromEntries(
    Object.entries(teamPlugins).map(([prefix, teamPlugin]): [string, ESLint.Plugin] => {
      const shared = plugins.get(prefix)
      return [prefix, shared === undefined ? teamPlugin : shared]
    }),
  )
}
