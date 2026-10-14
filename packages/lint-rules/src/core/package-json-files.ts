import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRecord } from './is-record.ts'

export const PACKAGE_JSON = 'package.json'
export const THIS_PACKAGE = '@agents-inc/lint-rules'

/** A package.json as read from disk, with its path for messages: the fields this package reads, unchecked. */
export type PackageJsonFile = {
  readonly path: string
  readonly version: unknown
  readonly dependencies: unknown
  readonly devDependencies: unknown
  readonly peerDependencies: unknown
}

/** The path of the package.json nearest to `dir`: in it, or in the first directory above it that has one. */
export function nearestPackageJsonPath(dir: string): string | undefined {
  return directoriesUpFrom(resolve(dir))
    .map((directory) => join(directory, PACKAGE_JSON))
    .find((path) => existsSync(path))
}

/** This package's own manifest: the nearest package.json above this module, in src and in dist alike. */
export function ourPackageJsonFile(): PackageJsonFile {
  const nearest = nearestPackageJsonPath(dirname(fileURLToPath(import.meta.url)))
  if (nearest === undefined) throw new Error(`${THIS_PACKAGE} found no package.json of its own`)
  return readPackageJsonFile(nearest)
}

/** Parse boundary: any file named package.json. A malformed one throws, naming it. */
export function readPackageJsonFile(path: string): PackageJsonFile {
  const parsed = parsedJsonIn(path)
  if (!isRecord(parsed)) throw new Error(`${path}: not a JSON object`)
  return {
    path,
    version: parsed['version'],
    dependencies: parsed['dependencies'],
    devDependencies: parsed['devDependencies'],
    peerDependencies: parsed['peerDependencies'],
  }
}

/** Whether a dependency field lists the package, at any version. */
export function listsPackage(field: unknown, packageName: string): boolean {
  return isRecord(field) && Object.hasOwn(field, packageName)
}

/** The version range a dependency field gives the package: throws, naming the file, when it gives none. */
export function rangeListedIn(file: PackageJsonFile, field: unknown, packageName: string): string {
  const range = isRecord(field) ? field[packageName] : undefined
  if (typeof range !== 'string') throw new Error(`${file.path}: lists no version range for ${packageName}`)
  return range
}

/** The version a package's own package.json gives: throws, naming the file, when it gives none. */
export function versionOf(file: PackageJsonFile): string {
  if (typeof file.version !== 'string') throw new Error(`${file.path}: gives no version`)
  return file.version
}

function directoriesUpFrom(absoluteDir: string): string[] {
  const parent = dirname(absoluteDir)
  return parent === absoluteDir ? [absoluteDir] : [absoluteDir, ...directoriesUpFrom(parent)]
}

function parsedJsonIn(path: string): unknown {
  const text = readFileSync(path, 'utf8')
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${path}: not valid JSON`, { cause: error })
  }
}
