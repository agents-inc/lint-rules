import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { isModuleNamespaceObject } from 'node:util/types'
import { foundOr } from '@workspace/rule-data/collections'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import type { EslintPluginRegistry } from './build-eslint-config.ts'
import { hasErrorCode, messageOf } from './caught-errors.ts'
import { configErrorIn, configProblemIn } from './config-error.ts'
import { keysAnOxlintConfigHolds } from './installed-oxlint.ts'
import { isRecord } from './is-record.ts'
import { parsedJsonc } from './jsonc.ts'
import type { TeamEslintConfig } from './merge-eslint-config.ts'
import { extendedBy, isAnObject } from './oxlint-config-reading.ts'
import { describeValue } from './value-descriptions.ts'

// Each merge reads the team's other-engine config with require(), so the merges stay synchronous. Two
// configs merging and naming each other would be a module cycle Node refuses, so while a read runs, a
// merge called returns the team's config unmerged and hands it to the read.

/** The plugins we register let the read recognise the team's prefixes for ours. */
type TeamEslintConfigRead = { readonly blocks: readonly Linter.Config[]; readonly ourPlugins: EslintPluginRegistry }

type HandedOver = { readonly engine: 'eslint'; readonly config: TeamEslintConfigRead } | { readonly engine: 'oxlint'; readonly config: OxlintConfig }

type Read = { readonly handedOver: HandedOver[] }

type Loaded = { readonly handedOver: readonly HandedOver[]; readonly defaultExport: unknown }

type EslintConfigObject = Exclude<TeamEslintConfig, readonly unknown[]>

type OtherConfig = {
  /** The config file calling the merge, which an error tells the team to fix. */
  readonly readBy: string
  readonly merge: string
  readonly key: string
  readonly named: string
}

const requireFromHere = createRequire(import.meta.url)

// A merge in reading mode reads no other file, so reads never nest.
const readsInProgress: Read[] = []

const handedOverByFile = new Map<string, readonly HandedOver[]>()

const JSON_EXTENSION = '.json'
const ESLINT_CONFIG_HELPERS = 'eslint/config'
const TOP_LEVEL_AWAIT_REFUSED = 'ERR_REQUIRE_ASYNC_MODULE'
const KEYS_SEPARATOR = ', '
// ESLint refuses any other key (measured, 10.12), and defineConfig reads `extends`. Typed so a key
// ESLint's own type gains or loses fails the typecheck.
const KEYS_AN_ESLINT_CONFIG_OBJECT_HOLDS: ReadonlySet<string> = new Set(
  Object.keys({
    name: true,
    basePath: true,
    files: true,
    ignores: true,
    language: true,
    languageOptions: true,
    linterOptions: true,
    processor: true,
    plugins: true,
    rules: true,
    settings: true,
    extends: true,
  } satisfies Record<keyof EslintConfigObject, true>),
)

const TEAMS_OXLINT_CONFIG: OtherConfig = {
  readBy: consumerConfigFiles.eslintConfig,
  merge: 'mergeEslintConfig',
  key: 'oxlintConfig',
  named: 'oxlint config',
}

const TEAMS_ESLINT_CONFIG: OtherConfig = {
  readBy: consumerConfigFiles.oxlintConfig,
  merge: 'mergeOxlintConfig',
  key: 'eslintConfig',
  named: 'ESLint config',
}

export function isInReadingMode(): boolean {
  return readsInProgress.length > 0
}

export function handOverToTheRead(handedOver: HandedOver): void {
  const read = foundOr(readsInProgress.at(-1), 'a merge handed over a config with no read in progress')
  read.handedOver.push(handedOver)
}

/** Refused where left out or neither a path nor null; `requiredBecause` says why it is required here. */
export function pathOfTheTeamsOxlintConfigGiven(given: unknown, requiredBecause: string): string | null {
  const { readBy, key } = TEAMS_OXLINT_CONFIG
  const path = foundOr(isRecord(given) ? given[key] : undefined, oxlintConfigPathLeftOutProblem(requiredBecause))
  if (path === null || typeof path === 'string') return path
  throw configErrorIn(readBy, `${key} must be a path or null, and was given ${describeValue(path)}`)
}

/** A JSON config is parsed as oxlint parses it, any other loaded. A file holding a key no oxlint config holds is refused. Null reads as an empty config. */
export function readTheTeamsOxlintConfig(path: string | null, tsconfigRootDir: string): OxlintConfig {
  if (path === null) return {}
  const file = existingFileAt(path, tsconfigRootDir, TEAMS_OXLINT_CONFIG)
  return readOrRefuse(file, TEAMS_OXLINT_CONFIG, () => oxlintConfigIn(file, keysAnOxlintConfigHolds()))
}

/** As the file handed it to our merge, else its default export. From a default export our plugins are unknown, so a prefix the team registers one of ours under goes unrecognised (a known limit). Null sets no rule. */
export function readTheTeamsEslintConfig(path: string | null, tsconfigRootDir: string): TeamEslintConfigRead {
  if (path === null) return { blocks: [], ourPlugins: {} }
  const file = existingFileAt(path, tsconfigRootDir, TEAMS_ESLINT_CONFIG)
  return readOrRefuse(file, TEAMS_ESLINT_CONFIG, () => eslintConfigLoadedFrom(file))
}

function oxlintConfigPathLeftOutProblem(requiredBecause: string): string {
  const { readBy, merge, named, key } = TEAMS_OXLINT_CONFIG
  return configProblemIn(
    readBy,
    `${merge} needs the path of your ${named} as its third argument, { ${key}: '${consumerConfigFiles.oxlintConfig}' }, or { ${key}: null } if this project has none: ${requiredBecause}`,
  )
}

function existingFileAt(path: string, tsconfigRootDir: string, other: OtherConfig): string {
  const file = resolve(tsconfigRootDir, path)
  if (!existsSync(file)) throw configErrorIn(other.readBy, `${other.key} names ${file}, where there is no file`)
  return file
}

function readOrRefuse<Config>(file: string, other: OtherConfig, read: () => Config): Config {
  try {
    return read()
  } catch (error) {
    throw configErrorIn(other.readBy, `could not read your ${other.named} at ${file}: ${whyUnreadable(error)}`, { cause: error })
  }
}

function whyUnreadable(error: unknown): string {
  if (hasErrorCode(error, TOP_LEVEL_AWAIT_REFUSED)) return 'a config read while another loads cannot use top-level await'
  return messageOf(error)
}

function oxlintConfigIn(file: string, keysAConfigHolds: ReadonlySet<string>): OxlintConfig {
  if (extname(file) !== JSON_EXTENSION) return oxlintConfigLoadedFrom(file, keysAConfigHolds)
  return oxlintConfigInJson(file, keysAConfigHolds)
}

function oxlintConfigLoadedFrom(file: string, keysAConfigHolds: ReadonlySet<string>): OxlintConfig {
  const { handedOver, defaultExport } = loadedInReadingMode(file)
  const handedByOurMerge = oxlintConfigsAmong(handedOver)
  if (handedByOurMerge.length > 0) return theOneConfigHandedOver(handedByOurMerge, TEAMS_ESLINT_CONFIG.merge)
  if (!isOxlintConfig(defaultExport)) throw new Error(`its default export is ${describeValue(defaultExport)}, not an oxlint config object`)
  refuseKeysNoConfigHolds([defaultExport], keysAConfigHolds, TEAMS_OXLINT_CONFIG)
  return defaultExport
}

function eslintConfigLoadedFrom(file: string): TeamEslintConfigRead {
  const { handedOver, defaultExport } = loadedInReadingMode(file)
  const handedByOurMerge = eslintConfigsAmong(handedOver)
  if (handedByOurMerge.length > 0) return theOneConfigHandedOver(handedByOurMerge, TEAMS_OXLINT_CONFIG.merge)
  refuseKeysNoConfigHolds(objectsDefineConfigReadsIn(defaultExport), KEYS_AN_ESLINT_CONFIG_OBJECT_HOLDS, TEAMS_ESLINT_CONFIG)
  return { blocks: eslintBlocksOf(defaultExport), ourPlugins: {} }
}

function oxlintConfigsAmong(handedOver: readonly HandedOver[]): OxlintConfig[] {
  return handedOver.flatMap((each) => (each.engine === 'oxlint' ? [each.config] : []))
}

function eslintConfigsAmong(handedOver: readonly HandedOver[]): TeamEslintConfigRead[] {
  return handedOver.flatMap((each) => (each.engine === 'eslint' ? [each.config] : []))
}

/** defineConfig refuses what else they hold itself. */
function objectsDefineConfigReadsIn(defaultExport: unknown): readonly object[] {
  return [defaultExport].flat(Infinity).filter(isRecord)
}

/** Such a file is something else, a package.json say, even beside keys a config holds. */
function refuseKeysNoConfigHolds(configs: readonly object[], keysAConfigHolds: ReadonlySet<string>, other: OtherConfig): void {
  const foreignKeys = new Set(configs.flatMap((config) => Object.keys(config).filter((key) => !keysAConfigHolds.has(key))))
  if (foreignKeys.size > 0) throw new Error(`it is not an ${other.named}: no ${other.named} holds ${[...foreignKeys].join(KEYS_SEPARATOR)}`)
}

function theOneConfigHandedOver<Config>(handedOver: readonly Config[], mergeCalled: string): Config {
  const [config, ...others] = handedOver
  if (config === undefined || others.length > 0) throw new Error(`it calls ${mergeCalled} ${String(handedOver.length)} times, where one call gives the team's config`)
  return config
}

function loadedInReadingMode(file: string): Loaded {
  const read: Read = { handedOver: [] }
  readsInProgress.push(read)
  try {
    const defaultExport = defaultExportOf(requireFromHere(file))
    return { handedOver: handedOverByTheFile(file, read.handedOver), defaultExport }
  } finally {
    readsInProgress.pop()
  }
}

/** On a later read Node serves the cached module, which calls no merge again, so the first hand-over stands. */
function handedOverByTheFile(file: string, handedOverNow: readonly HandedOver[]): readonly HandedOver[] {
  const handedOverFirst = handedOverByFile.get(file)
  if (handedOverNow.length === 0 && handedOverFirst !== undefined) return handedOverFirst
  handedOverByFile.set(file, handedOverNow)
  return handedOverNow
}

function defaultExportOf(loaded: unknown): unknown {
  return isRecord(loaded) && isModuleNamespaceObject(loaded) ? loaded['default'] : loaded
}

/** Comments and trailing commas allowed. Judged by its keys before each config it extends by path is read in. */
function oxlintConfigInJson(file: string, keysAConfigHolds: ReadonlySet<string>): OxlintConfig {
  const config = parsedJsonc(readFileSync(file, 'utf8'))
  if (!isOxlintConfig(config)) throw new Error(`${file} holds ${describeValue(config)}, not a JSON object`)
  refuseKeysNoConfigHolds([config], keysAConfigHolds, TEAMS_OXLINT_CONFIG)
  return { ...config, ...extendsReadFrom(config, dirname(file), keysAConfigHolds) }
}

function extendsReadFrom(config: OxlintConfig, folder: string, keysAConfigHolds: ReadonlySet<string>): Pick<OxlintConfig, 'extends'> {
  if (config.extends === undefined) return {}
  return {
    extends: extendedBy(config).map((extended) => (isAnObject(extended) ? extended : oxlintConfigInJson(resolve(folder, extended), keysAConfigHolds))),
  }
}

function eslintBlocksOf(config: unknown): readonly Linter.Config[] {
  const { defineConfig }: typeof import('eslint/config') = requireFromHere(ESLINT_CONFIG_HELPERS)
  // Parse boundary: a team's default export, which defineConfig checks.
  return defineConfig(config as TeamEslintConfig)
}

/** Parse boundary: oxlint checks the rest itself when it loads the config. */
function isOxlintConfig(value: unknown): value is OxlintConfig {
  return isRecord(value)
}
