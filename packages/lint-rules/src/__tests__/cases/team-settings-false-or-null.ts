import type { Linter } from 'eslint'
import { teamBlockSourceOf, teamEslintModuleOfBlockSourcesText } from '../factories/consumer-project-factories.ts'
import { buildPublishedPackageJson, fileInPackage, filesUnderPackage, packageDirOf } from '../factories/monorepo-package-factories.ts'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import { buildBundlerTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// A team block that sets a setting ours yields to has set it whatever the value, false and null
// included, so ours stays out of its files (O8: the team's non-rule keys win where set; decisions.md,
// 2026-10-14 "fix round 5 review"). The plugins themselves pass over such a value: import-x 4.17.1
// takes import-x/resolver only where it holds anything, and reads import-x/resolve in its place
// (lib/utils/resolve.js, fullResolve); eslint-plugin-n 18.4.1 takes a tryExtensions list only where
// it is an array, and tries its default in its place (lib/util/get-try-extensions.js). Ours left in
// those files would be read instead: our import-x/resolver-next before the team's import-x/resolve,
// our settings.n list before the plugin's default.
//
// Three publishable packages of a monorepo, each a TS project whose a.ts imports `./b` beside b.ts.
// Neither import-x's fallback nor eslint-plugin-n's default tries .ts, and the team's import-x/resolve
// does. The team sets, in each package's files alone: nothing; import-x/resolver to false beside
// import-x/resolve; and settings.node's tryExtensions to null.

/** The team's options for import-x's node resolver, which import-x reads where no resolver holds anything: .ts first. */
export const TEAMS_NODE_RESOLVER_OPTIONS = { extensions: ['.ts', '.js'] }

/** Each package's name, by the settings the team's config gives its files. */
const PACKAGES = {
  teamSetsNone: 'team-sets-none',
  teamSetsResolverFalse: 'team-sets-resolver-false',
  teamSetsNodeListNull: 'team-sets-node-list-null',
} as const

const IMPORTER = 'src/a.ts'

const IMPORTS_B = `import { b } from './b'

export const all = [b]
`

/** The package's files, by their paths in the project: its package.json, its tsconfig.json, b.ts and a.ts. */
function filesOfPackage(packageName: string): [string, string][] {
  return filesUnderPackage(packageName, {
    'package.json': jsonFileText(buildPublishedPackageJson(packageName)),
    'tsconfig.json': jsonFileText(buildBundlerTsconfig()),
    'src/b.ts': 'export const b = 1\n',
    [IMPORTER]: IMPORTS_B,
  })
}

/** The three packages' files, under packages/ of the project's root. */
export const falseOrNullSettingsPackageFiles: ProjectFiles = Object.fromEntries(Object.values(PACKAGES).flatMap(filesOfPackage))

function importerIn(packageName: string): string {
  return fileInPackage(packageName, IMPORTER)
}

/** The module importing `./b` in each package, by its path in the project. */
export const IMPORTER_IN = {
  teamSetsNone: importerIn(PACKAGES.teamSetsNone),
  teamSetsResolverFalse: importerIn(PACKAGES.teamSetsResolverFalse),
  teamSetsNodeListNull: importerIn(PACKAGES.teamSetsNodeListNull),
}

function filesOf(packageName: string): string[] {
  return [`${packageDirOf(packageName)}/**`]
}

/** The team's blocks giving each package's files their settings: in its own block each, as a team's config would. */
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

/**
 * The team's ESLint config module: import-x and eslint-plugin-n registered by the team itself, as a
 * config run alone needs them, its import-x/no-unresolved and n/no-missing-import on in every TS
 * file, and the settings blocks.
 */
export const TEAMS_FALSE_OR_NULL_SETTINGS_MODULE_TEXT = teamEslintModuleOfBlockSourcesText(
  ["import importX from 'eslint-plugin-import-x'", "import n from 'eslint-plugin-n'"],
  [
    `{ name: 'team/rules', files: ['**/*.ts'], plugins: { 'import-x': importX, n }, rules: { '${NO_UNRESOLVED.rule}': 'error', '${NO_MISSING_IMPORT.rule}': 'error' } }`,
    ...TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS.map(teamBlockSourceOf),
  ],
)

/**
 * What the team's two rules give in each package with its config alone: `./b` unresolved by
 * import-x but where the team's import-x/resolve tries .ts, and missing to eslint-plugin-n
 * everywhere, as its default tries no .ts.
 */
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

/** The importers where the team sets no setting of eslint-plugin-n's: nothing, and import-x's alone. */
export const IMPORTERS_WHERE_THE_TEAM_SETS_NO_N_SETTING = [IMPORTER_IN.teamSetsNone, IMPORTER_IN.teamSetsResolverFalse]

/** What the team's n/no-missing-import gives, merged, where the team sets no setting of eslint-plugin-n's: nothing, as our list, in force there, tries .ts. */
export const OWED_MERGED_WHERE_THE_TEAM_SETS_NO_N_SETTING = {
  [IMPORTER_IN.teamSetsNone]: { [NO_MISSING_IMPORT.rule]: [] },
  [IMPORTER_IN.teamSetsResolverFalse]: { [NO_MISSING_IMPORT.rule]: [] },
}
