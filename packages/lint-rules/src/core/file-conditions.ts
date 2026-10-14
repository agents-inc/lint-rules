import { extensionsNamedBy, literalGlobOf, NEGATION, pathNamedBy } from './globs.ts'

// Which files a rule of ours may run in, worked out from glob lists alone, so that a block of ours
// can be kept to exactly those files without a function in its `files` (spec-owner-answers.md,
// Q-D). Every condition is a list of terms, any one of which a file must meet. A glob with no glob
// syntax names one path, so a term holding one matches that file or none: two such paths in one
// term match nothing, and every path but its own among its exclusions asks nothing more. That keeps
// a list of literal paths, as the TS files outside every tsconfig are, from multiplying the terms
// it meets (review, Must fix 2).

/**
 * The files matching every glob of `all` and none of `none`. A block writes `all` as one `files`
 * entry, whose globs ESLint ANDs, and `none` as ignores. `none` holds no negated glob: ignores read
 * a leading `!` as taking a file back.
 */
export type FilesTerm = { readonly all: readonly string[]; readonly none: readonly string[] }

/** The files any one of its terms matches: none where it has no term. */
export type FilesCondition = readonly FilesTerm[]

/** One entry of a block's `files`: a glob, or globs a file must match every one of. */
export type FilesEntry = string | string[]

/**
 * What a block keeping to some files writes: its `files` entries, each one's globs ANDed (null
 * where every file it otherwise applies to is kept), and the globs it ignores.
 */
export type FilesAndIgnores = { readonly files: readonly (readonly string[])[] | null; readonly ignores: readonly string[] }

/** A term's globs, each once, for asking whether it holds a glob without walking its lists. */
type GlobsHeld = { readonly all: ReadonlySet<string>; readonly none: ReadonlySet<string> }

/** A negated glob of a list of ignores, by its place in the list, and the glob it takes back. */
type Negation = { readonly index: number; readonly takesBack: string }

/** The terms of a condition by the path their literal glob names, under NO_PATH those naming none. */
type TermsByPath = ReadonlyMap<string | typeof NO_PATH, readonly FilesTerm[]>

export const EVERY_FILE: FilesCondition = [{ all: [], none: [] }]
export const NO_FILE: FilesCondition = []

const NO_PATH = null
// What each normalized term is read as, each part read the first time it is asked for, since a
// term's lists may be long: a term is never changed after it is made.
const pathsOfTerms = new WeakMap<FilesTerm, string | typeof NO_PATH>()
const globsHeldByTerms = new WeakMap<FilesTerm, GlobsHeld>()
const keysOfTerms = new WeakMap<FilesTerm, string>()

/** The files a block applies to: those its `files` match (every file, where null), less those its ignores leave out. */
export function filesInScopeOf(files: readonly FilesEntry[] | null, ignores: readonly string[]): FilesCondition {
  return bothOf(filesMatchedBy(files), notOf(filesIgnoredBy(ignores)))
}

/**
 * The files a list of ignores leaves out, read in order, a negated glob taking back a file an
 * earlier glob left out: a file is left out where some glob matches it and no negated glob after
 * that one does. A block's ignores read so, and so does the last matching line of a .gitignore.
 */
export function filesIgnoredBy(ignores: readonly string[]): FilesCondition {
  const negations = negationsIn(ignores)
  return simplified(ignores.flatMap((glob, index) => (isNegated(glob) ? [] : [termLeftOutBy(glob, takenBackAfter(index, negations))])))
}

/**
 * The files every condition matches. A condition of one term narrows every term of the rest alike,
 * so those are joined at once; terms every other condition holds are set aside, as `(c or x) and (c
 * or y)` is `c or (x and y)`; the rest are met two at a time.
 */
export function bothOf(...conditions: readonly FilesCondition[]): FilesCondition {
  const oneTermEach = conditions.flatMap((condition) => (condition.length === 1 ? condition : []))
  const theRest = conditions.filter((condition) => condition.length !== 1)
  return bothOfTwo(simplified([termOfEvery(oneTermEach)]), bothOfSeveral(theRest))
}

function bothOfSeveral(conditions: readonly FilesCondition[]): FilesCondition {
  const shared = termsEachHolds(conditions)
  if (shared.length === 0) return conditions.reduce(bothOfTwo, EVERY_FILE)
  const sharedKeys = new Set(shared.map(keyOfNormalizedTerm))
  return eitherOf(shared, bothOf(...conditions.map((condition) => termsOtherThan(sharedKeys, condition))))
}

function termsOtherThan(keys: ReadonlySet<string>, condition: FilesCondition): FilesTerm[] {
  return condition.filter((term) => !keys.has(keyOfNormalizedTerm(term)))
}

/** The terms every one of several conditions holds: none of none. */
function termsEachHolds(conditions: readonly FilesCondition[]): FilesTerm[] {
  const [first, ...others] = conditions
  if (first === undefined || others.length === 0) return []
  const keysOfEachOther = others.map((condition) => new Set(condition.map(keyOfNormalizedTerm)))
  return first.filter((term) => keysOfEachOther.every((keys) => keys.has(keyOfNormalizedTerm(term))))
}

/** The files any of the conditions matches. */
export function eitherOf(...conditions: readonly FilesCondition[]): FilesCondition {
  return simplified(conditions.flat())
}

/** The files the condition does not match. */
export function notOf(condition: FilesCondition): FilesCondition {
  return bothOf(...condition.map(notOfTerm))
}

export function matchesEveryFile(condition: FilesCondition): boolean {
  return condition.some(({ all, none }) => all.length === 0 && none.length === 0)
}

export function globsOf(entry: FilesEntry): string[] {
  return typeof entry === 'string' ? [entry] : [...entry]
}

/** One string per condition, the same for two conditions written alike: terms and globs are kept sorted. */
export function keyOfCondition(condition: FilesCondition): string {
  return JSON.stringify(condition)
}

/**
 * The condition as few blocks write it: one per set of globs its terms ignore, whose `files` lists
 * each of those terms' globs as an entry. Where such a term needs no glob, it matches every file the
 * others match, so it is the only one left of them.
 */
export function filesAndIgnoresOf(condition: FilesCondition): FilesAndIgnores[] {
  return termsGroupedByIgnores(condition).map((terms) => ({
    files: terms.some(({ all }) => all.length === 0) ? null : terms.map(({ all }) => all),
    ignores: ignoresShared(terms),
  }))
}

/** Two conditions met: every term of one with each term of the other a file can meet both of. */
function bothOfTwo(condition: FilesCondition, other: FilesCondition): FilesCondition {
  const otherByPath = termsByPathOf(other)
  return reduced(condition.flatMap((term) => termsMeeting(term, other, otherByPath).flatMap((otherTerm) => termOfBoth(term, otherTerm))))
}

/** The other condition's terms a file of the term can meet: where the term names a path, only those naming none or the same one. */
function termsMeeting(term: FilesTerm, other: FilesCondition, otherByPath: TermsByPath): readonly FilesTerm[] {
  const path = pathOfTerm(term)
  return path === NO_PATH ? other : [...termsNaming(NO_PATH, otherByPath), ...termsNaming(path, otherByPath)]
}

/** The files two terms both match, normalized: none where no file can. */
function termOfBoth(term: FilesTerm, other: FilesTerm): FilesTerm[] {
  return normalizedTerm(termOfEvery([term, other]))
}

/** Each negated glob of the ignores, by its place among them. */
function negationsIn(ignores: readonly string[]): Negation[] {
  return ignores.flatMap((glob, index) => (isNegated(glob) ? [{ index, takesBack: withoutNegation(glob) }] : []))
}

/** The globs the negations after the place given take back. */
function takenBackAfter(index: number, negations: readonly Negation[]): string[] {
  return negations.filter((negation) => negation.index > index).map(({ takesBack }) => takesBack)
}

/** The files a glob of ignores leaves out: those it matches that no negated glob after it takes back. */
function termLeftOutBy(glob: string, takenBack: readonly string[]): FilesTerm {
  return { all: [glob], none: takenBack }
}

/** The files a block's `files` match: every file, where it names none (null). */
function filesMatchedBy(files: readonly FilesEntry[] | null): FilesCondition {
  if (files === null) return EVERY_FILE
  return simplified(files.map((entry) => ({ all: globsOf(entry), none: [] })))
}

/** A file outside a term misses one of its globs, or matches one it must not. */
function notOfTerm({ all, none }: FilesTerm): FilesCondition {
  return simplified([...all.map(termMissing), ...none.map((glob) => ({ all: [glob], none: [] }))])
}

function termMissing(glob: string): FilesTerm {
  return isNegated(glob) ? { all: [withoutNegation(glob)], none: [] } : { all: [], none: [glob] }
}

function termsGroupedByIgnores(condition: FilesCondition): FilesTerm[][] {
  const ignoresKeys = [...new Set(condition.map(ignoresKeyOf))]
  return ignoresKeys.map((key) => condition.filter((term) => ignoresKeyOf(term) === key))
}

function ignoresKeyOf({ none }: FilesTerm): string {
  return JSON.stringify(none)
}

function keyOfTerm(term: FilesTerm): string {
  return JSON.stringify(term)
}

function ignoresShared(terms: readonly FilesTerm[]): readonly string[] {
  const [first] = terms
  if (first === undefined) throw new Error('a group of terms holds at least one term')
  return first.none
}

function termOfEvery(terms: readonly FilesTerm[]): FilesTerm {
  return { all: terms.flatMap(({ all }) => all), none: terms.flatMap(({ none }) => none) }
}

/**
 * The same files, in as few terms as globs alone can tell: each term's globs sorted and once each,
 * a term no file can meet dropped, and a term dropped where another matches every file it does.
 */
function simplified(terms: readonly FilesTerm[]): FilesCondition {
  return reduced(terms.flatMap(normalizedTerm))
}

/** Normalized terms each once, and none another matches every file of. */
function reduced(normalized: readonly FilesTerm[]): FilesCondition {
  const unique = uniqueTerms(normalized)
  const byPath = termsByPathOf(unique)
  return unique.filter((term) => !isWithinAnother(term, termsItMayBeWithin(term, byPath)))
}

/**
 * The term with its globs sorted and once each, a literal glob written as literalGlobOf writes its
 * path: none where no file can meet it. A file at one path is at no other, so a term naming two
 * paths meets none, and of its exclusions only the globs naming no path, or its own, ask more.
 */
function normalizedTerm({ all, none }: FilesTerm): FilesTerm[] {
  const paths = [...new Set(all.flatMap(pathsNamedBy))]
  const [path, ...otherPaths] = paths
  if (otherPaths.length > 0) return []
  const term = path === undefined ? { all, none } : termAtPath(path, all, none)
  const sorted = { all: sortedOnce(term.all), none: sortedOnce(term.none) }
  return isContradictory(sorted) ? [] : [sorted]
}

function termAtPath(path: string, all: readonly string[], none: readonly string[]): FilesTerm {
  const literal = literalGlobOf(path)
  return {
    all: [literal, ...all.filter((glob) => pathNamedBy(glob) === NO_PATH)],
    none: none.flatMap((glob) => {
      const excluded = pathNamedBy(glob)
      if (excluded === NO_PATH) return [glob]
      return excluded === path ? [literal] : []
    }),
  }
}

function pathsNamedBy(glob: string): string[] {
  const path = pathNamedBy(glob)
  return path === NO_PATH ? [] : [path]
}

/** The path a normalized term's literal glob names: NO_PATH where it holds none. */
function pathOfTerm(term: FilesTerm): string | typeof NO_PATH {
  return readOnce(pathsOfTerms, term, ({ all }) => {
    const [path] = all.flatMap(pathsNamedBy)
    return path === undefined ? NO_PATH : path
  })
}

function globsHeldBy(term: FilesTerm): GlobsHeld {
  return readOnce(globsHeldByTerms, term, ({ all, none }) => ({ all: new Set(all), none: new Set(none) }))
}

function keyOfNormalizedTerm(term: FilesTerm): string {
  return readOnce(keysOfTerms, term, keyOfTerm)
}

/** What the term is read as, read the first time it is asked for: nothing a term is read as is undefined. */
function readOnce<Value>(reads: WeakMap<FilesTerm, Value>, term: FilesTerm, read: (term: FilesTerm) => Value): Value {
  const known = reads.get(term)
  if (known !== undefined) return known
  const value = read(term)
  reads.set(term, value)
  return value
}

function termsByPathOf(condition: FilesCondition): TermsByPath {
  const byPath = new Map<string | typeof NO_PATH, FilesTerm[]>()
  condition.forEach((term) => {
    const path = pathOfTerm(term)
    const naming = byPath.get(path)
    if (naming === undefined) byPath.set(path, [term])
    else naming.push(term)
  })
  return byPath
}

function termsNaming(path: string | typeof NO_PATH, byPath: TermsByPath): readonly FilesTerm[] {
  const terms = byPath.get(path)
  return terms === undefined ? [] : terms
}

/** Each term once, in the order of their keys, so two conditions written alike come out alike. */
function uniqueTerms(terms: readonly FilesTerm[]): FilesTerm[] {
  const byKey = new Map(terms.map((term): [string, FilesTerm] => [keyOfNormalizedTerm(term), term]))
  return [...byKey].toSorted(inOrderOfKeys).map(([, term]) => term)
}

function inOrderOfKeys([key]: readonly [string, FilesTerm], [otherKey]: readonly [string, FilesTerm]): number {
  if (key === otherKey) return 0
  return key < otherKey ? -1 : 1
}

/**
 * A sorted term asking a file to match a glob and also to miss it, or to have an extension it also
 * refuses: its lists are searched, not walked.
 */
function isContradictory(term: FilesTerm): boolean {
  const { all, none } = term
  return all.some((glob) => sortedHolds(none, glob) || sortedHolds(all, `${NEGATION}${glob}`)) || asksOnlyExtensionsItRefuses(term)
}

/**
 * Whether a glob of `all` naming files by their extensions, as filesOfExtensions writes them, names
 * only extensions that such globs of `none` name: a file has one last extension, so no file meets
 * both, as no JS or TS file is outside every JS, TS and component file.
 */
function asksOnlyExtensionsItRefuses({ all, none }: FilesTerm): boolean {
  const asked = all.flatMap(extensionsListedBy)
  if (asked.length === 0) return false
  const refused = new Set(none.flatMap(extensionsListedBy).flat())
  return asked.some((extensions) => extensions.every((extension) => refused.has(extension)))
}

/** The extensions a glob names files by, as a list holding that one list: none for a glob naming files otherwise. */
function extensionsListedBy(glob: string): string[][] {
  const extensions = extensionsNamedBy(glob)
  return extensions === null ? [] : [extensions]
}

/** Whether a list sorted as sortedOnce sorts it holds the glob. */
function sortedHolds(sorted: readonly string[], glob: string): boolean {
  const index = lowerBoundOf(sorted, glob, 0, sorted.length)
  return sorted[index] === glob
}

/** The first index from `from` to `to` whose glob does not sort before the one given. */
function lowerBoundOf(sorted: readonly string[], glob: string, from: number, to: number): number {
  if (from >= to) return from
  const middle = Math.floor((from + to) / 2)
  const atMiddle = sorted[middle]
  return atMiddle !== undefined && atMiddle < glob ? lowerBoundOf(sorted, glob, middle + 1, to) : lowerBoundOf(sorted, glob, from, middle)
}

/**
 * The terms another term can lie within, which ask no glob of a file it does not: where it names a
 * path, those naming none or the same one; where it names none, those naming none.
 */
function termsItMayBeWithin(term: FilesTerm, byPath: TermsByPath): readonly FilesTerm[] {
  const path = pathOfTerm(term)
  return path === NO_PATH ? termsNaming(NO_PATH, byPath) : [...termsNaming(NO_PATH, byPath), ...termsNaming(path, byPath)]
}

function isWithinAnother(term: FilesTerm, terms: readonly FilesTerm[]): boolean {
  if (terms.length === 0) return false
  const held = globsHeldBy(term)
  return terms.some((other) => other !== term && isWithin(held, other))
}

/** Every file the term holding these globs matches, the other matches too: the other asks no more of a file. */
function isWithin(held: GlobsHeld, other: FilesTerm): boolean {
  return other.all.every((glob) => held.all.has(glob)) && other.none.every((glob) => held.none.has(glob))
}

function sortedOnce(globs: readonly string[]): string[] {
  return [...new Set(globs)].toSorted()
}

function isNegated(glob: string): boolean {
  return glob.startsWith(NEGATION)
}

function withoutNegation(glob: string): string {
  return glob.slice(NEGATION.length)
}
