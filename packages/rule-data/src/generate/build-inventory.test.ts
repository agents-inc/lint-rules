import { describe, expect, it } from 'vitest'

import {
  buildEslintImplementation,
  buildInstalledEngines,
  buildInstalledEslintRule,
  buildInstalledOxlintRule,
  buildInventoryRule,
  buildOxlintImplementation,
} from '../__tests__/factories/inventory-factories.ts'
import { buildInventory } from './build-inventory.ts'

describe('buildInventory', () => {
  it("joins both engines' versions of a rule under its ESLint ID, with its oxlint scope's plugin and aliases", () => {
    const installed = buildInstalledEngines({
      oxlintRules: [buildInstalledOxlintRule('import/no-cycle', { typeAware: false })],
      eslintRules: [buildInstalledEslintRule('import-x/no-cycle', { deprecated: false, typed: false })],
    })

    expect(buildInventory(installed)).toStrictEqual({
      versions: installed.versions,
      rules: [
        buildInventoryRule('import-x/no-cycle', {
          oxlint: buildOxlintImplementation('import/no-cycle', {
            oxlintPlugin: 'import',
            typeAware: false,
            eslintAliases: ['import/no-cycle'],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ],
    })
  })

  it('keeps a rule only one engine has, with null for the other, in ascending ID order', () => {
    const installed = buildInstalledEngines({
      oxlintRules: [
        buildInstalledOxlintRule('no-debugger', { typeAware: false }),
        buildInstalledOxlintRule('jsx_a11y/alt-text', { typeAware: false }),
      ],
      eslintRules: [
        buildInstalledEslintRule('sonarjs/cognitive-complexity', { deprecated: false, typed: false }),
        buildInstalledEslintRule('@typescript-eslint/no-floating-promises', { deprecated: false, typed: true }),
      ],
    })

    expect(buildInventory(installed).rules).toStrictEqual([
      buildInventoryRule('@typescript-eslint/no-floating-promises', {
        oxlint: null,
        eslint: buildEslintImplementation({ deprecated: false, typed: true }),
      }),
      buildInventoryRule('jsx-a11y/alt-text', {
        oxlint: buildOxlintImplementation('jsx_a11y/alt-text', {
          oxlintPlugin: 'jsx-a11y',
          typeAware: false,
          eslintAliases: [],
        }),
        eslint: null,
      }),
      buildInventoryRule('no-debugger', {
        oxlint: buildOxlintImplementation('no-debugger', {
          oxlintPlugin: 'eslint',
          typeAware: false,
          eslintAliases: [],
        }),
        eslint: null,
      }),
      buildInventoryRule('sonarjs/cognitive-complexity', {
        oxlint: null,
        eslint: buildEslintImplementation({ deprecated: false, typed: false }),
      }),
    ])
  })

  describe('two oxlint rules and their canonical IDs', () => {
    it('joins a renamed oxlint rule to the current ESLint name', () => {
      const installed = buildInstalledEngines({
        oxlintRules: [buildInstalledOxlintRule('unicorn/no-array-for-each', { typeAware: false })],
        eslintRules: [buildInstalledEslintRule('unicorn/no-for-each', { deprecated: false, typed: false })],
      })

      expect(buildInventory(installed).rules).toStrictEqual([
        buildInventoryRule('unicorn/no-for-each', {
          oxlint: buildOxlintImplementation('unicorn/no-array-for-each', {
            oxlintPlugin: 'unicorn',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ])
    })

    it('throws when both map to one canonical ID, naming both oxlint names and the ID', () => {
      const installed = buildInstalledEngines({
        oxlintRules: [
          buildInstalledOxlintRule('unicorn/no-array-for-each', { typeAware: false }),
          buildInstalledOxlintRule('unicorn/no-for-each', { typeAware: false }),
        ],
        eslintRules: [buildInstalledEslintRule('unicorn/no-for-each', { deprecated: false, typed: false })],
      })
      const joinBoth = () => buildInventory(installed)

      expect(joinBoth).toThrow(/unicorn\/no-array-for-each and unicorn\/no-for-each → unicorn\/no-for-each/)
    })
  })
})
