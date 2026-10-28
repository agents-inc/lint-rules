import { type Dirent, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'
import type { FileTest } from './eslint-file-types.ts'
import { liesOutside } from './lies-outside.ts'
import { namedGroupOf } from './named-groups.ts'
import { directoriesUpFrom } from './paths-from-a-folder.ts'
import { readOnce } from './read-once.ts'

type ReleaseLine = { readonly major: number; readonly minor: number }

type ConfigFileRead = { readonly ownFiles: ReadonlySet<string>; readonly loadedReferences: readonly string[] }

export type TsconfigWalk = {
  /** Absolute paths, outside node_modules and .git. */
  readonly tsconfigFiles: readonly string[]
  /** By absolute path: a config the project service tries for the file, or one it references, lists it. Mirrors the project service's search: from the file's directory up to tsconfigRootDir, a tsconfig.json then a jsconfig.json in each. */
  readonly isListed: FileTest
}

type Reads = {
  readonly configFiles: Map<string, ConfigFileRead>
  readonly configFilesInDirectory: Map<string, readonly string[]>
  readonly extendedConfigs: Map<string, ts.ExtendedConfigCacheEntry>
}

// In each directory the project service tries a tsconfig.json first, then a jsconfig.json.
const CONFIG_FILE_NAMES: readonly string[] = ['tsconfig.json', 'jsconfig.json']
const TS_FILE = /\.(?:ts|mts|cts|tsx)$/u
// ESLint lints nothing under these.
const DIRECTORIES_NEVER_WALKED: ReadonlySet<string> = new Set(['node_modules', '.git'])
// A directory the walk cannot list: no permission (measured EACCES on a real project), or gone.
const UNREADABLE_DIRECTORY_CODES: ReadonlySet<string> = new Set(['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR'])
const GLOB_SEPARATOR = '/'
const AT_THE_ROOT = ''
// From this TypeScript the project service tries every ancestor config, not only the nearest.
const EVERY_ANCESTOR_CONFIG_SINCE: ReleaseLine = { major: 5, minor: 7 }
const RELEASE_LINE = /^(?<major>\d+)\.(?<minor>\d+)$/u

// A config file TypeScript cannot read lists no file, as the project service then finds no project in it.
const CONFIG_HOST: ts.ParseConfigFileHost = {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic() {
    return undefined
  },
}

export function tsconfigWalkOf(tsconfigRootDir: string): TsconfigWalk {
  const root = resolve(tsconfigRootDir)
  const files = filesUnder(root, AT_THE_ROOT).map((file) => resolve(root, file))
  return { tsconfigFiles: files.filter(isConfigFile), isListed: listingTestOf(root, new Set(files)) }
}

/** The configs are read once, when first asked of; a file the walk did not find is asked of them read afresh, as that read may predate it. */
function listingTestOf(root: string, foundByTheWalk: ReadonlySet<string>): FileTest {
  const firstReads = freshReads()
  function isListedAsFirstRead(file: string): boolean {
    return isTakenInByAConfig(file, root, firstReads)
  }
  function isListedAsTheDiskNowHolds(file: string): boolean {
    return isTakenInByAConfig(file, root, freshReads())
  }
  function isMadeSinceTheWalk(file: string): boolean {
    return !foundByTheWalk.has(file)
  }
  return (file) => isListedAsFirstRead(file) || (isMadeSinceTheWalk(file) && isListedAsTheDiskNowHolds(file))
}

/** A typed rule on a TS file the walk reaches, and no tsconfig lists, is a fatal parse error. */
export function isTsFileTheWalkReaches(file: string, tsconfigRootDir: string): boolean {
  const fromTheRoot = relative(resolve(tsconfigRootDir), file)
  return isTsFile(file) && !liesOutside(fromTheRoot) && !liesUnderAFolderNeverWalked(fromTheRoot)
}

function liesUnderAFolderNeverWalked(fromTheRoot: string): boolean {
  return fromTheRoot.split(sep).some((part) => DIRECTORIES_NEVER_WALKED.has(part))
}

function freshReads(): Reads {
  return { configFiles: new Map(), configFilesInDirectory: new Map(), extendedConfigs: new Map() }
}

function isTakenInByAConfig(file: string, root: string, reads: Reads): boolean {
  return configFilesTriedFor(file, root, reads).some((tried) => loadsAConfigListing(tried, file, reads))
}

/** The config itself, or one its references load. */
function loadsAConfigListing(configFile: string, file: string, reads: Reads): boolean {
  return configFilesLoadedFrom(configFile, reads).some((loaded) => readOf(loaded, reads).ownFiles.has(file))
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

function configFilesLoadedFrom(configFile: string, reads: Reads): readonly string[] {
  return withEachConfigLoadedFrom(configFile, [], reads)
}

/** Depth first, each once: a config loaded already is not read again, so a cycle of references ends. */
function withEachConfigLoadedFrom(configFile: string, loaded: readonly string[], reads: Reads): readonly string[] {
  if (loaded.includes(configFile)) return loaded
  return readOf(configFile, reads).loadedReferences.reduce<readonly string[]>(
    (loadedSoFar, reference) => withEachConfigLoadedFrom(reference, loadedSoFar, reads),
    [...loaded, configFile],
  )
}

function readOf(configFile: string, reads: Reads): ConfigFileRead {
  return readOnce(reads.configFiles, configFile, () => configFileReadAt(configFile, reads))
}

function configFileReadAt(configFile: string, reads: Reads): ConfigFileRead {
  const parsed = ts.getParsedCommandLineOfConfigFile(configFile, undefined, CONFIG_HOST, reads.extendedConfigs)
  return parsed === undefined ? { ownFiles: new Set(), loadedReferences: [] } : configFileReadFrom(parsed)
}

/** With `disableReferencedProjectLoad`, the service loads none of its references. */
function configFileReadFrom({ fileNames, options, projectReferences = [] }: Readonly<ts.ParsedCommandLine>): ConfigFileRead {
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
  return entriesOf(join(root, fromRoot)).flatMap((entry) => filesOfTheEntry(root, fromRoot, entry))
}

function filesOfTheEntry(root: string, fromRoot: string, entry: Readonly<Dirent>): string[] {
  const path = fromRoot === AT_THE_ROOT ? entry.name : `${fromRoot}${GLOB_SEPARATOR}${entry.name}`
  if (entry.isDirectory()) return DIRECTORIES_NEVER_WALKED.has(entry.name) ? [] : filesUnder(root, path)
  return entry.isFile() ? [path] : []
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
