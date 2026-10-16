import { buildRulesetDefinition, type InitLists, type InitRulesetDefinition } from '../factories/init-factories.ts'

// Small ruleset catalogs and the exact text init writes for each (q-i6, q30a, q-i7; spec-cli.md
// "The config text"). Data order is not alphabetical, so a sorted list would show.

/**
 * Two opt-in quality rulesets; a testing domain with an opt-in member, whose last member comes after
 * the styling domain in data order; a styling domain whose every member is opt-in; a language.
 */
export const CATALOG_WITH_OPT_IN_RULESETS: readonly InitRulesetDefinition[] = [
  buildRulesetDefinition({ name: 'naming', list: 'quality' }),
  buildRulesetDefinition({ name: 'strict-design-tokens', list: 'quality', optIn: true }),
  buildRulesetDefinition({ name: 'correctness', list: 'quality' }),
  buildRulesetDefinition({ name: 'strict-naming', list: 'quality', optIn: true }),
  buildRulesetDefinition({ name: 'react', list: 'libs', domain: 'ui' }),
  buildRulesetDefinition({ name: 'vitest', list: 'libs', domain: 'testing' }),
  buildRulesetDefinition({ name: 'playwright', list: 'libs', domain: 'testing', optIn: true }),
  buildRulesetDefinition({ name: 'tokens', list: 'libs', domain: 'styling', optIn: true }),
  buildRulesetDefinition({ name: 'testing-library', list: 'libs', domain: 'testing' }),
  buildRulesetDefinition({ name: 'node', list: 'runtimes', env: 'node' }),
  buildRulesetDefinition({ name: 'browser', list: 'runtimes', env: 'browser' }),
  buildRulesetDefinition({ name: 'json', list: 'languages' }),
]

export const TEXT_WITH_OPT_IN_RULESETS = `import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  // What \`check\` runs on the lines sub-agents change.
  agentRulesets: {
    // Opt-in, so not listed: 'strict-design-tokens', 'strict-naming'
    quality: [
      'naming',
      'correctness',
    ],
    libs: {
      ui: ['react'],
      // Opt-in, so not listed: 'playwright'
      testing: ['vitest', 'testing-library'],
      // Opt-in, so not listed: 'tokens'
      styling: [],
    },
    runtimes: [
      'node',
      'browser',
    ],
    languages: [
      'json',
    ],
  },

  // What people's editors show once your team merges it into its own lint configs: add rulesets here.
  editorRulesets: {
    quality: [],
    libs: {},
    runtimes: [],
    languages: [],
  },

  ignores: [
    '**/build/**',
    '**/coverage/**',
    '**/dist/**',
    '**/.next/**',
    '**/.yarn/**',
    '**/*.d.ts',
    '**/*.gen.*',
    '**/*.min.js',
    '**/mockServiceWorker.js',
  ],

  rules: {},

  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
`

/** The lists TEXT_WITH_OPT_IN_RULESETS gives, for the factory that lays out init's text. */
export const LISTS_WITH_OPT_IN_RULESETS: InitLists = {
  quality: { listed: ['naming', 'correctness'], optIn: ['strict-design-tokens', 'strict-naming'] },
  libs: [
    { domain: 'ui', listed: ['react'], optIn: [] },
    { domain: 'testing', listed: ['vitest', 'testing-library'], optIn: ['playwright'] },
    { domain: 'styling', listed: [], optIn: ['tokens'] },
  ],
  runtimes: { listed: ['node', 'browser'], optIn: [] },
  languages: { listed: ['json'], optIn: [] },
}

/** One quality ruleset, no libs, a runtime list whose one ruleset is opt-in, no language. */
export const CATALOG_WITH_AN_EMPTY_FLAT_LIST: readonly InitRulesetDefinition[] = [
  buildRulesetDefinition({ name: 'correctness', list: 'quality' }),
  buildRulesetDefinition({ name: 'deno', list: 'runtimes', env: 'deno', optIn: true }),
]

export const TEXT_WITH_AN_EMPTY_FLAT_LIST = `import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  // What \`check\` runs on the lines sub-agents change.
  agentRulesets: {
    quality: [
      'correctness',
    ],
    libs: {},
    // Opt-in, so not listed: 'deno'
    runtimes: [],
    languages: [],
  },

  // What people's editors show once your team merges it into its own lint configs: add rulesets here.
  editorRulesets: {
    quality: [],
    libs: {},
    runtimes: [],
    languages: [],
  },

  ignores: [
    '**/build/**',
    '**/coverage/**',
    '**/dist/**',
    '**/.next/**',
    '**/.yarn/**',
    '**/*.d.ts',
    '**/*.gen.*',
    '**/*.min.js',
    '**/mockServiceWorker.js',
  ],

  rules: {},

  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
`

export const LISTS_WITH_AN_EMPTY_FLAT_LIST: InitLists = {
  quality: { listed: ['correctness'], optIn: [] },
  libs: [],
  runtimes: { listed: [], optIn: ['deno'] },
  languages: { listed: [], optIn: [] },
}

/**
 * The opt-in rulesets that sort code (owner, 2026-10-15): two in quality, beside an opt-in one that
 * sorts nothing and which the formatter warning leaves out; one in a libs domain, under its domain's
 * comment; and a language that sorts code but is not opt-in, so it is listed under no comment.
 */
export const CATALOG_WITH_SORTING_RULESETS: readonly InitRulesetDefinition[] = [
  buildRulesetDefinition({ name: 'naming', list: 'quality' }),
  buildRulesetDefinition({ name: 'import-order', list: 'quality', optIn: true, sortsCode: true }),
  buildRulesetDefinition({ name: 'strict-naming', list: 'quality', optIn: true }),
  buildRulesetDefinition({ name: 'correctness', list: 'quality' }),
  buildRulesetDefinition({ name: 'ordering', list: 'quality', optIn: true, sortsCode: true }),
  buildRulesetDefinition({ name: 'react', list: 'libs', domain: 'ui' }),
  buildRulesetDefinition({ name: 'css-modules', list: 'libs', domain: 'styling' }),
  buildRulesetDefinition({ name: 'class-order', list: 'libs', domain: 'styling', optIn: true, sortsCode: true }),
  buildRulesetDefinition({ name: 'node', list: 'runtimes', env: 'node' }),
  buildRulesetDefinition({ name: 'json-key-order', list: 'languages', sortsCode: true }),
]

export const TEXT_WITH_SORTING_RULESETS = `import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  // What \`check\` runs on the lines sub-agents change.
  agentRulesets: {
    // Opt-in, so not listed: 'import-order', 'strict-naming', 'ordering'
    // 'import-order', 'ordering': each sorts code, so it conflicts with a formatter that sorts the same code (Biome, oxfmt's sortImports, a Prettier sort plugin): use one or the other.
    quality: [
      'naming',
      'correctness',
    ],
    libs: {
      ui: ['react'],
      // Opt-in, so not listed: 'class-order'
      // 'class-order': each sorts code, so it conflicts with a formatter that sorts the same code (Biome, oxfmt's sortImports, a Prettier sort plugin): use one or the other.
      styling: ['css-modules'],
    },
    runtimes: [
      'node',
    ],
    languages: [
      'json-key-order',
    ],
  },

  // What people's editors show once your team merges it into its own lint configs: add rulesets here.
  editorRulesets: {
    quality: [],
    libs: {},
    runtimes: [],
    languages: [],
  },

  ignores: [
    '**/build/**',
    '**/coverage/**',
    '**/dist/**',
    '**/.next/**',
    '**/.yarn/**',
    '**/*.d.ts',
    '**/*.gen.*',
    '**/*.min.js',
    '**/mockServiceWorker.js',
  ],

  rules: {},

  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
`

export const LISTS_WITH_SORTING_RULESETS: InitLists = {
  quality: { listed: ['naming', 'correctness'], optIn: ['import-order', 'strict-naming', 'ordering'], sortsCode: ['import-order', 'ordering'] },
  libs: [
    { domain: 'ui', listed: ['react'], optIn: [] },
    { domain: 'styling', listed: ['css-modules'], optIn: ['class-order'], sortsCode: ['class-order'] },
  ],
  runtimes: { listed: ['node'], optIn: [] },
  languages: { listed: ['json-key-order'], optIn: [] },
}

/** A libs domain whose name is no JavaScript identifier, beside one whose name is: only the first is quoted as a key. */
export const CATALOG_WITH_A_DOMAIN_TO_QUOTE: readonly InitRulesetDefinition[] = [
  buildRulesetDefinition({ name: 'correctness', list: 'quality' }),
  buildRulesetDefinition({ name: 'react', list: 'libs', domain: 'ui' }),
  buildRulesetDefinition({ name: 'query', list: 'libs', domain: 'data-fetching' }),
]

export const TEXT_WITH_A_DOMAIN_TO_QUOTE = `import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  // What \`check\` runs on the lines sub-agents change.
  agentRulesets: {
    quality: [
      'correctness',
    ],
    libs: {
      ui: ['react'],
      'data-fetching': ['query'],
    },
    runtimes: [],
    languages: [],
  },

  // What people's editors show once your team merges it into its own lint configs: add rulesets here.
  editorRulesets: {
    quality: [],
    libs: {},
    runtimes: [],
    languages: [],
  },

  ignores: [
    '**/build/**',
    '**/coverage/**',
    '**/dist/**',
    '**/.next/**',
    '**/.yarn/**',
    '**/*.d.ts',
    '**/*.gen.*',
    '**/*.min.js',
    '**/mockServiceWorker.js',
  ],

  rules: {},

  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
`
