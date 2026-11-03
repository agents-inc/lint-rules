import type { Engine } from '../../catalog.ts'
import type { CaseFile } from '../rule-case-runs.ts'
import type { RuleCase } from './changed-settings.ts'

const BOTH_ENGINES = ['oxlint', 'eslint'] as const
const REGEXP_ESCAPE_SOURCE = String.raw`export const escaped = (text) => text.replace(/[$()*+.?[\\\]^{|}]/gu, '\\$&')`

function inJsAndTs(name: string, source: string): CaseFile[] {
  return [
    { path: `src/${name}.js`, source },
    { path: `src/${name}.ts`, source },
  ]
}

function inTs(name: string, source: string): CaseFile[] {
  return [{ path: `src/${name}.ts`, source }]
}

function inJsxAndTsx(name: string, source: string): CaseFile[] {
  return [
    { path: `src/${name}.jsx`, source },
    { path: `src/${name}.tsx`, source },
  ]
}

function linesLong(count: number): string {
  return Array.from({ length: count }, (_, index) => `export const line${String(index)} = ${String(index)}\n`).join('')
}

function inComponentFilesOxlintAloneReads(name: string, count: number): CaseFile[] {
  return [
    { path: `src/${name}.vue`, source: `<script>\n${linesLong(count)}</script>\n`, onlyIn: 'oxlint' },
    { path: `src/${name}.svelte`, source: `<script>\n${linesLong(count)}</script>\n`, onlyIn: 'oxlint' },
    { path: `src/${name}.astro`, source: `---\n${linesLong(count)}---\n`, onlyIn: 'oxlint' },
  ]
}

function pinnedGap(rule: string, shape: string, files: readonly CaseFile[], reportedBy: Engine): RuleCase[] {
  return BOTH_ENGINES.map((engine) => ({
    rule,
    subject: `${shape}, ${engine === reportedBy ? 'reported' : 'left alone'} by ${engine === 'oxlint' ? 'oxlint' : 'ESLint'}`,
    engines: [engine],
    silentIn: engine === reportedBy ? [] : files,
    reportedIn: engine === reportedBy ? files : [],
  }))
}

export const OXLINT_VERSION_CASES: readonly RuleCase[] = [
  // array-simple: a simple element type is written T[], any other Array<T>.
  {
    rule: '@typescript-eslint/array-type',
    engines: BOTH_ENGINES,
    silentIn: [...inTs('simple-brackets', 'export const names: string[] = []\n'), ...inTs('complex-generic', 'export const values: Array<string | number> = []\n')],
    reportedIn: [...inTs('simple-generic', 'export const names: Array<string> = []\n'), ...inTs('complex-brackets', 'export const values: (string | number)[] = []\n')],
  },
  {
    rule: '@typescript-eslint/consistent-type-assertions',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inTs('annotated', "type Row = { id: string; label: string }\nexport const row: Row = { id: 'a', label: 'b' }\n"),
      ...inTs('value-as', 'type Row = { id: string }\nexport function rowOf(input: unknown) {\n  return input as Row\n}\n'),
      ...inTs('as-const', "export const modes = ['on', 'off'] as const\n"),
    ],
    reportedIn: [
      ...inTs('object-literal-as', "type Row = { id: string; label: string }\nexport const row = { id: 'a' } as Row\n"),
      ...inTs('array-literal-as', "type Row = { id: string }\nexport const rows = [{ id: 'a' }] as Row[]\n"),
      ...inTs('angle-bracket', 'type Row = { id: string }\nexport function rowOf(input: unknown) {\n  return <Row>input\n}\n'),
    ],
  },
  {
    rule: '@typescript-eslint/consistent-type-definitions',
    engines: BOTH_ENGINES,
    silentIn: inTs('type-alias', 'export type Row = {\n  id: string\n}\n'),
    reportedIn: inTs('interface', 'export interface Row {\n  id: string\n}\n'),
  },
  {
    rule: '@typescript-eslint/no-dynamic-delete',
    engines: BOTH_ENGINES,
    silentIn: inTs('static-key', 'export function drop(o: { k?: number }) {\n  delete o.k\n}\n'),
    reportedIn: inTs('dynamic-key', 'export function drop(o: Record<string, number>, k: string) {\n  delete o[k]\n}\n'),
  },
  // with-single-extends: an empty interface extending one other names it, and is left alone.
  {
    rule: '@typescript-eslint/no-empty-object-type',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inTs('single-extends', 'interface Base {\n  id: string\n}\nexport interface Row extends Base {}\n'),
      ...inTs('two-extends', 'interface A {\n  a: string\n}\ninterface B {\n  b: string\n}\nexport interface Both extends A, B {}\n'),
      ...inTs('with-members', 'export type Row = { id: string }\n'),
    ],
    reportedIn: [...inTs('empty-type', 'export type Anything = {}\n'), ...inTs('empty-interface', 'export interface Anything {}\n')],
  },
  {
    rule: '@typescript-eslint/no-inferrable-types',
    engines: BOTH_ENGINES,
    silentIn: [...inTs('inferred', 'export const total = 1\n'), ...inTs('wider', 'export const total: number | string = 1\n')],
    reportedIn: [...inTs('annotated-literal', 'export const total: number = 1\n'), ...inTs('annotated-parameter', 'export function grow(by: number = 1) {\n  return by\n}\n')],
  },
  {
    rule: '@typescript-eslint/no-invalid-void-type',
    engines: BOTH_ENGINES,
    silentIn: [...inTs('void-return', 'export function f(): void {\n  return undefined\n}\n'), ...inTs('promise-void', 'export const done: Promise<void> = Promise.resolve()\n')],
    reportedIn: [...inTs('void-parameter', 'export function f(v: void) {\n  return v\n}\n'), ...inTs('void-union', 'export type Maybe = string | void\n')],
  },
  {
    rule: '@typescript-eslint/no-unsafe-function-type',
    engines: BOTH_ENGINES,
    silentIn: inTs('signature', 'export type Callback = () => void\n'),
    reportedIn: inTs('function-type', 'export type Callback = Function\n'),
  },
  {
    rule: '@typescript-eslint/prefer-enum-initializers',
    engines: BOTH_ENGINES,
    silentIn: inTs('initialized', 'export enum Mode {\n  On = 0,\n  Off = 1,\n}\n'),
    reportedIn: inTs('uninitialized', 'export enum Mode {\n  On,\n  Off,\n}\n'),
  },
  {
    rule: '@typescript-eslint/prefer-function-type',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inTs('function-type', 'export type Handler = (value: string) => void\n'),
      ...inTs('call-and-member', 'export interface Handler {\n  (value: string): void\n  label: string\n}\n'),
    ],
    reportedIn: inTs('call-only', 'export interface Handler {\n  (value: string): void\n}\n'),
  },
  {
    rule: '@typescript-eslint/prefer-literal-enum-member',
    engines: BOTH_ENGINES,
    silentIn: inTs('literal-members', "export enum Mode {\n  On = 1,\n  Off = 'off',\n}\n"),
    reportedIn: inTs('computed-member', 'const base = 1\nexport enum Mode {\n  On = base,\n}\n'),
  },
  {
    rule: 'array-callback-return',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inJsAndTs('returns', 'export const doubled = [1, 2].map((n) => {\n  return n * 2\n})\n'),
      ...inJsAndTs('for-each', 'export function log(values) {\n  values.forEach((n) => {\n    console.log(n)\n  })\n}\n'),
    ],
    reportedIn: inJsAndTs('no-return', 'export const doubled = [1, 2].map((n) => {\n  const v = n * 2\n})\n'),
  },
  {
    rule: 'default-param-last',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('default-last', 'export function go(first, second = 1) {\n  return first + second\n}\n'),
    reportedIn: inJsAndTs('default-first', 'export function go(first = 1, second) {\n  return first + second\n}\n'),
  },
  // Shipped with max 200 in JSX files, outside hooks, tests and stories.
  {
    rule: 'max-lines',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inJsxAndTsx('at-the-limit', linesLong(200)),
      ...inJsAndTs('over-the-limit', linesLong(201)),
      { path: 'src/use-over-the-limit.tsx', source: linesLong(201) },
      { path: 'src/over-the-limit.test.tsx', source: linesLong(201) },
      ...inComponentFilesOxlintAloneReads('over-the-limit', 201),
    ],
    reportedIn: inJsxAndTsx('over-the-limit', linesLong(201)),
  },
  // The default pattern names the error parameter `err`.
  {
    rule: 'n/handle-callback-err',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inJsAndTs('handled', 'export function read(cb) {\n  cb(function (err, data) {\n    if (err) throw err\n    console.log(data)\n  })\n}\n'),
      ...inJsAndTs('other-name', 'export function read(cb) {\n  cb(function (error, data) {\n    console.log(data)\n  })\n}\n'),
    ],
    reportedIn: inJsAndTs('unhandled', 'export function read(cb) {\n  cb(function (err, data) {\n    console.log(data)\n  })\n}\n'),
  },
  {
    rule: 'no-constructor-return',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('bare-return', 'export class Box {\n  constructor(ready) {\n    if (!ready) return\n    this.ready = ready\n  }\n}\n'),
    reportedIn: inJsAndTs('returns-value', 'export class Box {\n  constructor() {\n    return { ok: true }\n  }\n}\n'),
  },
  {
    rule: 'no-extra-label',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs(
      'outer-loop',
      'export function f(rows) {\n  outer: for (const row of rows) {\n    for (const cell of row) {\n      if (cell) break outer\n    }\n  }\n}\n',
    ),
    reportedIn: inJsAndTs('only-loop', 'export function f() {\n  outer: for (let i = 0; i < 1; i += 1) {\n    break outer\n  }\n}\n'),
  },
  // A block declaring a let or const scopes it, so only a block declaring nothing is lone.
  {
    rule: 'no-lone-blocks',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inJsAndTs('scoping-block', 'export function f() {\n  const a = 1\n  {\n    const inner = 2\n    console.log(inner)\n  }\n  return a\n}\n'),
      ...inJsAndTs('top-level-scoping-block', '{\n  const inner = 2\n  console.log(inner)\n}\nexport const a = 1\n'),
    ],
    reportedIn: inJsAndTs('lone-block', 'export function f() {\n  {\n    console.log(1)\n  }\n}\n'),
  },
  {
    rule: 'no-promise-executor-return',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('block-body', 'export const p = new Promise((resolve) => {\n  resolve(1)\n})\n'),
    reportedIn: inJsAndTs('expression-body', 'export const p = new Promise((resolve) => resolve(1))\n'),
  },
  // except-parens: an assignment in parentheses is meant.
  {
    rule: 'no-return-assign',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('in-parentheses', 'export function f(a) {\n  return (a.v = 2)\n}\n'),
    reportedIn: inJsAndTs('bare', 'export function f(a) {\n  return a.v = 2\n}\n'),
  },
  {
    rule: 'no-useless-computed-key',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('computed-variable', 'const key = 1\nexport const o = { [key]: 1, id: 2 }\n'),
    reportedIn: [...inJsAndTs('literal-key', "export const o = { ['id']: 1 }\n"), ...inJsAndTs('class-member', "export class Runner {\n  ['run']() {\n    return 1\n  }\n}\n")],
  },
  {
    rule: 'no-useless-return',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('early-return', 'export function f(v) {\n  if (v > 0) {\n    return\n  }\n  console.log(v)\n}\n'),
    reportedIn: inJsAndTs('last-return', 'export function f(v) {\n  if (v > 0) {\n    console.log(v)\n  }\n  return\n}\n'),
  },
  {
    rule: 'no-var',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('let', 'export function f() {\n  let total = 1\n  total += 1\n  return total\n}\n'),
    reportedIn: inJsAndTs('var', 'export function f() {\n  var total = 1\n  return total\n}\n'),
  },
  // properties: a method written as a function expression is left alone.
  {
    rule: 'object-shorthand',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inJsAndTs('shorthand', 'export const query = (limit, offset) => ({ limit, offset })\n'),
      ...inJsAndTs('long-method', 'export const handlers = {\n  run: function () {\n    return 1\n  },\n}\n'),
    ],
    reportedIn: inJsAndTs('longhand', 'export const query = (limit, offset) => ({ limit: limit, offset: offset })\n'),
  },
  // allowNamedFunctions: a named function expression is left alone.
  {
    rule: 'prefer-arrow-callback',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inJsAndTs('arrow', 'export const doubled = [1, 2].map((n) => n * 2)\n'),
      ...inJsAndTs('named-function', 'export const doubled = [1, 2].map(function double(n) {\n  return n * 2\n})\n'),
    ],
    reportedIn: inJsAndTs('anonymous-function', 'export const doubled = [1, 2].map(function (n) {\n  return n * 2\n})\n'),
  },
  {
    rule: 'prefer-exponentiation-operator',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('operator', 'export const cubed = 2 ** 3\n'),
    reportedIn: inJsAndTs('math-pow', 'export const cubed = Math.pow(2, 3)\n'),
  },
  {
    rule: 'prefer-numeric-literals',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('binary-literal', 'export const n = 0b111110111\n'), ...inJsAndTs('decimal-parse', "export const n = parseInt('503', 10)\n")],
    reportedIn: [...inJsAndTs('binary-parse', "export const n = parseInt('111110111', 2)\n"), ...inJsAndTs('number-parse-int', "export const n = Number.parseInt('767', 8)\n")],
  },
  {
    rule: 'prefer-object-spread',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('spread', 'export const merged = { ...{ a: 1 }, ...{ b: 2 } }\n'), ...inJsAndTs('into-target', 'export function merge(target, b) {\n  return Object.assign(target, b)\n}\n')],
    reportedIn: inJsAndTs('assign-to-literal', 'export const merged = Object.assign({}, { a: 1 }, { b: 2 })\n'),
  },
  {
    rule: 'prefer-promise-reject-errors',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('error', "export const p = Promise.reject(new Error('nope'))\n"),
    reportedIn: [
      ...inJsAndTs('string-reason', "export const p = Promise.reject('nope')\n"),
      ...inJsAndTs('executor-string', "export const p = new Promise((resolve, reject) => {\n  reject('nope')\n})\n"),
    ],
  },
  {
    rule: 'prefer-regex-literals',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('literal', 'export const re = /abc/u\n'), ...inJsAndTs('dynamic', "export function matcher(pattern) {\n  return new RegExp(pattern, 'u')\n}\n")],
    reportedIn: inJsAndTs('static-string', "export const re = new RegExp('abc')\n"),
  },
  {
    rule: 'prefer-spread',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('spread', 'export function total(add, xs) {\n  return add(...xs)\n}\n'), ...inJsAndTs('other-this', 'export function total(add, context, xs) {\n  return add.apply(context, xs)\n}\n')],
    reportedIn: inJsAndTs('apply-undefined', 'export function total(add, xs) {\n  return add.apply(undefined, xs)\n}\n'),
  },
  {
    rule: 'promise/param-names',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('conventional', 'export const p = new Promise((resolve, reject) => {\n  resolve(1)\n  return reject\n})\n'),
    reportedIn: inJsAndTs('other-names', 'export const p = new Promise((ok, bad) => {\n  ok(1)\n  return bad\n})\n'),
  },
  {
    rule: 'react/jsx-curly-brace-presence',
    engines: BOTH_ENGINES,
    silentIn: inJsxAndTsx('plain', 'export const Row = ({ title }) => (\n  <div className="row" title={title}>\n    text\n  </div>\n)\n'),
    reportedIn: [
      ...inJsxAndTsx('braced-prop', "export const Row = () => <div className={'row'} />\n"),
      ...inJsxAndTsx('braced-child', "export const Row = () => <div>{'text'}</div>\n"),
    ],
  },
  {
    rule: 'unicorn/error-message',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('with-message', "export function f() {\n  throw new Error('broken')\n}\n"),
    reportedIn: inJsAndTs('no-message', 'export function f() {\n  throw new Error()\n}\n'),
  },
  {
    rule: 'unicorn/no-object-as-default-parameter',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('empty-object', 'export function f(options = {}) {\n  return options\n}\n'), ...inJsAndTs('destructured', 'export function f({ deep = true } = {}) {\n  return deep\n}\n')],
    reportedIn: inJsAndTs('object-default', 'export function f(options = { deep: true }) {\n  return options\n}\n'),
  },
  {
    rule: 'unicorn/no-useless-promise-resolve-reject',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('plain-return', 'export async function f() {\n  return 1\n}\n'), ...inJsAndTs('not-async', 'export function f() {\n  return Promise.resolve(1)\n}\n')],
    reportedIn: inJsAndTs('async-resolve', 'export async function f() {\n  return Promise.resolve(1)\n}\n'),
  },
  {
    rule: 'unicorn/prefer-array-flat',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('flat', 'export function flatten(lists) {\n  return lists.flat()\n}\n'),
    reportedIn: [
      ...inJsAndTs('reduce-concat', 'export function flatten(lists) {\n  return lists.reduce((a, b) => a.concat(b), [])\n}\n'),
      ...inJsAndTs('flat-map-identity', 'export function flatten(lists) {\n  return lists.flatMap((list) => list)\n}\n'),
    ],
  },
  {
    rule: 'unicorn/prefer-array-index-of',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('index-of', 'export const i = [1, 2].indexOf(2)\n'), ...inJsAndTs('predicate', 'export const i = [1, 2].findIndex((x) => x > 1)\n')],
    reportedIn: inJsAndTs('find-index-equal', 'export const i = [1, 2].findIndex((x) => x === 2)\n'),
  },
  {
    rule: 'unicorn/prefer-array-some',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('some', 'export const any = [1, 2].some((x) => x > 1)\n'), ...inJsAndTs('filter-used', 'export const big = [1, 2].filter((x) => x > 1)\n')],
    reportedIn: inJsAndTs('filter-length', 'export const any = [1, 2].filter((x) => x > 1).length > 0\n'),
  },
  {
    rule: 'unicorn/prefer-blob-reading-methods',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('text', 'export function read(blob) {\n  return blob.text()\n}\n'),
    reportedIn: inJsAndTs('file-reader', 'export function read(blob) {\n  new FileReader().readAsText(blob)\n}\n'),
  },
  {
    rule: 'unicorn/prefer-code-point',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('code-point-at', "export const c = 'a'.codePointAt(0)\n"),
    reportedIn: [...inJsAndTs('char-code-at', "export const c = 'a'.charCodeAt(0)\n"), ...inJsAndTs('from-char-code', 'export const c = String.fromCharCode(97)\n')],
  },
  {
    rule: 'unicorn/prefer-date-now',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('date-now', 'export const now = Date.now()\n'),
    reportedIn: [...inJsAndTs('get-time', 'export const now = new Date().getTime()\n'), ...inJsAndTs('unary-plus', 'export const now = +new Date()\n')],
  },
  {
    rule: 'unicorn/prefer-default-parameters',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('default-parameter', 'export function f(v = 1) {\n  return v\n}\n'),
    reportedIn: inJsAndTs('or-reassigned', 'export function f(v) {\n  v = v || 1\n  return v\n}\n'),
  },
  {
    rule: 'unicorn/prefer-dom-node-append',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('append', 'export function add(parent, child) {\n  parent.append(child)\n}\n'),
    reportedIn: inJsAndTs('append-child', 'export function add(parent, child) {\n  parent.appendChild(child)\n}\n'),
  },
  {
    rule: 'unicorn/prefer-dom-node-remove',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('remove', 'export function drop(child) {\n  child.remove()\n}\n'),
    reportedIn: inJsAndTs('remove-child', 'export function drop(parent, child) {\n  parent.removeChild(child)\n}\n'),
  },
  {
    rule: 'unicorn/prefer-dom-node-text-content',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('text-content', 'export function text(element) {\n  return element.textContent\n}\n'),
    reportedIn: [...inJsAndTs('inner-text', 'export function text(element) {\n  return element.innerText\n}\n'), ...inJsAndTs('destructured', 'export function text({ innerText }) {\n  return innerText\n}\n')],
  },
  {
    rule: 'unicorn/prefer-export-from',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('export-from', "export { total } from './totals'\n"), ...inJsAndTs('used-here', "import { total } from './totals'\nexport const doubled = total * 2\n")],
    reportedIn: inJsAndTs('import-then-export', "import { total } from './totals'\nexport { total }\n"),
  },
  {
    rule: 'unicorn/prefer-includes',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('includes', 'export const has = [1, 2].includes(2)\n'), ...inJsAndTs('position', 'export const second = [1, 2].indexOf(2) === 1\n')],
    reportedIn: inJsAndTs('index-of-compared', 'export const has = [1, 2].indexOf(2) !== -1\n'),
  },
  // Read from an event a keyboard listener receives.
  {
    rule: 'unicorn/prefer-keyboard-event-key',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('key', "window.addEventListener('keydown', (event) => {\n  if (event.key === 'Enter') console.log('enter')\n})\n"),
    reportedIn: inJsAndTs('key-code', "window.addEventListener('keydown', (event) => {\n  if (event.keyCode === 13) console.log('enter')\n})\n"),
  },
  {
    rule: 'unicorn/prefer-math-trunc',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('trunc', 'export const t = (n) => Math.trunc(n)\n'), ...inJsAndTs('other-bits', 'export const t = (n) => n | 1\n')],
    reportedIn: [...inJsAndTs('or-zero', 'export const t = (n) => n | 0\n'), ...inJsAndTs('double-not', 'export const t = (n) => ~~n\n')],
  },
  {
    rule: 'unicorn/prefer-modern-dom-apis',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('before', 'export function put(child, next) {\n  next.before(child)\n}\n'),
    reportedIn: [
      ...inJsAndTs('insert-before', 'export function put(parent, child, next) {\n  parent.insertBefore(child, next)\n}\n'),
      ...inJsAndTs('replace-child', 'export function swap(parent, child, old) {\n  parent.replaceChild(child, old)\n}\n'),
    ],
  },
  {
    rule: 'unicorn/prefer-modern-math-apis',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('hypot', 'export const h = (a, b) => Math.hypot(a, b)\n'),
    reportedIn: [...inJsAndTs('square-root', 'export const h = (a, b) => Math.sqrt(a * a + b * b)\n'), ...inJsAndTs('log-ten', 'export const digits = (x) => Math.log(x) * Math.LOG10E\n')],
  },
  {
    rule: 'unicorn/prefer-native-coercion-functions',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('passed', 'export const all = [1].map(String)\n'), ...inJsAndTs('more-work', 'export const asText = (v) => String(v).trim()\n')],
    reportedIn: [...inJsAndTs('wrapped', 'export const asText = (v) => String(v)\n'), ...inJsAndTs('wrapped-callback', 'export const all = [1].map((v) => String(v))\n')],
  },
  {
    rule: 'unicorn/prefer-number-properties',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('number-is-nan', 'export const ok = Number.isNaN(1)\n'),
    reportedIn: [...inJsAndTs('global-is-nan', 'export const ok = isNaN(1)\n'), ...inJsAndTs('global-parse-float', "export const n = parseFloat('1.5')\n")],
  },
  {
    rule: 'unicorn/prefer-object-from-entries',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('from-entries', 'export function toObject(pairs) {\n  return Object.fromEntries(pairs)\n}\n'),
    reportedIn: inJsAndTs('reduce-spread', 'export function toObject(pairs) {\n  return pairs.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})\n}\n'),
  },
  {
    rule: 'unicorn/prefer-optional-catch-binding',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inJsAndTs('no-binding', 'export function f(run) {\n  try {\n    return run()\n  } catch {\n    return 0\n  }\n}\n'),
      ...inJsAndTs('used-binding', 'export function f(run) {\n  try {\n    return run()\n  } catch (error) {\n    console.log(error)\n    return 0\n  }\n}\n'),
    ],
    reportedIn: inJsAndTs('unused-binding', 'export function f(run) {\n  try {\n    return run()\n  } catch (error) {\n    return 0\n  }\n}\n'),
  },
  {
    rule: 'unicorn/prefer-query-selector',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('query-selector', "export const el = document.querySelector('#x')\n"),
    reportedIn: [...inJsAndTs('get-element-by-id', "export const el = document.getElementById('x')\n"), ...inJsAndTs('by-class-name', "export const els = document.getElementsByClassName('item')\n")],
  },
  {
    rule: 'unicorn/prefer-regexp-test',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('test', 'export function f(s) {\n  return /a/u.test(s) ? 1 : 0\n}\n'), ...inJsAndTs('match-used', 'export function f(s) {\n  return s.match(/a/u)\n}\n')],
    reportedIn: [
      ...inJsAndTs('exec-in-condition', 'export function f(s) {\n  if (/a/u.exec(s)) {\n    return 1\n  }\n  return 0\n}\n'),
      ...inJsAndTs('match-in-condition', 'export function f(s) {\n  if (s.match(/a/u)) {\n    return 1\n  }\n  return 0\n}\n'),
    ],
  },
  {
    rule: 'unicorn/prefer-string-replace-all',
    engines: BOTH_ENGINES,
    silentIn: [...inJsAndTs('replace-all', "export const s = 'a-b'.replaceAll('-', '_')\n"), ...inJsAndTs('first-only', "export const s = 'a-b'.replace(/-/u, '_')\n")],
    reportedIn: inJsAndTs('global-replace', "export const s = 'a-b'.replace(/-/gu, '_')\n"),
  },
  {
    rule: 'unicorn/prefer-string-slice',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('slice', "export const s = 'abc'.slice(0, 2)\n"),
    reportedIn: [...inJsAndTs('substr', "export const s = 'abc'.substr(0, 2)\n"), ...inJsAndTs('substring', "export const s = 'abc'.substring(0, 2)\n")],
  },
  {
    rule: 'unicorn/prefer-string-trim-start-end',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('trim-end', "export const s = 'a '.trimEnd()\n"),
    reportedIn: [...inJsAndTs('trim-right', "export const s = 'a '.trimRight()\n"), ...inJsAndTs('trim-left', "export const s = ' a'.trimLeft()\n")],
  },
  {
    rule: 'unicorn/prefer-type-error',
    engines: BOTH_ENGINES,
    silentIn: [
      ...inJsAndTs('type-error', "export function f(v) {\n  if (typeof v !== 'string') {\n    throw new TypeError('not a string')\n  }\n  return v\n}\n"),
      ...inJsAndTs('value-check', "export function f(v) {\n  if (v === '') {\n    throw new Error('empty')\n  }\n  return v\n}\n"),
    ],
    reportedIn: inJsAndTs('error-after-type-check', "export function f(v) {\n  if (typeof v !== 'string') {\n    throw new Error('not a string')\n  }\n  return v\n}\n"),
  },
  {
    rule: 'unicorn/throw-new-error',
    engines: BOTH_ENGINES,
    silentIn: inJsAndTs('new-error', "export function f() {\n  throw new Error('broken')\n}\n"),
    reportedIn: inJsAndTs('called-error', "export function f() {\n  throw Error('broken')\n}\n"),
  },
]

export const OXLINT_VERSION_GAPS: readonly RuleCase[] = [
  ...pinnedGap('@typescript-eslint/no-dynamic-delete', 'a key written as a template literal', inTs('template-key', 'export function drop(o: Record<string, number>) {\n  delete o[`k`]\n}\n'), 'eslint'),
  ...pinnedGap('array-callback-return', 'a reduce callback that returns nothing', inJsAndTs('reduce-no-return', 'export const total = [1].reduce((sum, n) => {\n  sum + n\n}, 0)\n'), 'eslint'),
  ...pinnedGap(
    'no-lone-blocks',
    "a scoping block that is a function's only statement",
    inJsAndTs('only-statement', 'export function f() {\n  {\n    const inner = 1\n    return inner\n  }\n}\n'),
    'eslint',
  ),
  ...pinnedGap('react/jsx-curly-brace-presence', 'a braced string prop holding a backslash', inJsxAndTsx('backslash', "export const Row = () => <div title={'a\\\\b'} />\n"), 'oxlint'),
  ...pinnedGap('unicorn/prefer-includes', 'some() comparing each item to a value', inJsAndTs('some-equal', 'export const has = [1, 2].some((x) => x === 2)\n'), 'eslint'),
  ...pinnedGap('unicorn/prefer-keyboard-event-key', 'keyCode read from a parameter typed KeyboardEvent', inTs('typed-parameter', 'export function key(e: KeyboardEvent) {\n  return e.keyCode\n}\n'), 'eslint'),
  ...pinnedGap(
    'unicorn/prefer-string-replace-all',
    'the replace call escaping a string for a RegExp',
    inJsAndTs('regexp-escape', `${REGEXP_ESCAPE_SOURCE}\n`),
    'oxlint',
  ),
  ...pinnedGap(
    'unicorn/prefer-type-error',
    'an Error thrown after an instanceof check',
    inJsAndTs('after-instanceof', "export function f(v) {\n  if (!(v instanceof Map)) {\n    throw new Error('not a map')\n  }\n  return v\n}\n"),
    'eslint',
  ),
]

/**
 * The rules whose versions report and stay silent alike, and whose oxlint version's fix, where check does not withhold
 * the rule's fix, neither leaves code ESLint's would fix nor changes what the code does.
 */
export const MOVED_TO_OXLINT: readonly string[] = [
  '@typescript-eslint/array-type',
  '@typescript-eslint/consistent-type-assertions',
  '@typescript-eslint/consistent-type-definitions',
  '@typescript-eslint/no-empty-object-type',
  '@typescript-eslint/no-invalid-void-type',
  '@typescript-eslint/no-unsafe-function-type',
  '@typescript-eslint/prefer-enum-initializers',
  '@typescript-eslint/prefer-literal-enum-member',
  'default-param-last',
  'max-lines',
  'n/handle-callback-err',
  'no-constructor-return',
  'no-extra-label',
  'no-promise-executor-return',
  'no-return-assign',
  'no-useless-computed-key',
  'object-shorthand',
  'prefer-arrow-callback',
  'prefer-exponentiation-operator',
  'prefer-numeric-literals',
  'prefer-object-spread',
  'prefer-promise-reject-errors',
  'prefer-regex-literals',
  'prefer-spread',
  'promise/param-names',
  'unicorn/error-message',
  'unicorn/no-object-as-default-parameter',
  'unicorn/no-useless-promise-resolve-reject',
  'unicorn/prefer-blob-reading-methods',
  'unicorn/prefer-code-point',
  'unicorn/prefer-math-trunc',
  'unicorn/prefer-modern-dom-apis',
  'unicorn/prefer-optional-catch-binding',
  'unicorn/prefer-query-selector',
  'unicorn/prefer-string-trim-start-end',
  'unicorn/throw-new-error',
]
