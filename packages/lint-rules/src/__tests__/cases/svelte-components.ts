import type { OxlintOverride } from 'oxlint'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// Svelte 5 components and rune modules, shaped like real run 3's case R-INT-2 (interview-prep's
// ui/*/svelte: StarRating.svelte, useElapsedTime.svelte.ts), where oxlint's no-undef reported every
// rune in every component. A rune is a global Svelte's compiler gives .svelte files and .svelte.js
// and .svelte.ts modules, and no other file. Each file below also uses one name nobody declares,
// which no-undef must still report outside .svelte files, where it is off and Svelte's own checker
// reports it (owner, q79): a missing import.

/**
 * The globals Svelte 5's runes are named by: every name in svelte 5.57.2's `RUNES` (src/utils.js)
 * starts with one of these, `$state.raw` and `$effect.pre` among them.
 */
export const SVELTE_RUNES = ['$state', '$derived', '$effect', '$props', '$bindable', '$inspect', '$host'] as const

/**
 * The runes a .svelte.js or .svelte.ts module may use: svelte 5.57.2 refuses `$props` outside a
 * component's top level, `$bindable` outside `$props()` and `$host` outside a custom element's
 * component (src/compiler/errors.js: props_invalid_placement, bindable_invalid_location,
 * host_invalid_placement).
 */
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

// Writing to a rune (2), which Svelte refuses: no-global-assign reads a rune as a read-only global
// where it is one. The one shipped rule that sees the runes in a TypeScript file, since no-undef
// leaves TS files to TypeScript.
const WRITES_TO_A_RUNE = `export function resetDerived(): void {
  $derived = (value: number) => value
}
`

/** Each Svelte file of the project, and the file beside them that holds a rune but is no Svelte file. */
export const SVELTE_SOURCE_FILES = {
  component: 'src/lib/StarRating.svelte',
  plainScriptComponent: 'src/lib/Counter.svelte',
  jsModule: 'src/lib/elapsed.svelte.js',
  tsModule: 'src/lib/elapsed.svelte.ts',
  tsModuleWritingToARune: 'src/lib/reset.svelte.ts',
  notARuneModule: 'src/lib/counter.js',
  tsFileWritingToARune: 'src/lib/reset.ts',
} as const

/** The project's sources: Svelte 5 components and rune modules, and two files that are no Svelte file, each beside its Svelte twin. */
export const svelteSourceFiles: ProjectFiles = {
  [SVELTE_SOURCE_FILES.component]: STAR_RATING_COMPONENT,
  [SVELTE_SOURCE_FILES.plainScriptComponent]: COUNTER_COMPONENT,
  [SVELTE_SOURCE_FILES.jsModule]: ELAPSED_TIME_MODULE,
  [SVELTE_SOURCE_FILES.tsModule]: ELAPSED_TIME_TS_MODULE,
  [SVELTE_SOURCE_FILES.tsModuleWritingToARune]: WRITES_TO_A_RUNE,
  [SVELTE_SOURCE_FILES.notARuneModule]: NOT_A_RUNE_MODULE,
  [SVELTE_SOURCE_FILES.tsFileWritingToARune]: WRITES_TO_A_RUNE,
}

/**
 * What oxlint owes in each file, where it runs no-undef and no-global-assign: the name nobody
 * declares in each rune module that is not TypeScript by its extension, and none in a component,
 * where no-undef is off (owner, q79), a rune in the file that is no Svelte file, and the write to a
 * rune in the TS rune module alone.
 */
export const OWED_BY_OXLINT = {
  [SVELTE_SOURCE_FILES.component]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.plainScriptComponent]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.jsModule]: { 'no-undef': ['src/lib/elapsed.svelte.js:8 eslint(no-undef)'], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsModule]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsModuleWritingToARune]: { 'no-undef': [], 'no-global-assign': ['src/lib/reset.svelte.ts:2 eslint(no-global-assign)'] },
  [SVELTE_SOURCE_FILES.notARuneModule]: { 'no-undef': ['src/lib/counter.js:2 eslint(no-undef)'], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsFileWritingToARune]: { 'no-undef': [], 'no-global-assign': [] },
}

/**
 * What ESLint owes where it runs both rules, in a project that lists no oxlint: as oxlint, in the
 * files it lints, JS and TS files alone, so no .svelte file.
 */
export const OWED_BY_ESLINT = {
  [SVELTE_SOURCE_FILES.jsModule]: { 'no-undef': ['src/lib/elapsed.svelte.js:8 no-undef'], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsModule]: { 'no-undef': [], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsModuleWritingToARune]: { 'no-undef': [], 'no-global-assign': ['src/lib/reset.svelte.ts:2 no-global-assign'] },
  [SVELTE_SOURCE_FILES.notARuneModule]: { 'no-undef': ['src/lib/counter.js:2 no-undef'], 'no-global-assign': [] },
  [SVELTE_SOURCE_FILES.tsFileWritingToARune]: { 'no-undef': [], 'no-global-assign': [] },
}

/**
 * The overrides every oxlint config of ours opens with, whatever it lints, each giving a framework's
 * globals in its own files (decisions.md, 2026-10-14 "fix round 4 closed"): oxlint's svelte env,
 * which holds the runes as read-only globals, in Svelte's components and rune modules; Svelte's
 * legacy globals, read-only, in its components; oxlint's vue env in Vue's components; and its astro
 * env in Astro's.
 */
export const FRAMEWORK_GLOBALS_OXLINT_OVERRIDES: readonly OxlintOverride[] = [
  { files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts', '**/*.svelte.*.js', '**/*.svelte.*.ts'], env: { svelte: true } },
  { files: ['**/*.svelte'], globals: { $$props: 'readonly', $$restProps: 'readonly', $$slots: 'readonly' } },
  { files: ['**/*.vue'], env: { vue: true } },
  { files: ['**/*.astro'], env: { astro: true } },
]

/** The block every ESLint config of ours holds right after its base block, giving the rune modules the runes. */
export const SVELTE_RUNES_ESLINT_BLOCK_NAME = 'agents-inc/svelte-runes'

/**
 * The override every oxlint config of ours holds after the framework globals' (q76; spec-core.md
 * C10): Vitest's and Jest's globals, through oxlint's envs, read-only, in test files, whatever
 * rulesets are listed. The test files are the shapes the shipped test-file ignores use, of every JS
 * and TS extension.
 */
export const TEST_RUNNER_GLOBALS_OXLINT_OVERRIDE: OxlintOverride = {
  files: ['**/*.{test,spec}.{js,mjs,cjs,jsx,ts,mts,cts,tsx}', '**/__tests__/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
  env: { vitest: true, jest: true },
}

/** The overrides every oxlint config of ours opens with, whatever it lints: each framework's globals, then the test runners'. */
export const GLOBALS_OXLINT_OVERRIDES: readonly OxlintOverride[] = [...FRAMEWORK_GLOBALS_OXLINT_OVERRIDES, TEST_RUNNER_GLOBALS_OXLINT_OVERRIDE]

/** The block every ESLint config of ours holds right after the Svelte runes' block, giving test files the test runners' globals (q76). */
export const TEST_RUNNER_GLOBALS_ESLINT_BLOCK_NAME = 'agents-inc/test-runner-globals'

// Svelte's tests of runes are rune modules too (decisions.md, 2026-10-14 "fix round 4 closed"):
// vite-plugin-svelte 7.3.1 compiles as a module each file whose name holds `.svelte.` and then ends
// in js or ts, whatever dot-separated parts come between (src/utils/id.js, buildModuleIdFilter:
// `^[^?#]+(?:\.svelte\.)(?:[^.\\/]+\.)*(?:js|ts)(?:[?#]|$)`), and Svelte's testing docs name a
// test of runes `multiplier.svelte.test.js`. Beside them, files that meet one half of that rule
// and not the other: a name that ends in .js but holds no `.svelte.`, names that hold `.svelte.`
// but end in .mjs or .mts, and `.svelte.` in a folder's name rather than the file's.

/** A test of runes, as Svelte's testing docs write one: every rune a module may use; expectDoubled (8) is declared nowhere. */
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

/** A test writing to a rune (2), which no-global-assign reports where the rune is a read-only global: no-undef leaves TS files to TypeScript. */
const RUNE_WRITING_TEST = `export function resetsDerived(): void {
  $derived = (value: number) => value
}
`

/** Each test file of the project: two rune modules, and four that are no rune module. */
const SVELTE_TEST_FILES = {
  jsRuneModule: 'src/lib/multiplier.svelte.test.js',
  tsRuneModule: 'src/lib/multiplier.svelte.spec.ts',
  noSvelteInfix: 'src/lib/multiplier.test.js',
  mjsExtension: 'src/lib/multiplier.svelte.test.mjs',
  mtsExtension: 'src/lib/multiplier.svelte.spec.mts',
  infixInAFolder: 'src/lib.svelte.parts/multiplier.test.js',
} as const

/** The project's test files: each JS one holds the test of runes, each TS one the test writing to a rune. */
export const svelteTestFiles: ProjectFiles = {
  [SVELTE_TEST_FILES.jsRuneModule]: RUNE_TEST,
  [SVELTE_TEST_FILES.tsRuneModule]: RUNE_WRITING_TEST,
  [SVELTE_TEST_FILES.noSvelteInfix]: RUNE_TEST,
  [SVELTE_TEST_FILES.mjsExtension]: RUNE_TEST,
  [SVELTE_TEST_FILES.mtsExtension]: RUNE_WRITING_TEST,
  [SVELTE_TEST_FILES.infixInAFolder]: RUNE_TEST,
}

/** The rune modules among the test files, where every rune a module may use is a global. */
export const RUNE_TEST_MODULES = [SVELTE_TEST_FILES.jsRuneModule, SVELTE_TEST_FILES.tsRuneModule]

/** The test files that are no rune module, where no rune is a global. */
export const TEST_FILES_OF_NO_RUNE_MODULE = [
  SVELTE_TEST_FILES.noSvelteInfix,
  SVELTE_TEST_FILES.mjsExtension,
  SVELTE_TEST_FILES.mtsExtension,
  SVELTE_TEST_FILES.infixInAFolder,
]

/**
 * What oxlint owes in each test file, where it runs no-undef and no-global-assign: in the JS rune
 * module the name nobody declares alone; in each JS file that is no rune module every rune too, on
 * lines 2 to 5; in the TS rune module the write to a rune; and nothing in the TS file that is no
 * rune module, where the rune is no global to write to.
 */
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

/** What ESLint owes in each test file where it runs both rules, in a project that lists no oxlint: as oxlint, under ESLint's names. */
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
