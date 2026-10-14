import { describe, expect, it } from 'vitest'

import {
  buildCanonicalRule,
  buildEslintImplementation,
  buildEslintRoute,
  buildInventory,
  buildInventoryRule,
  buildOxlintImplementation,
  buildOxlintRoute,
} from '../__tests__/factories/inventory-factories.ts'
import { oxlintSpellingsOf } from '../rule-id-parts.ts'
import { buildRouting } from './build-routing.ts'

describe('buildRouting', () => {
  describe('a rule the canonical list names', () => {
    it('runs on the engine the canonical list names, though oxlint has an untyped version', () => {
      const inventory = buildInventory([
        buildInventoryRule('unicorn/prefer-at', {
          oxlint: buildOxlintImplementation('unicorn/prefer-at', {
            oxlintPlugin: 'unicorn',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ])
      const canonicalRules = [
        buildCanonicalRule('unicorn/prefer-at', {
          engine: 'eslint',
          ruleset: 'modern-js',
          options: [{ checkAllIndexAccess: true }],
          typed: false,
        }),
      ]

      expect(buildRouting({ inventory, canonicalRules })).toStrictEqual([
        buildEslintRoute('unicorn/prefer-at', {
          typed: false,
          oxlintSpellings: oxlintSpellingsOf('unicorn/prefer-at'),
          shipped: {
            ruleset: 'modern-js',
            options: [{ checkAllIndexAccess: true }],
            files: null,
            ignores: null,
          },
        }),
      ])
    })

    it('runs on oxlint under its oxlint name and plugin, shipping its ruleset and options', () => {
      const inventory = buildInventory([
        buildInventoryRule('eqeqeq', {
          oxlint: buildOxlintImplementation('eqeqeq', {
            oxlintPlugin: 'eslint',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ])
      const canonicalRules = [
        buildCanonicalRule('eqeqeq', {
          engine: 'oxlint',
          oxlintName: 'eqeqeq',
          ruleset: 'correctness',
          options: ['always'],
          typed: false,
        }),
      ]

      expect(buildRouting({ inventory, canonicalRules })).toStrictEqual([
        buildOxlintRoute('eqeqeq', {
          oxlintName: 'eqeqeq',
          oxlintSpellings: oxlintSpellingsOf('eqeqeq'),
          oxlintPlugin: 'eslint',
          eslintAliases: [],
          shipped: { ruleset: 'correctness', options: ['always'], files: null, ignores: null },
        }),
      ])
    })

    it('ships the files it runs on and the files it skips', () => {
      const inventory = buildInventory([
        buildInventoryRule('max-lines', {
          oxlint: null,
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ])
      const canonicalRules = [
        buildCanonicalRule('max-lines', {
          engine: 'eslint',
          ruleset: 'complexity',
          options: [{ max: 200 }],
          typed: false,
          files: ['**/*.{tsx,jsx}'],
          ignores: ['**/*.stories.{ts,tsx,js,jsx}'],
        }),
      ]

      expect(buildRouting({ inventory, canonicalRules })).toStrictEqual([
        buildEslintRoute('max-lines', {
          typed: false,
          oxlintSpellings: [],
          shipped: {
            ruleset: 'complexity',
            options: [{ max: 200 }],
            files: ['**/*.{tsx,jsx}'],
            ignores: ['**/*.stories.{ts,tsx,js,jsx}'],
          },
        }),
      ])
    })
  })

  describe("a route's oxlint spellings", () => {
    it("are oxlint's spellings of its own name for a rule oxlint has under another name, though ESLint runs it", () => {
      const inventory = buildInventory([
        buildInventoryRule('unicorn/no-for-each', {
          oxlint: buildOxlintImplementation('unicorn/no-array-for-each', {
            oxlintPlugin: 'unicorn',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ])
      const canonicalRules = [
        buildCanonicalRule('unicorn/no-for-each', {
          engine: 'eslint',
          ruleset: 'modern-js',
          options: [],
          typed: false,
        }),
      ]

      expect(buildRouting({ inventory, canonicalRules })).toStrictEqual([
        buildEslintRoute('unicorn/no-for-each', {
          typed: false,
          oxlintSpellings: oxlintSpellingsOf('unicorn/no-array-for-each'),
          shipped: { ruleset: 'modern-js', options: [], files: null, ignores: null },
        }),
      ])
    })
  })

  describe('a rule the canonical list does not name', () => {
    it('runs on oxlint when oxlint has a version that needs no type information', () => {
      const inventory = buildInventory([
        buildInventoryRule('no-debugger', {
          oxlint: buildOxlintImplementation('no-debugger', {
            oxlintPlugin: 'eslint',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
        buildInventoryRule('oxc/no-accumulating-spread', {
          oxlint: buildOxlintImplementation('oxc/no-accumulating-spread', {
            oxlintPlugin: 'oxc',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: null,
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildOxlintRoute('no-debugger', {
          oxlintName: 'no-debugger',
          oxlintSpellings: oxlintSpellingsOf('no-debugger'),
          oxlintPlugin: 'eslint',
          eslintAliases: [],
          shipped: null,
        }),
        buildOxlintRoute('oxc/no-accumulating-spread', {
          oxlintName: 'oxc/no-accumulating-spread',
          oxlintSpellings: oxlintSpellingsOf('oxc/no-accumulating-spread'),
          oxlintPlugin: 'oxc',
          eslintAliases: [],
          shipped: null,
        }),
      ])
    })

    it("runs on ESLint when oxlint's version needs type information", () => {
      const inventory = buildInventory([
        buildInventoryRule('@typescript-eslint/no-floating-promises', {
          oxlint: buildOxlintImplementation('typescript/no-floating-promises', {
            oxlintPlugin: 'typescript',
            typeAware: true,
            eslintAliases: [],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: true }),
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildEslintRoute('@typescript-eslint/no-floating-promises', {
          typed: true,
          shipped: null,
          oxlintSpellings: oxlintSpellingsOf('typescript/no-floating-promises'),
        }),
      ])
    })

    it("runs on ESLint when only ESLint has it, typed as the plugin's metadata says", () => {
      const inventory = buildInventory([
        buildInventoryRule('sonarjs/cognitive-complexity', {
          oxlint: null,
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
        buildInventoryRule('functional/prefer-immutable-types', {
          oxlint: null,
          eslint: buildEslintImplementation({ deprecated: false, typed: true }),
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildEslintRoute('functional/prefer-immutable-types', { typed: true, shipped: null, oxlintSpellings: [] }),
        buildEslintRoute('sonarjs/cognitive-complexity', { typed: false, shipped: null, oxlintSpellings: [] }),
      ])
    })
  })

  describe('a deprecated ESLint rule', () => {
    const inventory = buildInventory([
      buildInventoryRule('unicorn/dom-node-dataset', {
        oxlint: null,
        eslint: buildEslintImplementation({ deprecated: false, typed: false }),
      }),
      buildInventoryRule('unicorn/prefer-dom-node-dataset', {
        oxlint: null,
        eslint: buildEslintImplementation({ deprecated: true, typed: false }),
      }),
    ])

    it('is not a RuleId when the canonical list does not name it', () => {
      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildEslintRoute('unicorn/dom-node-dataset', { typed: false, shipped: null, oxlintSpellings: [] }),
      ])
    })

    it('is a RuleId when the canonical list names it', () => {
      const canonicalRules = [
        buildCanonicalRule('unicorn/prefer-dom-node-dataset', {
          engine: 'eslint',
          ruleset: 'browser',
          options: [],
          typed: false,
        }),
      ]

      expect(buildRouting({ inventory, canonicalRules })).toStrictEqual([
        buildEslintRoute('unicorn/dom-node-dataset', { typed: false, shipped: null, oxlintSpellings: [] }),
        buildEslintRoute('unicorn/prefer-dom-node-dataset', {
          typed: false,
          oxlintSpellings: [],
          shipped: { ruleset: 'browser', options: [], files: null, ignores: null },
        }),
      ])
    })
  })

  describe("an oxlint-routed rule's ESLint aliases", () => {
    it('keep an alias that is not itself a RuleId', () => {
      const inventory = buildInventory([
        buildInventoryRule('import-x/no-cycle', {
          oxlint: buildOxlintImplementation('import/no-cycle', {
            oxlintPlugin: 'import',
            typeAware: false,
            eslintAliases: ['import/no-cycle'],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildOxlintRoute('import-x/no-cycle', {
          oxlintName: 'import/no-cycle',
          oxlintSpellings: oxlintSpellingsOf('import/no-cycle'),
          oxlintPlugin: 'import',
          eslintAliases: ['import/no-cycle'],
          shipped: null,
        }),
      ])
    })

    it('drop an alias that is a RuleId of its own, routed separately', () => {
      const inventory = buildInventory([
        buildInventoryRule('no-unused-vars', {
          oxlint: buildOxlintImplementation('no-unused-vars', {
            oxlintPlugin: 'eslint',
            typeAware: false,
            eslintAliases: ['@typescript-eslint/no-unused-vars'],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
        buildInventoryRule('@typescript-eslint/no-unused-vars', {
          oxlint: null,
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildEslintRoute('@typescript-eslint/no-unused-vars', { typed: false, shipped: null, oxlintSpellings: [] }),
        buildOxlintRoute('no-unused-vars', {
          oxlintName: 'no-unused-vars',
          oxlintSpellings: oxlintSpellingsOf('no-unused-vars'),
          oxlintPlugin: 'eslint',
          eslintAliases: [],
          shipped: null,
        }),
      ])
    })
  })

  describe('two RuleIds and their oxlint names', () => {
    it('throws when both claim one oxlint name, naming both IDs', () => {
      const inventory = buildInventory([
        buildInventoryRule('unicorn/no-for-each', {
          oxlint: buildOxlintImplementation('unicorn/no-array-for-each', {
            oxlintPlugin: 'unicorn',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
        buildInventoryRule('unicorn/no-array-for-each', {
          oxlint: buildOxlintImplementation('unicorn/no-array-for-each', {
            oxlintPlugin: 'unicorn',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: null,
        }),
      ])
      const routeBoth = () => buildRouting({ inventory, canonicalRules: [] })

      expect(routeBoth).toThrow(/unicorn\/no-for-each/)
      expect(routeBoth).toThrow(/unicorn\/no-array-for-each/)
    })

    it('routes both when each has an oxlint name of its own', () => {
      const inventory = buildInventory([
        buildInventoryRule('unicorn/no-for-each', {
          oxlint: buildOxlintImplementation('unicorn/no-array-for-each', {
            oxlintPlugin: 'unicorn',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
        buildInventoryRule('unicorn/no-thenable', {
          oxlint: buildOxlintImplementation('unicorn/no-thenable', {
            oxlintPlugin: 'unicorn',
            typeAware: false,
            eslintAliases: [],
          }),
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildOxlintRoute('unicorn/no-for-each', {
          oxlintName: 'unicorn/no-array-for-each',
          oxlintSpellings: oxlintSpellingsOf('unicorn/no-array-for-each'),
          oxlintPlugin: 'unicorn',
          eslintAliases: [],
          shipped: null,
        }),
        buildOxlintRoute('unicorn/no-thenable', {
          oxlintName: 'unicorn/no-thenable',
          oxlintSpellings: oxlintSpellingsOf('unicorn/no-thenable'),
          oxlintPlugin: 'unicorn',
          eslintAliases: [],
          shipped: null,
        }),
      ])
    })
  })

  describe('a rule routed to an engine that does not have it', () => {
    const hooksRuleOnlyOxlintHas = buildInventoryRule('react-hooks/rules-of-hooks', {
      oxlint: buildOxlintImplementation('react/rules-of-hooks', {
        oxlintPlugin: 'react',
        typeAware: false,
        eslintAliases: [],
      }),
      eslint: null,
    })
    const complexityRuleOnlyEslintHas = buildInventoryRule('sonarjs/cognitive-complexity', {
      oxlint: null,
      eslint: buildEslintImplementation({ deprecated: false, typed: false }),
    })

    it('routes a canonical rule to the engine that has it', () => {
      const inventory = buildInventory([hooksRuleOnlyOxlintHas])
      const canonicalRules = [
        buildCanonicalRule('react-hooks/rules-of-hooks', {
          engine: 'oxlint',
          oxlintName: 'react/rules-of-hooks',
          ruleset: 'react',
          options: [],
          typed: false,
        }),
      ]

      expect(buildRouting({ inventory, canonicalRules })).toStrictEqual([
        buildOxlintRoute('react-hooks/rules-of-hooks', {
          oxlintName: 'react/rules-of-hooks',
          oxlintSpellings: oxlintSpellingsOf('react/rules-of-hooks'),
          oxlintPlugin: 'react',
          eslintAliases: [],
          shipped: { ruleset: 'react', options: [], files: null, ignores: null },
        }),
      ])
    })

    it('throws for a canonical rule routed to ESLint that only oxlint has, naming the rule and ESLint', () => {
      const inventory = buildInventory([hooksRuleOnlyOxlintHas])
      const canonicalRules = [
        buildCanonicalRule('react-hooks/rules-of-hooks', {
          engine: 'eslint',
          ruleset: 'react',
          options: [],
          typed: false,
        }),
      ]
      const route = () => buildRouting({ inventory, canonicalRules })

      expect(route).toThrow(/react-hooks\/rules-of-hooks/)
      expect(route).toThrow(/ESLint/)
    })

    it('throws for a canonical rule routed to oxlint that only ESLint has, naming the rule and oxlint', () => {
      const inventory = buildInventory([complexityRuleOnlyEslintHas])
      const canonicalRules = [
        buildCanonicalRule('sonarjs/cognitive-complexity', {
          engine: 'oxlint',
          oxlintName: 'sonarjs/cognitive-complexity',
          ruleset: 'complexity',
          options: [],
          typed: false,
        }),
      ]
      const route = () => buildRouting({ inventory, canonicalRules })

      expect(route).toThrow(/sonarjs\/cognitive-complexity/)
      expect(route).toThrow(/oxlint/)
    })

    it('throws for a rule outside the canonical list that only oxlint has, as a type-aware version', () => {
      const inventory = buildInventory([
        buildInventoryRule('@typescript-eslint/no-floating-promises', {
          oxlint: buildOxlintImplementation('typescript/no-floating-promises', {
            oxlintPlugin: 'typescript',
            typeAware: true,
            eslintAliases: [],
          }),
          eslint: null,
        }),
      ])
      const route = () => buildRouting({ inventory, canonicalRules: [] })

      expect(route).toThrow(/@typescript-eslint\/no-floating-promises/)
    })
  })

  describe('a canonical rule no installed engine has', () => {
    it('throws, naming the rule', () => {
      const inventory = buildInventory([
        buildInventoryRule('sonarjs/cognitive-complexity', {
          oxlint: null,
          eslint: buildEslintImplementation({ deprecated: false, typed: false }),
        }),
      ])
      const canonicalRules = [
        buildCanonicalRule('sonarjs/cognitive-complexity', {
          engine: 'eslint',
          ruleset: 'complexity',
          options: [],
          typed: false,
        }),
        buildCanonicalRule('sonarjs/no-such-rule', {
          engine: 'eslint',
          ruleset: 'complexity',
          options: [],
          typed: false,
        }),
      ]

      expect(() => buildRouting({ inventory, canonicalRules })).toThrow(/sonarjs\/no-such-rule/)
    })
  })

  it('lists routes in ascending ID order whatever order the inventory gives', () => {
    const inventory = buildInventory([
      buildInventoryRule('unicorn/no-thenable', {
        oxlint: buildOxlintImplementation('unicorn/no-thenable', {
          oxlintPlugin: 'unicorn',
          typeAware: false,
          eslintAliases: [],
        }),
        eslint: buildEslintImplementation({ deprecated: false, typed: false }),
      }),
      buildInventoryRule('sonarjs/cognitive-complexity', {
        oxlint: null,
        eslint: buildEslintImplementation({ deprecated: false, typed: false }),
      }),
      buildInventoryRule('@typescript-eslint/no-unused-vars', {
        oxlint: null,
        eslint: buildEslintImplementation({ deprecated: false, typed: false }),
      }),
    ])

    expect(buildRouting({ inventory, canonicalRules: [] }).map((route) => route.id)).toStrictEqual([
      '@typescript-eslint/no-unused-vars',
      'sonarjs/cognitive-complexity',
      'unicorn/no-thenable',
    ])
  })
})
