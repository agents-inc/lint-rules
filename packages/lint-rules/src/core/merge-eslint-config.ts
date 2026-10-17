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

/** Whatever ESLint's `defineConfig` takes. */
export type TeamEslintConfig = Parameters<typeof defineConfig>[number]

type PluginMeta = NonNullable<ESLint.Plugin['meta']>

type TeamFiles = Pick<TeamTypeInformationBlock, 'files' | 'ignores'>

type TypeInformationOption = (typeof TYPE_INFORMATION_OPTIONS)[number]

/** Base, typed, scopes, entries; no off-switch. */
type OurBlocks = readonly Linter.Config[]

type RulesWhere = Where & { readonly rules: Linter.RulesRecord }

type SettingWhere = Where & SettingOfOurs

type SettingsWhere = Where & { readonly settings: NonNullable<Linter.Config['settings']> }

type SettingsBesideTheTeam = { readonly base: Linter.Config; readonly keptToTheirFiles: readonly Linter.Config[] }

const TYPE_INFORMATION_OPTIONS = ['project', 'projectService'] as const
// Joined to a plugin's own version as semver build metadata, so its cache key carries ours too.
const OUR_BUILD_TAG = 'agents-inc-lint-rules'
const GLOB_SEPARATOR = '/'
const EVERY_FILE_UNDER = '/**'
const CONFINED = 'confined'
const SETTINGS = 'settings'
// A block holding any other key, language options or plugins, still gives something once its rules are gone.
const KEYS_OF_A_RULES_BLOCK: ReadonlySet<string> = new Set(['name', 'files', 'ignores', 'rules'])
// A block holding ignores and no other key but these is global ignores (@eslint/config-array 0.23, META_FIELDS).
const KEYS_OF_GLOBAL_IGNORES: ReadonlySet<string> = new Set(['name', 'basePath', 'ignores'])

/** Ours first, then the team's blocks. A rule the team's ESLint or oxlint config sets anywhere, under either twin name, is the team's in every file. Our ignores keep only our rules out of their files. */
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

function ourPartLeavingOut(setByTheTeam: ReadonlySet<string>, part: EslintPart): EslintPart {
  return { ...part, layers: ourLayersLeavingOut(setByTheTeam, part.layers), oxlintLayers: ourLayersLeavingOut(setByTheTeam, part.oxlintLayers) }
}

function whereOurBlocksMayRunBeside(teamBlocks: readonly Linter.Config[], { layers, tsconfigRootDir }: EslintPart): FilesCondition {
  return notOf(filesOurBlocksAreKeptOutOf(ourEslintPartOf(layers), eslintDefaultIgnoresHoldBeside(teamBlocks, tsconfigRootDir)))
}

/** Where the team's global ignores take nothing back from ESLint's default ones, ESLint already keeps those files out of every block, so ours need only our own ignores. */
function filesOurBlocksAreKeptOutOf({ leftOut, leftOutByOurIgnores }: OurEslintPart, eslintDefaultIgnoresHold: boolean): FilesCondition {
  return eslintDefaultIgnoresHold ? leftOutByOurIgnores : leftOut
}

/** ESLint reads the team's global ignores after its default ones; a function among them only leaves files out, so it adds no glob. */
function eslintDefaultIgnoresHoldBeside(teamBlocks: readonly Linter.Config[], tsconfigRootDir: string): boolean {
  const globalIgnores = teamBlocks.filter(isGlobalIgnores).map(withGlobsOnly)
  return eslintDefaultIgnoresHoldUnder(globalIgnores.flatMap((block) => teamFilesFromTheRoot(block, tsconfigRootDir).flatMap(({ ignores }) => ignores)))
}

/** A block holding only a name or basePath counts too, and gives no glob. */
function isGlobalIgnores(block: Linter.Config): boolean {
  return Object.keys(block).every((key) => KEYS_OF_GLOBAL_IGNORES.has(key))
}

/** Our runtime globals go right after the base block. No global ignores: ours keep only our rules out. */
function blocksInOrder({ base, afterTheBase }: BlocksBeforeTheOffSwitch, runtimeGlobals: OurBlocks): OurBlocks {
  return [base, ...runtimeGlobals, ...afterTheBase]
}

/** Our runtime globals are given only where a rule of ours reads them, so the team's own no-undef stays its own elsewhere. Beside oxlint, ESLint runs none. */
function whereOurRuntimeGlobalsAreRead(layers: RuleLayers, catalog: Catalog): FilesCondition {
  return eitherOf(...runtimeGlobalReadersOnIn(layers, catalog).map((ruleId) => whereOurEslintPartRuns(ruleId, layers)))
}

/** A block whose rules must stay out of some files gets a copy after it kept to the rest; a block left with nothing to give is dropped. */
function confinedBeside(block: Linter.Config, whereOurBlocksMayRun: FilesCondition): Linter.Config[] {
  if (matchesEveryFile(whereOurBlocksMayRun)) return keptWhereItGivesAnything(block)
  const copies = eachWithin(rulesKeptTo(whereOurBlocksMayRun, rulesStatedIn(block)))
  return [
    ...keptWhereItGivesAnything({ ...block, rules: {} }),
    ...copies.map((copy, index) => ourBlockWithin(block, copy, `${nameOf(block)}/${CONFINED}/${String(index)}`)),
  ]
}

function rulesKeptTo(where: FilesCondition, rules: Linter.RulesRecord): RulesWhere[] {
  return Object.keys(rules).length === 0 ? [] : [{ where, rules }]
}

function keptWhereItGivesAnything(block: Linter.Config): Linter.Config[] {
  return givesAnything(block) ? [block] : []
}

function ourBlockWithin(block: Linter.Config, { within, rules }: Within<RulesWhere>, name: string): Linter.Config {
  return { ...scopeWithin(block, within, name), rules }
}

/** Globs ANDed with the block's own, ignores after its own. */
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

/** ESLint merges `settings` key by key, and plugins read newer keys first (settings.n before settings.node, import-x/resolver-next before import-x/resolver), so a setting of ours could hide the team's. Each is ours only where no team block gives a setting it yields to. */
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

function ourSettingsIn(base: Linter.Config): NonNullable<Linter.Config['settings']> {
  const { settings } = base
  if (settings === undefined) throw new Error(`${nameOf(base)}: our base block gives our settings`)
  return settings
}

function whereTheTeamGivesAnyOf(paths: readonly SettingPath[], teamBlocks: readonly Linter.Config[], tsconfigRootDir: string): FilesCondition {
  const giving = teamBlocks.filter(({ settings = {} }) => paths.some((path) => givesTheSetting(settings, path)))
  return eitherOf(...giving.map((block) => filesTheTeamBlockAppliesTo(block, tsconfigRootDir)))
}

function givesAnything(block: Linter.Config): boolean {
  const { rules = {} } = block
  return Object.keys(rules).length > 0 || Object.keys(block).some((key) => !KEYS_OF_A_RULES_BLOCK.has(key))
}

function nameOf({ name }: Linter.Config): string {
  if (name === undefined) throw new Error('a block of ours has no name')
  return name
}

/** A team's `files` or `ignores` may hold a function, which no glob can stand for: the block is read as applying wherever it may, so ours stays out of every file the team's setting may reach. */
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

/** A function reads as matching every file, so it adds no glob. */
function globsOfEntry(entry: unknown): FilesEntry {
  if (isGlob(entry)) return entry
  return Array.isArray(entry) ? entry.filter(isGlob) : []
}

function isGlob(value: unknown): value is string {
  return typeof value === 'string'
}

/** ESLint refuses a suppression of a rule it has no definition of, so each rule a suppression may name gets a stub. */
function pluginNeedsOf(part: EslintPart, catalog: Catalog): PluginNeeds {
  const ruleIdsRun = ruleIdsOnIn(part.layers)
  return {
    ruleNamesRun: ruleNamesByPrefix([...ruleIdsRun, ...extensionsTakingOverOnTsFiles(ruleIdsRun, part, catalog)]),
    ruleNamesStubbed: part.usesOxlint ? oxlintRuleNamesByPrefix(catalog) : new Map(),
  }
}

/** Without oxlint, typescript-eslint's extension of each core rule ESLint takes over runs on TS files in its place, on our module whatever object the team registers. */
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
    layers: layersWithoutRuntimeGlobals(part.layers),
    plugins,
    // The team's noInlineConfig stands either way. Beside oxlint, each engine flags the other's suppressions as unused.
    linterOptions: part.usesOxlint ? { reportUnusedDisableDirectives: 'off' } : null,
    settings,
    typeInformation,
    twinsOnTsFiles: !part.usesOxlint,
  }
}

/** ESLint's --cache keys results on each plugin's name@version, and some plugins carry none, so an upgrade of this package would serve stale results (measured). Each plugin carries our version too, on a copy. */
function withOurVersionInEachCacheKey(
  plugins: ReadonlyMap<string, ESLint.Plugin>,
  ourVersion: string,
): ReadonlyMap<string, ESLint.Plugin> {
  return new Map(
    [...plugins].map(([prefix, plugin]): [string, ESLint.Plugin] => [prefix, withOurVersion(prefix, plugin, ourVersion)]),
  )
}

/** ESLint reads a plugin's name and version from its top level before its meta, skipping an empty one, so both move into the meta. */
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

/** typescript-eslint builds one project service per process, so beside the team's type information ours would be fatal (measured). Our typed rules then run only where the team's blocks give types, as its disableTypeChecked would. */
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

/** Off where the block sets to false or null an option an earlier block turned on; types given through the other option stay (measured). Null where it leaves type information as it was. */
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

function parserOptionsOf({ languageOptions = {} }: Linter.Config): Readonly<Record<string, unknown>> {
  const { parserOptions } = languageOptions
  return isRecord(parserOptions) ? parserOptions : {}
}

function turnsOn(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false
}

/** ESLint keeps an earlier block's value where a later one leaves the option out or sets it undefined. */
function switchesOff(value: unknown): boolean {
  return value === false || value === null
}

/** ESLint reads a team block's globs from its basePath and ours from the project root, so the team's are re-read from the root. None where the basePath holds no file of the project. */
function teamFilesFromTheRoot({ basePath, files, ignores = [] }: Linter.Config, tsconfigRootDir: string): TeamFiles[] {
  const asWritten: TeamFiles = { files: files === undefined ? null : files, ignores }
  if (basePath === undefined) return [asWritten]
  const basePathFromTheRoot = pathFromTheRoot(basePath, tsconfigRootDir)
  if (basePathFromTheRoot === null) return teamFilesReadFromAbove(asWritten, rootFromTheBasePath(basePath, tsconfigRootDir))
  return basePathFromTheRoot === '' ? [asWritten] : [teamFilesUnder(literalGlobOf(basePathFromTheRoot), asWritten)]
}

/** The folders from the basePath down to the root; null where the basePath is not above it. */
function rootFromTheBasePath(basePath: string, tsconfigRootDir: string): string[] | null {
  const fromTheBasePath = relative(resolve(tsconfigRootDir, basePath), tsconfigRootDir)
  return liesOutside(fromTheBasePath) ? null : fromTheBasePath.split(sep)
}

function teamFilesReadFromAbove({ files, ignores }: TeamFiles, folders: readonly string[] | null): TeamFiles[] {
  if (folders === null) return []
  const ignoresFromTheRoot = ignores.flatMap((glob) => globsReadFromTheRoot(glob, folders))
  if (files === null) return [{ files: null, ignores: ignoresFromTheRoot }]
  const entries = files.flatMap((entry) => entriesReadFromTheRoot(globsOf(entry), folders))
  return entries.length === 0 ? [] : [{ files: entries, ignores: ignoresFromTheRoot }]
}

/** One entry for each choice of a reading of each glob. */
function entriesReadFromTheRoot(globs: readonly string[], folders: readonly string[]): FilesEntry[] {
  const readingsOfEachGlob = globs.map((glob) => globsReadFromTheRoot(glob, folders))
  return cartesianProductOf(readingsOfEachGlob).map(asFilesEntry)
}

function cartesianProductOf<Member>(lists: readonly (readonly Member[])[]): Member[][] {
  return lists.reduce<Member[][]>((sofar, list) => sofar.flatMap((combination) => list.map((member) => [...combination, member])), [[]])
}

/** ESLint resolves a relative basePath against the config file's directory, the same one our globs are read from; an absolute one is read against tsconfigRootDir. Null where it lies outside. */
function pathFromTheRoot(basePath: string, tsconfigRootDir: string): string | null {
  const fromTheRoot = relative(tsconfigRootDir, resolve(tsconfigRootDir, basePath))
  return liesOutside(fromTheRoot) ? null : fromTheRoot.split(sep).join(GLOB_SEPARATOR)
}

/** Each entry ANDs every file under the basePath: a negated glob alone would match outside it. */
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

function teamBlockBeside(block: Linter.Config, plugins: ReadonlyMap<string, ESLint.Plugin>): Linter.Config {
  const { plugins: teamPlugins } = block
  return teamPlugins === undefined ? block : { ...block, plugins: withSharedPlugins(teamPlugins, plugins) }
}

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
