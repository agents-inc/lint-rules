import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { ESLint, Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { SVELTE_RUNES_ESLINT_BLOCK_NAME } from '../__tests__/cases/svelte-components.ts'
import {
  buildCatalog,
  buildEslintRoute,
  buildFakePlugin,
  buildLibsRuleset,
  buildOxlintRoute,
  buildPluginRegistry,
  buildQualityRuleset,
  buildRuntimeRuleset,
  buildShippedRule,
} from '../__tests__/factories/catalog-factories.ts'
import { buildFileOverride, buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { setUpEslintConfigOracle } from '../__tests__/eslint-config-oracle.ts'
import { buildEslintConfig, eslintBlocksBeforeTheOffSwitch, type TypeInformation } from './build-eslint-config.ts'
import { resolveRuleLayers } from './resolve-rule-layers.ts'

const OFF = 0
const WARN = 1
const ERROR = 2
const OFF_OR_ABSENT = [undefined, [OFF]]

const JS_AND_TS_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']
const TS_EXTENSIONS = ['ts', 'mts', 'cts', 'tsx']
const TSCONFIG_ROOT_DIR = '/project/root'
const GLOB_MATCHING_NON_JS_FILES_TOO = '**/*.test.*'
const NON_JS_FILES_UNDER_THE_GLOB = ['src/x.test.json', 'src/x.test.md']
const STORYBOOK_DIRECTORY_GLOB = '**/.storybook/**'
const NON_JS_FILES_IN_THE_STORYBOOK_DIRECTORY = ['.storybook/x.test.json', '.storybook/x.test.md']

const A_TYPED_RULE = '@typescript-eslint/no-floating-promises'
const CONSUMER_CONFIG_FILES = [
  'agents-inc.lint.mts',
  'oxlint.config.mts',
  'apps/web/agents-inc.lint.mts',
  'apps/web/oxlint.config.mts',
]
const ORDINARY_MTS_FILE = 'src/a.mts'
const NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG: readonly string[] = []
// As the computation lists them for buildEslintConfig: relative to tsconfigRootDir, as written on
// disk. A directory may be named with glob syntax, as Next.js's `[id]` and `(group)` are.
const TS_FILES_OUTSIDE_EVERY_TSCONFIG = ['scripts/stray.mts', 'app/[id]/(group)/page.ts']
// Inside a tsconfig, and matched by `app/[id]/(group)/page.ts` read as a glob rather than a path.
const FILE_THE_PATH_READ_AS_A_GLOB_MATCHES = 'app/i/(group)/page.ts'

const SUPPRESSES_AN_OXLINT_ONLY_RULE = '// eslint-disable-next-line oxc/approx-constant\nexport const pi = 3.141592653589793\n'
const SUPPRESSES_A_RULE_NOBODY_DEFINES = '// eslint-disable-next-line nobody/rule\nexport const pi = 3.141592653589793\n'
const SUPPRESSES_AN_OXLINT_ONLY_NAME_UNDER_A_REGISTERED_PREFIX =
  '// eslint-disable-next-line react/no-clone-element\nexport const element = null\n'
const SUPPRESSES_A_NAME_NEITHER_ENGINE_HAS_UNDER_A_REGISTERED_PREFIX =
  '// eslint-disable-next-line react/not-a-rule\nexport const element = null\n'

// Copied from the gate: functional/prefer-immutable-types matches these as RegExps, which a JSON
// config could only hold as strings that never match.
const IMMUTABILITY_TYPE_OVERRIDES = [
  { type: /^(React\.)?(ReactNode|ReactElement|ReactPortal|ReactFragment|JSX\.Element)$/u, to: 'Immutable' },
  { type: /^(React\.)?(CSSProperties|Properties(<.*>)?)$/u, to: 'Immutable' },
  { type: /^(HTML|SVG)\w*Element$/u, to: 'Immutable' },
  { type: /^(React\.)?(RefObject|MutableRefObject|Ref|ForwardedRef)<.*>$/u, to: 'Immutable' },
  { type: /^(React\.)?\w*(HTML|SVG|DOM)Attributes<.*>$/u, to: 'Immutable' },
  {
    type: /^(React\.)?(ComponentProps|ComponentPropsWithoutRef|ComponentPropsWithRef|ComponentType|FC|ElementType)<.*>$/u,
    to: 'Immutable',
  },
  { type: /^(StoryObj|Meta|StoryFn)<.*>$/u, to: 'Immutable' },
  { type: /^(RegExpMatchArray|RegExpExecArray)$/u, to: 'Immutable' },
]

const catalog = buildCatalog({
  rulesets: [
    buildQualityRuleset('correctness'),
    buildQualityRuleset('type-safety'),
    buildQualityRuleset('complexity'),
    buildQualityRuleset('conventions'),
    buildQualityRuleset('declarative'),
    buildLibsRuleset('storybook', 'testing'),
    buildRuntimeRuleset('node', 'node'),
    buildRuntimeRuleset('browser', 'browser'),
  ],
  rules: [
    buildOxlintRoute('no-debugger', {
      oxlintName: 'no-debugger',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness'),
    }),
    buildOxlintRoute('import-x/no-cycle', {
      oxlintName: 'import/no-cycle',
      oxlintPlugin: 'import',
      shipped: buildShippedRule('correctness'),
      eslintAliases: ['import/no-cycle'],
    }),
    buildOxlintRoute('no-unused-vars', {
      oxlintName: 'no-unused-vars',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness'),
    }),
    buildOxlintRoute('oxc/approx-constant', {
      oxlintName: 'oxc/approx-constant',
      oxlintPlugin: 'oxc',
      shipped: null,
    }),
    buildOxlintRoute('react-perf/jsx-no-new-object-as-prop', {
      oxlintName: 'react-perf/jsx-no-new-object-as-prop',
      oxlintPlugin: 'react-perf',
      shipped: null,
    }),
    buildOxlintRoute('vitest/no-focused-tests', {
      oxlintName: 'vitest/no-focused-tests',
      oxlintPlugin: 'vitest',
      shipped: null,
    }),
    buildEslintRoute('demo/strict', {
      typed: false,
      shipped: buildShippedRule('correctness', { options: [{ level: 2 }] }),
    }),
    buildEslintRoute('@typescript-eslint/no-floating-promises', {
      typed: true,
      shipped: buildShippedRule('type-safety', { options: [] }),
    }),
    buildEslintRoute('@typescript-eslint/no-unused-vars', { typed: false, shipped: null }),
    buildEslintRoute('max-lines', {
      typed: false,
      shipped: buildShippedRule('complexity', {
        options: [{ max: 200 }],
        files: ['**/*.tsx'],
        ignores: ['**/use-*.tsx'],
      }),
    }),
    buildEslintRoute('demo/not-in-tests', {
      typed: false,
      shipped: buildShippedRule('conventions', { options: [], ignores: ['**/*.test.ts'] }),
    }),
    // Typed and shipped with ignores, so it runs from a block of its own rather than the typed block.
    buildEslintRoute('demo/typed-not-in-tests', {
      typed: true,
      shipped: buildShippedRule('declarative', { options: [], ignores: ['**/*.test.ts'] }),
    }),
    buildEslintRoute('storybook/default-exports', {
      typed: false,
      shipped: buildShippedRule('storybook', {
        options: [],
        files: ['**/*.stories.tsx'],
        ignores: ['**/legacy/**'],
      }),
    }),
    // As the real storybook rules ship: a directory glob beside the stories glob.
    buildEslintRoute('storybook/context-in-play-function', {
      typed: false,
      shipped: buildShippedRule('storybook', { options: [], files: ['**/*.stories.tsx', STORYBOOK_DIRECTORY_GLOB] }),
    }),
    buildEslintRoute('n/prefer-global/buffer', {
      typed: false,
      shipped: buildShippedRule('node', { options: ['always'] }),
    }),
    buildEslintRoute('unicorn/prefer-dom-node-append', {
      typed: false,
      shipped: buildShippedRule('browser', { options: [] }),
    }),
  ],
})

const pluginRegistry = buildPluginRegistry({
  '@typescript-eslint': ['no-floating-promises', 'no-unused-vars'],
  demo: ['strict', 'not-in-tests', 'typed-not-in-tests'],
  n: ['prefer-global/buffer'],
  storybook: ['default-exports', 'context-in-play-function'],
  unicorn: ['prefer-dom-node-append'],
})

const {
  calculatedConfigFor,
  globalsFor,
  isPathIgnored,
  messagesReportedOn,
  parserOptionsFor,
  ruleEntryFor,
  ruleIdsReportedOn,
  ruleSeverityFor,
} = setUpEslintConfigOracle()

/** ESLint's calculated linterOptions for the file; it leaves noInlineConfig out when no block sets it. */
async function linterOptionsFor(config: Linter.Config[], file: string): Promise<Linter.LinterOptions> {
  const calculated = await calculatedConfigFor(config, file)
  if (calculated === undefined) throw new Error(`ESLint does not lint ${file}`)
  if (calculated.linterOptions === undefined) throw new Error(`ESLint calculated no linterOptions for ${file}`)
  return calculated.linterOptions
}

function blockNamed(config: readonly Linter.Config[], name: string): Linter.Config {
  const block = config.find((candidate) => candidate.name === name)
  if (block === undefined) throw new Error(`no block named ${name}`)
  return block
}

function pluginsOf(block: Linter.Config): Record<string, ESLint.Plugin> {
  if (block.plugins === undefined) throw new Error(`block ${block.name} registers no plugins`)
  return block.plugins
}

function languageOptionsOf(block: Linter.Config): Linter.LanguageOptions {
  if (block.languageOptions === undefined) throw new Error(`block ${block.name} sets no languageOptions`)
  return block.languageOptions
}

function registeredPlugin(prefix: string): ESLint.Plugin {
  const plugin = pluginRegistry[prefix]
  if (plugin === undefined) throw new Error(`the registry has no plugin under ${prefix}`)
  return plugin
}

function ruleNamesOf(plugin: ESLint.Plugin | undefined): string[] {
  if (plugin?.rules === undefined) throw new Error('plugin has no rules')
  return Object.keys(plugin.rules)
}

function pluginUnder(plugins: Readonly<Record<string, ESLint.Plugin>>, prefix: string): ESLint.Plugin {
  const plugin = plugins[prefix]
  if (plugin === undefined) throw new Error(`no plugin is registered under ${prefix}`)
  return plugin
}

function rulesOf(plugin: ESLint.Plugin): NonNullable<ESLint.Plugin['rules']> {
  if (plugin.rules === undefined) throw new Error('plugin has no rules')
  return plugin.rules
}

/** Each rule of the plugin, named 'own' when it is the very rule module the original holds and 'stub' otherwise. */
function ruleProvenanceOf(plugin: ESLint.Plugin, original: ESLint.Plugin): Record<string, 'own' | 'stub'> {
  const originalRules = rulesOf(original)
  return Object.fromEntries(
    Object.entries(rulesOf(plugin)).map(([name, rule]) => [name, rule === originalRules[name] ? 'own' : 'stub']),
  )
}

describe('buildEslintConfig', () => {
  it('emits named blocks in order: ignores, base, Svelte runes, typed, built-in scopes, file overrides, off-switch', () => {
    const lintRules = buildLintRules(
      { quality: ['correctness', 'type-safety', 'complexity'] },
      {
        ignores: ['dist/**'],
        fileOverrides: [buildFileOverride(['**/*.test.ts'], { rules: { 'demo/strict': 'off' } })],
      },
    )

    expect(buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG).map((block) => block.name)).toStrictEqual([
      'agents-inc/ignores',
      'agents-inc/base',
      SVELTE_RUNES_ESLINT_BLOCK_NAME,
      'agents-inc/typed',
      'agents-inc/scope/max-lines',
      'agents-inc/file-overrides/0',
      'agents-inc/oxlint-rules-off',
    ])
  })

  describe('the ignores block', () => {
    const lintRules = buildLintRules({ quality: ['correctness'] }, { ignores: ['dist/**', '*.gen.ts'] })

    it('holds only the config\'s ignores, slash-free ones made to match at any depth, so it is global', () => {
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(blockNamed(config, 'agents-inc/ignores')).toStrictEqual({
        name: 'agents-inc/ignores',
        ignores: ['dist/**', '**/*.gen.ts'],
      })
    })

    it('makes ESLint skip the ignored files and lint the rest', async () => {
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(await isPathIgnored(config, 'dist/a.ts')).toBe(true)
      expect(await isPathIgnored(config, 'src/deep/a.gen.ts')).toBe(true)
      expect(await isPathIgnored(config, 'src/a.ts')).toBe(false)
    })
  })

  describe('the base block', () => {
    const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] })

    it('registers every plugin in the registry, unchanged, and a stub plugin per prefix nobody registers', () => {
      const plugins = pluginsOf(blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'agents-inc/base'))

      expect(Object.keys(plugins).sort()).toStrictEqual([
        '@typescript-eslint',
        'demo',
        'import-x',
        'n',
        'oxc',
        'react-perf',
        'storybook',
        'unicorn',
        'vitest',
      ])
      expect(plugins['demo']).toBe(registeredPlugin('demo'))
    })

    it('gives each stub plugin one rule per oxlint-routed ID under its prefix, listed or not', () => {
      const plugins = pluginsOf(blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'agents-inc/base'))

      expect({
        'import-x': ruleNamesOf(plugins['import-x']),
        oxc: ruleNamesOf(plugins['oxc']),
        'react-perf': ruleNamesOf(plugins['react-perf']),
        vitest: ruleNamesOf(plugins['vitest']),
      }).toStrictEqual({
        'import-x': ['no-cycle'],
        oxc: ['approx-constant'],
        'react-perf': ['jsx-no-new-object-as-prop'],
        vitest: ['no-focused-tests'],
      })
    })

    it('parses with the typescript-eslint parser, JSX on, latest syntax, as modules', () => {
      const languageOptions = languageOptionsOf(
        blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'agents-inc/base'),
      )

      expect(languageOptions['parser']).toBe(tseslint.parser)
      expect(languageOptions['parserOptions']).toStrictEqual({
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      })
    })

    it('carries the import-x node resolver, the immutability type overrides, the extensions eslint-plugin-n tries, ours first, and React version detection', () => {
      const { settings } = blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'agents-inc/base')

      expect(settings).toStrictEqual({
        'import-x/resolver-next': [
          expect.objectContaining({ interfaceVersion: 3, name: 'eslint-plugin-import-x:node' }),
        ],
        immutability: { overrides: IMMUTABILITY_TYPE_OVERRIDES },
        n: { tryExtensions: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.json', '.node'] },
        react: { version: 'detect' },
      })
    })

    // Suppressions are banned unless allowSuppressions says otherwise, and ESLint applies a directive
    // before any rule runs, so by default it reads none.
    it('stops ESLint reporting unused disable directives, which the runner checks itself, and reading any by default', () => {
      const block = blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'agents-inc/base')

      expect(block.linterOptions).toStrictEqual({ reportUnusedDisableDirectives: 'off', noInlineConfig: true })
    })

    it('lets ESLint read directives when allowSuppressions is true, still reporting no unused one', async () => {
      const allowing = buildLintRules({ quality: ['correctness', 'type-safety'] }, { allowSuppressions: true })
      const linterOptions = await linterOptionsFor(buildEslintConfig(allowing, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'src/a.ts')

      expect({
        readsDirectives: linterOptions.noInlineConfig !== true,
        reportsUnusedDirectives: linterOptions.reportUnusedDisableDirectives,
      }).toStrictEqual({ readsDirectives: true, reportsUnusedDirectives: OFF })
    })

    it('holds the untyped ESLint-routed rules, with severity and options', () => {
      const block = blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'agents-inc/base')

      expect(block.rules).toStrictEqual({ 'demo/strict': ['error', { level: 2 }] })
    })

    it.each(JS_AND_TS_EXTENSIONS)('applies to .%s files', async (extension) => {
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(await ruleEntryFor(config, `src/a.${extension}`, 'demo/strict')).toStrictEqual([ERROR, { level: 2 }])
    })

    it('defines the globals of a listed runtime and not those of an unlisted one', async () => {
      const nodeOnly = buildEslintConfig(buildLintRules({ runtimes: ['node'] }), catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)
      const browserOnly = buildEslintConfig(buildLintRules({ runtimes: ['browser'] }), catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)
      const nodeGlobals = await globalsFor(nodeOnly, 'src/a.ts')
      const browserGlobals = await globalsFor(browserOnly, 'src/a.ts')

      expect(['off', undefined]).not.toContain(nodeGlobals['process'])
      expect(nodeGlobals['window']).toBeUndefined()
      expect(['off', undefined]).not.toContain(browserGlobals['window'])
      expect(browserGlobals['process']).toBeUndefined()
    })
  })

  describe('the typed block', () => {
    const lintRules = buildLintRules(
      { quality: ['correctness', 'type-safety'] },
      { tsconfigRootDir: TSCONFIG_ROOT_DIR },
    )

    it('parses through the project service rooted at tsconfigRootDir and holds the typed rules', () => {
      const block = blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'agents-inc/typed')

      expect(block.languageOptions).toStrictEqual({
        parserOptions: { projectService: true, tsconfigRootDir: TSCONFIG_ROOT_DIR },
      })
      expect(block.rules).toStrictEqual({ '@typescript-eslint/no-floating-promises': ['error'] })
    })

    it.each(TS_EXTENSIONS)('runs typed rules on .%s files', async (extension) => {
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(await ruleEntryFor(config, `src/a.${extension}`, '@typescript-eslint/no-floating-promises')).toStrictEqual([
        ERROR,
      ])
    })

    it('runs no typed rule on JavaScript files', async () => {
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(OFF_OR_ABSENT).toContainEqual(
        await ruleEntryFor(config, 'src/a.js', '@typescript-eslint/no-floating-promises'),
      )
    })

    // A typed rule on a file without the project service stops the whole ESLint run, and a tsconfig
    // that includes them makes allowDefaultProject a fatal parse error, so the consumer's config
    // files get neither, at the root or in a nested package, however a typed rule is turned on.
    describe('leaves out the config files a consumer writes for us', () => {
      const waysATypedRuleIsTurnedOn = [
        {
          how: 'a listed ruleset ships it',
          lintRules: buildLintRules({ quality: ['type-safety'] }),
          ruleId: A_TYPED_RULE,
          severity: 'error',
          severityInATsFile: 'error',
        },
        {
          how: 'the top-level rules turn it on',
          lintRules: buildLintRules({}, { rules: { [A_TYPED_RULE]: 'warn' } }),
          ruleId: A_TYPED_RULE,
          severity: 'warn',
          severityInATsFile: 'warn',
        },
        {
          how: 'it ships with ignores of its own',
          lintRules: buildLintRules({ quality: ['declarative'] }),
          ruleId: 'demo/typed-not-in-tests',
          severity: 'error',
          severityInATsFile: 'error',
        },
        {
          how: 'a file override adds its ruleset for every file',
          lintRules: buildLintRules(
            {},
            { fileOverrides: [buildFileOverride(['**/*'], { rulesets: { quality: ['type-safety'] } })] },
          ),
          ruleId: A_TYPED_RULE,
          severity: 'error',
          severityInATsFile: 'error',
        },
        // The entry's files are .mts files only, so a .ts file keeps the rule off.
        {
          how: 'a file override\'s rules turn it on for every .mts file',
          lintRules: buildLintRules(
            {},
            { fileOverrides: [buildFileOverride(['**/*.mts'], { rules: { [A_TYPED_RULE]: 'warn' } })] },
          ),
          ruleId: A_TYPED_RULE,
          severity: 'warn',
          severityInATsFile: 'off',
        },
      ]

      it.each(waysATypedRuleIsTurnedOn)(
        'giving them no project service and no typed rule when $how, while an ordinary .mts file gets both',
        async ({ lintRules, ruleId, severity }) => {
          const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)
          const typedLinting = await Promise.all(
            [...CONSUMER_CONFIG_FILES, ORDINARY_MTS_FILE].map(async (file) => ({
              file,
              projectService: (await parserOptionsFor(config, file))['projectService'],
              severity: (await ruleSeverityFor(config, file, ruleId)) ?? 'off',
            })),
          )

          expect(typedLinting).toStrictEqual([
            ...CONSUMER_CONFIG_FILES.map((file) => ({ file, projectService: undefined, severity: 'off' })),
            { file: ORDINARY_MTS_FILE, projectService: true, severity },
          ])
        },
      )

      it('and still runs the untyped rules on them', async () => {
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)
        const severities = await Promise.all(
          CONSUMER_CONFIG_FILES.map(async (file) => ({ file, severity: await ruleSeverityFor(config, file, 'demo/strict') })),
        )

        expect(severities).toStrictEqual(CONSUMER_CONFIG_FILES.map((file) => ({ file, severity: 'error' })))
      })

      // Spec C3: our project service finds no project for a TS file no tsconfig takes in, and a typed
      // rule there is a fatal parse error that switches off every rule in the file.
      it.each(waysATypedRuleIsTurnedOn)(
        'and gives each TS file outside every tsconfig neither when $how, while a file its path read as a glob would match gets both',
        async ({ lintRules, ruleId, severity, severityInATsFile }) => {
          const config = buildEslintConfig(lintRules, catalog, pluginRegistry, TS_FILES_OUTSIDE_EVERY_TSCONFIG)
          const typedLinting = await Promise.all(
            [...TS_FILES_OUTSIDE_EVERY_TSCONFIG, FILE_THE_PATH_READ_AS_A_GLOB_MATCHES, ORDINARY_MTS_FILE].map(async (file) => ({
              file,
              projectService: (await parserOptionsFor(config, file))['projectService'],
              severity: (await ruleSeverityFor(config, file, ruleId)) ?? 'off',
            })),
          )

          expect(typedLinting).toStrictEqual([
            ...TS_FILES_OUTSIDE_EVERY_TSCONFIG.map((file) => ({ file, projectService: undefined, severity: 'off' })),
            { file: FILE_THE_PATH_READ_AS_A_GLOB_MATCHES, projectService: true, severity: severityInATsFile },
            { file: ORDINARY_MTS_FILE, projectService: true, severity },
          ])
        },
      )

      it('and still runs the untyped rules on each TS file outside every tsconfig', async () => {
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, TS_FILES_OUTSIDE_EVERY_TSCONFIG)
        const severities = await Promise.all(
          TS_FILES_OUTSIDE_EVERY_TSCONFIG.map(async (file) => ({ file, severity: await ruleSeverityFor(config, file, 'demo/strict') })),
        )

        expect(severities).toStrictEqual(TS_FILES_OUTSIDE_EVERY_TSCONFIG.map((file) => ({ file, severity: 'error' })))
      })
    })
  })

  describe('built-in scopes', () => {
    it('run a rule shipped with files only on those files, minus its ignores', async () => {
      const config = buildEslintConfig(buildLintRules({ quality: ['complexity'] }), catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(await ruleEntryFor(config, 'src/a.tsx', 'max-lines')).toStrictEqual([ERROR, { max: 200 }])
      expect(OFF_OR_ABSENT).toContainEqual(await ruleEntryFor(config, 'src/use-thing.tsx', 'max-lines'))
      expect(OFF_OR_ABSENT).toContainEqual(await ruleEntryFor(config, 'src/a.ts', 'max-lines'))
    })

    it('turn a rule shipped with ignores off under them and leave it on elsewhere', async () => {
      const config = buildEslintConfig(buildLintRules({ quality: ['conventions'] }), catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(await ruleEntryFor(config, 'src/a.ts', 'demo/not-in-tests')).toStrictEqual([ERROR])
      expect(OFF_OR_ABSENT).toContainEqual(await ruleEntryFor(config, 'src/a.test.ts', 'demo/not-in-tests'))
    })

    it('keep the shipped files of a rule enabled through rules while its ruleset is unlisted', async () => {
      const lintRules = buildLintRules({}, { rules: { 'storybook/default-exports': 'error' } })
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(await ruleEntryFor(config, 'src/a.stories.tsx', 'storybook/default-exports')).toStrictEqual([ERROR])
      expect(OFF_OR_ABSENT).toContainEqual(await ruleEntryFor(config, 'src/a.tsx', 'storybook/default-exports'))
    })
  })

  describe('file overrides', () => {
    describe('adding a ruleset whose rule is shipped with files', () => {
      const lintRules = buildLintRules(
        { quality: ['correctness'] },
        { fileOverrides: [buildFileOverride(['src/**'], { rulesets: { libs: { testing: ['storybook'] } } })] },
      )

      it('scope the rule to the override glob AND the rule glob, minus the rule\'s ignores', () => {
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)
        const blocksSettingTheRule = config.filter(
          (block) => block.rules !== undefined && 'storybook/default-exports' in block.rules,
        )

        expect(blocksSettingTheRule.map((block) => ({ files: block.files, ignores: block.ignores }))).toStrictEqual([
          { files: [['src/**', '**/*.stories.tsx']], ignores: ['**/legacy/**'] },
        ])
      })

      it('run the rule only where both globs match and its ignores do not', async () => {
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

        expect(await ruleEntryFor(config, 'src/a.stories.tsx', 'storybook/default-exports')).toStrictEqual([ERROR])
        expect(OFF_OR_ABSENT).toContainEqual(await ruleEntryFor(config, 'src/a.tsx', 'storybook/default-exports'))
        expect(OFF_OR_ABSENT).toContainEqual(
          await ruleEntryFor(config, 'lib/a.stories.tsx', 'storybook/default-exports'),
        )
        expect(OFF_OR_ABSENT).toContainEqual(
          await ruleEntryFor(config, 'src/legacy/a.stories.tsx', 'storybook/default-exports'),
        )
      })
    })

    // Softening a rule never widens where it runs: an entry's rules keep the rule's shipped files and
    // ignores, ANDed with the entry's own globs, as the top-level rules do.
    describe('whose own rules set a rule shipped with files and ignores', () => {
      const FILES_INSIDE_AND_OUTSIDE_THE_SCOPES = ['src/a.tsx', 'src/a.test.js', 'src/use-thing.tsx', 'lib/a.tsx']
      const entriesSettingMaxLines = [
        {
          entryDoes: 'softens it while its ruleset is listed',
          lintRules: buildLintRules(
            { quality: ['complexity'] },
            { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'max-lines': 'warn' } })] },
          ),
          severities: { 'src/a.tsx': 'warn', 'src/a.test.js': 'off', 'src/use-thing.tsx': 'off', 'lib/a.tsx': 'error' },
        },
        {
          entryDoes: 'turns it on while its ruleset is unlisted',
          lintRules: buildLintRules(
            {},
            { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'max-lines': ['error', { max: 300 }] } })] },
          ),
          severities: { 'src/a.tsx': 'error', 'src/a.test.js': 'off', 'src/use-thing.tsx': 'off', 'lib/a.tsx': 'off' },
        },
        {
          entryDoes: 'turns it off',
          lintRules: buildLintRules(
            { quality: ['complexity'] },
            { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'max-lines': 'off' } })] },
          ),
          severities: { 'src/a.tsx': 'off', 'src/a.test.js': 'off', 'src/use-thing.tsx': 'off', 'lib/a.tsx': 'error' },
        },
      ]

      it.each(entriesSettingMaxLines)(
        'run it only inside its own scope when the entry $entryDoes',
        async ({ lintRules, severities }) => {
          const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)
          const calculated = Object.fromEntries(
            await Promise.all(
              FILES_INSIDE_AND_OUTSIDE_THE_SCOPES.map(async (file) => [
                file,
                (await ruleSeverityFor(config, file, 'max-lines')) ?? 'off',
              ]),
            ),
          )

          expect(calculated).toStrictEqual(severities)
        },
      )

      it('keep the ignores of a rule shipped with ignores only', async () => {
        const lintRules = buildLintRules(
          { quality: ['conventions'] },
          { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'demo/not-in-tests': 'warn' } })] },
        )
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)
        const calculated = Object.fromEntries(
          await Promise.all(
            ['src/a.ts', 'src/a.test.ts', 'lib/a.ts'].map(async (file) => [
              file,
              (await ruleSeverityFor(config, file, 'demo/not-in-tests')) ?? 'off',
            ]),
          ),
        )

        expect(calculated).toStrictEqual({ 'src/a.ts': 'warn', 'src/a.test.ts': 'off', 'lib/a.ts': 'error' })
      })
    })

    it('apply an entry\'s rules to exactly its files, keeping the shipped options', async () => {
      const lintRules = buildLintRules(
        { quality: ['correctness'] },
        { fileOverrides: [buildFileOverride(['**/*.test.ts'], { rules: { 'demo/strict': 'warn' } })] },
      )
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(await ruleEntryFor(config, 'src/a.test.ts', 'demo/strict')).toStrictEqual([WARN, { level: 2 }])
      expect(await ruleEntryFor(config, 'src/a.ts', 'demo/strict')).toStrictEqual([ERROR, { level: 2 }])
    })

    // ESLint lints every file a block's `files` matches, so an entry's glob alone hands it
    // x.test.json: `eslint .` then reports a parse error there, or throws outright when the entry
    // sets a plugin's rule, since our plugins are registered for JS and TS files only.
    describe('whose glob also matches files that are not JS or TS', () => {
      const entriesByBlockTheyEmit = [
        {
          entryDoes: 'sets a rule',
          lintRules: buildLintRules(
            { quality: ['correctness'] },
            { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rules: { 'demo/strict': 'warn' } })] },
          ),
          lintedFile: 'src/x.test.ts',
          ruleId: 'demo/strict',
          severity: 'warn',
        },
        {
          entryDoes: 'drops a runtime',
          lintRules: buildLintRules(
            { runtimes: ['node', 'browser'] },
            { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rulesets: { runtimes: ['node'] } })] },
          ),
          lintedFile: 'src/x.test.ts',
          ruleId: 'unicorn/prefer-dom-node-append',
          severity: 'off',
        },
        {
          entryDoes: 'adds a rule shipped with ignores only',
          lintRules: buildLintRules(
            {},
            { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rulesets: { quality: ['conventions'] } })] },
          ),
          // demo/not-in-tests ships ignoring **/*.test.ts
          lintedFile: 'src/x.test.tsx',
          ruleId: 'demo/not-in-tests',
          severity: 'error',
        },
        {
          entryDoes: 'adds a typed rule',
          lintRules: buildLintRules(
            {},
            { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rulesets: { quality: ['type-safety'] } })] },
          ),
          lintedFile: 'src/x.test.ts',
          ruleId: '@typescript-eslint/no-floating-promises',
          severity: 'error',
        },
      ]

      it.each(entriesByBlockTheyEmit)('make ESLint lint no such file when the entry $entryDoes', async ({ lintRules }) => {
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)
        const lintedByEslint = await Promise.all(
          NON_JS_FILES_UNDER_THE_GLOB.map(async (file) => ({
            file,
            linted: (await calculatedConfigFor(config, file)) !== undefined,
          })),
        )

        expect(lintedByEslint).toStrictEqual(NON_JS_FILES_UNDER_THE_GLOB.map((file) => ({ file, linted: false })))
      })

      it.each(entriesByBlockTheyEmit)(
        'still apply to a JS or TS file under the glob when the entry $entryDoes',
        async ({ lintRules, lintedFile, ruleId, severity }) => {
          const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

          expect(await ruleSeverityFor(config, lintedFile, ruleId)).toBe(severity)
        },
      )
    })

    // A directory glob names no extension, so ANDed with an entry glob that names none either, the
    // pair alone matches every file in the directory, x.test.json included.
    describe('whose glob matches files that are not JS or TS, adding a rule shipped with a directory glob', () => {
      const lintRules = buildLintRules(
        {},
        {
          fileOverrides: [
            buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rulesets: { libs: { testing: ['storybook'] } } }),
          ],
        },
      )

      it('make ESLint lint no such file in that directory', async () => {
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)
        const lintedByEslint = await Promise.all(
          NON_JS_FILES_IN_THE_STORYBOOK_DIRECTORY.map(async (file) => ({
            file,
            linted: (await calculatedConfigFor(config, file)) !== undefined,
          })),
        )

        expect(lintedByEslint).toStrictEqual(NON_JS_FILES_IN_THE_STORYBOOK_DIRECTORY.map((file) => ({ file, linted: false })))
      })

      it('still run the rule on a TS file in that directory', async () => {
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

        expect(await ruleSeverityFor(config, '.storybook/x.test.ts', 'storybook/context-in-play-function')).toBe('error')
      })
    })
  })

  describe('the oxlint off-switch', () => {
    it('turns off every oxlint-routed rule, listed or not, under its ID and each alias, and nothing else', () => {
      const config = buildEslintConfig(buildLintRules({ quality: ['correctness'] }), catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(blockNamed(config, 'agents-inc/oxlint-rules-off')).toStrictEqual({
        name: 'agents-inc/oxlint-rules-off',
        rules: {
          'import-x/no-cycle': 'off',
          'import/no-cycle': 'off',
          'no-debugger': 'off',
          'no-unused-vars': 'off',
          'oxc/approx-constant': 'off',
          'react-perf/jsx-no-new-object-as-prop': 'off',
          'vitest/no-focused-tests': 'off',
        },
      })
    })

    it('leaves running the ESLint-routed twin of a rule oxlint runs', async () => {
      const lintRules = buildLintRules(
        { quality: ['correctness'] },
        { rules: { '@typescript-eslint/no-unused-vars': 'error' } },
      )
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(await ruleSeverityFor(config, 'src/a.ts', '@typescript-eslint/no-unused-vars')).toBe('error')
      expect(await ruleSeverityFor(config, 'src/a.ts', 'no-unused-vars')).toBe('off')
    })

    // The stubs matter only where ESLint reads directives: where suppressions are allowed.
    it('lets a suppression of an oxlint-only rule load, through its stub', async () => {
      const config = buildEslintConfig(
        buildLintRules({ quality: ['correctness'] }, { allowSuppressions: true }),
        catalog,
        pluginRegistry,
        NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG,
      )

      expect(await ruleIdsReportedOn(config, SUPPRESSES_AN_OXLINT_ONLY_RULE, 'src/suppressed.js')).toStrictEqual([])
    })

    it('still lets ESLint report a suppression of a rule no plugin defines', async () => {
      const config = buildEslintConfig(
        buildLintRules({ quality: ['correctness'] }, { allowSuppressions: true }),
        catalog,
        pluginRegistry,
        NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG,
      )

      expect(await ruleIdsReportedOn(config, SUPPRESSES_A_RULE_NOBODY_DEFINES, 'src/suppressed.js')).toStrictEqual([
        'nobody/rule',
      ])
    })
  })

  // As in the real catalog: oxlint runs react/jsx-key, which eslint-plugin-react also defines, and
  // react/no-clone-element, which exists only in oxlint.
  describe('a registered plugin whose prefix holds oxlint-only rule names', () => {
    const catalogWithOxlintOnlyNames = buildCatalog({
      rulesets: [buildQualityRuleset('correctness')],
      rules: [
        buildOxlintRoute('react/jsx-key', {
          oxlintName: 'react/jsx-key',
          oxlintPlugin: 'react',
          shipped: buildShippedRule('correctness'),
        }),
        buildOxlintRoute('react/no-clone-element', {
          oxlintName: 'react/no-clone-element',
          oxlintPlugin: 'react',
          shipped: null,
        }),
        buildEslintRoute('react/no-danger', { typed: false, shipped: buildShippedRule('correctness') }),
      ],
    })
    const reactPlugin = buildFakePlugin(['jsx-key', 'no-danger'], { meta: { name: 'eslint-plugin-react', version: '7.37.5' } })
    const registry = { react: reactPlugin }
    // Suppressions allowed, so ESLint reads the directives the stubs are for.
    const lintRules = buildLintRules({ quality: ['correctness'] }, { allowSuppressions: true })

    function basePlugins(): Record<string, ESLint.Plugin> {
      return pluginsOf(blockNamed(buildEslintConfig(lintRules, catalogWithOxlintOnlyNames, registry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'agents-inc/base'))
    }

    it('is registered as a copy holding each of its own rules and a stub per oxlint-only name it lacks', () => {
      expect(ruleProvenanceOf(pluginUnder(basePlugins(), 'react'), reactPlugin)).toStrictEqual({
        'jsx-key': 'own',
        'no-clone-element': 'stub',
        'no-danger': 'own',
      })
    })

    it('is copied rather than changed: the registry still holds the same plugin, with only its own rules', () => {
      const registered = pluginUnder(basePlugins(), 'react')

      expect({ registeredIsTheOriginal: registered === reactPlugin, originalRuleNames: ruleNamesOf(reactPlugin) }).toStrictEqual({
        registeredIsTheOriginal: false,
        originalRuleNames: ['jsx-key', 'no-danger'],
      })
    })

    it('keeps the original plugin\'s meta on the copy', () => {
      expect(pluginUnder(basePlugins(), 'react').meta).toBe(reactPlugin.meta)
    })

    it('lets a suppression of the oxlint-only name load in ESLint', async () => {
      const config = buildEslintConfig(lintRules, catalogWithOxlintOnlyNames, registry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(
        await ruleIdsReportedOn(config, SUPPRESSES_AN_OXLINT_ONLY_NAME_UNDER_A_REGISTERED_PREFIX, 'src/suppressed.tsx'),
      ).toStrictEqual([])
    })

    it('still lets ESLint report a suppression of a name neither the plugin nor oxlint has', async () => {
      const config = buildEslintConfig(lintRules, catalogWithOxlintOnlyNames, registry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG)

      expect(
        await ruleIdsReportedOn(config, SUPPRESSES_A_NAME_NEITHER_ENGINE_HAS_UNDER_A_REGISTERED_PREFIX, 'src/suppressed.tsx'),
      ).toStrictEqual(['react/not-a-rule'])
    })
  })

  // Spec C4 (#39, #32 Q4): without oxlint, ESLint takes over oxlint's rules, and on TS files a core
  // rule typescript-eslint extends runs as its extension, which reads TypeScript syntax the core rule
  // misreads. The pairs come from the catalog: a core rule's extensions, less those it records as its
  // aliases (the deprecated ones). The agent build, and every build beside oxlint, keep the core rule.
  describe('the blocks of a project without oxlint, for a core rule ESLint takes over that typescript-eslint extends', () => {
    const MAX_PARAMS_TWIN = '@typescript-eslint/max-params'
    const NO_UNUSED_VARS_TWIN = '@typescript-eslint/no-unused-vars'
    const PREFER_DESTRUCTURING_TWIN = '@typescript-eslint/prefer-destructuring'
    const NO_LOOP_FUNC_ALIAS = '@typescript-eslint/no-loop-func'
    const DEFAULT_PARAM_LAST_TWIN = '@typescript-eslint/default-param-last'
    const NOT_RUN = 'not run'
    const TS_FILE = 'src/a.ts'
    const JS_FILE = 'src/a.js'
    const STRAY_TS_FILE = 'scripts/stray.ts'
    const LEGACY_TS_FILE = 'legacy/a.ts'
    const LEGACY_JS_FILE = 'legacy/a.js'
    const STORY_TS_FILE = 'src/a.stories.ts'
    const TEAM_TYPED_TS_FILE = 'packages/typed/a.ts'
    const TEAM_UNTYPED_TS_FILE = 'packages/untyped/a.ts'
    const SIX_PARAMETERS = 'export function six(a, b, c, d, e, f) {\n  return [a, b, c, d, e, f]\n}\n'
    const CORE_MAX_PARAMS_MESSAGE = "Function 'six' has too many parameters (6). Maximum allowed is 5."

    const twinsCatalog = buildCatalog({
      rulesets: ['complexity', 'redundancy', 'modern-js', 'correctness', 'conventions'].map(buildQualityRuleset),
      rules: [
        buildOxlintRoute('max-params', {
          oxlintName: 'max-params',
          oxlintPlugin: 'eslint',
          shipped: buildShippedRule('complexity', { options: [{ max: 4 }] }),
        }),
        buildEslintRoute(MAX_PARAMS_TWIN, { typed: false, shipped: null }),
        // Shipped with ignores, as the real one is, so it runs from a block of its own.
        buildOxlintRoute('no-unused-vars', {
          oxlintName: 'no-unused-vars',
          oxlintPlugin: 'eslint',
          shipped: buildShippedRule('redundancy', { ignores: ['**/*.stories.{ts,tsx}'] }),
        }),
        buildEslintRoute(NO_UNUSED_VARS_TWIN, { typed: false, shipped: null }),
        // typescript-eslint's extension of it is typed.
        buildOxlintRoute('prefer-destructuring', {
          oxlintName: 'prefer-destructuring',
          oxlintPlugin: 'eslint',
          shipped: buildShippedRule('modern-js'),
        }),
        buildEslintRoute(PREFER_DESTRUCTURING_TWIN, { typed: true, shipped: null }),
        // Its extension is deprecated in its favour, so the catalog records it as an alias.
        buildOxlintRoute('no-loop-func', {
          oxlintName: 'no-loop-func',
          oxlintPlugin: 'eslint',
          shipped: buildShippedRule('correctness'),
          eslintAliases: [NO_LOOP_FUNC_ALIAS],
        }),
        // Routed to ESLint, so no build swaps it (O12).
        buildEslintRoute('default-param-last', { typed: false, shipped: buildShippedRule('conventions') }),
        buildEslintRoute(DEFAULT_PARAM_LAST_TWIN, { typed: false, shipped: null }),
      ],
      coreRuleExtensions: new Map([
        ['default-param-last', [DEFAULT_PARAM_LAST_TWIN]],
        ['max-params', [MAX_PARAMS_TWIN]],
        ['no-loop-func', [NO_LOOP_FUNC_ALIAS]],
        ['no-unused-vars', [NO_UNUSED_VARS_TWIN]],
        ['prefer-destructuring', [PREFER_DESTRUCTURING_TWIN]],
      ]),
    })
    // The real typescript-eslint plugin, whose rules refuse options they do not take.
    const twinPlugins: ReadonlyMap<string, ESLint.Plugin> = new Map([['@typescript-eslint', registeredRealPlugin('@typescript-eslint')]])
    const ourTypeInformation: TypeInformation = {
      from: 'ours',
      tsconfigRootDir: TSCONFIG_ROOT_DIR,
      tsFilesOutsideEveryTsconfig: [STRAY_TS_FILE],
    }
    const teamTypeInformation: TypeInformation = {
      from: 'the team',
      blocks: [{ switches: 'on', files: ['packages/typed/**'], ignores: [] }],
    }

    function registeredRealPlugin(prefix: string): ESLint.Plugin {
      const plugin = eslintPlugins[prefix]
      if (plugin === undefined) throw new Error(`no ESLint plugin is registered under ${prefix}`)
      return plugin
    }

    /** Our blocks before the off-switch, in order, for a project whose package.json lists no oxlint unless `besideOxlint`. */
    function ourBlocks(
      lintRules: ReturnType<typeof buildLintRules>,
      {
        typeInformation = ourTypeInformation,
        besideOxlint = false,
        plugins = twinPlugins,
      }: { typeInformation?: TypeInformation; besideOxlint?: boolean; plugins?: ReadonlyMap<string, ESLint.Plugin> } = {},
    ): Linter.Config[] {
      const { globalIgnores, base, afterTheBase } = eslintBlocksBeforeTheOffSwitch(
        {
          layers: resolveRuleLayers(lintRules, twinsCatalog),
          plugins,
          linterOptions: null,
          typeInformation,
          twinsOnTsFiles: !besideOxlint,
        },
        twinsCatalog,
      )
      return [...globalIgnores, base, ...afterTheBase]
    }

    /** Each rule's calculated entry in each file, or NOT_RUN where no block sets it or it is off. */
    async function entriesIn(
      config: Linter.Config[],
      files: readonly string[],
      ruleIds: readonly string[],
    ): Promise<Record<string, Record<string, unknown>>> {
      return Object.fromEntries(
        await Promise.all(
          files.map(async (file) => [
            file,
            Object.fromEntries(await Promise.all(ruleIds.map(async (ruleId) => [ruleId, await runningEntryFor(config, file, ruleId)]))),
          ]),
        ),
      )
    }

    async function runningEntryFor(config: Linter.Config[], file: string, ruleId: string): Promise<unknown> {
      const severity = await ruleSeverityFor(config, file, ruleId)
      return severity === undefined || severity === 'off' ? NOT_RUN : ruleEntryFor(config, file, ruleId)
    }

    /** The real typescript-eslint plugin, but its max-params declaring a schema ESLint cannot compile: an unknown format. */
    function typescriptEslintWithAnUncompilableMaxParamsSchema(): ESLint.Plugin {
      const real = registeredRealPlugin('@typescript-eslint')
      const maxParams = real.rules?.['max-params']
      if (maxParams === undefined) throw new Error('typescript-eslint has no max-params')
      const schema = [{ type: 'object', properties: { max: { type: 'integer', format: 'no-such-format' } } }] as const
      return { ...real, rules: { ...real.rules, 'max-params': { ...maxParams, meta: { ...maxParams.meta, schema } } } }
    }

    /** The cause of the error the build throws. */
    function causeOfTheErrorThrownBy(build: () => unknown): unknown {
      try {
        build()
      } catch (error) {
        if (error instanceof Error) return error.cause
        throw error
      }
      throw new Error('the build threw nothing')
    }

    /** The entry ESLint calculates for a core rule given the entry alone: it fills in the default options the rule declares. */
    async function coreEntryAsEslintFillsIn(ruleId: string, entry: Linter.RuleEntry): Promise<unknown> {
      return ruleEntryFor([{ files: [JS_FILE], rules: { [ruleId]: entry } }], JS_FILE, ruleId)
    }

    it('runs the extension on TS files, with the core rule\'s setting, and the core rule on JS files, from the base block', async () => {
      const config = ourBlocks(buildLintRules({ quality: ['complexity'] }))

      expect(await entriesIn(config, [TS_FILE, JS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 4 }] },
        [JS_FILE]: { 'max-params': [ERROR, { max: 4 }], [MAX_PARAMS_TWIN]: NOT_RUN },
      })
    })

    it('swaps them the same way in a rule\'s own block, keeping its ignores', async () => {
      const config = ourBlocks(buildLintRules({ quality: ['redundancy'] }))

      expect(await entriesIn(config, [TS_FILE, JS_FILE, STORY_TS_FILE], ['no-unused-vars', NO_UNUSED_VARS_TWIN])).toStrictEqual({
        [TS_FILE]: { 'no-unused-vars': NOT_RUN, [NO_UNUSED_VARS_TWIN]: [ERROR] },
        [JS_FILE]: { 'no-unused-vars': await coreEntryAsEslintFillsIn('no-unused-vars', 'error'), [NO_UNUSED_VARS_TWIN]: NOT_RUN },
        [STORY_TS_FILE]: { 'no-unused-vars': NOT_RUN, [NO_UNUSED_VARS_TWIN]: NOT_RUN },
      })
    })

    it('swaps them the same way in an entry\'s files, with the entry\'s setting, and leaves the rest to the top level', async () => {
      const lintRules = buildLintRules(
        { quality: ['complexity'] },
        { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { 'max-params': ['warn', { max: 8 }] } })] },
      )

      expect(await entriesIn(ourBlocks(lintRules), [LEGACY_TS_FILE, LEGACY_JS_FILE, TS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [LEGACY_TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [WARN, { max: 8 }] },
        [LEGACY_JS_FILE]: { 'max-params': [WARN, { max: 8 }], [MAX_PARAMS_TWIN]: NOT_RUN },
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 4 }] },
      })
    })

    it('runs neither in the files of an entry that turns the core rule off', async () => {
      const lintRules = buildLintRules(
        { quality: ['complexity'] },
        { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { 'max-params': 'off' } })] },
      )

      expect(await entriesIn(ourBlocks(lintRules), [LEGACY_TS_FILE, LEGACY_JS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [LEGACY_TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: NOT_RUN },
        [LEGACY_JS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: NOT_RUN },
      })
    })

    // D-f: a typed extension runs only where there is type information; elsewhere the core rule does.
    it('runs a typed extension only in TS files our project service types, and the core rule in the rest', async () => {
      const config = ourBlocks(buildLintRules({ quality: ['modern-js'] }))

      expect(
        await entriesIn(config, [TS_FILE, STRAY_TS_FILE, JS_FILE], ['prefer-destructuring', PREFER_DESTRUCTURING_TWIN]),
      ).toStrictEqual({
        [TS_FILE]: { 'prefer-destructuring': NOT_RUN, [PREFER_DESTRUCTURING_TWIN]: [ERROR] },
        [STRAY_TS_FILE]: { 'prefer-destructuring': [ERROR], [PREFER_DESTRUCTURING_TWIN]: NOT_RUN },
        [JS_FILE]: { 'prefer-destructuring': [ERROR], [PREFER_DESTRUCTURING_TWIN]: NOT_RUN },
      })
    })

    it("runs a typed extension only in the TS files the team's blocks type, and the core rule in the rest", async () => {
      const config = ourBlocks(buildLintRules({ quality: ['modern-js'] }), { typeInformation: teamTypeInformation })

      expect(
        await entriesIn(config, [TEAM_TYPED_TS_FILE, TEAM_UNTYPED_TS_FILE], ['prefer-destructuring', PREFER_DESTRUCTURING_TWIN]),
      ).toStrictEqual({
        [TEAM_TYPED_TS_FILE]: { 'prefer-destructuring': NOT_RUN, [PREFER_DESTRUCTURING_TWIN]: [ERROR] },
        [TEAM_UNTYPED_TS_FILE]: { 'prefer-destructuring': [ERROR], [PREFER_DESTRUCTURING_TWIN]: NOT_RUN },
      })
    })

    // D-e: typescript-eslint's max-params refuses a bare number, and a refused option is a config
    // error that ends ESLint's run, so where the options given are refused the core rule stays.
    it("keeps the core rule on TS files where the consumer's options are ones the extension refuses: max-params given 5", async () => {
      const config = ourBlocks(buildLintRules({ quality: ['complexity'] }, { rules: { 'max-params': ['error', 5] } }))

      expect({
        entries: await entriesIn(config, [TS_FILE], ['max-params', MAX_PARAMS_TWIN]),
        reported: await messagesReportedOn(config, SIX_PARAMETERS, TS_FILE),
      }).toStrictEqual({
        entries: { [TS_FILE]: { 'max-params': [ERROR, 5], [MAX_PARAMS_TWIN]: NOT_RUN } },
        reported: [{ ruleId: 'max-params', message: CORE_MAX_PARAMS_MESSAGE }],
      })
    })

    it('runs the extension on TS files where the same limit is given in the form it takes', async () => {
      const config = ourBlocks(buildLintRules({ quality: ['complexity'] }, { rules: { 'max-params': ['error', { max: 5 }] } }))

      expect(await entriesIn(config, [TS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 5 }] },
      })
    })

    // ESLint refuses options a rule's schema does not take, and asking it is how a refused option is
    // told apart; any other failure is a defect of its own, which must not pass for a refusal and
    // silently keep the core rule (review, Should fix; CLAUDE.md: a caught error reports its cause).
    it("throws, with ESLint's error as its cause, where checking the extension's options fails for another reason than refusing them", () => {
      const plugins = new Map([['@typescript-eslint', typescriptEslintWithAnUncompilableMaxParamsSchema()]])
      const cause = causeOfTheErrorThrownBy(() => ourBlocks(buildLintRules({ quality: ['complexity'] }), { plugins }))

      expect(cause instanceof Error ? cause.message : cause).toMatch(/options validation schema/u)
    })

    // D9 (decisions.md, the build wf_ec970377-570 review; review Must fix 4): where our layers state a
    // core rule ESLint takes over and its extension, the highest layer stating either name decides
    // the setting, the extension running on TS files and the core rule on JS files, never both.
    it("runs the extension on TS files and the core rule on JS files, each with the consumer's setting of the extension, over the core rule a listed ruleset ships", async () => {
      const lintRules = buildLintRules({ quality: ['complexity'] }, { rules: { [MAX_PARAMS_TWIN]: ['error', { max: 2 }] } })

      expect(await entriesIn(ourBlocks(lintRules), [TS_FILE, JS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 2 }] },
        [JS_FILE]: { 'max-params': [ERROR, { max: 2 }], [MAX_PARAMS_TWIN]: NOT_RUN },
      })
    })

    // The layer states each name its own setting, so each runs with its own where it runs.
    it("runs the extension on TS files and the core rule on JS files, each with its own setting, where one layer states both", async () => {
      const lintRules = buildLintRules({}, { rules: { 'max-params': ['error', { max: 5 }], [MAX_PARAMS_TWIN]: ['error', { max: 2 }] } })

      expect(await entriesIn(ourBlocks(lintRules), [TS_FILE, JS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 2 }] },
        [JS_FILE]: { 'max-params': [ERROR, { max: 5 }], [MAX_PARAMS_TWIN]: NOT_RUN },
      })
    })

    it("runs the extension on TS files and the core rule on JS files in an entry's files, each with the entry's setting of the extension, and the top level's elsewhere", async () => {
      const lintRules = buildLintRules(
        { quality: ['complexity'] },
        { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { [MAX_PARAMS_TWIN]: ['warn', { max: 2 }] } })] },
      )

      expect(await entriesIn(ourBlocks(lintRules), [LEGACY_TS_FILE, LEGACY_JS_FILE, TS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [LEGACY_TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [WARN, { max: 2 }] },
        [LEGACY_JS_FILE]: { 'max-params': [WARN, { max: 2 }], [MAX_PARAMS_TWIN]: NOT_RUN },
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 4 }] },
      })
    })

    // The core rule takes the extension's setting where its schema takes the options (the allowed
    // case), and keeps the layer below's where it refuses them: typescript-eslint's prefer-destructuring
    // takes an option the core rule's second object does not.
    it.each([
      { options: 'the core rule takes', given: [{ object: false }], coreOnJs: [ERROR, { object: false }] },
      {
        options: 'the core rule refuses',
        given: [{ object: false }, { enforceForDeclarationWithTypeAnnotation: true }],
        coreOnJs: [ERROR],
      },
    ])(
      "runs the typed extension on TS files with the consumer's setting of it, and the core rule on JS files with that setting where its options are ones $options, else with the ruleset's",
      async ({ given, coreOnJs }) => {
        const lintRules = buildLintRules({ quality: ['modern-js'] }, { rules: { [PREFER_DESTRUCTURING_TWIN]: ['error', ...given] } })

        expect(await entriesIn(ourBlocks(lintRules), [TS_FILE, JS_FILE], ['prefer-destructuring', PREFER_DESTRUCTURING_TWIN])).toStrictEqual({
          [TS_FILE]: { 'prefer-destructuring': NOT_RUN, [PREFER_DESTRUCTURING_TWIN]: [ERROR, ...given] },
          [JS_FILE]: { 'prefer-destructuring': coreOnJs, [PREFER_DESTRUCTURING_TWIN]: NOT_RUN },
        })
      },
    )

    // An entry turning the core rule off turns the extension off with it, and its own statement of the
    // extension, written after, decides: here the extension runs at the entry's setting.
    it("runs the extension on TS files with the setting an entry gives it, where the same entry turns the core rule off", async () => {
      const lintRules = buildLintRules(
        {},
        { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { 'max-params': 'off', [MAX_PARAMS_TWIN]: ['error', { max: 3 }] } })] },
      )

      expect(await entriesIn(ourBlocks(lintRules), [LEGACY_TS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [LEGACY_TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 3 }] },
      })
    })

    it('keeps the core rule on TS files where its only extension is one the catalog records as its alias', async () => {
      const config = ourBlocks(buildLintRules({ quality: ['correctness'] }))

      expect(await entriesIn(config, [TS_FILE], ['no-loop-func', NO_LOOP_FUNC_ALIAS])).toStrictEqual({
        [TS_FILE]: { 'no-loop-func': [ERROR], [NO_LOOP_FUNC_ALIAS]: NOT_RUN },
      })
    })

    it('keeps an ESLint-routed core rule on TS files though typescript-eslint extends it', async () => {
      const config = ourBlocks(buildLintRules({ quality: ['conventions'] }))

      expect(await entriesIn(config, [TS_FILE], ['default-param-last', DEFAULT_PARAM_LAST_TWIN])).toStrictEqual({
        [TS_FILE]: { 'default-param-last': [ERROR], [DEFAULT_PARAM_LAST_TWIN]: NOT_RUN },
      })
    })

    it('keeps the core rule on TS files beside oxlint, as the agent build does', async () => {
      const config = ourBlocks(buildLintRules({ quality: ['complexity'] }), { besideOxlint: true })

      expect(await entriesIn(config, [TS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [TS_FILE]: { 'max-params': [ERROR, { max: 4 }], [MAX_PARAMS_TWIN]: NOT_RUN },
      })
    })
  })

  describe('the lint rules it is given', () => {
    it('build when they are valid', () => {
      const lintRules = buildLintRules({}, { rules: { 'demo/strict': 'error' } })

      expect(blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, NO_TS_FILE_OUTSIDE_EVERY_TSCONFIG), 'agents-inc/base').rules).toStrictEqual({
        'demo/strict': ['error', { level: 2 }],
      })
    })
  })
})
