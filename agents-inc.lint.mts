/// <reference types="node" />
import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  // What `check` runs on the lines sub-agents change.
  agentRulesets: {
    // Opt-in, so not listed: 'import-order', 'ordering'
    // 'import-order', 'ordering': each sorts code, so it conflicts with a formatter that sorts the same code (Biome, oxfmt's sortImports, a Prettier sort plugin): use one or the other.
    quality: [
      'correctness',
      'type-safety',
      'security',
      'accessibility',
      'performance',
      'complexity',
      'declarative',
      'immutability',
      'modern-js',
      'redundancy',
      'modules',
      'naming',
      'comments',
      'conventions',
      'tests',
    ],
    libs: {
      ui: ['react', 'nextjs', 'react-ssr'],
      testing: ['vitest', 'testing-library', 'storybook', 'playwright', 'jest-dom'],
      forms: ['react-hook-form'],
      // Opt-in, so not listed: 'tailwind'
      styling: ['css-modules', 'class-names'],
      data: ['tanstack-query', 'drizzle'],
      routing: ['tanstack-router'],
      validation: ['zod'],
      auth: ['jsonwebtoken'],
    },
    // Opt-in, so not listed: 'browser-targets'
    runtimes: [
      'node',
      'browser',
    ],
    languages: [],
  },

  // What people's editors show once your team merges it into its own lint configs: add rulesets here.
  editorRulesets: {
    // Opt-in, so not listed: 'import-order', 'ordering'
    // 'import-order', 'ordering': each sorts code, so it conflicts with a formatter that sorts the same code (Biome, oxfmt's sortImports, a Prettier sort plugin): use one or the other.
    quality: [
      'correctness',
      'type-safety',
      'security',
      'accessibility',
      'performance',
      'complexity',
      'declarative',
      'immutability',
      'modern-js',
      'redundancy',
      'modules',
      'naming',
      'comments',
      'conventions',
      'tests',
    ],
    libs: {
      ui: ['react', 'nextjs', 'react-ssr'],
      testing: ['vitest', 'testing-library', 'storybook', 'playwright', 'jest-dom'],
      forms: ['react-hook-form'],
      // Opt-in, so not listed: 'tailwind'
      styling: ['css-modules', 'class-names'],
      data: ['tanstack-query', 'drizzle'],
      routing: ['tanstack-router'],
      validation: ['zod'],
      auth: ['jsonwebtoken'],
    },
    // Opt-in, so not listed: 'browser-targets'
    runtimes: [
      'node',
      'browser',
    ],
    languages: [],
  },

  ignores: [
    '**/build/**',
    '**/coverage/**',
    '**/dist/**',
    '**/.next/**',
    '**/.yarn/**',
    '**/generated/**',
    '**/__generated__/**',
    '**/*.d.ts',
    '**/*.gen.*',
    '**/*.min.js',
    '**/mockServiceWorker.js',
    // Code that breaks rules on purpose, and the copies of the source Stryker makes.
    'packages/lint-rules/test-fixtures/**',
    '.stryker-tmp/**',
  ],

  rules: {},

  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
