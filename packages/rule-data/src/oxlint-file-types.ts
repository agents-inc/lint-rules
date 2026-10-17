import oxlintFileTypes from '../data/oxlint-file-types.json' with { type: 'json' }

// Which file types oxlint runs each rule in (data/oxlint-file-types.json). A guard reading options, the
// path beyond its extension, or the file's content is not recorded. Imports nothing but the data, so
// lint-rules reads it without loading the catalog.

/** The file types oxlint runs a rule in: their extensions, and whether the declaration files among them are skipped. */
export type OxlintRuleFileTypes = { readonly extensions: readonly string[]; readonly skipsDeclarationFiles: boolean }

/** The file types a rule's guard skips, and the rules it guards, by their oxlint names. */
type FileGuard = { readonly skips: readonly string[]; readonly skipsDeclarationFiles: boolean; readonly rules: readonly string[] }

const LINTED_EXTENSIONS: readonly string[] = oxlintFileTypes.lintedByDefault.extensions

const NO_GUARD: FileGuard = { skips: [], skipsDeclarationFiles: false, rules: [] }

const guardByOxlintName: ReadonlyMap<string, FileGuard> = new Map(oxlintFileTypes.guards.flatMap(eachRuleWithItsGuard))

export const oxlintDeclarationFiles: readonly string[] = oxlintFileTypes.declarationFiles.globs

/** The file types oxlint runs the rule in: a rule no guard names runs in every file oxlint lints. */
export function fileTypesOxlintRunsTheRuleIn(oxlintName: string): OxlintRuleFileTypes {
  const { skips, skipsDeclarationFiles } = guardOf(oxlintName)
  return { extensions: LINTED_EXTENSIONS.filter((extension) => !skips.includes(extension)), skipsDeclarationFiles }
}

function guardOf(oxlintName: string): FileGuard {
  const guard = guardByOxlintName.get(oxlintName)
  return guard === undefined ? NO_GUARD : guard
}

function eachRuleWithItsGuard(guard: FileGuard): [string, FileGuard][] {
  return guard.rules.map((oxlintName) => [oxlintName, guard])
}
