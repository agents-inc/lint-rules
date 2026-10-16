import type { OxlintOverride } from 'oxlint'
import type { FilesCondition, FilesTerm } from './file-conditions.ts'
import { extensionsNamedBy, filesOfExtensions, NEGATION, pathNamedBy } from './globs.ts'

// A files condition as oxlint overrides apply it. An override takes a file where a glob of `files`
// matches it and no glob of `excludeFiles` does, and reads a negated glob in `excludeFiles` as every
// file that glob does not match (measured, oxlint 1.87): so a term's globs ANDed are its first in
// `files` and each other negated in `excludeFiles`. Where one glob can say two, as a folder's every
// file and every TS file say the folder's TS files, they are joined into it, which every reader of
// the config reads alike. A glob with no slash names a file in the config's folder alone, as ESLint
// reads it, where oxlint reads it in any folder: so it is written from the config's folder, `./a.js`,
// which oxlint reads as that file alone in `files` and `excludeFiles` (measured, 1.87). Negated, a
// glob of the config's folder alone, `a.js` or `./*.ts`, has no form, as `!./a.js` and `!/a.js`
// exclude every file (measured, 1.87): so a term holding one has it in `files`, and a file there
// matches each other glob with no slash where it matches it at any depth.

/** The files an override applies to, as it names them. */
export type OverrideFiles = Pick<OxlintOverride, 'files' | 'excludeFiles'>

/** Two globs joined: the one glob matching the files both match, no file, or none where no one glob can say it. */
type Joined = { readonly kind: 'one glob'; readonly glob: string } | { readonly kind: 'no file' } | { readonly kind: 'not one glob' }

/** A term as one override names it: the glob of its `files`, and its `excludeFiles`. */
type WrittenTerm = { readonly glob: string; readonly excludeFiles: readonly string[] }

const CATCH_ALL = '**/*'
const ANY_FOLDERS = '**/'
const EVERY_FILE_UNDER = '/**'
const FOLDER_SEPARATOR = '/'
const LEADING_DOT_SLASH = './'
const EXTENSION_DOT = '.'
const NOT_FOUND = -1
const NOT_ONE_GLOB: Joined = { kind: 'not one glob' }
const NO_FILE: Joined = { kind: 'no file' }

/** The condition as few overrides apply it: one per list of globs its terms exclude, `files` holding each such term's glob. */
export function overrideFilesOf(condition: FilesCondition): OverrideFiles[] {
  const written = condition.flatMap(writtenTermOf)
  const excludeKeys = [...new Set(written.map(({ excludeFiles }) => keyOf(excludeFiles)))]
  return excludeKeys.map((key) => filesOfAlike(written.filter(({ excludeFiles }) => keyOf(excludeFiles) === key)))
}

/** The files given, less those the globs given match: no `excludeFiles` where none are given. */
export function filesLess(files: readonly string[], excludeFiles: readonly string[]): OverrideFiles {
  return { files: [...files], ...(excludeFiles.length === 0 ? {} : { excludeFiles: [...excludeFiles] }) }
}

/** Terms excluding the same globs, as one override: each term's glob in `files`. */
function filesOfAlike(alike: readonly WrittenTerm[]): OverrideFiles {
  const [first] = alike
  if (first === undefined) throw new Error('a group of written terms holds at least one')
  return filesLess([...new Set(alike.map(({ glob }) => glob))], first.excludeFiles)
}

/**
 * A term as one override: its globs joined, the first it asks a file to match in `files`, one naming
 * files in the config's folder alone first, each other negated and each it asks a file to miss in
 * `excludeFiles`. None where its globs match no file together.
 */
function writtenTermOf({ all, none }: FilesTerm): WrittenTerm[] {
  const kept = globsJoined(all)
  if (kept === null) return []
  const [first = CATCH_ALL, ...rest] = withThoseOfTheConfigFolderFirst(kept.filter((glob) => !isNegated(glob)))
  const missed = kept.filter(isNegated).map(withoutNegation)
  const excluded = [...missed, ...none].map(writtenFromTheConfigFolder)
  return [{ glob: writtenFromTheConfigFolder(first), excludeFiles: [...rest.map(everyFileItDoesNotMatch), ...excluded] }]
}

/** The glob as oxlint reads it in `files` and `excludeFiles`: one with no slash, from the config's folder. */
function writtenFromTheConfigFolder(glob: string): string {
  return glob.includes(FOLDER_SEPARATOR) ? glob : `${LEADING_DOT_SLASH}${glob}`
}

/** The globs, those naming files in the config's folder alone first. */
function withThoseOfTheConfigFolderFirst(globs: readonly string[]): string[] {
  return [...globs.filter(namesFilesInTheConfigFolderAlone), ...globs.filter((glob) => !namesFilesInTheConfigFolderAlone(glob))]
}

/** Whether the glob names files in the config's folder alone, as ESLint reads it: it has no slash once a leading `./` is dropped. */
function namesFilesInTheConfigFolderAlone(glob: string): boolean {
  return !withoutALeadingDotSlash(glob).includes(FOLDER_SEPARATOR)
}

/** The globs, each joined into the first it joins: null where two of them match no file together. */
function globsJoined(globs: readonly string[]): readonly string[] | null {
  return globs.reduce<readonly string[] | null>((joinedSoFar, glob) => (joinedSoFar === null ? null : withGlobJoined(joinedSoFar, glob)), [])
}

/** The globs with one more joined into the first it joins, or after them: null where it and one of them match no file together. */
function withGlobJoined(globs: readonly string[], glob: string): readonly string[] | null {
  const joins = globs.map((each) => joined(each, glob))
  if (joins.some(({ kind }) => kind === 'no file')) return null
  const index = joins.findIndex(({ kind }) => kind === 'one glob')
  if (index === NOT_FOUND) return [...globs, glob]
  return globs.toSpliced(index, 1, globOfAJoin(joins[index]))
}

function globOfAJoin(join: Joined | undefined): string {
  if (join === undefined || join.kind !== 'one glob') throw new Error('only a join into one glob gives a glob')
  return join.glob
}

/**
 * The one glob matching the files both match: either, where the other matches every file or both
 * are the same, or one names files under a folder whose every file the other matches; a path, where
 * the other matches it; the extensions two globs of extensions share; and a folder's files a glob
 * matches at any depth, as a folder's every file and every TS file give its TS files. No file where
 * those show none. A negated glob joins only those matching every file.
 */
function joined(first: string, second: string): Joined {
  if (first === CATCH_ALL || first === second) return { kind: 'one glob', glob: second }
  if (second === CATCH_ALL) return { kind: 'one glob', glob: first }
  if (isNegated(first) || isNegated(second)) return NOT_ONE_GLOB
  if (isUnderTheFolderOf(second, first)) return { kind: 'one glob', glob: second }
  if (isUnderTheFolderOf(first, second)) return { kind: 'one glob', glob: first }
  const withAPath = joinedWithAPath(first, second)
  if (withAPath.kind !== 'not one glob') return withAPath
  const byExtensions = joinedByExtensions(first, second)
  if (byExtensions.kind !== 'not one glob') return byExtensions
  const [inAFolder] = [...filesOfAFolderAtAnyDepth(first, second), ...filesOfAFolderAtAnyDepth(second, first)]
  return inAFolder === undefined ? NOT_ONE_GLOB : { kind: 'one glob', glob: inAFolder }
}

function joinedWithAPath(first: string, second: string): Joined {
  const firstPath = pathNamedBy(first)
  if (firstPath !== null) return pathJoinedWith(first, firstPath, second)
  const secondPath = pathNamedBy(second)
  return secondPath === null ? NOT_ONE_GLOB : pathJoinedWith(second, secondPath, first)
}

/** The path, where the other glob names it too, or matches it by its extension or a folder holding it: else no file. */
function pathJoinedWith(pathGlob: string, path: string, other: string): Joined {
  const otherPath = pathNamedBy(other)
  if (otherPath !== null) return keptWhere(otherPath === path, pathGlob)
  const extensions = extensionsNamedBy(other)
  if (extensions !== null) return keptWhere(extensions.some((extension) => path.endsWith(`${EXTENSION_DOT}${extension}`)), pathGlob)
  const folder = literalFolderOf(other)
  if (folder !== null) return keptWhere(path.startsWith(`${folder}${FOLDER_SEPARATOR}`), pathGlob)
  return NOT_ONE_GLOB
}

function keptWhere(matches: boolean, glob: string): Joined {
  return matches ? { kind: 'one glob', glob } : NO_FILE
}

/** Two globs of extensions: the extensions both name, else no file. */
function joinedByExtensions(first: string, second: string): Joined {
  const firstExtensions = extensionsNamedBy(first)
  const secondExtensions = extensionsNamedBy(second)
  if (firstExtensions === null || secondExtensions === null) return NOT_ONE_GLOB
  const shared = firstExtensions.filter((extension) => secondExtensions.includes(extension))
  return shared.length === 0 ? NO_FILE : { kind: 'one glob', glob: filesOfExtensions(shared) }
}

/** Whether the glob starts with the folder another glob names every file under, so matches only files the other matches too. */
function isUnderTheFolderOf(glob: string, folderGlob: string): boolean {
  const folder = literalFolderOf(folderGlob)
  return folder !== null && glob.startsWith(`${folder}${FOLDER_SEPARATOR}`)
}

/** The folder a glob of every file under one literal folder names: null for any other glob. */
function literalFolderOf(glob: string): string | null {
  if (!glob.endsWith(EVERY_FILE_UNDER)) return null
  return pathNamedBy(glob.slice(0, -EVERY_FILE_UNDER.length))
}

/**
 * A folder's files a glob of one path part at any depth matches: that part is a file below the
 * folder. A glob of more parts may match from a folder above the folder's end, as the glob of every
 * file in a keep folder matches keep/legacy/a.js, a file in a legacy folder too, so it joins no
 * folder's glob.
 */
function filesOfAFolderAtAnyDepth(folderGlob: string, anyDepthGlob: string): string[] {
  if (!folderGlob.endsWith(EVERY_FILE_UNDER) || !anyDepthGlob.startsWith(ANY_FOLDERS)) return []
  const pathPart = anyDepthGlob.slice(ANY_FOLDERS.length)
  return pathPart.includes(FOLDER_SEPARATOR) ? [] : [`${folderGlob}${FOLDER_SEPARATOR}${pathPart}`]
}

/**
 * The glob negated, as `excludeFiles` reads it: every file it does not match. oxlint puts `**` and a
 * slash in front of a glob with no slash, which would put them before the `!` too, so such a glob is
 * written at any depth: only beside `files` naming files in the config's folder alone, which match
 * it there where they match it at any depth.
 */
function everyFileItDoesNotMatch(glob: string): string {
  const fromTheConfigFolder = withoutALeadingDotSlash(glob)
  return `${NEGATION}${fromTheConfigFolder.includes(FOLDER_SEPARATOR) ? fromTheConfigFolder : `${ANY_FOLDERS}${fromTheConfigFolder}`}`
}

function withoutALeadingDotSlash(glob: string): string {
  return glob.startsWith(LEADING_DOT_SLASH) ? glob.slice(LEADING_DOT_SLASH.length) : glob
}

function keyOf(globs: readonly string[]): string {
  return JSON.stringify(globs)
}

function isNegated(glob: string): boolean {
  return glob.startsWith(NEGATION)
}

function withoutNegation(glob: string): string {
  return glob.slice(NEGATION.length)
}
