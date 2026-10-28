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
    // Code that breaks rules on purpose, the copies of the source Stryker makes, and the folder the agents-inc CLI writes.
    'packages/lint-rules/test-fixtures/**',
    '.stryker-tmp/**',
    '.agents-inc/**',
  ],

  rules: {},

  fileOverrides: [
    {
      // ESLint calls a function in `files`, but its types hold only globs there: filesEntryAlsoMatching casts to them.
      files: ['packages/lint-rules/src/core/eslint-file-types.ts'],
      rules: { '@typescript-eslint/no-unsafe-type-assertion': 'off' },
    },
    {
      // ESLint calls a rule's listeners and uses nothing they return, so a rule reports and gathers what it walks
      // through side effects, and RuleTester takes vitest's hooks as assignments to it. `{*[!t],…}` names each file in
      // rules/ but the tests (the names ending in `.test`), as both engines read it: oxlint reads no extglob.
      files: [
        'packages/eslint-plugin-house/src/rules/{*[!t],*[!s]t,*[!e]st,*[!t]est,*[!.]test}.ts',
        'packages/eslint-plugin-house/src/shared/**',
        'packages/eslint-plugin-house/src/__tests__/house-rule-tester.ts',
      ],
      rules: { 'functional/immutable-data': 'off', 'functional/no-expression-statements': 'off', 'functional/no-return-void': 'off' },
    },
    {
      // A type test makes its assertions in calls at its top level, which tsc checks and nothing runs, and proves an
      // API missing by using it under `@ts-expect-error`, where the unsafe rules see a type that could not be resolved.
      files: ['**/*.test-d.ts'],
      rules: {
        'unicorn/no-top-level-side-effects': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
      },
    },
    {
      // A Stryker config drops the build it spreads in with `buildCommand: undefined`: Stryker refuses `null` there,
      // and leaving the key out by a rest-sibling omit draws oxlint's default no-unused-vars, which runs in config files.
      files: ['stryker.*.config.mjs'],
      rules: { 'sonarjs/no-undefined-assignment': 'off' },
    },
  ],
})

export const { eslint, oxlint } = config.editorRulesets
