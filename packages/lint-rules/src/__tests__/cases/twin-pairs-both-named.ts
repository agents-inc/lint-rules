import type { OxlintConfig } from 'oxlint'
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

// Beside either, a class whose constructor does nothing (10), which no-useless-constructor reports.
const USELESS_CONSTRUCTOR = `export class Empty { constructor() {} }
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

// Beside either, a constant never used (4), which no-unused-vars reports under args none and all alike.
const UNUSED_CONSTANT = `const constant = 1
`

const MAX_3 = ['error', { max: 3 }] as const
const MAX_2 = ['error', { max: 2 }] as const

export const NO_USELESS_CONSTRUCTOR: RuleByItsNames = {
  rule: 'no-useless-constructor',
  names: ['no-useless-constructor', '@typescript-eslint/no-useless-constructor', 'eslint(no-useless-constructor)'],
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

export const OURS_STATING_BOTH_NAMES_OF_TWO_PAIRS: OurFields = {
  rules: {
    'max-params': MAX_3,
    '@typescript-eslint/max-params': MAX_2,
    'no-useless-constructor': 'error',
    '@typescript-eslint/no-useless-constructor': 'off',
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
export const TEAM_ESLINT_RULES_TURNING_MAX_PARAMS_AND_NO_USELESS_CONSTRUCTOR_ON = { 'max-params': 'error', 'no-useless-constructor': 'error' } as const

// args all with an option oxlint's no-unused-vars loads and does not honour, which rule-data's
// oxlint-refused-options.json counts as refused; and args none, which it honours.
const ARGS_ALL_REMOVING_UNUSED_IMPORTS = ['error', { args: 'all', enableAutofixRemoval: { imports: true } }] as const
const ARGS_NONE = ['error', { args: 'none' }] as const

/** ESLint runs typescript-eslint's in the entry's TS files, where oxlint would drop its option. */
export const OURS_SETTING_NO_UNUSED_VARS_AND_TYPESCRIPT_ESLINTS_IN_AN_ENTRY_WITH_AN_OPTION_OXLINT_DROPS: OurFields = {
  rules: { 'no-unused-vars': ARGS_NONE },
  fileOverrides: [{ files: ['legacy/**'], rules: { '@typescript-eslint/no-unused-vars': ARGS_ALL_REMOVING_UNUSED_IMPORTS } }],
}

export const OURS_STATING_BOTH_NO_UNUSED_VARS_NAMES_THE_EXTENSION_WITH_AN_OPTION_OXLINT_DROPS: OurFields = {
  rules: { 'no-unused-vars': ARGS_NONE, '@typescript-eslint/no-unused-vars': ARGS_ALL_REMOVING_UNUSED_IMPORTS },
}

/** ESLint runs typescript-eslint's on the TS files alone, and no rule of ours runs on the JS files. */
export const OURS_TURNING_NO_UNUSED_VARS_OFF_AND_TYPESCRIPT_ESLINTS_ON: OurFields = {
  rules: { 'no-unused-vars': 'off', '@typescript-eslint/no-unused-vars': ARGS_ALL_REMOVING_UNUSED_IMPORTS },
}

export const OURS_TURNING_NO_UNUSED_VARS_OFF_AND_TYPESCRIPT_ESLINTS_ON_IN_AN_ENTRY: OurFields = {
  fileOverrides: [{ files: ['legacy/**'], rules: { 'no-unused-vars': 'off', '@typescript-eslint/no-unused-vars': ARGS_ALL_REMOVING_UNUSED_IMPORTS } }],
}

/** no-unused-vars is in force nowhere, so the entry's setting stays typescript-eslint's, which ESLint runs on every file there. */
export const OURS_TURNING_NO_UNUSED_VARS_OFF_AND_TYPESCRIPT_ESLINTS_ON_BESIDE_AN_ENTRY_STATING_TYPESCRIPT_ESLINTS_ALONE: OurFields = {
  rules: { 'no-unused-vars': 'off', '@typescript-eslint/no-unused-vars': ARGS_ALL_REMOVING_UNUSED_IMPORTS },
  fileOverrides: [{ files: ['legacy/**'], rules: { '@typescript-eslint/no-unused-vars': ARGS_NONE } }],
}

export const TEAM_ESLINT_RULES_TURNING_NO_UNUSED_VARS_ON = { 'no-unused-vars': 'error' } as const

export const TEAM_OXLINT_CONFIG_TURNING_NO_UNUSED_VARS_ON: OxlintConfig = { categories: { correctness: 'off' }, rules: { 'no-unused-vars': 'error' } }

export const OURS_STATING_BOTH_NO_UNUSED_VARS_NAMES: OurFields = {
  rules: { 'no-unused-vars': ['error', { args: 'none' }], '@typescript-eslint/no-unused-vars': ['error', { args: 'all' }] },
}

export const maxParamsSourceFiles = { 'src/a.ts': TS_SOURCE, 'src/b.js': JS_SOURCE } as const

export const maxParamsAndUselessConstructorSourceFiles = {
  'src/a.ts': `${TS_SOURCE}${USELESS_CONSTRUCTOR}`,
  'src/b.js': `${JS_SOURCE}${USELESS_CONSTRUCTOR}`,
} as const

export const maxParamsSourceFilesInLegacyAndSrc = {
  'legacy/a.ts': TS_SOURCE,
  'legacy/b.js': JS_SOURCE,
  'src/a.ts': TS_SOURCE,
  'src/b.js': JS_SOURCE,
} as const

export const unusedParameterSourceFiles = {
  'src/a.ts': TS_UNUSED_PARAMETER_SOURCE,
  'src/b.js': JS_UNUSED_PARAMETER_SOURCE,
  'scripts/s.ts': TS_UNUSED_PARAMETER_SOURCE,
  'scripts/s.js': JS_UNUSED_PARAMETER_SOURCE,
} as const

export const unusedParameterAndConstantSourceFiles = {
  'legacy/a.ts': `${TS_UNUSED_PARAMETER_SOURCE}${UNUSED_CONSTANT}`,
  'legacy/b.js': `${JS_UNUSED_PARAMETER_SOURCE}${UNUSED_CONSTANT}`,
  'src/a.ts': `${TS_UNUSED_PARAMETER_SOURCE}${UNUSED_CONSTANT}`,
  'src/b.js': `${JS_UNUSED_PARAMETER_SOURCE}${UNUSED_CONSTANT}`,
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
