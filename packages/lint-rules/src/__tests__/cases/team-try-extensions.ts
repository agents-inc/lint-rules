import type { Linter } from 'eslint'
import { buildPublishedPackageJson, fileInPackage, filesUnderPackage, packageDirOf } from '../factories/monorepo-package-factories.ts'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import { buildBundlerTsconfig } from '../factories/tsconfig-factories.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// Our `settings.n.tryExtensions` is ours only where the team's config sets neither
// `settings.n.tryExtensions` nor the older `settings.node.tryExtensions` (decisions.md, 2026-10-14
// "fix round 4 closed"; O8: the team's non-rule keys win where set). eslint-plugin-n 18.4.1 reads
// settings.n's list before settings.node's (lib/util/get-try-extensions.js), so ours, in a block
// before the team's, beat the team's legacy key (fix round 4's review); ESLint merges `settings`
// key by key, so a team's own settings.n list replaces ours (measured, ESLint 10.12).
//
// Five publishable packages of a monorepo, each importing `@/both` through its tsconfig's alias, where
// both.json is published and both.ts is not. Our list tries .ts before .json, as TypeScript and
// bundlers resolve, so the import names the unpublished both.ts; the team's own list tries .json
// first, so it names the published both.json. The team sets, in each package's files alone: nothing;
// the legacy key's list; settings.n's list; and in two more, a key of settings.node or settings.n
// that is not tryExtensions, beside which ours stays.

/** The team's own list: JSON before TS, so `@/both` resolves to the published both.json. */
export const TEAMS_TRY_EXTENSIONS = ['.js', '.json', '.ts']

const NODE_VERSION = '>=22'

/** Each package's name, by the settings the team's config gives its files. */
const TRY_EXTENSIONS_PACKAGES = {
  teamSetsNone: 'team-sets-none',
  teamSetsLegacyKey: 'team-sets-node',
  teamSetsNKey: 'team-sets-n',
  teamSetsLegacyKeysVersion: 'team-sets-node-version',
  teamSetsNKeysVersion: 'team-sets-n-version',
} as const

/** The module importing `@/both` in each package. */
const USES_BOTH_MODULE = 'src/uses-both.ts'

const TSCONFIG = buildBundlerTsconfig({ resolveJsonModule: true, paths: { '@/*': ['./src/*'] } })

const USES_BOTH = `import both from '@/both'

export const all = [both]
`

/** The package's files, by their paths in the project: its package.json, its tsconfig, both.json, both.ts and the module importing `@/both`. */
function filesOfPackage(packageName: string): [string, string][] {
  return filesUnderPackage(packageName, {
    'package.json': jsonFileText(buildPublishedPackageJson(packageName, ['src/both.json', USES_BOTH_MODULE])),
    'tsconfig.json': jsonFileText(TSCONFIG),
    'src/both.json': '{ "both": 1 }\n',
    'src/both.ts': 'const both = 1\nexport default both\n',
    [USES_BOTH_MODULE]: USES_BOTH,
  })
}

/** The five packages' files, under packages/ of the project's root. */
export const tryExtensionsPackageFiles: ProjectFiles = Object.fromEntries(Object.values(TRY_EXTENSIONS_PACKAGES).flatMap(filesOfPackage))

function usesBothIn(packageName: string): string {
  return fileInPackage(packageName, USES_BOTH_MODULE)
}

/** The module importing `@/both` in each package, by its path in the project. */
export const USES_BOTH_IN = {
  teamSetsNone: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsNone),
  teamSetsLegacyKey: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsLegacyKey),
  teamSetsNKey: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsNKey),
  teamSetsLegacyKeysVersion: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsLegacyKeysVersion),
  teamSetsNKeysVersion: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsNKeysVersion),
}

/** The team's blocks giving each package's files their settings: in its own block each, as a team's config would. */
export const TEAMS_SETTINGS_BLOCKS: readonly Linter.Config[] = [
  { name: 'team/legacy-try-extensions', files: [`${packageDirOf(TRY_EXTENSIONS_PACKAGES.teamSetsLegacyKey)}/**`], settings: { node: { tryExtensions: TEAMS_TRY_EXTENSIONS } } },
  { name: 'team/try-extensions', files: [`${packageDirOf(TRY_EXTENSIONS_PACKAGES.teamSetsNKey)}/**`], settings: { n: { tryExtensions: TEAMS_TRY_EXTENSIONS } } },
  { name: 'team/legacy-node-version', files: [`${packageDirOf(TRY_EXTENSIONS_PACKAGES.teamSetsLegacyKeysVersion)}/**`], settings: { node: { version: NODE_VERSION } } },
  { name: 'team/node-version', files: [`${packageDirOf(TRY_EXTENSIONS_PACKAGES.teamSetsNKeysVersion)}/**`], settings: { n: { version: NODE_VERSION } } },
]

/** The team's block turning its own n/no-unpublished-import on in every TS file, so its copy runs rather than ours. */
export const TEAMS_OWN_UNPUBLISHED_IMPORT_BLOCK: Linter.Config = { name: 'team/rules', files: ['**/*.ts'], rules: { 'n/no-unpublished-import': 'error' } }

/**
 * What n/no-unpublished-import owes in each package, whoever's copy of the rule runs: the import of
 * the unpublished both.ts where our list is in force, and nothing where the team's own is.
 */
export const OWED_BY_EACH_PACKAGES_SETTINGS = {
  [USES_BOTH_IN.teamSetsNone]: { 'n/no-unpublished-import': [`${USES_BOTH_IN.teamSetsNone}:1 n/no-unpublished-import`] },
  [USES_BOTH_IN.teamSetsLegacyKey]: { 'n/no-unpublished-import': [] },
  [USES_BOTH_IN.teamSetsNKey]: { 'n/no-unpublished-import': [] },
  [USES_BOTH_IN.teamSetsLegacyKeysVersion]: { 'n/no-unpublished-import': [`${USES_BOTH_IN.teamSetsLegacyKeysVersion}:1 n/no-unpublished-import`] },
  [USES_BOTH_IN.teamSetsNKeysVersion]: { 'n/no-unpublished-import': [`${USES_BOTH_IN.teamSetsNKeysVersion}:1 n/no-unpublished-import`] },
}
