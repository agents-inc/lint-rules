import { buildPublishedPackageJson } from '../factories/monorepo-package-factories.ts'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import { buildBundlerTsconfig } from '../factories/tsconfig-factories.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// Imports eslint-plugin-n 18.4.1 cannot resolve, in a monorepo's publishable packages. It reads a name failing its
// package-name pattern (`@/…`, `#…`, `$app/…`) as a path, and an unresolved path as the cwd: reported unpublished
// from outside the package, never from inside (measured, ESLint 10.12). It reads aliases from tsconfig.json alone,
// for TS files alone; the `resolverConfig` option we ship reaches JS files too. Each package also imports a
// devDependency the rule must report.
// Given as the plugin's setting rather than our rule's option, `resolverConfig` makes n/no-extraneous-import
// report aliases named like packages (`~/…`) and baseUrl paths; the last two packages pin that.

const DEV_DEPENDENCY = '@repo/api-mocks'

function manifestText(packageName: string): string {
  return jsonFileText({ ...buildPublishedPackageJson(packageName), devDependencies: { [DEV_DEPENDENCY]: '*' } })
}

// The alias to the published src (1), the alias to the unpublished scripts folder (2), the devDependency (3).
const USES_THE_ALIAS_FROM_JS = `import { util } from '@/util'
import { build } from '#scripts/build'
import { mocks } from '@repo/api-mocks'

export const all = [util, build, mocks]
`

// The alias in tsconfig.app.json to the published src (1), the devDependency (2).
const USES_THE_APP_ALIAS = `import { story } from '@/story'
import { mocks } from '@repo/api-mocks'

export const all = [story, mocks]
`

// The alias in jsconfig.json to the published src (1), the devDependency (2).
const USES_THE_JSCONFIG_ALIAS = `import { util } from '@/util'
import { mocks } from '@repo/api-mocks'

export const all = [util, mocks]
`

// SvelteKit's virtual module (1), the devDependency (2).
const USES_A_KIT_MODULE = `import { browser } from '$app/environment'
import { mocks } from '@repo/api-mocks'

export const all = [browser, mocks]
`

// Vite's virtual module (1): the package-name pattern has no end anchor, so `virtual:pwa-register` reads as a package.
const USES_A_VIRTUAL_PREFIX = `import { registerSW } from 'virtual:pwa-register'

export const all = [registerSW]
`

// tsconfig.json's alias to the published src (1), a relative path to the unpublished scripts folder (2), the devDependency (3).
const REQUIRES_THROUGH_THE_ALIAS = `const { util } = require('@/util.cjs')
const { build } = require('../scripts/build.cjs')
const { mocks } = require('@repo/api-mocks')

module.exports = [util, build, mocks]
`

// tsconfig.json's aliases to the published src, named like packages (1, 2).
const USES_ALIASES_NAMED_LIKE_PACKAGES = `import { util } from '~/util'
import { button } from 'components/button'

export const all = [util, button]
`

// A path to the published src read through tsconfig.json's baseUrl (1).
const USES_THE_BASE_URL = `import { format } from 'utils/format'

export const all = [format]
`

const UNRESOLVABLE_IMPORTERS = {
  jsFileThroughTsconfigAlias: 'packages/js-in-ts/src/uses-alias.js',
  tsFileThroughAppTsconfigAlias: 'packages/vite-app/src/app.ts',
  jsFileThroughJsconfigAlias: 'packages/js-only/src/uses-alias.js',
  kitVirtualModule: 'packages/kit-app/src/routes/load.ts',
  virtualPrefix: 'packages/kit-app/src/register.ts',
  cjsFileThroughTsconfigAlias: 'packages/cjs-in-ts/src/uses-alias.cjs',
} as const

const IMPORTERS_OF_ALIASES_NAMED_LIKE_PACKAGES = {
  jsFileThroughTsconfigAliases: 'packages/js-tilde/src/uses-aliases.js',
  tsFileThroughBaseUrl: 'packages/ts-base-url/src/uses-base-url.ts',
} as const

export const unresolvableImportFiles: ProjectFiles = {
  'packages/js-in-ts/package.json': manifestText('js-in-ts'),
  'packages/js-in-ts/tsconfig.json': jsonFileText(
    buildBundlerTsconfig({ allowJs: true, paths: { '@/*': ['./src/*'], '#scripts/*': ['./scripts/*'] } }, ['src', 'scripts']),
  ),
  'packages/js-in-ts/src/util.js': 'export const util = 1\n',
  'packages/js-in-ts/scripts/build.js': 'export const build = 1\n',
  [UNRESOLVABLE_IMPORTERS.jsFileThroughTsconfigAlias]: USES_THE_ALIAS_FROM_JS,
  'packages/vite-app/package.json': manifestText('vite-app'),
  'packages/vite-app/tsconfig.json': jsonFileText({ files: [], references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }] }),
  'packages/vite-app/tsconfig.app.json': jsonFileText(buildBundlerTsconfig({ paths: { '@/*': ['./src/*'] } })),
  'packages/vite-app/tsconfig.node.json': jsonFileText(buildBundlerTsconfig({}, ['vite.config.ts'])),
  'packages/vite-app/src/story.ts': 'export const story = 1\n',
  [UNRESOLVABLE_IMPORTERS.tsFileThroughAppTsconfigAlias]: USES_THE_APP_ALIAS,
  'packages/js-only/package.json': manifestText('js-only'),
  'packages/js-only/jsconfig.json': jsonFileText({ compilerOptions: { paths: { '@/*': ['./src/*'] } }, include: ['src'] }),
  'packages/js-only/src/util.js': 'export const util = 1\n',
  [UNRESOLVABLE_IMPORTERS.jsFileThroughJsconfigAlias]: USES_THE_JSCONFIG_ALIAS,
  'packages/kit-app/package.json': manifestText('kit-app'),
  [UNRESOLVABLE_IMPORTERS.kitVirtualModule]: USES_A_KIT_MODULE,
  [UNRESOLVABLE_IMPORTERS.virtualPrefix]: USES_A_VIRTUAL_PREFIX,
  'packages/cjs-in-ts/package.json': manifestText('cjs-in-ts'),
  'packages/cjs-in-ts/tsconfig.json': jsonFileText(buildBundlerTsconfig({ allowJs: true, paths: { '@/*': ['./src/*'] } }, ['src', 'scripts'])),
  'packages/cjs-in-ts/src/util.cjs': 'module.exports = { util: 1 }\n',
  'packages/cjs-in-ts/scripts/build.cjs': 'module.exports = { build: 1 }\n',
  [UNRESOLVABLE_IMPORTERS.cjsFileThroughTsconfigAlias]: REQUIRES_THROUGH_THE_ALIAS,
  'packages/js-tilde/package.json': manifestText('js-tilde'),
  'packages/js-tilde/tsconfig.json': jsonFileText(
    buildBundlerTsconfig({ allowJs: true, paths: { '~/*': ['./src/*'], 'components/*': ['./src/components/*'] } }),
  ),
  'packages/js-tilde/src/util.js': 'export const util = 1\n',
  'packages/js-tilde/src/components/button.js': 'export const button = 1\n',
  [IMPORTERS_OF_ALIASES_NAMED_LIKE_PACKAGES.jsFileThroughTsconfigAliases]: USES_ALIASES_NAMED_LIKE_PACKAGES,
  'packages/ts-base-url/package.json': manifestText('ts-base-url'),
  // TypeScript 6 refuses baseUrl as deprecated unless told to ignore it, as a project still using it is.
  'packages/ts-base-url/tsconfig.json': jsonFileText(buildBundlerTsconfig({ baseUrl: 'src', ignoreDeprecations: '6.0' })),
  'packages/ts-base-url/src/utils/format.ts': 'export const format = 1\n',
  [IMPORTERS_OF_ALIASES_NAMED_LIKE_PACKAGES.tsFileThroughBaseUrl]: USES_THE_BASE_URL,
}

export const NO_UNPUBLISHED_REQUIRE: RuleByItsNames = { rule: 'n/no-unpublished-require', names: ['n/no-unpublished-require'] }

/** n/no-unpublished-require, which our `resolverConfig` reaches: the unpublished path and the devDependency, not the alias. */
export const OWED_WHERE_OUR_RESOLVER_OPTION_REACHES_A_REQUIRE = {
  [UNRESOLVABLE_IMPORTERS.cjsFileThroughTsconfigAlias]: {
    'n/no-unpublished-require': ['packages/cjs-in-ts/src/uses-alias.cjs:2 n/no-unpublished-require', 'packages/cjs-in-ts/src/uses-alias.cjs:3 n/no-unpublished-require'],
  },
}

/** Reports aliases named like packages when `resolverConfig` is the plugin's setting. */
export const NO_EXTRANEOUS_IMPORT: RuleByItsNames = { rule: 'n/no-extraneous-import', names: ['n/no-extraneous-import'] }

/** n/no-unpublished-import, which our option reaches: the unpublished alias and the devDependency; nothing for `virtual:`. */
export const OWED_WHERE_OUR_RESOLVER_OPTION_REACHES = {
  [UNRESOLVABLE_IMPORTERS.jsFileThroughTsconfigAlias]: {
    'n/no-unpublished-import': ['packages/js-in-ts/src/uses-alias.js:2 n/no-unpublished-import', 'packages/js-in-ts/src/uses-alias.js:3 n/no-unpublished-import'],
  },
  [UNRESOLVABLE_IMPORTERS.virtualPrefix]: { 'n/no-unpublished-import': [] },
}

// Where nothing of ours reaches: the devDependency alone, on line 2 of each.

/** Vite's layout: the alias in tsconfig.app.json, which the plugin never reads. */
export const OWED_THROUGH_THE_APP_TSCONFIG_ALIAS = {
  [UNRESOLVABLE_IMPORTERS.tsFileThroughAppTsconfigAlias]: { 'n/no-unpublished-import': ['packages/vite-app/src/app.ts:2 n/no-unpublished-import'] },
}

/** A JS project: the alias in jsconfig.json, which the plugin never reads. */
export const OWED_THROUGH_THE_JSCONFIG_ALIAS = {
  [UNRESOLVABLE_IMPORTERS.jsFileThroughJsconfigAlias]: { 'n/no-unpublished-import': ['packages/js-only/src/uses-alias.js:2 n/no-unpublished-import'] },
}

/** SvelteKit's virtual module, which no file holds. */
export const OWED_BESIDE_A_KIT_MODULE = {
  [UNRESOLVABLE_IMPORTERS.kitVirtualModule]: { 'n/no-unpublished-import': ['packages/kit-app/src/routes/load.ts:2 n/no-unpublished-import'] },
}

/** Nothing from either rule for an alias named like a package, or a baseUrl path. */
export const OWED_THROUGH_ALIASES_NAMED_LIKE_PACKAGES = {
  [IMPORTERS_OF_ALIASES_NAMED_LIKE_PACKAGES.jsFileThroughTsconfigAliases]: { 'n/no-extraneous-import': [], 'n/no-unpublished-import': [] },
  [IMPORTERS_OF_ALIASES_NAMED_LIKE_PACKAGES.tsFileThroughBaseUrl]: { 'n/no-extraneous-import': [], 'n/no-unpublished-import': [] },
}
