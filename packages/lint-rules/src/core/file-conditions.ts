import { compareCodeUnits, foundOr, groupBy } from '@workspace/rule-data/collections'
import { extensionsNamedBy, isNegated, literalGlobOf, negationOf, pathNamedBy, withoutNegation } from './globs.ts'
import { readOnce } from './read-once.ts'

// Which files a rule of ours may run in, from glob lists alone, so a block can be kept to exactly those
// files without a function in its `files`. A glob with no glob syntax names one path, which keeps long
// lists of literal paths from multiplying the terms.

/** `all` is one `files` entry, whose globs ESLint ANDs; `none` is ignores, so it holds no negated glob. */
export type FilesTerm = { readonly all: readonly string[]; readonly none: readonly string[] }

/** Any one term must match; no terms matches nothing. */
export type FilesCondition = readonly FilesTerm[]

export type FilesEntry = string | string[]

/** `files` entries each AND their globs; null where every file is kept. */
export type FilesAndIgnores = { readonly files: ReadonlyArray<readonly string[]> | null; readonly ignores: readonly string[] }

type GlobsHeld = { readonly all: ReadonlySet<string>; readonly none: ReadonlySet<string> }

type Negation = { readonly index: number; readonly takesBack: string }

type TermsByPath = ReadonlyMap<string | typeof NO_PATH, readonly FilesTerm[]>

export const EVERY_FILE: FilesCondition = [{ all: [], none: [] }]
export const NO_FILE: FilesCondition = []

const NO_PATH = null
// Each part read the first time it is asked for, since a term's lists may be long: terms are never mutated.
const pathsOfTerms = new WeakMap<FilesTerm, string | typeof NO_PATH>()
const globsHeldByTerms = new WeakMap<FilesTerm, GlobsHeld>()
const keysOfTerms = new WeakMap<FilesTerm, string>()

export function filesInScopeOf(files: readonly FilesEntry[] | null, ignores: readonly string[]): FilesCondition {
  return bothOf(filesMatchedBy(files), notOf(filesIgnoredBy(ignores)))
}

/** A negated glob takes back a file an earlier glob left out, as block ignores and .gitignore read them. */
export function filesIgnoredBy(ignores: readonly string[]): FilesCondition {
  const negations = negationsIn(ignores)
  return simplified(ignores.flatMap((glob, index) => (isNegated(glob) ? [] : [termLeftOutBy(glob, takenBackAfter(index, negations))])))
}

/** `(c or x) and (c or y)` is `c or (x and y)`, so terms every condition holds are set aside first; the rest are met two at a time. */
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

function termsEachHolds(conditions: readonly FilesCondition[]): FilesTerm[] {
  const [first, ...others] = conditions
  if (first === undefined || others.length === 0) return []
  const keysOfEachOther = others.map((condition) => new Set(condition.map(keyOfNormalizedTerm)))
  return first.filter((term) => keysOfEachOther.every((keys) => keys.has(keyOfNormalizedTerm(term))))
}

export function eitherOf(...conditions: readonly FilesCondition[]): FilesCondition {
  return simplified(conditions.flat())
}

export function notOf(condition: FilesCondition): FilesCondition {
  return bothOf(...condition.map(notOfTerm))
}

export function matchesEveryFile(condition: FilesCondition): boolean {
  return condition.some(({ all, none }) => all.length === 0 && none.length === 0)
}

export function globsOf(entry: Readonly<FilesEntry>): string[] {
  return typeof entry === 'string' ? [entry] : [...entry]
}

/** The same for two conditions written alike. */
export function keyOfCondition(condition: FilesCondition): string {
  return JSON.stringify(condition)
}

/** One block per set of ignored globs. A term needing no glob matches every file the others do, so it is the only one left. */
export function filesAndIgnoresOf(condition: FilesCondition): FilesAndIgnores[] {
  return termsGroupedByIgnores(condition).map((terms) => ({
    files: terms.some(needsNoGlob) ? null : terms.map(({ all }) => all),
    ignores: ignoresShared(terms),
  }))
}

function bothOfTwo(condition: FilesCondition, other: FilesCondition): FilesCondition {
  const otherByPath = termsByPathOf(other)
  return reduced(condition.flatMap((term) => termsMeeting(term, other, otherByPath).flatMap((otherTerm) => termOfBoth(term, otherTerm))))
}

/** Where the term names a path, only those naming none or the same one. */
function termsMeeting(term: FilesTerm, other: FilesCondition, otherByPath: TermsByPath): readonly FilesTerm[] {
  const path = pathOfTerm(term)
  return path === NO_PATH ? other : [...termsNaming(NO_PATH, otherByPath), ...termsNaming(path, otherByPath)]
}

function termOfBoth(term: FilesTerm, other: FilesTerm): FilesTerm[] {
  return normalizedTerm(termOfEvery([term, other]))
}

function negationsIn(ignores: readonly string[]): Negation[] {
  return ignores.flatMap((glob, index) => (isNegated(glob) ? { index, takesBack: withoutNegation(glob) } : []))
}

function takenBackAfter(index: number, negations: readonly Negation[]): string[] {
  return negations.filter((negation) => negation.index > index).map(({ takesBack }) => takesBack)
}

function termLeftOutBy(glob: string, takenBack: readonly string[]): FilesTerm {
  return { all: [glob], none: takenBack }
}

function filesMatchedBy(files: readonly FilesEntry[] | null): FilesCondition {
  if (files === null) return EVERY_FILE
  return simplified(files.map((entry) => ({ all: globsOf(entry), none: [] })))
}

function notOfTerm({ all, none }: FilesTerm): FilesCondition {
  return simplified([...all.map(termMissing), ...none.map((glob) => ({ all: [glob], none: [] }))])
}

function termMissing(glob: string): FilesTerm {
  return isNegated(glob) ? { all: [withoutNegation(glob)], none: [] } : { all: [], none: [glob] }
}

function termsGroupedByIgnores(condition: FilesCondition): Array<readonly FilesTerm[]> {
  return groupBy(condition, ({ none }) => JSON.stringify(none)).values().toArray()
}

function needsNoGlob({ all }: FilesTerm): boolean {
  return all.length === 0
}

function keyOfTerm(term: FilesTerm): string {
  return JSON.stringify(term)
}

function ignoresShared(terms: readonly FilesTerm[]): readonly string[] {
  return foundOr(terms.at(0), 'a group of terms holds at least one term').none
}

function termOfEvery(terms: readonly FilesTerm[]): FilesTerm {
  return { all: terms.flatMap(({ all }) => all), none: terms.flatMap(({ none }) => none) }
}

/** Drops a term no file can meet, and one another term covers. */
function simplified(terms: readonly FilesTerm[]): FilesCondition {
  return reduced(terms.flatMap(normalizedTerm))
}

function reduced(normalized: readonly FilesTerm[]): FilesCondition {
  const unique = uniqueTerms(normalized)
  const byPath = termsByPathOf(unique)
  return unique.filter((term) => !isWithinAnother(term, termsItMayBeWithin(term, byPath)))
}

/** A file at one path is at no other, so a term naming two paths meets none, and of its exclusions only those naming no path, or its own, ask more. */
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
    none: none.flatMap((glob) => exclusionAtPath(glob, path, literal)),
  }
}

/** One naming another path excludes no file at this one. */
function exclusionAtPath(glob: string, path: string, literal: string): string[] {
  const excluded = pathNamedBy(glob)
  if (excluded === NO_PATH) return [glob]
  return excluded === path ? [literal] : []
}

function pathsNamedBy(glob: string): string[] {
  const path = pathNamedBy(glob)
  return path === NO_PATH ? [] : [path]
}

function pathOfTerm(term: FilesTerm): string | typeof NO_PATH {
  return readOnce(pathsOfTerms, term, firstPathNamedIn)
}

function firstPathNamedIn({ all }: FilesTerm): string | typeof NO_PATH {
  const [path] = all.flatMap(pathsNamedBy)
  return path === undefined ? NO_PATH : path
}

function globsHeldBy(term: FilesTerm): GlobsHeld {
  return readOnce(globsHeldByTerms, term, ({ all, none }) => ({ all: new Set(all), none: new Set(none) }))
}

function keyOfNormalizedTerm(term: FilesTerm): string {
  return readOnce(keysOfTerms, term, keyOfTerm)
}

function termsByPathOf(condition: FilesCondition): TermsByPath {
  return Map.groupBy(condition, pathOfTerm)
}

function termsNaming(path: string | typeof NO_PATH, byPath: TermsByPath): readonly FilesTerm[] {
  const terms = byPath.get(path)
  return terms === undefined ? [] : terms
}

function uniqueTerms(terms: readonly FilesTerm[]): FilesTerm[] {
  const byKey = new Map(terms.map((term): [string, FilesTerm] => [keyOfNormalizedTerm(term), term]))
  return [...byKey].toSorted(inOrderOfKeys).map(([, term]) => term)
}

function inOrderOfKeys([key]: readonly [string, FilesTerm], [otherKey]: readonly [string, FilesTerm]): number {
  return compareCodeUnits(key, otherKey)
}

/** Its lists are searched, not walked. */
function isContradictory(term: FilesTerm): boolean {
  const { all, none } = term
  return all.some((glob) => isInSorted(none, glob) || isInSorted(all, negationOf(glob))) || asksOnlyExtensionsItRefuses(term)
}

/** A file has one last extension, so no file meets both. */
function asksOnlyExtensionsItRefuses({ all, none }: FilesTerm): boolean {
  const asked = all.flatMap(extensionsListedBy)
  if (asked.length === 0) return false
  const refused = new Set(none.flatMap(extensionsListedBy).flat())
  return asked.some((extensions) => extensions.every((extension) => refused.has(extension)))
}

/** None where the glob names files by no extension. */
export function extensionsListedBy(glob: string): string[][] {
  const extensions = extensionsNamedBy(glob)
  return extensions === null ? [] : [extensions]
}

function isInSorted(sorted: readonly string[], glob: string): boolean {
  const index = lowerBoundOf(sorted, glob, 0, sorted.length)
  return sorted[index] === glob
}

function lowerBoundOf(sorted: readonly string[], glob: string, from: number, to: number): number {
  if (from >= to) return from
  const middle = Math.floor((from + to) / 2)
  const atMiddle = sorted[middle]
  return atMiddle !== undefined && atMiddle < glob ? lowerBoundOf(sorted, glob, middle + 1, to) : lowerBoundOf(sorted, glob, from, middle)
}

/** Where it names a path, those naming none or the same one; where it names none, those naming none. */
function termsItMayBeWithin(term: FilesTerm, byPath: TermsByPath): readonly FilesTerm[] {
  const path = pathOfTerm(term)
  return path === NO_PATH ? termsNaming(NO_PATH, byPath) : [...termsNaming(NO_PATH, byPath), ...termsNaming(path, byPath)]
}

function isWithinAnother(term: FilesTerm, terms: readonly FilesTerm[]): boolean {
  if (terms.length === 0) return false
  const held = globsHeldBy(term)
  return terms.some((other) => other !== term && isWithin(held, other))
}

function isWithin(held: GlobsHeld, other: FilesTerm): boolean {
  return other.all.every((glob) => held.all.has(glob)) && other.none.every((glob) => held.none.has(glob))
}

function sortedOnce(globs: readonly string[]): string[] {
  return [...new Set(globs)].toSorted()
}
