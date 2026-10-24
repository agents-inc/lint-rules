# Spec: lint-rules lints itself clean (s-lint-rules-own-lint-gate)

The 2026-10-24 spec for the owner's accepted own-lint clean-up, copied from the session that wrote it with its
session and machine paths left out.

Owner-accepted 2026-10-23: "Finish the repo's own lint clean-up so its own ESLint and oxlint can run as a gate", size L.
Every path below is from the repository root. Written by pm 2026-10-23, revised 2026-10-24 for the owner's answers.
Read-only.

**`<lock>`** below means the session's shared build lock: `flock <lock file> bash -c 'cd <repository root> && <command>'`.
Every build, lint, typecheck, test and Stryker run goes through it. **`<S>`** is the lane's session scratch folder.
Write engine JSON into `<S>` under the lock, then run `jq` outside it, from the repository root (no nested quotes).

<goal>
The repo's own ESLint and oxlint report nothing over the whole repository, so the two commands become a gate every
lane runs, with no shipped rule, published declaration, CLI output or test weakened.

**User story:** As the owner, I want sub-agents here held to the ruleset this repo ships, so that its own code is the
first proof the rules can be lived with.
</goal>

<context>

## Why

Every lane so far linted only its added lines and left the rest "for the lint clean-up" (`docs/work/learnings.md`:
"Self-lint of the rounds", "Self-lint of the lanes' added lines", the `scripts/tsconfig.json` side effect). Until the tree
is clean, neither engine can be a gate, so nothing stops a new instance of a fixed pattern
(learnings: "Only the repo's own `functional/immutable-data`, which no gate runs, flags a new one"). Priority: High.

## Current state (measured)

- The repo lints itself through `eslint.config.mjs`, `oxlint.config.mts` and `agents-inc.lint.mts`, written as a team's
  (plan.md Open, "Later (owner 2026-10-14)": `npx eslint .` and `npx oxlint` from the root, after `bun run build`).
  The editor set equals the agent set (`docs/work/spec-answers-3.md` item 39).
- **No lint script exists**, at the root or in any package: `jq .scripts package.json packages/*/package.json`.
  Owner, q-dogfood-whole-repo-lint (2026-10-16): "This shouldn't need a script. I can just tell a subagents to run
  against all files can't i". So the gate is two commands carried in briefs, not a script.
- **`check` exists** (`agents-inc-lint check`, `packages/lint-rules/src/cli/check/run-check.ts`) but runs the agent set
  on changed lines only, and agents here do not run it unless the owner says (spec-answers-3 item 39). It is not this gate.
- Root oxlint also lints `packages/lint-rules/test-fixtures/consumer-files` by that folder's own oxlint config and reports
  its planted `no-debugger` (plan.md Open, "Raised by this repo's own configs"). It is the only nested oxlint config:
  `git ls-files | grep -E '(^|/)(oxlint\.config\.[cm]?[jt]s|\.oxlintrc\.json)$'`. Measured: `--disable-nested-config`
  and `--ignore-pattern=packages/lint-rules/test-fixtures/**` each leave it out; `--ignore-path` to a file outside the
  repo does not.
- ESLint lints `.agents-inc/claude/*.ts` (tracked, written by the agents-inc CLI; `knip.jsonc` already ignores
  `.agents-inc/**` for that reason).
- The source holds no lint-disable directive today:
  `grep -rnE "^\s*(//|/\*)\s*(eslint|oxlint)-disable" packages scripts *.mjs *.mts | grep -v -e node_modules -e test-fixtures -e /dist/`
  prints one line, inside a fixture string. This clean-up adds the first ones.
- Other lanes are editing files this clean-up owns: the LA/LB fix round (the house rule
  `no-throwing-default-in-exhaustive-switch.ts` and its tests, `__tests__/collect-time-throws.ts`, docs) and the lane
  widening the collect-time finder to helper modules (`__tests__/collect-time-throws.ts`).

## The findings: the commands that list them

Measure (dist must be fresh: `bun run build` first):

- `<lock>` with `npx eslint . -f json -o <S>/eslint.json`
- `<lock>` with `npx oxlint --disable-nested-config --format=json > <S>/oxlint.json`

By package and rule (`packages/<name>`, else the top folder):

- `jq -r --arg root "$PWD/" '.[] | (.filePath | ltrimstr($root) | split("/") | if .[0] == "packages" then .[1] else .[0] end) as $area | .messages[] | "\($area) \(.ruleId)"' <S>/eslint.json | sort | uniq -c | sort -k2,2 -k1,1nr`
- `jq -r '.diagnostics[] | (.filename | split("/") | if .[0] == "packages" then .[1] else .[0] end) as $area | "\($area) \(.code)"' <S>/oxlint.json | sort | uniq -c | sort -k2,2 -k1,1nr`

Site by site, for a lane (`$f:line rule`): `jq -r --arg root "$PWD/" '.[] | (.filePath | ltrimstr($root)) as $f | .messages[] | "\($f):\(.line) \(.ruleId)"'`
and `jq -r '.diagnostics[] | "\(.filename):\(.labels[0].span.line) \(.code)"'`. By file and rule, to see what moved
between two runs: the first form with `"\($f) \(.ruleId)"`, `sort | uniq -c`, then `diff`. Fatal check, must print 0:
`jq '[.[] | .messages[] | select(.fatal == true or .ruleId == null)] | length' <S>/eslint.json`.

**Measured 2026-10-24 02:30 CEST** (HEAD `35a334d` plus the uncommitted LA/LB work, with its fix round and the finder
widening in progress; dist built 01:33, no source newer): ESLint 2235 errors in 366 of 649 files, 76 rules, 0 fatal,
about a third `functional/prefer-immutable-types`; oxlint with the gate's flag 234 errors in 114 of 632 files, 13 rules.
The 48 more ESLint errors than at 2026-10-23 23:43 are all in the two files other lanes are editing (by-file diff of the
two runs): the house rule `no-throwing-default-in-exhaustive-switch.ts` and `__tests__/collect-time-throws.ts`.
The raw output stayed in the session's scratch folder. Re-measure before acting.

## Desired state

After `bun run build`, from the root, `npx eslint .` and `npx oxlint --disable-nested-config` report nothing, and
briefs carry both as a gate beside `bun run typecheck` and `bun run test`. No call that can throw runs while vitest
collects a test file. Every behaviour pinned before the clean-up holds after it, and the published package is as
before in what it declares and prints.

</context>

<existing_patterns>

## Pattern files

| Priority | File | Pattern |
| --- | --- | --- |
| 1 | `agents-inc.lint.mts`, its one `fileOverrides` entry | A repo-own override with its reason in a comment above it. New overrides take this shape. Entries take `files` only (no `ignores`: `FileOverride` in `packages/lint-rules/src/index.ts`). |
| 2 | `eslint.config.mjs` and `oxlint.config.mts`, `theirExistingConfig`; `agents-inc.lint.mts` `ignores` | A folder left out of all three: `test-fixtures` and `.stryker-tmp` are in each. |
| 3 | `packages/lint-rules/src/repo-own-lint-configs.integration.test.ts`, `repo-own-rules.integration.test.ts` (with `__tests__/calculated-rule-severity.ts`) | How a test pins what the root configs do: `isPathIgnored`, a rule's calculated severity per file. |
| 4 | `packages/lint-rules/src/cli/check/eslint-fix-filter.ts` | ESLint's `fix` predicate by rule: how to apply one rule's autofix and no other. |
| 5 | `packages/lint-rules/src/core/merge-eslint-config.ts` `withOurVersion`; `core/eslint-config-reading.ts` `nameOfPlugin` | A construct a rule calls deprecated that is required: ESLint reads a plugin's top-level `name`/`version` before `meta` (their doc comments). The shape of a site that stays. |
| 6 | `packages/rule-data/src/collections.ts` `compareCodeUnits`, `foundOr`, `groupBy` | The repo's helpers a rewrite reaches for first. |
| 7 | `packages/lint-rules/src/__tests__/runs-before-the-suite.ts` `setUpRunsBeforeTheSuite` | The shared suite setup: carries a value from `beforeAll` to the tests outside an `it.fails` suite. |
| 8 | `packages/lint-rules/src/test-collection.test.ts`, `__tests__/collect-time-throws.ts`, `__tests__/collect-time-throws-left.ts` | What lane K empties: the finder, and the known-gap list it is checked against. |

</existing_patterns>

<technical_requirements>

## Must have

1. Phases: lane 0 (config and root) and lane K (collect-time moves), then lanes H, R, C, L, S, T, M in parallel on
   disjoint files, then lane Z (Q1's sites, cross-lane changes, the frozen final gate, docs). Ownership: Constraints.
2. Each finding is cleared by changing the code, unless the rule guidance says config or a proof-carrying disable.
   CLAUDE.md, Code: "An `eslint-disable` needs proof after `--`: the compiler error or the concrete thing that breaks,
   never 'the rule is annoying here'." A construct required in every file of a kind goes in `agents-inc.lint.mts`
   `fileOverrides` where the owner has ruled it, not in per-site disables.
3. Lane 0's config, each owner-ruled or settled by precedent:
   - **Rule files** (q-dogfood-required-mutation; q-lint-own-rule-file-overrides 2026-10-24, "Yes, the same override
     covers both"): one `fileOverrides` entry turning `functional/immutable-data`, `functional/no-expression-statements`
     and `functional/no-return-void` off in the house plugin's rule source files, `src/shared/`, and
     `src/__tests__/house-rule-tester.ts` (`RuleTester.afterAll = afterAll`, the ruling's own example). Its globs name no
     rule test file (`src/rules/*.test.ts`): entries take no `ignores`, so the developer measures a glob form both engines
     read that way.
   - **Type tests** (q-lint-own-type-test-files 2026-10-24, "Override it off for `**/*.test-d.ts` in this repo"): one
     entry turning `unicorn/no-top-level-side-effects` off in `**/*.test-d.ts`.
   - `.agents-inc/**` left out of all three configs (precedent: `knip.jsonc`; CLAUDE.md "Generated files are never hand-edited").
   - The gate's oxlint command carries `--disable-nested-config`: the only nested config is test data, and the flag
     makes oxlint honour the root `ignorePatterns` as written (plan.md Open named this remedy). Reversible.
   - `eslint.config.mjs` imports `repoOwnPlugin` through a workspace name, as `import-x/no-relative-packages` advises: an
     export of it in `packages/eslint-plugin-house/package.json` and `@workspace/eslint-plugin-house` (`workspace:*`) in
     the root devDependencies, the shape the root's `@agents-inc/lint-rules` dependency already has; `bun install`.
   - `scripts/mutate-changed-lines.mts`'s imports of `packages/lint-rules/mutation-testing/*`: a disable with proof
     (the published package's `exports` do not, and must not, name `mutation-testing/`).
4. **The `it.fails` read-before `let`** (q-lint-no-let-it-fails 2026-10-24, "Allow `let` for this pattern"; the card's
   consequence: "An ESLint override (or a disable with its proof) for the it.fails read-before pattern"): a per-site
   `eslint-disable-next-line functional/no-let` on each `let` a hook assigns and an `it.fails` test reads, every one
   carrying the same proof: `-- it.fails: only the assertion may throw, so the run is in beforeAll and its result crosses
   to the test (CLAUDE.md, Tests; q-lint-no-let-it-fails)`. Done in the lane owning the file, lane K for those it
   creates. Why not the override: the sites sit in five lanes and lane K adds more, so a file-keyed override is one
   list every lane edits, and `off` per file also hides every other `let` there; no `functional/no-let` option
   (`allowInForLoopInit`, `allowInFunctions`, `ignoreIdentifierPattern`) selects a hook-assigned binding. If the
   orchestrator prefers the override, it is a lane 0 entry listing those files, pinned as below.
   A hook-assigned `let` that no `it.fails` test reads is outside the ruling: `setUpRunsBeforeTheSuite` where a value is
   made once before the suite and only read; otherwise (a temp folder made in one hook and removed in another, a value
   saved before each test and restored after it, a spy) a disable whose proof is TS2588 (a `const` cannot be assigned
   in the hook) and why the helper does not fit.
5. **Collect-time moves** (q-lint-collect-time-left 2026-10-24, "Move each into its test or a hook"; q-lint-collect-time-reach,
   "Widen it to helper modules", the widened finder's helper-module sites joining): every call
   `test-collection.test.ts` finds moves into its test, a function the test calls, or a hook, **keeping every test's name
   and verdict** (Success criteria, "Same tests, same verdicts"). Afterwards the finder finds none and the known-gap list
   is gone. Prefer the test body (nothing crosses scopes); a hook only for setup the suite shares, then requirement 4's
   forms. A `.each` table whose rows come from the throwing call moves only its throwing part into the test when the
   titles come from data that cannot throw; where the titles are what the call returns, it cannot move without changing
   test names: stop on it and report it.
6. Every `functional/prefer-immutable-types` parameter is wrapped (`Readonly<…>`, `readonly T[]`, `ReadonlyMap`,
   `ReadonlySet`): owner, q-dogfood-library-types-readonly, "Keep it; wrap library types in `Readonly<…>`".
7. The rewrites the owner already gave (q-dogfood-keep-three): `unicorn/no-non-function-verb-prefix` on a value named
   like `setByTheTeam…` → rename; `@typescript-eslint/no-generated-empty-object-type` on `<V extends NonNullable<unknown>>`
   → a named union of the non-nullish types; an exhaustive switch → the `never` default (CLAUDE.md, Code).
8. Docs in lane Z (CLAUDE.md step 8): only sentences the clean-up made false, plus the gate's commands in one place.

## Should have

1. A finding the shipped ruleset itself should not raise (a false positive a consumer would also hit; the type-test
   exemption is one) written up as an owner question, not fixed here.

## Must NOT have

1. No change to the shipped ruleset or catalog: `packages/rule-data/data/**`, `packages/rule-data/src/generated/**`,
   house rule behaviour, option schemas, messages. Each is its own card.
2. Nothing a consumer sees: `dist/*.d.mts` declarations, `check`/`init` stdout, stderr and exit codes
   (`src/cli/exit-codes.ts`: `EXIT_CLEAN`, `EXIT_FINDINGS`, `EXIT_COULD_NOT_RUN`, `EXIT_INTERRUPTED`, `EXIT_TERMINATED`),
   signal behaviour, the package's `exports`. Q1 alone may open the declarations.
3. No lint script, hook or new tool (q-dogfood-whole-repo-lint; CLAUDE.md Scope).
4. No test weakened: no assertion broadened, no test renamed or dropped, no `it.fails` turned to `it` or back
   (CLAUDE.md, Tests). The one pin that changes is the known-gap list, which the owner's ruling makes wrong (lane K).
5. No blanket `--fix`. Apply an autofix one rule at a time (pattern 4). `unicorn/consistent-boolean-name`'s fix renames
   within one file only, so on an exported name it breaks every importer; `import-x/no-relative-packages`'s fix writes a
   path the package does not export.
6. Outside lane K, no call added at a test file's top level, in a `describe` body or an `.each` table, or at a helper
   module's top level: `test-collection.test.ts` would report it.

</technical_requirements>

<constraints>

## Lanes and the files each owns

A lane edits only its own files. A change wanted in another lane's file (a rename of an exported symbol, a narrower
return type, a parameter object replacing positional ones, a helper another lane would call) is reported with the
exact change, for lane Z. A wider parameter type (`Readonly<…>`) needs no caller change; a `readonly T[]` parameter
passed on to another lane's function taking `T[]` does, so it is reported too.

| Lane | Owns | Lists its findings with | Phase |
| --- | --- | --- | --- |
| 0 config and root | `eslint.config.mjs`, `oxlint.config.mts`, `agents-inc.lint.mts`, `package.json`, `bun.lock`, `scripts/`, `stryker*.config.*`, `packages/*/vitest*.config.ts`, `packages/lint-rules/tsdown.config.ts`, `packages/eslint-plugin-house/package.json`, `packages/lint-rules/src/repo-own-lint-configs.integration.test.ts` | the whole-repo commands, kept to these paths and `.agents-inc`, `packages/lint-rules/test-fixtures` | 1 |
| K collect-time moves | every file holding a call the widened finder lists (`grep -o "file: '[^']*'" packages/lint-rules/src/__tests__/collect-time-throws-left.ts \| sort -u` once the widening lane has landed), each importer a helper-module move must change (`grep -rl <export> packages`), `collect-time-throws-left.ts`, `test-collection.test.ts` | no new finding on a line it changed: by-file-and-rule counts of its files, before and after | 1, beside lane 0 only if the two file lists do not meet; else after it |
| H house | `packages/eslint-plugin-house/src/**` | `npx eslint packages/eslint-plugin-house/src`, same for oxlint | 2 |
| R rule-data | `packages/rule-data/src/**` but `src/generated/**` | `packages/rule-data/src` | 2 |
| C core and entries | `packages/lint-rules/src/core/**`, and `packages/lint-rules/src/*.ts` that are neither tests nor `cli.ts`: `ls packages/lint-rules/src/*.ts \| grep -v -E '\.test(-d)?\.ts$\|/cli\.ts$'` | those paths | 2 |
| L cli | `packages/lint-rules/src/cli/**`, `packages/lint-rules/src/cli.ts` | those paths | 2 |
| S shared test helpers | `packages/lint-rules/src/__tests__/**` | that folder | 2 |
| T top-level tests | `packages/lint-rules/src/*.test.ts`, `packages/lint-rules/src/*.test-d.ts` | `npx eslint 'packages/lint-rules/src/*.test.ts' 'packages/lint-rules/src/*.test-d.ts'` | 2 |
| M mutation-testing | `packages/lint-rules/mutation-testing/**` | that folder | 2 |
| Z leftovers | Q1's sites and the reported cross-lane changes, by file; docs (`docs/**`, `CLAUDE.md`) | the whole-repo commands | 3 |

C, S and T carry the most findings (the by-area command shows it); the orchestrator may split one by file. Lane K
finishes before phase 2 because its files are spread over C, L, S and T.

## Files no lane touches

- `packages/rule-data/data/**`, `packages/rule-data/src/generated/**`: shipped data and generator output.
- `packages/lint-rules/test-fixtures/**`: code that breaks rules on purpose.
- `.agents-inc/**`: written by the agents-inc CLI.
- `packages/lint-rules/package.json` `exports`, `files`, `bin`: published.
- `docs/**`, `CLAUDE.md`: lane Z alone.

## Technical constraints

- **Precondition, re-derived 2026-10-24:** a lane starts once no other lane is editing a file it owns. Today that means
  the LA/LB fix round and the finder-widening lane have landed (lane K needs the widened list anyway). A commit is not
  required: `--only <files> --testFiles <specs>` keeps a mutation run to the lines named. Without the commit, two things
  change, and every lane does them:
  - **Mutation runs name ranges.** The round takes the lines changed since HEAD, and every untracked file whole
    (`mutateArgument`, `scripts/mutate-changed-lines.mts`), and `--only` keeps the part inside the files and ranges
    named. Where a lane's file is untracked (`git ls-files --others --exclude-standard`) or holds another lane's
    uncommitted lines, `--only <file>` would mutate that work too: name `<file>:<start>-<end>` for the lane's own hunks.
  - **Diffs read against a copy, not HEAD.** Copy the lane's owned files into `<S>/before/` as it starts. Every
    diff-based check (assertions changed, disables added, the real-run baselines) reads `diff -ru <S>/before <paths>`,
    which leaves out the uncommitted work of earlier lanes.
  Committed first, both reduce to `--only <file>` and `git diff`.
- Lanes share one tree. A red gate in another lane's file is reported, never fixed. The decisive gate is lane Z's, run
  on a frozen tree.
- Node 22.18+ (`node --version`); the lock for every build and run; no `cd X &&` at the start of a Bash command; git read-only.
- `check`'s agent set bans suppressions (root `agents-inc.lint.mts` sets no `allowSuppressions`); it matters only if the
  owner later has agents run `check` here. The editor set the gate runs allows them.

## Dependencies

- **Requires:** the precondition above; the owner's answer to Q1 for its sites (lane Z).
- **Blocks:** adding the two lint commands to every brief's gate list.

</constraints>

<success_criteria>

## Done (lane Z, tree frozen, after every lane and Q1's answer)

| Criterion | How to verify |
| --- | --- |
| ESLint reports nothing over the whole repo | `<lock>` `bun run build && npx eslint . -f json -o <S>/eslint.json`; exit 0; `jq '[.[] \| .messages[]] \| length'` prints 0; fatal check 0; `jq length` (files linted) equals the first measurement's less the `.agents-inc` files |
| oxlint reports nothing over the whole repo | `<lock>` `npx oxlint --disable-nested-config --format=json > <S>/oxlint.json`; exit 0; `jq '.diagnostics \| length'` 0; `jq .number_of_files` greater than 0 |
| Gates green | `<lock>` `bun run typecheck` (knip first) and `bun run test`, unfiltered, each with its output visible and a non-blank exit code |
| No collect-time throw left | `test-collection.test.ts` green, asserting the finder finds none; `collect-time-throws-left.ts` gone |
| No shipped rule changed | `git diff --exit-code -- packages/rule-data/data packages/rule-data/src/generated`; `bun run --cwd packages/rule-data generate` then the same diff |
| Published declarations unchanged | `dist/*.d.mts` saved after the pre-clean-up build, compared with the final build's: `diff <(cat <S>/dts-before/*.d.mts) <(cat packages/lint-rules/dist/*.d.mts)`; a hunk changing only a chunk's hash suffix is no change; anything else only as Q1 rules |
| Same tests, same verdicts | per package, `npx vitest run --reporter=json --outputFile=<S>/tests-<pkg>-<when>.json` from the package folder (inside the lock's `bash -c`), before phase 1 and at the end; `jq -r '.testResults[] \| .name as $f \| .assertionResults[] \| "\($f)\t\(.fullName)\t\(.status)"'` sorted, identical; `grep -rcE '(it\|test)\.fails' packages/*/src packages/lint-rules/mutation-testing` identical per file |
| Every disable carries proof | `grep -rnE "(eslint\|oxlint)-disable" packages scripts *.mjs *.mts \| grep -v -e node_modules -e test-fixtures -e /dist/` against the baseline line: each new line has `--` and a compiler error code or the concrete break; the `no-let` ones carry requirement 4's wording; the list is in lane Z's report |

## Per lane, before its report

| Criterion | How to verify |
| --- | --- |
| Owned files lint-clean but Q1's sites | the lane's list commands print only Q1's sites (lane C) or nothing |
| Assertions changed are listed | `diff -ru <S>/before <owned test paths> \| grep -E '^[-+].*(expect\|assert)'`, each with why it tests the same thing (`toThrowError` → `toThrow` is one such: the same matcher) |
| Mutation on changed source lines (H, R, C, L) | `<lock>` `node scripts/mutate-changed-lines.mts [config] --only <files or ranges> --testFiles <specs>` (`docs/work/mutation-testing.md`, "One lane's changed lines"); each Survived or NoCoverage gets a test or a measured reason; a load-time Survived under `--testFiles` is re-run without it (q-lint-only-module-load); a line whose mutants are all CompileError, or that gets none, is broken by hand (learnings: "Stryker's totals for a range can say 0 survived…") |
| Hand breaks where no config mutates (K, S, T, M) | each changed decision line broken by hand and a test seen failing |
| Same output from the real tool | the lane's real-run cases (below), recorded before the change and after, byte-identical, tracked in `<S>/real-runs.md` |

</success_criteria>

<implementation_notes>

## Rule guidance (every lane)

| Rule | Fix | Config or site | Risk to behaviour |
| --- | --- | --- | --- |
| `functional/prefer-immutable-types` | Wrap the parameter's type (requirement 6) | Site (owner-ruled) | Types only; a `readonly` array passed on to a `T[]` parameter fails tsc where the callee lives (report if another lane's). Published signatures: Q1 |
| `unicorn/consistent-function-style` | Method shorthand; function declaration | Site | Low: a method has its own `this` (check none read it); a declaration hoists; an arrow that defers a call stays deferred |
| `@typescript-eslint/array-type` | `ReadonlyArray<…>`/`Array<…>` for non-simple types (autofix, by rule) | Site | Types only; in a type that reaches `dist/*.d.mts`: Q1 |
| `@typescript-eslint/no-deprecated` | `toThrowError` → `toThrow` (same matcher). `builtinRules` (`eslint/use-at-your-own-risk`): find a supported API that lists ESLint's core rules or keep it with proof. The top-level plugin `name`/`version` reads in `withOurVersion` and `nameOfPlugin`: keep, with proof (pattern 5) | Site | Switching the plugin reads to `meta.*` changes which name and version a team's plugin is read by: never |
| `functional/immutable-data`, `functional/no-expression-statements`, `functional/no-return-void` | House rule, shared and `house-rule-tester.ts`: lane 0's entry (ruled). Elsewhere: a pure core and an edge; the process edge (`process.exitCode`, `process.stderr.write` in `src/cli.ts`, `cli/main.ts`, `cli/outcome.ts`) stays in one edge function with a proof-carrying disable. `core/other-engine-config.ts`'s reading mode is module state by design (architecture, "Loading") | See left | High in `cli/main.ts` and `other-engine-config.ts`; `mutation-testing/child-process-bridge.ts` is untested (lane M) |
| `functional/no-let` | Requirement 4 for hook-assigned `let`s. Others: rewrite (`cli/main.ts`'s signal state, `cli/outcome.ts`, `cli/check/report.ts`, `fix-guard.ts`, `eslint-run.ts`, a PRNG or poll handle in a helper) | Site | High for the signal state (`check-second-signal.integration.test.ts`, `cli/main.test.ts`) |
| `unicorn/no-top-level-side-effects` | Only in `define-lint-rules.test-d.ts`: lane 0's type-test entry (ruled) | Config | None |
| `unicorn/consistent-boolean-name`, `unicorn/no-non-function-verb-prefix`, `sonarjs/function-name`, `sonarjs/variable-name`, `unicorn/no-keyword-prefix`, `unicorn/name-replacements` | Rename | Site | A rename reaching another lane's file is reported |
| `sonarjs/different-types-comparison`, `@typescript-eslint/no-unnecessary-condition`, `@typescript-eslint/prefer-optional-chain` on a check the types call impossible | Never delete or loosen a runtime check, and never `===` → `==`, without a real run proving it unreachable. `Object.entries` over a `Partial` record drops `\| undefined` from the type, not from the data (`listsGivenBy`, `core/resolve-rule-layers.ts`); typescript-eslint types `Program.parent` as undefined, at run time it is `null` (learnings, Slice 1). Reachable: fix the type, or keep with proof | Site | High: these are the sites where a "fix" deletes a guard |
| `@typescript-eslint/no-unsafe-*` | Type the value once at its boundary (a dynamic import of `dist/`, ESLint's `any`-typed `calculateConfigForFile`); CLAUDE.md "No casts except at parse boundaries" | Site | Low |
| oxlint `eslint(require-unicode-regexp)`, `regexp/*` | Add `u` only after a case pins a match and a non-match for that regex: under `u` an identity escape such as `\-` outside a class is a syntax error and `.` spans astral characters | Site | High in house and rule-data (shipped regexes) |
| oxlint `unicorn(no-array-for-each)` | `for…of`; test titles unchanged. A loop sequential on purpose then draws `no-await-in-loop`: keep with proof (learnings: `scripts/mutate-changed-lines.mts` runs share Stryker's working copy) | Site | Low |
| oxlint `unicorn(consistent-function-scoping)` | Hoist to module scope (a declaration, not a call) | Site | Low |
| oxlint `eslint(prefer-destructuring)` | Destructure in place | Site | None |
| oxlint `eslint(max-params)` | A parameter object | Site | Signature change: report references outside the lane |
| `@typescript-eslint/require-array-sort-compare` | `compareCodeUnits` (the default sort's order for strings) | Site | None for strings; a `string \| null` list needs a look |
| `@typescript-eslint/ban-ts-comment` in `suppression-ban.integration.test.ts` | The prose comment starting `// @ts-ignore and @ts-nocheck…` is a live TypeScript directive on the next line; reword it, and tsc must pass without it | Site | A type error it hid may surface: fix the type |
| oxlint `eslint(no-unused-vars)` on `parserOptionsFor` in `merge-eslint-config.test.ts` | Triage first (CLAUDE.md, Tests: an unused binding in a test usually marks a missing assertion); report if the intended assertion is not obvious | Site | Weakening a test |
| oxlint `vitest(valid-title)` | A string title, printing the same name | Site | Test name drift |
| `@typescript-eslint/triple-slash-reference` in `packages/rule-data/src/eslint-plugins.ts` | Remove only if `bun run typecheck` and `bun run build` pass without it; else keep with the error code | Site | dts build |
| `sonarjs/no-undefined-assignment` on `buildCommand: undefined` (`stryker.*.config.mjs`) | Leave the key out (rest-sibling omit passes `no-unused-vars`, q-dogfood-rest-siblings). **Superseded 2026-10-24:** the omit draws oxlint's default `no-unused-vars` in config files, so `agents-inc.lint.mts` has a repo-own `fileOverrides` entry turning the rule off for `stryker.*.config.mjs`, its reason as a comment | Site | Stryker must still skip the build: real run |

## Every lane: the order (CLAUDE.md, "How work gets done")

1. Re-derive: run the lane's list commands and the by-area command. A row of this spec that does not describe the tree:
   stop on it, report it with the command and output, go on. Copy the owned files into `<S>/before/`.
2. **web-tester** pins what must not change (below), writing failing tests where a behaviour is unpinned and showing
   each new pin fail once (a characterization pin is shown to fail by a hand break, recorded). Records the before-state:
   the real-run cases' outputs, the test inventory, `dist/*.d.mts`.
3. **web-developer** clears the lane's findings by the guidance table, reporting cross-lane changes.
4. **Expressive-TypeScript pass**: the `meta-design-expressive-typescript` skill and nothing else, on the changed lines;
   lint stays clean.
5. **Real runs**: the lane's cases, after the change, compared with the before-state.
6. **reviewer**: verifies the no-behaviour-change claim with reproductions (the verifier is never the fixer).
7. Docs are lane Z's; a lane lists the sentences it made false.

Each lane's gate: its list commands; `<lock>` `bun run typecheck` and `bun run test` (unfiltered); the per-lane success
criteria. Every report: Corrections (or "nothing"), cross-lane changes wanted (exact), assertions changed, disables added
with their proof, d.mts diff result, hardening verdict.

## Lane 0: config and root

- **Tester pins** (in `repo-own-lint-configs.integration.test.ts`, red first, each a refusal beside an allowed case,
  CLAUDE.md, Tests; `severityOfCalculatedEntry`):
  - ESLint leaves `.agents-inc/claude/config-types.ts` out (`isPathIgnored`).
  - The three functional rules are off in a house rule file, in `src/shared/` and (immutable-data) in
    `house-rule-tester.ts`, and on in a house rule test file and in `packages/lint-rules/src/core/`.
  - `unicorn/no-top-level-side-effects` is off in `define-lint-rules.test-d.ts` and on in a non-type-test module.
  - Already pinned: the root configs and the fixture ignores (`repo-own-lint-configs.integration.test.ts`), the repo-own
    rule (`repo-own-rules.integration.test.ts`), the round script (`mutation-testing/mutate-changed-lines.integration.test.ts`),
    no `@workspace/` in dist (`dist.test.ts`), root `bun.lock` against `package.json` (`package-manifests.test.ts`).
- **Developer:** requirement 3; the root, `scripts/`, Stryker-config and vitest-config findings; `tsdown.config.ts`'s regex.
  `packages/rule-data/vitest.mutation.config.ts`'s top-level `mkdirSync` is required (its comment: without the copy's
  `.git`, `oxlint --print-config` exits 1, measured): keep with that proof unless a form passes `ignoreVoid`.
  **Superseded 2026-10-24:** the line was deleted. `child-process-bridge.ts`, that config's setup file, already makes
  the folder; Stryker runs with and without the line gave the same results.
- **Real runs:** the whole-repo commands; `<lock>` `bun run mutation stryker.rule-data.config.mjs --dryRunOnly`
  before and after shows no build step and the same test count; `node scripts/mutate-changed-lines.mts --only <a file>`
  on a scratch change prints as before.
- **Gate:** the lane's paths and the two ignored folders lint-clean; typecheck (knip sees the new house export used); tests.
  Then re-measure the whole repo for the phase-2 lanes.

## Lane K: collect-time moves

- **Starts** once the finder-widening lane has landed: its list (`collect-time-throws-left.ts`) then holds the
  helper-module sites too. Re-derive the list and every helper-module export's importers before claiming files.
- **Tester:** records the test inventory (Success criteria) for every package; changes `test-collection.test.ts`'s
  expectation from the known-gap list to "none found" (red now, listing every call; the owner's ruling makes the old pin
  wrong, CLAUDE.md, Tests); for each `.each` table and each `describe`-body value being moved, notes the titles it yields.
- **Developer:** requirement 5, call by call; requirement 4's forms where a hook's value crosses to tests; deletes
  `collect-time-throws-left.ts` once empty. A helper module's top-level call (a lookup building an exported constant)
  becomes something its importers call where they use it, so the call runs inside their tests or hooks.
- **Stops on:** a move that would change a test's title or verdict, or the number of tests a file collects.
- **Real runs:** the test inventory before and after, identical; each moved call broken by hand to throw, and the run
  showing one named failing test where it showed a file error before (CLAUDE.md, Tests: a throw at collect time fails
  the whole file naming no assertion).

## Lane H: house

- **Pins:** `packages/eslint-plugin-house/src/rules/<rule>.test.ts` per rule (cases in `src/__tests__/cases/`),
  `src/plugin.test.ts`; Stryker's house config (static mutants included) over the files to be touched, before the
  change, and a test for each survivor; a match and a non-match for each regex gaining `u`; a case reaching each branch
  `sonarjs/different-types-comparison` calls impossible (`no-create-context-in-render.ts`, `no-unstable-list-keys.ts`).
- **Developer:** what lane 0's entry leaves.
- **Real runs:** `init` into a scratch project, a React file holding each house rule's valid and invalid cases, `check`
  on it: findings identical before and after.

## Lane R: rule-data

- **Pins:** `src/generate/generated-files.test.ts` (the generator's output is the committed files), `canonical-list.test.ts`,
  `catalog.test.ts`, `eslint-plugins.test.ts`, `src/generate/read-installed*.test.ts`; Stryker's rule-data config;
  regex pins as H.
- **Developer:** everything, hook `let`s by requirement 4 (e.g. `src/__tests__/temp-dirs.ts`).
- **Real runs:** `bun run --cwd packages/rule-data generate` leaves `git diff -- packages/rule-data/src/generated` empty.

## Lane C: core and entries

- **Pins:** each `core/*.test.ts`; read-only to C, the top-level suites over core's output (`merge-eslint-config*.test.ts`,
  `merge-oxlint-config*.test.ts`, `editor-merges.*.integration.test.ts`, `gate-equivalence.test.ts`,
  `editor-equivalence.test.ts`, `agent-configs.project-facts.integration.test.ts`, `merge-other-engine-config*.test.ts`)
  and the type-error positions (`lint-rules-type-errors.integration.test.ts`, `file-override-globs-type-errors.integration.test.ts`,
  `merge-oxlint-config-type-errors.integration.test.ts`, `define-lint-rules.test-d.ts`). A case for `listsGivenBy` given a
  list written `undefined`. Stryker's default and static configs.
- **Developer:** all but Q1's sites (stop on any `dist/*.d.mts` hunk) and the deprecated reads kept with proof.
- **Real runs:** `npx eslint --print-config <file>` and `npx oxlint --print-config` from the root for a source, a test,
  a type-test and a config file, and inside `packages/lint-rules/test-fixtures/consumer-files` and
  `consumer-files-without-oxlint`: identical before and after.

## Lane L: cli

- **Pins:** `cli/**/*.test.ts`; read-only to L, `check*.integration.test.ts` (signals: `check-second-signal`),
  `init.integration.test.ts`, `packed-install.integration.test.ts`, `cli-dist.test.ts`, `node-warnings.integration.test.ts`.
  Before rewriting `cli/main.ts`'s and `cli/outcome.ts`'s state, a pin for each path through it: one signal, two, a
  failure mid-run (exit code and the autofixed line).
- **Developer:** everything; hook `let`s in `cli/main.test.ts` and `cli/check/fix-step.test.ts` by requirement 4; the
  process edge kept with proof.
- **Real runs:** in a scratch git repo after `init`: `check` with no change, with a fixable and an unfixable finding, with
  Ctrl+C mid-run, and `init` again (nothing to write): stdout, stderr and exit code identical before and after.

## Lane S: shared test helpers

- **Pins:** the helper tests in `src/__tests__/*.test.ts` (one per helper with logic), and the suites calling each helper;
  the test inventory. No Stryker config mutates this folder: hand breaks.
- **Developer:** everything; `runs-before-the-suite.ts`'s own `let` by requirement 4's second paragraph (TS2588; it is
  the helper that carries a value across); renames and narrower returns of exported helpers reported.
- **Real runs:** the test inventory, before and after.

## Lane T: top-level tests

- **Pins:** the test inventory; `test-collection.test.ts` (lane K's "none found").
- **Developer:** everything; hook `let`s by requirement 4. `toThrowError` → `toThrow`; `ban-ts-comment` and
  `parserOptionsFor` as the table says.
- **Real runs:** the test inventory; `bun run typecheck` shows each `@ts-expect-error` still needed (TS2578 otherwise).

## Lane M: mutation-testing

- **Pins:** first, commit the harness learnings names as missing ("Missing guard: nothing catches a behaviour change in
  `mutation-testing/child-process-bridge.ts`": a fake Stryker namespace loaded first, the real bridge second, a dry run,
  children spawned per test and in a hook, the final per-test coverage asserted); the existing `*.test.ts` beside each
  module and `mutate-changed-lines.integration.test.ts`. No config mutates this folder: hand breaks.
- **Developer:** everything; what the vitest/Stryker setup API requires (the bridge mutates the process and the
  coverage maps by design) stays with proof naming what breaks.
- **Real runs:** `<lock>` `bun run mutation stryker.rule-data.config.mjs --force --mutate packages/rule-data/src/generate/read-installed.ts:<the OXLINT_CONFIG_SETTING_NOTHING line>`
  kills that mutant before and after (learnings: it is killed only through the bridge).

## Lane Z: leftovers, final gate, docs

1. After Q1's answer: its sites. The cross-lane changes each lane reported.
2. Freeze the tree; run every Done criterion once.
3. Docs, false sentences only (CLAUDE.md, Docs): plan.md Open's "Left: each area's lint clean-up", the nested-config
   bullet, and the collect-time owner call; CLAUDE.md, Tests, on `test-collection.test.ts` if it still speaks of a
   known-gap list; learnings' "for the lint clean-up" and "which no gate runs" sentences (record the correction, do not
   overwrite); the gate's commands in one place, `docs/architecture.md` beside the knip paragraph, everywhere else
   links to it.

## Reviewer focus

- Every rewritten guard (rule guidance, "checks the types call impossible"), every `let` rewrite in `cli/`, every
  regex given `u`, every collect-time move: a reproduction for each, before and after.
- Disables: proof after `--`, never "the rule is annoying"; the `no-let` ones only where an `it.fails` test reads the binding.
- Test diffs: assertion lines, titles, `it.fails` marks, tests per file.

## Hardening verdict

- The gate holds the class once briefs carry it; nothing runs it unprompted (owner: no script, no hook).
- A disable that goes stale is reported by nothing: `reportUnusedDisableDirectives` is off beside oxlint (architecture,
  step 6). An ESLint or oxlint flag reporting unused directives might, but each engine may read the other's directives
  as unused (not measured). Owner's call; not built here.
- Nothing checks that a `no-let` disable sits on a binding an `it.fails` test reads; the reviewer reads each.

</implementation_notes>

<questions>

## Resolved (owner, recorded)

- Where the gate runs → no script: sub-agents run the commands (q-dogfood-whole-repo-lint, 2026-10-16).
- `prefer-immutable-types` on library types → wrap in `Readonly<…>` (q-dogfood-library-types-readonly).
- Mutation the ESLint rule API needs → off for those files in `fileOverrides` (q-dogfood-required-mutation), and the same
  entry covers `no-expression-statements` and `no-return-void` (q-lint-own-rule-file-overrides, 2026-10-24).
- Type tests → `unicorn/no-top-level-side-effects` off for `**/*.test-d.ts` in this repo (q-lint-own-type-test-files, 2026-10-24).
- The `it.fails` read-before `let` → allowed (q-lint-no-let-it-fails, 2026-10-24); the form is requirement 4's.
- Collect-time throws → each moves into its test or a hook (q-lint-collect-time-left, 2026-10-24); the finder widens to
  helper modules and their sites move too (q-lint-collect-time-reach, 2026-10-24).
- `consistent-return`, `no-generated-empty-object-type`, `no-non-function-verb-prefix` on correct code → the rewrites
  (q-dogfood-keep-three; the `never` default, owner 2026-10-22).

## Still open

- **Q1, q-lint-own-published-types.** `prefer-immutable-types` on `theirs` of `mergeEslintConfig` (`src/eslint.ts`) and
  `mergeOxlintConfig` (`src/oxlint.ts`), `array-type` on `AtLeastOneFileGlob` (`src/index.ts`), and any fix in a type
  inlined into `dist/*.d.mts`, change what a consumer's types read. Lane C leaves them; lane Z does them by the answer.
- **q-lint-own-calls** (the lint session's calls on its old page, a previous account): not read; nothing found in the
  repo or the trackers ties it to this spec.

</questions>
