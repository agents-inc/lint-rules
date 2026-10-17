import type { OxlintConfig } from 'oxlint'
import type { ProjectFiles } from '../temp-projects.ts'

// Globals a framework's compiler gives its own component files alone: Vue 3.5.44's `<script setup>` macros
// (`MACROS`, @vue/compiler-sfc), Astro 7.3.8's `Astro` (astro/env.d.ts), and Svelte 5.57.2's legacy globals
// (`RESERVED`, 2-analyze/index.js). Each component also uses one undeclared name, and a JS file beside it uses
// the framework's global, which it does not have.

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

// Writes to each legacy global (3 to 5). Svelte 5.57.2 compiles them as constants (transform-client.js),
// so our oxlint part gives them as read-only globals and no-global-assign reports each write.
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

// A store subscription (3): `$` plus an imported store's name, which no list of globals can hold.
const STORE_COMPONENT = `<script>
  import { count } from './count.js'
  const doubled = $count * 2
</script>

<p>{doubled}</p>
`

const COUNT_STORE = `export const count = { subscribe: () => () => {} }
`

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

export const JS_FILES_USING_A_FRAMEWORK_GLOBAL = [
  FRAMEWORK_FILES.vueMacroInAJsFile,
  FRAMEWORK_FILES.astroGlobalInAJsFile,
  FRAMEWORK_FILES.svelteLegacyGlobalInARuneModule,
]

/** What no-undef owes in oxlint: the undeclared name in Vue and Astro components, the global in each JS file. */
export const OWED_BY_OXLINT_IN_FRAMEWORK_FILES = {
  [FRAMEWORK_FILES.vueComponent]: { 'no-undef': ['src/components/Greeting.vue:13 eslint(no-undef)'] },
  [FRAMEWORK_FILES.vueMacroInAJsFile]: { 'no-undef': ['src/components/use-greeting.js:2 eslint(no-undef)'] },
  [FRAMEWORK_FILES.astroPage]: { 'no-undef': ['src/pages/index.astro:3 eslint(no-undef)'] },
  [FRAMEWORK_FILES.astroGlobalInAJsFile]: { 'no-undef': ['src/pages/page-title.js:1 eslint(no-undef)'] },
  [FRAMEWORK_FILES.svelteLegacyComponent]: { 'no-undef': [] },
  [FRAMEWORK_FILES.svelteLegacyGlobalInARuneModule]: { 'no-undef': ['src/lib/legacy.svelte.js:1 eslint(no-undef)'] },
  [FRAMEWORK_FILES.svelteStore]: { 'no-undef': [] },
}

/** Nothing: Svelte declares `$count` from the import, and no-undef is off in .svelte files. */
export const OWED_IN_THE_STORE_COMPONENT = { [FRAMEWORK_FILES.svelteStoreComponent]: { 'no-undef': [] } }

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

export const TEAM_OXLINT_CONFIG_TURNING_SVELTE_PROPS_OFF: OxlintConfig = { categories: { correctness: 'off' }, globals: { $$props: 'off' } }

/** The team's root `$$props: off` makes it no global: only the writes to `$$restProps` (4) and `$$slots` (5) are owed. */
export const OWED_IN_THE_WRITING_COMPONENT_BESIDE_A_TEAM_TURNING_PROPS_OFF = {
  [FRAMEWORK_FILES.svelteLegacyComponentWritingToItsGlobals]: {
    'no-global-assign': ['src/lib/LegacyWrites.svelte:4 eslint(no-global-assign)', 'src/lib/LegacyWrites.svelte:5 eslint(no-global-assign)'],
  },
}

/** ESLint, in a project listing no oxlint, lints no component: only each JS file's framework global. */
export const OWED_BY_ESLINT_IN_FRAMEWORK_FILES = {
  [FRAMEWORK_FILES.vueMacroInAJsFile]: { 'no-undef': ['src/components/use-greeting.js:2 no-undef'] },
  [FRAMEWORK_FILES.astroGlobalInAJsFile]: { 'no-undef': ['src/pages/page-title.js:1 no-undef'] },
  [FRAMEWORK_FILES.svelteLegacyGlobalInARuneModule]: { 'no-undef': ['src/lib/legacy.svelte.js:1 no-undef'] },
  [FRAMEWORK_FILES.svelteStore]: { 'no-undef': [] },
}
