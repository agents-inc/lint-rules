import { type Dirent, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import ts from 'typescript'
import { namedGroupOf } from './named-groups.ts'
import { directoriesUpFrom } from './paths-from-a-folder.ts'
import { readOnce } from './read-once.ts'

type ReleaseLine = { readonly major: number; readonly minor: number }

type ConfigFileRead = { readonly ownFiles: ReadonlySet<string>; readonly loadedReferences: readonly string[] }

/** TS files relative to tsconfigRootDir; config files absolute. */
type TsconfigWalk = { readonly tsFilesOutsideEveryTsconfig: readonly string[]; readonly tsconfigFiles: readonly string[] }

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
// A directory the walk cannot list: no permission (measured EACCES on a real project), or gone.
const UNREADABLE_DIRECTORY_CODES: ReadonlySet<string> = new Set(['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR'])
const GLOB_SEPARATOR = '/'
// From this TypeScript the project service tries every ancestor config, not only the nearest.
const EVERY_ANCESTOR_CONFIG_SINCE: ReleaseLine = { major: 5, minor: 7 }
const RELEASE_LINE = /^(?<major>\d+)\.(?<minor>\d+)$/u

// A config file TypeScript cannot read lists no file, as the project service then finds no project in it.
const CONFIG_HOST: ts.ParseConfigFileHost = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }

/** A typed rule on these is a fatal parse error. Mirrors the project service's search: from the file's directory up to tsconfigRootDir, a tsconfig.json then a jsconfig.json in each, a config or one it references listing the file. */
export function tsFilesOutsideEveryTsconfig(tsconfigRootDir: string): readonly string[] {
  return tsconfigWalkOf(tsconfigRootDir).tsFilesOutsideEveryTsconfig
}

/** Also returns every tsconfig.json and jsconfig.json, which the import-x resolver reads. */
export function tsconfigWalkOf(tsconfigRootDir: string): TsconfigWalk {
  const root = resolve(tsconfigRootDir)
  const reads = newReads()
  const files = filesUnder(root, '')
  return {
    tsFilesOutsideEveryTsconfig: files.filter(isTsFile).filter((file) => !isTakenInByAConfig(resolve(root, file), root, reads)),
    tsconfigFiles: files.filter(isConfigFile).map((file) => resolve(root, file)),
  }
}

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

/** Nearest first; before TypeScript 5.7, the nearest alone. */
function configFilesTriedFor(file: string, root: string, reads: Reads): readonly string[] {
  const nearestFirst = directoriesUpFrom(dirname(file), root).flatMap((directory) => configFilesIn(directory, reads))
  return triesEveryAncestorConfig(ts.versionMajorMinor) ? nearestFirst : nearestFirst.slice(0, 1)
}

function configFilesIn(directory: string, reads: Reads): readonly string[] {
  return readOnce(reads.configFilesInDirectory, directory, () =>
    CONFIG_FILE_NAMES.map((name) => join(directory, name)).filter((path) => ts.sys.fileExists(path)),
  )
}

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

/** With `disableReferencedProjectLoad`, the service loads none of its references. */
function configFileReadFrom({ fileNames, options, projectReferences = [] }: ts.ParsedCommandLine): ConfigFileRead {
  const loadsReferences = options.disableReferencedProjectLoad !== true
  return {
    ownFiles: new Set(fileNames.map((fileName) => resolve(fileName))),
    loadedReferences: loadsReferences ? projectReferences.map((reference) => resolve(ts.resolveProjectReferencePath(reference))) : [],
  }
}

function triesEveryAncestorConfig(versionMajorMinor: string): boolean {
  const { major, minor } = releaseLineOf(versionMajorMinor)
  const since = EVERY_ANCESTOR_CONFIG_SINCE
  return major > since.major || (major === since.major && minor >= since.minor)
}

function releaseLineOf(versionMajorMinor: string): ReleaseLine {
  const match = RELEASE_LINE.exec(versionMajorMinor)
  if (match === null) throw new Error(`TypeScript gives its version as "${versionMajorMinor}", not major.minor`)
  return { major: Number(namedGroupOf(match, 'major')), minor: Number(namedGroupOf(match, 'minor')) }
}

function filesUnder(root: string, fromRoot: string): string[] {
  return entriesOf(join(root, fromRoot)).flatMap((entry) => {
    const path = fromRoot === '' ? entry.name : `${fromRoot}${GLOB_SEPARATOR}${entry.name}`
    if (entry.isDirectory()) return DIRECTORIES_NEVER_WALKED.has(entry.name) ? [] : filesUnder(root, path)
    return entry.isFile() ? [path] : []
  })
}

function isTsFile(path: string): boolean {
  return TS_FILE.test(path)
}

function isConfigFile(path: string): boolean {
  return CONFIG_FILE_NAMES.includes(basename(path))
}

/** None where it cannot be listed. */
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
