import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import ts from 'typescript'
import { resolvedFrom } from './package-json-files.ts'
import { filesTakenInByAConfig, tsconfigWalkOf } from './ts-files-outside-every-tsconfig.ts'

// Read once per build so the ESLint builders stay pure.

export type ProjectFacts = {
  /** Relative to tsconfigRootDir: none of our typed rules runs there. */
  readonly tsFilesOutsideEveryTsconfig: readonly string[]
  /** Absolute paths, outside node_modules and .git. */
  readonly tsconfigFiles: readonly string[]
  /** eslint-plugin-react's `detect` requires it. */
  readonly reactIsInstalled: boolean
}

// eslint-plugin-react 7.37.5's `detect` resolves `react` itself.
const REACT = 'react'
const RELATIVE_SPECIFIER = /^\.\.?\//u
// ts.preProcessFile's first flag: read the file's imports.
const READ_IMPORTS = true
// TypeScript reads a `require` call as an import only in a JavaScript file, not in a TS ES module (measured).
const JAVASCRIPT_FILE = /\.[cm]?jsx?$/u
const CONSUMER_FILES_AT_THE_ROOT: readonly string[] = Object.values(consumerConfigFiles)

export function projectFactsOf(tsconfigRootDir: string): ProjectFacts {
  const walk = tsconfigWalkOf(tsconfigRootDir)
  const foundThroughAnImport = new Set(consumerFilesFoundThroughAnImporter(tsconfigRootDir, walk.tsFilesOutsideEveryTsconfig))
  return {
    tsFilesOutsideEveryTsconfig: walk.tsFilesOutsideEveryTsconfig.filter((file) => !foundThroughAnImport.has(file)),
    tsconfigFiles: walk.tsconfigFiles,
    reactIsInstalled: resolvedFrom(tsconfigRootDir, REACT) !== null,
  }
}

/** Consumer files no tsconfig lists but that a tsconfig'd file imports (oxlint.config.mts imports agents-inc.lint.mts): the project service types them through the importer. Only imports naming the file's own path are read (a known limit). */
function consumerFilesFoundThroughAnImporter(tsconfigRootDir: string, tsFilesOutside: readonly string[]): string[] {
  const outsideAtTheRoot = CONSUMER_FILES_AT_THE_ROOT.filter((file) => tsFilesOutside.includes(file))
  const present = CONSUMER_FILES_AT_THE_ROOT.filter((file) => existsSync(join(tsconfigRootDir, file)))
  const possibleImporters = present.filter((file) => !outsideAtTheRoot.includes(file))
  const importers = filesTakenInByAConfig(tsconfigRootDir, possibleImporters)
  const imported = new Set(importers.flatMap((importer) => relativeImportsOf(join(tsconfigRootDir, importer))))
  return outsideAtTheRoot.filter((file) => imported.has(resolve(tsconfigRootDir, file)))
}

function relativeImportsOf(file: string): string[] {
  const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), READ_IMPORTS, JAVASCRIPT_FILE.test(file))
  const specifiers = importedFiles.map(({ fileName }) => fileName)
  return specifiers.filter((specifier) => RELATIVE_SPECIFIER.test(specifier)).map((specifier) => resolve(dirname(file), specifier))
}
