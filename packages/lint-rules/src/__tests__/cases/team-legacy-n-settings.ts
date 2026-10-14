import type { Linter } from 'eslint'
import { teamBlockSourceOf, teamEslintModuleOfBlockSourcesText } from '../factories/consumer-project-factories.ts'
import { buildTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// eslint-plugin-n 18.4.1 reads typescriptExtensionMap and tsconfigPath from settings.n wherever it
// is set at all, else from the older settings.node, as one object
// (lib/util/get-typescript-extension-map.js), so any settings.n of ours hid a team's settings.node
// there, though the plugin reads every other setting key by key (fix round 5's review). Our
// settings.n stays out of every file where a team block sets, under settings.node, a key we set
// under settings.n, tryExtensions, or one of those two (decisions.md, 2026-10-14 "fix round 5
// review"; O8). Where a team block sets another key of settings.node alone, ours stays.
//
// Eight publishable packages of a monorepo, each a TS project compiling JSX as React's runtime does
// (`jsx: react-jsx`), whose a.ts imports `./Comp.jsx` beside Comp.tsx. Only where the plugin reads
// typescriptExtensionMap 'preserve', or the jsx of a tsconfig that preserves it, does it map
// .jsx to .tsx; else it reads the package's own tsconfig.json, and the team's n/no-missing-import
// reports the import. The team sets, in each package's files alone: nothing; settings.node's list;
// its list and typescriptExtensionMap; its typescriptExtensionMap; its tsconfigPath; its version;
// its version and typescriptExtensionMap; and settings.n's typescriptExtensionMap, which ESLint
// merges into ours key by key (measured, ESLint 10.12).

/** The typescriptExtensionMap that maps a TS file's import of .jsx to the .tsx file. */
export const PRESERVE = 'preserve'

const TEAMS_TRY_EXTENSIONS = ['.js', '.ts']
const NODE_VERSION = '>=22'

/** Each package's name, by the settings the team's config gives its files. */
const PACKAGES = {
  teamSetsNone: 'team-sets-none',
  teamSetsLegacyList: 'team-sets-node-list',
  teamSetsLegacyListAndMap: 'team-sets-node-list-and-map',
  teamSetsLegacyMap: 'team-sets-node-map',
  teamSetsLegacyTsconfigPath: 'team-sets-node-tsconfig-path',
  teamSetsLegacyVersion: 'team-sets-node-version',
  teamSetsLegacyVersionAndMap: 'team-sets-node-version-and-map',
  teamSetsNMap: 'team-sets-n-map',
} as const

const PACKAGES_DIR = 'packages'
const IMPORTER = 'src/a.ts'
const PRESERVING_TSCONFIG = 'tsconfig.preserve.json'

const COMPILER_OPTIONS = { target: 'ES2022', module: 'esnext', moduleResolution: 'bundler', strict: true, noEmit: true, skipLibCheck: true }

const IMPORTS_THE_JSX_NAME = `import Comp from './Comp.jsx'

export const all = [Comp]
`

function packageDirOf(packageName: string): string {
  return `${PACKAGES_DIR}/${packageName}`
}

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** The tsconfig the team's tsconfigPath names, by its path from the project's root, which ESLint runs from: eslint-plugin-n resolves it against the process's folder (lib/util/get-tsconfig.js). */
export const PRESERVING_TSCONFIG_PATH = `${packageDirOf(PACKAGES.teamSetsLegacyTsconfigPath)}/${PRESERVING_TSCONFIG}`

/** The package's files, by their paths in the project: its package.json, its tsconfig.json, a tsconfig preserving JSX, Comp.tsx and a.ts. */
function filesOfPackage(packageName: string): [string, string][] {
  const packageDir = packageDirOf(packageName)
  const manifest = { name: `@repo/${packageName}`, version: '0.0.0', files: ['src'] }
  return Object.entries({
    [`${packageDir}/package.json`]: jsonText(manifest),
    [`${packageDir}/tsconfig.json`]: jsonText(buildTsconfig({ compilerOptions: { ...COMPILER_OPTIONS, jsx: 'react-jsx' }, include: ['src'] })),
    [`${packageDir}/${PRESERVING_TSCONFIG}`]: jsonText(buildTsconfig({ compilerOptions: { ...COMPILER_OPTIONS, jsx: PRESERVE }, include: ['src'] })),
    [`${packageDir}/src/Comp.tsx`]: 'const Comp = 1\nexport default Comp\n',
    [`${packageDir}/${IMPORTER}`]: IMPORTS_THE_JSX_NAME,
  })
}

/** The eight packages' files, under packages/ of the project's root. */
export const legacyNSettingsPackageFiles: ProjectFiles = Object.fromEntries(Object.values(PACKAGES).flatMap(filesOfPackage))

function importerIn(packageName: string): string {
  return `${packageDirOf(packageName)}/${IMPORTER}`
}

/** The module importing `./Comp.jsx` in each package, by its path in the project. */
export const IMPORTER_IN = {
  teamSetsNone: importerIn(PACKAGES.teamSetsNone),
  teamSetsLegacyList: importerIn(PACKAGES.teamSetsLegacyList),
  teamSetsLegacyListAndMap: importerIn(PACKAGES.teamSetsLegacyListAndMap),
  teamSetsLegacyMap: importerIn(PACKAGES.teamSetsLegacyMap),
  teamSetsLegacyTsconfigPath: importerIn(PACKAGES.teamSetsLegacyTsconfigPath),
  teamSetsLegacyVersion: importerIn(PACKAGES.teamSetsLegacyVersion),
  teamSetsLegacyVersionAndMap: importerIn(PACKAGES.teamSetsLegacyVersionAndMap),
  teamSetsNMap: importerIn(PACKAGES.teamSetsNMap),
}

/**
 * The importers where the team sets settings.node's list, the one key ours sets under settings.n,
 * alone or beside typescriptExtensionMap; and beside them, where it sets nothing or settings.node's
 * version alone.
 */
export const IMPORTERS_BESIDE_THE_TEAMS_LIST = [
  IMPORTER_IN.teamSetsNone,
  IMPORTER_IN.teamSetsLegacyList,
  IMPORTER_IN.teamSetsLegacyListAndMap,
  IMPORTER_IN.teamSetsLegacyVersion,
]

/**
 * The importers where the team sets typescriptExtensionMap or tsconfigPath, which ours does not set,
 * under settings.node without the list, alone or beside its version, or under settings.n; and beside
 * them, where it sets settings.node's version alone.
 */
export const IMPORTERS_BESIDE_THE_TEAMS_OTHER_KEYS = [
  IMPORTER_IN.teamSetsLegacyMap,
  IMPORTER_IN.teamSetsLegacyTsconfigPath,
  IMPORTER_IN.teamSetsLegacyVersion,
  IMPORTER_IN.teamSetsLegacyVersionAndMap,
  IMPORTER_IN.teamSetsNMap,
]

function filesOf(packageName: string): string[] {
  return [`${packageDirOf(packageName)}/**`]
}

/** The team's blocks giving each package's files their settings: in its own block each, as a team's config would. */
export const TEAMS_N_SETTINGS_BLOCKS: readonly Linter.Config[] = [
  { name: 'team/node-list', files: filesOf(PACKAGES.teamSetsLegacyList), settings: { node: { tryExtensions: TEAMS_TRY_EXTENSIONS } } },
  {
    name: 'team/node-list-and-map',
    files: filesOf(PACKAGES.teamSetsLegacyListAndMap),
    settings: { node: { tryExtensions: TEAMS_TRY_EXTENSIONS, typescriptExtensionMap: PRESERVE } },
  },
  { name: 'team/node-map', files: filesOf(PACKAGES.teamSetsLegacyMap), settings: { node: { typescriptExtensionMap: PRESERVE } } },
  { name: 'team/node-tsconfig-path', files: filesOf(PACKAGES.teamSetsLegacyTsconfigPath), settings: { node: { tsconfigPath: PRESERVING_TSCONFIG_PATH } } },
  { name: 'team/node-version', files: filesOf(PACKAGES.teamSetsLegacyVersion), settings: { node: { version: NODE_VERSION } } },
  {
    name: 'team/node-version-and-map',
    files: filesOf(PACKAGES.teamSetsLegacyVersionAndMap),
    settings: { node: { version: NODE_VERSION, typescriptExtensionMap: PRESERVE } },
  },
  { name: 'team/n-map', files: filesOf(PACKAGES.teamSetsNMap), settings: { n: { typescriptExtensionMap: PRESERVE } } },
]

export const NO_MISSING_IMPORT: RuleByItsNames = { rule: 'n/no-missing-import', names: ['n/no-missing-import'] }

/**
 * The team's ESLint config module: eslint-plugin-n registered by the team itself, as a config run
 * alone needs it, its n/no-missing-import on in every TS file, and the settings blocks.
 */
export const TEAMS_N_SETTINGS_MODULE_TEXT = teamEslintModuleOfBlockSourcesText(
  ["import n from 'eslint-plugin-n'"],
  [
    `{ name: 'team/n', files: ['**/*.ts'], plugins: { n }, rules: { '${NO_MISSING_IMPORT.rule}': 'error' } }`,
    ...TEAMS_N_SETTINGS_BLOCKS.map(teamBlockSourceOf),
  ],
)

/**
 * What the team's n/no-missing-import gives in each package with its config alone: the import of
 * `./Comp.jsx` where the plugin reads the package's tsconfig.json, and nothing where it reads the
 * team's typescriptExtensionMap or the tsconfig its tsconfigPath names.
 */
export const OWED_BY_THE_TEAMS_N_SETTINGS = {
  [IMPORTER_IN.teamSetsNone]: { 'n/no-missing-import': [`${IMPORTER_IN.teamSetsNone}:1 n/no-missing-import`] },
  [IMPORTER_IN.teamSetsLegacyList]: { 'n/no-missing-import': [`${IMPORTER_IN.teamSetsLegacyList}:1 n/no-missing-import`] },
  [IMPORTER_IN.teamSetsLegacyListAndMap]: { 'n/no-missing-import': [] },
  [IMPORTER_IN.teamSetsLegacyMap]: { 'n/no-missing-import': [] },
  [IMPORTER_IN.teamSetsLegacyTsconfigPath]: { 'n/no-missing-import': [] },
  [IMPORTER_IN.teamSetsLegacyVersion]: { 'n/no-missing-import': [`${IMPORTER_IN.teamSetsLegacyVersion}:1 n/no-missing-import`] },
  [IMPORTER_IN.teamSetsLegacyVersionAndMap]: { 'n/no-missing-import': [] },
  [IMPORTER_IN.teamSetsNMap]: { 'n/no-missing-import': [] },
}
