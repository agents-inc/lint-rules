// A team block whose basePath is a folder above the project root reads its globs from there
// (my-basepath-bug; spec-core.md C8). ESLint matches `project/src/a.ts` against them, where
// `project` is the root's path from the basePath; the root's own blocks read `src/a.ts`. So each
// glob is read past the root's folders, segment by segment, as minimatch matches them, and what is
// left matches, from the root, the root's files the glob matches from above. ESLint reads globs
// with `dot: true` (@eslint/config-array, MINIMATCH_OPTIONS), so a `*` matches a leading dot too.
// Limits: a segment holding an extglob matches no folder, and braces are read within one segment.

import { NEGATION } from './globs.ts'

const SEGMENT_SEPARATOR = '/'
const GLOBSTAR = '**'
const LEADING_DOT_SLASH = './'
// The first braces holding no braces and at least one comma, which minimatch expands.
const INNERMOST_BRACES = /\{(?<body>[^{}]*,[^{}]*)\}/u
const BRACE_SEPARATOR = ','
// One part of a segment, read in turn: an escaped character, a class, an extglob's opening, a star,
// a question mark, or any other character, itself.
const SEGMENT_PART = /\\(?<escaped>.)|\[(?<negated>[!^])?(?<members>[^\]]+)\]|(?<extglob>[@*+?!]\()|(?<star>\*)|(?<one>\?)|(?<other>.)/gsu
const REGEXP_SYNTAX = /[\\^$.*+?()[\]{}|/]/gu
const ANY_CHARACTERS_IN_A_NAME = '[^/]*'
const ONE_CHARACTER_IN_A_NAME = '[^/]'

/**
 * The globs that, read from the root, match the files under it that the glob given matches read
 * from a folder above it, `folders` being the root's path from there, a folder each: none where it
 * matches none of them. A negated glob stays negated. A glob that ends at the root itself matches
 * no file under it.
 */
export function globsReadFromTheRoot(glob: string, folders: readonly string[]): string[] {
  const negated = glob.startsWith(NEGATION)
  const pattern = withoutLeadingDotSlash(negated ? glob.slice(NEGATION.length) : glob)
  const left = segmentsLeftPast(pattern.split(SEGMENT_SEPARATOR), folders)
  const globs = left.filter(reachesBelowTheRoot).map((segments) => segments.join(SEGMENT_SEPARATOR))
  return [...new Set(globs)].map((each) => (negated ? `${NEGATION}${each}` : each))
}

/** What is left of the glob's segments once each of the folders has matched one, a `**` matching any number of them. */
function segmentsLeftPast(segments: readonly string[], folders: readonly string[]): string[][] {
  const [folder, ...foldersBelow] = folders
  if (folder === undefined) return [[...segments]]
  const [segment, ...rest] = segments
  if (segment === undefined) return []
  if (segment === GLOBSTAR) return [...segmentsLeftPast(segments, foldersBelow), ...segmentsLeftPast(rest, folders)]
  return segmentMatches(segment, folder) ? segmentsLeftPast(rest, foldersBelow) : []
}

/** Whether any segment is left once the root's folders are read past: a glob ending at the root itself matches no file under it. */
function reachesBelowTheRoot(segmentsLeft: readonly string[]): boolean {
  return segmentsLeft.length > 0
}

function segmentMatches(segment: string, folder: string): boolean {
  return bracesExpanded(segment).some((expanded) => segmentWithoutBracesMatches(expanded, folder))
}

/**
 * Whether a segment without braces matches the folder: none holding an extglob does. With no `u`
 * flag, as minimatch builds its RegExp, so a `?` or a class matches one UTF-16 code unit.
 */
function segmentWithoutBracesMatches(segment: string, folder: string): boolean {
  const source = sourceOfSegment(segment)
  return source !== null && new RegExp(`^${source}$`).test(folder)
}

/** The segment with its braces expanded, innermost first, as minimatch expands them. */
function bracesExpanded(segment: string): string[] {
  const braces = INNERMOST_BRACES.exec(segment)
  if (braces === null) return [segment]
  const before = segment.slice(0, braces.index)
  const after = segment.slice(braces.index + braces[0].length)
  return groupOf(braces, 'body').split(BRACE_SEPARATOR).flatMap((alternative) => bracesExpanded(`${before}${alternative}${after}`))
}

/** A segment without braces as a RegExp source: null where it holds an extglob. */
function sourceOfSegment(segment: string): string | null {
  const parts = [...segment.matchAll(SEGMENT_PART)].map(sourceOfPart)
  return parts.some((part) => part === null) ? null : parts.join('')
}

function sourceOfPart(part: RegExpExecArray): string | null {
  const { escaped, negated, members, extglob, star, one, other } = groupsOf(part)
  if (extglob !== undefined) return null
  if (members !== undefined) return `[${negated === undefined ? '' : '^'}${members}]`
  if (star !== undefined) return ANY_CHARACTERS_IN_A_NAME
  if (one !== undefined) return ONE_CHARACTER_IN_A_NAME
  if (escaped !== undefined) return literal(escaped)
  if (other !== undefined) return literal(other)
  throw new Error(`${SEGMENT_PART.source} matched "${part[0]}" with no group`)
}

function groupsOf({ groups }: RegExpExecArray): Readonly<Record<string, string | undefined>> {
  if (groups === undefined) throw new Error('a pattern with named groups matched without them')
  return groups
}

function groupOf(match: RegExpExecArray, name: string): string {
  const group = groupsOf(match)[name]
  if (group === undefined) throw new Error(`the pattern matched "${match[0]}" without its group ${name}`)
  return group
}

function literal(text: string): string {
  return text.replaceAll(REGEXP_SYNTAX, (syntax) => `\\${syntax}`)
}

/** ESLint drops a glob's leading `./` (@eslint/config-array, normalizePattern). */
function withoutLeadingDotSlash(glob: string): string {
  return glob.startsWith(LEADING_DOT_SLASH) ? glob.slice(LEADING_DOT_SLASH.length) : glob
}
