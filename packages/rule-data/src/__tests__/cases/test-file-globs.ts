// The globs a rule's files or ignores name test files by. Nothing but the guard in canonical-list.test.ts
// catches a list that leaves one out, so each is written out here rather than read from the data.

/** Test files, files under `__tests__`, and Vitest's type tests (`*.test-d.ts`), in the order rules.json lists them. */
export const TEST_FILE_GLOBS: readonly string[] = ['**/*.{test,spec}.{js,mjs,cjs,jsx,ts,mts,cts,tsx}', '**/__tests__/**', '**/*.{test,spec}-d.{js,mjs,cjs,jsx,ts,mts,cts,tsx}']

/** The usual names of a test runner's setup file, in the extensions test files take: it gets test files' relaxed rules. */
export const SETUP_FILE_GLOBS: readonly string[] = ['**/vitest.setup.{js,mjs,cjs,jsx,ts,mts,cts,tsx}', '**/jest.setup.{js,mjs,cjs,jsx,ts,mts,cts,tsx}', '**/setupTests.{js,mjs,cjs,jsx,ts,mts,cts,tsx}', '**/test-setup.{js,mjs,cjs,jsx,ts,mts,cts,tsx}']

/** What a rule skipping test files skips: test files, then setup files. */
export const TEST_AND_SETUP_FILE_GLOBS: readonly string[] = [...TEST_FILE_GLOBS, ...SETUP_FILE_GLOBS]

/** Story files, in the extensions test files take; Testing Library runs in their `play` functions. */
export const STORY_FILE_GLOB = '**/*.stories.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'

/** What marks a glob as naming story files. */
export const STORY_FILE_NAME_PART = '.stories.'

/** Every rule that skips test, type-test and setup files: those that skipped them first, then those that judge test code by source-code standards. */
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
  'accessor-pairs',
]

/** A glob naming test files in any spelling: the guard reads each such glob, not only the three it expects. */
export const NAMES_TEST_FILES = /test|spec/u
