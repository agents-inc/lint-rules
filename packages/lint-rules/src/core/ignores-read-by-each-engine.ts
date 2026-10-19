import { foundOr } from '@workspace/rule-data/collections'
import { eitherOf, type FilesCondition, filesIgnoredBy } from './file-conditions.ts'
import {
  everyFileUnderFoldersMatching,
  isNegated,
  keepingNegation,
  LEADING_DOT_SLASH,
  namesFoldersOnly,
  negationOf,
  pathNamedBy,
  withoutLeadingDotSlash,
  withoutNegation,
  withoutTheLastSlash,
} from './globs.ts'

// Which files our ignores keep each engine's part out of: ESLint reads them as global ignores, oxlint as
// ignorePatterns, and the two differ only where a negated value takes back a file under a left-out folder.
// ESLint (measured 10.12): a file is out where it or any folder above it matches and no later negated value
// does, so a negation takes back only a folder no folder above it is left out with.
// oxlint (the ignore crate, measured 1.87): the last line matching the file decides, else the last matching
// its deepest matched folder. A line starting `./` matches nothing.
// Where a negation could take back only some files under a folder, it is read as taking back all (a known limit).

type FolderReading =
  | { readonly kind: 'one folder'; readonly path: string }
  | { readonly kind: 'a folder and every folder in it'; readonly path: string }
  | { readonly kind: 'every folder named'; readonly name: string }
  | { readonly kind: 'every folder named, and every folder in one'; readonly name: string }
  | { readonly kind: 'unread' }

type FoldersNamed = Extract<FolderReading, { readonly name: string }>

/** The files under `taken`, less those under `leftOutAgain`. */
type TakeBack = { readonly taken: string; readonly leftOutAgain: readonly string[] }

type IgnoreLine = { readonly index: number; readonly takesBack: boolean; readonly glob: string; readonly matchesFoldersOnly: boolean }

const FOLDER_SEPARATOR = '/'
const ANY_DEPTH = '**/'
const EVERY_FOLDER_IN = '/**'
const FILES_DIRECTLY_IN = '/*'
const NO_TAKE_BACK: TakeBack[] = []

export function filesEslintLeavesOutOf(ignores: readonly string[]): FilesCondition {
  const values = ignores.map(asEslintNormalizesIt)
  const fileValues = values.filter((value) => !namesFoldersOnly(value))
  return eitherOf(filesIgnoredBy(fileValues), ...filesUnderEachFolderValueEslintLeavesOut(values))
}

export function filesOxlintLeavesOutOf(ignores: readonly string[]): FilesCondition {
  const lines = ignores.flatMap(ignoreLineOf)
  const fileLines = lines.filter(({ matchesFoldersOnly }) => !matchesFoldersOnly)
  const takenBackAsFiles = fileLines.filter(({ takesBack }) => takesBack).map(({ glob }) => glob)
  return eitherOf(
    filesIgnoredBy(fileLines.map(asIgnoresGlob)),
    ...lines.filter(isReadThroughItsFolders).map((line) => filesUnderFoldersOxlintLeavesOut(line, lines, takenBackAsFiles)),
  )
}

/** `value` has no leading ./; `later` are the global ignores ESLint reads after it. */
export function eslintTakesFilesBackFrom(value: string, later: readonly string[]): boolean {
  return takeBacksEslintMakesAfter(value, later.map(asEslintNormalizesIt)).length > 0
}

function filesUnderEachFolderValueEslintLeavesOut(values: readonly string[]): FilesCondition[] {
  return values.flatMap((value, index) => (isNegated(value) ? [] : [filesUnderFoldersEslintLeavesOut(value, values.slice(index + 1))]))
}

/** Two take-backs that leave files out again overlap only where they are the same, so each adds one term. */
function filesUnderFoldersEslintLeavesOut(value: string, later: readonly string[]): FilesCondition {
  const underTheFolders = everyFileUnderFoldersMatching(value)
  const takeBacks = takeBacksEslintMakesAfter(value, later)
  const takenBackWhole = takeBacks.filter(({ leftOutAgain }) => leftOutAgain.length === 0).map(({ taken }) => taken)
  return eitherOf(
    [{ all: [underTheFolders], none: takeBacks.map(({ taken }) => taken) }],
    ...takeBacks.flatMap(({ leftOutAgain }) => leftOutAgain.map((again): FilesCondition => [{ all: [underTheFolders, again], none: takenBackWhole }])),
  )
}

function takeBacksEslintMakesAfter(value: string, later: readonly string[]): TakeBack[] {
  const leftOut = folderReadingOf(withoutTheLastSlash(value))
  return later.filter(isNegated).flatMap((negated) => takeBacksEslintMakesFrom(leftOut, withoutNegation(negated)))
}

/** ESLint walks a file's folders from the top and stops at the first one left out, so a negation takes a file back only where it matches that folder and every left-out folder below it. */
function takeBacksEslintMakesFrom(leftOut: FolderReading, negated: string): TakeBack[] {
  const takingBack = folderReadingOf(withoutTheLastSlash(negated))
  switch (leftOut.kind) {
    case 'one folder':
      return mayMatchTheFolder(takingBack, leftOut.path) ? everyFileUnder(negated) : NO_TAKE_BACK
    case 'a folder and every folder in it':
      return takeBacksFromAFolderAndThoseInIt(leftOut.path, takingBack, negated)
    case 'every folder named':
    case 'every folder named, and every folder in one':
      return takeBacksFromFoldersNamed(leftOut, takingBack, negated)
    case 'unread':
      return everyFileUnder(negated)
  }
}

/** A negation matching the folder alone takes back only the files directly in it, since the value leaves each folder below out again. One matching every folder of its name also takes back files under another folder, which ESLint leaves out (a known limit). */
function takeBacksFromAFolderAndThoseInIt(path: string, takingBack: FolderReading, negated: string): TakeBack[] {
  switch (takingBack.kind) {
    case 'one folder':
      return takingBack.path === path ? theFilesDirectlyIn(negated) : NO_TAKE_BACK
    case 'every folder named':
      return lastSegmentOf(path) === takingBack.name ? theFilesDirectlyIn(negated) : NO_TAKE_BACK
    case 'a folder and every folder in it':
    case 'every folder named, and every folder in one':
    case 'unread':
      return mayMatchTheFolder(takingBack, path) ? everyFileUnder(negated) : NO_TAKE_BACK
  }
}

/** A value naming folders leaves out a file's highest folder of that name first. Two readings here take back more than ESLint does (a known limit). */
function takeBacksFromFoldersNamed(leftOut: FoldersNamed, takingBack: FolderReading, negated: string): TakeBack[] {
  switch (takingBack.kind) {
    case 'one folder':
      if (!isTheHighestFolderNamed(takingBack.path, leftOut.name)) return NO_TAKE_BACK
      return leftOut.kind === 'every folder named' ? theFolderOutsideAnyBelowNamed(negated, leftOut.name) : theFilesDirectlyIn(negated)
    case 'a folder and every folder in it':
      return isInAFolderNamed(takingBack.path, leftOut.name) ? NO_TAKE_BACK : everyFileUnder(negated)
    case 'every folder named':
      if (takingBack.name !== leftOut.name) return NO_TAKE_BACK
      return leftOut.kind === 'every folder named' ? everyFileUnder(negated) : theFilesDirectlyIn(negated)
    case 'every folder named, and every folder in one':
      return takingBack.name === leftOut.name ? everyFileUnder(negated) : anyFolderNamedAboveOneNamed(takingBack.name, leftOut.name)
    case 'unread':
      return everyFileUnder(negated)
  }
}

function isTheHighestFolderNamed(path: string, name: string): boolean {
  return lastSegmentOf(path) === name && !isInAFolderNamed(path, name)
}

function theFolderOutsideAnyBelowNamed(folderGlob: string, name: string): TakeBack[] {
  const taken = everyFileUnderFoldersMatching(folderGlob)
  return [{ taken, leftOutAgain: [`${taken}${FOLDER_SEPARATOR}${name}${EVERY_FOLDER_IN}`] }]
}

function anyFolderNamedAboveOneNamed(above: string, below: string): TakeBack[] {
  return [{ taken: `${ANY_DEPTH}${above}${FOLDER_SEPARATOR}${ANY_DEPTH}${below}${EVERY_FOLDER_IN}`, leftOutAgain: [] }]
}

function theFilesDirectlyIn(folderGlob: string): TakeBack[] {
  return [{ taken: `${withoutTheLastSlash(folderGlob)}${FILES_DIRECTLY_IN}`, leftOutAgain: [] }]
}

function everyFileUnder(glob: string): TakeBack[] {
  return [{ taken: everyFileUnderFoldersMatching(glob), leftOutAgain: [] }]
}

/** Less those a negated line may take back by matching a deeper folder or the file itself. */
function filesUnderFoldersOxlintLeavesOut(line: IgnoreLine, lines: readonly IgnoreLine[], takenBackAsFiles: readonly string[]): FilesCondition {
  const leftOut = folderReadingOf(line.glob)
  const takingBack = lines.filter(({ takesBack }) => takesBack).filter((negated) => oxlintMayTakeBackFrom(line, leftOut, negated))
  return [{ all: [everyFileUnderFoldersMatching(line.glob)], none: [...takenBackAsFiles, ...takingBack.map(({ glob }) => everyFileUnderFoldersMatching(glob))] }]
}

/** A line ending `/**` matches every file it takes back as a file, which the files' own reading decides. */
function oxlintMayTakeBackFrom(line: IgnoreLine, leftOut: FolderReading, negated: IgnoreLine): boolean {
  if (negated.glob.endsWith(EVERY_FOLDER_IN)) return false
  const isLater = negated.index > line.index
  const takingBack = folderReadingOf(negated.glob)
  switch (leftOut.kind) {
    case 'one folder':
      return mayTakeBackFromTheFolder(leftOut.path, takingBack, isLater)
    case 'every folder named':
      return mayTakeBackFromFoldersNamed(leftOut.name, takingBack, isLater)
    case 'a folder and every folder in it':
    case 'every folder named, and every folder in one':
    case 'unread':
      return true
  }
}

/** A negated folder below it takes files back, the folder itself only after it, any other none. */
function mayTakeBackFromTheFolder(path: string, takingBack: FolderReading, isLater: boolean): boolean {
  if (takingBack.kind !== 'one folder') return true
  if (takingBack.path === path) return isLater
  return isUnder(takingBack.path, path)
}

/** A negated folder inside one of that name takes files back, one of that name itself only after it, any other none. */
function mayTakeBackFromFoldersNamed(name: string, takingBack: FolderReading, isLater: boolean): boolean {
  if (takingBack.kind === 'every folder named') return takingBack.name !== name || isLater
  if (takingBack.kind !== 'one folder') return true
  if (isInAFolderNamed(takingBack.path, name)) return true
  return lastSegmentOf(takingBack.path) === name && isLater
}

/** Never for one ending `/**`: every file under it is itself a match. */
function isReadThroughItsFolders({ takesBack, glob }: IgnoreLine): boolean {
  return !takesBack && !glob.endsWith(EVERY_FOLDER_IN)
}

/** oxlint matches a line starting `./` against no path, so it yields none. */
function ignoreLineOf(value: string, index: number): IgnoreLine[] {
  const takesBack = isNegated(value)
  const pattern = takesBack ? withoutNegation(value) : value
  if (pattern.startsWith(LEADING_DOT_SLASH)) return []
  const matchesFoldersOnly = namesFoldersOnly(pattern)
  const body = withoutTheLastSlash(pattern)
  const fromTheConfigFolder = body.startsWith(FOLDER_SEPARATOR) ? body.slice(FOLDER_SEPARATOR.length) : body
  const holdsInAnyFolder = !body.includes(FOLDER_SEPARATOR)
  return [{ index, takesBack, glob: holdsInAnyFolder ? `${ANY_DEPTH}${fromTheConfigFolder}` : fromTheConfigFolder, matchesFoldersOnly }]
}

function asIgnoresGlob({ takesBack, glob }: IgnoreLine): string {
  return takesBack ? negationOf(glob) : glob
}

/** Read without its last slash. */
function folderReadingOf(glob: string): FolderReading {
  const everyFolderIn = glob.endsWith(EVERY_FOLDER_IN)
  const folder = everyFolderIn ? glob.slice(0, -EVERY_FOLDER_IN.length) : glob
  const name = nameAtAnyDepth(folder)
  if (name !== null) return everyFolderIn ? { kind: 'every folder named, and every folder in one', name } : { kind: 'every folder named', name }
  const path = pathNamedBy(folder)
  if (path === null) return { kind: 'unread' }
  return everyFolderIn ? { kind: 'a folder and every folder in it', path } : { kind: 'one folder', path }
}

/** null for any glob not matching every folder of one name at any depth. */
function nameAtAnyDepth(glob: string): string | null {
  if (!glob.startsWith(ANY_DEPTH)) return null
  const name = glob.slice(ANY_DEPTH.length)
  return !name.includes(FOLDER_SEPARATOR) && pathNamedBy(name) === name ? name : null
}

/** Globs that cannot be read may. */
function mayMatchTheFolder(negated: FolderReading, path: string): boolean {
  switch (negated.kind) {
    case 'one folder':
      return negated.path === path
    case 'a folder and every folder in it':
      return negated.path === path || isUnder(path, negated.path)
    case 'every folder named':
      return lastSegmentOf(path) === negated.name
    case 'every folder named, and every folder in one':
      return segmentsOf(path).includes(negated.name)
    case 'unread':
      return true
  }
}

/** The path's own last part aside. */
function isInAFolderNamed(path: string, name: string): boolean {
  return segmentsOf(path).slice(0, -1).includes(name)
}

function isUnder(path: string, folder: string): boolean {
  return path.startsWith(`${folder}${FOLDER_SEPARATOR}`)
}

function lastSegmentOf(path: string): string {
  return foundOr(segmentsOf(path).at(-1), 'a path has at least one part')
}

function segmentsOf(path: string): string[] {
  return path.split(FOLDER_SEPARATOR)
}

/** ESLint drops a value's leading ./ (normalizePattern), negated or not. */
function asEslintNormalizesIt(value: string): string {
  return keepingNegation(value, withoutLeadingDotSlash)
}
