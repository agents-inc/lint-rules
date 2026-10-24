import { buildShippedRule } from '@workspace/rule-data/test-support/shipped-rule-factories'
import { describe, expect, it } from 'vitest'
import { GLOBALS_OXLINT_OVERRIDES } from '../__tests__/cases/svelte-components.ts'
import {
  buildCatalog,
  buildEslintRoute,
  buildLibsRuleset,
  buildOxlintRoute,
  buildQualityRuleset,
  buildRuntimeRuleset,
} from '../__tests__/factories/catalog-factories.ts'
import { buildFileOverride, buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { oxlintSeverityFor } from '../__tests__/oxlint-config-oracle.ts'
import { buildOxlintConfig } from './build-oxlint-config.ts'
import type { LintRulesInput } from './lint-rules-input.ts'

/** What an entry does to the rule, as a title names it, the lint rules giving that entry, and the rule's severity in each file. */
type EntrySettingTheRule = { readonly entryDoes: string; readonly lintRules: () => LintRulesInput; readonly severities: Readonly<Record<string, string>> }

const EVERY_CATEGORY_OFF = {
  correctness: 'off',
  nursery: 'off',
  pedantic: 'off',
  perf: 'off',
  restriction: 'off',
  style: 'off',
  suspicious: 'off',
}

const catalog = buildCatalog({
  rulesets: [
    buildQualityRuleset('correctness'),
    buildQualityRuleset('complexity'),
    buildQualityRuleset('performance'),
    buildLibsRuleset('react', 'ui'),
    buildLibsRuleset('vitest', 'testing'),
    buildRuntimeRuleset('node', 'node'),
    buildRuntimeRuleset('browser', 'browser'),
  ],
  rules: [
    buildOxlintRoute('eqeqeq', {
      oxlintName: 'eqeqeq',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness', { options: ['always'] }),
    }),
    buildOxlintRoute('jsx-a11y/alt-text', {
      oxlintName: 'jsx_a11y/alt-text',
      oxlintPlugin: 'jsx-a11y',
      shipped: buildShippedRule('correctness', { options: [] }),
    }),
    buildOxlintRoute('no-debugger', {
      oxlintName: 'no-debugger',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness', { options: [] }),
      oxlintSpellings: ['no-debugger', 'eslint/no-debugger'],
    }),
    buildOxlintRoute('@typescript-eslint/no-explicit-any', {
      oxlintName: 'typescript/no-explicit-any',
      oxlintPlugin: 'typescript',
      shipped: null,
      oxlintSpellings: [
        'typescript/no-explicit-any',
        '@typescript-eslint/no-explicit-any',
        'typescript-eslint/no-explicit-any',
      ],
    }),
    buildOxlintRoute('unicorn/no-null', {
      oxlintName: 'unicorn/no-null',
      oxlintPlugin: 'unicorn',
      shipped: null,
      oxlintSpellings: ['unicorn/no-null', 'eslint-plugin-unicorn/no-null'],
    }),
    // ESLint runs it; oxlint implements it too, under these names.
    buildEslintRoute('@typescript-eslint/array-type', {
      typed: false,
      shipped: null,
      oxlintSpellings: ['typescript/array-type', '@typescript-eslint/array-type', 'typescript-eslint/array-type'],
    }),
    buildEslintRoute('max-lines', {
      typed: false,
      shipped: buildShippedRule('complexity', { options: [{ max: 200 }] }),
    }),
    buildOxlintRoute('oxc/no-accumulating-spread', {
      oxlintName: 'oxc/no-accumulating-spread',
      oxlintPlugin: 'oxc',
      shipped: buildShippedRule('performance', { options: [], ignores: ['**/*.test.ts'] }),
    }),
    buildOxlintRoute('react-hooks/rules-of-hooks', {
      oxlintName: 'react/rules-of-hooks',
      oxlintPlugin: 'react',
      shipped: buildShippedRule('react', { options: [], ignores: ['**/*.stories.tsx'] }),
    }),
    buildOxlintRoute('vitest/no-focused-tests', {
      oxlintName: 'vitest/no-focused-tests',
      oxlintPlugin: 'vitest',
      shipped: buildShippedRule('vitest', { options: [] }),
    }),
    buildOxlintRoute('n/no-exports-assign', {
      oxlintName: 'node/no-exports-assign',
      oxlintPlugin: 'node',
      shipped: buildShippedRule('node', { options: [] }),
    }),
    buildOxlintRoute('unicorn/prefer-add-event-listener', {
      oxlintName: 'unicorn/prefer-add-event-listener',
      oxlintPlugin: 'unicorn',
      shipped: buildShippedRule('browser', { options: [] }),
    }),
  ],
})

describe('buildOxlintConfig', () => {
  it('returns a complete config: every category off, the plugins of its rules, env, ignores, options, and React 18.3.0 for the react plugin', () => {
    const lintRules = buildLintRules(
      { quality: ['correctness', 'complexity'], runtimes: ['node'] },
      { ignores: ['src/generated/**'] },
    )

    expect(buildOxlintConfig(lintRules, catalog)).toStrictEqual({
      categories: EVERY_CATEGORY_OFF,
      plugins: ['eslint', 'jsx-a11y', 'node'],
      env: { builtin: true, es2024: true, node: true },
      ignorePatterns: ['**/node_modules/**', 'src/generated/**'],
      options: { reportUnusedDisableDirectives: 'off' },
      settings: { react: { version: '18.3.0' } },
      rules: {
        eqeqeq: ['error', 'always'],
        'jsx_a11y/alt-text': ['error'],
        'no-debugger': ['error'],
        'node/no-exports-assign': ['error'],
      },
      overrides: [...GLOBALS_OXLINT_OVERRIDES],
    })
  })

  describe('ignorePatterns', () => {
    it('ignore node_modules when the config ignores nothing, as ESLint already does', () => {
      const lintRules = buildLintRules({}, { ignores: [] })

      expect(buildOxlintConfig(lintRules, catalog).ignorePatterns).toStrictEqual(['**/node_modules/**'])
    })

    it('match a slash-free ignore at any depth', () => {
      const lintRules = buildLintRules({}, { ignores: ['*.gen.ts'] })

      expect(buildOxlintConfig(lintRules, catalog).ignorePatterns).toStrictEqual([
        '**/node_modules/**',
        '**/*.gen.ts',
      ])
    })
  })

  describe('env', () => {
    it('turns on every listed runtime', () => {
      const lintRules = buildLintRules({ runtimes: ['node', 'browser'] })

      expect(buildOxlintConfig(lintRules, catalog).env).toStrictEqual({
        builtin: true,
        es2024: true,
        node: true,
        browser: true,
      })
    })

    it('turns on no runtime when none is listed', () => {
      const lintRules = buildLintRules({ runtimes: [] })

      expect(buildOxlintConfig(lintRules, catalog).env).toStrictEqual({ builtin: true, es2024: true })
    })
  })

  describe('rules', () => {
    it('keep the shipped options when the config sets only a severity', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] }, { rules: { eqeqeq: 'warn' } })

      expect(buildOxlintConfig(lintRules, catalog).rules).toStrictEqual({
        eqeqeq: ['warn', 'always'],
        'jsx_a11y/alt-text': ['error'],
        'no-debugger': ['error'],
      })
    })

    it('leave out a rule the config turns off', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] }, { rules: { 'no-debugger': 'off' } })

      expect(buildOxlintConfig(lintRules, catalog).rules).toStrictEqual({
        eqeqeq: ['error', 'always'],
        'jsx_a11y/alt-text': ['error'],
      })
    })

    it('turn a rule off under its built-in ignores', () => {
      const lintRules = buildLintRules({ libs: { ui: ['react'] } })
      const config = buildOxlintConfig(lintRules, catalog)

      expect(config.rules).toStrictEqual({ 'react/rules-of-hooks': ['error'] })
      expect(config.overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        { files: ['**/*.stories.tsx'], rules: { 'react/rules-of-hooks': 'off' } },
      ])
    })
  })

  describe('file overrides', () => {
    it('list the plugin of a rule that only a file override turns on', () => {
      const lintRules = buildLintRules(
        { quality: ['correctness'] },
        {
          fileOverrides: [
            buildFileOverride(['**/*.test.ts'], { rulesets: { libs: { testing: ['vitest'] } } }),
          ],
        },
      )
      const config = buildOxlintConfig(lintRules, catalog)

      expect(config.plugins).toStrictEqual(['eslint', 'jsx-a11y', 'vitest'])
      expect(config.overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        { files: ['**/*.test.ts'], rules: { 'vitest/no-focused-tests': ['error'] } },
      ])
    })

    it('exclude a rule they add from its own built-in ignores', () => {
      const lintRules = buildLintRules(
        { quality: ['correctness'] },
        {
          fileOverrides: [
            buildFileOverride(['src/**'], { rulesets: { quality: ['correctness', 'performance'] } }),
          ],
        },
      )

      expect(buildOxlintConfig(lintRules, catalog).overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        {
          files: ['src/**'],
          excludeFiles: ['**/*.test.ts'],
          rules: { 'oxc/no-accumulating-spread': ['error'] },
        },
      ])
    })

    // oxc/no-accumulating-spread ships ignoring **/*.test.ts; an entry setting it never widens it onto those files.
    describe('whose own rules set a rule shipped with ignores', () => {
      const entriesSettingTheRule: readonly EntrySettingTheRule[] = [
        {
          entryDoes: 'softens it while its ruleset is listed',
          lintRules() {
            return buildLintRules(
              { quality: ['performance'] },
              { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'oxc/no-accumulating-spread': 'warn' } })] },
            )
          },
          severities: { 'src/a.ts': 'warn', 'src/a.test.ts': 'off', 'lib/a.ts': 'error' },
        },
        {
          entryDoes: 'turns it on while its ruleset is unlisted',
          lintRules() {
            return buildLintRules(
              {},
              { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'oxc/no-accumulating-spread': 'error' } })] },
            )
          },
          severities: { 'src/a.ts': 'error', 'src/a.test.ts': 'off', 'lib/a.ts': 'off' },
        },
      ]

      it.each(entriesSettingTheRule)('keep it off under its ignores when the entry $entryDoes', ({ lintRules, severities }) => {
        const config = buildOxlintConfig(lintRules(), catalog)
        const applied = Object.fromEntries(
          Object.keys(severities).map((file) => [
            file,
            oxlintSeverityFor(config, file, 'oxc/no-accumulating-spread') ?? 'off',
          ]),
        )

        expect(applied).toStrictEqual(severities)
      })
    })

    it('carry the severity and the options of every rule they turn on, and off for the rest', () => {
      const lintRules = buildLintRules(
        { quality: ['correctness'] },
        {
          fileOverrides: [
            buildFileOverride(['**/*.test.ts'], { rules: { eqeqeq: 'warn', 'no-debugger': 'off' } }),
          ],
        },
      )

      expect(buildOxlintConfig(lintRules, catalog).overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        { files: ['**/*.test.ts'], rules: { eqeqeq: ['warn', 'always'], 'no-debugger': 'off' } },
      ])
    })

    it('switch off the env and the rules of a runtime they drop', () => {
      const lintRules = buildLintRules(
        { runtimes: ['node', 'browser'] },
        { fileOverrides: [buildFileOverride(['apps/api/**'], { rulesets: { runtimes: ['node'] } })] },
      )

      expect(buildOxlintConfig(lintRules, catalog).overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        {
          files: ['apps/api/**'],
          env: { browser: false },
          rules: { 'unicorn/prefer-add-event-listener': 'off' },
        },
      ])
    })

    it('switch on the env and the rules of a runtime they add', () => {
      const lintRules = buildLintRules(
        { runtimes: ['browser'] },
        {
          fileOverrides: [
            buildFileOverride(['apps/api/**'], { rulesets: { runtimes: ['node', 'browser'] } }),
          ],
        },
      )
      const config = buildOxlintConfig(lintRules, catalog)

      expect(config.plugins).toStrictEqual(['node', 'unicorn'])
      expect(config.overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        {
          files: ['apps/api/**'],
          env: { node: true },
          rules: { 'node/no-exports-assign': ['error'] },
        },
      ])
    })

    it('come after the built-in overrides, each entry\'s ruleset changes before its own rules', () => {
      const lintRules = buildLintRules(
        { libs: { ui: ['react'] }, runtimes: ['node', 'browser'] },
        {
          fileOverrides: [
            buildFileOverride(['apps/api/**'], {
              rulesets: { runtimes: ['node'] },
              rules: { 'unicorn/prefer-add-event-listener': 'warn' },
            }),
          ],
        },
      )

      expect(buildOxlintConfig(lintRules, catalog).overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        { files: ['**/*.stories.tsx'], rules: { 'react/rules-of-hooks': 'off' } },
        {
          files: ['apps/api/**'],
          env: { browser: false },
          rules: { 'unicorn/prefer-add-event-listener': 'off' },
        },
        { files: ['apps/api/**'], rules: { 'unicorn/prefer-add-event-listener': ['warn'] } },
      ])
    })
  })

  describe('the lint rules it is given', () => {
    it('build when they are valid', () => {
      const lintRules = buildLintRules({}, { rules: { 'no-debugger': 'error' } })

      expect(buildOxlintConfig(lintRules, catalog).rules).toStrictEqual({ 'no-debugger': ['error'] })
    })
  })

  // oxlint cannot turn a rule on in files of its own, so the catalog must route such a rule to ESLint.
  describe('given a catalog routing to oxlint a rule shipped with files of its own', () => {
    const catalogWithAFileScopedOxlintRule = buildCatalog({
      rulesets: [buildQualityRuleset('correctness')],
      rules: [
        buildOxlintRoute('no-debugger', {
          oxlintName: 'no-debugger',
          oxlintPlugin: 'eslint',
          shipped: buildShippedRule('correctness', { files: ['**/*.tsx'] }),
        }),
      ],
    })

    it('refuses to turn the rule on, naming it', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] })

      expect(() => buildOxlintConfig(lintRules, catalogWithAFileScopedOxlintRule)).toThrow(
        new Error('no-debugger: turned on in files of its own, so the catalog must route it to ESLint'),
      )
    })

    it('turns the rule off where an entry does, within its own files', () => {
      const lintRules = buildLintRules({}, { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'no-debugger': 'off' } })] })

      expect(buildOxlintConfig(lintRules, catalogWithAFileScopedOxlintRule).overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        { files: ['src/**/*.tsx'], rules: { 'no-debugger': 'off' } },
      ])
    })
  })
})
