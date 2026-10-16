import { type Dirent, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import ts from 'typescript'

type ReleaseLine = { readonly major: number; readonly minor: number }

/** What a config file gives the project service: the files it lists itself, and the config files it loads besides. */
type ConfigFileRead = { readonly ownFiles: ReadonlySet<string>; readonly loadedReferences: readonly string[] }

/** What one walk of tsconfigRootDir finds: the TS files no tsconfig takes in, relative to it, and every config file, absolute. */
export type TsconfigWalk = { readonly tsFilesOutsideEveryTsconfig: readonly string[]; readonly tsconfigFiles: readonly string[] }

/** What one computation has read, each read once. */
type Reads = {
  readonly configFiles: Map<string, ConfigFileRead>
  readonly configFilesInDirectory: Map<string, readonly string[]>
  readonly extendedConfigs: Map<string, ts.ExtendedConfigCacheEntry>
}

// In each directory the project service tries a tsconfig.json first, then a jsconfig.json.
const CONFIG_FILE_NAMES = ['tsconfig.json', 'jsconfig.json']
const TS_FILE = /\.(?:ts|mts|cts|tsx)$/u
// ESLint lints nothing under these.
const DIRECTORIES_NEVER_WALKED: ReadonlySet<string> = new Set(['node_modules', '.git'])
// A directory the walk cannot list: no permission (R2 measured EACCES on a real project), or gone.
const UNREADABLE_DIRECTORY_CODES: ReadonlySet<string> = new Set(['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR'])
const GLOB_SEPARATOR = '/'
// The TypeScript from which the project service tries every ancestor config, not only the nearest.
const EVERY_ANCESTOR_CONFIG_SINCE: ReleaseLine = { major: 5, minor: 7 }
const RELEASE_LINE = /^(?<major>\d+)\.(?<minor>\d+)$/u

// A config file TypeScript cannot read lists no file, as the project service then finds no project in it.
const CONFIG_HOST: ts.ParseConfigFileHost = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }

/**
 * The TS files under tsconfigRootDir that typescript-eslint's project service finds no tsconfig
 * for, relative to it, `/` between segments: a typed rule there is a fatal parse error. The search
 * is the service's own (spec C3, R2): from the file's directory up to tsconfigRootDir and no
 * higher, a tsconfig.json then a jsconfig.json in each, and a config takes the file in when it, or
 * a config it references, lists it. Before TypeScript 5.7 only the nearest config counts. A file a
 * config only imports is listed here, though the service finds it through the importer (D-h).
 */
export function tsFilesOutsideEveryTsconfig(tsconfigRootDir: string): readonly string[] {
  return tsconfigWalkOf(tsconfigRootDir).tsFilesOutsideEveryTsconfig
}

/**
 * One walk of tsconfigRootDir, outside node_modules and .git: the TS files outside every tsconfig
 * (`tsFilesOutsideEveryTsconfig`), and every tsconfig.json and jsconfig.json, which the import-x
 * resolver reads (spec-core.md C1).
 */
export function tsconfigWalkOf(tsconfigRootDir: string): TsconfigWalk {
  const root = resolve(tsconfigRootDir)
  const reads = newReads()
  const files = filesUnder(root, '')
  return {
    tsFilesOutsideEveryTsconfig: files.filter(isTsFile).filter((file) => !isTakenInByAConfig(resolve(root, file), root, reads)),
    tsconfigFiles: files.filter(isConfigFile).map((file) => resolve(root, file)),
  }
}

/** Of the files given, relative to tsconfigRootDir, those a config the project service tries for them takes in, by the same search. */
export function filesTakenInByAConfig(tsconfigRootDir: string, files: readonly string[]): string[] {
  const root = resolve(tsconfigRootDir)
  const reads = newReads()
  return files.filter((file) => isTakenInByAConfig(resolve(root, file), root, reads))
}

function newReads(): Reads {
  return { configFiles: new Map(), configFilesInDirectory: new Map(), extendedConfigs: new Map() }
}

function isTakenInByAConfig(file: string, root: string, reads: Reads): boolean {
  return configFilesTriedFor(file, root, reads).some((tried) =>
    configFilesLoadedFrom(tried, reads).some((loaded) => readOf(loaded, reads).ownFiles.has(file)),
  )
}

/** The config files the project service tries for the file, nearest first: before TypeScript 5.7, the nearest alone. */
function configFilesTriedFor(file: string, root: string, reads: Reads): readonly string[] {
  const nearestFirst = directoriesFromUpTo(dirname(file), root).flatMap((directory) => configFilesIn(directory, reads))
  return triesEveryAncestorConfig(ts.versionMajorMinor) ? nearestFirst : nearestFirst.slice(0, 1)
}

/** The directory and each one above it up to the root, which lies at or above it. */
function directoriesFromUpTo(directory: string, root: string): string[] {
  return directory === root ? [root] : [directory, ...directoriesFromUpTo(dirname(directory), root)]
}

function configFilesIn(directory: string, reads: Reads): readonly string[] {
  return readOnce(reads.configFilesInDirectory, directory, () =>
    CONFIG_FILE_NAMES.map((name) => join(directory, name)).filter((path) => ts.sys.fileExists(path)),
  )
}

/** The config file and every config file it loads through its references, transitively, each once. */
function configFilesLoadedFrom(configFile: string, reads: Reads): string[] {
  const loaded = new Set<string>()
  const load = (current: string): void => {
    if (loaded.has(current)) return
    loaded.add(current)
    readOf(current, reads).loadedReferences.forEach(load)
  }
  load(configFile)
  return [...loaded]
}

function readOf(configFile: string, reads: Reads): ConfigFileRead {
  return readOnce(reads.configFiles, configFile, () => {
    const parsed = ts.getParsedCommandLineOfConfigFile(configFile, undefined, CONFIG_HOST, reads.extendedConfigs)
    return parsed === undefined ? { ownFiles: new Set(), loadedReferences: [] } : configFileReadFrom(parsed)
  })
}

/** Its `extends` resolved. With `disableReferencedProjectLoad`, the service loads none of its references. */
function configFileReadFrom({ fileNames, options, projectReferences = [] }: ts.ParsedCommandLine): ConfigFileRead {
  const loadsReferences = options.disableReferencedProjectLoad !== true
  return {
    ownFiles: new Set(fileNames.map((fileName) => resolve(fileName))),
    loadedReferences: loadsReferences ? projectReferences.map((reference) => resolve(ts.resolveProjectReferencePath(reference))) : [],
  }
}

function readOnce<Value>(cache: Map<string, Value>, key: string, read: () => Value): Value {
  const known = cache.get(key)
  if (known !== undefined) return known
  const value = read()
  cache.set(key, value)
  return value
}

function triesEveryAncestorConfig(versionMajorMinor: string): boolean {
  const { major, minor } = releaseLineOf(versionMajorMinor)
  const since = EVERY_ANCESTOR_CONFIG_SINCE
  return major > since.major || (major === since.major && minor >= since.minor)
}

function releaseLineOf(versionMajorMinor: string): ReleaseLine {
  const groups = RELEASE_LINE.exec(versionMajorMinor)?.groups
  const major = groups?.['major']
  const minor = groups?.['minor']
  if (major === undefined || minor === undefined) throw new Error(`TypeScript gives its version as "${versionMajorMinor}", not major.minor`)
  return { major: Number(major), minor: Number(minor) }
}

/** Every file under the directory, relative to the root, `/` between segments. */
function filesUnder(root: string, fromRoot: string): string[] {
  return entriesOf(join(root, fromRoot)).flatMap((entry) => {
    const path = fromRoot === '' ? entry.name : `${fromRoot}${GLOB_SEPARATOR}${entry.name}`
    if (entry.isDirectory()) return DIRECTORIES_NEVER_WALKED.has(entry.name) ? [] : filesUnder(root, path)
    return entry.isFile() ? [path] : []
  })
}

/** A TS file, declaration files included. */
function isTsFile(path: string): boolean {
  return TS_FILE.test(path)
}

function isConfigFile(path: string): boolean {
  return CONFIG_FILE_NAMES.includes(basename(path))
}

/** A directory's entries; none where it cannot be listed. */
function entriesOf(directory: string): Dirent[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
  } catch (error) {
    if (isUnreadableDirectory(error)) return []
    throw error
  }
}

function isUnreadableDirectory(error: unknown): boolean {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' && UNREADABLE_DIRECTORY_CODES.has(error.code)
}
