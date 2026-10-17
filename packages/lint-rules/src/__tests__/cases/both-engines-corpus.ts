import type { OxlintConfig } from 'oxlint'
import type { LintRules } from '../../index.ts'
import type { buildConsumerLintRules } from '../factories/lint-rules-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { OurFields } from './both-engines-grid.ts'

// Projects the editor-merges.*.integration tests lint on both real engines through the built package. Each line
// of the TS source draws one rule, noted beside it; the JS source holds the same lines, types removed. The team
// runs in ESLint the rules our oxlint part runs, and in oxlint those our ESLint part runs.

export type OurRulesets = Parameters<typeof buildConsumerLintRules>[1]

/** Our part runs only the rules our settings state, and those always on. */
export const NO_RULESETS: OurRulesets = {}

type OurRules = NonNullable<LintRules['rules']>

/** The team's oxlint config is the corpus's unless given. */
export type CorpusCase = {
  readonly how: string
  readonly ourRulesets: OurRulesets
  readonly ours: OurFields
  readonly files: readonly string[]
  readonly rules: readonly RuleByItsNames[]
  readonly teamOxlintConfig?: OxlintConfig
}

// ban-ts-comment (1); array-type (2); no-unused-vars (4); prefer-const (5); eqeqeq (6); no-var (8);
// getter-return (9); max-params of 4 or fewer (10); no-undef, for process outside the node runtime (13).
const TS_SOURCE = `// @ts-ignore
export const list: Array<string> = []
export function same(a: number, b: number): boolean {
  const unused = 1
  let neverReassigned = 2
  return a == b && neverReassigned > 0
}
export var counter = 0
export const o = { get x() { } }
export function five(a: number, b: number, c: number, d: number, e: number): number {
  return a + b + c + d + e
}
export const exited = () => process.exit(1)
`

const JS_SOURCE = `// @ts-ignore
export const list = []
export function same(a, b) {
  const unused = 1
  let neverReassigned = 2
  return a == b && neverReassigned > 0
}
export var counter = 0
export const o = { get x() { } }
export function five(a, b, c, d, e) {
  return a + b + c + d + e
}
export const exited = () => process.exit(1)
`

const COMMONJS_SOURCE = `${JS_SOURCE.replaceAll('export ', '')}module.exports = { list, same, counter, o, five, exited }
`

// A type nobody uses (1) and a function of five parameters (2): no-unused-vars reports both.
const DECLARATION_SOURCE = `type Unused = string
declare function five(a: number, b: number, c: number, d: number, e: number): number
export {}
`

/** A .vue file with a plain script holds the JS source, every other component the TS source, one line down. */
const CORPUS_SOURCES: Readonly<Record<string, string>> = {
  'a.js': JS_SOURCE,
  'a.ts': TS_SOURCE,
  'src/a.ts': TS_SOURCE,
  'src/a.js': JS_SOURCE,
  'src/b.mjs': JS_SOURCE,
  'src/b.cjs': COMMONJS_SOURCE,
  'src/c.tsx': TS_SOURCE,
  'src/types.d.ts': DECLARATION_SOURCE,
  'generated/a.ts': TS_SOURCE,
  'legacy/a.ts': TS_SOURCE,
  'legacy/keep/index.js': JS_SOURCE,
  'legacy/keep/deep/b.js': JS_SOURCE,
  'legacy/keep/legacy/c.js': JS_SOURCE,
  'src/legacy/a.ts': TS_SOURCE,
  'src/legacy/keep/index.js': JS_SOURCE,
  'lib/a.ts': TS_SOURCE,
  'lib/sub/c.js': JS_SOURCE,
  'src/lib/a.js': JS_SOURCE,
  'keep/a.js': JS_SOURCE,
  'keep/legacy/a.js': JS_SOURCE,
  'src/keep/a.js': JS_SOURCE,
  'src/keep/legacy/x.js': JS_SOURCE,
  'stories/x.stories.ts': TS_SOURCE,
  'src/c.vue': `<script lang="ts">\n${TS_SOURCE}</script>\n`,
  'src/d.vue': `<script>\n${JS_SOURCE}</script>\n`,
  'src/c.svelte': `<script lang="ts">\n${TS_SOURCE}</script>\n`,
  'src/c.astro': `---\n${TS_SOURCE}---\n`,
}

/** Throws on a file the corpus does not hold. */
export function corpusSourcesOf(files: readonly string[]): Readonly<Record<string, string>> {
  return Object.fromEntries(files.map((file) => [file, corpusSourceOf(file)]))
}

function corpusSourceOf(file: string): string {
  const source = CORPUS_SOURCES[file]
  if (source === undefined) throw new Error(`the corpus holds no ${file}`)
  return source
}

export const EQEQEQ: RuleByItsNames = { rule: 'eqeqeq', names: ['eqeqeq', 'eslint(eqeqeq)'] }
export const ARRAY_TYPE: RuleByItsNames = { rule: '@typescript-eslint/array-type', names: ['@typescript-eslint/array-type', 'typescript(array-type)'] }
export const NO_VAR: RuleByItsNames = { rule: 'no-var', names: ['no-var', 'eslint(no-var)'] }
export const NO_UNUSED_VARS: RuleByItsNames = {
  rule: 'no-unused-vars',
  names: ['no-unused-vars', '@typescript-eslint/no-unused-vars', 'eslint(no-unused-vars)'],
}
export const PREFER_CONST: RuleByItsNames = { rule: 'prefer-const', names: ['prefer-const', 'eslint(prefer-const)'] }
export const GETTER_RETURN: RuleByItsNames = { rule: 'getter-return', names: ['getter-return', 'eslint(getter-return)'] }
export const BAN_TS_COMMENT: RuleByItsNames = {
  rule: '@typescript-eslint/ban-ts-comment',
  names: ['@typescript-eslint/ban-ts-comment', 'typescript(ban-ts-comment)'],
}
export const MAX_PARAMS: RuleByItsNames = { rule: 'max-params', names: ['max-params', '@typescript-eslint/max-params', 'eslint(max-params)'] }

export const CORPUS_RULES: readonly RuleByItsNames[] = [EQEQEQ, ARRAY_TYPE, NO_VAR, NO_UNUSED_VARS, PREFER_CONST, GETTER_RETURN]

const CORPUS_RULE_IDS_THE_TEAM_SETS: ReadonlySet<string> = new Set([...CORPUS_RULES.map(({ rule }) => rule), BAN_TS_COMMENT.rule, MAX_PARAMS.rule, 'no-undef'])

export function corpusRulesTheTeamSets(rules: readonly RuleByItsNames[]): string[] {
  return rules.map(({ rule }) => rule).filter((ruleId) => CORPUS_RULE_IDS_THE_TEAM_SETS.has(ruleId))
}

/** Three our oxlint part runs, two our ESLint part runs, and no-unused-vars, a twin. */
export const OUR_CORPUS_RULES = {
  eqeqeq: 'error',
  '@typescript-eslint/array-type': 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
  'prefer-const': 'error',
  'getter-return': 'error',
} as const satisfies OurRules

/** For settings that turn eqeqeq on only in an entry. */
export const OUR_CORPUS_RULES_BUT_EQEQEQ = {
  '@typescript-eslint/array-type': 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
  'prefer-const': 'error',
  'getter-return': 'error',
} as const satisfies OurRules

/** For settings that turn prefer-const, which our oxlint part runs, on only in an entry. */
export const OUR_CORPUS_RULES_BUT_PREFER_CONST = {
  eqeqeq: 'error',
  '@typescript-eslint/array-type': 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
  'getter-return': 'error',
} as const satisfies OurRules

/** For settings that turn array-type on only in an entry. */
export const OUR_CORPUS_RULES_BUT_ARRAY_TYPE = {
  eqeqeq: 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
  'prefer-const': 'error',
  'getter-return': 'error',
} as const satisfies OurRules

/** Those our oxlint part runs, max-params at its default of 3, and the twins of typescript-eslint. */
export const TEAM_CORPUS_ESLINT_RULES = {
  eqeqeq: 'error',
  'prefer-const': 'error',
  'getter-return': 'error',
  'max-params': 'error',
  '@typescript-eslint/no-unused-vars': 'error',
  '@typescript-eslint/ban-ts-comment': 'error',
} as const

export const TEAM_CORPUS_JS_AND_TS_EXTENSIONS: readonly string[] = ['js', 'mjs', 'cjs', 'ts', 'tsx']

/** The rules our ESLint part runs, and no-undef; nothing by category. */
export const TEAM_CORPUS_OXLINT_CONFIG: OxlintConfig = {
  plugins: ['typescript'],
  categories: { correctness: 'off' },
  rules: { 'typescript/array-type': 'error', 'no-var': 'error', 'no-undef': 'error' },
}

/** Also turns on the core rule of each twin pair the corpus holds: no-unused-vars, and max-params at oxlint's default of 3. */
export const TEAM_CORPUS_OXLINT_CONFIG_TURNING_TWIN_CORE_RULES_ON: OxlintConfig = {
  plugins: ['typescript'],
  categories: { correctness: 'off' },
  rules: { 'typescript/array-type': 'error', 'no-var': 'error', 'no-undef': 'error', 'no-unused-vars': 'error', 'max-params': 'error' },
}
