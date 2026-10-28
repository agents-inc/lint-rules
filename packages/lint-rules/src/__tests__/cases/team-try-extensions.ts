import type { Linter } from 'eslint'
import { buildPublishedPackageJson, fileInPackage, filesUnderPackage, packageDirOf } from '../factories/monorepo-package-factories.ts'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import { buildBundlerTsconfig } from '../factories/tsconfig-factories.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// Our `settings.n.tryExtensions` stays out where the team sets it or the older `settings.node.tryExtensions`:
// eslint-plugin-n 18.4.1 reads settings.n's list first (get-try-extensions.js), so ours would beat the legacy key.
// Each package imports `@/both`: our list tries .ts first and names the unpublished both.ts; the team's tries
// .json first and names the published both.json.

/** The team's own list: JSON before TS, so `@/both` resolves to the published both.json. */
export const TEAMS_TRY_EXTENSIONS = ['.js', '.json', '.ts']

const NODE_VERSION = '>=22'

const TRY_EXTENSIONS_PACKAGES = {
  teamSetsNone: 'team-sets-none',
  teamSetsLegacyKey: 'team-sets-node',
  teamSetsNKey: 'team-sets-n',
  teamSetsLegacyKeysVersion: 'team-sets-node-version',
  teamSetsNKeysVersion: 'team-sets-n-version',
} as const

const USES_BOTH_MODULE = 'src/uses-both.ts'

const TSCONFIG = buildBundlerTsconfig({ resolveJsonModule: true, paths: { '@/*': ['./src/*'] } })

const USES_BOTH = `import both from '@/both'

export const all = [both]
`

function filesOfPackage(packageName: string): Array<[string, string]> {
  return filesUnderPackage(packageName, {
    'package.json': jsonFileText(buildPublishedPackageJson(packageName, ['src/both.json', USES_BOTH_MODULE])),
    'tsconfig.json': jsonFileText(TSCONFIG),
    'src/both.json': '{ "both": 1 }\n',
    'src/both.ts': 'const both = 1\nexport default both\n',
    [USES_BOTH_MODULE]: USES_BOTH,
  })
}

export const tryExtensionsPackageFiles: ProjectFiles = Object.fromEntries(Object.values(TRY_EXTENSIONS_PACKAGES).flatMap(filesOfPackage))

function usesBothIn(packageName: string): string {
  return fileInPackage(packageName, USES_BOTH_MODULE)
}

export const USES_BOTH_IN = {
  teamSetsNone: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsNone),
  teamSetsLegacyKey: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsLegacyKey),
  teamSetsNKey: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsNKey),
  teamSetsLegacyKeysVersion: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsLegacyKeysVersion),
  teamSetsNKeysVersion: usesBothIn(TRY_EXTENSIONS_PACKAGES.teamSetsNKeysVersion),
}

export const TEAMS_SETTINGS_BLOCKS: readonly Linter.Config[] = [
  { name: 'team/legacy-try-extensions', files: [`${packageDirOf(TRY_EXTENSIONS_PACKAGES.teamSetsLegacyKey)}/**`], settings: { node: { tryExtensions: TEAMS_TRY_EXTENSIONS } } },
  { name: 'team/try-extensions', files: [`${packageDirOf(TRY_EXTENSIONS_PACKAGES.teamSetsNKey)}/**`], settings: { n: { tryExtensions: TEAMS_TRY_EXTENSIONS } } },
  { name: 'team/legacy-node-version', files: [`${packageDirOf(TRY_EXTENSIONS_PACKAGES.teamSetsLegacyKeysVersion)}/**`], settings: { node: { version: NODE_VERSION } } },
  { name: 'team/node-version', files: [`${packageDirOf(TRY_EXTENSIONS_PACKAGES.teamSetsNKeysVersion)}/**`], settings: { n: { version: NODE_VERSION } } },
]

/** So the team's copy of the rule runs rather than ours. */
export const TEAMS_OWN_UNPUBLISHED_IMPORT_BLOCK: Linter.Config = { name: 'team/rules', files: ['**/*.ts'], rules: { 'n/no-unpublished-import': 'error' } }

/** Whoever's copy runs: the unpublished both.ts where our list is in force, nothing where the team's is. */
export const OWED_BY_EACH_PACKAGES_SETTINGS = {
  [USES_BOTH_IN.teamSetsNone]: { 'n/no-unpublished-import': [`${USES_BOTH_IN.teamSetsNone}:1 n/no-unpublished-import`] },
  [USES_BOTH_IN.teamSetsLegacyKey]: { 'n/no-unpublished-import': [] },
  [USES_BOTH_IN.teamSetsNKey]: { 'n/no-unpublished-import': [] },
  [USES_BOTH_IN.teamSetsLegacyKeysVersion]: { 'n/no-unpublished-import': [`${USES_BOTH_IN.teamSetsLegacyKeysVersion}:1 n/no-unpublished-import`] },
  [USES_BOTH_IN.teamSetsNKeysVersion]: { 'n/no-unpublished-import': [`${USES_BOTH_IN.teamSetsNKeysVersion}:1 n/no-unpublished-import`] },
}
