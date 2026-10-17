// Names a framework's compiler gives its own files' scripts. oxlint lints every framework's components; our
// ESLint part lints JS and TS alone, so of these it lints only Svelte's rune modules.

import { JS_AND_TS_EXTENSIONS } from './eslint-file-types.ts'

/** An env both oxlint and the `globals` package (read by ESLint) know. */
export type FrameworkEnv = { readonly files: readonly string[]; readonly env: string }

// Each engine's `svelte` env makes every Svelte 5 rune a read-only global (measured, oxlint 1.87 and globals 17.13).
const SVELTE_ENV = 'svelte'

const SVELTE_COMPONENTS = '**/*.svelte'

// vite-plugin-svelte 7.3.1 compiles as a rune module each file whose name holds `.svelte.` and ends in js or ts,
// so `multiplier.svelte.test.js` is one too.
const SVELTE_RUNE_MODULES: readonly string[] = ['**/*.svelte.js', '**/*.svelte.ts', '**/*.svelte.*.js', '**/*.svelte.*.ts']

export const SVELTE_RUNES: FrameworkEnv = { files: [SVELTE_COMPONENTS, ...SVELTE_RUNE_MODULES], env: SVELTE_ENV }

/** Given by Svelte's compiler to a component alone, and in neither engine's env (`RESERVED` in svelte 5.57.2). */
export const SVELTE_COMPONENT_GLOBALS = { files: [SVELTE_COMPONENTS], names: ['$$props', '$$restProps', '$$slots'] } as const

/** Vue's `<script setup>` macros and Astro's `Astro` global, each in an oxlint env of its name (measured, oxlint 1.87). */
export const OTHER_FRAMEWORK_ENVS: readonly FrameworkEnv[] = [
  { files: ['**/*.vue'], env: 'vue' },
  { files: ['**/*.astro'], env: 'astro' },
]

export type TestRunnerEnvs = { readonly files: readonly string[]; readonly envs: readonly string[] }

const BRACE_SEPARATOR = ','
const TEST_FILE_EXTENSIONS = `{${[...JS_AND_TS_EXTENSIONS].join(BRACE_SEPARATOR)}}`

/** Read-only, in test files whatever rulesets are listed: `*.test.*`, `*.spec.*` and anything under `__tests__`. */
export const TEST_RUNNER_GLOBALS: TestRunnerEnvs = {
  files: [`**/*.{test,spec}.${TEST_FILE_EXTENSIONS}`, `**/__tests__/**/*.${TEST_FILE_EXTENSIONS}`],
  envs: ['vitest', 'jest'],
}
