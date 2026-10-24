// A dropped rule leaves data/rules.json and stays a RuleId a team can turn on.

/** Rules dropped as duplicates or conflicts, and the shipped rules that still report what each did. */
export type Drop = { readonly dropped: readonly string[]; readonly stillReporting: readonly string[] }

export const ROUND_2_DROPS: readonly Drop[] = [
  { dropped: ['react/jsx-key'], stillReporting: ['@eslint-react/x-no-missing-key'] },
  { dropped: ['@eslint-react/jsx-no-comment-textnodes'], stillReporting: ['react/jsx-no-comment-textnodes'] },
  {
    dropped: ['react/no-did-mount-set-state', 'react/no-did-update-set-state', 'react/no-will-update-set-state'],
    stillReporting: [
      '@eslint-react/x-no-set-state-in-component-did-mount',
      '@eslint-react/x-no-set-state-in-component-did-update',
      '@eslint-react/x-no-set-state-in-component-will-update',
    ],
  },
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
  { dropped: ['react/no-unused-class-component-methods'], stillReporting: ['@eslint-react/x-no-unused-class-component-members'] },
  {
    dropped: ['react/no-unstable-nested-components', '@eslint-react/x-static-components'],
    stillReporting: ['@eslint-react/x-no-nested-component-definitions', '@eslint-react/x-no-nested-lazy-component-declarations'],
  },
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
  {
    dropped: ['react/iframe-missing-sandbox', 'react/jsx-no-script-url', 'react/style-prop-object'],
    stillReporting: ['@eslint-react/dom-no-missing-iframe-sandbox', '@eslint-react/dom-no-script-url', '@eslint-react/dom-no-string-style-prop'],
  },
  { dropped: ['react/jsx-no-leaked-render'], stillReporting: ['@eslint-react/x-no-leaked-conditional-rendering'] },
  { dropped: ['functional/no-class-inheritance', 'react/prefer-stateless-function'], stillReporting: ['functional/no-classes'] },
  { dropped: ['react-hooks/set-state-in-effect'], stillReporting: ['react-you-might-not-need-an-effect/no-derived-state'] },
  {
    dropped: ['jsx-a11y/no-aria-hidden-on-focusable', 'jsx-a11y/anchor-has-content', 'sonarjs/object-alt-content'],
    stillReporting: ['house/no-focusable-content-in-aria-hidden', 'jsx-a11y/control-has-associated-label', 'jsx-a11y/alt-text'],
  },
  {
    dropped: ['@typescript-eslint/prefer-for-of', '@typescript-eslint/no-non-null-asserted-nullish-coalescing', '@typescript-eslint/no-unsafe-unary-minus'],
    stillReporting: ['unicorn/no-for-loop', '@typescript-eslint/no-non-null-assertion', 'sonarjs/non-number-in-arithmetic-expression'],
  },
  {
    dropped: ['oxc/bad-object-literal-comparison', 'oxc/bad-match-all-arg', 'oxc/bad-replace-all-arg'],
    stillReporting: ['no-constant-binary-expression', 'regexp/no-missing-g-flag'],
  },
  {
    dropped: ['sonarjs/no-return-type-any', 'sonarjs/class-name', 'sonarjs/call-argument-line', 'sonarjs/array-callback-without-return', 'sonarjs/async-test-assertions'],
    stillReporting: ['@typescript-eslint/no-explicit-any', '@typescript-eslint/naming-convention', 'no-unexpected-multiline', 'array-callback-return', 'vitest/valid-expect'],
  },
  { dropped: ['regexp/no-legacy-features', 'regexp/no-non-standard-flag'], stillReporting: ['unicorn/no-nonstandard-builtin-properties', 'no-invalid-regexp'] },
  { dropped: ['promise/no-multiple-resolved', 'promise/prefer-await-to-then'], stillReporting: ['unicorn/no-multiple-promise-resolver-calls', 'unicorn/prefer-await'] },
  {
    dropped: ['unicorn/require-module-specifiers', 'unicorn/no-nested-ternary', 'unicorn/no-this-outside-of-class', 'unicorn/prefer-reflect-apply'],
    stillReporting: ['import-x/no-empty-named-blocks', 'sonarjs/no-nested-conditional', '@typescript-eslint/no-invalid-this', 'no-useless-call'],
  },
  // Each conflicted with the rule beside it.
  {
    dropped: ['unicorn/no-useless-recursion', 'unicorn/no-unnecessary-splice', 'unicorn/prefer-single-replace', 'sonarjs/shorthand-property-grouping', 'react/prefer-es6-class'],
    stillReporting: ['house/no-classic-loops', 'unicorn/no-array-front-mutation', 'require-unicode-regexp', 'perfectionist/sort-objects', 'functional/no-classes'],
  },
  { dropped: ['n/no-extraneous-import', 'n/no-extraneous-require'], stillReporting: ['import-x/no-extraneous-dependencies'] },
  // Dropped as noise, with nothing in its place.
  { dropped: ['import-x/no-rename-default'], stillReporting: [] },
  // Their oxc twins report beside oxlint, and stand in for them without it.
  {
    dropped: ['unicorn/no-invalid-character-comparison', 'unicorn/no-misrefactored-assignment', 'unicorn/no-constant-zero-expression'],
    stillReporting: ['oxc/bad-char-at-comparison', 'oxc/misrefactored-assign-op', 'oxc/erasing-op'],
  },
]

/**
 * The installed rules whose rewrite needs an API Node 22 lacks: off until a category for the newest
 * language features, enabled by Node version, exists. In data/rule-candidates.json's order.
 */
export const RULES_NEEDING_NEWER_NODE: readonly string[] = [
  'e18e/prefer-get-or-insert',
  'unicorn/prefer-dispose',
  'unicorn/prefer-error-is-error',
  'unicorn/prefer-get-or-insert-computed',
  'unicorn/prefer-iterator-concat',
  'unicorn/prefer-iterator-zip',
  'unicorn/prefer-promise-try',
  'unicorn/prefer-regexp-escape',
  'unicorn/prefer-temporal',
  'unicorn/prefer-uint8array-base64',
  'unicorn/prefer-uint8array-hex',
]
