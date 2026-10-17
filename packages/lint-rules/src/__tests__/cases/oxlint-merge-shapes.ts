import type { OxlintOverride } from 'oxlint'
import { buildOurShapeValue, buildTeamShapeValue, type OxlintMergeShapeValue } from '../factories/shape-factories.ts'
import { buildTeamOxlintConfig } from '../factories/team-config-factories.ts'
import type { Dimension } from '../pairwise-shapes.ts'

// Team and our oxlint config shapes, each a dimension, checked against the real oxlint CLI.

// app/ holds the files only the shapes stating rules under other keys name.
export const OXLINT_MERGE_LINTED_DIRS = ['src', 'lib', 'app']

// Rule each line draws: 1 typescript/consistent-type-imports, 2 oxc/erasing-op, 3 unicorn/no-useless-spread,
// 4 typescript/no-duplicate-enum-values, 5 no-compare-neg-zero, 6 typescript/array-type, 7 promise/param-names,
// 9 typescript/no-this-alias, 10 no-unused-vars.
const TYPESCRIPT_SOURCE = `import { Thing } from './thing'
export const isZero = (value: number): boolean => value * 0 === 0
export const copy = [...[1, 2]]
export enum Letter { A = 'a', B = 'a' }
export const isNegativeZero = (value: number): boolean => value === -0
export const list: Array<string> = []
export const waited = new Promise((ok, fail) => ok(fail))
export const typed: Thing = 1
export const aliased = function (this: unknown): unknown { const self = this; return self }
const unused = 1
`

// Lines 2, 3, 5 and 7 above, as JavaScript.
const JAVASCRIPT_SOURCE = `export const isZero = (value) => value * 0 === 0
export const copy = [...[1, 2]]
export const isNegativeZero = (value) => value === -0
export const waited = new Promise((ok, fail) => ok(fail))
`

// Draws react/jsx-no-duplicate-props, react/jsx-key, then jsx-a11y/alt-text.
const JSX_LINES = `export const List = () => <ul id="a" id="b">{[1].map(() => <li />)}</ul>
export const Logo = () => <img src="logo.png" />
`

// A test file, as oxlint runs jest's rules in test files only (measured, 1.87). Rule each line draws (key):
// 1 import/no-namespace (bare), import/no-nodejs-modules (import-x/); 2 eslint/require-await (bare);
// 3 eslint/no-nested-ternary (bare); 4 eslint/no-dupe-keys (bare); 5 jest/no-focused-tests (bare);
// 6 import/no-anonymous-default-export (bare); 7 oxc/approx-constant (deepscan/);
// 8 typescript/no-explicit-any (typescript-eslint/); 9 typescript/no-non-null-assertion (@typescript-eslint/eslint-plugin/)
const APP_TYPESCRIPT_SOURCE = `import * as path from 'node:path'
export const run = async () => path.sep
export const pick = (count: number) => (count > 0 ? 'a' : count < 0 ? 'b' : 'c')
export const keys = { a: 1, a: 2 }
it.only('runs', () => {})
export default () => 1
export const pi = 3.1415
export const loose: any = 1
export const forced = keys!
`

// The same for JSX: 1 react/require-render-return (bare); 2 react-perf/jsx-no-new-object-as-prop (react_perf/);
// 3 nextjs/no-img-element (@next/); 4 nextjs/no-html-link-for-pages (@next/next/);
// 5 nextjs/no-sync-scripts (@next/eslint-plugin-next/); 6 jsx-a11y/label-has-associated-control (jsx_a11y/);
// 7 react/no-danger (react-hooks/); 8 react/no-unknown-property (eslint-plugin-react/)
const APP_JSX_SOURCE = `export class Widget extends React.Component { render() {} }
export const Styled = () => <div style={{ color: 'red' }} />
export const Photo = () => <img src="photo.png" alt="photo" />
export const Link = () => <a href="/about">about</a>
export const Script = () => <script src="script.js" />
export const Label = () => <label>name</label>
export const Danger = () => <div dangerouslySetInnerHTML={{ __html: '' }} />
export const Unknown = () => <div class="unknown" />
`

export const oxlintMergeSourceFiles = {
  'src/a.ts': TYPESCRIPT_SOURCE,
  'lib/b.ts': TYPESCRIPT_SOURCE,
  'src/f.tsx': `${TYPESCRIPT_SOURCE}${JSX_LINES}`,
  'src/f.test.tsx': `${TYPESCRIPT_SOURCE}${JSX_LINES}`,
  'lib/m.tsx': `${TYPESCRIPT_SOURCE}${JSX_LINES}`,
  'lib/m.test.tsx': `${TYPESCRIPT_SOURCE}${JSX_LINES}`,
  'src/g.jsx': `${JAVASCRIPT_SOURCE}${JSX_LINES}`,
  'app/k.test.ts': APP_TYPESCRIPT_SOURCE,
  'app/k.jsx': APP_JSX_SOURCE,
} as const

// The team's JS plugin's rule shares an oxlint rule's name: a key under the plugin's prefix means the plugin's.
const JS_PLUGIN_FILE = 'lint/local-plugin.js'
const JS_PLUGIN_RULE = 'local/jsx-no-duplicate-props'

// oxlint reads `@next/eslint-plugin-local/` as package `@next/local`, which names no plugin of oxlint's.
const SCOPED_JS_PLUGIN_FILE = 'lint/next-local-plugin.js'
const SCOPED_JS_PLUGIN_RULE_UNDER_ITS_PACKAGE_NAME = '@next/eslint-plugin-local/no-img-element'

function jsPluginReportingEveryFile(pluginName: string, ruleName: string): string {
  return `export default {
  meta: { name: '${pluginName}' },
  rules: {
    '${ruleName}': {
      create: (context) => ({
        Program(node) {
          context.report({ node, message: 'linted' })
        },
      }),
    },
  },
}
`
}

export const oxlintMergeJsPluginFiles = {
  [JS_PLUGIN_FILE]: jsPluginReportingEveryFile('local', 'jsx-no-duplicate-props'),
  [SCOPED_JS_PLUGIN_FILE]: jsPluginReportingEveryFile('@next/local', 'no-img-element'),
} as const

// A react category rule the team lists in overrides only, if at all; our part never states it.
const TEAM_STATED_RULE_NAME = 'jsx-no-duplicate-props'
const TEAM_STATED_RULE = `react/${TEAM_STATED_RULE_NAME}`
const TEST_TSX_FILES = ['**/*.test.tsx']
const TSX_FILES = ['**/*.tsx']
const LIB_FILES = ['lib/**']
const SRC_FILES = ['src/**']
const APP_FILES = ['app/**']
// No linted file is in vendor/: a listing there only makes the merge list its plugins at the root.
const VENDOR_FILES = ['vendor/**']
const TEST_AND_JSX_FILES = ['**/*.test.tsx', '**/*.jsx']
const PLUGINS_LISTED_IN_OVERRIDES: OxlintOverride['plugins'] = ['promise', 'react']

export const ROOT_PLUGINS_OMITTED = buildTeamShapeValue('root plugins left out', {})
export const ROOT_PLUGINS_EMPTY = buildTeamShapeValue('root plugins []', { plugins: [] })
export const ROOT_PLUGINS_LISTED = buildTeamShapeValue('root plugins [oxc, unicorn]', { plugins: ['oxc', 'unicorn'] })
// oxlint runs its eslint scope whatever `plugins` lists, so this root lists, for oxlint, no plugin.
export const ROOT_PLUGINS_ESLINT_ONLY = buildTeamShapeValue('root plugins [eslint]', { plugins: ['eslint'] })

export const NO_EXTENDS = buildTeamShapeValue('no extends', {})
export const EXTENDS_LISTING_PLUGINS = buildTeamShapeValue('extends an object listing [unicorn]', { extends: [{ plugins: ['unicorn'] }] })
export const EXTENDS_LISTING_NONE = buildTeamShapeValue('extends an object listing no plugins', { extends: [{ rules: {} }] })
export const EXTENDS_NESTED = buildTeamShapeValue('extends an object extending one listing [unicorn], and react for lib/**', {
  extends: [{ extends: [{ plugins: ['unicorn'], overrides: [{ files: LIB_FILES, plugins: ['react'] }] }] }],
})
export const EXTENDS_SETTING_CATEGORIES = buildTeamShapeValue('extends an object listing [oxc], with categories { style: warn }', {
  extends: [{ plugins: ['oxc'], categories: { style: 'warn' } }],
})
export const EXTENDS_STATING_IN_AN_OVERRIDE = buildTeamShapeValue(
  `extends an object listing [], whose override states ${TEAM_STATED_RULE} error for **/*.tsx, listing no plugin`,
  { extends: [{ plugins: [], overrides: [{ files: TSX_FILES, rules: { [TEAM_STATED_RULE]: 'error' } }] }] },
)
// oxlint ignores both statements while react is not listed at the root.
export const EXTENDS_STATING_AT_ITS_ROOT_AND_IN_A_NESTED_OVERRIDE = buildTeamShapeValue(
  `extends an object listing [] stating ${TEAM_STATED_RULE} error at its root, and extending one listing [] whose override states it error for **/*.tsx, listing no plugin`,
  {
    extends: [
      {
        plugins: [],
        rules: { [TEAM_STATED_RULE]: 'error' },
        extends: [{ plugins: [], overrides: [{ files: TSX_FILES, rules: { [TEAM_STATED_RULE]: 'error' } }] }],
      },
    ],
  },
)
export const EXTENDS_LISTING_AND_STATING_IN_AN_OVERRIDE = buildTeamShapeValue(
  `extends an object whose override lists [react] and states ${TEAM_STATED_RULE} error for **/*.tsx`,
  { extends: [{ overrides: [{ files: TSX_FILES, plugins: ['react'], rules: { [TEAM_STATED_RULE]: 'error' } }] }] },
)
export const EXTENDS_NESTED_LISTING_REACT_WITH_STYLE = buildTeamShapeValue(
  'extends an object listing [] that extends one listing [react], with categories { style: warn }',
  { extends: [{ plugins: [], extends: [{ plugins: ['react'], categories: { style: 'warn' } }] }] },
)
// The later of two extended configs sets the category (measured, oxlint 1.87): style is off.
export const EXTENDS_TWO_SETTING_STYLE = buildTeamShapeValue(
  'extends two objects listing [], the first with categories { style: warn }, the second { style: off }',
  { extends: [{ plugins: [], categories: { style: 'warn' } }, { plugins: [], categories: { style: 'off' } }] },
)

export const NO_LISTING = buildTeamShapeValue('no override lists a plugin', {})
export const ONE_LISTING = buildTeamShapeValue('an override lists [promise, react] for **/*.tsx', {
  overrides: [{ files: TSX_FILES, plugins: PLUGINS_LISTED_IN_OVERRIDES }],
})
export const ONE_LISTING_EXCLUDING = buildTeamShapeValue('an override lists [promise, react] for src/** but **/*.jsx', {
  overrides: [{ files: SRC_FILES, excludeFiles: ['**/*.jsx'], plugins: PLUGINS_LISTED_IN_OVERRIDES }],
})
export const TWO_LISTINGS_OVERLAPPING = buildTeamShapeValue(
  'two overrides list [promise, react], for lib/** and for **/*.tsx, both but test files',
  {
    overrides: [
      { files: LIB_FILES, excludeFiles: TEST_TSX_FILES, plugins: PLUGINS_LISTED_IN_OVERRIDES },
      { files: TSX_FILES, excludeFiles: TEST_TSX_FILES, plugins: PLUGINS_LISTED_IN_OVERRIDES },
    ],
  },
)
export const TWO_LISTINGS_OF_TWO_SETS = buildTeamShapeValue('two overrides list [react] for **/*.tsx but test files, and [promise] for src/**', {
  overrides: [
    { files: TSX_FILES, excludeFiles: TEST_TSX_FILES, plugins: ['react'] },
    { files: SRC_FILES, plugins: ['promise'] },
  ],
})
export const THREE_LISTINGS_OF_TWO_SETS = buildTeamShapeValue('[react] listed for **/*.tsx; [promise] for **/*.tsx but test files, and for src/**', {
  overrides: [
    { files: TSX_FILES, plugins: ['react'] },
    { files: TSX_FILES, excludeFiles: TEST_TSX_FILES, plugins: ['promise'] },
    { files: SRC_FILES, plugins: ['promise'] },
  ],
})
export const TWO_LISTINGS_EXCLUDING_ALIKE = buildTeamShapeValue(
  '[react] listed for **/*.tsx; [promise] for lib/** and for **/*.tsx, both but test and .jsx files, given in two orders',
  {
    overrides: [
      { files: TSX_FILES, plugins: ['react'] },
      { files: LIB_FILES, excludeFiles: TEST_AND_JSX_FILES, plugins: ['promise'] },
      { files: TSX_FILES, excludeFiles: TEST_AND_JSX_FILES.toReversed(), plugins: ['promise'] },
    ],
  },
)
// oxlint switches no category on for eslint, nor for a plugin its root lists.
export const LISTING_ESLINT_AND_A_ROOT_PLUGIN = buildTeamShapeValue(
  'an override lists [eslint, react, unicorn] for **/*.tsx; no-compare-neg-zero error at the root',
  { rules: { 'no-compare-neg-zero': 'error' }, overrides: [{ files: TSX_FILES, plugins: ['eslint', 'react', 'unicorn'] }] },
)
export const LISTINGS_OF_NESTED_SETS = buildTeamShapeValue('an override lists [promise, react] for **/*.tsx, and another [react] for lib/**', {
  overrides: [
    { files: TSX_FILES, plugins: PLUGINS_LISTED_IN_OVERRIDES },
    { files: LIB_FILES, plugins: ['react'] },
  ],
})
export const LISTINGS_OF_EQUAL_SETS_SHARING_A_PLUGIN = buildTeamShapeValue(
  'an override lists [promise, react] for **/*.tsx, and another [jsx-a11y, promise] for src/**',
  {
    overrides: [
      { files: TSX_FILES, plugins: PLUGINS_LISTED_IN_OVERRIDES },
      { files: SRC_FILES, plugins: ['jsx-a11y', 'promise'] },
    ],
  },
)

export const NO_STATEMENT = buildTeamShapeValue(`no statement of ${TEAM_STATED_RULE}`, {})
export const ROOT_STATES_ON = buildTeamShapeValue(`${TEAM_STATED_RULE} error at the root`, { rules: { [TEAM_STATED_RULE]: 'error' } })
export const ROOT_STATES_OFF = buildTeamShapeValue(`${TEAM_STATED_RULE} off at the root`, { rules: { [TEAM_STATED_RULE]: 'off' } })
export const LISTING_OVERRIDE_STATES_ON = buildTeamShapeValue(`${TEAM_STATED_RULE} error for test files, in an override listing react`, {
  overrides: [{ files: TEST_TSX_FILES, plugins: ['react'], rules: { [TEAM_STATED_RULE]: 'error' } }],
})
export const LISTING_OVERRIDE_STATES_OFF = buildTeamShapeValue(`${TEAM_STATED_RULE} off for test files, in an override listing react`, {
  overrides: [{ files: TEST_TSX_FILES, plugins: ['react'], rules: { [TEAM_STATED_RULE]: 'off' } }],
})
export const OTHER_OVERRIDE_STATES_ON = buildTeamShapeValue(`${TEAM_STATED_RULE} error for test files, in an override listing no plugin`, {
  overrides: [{ files: TEST_TSX_FILES, rules: { [TEAM_STATED_RULE]: 'error' } }],
})
export const OTHER_OVERRIDE_STATES_OFF = buildTeamShapeValue(`${TEAM_STATED_RULE} off for test files, in an override listing no plugin`, {
  overrides: [{ files: TEST_TSX_FILES, rules: { [TEAM_STATED_RULE]: 'off' } }],
})

// Keys oxlint takes for its rules (parse_rule_key, oxlint 1.87) that the catalog's oxlintSpellings miss,
// each stated where oxlint ignores it for the team.
export const NO_STATEMENT_UNDER_ANOTHER_KEY = buildTeamShapeValue('no statement under a key the catalog does not spell', {})
export const REACT_UNDER_OTHER_PREFIXES = buildTeamShapeValue(
  `react listed for lib/**; react_hooks/${TEAM_STATED_RULE_NAME} error for src/**, and oxlint-plugin-react/${TEAM_STATED_RULE_NAME} for lib/**, in overrides listing no plugin`,
  {
    overrides: [
      { files: LIB_FILES, plugins: ['react'] },
      { files: SRC_FILES, rules: { [`react_hooks/${TEAM_STATED_RULE_NAME}`]: 'error' } },
      { files: LIB_FILES, rules: { [`oxlint-plugin-react/${TEAM_STATED_RULE_NAME}`]: 'error' } },
    ],
  },
)
export const TYPESCRIPT_UNDER_OTHER_PREFIXES = buildTeamShapeValue(
  'typescript listed for lib/**; typescript_eslint/array-type error at the root, and @typescript-eslint/oxlint-plugin/no-duplicate-enum-values for src/**, in an override listing no plugin',
  {
    rules: { 'typescript_eslint/array-type': 'error' },
    overrides: [
      { files: LIB_FILES, plugins: ['typescript'] },
      { files: SRC_FILES, rules: { '@typescript-eslint/oxlint-plugin/no-duplicate-enum-values': 'error' } },
    ],
  },
)
export const JSX_A11Y_UNDER_OTHER_PREFIXES = buildTeamShapeValue(
  'jsx-a11y listed for lib/**; jsx-a11y-x/alt-text error for src/**, and jsx_a11y-x/alt-text for test files, in overrides listing no plugin',
  {
    overrides: [
      { files: LIB_FILES, plugins: ['jsx-a11y'] },
      { files: SRC_FILES, rules: { 'jsx-a11y-x/alt-text': 'error' } },
      { files: TEST_TSX_FILES, rules: { 'jsx_a11y-x/alt-text': 'error' } },
    ],
  },
)
// oxlint takes a bare key as the first of its rules so named, of whatever plugin (parse_rule_key).
export const REACT_UNDER_NO_PREFIX = buildTeamShapeValue(
  `react listed for lib/**; ${TEAM_STATED_RULE_NAME}, with no prefix, error for src/**, in an override listing no plugin`,
  {
    overrides: [
      { files: LIB_FILES, plugins: ['react'] },
      { files: SRC_FILES, rules: { [TEAM_STATED_RULE_NAME]: 'error' } },
    ],
  },
)

// The allowed case: a JS plugin's rule under its own prefix runs whatever plugins are listed.
export const JS_PLUGIN_RULE_NAMED_AS_OXLINTS = buildTeamShapeValue(
  `react listed for lib/**; the team's JS plugin's ${JS_PLUGIN_RULE} error for src/**, in an override listing no plugin`,
  {
    jsPlugins: [`./${JS_PLUGIN_FILE}`],
    overrides: [
      { files: LIB_FILES, plugins: ['react'] },
      { files: SRC_FILES, rules: { [JS_PLUGIN_RULE]: 'error' } },
    ],
  },
)

// Other names oxlint takes for its plugins (unalias_plugin_name, normalize_plugin_name; measured, 1.87), listed
// only where no file is, so oxlint ignores each statement. Allowed case: an @next JS plugin under its package name.
export const OTHER_NAMES_OF_OXLINTS_PLUGINS = buildTeamShapeValue(
  'import, jsx-a11y, nextjs, oxc, react, react-perf and typescript listed for vendor/** only; for app/**, in an override listing no plugin, a rule of each under another name oxlint takes for it, and the team JS plugin @next/local rule under its package name',
  {
    jsPlugins: [`./${SCOPED_JS_PLUGIN_FILE}`],
    overrides: [
      { files: VENDOR_FILES, plugins: ['import', 'jsx-a11y', 'nextjs', 'oxc', 'react', 'react-perf', 'typescript'] },
      {
        files: APP_FILES,
        rules: {
          'react-hooks/no-danger': 'error',
          'eslint-plugin-react/no-unknown-property': 'error',
          'typescript-eslint/no-explicit-any': 'error',
          '@typescript-eslint/eslint-plugin/no-non-null-assertion': 'error',
          'deepscan/approx-constant': 'error',
          'import-x/no-nodejs-modules': 'error',
          'jsx_a11y/label-has-associated-control': 'error',
          'react_perf/jsx-no-new-object-as-prop': 'error',
          '@next/no-img-element': 'error',
          '@next/next/no-html-link-for-pages': 'error',
          '@next/eslint-plugin-next/no-sync-scripts': 'error',
          [SCOPED_JS_PLUGIN_RULE_UNDER_ITS_PACKAGE_NAME]: 'error',
        },
      },
    ],
  },
)

// oxlint reads a bare name several of its plugins share as the first such plugin's rule (parse_rule_key).
export const BARE_NAMES_OF_SHARED_RULES = buildTeamShapeValue(
  'import, jest and react listed for vendor/** only; no-namespace, no-anonymous-default-export, require-render-return and no-focused-tests error at the root; require-await, no-nested-ternary and no-dupe-keys error for app/**, in an override listing no plugin',
  {
    rules: {
      'no-namespace': 'error',
      'no-anonymous-default-export': 'error',
      'require-render-return': 'error',
      'no-focused-tests': 'error',
    },
    overrides: [
      { files: VENDOR_FILES, plugins: ['import', 'jest', 'react'] },
      { files: APP_FILES, rules: { 'require-await': 'error', 'no-nested-ternary': 'error', 'no-dupe-keys': 'error' } },
    ],
  },
)

// Where oxlint counts the team's statement of a rule ours states, the team's setting decides; where it ignores it, ours does.
export const NO_STATEMENT_OF_OURS = buildTeamShapeValue('no statement of a rule our part may state', {})
export const ROOT_STATES_OURS = buildTeamShapeValue(
  '@typescript-eslint/consistent-type-imports warn preferring no type imports, eslint/no-compare-neg-zero warn and react-hooks/jsx-key warn at the root',
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'no-type-imports' }],
      'eslint/no-compare-neg-zero': 'warn',
      'react-hooks/jsx-key': 'warn',
    },
  },
)
export const EXTENDED_ROOT_STATES_OURS = buildTeamShapeValue(
  'extends an object listing [] stating typescript/consistent-type-imports warn, react/jsx-key warn and no-compare-neg-zero off at its root',
  { extends: [{ plugins: [], rules: { 'typescript/consistent-type-imports': 'warn', 'react/jsx-key': 'warn', 'no-compare-neg-zero': 'off' } }] },
)
export const LISTING_OVERRIDE_STATES_OURS = buildTeamShapeValue(
  'eslint-plugin-react/jsx-key warn and typescript/consistent-type-imports off for **/*.tsx, in an override listing react',
  { overrides: [{ files: TSX_FILES, plugins: ['react'], rules: { 'eslint-plugin-react/jsx-key': 'warn', 'typescript/consistent-type-imports': 'off' } }] },
)
export const OTHER_OVERRIDE_TURNS_OURS_OFF = buildTeamShapeValue(
  'typescript/consistent-type-imports, react/jsx-key and no-compare-neg-zero off for src/**, in an override listing no plugin',
  { overrides: [{ files: SRC_FILES, rules: { 'typescript/consistent-type-imports': 'off', 'react/jsx-key': 'off', 'no-compare-neg-zero': 'off' } }] },
)
export const EXTENDED_OVERRIDES_STATE_OURS = buildTeamShapeValue(
  'extends an object listing [] whose overrides turn react/jsx-key off for lib/**, listing react, and state no-compare-neg-zero warn for test files',
  {
    extends: [
      {
        plugins: [],
        overrides: [
          { files: LIB_FILES, plugins: ['react'], rules: { 'react/jsx-key': 'off' } },
          { files: TEST_TSX_FILES, rules: { 'no-compare-neg-zero': ['warn'] } },
        ],
      },
    ],
  },
)
// Both statements count only where react is listed at the root: the override lists promise alone.
export const STATEMENTS_OF_OURS_OXLINT_MAY_IGNORE = buildTeamShapeValue(
  'react/jsx-key warn at the root, and for lib/** in an override listing [promise]',
  { rules: { 'react/jsx-key': 'warn' }, overrides: [{ files: LIB_FILES, plugins: ['promise'], rules: { 'react/jsx-key': 'warn' } }] },
)

export const NO_CATEGORIES = buildTeamShapeValue('categories left out', {})
export const STYLE_ON = buildTeamShapeValue('categories { style: warn }', { categories: { style: 'warn' } })
export const CORRECTNESS_OFF = buildTeamShapeValue('categories { correctness: off }', { categories: { correctness: 'off' } })

export const NO_RULE_OF_A_DEFAULT_PLUGIN = buildOurShapeValue('ours: no typescript rule', {})
export const OUR_RULE_OF_A_DEFAULT_PLUGIN = buildOurShapeValue('ours: @typescript-eslint/consistent-type-imports', {
  rules: { '@typescript-eslint/consistent-type-imports': 'error' },
})
export const OUR_RULE_OF_A_DEFAULT_PLUGIN_OFF_IN_AN_ENTRY = buildOurShapeValue(
  'ours: @typescript-eslint/consistent-type-imports, off in an entry for src/**',
  {
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
    fileOverrides: [{ files: SRC_FILES, rules: { '@typescript-eslint/consistent-type-imports': 'off' } }],
  },
)

export const NO_REACT_RULE = buildOurShapeValue('ours: no react rule', {})
export const OUR_REACT_RULE = buildOurShapeValue('ours: react/jsx-key', { rules: { 'react/jsx-key': 'error' } })
export const OUR_REACT_RULE_OFF_IN_AN_ENTRY = buildOurShapeValue('ours: react/jsx-key, off in an entry for lib/**', {
  rules: { 'react/jsx-key': 'error' },
  fileOverrides: [{ files: LIB_FILES, rules: { 'react/jsx-key': 'off' } }],
})
export const OUR_ENTRY_TURNING_OFF_A_RULE_WE_DO_NOT_RUN = buildOurShapeValue('ours: react/jsx-key off in an entry for lib/**, and on nowhere', {
  fileOverrides: [{ files: LIB_FILES, rules: { 'react/jsx-key': 'off' } }],
})
export const OUR_REACT_RULE_ONLY_IN_AN_ENTRY = buildOurShapeValue('ours: react/jsx-key on in an entry for lib/** only', {
  fileOverrides: [{ files: LIB_FILES, rules: { 'react/jsx-key': 'error' } }],
})
// Our top-level off removes only ours: the team's config alone decides the rule.
export const OUR_REACT_RULE_OFF_AT_THE_TOP_LEVEL = buildOurShapeValue('ours: react/jsx-key off at the top level', {
  rules: { 'react/jsx-key': 'off' },
})

// A core rule of oxlint's: its plugin is eslint, which oxlint always runs.
export const NO_CORE_RULE = buildOurShapeValue('ours: no core rule', {})
export const OUR_CORE_RULE = buildOurShapeValue('ours: no-compare-neg-zero', { rules: { 'no-compare-neg-zero': 'error' } })
export const OUR_CORE_RULE_ONLY_IN_AN_ENTRY = buildOurShapeValue('ours: no-compare-neg-zero on in an entry for lib/** only', {
  fileOverrides: [{ files: LIB_FILES, rules: { 'no-compare-neg-zero': 'error' } }],
})

// Our ignores remove only our rules from the files they match; the team's findings there stay.
// Written as a folder, an ignore covers what ignorePatterns and ESLint's global ignores cover.
export const NO_IGNORES_OF_OURS = buildOurShapeValue('ours: no ignores', {})
export const OUR_IGNORES = buildOurShapeValue('ours: ignores lib/**', { ignores: LIB_FILES })
export const OUR_IGNORES_OF_A_FOLDER = buildOurShapeValue('ours: ignores lib, a folder', { ignores: ['lib'] })
export const OUR_IGNORES_OF_A_FOLDER_ENDING_IN_A_SLASH = buildOurShapeValue('ours: ignores lib/, a folder', { ignores: ['lib/'] })

// Our ESLint-run rules are off in oxlint only where ESLint runs them: not in our ignores or entries turning them off.
export const NO_RULE_ESLINT_RUNS = buildOurShapeValue('ours: no rule ESLint runs', {})
export const OUR_RULES_ESLINT_RUNS = buildOurShapeValue('ours: @typescript-eslint/array-type and promise/param-names, which ESLint runs', {
  rules: { '@typescript-eslint/array-type': 'error', 'promise/param-names': 'error' },
})
// oxlint's own correctness: warn runs its no-this-alias copy under typescript, a default plugin; the merge turns it off everywhere.
export const OUR_RULE_ESLINT_RUNS_IN_OXLINTS_DEFAULT_CATEGORY = buildOurShapeValue(
  "ours: @typescript-eslint/no-this-alias, which ESLint runs, and oxlint's correctness category holds",
  { rules: { '@typescript-eslint/no-this-alias': 'error' } },
)
// Likewise the core no-unused-vars, twin of typescript-eslint's, which correctness: warn runs under eslint.
export const OUR_TWIN_RULE_ESLINT_RUNS_IN_OXLINTS_DEFAULT_CATEGORY = buildOurShapeValue(
  "ours: @typescript-eslint/no-unused-vars, which ESLint runs, whose core twin oxlint's correctness category holds",
  { rules: { '@typescript-eslint/no-unused-vars': 'error' } },
)
export const OUR_RULES_ESLINT_RUNS_OFF_IN_AN_ENTRY = buildOurShapeValue(
  'ours: @typescript-eslint/array-type and promise/param-names, which ESLint runs, array-type off in an entry for src/**',
  {
    rules: { '@typescript-eslint/array-type': 'error', 'promise/param-names': 'error' },
    fileOverrides: [{ files: SRC_FILES, rules: { '@typescript-eslint/array-type': 'off' } }],
  },
)

export const OXLINT_MERGE_DIMENSIONS: readonly Dimension<OxlintMergeShapeValue>[] = [
  { name: 'team root plugins', values: [ROOT_PLUGINS_OMITTED, ROOT_PLUGINS_EMPTY, ROOT_PLUGINS_LISTED, ROOT_PLUGINS_ESLINT_ONLY] },
  {
    name: 'team extends',
    values: [
      NO_EXTENDS,
      EXTENDS_LISTING_PLUGINS,
      EXTENDS_LISTING_NONE,
      EXTENDS_NESTED,
      EXTENDS_SETTING_CATEGORIES,
      EXTENDS_STATING_IN_AN_OVERRIDE,
      EXTENDS_STATING_AT_ITS_ROOT_AND_IN_A_NESTED_OVERRIDE,
      EXTENDS_LISTING_AND_STATING_IN_AN_OVERRIDE,
      EXTENDS_NESTED_LISTING_REACT_WITH_STYLE,
      EXTENDS_TWO_SETTING_STYLE,
    ],
  },
  {
    name: 'team overrides listing a plugin',
    values: [
      NO_LISTING,
      ONE_LISTING,
      ONE_LISTING_EXCLUDING,
      TWO_LISTINGS_OVERLAPPING,
      TWO_LISTINGS_OF_TWO_SETS,
      THREE_LISTINGS_OF_TWO_SETS,
      TWO_LISTINGS_EXCLUDING_ALIKE,
      LISTING_ESLINT_AND_A_ROOT_PLUGIN,
      LISTINGS_OF_NESTED_SETS,
      LISTINGS_OF_EQUAL_SETS_SHARING_A_PLUGIN,
    ],
  },
  {
    name: `team statements of ${TEAM_STATED_RULE}`,
    values: [
      NO_STATEMENT,
      ROOT_STATES_ON,
      ROOT_STATES_OFF,
      LISTING_OVERRIDE_STATES_ON,
      LISTING_OVERRIDE_STATES_OFF,
      OTHER_OVERRIDE_STATES_ON,
      OTHER_OVERRIDE_STATES_OFF,
    ],
  },
  {
    name: 'team statements under another name of a plugin, or no prefix',
    values: [
      NO_STATEMENT_UNDER_ANOTHER_KEY,
      REACT_UNDER_OTHER_PREFIXES,
      TYPESCRIPT_UNDER_OTHER_PREFIXES,
      JSX_A11Y_UNDER_OTHER_PREFIXES,
      REACT_UNDER_NO_PREFIX,
      JS_PLUGIN_RULE_NAMED_AS_OXLINTS,
      OTHER_NAMES_OF_OXLINTS_PLUGINS,
      BARE_NAMES_OF_SHARED_RULES,
    ],
  },
  {
    name: 'team statements of rules our part may state',
    values: [
      NO_STATEMENT_OF_OURS,
      ROOT_STATES_OURS,
      EXTENDED_ROOT_STATES_OURS,
      LISTING_OVERRIDE_STATES_OURS,
      OTHER_OVERRIDE_TURNS_OURS_OFF,
      EXTENDED_OVERRIDES_STATE_OURS,
      STATEMENTS_OF_OURS_OXLINT_MAY_IGNORE,
    ],
  },
  { name: 'team categories', values: [NO_CATEGORIES, STYLE_ON, CORRECTNESS_OFF] },
  {
    name: 'our rule of a default plugin',
    values: [NO_RULE_OF_A_DEFAULT_PLUGIN, OUR_RULE_OF_A_DEFAULT_PLUGIN, OUR_RULE_OF_A_DEFAULT_PLUGIN_OFF_IN_AN_ENTRY],
  },
  {
    name: 'our react rule',
    values: [
      NO_REACT_RULE,
      OUR_REACT_RULE,
      OUR_REACT_RULE_OFF_IN_AN_ENTRY,
      OUR_ENTRY_TURNING_OFF_A_RULE_WE_DO_NOT_RUN,
      OUR_REACT_RULE_ONLY_IN_AN_ENTRY,
      OUR_REACT_RULE_OFF_AT_THE_TOP_LEVEL,
    ],
  },
  { name: 'our core rule', values: [NO_CORE_RULE, OUR_CORE_RULE] },
  { name: 'our ignores', values: [NO_IGNORES_OF_OURS, OUR_IGNORES, OUR_IGNORES_OF_A_FOLDER] },
  {
    name: 'our rules ESLint runs',
    values: [
      NO_RULE_ESLINT_RUNS,
      OUR_RULES_ESLINT_RUNS,
      OUR_RULES_ESLINT_RUNS_OFF_IN_AN_ENTRY,
      OUR_RULE_ESLINT_RUNS_IN_OXLINTS_DEFAULT_CATEGORY,
      OUR_TWIN_RULE_ESLINT_RUNS_IN_OXLINTS_DEFAULT_CATEGORY,
    ],
  },
]

/** Values that must meet in one shape beyond a pair: each set pins a defect a review or this test found. */
export const OXLINT_MERGE_SEEDS: readonly (readonly OxlintMergeShapeValue[])[] = [
  // oxlint adds its default plugins through an extended config that lists none.
  [ROOT_PLUGINS_LISTED, EXTENDS_LISTING_NONE, OUR_RULE_OF_A_DEFAULT_PLUGIN],
  [ROOT_PLUGINS_EMPTY, EXTENDS_LISTING_NONE, OUR_RULE_OF_A_DEFAULT_PLUGIN],
  // Our entry's off, where the team lists the rule's plugin only in an override.
  [ONE_LISTING, OUR_ENTRY_TURNING_OFF_A_RULE_WE_DO_NOT_RUN],
  // A rule ours states only in an entry, where the team's listing runs it outside the entry.
  [ONE_LISTING, OUR_REACT_RULE_ONLY_IN_AN_ENTRY],
  // A file two team listings both match and both exclude, which nothing else lists react for.
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, TWO_LISTINGS_OVERLAPPING, NO_STATEMENT, OUR_REACT_RULE],
  // Our off of a rule ESLint runs, whose plugin the team lists in an override, with its category on.
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, ONE_LISTING, STYLE_ON, OUR_RULES_ESLINT_RUNS],
  // A root statement oxlint ignores where the plugin is not listed.
  [ONE_LISTING, ROOT_STATES_ON, OUR_REACT_RULE],
  // Under a root listing no plugin but eslint, an override's listing switches no category on.
  [ROOT_PLUGINS_EMPTY, NO_EXTENDS, ONE_LISTING, NO_REACT_RULE],
  // An extended config's override stating a rule whose plugin it does not list, which oxlint ignores.
  [ROOT_PLUGINS_LISTED, EXTENDS_STATING_IN_AN_OVERRIDE, ONE_LISTING, NO_STATEMENT, NO_STATEMENT_UNDER_ANOTHER_KEY],
  // Listings of two sets under a root listing none, one excluding test files: the other's categories
  // stay off in the files it excludes.
  [
    ROOT_PLUGINS_EMPTY,
    NO_EXTENDS,
    TWO_LISTINGS_OF_TWO_SETS,
    NO_STATEMENT,
    NO_STATEMENT_UNDER_ANOTHER_KEY,
    STYLE_ON,
    NO_RULE_ESLINT_RUNS,
  ],
  // A root statement oxlint ignores, of a rule whose category is off, so no category off covers it.
  [ROOT_PLUGINS_LISTED, NO_EXTENDS, ONE_LISTING, ROOT_STATES_ON, NO_STATEMENT_UNDER_ANOTHER_KEY, CORRECTNESS_OFF],
  // A category an extended config alone turns on, switched on by an override's listing.
  [ROOT_PLUGINS_LISTED, EXTENDS_SETTING_CATEGORIES, ONE_LISTING, NO_STATEMENT_UNDER_ANOTHER_KEY, NO_CATEGORIES, NO_RULE_ESLINT_RUNS],
  // Statements under keys the catalog does not spell, which oxlint ignores where their plugin is not listed.
  [ROOT_PLUGINS_LISTED, NO_EXTENDS, REACT_UNDER_OTHER_PREFIXES, NO_STATEMENT],
  [
    ROOT_PLUGINS_LISTED,
    NO_EXTENDS,
    TYPESCRIPT_UNDER_OTHER_PREFIXES,
    NO_CATEGORIES,
    NO_RULE_OF_A_DEFAULT_PLUGIN,
    NO_RULE_ESLINT_RUNS,
  ],
  [ROOT_PLUGINS_EMPTY, NO_EXTENDS, JSX_A11Y_UNDER_OTHER_PREFIXES],
  [ROOT_PLUGINS_LISTED, NO_EXTENDS, REACT_UNDER_NO_PREFIX, NO_STATEMENT],
  // Each seed from here holds a break of the merge no generated shape caught.
  // Statements oxlint ignores at an extended config's root, and in an override of a config it extends.
  [ROOT_PLUGINS_LISTED, EXTENDS_STATING_AT_ITS_ROOT_AND_IN_A_NESTED_OVERRIDE, ONE_LISTING, NO_STATEMENT, NO_STATEMENT_UNDER_ANOTHER_KEY],
  // The same, with the rule's category off, so no category off covers the extended root's statement.
  [
    ROOT_PLUGINS_LISTED,
    EXTENDS_STATING_AT_ITS_ROOT_AND_IN_A_NESTED_OVERRIDE,
    ONE_LISTING,
    NO_STATEMENT,
    NO_STATEMENT_UNDER_ANOTHER_KEY,
    CORRECTNESS_OFF,
  ],
  // An extended config's override, which our offs first in line must not undo.
  [ROOT_PLUGINS_OMITTED, EXTENDS_LISTING_AND_STATING_IN_AN_OVERRIDE, NO_LISTING, NO_STATEMENT, NO_STATEMENT_UNDER_ANOTHER_KEY],
  // A plugin and a category a config extended by an extended config sets.
  [
    ROOT_PLUGINS_LISTED,
    EXTENDS_NESTED_LISTING_REACT_WITH_STYLE,
    ONE_LISTING,
    NO_STATEMENT,
    NO_STATEMENT_UNDER_ANOTHER_KEY,
    NO_CATEGORIES,
    NO_RULE_ESLINT_RUNS,
  ],
  // The later of two extended configs setting a category, switched on by an override's listing.
  [ROOT_PLUGINS_LISTED, EXTENDS_TWO_SETTING_STYLE, ONE_LISTING, NO_STATEMENT, NO_CATEGORIES],
  // oxlint's default plugins, which our config first in line must not add beside an extended config.
  [ROOT_PLUGINS_EMPTY, EXTENDS_LISTING_PLUGINS, NO_CATEGORIES],
  // Listings of one set, one excluding test files, beside another set.
  [ROOT_PLUGINS_EMPTY, NO_EXTENDS, THREE_LISTINGS_OF_TWO_SETS, NO_STATEMENT, NO_STATEMENT_UNDER_ANOTHER_KEY, STYLE_ON],
  // A file two listings of one set both exclude by the same globs, in two orders.
  [ROOT_PLUGINS_EMPTY, NO_EXTENDS, TWO_LISTINGS_EXCLUDING_ALIKE, NO_STATEMENT, NO_STATEMENT_UNDER_ANOTHER_KEY, NO_CATEGORIES],
  // A listing naming eslint and a root plugin, beside the root's statement of an eslint rule.
  [ROOT_PLUGINS_LISTED, NO_EXTENDS, LISTING_ESLINT_AND_A_ROOT_PLUGIN, NO_CATEGORIES],
  // One listing's set inside another's.
  [ROOT_PLUGINS_EMPTY, NO_EXTENDS, LISTINGS_OF_NESTED_SETS, NO_STATEMENT, NO_STATEMENT_UNDER_ANOTHER_KEY, STYLE_ON],
  // Two sets of one size sharing a plugin, where our part adds nothing.
  [
    ROOT_PLUGINS_EMPTY,
    NO_EXTENDS,
    LISTINGS_OF_EQUAL_SETS_SHARING_A_PLUGIN,
    NO_STATEMENT,
    NO_STATEMENT_UNDER_ANOTHER_KEY,
    NO_CATEGORIES,
    NO_RULE_OF_A_DEFAULT_PLUGIN,
    NO_REACT_RULE,
    NO_RULE_ESLINT_RUNS,
  ],
  // A root listing only eslint, which lists, for oxlint, no plugin.
  [ROOT_PLUGINS_ESLINT_ONLY, NO_EXTENDS, ONE_LISTING, NO_CATEGORIES],
  // Keys under other names of oxlint's plugins, and bare names several plugins share, under a root
  // listing neither typescript, oxc nor unicorn.
  [ROOT_PLUGINS_EMPTY, NO_EXTENDS, NO_LISTING, OTHER_NAMES_OF_OXLINTS_PLUGINS],
  [ROOT_PLUGINS_EMPTY, NO_EXTENDS, NO_LISTING, BARE_NAMES_OF_SHARED_RULES],
  // The team's root states ours under other spellings: where oxlint counts a statement it decides; where it ignores it, ours does.
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, ROOT_STATES_OURS, OUR_RULE_OF_A_DEFAULT_PLUGIN, OUR_CORE_RULE],
  [ROOT_PLUGINS_LISTED, NO_EXTENDS, ROOT_STATES_OURS, OUR_RULE_OF_A_DEFAULT_PLUGIN, OUR_REACT_RULE],
  // Statements of ours that count only where an extended config lists react at the root, and where none does.
  [ROOT_PLUGINS_LISTED, EXTENDS_NESTED_LISTING_REACT_WITH_STYLE, STATEMENTS_OF_OURS_OXLINT_MAY_IGNORE, OUR_REACT_RULE],
  [ROOT_PLUGINS_EMPTY, NO_EXTENDS, NO_LISTING, STATEMENTS_OF_OURS_OXLINT_MAY_IGNORE, OUR_REACT_RULE],
  // A listing override and an extended config's overrides stating ours, beside ours on everywhere and in an entry only.
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, LISTING_OVERRIDE_STATES_OURS, OUR_RULE_OF_A_DEFAULT_PLUGIN, OUR_REACT_RULE],
  [ROOT_PLUGINS_EMPTY, EXTENDED_OVERRIDES_STATE_OURS, OUR_REACT_RULE_ONLY_IN_AN_ENTRY, OUR_CORE_RULE],
  // An override turning ours off, beside our entry turning one of them off elsewhere.
  [ROOT_PLUGINS_OMITTED, OTHER_OVERRIDE_TURNS_OURS_OFF, OUR_RULE_OF_A_DEFAULT_PLUGIN_OFF_IN_AN_ENTRY, OUR_CORE_RULE],
  // Our off and our ignores, where the team's listing switches react's categories on: the team's findings stay.
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, ONE_LISTING, NO_STATEMENT_OF_OURS, OUR_REACT_RULE_OFF_AT_THE_TOP_LEVEL],
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, ONE_LISTING, NO_STATEMENT_OF_OURS, OUR_REACT_RULE, OUR_IGNORES],
  // The same, our ignores written as a folder.
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, ONE_LISTING, NO_STATEMENT_OF_OURS, OUR_REACT_RULE, OUR_IGNORES_OF_A_FOLDER],
  // Our ESLint-run rules beside team categories running them: the team's findings stay where our
  // ignores or an entry of ours keep ESLint out.
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, ONE_LISTING, NO_STATEMENT_OF_OURS, STYLE_ON, OUR_RULES_ESLINT_RUNS, OUR_IGNORES],
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, ONE_LISTING, NO_STATEMENT_OF_OURS, STYLE_ON, OUR_RULES_ESLINT_RUNS, OUR_IGNORES_OF_A_FOLDER],
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, ONE_LISTING, NO_STATEMENT_OF_OURS, STYLE_ON, OUR_RULES_ESLINT_RUNS_OFF_IN_AN_ENTRY, NO_IGNORES_OF_OURS],
  // The correctness: warn copy of a rule our ESLint part runs: off in every file, our ignores' included;
  // nothing to switch off where the team writes correctness off.
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, NO_LISTING, NO_STATEMENT_OF_OURS, NO_CATEGORIES, OUR_RULE_ESLINT_RUNS_IN_OXLINTS_DEFAULT_CATEGORY, OUR_IGNORES],
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, NO_LISTING, NO_STATEMENT_OF_OURS, STYLE_ON, OUR_RULE_ESLINT_RUNS_IN_OXLINTS_DEFAULT_CATEGORY, NO_IGNORES_OF_OURS],
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, NO_LISTING, NO_STATEMENT_OF_OURS, CORRECTNESS_OFF, OUR_RULE_ESLINT_RUNS_IN_OXLINTS_DEFAULT_CATEGORY],
  // The core twin of an ESLint-run rule, whose copy correctness: warn runs: off too.
  [ROOT_PLUGINS_OMITTED, NO_EXTENDS, NO_LISTING, NO_STATEMENT_OF_OURS, NO_CATEGORIES, OUR_TWIN_RULE_ESLINT_RUNS_IN_OXLINTS_DEFAULT_CATEGORY],
  // typescript listed for lib/** alone switches its categories on there, correctness: warn included:
  // the off of our ESLint-run rule's copy holds in lib/** too.
  [
    ROOT_PLUGINS_LISTED,
    NO_EXTENDS,
    NO_LISTING,
    NO_STATEMENT,
    TYPESCRIPT_UNDER_OTHER_PREFIXES,
    NO_STATEMENT_OF_OURS,
    NO_CATEGORIES,
    OUR_RULE_ESLINT_RUNS_IN_OXLINTS_DEFAULT_CATEGORY,
  ],
]

// Two team configs the merge cannot reproduce.
export const OFF_UNDONE_BY_A_LATER_LISTING = buildTeamShapeValue(
  `root plugins []; ${TEAM_STATED_RULE} off for **/*.tsx in an override listing [react, promise], then [react] listed for test files`,
  buildTeamOxlintConfig({
    plugins: [],
    overrides: [
      { files: TSX_FILES, plugins: ['react', 'promise'], rules: { [TEAM_STATED_RULE]: 'off' } },
      { files: TEST_TSX_FILES, plugins: ['react'] },
    ],
  }),
)

export const FILE_EXCLUDED_BY_TWO_LISTINGS = buildTeamShapeValue(
  'root plugins []; [react] listed for **/*.tsx; [promise] listed for lib/** but test files, and for test files but lib/**',
  buildTeamOxlintConfig({
    plugins: [],
    overrides: [
      { files: TSX_FILES, plugins: ['react'] },
      { files: LIB_FILES, excludeFiles: TEST_TSX_FILES, plugins: ['promise'] },
      { files: TEST_TSX_FILES, excludeFiles: LIB_FILES, plugins: ['promise'] },
    ],
  }),
)
