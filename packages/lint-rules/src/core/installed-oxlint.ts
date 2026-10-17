import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import type { Catalog, OxlintRule } from '@workspace/rule-data'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { oxlintNameOf } from '@workspace/rule-data/rule-id-parts'
import { configErrorIn } from './config-error.ts'
import { isRecord } from './is-record.ts'
import {
  ourPackageJsonFile,
  PACKAGE_JSON,
  rangeListedIn,
  readPackageJsonFile,
  THIS_PACKAGE,
  versionOf,
} from './package-json-files.ts'
import { readOnce } from './read-once.ts'

type InstalledOxlint = { readonly tsconfigRootDir: string; readonly manifestPath: string; readonly version: string; readonly range: string }

type SchemaNames = { readonly ruleNames: ReadonlySet<string>; readonly pluginNames: ReadonlySet<string>; readonly configKeys: ReadonlySet<string> }

type JsonRead = { readonly json: unknown } | { readonly unreadable: Error }

type SchemaRead = { readonly names: SchemaNames } | { readonly unreadable: Error }

const OXLINT = 'oxlint'
const OXLINT_MANIFEST = `${OXLINT}/${PACKAGE_JSON}`
// Every oxlint release ships it beside its package.json, in `files` but not in `exports`.
const OXLINT_SCHEMA = 'configuration_schema.json'
const RULE_MAP_KEYS = ['definitions', 'DummyRuleMap', 'properties']
const PLUGIN_LIST_KEYS = ['definitions', 'LintPluginOptionsSchema', 'enum']
const CONFIG_KEY_MAP_KEYS = ['properties']
const RULE_NAME_SEPARATOR = '/'
const NOT_FOUND = -1
const NAMES_SEPARATOR = ', '

// Read at most once per process.
const schemaReads = new Map<string, SchemaRead>()

const requireFromHere = createRequire(import.meta.url)

/** oxlint refuses a rule or plugin name it does not know even when it is off (measured, 1.87), so the installed oxlint's schema must hold every name the merge may write. */
export function refuseUnsupportedInstalledOxlint(tsconfigRootDir: string, catalog: Catalog): void {
  const oxlint = installedOxlint(tsconfigRootDir)
  const schemaPath = join(dirname(oxlint.manifestPath), OXLINT_SCHEMA)
  const read = schemaReadAt(schemaPath)
  if ('unreadable' in read) throw unreadableSchema(oxlint, schemaPath, read.unreadable)
  const lacking = namesLackedBy(read.names, catalog)
  if (lacking.length > 0) throw lackingNames(oxlint, lacking)
}

/** oxlint refuses any other key, in JSON and JS/TS configs alike (measured, 1.87). */
export function keysAnOxlintConfigHolds(): ReadonlySet<string> {
  const read = schemaReadAt(join(dirname(requireFromHere.resolve(OXLINT_MANIFEST)), OXLINT_SCHEMA))
  if ('unreadable' in read) throw read.unreadable
  return read.names.configKeys
}

function installedOxlint(tsconfigRootDir: string): InstalledOxlint {
  const manifestPath = installedOxlintManifest(tsconfigRootDir)
  return { tsconfigRootDir, manifestPath, version: versionOf(readPackageJsonFile(manifestPath)), range: ourOxlintPeerRange() }
}

function installedOxlintManifest(tsconfigRootDir: string): string {
  try {
    return createRequire(resolve(tsconfigRootDir, PACKAGE_JSON)).resolve(OXLINT_MANIFEST)
  } catch (error) {
    throw configErrorIn(
      consumerConfigFiles.oxlintConfig,
      `a package.json lists oxlint, yet it does not resolve from ${tsconfigRootDir}: install it`,
      { cause: error },
    )
  }
}

function ourOxlintPeerRange(): string {
  const manifest = ourPackageJsonFile()
  return rangeListedIn(manifest, manifest.peerDependencies, OXLINT)
}

function unreadableSchema({ tsconfigRootDir, version, range }: InstalledOxlint, schemaPath: string, cause: Error): Error {
  return configErrorIn(
    consumerConfigFiles.oxlintConfig,
    `the oxlint installed for ${tsconfigRootDir} (${version}) has no rule list ${THIS_PACKAGE} can read at ${schemaPath}, so it cannot check that oxlint knows every name the merge writes: install another oxlint within ${range}`,
    { cause },
  )
}

function lackingNames({ tsconfigRootDir, version, range }: InstalledOxlint, names: readonly string[]): Error {
  return configErrorIn(
    consumerConfigFiles.oxlintConfig,
    `the oxlint installed for ${tsconfigRootDir} is ${version}, which has no rule or plugin named ${names.toSorted().join(NAMES_SEPARATOR)}; ${THIS_PACKAGE} writes these names, so oxlint would refuse the merged config: install another oxlint within ${range}`,
  )
}

function namesLackedBy({ ruleNames, pluginNames }: SchemaNames, catalog: Catalog): string[] {
  const rulesLacked = catalog.oxlintRules.filter((rule) => !ruleNames.has(schemaSpellingOf(rule))).map(({ oxlintName }) => oxlintName)
  const pluginsLacked = oxlintPluginsOf(catalog).filter((plugin) => !pluginNames.has(plugin))
  return [...rulesLacked, ...pluginsLacked]
}

function oxlintPluginsOf(catalog: Catalog): string[] {
  return [...new Set(catalog.oxlintRules.map(({ oxlintPlugin }) => oxlintPlugin))]
}

/** The schema spells a rule under its plugin's listed name: the catalog's `jsx_a11y/alt-text` is the schema's `jsx-a11y/alt-text`. */
function schemaSpellingOf({ oxlintName, oxlintPlugin }: OxlintRule): string {
  const slash = oxlintName.indexOf(RULE_NAME_SEPARATOR)
  const ruleName = slash === NOT_FOUND ? oxlintName : oxlintName.slice(slash + RULE_NAME_SEPARATOR.length)
  return oxlintNameOf({ scope: oxlintPlugin, ruleName })
}

function schemaReadAt(schemaPath: string): SchemaRead {
  return readOnce(schemaReads, schemaPath, readSchema)
}

function readSchema(schemaPath: string): SchemaRead {
  const read = jsonReadAt(schemaPath)
  if ('unreadable' in read) return read
  const names = schemaNamesIn(read.json)
  if (names === null) return { unreadable: new Error(`${schemaPath}: no rule map, plugin list and config keys where oxlint 1.x keeps them`) }
  return { names }
}

/** Parse boundary: the schema may be missing or not JSON in an unusable install. */
function jsonReadAt(path: string): JsonRead {
  try {
    return { json: JSON.parse(readFileSync(path, 'utf8')) }
  } catch (error) {
    return { unreadable: new Error(`${path}: not readable as JSON`, { cause: error }) }
  }
}

function schemaNamesIn(schema: unknown): SchemaNames | null {
  const ruleMap = valueAt(schema, RULE_MAP_KEYS)
  const pluginList = valueAt(schema, PLUGIN_LIST_KEYS)
  const configKeyMap = valueAt(schema, CONFIG_KEY_MAP_KEYS)
  if (!isRecord(ruleMap) || !isStringList(pluginList) || !isRecord(configKeyMap)) return null
  return { ruleNames: new Set(Object.keys(ruleMap)), pluginNames: new Set(pluginList), configKeys: new Set(Object.keys(configKeyMap)) }
}

function valueAt(value: unknown, keys: readonly string[]): unknown {
  return keys.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value)
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
