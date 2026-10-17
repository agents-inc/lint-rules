/** "Covered by": each covered rule, and the rule covering it. */
export const COVERED_BY: Readonly<Record<string, string>> = {
  'jsx-a11y/aria-props': '@eslint-react/dom-no-unknown-property',
  '@eslint-react/x-no-class-component': 'functional/no-classes',
  'react-hooks/globals': 'unicorn/no-top-level-assignment-in-function',
  'react-hooks/immutability': 'functional/immutable-data',
  'unicorn/no-for-loop': 'house/no-classic-loops',
  'guard-for-in': 'house/no-classic-loops',
  '@typescript-eslint/no-for-in-array': 'house/no-classic-loops',
  '@typescript-eslint/no-non-null-asserted-optional-chain': '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/no-confusing-non-null-assertion': '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/no-extra-non-null-assertion': '@typescript-eslint/no-non-null-assertion',
  // no-cond-assign keeps reporting beside the cover.
  'no-return-assign': 'sonarjs/no-nested-assignment',
  'testing-library/no-debugging-utils': 'sonarjs/no-debug-commands-in-ui-tests',
  'no-new': 'functional/no-expression-statements',
  'no-unused-expressions': 'functional/no-expression-statements',
  '@typescript-eslint/no-extraneous-class': 'functional/no-classes',
  'unicorn/no-array-sort': 'functional/immutable-data',
  'unicorn/no-array-reverse': 'functional/immutable-data',
  'unicorn/no-array-front-mutation': 'functional/immutable-data',
  'prefer-const': 'functional/no-let',
  '@typescript-eslint/no-invalid-this': 'functional/no-this-expressions',
  'react/prefer-read-only-props': 'functional/prefer-immutable-types',
  'sonarjs/prefer-while': 'house/no-classic-loops',
  'unicorn/prefer-while-loop-condition': 'house/no-classic-loops',
}

/** "Split by types": each untyped rule, and the typed rule that runs in its place with type information. */
export const SPLIT_BY_TYPES_WITH: Readonly<Record<string, string>> = {
  'unicorn/no-useless-template-literals': '@typescript-eslint/no-unnecessary-template-expression',
  'unicorn/no-unnecessary-boolean-comparison': '@typescript-eslint/no-unnecessary-boolean-literal-compare',
  'unicorn/no-useless-coercion': '@typescript-eslint/no-unnecessary-type-conversion',
  'unicorn/no-await-in-promise-methods': '@typescript-eslint/await-thenable',
  'no-constant-condition': '@typescript-eslint/no-unnecessary-condition',
  'no-throw-literal': '@typescript-eslint/only-throw-error',
  'consistent-return': '@typescript-eslint/consistent-return',
  'no-implied-eval': '@typescript-eslint/no-implied-eval',
}

/** Each oxlint rule ESLint has no version of: its ESLint stand-in, and the card its reason starts with. */
export const ESLINT_STAND_INS: Readonly<Record<string, { readonly standIn: string; readonly card: string }>> = {
  'oxc/bad-char-at-comparison': { standIn: 'unicorn/no-invalid-character-comparison', card: 'r2-d49-51' },
  'oxc/bad-comparison-sequence': { standIn: 'unicorn/no-chained-comparison', card: '#55' },
  'oxc/double-comparisons': { standIn: 'unicorn/no-double-comparison', card: '#55' },
  'oxc/erasing-op': { standIn: 'unicorn/no-constant-zero-expression', card: 'r2-d49-51' },
  'oxc/misrefactored-assign-op': { standIn: 'unicorn/no-misrefactored-assignment', card: 'r2-d49-51' },
}
