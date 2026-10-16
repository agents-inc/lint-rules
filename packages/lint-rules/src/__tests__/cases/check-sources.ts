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
 * on line 5, which has no fix and reports nothing once the binding is gone (P3).
 */
export const ATTEMPT_CATCHING = ['export function attempt(task: () => void) {', '  try {', '    task()', '  } catch (error) {', "    throw new Error('the task failed')", '  }', '}']

/** perfectionist/sort-arrays, ESLint, on line 1: its fix would put GB before MB. The gate withholds it. */
export const UNITS = ["export const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']"]

/** perfectionist/sort-named-imports, ESLint, in import-order, on line 1: its fix sorts the names. */
export const NAMED_IMPORTS_OUT_OF_ORDER = ["import { sep, join } from 'node:path'", "export const nested = join('a', sep)"]
export const NAMED_IMPORTS_SORTED = ["import { join, sep } from 'node:path'", "export const nested = join('a', sep)"]

/**
 * import-x/first, oxlint, in modules, on line 2: an import below other code. The import is read, not
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

/** A component file with a script oxlint would fix, were it given the file. */
export function componentWithAScript(scriptLine: string): string {
  return moduleText('<script lang="ts">', scriptLine, '</script>')
}

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
 * reports it at line 2 where suppressions are allowed (measured, oxlint 1.87, ESLint 10.12, cli
 * review n3).
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
