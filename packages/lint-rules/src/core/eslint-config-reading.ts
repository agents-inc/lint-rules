import type { Catalog } from '@workspace/rule-data'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { pluginPrefixOf } from '@workspace/rule-data/rule-id-parts'
import type { ESLint, Linter } from 'eslint'
import type { EslintPluginRegistry } from './build-eslint-config.ts'
import { sortedUnique } from './build-oxlint-config.ts'
import { ruleIdsNamedInEslint } from './catalog-lookups.ts'
import { configErrorIn } from './config-error.ts'

// What a team's ESLint config states, read the same way by both merges: the ESLint merge reads the
// config it is handed, the oxlint merge the one at the path it is given. Only ESLint's types are
// imported, so the oxlint side loads nothing of ESLint's to read one.

type PluginRegistration = readonly [prefix: string, plugin: ESLint.Plugin]

/** A block's rule key and its entry, which may be left undefined. */
type KeyAndEntry = [key: string, entry: Linter.RuleEntry | undefined]

/** A prefix the team registers one of our plugins under, and the other prefix we register it under. */
type PrefixOfOurPlugin = { readonly teams: string; readonly ours: string }

const PREFIX_SEPARATOR = '/'

/**
 * The RuleId of every rule of ours the team's blocks set, once each and sorted (spec-merge-model.md,
 * 1.2): each rule key of every block, at any severity, whatever files the block applies to, read as
 * each rule of ours it is an ESLint name of, and, under a prefix the team registers one of our
 * plugins under, as each rule of ours it names under ours too. A key under a prefix both register
 * (antfu's `react`, holding our @eslint-react beside our eslint-plugin-react) names a rule of each.
 */
export function ruleIdsTheTeamsEslintConfigSets(teamBlocks: readonly Linter.Config[], ourPlugins: EslintPluginRegistry, catalog: Catalog): string[] {
  const prefixesOfOurPlugins = prefixesOfOurPluginsIn(pluginsRegisteredBy(teamBlocks), ourPlugins)
  const names = ruleKeysOf(teamBlocks).flatMap((key) => [key, ...underOurPrefixes(key, prefixesOfOurPlugins)])
  return sortedUnique(names.flatMap((name) => ruleIdsNamedInEslint(name, catalog)))
}

/** Every rule key the blocks state, at any severity, `off` included. */
function ruleKeysOf(teamBlocks: readonly Linter.Config[]): string[] {
  return teamBlocks.flatMap((block) => Object.keys(rulesStatedIn(block)))
}

/** The rules a block states: an entry left undefined states none. */
export function rulesStatedIn({ rules = {} }: Linter.Config): Linter.RulesRecord {
  return Object.fromEntries(Object.entries(rules).filter(isStated))
}

function isStated(keyAndEntry: KeyAndEntry): keyAndEntry is [string, Linter.RuleEntry] {
  return keyAndEntry[1] !== undefined
}

/** The key under each prefix we register the plugin under that the team registers under the key's prefix. */
function underOurPrefixes(key: string, prefixesOfOurPlugins: readonly PrefixOfOurPlugin[]): string[] {
  const prefix = pluginPrefixOf(key)
  if (prefix === null) return []
  const ruleName = key.slice(`${prefix}${PREFIX_SEPARATOR}`.length)
  return prefixesOfOurPlugins.filter(({ teams }) => teams === prefix).map(({ ours }) => `${ours}${PREFIX_SEPARATOR}${ruleName}`)
}

/**
 * The prefixes the team registers one of our plugins under, other than the one we register it under
 * (antfu's config registers typescript-eslint as `ts`, and our @eslint-react as `react`, which we
 * register eslint-plugin-react under): the very object we register, or one with its name, as another
 * install of it carries.
 */
function prefixesOfOurPluginsIn(teamPlugins: ReadonlyMap<string, ESLint.Plugin>, ourPlugins: EslintPluginRegistry): PrefixOfOurPlugin[] {
  return [...teamPlugins].flatMap(([teams, teamPlugin]) => ourOtherPrefixesFor(teams, teamPlugin, ourPlugins))
}

/** Each prefix we register the team's plugin under besides the team's own for it: none where it is not ours. */
function ourOtherPrefixesFor(teams: string, teamPlugin: ESLint.Plugin, ourPlugins: EslintPluginRegistry): PrefixOfOurPlugin[] {
  return ourPrefixesOf(teamPlugin, ourPlugins)
    .filter((ours) => ours !== teams)
    .map((ours): PrefixOfOurPlugin => ({ teams, ours }))
}

/** The prefixes we register the team's plugin under: none where it is not ours. */
function ourPrefixesOf(teamPlugin: ESLint.Plugin, ourPlugins: EslintPluginRegistry): string[] {
  return Object.entries(ourPlugins)
    .filter(([, ourPlugin]) => isTheSamePlugin(teamPlugin, ourPlugin))
    .map(([prefix]) => prefix)
}

/**
 * The same object, or one named as ours: a plugin's name is its package's, which no other plugin
 * shares. A plugin with no name is recognised only as the same object.
 */
function isTheSamePlugin(teamPlugin: ESLint.Plugin, ourPlugin: ESLint.Plugin): boolean {
  if (teamPlugin === ourPlugin) return true
  const teamPluginName = nameOfPlugin(teamPlugin)
  return teamPluginName !== undefined && teamPluginName === nameOfPlugin(ourPlugin)
}

/** ESLint takes a plugin's name from its top level before its meta. */
function nameOfPlugin({ name, meta = {} }: ESLint.Plugin): string | undefined {
  return firstGiven([name, meta.name])
}

/** ESLint skips a name or version given empty. */
export function firstGiven(values: readonly (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value !== '')
}

/** ESLint throws on two objects under one prefix wherever both blocks apply, so any such pair is refused (spec D5). */
export function pluginsRegisteredBy(teamBlocks: readonly Linter.Config[]): ReadonlyMap<string, ESLint.Plugin> {
  const registrations = teamBlocks.flatMap(({ plugins = {} }) => Object.entries(plugins))
  const secondObject = registrations.find(registersASecondObjectUnderItsPrefix)
  if (secondObject !== undefined) {
    const [prefix] = secondObject
    throw configErrorIn(
      consumerConfigFiles.eslintConfig,
      `two different plugin objects are registered under "${prefix}": register one object under each prefix`,
    )
  }
  return new Map(registrations)
}

/** Whether an earlier registration put a different object under the same prefix. */
function registersASecondObjectUnderItsPrefix(
  [prefix, plugin]: PluginRegistration,
  index: number,
  registrations: readonly PluginRegistration[],
): boolean {
  return registrations
    .slice(0, index)
    .some(([earlierPrefix, earlierPlugin]) => earlierPrefix === prefix && earlierPlugin !== plugin)
}
