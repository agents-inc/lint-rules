import type { Linter } from 'eslint'
import { teamBlockSourceOf, teamEslintModuleOfBlockSourcesText } from '../factories/consumer-project-factories.ts'
import { buildPublishedPackageJson, fileInPackage, filesUnderPackage, packageDirOf } from '../factories/monorepo-package-factories.ts'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import { buildBundlerTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// A team block setting a setting ours yields to has set it whatever the value, false and null included, so ours
// stays out. The plugins pass over such a value (import-x 4.17.1 reads import-x/resolve instead; eslint-plugin-n
// 18.4.1 tries its default), so ours left in would be read in its place.
// Each package's a.ts imports `./b`: neither plugin's fallback tries .ts; the team's import-x/resolve does.

/** Read by import-x where no resolver holds anything. */
export const TEAMS_NODE_RESOLVER_OPTIONS = { extensions: ['.ts', '.js'] }

const PACKAGES = {
  teamSetsNone: 'team-sets-none',
  teamSetsResolverFalse: 'team-sets-resolver-false',
  teamSetsNodeListNull: 'team-sets-node-list-null',
} as const

const IMPORTER = 'src/a.ts'

const IMPORTS_B = `import { b } from './b'

export const all = [b]
`

function filesOfPackage(packageName: string): Array<[string, string]> {
  return filesUnderPackage(packageName, {
    'package.json': jsonFileText(buildPublishedPackageJson(packageName)),
    'tsconfig.json': jsonFileText(buildBundlerTsconfig()),
    'src/b.ts': 'export const b = 1\n',
    [IMPORTER]: IMPORTS_B,
  })
}

export const falseOrNullSettingsPackageFiles: ProjectFiles = Object.fromEntries(Object.values(PACKAGES).flatMap(filesOfPackage))

function importerIn(packageName: string): string {
  return fileInPackage(packageName, IMPORTER)
}

export const IMPORTER_IN = {
  teamSetsNone: importerIn(PACKAGES.teamSetsNone),
  teamSetsResolverFalse: importerIn(PACKAGES.teamSetsResolverFalse),
  teamSetsNodeListNull: importerIn(PACKAGES.teamSetsNodeListNull),
}

function filesOf(packageName: string): string[] {
  return [`${packageDirOf(packageName)}/**`]
}

export const TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS: readonly Linter.Config[] = [
  {
    name: 'team/resolver-false',
    files: filesOf(PACKAGES.teamSetsResolverFalse),
    settings: { 'import-x/resolver': false, 'import-x/resolve': TEAMS_NODE_RESOLVER_OPTIONS },
  },
  { name: 'team/node-list-null', files: filesOf(PACKAGES.teamSetsNodeListNull), settings: { node: { tryExtensions: null } } },
]

export const NO_UNRESOLVED: RuleByItsNames = { rule: 'import-x/no-unresolved', names: ['import-x/no-unresolved'] }

export const NO_MISSING_IMPORT: RuleByItsNames = { rule: 'n/no-missing-import', names: ['n/no-missing-import'] }

/** The team registers import-x and eslint-plugin-n itself, as its config run alone needs. */
export const TEAMS_FALSE_OR_NULL_SETTINGS_MODULE_TEXT = teamEslintModuleOfBlockSourcesText(
  ["import importX from 'eslint-plugin-import-x'", "import n from 'eslint-plugin-n'"],
  [
    `{ name: 'team/rules', files: ['**/*.ts'], plugins: { 'import-x': importX, n }, rules: { '${NO_UNRESOLVED.rule}': 'error', '${NO_MISSING_IMPORT.rule}': 'error' } }`,
    ...TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS.map(teamBlockSourceOf),
  ],
)

/** `./b` unresolved by import-x but where the team's import-x/resolve tries .ts; missing to eslint-plugin-n everywhere. */
export const OWED_BY_THE_TEAMS_CONFIG_ALONE = {
  [IMPORTER_IN.teamSetsNone]: {
    [NO_UNRESOLVED.rule]: [`${IMPORTER_IN.teamSetsNone}:1 ${NO_UNRESOLVED.rule}`],
    [NO_MISSING_IMPORT.rule]: [`${IMPORTER_IN.teamSetsNone}:1 ${NO_MISSING_IMPORT.rule}`],
  },
  [IMPORTER_IN.teamSetsResolverFalse]: {
    [NO_UNRESOLVED.rule]: [],
    [NO_MISSING_IMPORT.rule]: [`${IMPORTER_IN.teamSetsResolverFalse}:1 ${NO_MISSING_IMPORT.rule}`],
  },
  [IMPORTER_IN.teamSetsNodeListNull]: {
    [NO_UNRESOLVED.rule]: [`${IMPORTER_IN.teamSetsNodeListNull}:1 ${NO_UNRESOLVED.rule}`],
    [NO_MISSING_IMPORT.rule]: [`${IMPORTER_IN.teamSetsNodeListNull}:1 ${NO_MISSING_IMPORT.rule}`],
  },
}

export const IMPORTERS_WHERE_THE_TEAM_SETS_NO_N_SETTING = [IMPORTER_IN.teamSetsNone, IMPORTER_IN.teamSetsResolverFalse]

/** Nothing: our list, in force there, tries .ts. */
export const OWED_MERGED_WHERE_THE_TEAM_SETS_NO_N_SETTING = {
  [IMPORTER_IN.teamSetsNone]: { [NO_MISSING_IMPORT.rule]: [] },
  [IMPORTER_IN.teamSetsResolverFalse]: { [NO_MISSING_IMPORT.rule]: [] },
}
