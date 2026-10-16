// The rules the owner dropped on 2026-10-14 (docs/work/spec-data.md, D2 and D9), each card in a
// comment. A dropped rule leaves data/rules.json and stays a RuleId a team can turn on.

/** Rules dropped as duplicates or conflicts, and the shipped rules that still report what each did. */
export type Drop = { readonly dropped: readonly string[]; readonly stillReporting: readonly string[] }

export const ROUND_2_DROPS: readonly Drop[] = [
  // r2-d1
  { dropped: ['react/jsx-key'], stillReporting: ['@eslint-react/x-no-missing-key'] },
  // r2-d2
  { dropped: ['@eslint-react/jsx-no-comment-textnodes'], stillReporting: ['react/jsx-no-comment-textnodes'] },
  // r2-d3
  {
    dropped: ['react/no-did-mount-set-state', 'react/no-did-update-set-state', 'react/no-will-update-set-state'],
    stillReporting: [
      '@eslint-react/x-no-set-state-in-component-did-mount',
      '@eslint-react/x-no-set-state-in-component-did-update',
      '@eslint-react/x-no-set-state-in-component-will-update',
    ],
  },
  // r2-d4
  {
    dropped: [
      '@eslint-react/x-no-component-will-mount',
      '@eslint-react/x-no-component-will-receive-props',
      '@eslint-react/x-no-component-will-update',
      '@eslint-react/x-no-unsafe-component-will-mount',
      '@eslint-react/x-no-unsafe-component-will-receive-props',
      '@eslint-react/x-no-unsafe-component-will-update',
    ],
    stillReporting: ['react/no-unsafe'],
  },
  // r2-d5
  { dropped: ['react/no-unused-class-component-methods'], stillReporting: ['@eslint-react/x-no-unused-class-component-members'] },
  // r2-d6
  {
    dropped: ['react/no-unstable-nested-components', '@eslint-react/x-static-components'],
    stillReporting: ['@eslint-react/x-no-nested-component-definitions', '@eslint-react/x-no-nested-lazy-component-declarations'],
  },
  // r2-d7, r2-d8, r2-d9, r2-d10, r2-d13
  {
    dropped: [
      '@eslint-react/x-no-unstable-default-props',
      '@eslint-react/dom-no-dangerously-set-innerhtml-with-children',
      '@eslint-react/dom-no-void-elements-with-children',
      '@eslint-react/x-no-unstable-context-value',
      '@eslint-react/jsx-no-children-prop-with-children',
    ],
    stillReporting: [
      'react/no-object-type-as-default-prop',
      'react/no-danger-with-children',
      'react/void-dom-elements-no-children',
      'react/jsx-no-constructed-context-values',
      'react/no-children-prop',
    ],
  },
  // r2-d11, r2-d12, r2-d15
  {
    dropped: ['react/iframe-missing-sandbox', 'react/jsx-no-script-url', 'react/style-prop-object'],
    stillReporting: ['@eslint-react/dom-no-missing-iframe-sandbox', '@eslint-react/dom-no-script-url', '@eslint-react/dom-no-string-style-prop'],
  },
  // r2-d14
  { dropped: ['react/jsx-no-leaked-render'], stillReporting: ['@eslint-react/x-no-leaked-conditional-rendering'] },
  // r2-d18
  { dropped: ['functional/no-class-inheritance', 'react/prefer-stateless-function'], stillReporting: ['functional/no-classes'] },
  // r2-d20
  { dropped: ['react-hooks/set-state-in-effect'], stillReporting: ['react-you-might-not-need-an-effect/no-derived-state'] },
  // r2-d26, r2-d28, r2-d29
  {
    dropped: ['jsx-a11y/no-aria-hidden-on-focusable', 'jsx-a11y/anchor-has-content', 'sonarjs/object-alt-content'],
    stillReporting: ['house/no-focusable-content-in-aria-hidden', 'jsx-a11y/control-has-associated-label', 'jsx-a11y/alt-text'],
  },
  // r2-d35, r2-d36, r2-d43
  {
    dropped: ['@typescript-eslint/prefer-for-of', '@typescript-eslint/no-non-null-asserted-nullish-coalescing', '@typescript-eslint/no-unsafe-unary-minus'],
    stillReporting: ['unicorn/no-for-loop', '@typescript-eslint/no-non-null-assertion', 'sonarjs/non-number-in-arithmetic-expression'],
  },
  // r2-d42, r2-d52
  {
    dropped: ['oxc/bad-object-literal-comparison', 'oxc/bad-match-all-arg', 'oxc/bad-replace-all-arg'],
    stillReporting: ['no-constant-binary-expression', 'regexp/no-missing-g-flag'],
  },
  // r2-d44, r2-d45, r2-d55, r2-d56, r2-d61
  {
    dropped: ['sonarjs/no-return-type-any', 'sonarjs/class-name', 'sonarjs/call-argument-line', 'sonarjs/array-callback-without-return', 'sonarjs/async-test-assertions'],
    stillReporting: ['@typescript-eslint/no-explicit-any', '@typescript-eslint/naming-convention', 'no-unexpected-multiline', 'array-callback-return', 'vitest/valid-expect'],
  },
  // r2-d47, r2-d64-66
  { dropped: ['regexp/no-legacy-features', 'regexp/no-non-standard-flag'], stillReporting: ['unicorn/no-nonstandard-builtin-properties', 'no-invalid-regexp'] },
  // r2-d48, r2-d54
  { dropped: ['promise/no-multiple-resolved', 'promise/prefer-await-to-then'], stillReporting: ['unicorn/no-multiple-promise-resolver-calls', 'unicorn/prefer-await'] },
  // r2-d53, r2-d69, r2-d77, r2-d80
  {
    dropped: ['unicorn/require-module-specifiers', 'unicorn/no-nested-ternary', 'unicorn/no-this-outside-of-class', 'unicorn/prefer-reflect-apply'],
    stillReporting: ['import-x/no-empty-named-blocks', 'sonarjs/no-nested-conditional', '@typescript-eslint/no-invalid-this', 'no-useless-call'],
  },
  // r2-c1, r2-c3, r2-c4, r2-c10, r2-n3: each conflicted with the rule beside it.
  {
    dropped: ['unicorn/no-useless-recursion', 'unicorn/no-unnecessary-splice', 'unicorn/prefer-single-replace', 'sonarjs/shorthand-property-grouping', 'react/prefer-es6-class'],
    stillReporting: ['house/no-classic-loops', 'unicorn/no-array-front-mutation', 'require-unicode-regexp', 'perfectionist/sort-objects', 'functional/no-classes'],
  },
  // r2-d59
  { dropped: ['n/no-extraneous-import', 'n/no-extraneous-require'], stillReporting: ['import-x/no-extraneous-dependencies'] },
  // r2-d76
  { dropped: ['default-case-last'], stillReporting: ['perfectionist/sort-switch-case'] },
  // q-r4-no-rename-default: dropped as noise, with nothing in its place.
  { dropped: ['import-x/no-rename-default'], stillReporting: [] },
  // r2-d49-51: their oxc twins report beside oxlint, and stand in for them without it.
  {
    dropped: ['unicorn/no-invalid-character-comparison', 'unicorn/no-misrefactored-assignment', 'unicorn/no-constant-zero-expression'],
    stillReporting: ['oxc/bad-char-at-comparison', 'oxc/misrefactored-assign-op', 'oxc/erasing-op'],
  },
]

/**
 * The modern-js rules whose fix writes an API Node 22 lacks: shipped off on 2026-10-11 until a
 * category for the newest language features, enabled by Node version, exists (questions.md "Parked").
 */
export const RULES_NEEDING_NEWER_NODE: readonly string[] = [
  'unicorn/prefer-dispose',
  'unicorn/prefer-error-is-error',
  'unicorn/prefer-get-or-insert-computed',
  'unicorn/prefer-iterator-concat',
  'unicorn/prefer-promise-try',
  'unicorn/prefer-regexp-escape',
  'unicorn/prefer-temporal',
  'unicorn/prefer-uint8array-base64',
]
