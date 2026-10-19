import type { Engine } from '../../catalog.ts'
import { consumerConfigFiles } from '../../consumer-config-files.ts'
import type { CaseFile } from '../rule-case-runs.ts'

// Files each changed rule must stay silent in and still report in, under the settings the catalog ships.

/** A rule run with the settings it ships, on the engines that may run it. */
export type RuleCase = {
  /** The RuleId. Its engine and settings are read from the catalog. */
  readonly rule: string
  /** What the case covers, where a rule has more than one. */
  readonly subject?: string
  /** Where not every engine that may run the rule: the engine it is routed to, and ESLint for a rule oxlint runs, which runs it without oxlint. */
  readonly engines?: readonly Engine[]
  readonly silentIn: readonly CaseFile[]
  readonly reportedIn: readonly CaseFile[]
  /** Packages the case's files resolve before the project's own: written to the `node_modules` of the case's folder. */
  readonly packages?: readonly StubPackage[]
}

/**
 * A package the fixtures import that the repo does not install: its manifest's name, its declarations,
 * and, for a rule that resolves the import as Node does (import-x without a TypeScript resolver), its module.
 */
export type StubPackage = { readonly name: string; readonly declarations: string; readonly module?: string }

const FIND_QUERY_TYPES = ['Role', 'LabelText', 'PlaceholderText', 'Text', 'DisplayValue', 'AltText', 'Title', 'TestId']

export const FIND_QUERIES: readonly string[] = FIND_QUERY_TYPES.flatMap((queryType) => [`findBy${queryType}`, `findAllBy${queryType}`])

/** user-event 14's methods, each returning a promise. */
export const USER_EVENT_METHODS: readonly string[] = [
  'clear',
  'click',
  'copy',
  'cut',
  'dblClick',
  'deselectOptions',
  'hover',
  'keyboard',
  'paste',
  'pointer',
  'selectOptions',
  'tab',
  'tripleClick',
  'type',
  'unhover',
  'upload',
]

/** The package a consumer's config files import: a devDependency of theirs. */
const OUR_PACKAGE = '@agents-inc/lint-rules'

/**
 * Stubs of packages the typed fixtures import, each declaring its async helpers in the real package's
 * shape, which decides which `allowForKnownSafeCalls` specifier reaches a call: user-event's session
 * methods are anonymous (`__type`). Measured with typescript-eslint 8.71.1 to match the real packages.
 */
export const STUB_PACKAGES: readonly StubPackage[] = [
  {
    name: '@testing-library/dom',
    declarations: `export declare function waitFor<T>(callback: () => T | Promise<T>): Promise<T>
export declare function waitForElementToBeRemoved<T>(callback: T | (() => T)): Promise<void>
${FIND_QUERIES.map((query) => `export declare function ${query}(container: HTMLElement, matcher: string): Promise<HTMLElement>`).join('\n')}
export interface Screen {
${FIND_QUERIES.map((query) => `  ${query}(matcher: string): Promise<HTMLElement>`).join('\n')}
}
export declare const screen: Screen
`,
  },
  {
    name: '@testing-library/user-event',
    declarations: `${USER_EVENT_METHODS.map((method) => `declare function ${method}(...args: unknown[]): Promise<void>`).join('\n')}
declare const userEventApi: {
${USER_EVENT_METHODS.map((method) => `  ${method}: typeof ${method}`).join('\n')}
}
type UserEventApi = typeof userEventApi
export type UserEvent = {
  readonly setup: () => UserEvent
} & {
  readonly [k in keyof UserEventApi]: (...args: Parameters<UserEventApi[k]>) => ReturnType<UserEventApi[k]>
}
declare function setupMain(): UserEvent
export declare const userEvent: {
  readonly setup: typeof setupMain
${USER_EVENT_METHODS.map((method) => `  readonly ${method}: typeof ${method}`).join('\n')}
}
export default userEvent
`,
  },
  {
    name: OUR_PACKAGE,
    declarations: 'export declare function defineLintRules(config: object): object\n',
  },
  // Not in the fixtures' manifest.
  {
    name: 'vite',
    declarations: 'export interface Plugin {\n  readonly name: string\n}\nexport declare function defineConfig(config: object): object\n',
    module: 'export function defineConfig(config) {\n  return config\n}\n',
  },
]

/**
 * Vitest 3.2.4 as no-floating-promises sees it: `.resolves` and `.rejects` typed by @vitest/expect's
 * `Promisify`, written as 3.2.4 declares it (Vitest 5, which the repo installs, types them otherwise).
 */
const VITEST_3_PACKAGES: readonly StubPackage[] = [
  {
    name: 'vitest',
    declarations: "import type { ExpectStatic } from '@vitest/expect'\nexport declare const expect: ExpectStatic\n",
  },
  {
    name: '@vitest/expect',
    declarations: `type Promisify<O> = { [K in keyof O]: O[K] extends (...args: infer A) => infer R ? Promisify<O[K]> & ((...args: A) => Promise<R>) : O[K] }
export type PromisifyAssertion<T> = Promisify<Assertion<T>>
export interface Assertion<T> {
  toBe(expected: T): void
  toThrow(expected?: string): void
  resolves: PromisifyAssertion<T>
  rejects: PromisifyAssertion<T>
}
export interface ExpectStatic {
  <T>(actual: T): Assertion<T>
}
`,
  },
]

/** The typed fixtures' tsconfig: every TS file of the project, with the DOM's types and Node's. */
export const TYPED_PROJECT_TSCONFIG = {
  compilerOptions: {
    strict: true,
    target: 'es2023',
    lib: ['es2023', 'dom'],
    module: 'esnext',
    moduleResolution: 'bundler',
    jsx: 'preserve',
    types: ['node'],
    skipLibCheck: true,
    noEmit: true,
  },
  include: ['**/*.ts', '**/*.tsx'],
}

/**
 * The fixtures' manifest, publishable, with our package under devDependencies as `init` leaves it:
 * n/no-deprecated-api reads its Node floor and n/no-unpublished-import its publishability.
 */
export const PROJECT_MANIFEST = {
  name: 'changed-settings-fixtures',
  version: '0.0.0',
  type: 'module',
  engines: { node: '>=22.18.0' },
  devDependencies: { [OUR_PACKAGE]: '*' },
}

/** A legacy API both @typescript-eslint/no-deprecated and a more specific rule report: its file, and the specific rule. */
type DeprecatedApiFile = CaseFile & { readonly reportedBy: string }

function stringMethodFile(call: string, reportedBy: string): DeprecatedApiFile {
  const method = call.slice(0, call.indexOf('('))
  return { path: `src/string-${method}.ts`, source: `export const changed = ' abc '.${call}\n`, reportedBy }
}

function keyboardPropertyFile(property: string): DeprecatedApiFile {
  return {
    path: `src/keyboard-${property}.ts`,
    source: `declare function report(code: number): void
window.addEventListener('keydown', (event) => {
  report(event.${property})
})
`,
    reportedBy: 'unicorn/prefer-keyboard-event-key',
  }
}

function regExpStaticFile(name: string, index: number): DeprecatedApiFile {
  const access = /^[$\w]+$/u.test(name) ? `RegExp.${name}` : `RegExp[${JSON.stringify(name)}]`
  return { path: `src/regexp-static-${String(index)}.ts`, source: `export const matched = ${access}\n`, reportedBy: 'unicorn/no-nonstandard-builtin-properties' }
}

function nodeApiFile(name: string, source: string): DeprecatedApiFile {
  return { path: `src/node-${name}.ts`, source, reportedBy: 'n/no-deprecated-api' }
}

const REGEXP_LEGACY_STATICS = ['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', '$9', 'input', '$_', 'lastMatch', '$&', 'lastParen', '$+', 'leftContext', '$`', 'rightContext', "$'"]

const UTIL_TYPE_CHECKS = ['isArray', 'isBoolean', 'isBuffer', 'isDate', 'isError', 'isFunction', 'isNull', 'isNullOrUndefined', 'isNumber', 'isObject', 'isPrimitive', 'isRegExp', 'isString', 'isSymbol', 'isUndefined']

// A sample of n/no-deprecated-api's list that both rules report for Node 22.18 and a { from: "package" }
// specifier silences (measured, @types/node 22.20.5, eslint-plugin-n 18.4.1).
const NODE_API_FILES: readonly DeprecatedApiFile[] = [
  nodeApiFile('buffer-constructor', "import { Buffer } from 'node:buffer'\nexport const made = new Buffer(1)\n"),
  nodeApiFile('slow-buffer', "import { SlowBuffer } from 'node:buffer'\nexport const made = new SlowBuffer(1)\n"),
  nodeApiFile('events-listener-count', "import { EventEmitter } from 'node:events'\nexport const count = EventEmitter.listenerCount(new EventEmitter(), 'save')\n"),
  nodeApiFile('fs-exists', "import * as fs from 'node:fs'\nexport const check = fs.exists\n"),
  nodeApiFile('fs-lchmod', "import * as fs from 'node:fs'\nexport const change = fs.lchmod\n"),
  nodeApiFile('fs-lchmod-sync', "import * as fs from 'node:fs'\nexport const change = fs.lchmodSync\n"),
  nodeApiFile('tls-create-secure-pair', "import * as tls from 'node:tls'\nexport const pair = tls.createSecurePair\n"),
  nodeApiFile('url-parse', "import * as url from 'node:url'\nexport const parsed = url.parse('https://example.com')\n"),
  ...UTIL_TYPE_CHECKS.map((check) => nodeApiFile(`util-${check}`, `import * as util from 'node:util'\nexport const checked = util.${check}(1)\n`)),
  nodeApiFile('util-log', "import * as util from 'node:util'\nutil.log('saved')\n"),
]

function specificRulesOf(files: readonly DeprecatedApiFile[]): string[] {
  return [...new Set(files.map(({ reportedBy }) => reportedBy))]
}

/** Each legacy API both rules report: the duplicate no-deprecated leaves to the specific rule. */
export const DEPRECATED_API_FILES: readonly DeprecatedApiFile[] = [
  stringMethodFile('substr(1)', 'unicorn/prefer-string-slice'),
  stringMethodFile('trimLeft()', 'unicorn/prefer-string-trim-start-end'),
  stringMethodFile('trimRight()', 'unicorn/prefer-string-trim-start-end'),
  keyboardPropertyFile('keyCode'),
  keyboardPropertyFile('charCode'),
  keyboardPropertyFile('which'),
  ...REGEXP_LEGACY_STATICS.map(regExpStaticFile),
  ...NODE_API_FILES,
]

const OWN_DEPRECATED_FUNCTION: CaseFile = {
  path: 'src/own-deprecated.ts',
  source: `/** @deprecated Use next instead. */
function previous(): number {
  return 1
}
export const value = previous()
`,
}

function findQueryFile(query: string): CaseFile {
  return {
    path: `src/screen-${query}.test.ts`,
    source: `import { screen } from '@testing-library/dom'
export function check(): void {
  screen.${query}('save')
}
`,
  }
}

function userEventFile(method: string): CaseFile {
  return {
    path: `src/user-${method}.test.ts`,
    source: `import userEvent from '@testing-library/user-event'
export function act(element: Element): void {
  const user = userEvent.setup()
  user.${method}(element)
}
`,
  }
}

/** Each of testing-library's async helpers, called and left unawaited. */
const TESTING_LIBRARY_CALL_FILES: readonly CaseFile[] = [
  {
    path: 'src/wait-for.test.ts',
    source: `import { waitFor } from '@testing-library/dom'
export function check(): void {
  waitFor(() => 1)
}
`,
  },
  {
    path: 'src/wait-for-removal.test.ts',
    source: `import { waitForElementToBeRemoved } from '@testing-library/dom'
export function check(element: HTMLElement): void {
  waitForElementToBeRemoved(element)
}
`,
  },
  ...FIND_QUERIES.map(findQueryFile),
  {
    path: 'src/bare-find-query.test.ts',
    source: `import { findByRole } from '@testing-library/dom'
export function check(container: HTMLElement): void {
  findByRole(container, 'button')
}
`,
  },
  ...USER_EVENT_METHODS.map(userEventFile),
  {
    path: 'src/user-event-direct.test.ts',
    source: `import userEvent from '@testing-library/user-event'
export function act(element: Element): void {
  userEvent.click(element)
}
`,
  },
]

/**
 * vitest's async assertions, left unawaited. Measured (typescript-eslint 8.71.1, vitest 5.0.3): the
 * callee's type is an anonymous function type vitest maps each matcher to, so no specifier naming a
 * matcher reaches it; `{ from: "package", package: "vitest", name: "__type" }` does.
 */
const VITEST_ASSERTION_FILES: readonly CaseFile[] = [
  {
    path: 'src/resolves.test.ts',
    source: `import { expect } from 'vitest'
export function check(loaded: Promise<number>): void {
  expect(loaded).resolves.toBe(1)
}
`,
  },
  {
    path: 'src/rejects.test.ts',
    source: `import { expect } from 'vitest'
export function check(loaded: Promise<number>): void {
  expect(loaded).rejects.toThrow('failed')
}
`,
  },
]

const OWN_UNAWAITED_PROMISE: CaseFile = {
  path: 'src/own-promise.test.ts',
  source: `async function save(): Promise<void> {}
export function check(): void {
  save()
}
`,
}

/**
 * An unawaited call through an anonymous function type the file declares itself. Its type is named
 * `__type`, as user-event's session methods and vitest's matchers are, but it is declared in neither
 * package, so no `{ from: "package" }` entry may reach it.
 */
const OWN_ANONYMOUSLY_TYPED_PROMISE: CaseFile = {
  path: 'src/own-anonymous-type.test.ts',
  source: `export const save: () => Promise<void> = async () => {}
export function check(): void {
  save()
}
`,
}

const UNAWAITED_USER_EVENT = `import userEvent from '@testing-library/user-event'
export function press(element: Element) {
  userEvent.click(element)
}
`

const DOM_IMPORT = `import { screen } from '@testing-library/dom'
export const found = screen
`

const CLASS_WITH_THIS = `import { Component } from 'react'
export class Panel extends Component {
  render() {
    return this.props.children
  }
}
`

// unicorn does not know this helper to be pure; from v78 it accepts defineConfig() itself (measured).
const DEFAULT_EXPORTED_CALL = `import { createConfig } from 'build-tool'
export default createConfig({})
`

// A file importing our package, a devDependency of the fixtures' manifest.
const IMPORTS_OUR_PACKAGE = `import { defineLintRules } from '${OUR_PACKAGE}'

export const config = defineLintRules({})
`
const NESTED_PACKAGE = 'apps/web'

const NBSP = ' '

/** The same source in a file of each form the test-file globs name: a test, a spec, one under `__tests__`, and the two type tests. */
function inEachTestFile(source: string, extension: string): CaseFile[] {
  return [`src/a.test.${extension}`, `src/a.spec.${extension}`, `src/__tests__/a.${extension}`, `src/a.test-d.${extension}`, `src/a.spec-d.${extension}`].map((path) => ({ path, source }))
}

/** A rule that judges test code by source-code standards: silent on its code in each test file, still reporting it in a source file. */
function skippingTestFiles(rule: string, source: string): RuleCase {
  return { rule, subject: 'test and type-test files', silentIn: inEachTestFile(source, 'ts'), reportedIn: [{ path: 'src/a.ts', source }] }
}

const LONG_FUNCTION = `export function total(): number {
${Array.from({ length: 22 }, (_, index) => `  const part${String(index)} = ${String(index)}`).join('\n')}
  return ${Array.from({ length: 22 }, (_, index) => `part${String(index)}`).join(' + ')}
}
`

const STACK_PUSH = 'export function add(stack: number[], item: number): void {\n  stack.push(item)\n}\n'

// The plugin takes any function named render… for Testing Library's.
const RENDERER_NAMED_LIKE_A_RENDER = 'declare function rendererNameOf(frame: object): string\nexport const renderer = rendererNameOf({})\n'

const UNAWAITED_VITEST_3_ASSERTIONS: readonly CaseFile[] = [
  { path: 'src/resolves.test.ts', source: "import { expect } from 'vitest'\nexport function check(loaded: Promise<number>): void {\n  expect(loaded).resolves.toBe(1)\n}\n" },
  { path: 'src/rejects.test.ts', source: "import { expect } from 'vitest'\nexport function check(loaded: Promise<number>): void {\n  expect(loaded).rejects.toThrow('failed')\n}\n" },
]

/** A string held under the given name. */
function nonBooleanNamedFile(name: string): CaseFile {
  return { path: `src/non-boolean-${name}.js`, source: `export const ${name} = 'x'\n` }
}

/** The rules whose options or files changed. */
export const CHANGED_SETTING_CASES: readonly RuleCase[] = [
  // componentWillMount is reported as its UNSAFE_ alias is.
  {
    rule: 'react/no-unsafe',
    silentIn: [
      {
        path: 'src/render-only.jsx',
        source: `import { Component } from 'react'
export class Card extends Component {
  render() {
    return null
  }
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/alias.jsx',
        source: `import { Component } from 'react'
export class Card extends Component {
  componentWillMount() {}
  render() {
    return null
  }
}
`,
      },
      {
        path: 'src/unsafe.jsx',
        source: `import { Component } from 'react'
export class Card extends Component {
  UNSAFE_componentWillMount() {}
  render() {
    return null
  }
}
`,
      },
    ],
  },
  {
    rule: 'react/jsx-no-bind',
    silentIn: [{ path: 'src/bound.jsx', source: 'export const Save = ({ save }) => <button onClick={save.bind(null)}>Save</button>\n' }],
    reportedIn: [{ path: 'src/function.jsx', source: 'export const Save = ({ save }) => <button onClick={function () { save() }}>Save</button>\n' }],
  },
  // The specific rule reports each of these (DUPLICATES_LEFT_TO_THE_SPECIFIC_RULE).
  ...specificRulesOf(DEPRECATED_API_FILES).map((specificRule) => ({
    rule: '@typescript-eslint/no-deprecated',
    subject: `the APIs ${specificRule} reports`,
    silentIn: DEPRECATED_API_FILES.filter(({ reportedBy }) => reportedBy === specificRule).map(({ path, source }) => ({ path, source })),
    reportedIn: [OWN_DEPRECATED_FUNCTION],
  })),
  {
    rule: '@typescript-eslint/no-floating-promises',
    subject: "testing-library's async helpers",
    silentIn: TESTING_LIBRARY_CALL_FILES,
    reportedIn: [OWN_UNAWAITED_PROMISE],
  },
  {
    rule: '@typescript-eslint/no-floating-promises',
    subject: "vitest's async assertions",
    silentIn: VITEST_ASSERTION_FILES,
    reportedIn: [OWN_UNAWAITED_PROMISE],
  },
  // `__type` is the name of every anonymous function type; `from: "package"` keeps the user-event and
  // vitest entries to those packages' own.
  {
    rule: '@typescript-eslint/no-floating-promises',
    subject: "an anonymous function type of the file's own, beside the packages' anonymous ones",
    silentIn: [userEventFile('click'), ...VITEST_ASSERTION_FILES],
    reportedIn: [OWN_ANONYMOUSLY_TYPED_PROMISE],
  },
  // Story files, the storybook rules' files.
  {
    rule: 'testing-library/await-async-events',
    silentIn: [
      { path: 'src/button.stories.tsx', source: UNAWAITED_USER_EVENT },
      { path: '.storybook/preview.tsx', source: UNAWAITED_USER_EVENT },
    ],
    reportedIn: [{ path: 'src/button.test.tsx', source: UNAWAITED_USER_EVENT }],
  },
  {
    rule: 'testing-library/no-dom-import',
    silentIn: [
      { path: 'src/button.stories.tsx', source: DOM_IMPORT },
      { path: '.storybook/preview.tsx', source: DOM_IMPORT },
    ],
    reportedIn: [{ path: 'src/button.test.tsx', source: DOM_IMPORT }],
  },
  // oxlint skips regular expressions already; ESLint's own default does not.
  {
    rule: 'no-irregular-whitespace',
    silentIn: [{ path: 'src/regexp.js', source: `export const spaced = /a${NBSP}b/u\n` }],
    reportedIn: [{ path: 'src/statements.js', source: `export const first = 1;${NBSP}export const second = 2\n` }],
  },
  // Without oxlint, ESLint runs typescript-eslint's version on TS files.
  {
    rule: 'no-unused-vars',
    silentIn: ['js', 'ts'].map((extension) => ({
      path: `src/caught.${extension}`,
      source: `export function load(read) {
  try {
    return read()
  } catch (error) {
    return null
  }
}
`,
    })),
    reportedIn: ['js', 'ts'].map((extension) => ({
      path: `src/parameter.${extension}`,
      source: `export function load(read, unused) {
  return read()
}
`,
    })),
  },
  // The class's own name is allowed; super is still preferred.
  {
    rule: 'unicorn/class-reference-in-static-methods',
    silentIn: [
      {
        path: 'src/own-class.js',
        source: `export class Counter {
  static start = 1
  static first() {
    return Counter.start
  }
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/super-class.js',
        source: `class Base {
  static start = 1
}
export class Counter extends Base {
  static first() {
    return Base.start
  }
}
`,
      },
    ],
  },
  {
    rule: 'no-void',
    silentIn: [{ path: 'src/statement.js', source: 'export function run(save) {\n  void save()\n}\n' }],
    reportedIn: [{ path: 'src/expression.js', source: 'export const nothing = void 0\n' }],
  },
  // A class error boundary is the one class React needs.
  {
    rule: 'functional/no-classes',
    silentIn: [
      {
        path: 'src/did-catch.jsx',
        source: `import { Component } from 'react'
export class Boundary extends Component {
  componentDidCatch(error) {
    console.error(error)
  }
  render() {
    return this.props.children
  }
}
`,
      },
      {
        path: 'src/derived-state.jsx',
        source: `import { Component } from 'react'
export class Boundary extends Component {
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.props.children
  }
}
`,
      },
    ],
    reportedIn: [{ path: 'src/plain.js', source: 'export class Plain {}\n' }],
  },
  // Error-boundary files, told apart by name.
  {
    rule: 'functional/no-this-expressions',
    silentIn: [
      { path: 'src/error-boundary.tsx', source: CLASS_WITH_THIS },
      { path: 'src/AppErrorBoundary.tsx', source: CLASS_WITH_THIS },
    ],
    reportedIn: [{ path: 'src/panel.tsx', source: CLASS_WITH_THIS }],
  },
  {
    rule: 'sonarjs/function-name',
    silentIn: [
      {
        path: 'src/unsafe-method.jsx',
        source: `import { Component } from 'react'
export class Card extends Component {
  UNSAFE_componentWillMount() {}
  render() {
    return null
  }
}
`,
      },
    ],
    reportedIn: [{ path: 'src/snake-method.js', source: 'export class Card {\n  bad_name() {}\n}\n' }],
  },
  // A route group's folder.
  {
    rule: 'check-file/folder-naming-convention',
    silentIn: [{ path: 'src/(group)/page.ts', source: 'export const page = 1\n' }],
    reportedIn: [{ path: 'src/a!b/page.ts', source: 'export const page = 1\n' }],
  },
  {
    rule: '@typescript-eslint/consistent-type-assertions',
    silentIn: [{ path: 'src/annotated.ts', source: 'export const names: string[] = []\n' }],
    reportedIn: [{ path: 'src/asserted.ts', source: 'export const names = [] as string[]\n' }],
  },
  // Tool config files.
  {
    rule: 'unicorn/no-top-level-side-effects',
    silentIn: [
      { path: 'vite.config.ts', source: DEFAULT_EXPORTED_CALL },
      { path: 'tools/x.config.mjs', source: DEFAULT_EXPORTED_CALL },
    ],
    reportedIn: [{ path: 'src/setup.ts', source: DEFAULT_EXPORTED_CALL }],
  },
  // The files a consumer writes for us, which import our package, in a package npm may publish.
  {
    rule: 'n/no-unpublished-import',
    subject: 'the files a consumer writes for us',
    silentIn: Object.values(consumerConfigFiles).flatMap((file) => [
      { path: file, source: IMPORTS_OUR_PACKAGE },
      { path: `${NESTED_PACKAGE}/${file}`, source: IMPORTS_OUR_PACKAGE },
    ]),
    reportedIn: [{ path: 'src/app.ts', source: IMPORTS_OUR_PACKAGE }],
  },
  // Svelte's runes and store subscriptions are no globals; ESLint reads no .svelte file.
  {
    rule: 'no-undef',
    silentIn: [{ path: 'src/counter.svelte', source: '<script>\n  const doubled = $count * 2\n</script>\n', onlyIn: 'oxlint' }],
    reportedIn: [{ path: 'src/value.js', source: 'export const value = undeclared\n' }],
  },
  // A name written all in lower or upper case, as a command or a format is; a mixed-case slip is still fixed.
  {
    rule: 'unicorn/comment-content',
    silentIn: [
      { path: 'src/lowercase.js', source: '// run git before the release\nexport const step = 1\n' },
      { path: 'src/uppercase.js', source: '// read the JSON file\nexport const step = 1\n' },
    ],
    reportedIn: [{ path: 'src/mixed-case.js', source: '// push to Github\nexport const step = 1\n' }],
  },
  // The keyword, as array-type asks for readonly string[]; Readonly<…> around a named type stays allowed.
  {
    rule: 'functional/readonly-type',
    silentIn: [
      { path: 'src/keyword.ts', source: 'export type Run = { readonly code: number }\n' },
      { path: 'src/named.ts', source: 'type Props = { code: number }\nexport type Run = Readonly<Props>\n' },
    ],
    reportedIn: [{ path: 'src/generic.ts', source: 'export type Run = Readonly<{ code: number }>\n' }],
  },
  {
    rule: 'no-unused-vars',
    subject: 'a key left out of a copy',
    silentIn: ['js', 'ts'].map((extension) => ({ path: `src/rest.${extension}`, source: 'export const withoutFlag = ({ flag, ...entry }) => entry\n' })),
    reportedIn: ['js', 'ts'].map((extension) => ({ path: `src/destructured.${extension}`, source: 'export const pick = ({ flag }) => 1\n' })),
  },
  // btn is a default replacement, which the allowed names leave in force.
  {
    rule: 'unicorn/name-replacements',
    silentIn: [
      { path: 'src/dist.js', source: "export const distDir = 'dist'\n" },
      { path: 'src/repo.js', source: 'export function gitRepoAt(path) {\n  return path\n}\n' },
      { path: 'src/dirs.js', source: 'export const workspaceDirs = []\n' },
      { path: 'src/envs.js', source: 'export const envs = []\n' },
    ],
    reportedIn: [{ path: 'src/btn.js', source: 'export const btn = 1\n' }],
  },
  {
    rule: 'functional/no-expression-statements',
    subject: 'a call that returns nothing',
    silentIn: [{ path: 'src/write.ts', source: "import { writeFileSync } from 'node:fs'\nexport function save(path: string, text: string): void {\n  writeFileSync(path, text)\n}\n" }],
    reportedIn: [{ path: 'src/push.ts', source: STACK_PUSH }],
  },
  {
    rule: 'import-x/no-extraneous-dependencies',
    subject: 'a type-only import',
    silentIn: [{ path: 'src/listed-type.ts', source: "import type { defineLintRules } from '@agents-inc/lint-rules'\nexport type Define = typeof defineLintRules\n" }],
    reportedIn: [{ path: 'src/unlisted-type.ts', source: "import type { Plugin } from 'vite'\nexport type Plugins = Plugin[]\n" }],
  },
  // A first word ending in s is a verb (runs, uses) or a plural noun; is, has, was, does and requires are still checked.
  {
    rule: 'unicorn/consistent-boolean-name',
    silentIn: [
      { path: 'src/verb.js', source: 'export const runsOnEveryRender = true\n' },
      { path: 'src/plural.js', source: 'export const suppressionsAllowed = true\n' },
    ],
    reportedIn: [
      { path: 'src/noun.js', source: 'export const typeAware = true\n' },
      { path: 'src/not-a-boolean.js', source: "export const isOneOf = 'x'\n" },
      ...['hasItems', 'wasSent', 'doesFit', 'requiresAuth'].map(nonBooleanNamedFile),
    ],
  },
  // vitest/valid-expect reports them, and autofixes them.
  {
    rule: '@typescript-eslint/no-floating-promises',
    subject: "Vitest 3's async assertions",
    silentIn: UNAWAITED_VITEST_3_ASSERTIONS,
    reportedIn: [OWN_UNAWAITED_PROMISE],
    packages: VITEST_3_PACKAGES,
  },
  // A test is made of statements, and fixture code held in strings: these judge it by source-code standards.
  skippingTestFiles('functional/no-expression-statements', STACK_PUSH),
  skippingTestFiles('functional/no-return-void', 'export function log(text: string): void {\n  console.log(text)\n}\n'),
  skippingTestFiles('sonarjs/max-lines-per-function', LONG_FUNCTION),
  skippingTestFiles('unicorn/no-incorrect-template-string-interpolation', 'export const markup = (children: string) => `<Dialog>{children}</Dialog>`\n'),
  skippingTestFiles('sonarjs/no-undefined-assignment', 'export const expected = { outside: undefined }\n'),
  skippingTestFiles('@typescript-eslint/no-unsafe-type-assertion', 'export const narrowed = (value: { a: number } | string) => value as string\n'),
  skippingTestFiles('unicorn/prefer-await', "export const tagged = (run: Promise<void>) => run.then(() => 'done' as const)\n"),
  skippingTestFiles('functional/no-classes', 'export class Runner {}\n'),
  skippingTestFiles('functional/no-this-expressions', 'export const counter = {\n  count: 0,\n  next() {\n    return this.count\n  },\n}\n'),
  skippingTestFiles('sonarjs/file-name-differ-from-class', 'export default class Runner {}\n'),
  {
    rule: 'testing-library/render-result-naming-convention',
    subject: 'source files',
    silentIn: [
      { path: 'src/a.ts', source: RENDERER_NAMED_LIKE_A_RENDER },
      { path: 'src/a.tsx', source: RENDERER_NAMED_LIKE_A_RENDER },
    ],
    reportedIn: [
      { path: 'src/a.test.tsx', source: RENDERER_NAMED_LIKE_A_RENDER },
      { path: 'src/__tests__/a.tsx', source: RENDERER_NAMED_LIKE_A_RENDER },
      { path: 'src/a.test-d.ts', source: RENDERER_NAMED_LIKE_A_RENDER },
      { path: 'src/a.stories.tsx', source: RENDERER_NAMED_LIKE_A_RENDER },
    ],
  },
]

/** Each API no-deprecated leaves to the more specific rule, which still reports it. */
export const DUPLICATES_LEFT_TO_THE_SPECIFIC_RULE: readonly RuleCase[] = specificRulesOf(DEPRECATED_API_FILES).map((rule) => ({
  rule,
  silentIn: [],
  reportedIn: DEPRECATED_API_FILES.filter(({ reportedBy }) => reportedBy === rule).map(({ path, source }) => ({ path, source })),
}))

/** Rules moved to ESLint or newly shipped: each fires there, and stays silent beside. */
export const MOVED_OR_ADDED_CASES: readonly RuleCase[] = [
  {
    rule: 'no-constant-condition',
    silentIn: [{ path: 'src/variable.js', source: 'export function run(ready) {\n  if (ready) {\n    return 1\n  }\n  return 0\n}\n' }],
    reportedIn: [{ path: 'src/literal.js', source: 'export function run() {\n  if (true) {\n    return 1\n  }\n  return 0\n}\n' }],
  },
  {
    rule: 'unicorn/no-await-in-promise-methods',
    silentIn: [{ path: 'src/promise.js', source: 'export async function run(load) {\n  return Promise.all([load()])\n}\n' }],
    reportedIn: [{ path: 'src/awaited.js', source: 'export async function run(load) {\n  return Promise.all([await load()])\n}\n' }],
  },
  // ESLint's rule knows setTimeout only as a declared global, and these fixtures declare no runtime's
  // globals, so the calls reach it through globalThis.
  {
    rule: 'no-implied-eval',
    silentIn: [{ path: 'src/callback.js', source: 'export function later(run) {\n  globalThis.setTimeout(() => run(), 1)\n}\n' }],
    reportedIn: [{ path: 'src/string.js', source: "export function later() {\n  globalThis.setTimeout('run()', 1)\n}\n" }],
  },
  {
    rule: 'consistent-return',
    silentIn: [{ path: 'src/always.js', source: 'export function pick(ready) {\n  if (ready) {\n    return 1\n  }\n  return 0\n}\n' }],
    reportedIn: [{ path: 'src/sometimes.js', source: 'export function pick(ready) {\n  if (ready) {\n    return 1\n  }\n  return\n}\n' }],
  },
  {
    rule: 'house/require-class-helper',
    silentIn: [{ path: 'src/helper.jsx', source: "export const Card = ({ wide }) => <div className={cn('card', wide && 'wide')} />\n" }],
    reportedIn: [{ path: 'src/template.jsx', source: 'export const Card = ({ wide }) => <div className={`card ${wide}`} />\n' }],
  },
  {
    rule: 'default-case-last',
    silentIn: [{ path: 'src/default-last.js', source: "export function pick(kind) {\n  switch (kind) {\n    case 'a':\n      return 1\n    default:\n      return 0\n  }\n}\n" }],
    reportedIn: [{ path: 'src/default-first.js', source: "export function pick(kind) {\n  switch (kind) {\n    default:\n      return 0\n    case 'a':\n      return 1\n  }\n}\n" }],
  },
]

const FOR_EACH = 'items.forEach((item) => use(item))'
const DATASET_WRITE = "element.setAttribute('data-unicorn', '1')"

function suppressedFile(path: string, line: string, suppressedName: string): CaseFile {
  return { path, source: `export function run(items, element, use) {\n  // eslint-disable-next-line ${suppressedName}\n  ${line}\n}\n` }
}

/** The suppression rules, and the renamed rules oxlint runs, on oxlint. */
export const SUPPRESSION_AND_RENAMED_CASES: readonly RuleCase[] = [
  // Every blanket form; a comment naming a rule is no blanket.
  {
    rule: 'unicorn/no-abusive-eslint-disable',
    engines: ['oxlint'],
    silentIn: [{ path: 'src/named.js', source: '// eslint-disable-next-line no-debugger\nexport const value = 1\n' }],
    reportedIn: [
      { path: 'src/line.js', source: '// eslint-disable\nexport const value = 1\n' },
      { path: 'src/block.js', source: '/* eslint-disable */\nexport const value = 1\n' },
      { path: 'src/same-line.js', source: 'export const value = 1 // eslint-disable-line\n' },
      { path: 'src/oxlint-next-line.js', source: '// oxlint-disable-next-line\nexport const value = 1\n' },
    ],
  },
  // Beside oxlint, a suppression names oxlint's spelling; ours does not reach oxlint (a measured limit).
  {
    rule: 'unicorn/no-for-each',
    engines: ['oxlint'],
    silentIn: [
      { path: 'src/for-of.js', source: 'export function run(items, use) {\n  for (const item of items) use(item)\n}\n' },
      suppressedFile('src/suppressed-by-oxlints-name.js', FOR_EACH, 'unicorn/no-array-for-each'),
    ],
    reportedIn: [
      { path: 'src/for-each.js', source: `export function run(items, use) {\n  ${FOR_EACH}\n}\n` },
      suppressedFile('src/suppressed-by-our-name.js', FOR_EACH, 'unicorn/no-for-each'),
    ],
  },
  {
    rule: 'unicorn/dom-node-dataset',
    engines: ['oxlint'],
    silentIn: [
      { path: 'src/dataset.js', source: "export function run(element) {\n  element.dataset.unicorn = '1'\n}\n" },
      suppressedFile('src/suppressed-by-oxlints-name.js', DATASET_WRITE, 'unicorn/prefer-dom-node-dataset'),
    ],
    reportedIn: [
      { path: 'src/set-attribute.js', source: `export function run(element) {\n  ${DATASET_WRITE}\n}\n` },
      suppressedFile('src/suppressed-by-our-name.js', DATASET_WRITE, 'unicorn/dom-node-dataset'),
    ],
  },
]
