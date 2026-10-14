# Rule candidates, round 1 (2026-10-10)

Sources searched: the anti-slop plugins (dmmulroy/anti-slop and its forks, eslint-plugin-slop,
no-comment-slop, deslop, ts-slop, ai-guard, ai-deslop, human-first, ui anti-slop), ultracite and
antfu's `antislop` config, `@shadcn/lint` 0.2.1, and a broad sweep: rules our installed plugins
added since the gate, the "high-consensus" list, and unshipped core/unicorn/typescript-eslint rules.

**Outcome:** 55 rules pass your criteria. None needs a new dependency. 20 of them found real code
in the corpus; the other 35 are proven by a fixture and had 0 corpus hits, and most of those guard
runtime bugs.
One rule (reduce-accumulator copy) needs a house port. 14 items need your call, and the biggest of
them is `shadcn/no-arbitrary-values` (a new Tailwind ruleset).

**How measured.** Every rule fired on a bad fixture, stayed silent on a good one, and was run
through our shipped config to show nothing already reports it. The untyped corpus was the 12
ReactBench workspaces plus up to 32 other `~/dev` repos, never `~/dev/cli`: about 8,400 to 8,700
JS/TS files. Typed rules ran on 5 workspaces with dependencies installed (4,079 files), so their
volumes are lower bounds. **Hits** count authored code; built and vendored bundles are left out
unless stated. **False positives (FP)** are hits read in source that a competent developer would
defend, given as "FP of hits read". Fatal errors were checked on every run. The only one was a Flow
file in brainly.

## 1. Adopt

Defaults unless options are given. Engine: "oxlint" means oxlint has the rule natively; "ESLint
typed" needs type information.

### correctness

| Rule | Catches | Engine | Hits | FP | Options / notes |
| --- | --- | --- | --- | --- | --- |
| `no-empty` | Empty blocks, including `catch {}`. A comment inside the block satisfies it. | oxlint | 3 in 1 repo (+274 in bundles) | 0 of 3 | The shipped autofix `unicorn/prefer-optional-catch-binding` turns a reported `catch (e) {}` into `catch {}`, which nothing reports today. |
| `sonarjs/no-duplicated-branches` | Two if/else or switch branches with the same body | ESLint | 22 in 15 files, 5 repos (+31 in bundles) | 2 of 22 (9%): per-case comments; symmetric clamps | Put it beside `sonarjs/no-all-duplicated-branches` (correctness, low confidence, alternative redundancy) and move the two together. One-line blocks are exempt by design. Suppressions are banned, so the 2 accepted FPs would have to be rewritten. |
| `radix` | `parseInt(x)` with no radix (`'0x10'` parses as hex) | oxlint | 47 in 24 files, 5 repos | 0 of 15 | |
| `accessor-pairs` | A setter with no getter, so reads return undefined | oxlint | 11 in 1 repo | 3 of 11 (27%): write-only canvas stubs in test doubles | Ship with test-file `ignores`. It double-reports a subclass setter with `unicorn/no-incomplete-accessor-override`. |
| `no-sequences` | The comma operator (`return (x += a), x`) | oxlint | 1 | 0 of 1 | `no-unused-expressions` already covers the statement form. |
| `unicorn/no-unused-builtin-method-return` | A `.map()` result thrown away; `.some()` used as a loop | ESLint | 5 | 0 of 5 | `sonarjs/no-ignored-return` overlaps only on TS mutable arrays. |
| `unicorn/prefer-escaped-irregular-whitespace` | An invisible NBSP or zero-width character in a string | ESLint | 6 | 0 of 6 | The shipped `no-irregular-whitespace` skips strings. |
| `no-self-compare` | `x !== x` | oxlint | 0 | – | |
| `no-case-declarations` | `const`/`let` directly in a `case` (TDZ across cases) | oxlint | 0 | – | |
| `no-new-wrappers` | `new String()`, `new Number()` | oxlint | 0 | – | The gate recorded this hole. |
| `no-array-constructor` | `Array(a, b)`, `new Array(1, 2, 3)` | oxlint | 0 | – | `unicorn/no-new-array` covers only `new Array(n)`. |

Runtime-bug rules from unicorn 77 (ESLint, 0 corpus hits; nothing shipped fires on any of their fixtures):

| Rule | Catches |
| --- | --- |
| `unicorn/no-async-iterator-callback` | An async callback to `Iterator#filter/some/find/…`; the promises are never awaited |
| `unicorn/no-conflicting-constraints` | `<input min={10} max={5}>` (the CSS half needs a CSS language) |
| `unicorn/no-incomplete-accessor-override` | A subclass setter that hides the inherited getter |
| `unicorn/no-invalid-intl-options` | Conflicting or missing Intl options (`style: 'currency'` without `currency`) |
| `unicorn/no-invalid-property-descriptor` | `get` mixed with `value`/`writable` (throws) |
| `unicorn/no-invalid-response-options` | `new Response('', { status: 204 })` (throws) |
| `unicorn/no-invalid-temporal-arithmetic` | `Temporal.Instant.add({ days })` (throws) |
| `unicorn/no-invalid-url-protocol-comparison` | `url.protocol === 'https'` (always false) |
| `unicorn/no-unsafe-json-serialization` | `JSON.stringify` of a Set or Map (gives `{}`) or a BigInt (throws) |
| `unicorn/no-unused-iterator-helper` | A lazy iterator helper that is never consumed, so it never runs |
| `unicorn/no-url-in-search-params` | `new URLSearchParams('https://…?q=1')` |
| `unicorn/no-using-resource-escape` | Returning a `using` resource, which is already disposed |
| `unicorn/require-text-decoder-streaming` | `decode(chunk)` without `{ stream: true }`, which splits multibyte characters |

### type-safety

| Rule | Catches | Engine | Hits | FP | Options / notes |
| --- | --- | --- | --- | --- | --- |
| `@typescript-eslint/use-unknown-in-catch-callback-variable` | `.catch((e) => …)` without `e: unknown` | ESLint typed | 80 | 0 of 10 | The shipped prefer-await rules already push most of these sites to `await`. |
| `@typescript-eslint/no-namespace` | `namespace X {}` | oxlint | 0 | – | Pairs with the enum ban: both forbid syntax that does not erase. |
| `@typescript-eslint/no-unsafe-enum-assignment` | A number or string assigned to an enum type | ESLint typed | 4 | 0 of 4 | All 4 are also reported by `no-unsafe-type-assertion`. The unique form (no cast) had 0 hits. Low value: only library enums are left. |

### security / accessibility / react / browser

| Rule | Ruleset | Catches | Engine | Hits | FP |
| --- | --- | --- | --- | --- | --- |
| `unicorn/no-ineffective-csp-directives` | security | `frame-ancestors`/`sandbox`/`report-uri` in a `<meta>` CSP, which the browser ignores | ESLint | 0 | – |
| `unicorn/no-invalid-integrity` | security | A malformed SRI `integrity` value | ESLint | 0 | – |
| `jsx-a11y/anchor-ambiguous-text` | accessibility | `<a>Click here</a>` | oxlint | 1 | 0 of 1 |
| `sonarjs/no-debounce-throttle-in-render` | react | A lodash debounce/throttle created in a component body, so the timer resets on every render | ESLint | 0 | – |
| `unicorn/no-invalid-boolean-attribute-value` | browser | `setAttribute('disabled', 'false')`, which still disables | ESLint | 0 | – |
| `unicorn/no-invalid-dom-token` | browser | `classList.add('a b')` (throws) | ESLint | 0 | – |
| `unicorn/no-invalid-style-set-property` | browser | `style.setProperty('backgroundColor', …)` (silent no-op) | ESLint | 0 | – |
| `unicorn/no-prevent-default-in-passive-listener` | browser | `preventDefault` in a passive listener, where it has no effect | ESLint | 0 | – |

### performance

| Rule | Catches | Engine | Hits | FP | Options / notes |
| --- | --- | --- | --- | --- | --- |
| House port of `anti-slop/no-reduce-accumulator-copy` | A reducer that copies its accumulator each step (`acc.concat`, `slice`, `Array.from`, `toSorted`), which is quadratic | ESLint (house) | 1 (+25 in bundles) | 0 of 1 authored; 1 of 21 overall | It closes the last hole beside `oxc/no-accumulating-spread` and `unicorn/no-array-concat-in-loop`, and the spread rule's own help text recommends `concat`. It has to be a port: the upstream code misses named reducers under typescript-eslint (it compares an oxlint-only `.start`, so use `range`). Its advice ("mutate the accumulator") is banned by `functional/immutable-data`, so the message must point to `flatMap`, `map` or `Object.fromEntries`. Consider upstream PR #51's array-receiver guard. |

### immutability

| Rule | Catches | Engine | Hits | FP |
| --- | --- | --- | --- | --- |
| `@typescript-eslint/prefer-readonly` | A private class member that is never reassigned | ESLint typed | 191 | 0 of 10 |

### modern-js

| Rule | Catches | Engine | Hits | FP | Options / notes |
| --- | --- | --- | --- | --- | --- |
| `unicorn/prefer-at` | `a[a.length - 1]` | oxlint | 275 | 0 of 16 | The fix types the result `T \| undefined`, which can surface tsc errors. That is your "no silent fallbacks" rule working. |
| `@typescript-eslint/prefer-string-starts-ends-with` | `/^x/.test(s)`, `s.indexOf('x') === 0`, `s[0] === '#'`, `slice(-2) === 'px'` | ESLint typed | 14 | 0 of 14 | Ship only this version. It covers the unicorn twin's regex form, so adding both would report it twice. |
| `prefer-object-has-own` | `Object.prototype.hasOwnProperty.call` | oxlint | 22 | 0 of 22 | Autofixes. |
| `no-object-constructor` | `new Object()` | oxlint | 0 | – | |
| `unicorn/prefer-temporal-conversion` | `Temporal.Instant.from(zoned)` instead of `zoned.toInstant()` | ESLint | 0 | – | It fires only on code that already uses Temporal. |

### redundancy

| Rule | Catches | Engine | Hits | FP | Options / notes |
| --- | --- | --- | --- | --- | --- |
| `no-useless-assignment` | A dead store (an initial value overwritten before it is read) | oxlint | 70 in 54 files, 6 repos | 0 of 14 | `sonarjs/no-dead-store` also reports 17 of the 70, so those are duplicate reports (questions.md #13). It misses call initialisers. |
| `unicorn/prefer-single-call` | Consecutive `arr.push()` calls | oxlint | 482 (204 in one code generator) | 0 of 12 | The gate recorded this as a coverage hole. `functional/immutable-data` flags the same lines for a different defect. |
| `unicorn/no-useless-set-construction` | `set.union(new Set(other))` | ESLint | 0 | – | |
| `@typescript-eslint/no-unnecessary-qualifier` | `Ns.X` used inside namespace `Ns` | ESLint typed | 0 | – | Nearly moot once `no-namespace` ships. |

### conventions

| Rule | Catches | Engine | Hits | FP | Options / notes |
| --- | --- | --- | --- | --- | --- |
| `@typescript-eslint/consistent-type-imports` | A value import used only as a type | oxlint | 3,274 in 1,806 files, 24 of 33 repos | 2 of 20 at defaults, both removed by the option | `{ disallowTypeAnnotations: false }` (the 330 inline `import('./x').T` hits). The gate's reason for turning it off ("Oxfmt owns it") is false. The fix trips `import-x/order`, and `oxlint --fix` followed by `eslint --fix` ends clean. Repos with `verbatimModuleSyntax` have 0 hits. |
| `@typescript-eslint/consistent-type-exports` | A type re-exported as a value | ESLint typed | 7 | 0 of 7 | |
| `@typescript-eslint/dot-notation` | `obj['key']` where `obj.key` works | ESLint typed | 5 | 0 of 5 | `{ allowPrivateClassPropertyAccess: true, allowProtectedClassPropertyAccess: true }`. Never core `dot-notation`. |
| `symbol-description` | `Symbol()` with no description | oxlint | 0 | – | |
| `unicorn/prefer-literal-ascii` | `'\x41'` instead of `'A'` | ESLint | 0 (2,877 in minified bundles) | – | It converges with `unicorn/no-hex-escape` (fix order checked). |

### tests

| Rule | Catches | Engine | Hits |
| --- | --- | --- | --- |
| `sonarjs/no-empty-parameterized-test-dataset` | `it.each([])`: the body never runs | ESLint | 0 |
| `sonarjs/synchronous-exception-assertions` | `expect(async () => …)` with `.toThrow()`, which always fails, or `.not.toThrow()`, which always passes | ESLint typed | 0 |
| `sonarjs/composite-assertions` | `expect(a && b).toBeTruthy()`, which hides which condition failed | ESLint | 0 |
| `sonarjs/no-duplicate-parameterized-test-case` | Duplicate rows in `it.each` | ESLint | 0 |

## 2. Needs your call

| Item | Trade-off | Recommendation |
| --- | --- | --- |
| `shadcn/no-arbitrary-values` (new dependency `@shadcn/lint` 0.2.1, pre-1.0, released today) | Catches magic values in Tailwind classes (`p-[13px]`, `bg-[#333]`): 857 hits, 2.2% clear FP (3.4% counting debatable ones). But 78% of the Tailwind v4 hits are off-scale sizes (`text-[10px]` ×189) whose fix is a new theme token. It supports Tailwind v4 only: on v3, 51 of 201 "same value" suggestions are wrong. It needs a new user-visible libs ruleset, an ignore for `**/components/ui/**`, and theme-load errors reach stderr only. | Adopt if off-scale sizes count as magic numbers, which your "no magic numbers" rule suggests: `["error", { allow: ["layout", "*-[var(*"] }]`, in a Tailwind-v4 ruleset that you name. |
| `no-unreachable-loop` | Its only 2 hits are `for (const [, p] of nodes()) return p`, which takes the first item. One verifier calls them true (`const [first] = iterable` is the declarative form); the other calls them defensible. `ignore: ['ForOfStatement']` would gut it now that `for…of` is the only loop left. | Adopt at defaults. |
| `no-console` | 1,452 hits in 28 of 33 repos. 24 of 30 random hits are FP (scripts, CLIs, servers, gated dev warnings). Even narrowed to log/debug in app paths, 8 of 20 are. | Don't ship. If you want it: `allow: ['warn', 'error']`, and consumers turn it off per path with `fileOverrides`. |
| `@typescript-eslint/promise-function-async` | 288 hits. 10 of 10 plain hits are true (a non-async function returning a promise). 46 (16%) are React render callbacks, flagged because React 19's `ReactNode` includes `Promise`; no option removes them, only an explicit return type. | Hold until there is an option for that, or until you accept annotating render callbacks. |
| `@typescript-eslint/prefer-includes` | Its only unique form is `/foo/.test(s)` (2 true hits). It cannot drop its `indexOf` half, so every `unicorn/prefer-includes` site would be reported twice. | Skip. |
| `unicorn/prefer-json-import` | 6 hits, 1 FP. The fix needs import attributes and `resolveJsonModule`, close to your "migration rule" rejection of `unicorn/prefer-module`. | Reject, on that precedent. |
| `sonarjs/prefer-native-axios-alternative` | 2 true hits (deprecated `CancelToken`). axios's types don't mark it deprecated, so `no-deprecated` misses it. There is no axios ruleset. | Hold: one rule does not justify a new libs ruleset. |
| `@eslint-community/eslint-comments` `require-description`, `disable-enable-pair`, `no-duplicate-disable` (new plugin) | 600 / 104 / 1 hits. Your suppression ban (`house/no-suppressions`) will report all of them once built. These matter only to a consumer who turns the ban off. | Drop. Re-check after `house/no-suppressions` lands. |
| `llm-core/no-redundant-comments` (new single-author plugin) | It matches your "comments only where unintuitive" rule: 18 of 25 hits narrate the next line. But 7 of 25 (28%) are intent or domain comments. | Reject at that FP rate. |
| `react-google-translate/no-conditional-text-nodes-with-siblings` (new plugin, 1.1.0, published 2026-10-09) | A real crash: Google Translate wraps text nodes and React's `removeChild` throws. 321 hits; of 14 read, 6 are crash shapes, 3 stale text and 5 FP (36%, text that always renders). | Not now; re-measure when it matures. |
| `e18e/prefer-throw-if-no-entry` (new plugin) | It replaces a `statSync` try/catch with `{ throwIfNoEntry: false }`. 0 hits. Every other e18e rule is covered or rejected. | Skip: a new dependency for one rule. |
| `unicorn/prefer-uint8array-hex` (42 hits), `unicorn/prefer-iterator-zip` (2), `e18e/prefer-get-or-insert` | Their fixes write APIs that Node 22.23 lacks (measured). | Add them to the parked Node-22 list in questions.md. |
| `anti-slop/require-safety-comment-for-type-assertion` | It requires a `// SAFETY:` comment on every cast: 10,095 hits. Of 12 read, 8 are unsafe casts that `no-unsafe-type-assertion` already reports, and 4 (33%) are safe casts. It is broken under ESLint and would need a port. | Reject: the unsafe half is covered, and the rest is policy. |
| `anti-slop-effect/*` (5 rules) | Effect-library conventions. No corpus repo uses Effect, and `prefer-effect-match` still fired 152 times on non-Effect code. | No, unless you want an Effect libs ruleset. |

## 3. Rejected or already covered

### Already covered (a shipped rule fires on the same lines, run through our config)

| Candidate | Covered by |
| --- | --- |
| `anti-slop/no-chained-type-assertions`, `slop/no-chained-type-assertions` | `@typescript-eslint/no-unsafe-type-assertion` (4 of 4 fixture shapes) |
| `anti-slop/no-conditional-empty-object-spread` | `unicorn/consistent-conditional-object-spread` (after its fix, anti-slop is silent) |
| `anti-slop/no-unknown-type-aliases`, `slop/no-trivial-type-aliases`, `ai-deslop/no-pass-through-type-alias` | `sonarjs/redundant-type-aliases` |
| `anti-slop/no-widen-then-assert` | `no-unsafe-type-assertion` (0 hits; never fires under ESLint anyway) |
| `slop/no-static-only-class` | `@typescript-eslint/no-extraneous-class`, `functional/no-classes` |
| `no-comment-slop/no-banner-comment` | `house/no-section-banner` (135 of 136 distinct corpus banners; the miss is not a banner) |
| `ts-slop/{no-as-any, no-redundant-boolean-if, no-ts-ignore-without-description, no-useless-try-rethrow, no-sort-then-reverse}` | `no-explicit-any`; `unicorn/prefer-boolean-return`; `ban-ts-comment`; `no-useless-catch`; `unicorn/no-array-sort` + `no-array-reverse` |
| `ai-guard` copies (`no-catch-without-use`, `no-async-array-callback`, `no-floating-promise`, `no-await-in-loop`, `no-redundant-await`, `no-dead-branch`, `no-unsafe-deserialize`, `no-eval-dynamic`) | `no-unused-vars`/`sonarjs/no-ignored-exceptions`; `no-misused-promises`; `no-floating-promises`; `no-await-in-loop`; `return-await`; `no-unnecessary-condition`; `no-unsafe-assignment`; `no-eval` |
| `sonarjs/{no-redundant-jump, prefer-single-boolean-return, no-identical-conditions, no-gratuitous-expressions, no-redundant-boolean}` | `no-useless-return`/`unicorn/no-useless-continue`; `unicorn/prefer-boolean-return`; `no-dupe-else-if`; `no-unnecessary-condition`; `unicorn/no-unnecessary-boolean-comparison` |
| `unused-imports/no-unused-imports` | `no-unused-vars` (only the autofix differs) |
| `github/{async-currenttarget, async-preventdefault, require-passive-events}` | `unicorn/no-late-current-target-access`, `no-late-event-control`, `require-passive-events` |
| `@typescript-eslint/method-signature-style` | `functional/prefer-property-signatures` (209 of 209 lines) |
| `no-new-func` | `@typescript-eslint/no-implied-eval` |
| `no-undef-init` | `sonarjs/no-undefined-assignment` (11 of 11) |
| `eslint-comments/no-unlimited-disable` | `unicorn/no-abusive-eslint-disable` (147 of 147) |
| `unicorn/prefer-promise-static-methods` | `sonarjs/prefer-promise-shorthand` |
| `sonarjs/avoid-mutating-nested-properties-of-shallow-clones` | `functional/immutable-data` |
| `sonarjs/testing-library-query-assertion`, `testing-library-prefer-query-by-disappearance`, `vitest-mock-at-module-scope` | `testing-library/prefer-presence-queries` (9 of 9), `prefer-query-by-disappearance`, `vitest/hoisted-apis-on-top` (76 of 76) |
| `e18e` modernisation rules (11) | The matching unicorn/core rule, one fixture each |
| `consistent-return` (core) | `@typescript-eslint/consistent-return` |
| `no-unsanitized/property` | `unicorn/no-unsafe-dom-html` (23 of 23). `no-unsanitized/method`'s 10 unique hits are all `import(variable)` FPs. |

### Rejected (false positives measured, or taste)

| Candidate | Evidence |
| --- | --- |
| `anti-slop/no-runtime-typeof` | 16 of 20 FP (80%): typeof narrowing a declared union |
| `anti-slop/no-unknown-parameters` | 18 of 20 (90%): parse boundaries, error handlers |
| `anti-slop/no-unknown-returns` | 11 of 12: ignored callback returns, stubs |
| `anti-slop/no-unsafe-dictionary-type` | 12 of 15 (80%): `isRecord` guards, props bags |
| `anti-slop/no-known-value-widening` | 13 of 15: inline return types, deliberate lookup tables |
| `anti-slop/no-object-parameters` | 9 of 12 (75%): generic helpers, DOM-mirroring types |
| `anti-slop/no-array-filter-map` | 12 of 12 standard idiom; the fix needs ES2025 iterator helpers |
| `anti-slop/no-module-mocking` | A testing philosophy; 814 hits include third-party modules nothing can inject |
| `anti-slop/no-shape-in-symbol-names` | A word ban; 1,500 hits, mostly domain words (`ShapeItem`) |
| `anti-slop/no-reflect-apply` | 0 hits; fix loop with shipped `unicorn/prefer-reflect-apply` |
| `anti-slop/no-reflect-get` | 1 of 1 FP (a Proxy `get` trap) |
| `anti-slop/require-readable-spacing` | Whitespace, the formatter's job (the @stylistic precedent) |
| `slop/no-em-dash`, `slop/no-jargon` (+ no-comment-slop twins) | Prose taste; `robust` is mostly statistical |
| `slop/max-comment-length`, `no-comment-slop/max-comment-lines` | 5 of 5 sampled were why-notes |
| `slop/no-trivial-functions` | 9 of 12 (75%): named predicates and accessors |
| `slop/prefer-jsdoc`, `no-comment-slop/prefer-jsdoc-*` | 5 of 8: group labels turned into JSDoc on one declaration |
| `no-comment-slop/{no-trailing-comment, no-trailing-period, no-prose-semicolon, multiline-jsdoc-format, require-member-docs, no-foreign-syntax}` | Prose and formatting taste; doc completeness was already rejected with eslint-plugin-jsdoc |
| `deslop/no-obvious-comments` | 10 of 12 (83%); its autofix deletes why-comments |
| `ts-slop/no-narrator-comments` | ~10 of 10: Given/When/Then markers |
| `ts-slop/no-default-fallback-catch` | 12 of 15 (80%): handled sentinels, parse-or-null |
| `ts-slop/no-identity-passthrough` | ~8 of 16: `.filter(x => x)` is a truthiness filter |
| `ts-slop/{no-await-query-in-map, no-string-concat-in-reduce}` | False premises: `Promise.all(map(async))` is parallel; V8 concat is not quadratic |
| `ts-slop/no-catch-log-continue`, `llm-core/no-swallowed-errors` | 4 of 10 (40%) and 6 of 14 (43%): best-effort paths |
| `ai-guard/no-async-without-await`, `@typescript-eslint/require-await` | 10 of 15 (67%) and 8 of 14 (57%): async mocks, deliberate promise wrappers |
| `ai-guard/{no-broad-exception, no-catch-log-rethrow, no-duplicate-logic-block, no-hardcoded-secret}` | Flags `catch (e: unknown)`; 5 of 6; 10 of 10; fake test tokens |
| `ai-deslop/{no-call-only-assertions, no-constant-substring-tests}` | 8 of 12; 5 of 5 |
| `ai-deslop/{no-renamed-imports, no-duplicate-types, no-duplicate-consts}` | 14 of 15 (SVGR needs renames); cross-file state breaks caching |
| `human-first/{no-magic-numbers, no-comments}` | 15 of 15 sampled were test data; taste |
| `ui-anti-slop/require-reduced-motion` | At least 25% FP by definition (`transition-colors` is not motion); barely maintained |
| `ui-anti-slop/no-useless-memo` and design/copy rules | 8 of 10 (stable identity is needed); taste |
| `sonarjs/no-inverted-boolean-check` | Every authored hit is a `!(x > 0)` NaN guard, and its autofix changes behaviour |
| `shadcn/no-raw-colors` | 18 of 20 (90%): status, brand and SVG colours with no token; the SVG check cannot be turned off |
| `shadcn/no-inline-styles` | 8 of 20 (40%): runtime geometry; its own fix trips 3 shipped rules |
| `shadcn/no-unknown-classes` | 60 of 61: marker classes used as selectors, stylesheets outside the Tailwind graph |
| `shadcn/no-restyle` | 13 of 15: normal `className` customisation; needs per-project contracts |
| `shadcn/require-static-classes` | 14 of 14: class constants, lookup tables, forwarded props |
| `@typescript-eslint/prefer-nullish-coalescing` | 7 of 25 clear + 7 ambiguous; 8 of 20 even with booleans ignored |
| `@typescript-eslint/no-confusing-void-expression` | 35 of 36: arrow-shorthand handlers; the remainder is covered by `sonarjs/no-use-of-empty-return-value` |
| `no-template-curly-in-string` | 4 of 5 (one real bug: appflowy `notify.error('… ${categoryId} …')`) |
| `no-multi-assign` | 3 of 5: increment-and-capture, Bun HMR template |
| `no-script-url` | 6 of 6: security tests feeding sanitizers |
| `unicorn/no-useless-undefined` | 10 of 20; its autofix trips `consistent-return` and `functional/no-return-void` |
| `unicorn/no-unnecessary-parameters` | 9 of 14: test-helper defaults, general utilities |
| `unicorn/prefer-short-escape-sequences`, `yoda`, `unicorn/prefer-combined-guards`, `de-morgan/*` | Taste |
| `unicorn/no-leading-empty-lines` | Whitespace |
| `e18e/prefer-static-collator` | 60 of 60: the premise is false; single-argument `localeCompare` beat a hoisted collator on Node 22.23 (14.8 vs 38.0 ms) |
| `e18e/ban-dependencies`, `e18e/no-delete-property`, e18e micro-perf rules | Migration policy; the fix changes semantics; taste (3 of them crash ESLint without types) |
| `llm-core/{no-llm-artifacts, no-unbounded-promise-all}` | 8 of 8; flags every `Promise.all` over a map |
| `github/{unescaped-html-literal, prefer-observers, filenames-match-regex}` | 5 of 6; advisory; naming taste (`check-file` owns naming). The plugin also crashes ESLint on one corpus file. |
| `sonarjs` jQuery/Vue/Cypress rules | No such ruleset; not in the corpus |

## 4. Not measured, and why

| Item | Why not |
| --- | --- |
| ai-guard server rules (`no-sql-string-concat`, `require-auth-middleware`, `require-authz-check`, `no-console-in-handler`) | 0 hits in a frontend corpus; they need a Node/Express corpus. Also the shipped `sonarjs/sql-queries` stayed silent on the SQL fixture, so check it for a hole. |
| `eslint-plugin-playwright`, `sonarjs/no-networkidle-wait` | They need a Playwright libs ruleset that you name. The gate's rejection reason ("no Playwright in the corpus") is false: appflowy has `playwright/e2e`. |
| `languages` plugins (`@eslint/json`, `@eslint/markdown`, `eslint-plugin-package-json`, `eslint-cssicorn`) and unicorn's JSON/CSS/Markdown rules | The `languages` list is empty and has no parsers, so the engines cannot reach these files yet. |
| Dead Tailwind classes (`eslint-plugin-better-tailwindcss/no-unknown-classes`) | A real defect class was found in freecut: 13× `text-destructive-foreground`, plus `ring-dashed` and `r-[6]`, all of which generate no CSS. Measure it on the 2 Tailwind v4 repos. |
| A tuned core `no-magic-numbers` (tests exempt) | Your CLAUDE.md says "no magic numbers"; human-first's version is too blunt. Needs its own pass. |
| `no-implicit-coercion` | Volume only (507 hits); the gate's research filed it as a preference. |
| `@typescript-eslint/parameter-properties` / `erasable-syntax-only` | Volume only (44 hits). TS 5.8's `erasableSyntaxOnly` covers it at compile time. |
| `oxc/bad-bitwise-operator`, `oxc/no-barrel-file` | Flagged as worth a look; the fixture did not trigger the first. |
| `github/{a11y-svg-has-accessible-name, a11y-no-title-attribute, no-inner-html}` | Volume only (175, 172, 58). Probably covered by `unicorn/no-unsafe-dom-html`; not fixture-run. |
| `eslint-plugin-secure-coding`, `eslint-plugin-security` | Not run. |
| Standalone tools neither engine loads (unguard, vibecheck, stop-ai-slop, antislop, vibecop, tscanner, slopless) | Their rules would need porting. |
| The remaining unshipped inventory rules with no triage state | Listed in `candidates/broad/unshipped-status.tsv` (inventory minus `rules.json`, joined to the gate's `rule-triage.json`). Only correctness-flavoured ones were promoted here. |
| Typed-rule volumes | Only 5 workspaces had dependencies installed, so typed hit counts are lower bounds. |

## Corrections to our docs (old → new)

- plan.md "Considered and dropped": anti-slop is "15 rules" → 18 generic + 5 Effect (15 is ultracite's subset). `@shadcn/lint` 0.2.0 → 0.2.1 (same 6 rules, adds Vue/Svelte).
- questions.md #16: `house/no-section-banner` "misses `// ---------- helpers ----------`" → it reports it now (measured on the current dist). The item looks stale.
- Gate (ai-benchmarking, read-only): `consistent-type-imports` off because "Oxfmt owns it" → false (oxfmt only orders imports). plugin-verdicts' Playwright "corpus mismatch" → false.
- Any anti-slop rule must be a house port: several upstream rules read oxlint-only `node.start`/`end`, so under ESLint with typescript-eslint they never fire or always fire.
- This file (2026-10-11), `sonarjs/synchronous-exception-assertions`: `expect(async () => …).toThrow()` "can never fail" → it always fails, and `.not.toThrow()` always passes. Why: an async callback returns a promise instead of throwing (measured with Vitest 5.0.3, a throwing and a non-throwing callback).

## 5. Sources

- dmmulroy/anti-slop: https://github.com/dmmulroy/anti-slop (commit c44ef22), issues https://github.com/dmmulroy/anti-slop/issues/21, /23, /47, /50; PR https://github.com/dmmulroy/anti-slop/pull/51
- Forks: https://github.com/emilioSp/oxlint-anti-slop, https://github.com/tonyedgal/anti-slop, https://github.com/maharshi365/deslop
- https://github.com/antfu/eslint-plugin-slop, https://www.npmjs.com/package/eslint-plugin-slop, https://github.com/antfu/eslint-config (`antislop` config)
- https://github.com/jantimon/eslint-plugin-no-comment-slop, https://github.com/ahxar/eslint-plugin-deslop, https://github.com/AugurCognito/ts_slop
- https://github.com/ai-guard-dev/eslint-plugin-ai-guard (npm repository field), https://dev.to/yashjadhav21/i-built-an-eslint-plugin-zero-config-cli-that-catches-ai-generated-code-slop-1137-downloads-in-4dkm
- https://github.com/olistic/eslint-plugin-human-first, https://github.com/jakyeamos/eslint-plugin-anti-slop
- https://github.com/haydenbleasel/ultracite, https://github.com/github/eslint-plugin-github, https://www.npmjs.com/package/eslint-plugin-unused-imports
- https://github.com/TwoAbove/unguard, https://github.com/yuvrajangadsingh/vibecheck, https://github.com/WhiteBite/stop-ai-slop
- https://blog.compendialabs.org/posts/2026-09-02-dk-eslint-plugin-slop, https://evilmartians.com/chronicles/ten-anti-ai-slop-moves-for-frontend-projects-going-faster-than-humans-can-review
- shadcn: https://registry.npmjs.org/@shadcn/lint, https://github.com/shadcn-ui/lint, https://github.com/shadcn-ui/lint/blob/main/docs/rules.md, https://github.com/shadcn-ui/lint/blob/main/docs/how-it-works.md, https://github.com/shadcn-ui/lint/blob/main/docs/troubleshooting.md, https://github.com/shadcn-ui/lint/releases, https://andrew.ooo/posts/shadcn-lint-agent-first-tailwind-design-system-linter-review/
- https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-empty, https://oxc.rs/docs/guide/usage/formatter/sorting.html, https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html, https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha
- https://github.com/sindresorhus/eslint-plugin-unicorn/tree/v77.0.0/docs/rules, https://sonarsource.github.io/rspec/#/rspec/S9073/javascript, https://sonarsource.github.io/rspec/#/rspec/S9027/javascript
- https://www.npmjs.com/package/@e18e/eslint-plugin, https://www.npmjs.com/package/@eslint-community/eslint-plugin-eslint-comments, https://www.npmjs.com/package/eslint-plugin-no-unsanitized, https://www.npmjs.com/package/eslint-plugin-de-morgan, https://www.npmjs.com/package/eslint-plugin-erasable-syntax-only, https://www.npmjs.com/package/eslint-cssicorn
- https://github.com/pertrai1/eslint-plugin-llm-core, https://www.npmjs.com/package/oxlint-plugin-react-google-translate, https://github.com/facebook/react/issues/11538, https://github.com/ofri-peretz/eslint/releases/tag/release-2026-09-23-d4ff2bd1

Evidence (fixtures, raw hits, scripts) is under `scratchpad/candidates/{anti-slop,shadcn,broad}/`, with
each verifier's work in `verify/`. Example: `anti-slop/verify/dup-sites.txt` holds every authored
duplicate-branch hit.
