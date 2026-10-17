import type { Linter } from 'eslint'
import { createNodeResolver } from 'eslint-plugin-import-x'
import { teamBlockSourceOf, teamEslintModuleOfBlockSourcesText } from '../factories/consumer-project-factories.ts'
import { buildPublishedPackageJson, fileInPackage, filesUnderPackage, packageDirOf } from '../factories/monorepo-package-factories.ts'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import { buildBundlerTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// import-x 4.17.1 uses settings['import-x/resolver-next'] wherever it holds anything, and a legacy resolver key
// only where it holds nothing (resolve.js, fullResolve), so ours would beat a team's import-x/resolver. Ours stays
// out where a team block sets import-x/resolver, -resolver-next, -resolver-legacy or -resolve.
// Each package's a.ts imports `./b`: our TypeScript resolver resolves it; import-x's own fallback tries no .ts.

const TEAMS_EXTENSIONS = ['.ts', '.js']

export const TEAMS_LEGACY_RESOLVERS = { node: { extensions: TEAMS_EXTENSIONS } }

export const TEAMS_NODE_RESOLVER_OPTIONS = { extensions: TEAMS_EXTENSIONS }

/** The name the team gives its own resolver-next resolver, which ours does not carry. */
export const TEAMS_RESOLVER_NAME = 'team-resolver'

/** The name of the resolver ours is: eslint-import-resolver-typescript 4.4.5's (lib/constants.js, IMPORT_RESOLVER_NAME). */
export const OUR_RESOLVER_NAME = 'eslint-import-resolver-typescript'

const TEAMS_CORE_MODULES = ['virtual:team-module']

const PACKAGES = {
  teamSetsNone: 'team-sets-none',
  teamSetsResolver: 'team-sets-resolver',
  teamSetsResolverNext: 'team-sets-resolver-next',
  teamSetsCoreModules: 'team-sets-core-modules',
  teamSetsResolverAndCoreModules: 'team-sets-resolver-and-core-modules',
  teamSetsResolverLegacy: 'team-sets-resolver-legacy',
  teamSetsResolve: 'team-sets-resolve',
} as const

const IMPORTER = 'src/a.ts'
const RESOLVER_NEXT_BLOCK_NAME = 'team/resolver-next'

const IMPORTS_B = `import { b } from './b'

export const all = [b]
`

function filesOfPackage(packageName: string): [string, string][] {
  return filesUnderPackage(packageName, {
    'package.json': jsonFileText(buildPublishedPackageJson(packageName)),
    'tsconfig.json': jsonFileText(buildBundlerTsconfig()),
    'src/b.ts': 'export const b = 1\n',
    [IMPORTER]: IMPORTS_B,
  })
}

export const importXResolverPackageFiles: ProjectFiles = Object.fromEntries(Object.values(PACKAGES).flatMap(filesOfPackage))

function importerIn(packageName: string): string {
  return fileInPackage(packageName, IMPORTER)
}

export const IMPORTER_IN = {
  teamSetsNone: importerIn(PACKAGES.teamSetsNone),
  teamSetsResolver: importerIn(PACKAGES.teamSetsResolver),
  teamSetsResolverNext: importerIn(PACKAGES.teamSetsResolverNext),
  teamSetsCoreModules: importerIn(PACKAGES.teamSetsCoreModules),
  teamSetsResolverAndCoreModules: importerIn(PACKAGES.teamSetsResolverAndCoreModules),
  teamSetsResolverLegacy: importerIn(PACKAGES.teamSetsResolverLegacy),
  teamSetsResolve: importerIn(PACKAGES.teamSetsResolve),
}

function filesOf(packageName: string): string[] {
  return [`${packageDirOf(packageName)}/**`]
}

/** All but resolver-next's, which holds a resolver, not plain data. */
const TEAMS_DATA_BLOCKS: readonly Linter.Config[] = [
  { name: 'team/resolver', files: filesOf(PACKAGES.teamSetsResolver), settings: { 'import-x/resolver': TEAMS_LEGACY_RESOLVERS } },
  { name: 'team/core-modules', files: filesOf(PACKAGES.teamSetsCoreModules), settings: { 'import-x/core-modules': TEAMS_CORE_MODULES } },
  {
    name: 'team/resolver-and-core-modules',
    files: filesOf(PACKAGES.teamSetsResolverAndCoreModules),
    settings: { 'import-x/core-modules': TEAMS_CORE_MODULES, 'import-x/resolver': TEAMS_LEGACY_RESOLVERS },
  },
  { name: 'team/resolver-legacy', files: filesOf(PACKAGES.teamSetsResolverLegacy), settings: { 'import-x/resolver-legacy': TEAMS_LEGACY_RESOLVERS } },
  { name: 'team/resolve', files: filesOf(PACKAGES.teamSetsResolve), settings: { 'import-x/resolve': TEAMS_NODE_RESOLVER_OPTIONS } },
]

function teamsResolverNext(): object {
  return { ...createNodeResolver({ extensions: TEAMS_EXTENSIONS }), name: TEAMS_RESOLVER_NAME }
}

export const TEAMS_IMPORT_X_SETTINGS_BLOCKS: readonly Linter.Config[] = [
  ...TEAMS_DATA_BLOCKS,
  { name: RESOLVER_NEXT_BLOCK_NAME, files: filesOf(PACKAGES.teamSetsResolverNext), settings: { 'import-x/resolver-next': [teamsResolverNext()] } },
]

export const NO_UNRESOLVED: RuleByItsNames = { rule: 'import-x/no-unresolved', names: ['import-x/no-unresolved'] }

/** The team registers import-x itself, as its config run alone needs. */
export const TEAMS_IMPORT_X_MODULE_TEXT = teamEslintModuleOfBlockSourcesText(
  ["import importX, { createNodeResolver } from 'eslint-plugin-import-x'"],
  [
    `{ name: 'team/import-x', files: ['**/*.ts'], plugins: { 'import-x': importX }, rules: { '${NO_UNRESOLVED.rule}': 'error' } }`,
    ...TEAMS_DATA_BLOCKS.map(teamBlockSourceOf),
    `{ name: '${RESOLVER_NEXT_BLOCK_NAME}', files: ${JSON.stringify(filesOf(PACKAGES.teamSetsResolverNext))}, settings: { 'import-x/resolver-next': [{ ...createNodeResolver({ extensions: ${JSON.stringify(TEAMS_EXTENSIONS)} }), name: '${TEAMS_RESOLVER_NAME}' }] } }`,
  ],
)

/** Merged: as the team's config alone where it sets a resolver key; `./b` resolved where it sets none. */
export const OWED_MERGED_BESIDE_OUR_TYPESCRIPT_RESOLVER = {
  [IMPORTER_IN.teamSetsNone]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolver]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolverNext]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsCoreModules]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolverAndCoreModules]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolverLegacy]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolve]: { 'import-x/no-unresolved': [] },
}

/** `./b` is unresolved where no resolver of the team's tries .ts. */
export const OWED_BY_THE_TEAMS_RESOLVERS = {
  [IMPORTER_IN.teamSetsNone]: { 'import-x/no-unresolved': [`${IMPORTER_IN.teamSetsNone}:1 import-x/no-unresolved`] },
  [IMPORTER_IN.teamSetsResolver]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolverNext]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsCoreModules]: { 'import-x/no-unresolved': [`${IMPORTER_IN.teamSetsCoreModules}:1 import-x/no-unresolved`] },
  [IMPORTER_IN.teamSetsResolverAndCoreModules]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolverLegacy]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolve]: { 'import-x/no-unresolved': [] },
}
