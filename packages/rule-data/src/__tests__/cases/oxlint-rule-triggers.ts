// Code that draws each rule data/oxlint-file-types.json guards, written into a file of each type (a
// .vue or .svelte script block, an .astro frontmatter). Each trigger names the file types whose parser
// refuses its code (measured, oxlint 1.87).

/** A file type oxlint is given: an extension it lints by default, or a kind of declaration file. */
export type FileType = (typeof LINTED_EXTENSIONS)[number] | keyof typeof DECLARATION_FILE_TYPES

/** How a .vue or .svelte file opens the script block holding the code, where not as plain TypeScript: TSX, or a Vue `<script setup>`. */
export type ScriptBlock = 'setup' | 'tsx'

/** Code that draws a rule wherever oxlint runs the rule on it. */
export type RuleTrigger = {
  readonly code: string
  /** The file types whose parser refuses the code: oxlint reports the parse error and runs no rule. */
  readonly unparsedIn: readonly FileType[]
  /** The rule's options, where its defaults would not report the code. */
  readonly options?: readonly unknown[]
  /** A .vue file's script block, where the rule asks for one other than plain TypeScript. */
  readonly script?: ScriptBlock
  /** File types oxlint runs the rule in that it reports nothing in, for a reason the data does not record: what the file holds, or the rule's options. */
  readonly silentIn?: { readonly types: readonly FileType[]; readonly why: string }
}

/** The extensions of the files written for each rule: every one oxlint lints by default (measured, oxlint 1.87). */
export const LINTED_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro'] as const

/** Each kind of declaration file oxlint reads (oxc's is_ts_declaration), by the extension oxlint reads its type from. */
export const DECLARATION_FILE_TYPES = { 'd.ts': 'ts', 'd.mts': 'mts', 'd.cts': 'cts', 'd.css.ts': 'ts' } as const

/** Extensions oxlint lints no file of by default (measured, oxlint 1.87), each file holding a debugger statement where it can. */
export const NOT_LINTED_FILES = {
  'a.json': '{ "debugger": true }\n',
  'a.md': '```js\ndebugger\n```\n',
  'a.html': '<script>\ndebugger\n</script>\n',
  'a.css': 'a { color: red; }\n',
} as const

/** A debugger statement, which no-debugger reports in every file oxlint lints. */
export const DEBUGGER_STATEMENT = 'debugger\n'

const DECLARATIONS: readonly FileType[] = ['d.ts', 'd.mts', 'd.cts', 'd.css.ts']
const JAVASCRIPT: readonly FileType[] = ['js', 'mjs', 'cjs', 'jsx']
const COMMONJS: readonly FileType[] = ['cjs']
// TypeScript files that hold no JSX: an .astro file's frontmatter among them.
const TYPESCRIPT_WITHOUT_JSX: readonly FileType[] = ['ts', 'mts', 'cts', 'astro']

const PARSED_EVERYWHERE: readonly FileType[] = []
// A CommonJS file refuses import and export.
const AN_ES_MODULE = COMMONJS
// A declaration file refuses function bodies and initializers.
const IMPLEMENTATIONS = DECLARATIONS
const AN_ES_MODULE_WITH_IMPLEMENTATIONS = [...COMMONJS, ...DECLARATIONS]
const TYPESCRIPT_SYNTAX = JAVASCRIPT
const TYPESCRIPT_SYNTAX_WITH_IMPLEMENTATIONS = [...JAVASCRIPT, ...DECLARATIONS]
const JSX_IN_AN_ES_MODULE = [...COMMONJS, ...TYPESCRIPT_WITHOUT_JSX, ...DECLARATIONS]

/** Code drawing each rule the data guards, by its oxlint name. */
export const RULE_TRIGGERS: Readonly<Record<string, RuleTrigger>> = {
  'jest/no-untyped-mock-factory': {
    code: `import { jest } from '@jest/globals'
jest.mock('../moduleName', () => {
  return jest.fn(() => 42)
})
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'typescript/adjacent-overload-signatures': {
    code: `export declare function a(): void
export declare function b(): void
export declare function a(x: number): void
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/ban-ts-comment': {
    code: `// @ts-ignore
const a = 1
`,
    unparsedIn: PARSED_EVERYWHERE,
  },
  'typescript/ban-types': {
    code: `export let a: Object = {}
`,
    unparsedIn: TYPESCRIPT_SYNTAX_WITH_IMPLEMENTATIONS,
  },
  'typescript/consistent-generic-constructors': {
    code: `export const a: Map<string, number> = new Map()
`,
    unparsedIn: TYPESCRIPT_SYNTAX_WITH_IMPLEMENTATIONS,
  },
  'typescript/consistent-indexed-object-style': {
    code: `export type A = { [key: string]: number }
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/explicit-function-return-type': {
    code: `function f() {
  return 1
}
`,
    unparsedIn: IMPLEMENTATIONS,
  },
  'typescript/explicit-member-accessibility': {
    code: `class A {
  m() {}
}
`,
    unparsedIn: IMPLEMENTATIONS,
  },
  'typescript/explicit-module-boundary-types': {
    code: `export function f(a) {
  return a
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'typescript/method-signature-style': {
    code: `export interface A {
  m(): void
}
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-confusing-non-null-assertion': {
    code: `declare const a: number | undefined
export const b = a! == 1
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-duplicate-enum-values': {
    code: `export enum E {
  A = 1,
  B = 1,
}
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-empty-interface': {
    code: `export interface A {}
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-explicit-any': {
    code: `export let a: any = 1
`,
    unparsedIn: TYPESCRIPT_SYNTAX_WITH_IMPLEMENTATIONS,
  },
  'typescript/no-extra-non-null-assertion': {
    code: `declare const a: { b: number } | null
export const c = a!!.b
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-import-type-side-effects': {
    code: `import { type A } from './a'
export type B = A
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-misused-new': {
    code: `export interface I {
  new (): I
}
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-namespace': {
    code: `export namespace N {}
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
    silentIn: { types: DECLARATIONS, why: "its allowDefinitionFiles option, on by default, allows a namespace in a declaration file" },
  },
  'typescript/no-non-null-asserted-optional-chain': {
    code: `declare const a: { b?: number } | undefined
export const c = a?.b!
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-non-null-assertion': {
    code: `declare const a: number | null
export const b = a!
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-restricted-types': {
    code: `export let a: Foo
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
    options: [{ types: { Foo: 'Use Bar.' } }],
  },
  'typescript/no-this-alias': {
    code: `function f() {
  const self = this
  return self
}
`,
    unparsedIn: IMPLEMENTATIONS,
  },
  'typescript/no-unnecessary-type-constraint': {
    code: `export function f<T extends unknown>(a: T): T {
  return a
}
`,
    unparsedIn: TYPESCRIPT_SYNTAX_WITH_IMPLEMENTATIONS,
  },
  'typescript/no-unsafe-declaration-merging': {
    code: `export interface A {}
export class A {}
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/no-wrapper-object-types': {
    code: `export let a: String = ''
`,
    unparsedIn: TYPESCRIPT_SYNTAX_WITH_IMPLEMENTATIONS,
  },
  'typescript/parameter-properties': {
    code: `export class A {
  constructor(private a: number) {}
}
`,
    unparsedIn: TYPESCRIPT_SYNTAX_WITH_IMPLEMENTATIONS,
  },
  'typescript/prefer-as-const': {
    code: `export let a: 'x' = 'x'
`,
    unparsedIn: TYPESCRIPT_SYNTAX_WITH_IMPLEMENTATIONS,
  },
  'typescript/prefer-namespace-keyword': {
    code: `module N {}
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'typescript/prefer-ts-expect-error': {
    code: `// @ts-ignore
const a = 1
`,
    unparsedIn: PARSED_EVERYWHERE,
  },
  'typescript/triple-slash-reference': {
    code: `/// <reference path="./a" />
const a = 1
`,
    unparsedIn: PARSED_EVERYWHERE,
  },
  'typescript/unified-signatures': {
    code: `export function f(a: string): void
export function f(a: number): void
export function f(a: unknown) {}
`,
    unparsedIn: TYPESCRIPT_SYNTAX_WITH_IMPLEMENTATIONS,
  },
  'vue/define-emits-declaration': {
    code: `defineEmits(['change'])
`,
    unparsedIn: IMPLEMENTATIONS,
    script: 'setup',
    silentIn: { types: ['ts', 'mts', 'cts', 'tsx', 'svelte', 'astro'], why: "it asks for a Vue <script setup>, which only a .vue file holds" },
  },
  'vue/define-props-declaration': {
    code: `defineProps({ a: String })
`,
    unparsedIn: IMPLEMENTATIONS,
    script: 'setup',
    silentIn: { types: ['ts', 'mts', 'cts', 'tsx', 'svelte', 'astro'], why: "it asks for a Vue <script setup>, which only a .vue file holds" },
  },
  'vue/require-typed-ref': {
    code: `import { ref } from 'vue'
export const a = ref()
`,
    unparsedIn: AN_ES_MODULE,
  },
  'typescript/consistent-type-imports': {
    code: `import { A } from './a'
export let b: A
`,
    unparsedIn: TYPESCRIPT_SYNTAX,
  },
  'vitest/require-mock-type-parameters': {
    code: `import { vi } from 'vitest'
export const f = vi.fn()
`,
    unparsedIn: AN_ES_MODULE,
  },
  'getter-return': {
    code: `const o = {
  get a() {},
}
`,
    unparsedIn: PARSED_EVERYWHERE,
  },
  'vue/max-props': {
    code: `export default {
  props: { a: String, b: String },
}
`,
    unparsedIn: AN_ES_MODULE,
    options: [{ maxProps: 1 }],
  },
  'vue/next-tick-style': {
    code: `import { nextTick } from 'vue'
nextTick(() => {})
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'vue/no-async-in-computed-properties': {
    code: `export default {
  computed: {
    async a() {
      return 1
    },
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-computed-properties-in-data': {
    code: `export default {
  data() {
    return { a: this.b }
  },
  computed: {
    b() {
      return 1
    },
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-deprecated-data-object-declaration': {
    code: `export default {
  data: { a: 1 },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-deprecated-delete-set': {
    code: `export default {
  methods: {
    m() {
      this.$set(this.a, 'b', 1)
    },
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-deprecated-model-definition': {
    code: `export default {
  model: { prop: 'a' },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-deprecated-props-default-this': {
    code: `export default {
  props: {
    a: {
      type: String,
      default() {
        return this.b
      },
    },
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-expose-after-await': {
    code: `export default {
  async setup(props, { expose }) {
    await fetch('a')
    expose({})
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-lifecycle-after-await': {
    code: `import { onMounted } from 'vue'
export default {
  async setup() {
    await fetch('a')
    onMounted(() => {})
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-multiple-slot-args': {
    code: `export default {
  render() {
    return this.$slots.default(1, 2)
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-reserved-component-names': {
    code: `export default {
  name: 'div',
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-reserved-keys': {
    code: `export default {
  props: { $el: String },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-reserved-props': {
    code: `export default {
  props: { key: String },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-this-in-before-route-enter': {
    code: `export default {
  beforeRouteEnter() {
    this.a = 1
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/no-watch-after-await': {
    code: `import { watch } from 'vue'
export default {
  async setup() {
    await fetch('a')
    watch(() => 1, () => {})
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/require-default-export': {
    code: `export const a = 1
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/require-direct-export': {
    code: `const a = {}
export default a
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/require-prop-type-constructor': {
    code: `export default {
  props: { a: 'String' },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/require-slots-as-functions': {
    code: `export default {
  render() {
    return this.$slots.default.length
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/return-in-computed-property': {
    code: `export default {
  computed: {
    a() {},
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/return-in-emits-validator': {
    code: `export default {
  emits: {
    a() {},
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'vue/valid-define-options': {
    code: `const def = { name: 'Foo' }
defineOptions(def)
`,
    unparsedIn: IMPLEMENTATIONS,
    script: 'setup',
  },
  'vue/valid-next-tick': {
    code: `import { nextTick } from 'vue'
export default {
  async mounted() {
    nextTick()
  },
}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'react/capitalized-calls': {
    code: `import { useState } from 'react'
import Child from './child'
export function useThing() {
  useState(0)
  return Child()
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/error-boundaries': {
    code: `export function Component() {
  let el
  try {
    el = <Child />
  } catch {
    return null
  }
  return el
}
`,
    unparsedIn: JSX_IN_AN_ES_MODULE,
    script: 'tsx',
  },
  'react/exhaustive-effect-dependencies': {
    code: `import { useEffect } from 'react'
export function useThing(a) {
  useEffect(() => {
    console.log(a)
  }, [])
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/globals': {
    code: `import { useState } from 'react'
let someGlobal = false
export function useThing() {
  useState(0)
  someGlobal = true
  return someGlobal
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/hooks': {
    code: `import { useState } from 'react'
export function useThing(a) {
  if (a) {
    useState(0)
  }
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/immutability': {
    code: `import { useState } from 'react'
export function useThing() {
  const [state] = useState({ a: 0 })
  state.a = 1
  return state
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/incompatible-library': {
    code: `import { useForm } from 'react-hook-form'
export function useThing() {
  const { watch } = useForm()
  return watch('a')
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/invariant': {
    code: `export function useThing() {
  return 1
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
    silentIn: { types: ['js', 'mjs', 'jsx', 'ts', 'mts', 'cts', 'tsx'], why: "the React Compiler reports an invariant only on a bug of its own: oxc's tests of the rule hold no failing case" },
  },
  'react/memo-dependencies': {
    code: `import { useMemo } from 'react'
export function useThing(a) {
  return useMemo(() => a + 1, [])
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/no-deriving-state-in-effects': {
    code: `import { useEffect, useState } from 'react'
export function useThing(a) {
  const [b, setB] = useState(0)
  useEffect(() => {
    setB(a + 1)
  }, [a])
  return b
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/preserve-manual-memoization': {
    code: `import { useCallback } from 'react'
export function useFoo(props) {
  const x = []
  useHook()
  x.push(props)
  return useCallback(() => {
    doSomething()
    return [x]
  }, [x])
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/purity': {
    code: `import { useState } from 'react'
export function useNow() {
  useState(0)
  return Date.now()
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/refs': {
    code: `import { useRef } from 'react'
export function useThing() {
  const ref = useRef(null)
  return ref.current
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/rule-suppression': {
    code: `import { useState } from 'react'
export function useThing(value) {
  useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doubled = value * 2
  return doubled
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/set-state-in-effect': {
    code: `import { useEffect, useState } from 'react'
export function useThing() {
  const [a, setA] = useState(0)
  useEffect(() => {
    setA(1)
  }, [])
  return a
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/set-state-in-render': {
    code: `import { useState } from 'react'
export function useThing() {
  const [a, setA] = useState(0)
  setA(1)
  return a
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/static-components': {
    code: `export function Example() {
  const Component = createComponent()
  return <Component />
}
`,
    unparsedIn: JSX_IN_AN_ES_MODULE,
    script: 'tsx',
  },
  'react/syntax': {
    code: `import { useState } from 'react'
export function useThing() {
  useState(0)
  const x = 0
  x = 1
  return x
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/todo': {
    code: `import { useEffect } from 'react'
export function useThing() {
  useEffect(() => {
    try {
      doSomething()
    } finally {
      cleanup()
    }
  }, [])
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/unsupported-syntax': {
    code: `import { useState } from 'react'
export function useThing() {
  useState(0)
  eval('1')
  return 1
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/use-memo': {
    code: `import { useMemo } from 'react'
export function useThing() {
  return useMemo((x) => x, [])
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'react/void-use-memo': {
    code: `import { useMemo } from 'react'
export function useThing() {
  useMemo(() => {
    console.log(1)
  }, [])
}
`,
    unparsedIn: AN_ES_MODULE_WITH_IMPLEMENTATIONS,
  },
  'unicorn/no-empty-file': {
    code: ``,
    unparsedIn: PARSED_EVERYWHERE,
  },
  'typescript/no-useless-empty-export': {
    code: `export const a = 1
export {}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'unicorn/consistent-function-scoping': {
    code: `function outer() {
  function inner() {
    return 1
  }
  return inner()
}
`,
    unparsedIn: IMPLEMENTATIONS,
  },
  'unicorn/prefer-string-raw': {
    code: `const a = 'a\\\\b'
`,
    unparsedIn: PARSED_EVERYWHERE,
  },
  'vue/prefer-import-from-vue': {
    code: `import { ref } from '@vue/runtime-core'
export { ref }
`,
    unparsedIn: AN_ES_MODULE,
  },
  'no-unused-vars': {
    code: `const unused = 1
export {}
`,
    unparsedIn: AN_ES_MODULE,
  },
  'no-unassigned-vars': {
    code: `let a
function f() {
  return a
}
`,
    unparsedIn: IMPLEMENTATIONS,
  },
  'prefer-const': {
    code: `let a = 1
console.log(a)
`,
    unparsedIn: IMPLEMENTATIONS,
  },
  'react/rules-of-hooks': {
    code: `function Component() {
  if (condition) {
    useHook()
  }
}
`,
    unparsedIn: IMPLEMENTATIONS,
  },
  'no-unused-labels': {
    code: `function f() {
  a: {
  }
}
`,
    unparsedIn: IMPLEMENTATIONS,
  },
  'unicorn/prefer-module': {
    code: `const dir = __dirname
`,
    unparsedIn: PARSED_EVERYWHERE,
  },
}
