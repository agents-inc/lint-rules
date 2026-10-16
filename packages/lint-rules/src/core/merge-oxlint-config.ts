import type { Catalog, OxlintRule } from '@workspace/rule-data'
import type { AllowWarnDeny, DummyRuleMap, OxlintConfig, OxlintEnv, OxlintGlobals, OxlintOverride } from 'oxlint'
import { type OxlintPlugin, sortedUnique } from './build-oxlint-config.ts'
import { runtimeEnvsOf } from './catalog-lookups.ts'
import { configErrorIn } from './config-error.ts'
import type { OxlintPart } from './editor-parts.ts'
import { bothOf, eitherOf, type FilesCondition, keyOfCondition } from './file-conditions.ts'
import { EVERY_FILE_AT_ANY_DEPTH } from './globs.ts'
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
  pluginsCountedIn,
  type RuleEntry,
  ruleIdsTheTeamsOxlintConfigSets,
  type TeamResolution,
  teamResolutionOf,
  whereItApplies,
} from './oxlint-config-reading.ts'
import { filesLess, type OverrideFiles, overrideFilesOf } from './oxlint-override-files.ts'
import { type RuleLayers, runtimeGlobalReadersOnIn } from './resolve-rule-layers.ts'
import { ourLayersLeavingOut, rulesTheTeamSets, withEveryTwin } from './rules-the-team-sets.ts'
import {
  type OurOxlintPart,
  ourOxlintPartOf,
  whereOurOxlintPartRuns,
  whereTheOverrideApplies,
  whereTheOverrideLeavesItOn,
} from './where-our-parts-run.ts'

// How oxlint 1.87 applies a config the merge writes, beside what oxlint-config-reading.ts says of
// how it resolves one (oxc tag oxlint_v1.87.0, crates/oxc_linter/src/config), and checked against its
// CLI by merge-oxlint-config.differential.integration.test.ts:
// - In each file, the first override it matches that lists plugins other than every plugin listed
//   for the file switches on, by the root's categories, each rule not yet set of each plugin
//   listed for the file but not at the root. No other override switches categories on.
// - An extended config's root env reaches no file; the env of its overrides does (measured, 1.87).
// - An override's `files` and `excludeFiles` are globs, any one of which matches a file; one with no
//   slash matches a file of that name in any folder (measured, 1.87). `ignorePatterns` are read as
//   .gitignore lines instead, where a folder matched leaves out every file under it.
// The merge lists every plugin at the root, which switches no category on in any override, and
// states what oxlint would have switched on for the team: so every rule our part does not state
// runs in each file as the team's config alone runs it (questions.md #44), but for the copies
// oxlint's silent `correctness: warn` runs of rules our ESLint part runs, which are off. Ours come
// before every override of the team's, and state rules on only.

/** Listings excluding the same globs, and those globs. */
type ListingsExcludingOneList = { readonly excludeFiles: readonly string[]; readonly excluding: readonly Listing[] }

/** Listings that list the same plugins, and the plugins each lists. */
type ListingsOfOneSet = { readonly plugins: ReadonlySet<OxlintPlugin>; readonly listings: readonly Listing[] }

/** Overrides placed to apply before any of the team's, and the `extends` key that places them, where one does. */
type FirstInLine = { readonly extendsKey: Pick<OxlintConfig, 'extends'>; readonly overrides: readonly OxlintOverride[] }

/** Items alike, and the first of them. */
type GroupOfAlike<Item> = { readonly first: Item; readonly members: readonly Item[] }

/** The options a config gives oxlint. */
type OxlintOptions = NonNullable<OxlintConfig['options']>

/** A rule of ours turned on in an override, with its entry there, and the files it runs in from that override. */
type OnStatement = { readonly oxlintName: string; readonly entry: RuleEntry; readonly where: FilesCondition }

/** Statements holding in the same files. */
type OnStatementsWhere = { readonly where: FilesCondition; readonly statements: readonly OnStatement[] }

/**
 * What each override of ours stays out of: the files our ignores leave out, as oxlint reads them, and
 * the env keys and globals the team's root sets; and where it keeps our runtimes' envs to, the files
 * a rule of ours reading them runs in.
 */
type OursBesideTheTeams = {
  readonly leftOut: FilesCondition
  readonly teamsRoot: EnvAndGlobals
  readonly runtimeEnvs: ReadonlySet<string>
  readonly whereRuntimeEnvsAreRead: FilesCondition
}

/** The keys of a config or an override that give names as globals: its env, and its globals. */
type EnvAndGlobals = Pick<OxlintOverride, 'env' | 'globals'>

/** Our runtimes' env keys, and the rest of the env with the globals. */
type RuntimeEnvApart = { readonly runtimeEnv: OxlintEnv; readonly others: EnvAndGlobals }

// Each engine flags the other's suppressions as unused (measured 2026-10-04).
const UNUSED_DIRECTIVES_UNREPORTED: AllowWarnDeny = 'off'

const NOT_FOUND = -1

/**
 * The team's config with ours merged in (decisions.md, "Owner 2026-10-14"; spec-merge-model.md,
 * 1.5). A rule the team's oxlint config or its ESLint config sets anywhere, under any name of it or
 * of its typescript-eslint twin, is the team's in every file: our part states no spelling of it.
 * oxlint reads two spellings of one rule as one rule, and a later override beats the root and any
 * earlier override, an extended one included. So ours come first in line, on-statements only, and
 * nothing of ours follows the team's overrides. Every plugin is listed at the root, and what that
 * changes for the team is put back before ours: first, off, every rule the root then turns on that
 * the team's root did not; then the categories oxlint switches on for the team in an override, where
 * it does so; then, where the team leaves correctness to oxlint's default, oxlint's copy of each rule
 * our ESLint part runs, off. The team's statements oxlint ignores are dropped, as listing their
 * plugin would make them count. `setByTheTeamsEslintConfig` is the rules the team's ESLint config sets.
 */
export function mergeOxlintPart(theirs: OxlintConfig, part: OxlintPart, catalog: Catalog, setByTheTeamsEslintConfig: readonly string[]): OxlintConfig {
  const bySpelling = oxlintRulesBySpelling(catalog)
  const team = teamResolutionOf(theirs, bySpelling)
  const setByTheTeam = rulesTheTeamSets([...ruleIdsTheTeamsOxlintConfigSets(theirs, catalog), ...setByTheTeamsEslintConfig], catalog)
  const ours = ourOnStatements(ourLayersLeavingOut(setByTheTeam, part.layers), catalog, envAndGlobalsGivenBy(theirs))
  const plugins = everyPluginListed(team, ours, bySpelling)
  const asTheTeamsConfigAloneRuns = [
    ...offWhereTheRootRunsThem(oxlintNamesOnlyTheMergedRootRuns(team, plugins, catalog)),
    ...categorySwitchesOf(team, catalog),
  ]
  const copiesOfOurEslintRulesOff = offWhereTheRootRunsThem(copiesOxlintsDefaultRunsBesideOurEslintPart(theirs, part, setByTheTeam, catalog))
  const { overrides = [], options, extends: extended = [], ...untouched } = theirs
  const extendedObjects = extended.filter(isAnObject).map((config) => withIgnoredStatementsDropped(config, team, bySpelling))
  const firstInLine = placedFirstInLine([...asTheTeamsConfigAloneRuns, ...copiesOfOurEslintRulesOff, ...ours], extendedObjects)
  return {
    ...untouched,
    plugins,
    ...firstInLine.extendsKey,
    overrides: [...firstInLine.overrides, ...overrides.map((override) => overrideWithIgnoredStatementsDropped(override, team, bySpelling))],
    options: optionsKeepingTheTeams(options),
  }
}

/**
 * oxlint refuses a JS or TS config that extends a config by path, and loads none of it ("extends[0]
 * must be a config object", js_config.js): the merge refuses it first, naming the entry (#43).
 */
export function refuseAPathInExtends(theirs: OxlintConfig, oxlintConfigFile: string): void {
  const pathAt = configsInOxlintOrder(theirs)
    .map((config) => extendedBy(config).findIndex((extended) => !isAnObject(extended)))
    .find((index) => index !== NOT_FOUND)
  if (pathAt !== undefined) {
    throw configErrorIn(oxlintConfigFile, `extends[${String(pathAt)}] is a path, which oxlint refuses in a JS or TS config: import that file and put the object in extends`)
  }
}

/** The team's root plugins, every plugin its overrides list, and the plugin of every rule the merge states in our overrides. */
function everyPluginListed(team: TeamResolution, ours: readonly OxlintOverride[], bySpelling: OxlintRulesBySpelling): OxlintPlugin[] {
  const listedInOverrides = team.listings.flatMap(({ plugins }) => [...plugins])
  return sortedUnique([...team.rootPlugins, ...listedInOverrides, ...pluginsOfTheRulesIn(ours, bySpelling)])
}

function pluginsOfTheRulesIn(overrides: readonly OxlintOverride[], bySpelling: OxlintRulesBySpelling): OxlintPlugin[] {
  return overrides.flatMap(({ rules = {} }) => Object.keys(rules).map((spelling) => pluginOfRuleSpelled(spelling, bySpelling)))
}

/** The env and the globals a config gives: each key it gives at all. */
function envAndGlobalsGivenBy({ env, globals }: EnvAndGlobals): EnvAndGlobals {
  return { ...(env === undefined ? {} : { env }), ...(globals === undefined ? {} : { globals }) }
}

/**
 * Our part as on-statements only (spec, lane A2 Must 2): each rule the layers turn on is on exactly
 * where our part of those layers alone runs it, with that part's entry there, and stated nowhere
 * else. Each override of our part alone keeps the rules it turns on to the files it applies to that
 * our ignores leave in, as our part alone's `ignorePatterns` read them, less those a later override
 * of ours turns the rule off in. Our env and globals go where our part alone sets them, less each env
 * key and global the team's root sets (Q-E); and our runtimes' envs only where a rule of ours reading
 * them runs, so a team's own no-undef stays its own elsewhere (#68, read-q68).
 */
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

/** Where a rule of ours that reads our runtimes' globals runs, as oxlint reads our part alone. */
function whereOurRuntimeEnvsAreRead(layers: RuleLayers, ourPart: OurOxlintPart, catalog: Catalog): FilesCondition {
  return eitherOf(...runtimeGlobalReadersOnIn(layers, catalog).map((ruleId) => whereOurOxlintPartRuns(ruleId, ourPart, catalog)))
}

/** One override of our part alone as overrides that turn rules on only, each where the override leaves it on. */
function turningOnOnly(override: OxlintOverride, laterOfOurs: readonly OxlintOverride[], beside: OursBesideTheTeams): OxlintOverride[] {
  const statements = rulesTurnedOnIn(override).map(
    ([oxlintName, entry]): OnStatement => ({ oxlintName, entry, where: whereTheOverrideLeavesItOn(override, laterOfOurs, oxlintName, beside.leftOut) }),
  )
  const { runtimeEnv, others } = runtimeEnvApart(envAndGlobalsLessTheTeams(override, beside.teamsRoot), beside.runtimeEnvs)
  const where = whereTheOverrideApplies(override, beside.leftOut)
  return [
    ...withEnvAndGlobalsWhereTheyHold(statementsByWhere(statements), where, others),
    ...runtimeEnvWhere(bothOf(where, beside.whereRuntimeEnvsAreRead), runtimeEnv),
  ]
}

/** The runtimes' env keys apart from the rest of the env and the globals. */
function runtimeEnvApart({ env = {}, ...globals }: EnvAndGlobals, runtimeEnvs: ReadonlySet<string>): RuntimeEnvApart {
  const runtimeEnv = Object.fromEntries(Object.entries(env).filter(([key]) => runtimeEnvs.has(key)))
  const otherEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !runtimeEnvs.has(key)))
  return { runtimeEnv, others: { ...(isEmpty(otherEnv) ? {} : { env: otherEnv }), ...globals } }
}

/** Overrides giving the runtimes' env keys in the files given: none where there are none. */
function runtimeEnvWhere(where: FilesCondition, runtimeEnv: OxlintEnv): OxlintOverride[] {
  if (isEmpty(runtimeEnv)) return []
  return overrideFilesOf(where).map((files): OxlintOverride => ({ ...files, env: runtimeEnv }))
}

/** The statements, those holding in the same files together. */
function statementsByWhere(statements: readonly OnStatement[]): OnStatementsWhere[] {
  return groupsOfAlike(statements, holdInTheSameFiles).map(({ first, members }) => ({ where: first.where, statements: members }))
}

/**
 * The overrides turning the statements on, the env and globals on those holding exactly where they
 * do, or on overrides of their own before them.
 */
function withEnvAndGlobalsWhereTheyHold(byWhere: readonly OnStatementsWhere[], envAndGlobalsWhere: FilesCondition, envAndGlobals: EnvAndGlobals): OxlintOverride[] {
  if (Object.keys(envAndGlobals).length === 0) return byWhere.flatMap((group) => overridesTurningOn(group, {}))
  const holdsWhereTheyDo = ({ where }: OnStatementsWhere): boolean => keyOfCondition(where) === keyOfCondition(envAndGlobalsWhere)
  const ofTheirOwn = byWhere.some(holdsWhereTheyDo) ? [] : overrideFilesOf(envAndGlobalsWhere).map((files): OxlintOverride => ({ ...files, ...envAndGlobals }))
  return [...ofTheirOwn, ...byWhere.flatMap((group) => overridesTurningOn(group, holdsWhereTheyDo(group) ? envAndGlobals : {}))]
}

/** Overrides turning the statements on in their files, with the env and globals given. */
function overridesTurningOn({ where, statements }: OnStatementsWhere, withEnvAndGlobals: EnvAndGlobals): OxlintOverride[] {
  return overrideFilesOf(where).map((files): OxlintOverride => ({ ...files, ...withEnvAndGlobals, rules: onEntriesOf(statements) }))
}

function onEntriesOf(statements: readonly OnStatement[]): DummyRuleMap {
  return Object.fromEntries(statements.map(({ oxlintName, entry }) => [oxlintName, entry]))
}

function rulesTurnedOnIn({ rules = {} }: OxlintOverride): [string, RuleEntry][] {
  return Object.entries(rules).filter((statement): statement is [string, RuleEntry] => isOn(statement[1]))
}

/**
 * Our override's env less each key the team's root env sets, and its globals less each the team's
 * root globals set, which then stand in every file (Q-E): each key where something of it is left.
 */
function envAndGlobalsLessTheTeams({ env = {}, globals = {} }: EnvAndGlobals, teamsRoot: EnvAndGlobals): EnvAndGlobals {
  const ourEnv: OxlintEnv = withoutKeysSetIn(env, teamsRoot.env)
  const ourGlobals: OxlintGlobals = withoutKeysSetIn(globals, teamsRoot.globals)
  return { ...(isEmpty(ourEnv) ? {} : { env: ourEnv }), ...(isEmpty(ourGlobals) ? {} : { globals: ourGlobals }) }
}

/** The entries of ours whose key the team's leaves out: all of them where the team gives none. */
function withoutKeysSetIn<Value>(ours: Readonly<Record<string, Value>>, teams: Readonly<Record<string, unknown>> = {}): Record<string, Value> {
  return Object.fromEntries(Object.entries(ours).filter(([key]) => teams[key] === undefined))
}

function isEmpty(record: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(record).length === 0
}

function holdInTheSameFiles(first: OnStatement, second: OnStatement): boolean {
  return keyOfCondition(first.where) === keyOfCondition(second.where)
}

/** The team's options, with unused disable directives unreported where the team leaves that out. */
function optionsKeepingTheTeams(options: OxlintOptions = {}): OxlintOptions {
  const { reportUnusedDisableDirectives = UNUSED_DIRECTIVES_UNREPORTED } = options
  return { ...options, reportUnusedDisableDirectives }
}

/**
 * The oxlint name of each rule the merged root turns on that the team's root does not, once each: of
 * a plugin the team's root does not list, in a category the team's turn on, or stated at a root of
 * the team's config, where oxlint ignored the statement for the team.
 */
function oxlintNamesOnlyTheMergedRootRuns(team: TeamResolution, mergedRootPlugins: readonly OxlintPlugin[], catalog: Catalog): string[] {
  const onlyMergedRootPlugins = new Set(mergedRootPlugins.filter((plugin) => plugin !== ALWAYS_RUN && !team.rootPlugins.has(plugin)))
  const isOfAPluginOnlyTheMergedRootLists = (rule: OxlintRule): boolean => onlyMergedRootPlugins.has(pluginOf(rule))
  const ofTheCategories = catalog.oxlintRules.filter(
    (rule) => isOfAPluginOnlyTheMergedRootLists(rule) && isOn(categorySeverityOf(rule, team.categories)),
  )
  const statedAtARoot = team.rulesStatedAtARoot.filter(isOfAPluginOnlyTheMergedRootLists)
  return [...new Set([...ofTheCategories, ...statedAtARoot].map(({ oxlintName }) => oxlintName))]
}

/**
 * The oxlint name of each rule our ESLint part turns on, or of a twin of one, that the team sets in
 * neither config, where its config leaves correctness to oxlint's default: that silent `correctness:
 * warn` sets no rule, so it would run oxlint's copy beside ESLint's (decisions.md, "Owner 2026-10-14
 * (questions on the merge rework spec", point 1). A copy it would not run is off to no effect.
 */
function copiesOxlintsDefaultRunsBesideOurEslintPart(theirs: OxlintConfig, part: OxlintPart, setByTheTeam: ReadonlySet<string>, catalog: Catalog): string[] {
  if (!leavesCorrectnessAtOxlintsDefault(theirs)) return []
  const ourEslintPartRuns = withEveryTwin(new Set(part.turnedOnInEslint), catalog)
  return catalog.oxlintRules.filter(({ id }) => ourEslintPartRuns.has(id) && !setByTheTeam.has(id)).map(({ oxlintName }) => oxlintName)
}

/** An override first in line, turning the rules off in every file before any of the team's applies. */
function offWhereTheRootRunsThem(oxlintNames: readonly string[]): OxlintOverride[] {
  if (oxlintNames.length === 0) return []
  return [{ files: [EVERY_FILE_AT_ANY_DEPTH], rules: offEntriesFor(oxlintNames) }]
}

/**
 * Where oxlint switches categories on for the team, the rules it switches on, set as its categories
 * set them, before any of the team's overrides states them: the team's statements then decide as
 * they do for the team. In a file, oxlint switches on each plugin listed for the file but not at the
 * root, wherever an override it matches lists plugins other than every plugin listed for the file.
 * A listing that misses a root plugin always does. Listings that list each root plugin do only in a
 * file another listing with other plugins matches too: theirs switch on there, then off where none
 * of those matches.
 */
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

/** The rules oxlint switches on for plugins listed in an override: those of each not at the root, as the root's categories set them. */
function categoryRulesSwitchedOnFor(listed: ReadonlySet<OxlintPlugin>, { rootPlugins, categories }: TeamResolution, catalog: Catalog): DummyRuleMap {
  const notAtTheRoot = new Set([...listed].filter((plugin) => !rootPlugins.has(plugin)))
  return categoryRulesOf(notAtTheRoot, categories, catalog)
}

/**
 * The categories of the plugins listings of one set switch on, in their files, where a listing of
 * another set matches too: on in their files, then off where no listing of another set matches.
 * Another set's later switches never undo these, as each one's offs lie outside every listing of
 * a set other than its own.
 */
function switchesBesideOtherListings({ plugins, listings }: ListingsOfOneSet, team: TeamResolution, catalog: Catalog): OxlintOverride[] {
  const listingsOfOtherSets = team.listings.filter((listing) => !isTheSameSet(listing.plugins, plugins))
  const rules = categoryRulesSwitchedOnFor(plugins, team, catalog)
  if (listingsOfOtherSets.length === 0 || Object.keys(rules).length === 0) return []
  const offs = offEntriesFor(Object.keys(rules))
  return [...listings.flatMap(({ where }) => switchesWhere(where, rules)), ...offOutside(listingsOfOtherSets, offs)]
}

/**
 * Off in each file none of the listings matches: those no `files` of theirs matches, and those each
 * listing matching them by `files` excludes. A file excluded by listings with different
 * `excludeFiles` is not reached, as each list of them is taken alone (a limit).
 */
function offOutside(listings: readonly Listing[], offs: DummyRuleMap): OxlintOverride[] {
  const outsideEvery: OxlintOverride = { files: [EVERY_FILE_AT_ANY_DEPTH], excludeFiles: filesOf(listings), rules: offs }
  return [outsideEvery, ...listingsByExcludeFiles(listings).flatMap((excludingOneList) => offWhereTheyExclude(excludingOneList, listings, offs))]
}

/** Off in the files the listings exclude, but those another of the listings matches by `files`: none where those cover them. */
function offWhereTheyExclude(
  { excludeFiles, excluding }: ListingsExcludingOneList,
  listings: readonly Listing[],
  offs: DummyRuleMap,
): OxlintOverride[] {
  const otherFiles = filesOf(listings.filter((listing) => !excluding.includes(listing)))
  const files = excludeFiles.filter((glob) => !otherFiles.includes(glob))
  return files.length === 0 ? [] : [{ ...filesLess(files, otherFiles), rules: offs }]
}

/** The listings excluding files, grouped by the globs they exclude. */
function listingsByExcludeFiles(listings: readonly Listing[]): ListingsExcludingOneList[] {
  const excluding = listings.filter(({ where }) => excludeFilesOf(where).length > 0)
  return groupsOfAlike(excluding, excludeTheSameFiles).map(({ first, members }) => ({
    excludeFiles: excludeFilesOf(first.where),
    excluding: members,
  }))
}

function switchesWhere(where: OverrideFiles, rules: DummyRuleMap): OxlintOverride[] {
  return Object.keys(rules).length === 0 ? [] : [{ ...whereItApplies(where), rules }]
}

/** Each rule of the plugins its category turns on, at its category's severity. */
function categoryRulesOf(plugins: ReadonlySet<OxlintPlugin>, categories: CategorySeverities, catalog: Catalog): DummyRuleMap {
  const rulesOfThePlugins = catalog.oxlintRules.filter((rule) => plugins.has(pluginOf(rule)))
  return Object.fromEntries(rulesOfThePlugins.flatMap((rule) => entryWhereItsCategoryIsOn(rule, categories)))
}

/** The rule at its category's severity, where that is on. */
function entryWhereItsCategoryIsOn(rule: OxlintRule, categories: CategorySeverities): [string, RuleEntry][] {
  const severity = categorySeverityOf(rule, categories)
  return isOn(severity) ? [[rule.oxlintName, severity]] : []
}

function listingsBySet(listings: readonly Listing[]): ListingsOfOneSet[] {
  return groupsOfAlike(listings, listTheSamePlugins).map(({ first, members }) => ({ plugins: first.plugins, listings: members }))
}

/** The items in groups of those alike, each group in the order its items come, the groups in the order their first items come. */
function groupsOfAlike<Item>(items: readonly Item[], areAlike: (first: Item, second: Item) => boolean): GroupOfAlike<Item>[] {
  const firstOfEachGroup = items.filter((item, index) => items.findIndex((other) => areAlike(other, item)) === index)
  return firstOfEachGroup.map((first) => ({ first, members: items.filter((item) => areAlike(item, first)) }))
}

function listTheSamePlugins(first: Listing, second: Listing): boolean {
  return isTheSameSet(first.plugins, second.plugins)
}

function excludeTheSameFiles(first: Listing, second: Listing): boolean {
  return globsKey(excludeFilesOf(first.where)) === globsKey(excludeFilesOf(second.where))
}

function isTheSameSet(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  return first.size === second.size && [...first].every((member) => second.has(member))
}

/** One key per list of strings, whatever their order. */
function globsKey(values: readonly string[]): string {
  return JSON.stringify(sortedUnique([...values]))
}

/**
 * The team's config, extended configs and all, without the statements oxlint ignores for it: in an
 * override, a rule whose plugin neither the root nor the override lists. The merge lists every
 * plugin at the root, which would make them count. Its root statements of such rules are turned off
 * first in line instead (`oxlintNamesOnlyTheMergedRootRuns`).
 */
function withIgnoredStatementsDropped(config: OxlintConfig, team: TeamResolution, bySpelling: OxlintRulesBySpelling): OxlintConfig {
  const { overrides, extends: extended } = config
  return {
    ...config,
    ...(overrides === undefined ? {} : { overrides: overrides.map((override) => overrideWithIgnoredStatementsDropped(override, team, bySpelling)) }),
    ...(extended === undefined
      ? {}
      : { extends: extended.filter(isAnObject).map((extendedConfig) => withIgnoredStatementsDropped(extendedConfig, team, bySpelling)) }),
  }
}

function overrideWithIgnoredStatementsDropped(override: OxlintOverride, team: TeamResolution, bySpelling: OxlintRulesBySpelling): OxlintOverride {
  const { rules } = override
  if (rules === undefined) return override
  const countedHere = pluginsCountedIn(override, team)
  const counted = Object.entries(rules).filter(([key]) => isCountedWhere(countedHere, key, bySpelling))
  return counted.length === Object.keys(rules).length ? override : { ...override, rules: Object.fromEntries(counted) }
}

/**
 * Whether oxlint counts a statement where these plugins run: one of their rules, or a JS plugin's,
 * which no plugin listing touches.
 */
function isCountedWhere(pluginsRunning: ReadonlySet<OxlintPlugin>, key: string, bySpelling: OxlintRulesBySpelling): boolean {
  const rule = oxlintRuleKeyed(key, bySpelling)
  return rule === undefined || pluginsRunning.has(pluginOf(rule))
}

/**
 * Where overrides go to apply before any of the team's: first among the overrides, or, beside a
 * config the team extends, in a first config extended, as oxlint applies the overrides of an
 * extended config before the config's own. The `extends` key then lists the team's after it.
 */
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
