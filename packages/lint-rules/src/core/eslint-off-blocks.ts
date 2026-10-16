import type { Linter } from 'eslint'
import { sortedUnique } from './build-oxlint-config.ts'
import { asFilesEntry, JS_AND_TS_FILES, matchesOnlyJsAndTs } from './eslint-file-types.ts'
import { type FilesAndIgnores, type FilesCondition, filesAndIgnoresOf, keyOfCondition } from './file-conditions.ts'
import { extensionsNamedBy, filesOfOtherExtensionsThan, isNegated, negationOf, withoutNegation } from './globs.ts'

// ESLint blocks stating rule names off in some files only, as the merge writes them after the
// team's blocks and the agent build after its own: one block where the names share their files,
// else one each, numbered.

/** Something that holds in some files only. */
export type Where = { readonly where: FilesCondition }

/** ESLint names that are off in the same files. */
export type NamesOffWhere = Where & { readonly names: readonly string[] }

/** What holds within some files, and how a block keeps to them. */
export type Within<T> = T & { readonly within: FilesAndIgnores }

/** An entry of a block's `files`: its globs naming files by their extensions, and its others. */
type EntryByExtensions = { readonly extensions: readonly (readonly string[])[]; readonly others: readonly string[] }

/** How an off block keeps to its files. */
type OffBlockScope = Pick<Linter.Config, 'files' | 'ignores'>

// An ignore leaving out every file, which a later negated ignore takes files back from.
const EVERY_FILE_IGNORED = '**'
const TWINS_OFF = 'agents-inc/twins-off'

/** The names given off where each is off: the names off in the same files in one block, each block named by its place among them. */
export function offBlocksOf(offs: readonly NamesOffWhere[], nameOf: (index: number, count: number) => string): Linter.Config[] {
  const blocks = eachWithin(namesOffGroupedByWhere(offs)).flatMap(({ within, names }) => offBlockScopesOf(within).map((scope) => ({ scope, names })))
  return blocks.map(({ scope, names }, index) => ({ name: nameOf(index, blocks.length), ...scope, rules: rulesOff(names) }))
}

/** The name of a block turning typescript-eslint's twins of rules our oxlint part runs off, by its place among them. */
export function twinsOffName(index: number): string {
  return `${TWINS_OFF}/${String(index)}`
}

export function rulesOff(ruleIds: readonly string[]): Linter.RulesRecord {
  return Object.fromEntries(ruleIds.map((id): [string, Linter.RuleEntry] => [id, 'off']))
}

/** The items given, those that hold in the same files together, in the order each set of files is first met. */
export function groupedByWhere<T extends Where>(items: readonly T[]): T[][] {
  const keys = [...new Set(items.map(({ where }) => keyOfCondition(where)))]
  return keys.map((key) => items.filter(({ where }) => keyOfCondition(where) === key))
}

/** Each item once for each way a block keeps to its files. */
export function eachWithin<T extends Where>(items: readonly T[]): Within<T>[] {
  return items.flatMap((item) => filesAndIgnoresOf(item.where).map((within) => ({ ...item, within })))
}

export function whereOf(group: readonly Where[]): FilesCondition {
  const [first] = group
  if (first === undefined) throw new Error('a group holds at least one item')
  return first.where
}

/** The names off in the same files, together. */
function namesOffGroupedByWhere(offs: readonly NamesOffWhere[]): NamesOffWhere[] {
  return groupedByWhere(offs).map((sharing) => ({ where: whereOf(sharing), names: sortedUnique(sharing.flatMap(({ names }) => names)) }))
}

/**
 * How off blocks keep to their files without handing ESLint a file to lint (decisions.md, fix round
 * 2: an off block never adds files). ESLint lints a file only where some block's `files` name it by
 * more than every file: a glob neither negated nor ending `/*` or `/**` (measured, ESLint 10.12).
 * Our base block lints every JS and TS file, so a block whose every entry keeps to them names them
 * by `files`. One reaching other types, as our oxlint part runs a rule in .vue, .svelte and .astro
 * files, names its files by ignores alone, in one block where ignores can say every entry at once,
 * else in one block per entry.
 */
function offBlockScopesOf({ files, ignores }: FilesAndIgnores): OffBlockScope[] {
  if (files === null) return [ignoresKey(ignores)]
  if (files.every(keepsToJsAndTs)) return [{ files: files.map(asFilesEntry), ...ignoresKey(ignores) }]
  const byIgnores = ignoresAlone(files)
  if (byIgnores !== null) return [{ ignores: [...byIgnores, ...ignores] }]
  return files.map((entry) => offBlockScopeOfOneEntry(entry, ignores))
}

/**
 * An entry's own off block: by `files` where it keeps to JS and TS files, else by ignores. Where
 * ignores cannot say it either, as an entry asking two globs besides its extensions, which ignores
 * cannot AND, it is kept to the JS and TS files: in its files of other types the off does not
 * hold (a limit).
 */
function offBlockScopeOfOneEntry(entry: readonly string[], ignores: readonly string[]): OffBlockScope {
  if (keepsToJsAndTs(entry)) return { files: [asFilesEntry(entry)], ...ignoresKey(ignores) }
  const byIgnores = ignoresOfOneEntry(splitByExtensions(entry))
  if (byIgnores !== null) return { ignores: [...byIgnores, ...ignores] }
  return { files: [asFilesEntry([...entry, JS_AND_TS_FILES])], ...ignoresKey(ignores) }
}

/** An entry with a glob of only JS and TS files, which our base block lints anyway. */
function keepsToJsAndTs(entry: readonly string[]): boolean {
  return entry.some(matchesOnlyJsAndTs)
}

function ignoresKey(ignores: readonly string[]): Pick<Linter.Config, 'ignores'> {
  return ignores.length === 0 ? {} : { ignores: [...ignores] }
}

/**
 * Ignores applying a block to the files its entries match, where every entry asks one glob at most
 * besides one set of extensions they share: every file, then each entry's glob taken back, then
 * every file of another extension. Null where ignores cannot say it.
 */
function ignoresAlone(files: readonly (readonly string[])[]): string[] | null {
  const entries = files.map(splitByExtensions)
  const [first] = entries
  if (first === undefined) throw new Error('a block naming files names at least one entry')
  if (!entries.every(asksOneGlobAtMost) || !entries.every((entry) => keyOfExtensions(entry.extensions) === keyOfExtensions(first.extensions))) return null
  const eachEntrysGlobTakenBack = entries.every(({ others }) => others.length === 1)
    ? [EVERY_FILE_IGNORED, ...entries.flatMap(({ others }) => others).map(negationOf)]
    : []
  return [...eachEntrysGlobTakenBack, ...first.extensions.map(filesOfOtherExtensionsThan)]
}

/**
 * Ignores applying a block to the files one entry matches: every file, then its one glob taken
 * back, where it asks one; then each file a negated glob of it leaves out, and each of another
 * extension, left out again. Null where it asks two globs or more, which ignores cannot AND.
 */
function ignoresOfOneEntry({ extensions, others }: EntryByExtensions): string[] | null {
  const asked = others.filter((glob) => !isNegated(glob))
  const [onlyAsked, ...moreAsked] = asked
  if (moreAsked.length > 0) return null
  const leftOutByItsNegations = others.filter(isNegated).map(withoutNegation)
  return [...(onlyAsked === undefined ? [] : [EVERY_FILE_IGNORED, negationOf(onlyAsked)]), ...leftOutByItsNegations, ...extensions.map(filesOfOtherExtensionsThan)]
}

/** An entry asking a file one glob at most besides its extensions, and none negated: an ignore can take back only that one. */
function asksOneGlobAtMost({ others }: EntryByExtensions): boolean {
  return others.length <= 1 && others.every((glob) => !isNegated(glob))
}

/** An entry's globs naming files by their extensions, and its others. */
function splitByExtensions(entry: readonly string[]): EntryByExtensions {
  const extensions = entry.flatMap((glob) => {
    const named = extensionsNamedBy(glob)
    return named === null ? [] : [named]
  })
  return { extensions, others: entry.filter((glob) => extensionsNamedBy(glob) === null) }
}

function keyOfExtensions(extensions: readonly (readonly string[])[]): string {
  return JSON.stringify(extensions)
}
