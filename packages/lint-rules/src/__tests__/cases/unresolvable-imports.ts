import { buildPublishedPackageJson } from '../factories/monorepo-package-factories.ts'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import { buildBundlerTsconfig } from '../factories/tsconfig-factories.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// Imports eslint-plugin-n 18.4.1 cannot resolve, in publishable packages of a monorepo (decisions.md,
// 2026-10-14 "fix round 4 closed" and "fix round 5 review"). The plugin reads a name that fails its
// package-name pattern (`@/…`, `#…`, `$app/…`) as a path; where it resolves no file behind it,
// check-publish.js measures the import as `path.relative(packageDir, "")`, which is the folder the
// process runs in: outside the package, as from a monorepo's root, the import is reported unpublished
// whatever it names; inside it, never (measured, ESLint 10.12). The plugin reads aliases from the
// nearest file named tsconfig.json alone (lib/util/get-tsconfig.js), and for TS files alone
// (lib/util/import-target.js, getResolver). The `resolverConfig` option we ship on
// n/no-unpublished-import goes to enhanced-resolve 5.26, whose own `tsconfig` option finds
// tsconfig.json's aliases for JS files too (measured, ESLint 10.12); nothing reaches the rest
// (questions.md #78).
//
// Four packages: a TS project allowing JS, whose JS file imports through tsconfig.json's alias; Vite's
// layout, its alias in tsconfig.app.json; a JS project, its alias in jsconfig.json; and a SvelteKit
// app importing its framework's virtual modules. Each also imports a package it lists in
// devDependencies alone, which the rule must report.
//
// A CommonJS package of a TS project allowing JS requires through tsconfig.json's alias too
// (decisions.md, 2026-10-14 "fix round 6 closed"): n/no-unpublished-require ships the same
// `resolverConfig` option, so it reads the alias to the published src as a file, and still reports
// what the package does not publish.
//
// Two more hold imports no rule of ours reports, which the same `resolverConfig` given as the
// plugin's setting rather than our rule's option made n/no-extraneous-import report as extraneous
// packages (fix round 5's review; measured, ESLint 10.12): a JS file importing through tsconfig.json's
// aliases named like packages (`~/…`, `components/…`), and a TS file importing through baseUrl alone
// (`utils/…`).

/** Every package's devDependency the rule must report, as packages/ui's `@repo/api-mocks` was in real run 3. */
const DEV_DEPENDENCY = '@repo/api-mocks'

/** The package's package.json: published, and listing DEV_DEPENDENCY under devDependencies. */
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

// Vite's virtual module, by its convention's prefix (1). The plugin's package-name pattern has no end
// anchor, so it reads `virtual:pwa-register` as a package of that name, which no manifest lists.
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

/** The module of each package importing what the plugin cannot resolve. */
const UNRESOLVABLE_IMPORTERS = {
  jsFileThroughTsconfigAlias: 'packages/js-in-ts/src/uses-alias.js',
  tsFileThroughAppTsconfigAlias: 'packages/vite-app/src/app.ts',
  jsFileThroughJsconfigAlias: 'packages/js-only/src/uses-alias.js',
  kitVirtualModule: 'packages/kit-app/src/routes/load.ts',
  virtualPrefix: 'packages/kit-app/src/register.ts',
  cjsFileThroughTsconfigAlias: 'packages/cjs-in-ts/src/uses-alias.cjs',
} as const

/** The module of each package importing through what our option resolves and the plugin's setting would read as a package. */
const IMPORTERS_OF_ALIASES_NAMED_LIKE_PACKAGES = {
  jsFileThroughTsconfigAliases: 'packages/js-tilde/src/uses-aliases.js',
  tsFileThroughBaseUrl: 'packages/ts-base-url/src/uses-base-url.ts',
} as const

/** The seven packages' files, under packages/ of the project's root. */
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

/**
 * What n/no-unpublished-require owes where the `resolverConfig` option we ship on it reaches: in the
 * CommonJS file of the TS project, the relative path to the unpublished scripts folder and the
 * devDependency, not the alias to src.
 */
export const OWED_WHERE_OUR_RESOLVER_OPTION_REACHES_A_REQUIRE = {
  [UNRESOLVABLE_IMPORTERS.cjsFileThroughTsconfigAlias]: {
    'n/no-unpublished-require': ['packages/cjs-in-ts/src/uses-alias.cjs:2 n/no-unpublished-require', 'packages/cjs-in-ts/src/uses-alias.cjs:3 n/no-unpublished-require'],
  },
}

/** The rule fix round 5's review saw report an alias named like a package once the plugin's setting resolved it. */
export const NO_EXTRANEOUS_IMPORT: RuleByItsNames = { rule: 'n/no-extraneous-import', names: ['n/no-extraneous-import'] }

/**
 * What n/no-unpublished-import owes where the `resolverConfig` option we ship on it reaches: in the
 * JS file of the TS project, the alias to the unpublished scripts folder and the devDependency, not
 * the alias to src; and nothing for the `virtual:` prefix, read as a package.
 */
export const OWED_WHERE_OUR_RESOLVER_OPTION_REACHES = {
  [UNRESOLVABLE_IMPORTERS.jsFileThroughTsconfigAlias]: {
    'n/no-unpublished-import': ['packages/js-in-ts/src/uses-alias.js:2 n/no-unpublished-import', 'packages/js-in-ts/src/uses-alias.js:3 n/no-unpublished-import'],
  },
  [UNRESOLVABLE_IMPORTERS.virtualPrefix]: { 'n/no-unpublished-import': [] },
}

// What n/no-unpublished-import owes where neither our option nor a setting of the plugin's reaches:
// the devDependency alone, on line 2 of each, and not the alias or the virtual module, which name
// what the package publishes or nothing it ships at all.

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

/**
 * What n/no-extraneous-import and n/no-unpublished-import owe where an import names a file the package
 * publishes through an alias named like a package, or through baseUrl: nothing, from either rule.
 */
export const OWED_THROUGH_ALIASES_NAMED_LIKE_PACKAGES = {
  [IMPORTERS_OF_ALIASES_NAMED_LIKE_PACKAGES.jsFileThroughTsconfigAliases]: { 'n/no-extraneous-import': [], 'n/no-unpublished-import': [] },
  [IMPORTERS_OF_ALIASES_NAMED_LIKE_PACKAGES.tsFileThroughBaseUrl]: { 'n/no-extraneous-import': [], 'n/no-unpublished-import': [] },
}
