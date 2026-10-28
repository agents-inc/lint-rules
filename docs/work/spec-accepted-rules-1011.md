# Spec: build the lint rules the owner accepted on 2026-10-11, and record every verdict

The owner's Accept/Reject verdicts of 2026-10-11 on the old Lint Rule Candidates page
(https://claude.ai/artifact/VR852bgmX4krED5ZEbNawF, its `verdicts` store) were never applied: no accepted rule ships, and
the rejected ones read `recommended` or have no entry. This spec records them and builds the accepts. It is shaped like
[`spec-accepted-rules.md`](spec-accepted-rules.md) (the 2026-10-24 `rc-*` cards) and reuses its shared procedures by
reference. Written by pm, 2026-10-26, read-only: no repo file changed but this one. Every path is from the repository root.

**`<lock>`** means `flock <the session's lint-build lock> bash -c '<command>'`, run from the repository root. Every build,
typecheck, test, Stryker run and corpus measurement goes through it. **`<S>`** is the lane's scratch folder.

<goal>
Every 2026-10-11 verdict is recorded in the repo's data and decision log, and every accepted rule ships as the page
proposed it, proven to fire on its case and stay silent beside it, or stops on a measured reason with a card.

**User story:** As the owner, I want the rules I accepted on the candidates page in my sub-agents' lint, and the ones I
rejected recorded as rejected, so that no later sweep re-proposes them and agents are held to the guards I chose.
</goal>

<context>

## Why

The page stored one verdict per rule (`accept`, `reject`, or empty with a note). The 2026-10-23 bulk cards were built
from the rules with **no** verdict, so these were known and simply never applied. Today every accepted rule is
unshipped, and the rejects still look adoptable.

## Verified 2026-10-26 (lint-rules at `d207f8e`, plus the working tree)

The verdict store (a backup kept in the session) was mapped rule by rule:

- **Shipped:** none. For each ID below, `jq -e --arg id <id> 'any(.[]; .id==$id)' packages/rule-data/data/rules.json`
  fails, and `git log --oneline -S '"id": "<id>"' -- packages/rule-data/data/rules.json` prints nothing (never shipped,
  then removed). No accept ships under another name: no shipped `id` or `oxlintName` shares a rule name with one, but
  `react/no-namespace`, which is a different rule.
- **Accepted, not built:** every ID in the Accepted column below. Each is `recommended` with the 2026-10-10 reason
  `Adopt (r1): …`, except `@typescript-eslint/parameter-properties`, which is `considering` (never measured, r1 §4).
  Command: `jq -r '.[] | "\(.status)\t\(.id)\t\(.why[0:12])"' packages/rule-data/data/rule-candidates.json`.
- **Rejected, not recorded:** `@typescript-eslint/no-unsafe-enum-assignment` and `jsx-a11y/anchor-ambiguous-text` are
  `recommended`; `anti-slop/no-runtime-typeof`, `anti-slop/no-unknown-parameters` and `anti-slop/no-unknown-returns`
  have no entry (anti-slop is not installed).
- **Note only, no verdict (out of scope):** `ai-guard/no-console-in-handler` (on `rc-bulk-considering`),
  `anti-slop/no-known-value-widening` and `anti-slop/no-unsafe-dictionary-type` (on `rc-bulk-rejected`),
  `no-case-declarations` and `unicorn/prefer-escaped-irregular-whitespace` (on `rc-bulk-recommended`). All three cards
  are unanswered.

## Later owner answers that bear on these rules

- **r2-d68, 2026-10-14:** "Keep both, then drop no-hex-escape" (once `unicorn/prefer-literal-ascii` is decided;
  `spec-next-batch.md`, row D68). It was accepted on 2026-10-11, so dropping `unicorn/no-hex-escape` is owed (lane UNI).
- **`rc-erasable-syntax-only`, Reject, 2026-10-24.** The card justified the reject by the accepts ("you accepted the
  namespace and parameter-property rules (not shipped yet), so it would mostly add `export =`"). It agrees with the
  `parameter-properties` and `no-namespace` accepts. No conflict, no card.
- **Owner 2026-10-11 (candidates-page notes, `decisions.md`):** "It's not bad that some lines will have multiple rule
  violations as long as they're not the same violations"; "if this is already covered, don't add it". #35: no duplicate
  reports wanted.
- **Owner 2026-10-14 (my-renamed-in-eslint):** a rule oxlint has runs in oxlint, except where oxlint's version is
  measurably worse.
- **No later card changes any of these rules.** Checked by searching the board export and every older answers page for
  each ID and its `rc-` card id. Only the five note-only rules appear, each on a bulk card.

## What the owner saw when he chose

Each page entry showed r1's proposal: ruleset, engine, options, scoping and false-alarm figures
(`docs/work/rule-candidates-r1.md` §1; the `why` of each entry today). The page's coverage check, refreshed 2026-10-20
against the shipped rules, classed each rule's example as **same problem** or **different problem** against every shipped
rule. It found one accepted rule already reported as the same problem: `unicorn/no-unused-builtin-method-return`, by
`sonarjs/no-ignored-return`. It found `unicorn/no-async-iterator-callback` partly covered: on `forEach` by
`@typescript-eslint/no-misused-promises`, and on `filter`/`some`/`every`/`find` by nothing. The page's data (`before`, `after`, `caught`,
`verifiedWith` per rule) is kept in the session as `data-candidates-refreshed.json`. Its `before`/`after` are each case's
seeds.

## The verdicts, by lane

| Lane | Accepted (ruleset, r1's pick unless marked) | Rejected → `dropped`, `decidedBy: owner-2026-10-11` |
| --- | --- | --- |
| CORE, core rules oxlint runs | `accessor-pairs` (correctness, test files ignored), `no-array-constructor`, `no-empty`, `no-new-wrappers`, `no-self-compare`, `no-sequences`, `radix` (correctness); `no-object-constructor`, `prefer-object-has-own` (modern-js); `no-useless-assignment` (redundancy); `symbol-description` (conventions) | – |
| TSE, typescript-eslint | `@typescript-eslint/consistent-type-exports`, `consistent-type-imports` (`{ disallowTypeAnnotations: false }`), `dot-notation` (`{ allowPrivateClassPropertyAccess: true, allowProtectedClassPropertyAccess: true }`) (conventions); `no-namespace`, `use-unknown-in-catch-callback-variable`, `parameter-properties` (type-safety; **reading**, no r1 pick); `no-unnecessary-qualifier` (redundancy); `prefer-readonly` (immutability); `prefer-string-starts-ends-with` (modern-js) | `@typescript-eslint/no-unsafe-enum-assignment` (his note: "Same as a number of others that are already handled by another rule") |
| SNR, sonarjs | `sonarjs/composite-assertions`, `no-duplicate-parameterized-test-case`, `no-empty-parameterized-test-dataset`, `synchronous-exception-assertions` (tests); `no-duplicated-branches` (correctness, beside `sonarjs/no-all-duplicated-branches`); `no-debounce-throttle-in-render` (react) | – |
| UG, unicorn guards (ESLint) | correctness: `unicorn/no-async-iterator-callback`, `no-conflicting-constraints`, `no-incomplete-accessor-override`, `no-invalid-intl-options`, `no-invalid-property-descriptor`, `no-invalid-response-options`, `no-invalid-temporal-arithmetic`, `no-invalid-url-protocol-comparison`, `no-unsafe-json-serialization`, `no-unused-iterator-helper`, `no-url-in-search-params`, `no-using-resource-escape`, `require-text-decoder-streaming`; security: `unicorn/no-ineffective-csp-directives`, `no-invalid-integrity`; browser: `unicorn/no-invalid-boolean-attribute-value`, `no-invalid-dom-token`, `no-invalid-style-set-property`, `no-prevent-default-in-passive-listener` | – |
| UNI, unicorn | `unicorn/no-unused-builtin-method-return` (correctness); `no-useless-set-construction`, `prefer-single-call` (redundancy); `prefer-at`, `prefer-temporal-conversion` (modern-js); `prefer-literal-ascii` (conventions). Also drops `unicorn/no-hex-escape` (r2-d68) | – |
| HRA, house port | `anti-slop/no-reduce-accumulator-copy`, ported as `house/no-reduce-accumulator-copy` (**reading**) in performance | – |
| R11 only (record) | – | `jsx-a11y/anchor-ambiguous-text`, `anti-slop/no-runtime-typeof`, `anti-slop/no-unknown-parameters`, `anti-slop/no-unknown-returns` |

His notes on three accepts: `unicorn/no-async-iterator-callback`, "If this is already covered don't add this to";
`unicorn/no-invalid-property-descriptor`, "If this is already handled don't add it"; `unicorn/prefer-single-call`, the
multiple-violations note above.

</context>

<existing_patterns>

## Pattern files to read before implementing

| Priority | File | Where | Pattern |
| --- | --- | --- | --- |
| 1 | `docs/work/spec-accepted-rules.md` | "Shared procedures", "Lane A", "Lane EFF" | Corpus, rule runs, real run; shipping installed-plugin rules on both engines; a house port |
| 2 | `docs/architecture.md` | "Change a rule" | Ship, stop shipping, move engines, add a house rule; the offenders `canonical-list.test.ts` lists |
| 3 | `packages/rule-data/src/__tests__/cases/accepted-a.ts`, `src/accepted-a.integration.test.ts` | `ACCEPTED_A_CASES`; the `it.each` over `setUpRuleCaseOutcomes(catalog)` | One lane's cases, run as the catalog ships them, on each engine that may run the rule |
| 4 | `packages/rule-data/src/__tests__/cases/accepted-on-2026-10-24.ts`, `src/accepted-candidates.test.ts`, `src/__tests__/accepted-rules-out-of-place.ts` | `ACCEPTED_ON_2026_10_24`, `acceptedRulesOutOfPlace` | The pin that an accepted rule ships or waits, its `why` naming the decision |
| 5 | `packages/rule-data/src/__tests__/cases/dropped-rules.ts`, `src/rule-candidates.test.ts` | `DROPPED_RULES` (`OWNER_2026_10_10`); "records as dropped exactly…" | A dropped entry pinned to a decision label, not only a card |
| 6 | `packages/rule-data/data/rule-candidates.json` | the `owner-2026-10-10` and `rc-*` dropped entries | Entry shapes: `why`, `decidedBy`, `evidence`, `recorded` |
| 7 | `packages/rule-data/data/rules.json` | `@typescript-eslint/no-this-alias` (`eslintBecause`), `unicorn/no-hex-escape` | An oxlint-skipped file type routed to ESLint with a measured reason; the entry UNI removes |
| 8 | `packages/rule-data/src/__tests__/typescript-eslint-extensions.ts`, `src/__tests__/cases/extension-only-option-fixtures.ts` | `TypescriptEslintExtension` | A typescript-eslint rule extending a core rule (`dot-notation`; the `no-array-constructor` twin) |
| 9 | `packages/rule-data/data/oxlint-file-types.json`, `src/__tests__/cases/oxlint-rule-triggers.ts`, `data/oxlint-refused-options.json` | `typescript/parameter-properties` trigger | oxlint file-type guards; options oxlint takes but does not honour |
| 10 | `packages/lint-rules/test-fixtures/eslint-fallback/fixtures.json`, `src/eslint-fallback.integration.test.ts` | – | Each shipped oxlint rule fires in ESLint without oxlint, or sits on the skip list |
| 11 | `packages/rule-data/src/__tests__/cases/test-file-globs.ts` | – | `ignores` naming test files lists every test-file glob (an offender otherwise) |
| 12 | `packages/eslint-plugin-house/src/index.ts`, `src/plugin.test.ts`, any `src/rules/*.test.ts` | `housePlugin` | A house rule: file, test, registration, pinned names (HRA) |

</existing_patterns>

<technical_requirements>

## Must have

1. **R11 records every verdict** before any build lane's data step.
2. **Each accepted rule ships as the page proposed** (ruleset, engine, options, scoping), or stops on a measured reason
   with a card. A stop never removes its `recommended` entry.
3. **Proof per rule:** fires on its `reportedIn`, silent on its `silentIn`, on each engine that may run it, through the
   catalog's shipped settings.
4. **Not already reported, run, never by name:** each rule's `reportedIn` through `check` with every shipped ruleset on;
   each shipped rule reporting there is classed same or different problem. Run each pair below on purpose. Same problem
   → stop.
5. **Measured before enabling:** a false-alarm read (volume and rate as two numbers) for every rule r1 found hits for,
   and the first one ever for `@typescript-eslint/parameter-properties`.
6. **Engines:** an untyped rule oxlint has runs in oxlint (owner 2026-10-14) unless measurably worse there (then
   `eslintBecause` with the measurement, and its ID in `routed-to-eslint-for-a-reason.ts`). A rule reporting its case
   only with type information is `typed: true` in ESLint, as the 91 typed rules shipped today are
   (`jq '[.[] | select(.typed)] | length' packages/rule-data/data/rules.json`, 2026-10-26).
7. **No Node-gated fix:** a rule whose fix or suggestion writes an API Node 22.18 lacks is `parked` instead, as the
   modern-js eight (measured per rule; none is expected, since each of these fires only on code already using the API).
8. **`unicorn/no-hex-escape` dropped**, decided by `r2-d68`, in UNI's data step.

## Should have

1. Each lane lists the findings its rules raise in this repo's own code, for the own-lint programme.

## Must NOT have

1. Nothing for the five note-only rules. Their bulk cards are unanswered (and three of the notes are questions those
   cards do not answer: reported to the orchestrator).
2. Nothing from `rc-bulk-*`; no change to `rc-*` rules (`spec-accepted-rules.md` owns them).
3. No core `dot-notation`, no `unicorn/prefer-string-starts-ends-with` (r1: "never core dot-notation", "ship only this
   version"), and no `@typescript-eslint/no-array-constructor` shipped as a rule of its own (no verdict names it). Any of
   them as an ESLint fallback twin goes only where existing precedent puts one.
4. No new ruleset or domain. Every ruleset named above exists (`jq -r '.[].name'
   packages/rule-data/data/ruleset-definitions.json`).
5. No `files`, `ignores`, `coveredBy` or withheld fix beyond what the page showed (`accessor-pairs`' test-file ignores),
   unless a measurement shows it holds and hides nothing; otherwise a card.
6. No backward-compatibility shim, no `eslint-disable` without proof, no git write (CLAUDE.md).

</technical_requirements>

<constraints>

## Lanes and the files each owns

`rules.json`, `rule-candidates.json`, `src/generated/**`, `eslint-fallback/fixtures.json`, `oxlint-file-types.json` and
`oxlint-rule-triggers.ts` are shared. **Testers and measurements run in parallel. Any step touching a shared file runs
one lane at a time, in the queue below.** A change wanted in another lane's file is reported, not made.

| Lane | Tester owns (phase 1, parallel unless shared) | Developer owns (its queue turn) |
| --- | --- | --- |
| R11 record | new `packages/rule-data/src/__tests__/cases/accepted-on-2026-10-11.ts`; `src/accepted-candidates.test.ts` (a new describe only); `src/__tests__/cases/dropped-rules.ts` (its five entries) | `rule-candidates.json` (its entries), `docs/work/decisions.md` (one entry, after the decisions-entries lane's edit lands) |
| CORE, TSE, SNR, UG, UNI | new `packages/rule-data/src/__tests__/cases/accepted-1011-<lane>.ts` and `src/accepted-1011-<lane>.integration.test.ts`; in their turn: `eslint-fallback/fixtures.json` rows and new fixture files (CORE, TSE, UNI), `oxlint-rule-triggers.ts` (if a guard) | `rules.json` (its entries), `rule-candidates.json` (its entries), `src/generated/**`, `oxlint-file-types.json` and `eslint-fallback-skips.json` (if measured); UNI also `dropped-rules.ts` (`unicorn/no-hex-escape`); TSE also `routed-to-eslint-for-a-reason.ts` (if measured) |
| HRA | `packages/eslint-plugin-house/src/rules/no-reduce-accumulator-copy.test.ts`, `src/plugin.test.ts`, the key of its row in `accepted-on-2026-10-11.ts` (moved to the house ID: an assertion change, reported) | `packages/eslint-plugin-house/src/rules/no-reduce-accumulator-copy.ts`, `src/index.ts`, `rules.json`, `rule-candidates.json` (removes the upstream entry), `src/generated/**` |
| DOCS11 | – | `docs/plan.md`, `docs/work/questions.md`, `docs/work/status.md` (false sentences only) |

## Order

| Phase | What | Runs |
| --- | --- | --- |
| 1 | R11's tester; every lane's tester (red cases) and measurements | parallel, now; shared tester files one lane at a time |
| 2 | Developer queue, one at a time: **R11** (no rule ships), then **CORE → TSE → SNR → UG → UNI**, after the 2026-10-24 stream's data turns or interleaved with them at the orchestrator's call | serial over the shared files |
| 3 | **HRA**, after HOUSE-R7 and lane EFF have landed (both edit `packages/eslint-plugin-house/**`) | serial |
| 4 | Per lane after its turn: real run, reviewer | parallel |
| 5 | Contingent cards' answers: queue again | serial |
| 6 | DOCS11 (or folded into `spec-accepted-rules.md`'s DOCS lane), then the Done check on a frozen tree | serial |

## Files no lane touches

- The files of the lanes working now (`git status --short` at dispatch): `packages/eslint-plugin-house/**` (HOUSE-R7;
  HRA waits), `canonical-list.test.ts`, `held-plugins*.ts`, `accepted-cmt*`, the suppression pins,
  `docs/work/decisions.md` (until its current edit lands).
- `accepted-on-2026-10-24.ts`, `accepted-a.ts`, `ruleset-definitions.json`, `init-config-texts.ts`,
  `withheld-fixes.json`, `agents-inc.lint.mts`, `oxlint.config.mts`: no verdict here changes them.

## Technical constraints

- Node 22.18+ for the repo; Node 22.23.2's npm for the real run's consumer (CLAUDE.md "Environment").
- Case modules hold literals only (the collect-time check reaches helper modules).
- Each new engine-running test file carries the engines timeout, as `accepted-a.integration.test.ts` does.
- An oxlint rule carries neither `files` nor `typed`. `ignores` naming test files lists every test-file glob.
- `typed` is measured (untyped and typed runs of the case), not read from the plugin's meta.
- No `cd X &&` at the start of a Bash command; git read-only; no machine paths in tracked files.

## Dependencies

- **Requires:** R11 before any data step; HOUSE-R7 and EFF before HRA; the decisions-entries lane before R11's
  `decisions.md` entry.
- **Blocks:** the next release's notes ("What a consumer sees"); a minor bump (`docs/release.md`: a new `error` rule
  is breaking before 1.0), on the owner's go.

</constraints>

<success_criteria>

## Per lane, before its report

| Criterion | How to verify |
| --- | --- |
| Red first | `<lock>` `npx vitest run src/accepted-1011-<lane>.integration.test.ts` (from `packages/rule-data`) before the data step: each case fails naming its rule; output kept in `<S>` |
| Green after | the same run after the data step: every case passes |
| Gates | `<lock>` `bun run --cwd packages/rule-data generate`; `<lock>` `bun run build`; `<lock>` `bun run typecheck`; `<lock>` `bun run test`. Unfiltered, output visible, exit codes written down. A red in another lane's file is reported as others' red, not fixed |
| A data row is load-bearing | hand break: remove the lane's first shipped entry, regenerate, its case and the 2026-10-11 accepted pin fail; restore, regenerate, green |
| Not already reported | the lane's pairs below and every shipped rule reporting on `reportedIn`, each classed same/different, in the report |
| False alarms | per `spec-accepted-rules.md` "Shared procedures" (corpus, `run-rules.mjs`, 20 hits read by `shuf -n 20 --random-source=<(yes)`). Stop: a kind of false alarm the page did not show, or a rate above the page's (r1 §1) |
| Real run | as `spec-accepted-rules.md` "Shared procedures": packed install, `init`, cases, `check` twice; each `reportedIn` reported, `silentIn` silent, exit 1; the second run rewrites nothing; tracked in `<S>/real-runs.md` |
| Source lines mutated (HRA only) | `<lock>` `node scripts/mutate-changed-lines.mts <config> --only <files> --testFiles <specs>`, then without `--testFiles`; each Survived or NoCoverage gets a test or a measured reason |
| Own-repo findings listed | after `bun run build`: `<lock>` `npx eslint . -f json -o <S>/eslint-after.json`, `<lock>` `npx oxlint --disable-nested-config --format=json > <S>/oxlint-after.json`; the lane's rule IDs' findings listed, not fixed |

## Done (final, frozen tree)

| Criterion | How to verify |
| --- | --- |
| Every 2026-10-11 reject recorded | `jq -r '.[] \| select(.decidedBy=="owner-2026-10-11") \| .id' packages/rule-data/data/rule-candidates.json` prints exactly the Rejected column, plus either noted rule dropped under its owner's note (UG) |
| Every accept shipped or waiting | `accepted-candidates.test.ts`, "the rules the owner accepted on 2026-10-11": green; for each Accepted ID, it ships or its entry is `recommended` naming `owner-2026-10-11` and any card it waits on |
| no-hex-escape dropped | `jq -e 'any(.[]; .id=="unicorn/no-hex-escape")' packages/rule-data/data/rules.json` fails; its candidate entry is `dropped`, `decidedBy: "r2-d68"` |
| Note-only rules untouched | `git diff <base> -- packages/rule-data/data/rule-candidates.json` changes none of the five note-only IDs |
| Generated files fresh | `bun run --cwd packages/rule-data generate` then `git diff --exit-code -- packages/rule-data/src/generated` |
| Gates | `<lock>` `bun run build && bun run typecheck && bun run test` (`docs/release.md` step 2), output visible |
| Scope | `git diff --stat` touches only the files the lanes own |
| Decision log | `grep -n "Owner 2026-10-11 (old candidates page" docs/work/decisions.md` shows R11's entry |

</success_criteria>

<implementation_notes>

## Every lane: the order (CLAUDE.md, "How work gets done")

1. **Re-derive** the lane's rows (`jq` on the data, the inventory's `oxlint`/`eslint` for each ID in
   `src/generated/inventory.json`, the rule in the installed plugin). A row that does not describe the tree: stop on
   it, report command and output, go on.
2. **web-tester** writes the cases (red) and runs the measurements. A stop: report it with the reproduction; the
   orchestrator words the card.
3. **web-developer**, in its queue turn: the data step; `bun run --cwd packages/rule-data generate`; gates.
4. **Expressive-TypeScript pass** (`meta-design-expressive-typescript` only) on changed TS: R11's helper use, HRA.
5. **Real run.** 6. **reviewer** verifies with reproductions. 7. List the doc sentences made false, for DOCS11.

Report: corrections (or "nothing"); per rule shipped or stopped, with evidence; measurements (volume and rate, two
numbers); own-repo findings; cross-lane changes wanted; assertions changed; hardening verdict.

## Shared

- **Case seeds:** the page's `before` (seed for `reportedIn`) and `after` (seed for `silentIn`), each re-run at today's
  pinned version. A lane adds a second negative where the rule's docs name a shape it leaves alone, and a `.js` copy of
  the report case for each oxlint rule (ESLint fallback, oxlint file types).
- **Rule entry** (`rules.json`, sorted by `id`): `ruleset` above; `engine` per Must have 6; `oxlintName` exactly when
  oxlint runs it; `options` from the page (else `[]`); `typed` measured; `assignment`: `{ confidence, alternative?,
  note: "owner-2026-10-11, candidates page", by: "accepted-spec-2026-10-26" }`. Remove the ID's
  `rule-candidates.json` entry in the same edit.
- **Stops** keep the `recommended` entry, and the report carries a reproduction. A same-problem pair, a false alarm
  past the page's, a fix that changes meaning, or a fix loop (the second `check` rewrites a file) each stops the rule.

## Lane R11: record every verdict (tester, then developer)

**Tester pins first (red):**

- New `ACCEPTED_ON_2026_10_11` in `cases/accepted-on-2026-10-11.ts`: every Accepted ID →
  `{ card: 'owner-2026-10-11', waitsAs: 'recommended' }`, with the upstream ID `anti-slop/no-reduce-accumulator-copy`
  until HRA lands.
- `accepted-candidates.test.ts` gains a describe, "the rules the owner accepted on 2026-10-11", running
  `acceptedRulesOutOfPlace(ACCEPTED_ON_2026_10_11, …)` exactly as the 2026-10-24 one does.
- `DROPPED_RULES` gains the five Rejected IDs → `'owner-2026-10-11'`, as a named constant like `OWNER_2026_10_10`.

**Developer** (`rule-candidates.json`, sorted, `recorded` = the day it lands):

| Verdict | `status` | `why` | `evidence` | other |
| --- | --- | --- | --- | --- |
| Accept | `recommended` | `Owner 2026-10-11: "accept" (owner-2026-10-11, the candidates page); not built yet.`, plus ` His note: "<note>".` on the three noted rules | `docs/work/decisions.md, owner 2026-10-11` then the old evidence | `parameter-properties` moves from `considering` |
| Reject | `dropped` | `Owner 2026-10-11: "reject" (owner-2026-10-11, the candidates page).`, plus his note on `no-unsafe-enum-assignment` | `docs/work/decisions.md, owner 2026-10-11` then the old evidence (`docs/work/rule-candidates-r1.md` §3 for the anti-slop three) | `decidedBy: "owner-2026-10-11"`; new entries for the anti-slop three |

**`docs/work/decisions.md`**, one entry at the end, house style: `- Owner 2026-10-11 (old candidates page
https://claude.ai/artifact/VR852bgmX4krED5ZEbNawF, its Accept/Reject verdicts; recorded <date>):` then sub-bullets with
IDs and no counts: Accepted, by ruleset; his three notes, verbatim; Rejected (recorded `dropped`); no verdict, a note
only (the five, left to their bulk cards); and the knock-on, r2-d68 → `unicorn/no-hex-escape` dropped in lane UNI.

## Lane CORE: core rules oxlint runs (queue)

All eleven have an untyped oxlint version (`jq '.rules[] | select(.id=="<id>") | .oxlint' src/generated/inventory.json`),
so `engine: "oxlint"`, `oxlintName` the same ID.

- **ESLint fallback:** a `fixtures.json` row and fixture file per rule, firing in ESLint without oxlint, or a measured
  skip. `no-array-constructor`'s oxlint rule also answers for `@typescript-eslint/no-array-constructor`
  (`eslintAliases`). Its ESLint fallback on TS files follows the extension precedent (pattern 8); measure
  `new Array<string>(1, 2)` both ways.
- **oxlint file types:** read each rule's `should_run` at oxc tag `oxlint_v1.87.0`. A guard goes into
  `oxlint-file-types.json` with a trigger. If ESLint's version reports where oxlint skips, route it as pattern 7.
- `no-useless-assignment` is in oxlint's `nursery` category. Prove it runs through the catalog's oxlint config at 1.87.
- **Pairs to run:** `no-useless-assignment` × `sonarjs/no-dead-store` and `sonarjs/no-redundant-assignments` (r1: the
  first reports some of its hits); `accessor-pairs` × `unicorn/no-incomplete-accessor-override` (UG) on a subclass
  setter; `no-sequences` × `no-unused-expressions` on the statement form; `no-empty` after
  `unicorn/prefer-optional-catch-binding`'s fix (`catch (e) {}` → `catch {}`): `check` converges.
- **Measure:** false-alarm reads for `radix`, `no-empty`, `no-useless-assignment`, `prefer-object-has-own`,
  `accessor-pairs` (its test-file `ignores` applied, every test-file glob), `no-sequences`.

## Lane TSE: typescript-eslint (queue)

| Rule | Engine | Notes |
| --- | --- | --- |
| `consistent-type-exports`, `dot-notation`, `no-unnecessary-qualifier`, `prefer-readonly`, `prefer-string-starts-ends-with`, `use-unknown-in-catch-callback-variable` | eslint, typed (measure each) | oxlint's versions are type-aware only, so no `eslintBecause` (an offender, `docs/architecture.md`) |
| `consistent-type-imports`, `no-namespace`, `parameter-properties` | oxlint (`typescript/<name>`) | – |

- **Options:** prove oxlint honours `disallowTypeAnnotations: false` on `consistent-type-imports` (the inline
  `import('./x').T` case: silent with it, reported without). If it is accepted and not honoured, record it as
  `oxlint-refused-options.json` does and route to ESLint with the measurement. `dot-notation`'s options go to the
  extension; core `dot-notation` stays unshipped (`not-reviewed`).
- **Measure:** `consistent-type-imports`' fix with the opt-in `import-order` ruleset on: `check` converges (r1: the fix
  trips `import-x/order`). `parameter-properties`: first volume and false-alarm read, and its existing oxlint guard
  (`typescript/parameter-properties` in `oxlint-file-types.json`). `prefer-readonly` and `parameter-properties` against
  `functional/no-classes` (different problem expected). `no-namespace` against the enum ban (`no-restricted-syntax`).
- **Typed cases** run where a tsconfig takes the file in (as shipped typed rules do).

## Lane SNR: sonarjs (queue)

- All ESLint; `synchronous-exception-assertions` is typed per the inventory (measure).
- **Pairs to run:** `no-duplicated-branches` × `sonarjs/no-all-duplicated-branches` (moved together, r1);
  `synchronous-exception-assertions` × `vitest/require-to-throw-message` and the shipped `vitest/*` matcher rules;
  `composite-assertions` × the shipped `vitest/*` rules.
- **Measure:** `no-duplicated-branches`' false-alarm read. The page showed per-case comments and symmetric clamps as
  the false alarms the owner accepted; another kind stops it.

## Lane UG: unicorn guards (queue)

- All ESLint, untyped (measure). r1 found no corpus hits for any of them, so the proof is the cases and the real run.
- **The two noted rules.** If a shipped rule reports the same problem on every shape the rule reports, the rule is
  recorded `dropped` with `decidedBy: "owner-2026-10-11"` and his note as the reason (his own conditional verdict, no
  card). If the cover is partial (`no-async-iterator-callback` on `forEach`: `@typescript-eslint/no-misused-promises`),
  it ships if nothing reports the remaining shapes, and the double on the covered shape goes to a contingent card.
- **Pairs to run:** `no-incomplete-accessor-override` × `accessor-pairs` (CORE); `no-unsafe-json-serialization`,
  `no-invalid-dom-token` and `no-invalid-boolean-attribute-value` × the shipped `browser` and `correctness` rules on
  their cases.
- **Parsing:** `using` declarations, `Temporal.*` and iterator helpers parse in the ESLint config the catalog ships, for
  `.ts` and `.js`.

## Lane UNI: unicorn, with hits or an engine (queue)

| Rule | Engine | Notes |
| --- | --- | --- |
| `prefer-at`, `prefer-single-call` | oxlint | ESLint fallback rows; file-type guards as CORE |
| `no-unused-builtin-method-return`, `no-useless-set-construction`, `prefer-literal-ascii`, `prefer-temporal-conversion` | eslint | – |

- **`no-unused-builtin-method-return`:** the page found it the same problem as the shipped `sonarjs/no-ignored-return`
  on a discarded `.map()`. r1 says they overlap only on TS mutable arrays. Measure each shape both report (`.map()` and
  `.some()` used as a loop, in TS and JS, mutable and readonly arrays). Expected: contingent card U1.
- **`prefer-literal-ascii` and the drop:** ship it, and in the same data step remove `unicorn/no-hex-escape` from
  `rules.json`. Add it to `rule-candidates.json` as `dropped`, `decidedBy: "r2-d68"`, why `Owner 2026-10-14: "Keep both,
  then drop no-hex-escape" (r2-d68); prefer-literal-ascii was accepted on 2026-10-11 (owner-2026-10-11).`
  `DROPPED_RULES` gains it. Remove its `eslint-fallback-skips.json` entry only if a test says a skip names an unshipped
  rule. If `prefer-literal-ascii` stops, the drop still lands (r2-d68 waited on the decision, which was made), and the
  stop's card says so.
- **Measure:** `prefer-at`'s and `prefer-single-call`'s false-alarm reads. `prefer-single-call` × `functional/immutable-data`
  (different problem, allowed by his note). `prefer-at`'s fix types the result `T | undefined`; the real run records the
  tsc errors it surfaces (accepted on the page). `prefer-literal-ascii` × `unicorn/prefer-unicode-code-point-escapes`
  on `'\x41'` and `/\x41/u` after the drop.

## Lane HRA: the reduce-accumulator port (after HOUSE-R7 and EFF)

- Port `anti-slop/no-reduce-accumulator-copy` (github.com/dmmulroy/anti-slop, commit c44ef22, the page's `verifiedWith`)
  as `house/no-reduce-accumulator-copy`, in `performance`, ESLint. Read node `range`, never oxlint's `.start` (r1:
  upstream misses named reducers under typescript-eslint). The message points to `flatMap`, `map` or
  `Object.fromEntries`, never "mutate the accumulator" (`functional/immutable-data` bans that).
- **Tests:** an inline reducer copying with `acc.concat`, `acc.slice()`, `Array.from(acc)`, `acc.toSorted()` reports; a
  named reducer passed to `reduce` reports; `items.flatMap(…)` and a reducer returning a number stay silent. Measure
  upstream PR #51's array-receiver guard on a non-array receiver: adopt it if it removes a false alarm the cases show.
- **Pairs to run:** `oxc/no-accumulating-spread` and `unicorn/no-array-concat-in-loop` on each case (r1: different
  shapes).
- Register in `housePlugin`; `plugin.test.ts` pins the name. Remove the upstream `rule-candidates.json` entry; the
  2026-10-11 pin's key moves to the house ID in the same turn.

## Lane DOCS11 (after the lanes)

False sentences only, deleting before rewriting. `docs/plan.md` Open, "Ruleset critique": the clause "one pair remains:
`unicorn/no-hex-escape`, to drop once `prefer-literal-ascii` is decided". `docs/work/status.md` Open-tasks row 12, if
it names these verdicts. The release note's list is the section below.

## Reviewer focus

- Each `engine`, `typed` and `eslintBecause` backed by a run; no `eslintBecause` on a typed-only oxlint rule.
- `ignores` only on `accessor-pairs`, with every test-file glob; no other scoping without a measurement and, where it
  hides files, a card.
- Each stop carries a reproduction; no stopped rule ships; no rule dropped without his note or a card.
- HRA reads `range`; its message gives no advice another shipped rule bans.

</implementation_notes>

## What a consumer sees (for the release note)

Every rule ships at `error`, so this is a minor bump before 1.0 (`docs/release.md`). Each ruleset below is listed by
`init` by default (`optIn: false`). Rules a lane stops are left out of this list.

| Ruleset (domain) | Rules added | Removed |
| --- | --- | --- |
| correctness (quality) | `accessor-pairs` (outside test files), `no-array-constructor`, `no-empty`, `no-new-wrappers`, `no-self-compare`, `no-sequences`, `radix`, `sonarjs/no-duplicated-branches`, lane UG's correctness `unicorn/*` guards, `unicorn/no-unused-builtin-method-return` (per U1) | – |
| type-safety (quality) | `@typescript-eslint/no-namespace`, `parameter-properties`, `use-unknown-in-catch-callback-variable` | – |
| security (quality) | `unicorn/no-ineffective-csp-directives`, `unicorn/no-invalid-integrity` | – |
| performance (quality) | `house/no-reduce-accumulator-copy` | – |
| immutability (quality) | `@typescript-eslint/prefer-readonly` | – |
| modern-js (quality) | `no-object-constructor`, `prefer-object-has-own`, `@typescript-eslint/prefer-string-starts-ends-with`, `unicorn/prefer-at`, `unicorn/prefer-temporal-conversion` | `unicorn/no-hex-escape` |
| redundancy (quality) | `no-useless-assignment`, `@typescript-eslint/no-unnecessary-qualifier`, `unicorn/no-useless-set-construction`, `unicorn/prefer-single-call` | – |
| conventions (quality) | `symbol-description`, `@typescript-eslint/consistent-type-exports`, `consistent-type-imports`, `dot-notation`, `unicorn/prefer-literal-ascii` | – |
| tests (quality) | `sonarjs/composite-assertions`, `no-duplicate-parameterized-test-case`, `no-empty-parameterized-test-dataset`, `synchronous-exception-assertions` | – |
| react (ui) | `sonarjs/no-debounce-throttle-in-render` | – |
| browser (runtimes) | `unicorn/no-invalid-boolean-attribute-value`, `no-invalid-dom-token`, `no-invalid-style-set-property`, `no-prevent-default-in-passive-listener` | – |

The typed rules report only in files a tsconfig takes in. `consistent-type-imports` and `prefer-at` autofix: the first
rewrites imports to `import type`, the second can surface `T | undefined` tsc errors.

<questions>

## Cards owed now

None. Every accept and reject was given; the readings below are internal.

## Contingent cards (only if a lane's measurement trips a stop)

- **U1, expected (`unicorn/no-unused-builtin-method-return` repeats `sonarjs/no-ignored-return`).** The question:
  *you accepted a rule that a shipped rule already reports on discarded `.map()` results; ship both, ship it only where
  it adds a shape, or don't ship it?* UNI's measurement supplies the shapes each one reports alone, and the
  recommendation.
- **Any stop** (a same-problem pair, a new kind of false alarm, a fix that changes meaning, a fix loop): ship anyway;
  ship with the measured option or scope; don't ship. Volume and rate as two numbers, with the hits.

## Readings (mine, with their ground; the owner's to overrule)

- **Each accept ships as the page proposed it** (ruleset, engine, options, `accessor-pairs`' test-file ignores). The
  page showed that proposal beside the Accept button, and `docs/plan.md` (ruleset assignments): "Unless the owner reviews
  them, the first pick stands."
- **`@typescript-eslint/parameter-properties` → type-safety**, beside `no-namespace` and the enum ban: all three forbid
  syntax that does not erase (r1's reason for `no-namespace`; the `rc-erasable-syntax-only` card grouped them).
- **`house/no-reduce-accumulator-copy`**: the upstream name under `house/`, as card E1's first option named the Effect
  port.
- **`owner-2026-10-11` is the decision label** for `decidedBy` and the accepted pin, as `owner-2026-10-10` is. The
  page's verdicts carry no card id.
- **The two noted rules drop without a card** only if a shipped rule reports the same problem on every shape. That is
  the condition his note states.
- **The false-alarm stop is relative to what the page showed.** The owner accepted `accessor-pairs`,
  `no-duplicated-branches` and `consistent-type-imports` knowing their r1 false alarms.

## Corrections to the brief (old → found → evidence)

- "Possible conflict: `parameter-properties` (Accept 10-11) vs `erasable-syntax-only` (Reject 10-24)" → no conflict. The
  `rc-erasable-syntax-only` card's question and `recommendWhy` justify the reject by the namespace and parameter-property
  accepts (board export, `questions.rc-erasable-syntax-only`).
- The gap check named no rule already reported → one is: the page's coverage check (refreshed 2026-10-20) classes
  `unicorn/no-unused-builtin-method-return` as the same problem as the shipped `sonarjs/no-ignored-return`
  (`caught.same` in the page's data). Hence contingent card U1.
- The suggested `why`, `Owner 2026-10-11: "accept"`, would fail `acceptedRulesOutOfPlace`, which needs the `why` to name
  the decision → the `why` here names `owner-2026-10-11`.

</questions>
