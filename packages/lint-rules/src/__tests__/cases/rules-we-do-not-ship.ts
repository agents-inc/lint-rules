// Owner, q-lint-unshipped-rules-channel: our rules list accepts only rules we ship; naming any other rule there stops
// with a message pointing to the team's own ESLint or oxlint config. Each unshipped rule here was dropped from the
// candidates by the owner, so no lane is about to ship it; unshipped-rules-refused.test.ts holds each to the catalog.

/** In the catalog, unshipped, oxlint having a version of it (owner 2026-10-24: "Reject", rc-no-console). */
export const UNSHIPPED_RUN_BY_OXLINT = 'no-console'
/** In the catalog, unshipped, ESLint alone running it (dropped for house/no-classic-loops, owner 2026-10-10). */
export const UNSHIPPED_RUN_BY_ESLINT = 'functional/no-loop-statements'
export const SHIPPED_RUN_BY_OXLINT = 'no-debugger'
export const SHIPPED_RUN_BY_ESLINT = 'eqeqeq'
/** No route in the catalog has it. */
export const NO_RULE_IN_THE_CATALOG = 'not-a/rule'

export const ENTRY_GLOBS = ['legacy/**'] as const

/** The refusal of a rule we do not ship, named under `key` (`rules`, or an entry's `fileOverrides[i].rules`). */
export function unshippedRuleRefusal(key: string, id: string): string {
  return `agents-inc.lint.mts: ${key}: "${id}" is not a rule we ship; set it in your own ESLint or oxlint config`
}
