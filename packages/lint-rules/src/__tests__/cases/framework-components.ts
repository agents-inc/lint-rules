import type { OxlintConfig } from 'oxlint'
import type { ProjectFiles } from '../temp-projects.ts'

// Framework globals, the same class as Svelte's runes (decisions.md, 2026-10-14 "fix round 4
// closed"): names a framework's compiler gives the script of its own component files, and no other
// file. Fix round 4's developer measured oxlint's no-undef reporting each of them beside oxlint.
// The names, read from each framework's own package:
// - Vue 3.5.44's `<script setup>` compiler macros: `MACROS` in @vue/compiler-sfc
//   (dist/compiler-sfc.cjs.js).
// - Astro 7.3.8's `Astro`: `declare const Astro` in astro/env.d.ts, its one global.
// - Svelte 5.57.2's `$$props`, `$$restProps` and `$$slots`: `RESERVED` in
//   src/compiler/phases/2-analyze/index.js.
// Each component reading them also uses one name nobody declares, which no-undef must still report,
// and beside each a JS file uses a global of that framework, which it does not have. One more Svelte
// component writes to its legacy globals.

/** Every `<script setup>` compiler macro of Vue 3.5.44, a global in a .vue file alone. */
export const VUE_SCRIPT_SETUP_MACROS = ['defineProps', 'defineEmits', 'defineExpose', 'defineOptions', 'defineSlots', 'defineModel', 'withDefaults'] as const

/** Astro 7.3.8's one global, in a .astro file alone. */
export const ASTRO_GLOBALS = ['Astro'] as const

/** Svelte 5.57.2's legacy globals, in a .svelte component alone: no rune module has them. */
export const SVELTE_COMPONENT_GLOBALS = ['$$props', '$$restProps', '$$slots'] as const

// Every macro, one call to a line from 3 to 11 but withDefaults (3) around defineProps (4); formatName
// (13) is declared nowhere.
const GREETING_COMPONENT = `<script setup lang="ts">
type Props = { readonly name?: string }
const props = withDefaults(
  defineProps<Props>(),
  { name: 'you' },
)
const emit = defineEmits<{ greet: [name: string] }>()
const model = defineModel<string>()
const slots = defineSlots<{ default(): unknown }>()
defineOptions({ inheritAttrs: false })
defineExpose({ greet })
function greet(): void {
  emit('greet', formatName(props.name, model.value, slots))
}
</script>

<template><p>{{ props.name }}</p></template>
`

// A macro (2) in a JS file, where it is no global.
const MACRO_OUTSIDE_A_COMPONENT = `export function useGreeting() {
  return defineProps({ name: String })
}
`

// Astro (2) in the frontmatter; formatTitle (3) is declared nowhere.
const ASTRO_PAGE = `---
const { title } = Astro.props
const heading = formatTitle(title)
---

<h1>{heading}</h1>
`

// Astro (1) in a JS file, where it is no global.
const ASTRO_OUTSIDE_A_PAGE = `export const title = Astro.props.title
`

// Each legacy global, one to a line from 3 to 5; announce (6) is declared nowhere.
const LEGACY_COMPONENT = `<script>
  export let label = ''
  const attributes = $$restProps
  const title = $$props.title ?? label
  const hasFooter = Boolean($$slots.footer)
  announce(attributes, title, hasFooter)
</script>

<p>{title}</p>
`

// Writing to each legacy global, one to a line from 3 to 5. Svelte 5.57.2 compiles a component
// declaring `$$restProps` and `$$slots` as constants, and reads `$$props` as the constant
// `$$sanitized_props` (src/compiler/phases/3-transform/client/transform-client.js), so none takes
// a write: our oxlint part gives each as a read-only global, as each engine's env gives every other
// framework global, and no-global-assign reports each write.
const LEGACY_COMPONENT_WRITING_TO_ITS_GLOBALS = `<script>
  export let label = ''
  $$props = {}
  $$restProps = {}
  $$slots = {}
</script>

<p>{label}</p>
`

// $$props (1) in a rune module, which is no component and has none of the legacy globals.
const LEGACY_GLOBAL_IN_A_RUNE_MODULE = `export const title = $$props.title
`

// A store subscription (3): `$` and the name of a store the component imports, which Svelte
// subscribes to. No list of globals can hold every such name.
const STORE_COMPONENT = `<script>
  import { count } from './count.js'
  const doubled = $count * 2
</script>

<p>{doubled}</p>
`

const COUNT_STORE = `export const count = { subscribe: () => () => {} }
`

/**
 * Each file of the project: a component of each framework, the JS file beside it, a Svelte
 * component writing to its legacy globals, and one subscribing to a store.
 */
export const FRAMEWORK_FILES = {
  vueComponent: 'src/components/Greeting.vue',
  vueMacroInAJsFile: 'src/components/use-greeting.js',
  astroPage: 'src/pages/index.astro',
  astroGlobalInAJsFile: 'src/pages/page-title.js',
  svelteLegacyComponent: 'src/lib/Legacy.svelte',
  svelteLegacyComponentWritingToItsGlobals: 'src/lib/LegacyWrites.svelte',
  svelteLegacyGlobalInARuneModule: 'src/lib/legacy.svelte.js',
  svelteStoreComponent: 'src/lib/StoreCount.svelte',
  svelteStore: 'src/lib/count.js',
} as const

export const frameworkSourceFiles: ProjectFiles = {
  [FRAMEWORK_FILES.vueComponent]: GREETING_COMPONENT,
  [FRAMEWORK_FILES.vueMacroInAJsFile]: MACRO_OUTSIDE_A_COMPONENT,
  [FRAMEWORK_FILES.astroPage]: ASTRO_PAGE,
  [FRAMEWORK_FILES.astroGlobalInAJsFile]: ASTRO_OUTSIDE_A_PAGE,
  [FRAMEWORK_FILES.svelteLegacyComponent]: LEGACY_COMPONENT,
  [FRAMEWORK_FILES.svelteLegacyComponentWritingToItsGlobals]: LEGACY_COMPONENT_WRITING_TO_ITS_GLOBALS,
  [FRAMEWORK_FILES.svelteLegacyGlobalInARuneModule]: LEGACY_GLOBAL_IN_A_RUNE_MODULE,
  [FRAMEWORK_FILES.svelteStoreComponent]: STORE_COMPONENT,
  [FRAMEWORK_FILES.svelteStore]: COUNT_STORE,
}

/** The JS files beside the components, each using a framework global it does not have. */
export const JS_FILES_USING_A_FRAMEWORK_GLOBAL = [
  FRAMEWORK_FILES.vueMacroInAJsFile,
  FRAMEWORK_FILES.astroGlobalInAJsFile,
  FRAMEWORK_FILES.svelteLegacyGlobalInARuneModule,
]

/**
 * What oxlint owes where it runs no-undef: in each component the name nobody declares alone, and in
 * each JS file beside one the framework global it uses. The store subscription is a known gap,
 * owed apart (OWED_IN_THE_STORE_COMPONENT).
 */
export const OWED_BY_OXLINT_IN_FRAMEWORK_FILES = {
  [FRAMEWORK_FILES.vueComponent]: { 'no-undef': ['src/components/Greeting.vue:13 eslint(no-undef)'] },
  [FRAMEWORK_FILES.vueMacroInAJsFile]: { 'no-undef': ['src/components/use-greeting.js:2 eslint(no-undef)'] },
  [FRAMEWORK_FILES.astroPage]: { 'no-undef': ['src/pages/index.astro:3 eslint(no-undef)'] },
  [FRAMEWORK_FILES.astroGlobalInAJsFile]: { 'no-undef': ['src/pages/page-title.js:1 eslint(no-undef)'] },
  [FRAMEWORK_FILES.svelteLegacyComponent]: { 'no-undef': ['src/lib/Legacy.svelte:6 eslint(no-undef)'] },
  [FRAMEWORK_FILES.svelteLegacyGlobalInARuneModule]: { 'no-undef': ['src/lib/legacy.svelte.js:1 eslint(no-undef)'] },
  [FRAMEWORK_FILES.svelteStore]: { 'no-undef': [] },
}

/** What oxlint owes in the component subscribing to a store: nothing, as Svelte declares `$count` from the import. */
export const OWED_IN_THE_STORE_COMPONENT = { [FRAMEWORK_FILES.svelteStoreComponent]: { 'no-undef': [] } }

/**
 * What oxlint owes where it runs no-global-assign: each write to a legacy global in the component
 * writing to them, and nothing in the component reading them.
 */
export const OWED_FOR_WRITES_TO_SVELTE_LEGACY_GLOBALS = {
  [FRAMEWORK_FILES.svelteLegacyComponentWritingToItsGlobals]: {
    'no-global-assign': [
      'src/lib/LegacyWrites.svelte:3 eslint(no-global-assign)',
      'src/lib/LegacyWrites.svelte:4 eslint(no-global-assign)',
      'src/lib/LegacyWrites.svelte:5 eslint(no-global-assign)',
    ],
  },
  [FRAMEWORK_FILES.svelteLegacyComponent]: { 'no-global-assign': [] },
}

/** A team oxlint config whose root turns Svelte's `$$props` off, and turns nothing on, not even oxlint's default correctness category. */
export const TEAM_OXLINT_CONFIG_TURNING_SVELTE_PROPS_OFF: OxlintConfig = { categories: { correctness: 'off' }, globals: { $$props: 'off' } }

/**
 * What oxlint owes in the component reading the legacy globals, beside the team's root turning
 * `$$props` off: `$$props` (4), where the team's root setting stands in every file, as its root env
 * does (Q-E), and the name nobody declares (6); not `$$restProps` (3) or `$$slots` (5), which the
 * team leaves to ours.
 */
export const OWED_IN_THE_LEGACY_COMPONENT_BESIDE_A_TEAM_TURNING_PROPS_OFF = {
  [FRAMEWORK_FILES.svelteLegacyComponent]: { 'no-undef': ['src/lib/Legacy.svelte:4 eslint(no-undef)', 'src/lib/Legacy.svelte:6 eslint(no-undef)'] },
}

/**
 * What ESLint owes where it runs no-undef, in a project that lists no oxlint: the framework global
 * in each JS file, under ESLint's name. It lints no component, so owes nothing there.
 */
export const OWED_BY_ESLINT_IN_FRAMEWORK_FILES = {
  [FRAMEWORK_FILES.vueMacroInAJsFile]: { 'no-undef': ['src/components/use-greeting.js:2 no-undef'] },
  [FRAMEWORK_FILES.astroGlobalInAJsFile]: { 'no-undef': ['src/pages/page-title.js:1 no-undef'] },
  [FRAMEWORK_FILES.svelteLegacyGlobalInARuneModule]: { 'no-undef': ['src/lib/legacy.svelte.js:1 no-undef'] },
  [FRAMEWORK_FILES.svelteStore]: { 'no-undef': [] },
}
