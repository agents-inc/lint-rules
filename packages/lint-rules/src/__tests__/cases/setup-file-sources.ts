import { describedTsExpectError, tsIgnore } from './suppression-comments.ts'

export type SetupFileCase = { readonly file: string; readonly source: string }

export const SETUP_FILE_NAMES: readonly string[] = ['vitest.setup', 'jest.setup', 'setupTests', 'test-setup']

/** A name no runner gives its setup file, so the file is a source file like any other. */
export const NOT_A_SETUP_FILE_NAME = 'setup'

export const TEST_FILE_NAME = 'remember.test'

/** A hook's file, by each naming the hook-file skips match. */
export const HOOK_FILE_NAMES: readonly string[] = ['useRemember', 'use-remember']

export const OTHER_TS_EXTENSIONS: readonly string[] = ['mts', 'cts']
export const OTHER_JS_EXTENSIONS: readonly string[] = ['mjs', 'cjs']

const TS = 'ts'

// State a hook keeps, written through a function returning nothing, and read with a non-null assertion.
// Each line breaks a rule test files skip; the write on line 4 also breaks immutable-data, which they keep.
const STATE_A_HOOK_KEEPS = `const seen: string[] = []

export function remember(entry: string): void {
  seen.push(entry)
}

export const first = seen[0]!
`

// State kept in a class, which breaks rules test files skip in JS too; unexported, so it parses as ESM and as CommonJS.
const STATE_A_CLASS_KEEPS = `class Store {
  remember(entry) {
    return this.seen === entry
  }
}
`

// A JS setup file calls the runner's hooks as globals, as Vitest's globals and Jest's own give them.
const HOOK_CALLED_AS_A_GLOBAL = `export const registersCleanup = () => afterEach(() => undefined)
`

export const RULES_TEST_FILES_SKIP: readonly string[] = ['functional/no-return-void', 'functional/no-expression-statements', '@typescript-eslint/no-non-null-assertion']

export const RULES_TEST_FILES_SKIP_IN_JS: readonly string[] = ['functional/no-classes', 'functional/no-this-expressions']

export const RULE_TEST_FILES_KEEP = 'functional/immutable-data'

export const UNDEFINED_NAMES = 'no-undef'

export const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'

/** `file:line rule` for each report STATE_A_HOOK_KEEPS draws where nothing is skipped. */
export function reportsOfTheStateAHookKeeps(file: string): string[] {
  return [`${file}:3 functional/no-return-void`, `${file}:4 functional/no-expression-statements`, `${file}:4 ${RULE_TEST_FILES_KEEP}`, `${file}:7 @typescript-eslint/no-non-null-assertion`]
}

/** The same in a hook's file, which functional's no-return-void and no-expression-statements skip. */
export function reportsOfTheStateAHookKeepsInAHookFile(file: string): string[] {
  return [`${file}:4 ${RULE_TEST_FILES_KEEP}`, `${file}:7 @typescript-eslint/no-non-null-assertion`]
}

/** `file:line rule` for each report STATE_A_CLASS_KEEPS draws where nothing is skipped. */
export function reportsOfTheStateAClassKeeps(file: string): string[] {
  return [`${file}:1 functional/no-classes`, `${file}:3 functional/no-this-expressions`]
}

export function stateAHookKeepsIn(name: string, extension = TS): SetupFileCase {
  return { file: `src/hooks/${name}.${extension}`, source: STATE_A_HOOK_KEEPS }
}

export function stateAClassKeepsIn(name: string, extension: string): SetupFileCase {
  return { file: `src/classes/${name}.${extension}`, source: STATE_A_CLASS_KEEPS }
}

export function hookCalledAsAGlobalIn(name: string): SetupFileCase {
  return { file: `src/globals/${name}.js`, source: HOOK_CALLED_AS_A_GLOBAL }
}

export function describedTsExpectErrorIn(name: string, extension = TS): SetupFileCase {
  return { file: `src/expect-error/${name}.${extension}`, source: describedTsExpectError }
}

export function tsIgnoreIn(name: string): SetupFileCase {
  return { file: `src/ignore/${name}.ts`, source: tsIgnore }
}

function otherExtensionCasesIn(name: string): SetupFileCase[] {
  return [
    ...OTHER_TS_EXTENSIONS.flatMap((extension) => [stateAHookKeepsIn(name, extension), describedTsExpectErrorIn(name, extension)]),
    ...OTHER_JS_EXTENSIONS.map((extension) => stateAClassKeepsIn(name, extension)),
  ]
}

function projectFilesOf(cases: readonly SetupFileCase[]): Readonly<Record<string, string>> {
  return Object.fromEntries(cases.map(({ file, source }) => [file, source]))
}

export function setupFileProjectFiles(): Readonly<Record<string, string>> {
  return projectFilesOf([...SETUP_FILE_NAMES, NOT_A_SETUP_FILE_NAME].flatMap((name) => [stateAHookKeepsIn(name), hookCalledAsAGlobalIn(name), describedTsExpectErrorIn(name), tsIgnoreIn(name)]))
}

export function otherExtensionProjectFiles(): Readonly<Record<string, string>> {
  return projectFilesOf([
    ...[TEST_FILE_NAME, ...SETUP_FILE_NAMES, NOT_A_SETUP_FILE_NAME].flatMap((name) => otherExtensionCasesIn(name)),
    ...HOOK_FILE_NAMES.flatMap((name) => OTHER_TS_EXTENSIONS.map((extension) => stateAHookKeepsIn(name, extension))),
  ])
}
