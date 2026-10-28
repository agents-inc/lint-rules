import { readFileSync } from 'node:fs'
import { findPackageJSON } from 'node:module'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildPluginWithRuleWhoseCreateIsNoFunction,
  buildPluginWithRuleWithoutCreate,
  buildPluginWithRuleWithoutCreateBesideOneWith,
  buildPluginWithoutRules,
  buildRulesPlugin,
} from './__tests__/factories/eslint-plugin-factories.ts'
import ruleDataManifest from '../package.json' with { type: 'json' }
import { type HeldPlugin, heldPluginsOutOfPlace } from './__tests__/held-plugins.ts'
import { eslintPlugins } from './eslint-plugins.ts'
import { eslintPluginPackageNames } from './generate/eslint-plugin-package-names.ts'
import inventory from './generated/inventory.json' with { type: 'json' }
import { isObject } from './is-object.ts'

const PACKAGE_NAME_BY_PREFIX = {
  '@eslint-community/eslint-comments': '@eslint-community/eslint-plugin-eslint-comments',
  '@eslint-react': '@eslint-react/eslint-plugin',
  '@tanstack/query': '@tanstack/eslint-plugin-query',
  '@tanstack/router': '@tanstack/eslint-plugin-router',
  '@typescript-eslint': 'typescript-eslint',
  'check-file': 'eslint-plugin-check-file',
  'css-modules': 'eslint-plugin-css-modules',
  e18e: '@e18e/eslint-plugin',
  functional: 'eslint-plugin-functional',
  house: '@workspace/eslint-plugin-house',
  'hydration-proof': 'eslint-plugin-hydration-proof',
  'import-x': 'eslint-plugin-import-x',
  'jest-dom': 'eslint-plugin-jest-dom',
  // The fork, which accepts ESLint 10, registered under the original's prefix.
  'jsx-a11y': 'eslint-plugin-jsx-a11y-x',
  n: 'eslint-plugin-n',
  'no-secrets': 'eslint-plugin-no-secrets',
  perfectionist: 'eslint-plugin-perfectionist',
  playwright: 'eslint-plugin-playwright',
  promise: 'eslint-plugin-promise',
  react: 'eslint-plugin-react',
  'react-hook-form': 'eslint-plugin-react-hook-form',
  'react-hooks': 'eslint-plugin-react-hooks',
  'react-perf': 'eslint-plugin-react-perf',
  'react-you-might-not-need-an-effect': 'eslint-plugin-react-you-might-not-need-an-effect',
  regexp: 'eslint-plugin-regexp',
  shadcn: '@shadcn/lint',
  sonarjs: 'eslint-plugin-sonarjs',
  storybook: 'eslint-plugin-storybook',
  'testing-library': 'eslint-plugin-testing-library',
  unicorn: 'eslint-plugin-unicorn',
  vitest: '@vitest/eslint-plugin',
  zod: 'eslint-plugin-zod',
}

// Checked at load beside house, each the default export of its package.
const CHECKED_BESIDE_HOUSE: ReadonlyArray<keyof typeof PACKAGE_NAME_BY_PREFIX> = [
  '@tanstack/query',
  '@tanstack/router',
  'css-modules',
  'jsx-a11y',
  'promise',
  'react-hook-form',
  'react-hooks',
  'react-perf',
  'storybook',
]

const HELD_PLUGINS: readonly HeldPlugin[] = [
  { heldBy: 'q-lint-dep-drizzle-advisory', prefix: 'drizzle-security', packageName: 'eslint-plugin-drizzle-security' },
]

const ruleDataDependencies: Readonly<Record<string, string>> = ruleDataManifest.dependencies

/** The version the package's installed manifest gives: undefined where it gives none. */
function installedVersionOf(packageName: string): unknown {
  const packageJsonPath = findPackageJSON(packageName, import.meta.url)
  if (packageJsonPath === undefined) throw new Error(`${packageName} is not installed`)
  const manifest: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  return isObject(manifest) && 'version' in manifest ? manifest.version : undefined
}

describe('eslintPlugins, the runtime registry', () => {
  it('registers exactly the ESLint plugins rule-data depends on, and house, each under its ESLint prefix', () => {
    expect(Object.keys(eslintPlugins).toSorted()).toStrictEqual(Object.keys(PACKAGE_NAME_BY_PREFIX).toSorted())
  })

  it('holds the plugin itself, with rules, under every prefix', () => {
    const prefixesWithoutRules = Object.entries(eslintPlugins)
      .filter(([, plugin]) => plugin.rules === undefined || Object.keys(plugin.rules).length === 0)
      .map(([prefix]) => prefix)

    expect(prefixesWithoutRules).toStrictEqual([])
  })
})

async function registryLoadedWith(packageName: string, moduleExports: Readonly<Record<string, unknown>>): Promise<typeof import('./eslint-plugins.ts')> {
  vi.resetModules()
  vi.doMock(packageName, () => moduleExports)
  return import('./eslint-plugins.ts')
}

// house is one of the plugins checked at load, and the one whose package name is private: an error
// naming the package would put `@workspace/` into the published build.
describe('the load-time check on a plugin whose types do not fit ESLint.Plugin', () => {
  const HOUSE_PACKAGE = '@workspace/eslint-plugin-house'
  const checkedBesideHouse = CHECKED_BESIDE_HOUSE.map((prefix) => ({ prefix, packageName: PACKAGE_NAME_BY_PREFIX[prefix] }))
  const mockedPackages = [HOUSE_PACKAGE, ...checkedBesideHouse.map(({ packageName }) => packageName)]

  afterEach(() => {
    for (const packageName of mockedPackages) {
      vi.doUnmock(packageName)
    }
    vi.resetModules()
  })

  async function registryLoadedWithHouseExporting(housePlugin: unknown): Promise<typeof import('./eslint-plugins.ts')> {
    return registryLoadedWith(HOUSE_PACKAGE, { housePlugin })
  }

  it('registers a plugin of rules under its prefix, unchanged', async () => {
    const plugin = buildRulesPlugin(['some-rule'])

    const { eslintPlugins: registry } = await registryLoadedWithHouseExporting(plugin)

    expect(registry['house']).toBe(plugin)
  })

  it.each([
    { exported: 'no rules', housePlugin: buildPluginWithoutRules() },
    { exported: 'a rule with no create', housePlugin: buildPluginWithRuleWithoutCreate('some-rule') },
  ])(
    'refuses to load when the module exports $exported, naming the prefix and not the private package',
    async ({ housePlugin }) => {
      await expect(registryLoadedWithHouseExporting(housePlugin)).rejects.toThrow(
        new Error('the plugin registered as house does not export an ESLint plugin with rules'),
      )
    },
  )

  it('refuses to load when one rule of the module has no create, beside one that has', async () => {
    await expect(registryLoadedWithHouseExporting(buildPluginWithRuleWithoutCreateBesideOneWith('broken-rule', 'some-rule'))).rejects.toThrow(
      new Error('the plugin registered as house does not export an ESLint plugin with rules'),
    )
  })

  it('refuses to load when a rule of the module has a create that is no function', async () => {
    await expect(registryLoadedWithHouseExporting(buildPluginWithRuleWhoseCreateIsNoFunction('some-rule'))).rejects.toThrow(
      new Error('the plugin registered as house does not export an ESLint plugin with rules'),
    )
  })

  it.each(checkedBesideHouse)('refuses to load when $packageName exports no rules, naming the prefix $prefix', async ({ prefix, packageName }) => {
    await expect(registryLoadedWith(packageName, { default: buildPluginWithoutRules() })).rejects.toThrow(
      new Error(`the plugin registered as ${prefix} does not export an ESLint plugin with rules`),
    )
  })
})

describe('eslintPluginPackageNames, the npm package behind each prefix', () => {
  it('names the package of every registered prefix, and of no other', () => {
    expect(eslintPluginPackageNames).toStrictEqual(PACKAGE_NAME_BY_PREFIX)
  })

  it('names every dependency of rule-data, so no plugin it installs goes unregistered', () => {
    expect(Object.values(eslintPluginPackageNames).toSorted()).toStrictEqual(Object.keys(ruleDataDependencies).toSorted())
  })

  it('matches the inventory to the version of each package that is installed', () => {
    const installedVersionByPrefix = Object.fromEntries(
      Object.entries(eslintPluginPackageNames).map(([prefix, packageName]) => [
        prefix,
        installedVersionOf(packageName),
      ]),
    )

    expect(inventory.versions.eslintPlugins).toStrictEqual(installedVersionByPrefix)
  })
})

describe("a plugin left out for now by the owner's answer to a question card", () => {
  it('is installed nowhere rule-data installs a plugin, and names the question card whose answer left it out', () => {
    const installs = { registry: eslintPlugins, packageNames: eslintPluginPackageNames, dependencies: ruleDataDependencies }

    expect(heldPluginsOutOfPlace(HELD_PLUGINS, installs)).toStrictEqual([])
  })
})
