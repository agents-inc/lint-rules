# Ruleset critique, round 2

Measured 2026-10-30 on the working tree over HEAD 707df6e, and revised the same day after review, with every
measurement re-run. Other lanes were editing rule-data at the same time, so re-run each command before acting on it.
Nothing in the data or code was changed. The owner answered §4 on 2026-10-30, and the answers are built (§4's first line).

A group's purpose is round 1's membership test ([r1](ruleset-critique-r1.md) §1, whose rulesets the owner adopted on
2026-10-10), plus the plan's [Rulesets](../plan.md#rulesets) rules: a `libs` rule means nothing without its dependency,
JSX and regex get no ruleset, security wins, and otherwise the rule's main purpose decides. "Drops a group" means a team
leaves it out of its list. A rule's "rewrite" is the change it asks for, whether it applies it (a fix), offers it (a
suggestion) or only reports.

**Measured here.** Each rule ran alone on a scratch project outside the repo, with ESLint 10.12, oxlint 1.87,
eslint-plugin-unicorn 78.0.0, @eslint-react 5.26.5, eslint-plugin-react 7.37.5, Hono 4.12.33, Node 23.10 and
TypeScript 6.0.3 (5.7.3 where named).
- **M1:** a `.tsx` file with `jsxImportSource: "hono/jsx"` and no React installed or imported.
  - `@eslint-react/x-no-leaked-conditional-rendering` reports `{props.count && <li/>}`, `react/no-children-prop` reports
    `<section children={…} />`, and `react/no-adjacent-inline-elements` reports `<div><b>one</b><i>two</i></div>`.
  - Hono renders a list holding `{0 && <li/>}` as `<ul>0</ul>`, with its automatic runtime and its classic `jsx()` alike.
  - A `children` prop renders under the automatic runtime. The classic `jsx()` drops it: `<section></section>`.
- **M2:** `react/no-adjacent-inline-elements`.
  - It reports `<p><b>one</b><i>two</i></p>` and `<p><span>$</span><strong>42</strong></p>`.
  - It is silent on the same `<b>`/`<i>` pair split over two lines. JSX drops that line break, so the pair renders "onetwo".
  - It is also silent on `<p>one<b>two</b></p>`.
- **M3:** a Node `.ts` file with `new EventTarget()` and a listener that awaits, then calls `event.preventDefault()` and
  reads `event.currentTarget`. `unicorn/no-late-event-control` and `unicorn/no-late-current-target-access` each report it.
  Run in Node, the late `preventDefault()` leaves the event uncancelled, and `currentTarget` is `null`.
- **M4:** `unicorn/require-post-message-target-origin`, which oxlint runs, and ESLint where there is no oxlint.
  - oxlint reports a one-argument `postMessage` on a `Worker`, on a `BroadcastChannel` and on `self` inside a worker, none
    of which takes a target origin. It also reports one on `window`. It is silent on a `MessagePort`. Its help text reads
    "Insert `, worker.location.origin`". `--fix` applies nothing.
  - ESLint's version reports the `MessagePort` too, and offers editor suggestions such as `channel.location.origin`. In
    Node, a `BroadcastChannel` has no `location`, so that suggestion throws a TypeError.
  - unicorn leaves the rule out of its recommended set because it "can't distinguish `window.postMessage` and
    `{Worker,MessagePort,Client,BroadcastChannel}#postMessage()`" (the rule's source).
- **M5:** `module Shapes { … }`.
  - oxlint: `@typescript-eslint/no-namespace` and `@typescript-eslint/prefer-namespace-keyword` both report it. `--fix`
    rewrites it to `namespace Shapes`, which `no-namespace` still reports.
  - In a declaration file (`.d.ts`), `no-namespace` is silent on `declare module Shapes { … }`, and
    `prefer-namespace-keyword` alone reports it.
  - TypeScript 6.0.3 rejects `module Shapes` (TS1540) in a `.ts` file. In a `.d.ts` file it does so only with
    `skipLibCheck` off, and its own `tsc --init` turns `skipLibCheck` on. TypeScript 5.7.3 accepts both. Both
    versions are inside the supported range, `>=4.8.4 <6.1.0`.
- **M6:** `new Array(size)`, `new Array("3")`, `new Array(3)`, `new Array(1, 2)` and `new Array()`, in both engines.
  `unicorn/no-new-array` reports the three one-argument calls and `no-array-constructor` the other two, so neither reports a
  call the other does. oxlint, which runs `no-new-array`, applies no fix.
- **M7:** Node 23.10 with `--experimental-strip-types` refuses a file holding an enum, a namespace or a constructor
  parameter property, each with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. It runs a file holding only type annotations.
- **M8:** `unicorn/prefer-add-event-listener` (ESLint) reports `onmessage` on Node's `WebSocket` and `MessagePort` and
  `onabort` on an `AbortSignal`, and Node runs the `onabort` handler. `--fix` rewrites that assignment to
  `addEventListener('abort', …)`.

## 1. Round 1's close calls

**How measured.** The calls are the rule column of r1 §4's "Owner calls" table:
`sed -n '/^\*\*Owner calls/,/^## 5/p' docs/work/ruleset-critique-r1.md | grep '^| [a-z@]' | cut -d'|' -f2`.
- Expand `a/x, y` to `a/x` and `a/y`.
- The lodash row is in §3, because r1 sent it to its Q12.
- Each rule's group today: `jq -r --arg id <id> '.[] | select(.id == $id) | [.ruleset, .assignment.by, .assignment.alternative] | @tsv' packages/rule-data/data/rules.json`.
  For a rule that prints nothing, run the same `select` on `rule-candidates.json`, printing `.status, .decidedBy`.
- r1's `eslint/` IDs are written plain in the data (`no-shadow`).
- Round 1 measured none of these. "Case" is r1's note unless it cites M1–M8.
- The data's other close calls between correctness and a tidying group, which Q1 decides with these:

```
jq -r '.[] | select(.assignment.confidence=="low") | select(((.ruleset=="correctness") and ((.assignment.alternative // "") | test("redundancy|modern-js|naming|complexity|declarative"))) or (((.ruleset // "") | test("^(redundancy|modern-js|naming|complexity)$")) and ((.assignment.alternative // "") | test("correctness")))) | [.id, .ruleset, .assignment.alternative] | @tsv' packages/rule-data/data/rules.json
```

| Rule | Now | Other home | Case | → |
| --- | --- | --- | --- | --- |
| `no-shadow` | correctness | naming | The fix is always a rename, but what it prevents is reading the wrong variable. Filed in naming, a team that drops naming loses that check. | Q1 |
| `@typescript-eslint/prefer-enum-initializers` | correctness | type-safety | Stops enum values shifting when members move. It does nothing while the enum ban is on. | Q10 |
| `unicorn/no-new-array` | correctness | modern-js | It reports the one-argument `new Array(x)`, which makes a length or one element depending on x (M6). | Q1 |
| `promise/no-promise-in-callback` | correctness | modern-js | The bug is `no-floating-promises`' job, and that rule is in correctness; what is left is a migration. | Q10 |
| `unicorn/no-confusing-array-splice` | correctness | redundancy | One bug check plus one shortening. The data marks it `high`, with no alternative. | Q1 |
| `unicorn/consistent-optional-chaining` | correctness | redundancy | Either a crash risk or a `?.` that is not needed. | Q1 |
| `react/jsx-no-leaked-render` | – | – | Settled: not shipped, a duplicate of the next rule (r2-d14). | – |
| `@eslint-react/x-no-leaked-conditional-rendering` | react | correctness | Fires with no React, and Hono renders the leaked `0` (M1). | moved, §4 |
| `@eslint-react/jsx-no-children-prop-with-children` | – | – | Settled: not shipped, a duplicate of `react/no-children-prop` (r2-d13). | – |
| `react/no-children-prop` | react | conventions | Fires with no React (M1). Hono's classic `jsx()` drops a `children` prop; its automatic runtime renders it (M1). | Q4: conventions |
| `no-debugger` | redundancy | correctness | oxlint files it under correctness. A leftover pauses the program wherever devtools are open. | Q1 |
| `no-unused-expressions` | redundancy | correctness | `x == 1;` written for an assignment is a bug. Left out where `functional/no-expression-statements` is on (r2-d72). | Q1 |
| `no-new` | redundancy | correctness, declarative | Fails redundancy's test, because deleting `new X()` drops its side effects. Covered like the row above. | Q1 |
| `@typescript-eslint/no-unnecessary-type-parameters` | redundancy | type-safety | Catches a cast disguised as a type parameter (`parseJSON<T>(): T`). | Q2 |
| `unicorn/prefer-includes-over-repeated-comparisons` | complexity | modern-js (data), redundancy (r1) | It asks for `.includes()` (ES2016), like `unicorn/prefer-includes` in modern-js. It only reports. | Q3 |
| `unicorn/no-negated-array-predicate` | complexity | redundancy | Its fix (`!a.some(p)` → `a.every(x => !p(x))`) is neither shorter nor newer. It restructures for readability, which is complexity's test. | Q10 |
| `@typescript-eslint/no-dynamic-delete` | immutability | modern-js (r1), correctness (data) | `delete o[k]` is a mutation, which is immutability's test. | Q10 |
| `functional/prefer-property-signatures` | immutability | type-safety | Method signatures check parameters bivariantly, which is unsound. | Q2 |
| `unicorn/no-array-front-mutation` | immutability | performance | It recommends `push` and `pop`, so it fails both tests (r1). Covered by `functional/immutable-data` (r2-d74). | Q10 |
| `unicorn/prefer-short-arrow-method` | – | – | Settled: not shipped (q-dogfood-function-style-pair). | – |
| `unicorn/prefer-object-destructuring-defaults` | modern-js | conventions | Its suggested rewrite uses ES2015 destructuring in place of ES2018 spread, so it is older, not newer. | Q3 |
| `unicorn/prefer-has-check` | modern-js | redundancy | `.get(k) !== undefined` → `.has(k)`: same edition, shorter. | Q3 |
| `unicorn/prefer-array-flat-map` | modern-js | redundancy | `.map().flat()` → `.flatMap()`: both ES2019. | Q3 |
| `unicorn/prefer-array-from-map` | modern-js | redundancy | `Array.from(x).map(f)` → `Array.from(x, f)`: both ES2015. | Q3 |
| `unicorn/prefer-object-iterable-methods` | modern-js | redundancy | `Object.entries` → `Object.keys` or `Object.values`: same edition. | Q3 |
| `@typescript-eslint/no-deprecated` | modern-js | correctness | Fires on any `@deprecated` tag, whether a library's or the team's own, not on old JS. Its replacement, the successor the tag names, still passes modern-js' test. | Q10 |
| `n/no-unpublished-bin` | node | modules | Checks that `package.json`'s `bin` files get published: a manifest check, the reason r1 moved `n/no-unpublished-import` and `n/no-unpublished-require` to modules. r1 leaned node, since bin files are what Node runs. | Q10 |

## 2. Rules shipped since round 1: misfits only

**How measured.** The rules are listed by
`jq -r '.[] | select(.assignment.by | test("^(owner-2026-10-(1[1-9]|2[0-9]|3[01])|accepted-spec-|a3-|my-)")) | [.assignment.by, (.ruleset // "(off by default)"), .id] | @tsv' packages/rule-data/data/rules.json`.
- Each rule was read against its group's test. The unicorn rules were read from their 78.0.0 source.
- The 2026-10-28 answer lanes kept `owner-2026-10-24` on the rules they shipped.
- The owner's verdict on each was accept or reject, so this critique reads each group as still open; each card says where
  the owner saw a group. The 2026-10-11 candidates page proposed a group for each rule but `parameter-properties`, which
  [rule candidates r1](rule-candidates-r1.md) lists under "Not measured" with none (decisions.md). The 2026-10-24 axios
  card proposed no new group, because its lodash twin ships in modern-js.

| Rule | Now | Fits | Why | → |
| --- | --- | --- | --- | --- |
| `@typescript-eslint/no-namespace` | type-safety | conventions | A namespace does not weaken type checking. Like the enum ban, it bans syntax Node cannot run (M7). Its twin `prefer-namespace-keyword` is in modern-js (M5). | Q2, Q9 |
| `@typescript-eslint/parameter-properties` | type-safety | conventions | `constructor(private x)` does not weaken type checking. Node cannot run it (M7). | Q2 |
| `no-array-constructor` | correctness | redundancy | It reports only `new Array(1, 2)` and `new Array()` (M6): a literal is shorter, in the same edition, like `no-object-constructor`. | Q3 |
| `no-object-constructor` | modern-js | redundancy | `new Object()` → `{}`: both ES3, shorter. | Q3 |
| `unicorn/prefer-temporal-conversion` | modern-js | redundancy | Fires only on code already using Temporal, and both forms are Temporal. | Q3 |
| `@typescript-eslint/dot-notation` | conventions | redundancy | `o["a"]` → `o.a`: same edition, shorter. | Q10 |
| `sonarjs/prefer-native-axios-alternative` | modern-js | a library group | Silent without axios. It passes the `libs` test, but there is no axios group. Same case as round 1's lodash rules. | Q8 |

**Fits, though the data records another group as an alternative:**
- `prefer-named-capture-group`: its fix uses an ES2018 feature.
- `e18e/prefer-throw-if-no-entry`: it checks Node's `fs.statSync` and `lstatSync`.
- `unicorn/no-repeated-call-wrappers`.

**Not re-examined, because the owner placed them:**
- `@typescript-eslint/ban-ts-comment` (2026-10-29).
- `@typescript-eslint/consistent-type-imports`, in conventions (recorded with q-lint-tse-type-imports-decorator-metadata).
  Its twin `consistent-type-exports` follows it.
- `house/require-class-helper`, `default-case-last` and `import-x/first`.
- The off-by-default rules, which belong to no group.

## 3. Side issues

**How measured.**
- Sources: r1 §6, §4's lodash row and questions.md #7, plus plan.md's "Owner answers, 2026-10-10" and "Considered and dropped".
- For the rules not shipped: `jq -r '.[] | select(.id | test("<ids>")) | [.id, .status, .decidedBy] | @tsv' packages/rule-data/data/rule-candidates.json`.
- The modern-js pass reads each `select(.ruleset == "modern-js")` rule's rewrite against the group's test.

| Item | Status |
| --- | --- |
| r1 Q1–Q9: security wins, JSX, new groups, splits, Storybook | Settled by the owner, 2026-10-10. |
| r1 Q10: the precedence order | Never ruled; plan.md keeps the older tie-break. Not carried as a card: Q1 and Q3 asked it for their rules, and Q10 the rest one by one, all answered. |
| r1 Q11: rules whose fix needs an API Node 22 lacks | Settled: parked by the owner (questions.md, "Parked"). |
| r1 Q12: library rules with no library group (`sonarjs/memoize-cache-key`, `sonarjs/prefer-native-lodash-alternative`, `sonarjs/no-default-utility-imports`), now joined by `sonarjs/prefer-native-axios-alternative` | Answered, Q8: they stay. |
| r1 Q13 (a `suspicious` split) and Q14 (a `style` list) | Answered, Q11: no to both, nothing built. The owner's "not needed" of 2026-10-10 (plan.md, "Considered and dropped") is about stability tiers. |
| Q15: `no-use-before-define`'s options | Settled: not shipped (owner 2026-10-10). |
| Q15: `unicorn/no-useless-recursion` against `functional/no-loop-statements` | Settled: neither ships (owner 2026-10-10; r2-c1). |
| Q15: `unicorn/require-post-message-target-origin` | Answered, Q6: dropped (M4). |
| Q15: `react/no-adjacent-inline-elements` | Answered, Q7: dropped (M2). |
| Q15: conflicts #9, #10 and #16 | Settled. #9 by the owner on 2026-10-10. #10 by dropping `sonarjs/shorthand-property-grouping` (r2-c10). #16 by keeping both, with `react/jsx-no-bind` set to `allowBind: true` (r2-d19), as the data has it. |
| Iteration 2: modern-js' test over the rest of the group | Done here. Beyond §1 and §2 it also fails for `unicorn/prefer-math-abs`, whose suggested rewrite (`x < 0 ? -x : x` → `Math.abs(x)`) is ES1 on both sides. It fails for `unicorn/prefer-map-from-entries` too, whose fix writes ES2015 `new Map` for ES2019 `Object.fromEntries`. Both join Q3. |
| Iteration 2: browser's event rules that also fire outside browsers | `unicorn/no-late-event-control` and `no-late-current-target-access` fire on Node's `EventTarget` (M3): Q5. `unicorn/prefer-add-event-listener` fires on Node's `WebSocket`, `MessagePort` and `AbortSignal` (M8), so it is not specific to browsers; its purpose is a convention (Q10). |
| Iteration 2: complexity's scope-placement rules | `unicorn/consistent-function-scoping` and `unicorn/no-declarations-before-early-exit` restructure working code, which is complexity's test. They stay (Q10). |
| Iteration 2: an `unused` split, "only if a consumer asks" | No consumer has asked: `grep -rniE '\bunused\b.{0,30}(split\|ruleset)' docs/` finds only r1. Not raised. |
| `unicorn/no-hex-escape` beside `unicorn/prefer-literal-ascii` | Settled: `no-hex-escape` dropped (r2-d68, recorded 2026-10-29). |
| New: `@typescript-eslint/prefer-namespace-keyword`'s fix is still reported by `no-namespace` (M5) | Answered, Q9: declaration files only. |

## 4. Owner questions

**Answered by the owner on 2026-10-30 and built** (one entry per card in [decisions](decisions.md)): Q1 A, Q2 A, Q3 A,
Q4 A, Q5 A, Q6 A, Q7 A, Q8 A, Q9 C, Q10 A, Q11 A. Under Q1, of the data's other marked rules, `regexp/no-dupe-disjunctions`,
`unicorn/no-break-in-nested-loop` and `unicorn/no-subtraction-comparison` were shown to catch a real bug and moved;
`regexp/optimal-lookaround-quantifier` and `unicorn/prefer-else-if` were not, and stay.

**Decided by the owner's 2026-10-10 ruling, so not cards.** "JSX gets no ruleset … `react` keeps what depends on React"
(plan.md, Rulesets; questions.md, "Answered (owner, 2026-10-10)"). Three rules fire with no React (M1), so each leaves
react.
- `@eslint-react/x-no-leaked-conditional-rendering` goes to correctness: its purpose is wrong output, and Hono renders the
  leaked `0` (M1).
- `react/no-children-prop`: where it goes is Q4.
- `react/no-adjacent-inline-elements`: whether it ships at all is Q7.

**Q1. When a rule catches a real bug but the rewrite it asks for looks like tidying, should it sit with the bug checks (correctness)?**

A team that leaves out a tidying group (redundancy, modern-js, naming, complexity) loses every rule in it, so a bug
check filed there disappears without the team knowing. Today `no-debugger`, `no-unused-expressions` and `no-new` sit in
redundancy, while `no-shadow`, `unicorn/no-new-array`, `unicorn/no-confusing-array-splice` and
`unicorn/consistent-optional-chaining` sit in correctness. The data marks more rules as the same close call (command in
§1), for example `unicorn/no-subtraction-comparison` and `regexp/no-dupe-disjunctions`, which sit in redundancy. This
replaces round 1's question 10 (a fixed order for choosing between groups) for these rules.

- **A.** The bug decides. The three in redundancy move to correctness, and each other marked rule moves there once it is
  checked to catch a real bug. A team can still turn any single rule off in `rules`.
- **B.** The rewrite decides. `no-shadow` goes to naming, `no-new-array` to modern-js, the splice and optional-chaining
  rules to redundancy, and `no-new` to declarative, beside `functional/no-expression-statements`, which already covers
  it. `no-debugger` and `no-unused-expressions` stay in redundancy. A team that leaves those groups out loses these bug
  checks.
- **C.** Leave every rule where it is; the mix stays.

**Recommended: A.** Correctness is the group a team is least likely to leave out, and round 1 already moved `no-caller`
and `no-iterator` there for this reason.

**Q2. Should type-safety hold only the rules about weaker type checking?**

A team may leave type-safety out to allow `any` and casts, for example while moving from JavaScript. Today that also
lifts three bans on TypeScript-only syntax that Node cannot run without a build step: enums (`no-restricted-syntax`, its
`TSEnumDeclaration` selector), namespaces (`@typescript-eslint/no-namespace`) and constructor parameter properties
(`@typescript-eslint/parameter-properties`). Node refuses all three alike (M7). Two checks that do catch unsound types sit
elsewhere: `@typescript-eslint/no-unnecessary-type-parameters` (redundancy) and `functional/prefer-property-signatures`
(immutability). You accepted `no-namespace` on 2026-10-11 on a page that proposed type-safety for it;
`parameter-properties` was accepted with no group proposed.

- **A.** Both ways. The two checks move into type-safety, and the three bans move out together to conventions. Leaving
  type-safety out then no longer allows enums, namespaces or parameter properties.
- **B.** Only the two checks move in. Leaving type-safety out still lifts the three bans.
- **C.** Leave all five where they are.

**Recommended: A.** A team that loosens its types has not asked to start writing enums, namespaces or parameter
properties, and the three bans share one reason, so they belong together.

**Q3. Should modern-js hold only rules whose rewrite uses a newer language or platform feature?**

A team may leave modern-js out because where its code runs lacks newer features; today it then also loses rules that
only shorten code within the same language version. To redundancy would go `unicorn/prefer-has-check`,
`prefer-array-flat-map`, `prefer-array-from-map`, `prefer-object-iterable-methods`, `prefer-math-abs` and
`prefer-temporal-conversion`, plus `no-object-constructor`, plus `no-array-constructor` from correctness (it reports only
`new Array(1, 2)` and `new Array()`, the same shortening; M6). To conventions would go
`unicorn/prefer-object-destructuring-defaults` and `prefer-map-from-entries`, each of which asks for an older form. Into
modern-js from complexity would come `unicorn/prefer-includes-over-repeated-comparisons`. On 2026-10-11 you accepted
`no-object-constructor` and `prefer-temporal-conversion` on a page that proposed modern-js, and `no-array-constructor`
with correctness proposed.

- **A.** Move all eleven. Leaving modern-js out then drops only rewrites that need newer features.
- **B.** Move only round 1's five (`prefer-object-destructuring-defaults`, `prefer-has-check`, `prefer-array-flat-map`,
  `prefer-array-from-map`, `prefer-object-iterable-methods`). The other six stay.
- **C.** Move none. modern-js keeps meaning "the preferred way", whatever its age.

**Recommended: A.** It applies one test to the whole group, the one round 1 already used to move
`unicorn/prefer-array-index-of` to redundancy.

**Q4. Which group should `react/no-children-prop` go to, now that your 2026-10-10 ruling takes it out of react?**

The rule asks for children between the tags (`<section>label</section>`) rather than as a prop
(`<section children="label" />`). In React and in Hono's automatic runtime both forms render the same, so there it is a
spelling convention. With Hono's classic `jsx()` function the prop is dropped, and the element renders empty (M1).

- **A.** conventions. A team that leaves conventions out loses it, including a team on Hono's classic `jsx()`, whose
  empty elements then go unreported.
- **B.** correctness. Every team gets it, and on every runtime but Hono's classic `jsx()` it reports code that works.

**Recommended: A.** Its main purpose is a convention, which the plan says decides, and the bug it also catches needs one
runtime.

**Q5. Two rules in the browser group catch event-handler bugs that also happen outside browsers. Should they move to correctness?**

After an `await` inside an event handler, `event.preventDefault()` silently does nothing and `event.currentTarget` is
null. Node behaves the same, and both rules report a Node file (M3), so a server-only team that does not list browser
misses them. The rules are `unicorn/no-late-event-control` and `unicorn/no-late-current-target-access`.

- **A.** Move both to correctness. Every team gets them, and they fire only inside event handlers.
- **B.** Keep both in browser.

**Recommended: A.** Round 1 moved `unicorn/no-invalid-remove-event-listener` from browser to correctness for the same
reason.

**Q6. A rule reports every message sent to a worker, a broadcast channel or a message port as missing a target origin. Keep shipping it?**

`unicorn/require-post-message-target-origin` (browser group) wants a second argument on `postMessage`, because
`window.postMessage` takes a target origin. It cannot tell a window from a worker, channel or port, whose `postMessage`
takes none, and unicorn leaves it out of its own recommended set for that reason. oxlint's version reports workers and
broadcast channels. ESLint's version, which runs for teams without oxlint, also reports message ports, and its editor
suggestions there, such as `channel.location.origin`, throw an error when run (M4).

- **A.** Stop shipping it, recorded as dropped with this card. A `window.postMessage` with no target origin then goes
  unreported.
- **B.** Keep it. Teams using workers, channels or ports get a false report on every message, and turn the rule off in
  `rules` or for their worker files in `fileOverrides`.
- **C.** Ship it off by default. A team that posts only to windows turns it on in `rules`.

**Recommended: A.** It reports correct code wherever workers are used, and the code it suggests there throws an error.

**Q7. A rule about words running together on the page misses the usual case and reports markup written that way on purpose. Keep shipping it?**

`react/no-adjacent-inline-elements` reports `<b>one</b><i>two</i>` written on one line. It misses the same two tags on two
lines, which also show as "onetwo", and it reports `<span>$</span><strong>42</strong>`, which is written that way on
purpose (M2). It works in any JSX (M1), so under your 2026-10-10 ruling it cannot stay in react.

- **A.** Stop shipping it.
- **B.** Keep it, moved to correctness.

**Recommended: A.** It misses the form that code formatting usually produces and reports correct code.

**Q8. Four rules fire only on code that uses lodash, underscore or axios, and no group of their own exists. Keep them in the general groups?**

The rules are `sonarjs/memoize-cache-key` (correctness), `sonarjs/prefer-native-lodash-alternative` (modern-js),
`sonarjs/no-default-utility-imports` (modules) and `sonarjs/prefer-native-axios-alternative` (modern-js). A team without
those libraries sees nothing from them. On 2026-10-14 you approved one group per library, grouped by domain, for the
libraries then planned; lodash and axios were not among them. On 2026-10-24 you accepted the axios rule on a card that
said it needs no new group, because its lodash twin already ships in modern-js. Round 1 asked about the lodash rules as
its question 12, and it was never answered.

- **A.** Leave them in the groups their purpose names. A team that uses lodash cannot turn them off as one group.
- **B.** New library groups for lodash and axios (you name them). Each is one more name a new config lists, and a team
  can drop either.
- **C.** Stop shipping the two "use the built-in instead" rules. The other two stay where their purpose puts them.

**Recommended: A.** Rules that stay silent without their library cost other teams nothing, and a group of one or two
rules adds a name to every new config.

**Q9. One rule's automatic fix produces code that another rule still reports. How should the two be split?**

On `module Shapes { … }`, `@typescript-eslint/prefer-namespace-keyword` rewrites `module` to `namespace`, and
`@typescript-eslint/no-namespace` still reports the result, so the fix does not clear the line. In declaration files
(`.d.ts`), `no-namespace` is silent, so `prefer-namespace-keyword` is the only check there. TypeScript 6 rejects
`module Shapes` as an error, except in declaration files when `skipLibCheck` is on, as `tsc --init` sets it; TypeScript 5
accepts it (M5).

- **A.** Leave `prefer-namespace-keyword` out wherever `no-namespace` is on. The double report goes, and declaration
  files lose their only check.
- **B.** Stop shipping `prefer-namespace-keyword`. The double report goes, and declaration files lose their only check,
  as does any file where `no-namespace` is off.
- **C.** Run `prefer-namespace-keyword` only in declaration files. The double report goes, and declaration files keep
  their check. Where `no-namespace` is off, no lint rule reports `module` in other files, though TypeScript 6 still
  rejects it.
- **D.** Keep both. The double report stays.

**Recommended: C.** It is the only option that removes the double report and keeps a check in declaration files, where
nothing else reports `module` once `skipLibCheck` is on.

Where `no-namespace` is on follows Q2: wherever type-safety is listed today, and wherever conventions is under Q2's A.

**Q10. Do you confirm these single placements?**

Each is one rule judged against its own group's test.

| Rule | Now | Proposed | Why |
| --- | --- | --- | --- |
| `@typescript-eslint/prefer-enum-initializers` | correctness | stays | It stops enum values shifting, which is not about type checking. |
| `unicorn/no-negated-array-predicate` | complexity | stays | A readability rewrite. |
| `@typescript-eslint/no-dynamic-delete` | immutability | stays | `delete` is a mutation. |
| `unicorn/no-array-front-mutation` | immutability | stays | It objects to a mutation, and no other test fits it better. |
| `@typescript-eslint/no-deprecated` | modern-js | stays | For a library's or the platform's deprecation, the replacement is the standard successor of a deprecated form, which is modern-js' test. For your own `@deprecated` tags no group fits better. |
| `unicorn/consistent-function-scoping`, `unicorn/no-declarations-before-early-exit` | complexity | stay | Both restructure working code. |
| `n/no-unpublished-bin` | node | modules | A `package.json` check, like the `n/` rules round 1 moved there. Round 1 leaned toward keeping it in node, because bin files are what Node runs. |
| `@typescript-eslint/dot-notation` | conventions | redundancy | `o['a']` → `o.a`: shorter, same language version. You accepted it on 2026-10-11 on a page that proposed conventions. |
| `promise/no-promise-in-callback` | correctness | modern-js | The unhandled-promise bug is `@typescript-eslint/no-floating-promises`' job, which is in correctness. What is left is moving callbacks to promises. |
| `unicorn/prefer-add-event-listener` | browser | conventions | It also fires on Node's `WebSocket`, `MessagePort` and `AbortSignal` (M8), so it is not specific to browsers, and its purpose is a convention. |

- **A.** Confirm all. Four rules move and the rest stay.
- **B.** Change nothing; every rule here stays where it is.
- **C.** Name the ones to reopen, and each comes back as its own card.

**Recommended: A.** Each follows its group's own test, and only four rules move.

**Q11. Should either of two round-1 ideas you never answered be built: a separate "suspicious" group, or a "style" list?**

Round 1 asked whether correctness should be split, with likely-but-not-certain bugs in a "suspicious" group, and whether
a "style" list should hold conventions, naming, comments and ordering. It recommended no to both, and nothing was built.
Your "not needed" of 2026-10-10 was about stability tiers (stable or experimental), not these.

- **A.** No to both; nothing changes.
- **B.** Yes to the split. One more group, so a team can leave out likely-bug checks on their own.
- **C.** Yes to the style list. One more list in every config, so a team can drop all style rules at once.

**Recommended: A.** Both read as strictness levels, and a team can already leave out any single group by removing its
name.

## 5. Corrections to the first draft (review, 2026-10-30)

- `no-array-constructor`: was "the same choice as `unicorn/no-new-array`", in Q1. Now a shortening, in Q3. Why: M6.
- `promise/no-promise-in-callback`: was in Q1. Now in Q10. Why: its own row gives the bug to `no-floating-promises`.
- Q1: was nine rules as the whole set. Now the principle, with the command for the rest. Why: the data marks more.
- Q2: was two bans. Now three, with the enum ban. Why: M7.
- Q4: was a card on leaving react. Now the 2026-10-10 ruling, and a card on one destination. Why: the ruling, and M1.
- `react/no-children-prop`: was "works the same in any `jsx()` runtime". Now: the classic `jsx()` drops it. Why: M1.
- Q6: was "can only silence it one call at a time", and r1 corrected for MessagePort. Now `rules` or `fileOverrides`, and
  r1 holds for ESLint's version. Why: M4.
- Q9: was recommended A. Now C. Why: M5, declaration files.
- `unicorn/prefer-add-event-listener`: was "targets the DOM's `on*` properties", staying in browser. Now conventions.
  Why: M8.
- r1 Q13 and Q14: were settled by the tiers ruling. Now unanswered, Q11. Why: that ruling is about stability tiers.
