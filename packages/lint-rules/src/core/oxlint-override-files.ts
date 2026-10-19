import { foundOr } from '@workspace/rule-data/collections'
import type { OxlintOverride } from 'oxlint'
import type { FilesCondition, FilesTerm } from './file-conditions.ts'
import {
  EVERY_FILE_AT_ANY_DEPTH,
  extensionsNamedBy,
  filesOfExtensions,
  isNegated,
  LEADING_DOT_SLASH,
  negationOf,
  pathNamedBy,
  withoutLeadingDotSlash,
  withoutNegation,
} from './globs.ts'

// A files condition as oxlint overrides apply it (measured, oxlint 1.87): a term's first glob goes in `files`
// and the others negated in `excludeFiles`. A glob with no slash matches in any folder in oxlint but in the
// config's folder alone in ESLint, so it is written `./a.js`; negated, it has no form (`!./a.js` excludes
// every file), so such a glob always goes in `files`.

export type OverrideFiles = Pick<OxlintOverride, 'files' | 'excludeFiles'>

/** `no file` where they share none; `not one glob` where no one glob can say it. */
type Joined = { readonly kind: 'one glob'; readonly glob: string } | { readonly kind: 'no file' } | { readonly kind: 'not one glob' }

type WrittenTerm = { readonly glob: string; readonly excludeFiles: readonly string[] }

const ANY_FOLDERS = '**/'
const EVERY_FILE_UNDER = '/**'
const FOLDER_SEPARATOR = '/'
const EXTENSION_DOT = '.'
const NOT_FOUND = -1
const NOT_ONE_GLOB: Joined = { kind: 'not one glob' }
const NO_FILE: Joined = { kind: 'no file' }

/** One override per list of globs its terms exclude. */
export function overrideFilesOf(condition: FilesCondition): OverrideFiles[] {
  const written = condition.flatMap(writtenTermOf)
  const excludeKeys = [...new Set(written.map(({ excludeFiles }) => keyOf(excludeFiles)))]
  return excludeKeys.map((key) => filesOfAlike(written.filter(({ excludeFiles }) => keyOf(excludeFiles) === key)))
}

export function filesLess(files: readonly string[], excludeFiles: readonly string[]): OverrideFiles {
  return { files: [...files], ...(excludeFiles.length === 0 ? {} : { excludeFiles: [...excludeFiles] }) }
}

function filesOfAlike(alike: readonly WrittenTerm[]): OverrideFiles {
  const { excludeFiles } = foundOr(alike.at(0), 'a group of written terms holds at least one')
  return filesLess([...new Set(alike.map(({ glob }) => glob))], excludeFiles)
}

/** A glob naming files in the config's folder alone goes first in `files`. None where its globs match no file together. */
function writtenTermOf({ all, none }: FilesTerm): WrittenTerm[] {
  const kept = globsJoined(all)
  if (kept === null) return []
  const [first = EVERY_FILE_AT_ANY_DEPTH, ...rest] = withThoseOfTheConfigFolderFirst(kept.filter((glob) => !isNegated(glob)))
  const missed = kept.filter(isNegated).map(withoutNegation)
  const excluded = [...missed, ...none].map(writtenFromTheConfigFolder)
  return [{ glob: writtenFromTheConfigFolder(first), excludeFiles: [...rest.map(everyFileItDoesNotMatch), ...excluded] }]
}

function writtenFromTheConfigFolder(glob: string): string {
  return glob.includes(FOLDER_SEPARATOR) ? glob : `${LEADING_DOT_SLASH}${glob}`
}

function withThoseOfTheConfigFolderFirst(globs: readonly string[]): string[] {
  return [...globs.filter(namesFilesInTheConfigFolderAlone), ...globs.filter((glob) => !namesFilesInTheConfigFolderAlone(glob))]
}

/** As ESLint reads it: no slash once a leading `./` is dropped. */
function namesFilesInTheConfigFolderAlone(glob: string): boolean {
  return !withoutLeadingDotSlash(glob).includes(FOLDER_SEPARATOR)
}

/** Null where two of them match no file together. */
function globsJoined(globs: readonly string[]): readonly string[] | null {
  return globs.reduce<readonly string[] | null>((joinedSoFar, glob) => (joinedSoFar === null ? null : withGlobJoined(joinedSoFar, glob)), [])
}

/** Null where it and one of them match no file together. */
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

/** The one glob matching the files both match, where globs alone can tell. A negated glob joins only one matching every file. */
function joined(first: string, second: string): Joined {
  if (first === EVERY_FILE_AT_ANY_DEPTH || first === second) return { kind: 'one glob', glob: second }
  if (second === EVERY_FILE_AT_ANY_DEPTH) return { kind: 'one glob', glob: first }
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

function joinedByExtensions(first: string, second: string): Joined {
  const firstExtensions = extensionsNamedBy(first)
  const secondExtensions = extensionsNamedBy(second)
  if (firstExtensions === null || secondExtensions === null) return NOT_ONE_GLOB
  const shared = firstExtensions.filter((extension) => secondExtensions.includes(extension))
  return shared.length === 0 ? NO_FILE : { kind: 'one glob', glob: filesOfExtensions(shared) }
}

function isUnderTheFolderOf(glob: string, folderGlob: string): boolean {
  const folder = literalFolderOf(folderGlob)
  return folder !== null && glob.startsWith(`${folder}${FOLDER_SEPARATOR}`)
}

/** Null for any other glob. */
function literalFolderOf(glob: string): string | null {
  if (!glob.endsWith(EVERY_FILE_UNDER)) return null
  return pathNamedBy(glob.slice(0, -EVERY_FILE_UNDER.length))
}

/** A glob of more parts may match from a folder above (every file in a `keep` folder includes keep/legacy/a.js), so it joins no folder's glob. */
function filesOfAFolderAtAnyDepth(folderGlob: string, anyDepthGlob: string): string[] {
  if (!folderGlob.endsWith(EVERY_FILE_UNDER) || !anyDepthGlob.startsWith(ANY_FOLDERS)) return []
  const pathPart = anyDepthGlob.slice(ANY_FOLDERS.length)
  return pathPart.includes(FOLDER_SEPARATOR) ? [] : [`${folderGlob}${FOLDER_SEPARATOR}${pathPart}`]
}

/** oxlint prefixes a slash-less glob with ANY_FOLDERS, which would land before the `!`, so such a glob is written at any depth. */
function everyFileItDoesNotMatch(glob: string): string {
  const fromTheConfigFolder = withoutLeadingDotSlash(glob)
  return negationOf(fromTheConfigFolder.includes(FOLDER_SEPARATOR) ? fromTheConfigFolder : `${ANY_FOLDERS}${fromTheConfigFolder}`)
}

function keyOf(globs: readonly string[]): string {
  return JSON.stringify(globs)
}
