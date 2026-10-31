import type { CaseFile } from '../rule-case-runs.ts'
import type { RuleCase } from './changed-settings.ts'

// The shipped unicorn rules ESLint runs, each reporting its fixture and silent on the fixture corrected, with
// the settings the catalog ships. A rule another case list or the ESLint fallback proves is left to it.

type SourceFileType = 'js' | 'ts' | 'tsx'

type Proof = {
  readonly reported: string
  readonly corrected: string
  readonly fileType?: SourceFileType
  /** Files the shipped options leave alone and the rule's defaults report. */
  readonly silentAsShippedIn?: readonly CaseFile[]
}

function reportedAndCorrected(rule: string, { reported, corrected, fileType = 'ts', silentAsShippedIn = [] }: Proof): RuleCase {
  return {
    rule,
    silentIn: [{ path: `src/corrected.${fileType}`, source: corrected }, ...silentAsShippedIn],
    reportedIn: [{ path: `src/reported.${fileType}`, source: reported }],
  }
}

export const PROOF_UNICORN_CASES: readonly RuleCase[] = [
  reportedAndCorrected('unicorn/better-dom-traversing', {
    reported: 'const first = document.body.childNodes[0];\n',
    corrected: 'const first = document.body.firstChild;\n',
  }),
  reportedAndCorrected('unicorn/consistent-compound-words', {
    reported: "const passWord = 'x';\n",
    corrected: "const password = 'x';\n",
  }),
  reportedAndCorrected('unicorn/consistent-conditional-object-spread', {
    reported: 'const a = {...(globalThis.x ? {a: 1} : {})};\n',
    corrected: 'const a = {...(globalThis.x && {a: 1})};\n',
  }),
  reportedAndCorrected('unicorn/consistent-destructuring', {
    reported: 'const object = {a: 1};\nconst {a} = object;\nconsole.log(a + object.a);\n',
    corrected: 'const object = {a: 1};\nconst {a} = object;\nconsole.log(a + a);\n',
  }),
  reportedAndCorrected('unicorn/consistent-export-decorator-position', {
    reported: 'declare const dec: any;\nexport @dec class Foo {}\n',
    corrected: 'declare const dec: any;\n@dec\nexport class Foo {}\n',
  }),
  reportedAndCorrected('unicorn/consistent-function-style', {
    reported: 'export const handle = function handler(value: number) {\n  return value * 2\n}',
    corrected: 'export function handle(value: number) {\n  return value * 2\n}\n',
  }),
  reportedAndCorrected('unicorn/consistent-json-file-read', {
    reported: "import fs from 'node:fs';\nconst data = JSON.parse(fs.readFileSync('a.json'));\n",
    corrected: "import fs from 'node:fs';\nconst data = JSON.parse(fs.readFileSync('a.json', 'utf8'));\n",
  }),
  reportedAndCorrected('unicorn/consistent-optional-chaining', {
    reported: 'declare const foo: {a?: number; b?: number};\nconst x = foo.a && foo?.b;\n',
    corrected: 'declare const foo: {a?: number; b?: number};\nconst x = foo.a && foo.b;\n',
  }),
  reportedAndCorrected('unicorn/consistent-tuple-labels', {
    reported: 'type T = [a: string, number];\n',
    corrected: 'type T = [a: string, b: number];\n',
  }),
  reportedAndCorrected('unicorn/default-export-style', {
    reported: 'function foo() {}\nexport default foo;\n',
    corrected: 'export default function foo() {}\n',
  }),
  reportedAndCorrected('unicorn/isolated-functions', {
    reported: 'declare const page: any;\nconst outside = 1;\npage.evaluate(() => outside);\n',
    corrected: 'declare const page: any;\npage.evaluate(() => {\n\tconst inside = 1;\n\treturn inside;\n});\n',
  }),
  reportedAndCorrected('unicorn/iteration-fallback-style', {
    reported: 'declare const list: number[] | undefined;\nfor (const item of list ?? []) { console.log(item); }\n',
    corrected: 'declare const list: number[] | undefined;\nif (list != null) {\n\tfor (const item of list) { console.log(item); }\n}\n',
  }),
  reportedAndCorrected('unicorn/no-accidental-bitwise-operator', {
    reported: 'const a = 1;\nconst b = a | {};\nconsole.log(b);\n',
    corrected: 'const a = 1;\nconst b = a || {};\nconsole.log(b);\n',
  }),
  reportedAndCorrected('unicorn/no-array-concat-in-loop', {
    reported: 'let all = [];\nfor (const x of [1]) {\n\tall = all.concat(x);\n}\nconsole.log(all);\n',
    corrected: 'const all = [];\nfor (const x of [1]) {\n\tall.push(x);\n}\nconsole.log(all);\n',
  }),
  reportedAndCorrected('unicorn/no-array-from-fill', {
    reported: 'const a = Array.from({length: 3}).fill(0);\nconsole.log(a);\n',
    corrected: 'const a = Array.from({length: 3}, () => 0);\nconsole.log(a);\n',
  }),
  reportedAndCorrected('unicorn/no-array-front-mutation', {
    reported: 'const items = [1];\nitems.unshift(0);\n',
    corrected: 'const items = [1];\nconst withZero = [0, ...items];\n',
  }),
  reportedAndCorrected('unicorn/no-array-sort-for-min-max', {
    reported: 'export function f(xs: number[]): number { return [...xs].sort((a, b) => a - b)[0] }\n',
    corrected: 'export function f(xs: number[]): number { return Math.min(...xs) }\n',
  }),
  reportedAndCorrected('unicorn/no-array-splice', {
    reported: 'export function trimMiddle() {\n\tlet items = [1, 2, 3];\n\titems.splice(1, 2);\n\treturn items.length;\n}\n',
    corrected: 'export function trimMiddle() {\n\tlet items = [1, 2, 3];\n\titems = items.toSpliced(1, 2);\n\treturn items.length;\n}\n',
  }),
  reportedAndCorrected('unicorn/no-async-promise-finally', {
    reported: 'Promise.resolve().finally(async () => {});\n',
    corrected: 'Promise.resolve().finally(() => {});\n',
  }),
  reportedAndCorrected('unicorn/no-boolean-sort-comparator', {
    reported: 'const sorted = [2, 1].sort((a, b) => a > b);\nconsole.log(sorted);\n',
    corrected: 'const sorted = [2, 1].sort((a, b) => a - b);\nconsole.log(sorted);\n',
  }),
  reportedAndCorrected('unicorn/no-break-in-nested-loop', {
    reported: 'for (const a of [1]) {\n\tfor (const b of [2]) {\n\t\tbreak;\n\t}\n}\n',
    corrected: 'function hasTwo(values) {\n\tfor (const b of values) {\n\t\tif (b === 2) return true;\n\t}\n\treturn false;\n}\nfor (const a of [1]) {\n\tconsole.log(a, hasTwo([2]));\n}\n',
  }),
  reportedAndCorrected('unicorn/no-canvas-to-image', {
    reported: 'ctx.putImageData(other.getImageData(0, 0, 1, 1), 0, 0);\n',
    corrected: 'ctx.drawImage(other.canvas, 0, 0);\n',
  }),
  reportedAndCorrected('unicorn/no-collection-bracket-access', {
    reported: "const map = new Map();\nconsole.log(map['a']);\n",
    corrected: "const map = new Map();\nconsole.log(map.get('a'));\n",
  }),
  reportedAndCorrected('unicorn/no-computed-property-existence-check', {
    reported: 'export function has(object: object, key: string) {\n\treturn key in object;\n}\n',
    corrected: 'export function has(object: object, key: string) {\n\treturn Object.hasOwn(object, key);\n}\n',
  }),
  reportedAndCorrected('unicorn/no-confusing-array-splice', {
    reported: 'const items = [1, 2];\nitems.splice(0, 1, 9);\n',
    corrected: 'const items = [1, 2];\nitems[0] = 9;\n',
  }),
  reportedAndCorrected('unicorn/no-declarations-before-early-exit', {
    reported: 'export function f(a: number) {\n\tconst b = 1;\n\tif (a > 0) {\n\t\treturn 0;\n\t}\n\treturn b;\n}\n',
    corrected: 'export function f(a: number) {\n\tif (a > 0) {\n\t\treturn 0;\n\t}\n\tconst b = 1;\n\treturn b;\n}\n',
  }),
  reportedAndCorrected('unicorn/no-duplicate-loops', {
    reported: 'for (const x of [1, 2].map(y => y * 2)) {\n\tconsole.log(x);\n}\n',
    corrected: 'for (const y of [1, 2]) {\n\tconsole.log(y * 2);\n}\n',
  }),
  reportedAndCorrected('unicorn/no-duplicate-set-values', {
    reported: 'const s = new Set([1, 1]);\nconsole.log(s);\n',
    corrected: 'const s = new Set([1, 2]);\nconsole.log(s);\n',
  }),
  reportedAndCorrected('unicorn/no-error-property-assignment', {
    reported: "const error = new Error('x');\nerror.name = 'Custom';\n",
    corrected: "class CustomError extends Error {\n\toverride name = 'Custom';\n}\nconst error = new CustomError('x');\n",
  }),
  reportedAndCorrected('unicorn/no-exports-in-scripts', {
    reported: '#!/usr/bin/env node\nexport const a = 1;\n',
    corrected: '#!/usr/bin/env node\nconsole.log(1);\n',
    fileType: 'js',
  }),
  reportedAndCorrected('unicorn/no-for-loop', {
    reported: 'const items = [1, 2];\nfor (let i = 0; i < items.length; i++) {\n\tconsole.log(items[i]);\n}\n',
    corrected: 'const items = [1, 2];\nfor (const item of items) {\n\tconsole.log(item);\n}\n',
  }),
  reportedAndCorrected('unicorn/no-global-object-property-assignment', {
    reported: 'globalThis.foo = 1;\n',
    corrected: 'export const foo = 1;\n',
  }),
  reportedAndCorrected('unicorn/no-impossible-length-comparison', {
    reported: 'const items = [1];\nif (items.length < 0) {\n\tconsole.log(1);\n}\n',
    corrected: 'const items = [1];\nif (items.length === 0) {\n\tconsole.log(1);\n}\n',
  }),
  reportedAndCorrected('unicorn/no-incorrect-query-selector', {
    reported: "document.querySelectorAll('#foo');\n",
    corrected: "document.querySelector('#foo');\n",
  }),
  reportedAndCorrected('unicorn/no-invalid-argument-count', {
    reported: 'Array.isArray();\n',
    corrected: 'Array.isArray([]);\n',
  }),
  reportedAndCorrected('unicorn/no-invalid-file-input-accept', {
    reported: 'const a = <input type="file" accept="image/jpg" />;\n',
    corrected: 'const a = <input type="file" accept="image/jpeg" />;\n',
    fileType: 'tsx',
  }),
  reportedAndCorrected('unicorn/no-invalid-well-known-symbol-methods', {
    reported: 'const o = {async [Symbol.dispose]() {}};\n',
    corrected: 'const o = {async [Symbol.asyncDispose]() {}};\n',
  }),
  reportedAndCorrected('unicorn/no-keyword-prefix', {
    reported: 'const newValue = 1;\n',
    corrected: 'const value = 1;\n',
    silentAsShippedIn: [
      { path: 'src/property.ts', source: 'export const options = {newValue: 1};\n' },
    ],
  }),
  reportedAndCorrected('unicorn/no-late-current-target-access', {
    reported: 'async function onClick(event) {\n\tawait Promise.resolve();\n\tglobalThis.console.log(event.currentTarget);\n}\n',
    corrected: 'async function onClick(event) {\n\tconst target = event.currentTarget;\n\tawait Promise.resolve();\n\tglobalThis.console.log(target);\n}\n',
  }),
  reportedAndCorrected('unicorn/no-late-event-control', {
    reported: 'async function onClick(event) {\n\tawait Promise.resolve();\n\tevent.preventDefault();\n}\n',
    corrected: 'async function onClick(event) {\n\tevent.preventDefault();\n\tawait Promise.resolve();\n}\n',
  }),
  reportedAndCorrected('unicorn/no-loop-iterable-mutation', {
    reported: 'const items = [1];\nfor (const item of items) {\n\titems.push(item);\n}\n',
    corrected: 'const items = [1];\nconst copies = [];\nfor (const item of items) {\n\tcopies.push(item);\n}\n',
  }),
  reportedAndCorrected('unicorn/no-mismatched-map-key', {
    reported: "const map = new Map();\nif (map.has('a')) {\n\tglobalThis.console.log(map.get('b'));\n}\n",
    corrected: "const map = new Map();\nif (map.has('a')) {\n\tglobalThis.console.log(map.get('a'));\n}\n",
  }),
  reportedAndCorrected('unicorn/no-multiple-promise-resolver-calls', {
    reported: 'const p = new Promise((resolve) => {\n\tresolve(1);\n\tresolve(2);\n});\n',
    corrected: 'const p = new Promise((resolve) => {\n\tresolve(1);\n});\n',
  }),
  reportedAndCorrected('unicorn/no-negated-array-predicate', {
    reported: 'const bad = ![1, 2].every((n) => n > 0);\n',
    corrected: 'const bad = [1, 2].some((n) => !(n > 0));\n',
  }),
  reportedAndCorrected('unicorn/no-negated-comparison', {
    reported: 'declare const a: number;\ndeclare const b: number;\nif (!(a === b)) {\n\tglobalThis.console.log(1);\n}\n',
    corrected: 'declare const a: number;\ndeclare const b: number;\nif (a !== b) {\n\tglobalThis.console.log(1);\n}\n',
  }),
  reportedAndCorrected('unicorn/no-non-function-verb-prefix', {
    reported: "export const getName = 'hello';\n",
    corrected: "export function getName() {\n  return 'hello'\n}\n",
  }),
  reportedAndCorrected('unicorn/no-object-methods-with-collections', {
    reported: 'const keys = Object.keys(new Map());\n',
    corrected: 'const keys = Array.from(new Map().keys());\n',
  }),
  reportedAndCorrected('unicorn/no-optional-chaining-on-undeclared-variable', {
    reported: 'const value = someUndeclaredThing?.property;\n',
    corrected: 'declare const someDeclaredThing: {property: number} | undefined;\nconst value = someDeclaredThing?.property;\n',
  }),
  reportedAndCorrected('unicorn/no-redundant-comparison', {
    reported: 'declare const a: number;\ndeclare const b: number;\nif (a === b && a > 0 && b > 0) {\n\tglobalThis.console.log(1);\n}\n',
    corrected: 'declare const a: number;\ndeclare const b: number;\nif (a === b && a > 0) {\n\tglobalThis.console.log(1);\n}\n',
  }),
  reportedAndCorrected('unicorn/no-return-array-push', {
    reported: 'const list: number[] = [];\nconst length = list.push(1);\n',
    corrected: 'const list: number[] = [];\nlist.push(1);\nconst length = list.length;\n',
  }),
  reportedAndCorrected('unicorn/no-selector-as-dom-name', {
    reported: "const el = document.getElementById('#main');\n",
    corrected: "const el = document.getElementById('main');\n",
  }),
  reportedAndCorrected('unicorn/no-subtraction-comparison', {
    reported: 'declare const a: number;\ndeclare const b: number;\nif (a - b > 0) {\n\tglobalThis.console.log(1);\n}\n',
    corrected: 'declare const a: number;\ndeclare const b: number;\nif (a > b) {\n\tglobalThis.console.log(1);\n}\n',
  }),
  reportedAndCorrected('unicorn/no-top-level-assignment-in-function', {
    reported: 'let count = 0;\nfunction bump() {\n\tcount = 1;\n}\n',
    corrected: 'function bump(count: number) {\n\treturn count + 1;\n}\n',
  }),
  reportedAndCorrected('unicorn/no-transition-all', {
    reported: "export function fade(node: HTMLElement) {\n  node.style.transition = 'all 0.3s ease'\n}",
    corrected: "export function fade(node: HTMLElement) {\n  node.style.transition = 'opacity 0.3s ease'\n}\n",
  }),
  reportedAndCorrected('unicorn/no-uncalled-method', {
    reported: 'const joined = [1, 2].join;\n',
    corrected: "const joined = [1, 2].join(',');\n",
  }),
  reportedAndCorrected('unicorn/no-undeclared-class-members', {
    reported: 'class Foo {\n\tbar() { this.baz = 1; }\n}\n',
    corrected: 'class Foo {\n\tbaz;\n\tbar() { this.baz = 1; }\n}\n',
  }),
  reportedAndCorrected('unicorn/no-unnecessary-array-flat-map', {
    reported: 'const result = array.flatMap(item => [item]);\n',
    corrected: 'const result = array.map(item => item);\n',
  }),
  reportedAndCorrected('unicorn/no-unnecessary-boolean-comparison', {
    reported: 'if ((a > b) === true) { bar(); }\n',
    corrected: 'if (a > b) { bar(); }\n',
  }),
  reportedAndCorrected('unicorn/no-unnecessary-fetch-options', {
    reported: "await fetch('/x', {method: 'GET'});\n",
    corrected: "await fetch('/x');\n",
  }),
  reportedAndCorrected('unicorn/no-unnecessary-global-this', {
    reported: "globalThis.JSON.parse('1');\n",
    corrected: "JSON.parse('1');\n",
  }),
  reportedAndCorrected('unicorn/no-unnecessary-nested-ternary', {
    reported: 'const value = a ? (b ? c : d) : d;\n',
    corrected: 'const value = a && b ? c : d;\n',
  }),
  // Reported against the fixtures' manifest, whose engines name a Node that has Object.assign.
  reportedAndCorrected('unicorn/no-unnecessary-polyfills', {
    reported: "import assign from 'object.assign';\n",
    corrected: 'const merged = Object.assign({}, {a: 1});\n',
  }),
  reportedAndCorrected('unicorn/no-unnecessary-string-trim', {
    reported: "string.trim().startsWith('a');\n",
    corrected: "string.trimStart().startsWith('a');\n",
  }),
  reportedAndCorrected('unicorn/no-unreadable-for-of-expression', {
    reported: 'for (const item of a ? b : c) { use(item); }\n',
    corrected: 'const items = a ? b : c;\nfor (const item of items) { use(item); }\n',
  }),
  reportedAndCorrected('unicorn/no-unreadable-object-destructuring', {
    reported: 'const {a: {b: {c}}} = object;\n',
    corrected: 'const {a: {b}} = object;\nconst {c} = b;\n',
  }),
  reportedAndCorrected('unicorn/no-unsafe-buffer-conversion', {
    reported: 'const view = new Uint8Array(8).subarray(2);\nconst copy = new Uint8Array(view.buffer);\n',
    corrected: 'const view = new Uint8Array(8).subarray(2);\nconst copy = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);\n',
  }),
  reportedAndCorrected('unicorn/no-unsafe-dom-html', {
    reported: 'element.innerHTML = userInput;\n',
    corrected: 'element.textContent = userInput;\n',
  }),
  reportedAndCorrected('unicorn/no-unsafe-promise-all-settled-values', {
    reported: 'const results = await Promise.allSettled([task()]);\nconst values = results.map(result => result.value);\n',
    corrected: "const results = await Promise.allSettled([task()]);\nconst values = results.filter(result => result.status === 'fulfilled').map(result => result.value);\n",
  }),
  reportedAndCorrected('unicorn/no-unsafe-property-key', {
    reported: 'object[Math] = 1;\n',
    corrected: 'object.math = 1;\n',
  }),
  reportedAndCorrected('unicorn/no-unsafe-sqlite-interpolation', {
    reported: "import {DatabaseSync} from 'node:sqlite';\nnew DatabaseSync(':memory:').prepare(`SELECT * FROM t WHERE id = ${id}`);\n",
    corrected: "import {DatabaseSync} from 'node:sqlite';\nnew DatabaseSync(':memory:').prepare('SELECT * FROM t WHERE id = ?').get(id);\n",
  }),
  reportedAndCorrected('unicorn/no-unused-properties', {
    reported: 'const config = {used: 1, unused: 2};\nconsole.log(config.used);\n',
    corrected: 'const config = {used: 1};\nconsole.log(config.used);\n',
  }),
  reportedAndCorrected('unicorn/no-useless-boolean-cast', {
    reported: 'array.filter(item => Boolean(item.flag));\n',
    corrected: 'array.filter(item => item.flag);\n',
  }),
  reportedAndCorrected('unicorn/no-useless-coercion', {
    reported: "String('already a string');\n",
    corrected: "const text = 'already a string';\n",
  }),
  reportedAndCorrected('unicorn/no-useless-compound-assignment', {
    reported: 'count += 0;\n',
    corrected: 'let total = 1;\ntotal += 1;\nconsole.log(total);\n',
  }),
  reportedAndCorrected('unicorn/no-useless-continue', {
    reported: 'for (const item of array) { use(item); continue; }\n',
    corrected: 'for (const item of array) { use(item); }\n',
  }),
  reportedAndCorrected('unicorn/no-useless-delete-check', {
    reported: "const object = {key: 1};\nif ('key' in object) { delete object.key; }\n",
    corrected: 'const object = {key: 1};\ndelete object.key;\n',
  }),
  reportedAndCorrected('unicorn/no-useless-else', {
    reported: 'function f() { if (a) { return 1; } else { return 2; } }\n',
    corrected: 'function f() { if (a) { return 1; } return 2; }\n',
  }),
  reportedAndCorrected('unicorn/no-useless-logical-operand', {
    reported: 'if (foo && true) { bar(); }\n',
    corrected: 'if (foo) { bar(); }\n',
  }),
  reportedAndCorrected('unicorn/no-useless-override', {
    reported: 'class Child extends Parent {\n\trun(a) { return super.run(a); }\n}\n',
    corrected: 'class Child extends Parent {}\n',
  }),
  reportedAndCorrected('unicorn/no-useless-re-export', {
    reported: "export * from './a';\nexport {b} from './a';\n",
    corrected: "export * from './a';\n",
  }),
  reportedAndCorrected('unicorn/no-useless-template-literals', {
    reported: "const a = `${'foo'}`;\n",
    corrected: "const a = 'foo';\n",
  }),
  reportedAndCorrected('unicorn/no-xor-as-exponentiation', {
    reported: 'const a = 2 ^ 8;\n',
    corrected: 'const a = 2 ** 8;\n',
  }),
  reportedAndCorrected('unicorn/prefer-abort-signal-any', {
    reported: "const controller = new AbortController();\nAbortSignal.timeout(1).addEventListener('abort', () => controller.abort());\nAbortSignal.timeout(2).addEventListener('abort', () => controller.abort());\nfetch('/x', {signal: controller.signal});\n",
    corrected: "const signal = AbortSignal.any([AbortSignal.timeout(1), AbortSignal.timeout(2)]);\nfetch('/x', {signal: signal});\n",
  }),
  reportedAndCorrected('unicorn/prefer-abort-signal-timeout', {
    reported: "const controller = new AbortController();\nsetTimeout(() => controller.abort(), 100);\nfetch('/x', {signal: controller.signal});\n",
    corrected: "const signal = AbortSignal.timeout(100);\nfetch('/x', {signal: signal});\n",
  }),
  reportedAndCorrected('unicorn/prefer-add-event-listener-options', {
    reported: "declare const el: EventTarget;\nel.addEventListener('click', () => {}, true);\n",
    corrected: "declare const el: EventTarget;\nel.addEventListener('click', () => {}, {capture: true});\n",
  }),
  reportedAndCorrected('unicorn/prefer-aggregate-error', {
    reported: "const errors: Error[] = [];\nif (errors.length > 0) {\n\tthrow new Error('failed');\n}\n",
    corrected: "const errors: Error[] = [];\nif (errors.length > 0) {\n\tthrow new AggregateError(errors, 'failed');\n}\n",
  }),
  reportedAndCorrected('unicorn/prefer-array-from-async', {
    reported: 'async function f(source: AsyncIterable<number>) {\n\tconst result = [];\n\tfor await (const item of source) {\n\t\tresult.push(item);\n\t}\n\treturn result;\n}\n',
    corrected: 'async function f(source: AsyncIterable<number>) {\n\tconst result = await Array.fromAsync(source);\n\treturn result;\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-array-from-map', {
    reported: 'declare const set: Set<number>;\nconst a = Array.from(set).map(x => x * 2);\n',
    corrected: 'declare const set: Set<number>;\nconst a = Array.from(set, x => x * 2);\n',
  }),
  reportedAndCorrected('unicorn/prefer-array-from-range', {
    reported: 'const a = [...Array(5).keys()];\n',
    corrected: 'const a = Array.from({length: 5}, (_, index) => index);\n',
  }),
  reportedAndCorrected('unicorn/prefer-array-iterable-methods', {
    reported: 'declare const array: number[];\nfor (const [, value] of array.entries()) {\n\tconsole.log(value);\n}\n',
    corrected: 'declare const array: number[];\nfor (const value of array) {\n\tconsole.log(value);\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-array-last-methods', {
    reported: 'declare const array: number[];\nconst a = array.toReversed().find(x => x > 1);\n',
    corrected: 'declare const array: number[];\nconst a = array.findLast(x => x > 1);\n',
  }),
  reportedAndCorrected('unicorn/prefer-array-slice', {
    reported: 'declare const array: number[];\nconst a = array.splice(1)[0];\n',
    corrected: 'declare const array: number[];\nconst a = array.slice(1)[0];\n',
  }),
  reportedAndCorrected('unicorn/prefer-block-statement-over-iife', {
    reported: '(() => {\n\tconst a = 1;\n\tconsole.log(a);\n})();\n',
    corrected: '{\n\tconst a = 1;\n\tconsole.log(a);\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-boolean-return', {
    reported: 'function f(a: number) {\n\tif (a > 1) {\n\t\treturn true;\n\t}\n\n\treturn false;\n}\n',
    corrected: 'function f(a: number) {\n\treturn a > 1;\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-continue', {
    reported: 'for (const a of [1, 2]) {\n\tif (a > 1) {\n\t\tconsole.log(a);\n\t\tconsole.log(a + 1);\n\t}\n}\n',
    corrected: 'for (const a of [1, 2]) {\n\tif (!(a > 1)) {\n\t\tcontinue;\n\t}\n\n\tconsole.log(a);\n\tconsole.log(a + 1);\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-direct-iteration', {
    reported: 'const set = new Set([1]);\nfor (const a of set.values()) {\n\tconsole.log(a);\n}\n',
    corrected: 'const set = new Set([1]);\nfor (const a of set) {\n\tconsole.log(a);\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-dispose', {
    reported: 'const resource = {close() {}};\ntry {\n\tconsole.log(resource);\n} finally {\n\tresource.close();\n}\n',
    corrected: '{\n\tusing resource = {close() {}};\n\n\tconsole.log(resource);\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-dom-node-html-methods', {
    reported: 'declare const element: Element;\nconst html = element.innerHTML;\n',
    corrected: 'declare const element: Element;\nconst html = element.getHTML();\n',
  }),
  reportedAndCorrected('unicorn/prefer-dom-node-replace-children', {
    reported: 'declare const element: Element;\nwhile (element.firstChild) {\n\telement.removeChild(element.firstChild);\n}\n',
    corrected: 'declare const element: Element;\nelement.replaceChildren();\n',
  }),
  reportedAndCorrected('unicorn/prefer-early-return', {
    reported: 'function f(a: number) {\n\tif (a > 1) {\n\t\tconsole.log(a);\n\t\tconsole.log(a + 1);\n\t}\n}\n',
    corrected: 'function f(a: number) {\n\tif (!(a > 1)) {\n\t\treturn;\n\t}\n\n\tconsole.log(a);\n\tconsole.log(a + 1);\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-else-if', {
    reported: 'declare const a: number;\nif (a === 1) {\n\tconsole.log(1);\n}\n\nif (a === 2) {\n\tconsole.log(2);\n}\n',
    corrected: 'declare const a: number;\nif (a === 1) {\n\tconsole.log(1);\n} else if (a === 2) {\n\tconsole.log(2);\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-error-is-error', {
    reported: 'declare const value: unknown;\nconst a = value instanceof Error;\n',
    corrected: 'declare const value: unknown;\nconst a = Error.isError(value);\n',
  }),
  reportedAndCorrected('unicorn/prefer-flat-math-min-max', {
    reported: 'const a = Math.min(1, Math.min(2, 3));\n',
    corrected: 'const a = Math.min(1, 2, 3);\n',
  }),
  reportedAndCorrected('unicorn/prefer-get-or-insert-computed', {
    reported: "declare const map: Map<string, number>;\nconst a = map.getOrInsert('k', Date.now());\n",
    corrected: "declare const map: Map<string, number>;\nconst a = map.getOrInsertComputed('k', () => Date.now());\n",
  }),
  reportedAndCorrected('unicorn/prefer-global-number-constants', {
    reported: 'const a = Number.POSITIVE_INFINITY;\n',
    corrected: 'const a = Infinity;\n',
  }),
  reportedAndCorrected('unicorn/prefer-group-by', {
    reported: 'declare const array: string[];\nconst a = array.reduce<Record<string, string[]>>((groups, item) => {\n\t(groups[item] ??= []).push(item);\n\treturn groups;\n}, {});\n',
    corrected: 'declare const array: string[];\nconst a = Object.groupBy(array, (item) => item);\n',
  }),
  reportedAndCorrected('unicorn/prefer-has-check', {
    reported: "const map = new Map<string, number>()\nif (map.get('a') !== undefined) { console.log(1) }\n",
    corrected: "const map = new Map<string, number>()\nif (map.has('a')) { console.log(1) }\n",
  }),
  reportedAndCorrected('unicorn/prefer-hoisting-branch-code', {
    reported: "function run(flag: boolean) {\n  if (flag) { console.log('x'); console.log('a') } else { console.log('x'); console.log('b') }\n}\n",
    corrected: "function run(flag: boolean) {\n  console.log('x');\n  if (flag) { console.log('a') } else { console.log('b') }\n}\n",
  }),
  reportedAndCorrected('unicorn/prefer-https', {
    // eslint-disable-next-line unicorn/prefer-https -- the source is the http URL the rule must report
    reported: "export const url = 'http://example.com/a'\n",
    corrected: "export const url = 'https://example.com/a'\n",
  }),
  reportedAndCorrected('unicorn/prefer-identifier-import-export-specifiers', {
    reported: "import { 'foo' as foo } from './other.js'\nconsole.log(foo)\n",
    corrected: "import { foo } from './other.js'\nconsole.log(foo)\n",
  }),
  reportedAndCorrected('unicorn/prefer-includes-over-repeated-comparisons', {
    reported: "const check = (x: string) => x === 'a' || x === 'b' || x === 'c'\n",
    corrected: "const check = (x: string) => ['a', 'b', 'c'].includes(x)\n",
  }),
  reportedAndCorrected('unicorn/prefer-iterable-in-constructor', {
    reported: 'declare const values: number[]\nconst set = new Set()\nfor (const value of values) { set.add(value) }\n',
    corrected: 'declare const values: number[]\nconst set = new Set(values)\n',
  }),
  reportedAndCorrected('unicorn/prefer-iterator-concat', {
    reported: 'const a = new Map()\nconst b = new Map()\nconst all = Array.from([...a.keys(), ...b.keys()])\n',
    corrected: 'const a = new Map()\nconst b = new Map()\nconst all = Array.from(Iterator.concat(a.keys(), b.keys()))\n',
  }),
  reportedAndCorrected('unicorn/prefer-iterator-helpers', {
    reported: "const map = new Map()\nconst found = [...map.keys()].find(key => key === 'a')\n",
    corrected: "const map = new Map()\nconst found = map.keys().find(key => key === 'a')\n",
  }),
  reportedAndCorrected('unicorn/prefer-iterator-to-array', {
    reported: 'const map = new Map()\nconst keys = [...map.keys()]\n',
    corrected: 'const map = new Map()\nconst keys = map.keys().toArray()\n',
  }),
  reportedAndCorrected('unicorn/prefer-iterator-to-array-at-end', {
    reported: 'const map = new Map()\nconst keys = map.keys().toArray().map(key => key)\n',
    corrected: 'const map = new Map()\nconst keys = map.keys().map(key => key).toArray()\n',
  }),
  // The gate has no fixture for it: a shape from the rule's description.
  reportedAndCorrected('unicorn/prefer-iterator-zip', {
    reported: 'declare const names: string[]\ndeclare const ages: number[]\nfor (let index = 0; index < Math.min(names.length, ages.length); index++) {\n\tconsole.log(names[index], ages[index])\n}\n',
    corrected: 'declare const names: string[]\ndeclare const ages: number[]\nfor (const [name, age] of Iterator.zip([names, ages])) {\n\tconsole.log(name, age)\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-location-assign', {
    reported: "location.href = 'https://example.com'\n",
    corrected: "location.assign('https://example.com')\n",
  }),
  reportedAndCorrected('unicorn/prefer-map-from-entries', {
    reported: 'const object = { a: 1 }\nconst lookup = Object.fromEntries(Object.entries(object))\nconsole.log(lookup.a)\n',
    corrected: "const object = { a: 1 }\nconst lookup = new Map(Object.entries(object))\nconsole.log(lookup.get('a'))\n",
  }),
  reportedAndCorrected('unicorn/prefer-math-abs', {
    reported: 'const absolute = (x: number) => x < 0 ? -x : x\n',
    corrected: 'const absolute = (x: number) => Math.abs(x)\n',
  }),
  reportedAndCorrected('unicorn/prefer-math-constants', {
    reported: 'const pi = 3.141592653589793\n',
    corrected: 'const pi = Math.PI\n',
  }),
  reportedAndCorrected('unicorn/prefer-minimal-ternary', {
    reported: 'declare function foo(n: number): void\nconst run = (test: boolean) => test ? foo(1) : foo(2)\n',
    corrected: 'declare function foo(n: number): void\nconst run = (test: boolean) => foo(test ? 1 : 2)\n',
  }),
  reportedAndCorrected('unicorn/prefer-number-is-safe-integer', {
    reported: 'const check = (x: number) => Number.isInteger(x)\n',
    corrected: 'const check = (x: number) => Number.isSafeInteger(x)\n',
  }),
  reportedAndCorrected('unicorn/prefer-object-define-properties', {
    reported: "const target = {}\nObject.defineProperty(target, 'a', { value: 1 })\nObject.defineProperty(target, 'b', { value: 2 })\n",
    corrected: 'const target = {}\nObject.defineProperties(target, {\n\ta: { value: 1 },\n\tb: { value: 2 },\n});\n',
  }),
  reportedAndCorrected('unicorn/prefer-object-destructuring-defaults', {
    reported: 'const run = (options = {}) => {\n  const { a, b } = { a: 1, b: 2, ...options }\n  console.log(a, b)\n}\n',
    corrected: 'const run = (options = {}) => {\n  const {a = 1, b = 2} = options\n  console.log(a, b)\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-object-iterable-methods', {
    reported: 'const object = { a: 1 }\nfor (const [key] of Object.entries(object)) console.log(key)\n',
    corrected: 'const object = { a: 1 }\nfor (const key of Object.keys(object)) console.log(key)\n',
  }),
  reportedAndCorrected('unicorn/prefer-observer-apis', {
    reported: "window.addEventListener('resize', () => { console.log(document.body.offsetWidth) })\n",
    corrected: 'new ResizeObserver(() => { console.log(document.body.offsetWidth) }).observe(document.body)\n',
  }),
  reportedAndCorrected('unicorn/prefer-path2d', {
    reported: 'declare const context: CanvasRenderingContext2D\nfor (const point of [1, 2]) { context.beginPath(); context.moveTo(point, 0); context.lineTo(0, point); context.stroke() }\n',
    corrected: 'declare const context: CanvasRenderingContext2D\nconst path = new Path2D()\npath.moveTo(1, 0)\npath.lineTo(0, 1)\nfor (const point of [1, 2]) { context.translate(point, 0); context.stroke(path) }\n',
  }),
  reportedAndCorrected('unicorn/prefer-private-class-fields', {
    reported: 'class Store { _value = 1 }\n',
    corrected: 'class Store { #value = 1 }\n',
  }),
  reportedAndCorrected('unicorn/prefer-promise-try', {
    reported: 'declare function work(): number\nconst result = Promise.resolve().then(() => work())\n',
    corrected: 'declare function work(): number\nconst result = Promise.try(() => work())\n',
  }),
  reportedAndCorrected('unicorn/prefer-promise-with-resolvers', {
    reported: 'let resolve: (value: number) => void\nconst promise = new Promise<number>(r => { resolve = r })\n',
    corrected: 'const {promise, resolve} = Promise.withResolvers<number>()\n',
  }),
  reportedAndCorrected('unicorn/prefer-queue-microtask', {
    reported: 'process.nextTick(() => { console.log(1) })\n',
    corrected: 'queueMicrotask(() => { console.log(1) })\n',
  }),
  reportedAndCorrected('unicorn/prefer-regexp-escape', {
    reported: "const escape = (input: string) => input.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')\n",
    corrected: 'const escape = (input: string) => RegExp.escape(input)\n',
  }),
  reportedAndCorrected('unicorn/prefer-scoped-selector', {
    reported: "declare const element: Element\nconst found = element.querySelectorAll('div > span')\n",
    corrected: "declare const element: Element\nconst found = element.querySelectorAll(':scope div > span')\n",
  }),
  reportedAndCorrected('unicorn/prefer-set-methods', {
    reported: 'const a = new Set([1])\nconst b = new Set([2])\nconst union = new Set([...a, ...b])\n',
    corrected: 'const a = new Set([1])\nconst b = new Set([2])\nconst union = a.union(b)\n',
  }),
  reportedAndCorrected('unicorn/prefer-simple-condition-first', {
    reported: "declare const list: string[]\ndeclare const ready: boolean\nif (list.includes('a') && ready) {\n\tconsole.log(1)\n}\n",
    corrected: "declare const list: string[]\ndeclare const ready: boolean\nif (ready && list.includes('a')) {\n\tconsole.log(1)\n}\n",
  }),
  reportedAndCorrected('unicorn/prefer-simple-sort-comparator', {
    reported: 'export const sorted = [3, 1].sort((a, b) => (a < b ? -1 : 1))\n',
    corrected: 'export const sorted = [3, 1].sort((a, b) => a - b)\n',
  }),
  reportedAndCorrected('unicorn/prefer-simplified-conditions', {
    reported: 'declare const a: boolean\ndeclare const b: boolean\ndeclare const c: boolean\nif ((a && b) || (a && c)) {\n\tconsole.log(1)\n}\n',
    corrected: 'declare const a: boolean\ndeclare const b: boolean\ndeclare const c: boolean\nif (a && (b || c)) {\n\tconsole.log(1)\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-single-array-predicate', {
    reported: 'declare const list: number[]\nexport const x = list.some(n => n > 1) || list.some(n => n < 0)\n',
    corrected: 'declare const list: number[]\nexport const x = list.some(n => n > 1 || n < 0)\n',
  }),
  reportedAndCorrected('unicorn/prefer-single-object-destructuring', {
    reported: 'const source = {a: 1, b: 2}\nconst {a} = source\nconst {b} = source\nexport const total = a + b\n',
    corrected: 'const source = {a: 1, b: 2}\nconst {a, b} = source;\nexport const total = a + b\n',
  }),
  reportedAndCorrected('unicorn/prefer-smaller-scope', {
    reported: 'let value\nif (globalThis.isTrusted) {\n\tvalue = 1\n\tconsole.log(value)\n}\n',
    corrected: 'if (globalThis.isTrusted) {\n\tconst value = 1\n\tconsole.log(value)\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-split-limit', {
    reported: "declare const text: string\nexport const first = text.split(',')[0]\n",
    corrected: "declare const text: string\nexport const first = text.split(',', 1)[0]\n",
  }),
  reportedAndCorrected('unicorn/prefer-string-match-all', {
    reported: "const text = 'aaa'\nconst re = /a/g\nlet match\nwhile ((match = re.exec(text)) !== null) {\n\tconsole.log(match)\n}\n",
    corrected: "const text = 'aaa'\nconst re = /a/g\nfor (const match of text.matchAll(re)) {\n\tconsole.log(match)\n}\n",
  }),
  reportedAndCorrected('unicorn/prefer-string-pad-start-end', {
    reported: "declare const text: string\nexport const padded = ' '.repeat(5 - text.length) + text\n",
    corrected: 'declare const text: string\nexport const padded = text.padStart(5)\n',
  }),
  reportedAndCorrected('unicorn/prefer-string-repeat', {
    reported: "export const gap = '    '\n",
    corrected: "export const gap = ' '.repeat(4)\n",
  }),
  reportedAndCorrected('unicorn/prefer-switch', {
    reported: 'declare const value: number\nif (value === 1) {\n\tconsole.log(1)\n} else if (value === 2) {\n\tconsole.log(2)\n} else if (value === 3) {\n\tconsole.log(3)\n}\n',
    corrected: 'declare const value: number\nswitch (value) {\n\tcase 1: {\n\t\tconsole.log(1)\n\t\tbreak\n\t}\n\tcase 2: {\n\t\tconsole.log(2)\n\t\tbreak\n\t}\n\tcase 3: {\n\t\tconsole.log(3)\n\t\tbreak\n\t}\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-temporal', {
    reported: 'export const now = new Date()\n',
    corrected: 'export const now = Temporal.Now.instant()\n',
  }),
  reportedAndCorrected('unicorn/prefer-toggle-attribute', {
    reported: "declare const element: Element\ndeclare const flag: boolean\nif (flag) {\n\telement.setAttribute('hidden', '')\n} else {\n\telement.removeAttribute('hidden')\n}\n",
    corrected: "declare const element: Element\ndeclare const flag: boolean\nelement.toggleAttribute('hidden', flag);\n",
  }),
  reportedAndCorrected('unicorn/prefer-uint8array-base64', {
    reported: "declare const text: string\nexport const bytes = Buffer.from(text, 'base64')\n",
    corrected: 'declare const text: string\nexport const bytes = Uint8Array.fromBase64(text)\n',
  }),
  // The gate has no fixture for it: a shape from the rule's description.
  reportedAndCorrected('unicorn/prefer-uint8array-hex', {
    reported: "declare const bytes: Uint8Array\nexport const hex = Buffer.from(bytes).toString('hex')\n",
    corrected: 'declare const bytes: Uint8Array\nexport const hex = bytes.toHex()\n',
  }),
  reportedAndCorrected('unicorn/prefer-unary-minus', {
    reported: 'declare const value: number\nexport const negated = value * -1\n',
    corrected: 'declare const value: number\nexport const negated = -value\n',
  }),
  reportedAndCorrected('unicorn/prefer-unicode-code-point-escapes', {
    reported: 'export const a = /\\x41/\nexport const b = "\\u0041"\n',
    corrected: 'export const a = /\\u{41}/u\nexport const b = "\\u0041"\n',
  }),
  reportedAndCorrected('unicorn/prefer-url-can-parse', {
    reported: 'declare const input: string\nexport function valid() {\n\ttry {\n\t\tnew URL(input)\n\t\treturn true\n\t} catch {\n\t\treturn false\n\t}\n}\n',
    corrected: 'declare const input: string\nexport function valid() {\n\treturn URL.canParse(input);\n}\n',
  }),
  reportedAndCorrected('unicorn/prefer-url-href', {
    reported: 'declare const url: URL\nexport const text = String(url)\n',
    corrected: 'declare const url: URL\nexport const text = url.href\n',
  }),
  reportedAndCorrected('unicorn/prefer-url-search-parameters', {
    reported: "declare const query: string\nexport const pairs = query.split('&').map(part => part.split('='))\n",
    corrected: 'declare const query: string\nexport const pairs = new URLSearchParams(query)\n',
  }),
  reportedAndCorrected('unicorn/prefer-while-loop-condition', {
    reported: 'declare const next: () => boolean\nwhile (true) {\n\tif (!next()) {\n\t\tbreak\n\t}\n\tconsole.log(1)\n}\n',
    corrected: 'declare const next: () => boolean\nwhile (next()) {\n\tconsole.log(1)\n}\n',
  }),
  reportedAndCorrected('unicorn/require-css-escape', {
    reported: 'declare const id: string\nexport const found = document.querySelector(`[data-id="${id}"]`)\n',
    corrected: 'declare const id: string\nexport const found = document.querySelector(`[data-id="${CSS.escape(id)}"]`)\n',
  }),
  reportedAndCorrected('unicorn/require-passive-events', {
    reported: "window.addEventListener('wheel', () => {})\n",
    corrected: "window.addEventListener('wheel', () => {}, {passive: true})\n",
  }),
  reportedAndCorrected('unicorn/require-proxy-trap-boolean-return', {
    reported: "export const proxy = new Proxy({}, {\n\thas() {\n\t\treturn 'yes'\n\t},\n})\n",
    corrected: 'export const proxy = new Proxy({}, {\n\thas() {\n\t\treturn true\n\t},\n})\n',
  }),
  reportedAndCorrected('unicorn/template-indent', {
    reported: 'export const query = /* indent */ `\nselect 1\n`\n',
    corrected: 'export const query = /* indent */ `\n  select 1\n`\n',
  }),
  reportedAndCorrected('unicorn/try-complexity', {
    reported: 'declare const a: () => void\ntry {\n\ta()\n\tif (1) { a() }\n\tfor (;;) { a() }\n\twhile (1) { a() }\n\tswitch (1) { case 1: a() }\n\ta()\n\tif (2) { a() } else { a() }\n\ttry { a() } catch { a() }\n} catch {}\n',
    corrected: 'declare const a: () => void\ntry {\n\ta()\n} catch {}\n',
    silentAsShippedIn: [
      { path: 'src/one-branch.ts', source: 'declare const a: () => void\ndeclare const ready: boolean\ntry {\n\tif (ready) { a() }\n} catch {}\n' },
    ],
  }),
]
