import oxlintRefusedOptions from '../data/oxlint-refused-options.json' with { type: 'json' }

// The options typescript-eslint's extension of a core rule takes that oxlint's copy refuses or ignores
// (data/oxlint-refused-options.json). oxlint loads no part of a config with a refused option and drops
// an ignored one silently. Imports nothing but the data, so lint-rules reads it without the catalog.

/** A rule oxlint refuses or does not honour some options of, by its oxlint name, and those options' keys. */
type RefusedOptions = { readonly rule: string; readonly refusedKeys: readonly string[] }

const refusedKeysByOxlintName: ReadonlyMap<string, readonly string[]> = new Map(
  oxlintRefusedOptions.rules.map(({ rule, refusedKeys }: RefusedOptions) => [rule, refusedKeys]),
)

/** The option keys of typescript-eslint's extension that oxlint refuses for the rule, or does not honour: none for a rule the data does not name. */
export function optionKeysOxlintRefuses(oxlintName: string): readonly string[] {
  const refusedKeys = refusedKeysByOxlintName.get(oxlintName)
  return refusedKeys === undefined ? [] : refusedKeys
}
