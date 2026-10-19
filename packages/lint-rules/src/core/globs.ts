import { foundOr } from '@workspace/rule-data/collections'
import { namedGroupsOf } from './named-groups.ts'

const ANY_DEPTH = '**/'
const NEGATION = '!'
const ESCAPE = '\\'
export const LEADING_DOT_SLASH = './'
const FOLDER_SEPARATOR = '/'
const ROOT_ANCHORS = [LEADING_DOT_SLASH, FOLDER_SEPARATOR]
const EVERY_FILE_UNDER = '**'
// What minimatch reads as glob syntax, which a directory may be named with (Next.js's `[id]`, `(group)`).
const GLOB_SYNTAX_CHARACTERS = String.raw`*?[\]{}()!+@#\\`
const GLOB_SYNTAX = new RegExp(`[${GLOB_SYNTAX_CHARACTERS}]`, 'gu')
const LITERAL_GLOB = new RegExp(String.raw`^(?:[^${GLOB_SYNTAX_CHARACTERS}]|\\.)*$`, 'su')
const ESCAPED_CHARACTER = /\\(?<character>.)/gsu
// Every file at any depth, dot folders included (measured).
export const EVERY_FILE_AT_ANY_DEPTH = '**/*'
const EXTENSION_DOT = '.'
const BRACE_SEPARATOR = ','
const EXTGLOB_SEPARATOR = '|'
const FILES_OF_EXTENSIONS = /^\*\*\/\*\.(?:\{(?<braced>[\w,]+)\}|(?<bare>\w+))$/u

/** In ignores, a negated glob takes back a file an earlier glob left out. */
export function isNegated(glob: string): boolean {
  return glob.startsWith(NEGATION)
}

export function withoutNegation(negatedGlob: string): string {
  return negatedGlob.slice(NEGATION.length)
}

export function negationOf(glob: string): string {
  return `${NEGATION}${glob}`
}

export function keepingNegation(glob: string, change: (pattern: string) => string): string {
  return isNegated(glob) ? negationOf(change(withoutNegation(glob))) : change(glob)
}

export function isLedByAnyDepth(pattern: string): boolean {
  return pattern.startsWith(ANY_DEPTH)
}

/** `./x` and `/x` each name x at the root, in the engine reading that form. */
export function withoutRootAnchor(glob: string): string {
  const anchored = pathAnchoredAtTheRoot(glob)
  return anchored === null ? glob : anchored
}

/** ESLint drops a glob's leading `./` (@eslint/config-array, normalizePattern). */
export function withoutLeadingDotSlash(glob: string): string {
  return glob.startsWith(LEADING_DOT_SLASH) ? glob.slice(LEADING_DOT_SLASH.length) : glob
}

export function literalGlobOf(path: string): string {
  return path.replaceAll(GLOB_SYNTAX, (character) => `${ESCAPE}${character}`)
}

/** Null for a glob holding unescaped glob syntax. ESLint drops a leading `./`, so the path does too. */
export function pathNamedBy(glob: string): string | null {
  if (!LITERAL_GLOB.test(glob)) return null
  return withoutLeadingDotSlash(glob.replaceAll(ESCAPED_CHARACTER, '$<character>'))
}

/** A folder named with or without a trailing slash alike. */
export function everyFileUnderFoldersMatching(glob: string): string {
  if (isNegated(glob)) return negationOf(everyFileUnderFoldersMatching(withoutNegation(glob)))
  if (glob.endsWith(`${FOLDER_SEPARATOR}${EVERY_FILE_UNDER}`)) return glob
  return glob.endsWith(FOLDER_SEPARATOR) ? `${glob}${EVERY_FILE_UNDER}` : `${glob}${FOLDER_SEPARATOR}${EVERY_FILE_UNDER}`
}

export function namesFoldersOnly(glob: string): boolean {
  return glob.endsWith(FOLDER_SEPARATOR)
}

export function withoutTheLastSlash(glob: string): string {
  return namesFoldersOnly(glob) ? glob.slice(0, -FOLDER_SEPARATOR.length) : glob
}

// oxlint matches a slash-free glob at any depth and ESLint only at the root, so a slash-free glob
// gets ANY_DEPTH, the form both engines read the same way.
export function normalizeGlob(glob: string): string {
  if (isNegated(glob)) return negationOf(normalizeGlob(withoutNegation(glob)))
  return glob.includes('/') ? glob : `${ANY_DEPTH}${glob}`
}

export function normalizeGlobs(globs: readonly string[] | null): readonly string[] | null {
  return globs === null ? null : globs.map(normalizeGlob)
}

/** The forms ESLint and oxlint both read as this .gitignore line: a `./` or `/` path in both engines' root forms, a slash-free line at any depth. */
export function formsOfAnIgnoresValue(value: string): string[] {
  if (isNegated(value)) return formsOfAnIgnoresValue(withoutNegation(value)).map(negationOf)
  const anchored = pathAnchoredAtTheRoot(value)
  if (anchored !== null) return rootFormsOfBothEngines(anchored)
  return [isReadAtAnyDepth(value) ? `${ANY_DEPTH}${value}` : value]
}

function pathAnchoredAtTheRoot(value: string): string | null {
  const anchor = ROOT_ANCHORS.find((prefix) => value.startsWith(prefix))
  return anchor === undefined ? null : value.slice(anchor.length)
}

/** Each engine reads the other's root form as matching nothing (measured, ESLint 10.12 and oxlint 1.87). */
function rootFormsOfBothEngines(path: string): string[] {
  return [`${LEADING_DOT_SLASH}${path}`, `${FOLDER_SEPARATOR}${path}`]
}

/** A .gitignore reads a line in any folder when it holds no slash but a trailing one. */
function isReadAtAnyDepth(line: string): boolean {
  return !withoutTheLastSlash(line).includes(FOLDER_SEPARATOR)
}

export function filesOfExtensions(extensions: readonly string[]): string {
  const first = foundOr(extensions.at(0), 'a glob of files by their extensions names at least one')
  const extensionsGlob = extensions.length === 1 ? first : `{${extensions.join(BRACE_SEPARATOR)}}`
  return `${EVERY_FILE_AT_ANY_DEPTH}${EXTENSION_DOT}${extensionsGlob}`
}

export function extensionsNamedBy(glob: string): string[] | null {
  const match = FILES_OF_EXTENSIONS.exec(glob)
  if (match === null) return null
  const { braced, bare } = namedGroupsOf(match)
  if (braced !== undefined) return braced.split(BRACE_SEPARATOR)
  return [foundOr(bare, `${FILES_OF_EXTENSIONS.source} matched ${glob} without an extension`)]
}

/** As an extglob, which only ESLint's minimatch reads. */
export function filesOfOtherExtensionsThan(extensions: readonly string[]): string {
  return `${ANY_DEPTH}!(${extensions.map((extension) => `*${EXTENSION_DOT}${extension}`).join(EXTGLOB_SEPARATOR)})`
}
