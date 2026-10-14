import type { Linter } from 'eslint'
import { createNodeResolver } from 'eslint-plugin-import-x'
import { teamBlockSourceOf, teamEslintModuleOfBlockSourcesText } from '../factories/consumer-project-factories.ts'
import { buildTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// import-x 4.17.1 resolves an import with settings['import-x/resolver-next'] wherever it holds
// anything, and reads a legacy resolver key only where it holds nothing (lib/utils/resolve.js,
// fullResolve), so our resolver-next beat a team's import-x/resolver in every file (fix round 5's
// review). Ours stays out of every file where a team block sets import-x/resolver,
// import-x/resolver-next, import-x/resolver-legacy or import-x/resolve (decisions.md, 2026-10-14
// "fix round 5 review" and "fix round 6 closed"; O8), and stays where it sets another key of
// import-x's alone.
//
// Seven publishable packages of a monorepo, each a TS project whose a.ts imports `./b` beside b.ts.
// Our resolver tries import-x's default extensions, which hold no .ts (lib/node-resolver.js), as
// does import-x's own fallback where no resolver is set; the team's tries .ts first. The team sets, in
// each package's files alone: nothing; import-x/resolver; import-x/resolver-next; import-x/core-modules;
// import-x/core-modules beside import-x/resolver; import-x/resolver-legacy; and import-x/resolve, the
// options of import-x's node resolver where no resolver key holds one.

const TEAMS_EXTENSIONS = ['.ts', '.js']

/** The team's legacy resolver setting: import-x's node resolver, trying .ts first. */
export const TEAMS_LEGACY_RESOLVERS = { node: { extensions: TEAMS_EXTENSIONS } }

/** The team's options for import-x's own node resolver, trying .ts first. */
export const TEAMS_NODE_RESOLVER_OPTIONS = { extensions: TEAMS_EXTENSIONS }

/** The name the team gives its own resolver-next resolver, which ours does not carry. */
export const TEAMS_RESOLVER_NAME = 'team-resolver'

/** The name of the node resolver ours is (lib/node-resolver.js, createNodeResolver). */
export const OUR_RESOLVER_NAME = 'eslint-plugin-import-x:node'

const TEAMS_CORE_MODULES = ['virtual:team-module']

/** Each package's name, by the import-x settings the team's config gives its files. */
const PACKAGES = {
  teamSetsNone: 'team-sets-none',
  teamSetsResolver: 'team-sets-resolver',
  teamSetsResolverNext: 'team-sets-resolver-next',
  teamSetsCoreModules: 'team-sets-core-modules',
  teamSetsResolverAndCoreModules: 'team-sets-resolver-and-core-modules',
  teamSetsResolverLegacy: 'team-sets-resolver-legacy',
  teamSetsResolve: 'team-sets-resolve',
} as const

const PACKAGES_DIR = 'packages'
const IMPORTER = 'src/a.ts'
const RESOLVER_NEXT_BLOCK_NAME = 'team/resolver-next'

const IMPORTS_B = `import { b } from './b'

export const all = [b]
`

function packageDirOf(packageName: string): string {
  return `${PACKAGES_DIR}/${packageName}`
}

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** The package's files, by their paths in the project: its package.json, its tsconfig.json, b.ts and a.ts. */
function filesOfPackage(packageName: string): [string, string][] {
  const packageDir = packageDirOf(packageName)
  const compilerOptions = { target: 'ES2022', module: 'esnext', moduleResolution: 'bundler', strict: true, noEmit: true, skipLibCheck: true }
  return Object.entries({
    [`${packageDir}/package.json`]: jsonText({ name: `@repo/${packageName}`, version: '0.0.0', files: ['src'] }),
    [`${packageDir}/tsconfig.json`]: jsonText(buildTsconfig({ compilerOptions, include: ['src'] })),
    [`${packageDir}/src/b.ts`]: 'export const b = 1\n',
    [`${packageDir}/${IMPORTER}`]: IMPORTS_B,
  })
}

/** The five packages' files, under packages/ of the project's root. */
export const importXResolverPackageFiles: ProjectFiles = Object.fromEntries(Object.values(PACKAGES).flatMap(filesOfPackage))

function importerIn(packageName: string): string {
  return `${packageDirOf(packageName)}/${IMPORTER}`
}

/** The module importing `./b` in each package, by its path in the project. */
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

/** The team's blocks of plain data giving packages their import-x settings, in its own block each: all but resolver-next's, which holds a resolver. */
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

/** The team's own resolver-next resolver: import-x's node resolver trying .ts first, under the team's name. */
function teamsResolverNext(): object {
  return { ...createNodeResolver({ extensions: TEAMS_EXTENSIONS }), name: TEAMS_RESOLVER_NAME }
}

/** The team's blocks giving each package's files their import-x settings, its own resolver-next resolver among them. */
export const TEAMS_IMPORT_X_SETTINGS_BLOCKS: readonly Linter.Config[] = [
  ...TEAMS_DATA_BLOCKS,
  { name: RESOLVER_NEXT_BLOCK_NAME, files: filesOf(PACKAGES.teamSetsResolverNext), settings: { 'import-x/resolver-next': [teamsResolverNext()] } },
]

export const NO_UNRESOLVED: RuleByItsNames = { rule: 'import-x/no-unresolved', names: ['import-x/no-unresolved'] }

/**
 * The team's ESLint config module: import-x registered by the team itself, as a config run alone
 * needs it, its import-x/no-unresolved on in every TS file, and the settings blocks.
 */
export const TEAMS_IMPORT_X_MODULE_TEXT = teamEslintModuleOfBlockSourcesText(
  ["import importX, { createNodeResolver } from 'eslint-plugin-import-x'"],
  [
    `{ name: 'team/import-x', files: ['**/*.ts'], plugins: { 'import-x': importX }, rules: { '${NO_UNRESOLVED.rule}': 'error' } }`,
    ...TEAMS_DATA_BLOCKS.map(teamBlockSourceOf),
    `{ name: '${RESOLVER_NEXT_BLOCK_NAME}', files: ${JSON.stringify(filesOf(PACKAGES.teamSetsResolverNext))}, settings: { 'import-x/resolver-next': [{ ...createNodeResolver({ extensions: ${JSON.stringify(TEAMS_EXTENSIONS)} }), name: '${TEAMS_RESOLVER_NAME}' }] } }`,
  ],
)

/** What the team's import-x/no-unresolved gives in each package with its config alone: `./b` unresolved where no resolver of the team's tries .ts. */
export const OWED_BY_THE_TEAMS_RESOLVERS = {
  [IMPORTER_IN.teamSetsNone]: { 'import-x/no-unresolved': [`${IMPORTER_IN.teamSetsNone}:1 import-x/no-unresolved`] },
  [IMPORTER_IN.teamSetsResolver]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolverNext]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsCoreModules]: { 'import-x/no-unresolved': [`${IMPORTER_IN.teamSetsCoreModules}:1 import-x/no-unresolved`] },
  [IMPORTER_IN.teamSetsResolverAndCoreModules]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolverLegacy]: { 'import-x/no-unresolved': [] },
  [IMPORTER_IN.teamSetsResolve]: { 'import-x/no-unresolved': [] },
}
