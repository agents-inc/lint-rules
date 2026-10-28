# Spec: slice 2, each shipped rule proven on each engine that runs it, and oxlint running the rules it has

Written by pm, 2026-10-26, read-only (measurements in scratch folders only; no repo file changed but this one). Every
path is from the repository root. **`<lock>`**: `flock <the session's lint-rules build lock> bash -c '<command>'`, run
from the root; every build, generate, typecheck, test and Stryker run goes through it. **`<S>`**: the lane's scratch
folder.

<goal>
Every shipped rule has a case proving it fires on each engine that runs it, and every rule oxlint has a version of
(without type information) runs in oxlint, unless a recorded measurement shows oxlint's version is worse.

**User story:** As the owner, I want oxlint to run every rule it has, except the ones it does worse, and every rule we
ship proven on the engine running it, so that sub-agents get oxlint's speed and nothing silently stops reporting.
</goal>

<context>

## Why

- **Owner, card my-renamed-in-eslint, 2026-10-14** (dictated; spelling and repeats cleaned): "Oxlint rules should run when Oxlint is enabled, except for rules
  that are worse in Oxlint than in ESLint. For instance if they are buggy or they don't have the configuration options
  that ESLint rules have." Recorded in `docs/work/decisions.md` (Owner 2026-10-14, chat): "Where oxlint's version of a
  rule is measurably worse than ESLint's, we don't route it to oxlint: the rule runs in ESLint and the reason is
  documented."
- `docs/plan.md` Open, first three bullets: move the untyped ones without an `eslintBecause` once each passes its
  fixture on oxlint; per-rule, per-engine fixture proof (slice 2); rules turned on through `rules` that no fixture
  proves (questions.md #4). `docs/plan.md` Corrections: "Each rule keeps the gate's engine until per-engine proof
  (slice 2)". `docs/work/status.md` Slices item 2; its 2026-10-12 spec run stopped at research and wrote nothing.

## Current state (re-derive each before acting)

- **ESLint-routed rules oxlint has, with no recorded reason** (the move candidates), from the root:
  `jq -r --slurpfile rules packages/rule-data/data/rules.json '[$rules[0][] | select(.engine == "eslint" and (.eslintBecause|not)) | .id] as $eslint | .rules[] | select(.oxlint != null and (.id | IN($eslint[])) and (.oxlint.typeAware|not)) | .id' packages/rule-data/src/generated/inventory.json`.
  Nothing fails when this list is non-empty: `canonical-list.test.ts` checks rules that carry `eslintBecause`, never
  rules that lack one.
- `no-throw-literal` is on that list but is already decided: it is the untyped half of the `splitByTypesWith` pair
  with `@typescript-eslint/only-throw-error` (q-r5-only-throw-error), which plan.md Routing keeps in ESLint ("So does
  the untyped rule of a `splitByTypesWith` pair that oxlint has"). Only its `eslintBecause` is missing.
- **Proof that exists:** the ESLint version of every shipped oxlint-run rule (a fixture or a skip entry, in
  `packages/lint-rules/src/eslint-fallback.integration.test.ts`); the rules with `eslintBecause` fire in ESLint (same
  file); the `RuleCase` lists (`grep -l "rule: '" packages/rule-data/src/__tests__/cases/*.ts`) on every engine that
  may run each rule; the `oxc/*` stand-ins (`__tests__/cases/stand-ins.ts`). **Missing:** the oxlint side of nearly
  every oxlint-routed rule (`FIRES_IN_OXLINT` in `engines.integration.test.ts` is a hand-picked sample), and the
  ESLint side of most ESLint-routed rules. No test lists a shipped rule with no proof.
- Oxlint's fix support differs from ESLint's for part of the candidates. `check` fixes with `oxlint --fix`
  (`cli/check/oxlint-run.ts`), which applies safe fixes only, not suggestions or dangerous fixes. Read from rule meta,
  2026-10-26 (a claim the lane re-measures): ESLint's version is `fixable` and oxlint's has no safe fix (`pending`,
  suggestion only or dangerous) for `@typescript-eslint/consistent-type-definitions`,
  `@typescript-eslint/no-inferrable-types`, `no-useless-return`, `unicorn/prefer-array-flat`,
  `unicorn/prefer-array-index-of`, `unicorn/prefer-array-some`, `unicorn/prefer-dom-node-remove`,
  `unicorn/prefer-export-from`, `unicorn/prefer-includes`, `unicorn/prefer-modern-dom-apis`,
  `unicorn/prefer-modern-math-apis`, `unicorn/prefer-native-coercion-functions`, `unicorn/prefer-number-properties`,
  `unicorn/prefer-object-from-entries`; `@typescript-eslint/consistent-type-assertions` is partial. The other
  direction: `unicorn/prefer-dom-node-text-content` gains a fix. Oxlint's side:
  `npx oxlint --rules --format=json | jq -r '.[] | [.scope, .value, .fix] | @tsv'`; ESLint's: each rule module's
  `meta.fixable`.
- Measured 2026-10-26 (oxlint 1.87): oxlint honours `// eslint-disable-next-line n/handle-callback-err`, so moving
  the one `n/` candidate changes no suppression. Of the candidates' gate fixtures (ai-benchmarking's
  `tests/lint-fixtures/fixtures.json`), all but `max-lines` exist, and all but two fire in oxlint. The two that stay
  silent (`no-lone-blocks`, `unicorn/prefer-keyboard-event-key`) look like fixture shapes ESLint's version leaves alone
  too, which is why each case runs both engines.

## Settled, not re-opened

- "Worse" is plan.md Routing's and `docs/work/spec-merge-model.md` §3.1's criterion. On files both engines lint for
  us, oxlint's version misses a finding or reports a false one that ESLint's does not, or refuses or ignores an option
  ESLint's takes. Owner 2026-10-14, point 5.
- Rules oxlint runs only with type information stay in ESLint: oxlint's `--type-aware` stays off (owner,
  a4-oxlint-type-aware; plan.md "Does not carry over from the gate", "TS 5.9 typed tier").
- A rule whose oxlint name differs runs in oxlint (my-renamed-in-eslint). Without oxlint, the ESLint part runs each
  oxlint rule ESLint has a version of, proven on its fixture or skipped with a reason (plan.md Decisions, editor export).
- Moving a rule between engines is a data change with nothing for consumers to do (plan.md Routing; architecture.md,
  "Move a rule between engines").

</context>

## The measurement per rule (phase A: every move candidate)

Each candidate gets `RuleCase`s (`packages/rule-data/src/__tests__/cases/changed-settings.ts` defines the type), run
with the settings the catalog ships, on **both** engines:

| | Measures | A difference means |
| --- | --- | --- |
| M1 fires | each `reportedIn` file reported by oxlint's version and ESLint's. Seeds: the gate fixture, re-run; a seed ESLint's version leaves alone is replaced by a shape it reports | oxlint misses a finding |
| M2 silent | `silentIn`: the corrected form, plus at least one shape the rule's docs list as correct | oxlint reports a false one |
| M3 options | for a rule shipped with options (`jq -r '.[] \| select((.options\|length)>0) \| .id'` against the candidate list), a file whose outcome the option decides; oxlint loading the config at all (`not linted` otherwise) | oxlint refuses or ignores an option |
| M4 file types | each M1 shape in every file type ESLint's version reports it in for us (`.js` and `.ts`, plus JSX types for JSX rules); `packages/rule-data/data/oxlint-file-types.json` names the rules oxlint skips per type | oxlint skips files ESLint covers (the M7 precedent in spec-merge-model §3.2) |
| M5 fixes | `check`'s fix on each `reportedIn` file, per engine (ESLint `fix: true`; `oxlint --fix`): same text, different text, only one engine fixes, neither. Measured in `<S>`, recorded per rule in the report, not committed | not "worse" under the ruling: a fix only ESLint's version makes goes to owner question Q1; a fix only oxlint's makes is recorded. A fix that changes what the code means is a stop |

**Verdicts:**

- **Moves:** M1-M4 equal on both engines, and M5 shows no fix only ESLint's version makes and no fix that changes
  the meaning.
- **Stays:** M1-M4 differ. It keeps `engine: "eslint"` and gets an `eslintBecause` naming the difference and the
  measurement, in plan.md Routing's form ("oxlint … where ESLint's version …, (measured, oxlint <v>, ESLint <v>)").
- **Waits on Q1:** M1-M4 equal, but M5 shows ESLint's version fixes where oxlint's does not. It stays as it is and is
  listed with the card's id. Nothing moves or gets a reason until the owner answers.
- **Stops (report, do not decide):** a case neither engine can be made to fire; a fix that changes meaning.
  `max-lines` if its `files` cannot become an equivalent `ignores` (below).

**How a rule moves** (S2-DATA, in `rules.json`): `engine: "oxlint"`, `oxlintName` set to the inventory's
`oxlint.oxlintName`, nothing else changed; regenerate. **How a rule stays:** `eslintBecause` added, and its ID goes into
`ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON`'s matching group in `__tests__/cases/routed-to-eslint-for-a-reason.ts` (a new
group where no current one names the difference).

Knock-ons of a move the lanes own (each found by a test that reddens):

- The ESLint fallback treats the moved rule like any other oxlint rule. It needs a fixture in
  `packages/lint-rules/test-fixtures/eslint-fallback/` (`fixtures.json`) or a skip entry with a measured reason
  (`packages/rule-data/data/eslint-fallback-skips.json`, S2-DATA). The fallback test's "give every moved rule a fixture
  or a skip entry" and "are kept for moved rules … only" catch both directions. A staying rule needs the same fixture,
  since the fallback test fires every rule with `eslintBecause` in ESLint.
- `default-param-last` and `prefer-promise-reject-errors` have current typescript-eslint extensions (meta
  `extendsBaseRule`). Moved, each joins `twinnedMovedRules()`, so `TWINNED_MOVED_RULES` in
  `eslint-fallback.integration.test.ts` and `twin-fixtures.json` gain a row each. The second extension is typed, as
  `@typescript-eslint/prefer-destructuring`, already on the list, is.
- `max-lines` ships with `files` (JSX files), and the oxlint build refuses a rule scoped by `files`
  (`canonical-list.test.ts`, "has no oxlint rule scoped by files"). It moves only if its scope becomes an `ignores`
  that keeps it to the same files on both engines, pinned by its case (an over-limit `.tsx` reported; an over-limit
  `.ts`, test `.tsx` and `use-*.tsx` silent). Otherwise stop on it. Teaching the oxlint build `files` is out of scope.
- `no-return-assign` is `coveredBy` an ESLint rule (`sonarjs/no-nested-assignment`). Cross-engine covers already exist
  (`no-cond-assign`), and the fallback test proves covered rules in its covers-off run.
- `unicorn/prefer-optional-catch-binding`'s fix is withheld by `check` (`cli/check/withheld-fixes.json`). The fix run
  turns withheld rules off in oxlint too (architecture.md, "How `check` runs", step 3). The real run confirms it stays
  withheld once oxlint runs the rule.
- `oxlint-refused-options.integration.test.ts` covers the extension options of every core rule routed to oxlint. A
  moved core rule with an extension may need a data entry (S2-DATA) where the test says so.

## The measurement per rule (phase B: every other shipped rule)

Proof that the rule fires, on each engine that runs it, at the pinned plugin versions (which are newer than the gate's):

- **oxlint-routed rules:** each one's ESLint-fallback fixture, run through oxlint with the full shipped config in a
  project listing oxlint, with a covers-off run for covered rules as the fallback test does, reports the rule under
  oxlint's code. A skipped rule without a fixture gets one. An `oxc/*` rule is proven by its stand-in case where it has
  a stand-in, otherwise by a `RuleCase` naming `engines: ['oxlint']`.
- **ESLint-routed rules:** a `RuleCase` per rule (`reportedIn` seeded from the gate fixture; `silentIn` the corrected
  form), typed where the rule is.
- **Exempt, with the reason in the guard:** `house/*`, proven by each rule's own test,
  `packages/eslint-plugin-house/src/rules/<rule>.test.ts`. Every shipped house rule has one today; the guard checks
  that the file exists for each, since `src/plugin.test.ts` pins only the registry.
- A fixture that fires in ESLint but not in oxlint, for an oxlint-routed rule, is "worse" under the ruling: the rule
  moves to ESLint with `eslintBecause` (a queued S2-DATA step). A shipped rule that fires on no shape on its routed
  engine is a stop: dropping or moving it is the owner's card.

<technical_requirements>

## Must have

1. Phase A: every move candidate measured (M1-M5), and moved, given a reason, or listed as waiting on Q1, with its
   cases committed. `no-throw-literal` gets its `eslintBecause` and joins `SPLIT_BY_TYPES`.
2. The routing guard, in `canonical-list.test.ts`'s "the rules routed to ESLint for a measured reason" block: no
   shipped ESLint-routed rule whose oxlint version needs no type information lacks `eslintBecause`, except those
   waiting on Q1 (a literal list naming the card). It is red before S2-DATA and fails by name thereafter. This guard
   enforces the owner's ruling going forward, including on rules the accepted-rules lanes add.
3. Phase B: every shipped rule proven on each engine that runs it, and a completeness guard (S2-Z) that lists by name
   each shipped rule with no proof on an engine that runs it.

## Should have

1. Each staying rule's difference also pinned as a pair of cases, `engines: ['oxlint']` with the shape in
   `silentIn` (or `reportedIn` for a false report) and `engines: ['eslint']` the opposite, `subject` naming the gap. An
   oxlint upgrade that closes the gap then reddens the pin, and the rule can move.
2. A fix case in `packages/lint-rules/src/check-fixes.integration.test.ts`'s style for each moved rule whose oxlint fix
   `check` applies.

## Must NOT have

1. Rules oxlint runs only with type information: settled (a4-oxlint-type-aware).
2. Proof of rules we do not ship (questions.md #4): only on Q2's answer, as its own lane.
3. Rules with `eslintBecause` today: not re-measured (Should have 1 covers new ones only).
4. Teaching the oxlint build to scope a rule by `files`.
5. Any change to rulesets, options, `files` (but `max-lines`, as above), or what a consumer writes.
6. Edits to `docs/work/status.md` (the orchestrator's) or to ai-benchmarking (read-only).

</technical_requirements>

<constraints>

## Lanes and the files each owns

`rules.json`, `src/generated/**` and the two data files named below are single files: **testers run in parallel; data
steps run one at a time.** A change wanted in another lane's file is reported with the exact change.

| Lane | Agent | Owns |
| --- | --- | --- |
| S2-RUN case runner | web-tester | `packages/rule-data/src/__tests__/rule-case-outcomes.ts`, `rule-case-outcomes.test.ts`, `rule-case-runs.ts` (if needed) |
| S2-CASES phase A cases | web-tester | new `packages/rule-data/src/__tests__/cases/oxlint-versions.ts`, new `packages/rule-data/src/oxlint-versions.integration.test.ts`, `packages/rule-data/src/canonical-list.test.ts` (the guard), `__tests__/cases/routed-to-eslint-for-a-reason.ts` |
| S2-FALLBACK | web-tester | `packages/lint-rules/test-fixtures/eslint-fallback/**`, `packages/lint-rules/src/eslint-fallback.integration.test.ts` (`TWINNED_MOVED_RULES` only) |
| S2-DATA | web-developer | `packages/rule-data/data/rules.json`, `eslint-fallback-skips.json`, `oxlint-refused-options.json` (only where a test asks), `src/generated/**` |
| S2-OX phase B, oxlint side | web-tester | new `packages/lint-rules/src/oxlint-routed-rules.integration.test.ts`; fixtures for skipped oxlint rules (`test-fixtures/eslint-fallback/`, after S2-FALLBACK); new `packages/rule-data/src/__tests__/cases/proof-oxc.ts` and `src/proof-oxc.integration.test.ts` |
| S2-SONAR, S2-UNICORN, S2-REGEXP (regexp, perfectionist), S2-REACT (@eslint-react, react, react-hooks, react-you-might-not-need-an-effect, react-hook-form, css-modules), S2-TS (@typescript-eslint, functional, core), S2-TEST (testing-library, storybook, vitest), S2-NODE (n, import-x, promise, check-file, no-secrets) | web-tester each | new `packages/rule-data/src/__tests__/cases/proof-<lane>.ts` and `packages/rule-data/src/proof-<lane>.integration.test.ts`, for the lane's ESLint-routed rules |
| S2-Z index and guard | web-tester | new `packages/rule-data/src/__tests__/cases/proof-cases.ts` (every `RuleCase` list, imported by name), its `test-support` export in `packages/rule-data/package.json`, new `packages/lint-rules/src/every-rule-proven.integration.test.ts` |
| S2-DOCS | web-developer (or codex-keeper) | `docs/plan.md`, `docs/architecture.md`, `docs/work/questions.md`, `docs/work/learnings.md` |

Plugin groups come from: `jq -r '.[] | select(.engine=="eslint") | .id | if test("/") then sub("/[^/]*$"; "") else "core" end' packages/rule-data/data/rules.json | sort | uniq -c`. The orchestrator may split a large lane by rule
name.

## Order

| Phase | What | Runs |
| --- | --- | --- |
| 0 | Waits for own-lint lane Z (own-lint lanes R, S and T own `packages/rule-data/src/**`, `packages/lint-rules/src/__tests__/**` and `src/*.test.ts`) and for the accepted-rules stream's last data step (EFF, a `rules.json` writer), whose lanes also edit `canonical-list.test.ts`. Check `git status --short` and the queue before starting | – |
| 1 | S2-RUN; then S2-CASES (cases, measurements M1-M5, verdict lists); then S2-FALLBACK | serial (each needs the last) |
| 2 | S2-DATA: moves, reasons, `no-throw-literal`; regenerate; gates | one developer |
| 3 | Real run, reviewer, S2-DOCS (phase A done) | serial |
| 4 | On Q1's answer: the waiting rules through phases 1-3 again (small) | on the answer |
| 5 | Phase B testers in parallel (S2-OX, the plugin lanes); S2-DATA queued for any "worse" finding | parallel, data serial |
| 6 | S2-Z; S2-DOCS; final gate on a frozen tree | serial |

## Technical constraints

- Node 22.18+ (`node --version`); Node 22.23.2 for the packed-install real run (CLAUDE.md "Environment").
- Case modules hold literals only; nothing that can throw runs while a test file is collected (CLAUDE.md "Tests").
- Each new test file that runs an engine carries the engines timeout, as `accepted-a.integration.test.ts` does.
- No `cd X &&` at the start of a Bash command; git read-only.

## Dependencies

- **Requires:** own-lint lane Z, the accepted-rules stream's data steps; Q1 for the rules waiting on it; Q2 for any
  unshipped-rule lane.
- **Blocks:** plan.md Open's first two bullets; the next lint-rules release's note (below).

</constraints>

<success_criteria>

## Per lane, before its report

| Criterion | How to verify |
| --- | --- |
| Red first | S2-CASES: `<lock>` `npx vitest run src/canonical-list.test.ts src/oxlint-versions.integration.test.ts` from `packages/rule-data` fails, naming each candidate. S2-FALLBACK: the fallback test fails naming each new fixture's rule. Phase B lanes, whose rules already fire: a hand break per lane (turn its first rule off in the case's settings, or drop its `rules.json` entry and regenerate) fails that case; restored, green. Output kept in `<S>` |
| Green after | the same runs after S2-DATA |
| Gates | `<lock>` `bun run --cwd packages/rule-data generate`; `<lock>` `bun run build`; `<lock>` `bun run typecheck` (knip first); `<lock>` `bun run test`; unfiltered, output visible, exit codes written down. A red test in another lane's file is reported as others' red |
| Measurements | S2-CASES's report: per candidate, M1-M5 outcomes and its verdict, with the command that reproduces each difference |
| Mutation | S2-RUN and S2-Z source changes: `node scripts/mutate-changed-lines.mts` per CLAUDE.md "Tests" |
| Real run (phase A) | packed install, `init`, a scratch repo whose `package.json` lists oxlint, with the moved rules' `reportedIn` files committed and then edited: `check` reports each moved rule under oxlint's code and not ESLint's, exit 1; a second `check` rewrites no file; `prefer-optional-catch-binding`'s fix stays withheld; the same project without oxlint reports them through ESLint. Tracked in `<S>/real-runs.md` (pattern: `packed-install.integration.test.ts`) |

## Done

| Criterion | How to verify |
| --- | --- |
| Phase A | the "Current state" candidates command prints exactly the Q1 list (empty once Q1 is answered and built) |
| Routing guard bites | hand break: remove one moved rule's `oxlintName` and set it back to `eslint`; regenerate; the guard names it; restore |
| Phase B | `every-rule-proven.integration.test.ts` green; hand break (delete one `RuleCase`) names that rule |
| Generated fresh | `bun run --cwd packages/rule-data generate`, then `git diff --exit-code -- packages/rule-data/src/generated` |
| Scope | `git diff --stat` touches only the files the lanes own |

</success_criteria>

<implementation_notes>

## Every lane: the order (CLAUDE.md "How work gets done")

1. **Re-derive** the lane's rows (the commands above). A row that does not match the tree: stop on it, report the
   command and output, go on.
2. web-tester: cases and measurements (red). 3. web-developer: the data step in its queue turn; regenerate; gates.
4. Expressive-TypeScript pass (the `meta-design-expressive-typescript` skill only) on changed TypeScript.
5. Real run. 6. reviewer, verifying with reproductions. 7. S2-DOCS: only the sentences made false.

Report: corrections (or "nothing"), per rule its verdict with evidence, assertions changed and why, cross-lane
changes wanted.

## Pattern files

| Priority | File | Shows |
| --- | --- | --- |
| 1 | `packages/rule-data/src/__tests__/rule-case-outcomes.ts` (`setUpRuleCaseOutcomes`, `enginesThatMayRun`, `oxlintNamesOf`) | a rule's cases on each engine, shipped settings; `oxlintNamesOf` throws for an ESLint route today, which is S2-RUN's change |
| 2 | `packages/rule-data/src/accepted-a.integration.test.ts`, `__tests__/cases/accepted-a.ts` | one cases file plus one test file per lane |
| 3 | `packages/lint-rules/src/eslint-fallback.integration.test.ts`, `__tests__/eslint-versions.ts` | fixture index per rule, covers-off run, twins, the kept-fixtures guard |
| 4 | `packages/rule-data/src/canonical-list.test.ts`, "the rules routed to ESLint for a measured reason" | where the routing guard goes |
| 5 | `packages/rule-data/src/__tests__/cases/routed-to-eslint-for-a-reason.ts` | reason groups |
| 6 | `docs/work/spec-merge-model.md` §3 | the "worse" criterion and how the existing reasons were measured |

## S2-RUN

A case naming `engines` that include oxlint, for a rule ESLint runs, runs oxlint's version with the shipped options:
the inventory's oxlint name and plugin. A rule with no oxlint version, or only a type-aware one, is refused with an
error naming it. Both the allowed and the refused case go in `rule-case-outcomes.test.ts` (CLAUDE.md: pin a refusal
next to an allowed case).

## S2-CASES

One case set per candidate (`subject` where a rule has several). It writes the measurements, then the verdict lists in
`oxlint-versions.ts`: the moves, the stays (with Should have 1's pins), and the rules waiting on Q1 with the card id.
`oxlint-versions.integration.test.ts` runs every case on both engines and asserts each move is routed to oxlint, which
is red until S2-DATA. It also adds the guard (Must have 2) and the reason groups.

## Reviewer focus

- Each verdict's reproduction: re-run one move and one stay from the report's commands.
- Seeds: no case keeps a gate fixture that ESLint's version leaves alone.
- M3: each optioned rule has a file whose outcome the option decides.
- The guard and the completeness check fail by name on a hand break.

## What a consumer sees (release note)

A project listing oxlint gets the moved rules from oxlint: the same findings, in oxlint's wording, sooner. Editors
show them through oxlint's extension, and suppression comments keep working under the same names. Without oxlint,
nothing changes. A moved rule whose fix differs is fixed the oxlint way by `check`.

</implementation_notes>

<questions>

## Owner questions (nothing waiting on them is built)

- **Q1 (card owed):** some rules report the same code in oxlint as in ESLint, but only ESLint's version fixes it
  automatically ("Current state" lists them; S2-CASES confirms by running both). Moved, `check` would hand a sub-agent
  the finding to fix by hand instead of fixing it first. Keep those in ESLint, or move them anyway?
- **Q2 (card owed; questions.md #4):** rules a team switches on itself through `rules`, which we do not ship, are
  allowed with no proof and run in oxlint wherever oxlint has a version (a default never confirmed). Leave them so, or
  prove each the way slice 2 proves ours?

## Readings (mine, with their ground; the owner's to overrule)

- A lost autofix is not "worse" under the ruling until Q1 says so: the ruling names bugs and missing options, and
  plan.md's criterion names findings and options. So those rules stay where they are.
- Phase B uses the case runner for ESLint-routed rules and the existing fallback fixtures for the oxlint side of
  oxlint-routed rules. That is internal structure, and it adds no new fixture where one exists.

## Corrections to the brief (old → found → evidence)

- "Slice 2 was never built" → partly built: the ESLint side of every oxlint-run rule is proven, or skipped with a reason,
  and so are the `RuleCase` lists → `eslint-fallback.integration.test.ts`; `grep -l "rule: '"
  packages/rule-data/src/__tests__/cases/*.ts`.
- "64 untyped rules … with no recorded reason" → the command holds (64 on 2026-10-26), but one of them,
  `no-throw-literal`, is already decided by plan.md Routing (a split pair), and only its `eslintBecause` is missing.

</questions>
