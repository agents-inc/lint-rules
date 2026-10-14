import { eitherOf, type FilesCondition, filesIgnoredBy } from './file-conditions.ts'
import { everyFileUnderFoldersMatching, NEGATION, namesFoldersOnly, pathNamedBy } from './globs.ts'

// Which files our ignores keep our part for each engine out of, each engine reading the same values
// its own way (decisions.md, fix round 1 review): ESLint as global ignores, oxlint as
// ignorePatterns. Both merges and the agent build's two configs meet here, so a value one engine
// reads differently from the other keeps each engine's part out of the files that engine leaves out.
//
// ESLint (@eslint/config-array, measured 10.12): a path is left out where some value matches it and
// no negated value after that one does; a file is left out where it is, or where any folder above it
// is, `folder/` read for the folder. So a negated value takes back only a folder no folder above it
// is left out with: `legacy/` then `!legacy/keep/` leaves legacy/keep out, and `**/legacy/**` then
// `!**/keep/**` takes back keep/legacy, whose folder keep is never left out.
//
// oxlint (the ignore crate's .gitignore reading, matched_path_or_any_parents; measured 1.87): the
// last line matching the file decides; where none does, the last line matching the deepest folder
// above it that any line matches. A line with no slash but a last one holds in any folder, a last
// slash matches folders only, and a line starting `./` matches nothing.
//
// Each folder value is read through the files under it. Where a negated value could take back some
// of those files and not others by which folder above them it matches, it is kept as taking all of
// them back unless the globs show it matches no folder that counts: a limit, measured in the
// developer's probes for fix round 2.

/** What a glob matches as a folder, where the globs alone can tell. */
type FolderReading =
  | { readonly kind: 'one folder'; readonly path: string }
  | { readonly kind: 'a folder and every folder in it'; readonly path: string }
  | { readonly kind: 'every folder named'; readonly name: string }
  | { readonly kind: 'every folder named, and every folder in one'; readonly name: string }
  | { readonly kind: 'unread' }

/** A reading of a glob matching folders by their name. */
type FoldersNamed = Extract<FolderReading, { readonly name: string }>

/** The files under a glob a negated value takes back, but those under any of the globs ESLint leaves out again, each within it. */
type TakeBack = { readonly taken: string; readonly leftOutAgain: readonly string[] }

/** A line of our ignores as oxlint reads it: its place, whether it takes files back, its glob from the config's folder, and whether it matches folders only. */
type IgnoreLine = { readonly index: number; readonly takesBack: boolean; readonly glob: string; readonly matchesFoldersOnly: boolean }

const LEADING_DOT_SLASH = './'
const FOLDER_SEPARATOR = '/'
const ANY_DEPTH = '**/'
const EVERY_FOLDER_IN = '/**'
const FILES_DIRECTLY_IN = '/*'
const NO_TAKE_BACK: TakeBack[] = []

/** The files ESLint's global ignores leave out, our ignores written as them. */
export function filesEslintLeavesOutOf(ignores: readonly string[]): FilesCondition {
  // ESLint drops a value's leading ./ (normalizePattern), negated or not.
  const values = ignores.map(withoutALeadingDotSlash)
  const fileValues = values.filter((value) => !namesFoldersOnly(value))
  return eitherOf(filesIgnoredBy(fileValues), ...filesUnderEachFolderValueEslintLeavesOut(values))
}

/** The files oxlint's ignorePatterns leave out, our ignores written as them. */
export function filesOxlintLeavesOutOf(ignores: readonly string[]): FilesCondition {
  const lines = ignores.flatMap(ignoreLineOf)
  const fileLines = lines.filter(({ matchesFoldersOnly }) => !matchesFoldersOnly)
  const takenBackAsFiles = fileLines.filter(({ takesBack }) => takesBack).map(({ glob }) => glob)
  return eitherOf(
    filesIgnoredBy(fileLines.map(asIgnoresGlob)),
    ...lines.filter(isReadThroughItsFolders).map((line) => filesUnderFoldersOxlintLeavesOut(line, lines, takenBackAsFiles)),
  )
}

/** Whether a negated value among the global ignores given, which ESLint reads after the value given (one with no leading ./), takes back a file under a folder that value leaves out. */
export function eslintTakesFilesBackFrom(value: string, later: readonly string[]): boolean {
  return takeBacksEslintMakesAfter(value, later.map(withoutALeadingDotSlash)).length > 0
}

/** For each value but a negated one, the files under the folders it matches that ESLint leaves out. */
function filesUnderEachFolderValueEslintLeavesOut(values: readonly string[]): FilesCondition[] {
  return values.flatMap((value, index) => (isNegated(value) ? [] : [filesUnderFoldersEslintLeavesOut(value, values.slice(index + 1))]))
}

/**
 * Every file under a folder the value matches, less those a negated value after it takes back; and
 * within a take-back, the files ESLint leaves out again, unless another takes them back whole. Two
 * take-backs leaving files out again overlap only where they are the same, each re-taking the
 * highest folder of a name, so each adds one term, however many there are.
 */
function filesUnderFoldersEslintLeavesOut(value: string, later: readonly string[]): FilesCondition {
  const underTheFolders = everyFileUnderFoldersMatching(value)
  const takeBacks = takeBacksEslintMakesAfter(value, later)
  const takenBackWhole = takeBacks.filter(({ leftOutAgain }) => leftOutAgain.length === 0).map(({ taken }) => taken)
  return eitherOf(
    [{ all: [underTheFolders], none: takeBacks.map(({ taken }) => taken) }],
    ...takeBacks.flatMap(({ leftOutAgain }) => leftOutAgain.map((again): FilesCondition => [{ all: [underTheFolders, again], none: takenBackWhole }])),
  )
}

/** What each negated value after a value takes back of the files under the folders the value leaves out. */
function takeBacksEslintMakesAfter(value: string, later: readonly string[]): TakeBack[] {
  const leftOut = folderReadingOf(withoutTheLastSlash(value))
  return later.filter(isNegated).flatMap((negated) => takeBacksEslintMakesFrom(leftOut, withoutNegation(negated)))
}

/**
 * The files under the folders a value leaves out that a negated value after it takes back. ESLint
 * walks a file's folders from the top and stops at the first one left out, so a negated value takes
 * a file back only where it matches that folder and every folder below it that the value matches.
 */
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

/**
 * A value leaving out a folder and every folder in it leaves the folder out first. A negated value
 * matching that folder alone takes back only the files directly in it, since the value leaves each
 * folder below it out again, and the files' own reading decides those. One matching every folder of
 * its name takes back the files directly in each such folder down from it, also those under a
 * folder of another name, which ESLint leaves out (a limit).
 */
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

/**
 * A value naming folders by their name leaves out a file's highest folder of that name first, or
 * the highest holding one. A negated value matching that folder alone takes back the files under
 * it outside any folder of the name below it; where the value leaves out every folder in one too,
 * only the files directly in it. A negated value matching every folder holding one of its own name
 * takes a file back where a folder of that name lies above it. Two readings are approximate, and
 * take back more than ESLint does (a limit): every folder holding the name above any folder of the
 * name left out, which also holds a file whose highest folder of the name lies above them both; and
 * every folder of the name, whose files directly in it count even under another folder holding one.
 */
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

/** Whether the folder is the highest of its name: the last part of its path is the name, and no folder above it has it. */
function isTheHighestFolderNamed(path: string, name: string): boolean {
  return lastSegmentOf(path) === name && !isInAFolderNamed(path, name)
}

/** Every file under the folder a glob names, but those under a folder of the name below it, which ESLint leaves out again. */
function theFolderOutsideAnyBelowNamed(folderGlob: string, name: string): TakeBack[] {
  const taken = everyFileUnderFoldersMatching(folderGlob)
  return [{ taken, leftOutAgain: [`${taken}${FOLDER_SEPARATOR}${name}${EVERY_FOLDER_IN}`] }]
}

/** Every file under a folder of one name above a folder of another. */
function anyFolderNamedAboveOneNamed(above: string, below: string): TakeBack[] {
  return [{ taken: `${ANY_DEPTH}${above}${FOLDER_SEPARATOR}${ANY_DEPTH}${below}${EVERY_FOLDER_IN}`, leftOutAgain: [] }]
}

/** The files directly in a folder the glob matches, none in a folder below it. */
function theFilesDirectlyIn(folderGlob: string): TakeBack[] {
  return [{ taken: `${withoutTheLastSlash(folderGlob)}${FILES_DIRECTLY_IN}`, leftOutAgain: [] }]
}

/** Every file under a folder the glob matches. */
function everyFileUnder(glob: string): TakeBack[] {
  return [{ taken: everyFileUnderFoldersMatching(glob), leftOutAgain: [] }]
}

/** The files under the folders an ignore line matches, less those a negated line may take back by matching a folder deeper down, or the file itself. */
function filesUnderFoldersOxlintLeavesOut(line: IgnoreLine, lines: readonly IgnoreLine[], takenBackAsFiles: readonly string[]): FilesCondition {
  const leftOut = folderReadingOf(line.glob)
  const takingBack = lines.filter(({ takesBack }) => takesBack).filter((negated) => oxlintMayTakeBackFrom(line, leftOut, negated))
  return [{ all: [everyFileUnderFoldersMatching(line.glob)], none: [...takenBackAsFiles, ...takingBack.map(({ glob }) => everyFileUnderFoldersMatching(glob))] }]
}

/**
 * Whether a negated line may decide a file under a folder the ignore line matches: by matching a
 * folder below that one, or that very folder after the ignore line. A line ending `/**` matches
 * every file it takes back as a file, which the files' own reading decides.
 */
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

/** One folder left out: a negated folder below it takes files back, the folder itself only after it, any other none. */
function mayTakeBackFromTheFolder(path: string, takingBack: FolderReading, isLater: boolean): boolean {
  if (takingBack.kind !== 'one folder') return true
  if (takingBack.path === path) return isLater
  return isUnder(takingBack.path, path)
}

/**
 * Every folder of a name left out: a negated folder inside one of that name takes files back, one of
 * that name itself only after it, and one in no folder of the name none, as any folder of the name
 * holding files under it lies below it.
 */
function mayTakeBackFromFoldersNamed(name: string, takingBack: FolderReading, isLater: boolean): boolean {
  if (takingBack.kind === 'every folder named') return takingBack.name !== name || isLater
  if (takingBack.kind !== 'one folder') return true
  if (isInAFolderNamed(takingBack.path, name)) return true
  return lastSegmentOf(takingBack.path) === name && isLater
}

/** A line reads every file under its folders where a file under them is not itself a match: never for one ending `/**`. */
function isReadThroughItsFolders({ takesBack, glob }: IgnoreLine): boolean {
  return !takesBack && !glob.endsWith(EVERY_FOLDER_IN)
}

/** A line of our ignores as oxlint reads it, none where it starts `./`: oxlint matches it against no path. */
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
  return takesBack ? `${NEGATION}${glob}` : glob
}

/** What a glob, read without its last slash, matches as a folder, where the globs alone can tell. */
function folderReadingOf(glob: string): FolderReading {
  const everyFolderIn = glob.endsWith(EVERY_FOLDER_IN)
  const folder = everyFolderIn ? glob.slice(0, -EVERY_FOLDER_IN.length) : glob
  const name = nameAtAnyDepth(folder)
  if (name !== null) return everyFolderIn ? { kind: 'every folder named, and every folder in one', name } : { kind: 'every folder named', name }
  const path = pathNamedBy(folder)
  if (path === null) return { kind: 'unread' }
  return everyFolderIn ? { kind: 'a folder and every folder in it', path } : { kind: 'one folder', path }
}

/** The name a glob matching every folder of one name at any depth names: null for any other glob. */
function nameAtAnyDepth(glob: string): string | null {
  if (!glob.startsWith(ANY_DEPTH)) return null
  const name = glob.slice(ANY_DEPTH.length)
  return !name.includes(FOLDER_SEPARATOR) && pathNamedBy(name) === name ? name : null
}

/** Whether the negated glob may match the folder: unread globs may. */
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

/** Whether a folder of the name holds the path, the path's own last part aside. */
function isInAFolderNamed(path: string, name: string): boolean {
  return segmentsOf(path).slice(0, -1).includes(name)
}

function isUnder(path: string, folder: string): boolean {
  return path.startsWith(`${folder}${FOLDER_SEPARATOR}`)
}

function lastSegmentOf(path: string): string {
  const segments = segmentsOf(path)
  const last = segments.at(-1)
  if (last === undefined) throw new Error('a path has at least one part')
  return last
}

function segmentsOf(path: string): string[] {
  return path.split(FOLDER_SEPARATOR)
}

function withoutTheLastSlash(glob: string): string {
  return namesFoldersOnly(glob) ? glob.slice(0, -FOLDER_SEPARATOR.length) : glob
}

function withoutALeadingDotSlash(value: string): string {
  const takesBack = isNegated(value)
  const pattern = takesBack ? withoutNegation(value) : value
  const relative = pattern.startsWith(LEADING_DOT_SLASH) ? pattern.slice(LEADING_DOT_SLASH.length) : pattern
  return takesBack ? `${NEGATION}${relative}` : relative
}

function isNegated(glob: string): boolean {
  return glob.startsWith(NEGATION)
}

function withoutNegation(glob: string): string {
  return glob.slice(NEGATION.length)
}
