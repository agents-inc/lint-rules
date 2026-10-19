import type { OxlintOverride } from 'oxlint'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// Svelte 5 components and rune modules: runes are globals in .svelte, .svelte.js and .svelte.ts files only.
// Each file also uses one undeclared name, which no-undef must report outside .svelte files, where it is off.

/** Every rune in svelte 5.57.2's `RUNES` (src/utils.js) starts with one of these. */
export const SVELTE_RUNES = ['$state', '$derived', '$effect', '$props', '$bindable', '$inspect', '$host'] as const

/** svelte 5.57.2 refuses `$props`, `$bindable` and `$host` outside a component (src/compiler/errors.js). */
export const MODULE_RUNES = ['$state', '$derived', '$effect', '$inspect'] as const

export const NO_UNDEF: RuleByItsNames = { rule: 'no-undef', names: ['no-undef', 'eslint(no-undef)'] }
export const NO_GLOBAL_ASSIGN: RuleByItsNames = { rule: 'no-global-assign', names: ['no-global-assign', 'eslint(no-global-assign)'] }

// Every rune, in a component whose script is TypeScript; formatRating (14) is declared nowhere.
const STAR_RATING_COMPONENT = `<script lang="ts">
  type Props = { count?: number; value?: number }

  let { count = 5, value = $bindable(0) }: Props = $props()
  let hovered = $state<number | null>(null)
  let shown = $derived(hovered ?? value)
  let stars = $derived.by(() => Array.from({ length: count }, (_, index) => index + 1))
  const element = $host()

  $effect(() => {
    $inspect(shown, stars, element)
  })

  const label = formatRating(shown)
</script>

<p>{label}</p>
`

// A component whose script is plain JavaScript; reportCount (8) is declared nowhere.
const COUNTER_COMPONENT = `<script>
  let { start = 0 } = $props()
  const id = $props.id()
  let count = $state(start)
  let doubled = $derived(count * 2)

  $effect(() => {
    reportCount(id, doubled)
  })
</script>

<button onclick={() => count++}>{count}</button>
`

// The runes a module may use, in a JavaScript rune module; currentTime (8) is declared nowhere.
const ELAPSED_TIME_MODULE = `export function useElapsedTime() {
  let startedAt = $state(Date.now())
  let now = $state.raw(Date.now())
  const elapsed = $derived(now - startedAt)
  $inspect(elapsed)

  $effect.pre(() => {
    now = currentTime()
  })

  return {
    get elapsed() {
      return elapsed
    },
  }
}
`

// The same runes in a TypeScript rune module, which no-undef leaves to TypeScript: nothing to report.
const ELAPSED_TIME_TS_MODULE = `export function useElapsedTime(): { readonly elapsed: number } {
  let startedAt = $state(Date.now())
  let now = $state.raw(Date.now())
  const elapsed = $derived(now - startedAt)
  $inspect(elapsed)

  $effect.pre(() => {
    now = currentTime()
  })

  return {
    get elapsed(): number {
      return elapsed
    },
  }
}
`

// A rune where no rune is a global: a plain JavaScript module, not a rune module (2).
const NOT_A_RUNE_MODULE = `export function counter() {
  return $state(0)
}
`

// Writing to a rune (2), which Svelte refuses: the one shipped rule that sees runes in a TS file,
// as no-undef leaves TS files to TypeScript.
const WRITES_TO_A_RUNE = `export function resetDerived(): void {
  $derived = (value: number) => value
}
`

export const SVELTE_SOURCE_FILES = {
  component: 'src/lib/StarRating.svelte',
  plainScriptComponent: 'src/lib/Counter.svelte',
  jsModule: 'src/lib/elapsed.svelte.js',
  tsModule: 'src/lib/elapsed.svelte.ts',
  tsModuleWritingToARune: 'src/lib/reset.svelte.ts',
  notARuneModule: 'src/lib/counter.js',
  tsFileWritingToARune: 'src/lib/reset.ts',
} as const

export const svelteSourceFiles: ProjectFiles = {
  [SVELTE_SOURCE_FILES.component]: STAR_RATING_COMPONENT,
  [SVELTE_SOURCE_FILES.plainScriptComponent]: COUNTER_COMPONENT,
  [SVELTE_SOURCE_FILES.jsModule]: ELAPSED_TIME_MODULE,
  [SVELTE_SOURCE_FILES.tsModule]: ELAPSED_TIME_TS_MODULE,
  [SVELTE_SOURCE_FILES.tsModuleWritingToARune]: WRITES_TO_A_RUNE,
  [SVELTE_SOURCE_FILES.notARuneModule]: NOT_A_RUNE_MODULE,
  [SVELTE_SOURCE_FILES.tsFileWritingToARune]: WRITES_TO_A_RUNE,
}

/** What oxlint owes: no-undef is off in components, so they owe no undeclared name. */
export const OWED_BY_OXLINT = {
  [SVELTE_SOURCE_FILES.component]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.plainScriptComponent]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.jsModule]: { 'no-undef': ['src/lib/elapsed.svelte.js:8 eslint(no-undef)'], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsModule]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsModuleWritingToARune]: { 'no-undef': [], 'no-global-assign': ['src/lib/reset.svelte.ts:2 eslint(no-global-assign)'] },
  [SVELTE_SOURCE_FILES.notARuneModule]: { 'no-undef': ['src/lib/counter.js:2 eslint(no-undef)'], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsFileWritingToARune]: { 'no-undef': [], 'no-global-assign': [] },
}

/** What ESLint owes, in a project listing no oxlint; it lints no .svelte file. */
export const OWED_BY_ESLINT = {
  [SVELTE_SOURCE_FILES.jsModule]: { 'no-undef': ['src/lib/elapsed.svelte.js:8 no-undef'], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsModule]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsModuleWritingToARune]: { 'no-undef': [], 'no-global-assign': ['src/lib/reset.svelte.ts:2 no-global-assign'] },
  [SVELTE_SOURCE_FILES.notARuneModule]: { 'no-undef': ['src/lib/counter.js:2 no-undef'], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsFileWritingToARune]: { 'no-undef': [], 'no-global-assign': [] },
}

/** Every oxlint config of ours opens with these: Svelte, Vue and Astro globals in their own files. */
export const FRAMEWORK_GLOBALS_OXLINT_OVERRIDES: readonly OxlintOverride[] = [
  { files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts', '**/*.svelte.*.js', '**/*.svelte.*.ts'], env: { svelte: true } },
  { files: ['**/*.svelte'], globals: { $$props: 'readonly', $$restProps: 'readonly', $$slots: 'readonly' } },
  { files: ['**/*.vue'], env: { vue: true } },
  { files: ['**/*.astro'], env: { astro: true } },
]

/** The block every ESLint config of ours holds right after its base block, giving the rune modules the runes. */
export const SVELTE_RUNES_ESLINT_BLOCK_NAME = 'agents-inc/svelte-runes'

/** Vitest's and Jest's globals, read-only, in test and type-test files of every JS and TS extension. */
export const TEST_RUNNER_GLOBALS_OXLINT_OVERRIDE: OxlintOverride = {
  files: [
    '**/*.{test,spec}.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
    '**/*.{test,spec}-d.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
    '**/__tests__/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
  ],
  env: { vitest: true, jest: true },
}

export const GLOBALS_OXLINT_OVERRIDES: readonly OxlintOverride[] = [...FRAMEWORK_GLOBALS_OXLINT_OVERRIDES, TEST_RUNNER_GLOBALS_OXLINT_OVERRIDE]

/** The block right after the Svelte runes' block, giving test files the test runners' globals. */
export const TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME = 'agents-inc/test-runner-globals'

// vite-plugin-svelte 7.3.1 compiles as a rune module any file whose name holds `.svelte.` and ends in js or ts
// (buildModuleIdFilter), so tests of runes are rune modules. Beside them, files meeting one half of that only.

/** A test of runes as Svelte's docs write one; expectDoubled (8) is declared nowhere. */
const RUNE_TEST = `export function countsUp() {
  let count = $state(0)
  const doubled = $derived(count * 2)
  const cleanup = $effect.root(() => {
    $inspect(doubled)
  })
  count = 5
  return expectDoubled(doubled, cleanup)
}
`

/** Writes to a rune (2); no-undef leaves TS files to TypeScript. */
const RUNE_WRITING_TEST = `export function resetsDerived(): void {
  $derived = (value: number) => value
}
`

const SVELTE_TEST_FILES = {
  jsRuneModule: 'src/lib/multiplier.svelte.test.js',
  tsRuneModule: 'src/lib/multiplier.svelte.spec.ts',
  noSvelteInfix: 'src/lib/multiplier.test.js',
  mjsExtension: 'src/lib/multiplier.svelte.test.mjs',
  mtsExtension: 'src/lib/multiplier.svelte.spec.mts',
  infixInAFolder: 'src/lib.svelte.parts/multiplier.test.js',
} as const

export const svelteTestFiles: ProjectFiles = {
  [SVELTE_TEST_FILES.jsRuneModule]: RUNE_TEST,
  [SVELTE_TEST_FILES.tsRuneModule]: RUNE_WRITING_TEST,
  [SVELTE_TEST_FILES.noSvelteInfix]: RUNE_TEST,
  [SVELTE_TEST_FILES.mjsExtension]: RUNE_TEST,
  [SVELTE_TEST_FILES.mtsExtension]: RUNE_WRITING_TEST,
  [SVELTE_TEST_FILES.infixInAFolder]: RUNE_TEST,
}

export const RUNE_TEST_MODULES = [SVELTE_TEST_FILES.jsRuneModule, SVELTE_TEST_FILES.tsRuneModule]

export const TEST_FILES_OF_NO_RUNE_MODULE = [
  SVELTE_TEST_FILES.noSvelteInfix,
  SVELTE_TEST_FILES.mjsExtension,
  SVELTE_TEST_FILES.mtsExtension,
  SVELTE_TEST_FILES.infixInAFolder,
]

/** In each JS file that is no rune module, every rune (lines 2 to 5) is owed too. */
export const OWED_IN_TEST_FILES_BY_OXLINT = {
  [SVELTE_TEST_FILES.jsRuneModule]: { 'no-undef': ['src/lib/multiplier.svelte.test.js:8 eslint(no-undef)'], 'no-global-assign': [] },
  [SVELTE_TEST_FILES.tsRuneModule]: { 'no-undef': [], 'no-global-assign': ['src/lib/multiplier.svelte.spec.ts:2 eslint(no-global-assign)'] },
  [SVELTE_TEST_FILES.noSvelteInfix]: {
    'no-undef': [
      'src/lib/multiplier.test.js:2 eslint(no-undef)',
      'src/lib/multiplier.test.js:3 eslint(no-undef)',
      'src/lib/multiplier.test.js:4 eslint(no-undef)',
      'src/lib/multiplier.test.js:5 eslint(no-undef)',
      'src/lib/multiplier.test.js:8 eslint(no-undef)',
    ],
    'no-global-assign': [],
  },
  [SVELTE_TEST_FILES.mjsExtension]: {
    'no-undef': [
      'src/lib/multiplier.svelte.test.mjs:2 eslint(no-undef)',
      'src/lib/multiplier.svelte.test.mjs:3 eslint(no-undef)',
      'src/lib/multiplier.svelte.test.mjs:4 eslint(no-undef)',
      'src/lib/multiplier.svelte.test.mjs:5 eslint(no-undef)',
      'src/lib/multiplier.svelte.test.mjs:8 eslint(no-undef)',
    ],
    'no-global-assign': [],
  },
  [SVELTE_TEST_FILES.mtsExtension]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_TEST_FILES.infixInAFolder]: {
    'no-undef': [
      'src/lib.svelte.parts/multiplier.test.js:2 eslint(no-undef)',
      'src/lib.svelte.parts/multiplier.test.js:3 eslint(no-undef)',
      'src/lib.svelte.parts/multiplier.test.js:4 eslint(no-undef)',
      'src/lib.svelte.parts/multiplier.test.js:5 eslint(no-undef)',
      'src/lib.svelte.parts/multiplier.test.js:8 eslint(no-undef)',
    ],
    'no-global-assign': [],
  },
}

/** What ESLint owes in each test file, in a project listing no oxlint. */
export const OWED_IN_TEST_FILES_BY_ESLINT = {
  [SVELTE_TEST_FILES.jsRuneModule]: { 'no-undef': ['src/lib/multiplier.svelte.test.js:8 no-undef'], 'no-global-assign': [] },
  [SVELTE_TEST_FILES.tsRuneModule]: { 'no-undef': [], 'no-global-assign': ['src/lib/multiplier.svelte.spec.ts:2 no-global-assign'] },
  [SVELTE_TEST_FILES.noSvelteInfix]: {
    'no-undef': [
      'src/lib/multiplier.test.js:2 no-undef',
      'src/lib/multiplier.test.js:3 no-undef',
      'src/lib/multiplier.test.js:4 no-undef',
      'src/lib/multiplier.test.js:5 no-undef',
      'src/lib/multiplier.test.js:8 no-undef',
    ],
    'no-global-assign': [],
  },
  [SVELTE_TEST_FILES.mjsExtension]: {
    'no-undef': [
      'src/lib/multiplier.svelte.test.mjs:2 no-undef',
      'src/lib/multiplier.svelte.test.mjs:3 no-undef',
      'src/lib/multiplier.svelte.test.mjs:4 no-undef',
      'src/lib/multiplier.svelte.test.mjs:5 no-undef',
      'src/lib/multiplier.svelte.test.mjs:8 no-undef',
    ],
    'no-global-assign': [],
  },
  [SVELTE_TEST_FILES.mtsExtension]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_TEST_FILES.infixInAFolder]: {
    'no-undef': [
      'src/lib.svelte.parts/multiplier.test.js:2 no-undef',
      'src/lib.svelte.parts/multiplier.test.js:3 no-undef',
      'src/lib.svelte.parts/multiplier.test.js:4 no-undef',
      'src/lib.svelte.parts/multiplier.test.js:5 no-undef',
      'src/lib.svelte.parts/multiplier.test.js:8 no-undef',
    ],
    'no-global-assign': [],
  },
}
