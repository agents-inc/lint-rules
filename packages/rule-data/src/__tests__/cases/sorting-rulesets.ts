// The rulesets that sort code are opt-in: `init` leaves them out and warns they conflict with a
// formatter that sorts.

export const SORTING_RULESETS: readonly string[] = ['import-order', 'ordering']

/** Each rule of the sorting rulesets, by ruleset: every one reorders code. */
export const RULES_THAT_SORT = {
  'import-order': [
    'import-x/order',
    'perfectionist/sort-export-attributes',
    'perfectionist/sort-exports',
    'perfectionist/sort-import-attributes',
    'perfectionist/sort-named-exports',
    'perfectionist/sort-named-imports',
  ],
  ordering: [
    'perfectionist/sort-array-includes',
    'perfectionist/sort-arrays',
    'perfectionist/sort-classes',
    'perfectionist/sort-decorators',
    'perfectionist/sort-enums',
    'perfectionist/sort-heritage-clauses',
    'perfectionist/sort-interfaces',
    'perfectionist/sort-intersection-types',
    'perfectionist/sort-jsx-props',
    'perfectionist/sort-maps',
    'perfectionist/sort-modules',
    'perfectionist/sort-object-types',
    'perfectionist/sort-objects',
    'perfectionist/sort-sets',
    'perfectionist/sort-switch-case',
    'perfectionist/sort-union-types',
    'perfectionist/sort-variable-declarations',
    'regexp/sort-alternatives',
    'regexp/sort-flags',
  ],
}

/** Whether the ruleset is one that sorts code, which gives both its `optIn` and its `sortsCode`. */
export function isSortingRuleset(ruleset: string): boolean {
  return SORTING_RULESETS.includes(ruleset)
}
