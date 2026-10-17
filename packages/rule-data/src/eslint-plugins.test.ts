import { readFileSync } from 'node:fs'
import { findPackageJSON } from 'node:module'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildPluginWithRuleWithoutCreate,
  buildPluginWithoutRules,
  buildRulesPlugin,
} from './__tests__/factories/eslint-plugin-factories.ts'
import { eslintPlugins } from './eslint-plugins.ts'
import { eslintPluginPackageNames } from './generate/eslint-plugin-package-names.ts'
import inventory from './generated/inventory.json' with { type: 'json' }

const PACKAGE_NAME_BY_PREFIX = {
  '@eslint-react': '@eslint-react/eslint-plugin',
  '@typescript-eslint': 'typescript-eslint',
  'check-file': 'eslint-plugin-check-file',
  'css-modules': 'eslint-plugin-css-modules',
  functional: 'eslint-plugin-functional',
  house: '@workspace/eslint-plugin-house',
  'import-x': 'eslint-plugin-import-x',
  // The fork, which accepts ESLint 10, registered under the original's prefix.
  'jsx-a11y': 'eslint-plugin-jsx-a11y-x',
  n: 'eslint-plugin-n',
  'no-secrets': 'eslint-plugin-no-secrets',
  perfectionist: 'eslint-plugin-perfectionist',
  promise: 'eslint-plugin-promise',
  react: 'eslint-plugin-react',
  'react-hook-form': 'eslint-plugin-react-hook-form',
  'react-hooks': 'eslint-plugin-react-hooks',
  'react-perf': 'eslint-plugin-react-perf',
  'react-you-might-not-need-an-effect': 'eslint-plugin-react-you-might-not-need-an-effect',
  regexp: 'eslint-plugin-regexp',
  sonarjs: 'eslint-plugin-sonarjs',
  storybook: 'eslint-plugin-storybook',
  'testing-library': 'eslint-plugin-testing-library',
  unicorn: 'eslint-plugin-unicorn',
  vitest: '@vitest/eslint-plugin',
}

const { dependencies: ruleDataDependencies }: { dependencies: Readonly<Record<string, string>> } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)

function installedVersionOf(packageName: string): string {
  const packageJsonPath = findPackageJSON(packageName, import.meta.url)
  if (packageJsonPath === undefined) throw new Error(`${packageName} is not installed`)
  const { version }: { version: string } = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  return version
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

// house is one of the plugins checked at load, and the one whose package name is private: an error
// naming the package would put `@workspace/` into the published build.
describe('the load-time check on a plugin whose types do not fit ESLint.Plugin', () => {
  const HOUSE_PACKAGE = '@workspace/eslint-plugin-house'

  afterEach(() => {
    vi.doUnmock(HOUSE_PACKAGE)
    vi.resetModules()
  })

  async function registryLoadedWithHouseExporting(housePlugin: unknown): Promise<typeof import('./eslint-plugins.ts')> {
    vi.resetModules()
    vi.doMock(HOUSE_PACKAGE, () => ({ housePlugin }))
    return import('./eslint-plugins.ts')
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
      await expect(registryLoadedWithHouseExporting(housePlugin)).rejects.toThrowError(
        new Error('the plugin registered as house does not export an ESLint plugin with rules'),
      )
    },
  )
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
