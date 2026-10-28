import { posix } from 'node:path'

import { isMutated } from './stryker-round.ts'

type LineSpan = { readonly start: number; readonly end: number }

/** One entry of Stryker's `--mutate` list without columns: a whole file, or its lines `start` through `end`. */
export type MutateEntry = { readonly file: string; readonly lines?: LineSpan }

/** `keptTo` is null when no `--only` is given: the round keeps every changed line. */
type KeptRound = { readonly keptTo: readonly MutateEntry[] | null; readonly strykerArguments: readonly string[] }

type PatternsOfAConfig = readonly string[]

const ONLY = '--only'
const OPTION_PREFIX = '-'
const LIST_SEPARATOR = ','
const FIRST_LINE = 1
const ENTRY = /^(?<file>[^:]+)(?::(?<start>\d+)-(?<end>\d+))?$/u
// Read as Stryker reads --mutate: the range is the last `:<start>-<end>`, so the path before it may hold a `:`.
const GIT_ENTRY = /^(?<file>.+?)(?::(?<start>\d+)-(?<end>\d+))?$/u

/** Takes each `--only <list>` out of the arguments for Stryker. */
export function linesTheRoundIsKeptTo(argumentsGiven: readonly string[]): KeptRound {
  const onlyAt = indexesOf(ONLY, argumentsGiven)
  if (onlyAt.length === 0) return { keptTo: null, strykerArguments: argumentsGiven }
  const listsAt = onlyAt.map((index) => index + 1)
  return {
    keptTo: listsAt.flatMap((index) => entriesOfTheList(argumentsGiven[index])),
    strykerArguments: argumentsWithout(argumentsGiven, new Set([...onlyAt, ...listsAt])),
  }
}

/** The file is read as git prints it (`a//b`, `a/../a/b` and `./a/b` as `a/b`), so a kept file and a changed one compare equal. */
export function mutateEntryOf(text: string): MutateEntry {
  const groups = ENTRY.exec(text)?.groups
  if (groups === undefined) throw notAnEntry(text)
  const { file: fileAsGiven, start, end } = groups
  if (fileAsGiven === undefined) throw notAnEntry(text)
  const file = posix.normalize(fileAsGiven)
  if (start === undefined || end === undefined) return { file }
  const lines = { start: Number(start), end: Number(end) }
  if (lines.start < FIRST_LINE || lines.end < lines.start) throw notAnEntry(text)
  return { file, lines }
}

/** The changed lines that lie in a kept entry; every changed line, as given, with no `--only`. */
export function changedLinesKeptTo(changed: readonly string[], keptTo: readonly MutateEntry[] | null): string[] {
  if (keptTo === null) return [...changed]
  return changed
    .map(changedEntryOf)
    .flatMap((changedEntry) => partsKept(changedEntry, keptTo))
    .map(mutateEntryText)
}

/** Refuses a kept file that is not on disk, or that no config of the round mutates: either would keep the round to nothing. */
// eslint-disable-next-line functional/no-return-void -- a refusal: what it finds must stop the round script before Stryker starts, so it throws, and where it finds nothing it has nothing to give back
export function refuseKeptFilesNoConfigMutates(keptTo: readonly MutateEntry[], patternsOfEachConfig: readonly PatternsOfAConfig[], isAFile: (file: string) => boolean): void {
  const files = keptTo.map(({ file }) => file)
  const notOnDisk = files.filter((file) => !isAFile(file))
  if (notOnDisk.length > 0) {
    throw new Error(`${ONLY} names no file at ${notOnDisk.join(', ')}: give each path from the repo root, as git diff prints it`)
  }
  const mutatedByNone = files.filter((file) => !isMutatedBySomeConfig(file, patternsOfEachConfig))
  if (mutatedByNone.length > 0) {
    throw new Error(`No config of this round mutates ${mutatedByNone.join(', ')}: give source files it mutates, as git diff prints them`)
  }
}

function indexesOf(value: string, list: readonly string[]): number[] {
  return list
    .keys()
    .filter((index) => list[index] === value)
    .toArray()
}

function argumentsWithout(argumentsGiven: readonly string[], indexes: ReadonlySet<number>): string[] {
  return argumentsGiven.filter((_, index) => !indexes.has(index))
}

// Empty entries are dropped, as Stryker's own lists drop them.
function entriesOfTheList(argumentAfterOnly: string | undefined): MutateEntry[] {
  if (argumentAfterOnly === undefined || argumentAfterOnly.startsWith(OPTION_PREFIX)) throw noList()
  const entries = argumentAfterOnly.split(LIST_SEPARATOR).filter((entry) => entry !== '')
  if (entries.length === 0) throw noList()
  return entries.map(mutateEntryOf)
}

function noList(): Error {
  return new Error(`${ONLY} takes a comma-separated list of files, each alone or as <file>:<startLine>-<endLine>`)
}

// git's entry for a changed hunk (`<file>:<start>-<end>`) or an untracked file, never typed by a user.
function changedEntryOf(text: string): MutateEntry {
  const groups = GIT_ENTRY.exec(text)?.groups
  if (groups?.file === undefined) throw notAnEntry(text)
  const { file, start, end } = groups
  return start === undefined || end === undefined ? { file } : { file, lines: { start: Number(start), end: Number(end) } }
}

function notAnEntry(text: string): Error {
  return new Error(`${text}: give a file alone, or its lines as <file>:<startLine>-<endLine>`)
}

function mutateEntryText({ file, lines }: MutateEntry): string {
  return lines === undefined ? file : `${file}:${String(lines.start)}-${String(lines.end)}`
}

function partsKept(changed: MutateEntry, keptTo: readonly MutateEntry[]): MutateEntry[] {
  return keptTo.flatMap((kept) => overlapOf(changed, kept))
}

function overlapOf(changed: MutateEntry, kept: MutateEntry): MutateEntry[] {
  if (changed.file !== kept.file) return []
  if (changed.lines === undefined) return [kept]
  if (kept.lines === undefined) return [changed]
  const start = Math.max(changed.lines.start, kept.lines.start)
  const end = Math.min(changed.lines.end, kept.lines.end)
  return start > end ? [] : [{ file: changed.file, lines: { start, end } }]
}

function isMutatedBySomeConfig(file: string, patternsOfEachConfig: readonly PatternsOfAConfig[]): boolean {
  return patternsOfEachConfig.some((patterns) => isMutated(file, patterns))
}
