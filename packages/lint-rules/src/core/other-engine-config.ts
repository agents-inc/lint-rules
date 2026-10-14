import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { isModuleNamespaceObject } from 'node:util/types'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import type { EslintPluginRegistry } from './build-eslint-config.ts'
import { configErrorIn } from './config-error.ts'
import { keysAnOxlintConfigHolds } from './installed-oxlint.ts'
import { isRecord } from './is-record.ts'
import { parsedJsonc } from './jsonc.ts'
import type { TeamEslintConfig } from './merge-eslint-config.ts'
import { extendedBy, isAnObject } from './oxlint-config-reading.ts'

// Each merge reads the team's config for the other engine from the path it is given
// (spec-merge-model.md, 1.3), with require(), so the merges stay synchronous. Two configs each
// merging and naming the other would be a module cycle, which Node refuses, so a read puts the
// process in reading mode for as long as that one require() runs: a merge called then returns the
// team's config as it was given and hands it to the read, which takes it, or, where the file calls
// no merge of ours, the file's default export. A JSON oxlint config is parsed, not loaded. Node
// caches each module it loads, so a change to the file reaches a running engine when it restarts.

/** The team's ESLint config as a read takes it: its blocks, as ESLint's defineConfig gives them, and the plugins we register, by which the team's prefixes for ours are read. */
export type TeamEslintConfigRead = { readonly blocks: readonly Linter.Config[]; readonly ourPlugins: EslintPluginRegistry }

/** What a merge called in reading mode hands the read: the team's config, as given to it. */
type HandedOver = { readonly engine: 'eslint'; readonly config: TeamEslintConfigRead } | { readonly engine: 'oxlint'; readonly config: OxlintConfig }

/** A read in progress, and what each merge the file called handed over. */
type Read = { readonly handedOver: HandedOver[] }

/** A file required in reading mode: what the merges it called handed over, and its default export. */
type Loaded = { readonly handedOver: readonly HandedOver[]; readonly defaultExport: unknown }

/** One object of a config ESLint's defineConfig takes: a block, `extends` allowed. */
type EslintConfigObject = Exclude<TeamEslintConfig, readonly unknown[]>

/** How one merge names the other engine's config in its errors. */
type OtherConfig = {
  /** The config file calling the merge, which an error tells the team to fix. */
  readonly readBy: string
  readonly merge: string
  /** The key of the merge's third argument. */
  readonly key: string
  readonly named: string
  /** The file a team usually names. */
  readonly usualFile: string
}

const requireFromHere = createRequire(import.meta.url)

// A read sets reading mode for as long as its require() runs. A merge in reading mode reads no other
// file, so reads never nest; each still takes only what was handed to it.
const readsInProgress: Read[] = []

// What each file read so far handed over, by its path.
const handedOverByFile = new Map<string, readonly HandedOver[]>()

const JSON_EXTENSION = '.json'
const ESLINT_CONFIG_HELPERS = 'eslint/config'
const TOP_LEVEL_AWAIT_REFUSED = 'ERR_REQUIRE_ASYNC_MODULE'
const KEYS_SEPARATOR = ', '
// The keys an object of an ESLint config holds: a block's, ESLint refusing any other (measured, ESLint
// 10.12: @eslint/config-array's base schema and lib/config/flat-config-schema.js), and `extends`, which
// defineConfig reads in its place. Typed so a key ESLint's own type gains or loses fails the typecheck.
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

/** The ESLint merge's third argument names the team's oxlint config. */
export const TEAMS_OXLINT_CONFIG: OtherConfig = {
  readBy: consumerConfigFiles.eslintConfig,
  merge: 'mergeEslintConfig',
  key: 'oxlintConfig',
  named: 'oxlint config',
  usualFile: consumerConfigFiles.oxlintConfig,
}

/** The oxlint merge's third argument names the team's ESLint config. */
export const TEAMS_ESLINT_CONFIG: OtherConfig = {
  readBy: consumerConfigFiles.oxlintConfig,
  merge: 'mergeOxlintConfig',
  key: 'eslintConfig',
  named: 'ESLint config',
  usualFile: consumerConfigFiles.eslintConfig,
}

/** Whether a merge is called while a read loads the file calling it: it then returns the team's config as given, and hands it over. */
export function isInReadingMode(): boolean {
  return readsInProgress.length > 0
}

/** Hands the read in progress the team's config, as a merge in reading mode was given it. */
export function handOverToTheRead(handedOver: HandedOver): void {
  const read = readsInProgress.at(-1)
  if (read === undefined) throw new Error('a merge handed over a config with no read in progress')
  read.handedOver.push(handedOver)
}

/**
 * The path of the team's other config a merge was given as its third argument: a path, or null where
 * the project has none. Refused where it is left out, or is neither, naming the config file calling
 * the merge; `requiredBecause` says why it is required, where that is not always so.
 */
export function pathOfTheOtherConfigGiven(given: unknown, other: OtherConfig, requiredBecause: string | null): string | null {
  const path = isRecord(given) ? given[other.key] : undefined
  if (path === undefined) {
    const because = requiredBecause === null ? '' : `: ${requiredBecause}`
    throw configErrorIn(
      other.readBy,
      `${other.merge} needs the path of your ${other.named} as its third argument, { ${other.key}: '${other.usualFile}' }, or { ${other.key}: null } if this project has none${because}`,
    )
  }
  if (path === null || typeof path === 'string') return path
  throw configErrorIn(other.readBy, `${other.key} must be a path or null, and was given ${describeValue(path)}`)
}

/**
 * The team's oxlint config at the path, relative to tsconfigRootDir: a JSON config parsed as oxlint
 * parses it, each path it extends read from the folder of the config naming it; any other loaded.
 * A file holding a key no oxlint config holds is some other file, and refused.
 * Null reads as oxlint reads a project with none: an empty config (spec-merge-model.md, C2).
 */
export function readTheTeamsOxlintConfig(path: string | null, tsconfigRootDir: string): OxlintConfig {
  if (path === null) return {}
  const file = existingFileAt(path, tsconfigRootDir, TEAMS_OXLINT_CONFIG)
  return readOrRefuse(file, TEAMS_OXLINT_CONFIG, () => oxlintConfigIn(file, keysAnOxlintConfigHolds()))
}

/**
 * The team's ESLint config at the path, relative to tsconfigRootDir: as the file handed it to our
 * merge, or as its default export, which ESLint's defineConfig reads. Read from a default export,
 * it is read without our plugins: a prefix the team registers one of ours under goes unrecognised
 * (a limit); and one with an object holding a key no object of an ESLint config holds is some other
 * file, and refused before defineConfig reads its `extends`. Null: the project has no ESLint config,
 * which sets no rule.
 */
export function readTheTeamsEslintConfig(path: string | null, tsconfigRootDir: string): TeamEslintConfigRead {
  if (path === null) return { blocks: [], ourPlugins: {} }
  const file = existingFileAt(path, tsconfigRootDir, TEAMS_ESLINT_CONFIG)
  return readOrRefuse(file, TEAMS_ESLINT_CONFIG, () => eslintConfigLoadedFrom(file))
}

function existingFileAt(path: string, tsconfigRootDir: string, other: OtherConfig): string {
  const file = resolve(tsconfigRootDir, path)
  if (!existsSync(file)) throw configErrorIn(other.readBy, `${other.key} names ${file}, where there is no file`)
  return file
}

/** What reading the file gives, or an error naming the config file calling the merge, with what failed as its cause. */
function readOrRefuse<Config>(file: string, other: OtherConfig, read: () => Config): Config {
  try {
    return read()
  } catch (error) {
    throw configErrorIn(other.readBy, `could not read your ${other.named} at ${file}: ${whyUnreadable(error)}`, { cause: error })
  }
}

function whyUnreadable(error: unknown): string {
  if (isNodeErrorCoded(error, TOP_LEVEL_AWAIT_REFUSED)) return 'a config read while another loads cannot use top-level await'
  return error instanceof Error ? error.message : String(error)
}

function isNodeErrorCoded(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

/** A JSON config parsed as oxlint parses it; any other loaded. */
function oxlintConfigIn(file: string, keysAConfigHolds: ReadonlySet<string>): OxlintConfig {
  if (extname(file) !== JSON_EXTENSION) return oxlintConfigLoadedFrom(file, keysAConfigHolds)
  return oxlintConfigInJson(file, keysAConfigHolds)
}

function oxlintConfigLoadedFrom(file: string, keysAConfigHolds: ReadonlySet<string>): OxlintConfig {
  const { handedOver, defaultExport } = loadedInReadingMode(file)
  const handedByOurMerge = handedOver.flatMap((each) => (each.engine === 'oxlint' ? [each.config] : []))
  if (handedByOurMerge.length > 0) return theOneConfigHandedOver(handedByOurMerge, TEAMS_ESLINT_CONFIG.merge)
  if (!isOxlintConfig(defaultExport)) throw new Error(`its default export is ${describeValue(defaultExport)}, not an oxlint config object`)
  refuseKeysNoConfigHolds([defaultExport], keysAConfigHolds, TEAMS_OXLINT_CONFIG)
  return defaultExport
}

function eslintConfigLoadedFrom(file: string): TeamEslintConfigRead {
  const { handedOver, defaultExport } = loadedInReadingMode(file)
  const handedByOurMerge = handedOver.flatMap((each) => (each.engine === 'eslint' ? [each.config] : []))
  if (handedByOurMerge.length > 0) return theOneConfigHandedOver(handedByOurMerge, TEAMS_OXLINT_CONFIG.merge)
  refuseKeysNoConfigHolds(objectsDefineConfigReadsIn(defaultExport), KEYS_AN_ESLINT_CONFIG_OBJECT_HOLDS, TEAMS_ESLINT_CONFIG)
  return { blocks: eslintBlocksOf(defaultExport), ourPlugins: {} }
}

/** The objects ESLint's defineConfig reads in a default export, in arrays nested to any depth; it refuses what else they hold itself. */
function objectsDefineConfigReadsIn(defaultExport: unknown): readonly object[] {
  return [defaultExport].flat(Infinity).filter(isRecord)
}

/**
 * A file holding a key no config of the engine holds is some other file, a package.json say, even
 * beside keys a config holds: refused, naming those keys in the order it gives them.
 */
function refuseKeysNoConfigHolds(configs: readonly object[], keysAConfigHolds: ReadonlySet<string>, other: OtherConfig): void {
  const foreignKeys = new Set(configs.flatMap((config) => Object.keys(config).filter((key) => !keysAConfigHolds.has(key))))
  if (foreignKeys.size > 0) throw new Error(`it is not an ${other.named}: no ${other.named} holds ${[...foreignKeys].join(KEYS_SEPARATOR)}`)
}

/** A file calling our merge more than once leaves no one config to read as the team's. */
function theOneConfigHandedOver<Config>(handedOver: readonly Config[], mergeCalled: string): Config {
  const [config, ...others] = handedOver
  if (config === undefined || others.length > 0) throw new Error(`it calls ${mergeCalled} ${String(handedOver.length)} times, where one call gives the team's config`)
  return config
}

/** The file required, every merge it calls in reading mode. */
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

/**
 * What the file's merges handed over: on a later read, Node serves the module it cached, which calls
 * no merge again, so what they handed over the first time stands, as the module itself does.
 */
function handedOverByTheFile(file: string, handedOverNow: readonly HandedOver[]): readonly HandedOver[] {
  const handedOverFirst = handedOverByFile.get(file)
  if (handedOverNow.length === 0 && handedOverFirst !== undefined) return handedOverFirst
  handedOverByFile.set(file, handedOverNow)
  return handedOverNow
}

/** An ES module's default export; a CommonJS file's `module.exports`. */
function defaultExportOf(loaded: unknown): unknown {
  return isRecord(loaded) && isModuleNamespaceObject(loaded) ? loaded['default'] : loaded
}

/**
 * A JSON oxlint config, comments and trailing commas allowed, judged by its keys before each config it
 * extends by path is read in its place.
 */
function oxlintConfigInJson(file: string, keysAConfigHolds: ReadonlySet<string>): OxlintConfig {
  const config = parsedJsonc(readFileSync(file, 'utf8'))
  if (!isOxlintConfig(config)) throw new Error(`${file} holds ${describeValue(config)}, not a JSON object`)
  refuseKeysNoConfigHolds([config], keysAConfigHolds, TEAMS_OXLINT_CONFIG)
  return { ...config, ...extendsReadFrom(config, dirname(file), keysAConfigHolds) }
}

/** The configs a JSON config extends, each path read from the config's own folder: no key where it extends none. */
function extendsReadFrom(config: OxlintConfig, folder: string, keysAConfigHolds: ReadonlySet<string>): Pick<OxlintConfig, 'extends'> {
  if (config.extends === undefined) return {}
  return {
    extends: extendedBy(config).map((extended) => (isAnObject(extended) ? extended : oxlintConfigInJson(resolve(folder, extended), keysAConfigHolds))),
  }
}

/** The blocks ESLint makes of a config, through its own defineConfig, which refuses what is no object, and keeps any key: loaded only to read one. */
function eslintBlocksOf(config: unknown): readonly Linter.Config[] {
  const { defineConfig }: typeof import('eslint/config') = requireFromHere(ESLINT_CONFIG_HELPERS)
  // Parse boundary: a team's default export, which defineConfig checks.
  return defineConfig(config as TeamEslintConfig)
}

/** Parse boundary: an object, whose keys the read then checks; oxlint checks the rest itself when it loads the config. */
function isOxlintConfig(value: unknown): value is OxlintConfig {
  return isRecord(value)
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) return 'an array'
  if (value === null) return 'null'
  if (typeof value === 'object') return 'an object'
  return `${typeof value} ${String(value)}`
}
