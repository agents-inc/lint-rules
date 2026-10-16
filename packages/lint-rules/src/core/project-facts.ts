import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import ts from 'typescript'
import { resolvedFrom } from './package-json-files.ts'
import { filesTakenInByAConfig, tsconfigWalkOf } from './ts-files-outside-every-tsconfig.ts'

// What the ESLint builders read from the project on disk, read once per build so they stay pure:
// the agent build reads them in `buildAgentConfigs`, the ESLint merge in `mergeEslintPart`.

/** The project as the ESLint builders read it, under tsconfigRootDir. */
export type ProjectFacts = {
  /**
   * Each TS file the project service finds no tsconfig for, relative to tsconfigRootDir, `/` between
   * segments: none of our typed rules runs there.
   */
  readonly tsFilesOutsideEveryTsconfig: readonly string[]
  /** Every tsconfig.json and jsconfig.json under tsconfigRootDir outside node_modules and .git, as absolute paths. */
  readonly tsconfigFiles: readonly string[]
  /** Whether React resolves from tsconfigRootDir, which eslint-plugin-react's `detect` requires. */
  readonly reactIsInstalled: boolean
}

// eslint-plugin-react 7.37.5's `detect` resolves `react` itself (lib/util/version.js, detectReactVersion).
const REACT = 'react'
const RELATIVE_SPECIFIER = /^\.\.?\//u
// ts.preProcessFile's first flag: read the file's imports.
const READ_IMPORTS = true
// TypeScript reads a `require` call as an import in a JavaScript file alone, as eslint.config.mjs, and
// not in an ES module of TypeScript's, as oxlint.config.mts (measured with the project service).
const JAVASCRIPT_FILE = /\.[cm]?jsx?$/u
const CONSUMER_FILES_AT_THE_ROOT: readonly string[] = Object.values(consumerConfigFiles)

/** The project's facts: one walk of tsconfigRootDir, and whether React resolves from it. */
export function projectFactsOf(tsconfigRootDir: string): ProjectFacts {
  const walk = tsconfigWalkOf(tsconfigRootDir)
  const foundThroughAnImport = new Set(consumerFilesFoundThroughAnImporter(tsconfigRootDir, walk.tsFilesOutsideEveryTsconfig))
  return {
    tsFilesOutsideEveryTsconfig: walk.tsFilesOutsideEveryTsconfig.filter((file) => !foundThroughAnImport.has(file)),
    tsconfigFiles: walk.tsconfigFiles,
    reactIsInstalled: resolvedFrom(tsconfigRootDir, REACT) !== null,
  }
}

/**
 * The consumer's files at tsconfigRootDir that no tsconfig lists, but that another of them a
 * tsconfig takes in imports, as oxlint.config.mts imports agents-inc.lint.mts: the project service
 * finds such a file through its importer's program (D-h), so it has type information and our typed
 * rules run there. Only those importers are read, and only an import naming the file's own path (a
 * limit): a file found otherwise stays untyped.
 */
function consumerFilesFoundThroughAnImporter(tsconfigRootDir: string, tsFilesOutside: readonly string[]): string[] {
  const outsideAtTheRoot = CONSUMER_FILES_AT_THE_ROOT.filter((file) => tsFilesOutside.includes(file))
  const present = CONSUMER_FILES_AT_THE_ROOT.filter((file) => existsSync(join(tsconfigRootDir, file)))
  const possibleImporters = present.filter((file) => !outsideAtTheRoot.includes(file))
  const importers = filesTakenInByAConfig(tsconfigRootDir, possibleImporters)
  const imported = new Set(importers.flatMap((importer) => relativeImportsOf(join(tsconfigRootDir, importer))))
  return outsideAtTheRoot.filter((file) => imported.has(resolve(tsconfigRootDir, file)))
}

/** The absolute path of each module the file imports by a relative specifier, as written. */
function relativeImportsOf(file: string): string[] {
  const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), READ_IMPORTS, JAVASCRIPT_FILE.test(file))
  const specifiers = importedFiles.map(({ fileName }) => fileName)
  return specifiers.filter((specifier) => RELATIVE_SPECIFIER.test(specifier)).map((specifier) => resolve(dirname(file), specifier))
}
