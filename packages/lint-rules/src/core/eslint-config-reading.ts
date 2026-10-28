import type { Catalog } from '@workspace/rule-data'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { pluginPrefixOf, ruleNameOf } from '@workspace/rule-data/rule-id-parts'
import type { ESLint, Linter } from 'eslint'
import type { EslintPluginRegistry } from './build-eslint-config.ts'
import { sortedUnique } from './build-oxlint-config.ts'
import { ruleIdsNamedInEslint } from './catalog-lookups.ts'
import { configErrorIn } from './config-error.ts'

// Read the same way by both merges. Only ESLint's types are imported, so the oxlint side loads nothing of ESLint's.

type PluginRegistration = readonly [prefix: string, plugin: ESLint.Plugin]

type KeyAndEntry = [key: string, entry: Linter.RuleEntry | undefined]

type PrefixOfOurPlugin = { readonly teams: string; readonly ours: string }

const PREFIX_SEPARATOR = '/'

/** Every rule of ours the team's blocks set at any severity, sorted. A key under a prefix the team registers one of our plugins under also names our rule (antfu's `react` holds both our @eslint-react and eslint-plugin-react). */
export function ruleIdsTheTeamsEslintConfigSets(teamBlocks: readonly Linter.Config[], ourPlugins: EslintPluginRegistry, catalog: Readonly<Catalog>): string[] {
  const prefixesOfOurPlugins = prefixesOfOurPluginsIn(pluginsRegisteredBy(teamBlocks), ourPlugins)
  const names = ruleKeysOf(teamBlocks).flatMap((key) => [key, ...underOurPrefixes(key, prefixesOfOurPlugins)])
  return sortedUnique(names.flatMap((name) => ruleIdsNamedInEslint(name, catalog)))
}

function ruleKeysOf(teamBlocks: readonly Linter.Config[]): string[] {
  return teamBlocks.flatMap((block) => Object.keys(rulesStatedIn(block)))
}

/** An entry left undefined states none. */
export function rulesStatedIn({ rules = {} }: Readonly<Linter.Config>): Linter.RulesRecord {
  return Object.fromEntries(Object.entries(rules).filter(isStated))
}

function isStated(keyAndEntry: KeyAndEntry): keyAndEntry is [string, Linter.RuleEntry] {
  return keyAndEntry[1] !== undefined
}

function underOurPrefixes(key: string, prefixesOfOurPlugins: readonly PrefixOfOurPlugin[]): string[] {
  const prefix = pluginPrefixOf(key)
  if (prefix === null) return []
  const ruleName = ruleNameOf(key)
  return prefixesOfOurPlugins.filter(({ teams }) => teams === prefix).map(({ ours }) => `${ours}${PREFIX_SEPARATOR}${ruleName}`)
}

/** E.g. antfu's config registers typescript-eslint as `ts`. Matched by the same object, or by its name, as another install of it carries. */
function prefixesOfOurPluginsIn(teamPlugins: ReadonlyMap<string, ESLint.Plugin>, ourPlugins: EslintPluginRegistry): PrefixOfOurPlugin[] {
  return [...teamPlugins].flatMap(([teams, teamPlugin]) => ourOtherPrefixesFor(teams, teamPlugin, ourPlugins))
}

function ourOtherPrefixesFor(teams: string, teamPlugin: Readonly<ESLint.Plugin>, ourPlugins: EslintPluginRegistry): PrefixOfOurPlugin[] {
  return ourPrefixesOf(teamPlugin, ourPlugins)
    .filter((ours) => ours !== teams)
    .map((ours): PrefixOfOurPlugin => ({ teams, ours }))
}

function ourPrefixesOf(teamPlugin: Readonly<ESLint.Plugin>, ourPlugins: EslintPluginRegistry): string[] {
  return Object.entries(ourPlugins)
    .filter(([, ourPlugin]) => isTheSamePlugin(teamPlugin, ourPlugin))
    .map(([prefix]) => prefix)
}

/** A plugin's name is its package's, which no other plugin shares; one with no name matches only as the same object. */
function isTheSamePlugin(teamPlugin: Readonly<ESLint.Plugin>, ourPlugin: Readonly<ESLint.Plugin>): boolean {
  if (teamPlugin === ourPlugin) return true
  const teamPluginName = nameOfPlugin(teamPlugin)
  return teamPluginName !== undefined && teamPluginName === nameOfPlugin(ourPlugin)
}

/** ESLint takes a plugin's name from its top level before its meta. */
// eslint-disable-next-line @typescript-eslint/no-deprecated -- ESLint 10 still reads the top-level name first, so a plugin naming itself there alone is named by it; reading meta.name alone would match it to no plugin of ours
function nameOfPlugin({ name, meta = {} }: Readonly<ESLint.Plugin>): string | undefined {
  return firstGiven([name, meta.name])
}

/** ESLint skips a name or version given empty. */
export function firstGiven(values: ReadonlyArray<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value !== '')
}

/** ESLint throws on two objects under one prefix wherever both blocks apply, so any such pair is refused. */
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

function registersASecondObjectUnderItsPrefix(
  [prefix, plugin]: PluginRegistration,
  index: number,
  registrations: readonly PluginRegistration[],
): boolean {
  return registrations
    .slice(0, index)
    .some(([earlierPrefix, earlierPlugin]) => earlierPrefix === prefix && earlierPlugin !== plugin)
}
