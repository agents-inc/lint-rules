import { existsSync, realpathSync } from 'node:fs'
import { findPackageJSON } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { configErrorIn } from '../../core/config-error.ts'
import { type EslintPart, isEslintPart } from '../../core/editor-parts.ts'
import { ourPackageJsonFile, THIS_PACKAGE } from '../../core/package-json-files.ts'
import { hasErrorCode } from '../caught-errors.ts'
import { foldersUpTo } from '../folders.ts'
import { anotherCopy, NO_ESLINT_PART_EXPORTED, noConfig, notInstalled } from './texts.ts'

/** The agents-inc.lint.mts check lints with, and the folder it is in, whose files it checks. */
export type FoundConfig = { readonly path: string; readonly folder: string }

const CONFIG_FILE = consumerConfigFiles.lintRules
const MODULE_NOT_FOUND = 'ERR_MODULE_NOT_FOUND'

/** The nearest agents-inc.lint.mts from the folder up to the git top level (q-c6): throws where there is none. */
export function nearestConfig(cwd: string, gitTopLevel: string): FoundConfig {
  const folder = foldersUpTo(realpathSync(cwd), gitTopLevel).find((candidate) => existsSync(join(candidate, CONFIG_FILE)))
  if (folder === undefined) throw new Error(noConfig(cwd, gitTopLevel, CONFIG_FILE))
  return { path: join(folder, CONFIG_FILE), folder }
}

/**
 * Throws where the package the config imports is not this check's own copy: another copy keeps its
 * agent settings in a registry of its own, and importing a missing one fails as an import error.
 * Run before the config is imported.
 */
export function refuseAnotherCopy({ path }: FoundConfig): void {
  const imported = realpathSync(dirname(packageJsonTheConfigImports(path)))
  const ours = realpathSync(dirname(ourPackageJsonFile().path))
  if (imported !== ours) throw new Error(anotherCopy(CONFIG_FILE, THIS_PACKAGE, imported, ours))
}

/** Imports the config and gives the ESLint part it exports. Whatever the config throws, check prints as it is. */
export async function eslintPartExportedBy({ path }: FoundConfig): Promise<EslintPart> {
  // Parse boundary: a module's namespace object.
  const exported: Record<string, unknown> = await import(pathToFileURL(path).href)
  const part = exported['eslint']
  if (!isEslintPart(part)) throw configErrorIn(CONFIG_FILE, NO_ESLINT_PART_EXPORTED)
  return part
}

function packageJsonTheConfigImports(configPath: string): string {
  try {
    const found = findPackageJSON(THIS_PACKAGE, pathToFileURL(configPath))
    if (found === undefined) throw new Error(notInstalled(CONFIG_FILE, THIS_PACKAGE))
    return found
  } catch (error) {
    if (hasErrorCode(error, MODULE_NOT_FOUND)) throw new Error(notInstalled(CONFIG_FILE, THIS_PACKAGE), { cause: error })
    throw error
  }
}
