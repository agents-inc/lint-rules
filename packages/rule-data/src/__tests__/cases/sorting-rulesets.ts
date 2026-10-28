// The rulesets that sort code are opt-in: `init` leaves them out and warns they conflict with a
// formatter that sorts. Two that sort nothing are opt-in too.

export const SORTING_RULESETS: readonly string[] = ['import-order', 'ordering']

/** Each rule of the sorting rulesets, by ruleset: every one reorders code but import-x/first, which the owner keeps in import-order. */
export const RULES_THAT_SORT = {
  'import-order': [
    'import-x/first',
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

/**
 * The opt-in rulesets that sort nothing: strict design tokens; the browser-support checks, which need a browser target;
 * jest-dom's, whose fixes call matchers only a project loading jest-dom has; and react-ssr's, which report in an app
 * that never renders on a server.
 */
const OPT_IN_RULESETS_THAT_SORT_NOTHING: ReadonlySet<string> = new Set(['tailwind', 'browser-targets', 'jest-dom', 'react-ssr'])

/** Whether the ruleset is one that sorts code, which gives its `sortsCode`. */
export function isSortingRuleset(ruleset: string): boolean {
  return SORTING_RULESETS.includes(ruleset)
}

/** Whether `init` leaves the ruleset out of a new config: one that sorts code, or an opt-in one that sorts nothing. */
export function isOptInRuleset(ruleset: string): boolean {
  return isSortingRuleset(ruleset) || OPT_IN_RULESETS_THAT_SORT_NOTHING.has(ruleset)
}
