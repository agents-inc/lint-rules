import { buildShippedRule } from '@workspace/rule-data/test-support/shipped-rule-factories'
import { describe, expect, it } from 'vitest'
import { GLOBALS_OXLINT_OVERRIDES } from '../__tests__/cases/svelte-components.ts'
import {
  buildCatalog,
  buildEslintRoute,
  buildLibsRuleset,
  buildOxlintRoute,
  buildPluginRegistry,
  buildQualityRuleset,
  buildRuntimeRuleset,
} from '../__tests__/factories/catalog-factories.ts'
import { buildRulesetDefinition } from '../__tests__/factories/init-factories.ts'
import { buildFileOverride, buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { setUpEslintConfigOracle } from '../__tests__/eslint-config-oracle.ts'
import { buildProjectFacts } from '../__tests__/factories/project-facts-factories.ts'
import { oxlintConfigForFile, oxlintSeverityFor } from '../__tests__/oxlint-config-oracle.ts'
import { buildEslintConfig } from './build-eslint-config.ts'
import { buildOxlintConfig } from './build-oxlint-config.ts'
import { type FileOverrideLayer, resolveRuleLayers } from './resolve-rule-layers.ts'

const WARN = 1
const OFF_OR_ABSENT_SEVERITY = ['off', undefined]

const catalog = buildCatalog({
  rulesets: [
    buildQualityRuleset('correctness'),
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
    buildOxlintRoute('no-debugger', {
      oxlintName: 'no-debugger',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness', { options: [] }),
    }),
    buildOxlintRoute('react/jsx-key', {
      oxlintName: 'react/jsx-key',
      oxlintPlugin: 'react',
      shipped: buildShippedRule('react', { options: [] }),
    }),
    buildOxlintRoute('vitest/no-focused-tests', {
      oxlintName: 'vitest/no-focused-tests',
      oxlintPlugin: 'vitest',
      shipped: buildShippedRule('vitest', { options: [] }),
    }),
    buildEslintRoute('n/prefer-global/buffer', {
      typed: false,
      shipped: buildShippedRule('node', { options: ['always'] }),
    }),
    buildEslintRoute('unicorn/prefer-dom-node-append', {
      typed: false,
      shipped: buildShippedRule('browser', { options: [] }),
    }),
    buildOxlintRoute('unicorn/prefer-add-event-listener', {
      oxlintName: 'unicorn/prefer-add-event-listener',
      oxlintPlugin: 'unicorn',
      shipped: buildShippedRule('browser', { options: [] }),
    }),
  ],
})

const pluginRegistry = buildPluginRegistry({
  n: ['prefer-global/buffer'],
  unicorn: ['prefer-dom-node-append'],
})

const everyTopLevelRuleset = {
  quality: ['correctness'],
  libs: { ui: ['react'], testing: ['vitest'] },
  runtimes: ['node', 'browser'],
}

// One ruleset in the languages list: the one list read with a default where an entry writes it undefined. Quality, libs
// or runtimes written undefined stop at a TypeError before an entry's lists are compared with an earlier entry's.
const languagesCatalog = buildCatalog({
  rulesets: [buildRulesetDefinition({ name: 'json', list: 'languages' })],
  rules: [buildEslintRoute('jsonc/no-dupe-keys', { typed: false, shipped: buildShippedRule('json') })],
})
const ALL_DATA = ['data/**']
const GENERATED_DATA = ['data/generated/**']
const NO_ENV_CHANGE = { enabled: [], disabled: [] }

function isDefinedGlobal(value: unknown): boolean {
  return value !== undefined && value !== 'off'
}

/** The layer of an entry for generated data, after an entry adding json for all data. */
function generatedDataLayerOf(generatedData: ReturnType<typeof buildFileOverride>): FileOverrideLayer | undefined {
  const lintRules = buildLintRules({}, {
    fileOverrides: [buildFileOverride(ALL_DATA, { rulesets: { languages: ['json'] } }), generatedData],
  })
  return resolveRuleLayers(lintRules, languagesCatalog).fileOverrides.at(1)
}

const { globalsFor, ruleEntryFor, ruleSeverityFor } = setUpEslintConfigOracle()

describe('file overrides', () => {
  describe('the rulesets an entry gives', () => {
    it('replace the top-level list they name for the entry\'s files', () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, {
        fileOverrides: [buildFileOverride(['apps/api/**'], { rulesets: { runtimes: ['node'] } })],
      })

      expect(resolveRuleLayers(lintRules, catalog).fileOverrides).toStrictEqual([
        {
          files: ['apps/api/**'],
          env: { enabled: [], disabled: ['browser'] },
          rulesetChanges: {
            'unicorn/prefer-add-event-listener': { severity: 'off', options: [], files: null, ignores: null },
            'unicorn/prefer-dom-node-append': { severity: 'off', options: [], files: null, ignores: null },
          },
          rules: {},
        },
      ])
    })

    it('inherit every list the entry leaves out', () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, {
        fileOverrides: [
          buildFileOverride(['apps/web/**'], {
            rulesets: { libs: { ui: ['react'], testing: ['vitest'] } },
          }),
        ],
      })

      expect(resolveRuleLayers(lintRules, catalog).fileOverrides).toStrictEqual([
        { files: ['apps/web/**'], env: { enabled: [], disabled: [] }, rulesetChanges: {}, rules: {} },
      ])
    })

    it('drop every libs ruleset for the entry\'s files when libs is empty', () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, {
        fileOverrides: [buildFileOverride(['apps/api/**'], { rulesets: { libs: {} } })],
      })

      expect(resolveRuleLayers(lintRules, catalog).fileOverrides).toStrictEqual([
        {
          files: ['apps/api/**'],
          env: { enabled: [], disabled: [] },
          rulesetChanges: {
            'react/jsx-key': { severity: 'off', options: [], files: null, ignores: null },
            'vitest/no-focused-tests': { severity: 'off', options: [], files: null, ignores: null },
          },
          rules: {},
        },
      ])
    })

    it('replace the whole libs map rather than one domain of it', () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, {
        fileOverrides: [buildFileOverride(['apps/web/**'], { rulesets: { libs: { ui: ['react'] } } })],
      })

      expect(resolveRuleLayers(lintRules, catalog).fileOverrides).toStrictEqual([
        {
          files: ['apps/web/**'],
          env: { enabled: [], disabled: [] },
          rulesetChanges: {
            'vitest/no-focused-tests': { severity: 'off', options: [], files: null, ignores: null },
          },
          rules: {},
        },
      ])
    })

    it('turn on the rules of a ruleset the entry adds, with their shipped options', () => {
      const lintRules = buildLintRules(
        { runtimes: ['browser'] },
        { fileOverrides: [buildFileOverride(['apps/api/**'], { rulesets: { runtimes: ['node', 'browser'] } })] },
      )

      expect(resolveRuleLayers(lintRules, catalog).fileOverrides).toStrictEqual([
        {
          files: ['apps/api/**'],
          env: { enabled: ['node'], disabled: [] },
          rulesetChanges: {
            'n/prefer-global/buffer': { severity: 'error', options: ['always'], files: null, ignores: null },
          },
          rules: {},
        },
      ])
    })
  })

  describe('dropping browser while node stays', () => {
    const fields = {
      fileOverrides: [buildFileOverride(['apps/api/**'], { rulesets: { runtimes: ['node'] } })],
    }
    it('leaves console defined in ESLint, since node defines it too, and removes window', async () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)
      const globals = await globalsFor(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), 'apps/api/a.ts')

      expect(['off', undefined]).not.toContain(globals['console'])
      expect(globals['window']).toBe('off')
    })

    it('switches only the browser env off in oxlint', () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)

      expect(buildOxlintConfig(lintRules, catalog).overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        {
          files: ['apps/api/**'],
          env: { browser: false },
          rules: { 'unicorn/prefer-add-event-listener': 'off' },
        },
      ])
    })
  })

  describe('the rules an entry gives', () => {
    const fields = {
      fileOverrides: [
        buildFileOverride(['apps/api/**'], {
          rulesets: { runtimes: ['node'] },
          rules: { 'unicorn/prefer-dom-node-append': 'warn', eqeqeq: 'warn' },
        }),
      ],
    }
    it('are kept apart from the ruleset changes in the layer', () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)

      expect(resolveRuleLayers(lintRules, catalog).fileOverrides).toStrictEqual([
        {
          files: ['apps/api/**'],
          env: { enabled: [], disabled: ['browser'] },
          rulesetChanges: {
            'unicorn/prefer-add-event-listener': { severity: 'off', options: [], files: null, ignores: null },
            'unicorn/prefer-dom-node-append': { severity: 'off', options: [], files: null, ignores: null },
          },
          rules: {
            'unicorn/prefer-dom-node-append': { severity: 'warn', options: [], files: null, ignores: null },
            eqeqeq: { severity: 'warn', options: ['always'], files: null, ignores: null },
          },
        },
      ])
    })

    it('win over the ruleset changes in ESLint', async () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(await ruleEntryFor(config, 'apps/api/a.ts', 'unicorn/prefer-dom-node-append')).toStrictEqual([WARN])
    })

    it('come after the ruleset changes in oxlint, with severity and options in full', () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)

      expect(buildOxlintConfig(lintRules, catalog).overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        {
          files: ['apps/api/**'],
          env: { browser: false },
          rules: { 'unicorn/prefer-add-event-listener': 'off' },
        },
        {
          files: ['apps/api/**'],
          rules: { eqeqeq: ['warn', 'always'] },
        },
      ])
    })
  })

  describe('two entries whose globs overlap', () => {
    const fields = {
      fileOverrides: [
        buildFileOverride(['apps/**'], { rules: { eqeqeq: 'warn', 'n/prefer-global/buffer': 'warn' } }),
        buildFileOverride(['apps/api/**'], { rules: { eqeqeq: 'off', 'n/prefer-global/buffer': 'off' } }),
      ],
    }
    it('keep their order as layers', () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)

      expect(resolveRuleLayers(lintRules, catalog).fileOverrides.map((layer) => layer.files)).toStrictEqual([
        ['apps/**'],
        ['apps/api/**'],
      ])
    })

    it('keep their order in oxlint, so the later one wins', () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)

      expect(buildOxlintConfig(lintRules, catalog).overrides).toStrictEqual([
        ...GLOBALS_OXLINT_OVERRIDES,
        { files: ['apps/**'], rules: { eqeqeq: ['warn', 'always'] } },
        { files: ['apps/api/**'], rules: { eqeqeq: 'off' } },
      ])
    })

    it('let the later one win in ESLint where both match, and the earlier one apply alone', async () => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(OFF_OR_ABSENT_SEVERITY).toContain(await ruleSeverityFor(config, 'apps/api/a.ts', 'n/prefer-global/buffer'))
      expect(await ruleSeverityFor(config, 'apps/web/a.ts', 'n/prefer-global/buffer')).toBe('warn')
    })
  })

  // An entry restates only the lists it gives, so where it overlaps one that dropped browser, browser stays
  // dropped. Its files are not test files, which get the test runners' env besides.
  describe('an entry that sets runtimes, then an overlapping one that sets rules only', () => {
    const fields = {
      fileOverrides: [
        buildFileOverride(['apps/api/**'], { rulesets: { runtimes: ['node'] } }),
        buildFileOverride(['**/handlers/**'], { rules: { eqeqeq: 'warn', 'n/prefer-global/buffer': 'warn' } }),
      ],
    }
    const RUNTIME_GLOBALS = ['process', 'window']
    const filesByEntriesMatching = [
      {
        matching: 'both entries, so the runtimes of the earlier one and the rules of the later one',
        file: 'apps/api/handlers/x.ts',
        eslintRules: { 'n/prefer-global/buffer': 'warn', 'unicorn/prefer-dom-node-append': 'off' },
        oxlintRules: { eqeqeq: 'warn', 'unicorn/prefer-add-event-listener': 'off' },
        env: { node: true, browser: false },
        definedGlobals: ['process'],
      },
      {
        matching: 'the later entry alone',
        file: 'apps/web/handlers/x.ts',
        eslintRules: { 'n/prefer-global/buffer': 'warn', 'unicorn/prefer-dom-node-append': 'error' },
        oxlintRules: { eqeqeq: 'warn', 'unicorn/prefer-add-event-listener': 'error' },
        env: { node: true, browser: true },
        definedGlobals: ['process', 'window'],
      },
      {
        matching: 'the earlier entry alone',
        file: 'apps/api/x.ts',
        eslintRules: { 'n/prefer-global/buffer': 'error', 'unicorn/prefer-dom-node-append': 'off' },
        oxlintRules: { eqeqeq: 'error', 'unicorn/prefer-add-event-listener': 'off' },
        env: { node: true, browser: false },
        definedGlobals: ['process'],
      },
    ]

    it.each(filesByEntriesMatching)('apply the rules of $matching in ESLint, to $file', async ({ file, eslintRules }) => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())
      const severities = Object.fromEntries(
        await Promise.all(Object.keys(eslintRules).map(async (id): Promise<[string, unknown]> => [id, await ruleSeverityFor(config, file, id)])),
      )

      expect(severities).toStrictEqual(eslintRules)
    })

    it.each(filesByEntriesMatching)('define the globals of $matching in ESLint, in $file', async ({ file, definedGlobals }) => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)
      const globals = await globalsFor(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), file)

      expect(RUNTIME_GLOBALS.filter((name) => isDefinedGlobal(globals[name]))).toStrictEqual(definedGlobals)
    })

    it.each(filesByEntriesMatching)('apply the rules of $matching in oxlint, to $file', ({ file, oxlintRules }) => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)
      const config = buildOxlintConfig(lintRules, catalog)
      const severities = Object.fromEntries(
        Object.keys(oxlintRules).map((oxlintName) => [oxlintName, oxlintSeverityFor(config, file, oxlintName)]),
      )

      expect(severities).toStrictEqual(oxlintRules)
    })

    it.each(filesByEntriesMatching)('switch on the env of $matching in oxlint, for $file', ({ file, env }) => {
      const lintRules = buildLintRules(everyTopLevelRuleset, fields)

      expect(oxlintConfigForFile(buildOxlintConfig(lintRules, catalog), file).env).toStrictEqual({
        builtin: true,
        es2024: true,
        ...env,
      })
    })
  })

  // Where two entries match, the later one's rulesets apply in full, including what the earlier one switched off.
  describe('two entries that set rulesets, whose globs overlap', () => {
    const rulesetCatalog = buildCatalog({
      rulesets: [
        buildLibsRuleset('react', 'ui'),
        buildLibsRuleset('vitest', 'testing'),
        buildRuntimeRuleset('node', 'node'),
        buildRuntimeRuleset('browser', 'browser'),
      ],
      rules: [
        buildEslintRoute('@eslint-react/no-missing-key', { typed: false, shipped: buildShippedRule('react') }),
        buildOxlintRoute('react/jsx-key', {
          oxlintName: 'react/jsx-key',
          oxlintPlugin: 'react',
          shipped: buildShippedRule('react'),
        }),
        buildEslintRoute('vitest/valid-title', { typed: false, shipped: buildShippedRule('vitest') }),
        buildOxlintRoute('vitest/no-focused-tests', {
          oxlintName: 'vitest/no-focused-tests',
          oxlintPlugin: 'vitest',
          shipped: buildShippedRule('vitest'),
        }),
        buildEslintRoute('n/prefer-global/buffer', { typed: false, shipped: buildShippedRule('node') }),
        buildOxlintRoute('n/no-exports-assign', {
          oxlintName: 'node/no-exports-assign',
          oxlintPlugin: 'node',
          shipped: buildShippedRule('node'),
        }),
        buildEslintRoute('unicorn/prefer-dom-node-append', { typed: false, shipped: buildShippedRule('browser') }),
        buildOxlintRoute('unicorn/prefer-add-event-listener', {
          oxlintName: 'unicorn/prefer-add-event-listener',
          oxlintPlugin: 'unicorn',
          shipped: buildShippedRule('browser'),
        }),
      ],
    })
    const rulesetPluginRegistry = buildPluginRegistry({
      '@eslint-react': ['no-missing-key'],
      n: ['prefer-global/buffer'],
      unicorn: ['prefer-dom-node-append'],
      vitest: ['valid-title'],
    })
    const RUNTIME_GLOBALS = ['process', 'window']

    describe('runtimes: everything server-side, then the web app browser-only', () => {
      const rulesets = { runtimes: ['node', 'browser'] }
      const fields = {
        fileOverrides: [
          buildFileOverride(['apps/**'], { rulesets: { runtimes: ['node'] } }),
          buildFileOverride(['apps/web/**'], { rulesets: { runtimes: ['browser'] } }),
        ],
      }
      const filesByEntriesMatching = [
        {
          matching: 'both entries, so the later one',
          file: 'apps/web/a.ts',
          eslintRules: { 'n/prefer-global/buffer': 'off', 'unicorn/prefer-dom-node-append': 'error' },
          oxlintRules: { 'node/no-exports-assign': 'off', 'unicorn/prefer-add-event-listener': 'error' },
          env: { node: false, browser: true },
          definedGlobals: ['window'],
        },
        {
          matching: 'the earlier entry alone',
          file: 'apps/api/a.ts',
          eslintRules: { 'n/prefer-global/buffer': 'error', 'unicorn/prefer-dom-node-append': 'off' },
          oxlintRules: { 'node/no-exports-assign': 'error', 'unicorn/prefer-add-event-listener': 'off' },
          env: { node: true, browser: false },
          definedGlobals: ['process'],
        },
        {
          matching: 'neither entry, so the top level',
          file: 'libs/a.ts',
          eslintRules: { 'n/prefer-global/buffer': 'error', 'unicorn/prefer-dom-node-append': 'error' },
          oxlintRules: { 'node/no-exports-assign': 'error', 'unicorn/prefer-add-event-listener': 'error' },
          env: { node: true, browser: true },
          definedGlobals: ['process', 'window'],
        },
      ]

      it.each(filesByEntriesMatching)(
        'apply the runtime rules of $matching in ESLint, to $file',
        async ({ file, eslintRules }) => {
          const lintRules = buildLintRules(rulesets, fields)
          const config = buildEslintConfig(lintRules, rulesetCatalog, rulesetPluginRegistry, buildProjectFacts())
          const severities = Object.fromEntries(
            await Promise.all(
              Object.keys(eslintRules).map(async (id): Promise<[string, unknown]> => [id, await ruleSeverityFor(config, file, id)]),
            ),
          )

          expect(severities).toStrictEqual(eslintRules)
        },
      )

      it.each(filesByEntriesMatching)(
        'define the runtime globals of $matching in ESLint, in $file',
        async ({ file, definedGlobals }) => {
          const lintRules = buildLintRules(rulesets, fields)
          const config = buildEslintConfig(lintRules, rulesetCatalog, rulesetPluginRegistry, buildProjectFacts())
          const globals = await globalsFor(config, file)

          expect(RUNTIME_GLOBALS.filter((name) => isDefinedGlobal(globals[name]))).toStrictEqual(definedGlobals)
        },
      )

      it.each(filesByEntriesMatching)(
        'apply the runtime rules of $matching in oxlint, to $file',
        ({ file, oxlintRules }) => {
          const lintRules = buildLintRules(rulesets, fields)
          const config = buildOxlintConfig(lintRules, rulesetCatalog)
          const severities = Object.fromEntries(
            Object.keys(oxlintRules).map((oxlintName) => [oxlintName, oxlintSeverityFor(config, file, oxlintName)]),
          )

          expect(severities).toStrictEqual(oxlintRules)
        },
      )

      it.each(filesByEntriesMatching)('switch on the env of $matching in oxlint, for $file', ({ file, env }) => {
        const lintRules = buildLintRules(rulesets, fields)

        expect(oxlintConfigForFile(buildOxlintConfig(lintRules, rulesetCatalog), file).env).toStrictEqual({
          builtin: true,
          es2024: true,
          ...env,
        })
      })
    })

    describe('libs: no libs anywhere in apps, then react for the web app', () => {
      const rulesets = { libs: { ui: ['react'], testing: ['vitest'] } }
      const fields = {
        fileOverrides: [
          buildFileOverride(['apps/**'], { rulesets: { libs: {} } }),
          buildFileOverride(['apps/web/**'], { rulesets: { libs: { ui: ['react'] } } }),
        ],
      }
      const filesByEntriesMatching = [
        {
          matching: 'both entries, so the later one',
          file: 'apps/web/a.tsx',
          eslintRules: { '@eslint-react/no-missing-key': 'error', 'vitest/valid-title': 'off' },
          oxlintRules: { 'react/jsx-key': 'error', 'vitest/no-focused-tests': 'off' },
        },
        {
          matching: 'the earlier entry alone',
          file: 'apps/api/a.tsx',
          eslintRules: { '@eslint-react/no-missing-key': 'off', 'vitest/valid-title': 'off' },
          oxlintRules: { 'react/jsx-key': 'off', 'vitest/no-focused-tests': 'off' },
        },
        {
          matching: 'neither entry, so the top level',
          file: 'libs/a.tsx',
          eslintRules: { '@eslint-react/no-missing-key': 'error', 'vitest/valid-title': 'error' },
          oxlintRules: { 'react/jsx-key': 'error', 'vitest/no-focused-tests': 'error' },
        },
      ]

      it.each(filesByEntriesMatching)(
        'apply the libs rules of $matching in ESLint, to $file',
        async ({ file, eslintRules }) => {
          const lintRules = buildLintRules(rulesets, fields)
          const config = buildEslintConfig(lintRules, rulesetCatalog, rulesetPluginRegistry, buildProjectFacts())
          const severities = Object.fromEntries(
            await Promise.all(
              Object.keys(eslintRules).map(async (id): Promise<[string, unknown]> => [id, await ruleSeverityFor(config, file, id)]),
            ),
          )

          expect(severities).toStrictEqual(eslintRules)
        },
      )

      it.each(filesByEntriesMatching)('apply the libs rules of $matching in oxlint, to $file', ({ file, oxlintRules }) => {
        const lintRules = buildLintRules(rulesets, fields)
        const config = buildOxlintConfig(lintRules, rulesetCatalog)
        const severities = Object.fromEntries(
          Object.keys(oxlintRules).map((oxlintName) => [oxlintName, oxlintSeverityFor(config, file, oxlintName)]),
        )

        expect(severities).toStrictEqual(oxlintRules)
      })
    })
  })

  // A later entry restates what an earlier overlapping one changed only in a list it gives. A config nobody
  // type-checks may write a list undefined, which the types refuse.
  describe('a later entry over one adding a ruleset of a list', () => {
    it('restates nothing where it writes that list undefined, as where it leaves the list out, and turns the rule off where it gives it empty', () => {
      expect({
        // @ts-expect-error a list the types take is never undefined, though a config nobody type-checks may write one
        writtenUndefined: generatedDataLayerOf(buildFileOverride(GENERATED_DATA, { rulesets: { languages: undefined } })),
        leftOut: generatedDataLayerOf(buildFileOverride(GENERATED_DATA, { rulesets: {} })),
        givenEmpty: generatedDataLayerOf(buildFileOverride(GENERATED_DATA, { rulesets: { languages: [] } })),
      }).toStrictEqual({
        writtenUndefined: { files: GENERATED_DATA, env: NO_ENV_CHANGE, rulesetChanges: {}, rules: {} },
        leftOut: { files: GENERATED_DATA, env: NO_ENV_CHANGE, rulesetChanges: {}, rules: {} },
        givenEmpty: {
          files: GENERATED_DATA,
          env: NO_ENV_CHANGE,
          rulesetChanges: { 'jsonc/no-dupe-keys': { severity: 'off', options: [], files: null, ignores: null } },
          rules: {},
        },
      })
    })
  })
})
