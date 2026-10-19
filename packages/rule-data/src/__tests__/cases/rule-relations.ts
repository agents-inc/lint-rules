import { TEST_FILE_GLOBS } from './test-file-globs.ts'

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
  'no-cond-assign': 'sonarjs/no-nested-assignment',
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
  'oxc/no-map-spread': 'functional/immutable-data',
}

const NO_NEW = 'no-new covered by functional/no-expression-statements'
const NO_UNUSED_EXPRESSIONS = 'no-unused-expressions covered by functional/no-expression-statements'
const NO_INVALID_THIS = '@typescript-eslint/no-invalid-this covered by functional/no-this-expressions'
const NON_NULL_ASSERTION_PAIRS = [
  '@typescript-eslint/no-confusing-non-null-assertion covered by @typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/no-extra-non-null-assertion covered by @typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/no-non-null-asserted-optional-chain covered by @typescript-eslint/no-non-null-assertion',
]
const ARRAY_MUTATION_PAIRS = [
  'unicorn/no-array-front-mutation covered by functional/immutable-data',
  'unicorn/no-array-reverse covered by functional/immutable-data',
  'unicorn/no-array-sort covered by functional/immutable-data',
]
const RUNS_ONLY_WHERE_TYPES_ARE_KNOWN = 'the cover runs only where types are known'
const SKIPS_TEST_FILES = TEST_FILE_GLOBS.map((glob) => `the cover skips ${glob}`)

/** Each set of files for each pair, as `filesLeftUncovered` names them. */
function leftUncovered(pairs: readonly string[], wheres: readonly string[]): string[] {
  return pairs.flatMap((pair) => wheres.map((where) => `${pair}: ${where}`))
}

/** Each set of files a cover leaves, where nothing reports what the rule it covers would, by the owner's card that decides it. */
export const FILES_LEFT_UNCOVERED_BY_CARD: Readonly<Record<string, readonly string[]>> = {
  'r2-d25': leftUncovered(['react-hooks/immutability covered by functional/immutable-data'], [RUNS_ONLY_WHERE_TYPES_ARE_KNOWN]),
  'r2-d72': leftUncovered([NO_NEW, NO_UNUSED_EXPRESSIONS], ['the cover runs only on **/*.ts', 'the cover skips **/use[A-Z]*.ts', 'the cover skips **/use-*.ts', RUNS_ONLY_WHERE_TYPES_ARE_KNOWN]),
  'r2-d74': leftUncovered(ARRAY_MUTATION_PAIRS, [RUNS_ONLY_WHERE_TYPES_ARE_KNOWN]),
  'r2-d78': leftUncovered(['react/prefer-read-only-props covered by functional/prefer-immutable-types'], [RUNS_ONLY_WHERE_TYPES_ARE_KNOWN]),
  'q-dogfood-map-spread-pair': leftUncovered(['oxc/no-map-spread covered by functional/immutable-data'], [RUNS_ONLY_WHERE_TYPES_ARE_KNOWN]),
  'my-covered-by-test-files': leftUncovered(NON_NULL_ASSERTION_PAIRS, SKIPS_TEST_FILES),
  'my-covered-by-test-files-declarative': [
    ...leftUncovered(
      [
        '@eslint-react/x-no-class-component covered by functional/no-classes',
        '@typescript-eslint/no-extraneous-class covered by functional/no-classes',
        NO_INVALID_THIS,
        NO_NEW,
        NO_UNUSED_EXPRESSIONS,
      ],
      SKIPS_TEST_FILES,
    ),
    `${NO_INVALID_THIS}: the cover skips **/*{ErrorBoundary,error-boundary}*.{ts,tsx,js,jsx}`,
  ],
}

/** "Covered in oxlint by": each rule left out where oxlint runs it and the other rule, and that rule. */
export const COVERED_IN_OXLINT_BY: Readonly<Record<string, string>> = {
  'jsx-a11y/html-has-lang': 'jsx-a11y/lang',
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
  'oxc/missing-throw': { standIn: 'sonarjs/no-unthrown-error', card: 'read-oxc-stand-ins' },
}

/** Each oxlint rule ESLint has no version of and no rule stands in for: the card its recorded search starts with. */
export const WITHOUT_AN_ESLINT_STAND_IN: Readonly<Record<string, string>> = {
  'oxc/bad-array-method-on-arguments': 'read-oxc-stand-ins',
  'oxc/bad-min-max-func': 'read-oxc-stand-ins',
  'oxc/const-comparisons': 'read-oxc-stand-ins',
  'oxc/no-accumulating-spread': 'read-oxc-stand-ins',
  'oxc/no-async-endpoint-handlers': 'read-oxc-stand-ins',
  'oxc/no-map-spread': 'read-oxc-stand-ins',
  'oxc/number-arg-out-of-range': 'read-oxc-stand-ins',
  'oxc/only-used-in-recursion': 'read-oxc-stand-ins',
  'oxc/uninvoked-array-callback': 'read-oxc-stand-ins',
}
