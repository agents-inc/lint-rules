import {
  blockEnable,
  blockPairAround,
  DEBUGGER_STATEMENT,
  exportedConstant,
  exportedString,
  moduleText,
  type SuppressionForm,
  suppressionOfTheNextLine,
} from '../factories/check-factories.ts'

// The lines of the files check's integration tests change, each shaped to fire one rule, as the
// agent build reports it (measured: oxlint 1.87, ESLint 10.12). Each array is a file's lines.

/** A try whose finally runs the task again: no finding. */
export const GUARDED_BY_FINALLY = ['export function guarded(task: () => void) {', '  try {', '    task()', '  } finally {', '    task()', '  }', '}']

/** The same function with lines 4 and 5 changed to a catch that only rethrows: oxlint's no-useless-catch, at the caught `error` (line 4) and the rethrow (line 5). */
export const GUARDED_BY_A_USELESS_CATCH = ['export function guarded(task: () => void) {', '  try {', '    task()', '  } catch (error) {', '    throw error', '  }', '}']

/** A catch that only rethrows: oxlint's no-useless-catch, at the caught `error` (line 4) and the rethrow (line 5). */
export const RETHROWN_BY_A_USELESS_CATCH = ['export function rethrown(task: () => void) {', '  try {', '    task()', '  } catch (error) {', '    throw error', '  }', '}']

/** The same function with only line 5, inside the finding, changed. */
export const RETHROWN_WITH_A_COMMENT_ADDED = ['export function rethrown(task: () => void) {', '  try {', '    task()', '  } catch (error) {', '    throw error // rethrown as it is', '  }', '}']

/** A module whose one export, a default, is named apart from its file: ESLint's sonarjs/file-name-differ-from-class, in naming, at line 0. */
export const A_DEFAULT_EXPORT_NAMED_APART = ["const label = 'before'", 'export default label']

/** The same module with only line 1 changed. */
export const A_DEFAULT_EXPORT_NAMED_APART_ITS_VALUE_CHANGED = ["const label = 'after'", 'export default label']

/** Line 2 holds a declaration with no name: a parse error in both engines. */
export const A_SYNTAX_ERROR = [exportedConstant('beforeTheError'), 'export const = 2']

/** A component that is clean under the correctness and react rulesets. */
export const A_CLEAN_COMPONENT = ['export function Hello() {', '  return <p>hello</p>', '}']

/** Two suppressions that suppress nothing, one of an ESLint-run rule (line 2), one of an oxlint-run rule (line 4); then one that does (line 6). */
export const SUPPRESSIONS_TWO_UNUSED = [
  exportedConstant('first'),
  '// eslint-disable-next-line no-var',
  exportedConstant('second'),
  '// eslint-disable-next-line no-debugger',
  exportedConstant('third'),
  '// eslint-disable-next-line no-debugger',
  DEBUGGER_STATEMENT,
]

/** A suppression, on line 2, of an ESLint-run rule that reports nothing there. */
export const A_SUPPRESSION_OF_NOTHING = [exportedConstant('banned'), '// eslint-disable-next-line no-var', exportedConstant('after')]

/** A suppression, on line 2, of the finding on line 3. */
export const A_SUPPRESSION_OVER_A_FINDING = [exportedConstant('bannedOver'), '// eslint-disable-next-line no-debugger', DEBUGGER_STATEMENT]

/** A `no-restricted-syntax` selector ESLint throws on when it lints, though defineLintRules accepts it (measured, ESLint 10.12). */
export const A_SELECTOR_ESLINT_THROWS_ON = '[[['

/** What ESLint throws on that selector, as each file is linted (measured, ESLint 10.12). */
export const A_SELECTOR_ESLINT_THROWS_ON_MESSAGE = String.raw`Syntax error in selector "[[[" at position 1: Expected " " or [^ [\],():#!=><~+.] but "[" found.`

/** A project's own ESLint config, which throws if anything imports it. */
export const THROWING_ESLINT_CONFIG = moduleText("throw new Error('check imported the eslint.config.mjs of the project')")

/** A project's own oxlint config, which turns off the rule the fixtures fire. */
export const OXLINT_CONFIG_TURNING_NO_DEBUGGER_OFF = `${JSON.stringify({ rules: { 'no-debugger': 'off' } })}\n`

/** A package that calls itself @agents-inc/lint-rules, and is not this one. */
export const ANOTHER_COPY_OF_THE_PACKAGE = {
  'package.json': `${JSON.stringify({ name: '@agents-inc/lint-rules', version: '0.0.0', type: 'module', exports: { '.': './index.mjs' } })}\n`,
  'index.mjs': moduleText("throw new Error('the other copy of @agents-inc/lint-rules was imported')"),
}

/** object-shorthand, ESLint, on line 2: `{ n: n }` becomes `{ n }`. */
export const SHORTHAND_FIRST = ['export function first(n: number) {', '  return { n: n }', '}']
export const SHORTHAND_SECOND = ['export function second(m: number) {', '  return { m: m }', '}']
export const SHORTHAND_SECOND_FIXED = ['export function second(m: number) {', '  return { m }', '}']

/** A type over three lines, no finding. */
export const IDS_AS_A_SET = ['export type Ids = Set<', '  number', '>']

/** @typescript-eslint/array-type, ESLint, from line 1 to 3: its fix, `number[]`, deletes lines 2 and 3. */
export const IDS_AS_AN_ARRAY = ['export type Ids = Array<', '  number', '>']
export const IDS_FIXED = 'export type Ids = number[]'
export const NAMES = 'export type Names = string[]'

/** object-shorthand on line 2. */
export const WRAP = ['export function wrap(m: number) {', '  return { m: m }', '}']
export const WRAP_FIXED = ['export function wrap(m: number) {', '  return { m }', '}']

export const ATTEMPT = ['export function attempt(task: () => void) {', '  task()', '}']

/**
* unicorn/prefer-optional-catch-binding on line 4, whose fix removes `(error)`; preserve-caught-error
* on line 5, which has no fix and reports nothing once the binding is gone.
*/
export const ATTEMPT_CATCHING = ['export function attempt(task: () => void) {', '  try {', '    task()', '  } catch (error) {', "    throw new Error('the task failed')", '  }', '}']

/** perfectionist/sort-arrays, ESLint, on line 1: its fix would put GB before MB. The gate withholds it. */
export const UNITS = ["export const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']"]

/** perfectionist/sort-named-imports, ESLint, in import-order, on line 1: its fix sorts the names. */
export const NAMED_IMPORTS_OUT_OF_ORDER = ["import { sep, join } from 'node:path'", "export const nested = join('a', sep)"]
export const NAMED_IMPORTS_SORTED = ["import { join, sep } from 'node:path'", "export const nested = join('a', sep)"]

/**
 * import-x/first, oxlint, in import-order, on line 2: an import below other code. The import is read, not
 * re-exported, which unicorn/prefer-export-from would fix into an `export … from`.
 */
export const AN_IMPORT_BELOW_CODE = ['export const before = 1', "import { sep } from 'node:path'", 'export const after = sep.length']

/** A module with an import, an object and a switch: no finding under the correctness and modules rulesets. */
export const A_TABLE = [
  "import { readFileSync } from 'node:fs'",
  '',
  'export const LIMITS = {',
  '  small: 1,',
  '  large: 9,',
  '}',
  '',
  'export function sizeOf(name: string): number {',
  '  switch (name) {',
  "    case 'small':",
  '      return 1',
  '    default:',
  '      return 0',
  '  }',
  '}',
  '',
  'export function readIt(path: string): string {',
  "  return readFileSync(path, 'utf8')",
  '}',
]

/**
 * A_TABLE after an agent added, each beside the code it repeats, a second import from node:fs
 * (line 2), a duplicate key (line 7) and a duplicate case (line 14). oxlint gives each finding at
 * two places, the older code's first (measured, oxlint 1.87): import-x/no-duplicates at lines 1
 * and 2, no-dupe-keys at 5 and 7, no-duplicate-case at 12 and 14.
 */
export const A_TABLE_WITH_DUPLICATES_ADDED = [
  "import { readFileSync } from 'node:fs'",
  "import { existsSync } from 'node:fs'",
  '',
  'export const LIMITS = {',
  '  small: 1,',
  '  large: 9,',
  '  small: 2,',
  '}',
  '',
  'export function sizeOf(name: string): number {',
  '  switch (name) {',
  "    case 'small':",
  '      return 1',
  "    case 'small':",
  '      return 2',
  '    default:',
  '      return 0',
  '  }',
  '}',
  '',
  'export function readIt(path: string): string {',
  "  return existsSync(path) ? readFileSync(path, 'utf8') : ''",
  '}',
]

/**
 * Where suppressions are allowed, a suppression in oxlint's own form of an oxlint-run rule that
 * reports nothing (line 2); then one that suppresses a finding (line 4).
 */
export const OXLINT_FORM_SUPPRESSIONS_ONE_UNUSED = [
  exportedConstant('first'),
  '// oxlint-disable-next-line no-debugger',
  exportedConstant('second'),
  '// oxlint-disable-next-line no-debugger',
  DEBUGGER_STATEMENT,
]

/**
 * A string thrown: ESLint's no-throw-literal, which has no fix (measured, ESLint 10.12). ESLint lints
 * the `*.min.js` files oxlint never lints, even with `--no-ignore` (measured, oxlint 1.87).
 */
export const A_LITERAL_THROWN = "throw 'generated'"

/** A committed file whose line 2 is an `eslint-enable` comment that turns back on nothing a disable comment turned off. */
export const AN_ENABLE_CLOSING_NOTHING = [
  exportedConstant('before'),
  blockEnable({ form: 'eslint', ruleName: 'no-debugger' }),
  'export function answer(): number {',
  '  return 1',
  '}',
]

/** The same file after an agent added a `debugger` on line 4: oxlint's no-debugger there. */
export const AN_ENABLE_CLOSING_NOTHING_WITH_A_DEBUGGER_ADDED = [
  exportedConstant('before'),
  blockEnable({ form: 'eslint', ruleName: 'no-debugger' }),
  'export function answer(): number {',
  '  debugger',
  '  return 1',
  '}',
]

/**
 * Enable comments that turn back on nothing, in both forms, naming a rule and naming none (lines 2
 * to 5), then a `debugger` (line 6). oxlint reports each comment with no code (measured, 1.87).
 */
export const ENABLES_CLOSING_NOTHING_ABOVE_A_DEBUGGER = [
  exportedConstant('strays'),
  blockEnable({ form: 'eslint', ruleName: 'no-debugger' }),
  blockEnable({ form: 'oxlint', ruleName: 'no-debugger' }),
  blockEnable({ form: 'eslint', ruleName: null }),
  blockEnable({ form: 'oxlint', ruleName: null }),
  DEBUGGER_STATEMENT,
]

/**
 * A block pair in the form given, turning no-debugger off on line 1 and back on on line 3, around
 * the line given. Where it silenced nothing, oxlint reports it at the enable comment and ESLint at the
 * disable comment (measured, oxlint 1.87, ESLint 10.12).
 */
export function noDebuggerPairAround(form: SuppressionForm, between: string): string[] {
  return blockPairAround(form, 'no-debugger', between)
}

/** The rule aSuppressionPartlyUnused names that reports nothing below it: nothing there calls `console`. */
export const A_RULE_REPORTING_NOTHING = 'no-console'

/**
* A suppression in the form given, on line 2, of no-debugger, which reports the `debugger` below it,
* and of no-console, which reports nothing there. oxlint spans the name no-console alone, and check
* reports it at line 2 where suppressions are allowed (measured, oxlint 1.87, ESLint 10.12).
*/
export function aSuppressionPartlyUnused(form: SuppressionForm): string[] {
  return [exportedConstant('before'), suppressionOfTheNextLine(form, `no-debugger, ${A_RULE_REPORTING_NOTHING}`), DEBUGGER_STATEMENT]
}

/**
 * The lines given, below a line another writer adds above them. The line is long enough that where
 * line 2's names were before, a string now is.
 */
export function movedDownByAnotherWriter(lines: readonly string[]): string[] {
  return [exportedString('writtenAboveByAnotherWriter', 'a line long enough to move every line below it well past where oxlint read it'), ...lines]
}

/** An import of our package, which `init` lists under devDependencies alone. */
export const AN_IMPORT_OF_OUR_PACKAGE = ["import { defineLintRules } from '@agents-inc/lint-rules'", 'export const define = defineLintRules']

/** An async function returning 1, which a monorepo package's lib folder holds. */
export const AN_ASYNC_LOAD = ['export async function load(): Promise<number> {', '  return 1', '}']

/** A call to that function left floating (line 4), beside one awaited (line 5): @typescript-eslint/no-floating-promises at line 4 alone. */
export const A_FLOATING_CALL_BESIDE_AN_AWAITED_ONE = ["import { load } from './lib/load.ts'", '', 'export async function run(): Promise<void> {', '  load()', '  await load()', '}']

/** The `value` of the module named, read in a function rather than re-exported: import-x/no-extraneous-dependencies at line 1 where the package is not listed. */
export function aValueReadFrom(specifier: string): string[] {
  return [`import { value } from '${specifier}'`, '', 'export function read(): number {', '  return value', '}']
}

/** A name the lib folder's value.ts lacks, imported through the alias given: import-x/named at line 1 where the alias resolves. */
export function aNameTheAliasedModuleLacks(alias: string): string[] {
  return [`import { missing } from '${alias}/value.ts'`, '', 'export function aliased(): number {', '  return missing', '}']
}

/** A module exporting `one`, which an alias leads to. */
export const THE_ALIASED_MODULE = [exportedConstant('one')]

/** oxlint's no-debugger at line 2 and ESLint's @typescript-eslint/only-throw-error at line 3, in a TS file a tsconfig takes in. */
export const A_DEBUGGER_AND_A_LITERAL_THROWN = [exportedConstant('reported'), DEBUGGER_STATEMENT, A_LITERAL_THROWN]

/** A block `eslint-disable` over lines 1 to 4 above a `debugger`: no-console, on line 3, suppresses nothing. */
export const A_DISABLE_OVER_SEVERAL_LINES_ABOVE_A_DEBUGGER = ['/* eslint-disable', '  no-debugger,', `  ${A_RULE_REPORTING_NOTHING}`, '*/', DEBUGGER_STATEMENT]

/** The same comment on one line. */
export const A_DISABLE_ON_ONE_LINE_ABOVE_A_DEBUGGER = [`/* eslint-disable no-debugger, ${A_RULE_REPORTING_NOTHING} */`, DEBUGGER_STATEMENT]

/** The lines given, after another writer added a character to the first: every later byte moves one on. */
export function withACharacterAddedToTheFirstLine([first, ...rest]: readonly string[]): string[] {
  if (first === undefined) throw new Error('there is no first line to add a character to')
  return [`${first}2`, ...rest]
}

/** An `oxlint-disable` comment on line 2 of an oxlint-run rule nothing below it reports: oxlint spans the whole comment. */
export const A_WHOLLY_UNUSED_OXLINT_DISABLE = [exportedConstant('before'), suppressionOfTheNextLine('oxlint', 'no-debugger'), exportedConstant('after')]

/** That file after another writer put a string holding the comment's text where oxlint read it, and moved the comment to line 3. */
export const A_WHOLLY_UNUSED_OXLINT_DISABLE_BELOW_A_STRING_HOLDING_ITS_TEXT = [
  exportedString('quoted1', suppressionOfTheNextLine('oxlint', 'no-debugger')),
  exportedConstant('between'),
  suppressionOfTheNextLine('oxlint', 'no-debugger'),
  exportedConstant('after'),
]

/** A wholly unused `oxlint-disable` comment of two names on line 1: oxlint spans the whole comment. */
export const A_WHOLLY_UNUSED_OXLINT_DISABLE_OF_TWO_NAMES = [suppressionOfTheNextLine('oxlint', `no-debugger, ${A_RULE_REPORTING_NOTHING}`), exportedConstant('after')]

/** That file after another writer took the second name out: the code below now lies where oxlint read the name. */
export const A_WHOLLY_UNUSED_OXLINT_DISABLE_WITH_A_NAME_TAKEN_OUT = [suppressionOfTheNextLine('oxlint', 'no-debugger'), exportedConstant('after')]

/** A string holding a rule's name on line 1, above an `oxlint-disable` comment of that rule on line 2. */
export const A_RULE_NAME_IN_A_STRING_ABOVE_A_SUPPRESSION_OF_IT = [
  exportedString('rule', A_RULE_REPORTING_NOTHING),
  suppressionOfTheNextLine('oxlint', A_RULE_REPORTING_NOTHING),
  exportedConstant('after'),
]

/** A Vue.js single-file component whose script holds the lines given, from line 5. */
export function vueComponentScripting(lines: readonly string[]): string[] {
  return ['<template>', '  <p>hi</p>', '</template>', '<script lang="ts">', ...lines, '</script>']
}

/** A Svelte component whose script holds the lines given, from line 2. */
function svelteComponentScripting(lines: readonly string[]): string[] {
  return ['<script lang="ts">', ...lines, '</script>', '<p>hi</p>']
}

/** An Astro component whose frontmatter holds the lines given, from line 2. */
function astroComponentScripting(lines: readonly string[]): string[] {
  return ['---', ...lines, '---', '<p>hi</p>']
}

/** Each component file kind check lints with oxlint's rules alone, and the line its script's first line is on. */
export const COMPONENT_FILE_KINDS = [
  { kind: 'Vue', extension: 'vue', scripting: vueComponentScripting, firstScriptLine: 5 },
  { kind: 'Svelte', extension: 'svelte', scripting: svelteComponentScripting, firstScriptLine: 2 },
  { kind: 'Astro', extension: 'astro', scripting: astroComponentScripting, firstScriptLine: 2 },
] as const

/** oxlint's no-useless-rename on the first line, whose fix drops the rename, in a component's script of each kind too (measured, oxlint 1.87). */
export const A_USELESS_RENAME = ["const { length: length } = 'ab'", 'export const big = length']
export const A_USELESS_RENAME_FIXED = ["const { length } = 'ab'", 'export const big = length']

/** src/cycle.ts, re-exporting a name from itself: a re-export cycle, which no rule reports. */
export const RE_EXPORTING_ITSELF = { file: 'src/cycle.ts', lines: ["export { looped } from './cycle.ts'"] }

/** A constant marked deprecated (src/old.ts), re-exported (src/passed-on.ts) and read through that (src/read.ts): no-deprecated at the read, line 3. */
export const A_DEPRECATED_CONSTANT_PASSED_ON: Readonly<Record<string, readonly string[]>> = {
  'src/old.ts': ['/** @deprecated read `current` */', 'export const old = 1'],
  'src/passed-on.ts': ["export { old } from './old.ts'"],
  'src/read.ts': ["import { old } from './passed-on.ts'", '', 'export const read = old'],
}

/** A type (src/shape.ts) re-exported as a value (src/shape-passed-on.ts), which consistent-type-exports fixes to SHAPE_PASSED_ON_AS_A_TYPE. */
export const A_TYPE_PASSED_ON_AS_A_VALUE: Readonly<Record<string, readonly string[]>> = {
  'src/shape.ts': ['export type Shape = { readonly side: number }'],
  'src/shape-passed-on.ts': ["export { Shape } from './shape.ts'"],
}

export const SHAPE_PASSED_ON_AS_A_TYPE = { file: 'src/shape-passed-on.ts', lines: ["export type { Shape } from './shape.ts'"] }

// An `oxlint-disable` comment over a `debugger`, ending in the characters that close a block comment: oxlint reads them
// as a name of a line comment, reported unused at those 2 bytes, trailing spaces or none (1.87), and as a block comment's close.
export const STRAY_COMMENT_CLOSES = [
  { comment: 'a line comment', suppression: '// oxlint-disable-next-line no-debugger */', aName: true },
  { comment: 'a line comment ending in two spaces', suppression: '// oxlint-disable-next-line no-debugger */  ', aName: true },
  { comment: 'a block comment, which it closes', suppression: '/* oxlint-disable-next-line no-debugger */', aName: false },
] as const
