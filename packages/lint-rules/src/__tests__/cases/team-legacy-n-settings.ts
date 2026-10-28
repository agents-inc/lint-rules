import type { Linter } from 'eslint'
import { teamBlockSourceOf, teamEslintModuleOfBlockSourcesText } from '../factories/consumer-project-factories.ts'
import { buildPublishedPackageJson, fileInPackage, filesUnderPackage, packageDirOf } from '../factories/monorepo-package-factories.ts'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import { buildBundlerTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// eslint-plugin-n 18.4.1 reads typescriptExtensionMap and tsconfigPath from settings.n if set at all, else from
// settings.node, as one object (get-typescript-extension-map.js), so our settings.n would hide a team's
// settings.node. Ours stays out where a team block sets, under settings.node, tryExtensions or one of those two.
// Each package imports `./Comp.jsx` beside Comp.tsx: the team's n/no-missing-import reports it unless the
// plugin reads typescriptExtensionMap 'preserve' or a JSX-preserving tsconfig.

/** Maps an import of .jsx to the .tsx file. */
export const PRESERVE = 'preserve'

const TEAMS_TRY_EXTENSIONS = ['.js', '.ts']
const NODE_VERSION = '>=22'

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

const IMPORTER = 'src/a.ts'
const PRESERVING_TSCONFIG = 'tsconfig.preserve.json'

const IMPORTS_THE_JSX_NAME = `import Comp from './Comp.jsx'

export const all = [Comp]
`

/** eslint-plugin-n resolves tsconfigPath against the process's folder, so this is relative to the project root. */
export const PRESERVING_TSCONFIG_PATH = fileInPackage(PACKAGES.teamSetsLegacyTsconfigPath, PRESERVING_TSCONFIG)

function filesOfPackage(packageName: string): Array<[string, string]> {
  return filesUnderPackage(packageName, {
    'package.json': jsonFileText(buildPublishedPackageJson(packageName)),
    'tsconfig.json': jsonFileText(buildBundlerTsconfig({ jsx: 'react-jsx' })),
    [PRESERVING_TSCONFIG]: jsonFileText(buildBundlerTsconfig({ jsx: PRESERVE })),
    'src/Comp.tsx': 'const Comp = 1\nexport default Comp\n',
    [IMPORTER]: IMPORTS_THE_JSX_NAME,
  })
}

export const legacyNSettingsPackageFiles: ProjectFiles = Object.fromEntries(Object.values(PACKAGES).flatMap(filesOfPackage))

function importerIn(packageName: string): string {
  return fileInPackage(packageName, IMPORTER)
}

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

/** Where the team sets settings.node's list, the one key ours sets; beside them, where it sets nothing or version alone. */
export const IMPORTERS_BESIDE_THE_TEAMS_LIST = [
  IMPORTER_IN.teamSetsNone,
  IMPORTER_IN.teamSetsLegacyList,
  IMPORTER_IN.teamSetsLegacyListAndMap,
  IMPORTER_IN.teamSetsLegacyVersion,
]

/** Where the team sets typescriptExtensionMap or tsconfigPath; beside them, where it sets version alone. */
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

/** The team registers eslint-plugin-n itself, as its config run alone needs. */
export const TEAMS_N_SETTINGS_MODULE_TEXT = teamEslintModuleOfBlockSourcesText(
  ["import n from 'eslint-plugin-n'"],
  [
    `{ name: 'team/n', files: ['**/*.ts'], plugins: { n }, rules: { '${NO_MISSING_IMPORT.rule}': 'error' } }`,
    ...TEAMS_N_SETTINGS_BLOCKS.map(teamBlockSourceOf),
  ],
)

/** The team's config alone reports the import wherever the plugin reads the package's own tsconfig.json. */
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
