// Names a framework's compiler gives the script of its own files, and no other file (decisions.md,
// 2026-10-14 "real run 3, scale lane" and "fix round 4 closed"). oxlint lints every framework's
// components, so our oxlint part gives each framework's names in its files. Our ESLint part lints
// JS and TS files alone, so of these files it lints Svelte's rune modules alone.

/** A framework's globals as an env both engines know: oxlint's, and the `globals` package's, which ESLint reads. */
export type FrameworkEnv = { readonly files: readonly string[]; readonly env: string }

// Svelte 5's runes ($state, $derived, $effect, $props, $bindable, $inspect, $host): each engine's
// `svelte` env makes every rune a read-only global (measured, oxlint 1.87 and globals 17.13).
const SVELTE_ENV = 'svelte'

const SVELTE_COMPONENTS = '**/*.svelte'

// Svelte's rune modules: vite-plugin-svelte 7.3.1 compiles as a module each file whose name holds
// `.svelte.` and then ends in js or ts, whatever dot-separated parts come between (src/utils/id.js,
// buildModuleIdFilter: `^[^?#]+(?:\.svelte\.)(?:[^.\\/]+\.)*(?:js|ts)(?:[?#]|$)`), so Svelte's
// tests of runes too, as its testing docs name them: `multiplier.svelte.test.js`.
const SVELTE_RUNE_MODULES: readonly string[] = ['**/*.svelte.js', '**/*.svelte.ts', '**/*.svelte.*.js', '**/*.svelte.*.ts']

/** Svelte's runes, in its components and its rune modules. */
export const SVELTE_RUNES: FrameworkEnv = { files: [SVELTE_COMPONENTS, ...SVELTE_RUNE_MODULES], env: SVELTE_ENV }

/**
 * Svelte's legacy globals, which its compiler gives a component alone, and neither engine's env
 * holds: `RESERVED` in svelte 5.57.2 (src/compiler/phases/2-analyze/index.js).
 */
export const SVELTE_COMPONENT_GLOBALS = { files: [SVELTE_COMPONENTS], names: ['$$props', '$$restProps', '$$slots'] } as const

/**
 * The other frameworks whose compiler gives its components globals that an env of oxlint's holds:
 * Vue's `<script setup>` compiler macros, `MACROS` in @vue/compiler-sfc 3.5.44, in its `vue` env;
 * and Astro's one global, `Astro` in astro 7.3.8's env.d.ts, in its `astro` env (each as in globals
 * 17.13, and measured on oxlint 1.87).
 */
export const OTHER_FRAMEWORK_ENVS: readonly FrameworkEnv[] = [
  { files: ['**/*.vue'], env: 'vue' },
  { files: ['**/*.astro'], env: 'astro' },
]
