import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import ts from 'typescript'
import type { FileTest } from './eslint-file-types.ts'
import { readOnce } from './read-once.ts'
import { isTsFileTheWalkReaches, tsconfigWalkOf } from './ts-files-outside-every-tsconfig.ts'

// The walk runs once per build, so the ESLint builders stay pure. Whether a file lies outside every tsconfig is
// asked as ESLint lints it, so a file made after the config loaded is read as the disk then holds it.

export type ProjectFacts = {
  /** By absolute path, each file answered as first asked: none of our typed rules runs there. */
  readonly isOutsideEveryTsconfig: FileTest
  /** Absolute paths, outside node_modules and .git. */
  readonly tsconfigFiles: readonly string[]
}

const RELATIVE_SPECIFIER = /^\.\.?\//u
// ts.preProcessFile's first flag: read the file's imports.
const SHOULD_READ_IMPORTS = true
// TypeScript reads a `require` call as an import only in a JavaScript file, not in a TS ES module (measured).
const JAVASCRIPT_FILE = /\.[cm]?jsx?$/u
const CONSUMER_FILES_AT_THE_ROOT: readonly string[] = Object.values(consumerConfigFiles)

export function projectFactsOf(tsconfigRootDir: string): ProjectFacts {
  const root = resolve(tsconfigRootDir)
  const { tsconfigFiles, isListed } = tsconfigWalkOf(root)
  const answers = new Map<string, boolean>()
  function isOutside(file: string): boolean {
    return isTsFileTheWalkReaches(file, root) && !isListed(file) && !isConsumerFileFoundThroughAnImporter(file, root, isListed)
  }
  function isOutsideEveryTsconfig(file: string): boolean {
    return readOnce(answers, file, isOutside)
  }
  return { isOutsideEveryTsconfig, tsconfigFiles }
}

/** A consumer file at tsconfigRootDir no tsconfig lists, which another there that a tsconfig lists imports (oxlint.config.mts imports agents-inc.lint.mts): the project service types it through the importer. Only imports naming the file's own path are read (a known limit). */
function isConsumerFileFoundThroughAnImporter(file: string, root: string, isListed: FileTest): boolean {
  const consumerFiles = CONSUMER_FILES_AT_THE_ROOT.map((name) => join(root, name))
  if (!consumerFiles.includes(file)) return false
  const importers = consumerFiles.filter((importer) => existsSync(importer) && isListed(importer))
  return importers.some((importer) => relativeImportsOf(importer).includes(file))
}

function relativeImportsOf(file: string): string[] {
  const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), SHOULD_READ_IMPORTS, JAVASCRIPT_FILE.test(file))
  const specifiers = importedFiles.map(({ fileName }) => fileName)
  return specifiers.filter((specifier) => RELATIVE_SPECIFIER.test(specifier)).map((specifier) => resolve(dirname(file), specifier))
}
