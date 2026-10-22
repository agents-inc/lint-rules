import { foundOr, groupBy } from '@workspace/rule-data/collections'
import type { Linter } from 'eslint'
import { sortedUnique } from './build-oxlint-config.ts'
import { asFilesEntry, JS_AND_TS_FILES, matchesOnlyJsAndTs } from './eslint-file-types.ts'
import { extensionsListedBy, type FilesAndIgnores, type FilesCondition, filesAndIgnoresOf, keyOfCondition } from './file-conditions.ts'
import { extensionsNamedBy, filesOfOtherExtensionsThan, isNegated, negationOf, withoutNegation } from './globs.ts'

// Blocks turning rules off in some files only: one block where the names share their files, else one each.

export type Where = { readonly where: FilesCondition }

export type NamesOffWhere = Where & { readonly names: readonly string[] }

export type Within<T> = T & { readonly within: FilesAndIgnores }

type EntryByExtensions = { readonly extensions: readonly (readonly string[])[]; readonly others: readonly string[] }

type OffBlockScope = Pick<Linter.Config, 'files' | 'ignores'>

type NamesOffInScope = { readonly scope: OffBlockScope; readonly names: readonly string[] }

// Leaves out every file, so a later negated ignore can take files back.
const EVERY_FILE_IGNORED = '**'
const TWINS_OFF = 'agents-inc/twins-off'

/** Names off in the same files share a block. */
export function offBlocksOf(offs: readonly NamesOffWhere[], nameOf: (index: number, count: number) => string): Linter.Config[] {
  const scoped = eachWithin(namesOffGroupedByWhere(offs)).flatMap(namesOffInEachScope)
  return scoped.map(({ scope, names }, index) => ({ name: nameOf(index, scoped.length), ...scope, rules: rulesOff(names) }))
}

export function twinsOffName(index: number): string {
  return `${TWINS_OFF}/${String(index)}`
}

export function rulesOff(ruleIds: readonly string[]): Linter.RulesRecord {
  return Object.fromEntries(ruleIds.map((id): [string, Linter.RuleEntry] => [id, 'off']))
}

/** In the order each set of files is first met. */
export function groupedByWhere<T extends Where>(items: readonly T[]): (readonly T[])[] {
  return groupBy(items, ({ where }) => keyOfCondition(where)).values().toArray()
}

export function eachWithin<T extends Where>(items: readonly T[]): Within<T>[] {
  return items.flatMap((item) => filesAndIgnoresOf(item.where).map((within) => ({ ...item, within })))
}

export function whereOf(group: readonly Where[]): FilesCondition {
  return foundOr(group.at(0), 'a group holds at least one item').where
}

function namesOffGroupedByWhere(offs: readonly NamesOffWhere[]): NamesOffWhere[] {
  return groupedByWhere(offs).map((sharing) => ({ where: whereOf(sharing), names: sortedUnique(sharing.flatMap(({ names }) => names)) }))
}

function namesOffInEachScope({ within, names }: Within<NamesOffWhere>): NamesOffInScope[] {
  return offBlockScopesOf(within).map((scope) => ({ scope, names }))
}

/** An off block must never add files for ESLint to lint, and ESLint lints a file named by any glob not negated nor ending `/*` or `/**` (measured, 10.12). So a block reaching other file types names its files by ignores alone. */
function offBlockScopesOf({ files, ignores }: FilesAndIgnores): OffBlockScope[] {
  if (files === null) return [ignoresKey(ignores)]
  if (files.every(keepsToJsAndTs)) return [{ files: files.map(asFilesEntry), ...ignoresKey(ignores) }]
  const byIgnores = ignoresAlone(files)
  if (byIgnores !== null) return [{ ignores: [...byIgnores, ...ignores] }]
  return files.map((entry) => offBlockScopeOfOneEntry(entry, ignores))
}

/** Where ignores cannot say it either (two globs besides its extensions, which ignores cannot AND), it is kept to JS and TS files, and the off does not hold in its other files (a known limit). */
function offBlockScopeOfOneEntry(entry: readonly string[], ignores: readonly string[]): OffBlockScope {
  if (keepsToJsAndTs(entry)) return { files: [asFilesEntry(entry)], ...ignoresKey(ignores) }
  const byIgnores = ignoresOfOneEntry(splitByExtensions(entry))
  if (byIgnores !== null) return { ignores: [...byIgnores, ...ignores] }
  return { files: [asFilesEntry([...entry, JS_AND_TS_FILES])], ...ignoresKey(ignores) }
}

function keepsToJsAndTs(entry: readonly string[]): boolean {
  return entry.some(matchesOnlyJsAndTs)
}

function ignoresKey(ignores: readonly string[]): Pick<Linter.Config, 'ignores'> {
  return ignores.length === 0 ? {} : { ignores: [...ignores] }
}

/** Every file, then each entry's glob taken back, then every file of another extension. Null where ignores cannot say it. */
function ignoresAlone(files: readonly (readonly string[])[]): string[] | null {
  const entries = files.map(splitByExtensions)
  const first = foundOr(entries.at(0), 'a block naming files names at least one entry')
  if (!entries.every(asksOneGlobAtMost) || !entries.every((entry) => namesTheSameExtensions(entry, first))) return null
  return [...eachEntrysGlobTakenBack(entries), ...first.extensions.map(filesOfOtherExtensionsThan)]
}

/** None unless every entry asks one glob. */
function eachEntrysGlobTakenBack(entries: readonly EntryByExtensions[]): string[] {
  if (entries.some(({ others }) => others.length !== 1)) return []
  return everyFileIgnoredBut(entries.flatMap(({ others }) => others))
}

/** None where no glob is taken back. */
function everyFileIgnoredBut(takenBack: readonly string[]): string[] {
  return takenBack.length === 0 ? [] : [EVERY_FILE_IGNORED, ...takenBack.map(negationOf)]
}

function namesTheSameExtensions(entry: EntryByExtensions, other: EntryByExtensions): boolean {
  return keyOfExtensions(entry.extensions) === keyOfExtensions(other.extensions)
}

/** Null where the entry asks two globs or more, which ignores cannot AND. */
function ignoresOfOneEntry({ extensions, others }: EntryByExtensions): string[] | null {
  const asked = others.filter((glob) => !isNegated(glob))
  if (asked.length > 1) return null
  const leftOutByItsNegations = others.filter(isNegated).map(withoutNegation)
  return [...everyFileIgnoredBut(asked), ...leftOutByItsNegations, ...extensions.map(filesOfOtherExtensionsThan)]
}

/** An ignore can take back only one glob. */
function asksOneGlobAtMost({ others }: EntryByExtensions): boolean {
  return others.length <= 1 && others.every((glob) => !isNegated(glob))
}

function splitByExtensions(entry: readonly string[]): EntryByExtensions {
  return { extensions: entry.flatMap(extensionsListedBy), others: entry.filter((glob) => extensionsNamedBy(glob) === null) }
}

function keyOfExtensions(extensions: readonly (readonly string[])[]): string {
  return JSON.stringify(extensions)
}
