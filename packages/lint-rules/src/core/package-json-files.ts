import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { foundOr } from '@workspace/rule-data/collections'
import { hasErrorCode } from './caught-errors.ts'
import { isRecord } from './is-record.ts'
import { directoriesUpFrom } from './paths-from-a-folder.ts'

export const PACKAGE_JSON = 'package.json'
export const THIS_PACKAGE = '@agents-inc/lint-rules'
// require's code; an import's is ERR_MODULE_NOT_FOUND.
const MODULE_NOT_FOUND = 'MODULE_NOT_FOUND'

/** The fields this package reads, unchecked. */
export type PackageJsonFile = {
  readonly path: string
  readonly version: unknown
  readonly dependencies: unknown
  readonly devDependencies: unknown
}

export function nearestPackageJsonPath(dir: string): string | undefined {
  return directoriesUpFrom(resolve(dir))
    .map((directory) => join(directory, PACKAGE_JSON))
    .find((path) => existsSync(path))
}

/** The nearest package.json above this module, in src and in dist alike. */
export function ourPackageJsonFile(): PackageJsonFile {
  const nearest = foundOr(nearestPackageJsonPath(dirname(fileURLToPath(import.meta.url))), `${THIS_PACKAGE} found no package.json of its own`)
  return readPackageJsonFile(nearest)
}

/** Parse boundary: a malformed file throws, naming it. */
export function readPackageJsonFile(path: string): PackageJsonFile {
  const parsed = parsedJsonIn(path)
  if (!isRecord(parsed)) throw new Error(`${path}: not a JSON object`)
  return {
    path,
    version: parsed['version'],
    dependencies: parsed['dependencies'],
    devDependencies: parsed['devDependencies'],
  }
}

export function listsPackage(field: unknown, packageName: string): boolean {
  return isRecord(field) && Object.hasOwn(field, packageName)
}

/** Throws, naming the file, when it gives none. */
export function versionOf(file: PackageJsonFile): string {
  if (typeof file.version !== 'string') throw new TypeError(`${file.path}: gives no version`)
  return file.version
}

/** Null where nothing resolves. */
export function resolvedFrom(dir: string, request: string): string | null {
  try {
    return createRequire(resolve(dir, PACKAGE_JSON)).resolve(request)
  } catch (error) {
    if (hasErrorCode(error, MODULE_NOT_FOUND)) return null
    throw error
  }
}

function parsedJsonIn(path: string): unknown {
  const text = readFileSync(path, 'utf8')
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${path}: not valid JSON`, { cause: error })
  }
}
