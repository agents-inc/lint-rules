import type { LintRules } from '../../index.ts'

type Rulesets = Partial<LintRules['agentRulesets']>

type RulesetMove = { readonly rule: string; readonly from: Rulesets; readonly to: Rulesets }

type RulesetStay = { readonly rule: string; readonly in: Rulesets }

const CORRECTNESS = { quality: ['correctness'] } as const satisfies Rulesets
const TYPE_SAFETY = { quality: ['type-safety'] } as const satisfies Rulesets
const COMPLEXITY = { quality: ['complexity'] } as const satisfies Rulesets
const IMMUTABILITY = { quality: ['immutability'] } as const satisfies Rulesets
const MODERN_JS = { quality: ['modern-js'] } as const satisfies Rulesets
const REDUNDANCY = { quality: ['redundancy'] } as const satisfies Rulesets
const MODULES = { quality: ['modules'] } as const satisfies Rulesets
const CONVENTIONS = { quality: ['conventions'] } as const satisfies Rulesets
const REACT = { libs: { ui: ['react'] } } as const satisfies Rulesets
const NODE = { runtimes: ['node'] } as const satisfies Rulesets
const BROWSER = { runtimes: ['browser'] } as const satisfies Rulesets

export const RULESET_MOVES: readonly RulesetMove[] = [
  { rule: '@eslint-react/x-no-leaked-conditional-rendering', from: REACT, to: CORRECTNESS },
  { rule: '@typescript-eslint/dot-notation', from: CONVENTIONS, to: REDUNDANCY },
  { rule: '@typescript-eslint/no-namespace', from: TYPE_SAFETY, to: CONVENTIONS },
  { rule: '@typescript-eslint/no-unnecessary-type-parameters', from: REDUNDANCY, to: TYPE_SAFETY },
  { rule: '@typescript-eslint/parameter-properties', from: TYPE_SAFETY, to: CONVENTIONS },
  { rule: 'functional/prefer-property-signatures', from: IMMUTABILITY, to: TYPE_SAFETY },
  { rule: 'n/no-unpublished-bin', from: NODE, to: MODULES },
  { rule: 'no-array-constructor', from: CORRECTNESS, to: REDUNDANCY },
  { rule: 'no-debugger', from: REDUNDANCY, to: CORRECTNESS },
  { rule: 'no-new', from: REDUNDANCY, to: CORRECTNESS },
  { rule: 'no-object-constructor', from: MODERN_JS, to: REDUNDANCY },
  { rule: 'no-restricted-syntax', from: TYPE_SAFETY, to: CONVENTIONS },
  { rule: 'no-unused-expressions', from: REDUNDANCY, to: CORRECTNESS },
  { rule: 'promise/no-promise-in-callback', from: CORRECTNESS, to: MODERN_JS },
  { rule: 'react/no-children-prop', from: REACT, to: CONVENTIONS },
  { rule: 'regexp/no-dupe-disjunctions', from: REDUNDANCY, to: CORRECTNESS },
  { rule: 'unicorn/no-break-in-nested-loop', from: COMPLEXITY, to: CORRECTNESS },
  { rule: 'unicorn/no-late-current-target-access', from: BROWSER, to: CORRECTNESS },
  { rule: 'unicorn/no-late-event-control', from: BROWSER, to: CORRECTNESS },
  { rule: 'unicorn/no-subtraction-comparison', from: REDUNDANCY, to: CORRECTNESS },
  { rule: 'unicorn/prefer-add-event-listener', from: BROWSER, to: CONVENTIONS },
  { rule: 'unicorn/prefer-array-flat-map', from: MODERN_JS, to: REDUNDANCY },
  { rule: 'unicorn/prefer-array-from-map', from: MODERN_JS, to: REDUNDANCY },
  { rule: 'unicorn/prefer-has-check', from: MODERN_JS, to: REDUNDANCY },
  { rule: 'unicorn/prefer-includes-over-repeated-comparisons', from: COMPLEXITY, to: MODERN_JS },
  { rule: 'unicorn/prefer-map-from-entries', from: MODERN_JS, to: CONVENTIONS },
  { rule: 'unicorn/prefer-math-abs', from: MODERN_JS, to: REDUNDANCY },
  { rule: 'unicorn/prefer-object-destructuring-defaults', from: MODERN_JS, to: CONVENTIONS },
  { rule: 'unicorn/prefer-object-iterable-methods', from: MODERN_JS, to: REDUNDANCY },
  { rule: 'unicorn/prefer-temporal-conversion', from: MODERN_JS, to: REDUNDANCY },
]

export const RULESET_STAYS: readonly RulesetStay[] = [
  { rule: '@typescript-eslint/no-deprecated', in: MODERN_JS },
  { rule: '@typescript-eslint/no-dynamic-delete', in: IMMUTABILITY },
  { rule: '@typescript-eslint/prefer-enum-initializers', in: CORRECTNESS },
  { rule: '@typescript-eslint/prefer-namespace-keyword', in: MODERN_JS },
  { rule: 'no-shadow', in: CORRECTNESS },
  { rule: 'regexp/optimal-lookaround-quantifier', in: REDUNDANCY },
  { rule: 'sonarjs/memoize-cache-key', in: CORRECTNESS },
  { rule: 'sonarjs/no-default-utility-imports', in: MODULES },
  { rule: 'sonarjs/prefer-native-axios-alternative', in: MODERN_JS },
  { rule: 'sonarjs/prefer-native-lodash-alternative', in: MODERN_JS },
  { rule: 'unicorn/consistent-function-scoping', in: COMPLEXITY },
  { rule: 'unicorn/consistent-optional-chaining', in: CORRECTNESS },
  { rule: 'unicorn/no-array-front-mutation', in: IMMUTABILITY },
  { rule: 'unicorn/no-confusing-array-splice', in: CORRECTNESS },
  { rule: 'unicorn/no-declarations-before-early-exit', in: COMPLEXITY },
  { rule: 'unicorn/no-negated-array-predicate', in: COMPLEXITY },
  { rule: 'unicorn/no-new-array', in: CORRECTNESS },
  { rule: 'unicorn/prefer-else-if', in: COMPLEXITY },
]

export const STOPPED_SHIPPING: readonly string[] = ['react/no-adjacent-inline-elements', 'unicorn/require-post-message-target-origin']
