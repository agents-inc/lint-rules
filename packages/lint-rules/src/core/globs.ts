const ANY_DEPTH = '**/'
export const NEGATION = '!'
const ESCAPE = '\\'
const LEADING_DOT_SLASH = './'
const FOLDER_SEPARATOR = '/'
const EVERY_FILE_UNDER = '**'
// What minimatch reads as glob syntax in a path, which a directory may be named with: Next.js's
// `[id]` and `(group)` among them. A backslash makes each one literal.
const GLOB_SYNTAX_CHARACTERS = String.raw`*?[\]{}()!+@#\\`
const GLOB_SYNTAX = new RegExp(`[${GLOB_SYNTAX_CHARACTERS}]`, 'gu')
// A glob every syntax character of which is escaped: it matches one path.
const LITERAL_GLOB = new RegExp(String.raw`^(?:[^${GLOB_SYNTAX_CHARACTERS}]|\\.)*$`, 'su')
const ESCAPED_CHARACTER = /\\(?<character>.)/gsu
const EVERY_FILE_AT_ANY_DEPTH = '**/*'
const EXTENSION_DOT = '.'
const BRACE_SEPARATOR = ','
const EXTGLOB_SEPARATOR = '|'
// What filesOfExtensions writes: one extension, or several braced.
const FILES_OF_EXTENSIONS = /^\*\*\/\*\.(?:\{(?<braced>[\w,]+)\}|(?<bare>\w+))$/u

/** A glob matching the path given and nothing else, however its directories are named. */
export function literalGlobOf(path: string): string {
  return path.replaceAll(GLOB_SYNTAX, (character) => `${ESCAPE}${character}`)
}

/**
 * The one path a glob names, where it holds no glob syntax but escaped characters, read as
 * themselves: null for any other glob. ESLint drops a leading `./`, so the path does too.
 */
export function pathNamedBy(glob: string): string | null {
  if (!LITERAL_GLOB.test(glob)) return null
  const path = glob.replaceAll(ESCAPED_CHARACTER, '$<character>')
  return path.startsWith(LEADING_DOT_SLASH) ? path.slice(LEADING_DOT_SLASH.length) : path
}

/**
 * A glob matching every file under a folder the glob given matches: a folder named with a trailing
 * slash or without one alike. A negated glob stays negated, and one ending in `/**` already matches
 * them.
 */
export function everyFileUnderFoldersMatching(glob: string): string {
  if (glob.startsWith(NEGATION)) return `${NEGATION}${everyFileUnderFoldersMatching(glob.slice(NEGATION.length))}`
  if (glob.endsWith(`${FOLDER_SEPARATOR}${EVERY_FILE_UNDER}`)) return glob
  return glob.endsWith(FOLDER_SEPARATOR) ? `${glob}${EVERY_FILE_UNDER}` : `${glob}${FOLDER_SEPARATOR}${EVERY_FILE_UNDER}`
}

/** Whether a glob names folders only: one ending in a slash matches no file path. */
export function namesFoldersOnly(glob: string): boolean {
  return glob.endsWith(FOLDER_SEPARATOR)
}

// oxlint matches a slash-free glob at any depth and ESLint only at the root, so a slash-free glob
// gets ANY_DEPTH, the form both engines read the same way. A negated glob keeps its `!` in front.
export function normalizeGlob(glob: string): string {
  if (glob.startsWith(NEGATION)) return `${NEGATION}${normalizeGlob(glob.slice(NEGATION.length))}`
  return glob.includes('/') ? glob : `${ANY_DEPTH}${glob}`
}

export function normalizeGlobs(globs: readonly string[] | null): readonly string[] | null {
  return globs === null ? null : globs.map(normalizeGlob)
}

/** Every file with one of the extensions, at any depth: braced where there are several. */
export function filesOfExtensions(extensions: readonly string[]): string {
  const [onlyExtension, ...rest] = extensions
  if (onlyExtension === undefined) throw new Error('a glob of files by their extensions names at least one')
  return `${EVERY_FILE_AT_ANY_DEPTH}${EXTENSION_DOT}${rest.length === 0 ? onlyExtension : `{${extensions.join(BRACE_SEPARATOR)}}`}`
}

/** The extensions a glob filesOfExtensions writes names: null for any other glob. */
export function extensionsNamedBy(glob: string): string[] | null {
  const match = FILES_OF_EXTENSIONS.exec(glob)
  if (match === null) return null
  const { braced, bare } = namedGroupsOf(match)
  if (braced !== undefined) return braced.split(BRACE_SEPARATOR)
  if (bare === undefined) throw new Error(`${FILES_OF_EXTENSIONS.source} matched ${glob} without an extension`)
  return [bare]
}

function namedGroupsOf({ groups }: RegExpExecArray): Readonly<Record<string, string | undefined>> {
  if (groups === undefined) throw new Error('a pattern with named groups matched without them')
  return groups
}

/** Every file but those with one of the extensions, at any depth, as minimatch reads an extglob (ESLint; oxlint's globs take none). */
export function filesOfOtherExtensionsThan(extensions: readonly string[]): string {
  return `${ANY_DEPTH}!(${extensions.map((extension) => `*${EXTENSION_DOT}${extension}`).join(EXTGLOB_SEPARATOR)})`
}
