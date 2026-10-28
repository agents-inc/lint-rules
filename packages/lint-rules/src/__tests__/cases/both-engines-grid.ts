import type { OxlintConfig } from 'oxlint'
import type { LintRules } from '../../index.ts'
import type { TeamGlobalIgnoresBlock, TeamIgnoresFunction } from '../factories/consumer-project-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'

// The projects the editor merges are checked in on both real engines, through the built package. Each source
// line draws one rule, noted beside it. The team's .vue, .svelte and .astro parser is a stand-in that blanks
// all but the script block, so every finding keeps its line.

export type OurFields = Pick<LintRules, 'rules' | 'fileOverrides' | 'ignores'>

type OurRules = NonNullable<LintRules['rules']>

type GridRuleId = keyof typeof OUR_GRID_RULES

/** Every name either engine reports it under, the team's name for it, and the engine the team runs it in. */
export type GridRule = RuleByItsNames & { readonly rule: GridRuleId; readonly teamsName: string; readonly teamsEngine: 'eslint' | 'oxlint' }

/** A way our settings keep our rules out of some files, which each engine reads its own way. */
export type GridRow = { readonly how: string; readonly ours: OurFields }

/** Null where the source cannot draw the rule. */
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

/** Files in and out of each way our settings keep our rules out, and files in node_modules, which ESLint never lints. */
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

const FILES_IN_NODE_MODULES: ReadonlySet<string> = new Set(['node_modules/x/a.js', 'packages/p/node_modules/y/a.js'])

/** Files oxlint lints, and ESLint lints only through a team's parser of its own: no JS or TS file. */
export const COMPONENT_FILES: readonly string[] = ['src/c.vue', 'src/c.svelte', 'src/c.astro']

export const GRID_JS_AND_TS_FILES = GRID_FILES.filter((file) => !COMPONENT_FILES.includes(file))

export const OUR_GRID_RULES = {
  'no-debugger': 'error',
  '@typescript-eslint/array-type': 'error',
  'no-var': 'error',
  'no-unused-vars': 'error',
} as const satisfies OurRules

/**
* Each turned on by the team in the other engine. no-var shows ESLint's reading of our ignores in JS files,
* where array-type draws nothing.
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

/** The team turns each on in one of its configs, so each is the team's. */
export const GRID_RULES_THE_TEAM_SETS: readonly string[] = GRID_RULES.map(({ rule }) => rule)

/** The two our oxlint part runs, no-unused-vars as its twin. */
export const TEAM_GRID_ESLINT_RULES = { 'no-debugger': 'error', '@typescript-eslint/no-unused-vars': 'error' } as const

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
* Each rule in every file that can draw it and that the team's engine for it lints. Given no ignore of the
* team's, oxlint lints node_modules too (measured, oxlint 1.87).
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

export const nodeModulesSourceFiles: Readonly<Record<string, string>> = {
  'src/a.ts': TS.text,
  'node_modules/x/a.js': JS.text,
  'node_modules/x/b.ts': TS.text,
}

export const TEAM_GLOBAL_IGNORES_TAKING_NODE_MODULES_BACK: TeamGlobalIgnoresBlock = { ignores: ['!**/node_modules/'] }

export type TeamTakeBackCase = {
  readonly how: string
  readonly sources: Readonly<Record<string, string>>
  readonly teamEslintGlobalIgnores: TeamGlobalIgnoresBlock
  /** Those its global ignores take back among them. */
  readonly lintedByTheTeamsEslint: readonly string[]
  /** As an editor does; oxlint's walk of the project skips every .git folder. */
  readonly oxlintGivenEachSourceFile?: true
}

const A_FUNCTION_LEAVING_OUT_NO_FILE: TeamIgnoresFunction = { functionSource: '() => false' }

/** dist/keep/a.js, which dist/ read from the project's parent leaves in. */
const nodeModulesAndDistSourceFiles: Readonly<Record<string, string>> = { ...nodeModulesSourceFiles, 'dist/keep/a.js': JS.text }

/**
* Team global ignores taking files back from ESLint's defaults, each a way the merge must read: the root .git
* folder; node_modules from a basePath; every node_modules from a basePath outside the project, which still
* reaches all of it (measured, ESLint 10.12), alone and after a non-negated glob; and after a function.
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
* ESLint's default ignores leave out the root .git folder alone; oxlint's walk skips every .git folder
* (measured, ESLint 10.12, oxlint 1.87).
*/
export const nestedGitSourceFiles: Readonly<Record<string, string>> = {
  'src/a.ts': TS.text,
  'src/.git/a.js': JS.text,
  'src/.git/b.ts': TS.text,
}

/** One package in node_modules our ignores take back as ESLint documents it. Lines: no-unused-vars (2), no-debugger (3), no-var (5). */
export const packageTakenBackSourceFiles: Readonly<Record<string, string>> = {
  'src/a.js': JS.text,
  'node_modules/mylib/a.js': JS.text,
  'node_modules/other/a.js': JS.text,
}

/** no-var runs in our ESLint part, no-unused-vars in our oxlint part. */
export const OURS_TAKING_A_PACKAGE_BACK_FROM_ESLINT_DEFAULTS: OurFields = {
  rules: { 'no-var': 'error', 'no-unused-vars': 'error' },
  ignores: ['!node_modules/', 'node_modules/*', '!node_modules/mylib/'],
}

export const TEAM_OXLINT_CONFIG_TURNING_NO_VAR_ON: OxlintConfig = { categories: { correctness: 'off' }, rules: { 'no-var': 'error' } }

/** ESLint lints no file in node_modules. */
function lintsTheFile(engine: GridRule['teamsEngine'], file: string): boolean {
  return engine === 'oxlint' || !FILES_IN_NODE_MODULES.has(file)
}

/** None where the line is null. */
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

export const DEBUGGER_RULES = { 'no-debugger': 'error', 'no-unused-vars': 'error' } as const satisfies OurRules

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

export const TEAM_OXLINT_CONFIG_TURNING_ARRAY_TYPE_ON: OxlintConfig = {
  plugins: ['typescript'],
  categories: { correctness: 'off' },
  rules: { 'typescript/array-type': 'error' },
}

export const arrayTypeSourceFiles = {
  'src/a.ts': ARRAY_TYPE_SOURCE,
  'src/c.vue': `<script lang="ts">\n${ARRAY_TYPE_SOURCE}</script>\n`,
  'src/c.svelte': `<script lang="ts">\n${ARRAY_TYPE_SOURCE}</script>\n`,
  'src/c.astro': `---\n${ARRAY_TYPE_SOURCE}---\n`,
} as const

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

export const DEFAULT_PARAM_LAST: RuleByItsNames = {
  rule: 'default-param-last',
  names: ['default-param-last', '@typescript-eslint/default-param-last', 'eslint(default-param-last)'],
}

/** The catalog routes the core rule to ESLint; our ignores leave out legacy/. */
export const OURS_SETTING_THE_DEFAULT_PARAM_LAST_EXTENSION: OurFields = {
  rules: { '@typescript-eslint/default-param-last': 'error' },
  ignores: ['legacy/'],
}

export const TEAM_OXLINT_CONFIG_TURNING_DEFAULT_PARAM_LAST_ON: OxlintConfig = { categories: { correctness: 'off' }, rules: { 'default-param-last': 'error' } }

// A parameter with a default before one without (1), which default-param-last reports.
const DEFAULT_PARAM_FIRST_TS_SOURCE = `export function last(a: number = 1, b: number): number {
  return a + b
}
`

export const defaultParamFirstSourceFiles = {
  'src/a.ts': DEFAULT_PARAM_FIRST_TS_SOURCE,
  'src/b.js': `export function last(a = 1, b) {
  return a + b
}
`,
  'legacy/a.ts': DEFAULT_PARAM_FIRST_TS_SOURCE,
} as const

export const NO_REDECLARE: RuleByItsNames = {
  rule: 'no-redeclare',
  names: ['no-redeclare', '@typescript-eslint/no-redeclare', 'eslint(no-redeclare)'],
}

/** oxlint's no-redeclare refuses the option (measured, oxlint 1.87: "unknown field `ignoreDeclarationMerge`"). */
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

export const TEAM_OXLINT_CONFIG_TURNING_NO_REDECLARE_ON: OxlintConfig = { categories: { correctness: 'off' }, rules: { 'no-redeclare': 'error' } }

export const TEAM_ESLINT_RULES_TURNING_NO_REDECLARE_ON = { 'no-redeclare': 'error' } as const

export const redeclaringSourceFiles = {
  'legacy/a.ts': REDECLARING_TS_SOURCE,
  'legacy/b.js': REDECLARING_JS_SOURCE,
  'src/a.ts': REDECLARING_TS_SOURCE,
  'src/b.js': REDECLARING_JS_SOURCE,
} as const
