import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import type { FilesEntry } from './file-conditions.ts'
import { isNegated, normalizeGlob } from './globs.ts'
import { eslintTakesFilesBackFrom } from './ignores-read-by-each-engine.ts'
import type { RuleLayers } from './resolve-rule-layers.ts'

// Here rather than with the blocks, so the oxlint build reads them without loading ESLint's side.

const EXTENSION_DOT = '.'
const BRACE_OPEN = '{'
const BRACE_CLOSE = '}'
const BRACE_SEPARATOR = ','
/** Without their dot. */
export const JS_AND_TS_EXTENSIONS: ReadonlySet<string> = new Set(['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx'])

/** The only files our parser and plugins are registered for. */
export const JS_AND_TS_FILES = `**/*.{${[...JS_AND_TS_EXTENSIONS].join(BRACE_SEPARATOR)}}`

/** The only files the project service parses. */
export const TS_FILES = '**/*.{ts,mts,cts,tsx}'

// ESLint's own global ignores, applied before any config's (lib/config/default-config.js, ESLint 10.12).
const ESLINT_DEFAULT_IGNORES: readonly string[] = ['**/node_modules/', '.git/']

// Linted without types at any depth: a tsconfig may take them in or not, and each choice makes one way of
// typing them a fatal parse error.
export const CONSUMER_CONFIG_FILES: readonly string[] = Object.values(consumerConfigFiles).map(normalizeGlob)

export function eslintGlobalIgnoresOf(layers: RuleLayers): string[] {
  return [...layers.ignores]
}

/** In an editor merge our ignores are not global, so ESLint's default ones hold there whatever our negated lines say. */
export function ignoresEslintAppliesToOurEditorPart(layers: RuleLayers): string[] {
  return [...eslintGlobalIgnoresOf(layers), ...ESLINT_DEFAULT_IGNORES]
}

/** Whether no global ignore given takes back a file ESLint's default ignores leave out. */
export function eslintDefaultIgnoresHoldUnder(globalIgnores: readonly string[]): boolean {
  return !ESLINT_DEFAULT_IGNORES.some((value) => eslintTakesFilesBackFrom(value, globalIgnores))
}

// ESLint ANDs the globs inside a nested array: `[[a, b], [c]]` matches (a AND c) OR (b AND c). Each is kept to JS
// and TS files, as ESLint lints every file a block's glob matches: `**/*.test.*` alone would hand it `x.test.json`.
export function filesMatchingAll(globLists: readonly (readonly string[])[]): FilesEntry[] {
  return combinationsOf(globLists).map(keptToJsAndTs).map(asFilesEntry)
}

function combinationsOf(globLists: readonly (readonly string[])[]): string[][] {
  return globLists.reduce<string[][]>(
    (combinations, globs) => combinations.flatMap((combination) => globs.map((glob) => [...combination, glob])),
    [[]],
  )
}

function keptToJsAndTs(combination: readonly string[]): string[] {
  return combination.some(matchesOnlyJsAndTs) ? [...combination] : [...combination, JS_AND_TS_FILES]
}

// A glob this cannot read is answered no, which costs only a redundant glob.
export function matchesOnlyJsAndTs(glob: string): boolean {
  if (isNegated(glob) || !glob.includes(EXTENSION_DOT)) return false
  return extensionsAfterLastDot(glob).every((extension) => JS_AND_TS_EXTENSIONS.has(extension))
}

function extensionsAfterLastDot(glob: string): string[] {
  const ending = glob.slice(glob.lastIndexOf(EXTENSION_DOT) + EXTENSION_DOT.length)
  const isBraced = ending.startsWith(BRACE_OPEN) && ending.endsWith(BRACE_CLOSE)
  const alternatives = isBraced ? ending.slice(BRACE_OPEN.length, -BRACE_CLOSE.length) : ending
  return alternatives.split(BRACE_SEPARATOR)
}

/** ESLint reads a nested array as its globs ANDed. */
export function asFilesEntry(combination: readonly string[]): FilesEntry {
  const [onlyGlob, ...rest] = combination
  return onlyGlob !== undefined && rest.length === 0 ? onlyGlob : [...combination]
}
