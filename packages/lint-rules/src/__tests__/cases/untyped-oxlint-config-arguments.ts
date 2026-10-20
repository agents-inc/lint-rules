import { VALUES_THAT_ARE_NO_PATH } from './other-engine-config-refusals.ts'

// Arguments untyped-oxlint-config.test.ts gives mergeOxlintConfig, as an oxlint.config.mts whose type errors nobody
// reads may.

/** A third argument, and what it is. */
export type ThirdArgumentGiven = { readonly what: string; readonly given: unknown }

const ESLINT_CONFIG_PATH = 'eslint.config.mjs'
const NO_PATH_BUT_A_NUMBER = 42

/** The part's name, in place of the part. */
export const THE_PARTS_NAME = 'oxlint'

/** Each holds neither a path nor null at eslintConfig. */
export const THIRD_ARGUMENTS_HOLDING_NO_PATH: readonly ThirdArgumentGiven[] = [
  { what: 'the path itself, not in an object', given: ESLINT_CONFIG_PATH },
  { what: 'an object without eslintConfig', given: {} },
  { what: 'eslintConfig undefined', given: { eslintConfig: undefined } },
  { what: 'eslintConfig a number', given: { eslintConfig: NO_PATH_BUT_A_NUMBER } },
  ...VALUES_THAT_ARE_NO_PATH.map(({ what, value }) => ({ what: `eslintConfig ${what}`, given: { eslintConfig: value } })),
]
