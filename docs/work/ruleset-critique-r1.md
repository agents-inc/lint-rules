# Ruleset critique, iteration 1

Inputs: 6 batch audits, where a skeptic checked every proposed move, plus the consumer-lens and prior-art critiques.
Sizes are counted, not estimated: `python3 -I synth/apply.py <scratchpad>` applies `synth/moves-r1.json` to
`rulesets/*.json` and writes `synth/assignment-r1.json`. Nothing in lint-rules or ai-benchmarking was edited.

**Outcome:** 191 of 1,014 rules change ruleset, and none is left unplaced. There would be 27 rulesets: today's 20 plus 7 new.
4 of the new 7 are optional splits; declining all four leaves 23.

## 1. Recommended rulesets

**Precedence, for a rule that passes two tests.** This replaces today's single tie-break.
1. `security`, as long as the rule is silent where its technology is absent.
2. A lib or runtime ruleset, if the rule means nothing without that dependency or runtime. JSX and regex are not
   technologies, so neither gets a ruleset.
3. `accessibility`, because it needs ARIA knowledge.
4. A topic ruleset: `modules`, `naming`, `comments`, `ordering`, `import-order`.
5. A purpose ruleset. Their tests below are written so they do not overlap. Where they do, `correctness` comes first, and
   `modern-js` comes before `redundancy`.
6. `consistency`: the fallback for a convention with no defect, no cost and nothing removable.

| Ruleset | List | Membership test | Size | Change |
| --- | --- | --- | --- | --- |
| correctness | quality | On some reachable input the code crashes, computes a wrong value, silently does nothing, or produces wrong output. Wrong output includes bad Error objects and invalid HTML from JSX. | 218 → 233 | takes the JSX/HTML defects |
| type-safety | quality | The code escapes or weakens TypeScript's checking: `any`, assertions, `@ts-` comments, or a type wider than it looks. | 22 → 22 | one rule out, one in |
| security | quality | The finding is exploitable or leaks a secret, in any runtime or lib. | 52 → 73 | security wins (Q1) |
| accessibility | quality | The rule checks JSX roles, ARIA, labels or keyboard behaviour, and exists only for people using assistive technology or a keyboard. | 42 | – |
| performance | quality | The code is correct, and the rule's only stated objection is avoidable time or memory. | 0 → 10 | **new** |
| modern-js | quality | The code works, and the fix uses a later ECMAScript, TS or web-platform edition, or the standard successor of a deprecated form. | 107 → 83 | narrowed |
| redundancy | quality | The rule objects that code is unneeded or longer than it has to be. Its fix deletes, merges or shortens it within the same edition, and behaviour is identical. | 105 → 125 | gains |
| complexity | quality | The code works and nothing can be removed, but its shape is hard to follow. The fix restructures it: un-nest, return early, or pick a branch construct that fits. | 38 → 24 | narrowed |
| limits | quality | A count in one unit (file, function, parameters, depth, expression, union, regex, try block) exceeds a configured maximum, and the rule prescribes no rewrite. | 0 → 11 | **new**, split from complexity (Q6) |
| declarative | quality | Bans an imperative or object-oriented construct that works correctly: classes, `this`, `let`, loops, bare statements, void functions, any mutation. | 24 → 10 | narrowed |
| immutability | quality | Prefers not reassigning or mutating where a non-mutating form exists (`const`, `toSorted`, no parameter reassignment), without banning a construct. | 0 → 14 | **new**, split from declarative (Q8) |
| consistency | quality | The flagged code has no defect, no cost and nothing removable. The rule's only argument is that a codebase should write this construct one way. | 0 → 28 | **new** |
| modules | quality | Checks an import, export or require statement, what its path resolves to, the package manifest, or the module graph. | 27 → 32 | gains |
| naming | quality | How identifiers, files or folders are named. The program behaves the same under the name the rule asks for. | 14 | – |
| comments | quality | Reads only comment text, and the fix never changes what the compiler or the runtime sees. | 8 | – |
| ordering | quality | Its only demand is the textual order of sibling items other than imports and exports. The fix only moves code. | 27 → 22 | narrowed |
| import-order | quality | The same as ordering, for import and export statements and their specifiers. | 0 → 7 | **new**, split from ordering (Q7) |
| react | libs.ui | The finding depends on React's API or model: hooks, components, props, children, key, ref, state, effects, context, lifecycle, the Compiler, react-dom, or React's DOM prop names. | 148 → 120 | narrowed |
| react-perf | libs.ui | Keeps prop and context references stable so that memoisation works, which the React Compiler does for you. | 0 → 9 | **new**, split from react (Q9) |
| storybook | libs.ui | Only story files and `.storybook/` config. | 13 | domain decided (Q5) |
| test-hygiene | libs.testing | Fires only in test code, on test-structure or assertion APIs that more than one runner shares (Jest-style, Mocha, Chai, Playwright, Cypress). | 0 → 36 | **new** |
| vitest | libs.testing | Uses an API only Vitest has: `vi.*`, `expect.poll`, the per-test context. | 22 → 3 | narrowed |
| testing-library | libs.testing | Unchanged. | 26 | – |
| react-hook-form | libs.forms | Unchanged. | 3 | – |
| css-modules | libs.styling | Unchanged. | 1 | – |
| node | runtimes | Uses a Node built-in module, a Node-only global or loader, or a file that Node runs directly. | 34 → 18 | narrowed |
| browser | runtimes | Uses an API only browsers have: the DOM, document, window, location, CSS, canvas, UI events. JSX markup is not a browser API. | 33 → 27 | narrowed |

`languages` stays empty.

**Where the inputs disagreed, and what I picked:**
- **Security against technology.** Picked security wins (consumer-lens and the security auditor), not technology wins (prior-art,
  following Biome). Biome sorts on two axes, so its security rules stay in its security group even when a domain gates them. We
  have one axis, so under technology-wins what `security` holds depends on which libs happen to exist.
- **A `suspicious` split of correctness** (consumer-lens): not adopted. It is a certainty tier. Prior-art says curation does that
  job for us, and the owner rejected tiers. The 38-rule cut is also judgement: only 40 rules have false-positive data.
- **A `style` list** (consumer-lens): not adopted. The lists say where a ruleset applies; a list sorted by importance is a tier.
- **`latest-js`** (consumer-lens): not adopted as a ruleset. Those 8 rules are a content defect (Q11).
- **complexity.** Picked the auditor's `limits` split over consumer-lens moving the readability rewrites into redundancy. The split
  keeps redundancy's test ("deletes or shortens") true, and leaves `complexity` meaning what Biome and Clippy mean by it.
- **`prefer-const`.** Consumer-lens sends it to modern-js and prior-art to consistency. Picked the `immutability` split instead:
  `let` → `const` is not a newer feature, and the split also keeps no-param-reassign and `toSorted` for class-based teams.
- **The redundancy test.** The redundancy auditor's clause "without bringing in an API" contradicted the modern-js auditor's moves
  (`findIndex` → `indexOf` goes to redundancy), so I dropped the clause. As a result, `unicorn/no-unnecessary-splice` stays in redundancy.
- **The enum ban** (`no-restricted-syntax`). Consumer-lens wants consistency; the plan and the skeptic want type-safety. Picked type-safety,
  because its configured message argues type soundness. A team that wants enums turns off one rule.
- **The test ruleset's name.** Picked `test-hygiene`. `testing` is the domain key, `tests` echoes the rejected code-role
  ruleset, and `test-quality` collides with the `quality` list.
- **The browser test.** The security auditor counted JSX elements as browser APIs. The react auditor showed that JSX also
  renders on servers (Hono SSR). Picked: JSX is not a browser API.

## 2. Moves

### Upheld by the skeptic (applied)

| From → to | Rules | Why |
| --- | --- | --- |
| correctness → redundancy | unicorn/no-duplicate-set-values | A Set drops the duplicate anyway. |
| correctness → complexity | sonarjs/no-nested-assignment | Its bug cases are already caught by no-cond-assign and no-return-assign. What remains is a hard-to-spot side effect, like no-nested-incdec. |
| react → correctness (9) | react/jsx-no-duplicate-props; react/ and @eslint-react/jsx-no-comment-textnodes; @eslint-react/jsx-no-leaked-dollar, jsx-no-leaked-semicolon, dom-no-missing-button-type, dom-no-void-elements-with-children; react/void-dom-elements-no-children, no-invalid-html-attribute | JSX or HTML defects. Each fired in Hono JSX with no React import. |
| react → redundancy (2) | react/jsx-curly-brace-presence, @eslint-react/jsx-no-useless-fragment | Unneeded JSX syntax, in any JSX. |
| react → security (6) | @eslint-react/dom-no-script-url, dom-no-unsafe-target-blank, dom-no-missing-iframe-sandbox, dom-no-unsafe-iframe-sandbox; react/jsx-no-script-url, iframe-missing-sandbox | HTML security issues; they fire in Hono JSX. |
| declarative → modern-js | unicorn/no-array-for-each | Asks for a `for…of` loop, the opposite of declarative. It still conflicts (§5 #2). |
| modern-js → correctness (2) | eslint/no-caller, eslint/no-iterator | Broken in strict mode, or ignored by every engine. Not merely old. |
| modern-js → redundancy (15) | regexp/prefer-d, prefer-w, prefer-plus-/question-/star-quantifier, prefer-range, prefer-predefined-assertion, negation, use-ignore-case, simplify-set-operations; eslint/prefer-regex-literals; sonarjs/prefer-promise-shorthand; unicorn/prefer-array-index-of, prefer-set-size, prefer-array-some | A shorter form from the same edition: `[0-9]` → `\d` is ES3 on both sides. The draft sorted by the `prefer-` prefix, not by what the rules do. |
| modern-js → performance (2) | unicorn/prefer-set-has, prefer-iterator-to-array-at-end | Speed or memory is the only reason given. |
| modern-js → consistency (2) | unicorn/prefer-url-href, prefer-array-from-range | Two equivalent spellings from the same era. |
| redundancy → modules (2) | typescript/no-useless-empty-export, unicorn/no-useless-re-export | Export-statement checks; a twin rule already in modules fires on the same line. |
| redundancy → complexity | sonarjs/no-small-switch | Pairs with prefer-switch: does the branch construct fit the number of branches? |
| redundancy → performance | unicorn/no-duplicate-loops | Its only message is about an intermediate array. |
| complexity → redundancy (5) | unicorn/prefer-hoisting-branch-code, no-negated-comparison, prefer-simple-sort-comparator; sonarjs/no-identical-functions, use-type-alias | Each removes duplicated or longer-than-needed code. |
| complexity → immutability | unicorn/prefer-smaller-scope | It is prefer-const for the cross-block case. Upheld for declarative, so it goes to immutability under Q8. |
| type-safety → complexity | sonarjs/function-return-type | TypeScript fully checks a union return type; this is an API-shape smell. |
| node → security (2) | sonarjs/weak-ssl, publicly-writable-directories | Each has a half that is not Node: AWS CDK TLS policies, and any `/tmp/` string. |
| node → modules (4) | n/no-extraneous-import, n/no-extraneous-require, n/no-unpublished-import, n/no-unpublished-require | They check package.json, not Node APIs, and duplicate import-x/no-extraneous-dependencies. |
| node → correctness (2) | oxc/no-async-endpoint-handlers, n/handle-callback-err | An Express 4 handler shape and an unused `err` parameter. Neither uses a Node API. |
| browser → correctness | unicorn/no-invalid-remove-event-listener | A silent no-op on any EventTarget, Node's AbortSignal included. |
| modules → import-order | import/first | Its only demand is where the imports go. |
| vitest → test-hygiene (19) | every vitest/* rule except hoisted-apis-on-top, require-awaited-expect-poll, require-local-test-context-for-concurrent-snapshots | Measured firing on Jest code, and some on Mocha. |

### Applied with the skeptic's destination instead of the proposer's

| Rule | To | Why |
| --- | --- | --- |
| react/jsx-props-no-spread-multi | correctness | A prop between the two spreads is silently overridden. oxlint files it as correctness. |
| @typescript-eslint/prefer-function-type | consistency | A call-signature interface or a function type alias: same length, same age. |
| regexp/prefer-escape-replacement-dollar-char | consistency | It reports only a `$` that is already literal, so it is a `$` vs `$$` spelling choice. |
| regexp/prefer-quantifier | consistency | The fix is often longer (`\d\d` → `\d{2}`). |
| unicorn/no-array-sort-for-min-max, unicorn/prefer-regexp-test | performance | Their docs give cost as the only reason. |
| unicorn/no-invalid-file-input-accept | correctness (from browser) | The skeptic's follow-on. Its source checks the JSX `accept` attribute, the same kind of check as no-invalid-html-attribute. |

### Upheld, but overridden

| Rule | Proposed | Why not |
| --- | --- | --- |
| unicorn/no-unnecessary-splice | redundancy → modern-js | `shift()` and `push()` are ES3, like `splice()`. That fails the modern-js test that sent prefer-array-index-of to redundancy. It stays in redundancy. |

### Refuted only because they wait on Q1 (applied under the recommended answer)

- node → security (8): sonarjs/encryption-secure-mode, no-weak-cipher, no-weak-keys, unverified-certificate, unverified-hostname,
  no-os-command-from-path, file-permissions; unicorn/no-unsafe-sqlite-interpolation.
- browser → security (4): unicorn/no-unsafe-dom-html; sonarjs/post-message, link-with-target-blank, disabled-resource-integrity.
- react → security (1): @eslint-react/dom-no-dangerously-set-innerhtml.
- **Kept in browser:** unicorn/require-post-message-target-origin. It fires on any one-argument `x.postMessage()`, including Node's
  `parentPort.postMessage(data)`. Its source says so, and unicorn leaves it out of `recommended` for this reason. In security it would
  misfire in Node-only projects.

### Refuted, but worth the owner's look

| Rule | Proposed | Why look |
| --- | --- | --- |
| eslint/no-use-before-define | correctness → ordering | It rightly stays: it is the only guard against a TDZ crash that tsc misses. But with oxlint's default options it flags the owner's "orchestrators at the top" layout. The fix is its options (`functions: false`), not its placement. |
| unicorn/no-useless-recursion | correctness → performance | It stays. But while functional/no-loop-statements is on, a tail-recursive function has no form that passes both (§5 #1). Drop one of the two in triage. |
| react/no-adjacent-inline-elements | react → correctness | It stays. It misses the case that really renders as "onetwo", and fires on deliberate markup. A candidate to drop. |

## 3. Homes for the 50 UNPLACED rules

| Home | Rules |
| --- | --- |
| consistency (22) | @typescript-eslint/array-type, consistent-type-definitions; eslint/arrow-body-style; functional/readonly-type; regexp/grapheme-string-literal, letter-case, match-any, unicode-property; unicorn/consistent-conditional-object-spread, consistent-destructuring, consistent-export-decorator-position, consistent-function-style, consistent-tuple-labels, iteration-fallback-style, prefer-global-number-constants, throw-new-error. Also 6 conventions that add code or change behaviour slightly. The skeptic refuted these under the narrow test ("same behaviour, same length"), so they are placed here by the wider fallback test: eslint/default-param-last, eslint/no-inner-declarations¹, sonarjs/bool-param-default, sonarjs/elseif-without-else, sonarjs/no-undefined-assignment, unicorn/template-indent¹ |
| test-hygiene (17) | sonarjs/async-test-assertions, chai-determinate-assertion², disabled-timeout², explicit-test-skip, inverted-assertion-arguments, no-code-after-done², no-debug-commands-in-ui-tests³, no-empty-test-file, no-fixed-wait-in-tests³, no-forced-browser-interaction³, no-incompatible-assertion-types, no-incomplete-assertions, no-mixed-completion-style, no-same-argument-assert², no-trivial-assertions, parameterized-tests, stable-tests |
| performance (5) | eslint/no-await-in-loop; oxc/no-accumulating-spread, no-map-spread; unicorn/no-array-concat-in-loop, prefer-split-limit |
| ordering | eslint/default-case-last. perfectionist/sort-switch-case already puts `default` last. |
| modern-js | regexp/unicode-escape. It is configured to `\u{…}`, the same preference as 3 rules already there. |
| type-safety | eslint/no-restricted-syntax. It bans enums, and its message argues narrowing. |
| correctness | eslint/no-void. In TS its real effect is to ban `void promise()`, the way out of no-floating-promises. |
| redundancy | unicorn/prefer-object-define-properties. It collapses repeated calls into one. |
| declarative | unicorn/class-reference-in-static-methods, set to `{preferThis: false}`. With today's default it contradicts no-this-expressions (§5 #11). |

¹ oxlint flags block-level functions in ES modules, where they do no harm. The plan already suggests shipping template-indent off.
² Chai or Mocha only. ³ Cypress or Playwright only. Both stay silent everywhere else.

## 4. Ambiguous rules

**Settled by the precedence rule, so no owner call is needed:** import/named, import/default, import/namespace and
unicorn/default-export-style stay in modules. sonarjs/no-commented-code stays in comments. import-x/no-rename-default stays in
naming. jsx-a11y/no-redundant-roles stays in accessibility. ban-ts-comment stays in type-safety, because removing it changes
what tsc reports. sonarjs/no-nested-incdec stays in complexity, now next to no-nested-assignment.

**Owner calls.** Each stays where it is unless marked "applied".

| Rule | Now | Alternative | Note |
| --- | --- | --- | --- |
| eslint/no-shadow | correctness | naming | The fix is always a rename. The two auditors split. |
| @typescript-eslint/prefer-enum-initializers | correctness | type-safety | It pairs with prefer-literal-enum-member, and does nothing while enums are banned. |
| unicorn/no-new-array | correctness | modern-js | Its autofix removes holes, which fixes behaviour. |
| promise/no-promise-in-callback | correctness | modern-js | The real bug is no-floating-promises' job; what is left is a style migration. |
| unicorn/no-confusing-array-splice, consistent-optional-chaining | correctness | redundancy | Each is one bug check plus one shortening, and the shortening is the common case. |
| react/jsx-no-leaked-render + @eslint-react/x-no-leaked-conditional-rendering | react | correctness | `{0 && …}` renders 0 in most JSX runtimes. Move both or neither. |
| @eslint-react/jsx-no-children-prop-with-children, react/no-children-prop | react | correctness / consistency | Is the shared `jsx()` children convention React's, or JSX's? |
| eslint/no-debugger, eslint/no-unused-expressions | redundancy | correctness | oxlint files both as correctness. |
| eslint/no-new | redundancy | declarative / correctness | Fails the redundancy test, because deleting it drops side effects. |
| @typescript-eslint/no-unnecessary-type-parameters | redundancy | type-safety | It catches casts disguised as type parameters, such as `parseJSON<T>(): T`. |
| unicorn/prefer-includes-over-repeated-comparisons, no-negated-array-predicate | complexity | redundancy | – |
| @typescript-eslint/no-dynamic-delete | immutability | modern-js | Keep it with prefer-map-from-entries. |
| functional/prefer-property-signatures | immutability | type-safety | Method signatures check parameters bivariantly, which is unsound. |
| unicorn/no-array-front-mutation | immutability | performance | Fails both tests, since it recommends push and pop. |
| unicorn/prefer-short-arrow-method | consistency (applied) | redundancy | The declarative split forces a choice. |
| unicorn/prefer-object-destructuring-defaults, prefer-has-check, prefer-array-flat-map, prefer-array-from-map, prefer-object-iterable-methods | modern-js | redundancy / consistency / performance | They probably fail the modern-js test. Iteration 2. |
| @typescript-eslint/no-deprecated | modern-js | correctness | It fires on your own `@deprecated` tags, not on old JS. |
| n/no-unpublished-bin | node | modules | Lean node, since bin files are what Node runs. |
| sonarjs/memoize-cache-key, prefer-native-lodash-alternative, no-default-utility-imports | 3 quality rulesets | a lodash lib | See Q12. |

## 5. Conflicts between enabled rules

(2026-10-10: #2 resolved by `house/no-classic-loops` replacing `functional/no-loop-statements`; #9 resolved by perfectionist groups and dropping `unicorn/prefer-type-literal-last`.)

| # | Rules (ruleset after the changes) | What happens |
| --- | --- | --- |
| 1 | unicorn/no-useless-recursion (correctness) × functional/no-loop-statements (declarative) | Each flags the other's fix for a tail-recursive function. Neither autofixes. |
| 2 | unicorn/no-array-for-each (modern-js) × functional/no-loop-statements | The autofix turns `.forEach()` into `for…of`, and the loop is then banned. |
| 3 | unicorn/no-unnecessary-splice (redundancy) × unicorn/no-array-front-mutation (immutability) | The autofix turns `splice(0, 1)` into `shift()`, which is then flagged. |
| 4 | unicorn/prefer-single-replace (redundancy) × eslint/require-unicode-regexp (correctness) | The autofix writes a regex without the `u` flag. |
| 5 | eslint/prefer-arrow-callback (modern-js) × house/named-hook-callback (react) | The autofix turns `useEffect(function () {})` into an arrow, which named-hook-callback then flags. It also double-reports with house/prefer-arrow-callbacks. |
| 6 | sonarjs/class-prototype (modern-js) × functional/no-classes (declarative) | One says "declare a class", the other bans it. |
| 7 | eslint/prefer-spread × unicorn/prefer-reflect-apply (both modern-js) | `fn.apply(null, args)` is fixed to `Reflect.apply`, not to the spread that prefer-spread wants. |
| 8 | unicorn/no-nested-ternary × sonarjs/no-nested-conditional (both complexity) | unicorn's parenthesised fix still fails sonar. |
| 9 | perfectionist/sort-union-types × unicorn/prefer-type-literal-last (both ordering) | An autofix loop on any union that mixes a type literal with a named type (ESLintCircularFixesWarning). The pair is missing from ai-benchmarking's CONFLICTS table. |
| 10 | perfectionist/sort-objects × sonarjs/shorthand-property-grouping (both ordering) | sort-objects' autofix undoes the grouping sonar asks for. |
| 11 | unicorn/class-reference-in-static-methods × functional/no-this-expressions (both declarative) | The default `preferThis` wants `this`, and no-this-expressions bans it. `{preferThis: false}` fixes it. |
| 12 | oxc/no-accumulating-spread (performance) × functional/immutable-data (declarative) | The suggested fix (push onto the accumulator) is banned. |
| 13 | perfectionist/sort-modules (ordering) × eslint/no-use-before-define (correctness) | The sort moves exports above the helpers they call, which no-use-before-define then flags. Narrow: only without blank lines between them. |
| 14 | @typescript-eslint/no-floating-promises × eslint/no-void (correctness) | Its "add void" suggestion produces a no-void error. |
| 15 | @eslint-react/x-no-component-will-mount, -will-receive-props, -will-update × x-no-unsafe-component-will-* (react) | The autofix renames to `UNSAFE_*`, which the twin rule flags. |
| 16 | react/jsx-no-bind {allowArrowFunctions} × react-perf/jsx-no-new-function-as-prop (react-perf) | The second rule flags every inline arrow, so the first one's option does nothing. |
| 17 | functional/no-classes, no-this-expressions (declarative) × React error boundaries | An error boundary can only be written as a class. Declarative's path scoping (no-expression-statements and no-return-void apply only to non-hook `*.ts`) must ship with the ruleset. |
| 18 | testing-library/no-dom-import × storybook/use-storybook-testing-library | They point a story at different import targets. Storybook's autofix satisfies both. |

The plan's guard runs `lint_fixpoint_audit.py` on the full set and on each variant with one ruleset removed. It cannot see
conflicts inside one ruleset (#7–#11, #15, #16) or between rules with no autofix (#1, #6, #11, #12, #17).

## 6. Questions for the owner

| # | Question | Recommend | What it changes |
| --- | --- | --- | --- |
| 1 | Does security beat runtimes and libs, whenever the rule is silent where its technology is absent? | Yes | 13 rules move to security (8 node, 4 browser, 1 react). This answers plan Open #2. The AWS CDK (18) and HTTP-middleware (14) rules then stay in security with no new libs. Declining keeps security at 60. |
| 2 | Like regex, JSX gets no ruleset: JSX-syntax and HTML rules go to quality by purpose, and react keeps what depends on React. | Yes | 18 rules leave react (§2). It replaces the plan's "the 14 dom-* rules stay in react", which is false for 6 of them. |
| 3 | Adopt `consistency`, `performance` and `test-hygiene`? | Yes | Every unplaced rule gets a home. Sizes 28 / 10 / 36. The test ruleset's name is your call. |
| 4 | Move the 19 vitest/* rules that work with any runner into test-hygiene? | Yes | vitest goes from 22 to 3. A Jest or Mocha project keeps those 19 after dropping vitest. |
| 5 | Which domain does Storybook belong to? | libs.ui | No size change. 9 of its 13 rules are about story format. |
| 6 | Split `limits` out of complexity? | Yes | One more ruleset. Teams adopting on old code drop the thresholds (max-lines-per-function 20, max-params 4) and keep no-nested-ternary and prefer-early-return. Declining: complexity 35. |
| 7 | Split `import-order` out of ordering? | Yes | One more ruleset. A formatter that sorts imports fights ours, and a team that groups object keys by meaning wants the opposite cut. Declining: ordering 29. |
| 8 | Split `immutability` out of declarative? | Yes | One more ruleset. Class-based codebases (NestJS, Angular, Lit) drop declarative, and today lose prefer-const, no-param-reassign and `toSorted` with it. Declining: declarative 25. |
| 9 | Add `react-perf` next to react, for React Compiler users? | Yes. It is the one place where react splits for a named consumer. | One more ruleset; react drops from 129 to 120. 2 of its 9 rules already switch themselves off under the compiler. The name is your call. It revisits "sub-rulesets: not yet", but as a peer ruleset, not a child. |
| 10 | Replace the single tie-break with the precedence order in §1? | Yes | Settles most of the ambiguous rules. It is a new sentence in the plan. |
| 11 | 8 modern-js rules autofix to APIs that Node 22.23.2 lacks: `RegExp.escape`, `Error.isError`, `Iterator.concat`, `Uint8Array#toBase64`, `Temporal`, `Map#getOrInsertComputed`, `Promise.try`, `using` (re-measured). | Ship them off until Node LTS has them, as unicorn's `recommended` does. Not a `latest-js` ruleset. | modern-js 83 → 75. This is content, not placement. |
| 12 | Lib-specific rules whose lib has no ruleset (lodash 3, AWS CDK 18, HTTP middleware 14): give each its own lib ruleset? | No | Nothing. For CDK and HTTP middleware this follows from Q1. The 3 lodash rules never fire without lodash. |
| 13 | Split correctness into correctness and `suspicious`? | No | It reads as a strictness tier. |
| 14 | Add a `style` list for consistency, naming, comments and ordering? | No | A list sorted by importance is a tier. The lists say where a ruleset applies. |
| 15 | Triage items found along the way (not placement): no-use-before-define options; drop no-useless-recursion or no-loop-statements; require-post-message-target-origin misfires on Worker and MessagePort; no-adjacent-inline-elements; conflicts #9, #10, #16. | A separate triage pass | – |

**For iteration 2:**
- Apply the modern-js test to its remaining 83 rules.
- Re-check browser's runtime-neutral event rules (no-late-event-control, no-late-current-target-access, prefer-add-event-listener).
- Find homes for complexity's scope-placement rules (consistent-function-scoping, no-declarations-before-early-exit).
- Weak option, only if a consumer asks: an `unused` split from redundancy.

## 7. Sizes after the recommended changes

Counted by `synth/apply.py`. Total 1,014.

| Ruleset | List | Now | After | Δ |
| --- | --- | --- | --- | --- |
| correctness | quality | 218 | 233 | +15 |
| redundancy | quality | 105 | 125 | +20 |
| modern-js | quality | 107 | 83 | −24 |
| security | quality | 52 | 73 | +21 |
| accessibility | quality | 42 | 42 | 0 |
| modules | quality | 27 | 32 | +5 |
| consistency | quality | – | 28 | new |
| complexity | quality | 38 | 24 | −14 |
| type-safety | quality | 22 | 22 | 0 |
| ordering | quality | 27 | 22 | −5 |
| immutability | quality | – | 14 | new |
| naming | quality | 14 | 14 | 0 |
| limits | quality | – | 11 | new |
| declarative | quality | 24 | 10 | −14 |
| performance | quality | – | 10 | new |
| comments | quality | 8 | 8 | 0 |
| import-order | quality | – | 7 | new |
| react | libs.ui | 148 | 120 | −28 |
| react-perf | libs.ui | – | 9 | new |
| storybook | libs.ui | 13 | 13 | 0 |
| test-hygiene | libs.testing | – | 36 | new |
| testing-library | libs.testing | 26 | 26 | 0 |
| vitest | libs.testing | 22 | 3 | −19 |
| react-hook-form | libs.forms | 3 | 3 | 0 |
| css-modules | libs.styling | 1 | 1 | 0 |
| node | runtimes | 34 | 18 | −16 |
| browser | runtimes | 33 | 27 | −6 |
| *unplaced* | – | 50 | 0 | −50 |

The list totals are quality 758, libs 211 and runtimes 45. Declining a question changes only these:
- Q1: security 60, node 26, browser 31, react 121.
- Q6: complexity 35.
- Q7: ordering 29.
- Q8: declarative 25, consistency 27.
- Q9: react 129.

## 8. Corrections (the brief, the plan, and ai-benchmarking)

| Claim | Where | Fact | Reproduce |
| --- | --- | --- | --- |
| Rules are "keyed by ESLint rule ID" | brief; plan, Routing | 164 of the 1,014 use oxlint-style IDs: 114 `eslint/`, 19 `typescript/`, 19 `oxc/` (these have no ESLint ID) and 12 `import/`. | Count the `id` prefixes in packages/rule-data/rulesets.json |
| browser has "~25 DOM rules"; node has "21 `n/*` rules" | plan, Rulesets | browser has 33. node has 34, of which 21 are `n/*`. | Count the entries per ruleset |
| "The 14 @eslint-react/dom-* rules are React-DOM rules" | plan, Rulesets | False for 6 of them: they fire in Hono JSX. | scratchpad react-probe/src/hono.tsx |
| Regex "`prefer-*` to `modern-js`" | plan, Rulesets | 10 of the regexp prefer-* rules ask for ES3 shorthand. | The modern-js audit |
| "CSS Modules … is something in package.json" | plan, Rulesets | Vite handles `*.module.css` with no package. | Vite's cssModuleRE |
| "12 Express-only rules" | plan, Waiting #2 | 14 security rules key on HTTP-server middleware, and 5 of those also match code that is not Express. 18 AWS CDK rules and 7 other lib rules stayed in security for the same reason. | eslint-plugin-sonarjs/cjs detection code |
| "a framework-agnostic testing ruleset" for the 17 sonarjs rules | plan, Waiting #1 | About 10 are agnostic. 4 need Chai or Mocha, and 3 need Cypress or Playwright. | sonarjs 4.2 source |
| Running fixpoint on each removal variant "covers what people will actually configure" | plan, Rulesets | It misses conflicts inside a ruleset and rules without autofix (§5). | scratchpad conflict/a.ts |
| house/prefer-line-comments "prefer // over /** */" | ai-benchmarking house/index.js meta | It skips `/**` JSDoc. | preferLineComments |
| vitest/valid-describe-callback "rejects async describe callbacks" | ai-benchmarking rejected-rules doc | It does not under oxlint 1.82, so an async `describe` goes unchecked. | scratchpad skeptic/fx |
| unicorn/no-array-for-each | the rule's ID | Its ESLint name in unicorn 74 is `unicorn/no-for-each`. | ESLint 10.10 refuses the other name |
