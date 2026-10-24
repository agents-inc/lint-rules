// The globs a rule's files or ignores name test files by. Nothing but the guard in canonical-list.test.ts
// catches a list that leaves one out, so each is written out here rather than read from the data.

/** Test files, files under `__tests__`, and Vitest's type tests (`*.test-d.ts`), in the order rules.json lists them. */
export const TEST_FILE_GLOBS: readonly string[] = ['**/*.{test,spec}.{ts,tsx,js,jsx}', '**/__tests__/**', '**/*.{test,spec}-d.{ts,tsx,js,jsx}']

/** Story files, where Testing Library runs in `play` functions. */
export const STORY_FILE_GLOB = '**/*.stories.{ts,tsx,js,jsx,mjs}'

/** Every rule that skips test and type-test files: those that skipped them first, then those that judge test code by source-code standards. */
export const RULES_SKIPPING_TEST_FILES: readonly string[] = [
  '@typescript-eslint/no-non-null-assertion',
  'max-lines',
  'react-hooks/refs',
  'react-hooks/rules-of-hooks',
  'sonarjs/cognitive-complexity',
  '@typescript-eslint/no-unsafe-type-assertion',
  'functional/no-classes',
  'functional/no-expression-statements',
  'functional/no-return-void',
  'functional/no-this-expressions',
  'sonarjs/file-name-differ-from-class',
  'sonarjs/max-lines-per-function',
  'sonarjs/no-undefined-assignment',
  'unicorn/no-incorrect-template-string-interpolation',
  'unicorn/no-repeated-call-wrappers',
  'unicorn/prefer-await',
]

/** A glob naming test files in any spelling: the guard reads each such glob, not only the three it expects. */
export const NAMES_TEST_FILES = /test|spec/u
