import type { AcceptedRule } from '../accepted-rules-out-of-place.ts'

// Every rule the owner accepted on the 2026-10-24 rule-candidate cards (docs/work/decisions.md, "Owner
// 2026-10-24"): the card that accepted it, the state it waits in until it ships, and the card its build waits
// on, where one does; or the later card that dropped it.

const PLAYWRIGHT_VITEST_TWINS = 'q-lint-playwright-vitest-twins'
const JEST_DOM_WITHOUT_JEST_DOM = 'q-lint-jest-dom-without-jest-dom'
const REACT_SSR_IN_CLIENT_APPS = 'q-lint-react-ssr-in-client-apps'
const DRIZZLE_ADVISORY = 'q-lint-dep-drizzle-advisory'
const COMMENT_RULES_IN_EDITORS = 'q-lint-cmt-editor-reach'

/** Each accepted rule's ID, and where it waits until it ships, or the card that dropped it. */
export const ACCEPTED_ON_2026_10_24: Readonly<Record<string, AcceptedRule>> = {
  '@eslint-community/eslint-comments/disable-enable-pair': {
    card: 'rc-eslint-community-eslint-comments-disable-enable-pair',
    waitsAs: 'recommended',
    heldBy: COMMENT_RULES_IN_EDITORS,
  },
  '@eslint-community/eslint-comments/no-duplicate-disable': {
    card: 'rc-eslint-community-eslint-comments-no-duplicate-disable',
    waitsAs: 'recommended',
    heldBy: 'q-lint-rc-duplicate-disable-measured',
  },
  '@eslint-community/eslint-comments/require-description': {
    card: 'rc-eslint-community-eslint-comments-require-description',
    waitsAs: 'recommended',
    heldBy: COMMENT_RULES_IN_EDITORS,
  },
  '@tanstack/query/exhaustive-deps': { card: 'rc-tanstack-query-exhaustive-deps', waitsAs: 'recommended' },
  '@tanstack/query/infinite-query-property-order': { card: 'rc-tanstack-query-infinite-query-property-order', waitsAs: 'recommended', heldBy: 'q-lint-rc-tanstack-property-order-measured' },
  '@tanstack/query/no-rest-destructuring': { card: 'rc-tanstack-query-no-rest-destructuring', waitsAs: 'recommended' },
  '@tanstack/query/no-unstable-deps': { card: 'rc-tanstack-query-no-unstable-deps', waitsAs: 'recommended' },
  '@tanstack/query/no-void-query-fn': { card: 'rc-tanstack-query-no-void-query-fn', waitsAs: 'recommended' },
  '@tanstack/query/stable-query-client': { card: 'rc-tanstack-query-stable-query-client', waitsAs: 'recommended', heldBy: 'q-lint-rc-stable-query-client-fix-measured' },
  '@tanstack/router/create-route-property-order': { card: 'rc-tanstack-router-create-route-property-order', waitsAs: 'recommended', heldBy: 'q-lint-rc-tanstack-property-order-measured' },
  '@tanstack/router/route-param-names': { card: 'rc-tanstack-router-route-param-names', waitsAs: 'recommended' },
  'anti-slop-effect/no-manual-effect-error-tag': { card: 'rc-anti-slop-effect-no-manual-effect-error-tag', waitsAs: 'recommended', heldBy: 'q-lint-effect-ruleset-name' },
  'compat/compat': { card: 'rc-compat-compat', waitsAs: 'recommended', heldBy: 'q-lint-compat-default-target' },
  'drizzle-security/no-unsafe-query': { card: 'rc-drizzle-security-no-unsafe-query', droppedBy: DRIZZLE_ADVISORY },
  'drizzle-security/no-unscoped-mutation': { card: 'rc-drizzle-security-no-unscoped-mutation', droppedBy: DRIZZLE_ADVISORY },
  'e18e/prefer-get-or-insert': { card: 'rc-e18e-prefer-get-or-insert', waitsAs: 'parked' },
  'e18e/prefer-throw-if-no-entry': { card: 'rc-e18e-prefer-throw-if-no-entry', waitsAs: 'recommended' },
  'hydration-proof/no-browser-global-in-render': { card: 'rc-hydration-proof-no-browser-global-in-render', waitsAs: 'recommended', heldBy: REACT_SSR_IN_CLIENT_APPS },
  'hydration-proof/no-locale-without-explicit-locale': { card: 'rc-hydration-proof-no-locale-without-explicit-locale', waitsAs: 'recommended', heldBy: REACT_SSR_IN_CLIENT_APPS },
  'hydration-proof/no-storage-in-initial-render': { card: 'rc-hydration-proof-no-storage-in-initial-render', waitsAs: 'recommended', heldBy: REACT_SSR_IN_CLIENT_APPS },
  'hydration-proof/no-timezone-without-explicit-timezone': {
    card: 'rc-hydration-proof-no-timezone-without-explicit-timezone',
    waitsAs: 'recommended',
    heldBy: REACT_SSR_IN_CLIENT_APPS,
  },
  'hydration-proof/no-window-render-branch': { card: 'rc-hydration-proof-no-window-render-branch', waitsAs: 'recommended', heldBy: REACT_SSR_IN_CLIENT_APPS },
  'hydration-proof/require-stable-server-snapshot': { card: 'rc-hydration-proof-require-stable-server-snapshot', waitsAs: 'recommended', heldBy: REACT_SSR_IN_CLIENT_APPS },
  'jest-dom/prefer-checked': { card: 'rc-jest-dom-prefer-checked', waitsAs: 'recommended', heldBy: JEST_DOM_WITHOUT_JEST_DOM },
  'jest-dom/prefer-empty': { card: 'rc-jest-dom-prefer-empty', waitsAs: 'recommended', heldBy: JEST_DOM_WITHOUT_JEST_DOM },
  'jest-dom/prefer-in-document': { card: 'rc-jest-dom-prefer-in-document', waitsAs: 'recommended', heldBy: JEST_DOM_WITHOUT_JEST_DOM },
  'jest-dom/prefer-pressed': { card: 'rc-jest-dom-prefer-pressed', waitsAs: 'recommended', heldBy: JEST_DOM_WITHOUT_JEST_DOM },
  'jest-dom/prefer-required': { card: 'rc-jest-dom-prefer-required', waitsAs: 'recommended', heldBy: JEST_DOM_WITHOUT_JEST_DOM },
  'jest-dom/prefer-to-have-attribute': { card: 'rc-jest-dom-prefer-to-have-attribute', waitsAs: 'recommended', heldBy: JEST_DOM_WITHOUT_JEST_DOM },
  'jest-dom/prefer-to-have-class': { card: 'rc-jest-dom-prefer-to-have-class', waitsAs: 'recommended', heldBy: JEST_DOM_WITHOUT_JEST_DOM },
  'playwright/no-duplicate-slow': { card: 'rc-playwright-no-duplicate-slow', waitsAs: 'recommended' },
  'playwright/no-element-handle': { card: 'rc-playwright-no-element-handle', waitsAs: 'recommended' },
  'playwright/no-focused-test': { card: 'rc-playwright-no-focused-test', waitsAs: 'recommended', heldBy: PLAYWRIGHT_VITEST_TWINS },
  'playwright/no-identical-title': { card: 'rc-playwright-no-identical-title', waitsAs: 'recommended', heldBy: PLAYWRIGHT_VITEST_TWINS },
  'playwright/no-networkidle': { card: 'rc-playwright-no-networkidle', waitsAs: 'recommended' },
  'playwright/no-unnecessary-assertions': { card: 'rc-playwright-no-unnecessary-assertions', waitsAs: 'recommended', heldBy: 'q-lint-rc-unnecessary-assertions-measured' },
  'playwright/no-wait-for-selector': { card: 'rc-playwright-no-wait-for-selector', waitsAs: 'recommended' },
  'playwright/prefer-hooks-on-top': { card: 'rc-playwright-prefer-hooks-on-top', waitsAs: 'recommended', heldBy: PLAYWRIGHT_VITEST_TWINS },
  'playwright/prefer-web-first-assertions': { card: 'rc-playwright-prefer-web-first-assertions', waitsAs: 'recommended', heldBy: 'q-lint-rc-web-first-assertions-measured' },
  'playwright/require-to-pass-timeout': { card: 'rc-playwright-require-to-pass-timeout', waitsAs: 'recommended' },
  'playwright/require-to-throw-message': { card: 'rc-playwright-require-to-throw-message', waitsAs: 'recommended', heldBy: PLAYWRIGHT_VITEST_TWINS },
  'playwright/valid-test-tags': { card: 'rc-playwright-valid-test-tags', waitsAs: 'recommended' },
  'prefer-named-capture-group': { card: 'rc-prefer-named-capture-group', waitsAs: 'recommended' },
  'shadcn/no-raw-colors': { card: 'rc-shadcn-no-raw-colors', waitsAs: 'recommended' },
  'sonarjs/prefer-native-axios-alternative': { card: 'rc-sonarjs-prefer-native-axios-alternative', waitsAs: 'recommended' },
  'unicorn/no-repeated-call-wrappers': { card: 'rc-unicorn-no-repeated-call-wrappers', waitsAs: 'recommended' },
  'unicorn/no-unnecessary-default-arguments': { card: 'rc-unicorn-no-unnecessary-default-arguments', droppedBy: 'q-lint-rc-default-args-measured' },
  'unicorn/prefer-iterator-zip': { card: 'rc-unicorn-prefer-iterator-zip', waitsAs: 'parked' },
  'unicorn/prefer-logical-operator-over-ternary': { card: 'rc-unicorn-prefer-logical-operator-over-ternary', waitsAs: 'recommended' },
  'unicorn/prefer-uint8array-hex': { card: 'rc-unicorn-prefer-uint8array-hex', waitsAs: 'parked' },
  'zod/no-coerce-boolean': { card: 'rc-zod-no-coerce-boolean', waitsAs: 'recommended' },
  'zod/no-conflicting-checks': { card: 'rc-zod-no-conflicting-checks', waitsAs: 'recommended' },
  'zod/no-duplicate-schema-methods': { card: 'rc-zod-no-duplicate-schema-methods', waitsAs: 'recommended' },
  'zod/no-empty-custom-schema': { card: 'rc-zod-no-empty-custom-schema', waitsAs: 'recommended' },
  'zod/no-optional-and-default-together': { card: 'rc-zod-no-optional-and-default-together', waitsAs: 'recommended' },
  'zod/no-throw-in-refine': { card: 'rc-zod-no-throw-in-refine', waitsAs: 'recommended' },
  'zod/no-transform-in-record-key': { card: 'rc-zod-no-transform-in-record-key', waitsAs: 'recommended' },
  'zod/prefer-trim-before-string-length-checks': { card: 'rc-zod-prefer-trim-before-string-length-checks', waitsAs: 'recommended', heldBy: 'q-lint-rc-zod-trim-fix-measured' },
  'zod/require-brand-type-parameter': { card: 'rc-zod-require-brand-type-parameter', waitsAs: 'recommended' },
}
