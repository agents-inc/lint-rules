import type { Linter } from 'eslint'
import type { OxlintConfig, OxlintOverride } from 'oxlint'

// A block or override whose files no path can match changes nothing and should never be written
// (verify.md, U066). These are the contradictions the globs as written show, each engine reading
// them its own way: a glob ANDed with its own negation, two literal paths ANDed, or a glob the
// block's own ignores leave out whole. No glob is matched against a path, so a pair no path can
// meet only by what the globs match (every TS file among every JS and TS file) is not seen.

const NEGATION = '!'
const ESCAPED_CHARACTER = /\\(?<character>.)/gsu
// What minimatch reads as glob syntax once every escaped character is taken out.
const GLOB_SYNTAX = /[*?[\]{}()!+@]/u
const LEADING_DOT_SLASH = './'
const FOLDER_SEPARATOR = '/'
const ANY_DEPTH = '**/'
// A literal glob's path and another glob written the same characters read differently: `[id]` is a
// path's folder in one and a character class in the other, so their keys are kept apart.
const PATH_KEY = 'path '
const GLOB_KEY = 'glob '

/** `name: files and ignores` for each block of an ESLint config whose files no path can match. */
export function eslintBlocksMatchingNoFile(config: readonly Linter.Config[]): string[] {
  return config.flatMap((block, index) => {
    const { files, ignores = [] } = block
    if (files === undefined || !files.map(globsOfEntry).every((entry) => eslintEntryMatchesNoFile(entry, ignores))) return []
    return [`${blockName(block.name, index)}: ${JSON.stringify({ files, ignores })}`]
  })
}

/** `files and excludeFiles` for each override of an oxlint config, or of a config it extends as an object, whose files no path can match. */
export function oxlintOverridesMatchingNoFile(config: OxlintConfig): string[] {
  const { overrides = [], extends: extended = [] } = config
  return [
    ...extended.flatMap((each) => (typeof each === 'string' ? [] : oxlintOverridesMatchingNoFile(each))),
    ...overrides.filter(oxlintOverrideMatchesNoFile).map(({ files, excludeFiles = [] }) => JSON.stringify({ files, excludeFiles })),
  ]
}

/** ESLint reads one glob of `files` as itself, and a list of them as all of them ANDed. */
function globsOfEntry(entry: string | readonly string[]): readonly string[] {
  return typeof entry === 'string' ? [entry] : entry
}

/**
 * ESLint's reading: a file must match every glob of the entry, a negated one by missing it, and no
 * glob of the block's ignores but one a later negated ignore takes back.
 */
function eslintEntryMatchesNoFile(globs: readonly string[], ignores: readonly string[]): boolean {
  const asked = globs.filter((glob) => !isNegated(glob))
  return (
    asked.some((glob) => globs.includes(`${NEGATION}${glob}`)) ||
    new Set(asked.flatMap(eslintPathNamedBy)).size > 1 ||
    asked.some((glob) => isLeftOutWholeBy(eslintKeyOf(glob), ignores))
  )
}

/** Whether a non-negated ignore names the same files as the glob, and no negated ignore after it may take any back. */
function isLeftOutWholeBy(key: string, ignores: readonly string[]): boolean {
  const lastNaming = ignores.findLastIndex((ignore) => !isNegated(ignore) && eslintKeyOf(ignore) === key)
  return lastNaming >= 0 && !ignores.slice(lastNaming + 1).some(isNegated)
}

/** oxlint's reading: a file matches an override where a glob of `files` matches it and none of `excludeFiles` does. */
function oxlintOverrideMatchesNoFile({ files, excludeFiles = [] }: OxlintOverride): boolean {
  const excluded = new Set(excludeFiles.map(oxlintKeyOf))
  return files.length > 0 && files.every((glob) => excluded.has(oxlintKeyOf(glob)))
}

/** The one path a glob names where it holds no glob syntax but escaped characters, read as themselves: none for any other glob. */
function eslintPathNamedBy(glob: string): string[] {
  if (GLOB_SYNTAX.test(glob.replaceAll(ESCAPED_CHARACTER, ''))) return []
  return [withoutALeadingDotSlash(glob.replaceAll(ESCAPED_CHARACTER, '$<character>'))]
}

/** Two globs ESLint reads alike get one key: a literal glob its path, ESLint dropping a leading ./; any other itself. */
function eslintKeyOf(glob: string): string {
  const [path] = eslintPathNamedBy(glob)
  return path === undefined ? `${GLOB_KEY}${glob}` : `${PATH_KEY}${path}`
}

/** oxlint reads an override glob from the config's folder, a ./ dropped, and one with no slash at any depth. */
function oxlintKeyOf(glob: string): string {
  const fromTheConfigFolder = withoutALeadingDotSlash(glob)
  return eslintKeyOf(fromTheConfigFolder.includes(FOLDER_SEPARATOR) ? fromTheConfigFolder : `${ANY_DEPTH}${fromTheConfigFolder}`)
}

function withoutALeadingDotSlash(path: string): string {
  return path.startsWith(LEADING_DOT_SLASH) ? path.slice(LEADING_DOT_SLASH.length) : path
}

function isNegated(glob: string): boolean {
  return glob.startsWith(NEGATION)
}

function blockName(name: string | undefined, index: number): string {
  return name === undefined ? `block ${String(index)}` : name
}
