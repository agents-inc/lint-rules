import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildInstalledPackageExportingItsEntryAlone } from '../__tests__/factories/package-json-factories.ts'
import { buildTsconfig } from '../__tests__/factories/tsconfig-factories.ts'
import { configFileText, esModuleRequiring, javaScriptRequiring, sourceImporting, standaloneSources } from '../__tests__/factories/tsconfig-layout-factories.ts'
import { PARALLEL_LOAD_TIMEOUT_MS } from '../__tests__/parallel-load.ts'
import { tsFilesTheProjectServiceFindsNoProjectFor } from '../__tests__/project-service-verdicts.ts'
import { type ProjectFiles, setUpTempProjects } from '../__tests__/temp-projects.ts'
import { projectFactsOf } from './project-facts.ts'

// The consumer's agents-inc.lint.mts, which no tsconfig lists, has type information where another of
// the consumer's files, which a tsconfig lists, imports it by its path: the project service finds it
// through the importer's program (D-h). Each case compares the facts with what the real project
// service decides.

const LINT_RULES_FILE = 'agents-inc.lint.mts'
const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
const ESLINT_CONFIG_FILE = 'eslint.config.mjs'
const BY_ITS_PATH = `./${LINT_RULES_FILE}`
const REACT = 'react'
// A folder whose name ends in .js, as a project named after a library may be.
const FOLDER_NAMED_AS_A_JS_FILE = 'chart.js'

const tempProjects = setUpTempProjects()

/** agents-inc.lint.mts beside the consumer file given, which the tsconfig alone lists, holding the source given. */
function projectWhoseImporterIs(importer: string, source: string, compilerOptions = buildTsconfig().compilerOptions): ProjectFiles {
  return { 'tsconfig.json': configFileText({ files: [importer], compilerOptions }), [importer]: source, ...standaloneSources([LINT_RULES_FILE]) }
}

/** The project's files under the folder given. */
function underFolder(folder: string, files: ProjectFiles): ProjectFiles {
  return Object.fromEntries(Object.entries(files).map(([path, text]) => [`${folder}/${path}`, text]))
}

describe("projectFactsOf's TS files outside every tsconfig, beside the project service's, for agents-inc.lint.mts", () => {
  it.each([
    { how: 'imported by its path', files: projectWhoseImporterIs(OXLINT_CONFIG_FILE, sourceImporting(BY_ITS_PATH)), folder: '.', outside: [] },
    {
      how: 'imported by a bare specifier of its name, which TypeScript resolves from node_modules',
      files: projectWhoseImporterIs(OXLINT_CONFIG_FILE, sourceImporting(LINT_RULES_FILE)),
      folder: '.',
      outside: [LINT_RULES_FILE],
    },
    {
      how: 'imported by a bare specifier going up a folder to it, which TypeScript resolves from node_modules',
      files: projectWhoseImporterIs(OXLINT_CONFIG_FILE, sourceImporting(`pkg/../${LINT_RULES_FILE}`)),
      folder: '.',
      outside: [LINT_RULES_FILE],
    },
    {
      how: 'required in oxlint.config.mts, an ES module, where TypeScript reads a require call as no import',
      files: projectWhoseImporterIs(OXLINT_CONFIG_FILE, esModuleRequiring(BY_ITS_PATH)),
      folder: '.',
      outside: [LINT_RULES_FILE],
    },
    {
      how: 'required in eslint.config.mjs, a JavaScript file a tsconfig allowing JS lists, where TypeScript reads a require call as an import',
      files: projectWhoseImporterIs(ESLINT_CONFIG_FILE, javaScriptRequiring(BY_ITS_PATH), { ...buildTsconfig().compilerOptions, allowJs: true }),
      folder: '.',
      outside: [],
    },
    {
      how: 'required in oxlint.config.mts, an ES module though the name of a folder it is in holds .js',
      files: underFolder(FOLDER_NAMED_AS_A_JS_FILE, projectWhoseImporterIs(OXLINT_CONFIG_FILE, esModuleRequiring(BY_ITS_PATH))),
      folder: FOLDER_NAMED_AS_A_JS_FILE,
      outside: [LINT_RULES_FILE],
    },
    {
      how: 'beside a tsconfig listing an oxlint.config.mts that is not there',
      files: { 'tsconfig.json': configFileText({ files: [OXLINT_CONFIG_FILE] }), ...standaloneSources([LINT_RULES_FILE]) },
      folder: '.',
      outside: [LINT_RULES_FILE],
    },
  ])('are the same where it is $how', { timeout: PARALLEL_LOAD_TIMEOUT_MS }, ({ files, folder, outside }) => {
    const root = join(tempProjects.create({ files }), folder)

    expect({
      facts: projectFactsOf(root).tsFilesOutsideEveryTsconfig,
      projectService: tsFilesTheProjectServiceFindsNoProjectFor(root),
    }).toStrictEqual({ facts: outside, projectService: outside })
  })
})

describe("projectFactsOf's reading of React, which eslint-plugin-react's detect resolves itself", () => {
  it.each([
    { where: 'react resolves from tsconfigRootDir', files: buildInstalledPackageExportingItsEntryAlone(REACT), reactIsInstalled: true },
    { where: 'none resolves', files: {}, reactIsInstalled: false },
  ])('reads it as installed or not where $where', ({ files, reactIsInstalled }) => {
    expect(projectFactsOf(tempProjects.create({ files })).reactIsInstalled).toBe(reactIsInstalled)
  })
})
