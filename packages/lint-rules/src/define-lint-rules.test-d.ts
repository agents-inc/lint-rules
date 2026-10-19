// Never run: typecheck fails when an `@ts-expect-error` below stops meeting a type error, or an
// allowed call beside it stops compiling.
import {
  buildConsumerLintRulesWithoutAgentRulesets,
  buildConsumerLintRulesWithoutEditorRulesets,
  buildEveryRulesetLintRules,
  EMPTY_TSCONFIG_ROOT_DIR,
} from './__tests__/factories/lint-rules-factories.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

const allowed = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR)

defineLintRules(allowed)

defineLintRules({
  tsconfigRootDir: EMPTY_TSCONFIG_ROOT_DIR,
  agentRulesets: { quality: ['correctness'], libs: {}, runtimes: [] },
  editorRulesets: { quality: ['naming'], libs: {}, runtimes: ['node'] },
})

// @ts-expect-error tsconfigRootDir is required
defineLintRules({ agentRulesets: allowed.agentRulesets, editorRulesets: allowed.editorRulesets })

// @ts-expect-error agentRulesets is required
defineLintRules(buildConsumerLintRulesWithoutAgentRulesets(EMPTY_TSCONFIG_ROOT_DIR))

// @ts-expect-error editorRulesets is required
defineLintRules(buildConsumerLintRulesWithoutEditorRulesets(EMPTY_TSCONFIG_ROOT_DIR))

defineLintRules({
  ...allowed,
  // @ts-expect-error rulesets is not a key of the config: it is agentRulesets and editorRulesets
  rulesets: allowed.agentRulesets,
})

// A list left out of a top-level set is empty, as in a file override.
defineLintRules({ ...allowed, agentRulesets: { quality: ['correctness'], libs: {} } })

defineLintRules({ ...allowed, editorRulesets: { quality: ['correctness'], libs: {} } })

defineLintRules({ ...allowed, editorRulesets: {} })

defineLintRules({ tsconfigRootDir: EMPTY_TSCONFIG_ROOT_DIR, agentRulesets: { runtimes: ['node'] }, editorRulesets: {} })

defineLintRules({
  ...allowed,
  // @ts-expect-error no ruleset is called not-a-ruleset, in a set leaving lists out too
  editorRulesets: { quality: ['not-a-ruleset'] },
})

defineLintRules({
  ...allowed,
  // @ts-expect-error database is not a libs domain, in a set leaving lists out too
  agentRulesets: { libs: { database: ['react'] } },
})

// @ts-expect-error editorRulesets is required: a set left out altogether is not an empty one
defineLintRules({ tsconfigRootDir: EMPTY_TSCONFIG_ROOT_DIR, agentRulesets: {} })

defineLintRules({
  ...allowed,
  // @ts-expect-error presets is not a key of the config
  presets: ['strict'],
})

defineLintRules({ ...allowed, agentRulesets: { ...allowed.agentRulesets, quality: ['correctness', 'naming'] } })

defineLintRules({ ...allowed, editorRulesets: { ...allowed.editorRulesets, quality: ['correctness', 'naming'] } })

defineLintRules({
  ...allowed,
  // @ts-expect-error no ruleset is called not-a-ruleset
  agentRulesets: { ...allowed.agentRulesets, quality: ['correctness', 'not-a-ruleset'] },
})

defineLintRules({
  ...allowed,
  // @ts-expect-error no ruleset is called not-a-ruleset, in the editor set either
  editorRulesets: { ...allowed.editorRulesets, quality: ['correctness', 'not-a-ruleset'] },
})

defineLintRules({
  ...allowed,
  // @ts-expect-error react is a libs ruleset, not a quality one
  agentRulesets: { ...allowed.agentRulesets, quality: ['correctness', 'react'] },
})

defineLintRules({
  ...allowed,
  // @ts-expect-error correctness is a quality ruleset, not a runtime
  agentRulesets: { ...allowed.agentRulesets, runtimes: ['node', 'correctness'] },
})

defineLintRules({ ...allowed, agentRulesets: { ...allowed.agentRulesets, languages: [] } })

defineLintRules({
  ...allowed,
  // @ts-expect-error no language ruleset exists yet
  agentRulesets: { ...allowed.agentRulesets, languages: ['json'] },
})

defineLintRules({ ...allowed, agentRulesets: { ...allowed.agentRulesets, libs: { testing: ['vitest', 'storybook'] } } })

defineLintRules({
  ...allowed,
  // @ts-expect-error react belongs to the ui domain, not testing
  agentRulesets: { ...allowed.agentRulesets, libs: { testing: ['vitest', 'react'] } },
})

defineLintRules({ ...allowed, agentRulesets: { ...allowed.agentRulesets, libs: { data: ['drizzle'] } } })

defineLintRules({
  ...allowed,
  // @ts-expect-error zod belongs to the validation domain, not data
  agentRulesets: { ...allowed.agentRulesets, libs: { data: ['zod'] } },
})

defineLintRules({
  ...allowed,
  editorRulesets: {
    ...allowed.editorRulesets,
    libs: {
      ui: ['react'],
      // @ts-expect-error database is not a libs domain
      database: ['react'],
    },
  },
})

defineLintRules({
  ...allowed,
  rules: {
    'max-lines': ['error', { max: 400 }],
    'react/no-array-index-key': 'warn',
    'unicorn/no-null': 'error',
    'house/max-hooks-per-component': ['error', { max: 6 }],
    'no-debugger': 'off',
  },
})

// allowSuppressions alone decides the suppression rules, so none of them can be set in rules.
defineLintRules({ ...allowed, allowSuppressions: false })

defineLintRules({
  ...allowed,
  allowSuppressions: true,
  fileOverrides: [
    { files: ['strict/**'], allowSuppressions: false },
    { files: ['legacy/**'], allowSuppressions: true, rules: { 'no-debugger': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  // @ts-expect-error allowSuppressions is true or false
  allowSuppressions: 'yes',
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error allowSuppressions is true or false in a file override too
    { files: ['legacy/**'], allowSuppressions: 'yes' },
  ],
})

defineLintRules({
  ...allowed,
  rules: {
    'no-debugger': 'off',
    // @ts-expect-error house/no-suppressions is set by allowSuppressions
    'house/no-suppressions': 'off',
  },
})

defineLintRules({
  ...allowed,
  rules: {
    'no-debugger': 'off',
    // @ts-expect-error @typescript-eslint/ban-ts-comment is set by allowSuppressions
    '@typescript-eslint/ban-ts-comment': 'warn',
  },
})

defineLintRules({
  ...allowed,
  rules: {
    'no-debugger': 'off',
    // @ts-expect-error unicorn/no-abusive-eslint-disable is set by allowSuppressions
    'unicorn/no-abusive-eslint-disable': 'error',
  },
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error house/no-suppressions is set by allowSuppressions, in a file override too
    { files: ['legacy/**'], rules: { 'house/no-suppressions': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error @typescript-eslint/ban-ts-comment is set by allowSuppressions, in a file override too
    { files: ['legacy/**'], rules: { '@typescript-eslint/ban-ts-comment': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error unicorn/no-abusive-eslint-disable is set by allowSuppressions, in a file override too
    { files: ['legacy/**'], rules: { 'unicorn/no-abusive-eslint-disable': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  rules: {
    'no-debugger': 'error',
    // @ts-expect-error not-a/rule is no rule ID
    'not-a/rule': 'error',
  },
})

defineLintRules({
  ...allowed,
  rules: {
    // @ts-expect-error warning is not a severity
    'no-debugger': 'warning',
  },
})

defineLintRules({
  ...allowed,
  rules: {
    // @ts-expect-error the options must follow a severity
    'max-lines': ['warning', { max: 400 }],
  },
})

// An entry may give either set, both, or neither.
defineLintRules({
  ...allowed,
  fileOverrides: [
    { files: ['apps/api/**'], agentRulesets: { runtimes: ['node'], libs: {} } },
    { files: ['apps/web/**'], editorRulesets: { runtimes: ['browser'] } },
    { files: ['apps/cli/**'], agentRulesets: { runtimes: ['node'] }, editorRulesets: { runtimes: ['node'] } },
    { files: ['**/*.test.ts'], rules: { '@typescript-eslint/no-non-null-assertion': 'off', 'max-lines': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error rulesets is not a key of an entry: it is agentRulesets and editorRulesets
    { files: ['apps/api/**'], rulesets: { runtimes: ['node'] } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error vitest belongs to the testing domain, not ui
    { files: ['apps/web/**'], agentRulesets: { libs: { ui: ['vitest'] } } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error vitest belongs to the testing domain, not ui, in the editor set too
    { files: ['apps/web/**'], editorRulesets: { libs: { ui: ['vitest'] } } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error not-a/rule is no rule ID
    { files: ['**/*.test.ts'], rules: { 'not-a/rule': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error ignores is not a key of a file override
    { files: ['**/*.test.ts'], ignores: ['**/fixtures/**'] },
  ],
})

// What `agents-inc.lint.mts` exports, and what the team's engine configs do with it.
const config = defineLintRules(allowed)

export const { eslint, oxlint } = config.editorRulesets

// @ts-expect-error the agent set is not visible on what defineLintRules returns
export const agentRulesets = config.agentRulesets

// @ts-expect-error no rulesets key is visible on what defineLintRules returns
export const rulesets = config.rulesets

// The team's ESLint config may be anything ESLint's defineConfig takes: an object, an array, nested
// arrays. Each merge's third argument names the team's other engine config, or null where there is none.
mergeEslintConfig({ rules: { 'no-console': 'error' } }, eslint, { oxlintConfig: 'oxlint.config.mts' })

mergeEslintConfig([{ rules: { 'no-console': 'error' } }, { ignores: ['dist/**'] }], eslint, { oxlintConfig: null })

mergeEslintConfig([[{ rules: { 'no-console': 'error' } }], { files: ['**/*.ts'] }], eslint, { oxlintConfig: 'oxlint.config.mts' })

// @ts-expect-error a number is no ESLint config
mergeEslintConfig(42, eslint, { oxlintConfig: null })

// @ts-expect-error the path of the team's oxlint config is required
mergeEslintConfig({ rules: { 'no-console': 'error' } }, eslint)

// @ts-expect-error oxlintConfig is a path or null
mergeEslintConfig({ rules: { 'no-console': 'error' } }, eslint, { oxlintConfig: 42 })

// The oxlint part is undefined when the project lists no oxlint, and the team's file passes it as it is.
mergeOxlintConfig({ rules: { 'no-console': 'error' } }, oxlint, { eslintConfig: 'eslint.config.mjs' })

mergeOxlintConfig({ rules: { 'no-console': 'error' } }, oxlint, { eslintConfig: null })

// @ts-expect-error a number is no oxlint config
mergeOxlintConfig(42, oxlint, { eslintConfig: null })

// @ts-expect-error the path of the team's ESLint config is required
mergeOxlintConfig({ rules: { 'no-console': 'error' } }, oxlint)

// @ts-expect-error eslintConfig is a path or null
mergeOxlintConfig({ rules: { 'no-console': 'error' } }, oxlint, { eslintConfig: 42 })
