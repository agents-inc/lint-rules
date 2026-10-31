// Shipped rules oxlint has a version of that ESLint runs instead, each for the measured reason its group names
// (oxlint 1.87).

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
const SPLIT_BY_TYPES = ['no-constant-condition', 'no-implied-eval', 'no-throw-literal', 'unicorn/no-await-in-promise-methods']

/**
 * By a fix that changes what the code does where ESLint's version, typed, leaves the code alone: oxlint's makes the
 * import a decorated class's emitted metadata reads type-only.
 */
const FIXES_WHAT_TYPES_LEAVE_ALONE = ['@typescript-eslint/consistent-type-imports']

/**
 * By a false alarm whose fix breaks the code, on a shape ESLint's version leaves alone: oxlint's prefer-at rewrites the
 * last item of a NodeList to `.at(-1)`, which a NodeList lacks; its prefer-single-call merges calls to a class's own push;
 * its jsx-curly-brace-presence unbraces a string holding an escape, which a JSX attribute then reads as written.
 */
const FIXES_WHAT_ESLINT_LEAVES_ALONE = ['react/jsx-curly-brace-presence', 'unicorn/prefer-at', 'unicorn/prefer-single-call']

/** By a finding ESLint's version reports that oxlint's leaves alone, each pinned in the oxlint-versions cases. */
const MISSES_A_FINDING = [
  '@typescript-eslint/no-dynamic-delete',
  'array-callback-return',
  'no-lone-blocks',
  'unicorn/prefer-includes',
  'unicorn/prefer-keyboard-event-key',
  'unicorn/prefer-type-error',
]

/** By a fix ESLint's version makes that oxlint's does not, on code both report. */
const FIXES_ONLY_ESLINT_MAKES = [
  '@typescript-eslint/no-inferrable-types',
  'no-useless-return',
  'unicorn/prefer-array-flat',
  'unicorn/prefer-array-index-of',
  'unicorn/prefer-array-some',
  'unicorn/prefer-date-now',
  'unicorn/prefer-dom-node-remove',
  'unicorn/prefer-export-from',
  'unicorn/prefer-modern-math-apis',
  'unicorn/prefer-native-coercion-functions',
  'unicorn/prefer-number-properties',
  'unicorn/prefer-object-from-entries',
  'unicorn/prefer-string-slice',
]

/**
 * By a false alarm on code ESLint's version, with type information, leaves alone: a fallback for a parameter typed any,
 * unknown or nullable, which a default would not replace.
 */
const REPORTS_WHAT_TYPES_LEAVE_ALONE = ['unicorn/prefer-default-parameters']

/**
 * By a false alarm on a call ESLint's version leaves to another rule: the replace call that escapes a string for a
 * RegExp, which ESLint's prefer-string-replace-all leaves to prefer-regexp-escape.
 */
const REPORTS_WHAT_ESLINT_LEAVES_TO_ANOTHER_RULE = ['unicorn/prefer-string-replace-all']

/** By files of its own, a scope the oxlint build turns no rule on in. */
const FILES_OF_ITS_OWN = ['@typescript-eslint/prefer-namespace-keyword']

/** Every rule routed to ESLint for a measured reason, sorted. */
export const ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON: readonly string[] = [
  ...SKIPPED_FILE_TYPES,
  ...REFUSED_OPTIONS,
  ...SPLIT_BY_TYPES,
  ...FIXES_WHAT_TYPES_LEAVE_ALONE,
  ...FIXES_WHAT_ESLINT_LEAVES_ALONE,
  ...MISSES_A_FINDING,
  ...FIXES_ONLY_ESLINT_MAKES,
  ...REPORTS_WHAT_TYPES_LEAVE_ALONE,
  ...REPORTS_WHAT_ESLINT_LEAVES_TO_ANOTHER_RULE,
  ...FILES_OF_ITS_OWN,
].toSorted()

/**
 * Rules ESLint runs that oxlint has an untyped version of, with no reason yet, each until the owner answers its card:
 * one whose oxlint fix changes what the code does where ESLint's leaves the code alone, or one whose fix, withheld by
 * check, only ESLint's version makes.
 */
export const RULES_WAITING_ON_AN_OWNER_ANSWER: ReadonlyArray<{ readonly rule: string; readonly card: string }> = [
  { rule: '@typescript-eslint/prefer-function-type', card: 'q-lint-slice2-oxlint-fix-changes-meaning' },
  { rule: 'no-var', card: 'q-lint-slice2-oxlint-fix-changes-meaning' },
  { rule: 'unicorn/prefer-dom-node-append', card: 'q-lint-slice2-oxlint-fix-changes-meaning' },
  { rule: 'unicorn/prefer-dom-node-text-content', card: 'q-lint-slice2-oxlint-fix-changes-meaning' },
  { rule: 'unicorn/prefer-modern-dom-apis', card: 'q-lint-prefer-modern-dom-apis-engine' },
  { rule: 'unicorn/prefer-regexp-test', card: 'q-lint-slice2-oxlint-fix-changes-meaning' },
]
