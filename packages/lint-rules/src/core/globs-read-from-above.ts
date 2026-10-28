// A team block whose basePath is above the project root reads its globs from there, so ESLint matches
// `project/src/a.ts` where the root's blocks read `src/a.ts`. Each glob is read past the root's folders as
// minimatch would (`dot: true`). Limits: an extglob segment matches no folder; braces expand within a segment.

import { isNegated, negationOf, withoutLeadingDotSlash, withoutNegation } from './globs.ts'
import { namedGroupOf, namedGroupsOf } from './named-groups.ts'

const SEGMENT_SEPARATOR = '/'
const GLOBSTAR = '**'
// The first braces holding no braces and at least one comma, which minimatch expands. The body splits at its first
// comma, so a run of commas is read once.
const INNERMOST_BRACES = /\{(?<body>[^{},]*,[^{}]*)\}/u
const BRACE_SEPARATOR = ','
const SEGMENT_PART = /\\(?<escaped>.)|\[(?<negated>[!^])?(?<members>[^\]]+)\]|(?<extglob>[@*+?!]\()|(?<star>\*)|(?<one>\?)|(?<other>.)/gsu
const REGEXP_SYNTAX = /[\\^$.*+?()[\]{}|/]/gu
const ANY_CHARACTERS_IN_A_NAME = '[^/]*'
const ONE_CHARACTER_IN_A_NAME = '[^/]'

/** `folders` is the root's path from the basePath, one folder each. A glob ending at the root itself matches no file under it. */
export function globsReadFromTheRoot(glob: string, folders: readonly string[]): string[] {
  const isGlobNegated = isNegated(glob)
  const pattern = withoutLeadingDotSlash(isGlobNegated ? withoutNegation(glob) : glob)
  const left = segmentsLeftPast(pattern.split(SEGMENT_SEPARATOR), folders)
  const globs = left.filter(reachesBelowTheRoot).map((segments) => segments.join(SEGMENT_SEPARATOR))
  return [...new Set(globs)].map((each) => (isGlobNegated ? negationOf(each) : each))
}

/** A `**` matches any number of folders. */
function segmentsLeftPast(segments: readonly string[], folders: readonly string[]): string[][] {
  const [folder, ...foldersBelow] = folders
  if (folder === undefined) return [[...segments]]
  const [segment, ...rest] = segments
  if (segment === undefined) return []
  if (segment === GLOBSTAR) return [...segmentsLeftPast(segments, foldersBelow), ...segmentsLeftPast(rest, folders)]
  return doesSegmentMatch(segment, folder) ? segmentsLeftPast(rest, foldersBelow) : []
}

function reachesBelowTheRoot(segmentsLeft: readonly string[]): boolean {
  return segmentsLeft.length > 0
}

function doesSegmentMatch(segment: string, folder: string): boolean {
  return bracesExpanded(segment).some((expanded) => doesSegmentWithoutBracesMatch(expanded, folder))
}

/** No `u` flag, as minimatch builds its RegExp, so a `?` or a class matches one UTF-16 code unit. A segment holding an extglob matches none. */
function doesSegmentWithoutBracesMatch(segment: string, folder: string): boolean {
  const source = sourceOfSegment(segment)
  // oxlint-disable-next-line require-unicode-regexp -- under u, a `?` or a class would match a character outside the basic plane whole, where minimatch matches one UTF-16 code unit (three cases in globs-read-from-above.test.ts fail with it)
  return source !== null && new RegExp(`^${source}$`).test(folder)
}

/** Innermost first, as minimatch expands them. */
function bracesExpanded(segment: string): string[] {
  const braces = INNERMOST_BRACES.exec(segment)
  if (braces === null) return [segment]
  const before = segment.slice(0, braces.index)
  const after = segment.slice(braces.index + braces[0].length)
  return namedGroupOf(braces, 'body').split(BRACE_SEPARATOR).flatMap((alternative) => bracesExpanded(`${before}${alternative}${after}`))
}

/** Null where it holds an extglob. */
function sourceOfSegment(segment: string): string | null {
  const parts = segment.matchAll(SEGMENT_PART).toArray().map(sourceOfPart)
  return parts.includes(null) ? null : parts.join('')
}

function sourceOfPart(part: RegExpExecArray): string | null {
  const { escaped, negated, members, extglob, star, one, other } = namedGroupsOf(part)
  if (extglob !== undefined) return null
  if (members !== undefined) return `[${negated === undefined ? '' : '^'}${members}]`
  if (star !== undefined) return ANY_CHARACTERS_IN_A_NAME
  if (one !== undefined) return ONE_CHARACTER_IN_A_NAME
  if (escaped !== undefined) return literal(escaped)
  if (other !== undefined) return literal(other)
  throw new Error(`${SEGMENT_PART.source} matched "${part[0]}" with no group`)
}

function literal(text: string): string {
  return text.replaceAll(REGEXP_SYNTAX, (syntax) => `\\${syntax}`)
}
