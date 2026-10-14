import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import type { FilesEntry } from './file-conditions.ts'
import { NEGATION, normalizeGlob } from './globs.ts'
import { eslintTakesFilesBackFrom } from './ignores-read-by-each-engine.ts'
import type { RuleLayers } from './resolve-rule-layers.ts'

// The files our ESLint part lints, as its blocks name them: every JS and TS file, each typed rule's
// TS files with type information, and each rule's own files; and the global ignores ESLint leaves
// it out of. Here rather than with the blocks, so the oxlint build reads them without loading
// ESLint's side.

const EXTENSION_DOT = '.'
const BRACE_OPEN = '{'
const BRACE_CLOSE = '}'
const BRACE_SEPARATOR = ','
/** The extensions of the JS and TS files our ESLint part lints, without their dot. */
export const JS_AND_TS_EXTENSIONS: ReadonlySet<string> = new Set(['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx'])

/** Every JS and TS file, the only ones our parser and plugins are registered for. */
export const JS_AND_TS_FILES = `**/*.{${[...JS_AND_TS_EXTENSIONS].join(BRACE_SEPARATOR)}}`

/** The TS files, the only ones the project service parses. */
export const TS_FILES = '**/*.{ts,mts,cts,tsx}'

// ESLint's own global ignores, which it applies before those of any config (lib/config/default-config.js,
// ESLint 10.12): it lints no file in a node_modules folder or the root .git folder, unless a config's
// global ignores take it back.
const ESLINT_DEFAULT_IGNORES: readonly string[] = ['**/node_modules/', '.git/']

// The files a consumer writes for us are linted without types, at any depth. A tsconfig may take
// them in or leave them out, and each choice makes one way of typing them a fatal parse error: a
// typed rule without the project service, or allowDefaultProject on a file the project includes.
export const CONSUMER_CONFIG_FILES: readonly string[] = Object.values(consumerConfigFiles).map(normalizeGlob)

/** Our ignores as the agent build gives them to ESLint: one block of global ignores, which ESLint reads after its default ones. */
export function eslintGlobalIgnoresOf(layers: RuleLayers): string[] {
  return [...layers.ignores]
}

/**
 * Our ignores as ESLint applies them to our part in an editor merge, where they keep only our blocks
 * out and are not global (D-a): ours, then ESLint's default ignores, which hold there whatever our
 * negated lines say (decisions.md, 2026-10-12 "fix round 2, after its second review").
 */
export function ignoresEslintAppliesToOurEditorPart(layers: RuleLayers): string[] {
  return [...eslintGlobalIgnoresOf(layers), ...ESLINT_DEFAULT_IGNORES]
}

/** Whether ESLint's default ignores still leave out every file they do under the global ignores given, which it reads after them: none takes a file back. */
export function eslintDefaultIgnoresHoldUnder(globalIgnores: readonly string[]): boolean {
  return !ESLINT_DEFAULT_IGNORES.some((value) => eslintTakesFilesBackFrom(value, globalIgnores))
}

// ESLint ANDs the globs inside a nested array, so each list of alternatives becomes one factor of
// a product: `[[a, b], [c]]` matches (a AND c) OR (b AND c). Each combination is kept to JS and TS
// files, the only ones our parser and plugins are registered for: ESLint lints every file a block's
// glob matches, so `**/*.test.*` alone would hand it `x.test.json`.
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

// Whether a glob's own extension, bare (`**/*.stories.tsx`) or braced (`**/*.{ts,tsx}`), keeps it
// to JS and TS files. Any glob this cannot read is answered no, which costs only a redundant glob.
export function matchesOnlyJsAndTs(glob: string): boolean {
  if (glob.startsWith(NEGATION) || !glob.includes(EXTENSION_DOT)) return false
  return extensionsAfterLastDot(glob).every((extension) => JS_AND_TS_EXTENSIONS.has(extension))
}

function extensionsAfterLastDot(glob: string): string[] {
  const ending = glob.slice(glob.lastIndexOf(EXTENSION_DOT) + EXTENSION_DOT.length)
  const isBraced = ending.startsWith(BRACE_OPEN) && ending.endsWith(BRACE_CLOSE)
  const alternatives = isBraced ? ending.slice(BRACE_OPEN.length, -BRACE_CLOSE.length) : ending
  return alternatives.split(BRACE_SEPARATOR)
}

/** A combination of one glob is written bare; ESLint reads a nested array as its globs ANDed. */
export function asFilesEntry(combination: readonly string[]): FilesEntry {
  const [onlyGlob, ...rest] = combination
  return onlyGlob !== undefined && rest.length === 0 ? onlyGlob : [...combination]
}
