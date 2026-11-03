// Our rules list accepts only rules we ship; naming any other rule there stops with a message pointing to the team's
// own ESLint or oxlint config. The owner dropped each unshipped rule here from the candidates, so none is about to ship;
// unshipped-rules-refused.test.ts holds each to the catalog.

export const UNSHIPPED_RUN_BY_OXLINT = 'no-console'
export const UNSHIPPED_RUN_BY_ESLINT = 'functional/no-loop-statements'
export const SHIPPED_RUN_BY_OXLINT = 'no-debugger'
export const SHIPPED_RUN_BY_ESLINT = 'eqeqeq'
export const NO_RULE_IN_THE_CATALOG = 'not-a/rule'

export const ENTRY_GLOBS = ['legacy/**'] as const

/** The refusal of a rule we do not ship, named under `key` (`rules`, or an entry's `fileOverrides[i].rules`). */
export function unshippedRuleRefusal(key: string, id: string): string {
  return `agents-inc.lint.mts: ${key}: "${id}" is not a rule we ship; set it in your own ESLint or oxlint config`
}
