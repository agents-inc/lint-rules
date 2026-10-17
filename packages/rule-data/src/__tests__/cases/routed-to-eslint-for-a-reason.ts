// Shipped rules whose oxlint version is measurably worse, so ESLint runs them beside oxlint too:
// oxlint skips the JS files ESLint's version reports in, or refuses an option ESLint's takes and then
// loads no part of the config (measured, oxlint 1.87).

/** By the file types oxlint skips: a finding ESLint's version reports in a .js file. */
const SKIPPED_FILE_TYPES = ['@typescript-eslint/ban-ts-comment', '@typescript-eslint/no-this-alias', '@typescript-eslint/triple-slash-reference']

/** By an option ESLint's version takes that oxlint refuses. */
const REFUSED_OPTIONS = [
  'eqeqeq',
  'import-x/named',
  'import-x/no-unassigned-import',
  'max-depth',
  'preserve-caught-error',
  'promise/valid-params',
  'react-hooks/exhaustive-deps',
  'react-hooks/rules-of-hooks',
  'react/jsx-no-duplicate-props',
  'react/no-children-prop',
  'unicorn/no-empty-file',
  'unicorn/prefer-add-event-listener',
  'unicorn/prefer-array-find',
  'unicorn/prefer-set-has',
  'vitest/no-conditional-expect',
  'vitest/no-focused-tests',
]

/**
 * By type information: the untyped rule of a pair split by types. oxlint cannot tell which files have
 * type information, so beside the typed rule its copy would report twice there.
 */
const SPLIT_BY_TYPES = ['no-constant-condition', 'no-implied-eval', 'unicorn/no-await-in-promise-methods']

/** Every rule routed to ESLint for a measured reason, sorted. */
export const ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON: readonly string[] = [...SKIPPED_FILE_TYPES, ...REFUSED_OPTIONS, ...SPLIT_BY_TYPES].toSorted()
