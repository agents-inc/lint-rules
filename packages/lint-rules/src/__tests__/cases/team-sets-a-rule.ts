import type { OxlintConfig } from 'oxlint'
import type { LintRules } from '../../index.ts'
import { CONSUMER_CONFIG_FILES, mergedEslintConfigText, teamAloneEslintConfigText, teamBlockSourceOf } from '../factories/consumer-project-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from '../team-configs-of-the-other-engine.ts'

// The projects the owner's model is checked in on both real CLIs, through the built package
// (editor-merges.team-sets-a-rule.integration.test.ts; spec-merge-model.md, 4.1). Each source line
// draws the rule noted beside it; lines were measured with ESLint 10.12 and oxlint 1.87.

type OurRules = NonNullable<LintRules['rules']>

export const NO_WARNING_COMMENTS: RuleByItsNames = { rule: 'no-warning-comments', names: ['no-warning-comments', 'eslint(no-warning-comments)'] }
export const NO_DEBUGGER: RuleByItsNames = { rule: 'no-debugger', names: ['no-debugger', 'eslint(no-debugger)'] }
export const ARRAY_TYPE: RuleByItsNames = { rule: '@typescript-eslint/array-type', names: ['@typescript-eslint/array-type', 'typescript(array-type)'] }
export const NO_VAR: RuleByItsNames = { rule: 'no-var', names: ['no-var', 'eslint(no-var)'] }
export const NO_UNUSED_VARS: RuleByItsNames = {
  rule: 'no-unused-vars',
  names: ['no-unused-vars', '@typescript-eslint/no-unused-vars', 'eslint(no-unused-vars)'],
}
export const NO_UNUSED_EXPRESSIONS: RuleByItsNames = {
  rule: 'no-unused-expressions',
  names: ['no-unused-expressions', '@typescript-eslint/no-unused-expressions', 'eslint(no-unused-expressions)'],
}
export const MAX_LINES: RuleByItsNames = { rule: 'max-lines', names: ['max-lines', 'eslint(max-lines)'] }
export const FLOATING_PROMISES: RuleByItsNames = {
  rule: '@typescript-eslint/no-floating-promises',
  names: ['@typescript-eslint/no-floating-promises', 'typescript(no-floating-promises)'],
}
export const NO_THIS_ALIAS: RuleByItsNames = { rule: '@typescript-eslint/no-this-alias', names: ['@typescript-eslint/no-this-alias', 'typescript(no-this-alias)'] }
export const NO_DUPLICATE_ENUM_VALUES: RuleByItsNames = {
  rule: '@typescript-eslint/no-duplicate-enum-values',
  names: ['@typescript-eslint/no-duplicate-enum-values', 'typescript(no-duplicate-enum-values)'],
}
export const NO_UNREACHABLE_LOOP: RuleByItsNames = { rule: 'no-unreachable-loop', names: ['no-unreachable-loop', 'eslint(no-unreachable-loop)'] }
export const JSX_NO_COMMENT_TEXTNODES: RuleByItsNames = {
  rule: 'react/jsx-no-comment-textnodes',
  names: ['react/jsx-no-comment-textnodes', '@eslint-react/jsx-no-comment-textnodes', 'react(jsx-no-comment-textnodes)'],
}

// oxlint's no-warning-comments reports todo (1) and fixme (3) by default, which ESLint's under the
// team's terms leaves alone; ESLint's under the team's terms reports hack (2). no-debugger (5).
export const WARNING_COMMENTS_SOURCE = `// todo: oxlint's default terms
// hack: the team's ESLint terms
// fixme: oxlint's default terms, and the team's oxlint terms
export function stop(): void {
  debugger
}
`

// An array type array-simple and oxlint's default report (1), and one only generic reports (2); no-var (3).
export const ARRAY_TYPE_SOURCE = `export const simple: Array<string> = []
export const bracketed: string[] = []
export var counter = 0
`

// no-unused-vars (2); no-unused-expressions, which allows no short circuit by default (3); no-debugger (4).
export const UNUSED_SOURCE = `export function stop(flag: boolean): void {
  const unused = 1
  flag && stop(false)
  debugger
}
`

// no-debugger (2); max-lines under a max of 2 (3).
export const DEBUGGER_SOURCE = `export function stop(): void {
  debugger
}
`

// `this` aliased to a variable (4).
export const THIS_ALIAS_SOURCE = `export class Counter {
  count = 0
  bump(): () => number {
    const self = this
    return () => self.count++
  }
}
`

// `this` aliased to a variable (4); an enum giving two members one value (8).
export const THIS_ALIAS_AND_DUPLICATE_ENUM_SOURCE = `${THIS_ALIAS_SOURCE}export enum Letter { A = 'a', B = 'a' }
`

// A loop that returns on its first pass (2).
export const UNREACHABLE_LOOP_SOURCE = `export function first(items: readonly number[]): number | undefined {
  for (const item of items) {
    return item
  }
  return undefined
}
`

// A comment written as JSX text (1); no-debugger (3).
export const COMMENT_AS_JSX_TEXT_AND_DEBUGGER_SOURCE = `export const Note = () => <div>// note</div>
export function stop(): void {
  debugger
}
`

// A promise left floating (4), which only a typed rule reports.
export const FLOATING_PROMISE_SOURCE = `async function load(): Promise<number> {
  return 1
}
load()
export {}
`

/** Our rules turned on for no-warning-comments' scenarios: oxlint runs both. */
export const OURS_WARNING_COMMENTS_AND_DEBUGGER: OurRules = { 'no-warning-comments': 'error', 'no-debugger': 'error' }

/** The team's ESLint block running no-warning-comments under its own terms in every JS and TS file. */
export const TEAMS_ESLINT_WARNING_COMMENTS = teamBlockSourceOf({ files: ['**/*.{js,ts}'], rules: { 'no-warning-comments': ['error', { terms: ['hack'] }] } })

/** The team's oxlint config running no-warning-comments under its own terms, and nothing by category. */
export const TEAMS_OXLINT_WARNING_COMMENTS: OxlintConfig = { categories: { correctness: 'off' }, rules: { 'no-warning-comments': ['warn', { terms: ['fixme'] }] } }

/** Our array-type, which ESLint runs, and no-var, which ESLint runs too. */
export const OURS_ARRAY_TYPE_AND_NO_VAR: OurRules = { '@typescript-eslint/array-type': 'error', 'no-var': 'error' }

/** The team's oxlint config running array-type under generic, and nothing by category. */
export const TEAMS_OXLINT_ARRAY_TYPE: OxlintConfig = {
  plugins: ['typescript'],
  categories: { correctness: 'off' },
  rules: { 'typescript/array-type': ['error', { default: 'generic' }] },
}

/** A team oxlint config turning style on for the plugins given at its root. */
export function teamsOxlintStyleCategoryListing(plugins: NonNullable<OxlintConfig['plugins']>): OxlintConfig {
  return { plugins, categories: { correctness: 'off', style: 'warn' } }
}

/**
 * A team oxlint config whose root lists the plugins given, typescript listed for legacy/** alone, its
 * categories left out. Under a root listing some plugin, the override's listing runs typescript's
 * rules of each category on in legacy/**, oxlint's own correctness: warn included; under a root
 * listing none, in no file (measured, oxlint 1.87).
 */
export function teamsOxlintListingTypescriptForLegacyBeside(rootPlugins: NonNullable<OxlintConfig['plugins']>): OxlintConfig {
  return { plugins: rootPlugins, overrides: [{ files: ['legacy/**'], plugins: ['typescript'] }] }
}

/** The same, turning style on and correctness off. */
export function teamsOxlintStyleCategoryListingTypescriptForLegacyBeside(rootPlugins: NonNullable<OxlintConfig['plugins']>): OxlintConfig {
  return { ...teamsOxlintListingTypescriptForLegacyBeside(rootPlugins), categories: { correctness: 'off', style: 'warn' } }
}

/** A team oxlint config extending an object that turns no-var on. */
export const TEAMS_OXLINT_EXTENDING_AN_OBJECT_TURNING_NO_VAR_ON: OxlintConfig = { categories: { correctness: 'off' }, extends: [{ rules: { 'no-var': 'warn' } }] }

/** typescript-eslint's recommended config, as a team spreads it into its own. */
export const TYPESCRIPT_ESLINT_RECOMMENDED = '...tseslint.configs.recommended'

/** Our no-unused-vars, no-unused-expressions and no-debugger: oxlint runs all three. */
export const OURS_UNUSED_AND_DEBUGGER: OurRules = { 'no-unused-vars': 'error', 'no-unused-expressions': 'error', 'no-debugger': 'error' }

/**
 * typescript-eslint's no-unused-vars alone, ours, which ESLint runs: oxlint has no copy of it, but its
 * twin, the core no-unused-vars, is in oxlint's correctness category under eslint, which always runs.
 */
export const OURS_TYPESCRIPT_ESLINT_UNUSED_VARS: OurRules = { '@typescript-eslint/no-unused-vars': 'error' }

/** typescript-eslint's no-unused-vars and no-debugger, ours: typescript-eslint's twin of the core rule oxlint runs, and a core rule. */
export const OURS_TYPESCRIPT_ESLINT_UNUSED_VARS_AND_DEBUGGER: OurRules = { '@typescript-eslint/no-unused-vars': 'error', 'no-debugger': 'error' }

/** The team's ESLint block registering typescript-eslint and running its twin of no-unused-vars alone, by its source. */
export const TEAMS_ESLINT_TWIN_OF_NO_UNUSED_VARS =
  "{ files: ['**/*.{js,ts}'], plugins: { '@typescript-eslint': tseslint.plugin }, rules: { '@typescript-eslint/no-unused-vars': 'error' } }"

/** The team's oxlint config running the core no-unused-vars alone. */
export const TEAMS_OXLINT_NO_UNUSED_VARS: OxlintConfig = { categories: { correctness: 'off' }, rules: { 'no-unused-vars': 'warn' } }

/** Our no-debugger, which oxlint runs, and max-lines under a max of 2, which ESLint runs. */
export const OURS_DEBUGGER_AND_MAX_LINES: OurRules = { 'no-debugger': 'error', 'max-lines': ['error', { max: 2 }] }

/** The team's oxlint override turning no-debugger off in legacy/** alone. */
export const TEAMS_OXLINT_DEBUGGER_OFF_IN_LEGACY: OxlintConfig = {
  categories: { correctness: 'off' },
  overrides: [{ files: ['legacy/**'], rules: { 'no-debugger': 'off' } }],
}

/** The team's ESLint block running max-lines under a max of 2 in legacy/** alone. */
export const TEAMS_ESLINT_MAX_LINES_IN_LEGACY = teamBlockSourceOf({ files: ['legacy/**'], rules: { 'max-lines': ['error', { max: 2 }] } })

/** Our no-debugger alone. */
export const OURS_DEBUGGER: OurRules = { 'no-debugger': 'error' }

/** A team oxlint config with no key at all: oxlint runs its own correctness: warn, which the team does not write. */
export const TEAMS_OXLINT_LEAVING_EVERY_KEY_OUT: OxlintConfig = {}

/** A team oxlint config writing correctness on, at oxlint's own severity for it, its default plugins left as they are. */
export const TEAMS_OXLINT_WRITING_CORRECTNESS_ON: OxlintConfig = { categories: { correctness: 'warn' } }

/** A team oxlint config writing nursery on, at a warning, and correctness off: the category runs its nursery rules (measured, oxlint 1.87). */
export const TEAMS_OXLINT_WRITING_NURSERY_ON: OxlintConfig = { categories: { correctness: 'off', nursery: 'warn' } }

/** Our typescript-eslint no-this-alias alone, which ESLint runs; oxlint's version is in its correctness category, under typescript, a default plugin. */
export const OURS_NO_THIS_ALIAS: OurRules = { '@typescript-eslint/no-this-alias': 'error' }

/** Our no-unreachable-loop alone, which oxlint runs; oxlint's version is a nursery rule. */
export const OURS_UNREACHABLE_LOOP: OurRules = { 'no-unreachable-loop': 'error' }

/** eslint-plugin-react's jsx-no-comment-textnodes and no-debugger, ours: oxlint runs both. */
export const OURS_COMMENT_TEXTNODES_AND_DEBUGGER: OurRules = { 'react/jsx-no-comment-textnodes': 'error', 'no-debugger': 'error' }

/** The import a team's ESLint config module gives @eslint-react's plugin by. */
export const ESLINT_REACT_IMPORT = "import eslintReact from '@eslint-react/eslint-plugin'"

/**
 * The team's ESLint block registering @eslint-react under react, as antfu's config does, the prefix
 * our eslint-plugin-react rules take, and setting jsx-no-comment-textnodes there, by its source.
 */
export const TEAMS_ESLINT_ESLINT_REACT_UNDER_REACT =
  "{ files: ['**/*.tsx'], plugins: { react: eslintReact }, rules: { 'react/jsx-no-comment-textnodes': 'error' } }"

/** Our typed no-floating-promises alone. */
export const OURS_FLOATING_PROMISES: OurRules = { '@typescript-eslint/no-floating-promises': 'error' }

/** A team oxlint config turning correctness on as an error for typescript too, type-aware rules on or left out. */
export function teamsOxlintCorrectnessErrors(typeAware: boolean): OxlintConfig {
  const correctness: OxlintConfig = { plugins: ['typescript'], categories: { correctness: 'error' } }
  return typeAware ? { ...correctness, options: { typeAware: true } } : correctness
}

/** The team's JSON oxlint config, which no merge of ours can write into, and the config at the path it extends. */
export const TEAMS_JSON_OXLINT_CONFIG = 'team.oxlintrc.json'
const BASE_JSON_OXLINT_CONFIG = 'base.json'
const MISSING_JSON_OXLINT_CONFIG = 'missing.json'

/**
 * A team's JSON oxlint config extending base.json by path, which turns no-var on, and an
 * eslint.config.mjs merging our part, naming that config. Where the base is missing, the path names
 * no file.
 */
export function teamsJsonOxlintConfigExtendingByPathFiles(base: 'present' | 'missing'): Readonly<Record<string, string>> {
  const extended = base === 'present' ? BASE_JSON_OXLINT_CONFIG : MISSING_JSON_OXLINT_CONFIG
  const { lintRules, teamEslintModule, eslint, teamAloneEslint } = CONSUMER_CONFIG_FILES
  return {
    [TEAMS_JSON_OXLINT_CONFIG]: `${JSON.stringify({ ...EMPTY_TEAM_OXLINT_CONFIG, extends: [`./${extended}`] })}\n`,
    [BASE_JSON_OXLINT_CONFIG]: `${JSON.stringify({ rules: { 'no-var': 'warn' } })}\n`,
    [eslint]: mergedEslintConfigText(lintRules, teamEslintModule, { oxlintConfig: TEAMS_JSON_OXLINT_CONFIG }),
    [teamAloneEslint]: teamAloneEslintConfigText(teamEslintModule),
  }
}

/** A block turning no-debugger off, which a team adds after our merge rather than handing it to the merge. */
export const BLOCK_TURNING_NO_DEBUGGER_OFF = teamBlockSourceOf({ rules: { 'no-debugger': 'off' } })
