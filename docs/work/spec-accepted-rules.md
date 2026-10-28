# Spec: build the lint rules the owner accepted on 2026-10-24, and record every verdict

The 2026-10-24 spec for the rule candidates the owner accepted, and rejected, on the `rc-*` cards, copied
here from the session that wrote it. Its content is kept; paths outside this repository and line numbers are
removed, and the evidence it measured, which stayed in that session, is named by what it is.

Corrections since written (old → new → why):

- `compat/compat` `needs-owner` (lane R's table) → `recommended`, naming card C1 → the owner accepted it in his
  note, and the Done criteria below need it `recommended` (lane R; `docs/work/decisions.md`).
- `RULES_NEEDING_NEWER_NODE` gains all three Node-gated rules → the two unicorn ones now; `e18e/prefer-get-or-insert`
  once lane DEP installs its plugin → `catalog.test.ts` also reads the list and needs each member a RuleId (lane R).
- `unicorn/prefer-iterator-zip`'s "fix" → a suggestion: the rule has `hasSuggestions` and no `fixable` (lane R).
- Pattern 2's helpers, in `changed-settings.integration.test.ts` → `setUpRuleCaseOutcomes` in
  `packages/rule-data/src/__tests__/rule-case-outcomes.ts` → lane T0 moved them there, as it says below.
- Lane DEP installs ten plugins (its table, "Order" phase 2, and "What a consumer sees": "ten plugins become
  dependencies") → nine: eslint-plugin-drizzle-security is held on card `q-lint-dep-drizzle-advisory` ("Cards owed"),
  so lane DRZ and its two rows in "What a consumer sees" wait on that card, not on the phase 2 queue → in a Drizzle
  project, npm nests the plugin under our package with a vulnerable drizzle-orm (lane DEP's measurement; the card).
  `HELD_PLUGINS` in `packages/rule-data/src/eslint-plugins.test.ts` keeps it uninstalled.
- "Current state": `playwright/*` is one `considering` wildcard → gone; each Playwright rule has its own entry → lane
  DEP replaced it, as its step says (`grep -F '"playwright/*"' packages/rule-data/data/rule-candidates.json` is empty).
- Lane A's two measured rules wait on cards A1 and A2, and lane DRZ, with its two rows in "What a consumer sees", on
  `q-lint-dep-drizzle-advisory` ("Cards owed") → all three answered: `unicorn/no-repeated-call-wrappers` ships in
  redundancy, outside test files (its row gains it); `unicorn/no-unnecessary-default-arguments` and both
  `drizzle-security/*` rules are `dropped`, each decided by its card, so lane DRZ builds nothing (its rows deleted) →
  owner 2026-10-24 (`docs/work/decisions.md`).

Owner verdicts 2026-10-24 on the `rc-*` cards (the answers board,
https://claude.ai/artifact/4GpMMzy64wzXqSPZaghWTJ). Every path below is from the repository root. Written by pm,
2026-10-24, read-only (no repo file changed; measurements ran in scratch folders only).

**`<lock>`** means: `flock <the session's lock file> bash -c '<command>'`, run from the repository root.
Every build, typecheck, test, Stryker run and corpus measurement goes through it. **`<S>`** is the lane's scratch
folder.

<goal>
Every `rc-*` verdict is recorded in the repo's data and decision log, and every accepted rule ships in the ruleset
named here, proven to fire on its fixture and stay silent beside it, or stops on a measured reason with a card.

**User story:** As the owner, I want the rules I accepted in my sub-agents' lint, and the ones I rejected recorded
as rejected, so that a later sweep never re-proposes them and agents are held to the accepted guards.
</goal>

<context>

## Why

The owner judged 71 cards with a choice, plus `rc-compat-compat` with a question (count: `jq -r '.answers |
to_entries[] | select(.key|startswith("rc-")) | .value.choice' <answers file> | sort | uniq -c`). Today none of the
accepted rules runs, and the rejected ones still read `needs-owner` or are absent from the data.

## Current state (measured 2026-10-24)

- Shipped rules: `packages/rule-data/data/rules.json`; every rule not shipped: `packages/rule-data/data/rule-candidates.json`
  (statuses `considering`, `recommended`, `parked`, `needs-owner`, `dropped` + `decidedBy`, `not-reviewed`;
  `src/__tests__/cases/candidate-states.ts`). **There is no ledger file in this repo**: these two files are the
  states, and `docs/work/decisions.md` is the decision log.
- Where each verdict's rule sits now: `jq -r '.[] | "\(.status)\t\(.id)"' packages/rule-data/data/rule-candidates.json | grep -E '<id>'`.
  Accepted rules from zod, TanStack, jest-dom, hydration-proof, drizzle-security, compat and 12 Playwright rules have
  **no entry** (their plugins are not installed; `playwright/*` is one `considering` wildcard).
- Node floor: `packages/lint-rules/package.json` `engines.node` is `^22.18.0 || >=24`. Measured: `Uint8Array.prototype.toHex`,
  `Iterator.zip` and `Map.prototype.getOrInsert` are `undefined` on Node 22.23.2 and 23.10.0
  (Node 22.23.2's `node -e 'console.log(typeof Iterator.zip)'`; where it is installed: `CLAUDE.md`, "Environment").
  `fs.statSync(p, { throwIfNoEntry: false })` works on every installed Node (18, 20, 22, 23), so
  `e18e/prefer-throw-if-no-entry` is **not** Node-gated.
- The 8 parked siblings: `RULES_NEEDING_NEWER_NODE` in `packages/rule-data/src/__tests__/cases/round-2-drops.ts`, pinned
  by `rule-candidates.test.ts` ("parks each modern-js rule…"). `unicorn/prefer-uint8array-hex` and
  `unicorn/prefer-iterator-zip` are already `parked` but not in that list.
- Plugin metadata, `npm view <pkg> version peerDependencies peerDependenciesMeta engines`: every new plugin accepts
  ESLint 10; its other peers (`zod`, `drizzle-orm`, `@testing-library/dom`, `typescript`, `oxlint`,
  `@typescript-eslint/parser`) are optional. Measured (the optional-peer probe): npm 10.9.2 on Node 22.23.2 installs
  a package depending on eslint-plugin-drizzle-security, eslint-plugin-zod, eslint-plugin-jest-dom and @e18e/eslint-plugin
  into a project holding drizzle-orm 0.44.7, zod 3.25.76 and @testing-library/dom 9.3.4: exit 0, no peer warning.
- Removed-context-method calls (`getSourceCode`, `getScope`, `getFilename`) in jest-dom, @tanstack/query,
  eslint-comments and @shadcn/lint are all behind a `context.sourceCode` check (read in each package), so none is
  expected to need `PREFIXES_NEEDING_COMPAT` (`packages/lint-rules/src/core/eslint-compat.ts`); a fixture firing on
  ESLint 10.12 is the proof.
- `react-ssr` and `jest-dom` are not opt-in (`ruleset-definitions.json`), so `init` lists them in every new config.
  Measured on the corpus below (the rule runs, `run-rules.mjs`, the accepted rules only, at the pinned versions):
  - **hydration-proof:** 199 of its 239 hits are in 15 projects with no server-rendering framework (no `next`,
    Remix, Gatsby, Astro or similar in any `package.json`), several of them component libraries; 40 are in the 2
    Next.js projects (binance-quiz, react-boilerplate-with-haas-history).
  - **jest-dom:** 423 of its 1,056 hits are in 4 projects with no trace of jest-dom (prisma-modelsection,
    appflowy-web, solid-ui-react, react-datepicker; `grep -rl jest-dom` outside `node_modules` finds nothing). The
    rules autofix, so `check` would rewrite those tests to call matchers the project lacks (appflowy's
    `expect(screen.getByTestId('share-button')).toBeTruthy()` → `.toBeInTheDocument()`), and they fail: the reason the
    owner rejected `prefer-to-have-style`.
  - **The four Playwright twins** report the same line as the shipped `vitest/*` rules in Vitest and Jest test files
    (the Playwright-twins probe; lane PW).

## Desired state

- Rejected rules are `dropped` with `decidedBy` = the card, the owner's word as `why`.
- Node-gated accepts are `parked` and in `RULES_NEEDING_NEWER_NODE`.
- Accepted rules ship (rules.json) in the rulesets below, or wait on a named card, each recorded `recommended` meanwhile.
- `docs/work/decisions.md` carries one dated entry listing every verdict.

## The verdicts, by lane

| Lane | Accepted (ruleset) | Rejected (→ `dropped`, `decidedBy` the card) |
| --- | --- | --- |
| A, installed plugins | `unicorn/no-unnecessary-default-arguments`, `unicorn/no-repeated-call-wrappers`, `unicorn/prefer-logical-operator-over-ternary` (redundancy); `prefer-named-capture-group`, `sonarjs/prefer-native-axios-alternative` (modern-js) | `no-console`, `@typescript-eslint/prefer-includes`, `@typescript-eslint/promise-function-async`, `unicorn/prefer-json-import` |
| CMT, eslint-comments | `@eslint-community/eslint-comments/{disable-enable-pair,no-duplicate-disable,require-description}` (comments; on only where suppressions are allowed) | – |
| ZOD | `zod/{no-coerce-boolean,no-conflicting-checks,no-duplicate-schema-methods,no-empty-custom-schema,no-optional-and-default-together,no-throw-in-refine,no-transform-in-record-key,prefer-trim-before-string-length-checks,require-brand-type-parameter}` (zod) | – |
| TSQ, TanStack | `@tanstack/query/{exhaustive-deps,infinite-query-property-order,no-rest-destructuring,no-unstable-deps,no-void-query-fn,stable-query-client}` (tanstack-query); `@tanstack/router/{create-route-property-order,route-param-names}` (tanstack-router) | – |
| PW, Playwright | `playwright/{no-duplicate-slow,no-element-handle,no-networkidle,no-unnecessary-assertions,no-wait-for-selector,prefer-web-first-assertions,require-to-pass-timeout,valid-test-tags}` (playwright); `playwright/{no-focused-test,no-identical-title,prefer-hooks-on-top,require-to-throw-message}` wait on card P1 | – |
| JD, jest-dom | `jest-dom/{prefer-checked,prefer-empty,prefer-in-document,prefer-pressed,prefer-required,prefer-to-have-attribute,prefer-to-have-class}` (jest-dom); ships after card J1 | `jest-dom/prefer-to-have-style` |
| HP, hydration-proof | `hydration-proof/{no-browser-global-in-render,no-locale-without-explicit-locale,no-storage-in-initial-render,no-timezone-without-explicit-timezone,no-window-render-branch,require-stable-server-snapshot}` (react-ssr); ships after card H1 | – |
| DRZ, drizzle-security | `drizzle-security/no-unsafe-query` (security); `drizzle-security/no-unscoped-mutation` (drizzle) | – |
| E18, e18e | `e18e/prefer-throw-if-no-entry` (node) | – |
| SH, shadcn | `shadcn/no-raw-colors` (tailwind, opt-in) | – |
| CPT, compat | `compat/compat` (browser-targets, opt-in): accepted in principle, default target is card C1 | – |
| EFF, Effect | `anti-slop-effect/no-manual-effect-error-tag`, ported as a house rule into a new Effect ruleset: card E1 | `anti-slop-effect/{no-manual-tag-comparison,no-manual-tagged-construction,no-service-constructor-imports,prefer-effect-match}`, `anti-slop/require-safety-comment-for-type-assertion` |
| R only (record) | Parked, Node-version category: `unicorn/prefer-uint8array-hex`, `unicorn/prefer-iterator-zip`, `e18e/prefer-get-or-insert` | `erasable-syntax-only/*`, `llm-core/no-redundant-comments`, `react-google-translate/no-conditional-text-nodes-with-siblings` |

Card → rule ID: the card id is `rc-` + the rule id with `@` dropped and `/` turned into `-`
(`@tanstack/query/exhaustive-deps` → `rc-tanstack-query-exhaustive-deps`); `rc-erasable-syntax-only` is the plugin
wildcard `erasable-syntax-only/*`. Unanswered and left alone: `rc-bulk-considering`, `rc-bulk-recommended`,
`rc-bulk-rejected` (absent from the answers file).

## The compat answer (owner's note: "can the rule default to including only relevant browsers like the major ones?")

**Yes.** `compat/compat` takes a browserslist query as its option, so the ruleset can ship one. Measured
(the compat measurement, `run-compat.mjs`; eslint-plugin-compat 7.0.2, browserslist 4.29.4, ESLint 10.12.0) on 8,405
JS/TS files: one snapshot of each of the 12 ReactBench workspaces in ai-benchmarking's `results` folder plus every
other project folder beside ai-benchmarking but `cli`, `agents-inc`, `ai-benchmarking` (`roots.txt`, `files2.txt`;
the r1 corpus's shape). 4 projects
(2,437 files) name their own browsers; the rest fall to the default.

| Target the rule is given | Hits where the project names no browsers | Name Opera Mini | Hits in projects naming their own |
| --- | --- | --- | --- |
| none (browserslist's `defaults`; the card's figure) | 1,272 | 1,268 | 211 |
| `defaults and not op_mini all` | 74 (70 name KaiOS) | 0 | 213 |
| `baseline widely available` (Chrome/Edge 124+, Firefox 125+, Safari and iOS 17.4+, current Android Chrome and Firefox; Vite's default build target, `node_modules/vite/dist/node/cli.js`) | 11 | 0 | 211 |
| last 2 versions of Chrome, Firefox, Safari, Edge, iOS Safari, Chrome Android | 10 | 0 | 211 |

All 11 `baseline widely available` hits read (`baseline-noconfig.tsv`): 10 are real gaps (7 unguarded
`requestIdleCallback` and 3 WebCodecs calls in walterlow-freecut, absent in Safari), 1 is defensible
(`new ClipboardItem` inside a Playwright test's `page.evaluate`, run in the test browser). Noise: about 90% Opera Mini at
the default → 0 Opera Mini and 1 of 11 defensible.

**Precedence, as eslint-plugin-compat 7.0.2 resolves it** (`determineTargetsFromConfig` in `lib/esm/src/helpers.js`,
the rule's `create` in `lib/esm/src/rules/compat.js`):

| Layer | Source | Who sets it | Merge |
| --- | --- | --- | --- |
| 1 | ESLint `settings.browsers`, else `settings.targets` | a team's own ESLint config (editor merges only; `agents-inc.lint.mts` has no `settings`) | the first non-empty of 1, 2 is the configured target |
| 2 | the rule's option | ours (the default), or a consumer's `rules` / `fileOverrides` naming its own query; a bare severity keeps ours | |
| 3 | the project's browserslist config, searched from the linted file's folder up (`browserslist` in package.json, `.browserslistrc`, `browserslist`) | the project | found **and** a configured target: the **union** of both; found alone: the project's |
| 4 | browserslist's `defaults` | – | only where neither exists |

So a project naming its own browsers is checked against its list **plus** ours. Measured: it added nothing on the 4
such projects (211 → 211); it would add reports to a project narrower than ours (an Electron app on `last 1 chrome
version`). Whether to accept that or keep our default to projects that name none is in card C1.

</context>

<existing_patterns>

## Pattern files to read before implementing

| Priority | File | Where | Pattern |
| --- | --- | --- | --- |
| 1 | `docs/architecture.md` | "Change a rule" | Ship a rule, stop shipping one, add an ESLint plugin, add a ruleset, add a house rule: the steps and the tests each trips |
| 2 | `packages/rule-data/src/changed-settings.integration.test.ts` | `outcomesOfCase` and the helpers above it; describe "a rule moved to ESLint or newly shipped" | A newly shipped rule run as the catalog ships it, fires on `reportedIn`, silent on `silentIn`, on each engine that may run it |
| 3 | `packages/rule-data/src/__tests__/cases/changed-settings.ts` | `RuleCase`, `StubPackage`, `MOVED_OR_ADDED_CASES` | Case shape: literals only, stub packages for imports |
| 4 | `packages/rule-data/src/__tests__/rule-case-runs.ts` | `shippedSettingsOf`, `eslintOutcomesOf`, `oxlintOutcomesOf` | Runs one rule through the real engines; `whenSuppressions` rules run at their `allowed` setting |
| 5 | `packages/rule-data/data/rules.json` | `unicorn/no-abusive-eslint-disable` | A rule `allowSuppressions` decides: `ruleset` plus `whenSuppressions: { banned: "off", allowed: "on" }` |
| 6 | `packages/rule-data/data/rules.json` | `sonarjs/prefer-native-lodash-alternative`, `regexp/prefer-named-backreference` | Ruleset precedents: deprecated-library successors and named groups go to `modern-js` |
| 7 | `packages/rule-data/data/rule-candidates.json` | the `parked` and `dropped` entries | Entry shapes; `decidedBy` only on `dropped` (`rule-candidates.test.ts`) |
| 8 | `packages/rule-data/src/rule-candidates.test.ts` | "parks each modern-js rule…", "records as dropped exactly…" | The pins R's tester extends |
| 9 | `packages/rule-data/src/eslint-plugins.ts`, `src/generate/eslint-plugin-package-names.ts`, `src/eslint-plugins.test.ts` (`PACKAGE_NAME_BY_PREFIX`) | registry | Registering a plugin; `checkedPlugin` for one whose types do not fit |
| 10 | `packages/lint-rules/src/eslint-fallback.integration.test.ts`, `test-fixtures/eslint-fallback/fixtures.json` | – | Each shipped oxlint-run rule must fire in ESLint without oxlint, or sit on the skip list |
| 11 | `packages/lint-rules/src/packed-install.integration.test.ts` (`PLUGINS_NPM_OVERRIDES_A_PEER_FOR`), `src/__tests__/npm-install-output.ts` | – | The npm warnings a consumer's install shows, pinned |
| 12 | `packages/eslint-plugin-house/src/index.ts`, `src/plugin.test.ts`, any `src/rules/*.test.ts` | – | A house rule: file, test, registration, pinned names (lane EFF) |
| 13 | `packages/lint-rules/src/core/` `keptToFilesATsconfigTakesIn` (architecture step 8) | – | A function in ESLint `files` decided per file: the model for C1 option 2 only |

</existing_patterns>

<technical_requirements>

## Must have

1. **R records every verdict** (lane R below), before any build lane's data step.
2. **Each accepted rule ships** as its lane says, or stops on a measured reason (false alarm, same-problem double
   report, a fix that changes meaning, a fix loop) with the evidence and a card. A stop never removes the
   `recommended` entry.
3. **Proof per rule:** fires on its `reportedIn` file, silent on its `silentIn` file, on each engine that may run it
   (an oxlint rule also in ESLint), through the catalog's shipped settings.
4. **Not already reported:** each rule's `reportedIn` lines run through `check` with every shipped ruleset on; any
   shipped rule reporting the same problem stops the rule (owner's criterion: proved by running, never by name).
5. **Measured before enabling:** the false-alarm rate (volume and rate as two numbers) of
   `unicorn/no-unnecessary-default-arguments`, `unicorn/no-repeated-call-wrappers`, `prefer-named-capture-group`,
   `jest-dom/prefer-pressed`; and the double reports named in each lane.
6. **Node-gated rules stay off** (`parked`) until the Node-version category exists.
7. **Every new dependency pinned exactly** in both `packages/rule-data` and `packages/lint-rules` `dependencies`.

## Should have

1. Each lane lists the findings its rules raise in this repo's own code (it lints itself), for the own-lint programme.
2. The secure-coding measurement for lane DRZ, so the answer is ready when `rc-bulk-recommended` is answered.

## Must NOT have

1. Nothing from the three `rc-bulk-*` cards (unanswered).
2. No change to `no-unneeded-ternary`'s options: the card offered its `defaultAssignment: false` *or* the unicorn rule; the
   owner accepted the unicorn rule.
3. No change to `regexp/prefer-named-capture-group` (`not-reviewed`): the card said only one version ships; the owner
   accepted the core one, and dropping the regexp one is not a verdict anyone gave.
4. No eslint-plugin-es-x or eslint-plugin-baseline-js: the card said "the same decision covers" them, but the owner's
   note names only this rule.
5. No ruleset name, libs domain or house rule ID for Effect before card E1; no compat target before card C1; no
   decision on the four Playwright twins before card P1; no jest-dom or hydration-proof rule shipped, and no change to
   whether `init` lists `jest-dom` or `react-ssr`, before cards J1 and H1.
6. No `withheld-fixes.json` entry, `coveredBy` or `files` scoping that the owner has not ruled on, unless a lane's
   measurement shows it holds and it hides nothing (otherwise a card).
7. No backward-compatibility shim, no `eslint-disable` without proof, no git write (CLAUDE.md).

</technical_requirements>

<constraints>

## Lanes and the files each owns

`rules.json`, `rule-candidates.json`, `src/generated/**` (the generator rewrites them whole), `bun.lock` and the two
`package.json` files are single files every lane's developer step touches. **So testers and measurements run in
parallel, and developer steps that touch those files run one at a time, in the queue below.** A change wanted in a file
another lane owns is reported with the exact change, not made.

| Lane | Tester owns (phase 1, parallel) | Developer owns (its queue turn) |
| --- | --- | --- |
| R record | `packages/rule-data/src/__tests__/cases/dropped-rules.ts`, `…/cases/round-2-drops.ts` | `packages/rule-data/data/rule-candidates.json` (its edits only), `docs/work/decisions.md` |
| T0 case runner (A's tester, first) | `packages/rule-data/src/changed-settings.integration.test.ts`, new `packages/rule-data/src/__tests__/rule-case-outcomes.ts` | – |
| DEP dependencies | `packages/rule-data/src/eslint-plugins.test.ts`; `packages/lint-rules/src/packed-install.integration.test.ts` only if a warning changes | `packages/rule-data/package.json`, `packages/lint-rules/package.json`, `bun.lock`, `packages/rule-data/src/eslint-plugins.ts`, `src/untyped-eslint-plugins.d.ts`, `src/generate/eslint-plugin-package-names.ts`, `packages/lint-rules/src/core/eslint-compat.ts` (only if measured), `rule-candidates.json` (new plugins' other rules), `src/generated/**` |
| A, CMT, ZOD, TSQ, PW, JD, HP, DRZ, E18, SH, CPT | new `packages/rule-data/src/__tests__/cases/accepted-<lane>.ts` and `packages/rule-data/src/accepted-<lane>.integration.test.ts`; plus, A: `packages/lint-rules/test-fixtures/eslint-fallback/**`, `packages/rule-data/src/__tests__/cases/oxlint-rule-triggers.ts` (only if a guard); CMT: the suppression pins (`grep -rln no-abusive-eslint-disable packages/*/src`: `allow-suppressions.test.ts`, `suppression-ban.integration.test.ts`, `define-lint-rules.test-d.ts`, `__tests__/cases/suppression-comments.ts`, and the others it lists) | `rules.json` (its entries), `rule-candidates.json` (its entries), `src/generated/**`, `packages/rule-data/data/oxlint-file-types.json` (A, only if a guard); CPT also its dependency lines and, under C1 option 2, `packages/lint-rules/src/core/**` files it names |
| EFF | `packages/eslint-plugin-house/src/rules/<rule>.test.ts`, `src/plugin.test.ts`, `packages/rule-data/src/canonical-list.test.ts` (pinned ruleset list), `packages/lint-rules/src/__tests__/cases/init-config-texts.ts` | `packages/eslint-plugin-house/src/rules/<rule>.ts`, `src/index.ts`, `packages/rule-data/data/ruleset-definitions.json`, `rules.json`, `rule-candidates.json`, `src/generated/**` |
| DOCS | – | `docs/plan.md`, `docs/architecture.md`, `docs/work/questions.md` (after the codex-keeper lands) |

## Order

| Phase | What | Runs |
| --- | --- | --- |
| 1 | R (tester then developer); T0, then every lane's tester (red cases); every lane's measurements; DEP's measurements | parallel; R and T0 can start now |
| 2 | Queue, one developer at a time: **A** (needs no dependency) → **DEP** (installs eslint-comments, zod, playwright, both TanStack plugins, jest-dom, hydration-proof, drizzle-security, e18e, shadcn) → **CMT → ZOD → TSQ → PW (the eight) → DRZ → E18 → SH** | serial over the shared files |
| 3 | Per lane after its turn: real run, reviewer | parallel |
| 4 | On answers: JD (J1), HP (H1), PW's four twins (P1), CPT (C1; installs compat in its own turn), EFF (E1), any card a measurement raises | queue again |
| 5 | DOCS, then the final gate on a frozen tree | serial |

## Files no lane touches

- Files of the agents working now: `packages/eslint-plugin-house/src/rules/no-throwing-default-in-exhaustive-switch*`,
  `src/repo-own-plugin.ts`, `eslint.config.mjs` (web-developer); `packages/lint-rules/mutation-testing/**`,
  `packages/lint-rules/src/__tests__/collect-time-throws*.ts`, `packages/lint-rules/src/test-collection.test.ts`
  (web-testers); `docs/plan.md`, `docs/work/learnings.md`, `docs/work/questions.md`, `docs/work/status.md`
  (codex-keeper; DOCS waits for it).
- `packages/lint-rules/src/cli/check/withheld-fixes.json` (but J1 option 3), `packages/rule-data/data/ruleset-definitions.json`
  and `packages/lint-rules/src/__tests__/cases/init-config-texts.ts` (but EFF, and JD/HP under option 2 of J1/H1, one at
  a time in phase 4), `agents-inc.lint.mts`, `oxlint.config.mts`: no verdict changes them.

## Technical constraints

- Node 22.18+ for the repo (`node --version`); Node 22.23.2 for npm consumer probes (CLAUDE.md "Environment").
- Case modules hold literals only: the collect-time check now reaches helper modules (owner, q-lint-collect-time-reach).
- Each new test file running an engine carries the engines timeout, as `changed-settings.integration.test.ts` does.
- A rule with an oxlint version runs in oxlint unless oxlint's is measurably worse (then `eslintBecause` with the
  measurement, and its ID into `src/__tests__/cases/routed-to-eslint-for-a-reason.ts`).
- `typed` is measured, not read from the plugin's meta (`build-routing.ts`: some typed rules do not declare it): a rule
  that reports its `reportedIn` file only with type information is `typed: true`.
- No `cd X &&` at the start of a Bash command; git read-only.

## Dependencies

- **Requires:** R before any data flip; DEP before CMT…SH; cards J1, H1, P1, C1, E1 for JD, HP, the four twins, CPT
  and EFF.
- **Blocks:** the next release's notes (section "What a consumer sees"); a minor version bump (docs/release.md: a new
  `error` rule is breaking before 1.0), on the owner's go.

</constraints>

<success_criteria>

## Per lane, before its report

| Criterion | How to verify |
| --- | --- |
| Red first | the lane's new test file run before the data step: each case fails naming its rule (`<lock>` `npx vitest run src/accepted-<lane>.integration.test.ts` from `packages/rule-data`), output kept in `<S>` |
| Green after | the same run after the data step: every case passes |
| Gates | `<lock>` `bun run --cwd packages/rule-data generate`; `<lock>` `bun run build`; `<lock>` `bun run typecheck` (knip first); `<lock>` `bun run test`; unfiltered, output visible, exit code written down. A red test in another lane's file is reported, not fixed |
| A data row is load-bearing | hand break: drop the lane's first shipped entry from `rules.json`, regenerate, its case fails; restore, regenerate, green (recorded) |
| Source lines mutated (EFF; CPT under C1 option 2) | `<lock>` `node scripts/mutate-changed-lines.mts <config> --only <files> --testFiles <specs>` (`docs/work/mutation-testing.md`, "One lane's changed lines"), then, for CPT, the `stryker.static.config.mjs` pass; after a run given `--testFiles`, which the script warns of, re-run it without `--testFiles`; each Survived or NoCoverage gets a test or a measured reason |
| Not already reported | real run (below) of `reportedIn` on today's build: the shipped rules reporting on those lines, each classed same/different problem, in the report |
| Real run | packed install, `init`, fixtures, `check` twice: each `reportedIn` line reported by the lane's rule, nothing of it on `silentIn`, exit 1; the second run rewrites no file and reports the same; tracked in `<S>/real-runs.md` |
| Own-repo findings listed | after `bun run build`: `<lock>` `npx eslint . -f json -o <S>/eslint-after.json`, `<lock>` `npx oxlint --disable-nested-config --format=json > <S>/oxlint-after.json`; the lane's rule IDs' findings (`jq`) listed, not fixed |

## Done (final, frozen tree)

| Criterion | How to verify |
| --- | --- |
| Every rejected rule recorded | `jq -r '.[] \| select(.status=="dropped" and (.decidedBy // "" \| startswith("rc-"))) \| .id' packages/rule-data/data/rule-candidates.json` prints exactly the Rejected column above |
| Node-gated parked | `jq -r '.[] \| select(.status=="parked") \| .id'` includes the three; `RULES_NEEDING_NEWER_NODE` lists them; `rule-candidates.test.ts` green |
| Every accepted rule shipped or waiting | for each Accepted ID: `jq -e --arg id <id> 'any(.[]; .id==$id)' packages/rule-data/data/rules.json`, or its `rule-candidates.json` entry is `recommended` and names its card |
| Generated files fresh | `bun run --cwd packages/rule-data generate` then `git diff --exit-code -- packages/rule-data/src/generated` |
| Gates | `<lock>` `bun run build && bun run typecheck && bun run test` (docs/release.md step 2), output visible |
| Scope | `git diff --stat` touches only the files the lanes own |
| Decision log | `grep -n "Owner 2026-10-24" docs/work/decisions.md` shows R's entry, naming every `rc-*` card with a verdict |

</success_criteria>

<implementation_notes>

## Every lane: the order (CLAUDE.md, "How work gets done")

1. **Re-derive** this spec's rows for the lane (`npm view <pkg> version`, `jq` on the data, the rule's presence in the
   installed plugin). A row that does not describe the tree: stop on it, report command and output, go on.
2. **web-tester** writes the lane's cases (red), and runs the lane's measurements. A measurement that trips a stop
   condition: stop that rule, report with the reproduction; the orchestrator words the card.
3. **web-developer**, in the queue: the data step below; `bun run --cwd packages/rule-data generate`; gates.
4. **Expressive-TypeScript pass** (the `meta-design-expressive-typescript` skill only) on changed TS (T0, EFF, CPT option 2).
5. **Real run** (below). 6. **reviewer** verifies with reproductions. 7. List the doc sentences made false, for DOCS.

Report: corrections (or "nothing"), per rule shipped/stopped with evidence, measurements (volume and false-alarm rate
as two numbers), own-repo findings, cross-lane changes wanted, assertions changed, hardening verdict.

## Shared procedures

- **Case seeds:** the session's `accepted-rule-examples.json` holds, for every rule to build here, the card's `before` (seed for
  `reportedIn`) and `after` (seed for `silentIn`), with the plugin version the candidates page verified them on
  (`verifiedWith`; several are older than the pinned version, so each is re-run). A lane adds a second negative where the
  rule's docs name a shape it must leave alone. The cases named in the lanes below are additions to these seeds.
- **Rule entry** (rules.json, sorted by `id`): `id`; `ruleset`; `engine` (`eslint` for every plugin rule here; `oxlint`
  plus `oxlintName` for the two oxlint-native rules of A); `options: []` unless a lane says otherwise; `typed`
  (measured); no `files`/`ignores` unless a lane's measurement earns them; `assignment`: `{ confidence, alternative?,
  note: "<card id>", by }`, `by` = `owner-2026-10-24` where the card named the ruleset, else `accepted-spec-2026-10-24`.
  Remove the ID's `rule-candidates.json` entry in the same edit.
- **Corpus** for false-alarm reads: the compat measurement's `files2.txt` (made by: one snapshot per task of `find
  <ai-benchmarking>/results -maxdepth 5 -type d -name workspace`, sorted, first per task; plus every project folder
  beside ai-benchmarking but `cli`, `agents-inc`, `ai-benchmarking`, `+types`; JS/TS files, pruning
  `node_modules .git dist build .next coverage out .turbo vendor storybook-static generated __generated__ .yarn`, without
  `*.min.js`, `*.d.ts`, `*.gen.*`, `mockServiceWorker.js`). Run the rule alone with
  the rule runs' `run-rules.mjs <depsDir> <files> <out.jsonl> <package> <prefix> <rule,…>` from a scratch install at the
  pinned version, under `<lock>`. Read every hit if 20 or fewer, else 20 chosen by
  `shuf -n 20 --random-source=<(yes)`. A hit a competent developer would defend is a false alarm (owner's criterion).
- **Stop conditions:** a false alarm in the read sample; a shipped rule reporting the same problem; a fix that
  changes what the code means; a fix loop (the second `check` rewrites a file). Each: stop that rule, keep its
  `recommended` entry, report.
- **Real run:** `<lock>` `bun run build`; `npm pack` in `packages/lint-rules` into `<S>`; a scratch git repo with a
  `package.json`, the tarball installed with Node 22.23.2's npm, `npx agents-inc-lint init`, an opt-in ruleset added
  to `agentRulesets` where the lane's is opt-in, one commit; the fixtures added; `npx agents-inc-lint check`, then
  again. Libraries a rule resolves (zod, @tanstack/react-query, drizzle-orm, @playwright/test) installed there where a
  case needs them. Pattern: `packed-install.integration.test.ts`.

## Lane R: record every verdict (tester, then developer; can start now)

**Tester pins first** (red): `DROPPED_RULES` (`cases/dropped-rules.ts`) gains each Rejected ID → its card id
(e.g. `'no-console': 'rc-no-console'`, `'erasable-syntax-only/*': 'rc-erasable-syntax-only'`); `RULES_NEEDING_NEWER_NODE`
gains `e18e/prefer-get-or-insert`, `unicorn/prefer-iterator-zip`, `unicorn/prefer-uint8array-hex`, the list kept in
ascending order (the test compares it with the file's order).

**Developer** (`rule-candidates.json`, sorted, `recorded: "2026-10-24"`):

| Verdict | `status` | `why` | `evidence` | other |
| --- | --- | --- | --- | --- |
| Rejected | `dropped` | `Owner 2026-10-24: "Reject" (<card id>).` | `docs/work/decisions.md, owner 2026-10-24` then the entry's old evidence, if any | `decidedBy: "<card id>"`; new entries for `erasable-syntax-only/*` and `jest-dom/prefer-to-have-style` |
| Node-gated accept | `parked` | `Owner 2026-10-24: "Accept" (<card id>), into the later category for the newest language features, enabled by Node version; off until then, as the 8 parked 2026-10-11: its fix writes <API>, which Node 22.23 lacks (measured).` | `docs/work/decisions.md, owner 2026-10-24; questions.md "Parked"` | – |
| Accept, not built yet | `recommended` | `Owner 2026-10-24: "Accept" (<card id>); not built yet.` (Effect: add `; ported as a house rule into an Effect ruleset, card E1`) | `docs/work/decisions.md, owner 2026-10-24` then the old evidence | existing entries flipped; new entries for zod, TanStack, jest-dom, hydration-proof, drizzle-security, and the 12 Playwright rules (beside `playwright/*`) |
| compat, no choice | `needs-owner` | `Owner 2026-10-24: "we should accept this but can the rule default to including only relevant browsers like the major ones?" Default target: card C1.` | `docs/work/decisions.md, owner 2026-10-24` | new entry |

**`docs/work/decisions.md`**, one entry at the end, house style: `- Owner 2026-10-24 (board
https://claude.ai/artifact/4GpMMzy64wzXqSPZaghWTJ, the rule-candidate cards): ` then sub-bullets: Accepted, by ruleset
(IDs); Accepted into the Node-version category, parked (IDs, why); Rejected (IDs, recorded `dropped` with the card);
compat/compat (the note verbatim, the measured answer in one line, card C1); Effect (the owner wants an Effect
ruleset, card E1); the three bulk cards unanswered. IDs, no counts.

**Report for DOCS** (codex-keeper owns the file now): `docs/work/questions.md` "Parked by the owner": the item names
"8 modern-js rules"; make it carry the command `jq -r '.[] | select(.status=="parked") | .id'
packages/rule-data/data/rule-candidates.json` instead.

## Lane T0: one case runner for every lane (A's tester, first; small)

Move `inFolder`, `writeStubPackages`, `readBy`, `owedOutcomes`, `owedOutcomesByEngine`, `outcomesOfCase` and the
project set-up of its `beforeAll` (tsconfig, package manifest, `@types/node` and `vitest` links, stub packages) from
`changed-settings.integration.test.ts` into `src/__tests__/rule-case-outcomes.ts`, as a function a describe block calls
(the `setUpCorpusRuns` shape, `packages/lint-rules/src/__tests__/corpus-runs.ts`). No assertion changes; the file's
test inventory before and after is identical (`npx vitest run --reporter=json`).

## Lane DEP: install every new plugin at once (queue, after A)

| Prefix | Package | Version (`npm view <pkg> version`, 2026-10-24) |
| --- | --- | --- |
| `@eslint-community/eslint-comments` | `@eslint-community/eslint-plugin-eslint-comments` | 4.8.1 |
| `zod` | `eslint-plugin-zod` | 5.2.2 (the sweep measured 5.0.1) |
| `playwright` | `eslint-plugin-playwright` | 2.12.1 |
| `@tanstack/query` | `@tanstack/eslint-plugin-query` | 5.104.5 (sweep 5.104.2) |
| `@tanstack/router` | `@tanstack/eslint-plugin-router` | 1.162.0 |
| `jest-dom` | `eslint-plugin-jest-dom` | 5.10.1 |
| `hydration-proof` | `eslint-plugin-hydration-proof` | 1.0.1 |
| `drizzle-security` | `eslint-plugin-drizzle-security` | 1.0.0 |
| `e18e` | `@e18e/eslint-plugin` | 0.8.1 |
| `shadcn` | `@shadcn/lint` | 0.2.3 (sweep 0.2.1) |

compat (`eslint-plugin-compat` 7.0.2) is CPT's, after C1.

- **Tester first:** `PACKAGE_NAME_BY_PREFIX` in `eslint-plugins.test.ts` gains the ten (red).
- **Measure first, in `<S>`:** a packed install (Node 22.23.2 npm) into an empty consumer and one holding zod 3,
  drizzle-orm 0.44 and @testing-library/dom 9: new `npm warn` lines (none expected: the optional-peer probe); `npm audit`
  advisories new against today's (plan.md Open lists today's); `du -sh node_modules` before and after. Any new warning:
  the tester pins it beside `PLUGINS_NPM_OVERRIDES_A_PEER_FOR`. Any install error: stop, card.
- **Developer:** both `dependencies` lists; `bun install`; register each prefix (`checkedPlugin` where the types do not
  fit `ESLint.Plugin`, an `untyped-eslint-plugins.d.ts` module where none are published); package names; a
  `PREFIXES_NEEDING_COMPAT` entry only for a plugin a fixture shows throwing on a removed context method;
  `rule-candidates.json`: every rule of the new plugins without an entry gets `not-reviewed` / `"not reviewed yet"` /
  `"src/generated/routing.json: installed, not shipped"`, except the Playwright rules, which replace `playwright/*` with
  one `considering` entry each carrying the wildcard's `why` and `evidence` (`rc-bulk-considering`, unanswered, lists
  `playwright/*`); regenerate. `rule-candidates.test.ts` names any rule left out.
- No rule ships in this lane: `jq length packages/rule-data/data/rules.json` is unchanged.

## Lane A: rules from plugins already installed (no new dependency; first in the queue)

| Rule | Ruleset | Engine | `by`, confidence, alternative |
| --- | --- | --- | --- |
| `unicorn/no-unnecessary-default-arguments` | redundancy | eslint | accepted-spec, high (the card) |
| `unicorn/no-repeated-call-wrappers` | redundancy | eslint | accepted-spec, low, complexity |
| `unicorn/prefer-logical-operator-over-ternary` | redundancy | oxlint, `unicorn/prefer-logical-operator-over-ternary` | accepted-spec, high (`no-unneeded-ternary` is redundancy) |
| `prefer-named-capture-group` | modern-js | oxlint, `prefer-named-capture-group` | accepted-spec, low, conventions (pattern 6) |
| `sonarjs/prefer-native-axios-alternative` | modern-js | eslint | accepted-spec, high (pattern 6) |

- **Cases:** default arguments: `format(42, 'EUR')` against `function format(n, currency = 'EUR')` reports, `format(42,
  'USD')` silent; call wrappers: every call of a local function wrapped in `Number(...)` reports, one unwrapped call
  silent, an exported function silent; ternary: `name ? name : fallback` reports, `name ? other : fallback` silent; named
  groups: `/(\d{4})/.exec(s)` reports, `/(?<year>\d{4})/` silent; axios: `axios.CancelToken.source()` reports,
  `new AbortController()` silent.
- **ESLint fallback:** the two oxlint rules get `test-fixtures/eslint-fallback/fixtures.json` rows and fixture files
  firing in ESLint, or a measured skip in `eslint-fallback-skips.json` (report the change; DEP's turn is over, A owns it
  in its turn).
- **oxlint file types:** read each oxlint rule's `should_run` at oxc tag `oxlint_v1.87.0`; a guard skipping file types
  goes into `oxlint-file-types.json` with a trigger in `oxlint-rule-triggers.ts`.
- **Measure:** false-alarm reads for the first two and `prefer-named-capture-group` (the card's 733 hits); `no-unneeded-ternary`
  (shipped options) silent on the ternary case; `@typescript-eslint/no-deprecated` silent on the axios case; with
  `regexp/no-unused-capturing-group` (shipped, `allowNamed: true`) on an unused unnamed group, `check` converges in
  one run (the regexp fix makes the group non-capturing; the named-group rule then stays silent).

## Lane CMT: eslint-comments (queue, after DEP)

- Entries: `ruleset: "comments"`, `whenSuppressions: { "banned": "off", "allowed": "on" }`, `options: []`, `by:
  owner-2026-10-24` (the card: "It only matters for teams that set allowSuppressions: true"), exactly as
  `unicorn/no-abusive-eslint-disable` (pattern 5). Reading: the owner's 2026-10-10 rule that the rules `allowSuppressions`
  manages have one place of control applies, so the generated `SuppressionRuleId` gains the three and `rules` refuses
  them by type.
- **Tester pins first:** where suppressions are allowed (top level, and an entry's files) each of the three is on, and
  off where banned, beside the existing four; `define-lint-rules.test-d.ts` refuses each in `rules` (`@ts-expect-error`)
  next to an allowed rule; cases, from each rule's documented invalid and valid examples: a block
  `/* eslint-disable no-debugger */` never re-enabled reports, the same closed by `/* eslint-enable no-debugger */`
  silent; one rule disabled twice for a line reports, once silent; a disable with no `--` reason reports, with
  `-- <why>` silent.
- **Measure (stop condition):** with `allowSuppressions: true`, a duplicate disable, once of an ESLint-run rule and once of
  an oxlint-run rule, through `check` on today's build: does `check` already report one of the pair as unused
  (`unused-suppressions.ts`)? Same problem reported → stop `no-duplicate-disable`, card. Also record
  `disable-enable-pair` beside `unicorn/no-abusive-eslint-disable` on a rule-less `/* eslint-disable */` (different
  problems: name the rules / re-enable them; the owner's 2026-10-11 note allows that).

## Lane ZOD (queue)

- 9 entries, `ruleset: "zod"`, `by: owner-2026-10-24`, high.
- **Cases** per rule from the plugin's docs: `z.coerce.boolean()`; `.min(18).max(10)`; `.trim().trim()`; `z.custom()`;
  `.optional().default(1)`; `refine(() => { throw … })`; `z.record(z.string().transform(…), …)`; `.min(1).trim()`;
  `.brand()`; each with its corrected form silent.
- **Measure:** which import shapes each rule fires on (`import { z } from 'zod'` under zod 3 and 4, `'zod/v4'`,
  `'zod/mini'`); a shape it misses is a written limit, not a stop. Autofixes (where the rule has one) keep the schema's
  meaning; the real run converges.

## Lane TSQ: TanStack (queue)

- `@tanstack/query/*` → `tanstack-query`, `@tanstack/router/*` → `tanstack-router`, `by: owner-2026-10-24`, high.
- **Measure `typed` per rule:** each case run untyped and typed; `no-void-query-fn` is typed (the card); `no-rest-destructuring`
  returns early without a type checker (read in `build/modern/rules-*.js`, `isQueryResultCall`), so measure it.
- **Measure:** `react-hooks/exhaustive-deps` on the `exhaustive-deps` and `no-unstable-deps` cases (different problem
  expected); the two property-order rules with the opt-in `ordering` ruleset on: `perfectionist/sort-objects` may
  reorder the same object back (a fix loop: stop, card).

## Lane PW: Playwright (queue)

- The eight rules → `playwright`, `by: owner-2026-10-24`, high. No `files` (a page-object file outside tests uses `page`).
- **The four twins** (`no-focused-test`, `no-identical-title`, `prefer-hooks-on-top`, `require-to-throw-message`) wait on
  card P1. Measured (the Playwright-twins probe, ESLint 10.12 + eslint-plugin-playwright 2.12.1 + @vitest/eslint-plugin
  1.6.27, and oxlint 1.87's vitest rules): each Playwright twin also reports the same line as the shipped `vitest/*` twin in
  Vitest and Jest-globals test files; the `vitest/*` twins report nothing in a Playwright file; and the Playwright twins
  miss shapes only Vitest has (`it.only`, `test.concurrent.only`, duplicate `it` titles, a hook after an `it`).
- **Measure:** the eight on every Vitest/Jest test file of the corpus and of this repo: any report there is a false
  alarm (stop). `prefer-web-first-assertions`'s fix keeps the assertion's meaning.

## Lane JD: jest-dom (tester and measurements now; data step after card J1)

- 7 entries → `jest-dom`, `by: owner-2026-10-24`, high. No `files` unless the read shows defended hits outside test
  and story files. J1 option 2 also sets `optIn: true` on `jest-dom` in `ruleset-definitions.json`, with `init`'s
  text cases (`packages/lint-rules/src/__tests__/cases/init-config-texts.ts`) and DOCS's plan.md `init` example.
- **Measured for this spec** (the rule runs' `jest-dom.jsonl`): 1,056 hits, 423 of them in 4 projects without jest-dom.
- **Measure:** `prefer-pressed` false-alarm read (`jq 'select(.rule=="jest-dom/prefer-pressed")' jest-dom.jsonl`,
  never read before); `testing-library/prefer-presence-queries` and the shipped `vitest/*` matcher rules on the
  `prefer-in-document` case; in a jest-dom project, each fix keeps the test's verdict.

## Lane DRZ: drizzle-security (queue)

- `no-unsafe-query` → `security` (security wins; it is silent without Drizzle; the card: "would likely sit in the security
  ruleset"), `by: accepted-spec-2026-10-24`, high. `no-unscoped-mutation` → `drizzle` (wiping a table is data loss, not
  an exploit or a leak: the critique's security test), medium, alternative security.
- **Measure (stop condition):** `sonarjs/sql-queries` and `unicorn/no-unsafe-sqlite-interpolation` (shipped, security) on
  the `sql.raw(\`… ${id}\`)` case. **Not a stop:** `secure-coding/no-sql-injection` is not installed or shipped; it is in
  the unanswered `rc-bulk-recommended`. Run it on the same case in `<S>` and put the result in the report, so that
  card's answer has it.

## Lane E18: e18e (queue)

- `e18e/prefer-throw-if-no-entry` → `node` (a Node built-in, the critique's runtime test), `by: accepted-spec-2026-10-24`,
  high, alternative correctness. Untyped (it imports no type helper; `lib/utils/typescript.js` serves eight other rules).
- **Measure:** `sonarjs/no-ignored-exceptions` (shipped, correctness) on `try { statSync(p) } catch { return false }`:
  same problem → stop.

## Lane HP: hydration-proof (tester and measurements now; data step after card H1)

- 6 entries → `react-ssr`, `by: owner-2026-10-24`, high. Single-author 1.0.1 plugin, first published 2026-09-17. H1
  option 2 also sets `optIn: true` on `react-ssr`, as J1 does for `jest-dom`.
- **Measured for this spec** (the rule runs' `hydration-proof.jsonl`): 239 hits, 199 in projects with no server rendering.
- **Measure:** a false-alarm read of the 40 hits in the two Next.js projects (the cards read 8 and 5 of two rules only);
  shipped `react`/`browser` rules on each case: same problem → stop.

## Lane SH: shadcn (queue)

- `shadcn/no-raw-colors` → `tailwind` (opt-in), `by: owner-2026-10-24`, high, defaults (its SVG check cannot be turned
  off, r1).
- **Measure:** the case on a Tailwind v4 project fires and a token class stays silent; `check`'s stderr with `tailwind`
  opted in on a project without a Tailwind v4 theme (r1: theme-load errors reach stderr only): any line there is consumer
  noise, reported with the output.

## Lane CPT: compat (after card C1)

- Its own queue turn: `eslint-plugin-compat` 7.0.2 into both `dependencies`, prefix `compat`; entry `ruleset:
  "browser-targets"`, `options: [<C1's query>]`, `by: owner-2026-10-24`.
- **Cases:** `requestIdleCallback(task)` reports with no browserslist config; `setTimeout(task, 0)` silent; a project
  whose `package.json` names `last 1 chrome version`: under option 1 still reports (pinned as the written limit), under
  option 2 silent.
- **Measure:** `check`'s stderr with stale browserslist data (`BROWSERSLIST_IGNORE_OLD_DATA` and baseline-browser-mapping's
  old-data warning exist in the installed packages); the install-size change (`@mdn/browser-compat-data` is 20.6 MB unpacked,
  `npm view @mdn/browser-compat-data dist.unpackedSize`), on every install whether or not `browser-targets` is listed.
- Written limits: the agent set has no ESLint `settings`, so a project cannot pass `settings.polyfills`; it narrows the
  target through `rules` instead.

## Lane EFF: Effect (after card E1)

- Port `anti-slop-effect/no-manual-effect-error-tag` (github.com/dmmulroy/anti-slop, commit c44ef22) as a house rule,
  reading node `range`, never oxlint's `.start` (r1, "Corrections": upstream rules misfire under typescript-eslint).
  Register in `housePlugin`; `plugin.test.ts` pins the name; entry in the E1 ruleset; the new ruleset in
  `ruleset-definitions.json` (and domain, per E1) with `canonical-list.test.ts`'s pinned list and `init`'s text cases;
  remove the upstream `anti-slop-effect/no-manual-effect-error-tag` candidate entry (its verdict is met by the port).
- **Tests:** a `_tag` comparison inside `Effect.catchAll`'s callback reports; `Effect.catchTag` silent; the same comparison
  outside an Effect handler silent (the upstream claim "fires only inside Effect's catch callbacks").

## Lane DOCS (after the lanes and the codex-keeper)

False sentences only, deleting before rewriting; correction rows where a recorded decision moves:
`docs/plan.md` Decisions, "Suppression comments" row ("these four rules") and `docs/architecture.md` wherever the
`allowSuppressions` set is counted (CMT); plan.md "Considered and dropped", "Target versions (`engines`, `browserslist`)
driving rules … not needed" (CPT: a correction row, old → new → why); plan.md Open, the Node-version item (R's three);
questions.md "Parked" (R's report); plan.md Requirements "npm warnings" (DEP, if changed); plan.md's `init` example and
"Rulesets" table (EFF). The release note's list is the section below.

## Reviewer focus

- `whenSuppressions` exactly as pattern 5; the three refused in `rules` by type, and nothing else's typing changed.
- Every `typed` value backed by an untyped/typed run; every `engine: eslint` on an oxlint-native rule carries `eslintBecause`.
- No `coveredBy`, `files`, `ignores` or withheld fix without a measurement and, where it hides files, a card.
- Each stop carries a reproduction; no stopped rule shipped.
- The Effect port reads `range`; `checkedPlugin` rather than a cast for untyped plugins (CLAUDE.md: no casts but at parse boundaries).

</implementation_notes>

## What a consumer sees (for the release note)

Every rule ships at `error`, so this is a minor bump before 1.0 (docs/release.md). Existing configs that already list
these rulesets get the rules on upgrade; `react-ssr`, `playwright`, `jest-dom`, `zod`, `tanstack-query`, `tanstack-router`
and `drizzle` were created empty on 2026-10-17 and `init` lists them by default.

| Ruleset (list) | Listed by `init` | Rules added |
| --- | --- | --- |
| redundancy (quality) | yes | `unicorn/prefer-logical-operator-over-ternary`; `unicorn/no-repeated-call-wrappers`, outside test and type-test files |
| modern-js (quality) | yes | `prefer-named-capture-group`, `sonarjs/prefer-native-axios-alternative` |
| comments (quality) | yes, but these run only where `allowSuppressions` is true, whatever is listed | `@eslint-community/eslint-comments/disable-enable-pair`, `no-duplicate-disable`, `require-description`; `rules` can no longer name them (a type error), as for the other rules `allowSuppressions` sets |
| zod (libs.validation) | yes | the nine `zod/*` |
| tanstack-query (libs.data), tanstack-router (libs.routing) | yes | the six `@tanstack/query/*`, the two `@tanstack/router/*` |
| playwright (libs.testing) | yes | six of the eight `playwright/*`; `no-unnecessary-assertions` and `prefer-web-first-assertions` wait on cards q-lint-rc-unnecessary-assertions-measured and q-lint-rc-web-first-assertions-measured; the four that repeat a `vitest/*` rule are off by default (card P1), a team turns them on for its Playwright folder in `fileOverrides` |
| jest-dom (libs.testing) | yes, or opt-in per card J1 | the seven `jest-dom/*` |
| react-ssr (libs.ui) | yes, or opt-in per card H1 | the six `hydration-proof/*` |
| node (runtimes) | yes | `e18e/prefer-throw-if-no-entry` |
| tailwind (libs.styling) | opt-in | `shadcn/no-raw-colors` |
| browser-targets (runtimes) | opt-in | `compat/compat`, with a default browser target (card C1) |
| a new Effect ruleset | per E1 | the Effect port (card E1) |

Also: ten plugins become dependencies (eleven with compat); every new plugin's rules become `RuleId`s a consumer may
turn on in `rules`; the install grows (DEP's measurement; compat adds `@mdn/browser-compat-data`, 20.6 MB unpacked).

<questions>

## Cards owed (the owner's; nothing waiting on them is built)

**C1 (`q-lint-compat-default-target`).** *Which browsers should `compat/compat` check by default when you opt into
`browser-targets`?* Measured on the r1-shaped corpus (section "The compat answer").
1. **Major browsers, as Vite targets them (`baseline widely available`), set as the rule's option.** 11 reports where a
   project names no browsers, 1 defensible; a project that names its own browsers is checked against its list *and* this
   one (no change on the 4 such projects measured; an app narrower than ours, e.g. Electron, gets extra reports).
2. **The same browsers, only where a project names none.** A project's own list then stands alone; costs a per-file
   look-up in our ESLint build (as the typed blocks ask each file of its tsconfig).
3. **The last 2 versions of each major browser.** 10 reports, none defensible; misses users still on older iPhones,
   whose Safari updates only with iOS.
4. **browserslist's own default.** 1,272 reports, nearly all Opera Mini.
**Recommended: 1**, because it is the set you named and Vite's default, and the merge measured harmless here; 2 can
follow if a narrow-target project is hurt.

**P1 (`q-lint-playwright-vitest-twins`).** *Four accepted Playwright rules repeat a Vitest rule you ship: in Vitest and
Jest test files both report the same line; in Playwright files only the Playwright one does. How should they ship?*
1. **Ship them everywhere:** two reports of one problem in Vitest/Jest test files of any project listing `tests` and
   `playwright` (both listed by default).
2. **Ship them "covered by" the Vitest rules:** one report everywhere the Vitest rule runs; Playwright files then get
   none of the four in every default config (`tests` is listed by default).
3. **Don't ship them by default:** a team turns them on for its Playwright folder in `fileOverrides` (the plugin's own
   docs scope it by folder); recorded as accepted, off.
**Recommended: 3**, because only the team knows where its Playwright tests live, and 1 doubles reports in every Vitest
file while 2 leaves Playwright files unchecked anyway.

**E1 (`q-lint-effect-ruleset-name`).** *You accepted an Effect ruleset. What do teams type to list it?*
1. **`libs: { effect: ['effect'] }`**: a new domain named after the library, the rule as `house/no-manual-effect-error-tag`.
2. **Under an existing domain, e.g. `data: [..., 'effect']`**.
3. **Another name you give.**
Listed by `init` by default either way (it fires only inside Effect's catch callbacks). **Recommended: 1**, because
Effect fits none of today's domains (ui, testing, forms, styling, data, routing, validation, auth).

**J1 (`q-lint-jest-dom-without-jest-dom`).** *The accepted jest-dom rules also fire in projects that do not use jest-dom,
and `init` lists `jest-dom` in every new config. Should it stay listed?* Measured: 423 of 1,056 corpus hits are in 4
projects with no jest-dom, and the rules' autofixes rewrite those tests to call matchers the project lacks, so they fail.
1. **Keep it listed:** a team without jest-dom removes `jest-dom` from its list; until it does, `check` breaks its tests.
2. **Make `jest-dom` opt-in:** `init` names it in a comment, as `tailwind`; a team using jest-dom adds it. Configs that
   already list it keep it.
3. **Ship the rules with their fixes withheld** (reports only): no broken tests, but the advice is still wrong there.
**Recommended: 2**, because a fix that turns passing tests into failing ones is what you rejected `prefer-to-have-style`
for, and only the team knows whether it uses jest-dom.

**H1 (`q-lint-react-ssr-in-client-apps`).** *The accepted hydration-proof rules fire in React apps that never render on a
server, and `init` lists `react-ssr` in every new config. Should it stay listed?* Measured: 199 of 239 corpus hits are in
projects with no server-rendering framework (some are component libraries, which a user's server may render); 40 are in
the two Next.js projects.
1. **Keep it listed:** a client-only app removes `react-ssr`; until it does, it gets reports with nothing to fix.
2. **Make `react-ssr` opt-in:** `init` names it in a comment; a team that renders on a server adds it.
**Recommended: 2**, because the card's own premise was that every hit is false in a browser-only app, and most corpus
hits are in such apps.

**A1 (`q-lint-rc-default-args-measured`).** *You accepted `unicorn/no-unnecessary-default-arguments` before it was
measured; it mostly flags defaults written out on purpose. Ship it anyway, ship it scoped, or don't ship it?* Lane A's
false-alarm read on the corpus ("Shared procedures"): 72 hits; of 20 read, 17 defensible (`create = false` beside calls
passing `true`, tests stating their inputs), 3 arguable, none clearly redundant. Untyped, it misses calls to imported
functions. This repo: 0 hits.
1. **Don't ship it:** it stays off; nothing changes for consumers.
2. **Ship it outside test files:** still mostly defensible hits (7 of the 8 sampled outside tests).
3. **Ship it anyway:** consumers get every hit, most written on purpose.
**Recommended: 1**, because none of the 20 sampled hits is clearly redundant, scoping doesn't change that, and your
accept was pending this measurement.

**A2 (`q-lint-rc-call-wrappers-measured`).** *You accepted `unicorn/no-repeated-call-wrappers` before it was measured;
every hit is in test files and reads as code people would defend. Ship it anyway, ship it outside test files, or don't
ship it?* Same read: 15 hits, all in test files, all shaped `new Store(makeConfig(…))`, each defensible (a judgement
call); none outside tests, so no measured true positive either. This repo: 1 hit, in a test file.
1. **Ship it outside test files:** no measured false alarm remains; it can still catch a duplicated conversion in source
   code, which the corpus didn't show.
2. **Don't ship it:** it stays off; nothing changes for consumers.
3. **Ship it anyway:** consumers get the test-file hits, all defensible by the sample.
**Recommended: 1**, because every measured false alarm is in tests; outside them the rule costs nothing measured and
keeps the duplication catch you accepted it for.

**`q-lint-dep-drizzle-advisory`.** *eslint-plugin-drizzle-security puts a second, vulnerable drizzle-orm under our
package in Drizzle projects. Install it?* Its optional peer is `drizzle-orm: ^0.29.0 || ^0.30.0 || ^1.0.0`
(`npm view eslint-plugin-drizzle-security@1.0.0 peerDependencies`), which takes no stable release after 0.30. Measured by
lane DEP: beside a project's own newer drizzle-orm, npm nests the plugin under our package with drizzle-orm 0.30.10, and
`npm audit` reports a high SQL-injection advisory (GHSA-gpj5-g38j-94v9) the project's own copy does not have. Nothing
prints at install, and the plugin never loads the copy. A dependency's `overrides` do not reach consumers. Until the
answer, the plugin is not installed and lane DRZ's two rules wait as `recommended`.

## Contingent cards (only if a lane's measurement trips a stop)

- **Any stop** (false alarm, same-problem double, a fix that changes meaning, a fix loop): ship anyway; ship with the
  measured option or scope; don't ship. Volume and false-alarm rate as two numbers, with the hits.

## Readings (mine, with their ground; the owner's to overrule)

- **eslint-comments run only where suppressions are allowed**, through `whenSuppressions`: the accepted cards say so, and
  the precedent `unicorn/no-abusive-eslint-disable` was built this way; the type refusal in `rules` follows the owner's
  2026-10-10 "one place to control it".
- **Ruleset assignments** marked `accepted-spec-2026-10-24` follow `docs/work/ruleset-critique-r1.md`'s tests and the
  data's precedents; plan.md: "Unless the owner reviews them, the first pick stands."
- **Accepted-but-unbuilt rules are `recommended`**, the status closest to "accepted"; `decidedBy` is for `dropped` alone.
- **Lanes merged:** no typescript-eslint rule was accepted, `prefer-named-capture-group` is a core rule, and the unicorn
  and sonarjs rules need no dependency, so they form one lane (A) that can land before any install.
- **Playwright's other rules stay `considering`** when DEP replaces the `playwright/*` wildcard, because the unanswered
  `rc-bulk-considering` lists it.

## Corrections to the brief (old → found → evidence)

- A "typescript-eslint/regex" lane → no typescript-eslint rule was accepted (`rc-typescript-eslint-prefer-includes` and
  `-promise-function-async` are Reject); `prefer-named-capture-group` is a core rule oxlint runs natively
  (`jq '.rules[] | select(.id=="prefer-named-capture-group")' packages/rule-data/src/generated/inventory.json`).
- "The ledger the repo keeps" → this repo has no ledger file; `rules.json` and `rule-candidates.json` are the states
  (`grep -rn -i ledger docs packages/*/src` finds only mentions of ai-benchmarking's).
- "drizzle raw-SQL vs secure-coding/no-sql-injection" as a double report → secure-coding is neither installed nor
  shipped (`jq -r '.[].id' packages/rule-data/data/rules.json | grep secure-coding` is empty); that rule is in the
  unanswered `rc-bulk-recommended`, so no double report can arise now.
- "Every `rc-*` key: choice Accept or Reject" → `rc-compat-compat` has an empty choice and a note; the three bulk cards
  are absent from the answers file.
- "Their 8 siblings on 2026-10-10" → the owner said "we will address later" on 2026-10-10 and shipped them off on
  2026-10-11 (`docs/work/decisions.md`, "third sweep"; `rule-candidates.json` `why` of each `parked` entry).
- "anti-slop/effect" as a lane of several rules → one accepted rule (`no-manual-effect-error-tag`), needing a house port
  and an owner-named ruleset.

</questions>
