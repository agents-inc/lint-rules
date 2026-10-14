import type { OxlintConfig } from 'oxlint'
import type { LintRules } from '../../index.ts'
import type { buildConsumerLintRules } from '../factories/lint-rules-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { OurFields } from './both-engines-grid.ts'

// Projects from the developer's break corpus (fix round 2), which the editor-merges.*.integration
// tests lint on both real engines through the built package. Each line of the TS source draws one
// rule, noted beside it; the JS source holds the same lines, types removed; the CommonJS source
// exports through module.exports. The team runs in ESLint the rules our oxlint part runs, and in
// oxlint those our ESLint part runs, as the developer's corpus did.

/** The rulesets our part lists, by set. */
export type OurRulesets = Parameters<typeof buildConsumerLintRules>[1]

/** No ruleset in either set: our part runs only the rules our settings state, and those always on. */
export const NO_RULESETS: OurRulesets = {}

type OurRules = NonNullable<LintRules['rules']>

/** A project of the corpus: our settings, the files it holds, the rules each test reads in them, and the team's oxlint config, the corpus's unless given. */
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

/** Every file of the corpus, by its path. A .vue file with a plain script holds the JS source, every other component the TS source, one line down. */
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

/** The sources of the files given, each from the corpus: throws on a file it does not hold. */
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

/** The rules our corpus settings turn on, by every name either engine reports them under. */
export const CORPUS_RULES: readonly RuleByItsNames[] = [EQEQEQ, ARRAY_TYPE, NO_VAR, NO_UNUSED_VARS, PREFER_CONST, GETTER_RETURN]

/** Every rule the corpus team's two configs set, by its ID: each corpus rule, ban-ts-comment, max-params and no-undef. */
const CORPUS_RULE_IDS_THE_TEAM_SETS: ReadonlySet<string> = new Set([...CORPUS_RULES.map(({ rule }) => rule), BAN_TS_COMMENT.rule, MAX_PARAMS.rule, 'no-undef'])

/** Of the rules given, the IDs of those the corpus team's two configs set (decisions.md, "Owner 2026-10-14": each is the team's). */
export function corpusRulesTheTeamSets(rules: readonly RuleByItsNames[]): string[] {
  return rules.map(({ rule }) => rule).filter((ruleId) => CORPUS_RULE_IDS_THE_TEAM_SETS.has(ruleId))
}

/** Our rules in the corpus: three our oxlint part runs, two our ESLint part runs, and no-unused-vars, a twin. */
export const OUR_CORPUS_RULES = {
  eqeqeq: 'error',
  '@typescript-eslint/array-type': 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
  'prefer-const': 'error',
  'getter-return': 'error',
} as const satisfies OurRules

/** Our corpus rules but eqeqeq, for settings that turn it on only in an entry. */
export const OUR_CORPUS_RULES_BUT_EQEQEQ = {
  '@typescript-eslint/array-type': 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
  'prefer-const': 'error',
  'getter-return': 'error',
} as const satisfies OurRules

/** Our corpus rules but prefer-const, which our oxlint part runs, for settings that turn it on only in an entry. */
export const OUR_CORPUS_RULES_BUT_PREFER_CONST = {
  eqeqeq: 'error',
  '@typescript-eslint/array-type': 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
  'getter-return': 'error',
} as const satisfies OurRules

/** Our corpus rules but array-type, for settings that turn it on only in an entry. */
export const OUR_CORPUS_RULES_BUT_ARRAY_TYPE = {
  eqeqeq: 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
  'prefer-const': 'error',
  'getter-return': 'error',
} as const satisfies OurRules

/** The team's ESLint rules in the corpus: those our oxlint part runs, max-params at its default of 3, and the twins of typescript-eslint. */
export const TEAM_CORPUS_ESLINT_RULES = {
  eqeqeq: 'error',
  'prefer-const': 'error',
  'getter-return': 'error',
  'max-params': 'error',
  '@typescript-eslint/no-unused-vars': 'error',
  '@typescript-eslint/ban-ts-comment': 'error',
} as const

/** The extensions of the JS and TS files the team's ESLint config lints in the corpus. */
export const TEAM_CORPUS_JS_AND_TS_EXTENSIONS: readonly string[] = ['js', 'mjs', 'cjs', 'ts', 'tsx']

/** The team's oxlint config in the corpus: the rules our ESLint part runs, and no-undef, nothing by category. */
export const TEAM_CORPUS_OXLINT_CONFIG: OxlintConfig = {
  plugins: ['typescript'],
  categories: { correctness: 'off' },
  rules: { 'typescript/array-type': 'error', 'no-var': 'error', 'no-undef': 'error' },
}

/**
 * The team's oxlint config in the corpus, also turning on the core rule of each twin pair the corpus
 * holds (D12): no-unused-vars and max-params, at oxlint's default of 3.
 */
export const TEAM_CORPUS_OXLINT_CONFIG_TURNING_TWIN_CORE_RULES_ON: OxlintConfig = {
  plugins: ['typescript'],
  categories: { correctness: 'off' },
  rules: { 'typescript/array-type': 'error', 'no-var': 'error', 'no-undef': 'error', 'no-unused-vars': 'error', 'max-params': 'error' },
}
