import { describe, expect, it } from 'vitest'

import {
  buildCanonicalRule,
  buildEslintImplementation,
  buildEslintRoutingEntry,
  buildInventory,
  buildInventoryRule,
  buildOxlintImplementation,
  buildOxlintRoutingEntry,
} from '../__tests__/factories/inventory-factories.ts'
import { oxlintSpellingsOf } from '../rule-id-parts.ts'
import { buildRouting } from './build-routing.ts'

const UNTYPED_ESLINT_VERSION = buildEslintImplementation({ deprecated: false, typed: false })
const TYPED_ESLINT_VERSION = buildEslintImplementation({ deprecated: false, typed: true })
const OXLINT_NO_ARRAY_FOR_EACH = buildOxlintImplementation('unicorn/no-array-for-each', { oxlintPlugin: 'unicorn', typeAware: false, eslintAliases: [] })
const OXLINT_NO_THENABLE = buildOxlintImplementation('unicorn/no-thenable', { oxlintPlugin: 'unicorn', typeAware: false, eslintAliases: [] })
const TYPE_AWARE_OXLINT_NO_FLOATING_PROMISES = buildOxlintImplementation('typescript/no-floating-promises', {
  oxlintPlugin: 'typescript',
  typeAware: true,
  eslintAliases: [],
})

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
          eslint: UNTYPED_ESLINT_VERSION,
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
        buildEslintRoutingEntry('unicorn/prefer-at', {
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
          eslint: UNTYPED_ESLINT_VERSION,
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
        buildOxlintRoutingEntry('eqeqeq', {
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
          eslint: UNTYPED_ESLINT_VERSION,
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
        buildEslintRoutingEntry('max-lines', {
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

  // rules.json records each relation with its reason; routing carries the other rule's ID alone, and
  // only where rules.json gives one.
  describe("a rule's relations to other shipped rules", () => {
    const inventory = buildInventory([
      buildInventoryRule('no-new', {
        oxlint: buildOxlintImplementation('no-new', { oxlintPlugin: 'eslint', typeAware: false, eslintAliases: [] }),
        eslint: UNTYPED_ESLINT_VERSION,
      }),
      buildInventoryRule('no-return-assign', {
        oxlint: null,
        eslint: UNTYPED_ESLINT_VERSION,
      }),
      buildInventoryRule('functional/no-expression-statements', {
        oxlint: null,
        eslint: TYPED_ESLINT_VERSION,
      }),
    ])

    it('carries the ID of the rule covering it, from oxlint and ESLint routes alike, and leaves the field out of a rule covered by none', () => {
      const canonicalRules = [
        buildCanonicalRule('functional/no-expression-statements', { engine: 'eslint', ruleset: 'declarative', options: [], typed: true }),
        buildCanonicalRule('no-new', {
          engine: 'oxlint',
          oxlintName: 'no-new',
          ruleset: 'redundancy',
          options: [],
          typed: false,
          coveredBy: { rule: 'functional/no-expression-statements', because: 'card: the cover reports every new expression statement' },
        }),
        buildCanonicalRule('no-return-assign', {
          engine: 'eslint',
          ruleset: 'correctness',
          options: [],
          typed: false,
          coveredBy: { rule: 'functional/no-expression-statements', because: 'card: the cover reports it' },
        }),
      ]

      expect(buildRouting({ inventory, canonicalRules }).map(({ id, shipped }) => [id, shipped])).toStrictEqual([
        ['functional/no-expression-statements', { ruleset: 'declarative', options: [], files: null, ignores: null }],
        ['no-new', { ruleset: 'redundancy', options: [], files: null, ignores: null, coveredBy: 'functional/no-expression-statements' }],
        ['no-return-assign', { ruleset: 'correctness', options: [], files: null, ignores: null, coveredBy: 'functional/no-expression-statements' }],
      ])
    })

    it('carries the ID of the typed rule it splits by types with, from oxlint and ESLint routes alike, and leaves the field out of a rule split with none', () => {
      const canonicalRules = [
        buildCanonicalRule('functional/no-expression-statements', { engine: 'eslint', ruleset: 'declarative', options: [], typed: true }),
        buildCanonicalRule('no-new', {
          engine: 'oxlint',
          oxlintName: 'no-new',
          ruleset: 'redundancy',
          options: [],
          typed: false,
          splitByTypesWith: { rule: 'functional/no-expression-statements', because: 'card: the typed rule reports it with types' },
        }),
        buildCanonicalRule('no-return-assign', {
          engine: 'eslint',
          ruleset: 'correctness',
          options: [],
          typed: false,
          splitByTypesWith: { rule: 'functional/no-expression-statements', because: 'card: the typed rule reports it with types' },
        }),
      ]

      expect(buildRouting({ inventory, canonicalRules }).map(({ id, shipped }) => [id, shipped])).toStrictEqual([
        ['functional/no-expression-statements', { ruleset: 'declarative', options: [], files: null, ignores: null }],
        ['no-new', { ruleset: 'redundancy', options: [], files: null, ignores: null, splitByTypesWith: 'functional/no-expression-statements' }],
        ['no-return-assign', { ruleset: 'correctness', options: [], files: null, ignores: null, splitByTypesWith: 'functional/no-expression-statements' }],
      ])
    })
  })

  // rules.json marks each rule our runtimes' globals serve; routing carries the mark only where
  // rules.json gives it.
  describe("whether our runtimes' globals serve a rule", () => {
    const inventory = buildInventory([
      buildInventoryRule('no-undef', {
        oxlint: buildOxlintImplementation('no-undef', { oxlintPlugin: 'eslint', typeAware: false, eslintAliases: [] }),
        eslint: UNTYPED_ESLINT_VERSION,
      }),
      buildInventoryRule('no-return-assign', {
        oxlint: null,
        eslint: UNTYPED_ESLINT_VERSION,
      }),
      buildInventoryRule('eqeqeq', {
        oxlint: null,
        eslint: UNTYPED_ESLINT_VERSION,
      }),
    ])

    it('carries the mark where the canonical list gives it, from oxlint and ESLint routes alike, and leaves the field out of a rule it leaves unmarked', () => {
      const canonicalRules = [
        buildCanonicalRule('no-undef', { engine: 'oxlint', oxlintName: 'no-undef', ruleset: 'correctness', options: [], typed: false, readsRuntimeGlobals: true }),
        buildCanonicalRule('no-return-assign', { engine: 'eslint', ruleset: 'correctness', options: [], typed: false, readsRuntimeGlobals: true }),
        buildCanonicalRule('eqeqeq', { engine: 'eslint', ruleset: 'correctness', options: [], typed: false }),
      ]

      expect(buildRouting({ inventory, canonicalRules }).map(({ id, shipped }) => [id, shipped])).toStrictEqual([
        ['eqeqeq', { ruleset: 'correctness', options: [], files: null, ignores: null }],
        ['no-return-assign', { ruleset: 'correctness', options: [], files: null, ignores: null, readsRuntimeGlobals: true }],
        ['no-undef', { ruleset: 'correctness', options: [], files: null, ignores: null, readsRuntimeGlobals: true }],
      ])
    })
  })

  describe("a route's oxlint spellings", () => {
    it("are oxlint's spellings of its own name for a rule oxlint has under another name, though ESLint runs it", () => {
      const inventory = buildInventory([
        buildInventoryRule('unicorn/no-for-each', {
          oxlint: OXLINT_NO_ARRAY_FOR_EACH,
          eslint: UNTYPED_ESLINT_VERSION,
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
        buildEslintRoutingEntry('unicorn/no-for-each', {
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
          eslint: UNTYPED_ESLINT_VERSION,
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
        buildOxlintRoutingEntry('no-debugger', {
          oxlintName: 'no-debugger',
          oxlintSpellings: oxlintSpellingsOf('no-debugger'),
          oxlintPlugin: 'eslint',
          eslintAliases: [],
          shipped: null,
        }),
        buildOxlintRoutingEntry('oxc/no-accumulating-spread', {
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
          oxlint: TYPE_AWARE_OXLINT_NO_FLOATING_PROMISES,
          eslint: TYPED_ESLINT_VERSION,
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildEslintRoutingEntry('@typescript-eslint/no-floating-promises', {
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
          eslint: UNTYPED_ESLINT_VERSION,
        }),
        buildInventoryRule('functional/prefer-immutable-types', {
          oxlint: null,
          eslint: TYPED_ESLINT_VERSION,
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildEslintRoutingEntry('functional/prefer-immutable-types', { typed: true, shipped: null, oxlintSpellings: [] }),
        buildEslintRoutingEntry('sonarjs/cognitive-complexity', { typed: false, shipped: null, oxlintSpellings: [] }),
      ])
    })
  })

  describe('a deprecated ESLint rule', () => {
    const inventory = buildInventory([
      buildInventoryRule('unicorn/dom-node-dataset', {
        oxlint: null,
        eslint: UNTYPED_ESLINT_VERSION,
      }),
      buildInventoryRule('unicorn/prefer-dom-node-dataset', {
        oxlint: null,
        eslint: buildEslintImplementation({ deprecated: true, typed: false }),
      }),
    ])

    it('is not a RuleId when the canonical list does not name it', () => {
      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildEslintRoutingEntry('unicorn/dom-node-dataset', { typed: false, shipped: null, oxlintSpellings: [] }),
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
        buildEslintRoutingEntry('unicorn/dom-node-dataset', { typed: false, shipped: null, oxlintSpellings: [] }),
        buildEslintRoutingEntry('unicorn/prefer-dom-node-dataset', {
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
          eslint: UNTYPED_ESLINT_VERSION,
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildOxlintRoutingEntry('import-x/no-cycle', {
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
          eslint: UNTYPED_ESLINT_VERSION,
        }),
        buildInventoryRule('@typescript-eslint/no-unused-vars', {
          oxlint: null,
          eslint: UNTYPED_ESLINT_VERSION,
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildEslintRoutingEntry('@typescript-eslint/no-unused-vars', { typed: false, shipped: null, oxlintSpellings: [] }),
        buildOxlintRoutingEntry('no-unused-vars', {
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
          oxlint: OXLINT_NO_ARRAY_FOR_EACH,
          eslint: UNTYPED_ESLINT_VERSION,
        }),
        buildInventoryRule('unicorn/no-array-for-each', {
          oxlint: OXLINT_NO_ARRAY_FOR_EACH,
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
          oxlint: OXLINT_NO_ARRAY_FOR_EACH,
          eslint: UNTYPED_ESLINT_VERSION,
        }),
        buildInventoryRule('unicorn/no-thenable', {
          oxlint: OXLINT_NO_THENABLE,
          eslint: UNTYPED_ESLINT_VERSION,
        }),
      ])

      expect(buildRouting({ inventory, canonicalRules: [] })).toStrictEqual([
        buildOxlintRoutingEntry('unicorn/no-for-each', {
          oxlintName: 'unicorn/no-array-for-each',
          oxlintSpellings: oxlintSpellingsOf('unicorn/no-array-for-each'),
          oxlintPlugin: 'unicorn',
          eslintAliases: [],
          shipped: null,
        }),
        buildOxlintRoutingEntry('unicorn/no-thenable', {
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
      eslint: UNTYPED_ESLINT_VERSION,
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
        buildOxlintRoutingEntry('react-hooks/rules-of-hooks', {
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
          oxlint: TYPE_AWARE_OXLINT_NO_FLOATING_PROMISES,
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
          eslint: UNTYPED_ESLINT_VERSION,
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
        oxlint: OXLINT_NO_THENABLE,
        eslint: UNTYPED_ESLINT_VERSION,
      }),
      buildInventoryRule('sonarjs/cognitive-complexity', {
        oxlint: null,
        eslint: UNTYPED_ESLINT_VERSION,
      }),
      buildInventoryRule('@typescript-eslint/no-unused-vars', {
        oxlint: null,
        eslint: UNTYPED_ESLINT_VERSION,
      }),
    ])

    expect(buildRouting({ inventory, canonicalRules: [] }).map((route) => route.id)).toStrictEqual([
      '@typescript-eslint/no-unused-vars',
      'sonarjs/cognitive-complexity',
      'unicorn/no-thenable',
    ])
  })
})
