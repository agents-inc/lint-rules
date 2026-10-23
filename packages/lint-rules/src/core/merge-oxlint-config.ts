import type { Catalog, OxlintRule } from '@workspace/rule-data'
import { foundOr, groupBy } from '@workspace/rule-data/collections'
import type { DummyRuleMap, OxlintConfig, OxlintEnv, OxlintGlobals, OxlintOverride } from 'oxlint'
import { type OxlintPlugin, sortedUnique } from './build-oxlint-config.ts'
import { runtimeEnvsOf } from './catalog-lookups.ts'
import { configErrorIn } from './config-error.ts'
import type { OxlintPart } from './editor-parts.ts'
import { bothOf, eitherOf, type FilesCondition, keyOfCondition } from './file-conditions.ts'
import { EVERY_FILE_AT_ANY_DEPTH } from './globs.ts'
import { isRecord } from './is-record.ts'
import {
  ALWAYS_RUN,
  type CategorySeverities,
  categorySeverityOf,
  configsInOxlintOrder,
  extendedBy,
  isAnObject,
  isOn,
  leavesCorrectnessAtOxlintsDefault,
  type Listing,
  oxlintRuleKeyed,
  oxlintRulesBySpelling,
  type OxlintRulesBySpelling,
  oxlintRuleSpelled,
  pluginOf,
  pluginsAppliedIn,
  type RuleEntry,
  ruleIdsTheTeamsOxlintConfigSets,
  type TeamResolution,
  teamResolutionOf,
  whereItApplies,
} from './oxlint-config-reading.ts'
import { filesLess, type OverrideFiles, overrideFilesOf } from './oxlint-override-files.ts'
import { REACT_VERSION } from './react-version.ts'
import { type RuleLayers, runtimeGlobalReadersOnIn } from './resolve-rule-layers.ts'
import { ourLayersLeavingOut, rulesTheTeamSets, withEveryTwin } from './rules-the-team-sets.ts'
import {
  type OurOxlintPart,
  ourOxlintPartOf,
  whereOurOxlintPartRuns,
  whereTheOverrideApplies,
  whereTheOverrideLeavesItOn,
} from './where-our-parts-run.ts'

// oxlint 1.87 quirks the merge works around (checked by merge-oxlint-config.differential.integration.test.ts):
// - In a file, the first override listing plugins beyond those listed for the file switches on, by the
//   root's categories, each unset rule of the plugins not listed at the root.
// - An extended config's root env reaches no file; its overrides' env does.
// - Override `files`/`excludeFiles` globs without a slash match that name in any folder; `ignorePatterns`
//   are .gitignore lines.
// The merge lists every plugin at the root and restates what oxlint would have switched on for the team,
// so rules our part does not state run as the team's config alone runs them.

type ListingsExcludingOneList = { readonly excludeFiles: readonly string[]; readonly excluding: readonly Listing[] }

type ListingsOfOneSet = { readonly plugins: ReadonlySet<OxlintPlugin>; readonly listings: readonly Listing[] }

/** `extendsKey` places the overrides first where the team extends a config. */
type FirstInLine = { readonly extendsKey: Pick<OxlintConfig, 'extends'>; readonly overrides: readonly OxlintOverride[] }

type GroupOfAlike<Item> = { readonly first: Item; readonly members: readonly Item[] }

type OxlintSettings = NonNullable<OxlintConfig['settings']>

type OnStatement = { readonly oxlintName: string; readonly entry: RuleEntry; readonly where: FilesCondition }

type OnStatementsWhere = { readonly where: FilesCondition; readonly statements: readonly OnStatement[] }

/** What our overrides stay out of: files our ignores leave out, and the env keys and globals the team's root sets. */
type OursBesideTheTeams = {
  readonly leftOut: FilesCondition
  readonly teamsRoot: EnvAndGlobals
  readonly runtimeEnvs: ReadonlySet<string>
  readonly whereRuntimeEnvsAreRead: FilesCondition
}

type EnvAndGlobals = Pick<OxlintOverride, 'env' | 'globals'>

type RuntimeEnvApart = { readonly runtimeEnv: OxlintEnv; readonly others: EnvAndGlobals }

const NOT_FOUND = -1

/** Ours come first, on-statements only, since a later override beats the root and earlier overrides; a rule the team's oxlint or ESLint config sets anywhere is left to the team. Listing every plugin at the root changes what runs for the team, so that is undone first in line. The team's options stand as written: oxlint refuses any option in a config below the one it starts from. */
export function mergeOxlintPart(theirs: OxlintConfig, part: OxlintPart, catalog: Catalog, setByTheTeamsEslintConfig: readonly string[]): OxlintConfig {
  const bySpelling = oxlintRulesBySpelling(catalog)
  const team = teamResolutionOf(theirs, bySpelling)
  const setByTheTeam = rulesTheTeamSets([...ruleIdsTheTeamsOxlintConfigSets(theirs, catalog), ...setByTheTeamsEslintConfig], catalog)
  const ours = ourOnStatements(ourLayersLeavingOut(setByTheTeam, part.layers), catalog, envAndGlobalsGivenBy(theirs))
  const plugins = everyPluginListed(team, ours, bySpelling)
  const asTheTeamsConfigAloneRuns = asTheTeamsConfigAloneRunsBeside(plugins, team, catalog)
  const copiesOfOurEslintRulesOff = offWhereTheRootRunsThem(copiesOxlintsDefaultRunsBesideOurEslintPart(theirs, part, setByTheTeam, catalog))
  const { overrides = [], settings, extends: extended = [], ...untouched } = theirs
  const extendedObjects = extendedObjectsWithIgnoredStatementsDropped(extended, team, bySpelling)
  const firstInLine = placedFirstInLine([...asTheTeamsConfigAloneRuns, ...copiesOfOurEslintRulesOff, ...ours], extendedObjects)
  return {
    ...untouched,
    plugins,
    ...firstInLine.extendsKey,
    overrides: [...firstInLine.overrides, ...overridesWithIgnoredStatementsDropped(overrides, team, bySpelling)],
    settings: withOurReactVersionUnlessTheTeamGivesOne(settings),
  }
}

function asTheTeamsConfigAloneRunsBeside(mergedRootPlugins: readonly OxlintPlugin[], team: TeamResolution, catalog: Catalog): OxlintOverride[] {
  return [...offWhereTheRootRunsThem(oxlintNamesOnlyTheMergedRootRuns(team, mergedRootPlugins, catalog)), ...categorySwitchesOf(team, catalog)]
}

/** oxlint refuses a JS or TS config that extends a config by path ("extends[0] must be a config object"), so the merge refuses it first, naming the entry. */
export function refuseAPathInExtends(theirs: OxlintConfig, oxlintConfigFile: string): void {
  const pathAt = configsInOxlintOrder(theirs)
    .map((config) => extendedBy(config).findIndex((extended) => !isAnObject(extended)))
    .find((index) => index !== NOT_FOUND)
  if (pathAt !== undefined) {
    throw configErrorIn(oxlintConfigFile, `extends[${String(pathAt)}] is a path, which oxlint refuses in a JS or TS config: import that file and put the object in extends`)
  }
}

function everyPluginListed(team: TeamResolution, ours: readonly OxlintOverride[], bySpelling: OxlintRulesBySpelling): OxlintPlugin[] {
  const listedInOverrides = team.listings.flatMap(({ plugins }) => [...plugins])
  return sortedUnique([...team.rootPlugins, ...listedInOverrides, ...pluginsOfTheRulesIn(ours, bySpelling)])
}

function pluginsOfTheRulesIn(overrides: readonly OxlintOverride[], bySpelling: OxlintRulesBySpelling): OxlintPlugin[] {
  return overrides.flatMap(({ rules = {} }) => Object.keys(rules).map((spelling) => pluginOfRuleSpelled(spelling, bySpelling)))
}

function envAndGlobalsGivenBy({ env, globals }: EnvAndGlobals): EnvAndGlobals {
  return { ...(env === undefined ? {} : { env }), ...(globals === undefined ? {} : { globals }) }
}

/** Each rule is on exactly where our part alone runs it, and stated nowhere else. Env and globals the team's root sets are left out, and our runtimes' envs go only where a rule of ours reads them, so the team's own no-undef stays its own. */
function ourOnStatements(layers: RuleLayers, catalog: Catalog, teamsRoot: EnvAndGlobals): OxlintOverride[] {
  const ourPart = ourOxlintPartOf(layers, catalog)
  const beside: OursBesideTheTeams = {
    leftOut: ourPart.leftOut,
    teamsRoot,
    runtimeEnvs: runtimeEnvsOf(catalog),
    whereRuntimeEnvsAreRead: whereOurRuntimeEnvsAreRead(layers, ourPart, catalog),
  }
  return ourPart.inLine.flatMap((override, index) => turningOnOnly(override, ourPart.inLine.slice(index + 1), beside))
}

function whereOurRuntimeEnvsAreRead(layers: RuleLayers, ourPart: OurOxlintPart, catalog: Catalog): FilesCondition {
  return eitherOf(...runtimeGlobalReadersOnIn(layers, catalog).map((ruleId) => whereOurOxlintPartRuns(ruleId, ourPart, catalog)))
}

function turningOnOnly(override: OxlintOverride, laterOfOurs: readonly OxlintOverride[], beside: OursBesideTheTeams): OxlintOverride[] {
  const statements = onStatementsOf(override, laterOfOurs, beside.leftOut)
  const { runtimeEnv, others } = runtimeEnvApart(envAndGlobalsLessTheTeams(override, beside.teamsRoot), beside.runtimeEnvs)
  const where = whereTheOverrideApplies(override, beside.leftOut)
  return [
    ...withEnvAndGlobalsWhereTheyHold(statementsByWhere(statements), where, others),
    ...runtimeEnvWhere(bothOf(where, beside.whereRuntimeEnvsAreRead), runtimeEnv),
  ]
}

function onStatementsOf(override: OxlintOverride, laterOfOurs: readonly OxlintOverride[], leftOut: FilesCondition): OnStatement[] {
  return rulesTurnedOnIn(override).map(([oxlintName, entry]) => ({ oxlintName, entry, where: whereTheOverrideLeavesItOn(override, laterOfOurs, oxlintName, leftOut) }))
}

function runtimeEnvApart({ env = {}, ...globals }: EnvAndGlobals, runtimeEnvs: ReadonlySet<string>): RuntimeEnvApart {
  const runtimeEnv = Object.fromEntries(Object.entries(env).filter(([key]) => runtimeEnvs.has(key)))
  const otherEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !runtimeEnvs.has(key)))
  return { runtimeEnv, others: { ...(isEmpty(otherEnv) ? {} : { env: otherEnv }), ...globals } }
}

function runtimeEnvWhere(where: FilesCondition, runtimeEnv: OxlintEnv): OxlintOverride[] {
  if (isEmpty(runtimeEnv)) return []
  return overrideFilesOf(where).map((files): OxlintOverride => ({ ...files, env: runtimeEnv }))
}

function statementsByWhere(statements: readonly OnStatement[]): OnStatementsWhere[] {
  return groupsOfAlike(statements, ({ where }) => keyOfCondition(where)).map(({ first, members }) => ({ where: first.where, statements: members }))
}

function withEnvAndGlobalsWhereTheyHold(byWhere: readonly OnStatementsWhere[], envAndGlobalsWhere: FilesCondition, envAndGlobals: EnvAndGlobals): OxlintOverride[] {
  if (Object.keys(envAndGlobals).length === 0) return byWhere.flatMap((group) => overridesTurningOn(group, {}))
  const holdsWhereTheyDo = ({ where }: OnStatementsWhere): boolean => keyOfCondition(where) === keyOfCondition(envAndGlobalsWhere)
  const ofTheirOwn = byWhere.some(holdsWhereTheyDo) ? [] : overrideFilesOf(envAndGlobalsWhere).map((files): OxlintOverride => ({ ...files, ...envAndGlobals }))
  return [...ofTheirOwn, ...byWhere.flatMap((group) => overridesTurningOn(group, holdsWhereTheyDo(group) ? envAndGlobals : {}))]
}

function overridesTurningOn({ where, statements }: OnStatementsWhere, withEnvAndGlobals: EnvAndGlobals): OxlintOverride[] {
  return overrideFilesOf(where).map((files): OxlintOverride => ({ ...files, ...withEnvAndGlobals, rules: onEntriesOf(statements) }))
}

function onEntriesOf(statements: readonly OnStatement[]): DummyRuleMap {
  return Object.fromEntries(statements.map(({ oxlintName, entry }) => [oxlintName, entry]))
}

function rulesTurnedOnIn({ rules = {} }: OxlintOverride): [string, RuleEntry][] {
  return Object.entries(rules).filter((statement): statement is [string, RuleEntry] => isOn(statement[1]))
}

/** The team's root env and globals stand in every file, so ours leave out each key it sets. */
function envAndGlobalsLessTheTeams({ env = {}, globals = {} }: EnvAndGlobals, teamsRoot: EnvAndGlobals): EnvAndGlobals {
  const ourEnv: OxlintEnv = withoutKeysSetIn(env, teamsRoot.env)
  const ourGlobals: OxlintGlobals = withoutKeysSetIn(globals, teamsRoot.globals)
  return { ...(isEmpty(ourEnv) ? {} : { env: ourEnv }), ...(isEmpty(ourGlobals) ? {} : { globals: ourGlobals }) }
}

function withoutKeysSetIn<Value>(ours: Readonly<Record<string, Value>>, teams: Readonly<Record<string, unknown>> = {}): Record<string, Value> {
  return Object.fromEntries(Object.entries(ours).filter(([key]) => teams[key] === undefined))
}

function isEmpty(record: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(record).length === 0
}

/** A config imported from .oxlintrc.json is untyped: settings that are no object where oxlint takes one stay as written, for oxlint to read as it would alone. */
function withOurReactVersionUnlessTheTeamGivesOne(settings: OxlintSettings = {}): OxlintSettings {
  if (!isRecord(settings)) return settings
  const { react = {} } = settings
  if (!isRecord(react)) return settings
  if (react.version !== undefined) return settings
  return { ...settings, react: { ...react, version: REACT_VERSION } }
}

/** Rules the merged root turns on that the team's root does not: plugins it did not list, or root statements oxlint ignored for the team. */
function oxlintNamesOnlyTheMergedRootRuns(team: TeamResolution, mergedRootPlugins: readonly OxlintPlugin[], catalog: Catalog): string[] {
  const onlyMergedRootPlugins = new Set(mergedRootPlugins.filter((plugin) => plugin !== ALWAYS_RUN && !team.rootPlugins.has(plugin)))
  const isOfAPluginOnlyTheMergedRootLists = (rule: OxlintRule): boolean => onlyMergedRootPlugins.has(pluginOf(rule))
  const ofTheCategories = catalog.oxlintRules.filter(
    (rule) => isOfAPluginOnlyTheMergedRootLists(rule) && isOn(categorySeverityOf(rule, team.categories)),
  )
  const statedAtARoot = team.rulesStatedAtARoot.filter(isOfAPluginOnlyTheMergedRootLists)
  return [...new Set([...ofTheCategories, ...statedAtARoot].map(({ oxlintName }) => oxlintName))]
}

/** Where the team leaves correctness to oxlint's default, that silent `correctness: warn` would run oxlint's copy of each rule our ESLint part runs, so those copies are turned off. */
function copiesOxlintsDefaultRunsBesideOurEslintPart(theirs: OxlintConfig, part: OxlintPart, setByTheTeam: ReadonlySet<string>, catalog: Catalog): string[] {
  if (!leavesCorrectnessAtOxlintsDefault(theirs)) return []
  const ourEslintPartRuns = withEveryTwin(new Set(part.turnedOnInEslint), catalog)
  return catalog.oxlintRules.filter(({ id }) => ourEslintPartRuns.has(id) && !setByTheTeam.has(id)).map(({ oxlintName }) => oxlintName)
}

/** First in line, so it applies before any of the team's overrides. */
function offWhereTheRootRunsThem(oxlintNames: readonly string[]): OxlintOverride[] {
  if (oxlintNames.length === 0) return []
  return [{ files: [EVERY_FILE_AT_ANY_DEPTH], rules: offEntriesFor(oxlintNames) }]
}

/** Restates the categories oxlint switches on for the team in its overrides, before the team's overrides, so the team's statements decide as before. */
function categorySwitchesOf(team: TeamResolution, catalog: Catalog): OxlintOverride[] {
  const fullListings = team.listings.filter((listing) => listsEveryRootPlugin(listing, team))
  const otherListings = team.listings.filter((listing) => !listsEveryRootPlugin(listing, team))
  return [
    ...listingsBySet(fullListings).flatMap((ofOneSet) => switchesBesideOtherListings(ofOneSet, team, catalog)),
    ...otherListings.flatMap(({ where, plugins }) => switchesWhere(where, categoryRulesSwitchedOnFor(plugins, team, catalog))),
  ]
}

function listsEveryRootPlugin({ plugins }: Listing, { rootPlugins }: TeamResolution): boolean {
  return [...rootPlugins].every((plugin) => plugins.has(plugin))
}

function categoryRulesSwitchedOnFor(listed: ReadonlySet<OxlintPlugin>, { rootPlugins, categories }: TeamResolution, catalog: Catalog): DummyRuleMap {
  const notAtTheRoot = new Set([...listed].filter((plugin) => !rootPlugins.has(plugin)))
  return categoryRulesOf(notAtTheRoot, categories, catalog)
}

/** On in a set's files where a listing of another set matches too, then off where none does. Another set's later switches never undo these. */
function switchesBesideOtherListings({ plugins, listings }: ListingsOfOneSet, team: TeamResolution, catalog: Catalog): OxlintOverride[] {
  const listingsOfOtherSets = team.listings.filter((listing) => !isTheSameSet(listing.plugins, plugins))
  const rules = categoryRulesSwitchedOnFor(plugins, team, catalog)
  if (listingsOfOtherSets.length === 0 || Object.keys(rules).length === 0) return []
  const offs = offEntriesFor(Object.keys(rules))
  return [...listings.flatMap(({ where }) => switchesWhere(where, rules)), ...offOutside(listingsOfOtherSets, offs)]
}

/** A file excluded by listings with different `excludeFiles` is not reached, as each list is taken alone (a known limit). */
function offOutside(listings: readonly Listing[], offs: DummyRuleMap): OxlintOverride[] {
  const outsideEvery: OxlintOverride = { files: [EVERY_FILE_AT_ANY_DEPTH], excludeFiles: filesOf(listings), rules: offs }
  return [outsideEvery, ...listingsByExcludeFiles(listings).flatMap((excludingOneList) => offWhereTheyExclude(excludingOneList, listings, offs))]
}

function offWhereTheyExclude(
  { excludeFiles, excluding }: ListingsExcludingOneList,
  listings: readonly Listing[],
  offs: DummyRuleMap,
): OxlintOverride[] {
  const otherFiles = filesOf(listings.filter((listing) => !excluding.includes(listing)))
  const files = excludeFiles.filter((glob) => !otherFiles.includes(glob))
  return files.length === 0 ? [] : [{ ...filesLess(files, otherFiles), rules: offs }]
}

function listingsByExcludeFiles(listings: readonly Listing[]): ListingsExcludingOneList[] {
  const excluding = listings.filter(({ where }) => excludeFilesOf(where).length > 0)
  return groupsOfAlike(excluding, ({ where }) => orderInsensitiveKeyOf(excludeFilesOf(where))).map(({ first, members }) => ({
    excludeFiles: excludeFilesOf(first.where),
    excluding: members,
  }))
}

function switchesWhere(where: OverrideFiles, rules: DummyRuleMap): OxlintOverride[] {
  return Object.keys(rules).length === 0 ? [] : [{ ...whereItApplies(where), rules }]
}

function categoryRulesOf(plugins: ReadonlySet<OxlintPlugin>, categories: CategorySeverities, catalog: Catalog): DummyRuleMap {
  const rulesOfThePlugins = catalog.oxlintRules.filter((rule) => plugins.has(pluginOf(rule)))
  return Object.fromEntries(rulesOfThePlugins.flatMap((rule) => entryWhereItsCategoryIsOn(rule, categories)))
}

function entryWhereItsCategoryIsOn(rule: OxlintRule, categories: CategorySeverities): [string, RuleEntry][] {
  const severity = categorySeverityOf(rule, categories)
  return isOn(severity) ? [[rule.oxlintName, severity]] : []
}

function listingsBySet(listings: readonly Listing[]): ListingsOfOneSet[] {
  return groupsOfAlike(listings, ({ plugins }) => orderInsensitiveKeyOf([...plugins])).map(({ first, members }) => ({ plugins: first.plugins, listings: members }))
}

/** Groups keep the order of their first items, and items keep their order within a group. */
function groupsOfAlike<Item>(items: readonly Item[], keyOf: (item: Item) => string): GroupOfAlike<Item>[] {
  return groupBy(items, keyOf).values().toArray().map(asGroupOfAlike)
}

function asGroupOfAlike<Item>(members: readonly Item[]): GroupOfAlike<Item> {
  return { first: foundOr(members.at(0), 'a group holds at least one item'), members }
}

function isTheSameSet(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  return first.size === second.size && [...first].every((member) => second.has(member))
}

function orderInsensitiveKeyOf(values: readonly string[]): string {
  return JSON.stringify(sortedUnique([...values]))
}

/** Drops override statements oxlint skips for the team (a rule whose plugin neither root nor override lists), since listing every plugin at the root would make them run. */
function withIgnoredStatementsDropped(config: OxlintConfig, team: TeamResolution, bySpelling: OxlintRulesBySpelling): OxlintConfig {
  const { overrides, extends: extended } = config
  return {
    ...config,
    ...(overrides === undefined ? {} : { overrides: overridesWithIgnoredStatementsDropped(overrides, team, bySpelling) }),
    ...(extended === undefined ? {} : { extends: extendedObjectsWithIgnoredStatementsDropped(extended, team, bySpelling) }),
  }
}

function extendedObjectsWithIgnoredStatementsDropped(
  extended: NonNullable<OxlintConfig['extends']>,
  team: TeamResolution,
  bySpelling: OxlintRulesBySpelling,
): OxlintConfig[] {
  return extended.filter(isAnObject).map((config) => withIgnoredStatementsDropped(config, team, bySpelling))
}

function overridesWithIgnoredStatementsDropped(
  overrides: readonly OxlintOverride[],
  team: TeamResolution,
  bySpelling: OxlintRulesBySpelling,
): OxlintOverride[] {
  return overrides.map((override) => overrideWithIgnoredStatementsDropped(override, team, bySpelling))
}

function overrideWithIgnoredStatementsDropped(override: OxlintOverride, team: TeamResolution, bySpelling: OxlintRulesBySpelling): OxlintOverride {
  const { rules } = override
  if (rules === undefined) return override
  const appliedHere = pluginsAppliedIn(override, team)
  const applied = Object.entries(rules).filter(([key]) => isAppliedWhere(appliedHere, key, bySpelling))
  return applied.length === Object.keys(rules).length ? override : { ...override, rules: Object.fromEntries(applied) }
}

/** A JS plugin's rule always applies, as no plugin listing touches it. */
function isAppliedWhere(pluginsRunning: ReadonlySet<OxlintPlugin>, key: string, bySpelling: OxlintRulesBySpelling): boolean {
  const rule = oxlintRuleKeyed(key, bySpelling)
  return rule === undefined || pluginsRunning.has(pluginOf(rule))
}

/** oxlint applies an extended config's overrides before the config's own, so beside a team `extends` ours go in a first extended config. */
function placedFirstInLine(overrides: readonly OxlintOverride[], extendedObjects: readonly OxlintConfig[]): FirstInLine {
  if (extendedObjects.length === 0) return { extendsKey: {}, overrides }
  // An extended config listing no plugins adds none, where leaving `plugins` out would add the defaults.
  const first: OxlintConfig[] = overrides.length === 0 ? [] : [{ plugins: [], overrides: [...overrides] }]
  return { extendsKey: { extends: [...first, ...extendedObjects] }, overrides: [] }
}

function filesOf(listings: readonly Listing[]): string[] {
  return listings.flatMap(({ where }) => where.files)
}

function excludeFilesOf({ excludeFiles = [] }: OverrideFiles): readonly string[] {
  return excludeFiles
}

function pluginOfRuleSpelled(spelling: string, bySpelling: OxlintRulesBySpelling): OxlintPlugin {
  return pluginOf(oxlintRuleSpelled(spelling, bySpelling))
}

function offEntriesFor(spellings: readonly string[]): DummyRuleMap {
  return Object.fromEntries(spellings.map((spelling) => [spelling, 'off']))
}
