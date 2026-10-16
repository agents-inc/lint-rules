// The relations between shipped rules the owner chose on 2026-10-14 (docs/work/spec-data.md, D4 to
// D6), each card in a comment.

/** "Covered by": each covered rule, and the rule covering it. The cards on which an (S) option was chosen. */
export const COVERED_BY: Readonly<Record<string, string>> = {
  // r2-d16
  'jsx-a11y/aria-props': '@eslint-react/dom-no-unknown-property',
  // r2-d18
  '@eslint-react/x-no-class-component': 'functional/no-classes',
  // r2-d24
  'react-hooks/globals': 'unicorn/no-top-level-assignment-in-function',
  // r2-d25
  'react-hooks/immutability': 'functional/immutable-data',
  // r2-d35
  'unicorn/no-for-loop': 'house/no-classic-loops',
  'guard-for-in': 'house/no-classic-loops',
  '@typescript-eslint/no-for-in-array': 'house/no-classic-loops',
  // r2-d36
  '@typescript-eslint/no-non-null-asserted-optional-chain': '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/no-confusing-non-null-assertion': '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/no-extra-non-null-assertion': '@typescript-eslint/no-non-null-assertion',
  // r2-d57, the orchestrator's reading: no-cond-assign keeps reporting beside the cover.
  'no-return-assign': 'sonarjs/no-nested-assignment',
  // r2-d60
  'testing-library/no-debugging-utils': 'sonarjs/no-debug-commands-in-ui-tests',
  // r2-d72
  'no-new': 'functional/no-expression-statements',
  'no-unused-expressions': 'functional/no-expression-statements',
  // r2-d73
  '@typescript-eslint/no-extraneous-class': 'functional/no-classes',
  // r2-d74
  'unicorn/no-array-sort': 'functional/immutable-data',
  'unicorn/no-array-reverse': 'functional/immutable-data',
  'unicorn/no-array-front-mutation': 'functional/immutable-data',
  // r2-d75
  'prefer-const': 'functional/no-let',
  // r2-d77
  '@typescript-eslint/no-invalid-this': 'functional/no-this-expressions',
  // r2-d78
  'react/prefer-read-only-props': 'functional/prefer-immutable-types',
  // r2-n1
  'sonarjs/prefer-while': 'house/no-classic-loops',
  'unicorn/prefer-while-loop-condition': 'house/no-classic-loops',
}

/** "Split by types": each untyped rule, and the typed rule that runs in its place with type information. */
export const SPLIT_BY_TYPES_WITH: Readonly<Record<string, string>> = {
  // r2-d32
  'unicorn/no-useless-template-literals': '@typescript-eslint/no-unnecessary-template-expression',
  // r2-d33
  'unicorn/no-unnecessary-boolean-comparison': '@typescript-eslint/no-unnecessary-boolean-literal-compare',
  // r2-d34
  'unicorn/no-useless-coercion': '@typescript-eslint/no-unnecessary-type-conversion',
  // r2-d40
  'unicorn/no-await-in-promise-methods': '@typescript-eslint/await-thenable',
  // r2-d41
  'no-constant-condition': '@typescript-eslint/no-unnecessary-condition',
  // q-r5-only-throw-error
  'no-throw-literal': '@typescript-eslint/only-throw-error',
  // q-r6-core-consistent-return-implied-eval
  'consistent-return': '@typescript-eslint/consistent-return',
  'no-implied-eval': '@typescript-eslint/no-implied-eval',
}

/** Each oxlint rule ESLint has no version of that ESLint stands in for without oxlint: its stand-in, and the card or questions.md number its reason starts with. */
export const ESLINT_STAND_INS: Readonly<Record<string, { readonly standIn: string; readonly card: string }>> = {
  'oxc/bad-char-at-comparison': { standIn: 'unicorn/no-invalid-character-comparison', card: 'r2-d49-51' },
  'oxc/bad-comparison-sequence': { standIn: 'unicorn/no-chained-comparison', card: '#55' },
  'oxc/double-comparisons': { standIn: 'unicorn/no-double-comparison', card: '#55' },
  'oxc/erasing-op': { standIn: 'unicorn/no-constant-zero-expression', card: 'r2-d49-51' },
  'oxc/misrefactored-assign-op': { standIn: 'unicorn/no-misrefactored-assignment', card: 'r2-d49-51' },
}
