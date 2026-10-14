import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
  buildCatalog,
  buildEslintRoute,
  buildLibsRuleset,
  buildOxlintRoute,
  buildPluginRegistry,
  buildQualityRuleset,
  buildRuntimeRuleset,
  buildShippedRule,
} from '../__tests__/factories/catalog-factories.ts'
import { buildFileOverride, buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { buildEslintConfig } from './build-eslint-config.ts'
import { buildOxlintConfig } from './build-oxlint-config.ts'
import { resolveRuleLayers } from './resolve-rule-layers.ts'

// The tests build no typed block, so no TS file is left out of one.
const NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG: readonly string[] = []

const catalog = buildCatalog({
  rulesets: [
    buildQualityRuleset('correctness'),
    buildQualityRuleset('complexity'),
    buildLibsRuleset('storybook', 'testing'),
    buildRuntimeRuleset('node', 'node'),
    buildRuntimeRuleset('browser', 'browser'),
  ],
  rules: [
    buildOxlintRoute('eqeqeq', {
      oxlintName: 'eqeqeq',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness', { options: ['always'] }),
    }),
    buildOxlintRoute('no-debugger', {
      oxlintName: 'no-debugger',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness', { options: [] }),
    }),
    buildEslintRoute('max-lines', {
      typed: false,
      shipped: buildShippedRule('complexity', {
        options: [{ max: 200 }],
        files: ['**/*.tsx'],
        ignores: ['**/use-*.tsx'],
      }),
    }),
    buildEslintRoute('storybook/default-exports', {
      typed: false,
      shipped: buildShippedRule('storybook', { options: [], files: ['**/*.stories.tsx'] }),
    }),
    buildEslintRoute('n/prefer-global/buffer', {
      typed: false,
      shipped: buildShippedRule('node', { options: ['always'] }),
    }),
    buildEslintRoute('unicorn/prefer-dom-node-append', {
      typed: false,
      shipped: buildShippedRule('browser', { options: [] }),
    }),
    buildOxlintRoute('n/no-exports-assign', {
      oxlintName: 'node/no-exports-assign',
      oxlintPlugin: 'node',
      shipped: null,
    }),
    buildEslintRoute('sonarjs/no-duplicate-string', { typed: false, shipped: null }),
  ],
})

const pluginRegistry = buildPluginRegistry({
  n: ['prefer-global/buffer'],
  sonarjs: ['no-duplicate-string'],
  storybook: ['default-exports'],
  unicorn: ['prefer-dom-node-append'],
})

function blockNamed(config: readonly Linter.Config[], name: string): Linter.Config {
  const block = config.find((candidate) => candidate.name === name)
  if (block === undefined) throw new Error(`no block named ${name}`)
  return block
}

describe('resolveRuleLayers', () => {
  describe('the base', () => {
    it('holds every rule of every listed ruleset, at error with its shipped options and file scope', () => {
      const lintRules = buildLintRules({ quality: ['correctness', 'complexity'], runtimes: ['node'] })

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        eqeqeq: { severity: 'error', options: ['always'], files: null, ignores: null },
        'no-debugger': { severity: 'error', options: [], files: null, ignores: null },
        'max-lines': {
          severity: 'error',
          options: [{ max: 200 }],
          files: ['**/*.tsx'],
          ignores: ['**/use-*.tsx'],
        },
        'n/prefer-global/buffer': { severity: 'error', options: ['always'], files: null, ignores: null },
      })
    })

    it('holds no rule of a ruleset that is not listed', () => {
      const lintRules = buildLintRules({ quality: ['correctness'], runtimes: ['browser'] })

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        eqeqeq: { severity: 'error', options: ['always'], files: null, ignores: null },
        'no-debugger': { severity: 'error', options: [], files: null, ignores: null },
        'unicorn/prefer-dom-node-append': { severity: 'error', options: [], files: null, ignores: null },
      })
    })

    it('takes the env of every listed runtime', () => {
      const lintRules = buildLintRules({ runtimes: ['node', 'browser'] })

      expect(resolveRuleLayers(lintRules, catalog).env).toStrictEqual(['node', 'browser'])
    })

    it('has no file override layer when the config gives none', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] })

      expect(resolveRuleLayers(lintRules, catalog).fileOverrides).toStrictEqual([])
    })
  })

  describe('rules set on top of the rulesets', () => {
    it('keep the shipped options when they give only a severity', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] }, { rules: { eqeqeq: 'warn' } })

      expect(resolveRuleLayers(lintRules, catalog).rules['eqeqeq']).toStrictEqual({
        severity: 'warn',
        options: ['always'],
        files: null,
        ignores: null,
      })
    })

    it('replace the shipped options when they give options', () => {
      const lintRules = buildLintRules(
        { quality: ['correctness'] },
        { rules: { eqeqeq: ['error', 'smart'] } },
      )

      expect(resolveRuleLayers(lintRules, catalog).rules['eqeqeq']).toStrictEqual({
        severity: 'error',
        options: ['smart'],
        files: null,
        ignores: null,
      })
    })

    it('remove a shipped rule they turn off', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] }, { rules: { 'no-debugger': 'off' } })

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        eqeqeq: { severity: 'error', options: ['always'], files: null, ignores: null },
      })
    })

    it('enable a rule whose ruleset is not listed, keeping its shipped file scope', () => {
      const lintRules = buildLintRules({}, { rules: { 'storybook/default-exports': 'error' } })

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        'storybook/default-exports': {
          severity: 'error',
          options: [],
          files: ['**/*.stories.tsx'],
          ignores: null,
        },
      })
    })

    it('enable an available rule, in no ruleset, with the options given and no file scope', () => {
      const lintRules = buildLintRules(
        {},
        { rules: { 'sonarjs/no-duplicate-string': ['error', { threshold: 3 }] } },
      )

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        'sonarjs/no-duplicate-string': {
          severity: 'error',
          options: [{ threshold: 3 }],
          files: null,
          ignores: null,
        },
      })
    })
  })

  describe('an available rule enabled through rules', () => {
    const lintRules = buildLintRules(
      {},
      { rules: { 'n/no-exports-assign': 'error', 'sonarjs/no-duplicate-string': 'error' } },
    )

    it('runs in oxlint, under its oxlint name, when the catalog routes it to oxlint', () => {
      expect(buildOxlintConfig(lintRules, catalog).rules).toStrictEqual({
        'node/no-exports-assign': ['error'],
      })
    })

    it('runs in ESLint when the catalog routes it to ESLint', () => {
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(blockNamed(config, 'agents-inc/base').rules).toStrictEqual({
        'sonarjs/no-duplicate-string': ['error'],
      })
    })
  })

  describe('globs', () => {
    const slashFreeCatalog = buildCatalog({
      rulesets: [buildQualityRuleset('complexity')],
      rules: [
        buildEslintRoute('max-lines', {
          typed: false,
          shipped: buildShippedRule('complexity', {
            options: [],
            files: ['*.tsx'],
            ignores: ['use-*.tsx'],
          }),
        }),
      ],
    })

    it('match at any depth when the config writes them without a slash', () => {
      const lintRules = buildLintRules(
        { quality: ['complexity'] },
        {
          ignores: ['*.gen.ts', 'src/generated/**'],
          fileOverrides: [buildFileOverride(['*.test.ts'], { rules: { 'max-lines': 'off' } })],
        },
      )
      const layers = resolveRuleLayers(lintRules, slashFreeCatalog)

      expect(layers.ignores).toStrictEqual(['**/*.gen.ts', 'src/generated/**'])
      expect(layers.fileOverrides.map((layer) => layer.files)).toStrictEqual([['**/*.test.ts']])
    })

    it('match at any depth when the data writes them without a slash', () => {
      const lintRules = buildLintRules({ quality: ['complexity'] })

      expect(resolveRuleLayers(lintRules, slashFreeCatalog).rules['max-lines']).toStrictEqual({
        severity: 'error',
        options: [],
        files: ['**/*.tsx'],
        ignores: ['**/use-*.tsx'],
      })
    })
  })
})
