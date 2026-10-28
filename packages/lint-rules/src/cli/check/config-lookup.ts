import { existsSync, realpathSync } from 'node:fs'
import { findPackageJSON } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { foundOr } from '@workspace/rule-data/collections'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { hasErrorCode } from '../../core/caught-errors.ts'
import { configErrorIn } from '../../core/config-error.ts'
import { type EslintPart, isEslintPart } from '../../core/editor-parts.ts'
import { isRecord } from '../../core/is-record.ts'
import { ourPackageJsonFile, THIS_PACKAGE } from '../../core/package-json-files.ts'
import { foldersUpTo } from '../folders.ts'
import { anotherCopy, NO_ESLINT_PART_EXPORTED, noConfig, notInstalled } from './texts.ts'

export type FoundConfig = { readonly path: string; readonly folder: string }

const CONFIG_FILE = consumerConfigFiles.lintRules
const MODULE_NOT_FOUND = 'ERR_MODULE_NOT_FOUND'

/** Searches up to the git top level; throws where there is none. */
export function nearestConfig(cwd: string, gitTopLevel: string): FoundConfig {
  const folder = foundOr(
    foldersUpTo(realpathSync(cwd), gitTopLevel).find((candidate) => existsSync(join(candidate, CONFIG_FILE))),
    noConfig(cwd, gitTopLevel, CONFIG_FILE),
  )
  return { path: join(folder, CONFIG_FILE), folder }
}

/**
 * Another copy keeps its agent settings in a registry of its own, and importing a missing one
 * fails as an import error, so this runs before the import. Gives back the config, which imports this copy.
 */
export function refuseAnotherCopy(config: FoundConfig): FoundConfig {
  const imported = realpathSync(dirname(packageJsonTheConfigImports(config.path)))
  const ours = realpathSync(dirname(ourPackageJsonFile().path))
  if (imported !== ours) throw new Error(anotherCopy(CONFIG_FILE, THIS_PACKAGE, imported, ours))
  return config
}

export async function eslintPartExportedBy({ path }: FoundConfig): Promise<EslintPart> {
  // Parse boundary: a module's namespace object, which is always a record.
  const exported: unknown = await import(pathToFileURL(path).href)
  const part = isRecord(exported) ? exported['eslint'] : undefined
  if (!isEslintPart(part)) throw configErrorIn(CONFIG_FILE, NO_ESLINT_PART_EXPORTED)
  return part
}

function packageJsonTheConfigImports(configPath: string): string {
  try {
    return foundOr(findPackageJSON(THIS_PACKAGE, pathToFileURL(configPath)), notInstalled(CONFIG_FILE, THIS_PACKAGE))
  } catch (error) {
    if (hasErrorCode(error, MODULE_NOT_FOUND)) throw new Error(notInstalled(CONFIG_FILE, THIS_PACKAGE), { cause: error })
    throw error
  }
}
