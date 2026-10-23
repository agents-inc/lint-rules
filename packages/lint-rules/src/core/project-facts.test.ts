import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildTsconfig } from '../__tests__/factories/tsconfig-factories.ts'
import { configFileText, esModuleRequiring, javaScriptRequiring, sourceImporting, standaloneSources } from '../__tests__/factories/tsconfig-layout-factories.ts'
import { PARALLEL_LOAD_TIMEOUT_MS } from '../__tests__/parallel-load.ts'
import { tsFilesTheProjectServiceFindsNoProjectFor, tsFilesUnder } from '../__tests__/project-service-verdicts.ts'
import { type ProjectFiles, setUpTempProjects, writeFileCreatingItsDir } from '../__tests__/temp-projects.ts'
import { projectFactsOf } from './project-facts.ts'

// agents-inc.lint.mts, which no tsconfig lists, is typed where a listed file imports it by path. Each case
// compares the facts with the real project service.

const LINT_RULES_FILE = 'agents-inc.lint.mts'
const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
const ESLINT_CONFIG_FILE = 'eslint.config.mjs'
const BY_ITS_PATH = `./${LINT_RULES_FILE}`
const STRAY_FILE = 'scripts/seed.ts'
const STRAY_FILE_MADE_AFTER_THE_EDIT = 'scripts/seed2.ts'
const SOURCE_FILE = 'src/a.ts'
const HELPER_FILE = 'helper.ts'
// A folder whose name ends in .js, as a project named after a library may be.
const FOLDER_NAMED_AS_A_JS_FILE = 'chart.js'

const tempProjects = setUpTempProjects()

/** The tsconfig lists only the importer. */
function projectWhoseImporterIs(importer: string, source: string, compilerOptions = buildTsconfig().compilerOptions): ProjectFiles {
  return { 'tsconfig.json': configFileText({ files: [importer], compilerOptions }), [importer]: source, ...standaloneSources([LINT_RULES_FILE]) }
}

/** The TS files under the root the facts read as outside every tsconfig, sorted. */
function outsideEveryTsconfigUnder(root: string): string[] {
  const { isOutsideEveryTsconfig } = projectFactsOf(root)
  return tsFilesUnder(root).filter((file) => isOutsideEveryTsconfig(join(root, file)))
}

function underFolder(folder: string, files: ProjectFiles): ProjectFiles {
  return Object.fromEntries(Object.entries(files).map(([path, text]) => [`${folder}/${path}`, text]))
}

function writeEach(root: string, files: ProjectFiles): void {
  for (const [file, text] of Object.entries(files)) {
    writeFileCreatingItsDir(join(root, file), text)
  }
}

describe("projectFactsOf's test of a TS file outside every tsconfig, beside the project service's, for agents-inc.lint.mts", () => {
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
      facts: outsideEveryTsconfigUnder(root),
      projectService: tsFilesTheProjectServiceFindsNoProjectFor(root),
    }).toStrictEqual({ facts: outside, projectService: outside })
  })
})

// The editor merges once, as it loads its ESLint config, and asks of each file as it lints it.
describe("projectFactsOf's test of a TS file outside every tsconfig, given files made after the facts", () => {
  it('reads agents-inc.lint.mts, imported by its path from a listed file, as typed through the importer, and a stray TS file as outside', () => {
    const root = tempProjects.create({ files: { 'tsconfig.json': configFileText({ files: [OXLINT_CONFIG_FILE] }), [OXLINT_CONFIG_FILE]: sourceImporting(BY_ITS_PATH) } })
    const { isOutsideEveryTsconfig } = projectFactsOf(root)
    const madeLater = Object.entries(standaloneSources([LINT_RULES_FILE, STRAY_FILE]))
    for (const [file, text] of madeLater) {
      writeFileCreatingItsDir(join(root, file), text)
    }

    expect({ lintRules: isOutsideEveryTsconfig(join(root, LINT_RULES_FILE)), stray: isOutsideEveryTsconfig(join(root, STRAY_FILE)) }).toStrictEqual({
      lintRules: false,
      stray: true,
    })
  })

  // Pinned limit: an answer is kept by the file's path, as ESLint keeps each file's config, so a tsconfig edited to take
  // in a file already asked of reaches it on a restart; a file made since and first asked of after the edit gets it.
  it('keeps a stray TS file outside as first asked, though a tsconfig edited since takes it in, and reads one made after the edit as inside', () => {
    const root = tempProjects.create({ files: { 'tsconfig.json': configFileText({ include: [dirname(SOURCE_FILE)] }), ...standaloneSources([SOURCE_FILE]) } })
    const { isOutsideEveryTsconfig } = projectFactsOf(root)
    writeEach(root, standaloneSources([STRAY_FILE]))
    const isStrayBeforeTheEdit = isOutsideEveryTsconfig(join(root, STRAY_FILE))
    writeEach(root, {
      'tsconfig.json': configFileText({ include: [dirname(SOURCE_FILE), dirname(STRAY_FILE)] }),
      ...standaloneSources([STRAY_FILE_MADE_AFTER_THE_EDIT]),
    })

    expect({
      strayBeforeTheEdit: isStrayBeforeTheEdit,
      strayAfterTheEdit: isOutsideEveryTsconfig(join(root, STRAY_FILE)),
      madeAfterTheEdit: isOutsideEveryTsconfig(join(root, STRAY_FILE_MADE_AFTER_THE_EDIT)),
    }).toStrictEqual({ strayBeforeTheEdit: true, strayAfterTheEdit: true, madeAfterTheEdit: false })
  })
})

// The project service finds such a file through the importer's program (D-h); only a consumer file is read so.
describe("projectFactsOf's test, for a TS file a listed consumer file imports by its path that is no consumer file", () => {
  it('reads it as outside every tsconfig, beside agents-inc.lint.mts, which nothing imports', () => {
    const root = tempProjects.create({
      files: { ...projectWhoseImporterIs(OXLINT_CONFIG_FILE, sourceImporting(`./${HELPER_FILE}`)), ...standaloneSources([HELPER_FILE]) },
    })

    expect(outsideEveryTsconfigUnder(root)).toStrictEqual([LINT_RULES_FILE, HELPER_FILE])
  })
})
