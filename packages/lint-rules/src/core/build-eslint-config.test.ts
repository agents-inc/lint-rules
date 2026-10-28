import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { RuleRoute } from '@workspace/rule-data'
import { buildShippedRule, buildShippedRuleDecidedBySuppressions } from '@workspace/rule-data/test-support/shipped-rule-factories'
import type { ESLint, Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { SVELTE_RUNES_ESLINT_BLOCK_NAME, TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME } from '../__tests__/cases/svelte-components.ts'
import { blockNamed, pluginRegisteredUnder } from '../__tests__/eslint-config-reads.ts'
import {
  buildCatalog,
  buildEslintRoute,
  buildFakePlugin,
  buildLibsRuleset,
  buildOxlintRoute,
  buildPluginRegistry,
  buildQualityRuleset,
  buildRuntimeRuleset,
  buildSuppressionModeShippedRule,
} from '../__tests__/factories/catalog-factories.ts'
import { buildFileOverride, buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { setUpEslintConfigOracle } from '../__tests__/eslint-config-oracle.ts'
import { buildProjectFacts, outsideEveryTsconfigAmong } from '../__tests__/factories/project-facts-factories.ts'
import { buildEslintConfig, eslintBlocksBeforeTheOffSwitch, type TypeInformation } from './build-eslint-config.ts'
import type { LintRulesInput, RuleSettingsInput } from './lint-rules-input.ts'
import { buildEslintSettings } from './eslint-settings.ts'
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
// A core rule oxlint runs, with a typed extension that has an option oxlint refuses, in the test's own catalog.
const CORE_RULE_WITH_A_TYPED_EXTENSION = 'no-redeclare'
const TYPED_EXTENSION_NAME = 'no-redeclare'
const TYPED_EXTENSION = `@typescript-eslint/${TYPED_EXTENSION_NAME}`
const AN_OPTION_OXLINT_REFUSES = { ignoreDeclarationMerge: true }
const CONSUMER_CONFIG_FILES = [
  'agents-inc.lint.mts',
  'oxlint.config.mts',
  'apps/web/agents-inc.lint.mts',
  'apps/web/oxlint.config.mts',
]
const ORDINARY_MTS_FILE = 'src/a.mts'
const ROOT_CONSUMER_CONFIG_FILES = ['agents-inc.lint.mts', 'oxlint.config.mts']
// As the computation lists them where no tsconfig takes in a consumer config file, beside a stray TS file.
const CONSUMER_CONFIG_FILES_AND_A_STRAY_OUTSIDE_EVERY_TSCONFIG = [...CONSUMER_CONFIG_FILES, 'scripts/stray.mts']
// Relative to tsconfigRootDir. A directory may be named with glob syntax, as Next.js's `[id]` and `(group)` are.
const TS_FILES_OUTSIDE_EVERY_TSCONFIG = ['scripts/stray.mts', 'app/[id]/(group)/page.ts']
// Inside a tsconfig, and matched by `app/[id]/(group)/page.ts` read as a glob rather than a path.
const FILE_THE_PATH_READ_AS_A_GLOB_MATCHES = 'app/i/(group)/page.ts'

const SUPPRESSES_AN_OXLINT_ONLY_RULE = '// eslint-disable-next-line oxc/approx-constant\nexport const pi = 3.141592653589793\n'
const SUPPRESSES_A_RULE_NOBODY_DEFINES = '// eslint-disable-next-line nobody/rule\nexport const pi = 3.141592653589793\n'
// ESLint checks the options an inline config gives a rule against that rule's schema.
const GIVES_AN_OXLINT_ONLY_RULE_OPTIONS = '/* eslint oxc/approx-constant: ["error", { "a": 1 }] */\nexport const pi = 3.141592653589793\n'
const GIVES_NO_DEBUGGER_OPTIONS = '/* eslint no-debugger: ["error", { "a": 1 }] */\nexport const pi = 3.141592653589793\n'
const SUPPRESSES_AN_OXLINT_ONLY_NAME_UNDER_A_REGISTERED_PREFIX =
  '// eslint-disable-next-line react/no-clone-element\nexport const element = null\n'
const SUPPRESSES_A_NAME_NEITHER_ENGINE_HAS_UNDER_A_REGISTERED_PREFIX =
  '// eslint-disable-next-line react/not-a-rule\nexport const element = null\n'

// eslint-import-resolver-typescript 4.4.5's IMPORT_RESOLVER_NAME.
const TYPESCRIPT_RESOLVER_NAME = 'eslint-import-resolver-typescript'
const IMPORT_X_EXTENSIONS = ['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx', '.cjs', '.mjs']
// The react ruleset expects React 18.3 or later, so both engines get that version.
const REACT_VERSION = '18.3.0'

// functional/prefer-immutable-types matches these as RegExps, which JSON could only hold as strings.
const IMMUTABILITY_TYPE_OVERRIDES = [
  { type: /^(?:React\.)?(?:ReactNode|ReactElement|ReactPortal|ReactFragment|JSX\.Element)$/u, to: 'Immutable' },
  { type: /^(?:React\.)?(?:CSSProperties|Properties(?:<.*>)?)$/u, to: 'Immutable' },
  { type: /^(?:HTML|SVG)\w*Element$/u, to: 'Immutable' },
  { type: /^(?:React\.)?(?:RefObject|MutableRefObject|Ref|ForwardedRef)<.*>$/u, to: 'Immutable' },
  { type: /^(?:React\.)?\w*(?:HTML|SVG|DOM)Attributes<.*>$/u, to: 'Immutable' },
  {
    type: /^(?:React\.)?(?:ComponentProps|ComponentPropsWithoutRef|ComponentPropsWithRef|ComponentType|FC|ElementType)<.*>$/u,
    to: 'Immutable',
  },
  { type: /^(?:StoryObj|Meta|StoryFn)<.*>$/u, to: 'Immutable' },
  { type: /^(?:RegExpMatchArray|RegExpExecArray)$/u, to: 'Immutable' },
]
// The index in IMMUTABILITY_TYPE_OVERRIDES of the override reading a type name as Immutable.
const BY_REACT_NODES = 0
const BY_CSS_PROPERTIES = 1
const BY_MARKUP_ELEMENTS = 2
const BY_REFS = 3
const BY_MARKUP_ATTRIBUTES = 4
const BY_COMPONENT_TYPES = 5
const BY_STORIES = 6
const BY_REGEXP_MATCHES = 7
const BY_NONE = -1

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
  linterOptionsFor,
  messagesReportedOn,
  parserOptionsFor,
  ruleEntryFor,
  ruleIdsReportedOn,
  ruleSeverityFor,
} = setUpEslintConfigOracle()

function pluginsOf(block: Readonly<Linter.Config>): Record<string, ESLint.Plugin> {
  if (block.plugins === undefined) throw new Error(`block ${block.name} registers no plugins`)
  return block.plugins
}

function languageOptionsOf(block: Readonly<Linter.Config>): Linter.LanguageOptions {
  if (block.languageOptions === undefined) throw new Error(`block ${block.name} sets no languageOptions`)
  return block.languageOptions
}

function registeredPlugin(prefix: string): ESLint.Plugin {
  const plugin = pluginRegistry[prefix]
  if (plugin === undefined) throw new Error(`the registry has no plugin under ${prefix}`)
  return plugin
}

function ruleNamesOf(plugin: Readonly<ESLint.Plugin> | undefined): string[] {
  if (plugin?.rules === undefined) throw new Error('plugin has no rules')
  return Object.keys(plugin.rules)
}

function rulesOf(plugin: Readonly<ESLint.Plugin>): NonNullable<ESLint.Plugin['rules']> {
  if (plugin.rules === undefined) throw new Error('plugin has no rules')
  return plugin.rules
}

/** 'own' where it is the original's very rule module, 'stub' otherwise. */
function ruleProvenanceOf(plugin: Readonly<ESLint.Plugin>, original: Readonly<ESLint.Plugin>): Record<string, 'own' | 'stub'> {
  const originalRules = rulesOf(original)
  return Object.fromEntries(
    Object.entries(rulesOf(plugin)).map(([name, rule]) => [name, rule === originalRules[name] ? 'own' : 'stub']),
  )
}

/** Suppressions allowed, so ESLint reads the directives the stubs are for. */
function correctnessAllowingSuppressions(): LintRulesInput {
  return buildLintRules({ quality: ['correctness'] }, { allowSuppressions: true })
}

// The real typescript-eslint plugin, whose rules refuse options they do not take.
function realTypescriptEslintPlugin(): ReadonlyMap<string, ESLint.Plugin> {
  return new Map([['@typescript-eslint', pluginRegisteredUnder(eslintPlugins, '@typescript-eslint')]])
}

/** Its max-params declares a schema ESLint cannot compile. */
function typescriptEslintWithAnUncompilableMaxParamsSchema(): ESLint.Plugin {
  const real = pluginRegisteredUnder(eslintPlugins, '@typescript-eslint')
  const maxParams = real.rules?.['max-params']
  if (maxParams === undefined) throw new Error('typescript-eslint has no max-params')
  const schema = [{ type: 'object', properties: { max: { type: 'integer', format: 'no-such-format' } } }] as const
  return { ...real, rules: { ...real.rules, 'max-params': { ...maxParams, meta: { ...maxParams.meta, schema } } } }
}

function causeOfTheErrorThrownBy(build: () => unknown): unknown {
  try {
    build()
  } catch (error) {
    if (error instanceof Error) return error.cause
    throw error
  }
  throw new Error('the build threw nothing')
}

/** How a typed rule is turned on, as a title names it, the lint rules doing so, and the rule's severity there. */
type TypedRuleWay = {
  readonly how: string
  readonly lintRules: () => LintRulesInput
  readonly ruleId: string
  readonly severity: string
  readonly severityInATsFile: string
}

/** What an entry does to max-lines, as a title names it, the lint rules giving that entry, and the severity in each file. */
type EntrySettingMaxLines = { readonly entryDoes: string; readonly lintRules: () => LintRulesInput; readonly severities: Readonly<Record<string, string>> }

/** What an entry does, as a title names it, the lint rules giving that entry, and a rule's severity in a JS or TS file under its glob. */
type EntryByTheBlockItEmits = {
  readonly entryDoes: string
  readonly lintRules: () => LintRulesInput
  readonly lintedFile: string
  readonly ruleId: string
  readonly severity: string
}

describe('buildEslintConfig', () => {
  it('emits named blocks in order: ignores, base, Svelte runes, test runner globals, typed, built-in scopes, file overrides, off-switch', () => {
    const lintRules = buildLintRules(
      { quality: ['correctness', 'type-safety', 'complexity'] },
      {
        ignores: ['dist/**'],
        fileOverrides: [buildFileOverride(['**/*.test.ts'], { rules: { 'demo/strict': 'off' } })],
      },
    )

    expect(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()).map((block) => block.name)).toStrictEqual([
      'agents-inc/ignores',
      'agents-inc/base',
      SVELTE_RUNES_ESLINT_BLOCK_NAME,
      TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME,
      'agents-inc/typed',
      'agents-inc/scope/max-lines',
      'agents-inc/file-overrides/0',
      'agents-inc/oxlint-rules-off',
    ])
  })

  it("names an entry's block for a rule with its own files after the entry", () => {
    const lintRules = buildLintRules({}, { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'max-lines': 'warn' } })] })

    expect(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()).map((block) => block.name)).toStrictEqual([
      'agents-inc/base',
      SVELTE_RUNES_ESLINT_BLOCK_NAME,
      TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME,
      'agents-inc/file-overrides/0/scope/max-lines',
      'agents-inc/oxlint-rules-off',
    ])
  })

  describe('the ignores block', () => {
    it('holds only the config\'s ignores, slash-free ones made to match at any depth, so it is global', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] }, { ignores: ['dist/**', '*.gen.ts'] })
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(blockNamed(config, 'agents-inc/ignores')).toStrictEqual({
        name: 'agents-inc/ignores',
        ignores: ['dist/**', '**/*.gen.ts'],
      })
    })

    it('makes ESLint skip the ignored files and lint the rest', async () => {
      const lintRules = buildLintRules({ quality: ['correctness'] }, { ignores: ['dist/**', '*.gen.ts'] })
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(await isPathIgnored(config, 'dist/a.ts')).toBe(true)
      expect(await isPathIgnored(config, 'src/deep/a.gen.ts')).toBe(true)
      expect(await isPathIgnored(config, 'src/a.ts')).toBe(false)
    })
  })

  describe('the base block', () => {
    it('registers every plugin in the registry, unchanged, and a stub plugin per prefix nobody registers', () => {
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] })
      const plugins = pluginsOf(blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), 'agents-inc/base'))

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
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] })
      const plugins = pluginsOf(blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), 'agents-inc/base'))

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
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] })
      const languageOptions = languageOptionsOf(
        blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), 'agents-inc/base'),
      )

      expect(languageOptions['parser']).toBe(tseslint.parser)
      expect(languageOptions['parserOptions']).toStrictEqual({
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      })
    })

    it('carries the import-x TypeScript resolver and the extensions import-x reads, the immutability type overrides, the extensions eslint-plugin-n tries, ours first, and React 18.3.0 for eslint-plugin-react', () => {
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] })
      const { settings } = blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), 'agents-inc/base')

      expect(settings).toStrictEqual({
        'import-x/resolver-next': [
          expect.objectContaining({ interfaceVersion: 3, name: TYPESCRIPT_RESOLVER_NAME }),
        ],
        'import-x/extensions': IMPORT_X_EXTENSIONS,
        immutability: { overrides: IMMUTABILITY_TYPE_OVERRIDES },
        n: { tryExtensions: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.json', '.node'] },
        react: { version: REACT_VERSION },
      })
    })

    // ESLint applies a directive before any rule runs, so with suppressions banned by default it reads none.
    it('stops ESLint reporting unused disable directives, which the runner checks itself, and reading any by default', () => {
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] })
      const block = blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), 'agents-inc/base')

      expect(block.linterOptions).toStrictEqual({ reportUnusedDisableDirectives: 'off', noInlineConfig: true })
    })

    it('lets ESLint read directives when allowSuppressions is true, still reporting no unused one', async () => {
      const allowing = buildLintRules({ quality: ['correctness', 'type-safety'] }, { allowSuppressions: true })
      const linterOptions = await linterOptionsFor(buildEslintConfig(allowing, catalog, pluginRegistry, buildProjectFacts()), 'src/a.ts')

      expect({
        readsDirectives: linterOptions.noInlineConfig !== true,
        reportsUnusedDirectives: linterOptions.reportUnusedDisableDirectives,
      }).toStrictEqual({ readsDirectives: true, reportsUnusedDirectives: OFF })
    })

    it('holds the untyped ESLint-routed rules, with severity and options', () => {
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] })
      const block = blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), 'agents-inc/base')

      expect(block.rules).toStrictEqual({ 'demo/strict': ['error', { level: 2 }] })
    })

    it.each(JS_AND_TS_EXTENSIONS)('applies to .%s files', async (extension) => {
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] })
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(await ruleEntryFor(config, `src/a.${extension}`, 'demo/strict')).toStrictEqual([ERROR, { level: 2 }])
    })

    it('defines the globals of a listed runtime and not those of an unlisted one', async () => {
      const nodeOnly = buildEslintConfig(buildLintRules({ runtimes: ['node'] }), catalog, pluginRegistry, buildProjectFacts())
      const browserOnly = buildEslintConfig(buildLintRules({ runtimes: ['browser'] }), catalog, pluginRegistry, buildProjectFacts())
      const nodeGlobals = await globalsFor(nodeOnly, 'src/a.ts')
      const browserGlobals = await globalsFor(browserOnly, 'src/a.ts')

      expect(['off', undefined]).not.toContain(nodeGlobals['process'])
      expect(nodeGlobals['window']).toBeUndefined()
      expect(['off', undefined]).not.toContain(browserGlobals['window'])
      expect(browserGlobals['process']).toBeUndefined()
    })
  })

  describe('the typed block', () => {
    it('parses through the project service rooted at tsconfigRootDir and holds the typed rules', () => {
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] }, { tsconfigRootDir: TSCONFIG_ROOT_DIR })
      const block = blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), 'agents-inc/typed')

      expect(block.languageOptions).toStrictEqual({
        parserOptions: { projectService: true, tsconfigRootDir: TSCONFIG_ROOT_DIR },
      })
      expect(block.rules).toStrictEqual({ '@typescript-eslint/no-floating-promises': ['error'] })
    })

    it.each(TS_EXTENSIONS)('runs typed rules on .%s files', async (extension) => {
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] }, { tsconfigRootDir: TSCONFIG_ROOT_DIR })
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(await ruleEntryFor(config, `src/a.${extension}`, '@typescript-eslint/no-floating-promises')).toStrictEqual([
        ERROR,
      ])
    })

    it('runs no typed rule on JavaScript files', async () => {
      const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] }, { tsconfigRootDir: TSCONFIG_ROOT_DIR })
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(OFF_OR_ABSENT).toContainEqual(
        await ruleEntryFor(config, 'src/a.js', '@typescript-eslint/no-floating-promises'),
      )
    })

    // A TS file outside every tsconfig, consumer config files included, gets no typed rules: a typed rule where
    // the project service finds no project is a fatal parse error. No default project is named, as
    // typescript-eslint sets one up once per process and it broke later projects.
    describe('gives the config files a consumer writes for us the typed rules', () => {
      const waysATypedRuleIsTurnedOn: readonly TypedRuleWay[] = [
        {
          how: 'a listed ruleset ships it',
          lintRules() {
            return buildLintRules({ quality: ['type-safety'] })
          },
          ruleId: A_TYPED_RULE,
          severity: 'error',
          severityInATsFile: 'error',
        },
        {
          how: 'the top-level rules turn it on',
          lintRules() {
            return buildLintRules({}, { rules: { [A_TYPED_RULE]: 'warn' } })
          },
          ruleId: A_TYPED_RULE,
          severity: 'warn',
          severityInATsFile: 'warn',
        },
        {
          how: 'it ships with ignores of its own',
          lintRules() {
            return buildLintRules({ quality: ['declarative'] })
          },
          ruleId: 'demo/typed-not-in-tests',
          severity: 'error',
          severityInATsFile: 'error',
        },
        {
          how: 'a file override adds its ruleset for every file',
          lintRules() {
            return buildLintRules(
              {},
              { fileOverrides: [buildFileOverride(['**/*'], { rulesets: { quality: ['type-safety'] } })] },
            )
          },
          ruleId: A_TYPED_RULE,
          severity: 'error',
          severityInATsFile: 'error',
        },
        // The entry's files are .mts files only, so a .ts file keeps the rule off.
        {
          how: 'a file override\'s rules turn it on for every .mts file',
          lintRules() {
            return buildLintRules(
              {},
              { fileOverrides: [buildFileOverride(['**/*.mts'], { rules: { [A_TYPED_RULE]: 'warn' } })] },
            )
          },
          ruleId: A_TYPED_RULE,
          severity: 'warn',
          severityInATsFile: 'off',
        },
      ]

      it.each(waysATypedRuleIsTurnedOn)(
        'through the project service where a tsconfig takes them in, as an ordinary .mts file, when $how',
        async ({ lintRules, ruleId, severity }) => {
          const config = buildEslintConfig(lintRules(), catalog, pluginRegistry, buildProjectFacts())
          const typedLinting = await Promise.all(
            [...CONSUMER_CONFIG_FILES, ORDINARY_MTS_FILE].map(async (file) => ({
              file,
              projectService: (await parserOptionsFor(config, file))['projectService'],
              severity: (await ruleSeverityFor(config, file, ruleId)) ?? 'off',
            })),
          )

          expect(typedLinting).toStrictEqual([...CONSUMER_CONFIG_FILES, ORDINARY_MTS_FILE].map((file) => ({ file, projectService: true, severity })))
        },
      )

      it('names no default project where no tsconfig takes in the two at tsconfigRootDir', () => {
        const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] }, { tsconfigRootDir: TSCONFIG_ROOT_DIR })
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts({ isOutsideEveryTsconfig: outsideEveryTsconfigAmong(CONSUMER_CONFIG_FILES_AND_A_STRAY_OUTSIDE_EVERY_TSCONFIG) }))

        expect(blockNamed(config, 'agents-inc/typed').languageOptions).toStrictEqual({
          parserOptions: { projectService: true, tsconfigRootDir: TSCONFIG_ROOT_DIR },
        })
      })

      it.each(waysATypedRuleIsTurnedOn)(
        'gives each one no tsconfig takes in, the two at tsconfigRootDir included, neither the project service nor the typed rule, as any other TS file outside every tsconfig, when $how',
        async ({ lintRules, ruleId }) => {
          const config = buildEslintConfig(lintRules(), catalog, pluginRegistry, buildProjectFacts({ isOutsideEveryTsconfig: outsideEveryTsconfigAmong(CONSUMER_CONFIG_FILES_AND_A_STRAY_OUTSIDE_EVERY_TSCONFIG) }))
          const typedLinting = await Promise.all(
            CONSUMER_CONFIG_FILES_AND_A_STRAY_OUTSIDE_EVERY_TSCONFIG.map(async (file) => ({
              file,
              projectService: (await parserOptionsFor(config, file))['projectService'],
              severity: (await ruleSeverityFor(config, file, ruleId)) ?? 'off',
            })),
          )

          expect(typedLinting).toStrictEqual(CONSUMER_CONFIG_FILES_AND_A_STRAY_OUTSIDE_EVERY_TSCONFIG.map((file) => ({ file, projectService: undefined, severity: 'off' })))
        },
      )

      // Only a default project could give them one, which broke one ESLint run over several projects.
      it.each(waysATypedRuleIsTurnedOn)('gives the two at tsconfigRootDir no typed rule where no tsconfig takes them in, when $how', async ({ lintRules, ruleId }) => {
        const config = buildEslintConfig(lintRules(), catalog, pluginRegistry, buildProjectFacts({ isOutsideEveryTsconfig: outsideEveryTsconfigAmong(CONSUMER_CONFIG_FILES_AND_A_STRAY_OUTSIDE_EVERY_TSCONFIG) }))
        const severities = await Promise.all(ROOT_CONSUMER_CONFIG_FILES.map(async (file) => ({ file, severity: (await ruleSeverityFor(config, file, ruleId)) ?? 'off' })))

        expect(severities).toStrictEqual(ROOT_CONSUMER_CONFIG_FILES.map((file) => ({ file, severity: 'off' })))
      })

      it('and still runs the untyped rules on them', async () => {
        const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] }, { tsconfigRootDir: TSCONFIG_ROOT_DIR })
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())
        const severities = await Promise.all(
          CONSUMER_CONFIG_FILES.map(async (file) => ({ file, severity: await ruleSeverityFor(config, file, 'demo/strict') })),
        )

        expect(severities).toStrictEqual(CONSUMER_CONFIG_FILES.map((file) => ({ file, severity: 'error' })))
      })

      // A typed rule on a TS file no tsconfig takes in is a fatal parse error that switches off every rule in the file.
      it.each(waysATypedRuleIsTurnedOn)(
        'and gives each TS file outside every tsconfig neither when $how, while a file its path read as a glob would match gets both',
        async ({ lintRules, ruleId, severity, severityInATsFile }) => {
          const config = buildEslintConfig(lintRules(), catalog, pluginRegistry, buildProjectFacts({ isOutsideEveryTsconfig: outsideEveryTsconfigAmong(TS_FILES_OUTSIDE_EVERY_TSCONFIG) }))
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
        const lintRules = buildLintRules({ quality: ['correctness', 'type-safety'] }, { tsconfigRootDir: TSCONFIG_ROOT_DIR })
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts({ isOutsideEveryTsconfig: outsideEveryTsconfigAmong(TS_FILES_OUTSIDE_EVERY_TSCONFIG) }))
        const severities = await Promise.all(
          TS_FILES_OUTSIDE_EVERY_TSCONFIG.map(async (file) => ({ file, severity: await ruleSeverityFor(config, file, 'demo/strict') })),
        )

        expect(severities).toStrictEqual(TS_FILES_OUTSIDE_EVERY_TSCONFIG.map((file) => ({ file, severity: 'error' })))
      })
    })

    // Beside oxlint, a layer stating both twin names runs the extension on TS files alone. Where that extension
    // is typed and no other typed rule runs, the project service must still parse those files.
    describe('where the only typed rule is a typed extension the top level runs on its TS files alone', () => {
      const catalogWithATypedExtension = buildCatalog({
        rulesets: [buildQualityRuleset('correctness')],
        rules: [
          buildOxlintRoute(CORE_RULE_WITH_A_TYPED_EXTENSION, { oxlintName: CORE_RULE_WITH_A_TYPED_EXTENSION, oxlintPlugin: 'eslint', shipped: null }),
          buildEslintRoute(TYPED_EXTENSION, { typed: true, shipped: null }),
        ],
        coreRuleExtensions: new Map([[CORE_RULE_WITH_A_TYPED_EXTENSION, [TYPED_EXTENSION]]]),
      })
      const registryWithTheExtension = buildPluginRegistry({ '@typescript-eslint': [TYPED_EXTENSION_NAME] })

      function lintRulesStatingBothNames(): LintRulesInput {
        return buildLintRules(
          {},
          { tsconfigRootDir: TSCONFIG_ROOT_DIR, rules: { [CORE_RULE_WITH_A_TYPED_EXTENSION]: 'error', [TYPED_EXTENSION]: ['error', AN_OPTION_OXLINT_REFUSES] } },
        )
      }

      it('parses a TS file through the project service and runs the extension there', async () => {
        const config = buildEslintConfig(lintRulesStatingBothNames(), catalogWithATypedExtension, registryWithTheExtension, buildProjectFacts())

        expect({
          projectService: (await parserOptionsFor(config, ORDINARY_MTS_FILE))['projectService'],
          entry: await ruleEntryFor(config, ORDINARY_MTS_FILE, TYPED_EXTENSION),
        }).toStrictEqual({ projectService: true, entry: [ERROR, AN_OPTION_OXLINT_REFUSES] })
      })

      it("names each block it emits, the one running the extension on the top level's TS files alone under agents-inc/scope", () => {
        const config = buildEslintConfig(lintRulesStatingBothNames(), catalogWithATypedExtension, registryWithTheExtension, buildProjectFacts())

        expect(config.map((block) => block.name)).toStrictEqual([
          'agents-inc/base',
          SVELTE_RUNES_ESLINT_BLOCK_NAME,
          TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME,
          'agents-inc/typed',
          `agents-inc/scope/${TYPED_EXTENSION}`,
          'agents-inc/twins-off/0',
          'agents-inc/oxlint-rules-off',
        ])
      })
    })
  })

  describe('built-in scopes', () => {
    it('run a rule shipped with files only on those files, minus its ignores', async () => {
      const config = buildEslintConfig(buildLintRules({ quality: ['complexity'] }), catalog, pluginRegistry, buildProjectFacts())

      expect(await ruleEntryFor(config, 'src/a.tsx', 'max-lines')).toStrictEqual([ERROR, { max: 200 }])
      expect(OFF_OR_ABSENT).toContainEqual(await ruleEntryFor(config, 'src/use-thing.tsx', 'max-lines'))
      expect(OFF_OR_ABSENT).toContainEqual(await ruleEntryFor(config, 'src/a.ts', 'max-lines'))
    })

    it('turn a rule shipped with ignores off under them and leave it on elsewhere', async () => {
      const config = buildEslintConfig(buildLintRules({ quality: ['conventions'] }), catalog, pluginRegistry, buildProjectFacts())

      expect(await ruleEntryFor(config, 'src/a.ts', 'demo/not-in-tests')).toStrictEqual([ERROR])
      expect(OFF_OR_ABSENT).toContainEqual(await ruleEntryFor(config, 'src/a.test.ts', 'demo/not-in-tests'))
    })

    it('keep the shipped files of a rule enabled through rules while its ruleset is unlisted', async () => {
      const lintRules = buildLintRules({}, { rules: { 'storybook/default-exports': 'error' } })
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(await ruleEntryFor(config, 'src/a.stories.tsx', 'storybook/default-exports')).toStrictEqual([ERROR])
      expect(OFF_OR_ABSENT).toContainEqual(await ruleEntryFor(config, 'src/a.tsx', 'storybook/default-exports'))
    })
  })

  describe('file overrides', () => {
    describe('adding a ruleset whose rule is shipped with files', () => {
      it('scope the rule to the override glob AND the rule glob, minus the rule\'s ignores', () => {
        const lintRules = buildLintRules({ quality: ['correctness'] }, { fileOverrides: [buildFileOverride(['src/**'], { rulesets: { libs: { testing: ['storybook'] } } })] })
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())
        const blocksSettingTheRule = config.filter(
          (block) => block.rules !== undefined && 'storybook/default-exports' in block.rules,
        )

        expect(blocksSettingTheRule.map((block) => ({ files: block.files, ignores: block.ignores }))).toStrictEqual([
          { files: [['src/**', '**/*.stories.tsx']], ignores: ['**/legacy/**'] },
        ])
      })

      it('run the rule only where both globs match and its ignores do not', async () => {
        const lintRules = buildLintRules({ quality: ['correctness'] }, { fileOverrides: [buildFileOverride(['src/**'], { rulesets: { libs: { testing: ['storybook'] } } })] })
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

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

    // An entry's rules keep the rule's shipped files and ignores, ANDed with the entry's own globs.
    describe('whose own rules set a rule shipped with files and ignores', () => {
      const FILES_INSIDE_AND_OUTSIDE_THE_SCOPES = ['src/a.tsx', 'src/a.test.js', 'src/use-thing.tsx', 'lib/a.tsx']
      const entriesSettingMaxLines: readonly EntrySettingMaxLines[] = [
        {
          entryDoes: 'softens it while its ruleset is listed',
          lintRules() {
            return buildLintRules(
              { quality: ['complexity'] },
              { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'max-lines': 'warn' } })] },
            )
          },
          severities: { 'src/a.tsx': 'warn', 'src/a.test.js': 'off', 'src/use-thing.tsx': 'off', 'lib/a.tsx': 'error' },
        },
        {
          entryDoes: 'turns it on while its ruleset is unlisted',
          lintRules() {
            return buildLintRules(
              {},
              { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'max-lines': ['error', { max: 300 }] } })] },
            )
          },
          severities: { 'src/a.tsx': 'error', 'src/a.test.js': 'off', 'src/use-thing.tsx': 'off', 'lib/a.tsx': 'off' },
        },
        {
          entryDoes: 'turns it off',
          lintRules() {
            return buildLintRules(
              { quality: ['complexity'] },
              { fileOverrides: [buildFileOverride(['src/**'], { rules: { 'max-lines': 'off' } })] },
            )
          },
          severities: { 'src/a.tsx': 'off', 'src/a.test.js': 'off', 'src/use-thing.tsx': 'off', 'lib/a.tsx': 'error' },
        },
      ]

      it.each(entriesSettingMaxLines)(
        'run it only inside its own scope when the entry $entryDoes',
        async ({ lintRules, severities }) => {
          const config = buildEslintConfig(lintRules(), catalog, pluginRegistry, buildProjectFacts())
          const calculated = Object.fromEntries(
            await Promise.all(
              FILES_INSIDE_AND_OUTSIDE_THE_SCOPES.map(async (file): Promise<[string, string]> => [
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
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())
        const calculated = Object.fromEntries(
          await Promise.all(
            ['src/a.ts', 'src/a.test.ts', 'lib/a.ts'].map(async (file): Promise<[string, string]> => [
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
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(await ruleEntryFor(config, 'src/a.test.ts', 'demo/strict')).toStrictEqual([WARN, { level: 2 }])
      expect(await ruleEntryFor(config, 'src/a.ts', 'demo/strict')).toStrictEqual([ERROR, { level: 2 }])
    })

    // ESLint lints every file a block's `files` matches, so an entry's glob alone would hand it x.test.json,
    // which then fails to parse, or throws where the entry sets a plugin's rule.
    describe('whose glob also matches files that are not JS or TS', () => {
      const entriesByBlockTheyEmit: readonly EntryByTheBlockItEmits[] = [
        {
          entryDoes: 'sets a rule',
          lintRules() {
            return buildLintRules(
              { quality: ['correctness'] },
              { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rules: { 'demo/strict': 'warn' } })] },
            )
          },
          lintedFile: 'src/x.test.ts',
          ruleId: 'demo/strict',
          severity: 'warn',
        },
        {
          entryDoes: 'drops a runtime',
          lintRules() {
            return buildLintRules(
              { runtimes: ['node', 'browser'] },
              { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rulesets: { runtimes: ['node'] } })] },
            )
          },
          lintedFile: 'src/x.test.ts',
          ruleId: 'unicorn/prefer-dom-node-append',
          severity: 'off',
        },
        {
          entryDoes: 'adds a rule shipped with ignores only',
          lintRules() {
            return buildLintRules(
              {},
              { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rulesets: { quality: ['conventions'] } })] },
            )
          },
          // demo/not-in-tests ships ignoring **/*.test.ts
          lintedFile: 'src/x.test.tsx',
          ruleId: 'demo/not-in-tests',
          severity: 'error',
        },
        {
          entryDoes: 'adds a typed rule',
          lintRules() {
            return buildLintRules(
              {},
              { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rulesets: { quality: ['type-safety'] } })] },
            )
          },
          lintedFile: 'src/x.test.ts',
          ruleId: '@typescript-eslint/no-floating-promises',
          severity: 'error',
        },
      ]

      it.each(entriesByBlockTheyEmit)('make ESLint lint no such file when the entry $entryDoes', async ({ lintRules }) => {
        const config = buildEslintConfig(lintRules(), catalog, pluginRegistry, buildProjectFacts())
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
          const config = buildEslintConfig(lintRules(), catalog, pluginRegistry, buildProjectFacts())

          expect(await ruleSeverityFor(config, lintedFile, ruleId)).toBe(severity)
        },
      )
    })

    // A directory glob names no extension, so ANDed with an entry glob that names none either, it matches
    // every file in the directory, x.test.json included.
    describe('whose glob matches files that are not JS or TS, adding a rule shipped with a directory glob', () => {
      it('make ESLint lint no such file in that directory', async () => {
        const lintRules = buildLintRules({}, { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rulesets: { libs: { testing: ['storybook'] } } })] })
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())
        const lintedByEslint = await Promise.all(
          NON_JS_FILES_IN_THE_STORYBOOK_DIRECTORY.map(async (file) => ({
            file,
            linted: (await calculatedConfigFor(config, file)) !== undefined,
          })),
        )

        expect(lintedByEslint).toStrictEqual(NON_JS_FILES_IN_THE_STORYBOOK_DIRECTORY.map((file) => ({ file, linted: false })))
      })

      it('still run the rule on a TS file in that directory', async () => {
        const lintRules = buildLintRules({}, { fileOverrides: [buildFileOverride([GLOB_MATCHING_NON_JS_FILES_TOO], { rulesets: { libs: { testing: ['storybook'] } } })] })
        const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

        expect(await ruleSeverityFor(config, '.storybook/x.test.ts', 'storybook/context-in-play-function')).toBe('error')
      })
    })
  })

  describe('the oxlint off-switch', () => {
    it('turns off every oxlint-routed rule, listed or not, under its ID and each alias, and nothing else', () => {
      const config = buildEslintConfig(buildLintRules({ quality: ['correctness'] }), catalog, pluginRegistry, buildProjectFacts())

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
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(await ruleSeverityFor(config, 'src/a.ts', '@typescript-eslint/no-unused-vars')).toBe('error')
      expect(await ruleSeverityFor(config, 'src/a.ts', 'no-unused-vars')).toBe('off')
    })

    // The stubs matter only where ESLint reads directives: where suppressions are allowed.
    it('lets a suppression of an oxlint-only rule load, through its stub', async () => {
      const config = buildEslintConfig(
        buildLintRules({ quality: ['correctness'] }, { allowSuppressions: true }),
        catalog,
        pluginRegistry,
        buildProjectFacts(),
      )

      expect(await ruleIdsReportedOn(config, SUPPRESSES_AN_OXLINT_ONLY_RULE, 'src/suppressed.js')).toStrictEqual([])
    })

    it('lets an inline config give an oxlint-only rule options, through its stub, where it reports options no-debugger refuses', async () => {
      const config = buildEslintConfig(correctnessAllowingSuppressions(), catalog, pluginRegistry, buildProjectFacts())

      expect({
        oxlintOnly: await ruleIdsReportedOn(config, GIVES_AN_OXLINT_ONLY_RULE_OPTIONS, 'src/suppressed.js'),
        refusingThem: await ruleIdsReportedOn(config, GIVES_NO_DEBUGGER_OPTIONS, 'src/suppressed.js'),
      }).toStrictEqual({ oxlintOnly: [], refusingThem: ['no-debugger'] })
    })

    it('still lets ESLint report a suppression of a rule no plugin defines', async () => {
      const config = buildEslintConfig(
        buildLintRules({ quality: ['correctness'] }, { allowSuppressions: true }),
        catalog,
        pluginRegistry,
        buildProjectFacts(),
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

    function basePlugins(): Record<string, ESLint.Plugin> {
      return pluginsOf(blockNamed(buildEslintConfig(correctnessAllowingSuppressions(), catalogWithOxlintOnlyNames, registry, buildProjectFacts()), 'agents-inc/base'))
    }

    it('is registered as a copy holding each of its own rules and a stub per oxlint-only name it lacks', () => {
      expect(ruleProvenanceOf(pluginRegisteredUnder(basePlugins(), 'react'), reactPlugin)).toStrictEqual({
        'jsx-key': 'own',
        'no-clone-element': 'stub',
        'no-danger': 'own',
      })
    })

    it('is copied rather than changed: the registry still holds the same plugin, with only its own rules', () => {
      const registered = pluginRegisteredUnder(basePlugins(), 'react')

      expect({ registeredIsTheOriginal: registered === reactPlugin, originalRuleNames: ruleNamesOf(reactPlugin) }).toStrictEqual({
        registeredIsTheOriginal: false,
        originalRuleNames: ['jsx-key', 'no-danger'],
      })
    })

    it('keeps the original plugin\'s meta on the copy', () => {
      expect(pluginRegisteredUnder(basePlugins(), 'react').meta).toBe(reactPlugin.meta)
    })

    it('lets a suppression of the oxlint-only name load in ESLint', async () => {
      const config = buildEslintConfig(correctnessAllowingSuppressions(), catalogWithOxlintOnlyNames, registry, buildProjectFacts())

      expect(
        await ruleIdsReportedOn(config, SUPPRESSES_AN_OXLINT_ONLY_NAME_UNDER_A_REGISTERED_PREFIX, 'src/suppressed.tsx'),
      ).toStrictEqual([])
    })

    it('still lets ESLint report a suppression of a name neither the plugin nor oxlint has', async () => {
      const config = buildEslintConfig(correctnessAllowingSuppressions(), catalogWithOxlintOnlyNames, registry, buildProjectFacts())

      expect(
        await ruleIdsReportedOn(config, SUPPRESSES_A_NAME_NEITHER_ENGINE_HAS_UNDER_A_REGISTERED_PREFIX, 'src/suppressed.tsx'),
      ).toStrictEqual(['react/not-a-rule'])
    })
  })

  // oxlint honours a suppression of a renamed rule only under its own name (measured, 1.87), so ESLint needs
  // a definition of that name too, under the ID's prefix.
  describe("an oxlint-routed rule whose oxlint name differs from its ID's", () => {
    const catalogWithRenamedRules = buildCatalog({
      rulesets: [buildQualityRuleset('correctness')],
      rules: [
        buildOxlintRoute('unicorn/no-for-each', { oxlintName: 'unicorn/no-array-for-each', oxlintPlugin: 'unicorn', shipped: buildShippedRule('correctness') }),
        buildOxlintRoute('unicorn/dom-node-dataset', { oxlintName: 'unicorn/prefer-dom-node-dataset', oxlintPlugin: 'unicorn', shipped: buildShippedRule('correctness') }),
        buildOxlintRoute('@typescript-eslint/no-explicit-any', { oxlintName: 'typescript/no-explicit-any', oxlintPlugin: 'typescript', shipped: buildShippedRule('correctness') }),
      ],
    })
    // As unicorn 77 is: no-for-each, and dom-node-dataset beside its deprecated old name, but no no-array-for-each.
    const unicornPlugin = buildFakePlugin(['dom-node-dataset', 'no-for-each', 'prefer-dom-node-dataset'], { meta: { name: 'eslint-plugin-unicorn', version: '77.0.0' } })
    const typescriptEslintPlugin = buildFakePlugin(['no-explicit-any'])
    const registry = { '@typescript-eslint': typescriptEslintPlugin, unicorn: unicornPlugin }
    const SUPPRESSES_IN_OXLINTS_SPELLING = '// eslint-disable-next-line unicorn/no-array-for-each\nexport const each = [1].forEach((n) => n)\n'
    const SUPPRESSES_UNDER_THE_ID = '// eslint-disable-next-line unicorn/no-for-each\nexport const each = [1].forEach((n) => n)\n'

    function basePlugins(): Record<string, ESLint.Plugin> {
      return pluginsOf(blockNamed(buildEslintConfig(correctnessAllowingSuppressions(), catalogWithRenamedRules, registry, buildProjectFacts()), 'agents-inc/base'))
    }

    it("gets a stub for its oxlint name under its ID's prefix where the plugin lacks that name, and none where the plugin has it", () => {
      expect(ruleProvenanceOf(pluginRegisteredUnder(basePlugins(), 'unicorn'), unicornPlugin)).toStrictEqual({
        'dom-node-dataset': 'own',
        'no-array-for-each': 'stub',
        'no-for-each': 'own',
        'prefer-dom-node-dataset': 'own',
      })
    })

    it("gets none where its oxlint name differs from its ID's in the prefix alone", () => {
      const plugins = basePlugins()

      expect({ prefixes: Object.keys(plugins).toSorted(), typescriptEslint: ruleProvenanceOf(pluginRegisteredUnder(plugins, '@typescript-eslint'), typescriptEslintPlugin) }).toStrictEqual({
        prefixes: ['@typescript-eslint', 'unicorn'],
        typescriptEslint: { 'no-explicit-any': 'own' },
      })
    })

    it("lets a suppression in oxlint's spelling load in ESLint, as one under the ID does", async () => {
      const config = buildEslintConfig(correctnessAllowingSuppressions(), catalogWithRenamedRules, registry, buildProjectFacts())

      expect({
        oxlintsSpelling: await ruleIdsReportedOn(config, SUPPRESSES_IN_OXLINTS_SPELLING, 'src/suppressed.js'),
        underTheId: await ruleIdsReportedOn(config, SUPPRESSES_UNDER_THE_ID, 'src/suppressed.js'),
      }).toStrictEqual({ oxlintsSpelling: [], underTheId: [] })
    })
  })

  // Without oxlint, ESLint takes over oxlint's rules, and on TS files a core rule typescript-eslint extends runs
  // as its extension. Builds beside oxlint keep the core rule.
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
        // Routed to ESLint, so no build swaps it.
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
    const ourTypeInformation: TypeInformation = {
      from: 'ours',
      tsconfigRootDir: TSCONFIG_ROOT_DIR,
      isOutsideEveryTsconfig: outsideEveryTsconfigAmong([STRAY_TS_FILE]),
    }
    const teamTypeInformation: TypeInformation = {
      from: 'the team',
      blocks: [{ switches: 'on', files: ['packages/typed/**'], ignores: [] }],
    }

    /** Lists no oxlint in package.json unless `besideOxlint`. */
    function ourBlocks(
      lintRules: ReturnType<typeof buildLintRules>,
      {
        typeInformation = ourTypeInformation,
        besideOxlint = false,
        plugins = realTypescriptEslintPlugin(),
      }: { typeInformation?: TypeInformation; besideOxlint?: boolean; plugins?: ReadonlyMap<string, ESLint.Plugin> } = {},
    ): Linter.Config[] {
      const { globalIgnores, base, afterTheBase } = eslintBlocksBeforeTheOffSwitch(
        {
          layers: resolveRuleLayers(lintRules, twinsCatalog),
          plugins,
          linterOptions: null,
          settings: buildEslintSettings(buildProjectFacts()),
          typeInformation,
          twinsOnTsFiles: !besideOxlint,
        },
        twinsCatalog,
      )
      return [...globalIgnores, base, ...afterTheBase]
    }

    /** NOT_RUN where no block sets it or it is off. */
    async function entriesIn(
      config: readonly Linter.Config[],
      files: readonly string[],
      ruleIds: readonly string[],
    ): Promise<Record<string, Record<string, unknown>>> {
      return Object.fromEntries(
        await Promise.all(
          files.map(async (file): Promise<[string, Record<string, unknown>]> => [
            file,
            Object.fromEntries(await Promise.all(ruleIds.map(async (ruleId): Promise<[string, unknown]> => [ruleId, await runningEntryFor(config, file, ruleId)]))),
          ]),
        ),
      )
    }

    async function runningEntryFor(config: readonly Linter.Config[], file: string, ruleId: string): Promise<unknown> {
      const severity = await ruleSeverityFor(config, file, ruleId)
      return severity === undefined || severity === 'off' ? NOT_RUN : ruleEntryFor(config, file, ruleId)
    }

    /** ESLint fills in the default options the rule declares. */
    async function coreEntryAsEslintFillsIn(ruleId: string, entry: Linter.RuleSeverity): Promise<unknown> {
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

    // A typed extension runs only where there is type information; elsewhere the core rule does.
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

    // typescript-eslint's max-params refuses a bare number, and a refused option ends ESLint's run.
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

    // Any failure other than a refusal must surface, not silently keep the core rule.
    it("throws, with ESLint's error as its cause, where checking the extension's options fails for another reason than refusing them", () => {
      const plugins = new Map([['@typescript-eslint', typescriptEslintWithAnUncompilableMaxParamsSchema()]])
      const cause = causeOfTheErrorThrownBy(() => ourBlocks(buildLintRules({ quality: ['complexity'] }), { plugins }))

      expect(cause instanceof Error ? cause.message : cause).toMatch(/options validation schema/u)
    })

    // The highest layer stating either name decides; the extension runs on TS files and the core rule on JS files.
    it("runs the extension on TS files and the core rule on JS files, each with the consumer's setting of the extension, over the core rule a listed ruleset ships", async () => {
      const lintRules = buildLintRules({ quality: ['complexity'] }, { rules: { [MAX_PARAMS_TWIN]: ['error', { max: 2 }] } })

      expect(await entriesIn(ourBlocks(lintRules), [TS_FILE, JS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 2 }] },
        [JS_FILE]: { 'max-params': [ERROR, { max: 2 }], [MAX_PARAMS_TWIN]: NOT_RUN },
      })
    })

    it("runs the extension on TS files and the core rule on JS files, each with its own setting, where one layer states both", async () => {
      const lintRules = buildLintRules({}, { rules: { 'max-params': ['error', { max: 5 }], [MAX_PARAMS_TWIN]: ['error', { max: 2 }] } })

      expect(await entriesIn(ourBlocks(lintRules), [TS_FILE, JS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 2 }] },
        [JS_FILE]: { 'max-params': [ERROR, { max: 5 }], [MAX_PARAMS_TWIN]: NOT_RUN },
      })
    })

    // A written limit (plan.md, Open, #60): where no layer states the core rule, nothing is taken over.
    it('runs the extension on JS and TS files alike, and the core rule nowhere, where the top level states the extension alone and no layer states the core rule', async () => {
      const lintRules = buildLintRules({}, { rules: { [MAX_PARAMS_TWIN]: ['error', { max: 3 }] } })

      expect(await entriesIn(ourBlocks(lintRules), [TS_FILE, JS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 3 }] },
        [JS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [ERROR, { max: 3 }] },
      })
    })

    it("runs the extension on an entry's JS and TS files alike, and the core rule nowhere, where the entry states the extension alone and no layer states the core rule", async () => {
      const lintRules = buildLintRules({}, { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { [MAX_PARAMS_TWIN]: ['warn', { max: 2 }] } })] })

      expect(await entriesIn(ourBlocks(lintRules), [LEGACY_TS_FILE, LEGACY_JS_FILE, TS_FILE], ['max-params', MAX_PARAMS_TWIN])).toStrictEqual({
        [LEGACY_TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [WARN, { max: 2 }] },
        [LEGACY_JS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: [WARN, { max: 2 }] },
        [TS_FILE]: { 'max-params': NOT_RUN, [MAX_PARAMS_TWIN]: NOT_RUN },
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

    // typescript-eslint's prefer-destructuring takes an option the core rule's second object does not.
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

    // An entry turning the core rule off turns the extension off too, and its own later statement of the extension decides.
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

      expect(blockNamed(buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts()), 'agents-inc/base').rules).toStrictEqual({
        'demo/strict': ['error', { level: 2 }],
      })
    })
  })
})

// Both rules of a pair run in ESLint on every file, one with type information and one without. The core
// throws on data that breaks this, which would report twice.
describe('a rule split by types with another, as the data gives it', () => {
  const UNTYPED = 'unicorn/no-unnecessary-boolean-comparison'
  const TYPED = '@typescript-eslint/no-unnecessary-boolean-literal-compare'
  const SRC_FILES = ['src/**']
  const TEST_FILES = ['**/*.test.ts']
  const untypedInEslint = buildEslintRoute(UNTYPED, { typed: false, shipped: buildShippedRule('redundancy', { splitByTypesWith: TYPED }) })
  const typedInEslint = buildEslintRoute(TYPED, { typed: true, shipped: buildShippedRule('redundancy') })
  const splitRegistry = buildPluginRegistry({ '@typescript-eslint': ['no-unnecessary-boolean-literal-compare'], unicorn: ['no-unnecessary-boolean-comparison'] })

  function configWith(untyped: Readonly<RuleRoute>, typed: Readonly<RuleRoute>): Linter.Config[] {
    const splitCatalog = buildCatalog({ rulesets: [buildQualityRuleset('redundancy')], rules: [untyped, typed] })
    return buildEslintConfig(buildLintRules({ quality: ['redundancy'] }), splitCatalog, splitRegistry, buildProjectFacts())
  }

  it('is built where both run in ESLint on every file: the untyped rule off in a TS file with types, and on in a JS file', async () => {
    const config = configWith(untypedInEslint, typedInEslint)

    expect({ typedFile: await ruleEntryFor(config, 'src/a.ts', UNTYPED), jsFile: await ruleEntryFor(config, 'src/a.js', UNTYPED) }).toStrictEqual({
      typedFile: [OFF],
      jsFile: [ERROR],
    })
  })

  it.each([
    {
      breach: 'the untyped rule runs in oxlint',
      untyped: buildOxlintRoute(UNTYPED, { oxlintName: 'no-unnecessary-boolean-comparison', oxlintPlugin: 'unicorn', shipped: buildShippedRule('redundancy', { splitByTypesWith: TYPED }) }),
      typed: typedInEslint,
    },
    {
      breach: 'the typed rule runs in oxlint',
      untyped: untypedInEslint,
      typed: { ...buildOxlintRoute(TYPED, { oxlintName: 'no-unnecessary-boolean-literal-compare', oxlintPlugin: 'typescript', shipped: buildShippedRule('redundancy') }), typed: true },
    },
    {
      breach: 'the untyped rule ships with files',
      untyped: buildEslintRoute(UNTYPED, { typed: false, shipped: buildShippedRule('redundancy', { splitByTypesWith: TYPED, files: SRC_FILES }) }),
      typed: typedInEslint,
    },
    {
      breach: 'the untyped rule ships with ignores',
      untyped: buildEslintRoute(UNTYPED, { typed: false, shipped: buildShippedRule('redundancy', { splitByTypesWith: TYPED, ignores: TEST_FILES }) }),
      typed: typedInEslint,
    },
    { breach: 'the typed rule ships with files', untyped: untypedInEslint, typed: buildEslintRoute(TYPED, { typed: true, shipped: buildShippedRule('redundancy', { files: SRC_FILES }) }) },
    { breach: 'the typed rule ships with ignores', untyped: untypedInEslint, typed: buildEslintRoute(TYPED, { typed: true, shipped: buildShippedRule('redundancy', { ignores: TEST_FILES }) }) },
    { breach: 'the typed rule runs without type information', untyped: untypedInEslint, typed: buildEslintRoute(TYPED, { typed: false, shipped: buildShippedRule('redundancy') }) },
    {
      breach: 'the untyped rule needs type information',
      untyped: buildEslintRoute(UNTYPED, { typed: true, shipped: buildShippedRule('redundancy', { splitByTypesWith: TYPED }) }),
      typed: typedInEslint,
    },
  ])('is refused where $breach', ({ untyped, typed }) => {
    expect(() => configWith(untyped, typed)).toThrow(`${UNTYPED}: split by types with ${TYPED}`)
  })

  // An entry stating either rule of the pair states the untyped one in a typed block of its own; one
  // stating neither leaves it to the top level's typed block.
  function blockNamesWithAnEntryStating(rules: RuleSettingsInput): Array<string | undefined> {
    const splitCatalog = buildCatalog({ rulesets: [buildQualityRuleset('redundancy')], rules: [untypedInEslint, typedInEslint] })
    const lintRules = buildLintRules({ quality: ['redundancy'] }, { fileOverrides: [buildFileOverride(['legacy/**'], { rules })] })
    return buildEslintConfig(lintRules, splitCatalog, splitRegistry, buildProjectFacts()).map((block) => block.name)
  }

  const BLOCKS_BEFORE_THE_ENTRIES = ['agents-inc/base', SVELTE_RUNES_ESLINT_BLOCK_NAME, TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME, 'agents-inc/typed']

  it.each([
    { states: 'the untyped rule', rules: { [UNTYPED]: 'warn' } },
    { states: 'the typed rule', rules: { [TYPED]: 'off' } },
  ] satisfies Array<{ states: string; rules: RuleSettingsInput }>)('gives an entry stating $states a typed block of its own, named for the entry', ({ rules }) => {
    expect(blockNamesWithAnEntryStating(rules)).toStrictEqual([
      ...BLOCKS_BEFORE_THE_ENTRIES,
      'agents-inc/file-overrides/0',
      'agents-inc/file-overrides/0/typed',
      'agents-inc/oxlint-rules-off',
    ])
  })

  it('gives an entry stating neither rule of the pair no block', () => {
    expect(blockNamesWithAnEntryStating({})).toStrictEqual([...BLOCKS_BEFORE_THE_ENTRIES, 'agents-inc/oxlint-rules-off'])
  })
})

describe('buildEslintSettings', () => {
  it('gives eslint-plugin-react React 18.3.0', () => {
    expect(buildEslintSettings(buildProjectFacts())['react']).toStrictEqual({ version: REACT_VERSION })
  })
})

// The base block's settings hold IMMUTABILITY_TYPE_OVERRIDES, each RegExp equal in source and flags (the base block
// test), so what these read is what functional/prefer-immutable-types reads as Immutable in a team's code.
describe('the immutability type overrides the base block gives', () => {
  it.each([
    { typeName: 'ReactNode', readBy: BY_REACT_NODES },
    { typeName: 'React.ReactElement', readBy: BY_REACT_NODES },
    { typeName: 'ReactPortal', readBy: BY_REACT_NODES },
    { typeName: 'React.ReactFragment', readBy: BY_REACT_NODES },
    { typeName: 'JSX.Element', readBy: BY_REACT_NODES },
    { typeName: 'React.JSX.Element', readBy: BY_REACT_NODES },
    { typeName: 'CSSProperties', readBy: BY_CSS_PROPERTIES },
    { typeName: 'React.CSSProperties', readBy: BY_CSS_PROPERTIES },
    { typeName: 'Properties', readBy: BY_CSS_PROPERTIES },
    { typeName: 'Properties<string>', readBy: BY_CSS_PROPERTIES },
    { typeName: 'HTMLElement', readBy: BY_MARKUP_ELEMENTS },
    { typeName: 'HTMLDivElement', readBy: BY_MARKUP_ELEMENTS },
    { typeName: 'SVGPathElement', readBy: BY_MARKUP_ELEMENTS },
    { typeName: 'RefObject<HTMLDivElement>', readBy: BY_REFS },
    { typeName: 'React.MutableRefObject<number>', readBy: BY_REFS },
    { typeName: 'Ref<T>', readBy: BY_REFS },
    { typeName: 'ForwardedRef<T>', readBy: BY_REFS },
    { typeName: 'HTMLAttributes<HTMLDivElement>', readBy: BY_MARKUP_ATTRIBUTES },
    { typeName: 'React.InputHTMLAttributes<HTMLInputElement>', readBy: BY_MARKUP_ATTRIBUTES },
    { typeName: 'SVGAttributes<SVGElement>', readBy: BY_MARKUP_ATTRIBUTES },
    { typeName: 'DOMAttributes<T>', readBy: BY_MARKUP_ATTRIBUTES },
    { typeName: 'ComponentProps<typeof Button>', readBy: BY_COMPONENT_TYPES },
    { typeName: 'React.ComponentPropsWithoutRef<"button">', readBy: BY_COMPONENT_TYPES },
    { typeName: 'ComponentPropsWithRef<T>', readBy: BY_COMPONENT_TYPES },
    { typeName: 'ComponentType<Props>', readBy: BY_COMPONENT_TYPES },
    { typeName: 'React.FC<Props>', readBy: BY_COMPONENT_TYPES },
    { typeName: 'ElementType<T>', readBy: BY_COMPONENT_TYPES },
    { typeName: 'StoryObj<typeof Button>', readBy: BY_STORIES },
    { typeName: 'Meta<typeof Button>', readBy: BY_STORIES },
    { typeName: 'StoryFn<T>', readBy: BY_STORIES },
    { typeName: 'RegExpMatchArray', readBy: BY_REGEXP_MATCHES },
    { typeName: 'RegExpExecArray', readBy: BY_REGEXP_MATCHES },
  ])('read $typeName by the override at index $readBy', ({ typeName, readBy }) => {
    expect(IMMUTABILITY_TYPE_OVERRIDES.findIndex(({ type }) => type.test(typeName))).toBe(readBy)
  })

  it.each([
    'ReactNodes',
    'MyReactNode',
    'JSXxElement',
    'CSSPropertiesX',
    'Element',
    'HTMLDivElements',
    'RefObject',
    'AriaAttributes<T>',
    'HTMLAttributes',
    'FC',
    'MyFC<Props>',
    'Metadata<T>',
    'React.Meta<T>',
    'RegExpMatchArrays',
    'RegExp',
  ])('read %s by none', (typeName) => {
    expect(IMMUTABILITY_TYPE_OVERRIDES.findIndex(({ type }) => type.test(typeName))).toBe(BY_NONE)
  })
})

// Only the ESLint build writes a setting for test files, so the data routes each rule with one to ESLint.
// The rule here is off where suppressions are allowed, so a test-file setting leaking out of a banning entry shows.
describe('a rule allowSuppressions decides, given a setting for test files while suppressions are banned', () => {
  // Slash-free, as ESLint matches only at the root unless it is given at any depth.
  const STRICT_IN_TEST_FILES = { files: ['*.test.ts'], options: [{ level: 1 }] }
  const SHIPPED_WITH_A_TEST_FILE_SETTING = {
    ...buildSuppressionModeShippedRule(),
    whenSuppressions: { banned: { options: [{ level: 2 }] }, allowed: 'off', bannedInTestFiles: STRICT_IN_TEST_FILES },
  } as const
  const strictAlone = buildPluginRegistry({ demo: ['strict'] })

  const routedToEslint = buildCatalog({ rulesets: [], rules: [buildEslintRoute('demo/strict', { typed: false, shipped: SHIPPED_WITH_A_TEST_FILE_SETTING })] })

  function blockNamesOf(lintRules: ReturnType<typeof buildLintRules>): Array<string | undefined> {
    return buildEslintConfig(lintRules, routedToEslint, strictAlone, buildProjectFacts())
      .map(({ name }) => name)
      .filter((name) => name?.endsWith('/demo/strict'))
  }

  it('takes it in test files alone, at any depth, routed to ESLint', async () => {
    const config = buildEslintConfig(buildLintRules({}), routedToEslint, strictAlone, buildProjectFacts())

    expect({
      testFile: await ruleEntryFor(config, 'src/a.test.ts', 'demo/strict'),
      otherFile: await ruleEntryFor(config, 'src/a.ts', 'demo/strict'),
    }).toStrictEqual({ testFile: [ERROR, { level: 1 }], otherFile: [ERROR, { level: 2 }] })
  })

  it("takes it in an entry's test files alone, where the entry bans suppressions under a top level allowing them", async () => {
    const lintRules = buildLintRules({}, { allowSuppressions: true, fileOverrides: [buildFileOverride(['strict/**'], { allowSuppressions: false })] })
    const config = buildEslintConfig(lintRules, routedToEslint, strictAlone, buildProjectFacts())

    // Off where suppressions are allowed, so no block states it outside the entry.
    expect({
      entryTestFile: await ruleEntryFor(config, 'strict/a.test.ts', 'demo/strict'),
      entryOtherFile: await ruleEntryFor(config, 'strict/a.ts', 'demo/strict'),
      testFileOutsideTheEntry: await ruleEntryFor(config, 'src/a.test.ts', 'demo/strict'),
    }).toStrictEqual({ entryTestFile: [ERROR, { level: 1 }], entryOtherFile: [ERROR, { level: 2 }], testFileOutsideTheEntry: undefined })
  })

  it("names the test files' block of an entry under the entry's name, as the top level's is under its own, as ESLint's config inspector shows them", () => {
    expect({
      topLevel: blockNamesOf(buildLintRules({})),
      entry: blockNamesOf(buildLintRules({}, { allowSuppressions: true, fileOverrides: [buildFileOverride(['strict/**'], { allowSuppressions: false })] })),
    }).toStrictEqual({ topLevel: ['agents-inc/test-files/demo/strict'], entry: ['agents-inc/file-overrides/0/test-files/demo/strict'] })
  })

  it('is refused routed to oxlint, naming the rule', () => {
    const routedToOxlint = buildCatalog({
      rulesets: [],
      rules: [buildOxlintRoute('no-debugger', { oxlintName: 'no-debugger', oxlintPlugin: 'eslint', shipped: SHIPPED_WITH_A_TEST_FILE_SETTING })],
    })

    expect(() => buildEslintConfig(buildLintRules({}), routedToOxlint, strictAlone, buildProjectFacts())).toThrow(
      'no-debugger: given a setting for test files while suppressions are banned',
    )
  })
})

// As the real catalog routes the rules allowSuppressions decides: the ban to ESLint, unicorn/no-abusive-eslint-disable to oxlint.
describe('an entry giving allowSuppressions, where oxlint runs one of the rules it decides', () => {
  const BLANKET_DISABLE_RULE = 'unicorn/no-abusive-eslint-disable'
  const routedToBothEngines = buildCatalog({
    rulesets: [],
    rules: [
      buildEslintRoute('demo/strict', { typed: false, shipped: buildSuppressionModeShippedRule() }),
      buildOxlintRoute(BLANKET_DISABLE_RULE, {
        oxlintName: BLANKET_DISABLE_RULE,
        oxlintPlugin: 'unicorn',
        shipped: buildShippedRuleDecidedBySuppressions({ banned: 'off', allowed: { options: [] } }),
      }),
    ],
  })
  const strictAlone = buildPluginRegistry({ demo: ['strict'] })

  it.each([
    { mode: 'banning them under a top level allowing them', topLevel: true, entry: false, rules: { 'demo/strict': ['error'] } },
    { mode: 'allowing them under a top level banning them', topLevel: false, entry: true, rules: { 'demo/strict': 'off' } },
  ])("states in the entry's block the one ESLint runs and not the one oxlint runs, $mode", ({ topLevel, entry, rules }) => {
    const lintRules = buildLintRules({}, { allowSuppressions: topLevel, fileOverrides: [buildFileOverride(['strict/**'], { allowSuppressions: entry })] })
    const config = buildEslintConfig(lintRules, routedToBothEngines, strictAlone, buildProjectFacts())

    expect(blockNamed(config, 'agents-inc/file-overrides/0').rules).toStrictEqual(rules)
  })
})
