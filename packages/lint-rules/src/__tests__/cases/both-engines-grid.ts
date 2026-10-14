import type { OxlintConfig } from 'oxlint'
import type { LintRules } from '../../index.ts'
import type { TeamGlobalIgnoresBlock, TeamIgnoresFunction } from '../factories/consumer-project-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'

// The projects the editor merges are checked in on both real engines, through the built package
// (editor-merges.both-engines.integration.test.ts). Each source line draws one rule, noted beside it.
// The team lints its .vue, .svelte and .astro files in ESLint through a parser of its own: a stand-in
// that parses the script block's lines and blanks the rest, so every finding keeps its line.

/** The settings our part is made from beside its rulesets: rules, entries and ignores. */
export type OurFields = Pick<LintRules, 'rules' | 'fileOverrides' | 'ignores'>

type OurRules = NonNullable<LintRules['rules']>

/** A rule of ours on the grid, by its ID. */
export type GridRuleId = keyof typeof OUR_GRID_RULES

/**
 * One of our rules on the grid: every name either engine reports it under, its typescript-eslint
 * twin's included, the one the team's configs alone report it under, and the engine they run it in.
 */
export type GridRule = RuleByItsNames & { readonly rule: GridRuleId; readonly teamsName: string; readonly teamsEngine: 'eslint' | 'oxlint' }

/** A way our settings keep our rules out of some files, which each engine reads its own way. */
export type GridRow = { readonly how: string; readonly ours: OurFields }

/** A kind of source the grid holds: its text, and the line of each rule's finding in it, null where it cannot draw the rule. */
type GridSource = { readonly text: string; readonly lines: Readonly<Record<GridRuleId, number | null>> }

// typescript/array-type under array-simple (1); no-unused-vars (3), which oxlint's reports in no
// .vue, .svelte or .astro file, at the top level or in a function (measured, oxlint 1.87);
// no-debugger (4); no-var (6).
const TS_SOURCE = `export const list: Array<string> = []
export function stop(): void {
  const unused = 1
  debugger
}
export var counter = 0
`

const TS: GridSource = { text: TS_SOURCE, lines: { 'no-debugger': 4, '@typescript-eslint/array-type': 1, 'no-var': 6, 'no-unused-vars': 3 } }

// no-unused-vars (2); no-debugger (3); no-var (5). JS has no array type to draw array-type.
const JS: GridSource = {
  text: `export function stop() {
  const unused = 1
  debugger
}
export var counter = 0
`,
  lines: { 'no-debugger': 3, '@typescript-eslint/array-type': null, 'no-var': 5, 'no-unused-vars': 2 },
}

// The TS source one line down, in a .vue or .svelte file's script block, or an .astro file's frontmatter.
const ONE_LINE_DOWN = { 'no-debugger': 5, '@typescript-eslint/array-type': 2, 'no-var': 7, 'no-unused-vars': 4 } as const
const SCRIPT_BLOCK: GridSource = { text: `<script lang="ts">\n${TS_SOURCE}</script>\n`, lines: ONE_LINE_DOWN }
const FRONTMATTER: GridSource = { text: `---\n${TS_SOURCE}---\n`, lines: ONE_LINE_DOWN }

/**
 * Files in and out of each way our settings keep our rules out: a folder named generated, legacy,
 * vendor or gen at the root and in src, a folder legacy/keep inside legacy, two files in lib, a.js at
 * the root and in src, and a .vue, .svelte and .astro file; and a file in node_modules, at the root
 * and in a nested package, which ESLint never lints and the agent build's oxlint config leaves out.
 */
const GRID_SOURCES: Readonly<Record<string, GridSource>> = {
  'a.js': JS,
  'a.ts': TS,
  'src/a.ts': TS,
  'src/a.js': JS,
  'generated/a.ts': TS,
  'src/generated/a.ts': TS,
  'legacy/a.ts': TS,
  'legacy/keep/index.js': JS,
  'src/legacy/a.ts': TS,
  'vendor/a.ts': TS,
  'src/vendor/a.ts': TS,
  'gen/a.ts': TS,
  'src/gen/a.ts': TS,
  'lib/a.ts': TS,
  'lib/b.ts': TS,
  'src/c.vue': SCRIPT_BLOCK,
  'src/c.svelte': SCRIPT_BLOCK,
  'src/c.astro': FRONTMATTER,
  'node_modules/x/a.js': JS,
  'packages/p/node_modules/y/a.js': JS,
}

export const gridSourceFiles: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(GRID_SOURCES).map(([file, { text }]) => [file, text]),
)

export const GRID_FILES = Object.keys(GRID_SOURCES)

/** The grid's files in a node_modules folder: ESLint lints none of them, whatever its config (its default ignores). */
const FILES_IN_NODE_MODULES: readonly string[] = ['node_modules/x/a.js', 'packages/p/node_modules/y/a.js']

/** Files oxlint lints, and ESLint lints only through a team's parser of its own: no JS or TS file. */
export const COMPONENT_FILES: readonly string[] = ['src/c.vue', 'src/c.svelte', 'src/c.astro']

/** The grid's JS and TS files, which our ESLint part lints. */
export const GRID_JS_AND_TS_FILES = GRID_FILES.filter((file) => !COMPONENT_FILES.includes(file))

export const OUR_GRID_RULES = {
  'no-debugger': 'error',
  '@typescript-eslint/array-type': 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
} as const satisfies OurRules

/**
 * Our rules on the grid, each turned on by the team in the other engine: no-debugger and
 * no-unused-vars, which our oxlint part runs, the team runs in ESLint, no-unused-vars as
 * typescript-eslint's twin;
 * array-type and no-var, which our ESLint part runs, the team runs in oxlint. no-var shows ESLint's
 * reading of our ignores in JS files too, where array-type draws nothing.
 */
export const GRID_RULES: readonly GridRule[] = [
  { rule: 'no-debugger', names: ['no-debugger', 'eslint(no-debugger)'], teamsName: 'no-debugger', teamsEngine: 'eslint' },
  {
    rule: '@typescript-eslint/array-type',
    names: ['@typescript-eslint/array-type', 'typescript(array-type)'],
    teamsName: 'typescript(array-type)',
    teamsEngine: 'oxlint',
  },
  { rule: 'no-var', names: ['no-var', 'eslint(no-var)'], teamsName: 'eslint(no-var)', teamsEngine: 'oxlint' },
  {
    rule: 'no-unused-vars',
    names: ['no-unused-vars', '@typescript-eslint/no-unused-vars', 'eslint(no-unused-vars)'],
    teamsName: '@typescript-eslint/no-unused-vars',
    teamsEngine: 'eslint',
  },
]

/** Every rule on the grid: the team turns each on in one of its configs, so each is the team's (decisions.md, "Owner 2026-10-14"). */
export const GRID_RULES_THE_TEAM_SETS: readonly string[] = GRID_RULES.map(({ rule }) => rule)

/** The rules the team's ESLint config turns on in every file it lints: the two our oxlint part runs, no-unused-vars as its twin. */
export const TEAM_GRID_ESLINT_RULES = { 'no-debugger': 'error', '@typescript-eslint/no-unused-vars': 'error' } as const

/** The team's oxlint config turning on the two rules our ESLint part runs, and nothing by category. */
export const TEAM_GRID_OXLINT_CONFIG: OxlintConfig = {
  plugins: ['typescript'],
  categories: { correctness: 'off' },
  rules: { 'typescript/array-type': 'error', 'no-var': 'error' },
}

const OUR_GRID_RULES_OFF = { 'no-debugger': 'off', '@typescript-eslint/array-type': 'off', 'no-var': 'off', 'no-unused-vars': 'off' } as const satisfies OurRules

export const GRID_ROWS: readonly GridRow[] = [
  { how: 'our ignores name a folder bare, generated', ours: { ignores: ['generated'] } },
  { how: 'our ignores name a folder with a trailing slash, legacy/', ours: { ignores: ['legacy/'] } },
  { how: 'our ignores name a folder with a trailing slash, vendor/', ours: { ignores: ['vendor/'] } },
  { how: 'our ignores name a folder at any depth with a trailing slash, **/gen/', ours: { ignores: ['**/gen/'] } },
  { how: 'our ignores name every file under a folder, vendor/**', ours: { ignores: ['vendor/**'] } },
  { how: 'our ignores name a file bare, a.js', ours: { ignores: ['a.js'] } },
  { how: 'our ignores name a file with a leading ./, ./src/a.ts', ours: { ignores: ['./src/a.ts'] } },
  { how: 'our ignores name lib/** and a negated line taking lib/a.ts back', ours: { ignores: ['lib/**', '!lib/a.ts'] } },
  { how: 'our ignores name lib/**/* and a negated line taking lib/a.ts back', ours: { ignores: ['lib/**/*', '!lib/a.ts'] } },
  { how: 'our ignores name legacy/ and a negated line taking legacy/keep/ back', ours: { ignores: ['legacy/', '!legacy/keep/'] } },
  { how: 'an entry of ours turns the rules off in lib/**', ours: { fileOverrides: [{ files: ['lib/**'], rules: OUR_GRID_RULES_OFF }] } },
]

/**
 * What the team's configs alone report on the grid, by file, then by rule: each rule in every file
 * that can draw it and the engine the team turns it on in lints, under that engine's name for it.
 * oxlint, given no ignore of the team's, lints the files in node_modules too (measured, oxlint 1.87).
 */
export function teamAloneFindingsOnTheGrid(): Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> {
  return Object.fromEntries(
    Object.entries(GRID_SOURCES).map(([file, { lines }]) => [
      file,
      Object.fromEntries(
        GRID_RULES.map(({ rule, teamsName, teamsEngine }) => [rule, findingAt(file, lintsTheFile(teamsEngine, file) ? lines[rule] : null, teamsName)]),
      ),
    ]),
  )
}

/** A TS file in src, and a JS and a TS file of a package in node_modules, each holding the grid's source of its kind. */
export const nodeModulesSourceFiles: Readonly<Record<string, string>> = {
  'src/a.ts': TS.text,
  'node_modules/x/a.js': JS.text,
  'node_modules/x/b.ts': TS.text,
}

/** The team's ESLint global ignores, taking back every node_modules folder ESLint's default ignores leave out. */
export const TEAM_GLOBAL_IGNORES_TAKING_NODE_MODULES_BACK: TeamGlobalIgnoresBlock = { ignores: ['!**/node_modules/'] }

/**
 * A team's ESLint global ignores taking files back from ESLint's default ignores, and a project of
 * the grid's sources holding files they take back.
 */
export type TeamTakeBackCase = {
  readonly how: string
  readonly sources: Readonly<Record<string, string>>
  readonly teamEslintGlobalIgnores: TeamGlobalIgnoresBlock
  /** The project's files the team's ESLint config lints, alone and merged: those its global ignores take back among them. */
  readonly lintedByTheTeamsEslint: readonly string[]
  /** Whether oxlint is given each source file, as an editor gives it the file it opens: its walk of the project skips every .git folder. */
  readonly oxlintGivenEachSourceFile?: true
}

/** A function in a team's ignores that leaves out no file. */
const A_FUNCTION_LEAVING_OUT_NO_FILE: TeamIgnoresFunction = { functionSource: '() => false' }

/** The node_modules sources, and a JS file in dist/keep, which dist/ read from the project's parent leaves in. */
const nodeModulesAndDistSourceFiles: Readonly<Record<string, string>> = { ...nodeModulesSourceFiles, 'dist/keep/a.js': JS.text }

/**
 * Team global ignores taking files back from ESLint's default ignores, each a way the merge must
 * read: the root .git folder, the second default; node_modules in packages/p from that basePath,
 * which leaves packages/q out; every node_modules folder from a basePath outside the project, its
 * parent, which still reaches every file of it (measured, ESLint 10.12), alone and after a glob
 * that is not negated, so that a block taking files back is told by any negated glob, not every
 * glob; and every node_modules folder after a function, which no glob stands for.
 */
export const TEAM_TAKE_BACK_CASES: readonly TeamTakeBackCase[] = [
  {
    how: 'take the root .git folder back: !.git/',
    sources: { 'src/a.ts': TS.text, '.git/a.js': JS.text, '.git/b.ts': TS.text },
    teamEslintGlobalIgnores: { ignores: ['!.git/'] },
    lintedByTheTeamsEslint: ['src/a.ts', '.git/a.js', '.git/b.ts'],
    oxlintGivenEachSourceFile: true,
  },
  {
    how: 'take node_modules back in packages/p, from that basePath: packages/p, !node_modules/',
    sources: {
      'src/a.ts': TS.text,
      'packages/p/node_modules/x/a.js': JS.text,
      'packages/p/node_modules/x/b.ts': TS.text,
      'packages/q/node_modules/x/a.js': JS.text,
    },
    teamEslintGlobalIgnores: { basePath: 'packages/p', ignores: ['!node_modules/'] },
    lintedByTheTeamsEslint: ['src/a.ts', 'packages/p/node_modules/x/a.js', 'packages/p/node_modules/x/b.ts'],
  },
  {
    how: 'take every node_modules folder back, from a basePath outside the project, its parent: .., !**/node_modules/',
    sources: nodeModulesSourceFiles,
    teamEslintGlobalIgnores: { basePath: '..', ignores: ['!**/node_modules/'] },
    lintedByTheTeamsEslint: Object.keys(nodeModulesSourceFiles),
  },
  {
    how: 'leave dist/ out, then take every node_modules folder back, from a basePath outside the project, its parent: .., dist/, !**/node_modules/',
    sources: nodeModulesAndDistSourceFiles,
    teamEslintGlobalIgnores: { basePath: '..', ignores: ['dist/', '!**/node_modules/'] },
    lintedByTheTeamsEslint: Object.keys(nodeModulesAndDistSourceFiles),
  },
  {
    how: 'hold a function leaving out no file, then take every node_modules folder back: !**/node_modules/',
    sources: nodeModulesSourceFiles,
    teamEslintGlobalIgnores: { ignores: [A_FUNCTION_LEAVING_OUT_NO_FILE, '!**/node_modules/'] },
    lintedByTheTeamsEslint: Object.keys(nodeModulesSourceFiles),
  },
]

/**
 * A TS file in src, and a JS and a TS file in a .git folder inside it, each holding the grid's source
 * of its kind: ESLint's default ignores leave out the root .git folder alone, so ESLint lints these
 * with no take-back, and oxlint walking the project skips every .git folder (measured, ESLint 10.12,
 * oxlint 1.87).
 */
export const nestedGitSourceFiles: Readonly<Record<string, string>> = {
  'src/a.ts': TS.text,
  'src/.git/a.js': JS.text,
  'src/.git/b.ts': TS.text,
}

/**
 * A JS file in src and two packages in node_modules, one of which our ignores take back from ESLint's
 * default ignores as ESLint documents it, each holding the grid's JS source: no-unused-vars (2),
 * no-debugger (3), no-var (5).
 */
export const packageTakenBackSourceFiles: Readonly<Record<string, string>> = {
  'src/a.js': JS.text,
  'node_modules/mylib/a.js': JS.text,
  'node_modules/other/a.js': JS.text,
}

/** Our no-var, which our ESLint part runs, and no-unused-vars, which our oxlint part runs, beside ignores taking node_modules/mylib back. */
export const OURS_TAKING_A_PACKAGE_BACK_FROM_ESLINT_DEFAULTS: OurFields = {
  rules: { 'no-var': 'error', 'no-unused-vars': 'error' },
  ignores: ['!node_modules/', 'node_modules/*', '!node_modules/mylib/'],
}

/** The team's oxlint config turning on no-var, which our ESLint part runs, and nothing by category. */
export const TEAM_OXLINT_CONFIG_TURNING_NO_VAR_ON: OxlintConfig = { categories: { correctness: 'off' }, rules: { 'no-var': 'error' } }

/** Whether the engine lints the file with a config that ignores nothing: ESLint lints no file in node_modules. */
function lintsTheFile(engine: GridRule['teamsEngine'], file: string): boolean {
  return engine === 'oxlint' || !FILES_IN_NODE_MODULES.includes(file)
}

/** A finding as `file:line name`, none where the line is null. */
function findingAt(file: string, line: number | null, name: string): string[] {
  return line === null ? [] : [`${file}:${String(line)} ${name}`]
}

// no-debugger (2); no-unused-vars, which oxlint's reports in no component file (3).
const DEBUGGER_SOURCE = `export function stop(): void {
  debugger
  const unused = 1
}
`

export const NO_DEBUGGER: RuleByItsNames = { rule: 'no-debugger', names: ['no-debugger', 'eslint(no-debugger)'] }

export const NO_UNUSED_VARS: RuleByItsNames = { rule: 'no-unused-vars', names: ['no-unused-vars', 'eslint(no-unused-vars)'] }

/** The two rules our oxlint part runs on the debugger sources, which the team turns on in ESLint too. */
export const DEBUGGER_RULES = { 'no-debugger': 'error', 'no-unused-vars': 'error' } as const satisfies OurRules

/** A TS file and the three component kinds, each holding the debugger source, one line down in a component. */
export const debuggerSourceFiles = {
  'src/a.ts': DEBUGGER_SOURCE,
  'src/c.vue': `<script lang="ts">\n${DEBUGGER_SOURCE}</script>\n`,
  'src/c.svelte': `<script lang="ts">\n${DEBUGGER_SOURCE}</script>\n`,
  'src/c.astro': `---\n${DEBUGGER_SOURCE}---\n`,
} as const

// array-type under array-simple (1, one line down in a component).
const ARRAY_TYPE_SOURCE = `export const list: Array<string> = []
`

export const ARRAY_TYPE: RuleByItsNames = {
  rule: '@typescript-eslint/array-type',
  names: ['@typescript-eslint/array-type', 'typescript(array-type)'],
}

export const OURS_TURNING_ARRAY_TYPE_ON = { '@typescript-eslint/array-type': 'error' } as const satisfies OurRules

/** A team oxlint config turning array-type on, and nothing by category. */
export const TEAM_OXLINT_CONFIG_TURNING_ARRAY_TYPE_ON: OxlintConfig = {
  plugins: ['typescript'],
  categories: { correctness: 'off' },
  rules: { 'typescript/array-type': 'error' },
}

/** A TS file and the three component kinds, each holding an array type array-simple reports. */
export const arrayTypeSourceFiles = {
  'src/a.ts': ARRAY_TYPE_SOURCE,
  'src/c.vue': `<script lang="ts">\n${ARRAY_TYPE_SOURCE}</script>\n`,
  'src/c.svelte': `<script lang="ts">\n${ARRAY_TYPE_SOURCE}</script>\n`,
  'src/c.astro': `---\n${ARRAY_TYPE_SOURCE}---\n`,
} as const

/** Both twins, by every name either engine reports them under. */
export const MAX_PARAMS: RuleByItsNames = {
  rule: 'max-params',
  names: ['max-params', '@typescript-eslint/max-params', 'eslint(max-params)', 'typescript(max-params)'],
}

export const OURS_SETTING_THE_MAX_PARAMS_EXTENSION = { '@typescript-eslint/max-params': ['error', { max: 2 }] } as const satisfies OurRules

/** A function of five parameters (1), which a max-params of 2 or 4 reports, in a TS and a JS file. */
export const fiveParameterSourceFiles = {
  'src/a.ts': `export function five(a: number, b: number, c: number, d: number, e: number): number {
  return a + b + c + d + e
}
`,
  'src/b.js': `export function five(a, b, c, d, e) {
  return a + b + c + d + e
}
`,
} as const

/** Both twins of default-param-last, by every name either engine reports them under. */
export const DEFAULT_PARAM_LAST: RuleByItsNames = {
  rule: 'default-param-last',
  names: ['default-param-last', '@typescript-eslint/default-param-last', 'eslint(default-param-last)'],
}

/** typescript-eslint's default-param-last, whose core rule the catalog routes to ESLint; our ignores leave out legacy/. */
export const OURS_SETTING_THE_DEFAULT_PARAM_LAST_EXTENSION: OurFields = {
  rules: { '@typescript-eslint/default-param-last': 'error' },
  ignores: ['legacy/'],
}

/** A team oxlint config turning default-param-last on, the core rule of a twin pair, and nothing by category. */
export const TEAM_OXLINT_CONFIG_TURNING_DEFAULT_PARAM_LAST_ON: OxlintConfig = { categories: { correctness: 'off' }, rules: { 'default-param-last': 'error' } }

// A parameter with a default before one without (1), which default-param-last reports.
const DEFAULT_PARAM_FIRST_TS_SOURCE = `export function last(a: number = 1, b: number): number {
  return a + b
}
`

/** A TS and a JS file in src, where our part runs the pair, and a TS file in legacy, which our ignores leave out. */
export const defaultParamFirstSourceFiles = {
  'src/a.ts': DEFAULT_PARAM_FIRST_TS_SOURCE,
  'src/b.js': `export function last(a = 1, b) {
  return a + b
}
`,
  'legacy/a.ts': DEFAULT_PARAM_FIRST_TS_SOURCE,
} as const

/** Both twins of no-redeclare, by every name either engine reports them under. */
export const NO_REDECLARE: RuleByItsNames = {
  rule: 'no-redeclare',
  names: ['no-redeclare', '@typescript-eslint/no-redeclare', 'eslint(no-redeclare)'],
}

/**
 * Our no-redeclare in every file, and typescript-eslint's, with an option oxlint's no-redeclare
 * refuses (measured, oxlint 1.87: "unknown field `ignoreDeclarationMerge`"), in an entry for legacy/**.
 */
export const OURS_SETTING_NO_REDECLARE_WITH_AN_OPTION_OXLINT_REFUSES: OurFields = {
  rules: { 'no-redeclare': 'error' },
  fileOverrides: [{ files: ['legacy/**'], rules: { '@typescript-eslint/no-redeclare': ['error', { ignoreDeclarationMerge: true }] } }],
}

// An interface declared twice, which typescript-eslint's no-redeclare under ignoreDeclarationMerge
// leaves alone and oxlint's reports at the first declaration (1); a var declared twice, which
// ESLint reports at the second declaration (4) and oxlint at the first (3).
const REDECLARING_TS_SOURCE = `interface Shape { a: string }
interface Shape { b: string }
var x = 1
var x = 2
export { x }
export type { Shape }
`

// A var declared twice: ESLint reports it at the second declaration (2), oxlint at the first (1).
const REDECLARING_JS_SOURCE = `var x = 1
var x = 2
export { x }
`

/** A team oxlint config turning no-redeclare on, the core rule of a twin pair, and nothing by category. */
export const TEAM_OXLINT_CONFIG_TURNING_NO_REDECLARE_ON: OxlintConfig = { categories: { correctness: 'off' }, rules: { 'no-redeclare': 'error' } }

/** The team's ESLint rules turning no-redeclare on, the core rule of a twin pair. */
export const TEAM_ESLINT_RULES_TURNING_NO_REDECLARE_ON = { 'no-redeclare': 'error' } as const

/** A TS and a JS file in legacy, where the entry sets typescript-eslint's no-redeclare, and in src, where it does not. */
export const redeclaringSourceFiles = {
  'legacy/a.ts': REDECLARING_TS_SOURCE,
  'legacy/b.js': REDECLARING_JS_SOURCE,
  'src/a.ts': REDECLARING_TS_SOURCE,
  'src/b.js': REDECLARING_JS_SOURCE,
} as const
