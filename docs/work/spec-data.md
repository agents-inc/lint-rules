# Spec: data lane (`packages/rule-data`), the owner's answers of 2026-10-14

Written 2026-10-14 by pm from the joint spec (core + data), then checked by the data lane's pm against today's data, the cards' full text (`scratch-backup/questions-page/items.json`, `remaining-questions/items.json`) and oxlint 1.87. Card IDs are the digest's (`scratch-backup/answers-digest-2026-10-14.md`). Where an answer differs from [spec-next-batch](spec-next-batch.md), the answer wins. The core lane's spec is `docs/work/spec-core.md` in the core copy; section 2 here is the interface both read. Corrections to the joint text: section 9.

**Owns:** `packages/rule-data/**` except `data/eslint-fallback-skips.json` (core's), and this file. Generated files only through `bun run --cwd packages/rule-data generate`. Not lane files: `packages/lint-rules`, `packages/eslint-plugin-house`, every doc but this one (docs are owed at landing, 6.2).

**Order:** tester writes 5.1's tests and watches them fail; developer builds D1 (shape), then D2–D9 (data), regenerates, runs the gate, records the lint-rules fallout (5.3); break-a-line on each new decision point (generator, catalog parse, test walks).

## 1. What changes for a user

- One report per problem for the round 2 pairs: rules dropped (D2), options and scopes changed (D3), and two new relations the core applies: "covered by" (S, D4) and "split by types" (T, D5).
- `consistent-return` and `no-implied-eval` ship (q-r6): JS files and TS files outside every tsconfig get them.
- Without oxlint, ESLint stands in for five `oxc/*` rules (#55, r2-d49-51; D6).
- Blanket suppression comments (`// eslint-disable`, `/* oxlint-disable */`) are reported beside oxlint where suppressions are allowed, by oxlint's `unicorn/no-abusive-eslint-disable` (q-r1). `react-hooks/rule-suppression` runs only where suppressions are allowed (r2-d22). `unicorn/no-for-each` and `unicorn/dom-node-dataset` run in oxlint; beside oxlint a suppression of them names oxlint's spelling (my-renamed-in-eslint). (D7)
- New ruleset `class-names` (libs, styling) holding `house/require-class-helper` (q-r2-class-helper-ruleset, lib-structure). `no-implicit-globals` moves to the `browser` runtime (q70). (D8)
- Tool config files (`vite.config.ts`…) pass `unicorn/no-top-level-side-effects` (q71); `.svelte` files get no `no-undef` (q79). (D3)
- The eight Node-22-unsafe modern-js rules stop shipping (third sweep; D9).

## 2. The interface between the lanes

The data lane owns every file below; the core reads only 2.5.

### 2.1 `data/rules.json`: two optional fields

| Field | On | Shape | Meaning |
| --- | --- | --- | --- |
| `coveredBy` | the narrow rule of an S pair | `{ "rule": "<RuleId>", "because": "<card id>: <one line>" }` | Left out of a layer wherever `rule` is on there |
| `splitByTypesWith` | the untyped rule of a T pair | `{ "rule": "<RuleId>", "because": "<card id>: <one line>" }` | Off where `rule`, a typed rule, runs with type information |

Absent on every other rule. `because` stays in `rules.json` (as `eslintBecause` does); routing carries only the ID.

### 2.2 `data/eslint-stand-ins.json` (new)

`{ "<oxlint-only RuleId>": { "standIn": "<RuleId>", "because": "<card id>: <why, with the measurement>" } }`, keys sorted, exactly D6's five.

### 2.3 `data/ruleset-definitions.json`

Every entry gains `"optIn": false` (none is opt-in yet; `init`, cli lane, reads it). New entry `class-names`: list `libs`, domain `styling`, env `null`, `optIn: false`, after `css-modules`.

### 2.4 Generated `src/generated/routing.json`

`shipped.coveredBy` and `shipped.splitByTypesWith` hold the other rule's ID, present only where `rules.json` gives the field. Nothing else changes shape.

### 2.5 Exported surface of `@workspace/rule-data`

| Type | New member | Value |
| --- | --- | --- |
| `ShippedRule` | `readonly coveredBy: string \| null` | the cover's ID; `null` where none |
| `ShippedRule` | `readonly splitByTypesWith: string \| null` | the typed partner's ID; `null` where none |
| `Catalog` | `readonly eslintStandIns: ReadonlyMap<string, string>` | oxlint-only rule ID → stand-in ID |
| `RulesetDefinition` | `readonly optIn: boolean` | |

Absence in JSON becomes `null` (or no map entry) at the catalog's parse (`parseShippedRule` in `catalog.ts`), by a presence check, not `??`: absence is the documented "none". No other export changes.

### 2.6 What the data guarantees (data tests; the core still throws on a breach)

- **S:** both rules shipped, each in a ruleset (not `alwaysOn`, not `whenSuppressions`), in **different** rulesets (a same-ruleset pair is a drop, as r2-d36 did); the cover differs from the rule and is not itself covered; no T untyped rule is a cover.
- **T:** untyped rule: `typed: false`, ESLint-routed, no `files`/`ignores`, a ruleset, no `coveredBy`. Typed rule: `typed: true`, ESLint-routed, no `files`/`ignores`, a ruleset, neither field. Each typed rule named by one untyped rule.
- **Stand-ins:** each key a shipped oxlint-run rule ESLint has no version of; each stand-in a `RuleId` routed to ESLint, untyped, unshipped, not in `rule-candidates.json`, not on the skip list, used once; every `because` starts with its card ID or questions.md number.

### 2.7 How the core builds before the data lands

The core developer adds 2.5's members to `packages/rule-data/src/catalog.ts` and `src/ruleset-definitions.ts` in the core copy only, with today's values, and nothing else in rule-data but `eslint-fallback-skips.json`. Data's `catalog.ts` must declare exactly those member names and types.

### 2.8 Landing (orchestrator)

1. Data lands first. 2. Core lands; its rule-data `src` hunks (2.7) are checked against 2.5 and dropped; its skip-list hunk lands. 3. Fallout: a tester updates the lint-rules assertions 5.3 lists, and only those; then the gate. The house lane's owed lines land here too.

## 3. Core lane (reads 2.5; details in spec-core.md)

C1 TypeScript import resolver and four import rules without oxlint (q-r3) · C2 applies `coveredBy` · C3 applies `splitByTypesWith` · C4 states `catalog.eslintStandIns` without oxlint · C5 ESLint stubs for oxlint's names of the renamed rules · C6 refuse ESLint below 10 (q-r7) · C7 runtime globals only where our `no-undef` runs (#68) · C8 `basePath: '..'` · C9 typed rules on our `.mts` config files (typed-config-files) · C10 test-runner globals (q76) · C11 packed npm install (#58) · C12 `buildAgentConfigs` · C13 no React warning without React. The data lane edits none of it.

## 4. Data lane items

Each rule change: `rules.json`, then regenerate. A dropped rule leaves `rules.json` only and becomes an unshipped `RuleId` (no candidates entry). New entries carry `assignment: { confidence: "high", note: "<card id>: …", by: "owner-2026-10-14" }`. Engine runs for D3 and D7: 5.1, `changed-settings.integration.test.ts`.

### D1. The shape: fields, stand-ins file, `optIn`

- Generator (`canonical-rules.ts`, `build-routing.ts`, `render-generated.ts`) carries `coveredBy.rule` / `splitByTypesWith.rule` into `shipped` (2.4); `catalog.ts` parses them, loads `eslint-stand-ins.json` into `eslintStandIns`, and `RulesetDefinition` gets `optIn`. Factories (`__tests__/factories/inventory-factories.ts`, `ruleset-definition-factories.ts`) gain the members.
- Tests: `build-routing.test.ts` (field carried where given, absent where not), `catalog.test.ts` (parsed per 2.5, `null` where absent; `eslintStandIns` equals the file), the 2.6 walks as functions with refusal-beside-allowed unit cases (factories), then their offenders lists on the real data (empty).

### D2. Drops (rules leaving `rules.json`)

| Card | Rules | Still reporting (pinned shipped) |
| --- | --- | --- |
| r2-d1 | `react/jsx-key` | `@eslint-react/x-no-missing-key` |
| r2-d2 | `@eslint-react/jsx-no-comment-textnodes` | `react/jsx-no-comment-textnodes` |
| r2-d3 | `react/no-did-mount-set-state`, `no-did-update-set-state`, `no-will-update-set-state` | `@eslint-react/x-no-set-state-in-component-did-mount`, `-did-update`, `-will-update` |
| r2-d4 | `@eslint-react/x-no-component-will-mount`, `x-no-component-will-receive-props`, `x-no-component-will-update`, `x-no-unsafe-component-will-mount`, `x-no-unsafe-component-will-receive-props`, `x-no-unsafe-component-will-update` | `react/no-unsafe` (D3 option) |
| r2-d5 | `react/no-unused-class-component-methods` | `@eslint-react/x-no-unused-class-component-members` |
| r2-d6 | `react/no-unstable-nested-components`, `@eslint-react/x-static-components` | `@eslint-react/x-no-nested-component-definitions`, `x-no-nested-lazy-component-declarations` |
| r2-d7, d8, d9, d10, d13 | `@eslint-react/x-no-unstable-default-props`, `dom-no-dangerously-set-innerhtml-with-children`, `dom-no-void-elements-with-children`, `x-no-unstable-context-value`, `jsx-no-children-prop-with-children` | `react/no-object-type-as-default-prop`, `no-danger-with-children`, `void-dom-elements-no-children`, `jsx-no-constructed-context-values`, `no-children-prop` |
| r2-d11, d12, d15 | `react/iframe-missing-sandbox`, `jsx-no-script-url`, `style-prop-object` | `@eslint-react/dom-no-missing-iframe-sandbox`, `dom-no-script-url`, `dom-no-string-style-prop` |
| r2-d14 | `react/jsx-no-leaked-render` | `@eslint-react/x-no-leaked-conditional-rendering` |
| r2-d18 | `functional/no-class-inheritance`, `react/prefer-stateless-function` | `functional/no-classes` |
| r2-d20 | `react-hooks/set-state-in-effect` | `react-you-might-not-need-an-effect/no-derived-state` |
| r2-d26, d28, d29 | `jsx-a11y/no-aria-hidden-on-focusable`, `anchor-has-content`, `sonarjs/object-alt-content` | `house/no-focusable-content-in-aria-hidden`, `jsx-a11y/control-has-associated-label`, `alt-text` |
| r2-d35, d36, d43 | `@typescript-eslint/prefer-for-of`, `no-non-null-asserted-nullish-coalescing`, `no-unsafe-unary-minus` | `unicorn/no-for-loop`, `@typescript-eslint/no-non-null-assertion`, `sonarjs/non-number-in-arithmetic-expression` |
| r2-d42, d52 | `oxc/bad-object-literal-comparison`, `bad-match-all-arg`, `bad-replace-all-arg` | `no-constant-binary-expression`, `regexp/no-missing-g-flag` |
| r2-d44, d45, d55, d56, d61 | `sonarjs/no-return-type-any`, `class-name`, `call-argument-line`, `array-callback-without-return`, `async-test-assertions` | `@typescript-eslint/no-explicit-any`, `naming-convention`, `no-unexpected-multiline`, `array-callback-return`, `vitest/valid-expect` |
| r2-d47, d64-66 | `regexp/no-legacy-features`, `no-non-standard-flag` | `unicorn/no-nonstandard-builtin-properties`, `no-invalid-regexp` |
| r2-d48, d54 | `promise/no-multiple-resolved`, `prefer-await-to-then` | `unicorn/no-multiple-promise-resolver-calls`, `prefer-await` |
| r2-d53, d69, d77, d80 | `unicorn/require-module-specifiers`, `no-nested-ternary`, `no-this-outside-of-class`, `prefer-reflect-apply` | `import-x/no-empty-named-blocks`, `sonarjs/no-nested-conditional`, `@typescript-eslint/no-invalid-this`, `no-useless-call` |
| r2-c1, c3, c4, c10, n3 (conflicts) | `unicorn/no-useless-recursion`, `no-unnecessary-splice`, `prefer-single-replace`, `sonarjs/shorthand-property-grouping`, `react/prefer-es6-class` | (conflicted with) `house/no-classic-loops`, `unicorn/no-array-front-mutation`, `require-unicode-regexp`, `perfectionist/sort-objects`, `functional/no-classes` |
| r2-d59 | `n/no-extraneous-import`, `n/no-extraneous-require` | `import-x/no-extraneous-dependencies` |
| r2-d76 | `default-case-last` | `perfectionist/sort-switch-case` |
| q-r4 | `import-x/no-rename-default` | (none: dropped as noise) |
| r2-d49-51 | `unicorn/no-invalid-character-comparison`, `no-misrefactored-assignment`, `no-constant-zero-expression` | their `oxc/*` twins; they return as stand-ins (D6) |

- **r2-d7's note** ("for oxlint use oxlint, for ESLint use ESLint"): every still-reporting rule above that oxlint runs has an ESLint version and no skip, so teams without oxlint keep the check. Holds today for all of them (`scripts/check-named-rules.mjs`, pm-data); pinned.
- **Tests:** `canonical-list.test.ts` pin "ships none of the round 2 drops, and ships the rule each leaves reporting" (the table, by card), beside the existing 2026-10-10 pin; one more: each oxlint-run reporter has an ESLint version and is not skipped.
- `oxlint-file-types.json` and `__tests__/cases/oxlint-rule-triggers.ts` **stay**: they describe oxlint's rules, shipped or not (correction 1).

### D3. Options and scope, each proven on its engine

`changed-settings.integration.test.ts` runs each row on every engine that may run it (the routed one; for an oxlint rule also ESLint, which runs it without oxlint), with the settings **read from the catalog**: the "passes" input silent, the "still reports" input reported. Cases in `__tests__/cases/changed-settings.ts`. Where oxlint refuses or does not honour a row, the rule moves to ESLint with `eslintBecause` (owner 2026-10-14; my-d11-ignored) and the row runs there.

| Card | Rule (engine) | Change | Passes | Still reports |
| --- | --- | --- | --- | --- |
| r2-d4 | `react/no-unsafe` (ox) | `[{ "checkAliases": true }]` | `render(){}` | `componentWillMount(){}` (new) and `UNSAFE_componentWillMount(){}`; measured 2 reports vs 1 |
| r2-d19 | `react/jsx-no-bind` (es) | add `"allowBind": true` | `onClick={f.bind(null)}` | `onClick={function () {}}` |
| r2-d46 | `@typescript-eslint/no-deprecated` (es, typed) | `allow`: `{ from: "lib", name: [...] }` entries for `substr`, `trimLeft`, `trimRight`, `keyCode`, `charCode`, `which`, the RegExp legacy statics; Node APIs both rules report on a fixture of `n/no-deprecated-api`'s documented list, by `{ from: "package" }` where a specifier matches | each listed API (and the specific rule reports it: `unicorn/prefer-string-slice`, `prefer-string-trim-start-end`, `prefer-keyboard-event-key`, `no-nonstandard-builtin-properties`, `n/no-deprecated-api`) | a call of a local `/** @deprecated */` function |
| r2-d62 | `@typescript-eslint/no-floating-promises` (es, typed) | `allowForKnownSafeCalls`: `{ from: "package" }` entries for `waitFor`, `waitForElementToBeRemoved`, `findBy*`/`findAllBy*` (8 query types each, listed), userEvent's async methods (listed, for `userEvent.click(el)`), and `name: "__type"` for user-event and for vitest: the methods of the session `userEvent.setup()` returns and vitest's `.resolves`/`.rejects` matchers are anonymous function types (measured, user-event 14.5.2, vitest 5.0.3; call 10) | each listed call, unawaited, both user-event forms | an unawaited promise-returning function of the file's own, named or anonymously typed |
| r2-d62 | `testing-library/await-async-events` (es) | `ignores`: the storybook rules' `files` (`**/*.stories.{ts,tsx,js,jsx,mjs}`, `**/.storybook/**`) | unawaited `userEvent.click(el)` in `a.stories.tsx` | the same in `a.test.tsx` |
| r2-d63 | `testing-library/no-dom-import` (es) | `ignores`: the same two globs | `import { screen } from '@testing-library/dom'` in `a.stories.tsx` | the same in `a.test.tsx` |
| r2-d67 | `no-irregular-whitespace` (ox) | `[{ "skipRegExps": true }]` | NBSP inside `/a b/u` | NBSP between statements. Measured: oxlint honours it (`false` reports in a regex); oxlint's default already skips regexes, so it changes ESLint's result only |
| r2-d71 | `no-unused-vars` (ox; ESLint core on JS, `@typescript-eslint/no-unused-vars` on TS without oxlint) | `[{ "caughtErrors": "none" }]` | unused `catch (error)` | an unused parameter. Measured: honoured |
| r2-c11 | `unicorn/class-reference-in-static-methods` (es) | `[{ "preferThis": false }]` | `class K { static a = 1; static f() { return K.a } }` | a superclass name in a static method (`preferSuper` stays on) |
| r2-c14 | `no-void` (ox) | `[{ "allowAsStatement": true }]` | `void save();` | `const x = void 0`. Measured: honoured |
| r2-c17 | `functional/no-classes` (es) | `[{ "ignoreCodePattern": ["componentDidCatch", "getDerivedStateFromError"] }]` | a class with `componentDidCatch`, and one with `static getDerivedStateFromError` | `class A {}` |
| r2-c17-this | `functional/no-this-expressions` (es) | `ignores: ["**/*{ErrorBoundary,error-boundary}*.{ts,tsx,js,jsx}"]` (call 7.5) | `this.state` in `src/error-boundary.tsx`, `src/AppErrorBoundary.tsx` | `this` in `src/a.tsx` |
| r2-n4 | `sonarjs/function-name` (es) | format `^(UNSAFE_)?[_a-zA-Z][a-zA-Z0-9]*$` | `UNSAFE_componentWillMount() {}` | `bad_name() {}` |
| r2-n5 | `check-file/folder-naming-convention` (es) | `{ "**/": "!(*[ !#$&;<>?\|]*)" }` (`(` `)` removed) | a file in `src/(group)/` | a file in `src/a!b/` |
| q-r2-array-literal-assertions | `@typescript-eslint/consistent-type-assertions` (es) | add `"arrayLiteralTypeAssertions": "never"` | `const a: string[] = []` | `const a = [] as string[]` |
| q71 | `unicorn/no-top-level-side-effects` (es) | `ignores` add `**/*.config.{js,mjs,cjs,ts,mts,cts}` (the three consumer-file entries stay, though two now overlap it: the consumer-files check reads them) | `export default defineConfig({})` in `vite.config.ts`, `x.config.mjs` | the same in `src/setup.ts` |
| q79 | `no-undef` (ox) | `ignores` add `**/*.svelte` | `$count` in `a.svelte` | `undeclared` in `a.js` |

- q71 makes the comment on `consumerConfigFiles` ("ship with exactly these names … as their ignores") false for that rule: fix the sentence.
- An ignores row on oxlint runs as the agent build writes it: the rule on, off in an override whose `files` are the shipped `ignores`.
- **r2-d46 / r2-d62 limit:** an API or call no specifier silences stays reported twice; the developer lists each (with the specifier tried) in the report, for a card. `@testing-library/*` is not installed: the typed fixture project declares stub packages (`node_modules/@testing-library/dom`, `@testing-library/user-event`: `package.json` + `index.d.ts` with the listed names), sources in the cases file.
- **r2-c17-this:** if the corpus check (7.5's command) finds a class error boundary in a file the glob misses, the rule is dropped instead (read-c17-this), and D4's r2-d77 pair is not recorded.

### D4. S pairs (`coveredBy` on the covered rule), the 15 cards with an (S) option chosen

| Card | Covered | Cover |
| --- | --- | --- |
| r2-d16 | `jsx-a11y/aria-props` | `@eslint-react/dom-no-unknown-property` |
| r2-d18 | `@eslint-react/x-no-class-component` | `functional/no-classes` |
| r2-d24 | `react-hooks/globals` | `unicorn/no-top-level-assignment-in-function` |
| r2-d25 | `react-hooks/immutability` | `functional/immutable-data` |
| r2-d35 | `unicorn/no-for-loop`, `guard-for-in`, `@typescript-eslint/no-for-in-array` | `house/no-classic-loops` |
| r2-d36 | `@typescript-eslint/no-non-null-asserted-optional-chain`, `no-confusing-non-null-assertion`, `no-extra-non-null-assertion` | `@typescript-eslint/no-non-null-assertion` |
| r2-d57 | `no-return-assign` only (orchestrator's reading; `no-cond-assign` keeps both: open 8.1) | `sonarjs/no-nested-assignment` |
| r2-d60 | `testing-library/no-debugging-utils` | `sonarjs/no-debug-commands-in-ui-tests` |
| r2-d72 | `no-new`, `no-unused-expressions` | `functional/no-expression-statements` |
| r2-d73 | `@typescript-eslint/no-extraneous-class` | `functional/no-classes` |
| r2-d74 | `unicorn/no-array-sort`, `no-array-reverse`, `no-array-front-mutation` | `functional/immutable-data` |
| r2-d75 | `prefer-const` | `functional/no-let` |
| r2-d77 | `@typescript-eslint/no-invalid-this` (only if `functional/no-this-expressions` still ships) | `functional/no-this-expressions` |
| r2-d78 | `react/prefer-read-only-props` | `functional/prefer-immutable-types` |
| r2-n1 | `sonarjs/prefer-while`, `unicorn/prefer-while-loop-condition` | `house/no-classic-loops` |

- Losses the owner accepted on the card: r2-d25, d74, d78 (cover typed: JS and untyped files get neither), r2-d72 (cover runs on non-hook `.ts` only), r2-d75 (prefer-const's autofix). Not on its card: r2-d36's cover `ignores` test files, so with type-safety on, test files get none of the four (call 7.4).
- **Tests:** `canonical-list.test.ts`: the pairs pinned exactly (`toStrictEqual`, covered → cover); 2.6's S offenders empty.

### D5. T pairs (`splitByTypesWith` on the untyped rule) and q-r6

| Card | Untyped | Typed |
| --- | --- | --- |
| r2-d32 | `unicorn/no-useless-template-literals` | `@typescript-eslint/no-unnecessary-template-expression` |
| r2-d33 | `unicorn/no-unnecessary-boolean-comparison` | `@typescript-eslint/no-unnecessary-boolean-literal-compare` |
| r2-d34 | `unicorn/no-useless-coercion` | `@typescript-eslint/no-unnecessary-type-conversion` |
| r2-d40 | `unicorn/no-await-in-promise-methods` | `@typescript-eslint/await-thenable` |
| r2-d41 | `no-constant-condition` | `@typescript-eslint/no-unnecessary-condition` |
| q-r5 (D31) | `no-throw-literal` | `@typescript-eslint/only-throw-error` |
| q-r6 | `consistent-return` (new: `correctness`, ESLint, `[]`, untyped) | `@typescript-eslint/consistent-return` |
| q-r6 | `no-implied-eval` (new: `security`, ESLint, `[]`, untyped) | `@typescript-eslint/no-implied-eval` |

- `no-constant-condition` and `unicorn/no-await-in-promise-methods` move from oxlint to ESLint (drop `oxlintName`), and `no-implied-eval` ships in ESLint, each with `eslintBecause`: "oxlint cannot tell which files have type information, so beside the typed rule its copy would report twice there (<card>)". Call 7.1. Add the three to `__tests__/cases/routed-to-eslint-for-a-reason.ts` as a third group.
- **Tests:** pairs pinned exactly; 2.6's T offenders empty; each moved or new rule fires on its fixture in ESLint (`changed-settings.integration.test.ts`).

### D6. ESLint stand-ins (#55, r2-d49-51)

| oxlint-only rule | Stand-in | Card, and what `because` records |
| --- | --- | --- |
| `oxc/bad-char-at-comparison` | `unicorn/no-invalid-character-comparison` | r2-d49-51 |
| `oxc/bad-comparison-sequence` | `unicorn/no-chained-comparison` | #55 |
| `oxc/double-comparisons` | `unicorn/no-double-comparison` | #55; silent on `x == y \|\| x < y` (measured, spec-next-batch item 3) |
| `oxc/erasing-op` | `unicorn/no-constant-zero-expression` | r2-d49-51 |
| `oxc/misrefactored-assign-op` | `unicorn/no-misrefactored-assignment` | r2-d49-51 |

- **Tests:** `eslint-stand-ins.test.ts` mirroring `eslint-fallback-skips.test.ts`: the five pairs exactly; 2.6's stand-in offenders empty. In `changed-settings.integration.test.ts`: each pair reports the same fixture (`s.charAt(0) === 'ab'`, `a < b < c`, `x === y || x < y`, `x * 0`, `t += t + n`), the oxc rule in oxlint and the stand-in in ESLint. Core proves the merge states them (C4).

### D7. Suppressions and routing

- **q-r1:** `unicorn/no-abusive-eslint-disable`: `engine: oxlint`, `oxlintName: unicorn/no-abusive-eslint-disable`; `whenSuppressions` and `comments` unchanged; no house mode (#22's is replaced). Measured (oxlint 1.87): reports `// eslint-disable`, `/* eslint-disable */`, `// eslint-disable-line`, `// oxlint-disable-next-line`; silent on `// eslint-disable-next-line no-debugger`. Without oxlint ESLint's version runs, missing the line form (card accepts).
- **r2-d22:** `react-hooks/rule-suppression` gets `whenSuppressions: { "banned": "off", "allowed": "on" }` (keeps `ruleset: react`, unread, as the q-r1 rule keeps `comments`); it joins `SuppressionRuleId`, so `rules` cannot name it; it runs where suppressions are allowed whatever rulesets are listed (call 7.3). q75 (keep it unsilenceable) holds.
- **my-renamed-in-eslint:** `unicorn/no-for-each` (`oxlintName: unicorn/no-array-for-each`) and `unicorn/dom-node-dataset` (`unicorn/prefer-dom-node-dataset`) move to oxlint. Measured: oxlint ignores `// eslint-disable-next-line unicorn/no-for-each` and honours `unicorn/no-array-for-each` (call 7.2).
- **Tests:** in `changed-settings.integration.test.ts`: the q-r1 forms above on oxlint; each renamed rule fires on its fixture in oxlint, and the two suppression spellings behave as measured (a pinned limit). `canonical-list.test.ts`: the three engines and `whenSuppressions` pinned.

### D8. Rulesets

- **lib-structure, q-r2-class-helper-ruleset:** `class-names` (2.3); `house/require-class-helper`: `ruleset: class-names`, ESLint, `[]`, untyped; its `rule-candidates.json` entry goes. The card's other names (`nextjs`, `react-ssr`, `playwright`, `jest-dom`, `tailwind`, `tanstack-query`, `drizzle`, `tanstack-router`, `zod`, `jsonwebtoken`, `browser-targets`) are created with their first rule (call 7.6). The house lane owns the rule's `*Variants` change (q-r2b).
- **q70:** `no-implicit-globals`: `correctness` → `browser` (call 7.7). Its skip entry (core's file) stays.
- **Tests:** `canonical-list.test.ts` "defines the owner's rulesets…" with `class-names` and `optIn: false` on each; pins for both moves. `house/require-class-helper` fires in ESLint (`` className={`a ${b}`} ``).

### D9. The eight modern-js rules (third sweep; spec-next-batch addendum item 2)

`unicorn/prefer-regexp-escape`, `prefer-error-is-error`, `prefer-iterator-concat`, `prefer-uint8array-base64`, `prefer-temporal`, `prefer-get-or-insert-computed`, `prefer-promise-try`, `prefer-dispose` leave `rules.json` and enter `rule-candidates.json` as `parked` (why: "Its fix writes an API Node 22 lacks; the owner shipped it off on 2026-10-11 until a category for the newest language features, enabled by Node version, exists"; evidence: questions.md "Parked", decisions.md third sweep; recorded: build date). Tests: `rule-candidates.test.ts` each `parked`; `catalog.test.ts` each an ESLint `RuleId` with `shipped: null`.

### Unchanged by an answer

r2-d17, d21, d27, d30, d38, d39, d47-sonarjs, d58, d68, d70, d79; r2-c5, c6, c12; r2-n2. (q-r5's "keep it" is D5's `no-throw-literal` pair.)

## 5. Tests

### 5.1 Owed (written first, watched failing)

| File | What |
| --- | --- |
| `canonical-list.test.ts` | 2.6 offenders (S, T); S and T pairs exact; round 2 drops pin; r2-d7 reporters; D7, D8 pins |
| `eslint-stand-ins.test.ts` (new) | D6 |
| `catalog.test.ts` | D1 parse; D9 `RuleId`s |
| `rule-candidates.test.ts` | D9 parked; `house/require-class-helper` gone (already computed by "no rule that also ships") |
| `generate/build-routing.test.ts` | D1 fields carried |
| `changed-settings.integration.test.ts` (new) + `__tests__/cases/changed-settings.ts` | D3 rows, D5/D7/D8 fires-on-engine, D6 twins |
| `generate/generated-files.test.ts` | fresh after regenerate |

Each any/every walk gets an input where any and every differ; each refusal sits beside an allowed case. Card IDs go in comments, never in test names; cases and stub sources in `__tests__/cases/`, built by factories.

### 5.2 Existing rule-data tests the answers make wrong (assertion changes allowed)

| File: test | Card | New assertion |
| --- | --- | --- |
| `catalog.test.ts`: "has no oxlint-routed rule whose rule name differs from its oxlint name's, so one suppression comment works in both engines" | my-renamed-in-eslint | the list is exactly the two renamed rules (a guard: a new rename needs C5's stub check) |
| `catalog.test.ts`: "runs unicorn/no-for-each in ESLint…", "runs unicorn/dom-node-dataset in ESLint…" | my-renamed-in-eslint | `engine: oxlint`, oxlint's name and plugin; spellings unchanged |
| `catalog.test.ts`: "makes house/require-class-helper a RuleId run by ESLint and shipped in no ruleset" | q-r2, lib-structure | shipped in `class-names` |
| `catalog.test.ts`: "ships n/no-unpublished-import with enhanced-resolve's tsconfig option beside its allowModules, and n/no-extraneous-import with no option" | r2-d59 | `n/no-extraneous-import` unshipped |
| `canonical-list.test.ts`: "keys the dataset rule by unicorn's current name and runs it in ESLint…", "keys the for-each rule … runs it in ESLint…" | my-renamed-in-eslint | runs in oxlint under oxlint's name |
| `canonical-list.test.ts`: "defines the owner's rulesets, in the owner's order, each in its list, domain and env" | lib-structure, D1 | `class-names`, `optIn` |
| `consumer-config-files.test.ts`: "gives the rules the consumer files break exactly those files, under any directory, as their shipped ignores" | q71 | `no-top-level-side-effects`: the three consumer files plus the tool-config glob; `sort-objects` unchanged |
| `consumer-config-files.test.ts`: "still report the same code in a file under the name a consumer file had before it became .mts" | q71 | `oxlint.config.ts` is a tool config: only `perfectionist/sort-objects` there |
| `catalog.test.ts`: "keeps no-use-before-define available to enable in oxlint but unshipped, beside a shipped core rule" (missed by this list; found at build) | D1 (2.5) | `no-dupe-class-members`'s `shipped` gains `coveredBy: null, splitByTypesWith: null` |

`generate/build-routing.test.ts` (also missed): its expected routes are built with `buildOxlintRoutingEntry` / `buildEslintRoutingEntry`, typed as the generator's `RoutingEntry` (2.4) rather than the catalog's `RuleRoute`. Type only; every expected value is unchanged.

Expected unchanged (verify, do not edit): `oxlint-spellings.integration.test.ts` (oxlint still refuses `unicorn/no-for-each` as a key), `eslint-fallback-skips.test.ts`, `oxlint-file-types.integration.test.ts`. Any other red test: stop and report.

### 5.3 Expected lint-rules fallout (landing step 3; the data lane's final run gives exact test names, each with its card)

- **Typecheck:** lint-rules' own literals of `ShippedRule`, `RulesetDefinition`, `Catalog` (`__tests__/factories/catalog-factories.ts` and any other) lack 2.5's members until the core lands. Only those errors.
- `test-fixtures/eslint-fallback/fixtures.json`: fixtures of the dropped oxlint rules go (r2-d1, d3, d6, d11, d12, d15, d20, d26, d28, d48, d53, d76) and of the two moved to ESLint (r2-d40, d41); the q-r1 rule and both renamed rules need one.
- Rules used as examples (C0, core tester): `react/jsx-key`, `@eslint-react/jsx-no-comment-textnodes`, `unicorn/no-nested-ternary`, `n/no-extraneous-import`, `oxc/erasing-op` (now with a stand-in), `unicorn/no-for-each` / `no-array-for-each` (`other-eslint-names*`, `eslint-entries-owed.test.ts`, `merge-eslint-config.test.ts`, `cases/eslint-merge-shapes.ts`), `consistent-return` / `no-implied-eval` as unshipped twins (`merge-eslint-config.test.ts`'s `TYPED_EXTENSION` tests and twin-walk `reaches`; after q-r6 no shipped typed extension has an unshipped core twin: that subject needs re-deriving).
- Subject changed: q-r1, r2-d22 (`allow-suppressions.test.ts`, `suppression-ban.integration.test.ts`, `config-errors.test.ts`, `define-lint-rules.type-test.ts`, `cases/suppression-comments.ts`, both equivalence tests); q79 (`framework-globals*`, `svelte-runes*`, `editor-merges.*` Svelte cases); q71 (`consumer-files.integration.test.ts`); `class-names` (`engines.integration.test.ts`, ruleset lists in factories or cases).

## 6. Success criteria, gate, docs

### 6.1 Criteria

| Criterion | How to verify |
| --- | --- |
| Data gate in the lane copy | `bun run build --force`; `bun run typecheck --force` (only 5.3's lint-rules errors); `bunx turbo test --force --continue --concurrency=1 -- --maxWorkers=2`: rule-data and house green, no suite collects zero tests, lint-rules failures only 5.3's, each named with its card |
| No file outside the lane | `sh <lanes>/lane-diff.sh <lanes>/data` lists only `packages/rule-data/**` (not the skip list) and this file |
| Generated files fresh | `generated-files.test.ts` |
| Each new decision point breaks a test | developer breaks each (generator branch, parse, walk) and records the failing test |
| S and T as recorded | `jq` under Commands prints exactly D4's and D5's pairs |

### 6.2 Docs owed at landing (not lane files; only sentences made false)

- plan.md "Rulesets": libs table and domain bullet (`class-names`), the libs test (its styling exception, q-r2), `optIn`, lib-structure names approved, created with their first rule. "Ruleset assignment": `coveredBy`, `splitByTypesWith` (one sentence each, with the `jq`). "Routing": the slice-1 exception "a rule whose ESLint name differs from oxlint's runs in ESLint" is false (C5's limit replaces it); the type-information reason for `eslintBecause`. "Rules under consideration": modern-js parked, class helper shipped. Corrections rows: renamed rules (ESLint → oxlint), #22 house mode → oxlint's unicorn rule, D3's `conventions` → `class-names`. Open: round 2 (what remains: 8.3, r2-d27 re-run, r2-d68), #70, #71, #79, #75, the renamed-rules default (answered: my-renamed-ids), the #54–#56 line's modern-js and stand-in parts, the suppression-ban line on `// eslint-disable`.
- architecture.md "Packages" (rule-data row: the two fields, `eslint-stand-ins.json`, `optIn`) and "Change a rule" (the renamed-rule sentence; S/T fields; stand-ins).
- questions.md #22, #23, #35, #55, #70, #71, #75, #79, and the Parked modern-js entry.

## 7. Calls for the owner (a card each, the same turn)

1. T untyped rules oxlint ran (`no-constant-condition`, `unicorn/no-await-in-promise-methods`) and the new `no-implied-eval` run in ESLint, since oxlint cannot tell where types exist. Alternative: oxlint keeps them, off on every TS file, so TS files outside every tsconfig get neither.
2. Renamed rules in oxlint: beside oxlint a suppression names oxlint's spelling (`unicorn/no-array-for-each`); without oxlint, ours.
3. r2-d22: `react-hooks/rule-suppression` runs, where suppressions are allowed, whatever rulesets are listed (it reports nothing without hooks).
4. r2-d36: the cover skips test files, so with type-safety on, test files lose all four non-null checks (not on the card). Recommend accept (tests allow `!` on purpose); alternative: keep r2-d36's three as doubles.
5. r2-c17-this: error-boundary files are told apart by name, `**/*{ErrorBoundary,error-boundary}*.{ts,tsx,js,jsx}`. Measured: 1 class error boundary in `~/dev` outside `~/dev/cli`, and its name matches (`rg -l -g '!cli/**' -g '!**/node_modules/**' -g '*.{tsx,jsx,ts,js}' -e 'componentDidCatch|getDerivedStateFromError' ~/dev`). A boundary named otherwise still gets reports. Alternative: drop the rule.
6. lib-structure: only `class-names` is created now.
7. q70 read as moving `no-implicit-globals` to `browser`: a project listing both runtimes keeps it everywhere unless an entry drops `browser`; one listing neither loses it.
8. r2-d46, r2-d62: APIs and calls no specifier can silence stay reported twice (listed in the build report).
9. Dropped rules are recorded in no list (unshipped `RuleId`s, not candidates).
10. r2-d62: `{ from: "package", name: "__type" }` for user-event and for vitest allows every unawaited call either package types anonymously, not only `user.click(el)` after `userEvent.setup()` and `.resolves`/`.rejects`. On vitest 3.x the vitest entry misses: there the matchers are `@vitest/expect`'s (measured, vitest 3.2.4). Alternative: leave both forms reported twice.

## 8. Open points for the orchestrator

1. **r2-d57 against the reading:** r2-d57's card names exactly `no-cond-assign` and `no-return-assign` and the owner chose S; the reading keeps `no-cond-assign` because the general card's example was that pair. Built: `no-return-assign` only. Recommend asking; the specific card is the later, narrower answer. Flipping is one `coveredBy` entry.
2. **The owner's note on my-renamed-in-eslint** ("these oxlint rules … should have an ESLint variant switched on in their place") reaches past the five stand-ins: ten shipped `oxc/*` rules have no ESLint version and no stand-in (`bad-array-method-on-arguments`, `bad-min-max-func`, `const-comparisons`, `missing-throw`, `no-accumulating-spread`, `no-async-endpoint-handlers`, `no-map-spread`, `number-arg-out-of-range`, `only-used-in-recursion`, `uninvoked-array-callback`). Recommend a research lane: a measured stand-in per rule, or "none exists" recorded; then a data change.
3. **`no-global-assign` × `no-implicit-globals`** (q-real-run-duplicates, fix round 5) is on no round 2 card; after q70 it remains in `browser` projects. A card.
4. **q-r2-switch-default** ("measure it", one corpus run, then a card) is in no lane. Recommend the research lane, beside #66.
5. **Not in this lane:** plugin upgrades (q-r2-plugin-upgrades; regenerate after), eslint-plugin-jsx-a11y-x, #72/#73 docs, spec-next-batch E2's swap for `default-param-last` and `prefer-promise-reject-errors`, #77 (cli lane), and the docs (6.2).
6. **For the core lane, from this check:** without oxlint, S must also leave out the TS-file swap of a covered core rule (`no-unused-expressions` → `@typescript-eslint/no-unused-expressions`, `tsFileRulesOf`); C3's tests can use the real data's eight pairs after landing.

## 9. Corrections

1. Joint 4.2, "a dropped oxlint rule also leaves `oxlint-file-types.json` and `oxlint-rule-triggers.ts`": false. Both describe oxlint's rules whether we ship them or not (56 of its 94 guarded rules are unshipped today, counted by mapping each guarded oxlint name to its `RuleId` through `inventory.json`); a consumer can still turn a dropped rule on. They stay.
2. Joint 5, "`oxlint-spellings.integration.test.ts` (its list naming the two renamed rules)" made wrong: false. That list is the keys oxlint refuses; routing does not change it.
3. Joint 5 missed: `catalog.test.ts`'s `n/no-extraneous-import` pin (r2-d59), two `consumer-config-files.test.ts` tests (q71), the ruleset-definitions pin (`class-names`, `optIn`), and lint-rules' typecheck in the data copy.
4. Joint 4.3 r2-d67, "measure that it is honoured": measured, honoured (oxlint 1.87); oxlint already skips regexes by default, so the option changes ESLint's result only.
5. Joint 6 gave each lane doc sections; neither lane owns a doc file. Docs are owed at landing (6.2).
6. Joint 4.3 r2-d62/d63 "story files": exactly the storybook rules' `files` globs.
7. From the joint spec, kept: #79 is data, not core; #77 is the cli lane's; `eslint.config.mjs` is JS, so typed-config-files covers the two `.mts` files; cards r2-d73 and r2-d77 name core rules where the shipped ones are `@typescript-eslint/`; the resolver is not installed; D2 (#22's house mode) is replaced by q-r1 and D3's `conventions` by `class-names`.

## Commands

From the lane copy's root.

```sh
# a rule's entry
jq -r --arg id '<rule id>' '.[] | select(.id==$id)' packages/rule-data/data/rules.json
# the S and T pairs
jq -r '.[] | select(.coveredBy) | "\(.id) <- \(.coveredBy.rule)"' packages/rule-data/data/rules.json
jq -r '.[] | select(.splitByTypesWith) | "\(.id) -> \(.splitByTypesWith.rule)"' packages/rule-data/data/rules.json
# every rule this spec names, against today's data (pm-data's script)
node <scratch-backup>/answers-build/pm-data/scripts/check-named-rules.mjs packages/rule-data
# oxlint: an option or a suppression on a fixture
node_modules/.bin/oxlint -c <config.json> --format unix <file>
# regenerate, then the lane's gate
bun run --cwd packages/rule-data generate
sh <lanes>/lane-diff.sh <lanes>/data
```
