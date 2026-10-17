import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { OurFields } from './both-engines-grid.ts'

// Both names of a twin pair in one layer of ours, with different settings, beside oxlint, on the real engines.

// A function of two parameters (1), of three (4) and of four (7): max-params at max 2 reports the
// last two, at max 3 the last, at the complexity ruleset's max 4 none.
const TS_SOURCE = `export function two(a: number, b: number): number {
  return a + b
}
export function three(a: number, b: number, c: number): number {
  return a + b + c
}
export function four(a: number, b: number, c: number, d: number): number {
  return a + b + c + d
}
`

const JS_SOURCE = `export function two(a, b) {
  return a + b
}
export function three(a, b, c) {
  return a + b + c
}
export function four(a, b, c, d) {
  return a + b + c + d
}
`

// The same, and an empty function (10), which no-empty-function reports.
const TS_SOURCE_WITH_AN_EMPTY_FUNCTION = `${TS_SOURCE}export function empty(): void {}
`

const JS_SOURCE_WITH_AN_EMPTY_FUNCTION = `${JS_SOURCE}export function empty() {}
`

// A parameter never used (1): no-unused-vars reports it under args all, not under args none.
const TS_UNUSED_PARAMETER_SOURCE = `export function f(unused: number): number {
  return 1
}
`

const JS_UNUSED_PARAMETER_SOURCE = `export function f(unused) {
  return 1
}
`

const MAX_3 = ['error', { max: 3 }] as const
const MAX_2 = ['error', { max: 2 }] as const

export const NO_EMPTY_FUNCTION: RuleByItsNames = {
  rule: 'no-empty-function',
  names: ['no-empty-function', '@typescript-eslint/no-empty-function', 'eslint(no-empty-function)'],
}

export const OURS_STATING_BOTH_MAX_PARAMS_NAMES: OurFields = {
  rules: { 'max-params': MAX_3, '@typescript-eslint/max-params': MAX_2 },
}

export const OURS_STATING_BOTH_MAX_PARAMS_NAMES_IN_AN_ENTRY_OVER_THE_ROOTS_TS_FILES: OurFields = {
  fileOverrides: [{ files: ['./*.ts'], rules: { 'max-params': MAX_3, '@typescript-eslint/max-params': MAX_2 } }],
}

export const OURS_STATING_BOTH_MAX_PARAMS_NAMES_IN_AN_ENTRY_OVER_THE_ROOT_SRC_FOLDERS_TS_FILES: OurFields = {
  fileOverrides: [{ files: ['./src/*.ts'], rules: { 'max-params': MAX_3, '@typescript-eslint/max-params': MAX_2 } }],
}

export const OURS_STATING_BOTH_MAX_PARAMS_NAMES_BESIDE_ONE_ALONE: OurFields = {
  fileOverrides: [
    { files: ['both/**'], rules: { 'max-params': MAX_3, '@typescript-eslint/max-params': MAX_2 } },
    { files: ['core/**'], rules: { 'max-params': MAX_3 } },
    { files: ['extension/**'], rules: { '@typescript-eslint/max-params': MAX_2 } },
  ],
}

/** oxlint's no-redeclare refuses the option (measured, oxlint 1.87: "unknown field `ignoreDeclarationMerge`"). */
export const OURS_STATING_BOTH_NO_REDECLARE_NAMES_THE_EXTENSION_WITH_AN_OPTION_OXLINT_REFUSES: OurFields = {
  rules: { 'no-redeclare': 'error', '@typescript-eslint/no-redeclare': ['error', { ignoreDeclarationMerge: true }] },
}

export const OURS_STATING_BOTH_NAMES_OF_TWO_PAIRS: OurFields = {
  rules: {
    'max-params': MAX_3,
    '@typescript-eslint/max-params': MAX_2,
    'no-empty-function': 'error',
    '@typescript-eslint/no-empty-function': 'off',
  },
}

export const OURS_TURNING_MAX_PARAMS_OFF_AND_TYPESCRIPT_ESLINTS_ON: OurFields = {
  rules: { 'max-params': 'off', '@typescript-eslint/max-params': MAX_2 },
}

export const OURS_TURNING_MAX_PARAMS_OFF_AND_TYPESCRIPT_ESLINTS_ON_IN_AN_ENTRY: OurFields = {
  fileOverrides: [{ files: ['legacy/**'], rules: { 'max-params': 'off', '@typescript-eslint/max-params': MAX_2 } }],
}

export const OURS_STATING_BOTH_MAX_PARAMS_NAMES_BESIDE_AN_ENTRY_TURNING_MAX_PARAMS_OFF: OurFields = {
  rules: { 'max-params': MAX_3, '@typescript-eslint/max-params': MAX_2 },
  fileOverrides: [{ files: ['legacy/**'], rules: { 'max-params': 'off' } }],
}

/** max-params at ESLint's default of 3, in the engine other than the one our part runs them in. */
export const TEAM_ESLINT_RULES_TURNING_MAX_PARAMS_AND_NO_EMPTY_FUNCTION_ON = { 'max-params': 'error', 'no-empty-function': 'error' } as const

// An option oxlint's no-redeclare refuses, and one it honours.
const IGNORING_DECLARATION_MERGES = ['error', { ignoreDeclarationMerge: true }] as const
const CHECKING_BUILTIN_GLOBALS = ['error', { builtinGlobals: true }] as const

/** ESLint runs typescript-eslint's on the TS files alone, and no rule of ours runs on the JS files. */
export const OURS_TURNING_NO_REDECLARE_OFF_AND_TYPESCRIPT_ESLINTS_ON: OurFields = {
  rules: { 'no-redeclare': 'off', '@typescript-eslint/no-redeclare': IGNORING_DECLARATION_MERGES },
}

export const OURS_TURNING_NO_REDECLARE_OFF_AND_TYPESCRIPT_ESLINTS_ON_IN_AN_ENTRY: OurFields = {
  fileOverrides: [{ files: ['legacy/**'], rules: { 'no-redeclare': 'off', '@typescript-eslint/no-redeclare': IGNORING_DECLARATION_MERGES } }],
}

/** no-redeclare is in force nowhere, so the entry's setting stays typescript-eslint's, which ESLint runs on every file there. */
export const OURS_TURNING_NO_REDECLARE_OFF_AND_TYPESCRIPT_ESLINTS_ON_BESIDE_AN_ENTRY_STATING_TYPESCRIPT_ESLINTS_ALONE: OurFields = {
  rules: { 'no-redeclare': 'off', '@typescript-eslint/no-redeclare': IGNORING_DECLARATION_MERGES },
  fileOverrides: [{ files: ['legacy/**'], rules: { '@typescript-eslint/no-redeclare': CHECKING_BUILTIN_GLOBALS } }],
}

export const OURS_STATING_BOTH_NO_UNUSED_VARS_NAMES: OurFields = {
  rules: { 'no-unused-vars': ['error', { args: 'none' }], '@typescript-eslint/no-unused-vars': ['error', { args: 'all' }] },
}

export const maxParamsSourceFiles = { 'src/a.ts': TS_SOURCE, 'src/b.js': JS_SOURCE } as const

export const maxParamsAndEmptyFunctionSourceFiles = {
  'src/a.ts': TS_SOURCE_WITH_AN_EMPTY_FUNCTION,
  'src/b.js': JS_SOURCE_WITH_AN_EMPTY_FUNCTION,
} as const

export const maxParamsSourceFilesInLegacyAndSrc = {
  'legacy/a.ts': TS_SOURCE,
  'legacy/b.js': JS_SOURCE,
  'src/a.ts': TS_SOURCE,
  'src/b.js': JS_SOURCE,
} as const

/** A TS and a JS file in src/ and in scripts/, which no-unused-vars' own ignores leave out. */
export const unusedParameterSourceFiles = {
  'src/a.ts': TS_UNUSED_PARAMETER_SOURCE,
  'src/b.js': JS_UNUSED_PARAMETER_SOURCE,
  'scripts/s.ts': TS_UNUSED_PARAMETER_SOURCE,
  'scripts/s.js': JS_UNUSED_PARAMETER_SOURCE,
} as const

export const maxParamsSourceFilesAtTheRootAndInSrc = { 'a.ts': TS_SOURCE, 'src/a.ts': TS_SOURCE } as const

export const maxParamsSourceFilesAtTheRootInSrcAndBelowIt = { 'a.ts': TS_SOURCE, 'src/a.ts': TS_SOURCE, 'src/deep/a.ts': TS_SOURCE } as const

export const maxParamsSourceFilesUnderEachEntry = {
  'both/a.ts': TS_SOURCE,
  'both/b.js': JS_SOURCE,
  'core/a.ts': TS_SOURCE,
  'core/b.js': JS_SOURCE,
  'extension/a.ts': TS_SOURCE,
  'extension/b.js': JS_SOURCE,
} as const
