import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  agentRulesets: {
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
      'import-order',
      'naming',
      'comments',
      'ordering',
      'conventions',
      'tests',
    ],
    libs: {
      ui: ['react'],
      testing: ['vitest', 'testing-library', 'storybook'],
      forms: ['react-hook-form'],
      styling: ['css-modules'],
    },
    runtimes: [
      'node',
      'browser',
    ],
    languages: [],   // no JSON, Markdown or CSS rules exist yet
  },

  editorRulesets: {
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
      'import-order',
      'naming',
      'comments',
      'ordering',
      'conventions',
      'tests',
    ],
    libs: {
      ui: ['react'],
      testing: ['vitest', 'testing-library', 'storybook'],
      forms: ['react-hook-form'],
      styling: ['css-modules'],
    },
    runtimes: [
      'node',
      'browser',
    ],
    languages: [],
  },

  ignores: [],

  rules: {},

  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
