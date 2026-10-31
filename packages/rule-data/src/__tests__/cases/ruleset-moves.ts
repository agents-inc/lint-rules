import type { RuleCase } from './changed-settings.ts'

/** As data/rules.json records it; an owner's placement carries no `alternative`. */
type OwnerAssignment = { readonly confidence: 'high'; readonly note: string; readonly by: string }

type RulesetMove = { readonly ruleset: string; readonly assignment: OwnerAssignment }

const OWNER_2026_10_10 = 'owner-2026-10-10'
const OWNER_2026_10_30 = 'owner-2026-10-30'

const BUG_CHECKS_IN_TIDYING_GROUPS = 'q-lint-crit2-bug-checks-in-tidying-groups'
const TYPE_SAFETY_SCOPE = 'q-lint-crit2-type-safety-scope'
const MODERN_JS_SCOPE = 'q-lint-crit2-modern-js-scope'
const NO_CHILDREN_PROP = 'q-lint-crit2-no-children-prop'
const LATE_EVENT_RULES = 'q-lint-crit2-late-event-rules'
const SINGLE_PLACEMENTS = 'q-lint-crit2-single-placements'

function movedOnCard(ruleset: string, card: string): RulesetMove {
  return { ruleset, assignment: { confidence: 'high', note: card, by: OWNER_2026_10_30 } }
}

/** Each moved rule, sorted by ID. */
export const RULESET_MOVES: Readonly<Record<string, RulesetMove>> = {
  '@eslint-react/x-no-leaked-conditional-rendering': {
    ruleset: 'correctness',
    assignment: { confidence: 'high', note: 'react keeps what depends on React', by: OWNER_2026_10_10 },
  },
  '@typescript-eslint/dot-notation': movedOnCard('redundancy', SINGLE_PLACEMENTS),
  '@typescript-eslint/no-namespace': movedOnCard('conventions', TYPE_SAFETY_SCOPE),
  '@typescript-eslint/no-unnecessary-type-parameters': movedOnCard('type-safety', TYPE_SAFETY_SCOPE),
  '@typescript-eslint/parameter-properties': movedOnCard('conventions', TYPE_SAFETY_SCOPE),
  'functional/prefer-property-signatures': movedOnCard('type-safety', TYPE_SAFETY_SCOPE),
  'n/no-unpublished-bin': movedOnCard('modules', SINGLE_PLACEMENTS),
  'no-array-constructor': movedOnCard('redundancy', MODERN_JS_SCOPE),
  'no-debugger': movedOnCard('correctness', BUG_CHECKS_IN_TIDYING_GROUPS),
  'no-new': movedOnCard('correctness', BUG_CHECKS_IN_TIDYING_GROUPS),
  'no-object-constructor': movedOnCard('redundancy', MODERN_JS_SCOPE),
  'no-restricted-syntax': movedOnCard('conventions', TYPE_SAFETY_SCOPE),
  'no-unused-expressions': movedOnCard('correctness', BUG_CHECKS_IN_TIDYING_GROUPS),
  'promise/no-promise-in-callback': movedOnCard('modern-js', SINGLE_PLACEMENTS),
  'react/no-children-prop': movedOnCard('conventions', NO_CHILDREN_PROP),
  'regexp/no-dupe-disjunctions': movedOnCard('correctness', BUG_CHECKS_IN_TIDYING_GROUPS),
  'unicorn/no-break-in-nested-loop': movedOnCard('correctness', BUG_CHECKS_IN_TIDYING_GROUPS),
  'unicorn/no-late-current-target-access': movedOnCard('correctness', LATE_EVENT_RULES),
  'unicorn/no-late-event-control': movedOnCard('correctness', LATE_EVENT_RULES),
  'unicorn/no-subtraction-comparison': movedOnCard('correctness', BUG_CHECKS_IN_TIDYING_GROUPS),
  'unicorn/prefer-add-event-listener': movedOnCard('conventions', SINGLE_PLACEMENTS),
  'unicorn/prefer-array-flat-map': movedOnCard('redundancy', MODERN_JS_SCOPE),
  'unicorn/prefer-array-from-map': movedOnCard('redundancy', MODERN_JS_SCOPE),
  'unicorn/prefer-has-check': movedOnCard('redundancy', MODERN_JS_SCOPE),
  'unicorn/prefer-includes-over-repeated-comparisons': movedOnCard('modern-js', MODERN_JS_SCOPE),
  'unicorn/prefer-map-from-entries': movedOnCard('conventions', MODERN_JS_SCOPE),
  'unicorn/prefer-math-abs': movedOnCard('redundancy', MODERN_JS_SCOPE),
  'unicorn/prefer-object-destructuring-defaults': movedOnCard('conventions', MODERN_JS_SCOPE),
  'unicorn/prefer-object-iterable-methods': movedOnCard('redundancy', MODERN_JS_SCOPE),
  'unicorn/prefer-temporal-conversion': movedOnCard('redundancy', MODERN_JS_SCOPE),
}

/** The ruleset and the assignment's note and `by` where the owner moved the rule, for a pin that leaves confidence to the data. */
export function placementMovedTo(rule: string): { readonly ruleset?: string; readonly assignment?: { readonly note: string; readonly by: string } } {
  const move = RULESET_MOVES[rule]
  if (move === undefined) return {}
  const { note, by } = move.assignment
  return { ruleset: move.ruleset, assignment: { note, by } }
}

export const KEPT_UNSHIPPED = 'unicorn/no-useless-spread'

const NAMESPACE_KEYWORD_RULE = '@typescript-eslint/prefer-namespace-keyword'

const MODULE_DECLARED = `declare module Shapes {
  export const sides: number
}
`

/** It reports `module Shapes` only where no-namespace is silent, in a declaration file; a quoted module name is never reported. */
export const NAMESPACE_KEYWORD_IN_DECLARATION_FILES: RuleCase = {
  rule: NAMESPACE_KEYWORD_RULE,
  silentIn: [
    {
      path: 'src/shapes.ts',
      source: `module Shapes {
  export const sides = 4
}
`,
    },
    { path: 'src/shapes-declared.ts', source: MODULE_DECLARED },
    {
      path: 'types/shapes-module.d.ts',
      source: `declare module 'shapes' {
  export const sides: number
}
`,
    },
  ],
  reportedIn: [
    { path: 'types/shapes.d.ts', source: MODULE_DECLARED },
    { path: 'types/shapes.d.mts', source: MODULE_DECLARED },
    { path: 'types/shapes.d.cts', source: MODULE_DECLARED },
  ],
}
