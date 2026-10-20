// Never run: typecheck fails when an `@ts-expect-error` below stops meeting a type error, or an
// allowed call beside it stops compiling.
import { join } from 'node:path'
import {
  buildConsumerLintRulesWithoutAgentRulesets,
  buildConsumerLintRulesWithoutEditorRulesets,
  buildEveryRulesetLintRules,
  EMPTY_TSCONFIG_ROOT_DIR,
} from './__tests__/factories/lint-rules-factories.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules, type LintRules } from './index.ts'
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

// allowSuppressions sets the suppression rules, so the types refuse each one named in rules, as below, though not
// in every shape (the KNOWN GAP further down; docs/plan.md, Open, "Written limit of the config's types").
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

// An entry's files name at least one glob, none led by `/`, which names no file in either engine.
defineLintRules({
  ...allowed,
  fileOverrides: [
    { files: ['x.ts'], rules: { 'no-debugger': 'off' } },
    { files: ['./x.ts'], rules: { 'no-debugger': 'off' } },
    { files: ['**/*.ts'], rules: { 'no-debugger': 'off' } },
    { files: ['src/**', 'lib/**'], rules: { 'no-debugger': 'off' } },
  ],
})

defineLintRules({ ...allowed, fileOverrides: [] })

// A `/` in the top-level ignores anchors the glob at the root, as in a .gitignore line.
defineLintRules({ ...allowed, ignores: ['/a.js'] })

const GLOBS_HELD_AS_CONST = ['legacy/**', './scripts/*.ts'] as const

defineLintRules({ ...allowed, fileOverrides: [{ files: GLOBS_HELD_AS_CONST, rules: { 'no-debugger': 'off' } }] })

const GLOBS_TYPED_AS_A_NON_EMPTY_LIST: readonly [string, ...string[]] = ['generated/**']

defineLintRules({ ...allowed, fileOverrides: [{ files: GLOBS_TYPED_AS_A_NON_EMPTY_LIST, rules: { 'no-debugger': 'off' } }] })

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error files names at least one glob
    { files: [], rules: { 'no-debugger': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    { files: ['apps/api/**'], rules: { 'no-debugger': 'off' } },
    // @ts-expect-error files names at least one glob, beside an entry that names one
    { files: [], rules: { 'no-debugger': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error files can't start with /: write ./x.ts
    { files: ['/x.ts'], rules: { 'no-debugger': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error files can't start with /, in a list whose other glob does not
    { files: ['src/**', '/x.ts'], rules: { 'no-debugger': 'off' } },
  ],
})

defineLintRules({
  ...allowed,
  fileOverrides: [
    { files: ['**/*.test.ts'], rules: { 'max-lines': 'off' } },
    // @ts-expect-error files can't start with /, beside entries whose globs do not
    { files: ['/x.ts'], rules: { 'no-debugger': 'off' } },
    { files: ['apps/api/**'], agentRulesets: { runtimes: ['node'] } },
  ],
})

const GLOBS_HELD_AS_A_STRING_LIST: string[] = ['legacy/**']

defineLintRules({
  ...allowed,
  fileOverrides: [
    // @ts-expect-error a string[] may hold no glob: write the list inline, or as const
    { files: GLOBS_HELD_AS_A_STRING_LIST, rules: { 'no-debugger': 'off' } },
  ],
})

// TypeScript refuses an unknown key only in an object written in place, so rules and libs held in a const are
// checked key by key: the error lands on the key the const is given to. Each call below spreads a config as a team
// writes agents-inc.lint.mts, its types inferred; the two after them spread one typed LintRules.
const WRITTEN_AS_A_TEAM_WRITES_IT = {
  tsconfigRootDir: EMPTY_TSCONFIG_ROOT_DIR,
  agentRulesets: { quality: ['correctness'] },
  editorRulesets: { quality: ['correctness'] },
} satisfies LintRules

const RULES_HELD_BESIDE_AN_UNKNOWN_ID = { 'no-debugger': 'off', 'not-a/rule': 'error' } as const

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  // @ts-expect-error no shipped rule is called not-a/rule, in rules held in a const beside a known ID
  rules: RULES_HELD_BESIDE_AN_UNKNOWN_ID,
})

const RULES_HELD_BESIDE_A_SUPPRESSION_RULE = { 'no-debugger': 'off', 'house/no-suppressions': 'off' } as const

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  // @ts-expect-error house/no-suppressions is set by allowSuppressions, in rules held in a const beside a known ID
  rules: RULES_HELD_BESIDE_A_SUPPRESSION_RULE,
})

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [
    // @ts-expect-error no shipped rule is called not-a/rule, in an entry's rules held in a const
    { files: ['legacy/**'], rules: RULES_HELD_BESIDE_AN_UNKNOWN_ID },
  ],
})

const RULES_TYPED_BY_ANY_ID: Record<string, 'off'> = { 'no-debugger': 'off' }

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  // @ts-expect-error a Record<string, ...> may name a rule we do not ship: hold the rules as const
  rules: RULES_TYPED_BY_ANY_ID,
})

const RULES_TYPED_BY_ANY_ID_WITH_A_SUPPRESSION_RULE: Record<string, 'off'> = { 'no-debugger': 'off', 'house/no-suppressions': 'off' }

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [
    // @ts-expect-error a Record<string, ...> may name a rule we do not ship, in an entry too: hold the rules as const
    { files: ['legacy/**'], rules: RULES_TYPED_BY_ANY_ID_WITH_A_SUPPRESSION_RULE },
  ],
})

const LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN = { ui: ['react'], database: ['react'] } as const

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  agentRulesets: {
    ...WRITTEN_AS_A_TEAM_WRITES_IT.agentRulesets,
    // @ts-expect-error no libs domain is called database, in libs held in a const beside a known domain
    libs: LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN,
  },
})

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [
    // @ts-expect-error no libs domain is called database, in an entry's editor set too
    { files: ['apps/web/**'], editorRulesets: { libs: LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN } },
  ],
})

const RULES_HELD_AS_CONST = { 'no-debugger': 'off', 'max-lines': ['error', { max: 400 }] } as const

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  rules: RULES_HELD_AS_CONST,
  fileOverrides: [{ files: ['legacy/**'], rules: RULES_HELD_AS_CONST }],
})

const LIBS_HELD_AS_CONST = { ui: ['react'], testing: ['vitest'] } as const

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  agentRulesets: { ...WRITTEN_AS_A_TEAM_WRITES_IT.agentRulesets, libs: LIBS_HELD_AS_CONST },
  fileOverrides: [{ files: ['apps/web/**'], editorRulesets: { libs: LIBS_HELD_AS_CONST } }],
})

// Spread over a config typed LintRules, whose every place gives every rule ID and libs domain, a const is checked as
// above.
defineLintRules({
  ...allowed,
  // @ts-expect-error no shipped rule is called not-a/rule, in rules held in a const, spread over a config typed LintRules
  rules: RULES_HELD_BESIDE_AN_UNKNOWN_ID,
})

defineLintRules({
  ...allowed,
  agentRulesets: {
    ...allowed.agentRulesets,
    // @ts-expect-error no libs domain is called database, in libs held in a const, spread over a config typed LintRules
    libs: LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN,
  },
})

// An entry's agent and editor sets are checked apart, so an agent set typed as a LintRules entry's gives its libs
// domains to no editor set beside it.
const AN_AGENT_SET_TYPED_AS_AN_ENTRYS: NonNullable<NonNullable<LintRules['fileOverrides']>[number]['agentRulesets']> = {
  libs: { ui: ['react'] },
}

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [
    {
      files: ['apps/web/**'],
      agentRulesets: AN_AGENT_SET_TYPED_AS_AN_ENTRYS,
      // @ts-expect-error no libs domain is called database, in an entry's editor set beside an agent set typed LintRules
      editorRulesets: { libs: LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN },
    },
  ],
})

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [{ files: ['apps/web/**'], agentRulesets: AN_AGENT_SET_TYPED_AS_AN_ENTRYS, editorRulesets: { libs: LIBS_HELD_AS_CONST } }],
})

// The rules allowSuppressions sets are names the types know, so a value typed LintRules, or any part of it, refuses
// them in a const it holds too, where the const's own type lists them, as `as const` does; under an index signature it
// does not (KNOWN GAP below).
const AN_ENTRY_TYPED_AS_ONE: NonNullable<LintRules['fileOverrides']>[number] = { files: ['legacy/**'], rules: { 'no-debugger': 'off' } }

const ENTRIES_TYPED_AS_LINT_RULES_ONES: NonNullable<LintRules['fileOverrides']> = [AN_ENTRY_TYPED_AS_ONE]

const A_CONFIG_TYPED_AS_ONE_WITH_A_SUPPRESSION_RULE: LintRules = {
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [
    // @ts-expect-error house/no-suppressions is set by allowSuppressions, in an entry's rules held in a const, in a config typed LintRules
    { files: ['legacy/**'], rules: RULES_HELD_BESIDE_A_SUPPRESSION_RULE },
  ],
}

defineLintRules(A_CONFIG_TYPED_AS_ONE_WITH_A_SUPPRESSION_RULE)

// @ts-expect-error house/no-suppressions is set by allowSuppressions, in rules held in a const typed as LintRules' rules
export const RULES_TYPED_AS_LINT_RULES_ONES_WITH_A_SUPPRESSION_RULE: LintRules['rules'] = RULES_HELD_BESIDE_A_SUPPRESSION_RULE

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [
    AN_ENTRY_TYPED_AS_ONE,
    // @ts-expect-error house/no-suppressions is set by allowSuppressions, in an entry's rules held in a const beside an entry typed LintRules
    { files: ['apps/**'], rules: RULES_HELD_BESIDE_A_SUPPRESSION_RULE },
  ],
})

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [
    // @ts-expect-error house/no-suppressions is set by allowSuppressions, in the entry below, reported at the spread too
    ...ENTRIES_TYPED_AS_LINT_RULES_ONES,
    // @ts-expect-error house/no-suppressions is set by allowSuppressions, in an entry's rules held in a const beside entries typed LintRules
    { files: ['apps/**'], rules: RULES_HELD_BESIDE_A_SUPPRESSION_RULE },
  ],
})

const A_CONFIG_TYPED_AS_ONE: LintRules = {
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  rules: RULES_HELD_AS_CONST,
  fileOverrides: [{ files: ['legacy/**'], rules: RULES_HELD_AS_CONST }],
}

defineLintRules(A_CONFIG_TYPED_AS_ONE)

const RULES_TYPED_AS_LINT_RULES_ONES: LintRules['rules'] = RULES_HELD_AS_CONST

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  rules: RULES_TYPED_AS_LINT_RULES_ONES,
  fileOverrides: [...ENTRIES_TYPED_AS_LINT_RULES_ONES, { files: ['apps/**'], rules: RULES_HELD_AS_CONST }],
})

// KNOWN GAP: a value typed LintRules, or any part of it, checks a const it holds only on the names both its type and
// the const's list, and their values: TypeScript refuses an unknown key only in an object written in place, and such a
// type, unlike defineLintRules, infers no names to check them against. An unknown rule ID or libs domain beside a
// known one goes unchecked, and under an index signature (`Record<string, ...>`, what `Object.fromEntries` returns),
// whose type lists no name, every name and value does, the rules allowSuppressions sets included. Given to
// defineLintRules, the value hands the call every rule ID and libs domain, which an entry beside a typed one takes
// too. So each call below compiles (what follows at run time, such as an entry switching the suppression ban off:
// docs/plan.md, Open). Once the types refuse them, each stops compiling here: put a `// @ts-expect-error <why>` over
// the line the error lands on, as above.
const A_CONFIG_TYPED_AS_ONE_WITH_AN_UNKNOWN_ID: LintRules = { ...WRITTEN_AS_A_TEAM_WRITES_IT, rules: RULES_HELD_BESIDE_AN_UNKNOWN_ID }

defineLintRules(A_CONFIG_TYPED_AS_ONE_WITH_AN_UNKNOWN_ID)

const A_CONFIG_TYPED_AS_ONE_WITH_AN_UNKNOWN_DOMAIN: LintRules = {
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  agentRulesets: { libs: LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN },
}

defineLintRules(A_CONFIG_TYPED_AS_ONE_WITH_AN_UNKNOWN_DOMAIN)

const A_CONFIG_TYPED_AS_ONE_WITH_A_SUPPRESSION_RULE_TYPED_BY_ANY_ID: LintRules = {
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [{ files: ['legacy/**'], rules: RULES_TYPED_BY_ANY_ID_WITH_A_SUPPRESSION_RULE }],
}

defineLintRules(A_CONFIG_TYPED_AS_ONE_WITH_A_SUPPRESSION_RULE_TYPED_BY_ANY_ID)

const RULES_TYPED_AS_LINT_RULES_ONES_WITH_AN_UNKNOWN_ID: LintRules['rules'] = RULES_HELD_BESIDE_AN_UNKNOWN_ID

defineLintRules({ ...WRITTEN_AS_A_TEAM_WRITES_IT, rules: RULES_TYPED_AS_LINT_RULES_ONES_WITH_AN_UNKNOWN_ID })

defineLintRules({ ...WRITTEN_AS_A_TEAM_WRITES_IT, fileOverrides: [AN_ENTRY_TYPED_AS_ONE, { files: ['apps/**'], rules: RULES_HELD_BESIDE_AN_UNKNOWN_ID }] })

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [AN_ENTRY_TYPED_AS_ONE, { files: ['apps/web/**'], agentRulesets: { libs: LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN } }],
})

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  fileOverrides: [...ENTRIES_TYPED_AS_LINT_RULES_ONES, { files: ['apps/**'], rules: RULES_HELD_BESIDE_AN_UNKNOWN_ID }],
})

// tsconfigRootDir is the absolute path of a folder: `import.meta.dirname`, as init writes it, or one written out.
defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  // @ts-expect-error tsconfigRootDir is an absolute path
  tsconfigRootDir: '.',
})

defineLintRules({
  ...WRITTEN_AS_A_TEAM_WRITES_IT,
  // @ts-expect-error tsconfigRootDir is an absolute path, even one leading back to the config's folder
  tsconfigRootDir: 'src/..',
})

defineLintRules({ ...WRITTEN_AS_A_TEAM_WRITES_IT, tsconfigRootDir: import.meta.dirname })

defineLintRules({ ...WRITTEN_AS_A_TEAM_WRITES_IT, tsconfigRootDir: '/repo/app' })

defineLintRules({ ...WRITTEN_AS_A_TEAM_WRITES_IT, tsconfigRootDir: 'C:\\work\\app' })

defineLintRules({ ...WRITTEN_AS_A_TEAM_WRITES_IT, tsconfigRootDir: '\\\\server\\share\\app' })

// A path a call returns is a string, which the types do not judge, as they do not judge import.meta.dirname: the
// check run as the config loads refuses a relative one, such as this `.`.
defineLintRules({ ...WRITTEN_AS_A_TEAM_WRITES_IT, tsconfigRootDir: join('src', '..') })

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
