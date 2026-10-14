# lint-rules — working agreement

**Read [`docs/plan.md`](docs/plan.md) first.** It holds every decision made so far, what is still
open, and the target monorepo layout. A decision recorded there is settled: do not re-open it
without the owner. [`docs/architecture.md`](docs/architecture.md) says how the code is built and how
a rule flows from data to the two engine configs.

## The rules already exist: they live in ai-benchmarking

This repo packages a rule set that was built and proven as the lint gate of **ai-benchmarking**,
at `~/dev/ai-benchmarking` ([github](https://github.com/vincentbollaert/agentic-benchmarking)).
Before implementing anything, read how the rules work there. **Treat that repo as read-only from
here.** It has its own `CLAUDE.md`, and changes to it belong in a session started in that folder.

| What | Where in `~/dev/ai-benchmarking` |
| --- | --- |
| How the gate works: tiers, cwd traps, open defects, the typed-lint workaround | `docs/lint-gate.md` |
| Every enabled rule, what it does, whether it is proven to fire (generated) | `docs/lint-rules.md` |
| The master list: enabled / considering / rejected, each with its reason (generated) | `docs/lint-rules-ledger.md` |
| Rejected rules and plugins, and why (generated) | `docs/lint-rules-rejected.md` |
| Candidate rules, and enabled rules that may not earn their cost | `docs/lint-rule-research.md`, `docs/lint-rule-concerns.md` |
| Putting the gate into another project | `docs/install.md` |
| **How to judge whether a rule is worth adopting.** The owner's criteria; follow them here too. | `CLAUDE.md` → "How to judge a candidate rule" |
| The generated engine configs. Never hand-edit them. | `agents-inc/vendor/lint/oxlint.json`, `eslint.config.mjs`, `eslint.typed.config.mjs`, `ignore-patterns.json` |
| The generators for those configs | `scripts/build_lint_config.py`, `scripts/build_eslint_config.py` |
| The rule decisions the generators read | `agents-inc/vendor/lint/rule-triage.json`, `rule-candidates.json`, `plugin-verdicts.json`, `false-positives.json` |
| Our custom rules (`house/*`) | `agents-inc/vendor/lint/house/index.js` |
| The runner today, scoped to changed lines | `agents-inc/vendor/lint/gate.mjs` (plus `baseline.mjs`, `format.mjs`, `typecheck.mjs`) |
| Patched plugins | `agents-inc/vendor/lint/patches/` |
| **Tests:** one fixture per rule, proving it fires | `tests/lint-fixtures/fixtures.json`, run by `scripts/test_lint_rules.py` |
| **Tests:** code each rule must stay silent on | `tests/lint-fixtures/negatives/`, run by `scripts/test_lint_negatives.py` |
| **Tests:** end-to-end behaviour of the gate | `scripts/test_lint_hooks.sh` |
| Checks: every rule in exactly one state, fixtured, proven | `scripts/rule_ledger.py --check`, `scripts/check_rule_coverage.py`, `scripts/rejected_rules.py --check` |
| Checks: no generated config was hand-edited | `scripts/check_generated.py` |
| Do autofixes converge? | `scripts/lint_fixpoint_audit.py` |
| One-line description of every script | `docs/setup.md` |

Before copying anything from the gate, check `docs/plan.md` → "Does not carry over from the gate".

## Environment

- TypeScript configs (`oxlint.config.ts`, and `.ts` files imported by `eslint.config.mjs`) need
  Node 22.18+. A shell that loads the profile gets fnm's Node 23.10 (check with `node --version`);
  anything that skips the profile, such as a hook, falls back to `/usr/bin/node`, which is 18.20.8.
  Node 22.23 is also installed at `~/.local/share/fnm/node-versions/v22.23.2/installation/bin`.
- The sibling monorepo `~/dev/cli` is the reference for workspace conventions: bun workspaces,
  Turborepo, shared `*-config` packages.

## How work gets done

The order is the point. Gathered 2026-10-10 from the owner's other repos (ai-benchmarking and the
agents-inc monorepo) and his recorded feedback; none of it is specific to those repos.

1. **Research first.** Read how the thing works today (in ai-benchmarking, or with `web-researcher`)
   before proposing anything. Re-derive every number and path; never trust one from memory or from
   an old brief.
2. **Spec anything non-trivial** with `pm`: fenced scope and success criteria that can be checked.
3. **Write the tests first and watch them fail** (`web-tester`). A test that has never failed has
   not been shown to test anything.
4. **Implement until they pass** (`web-developer`).
5. **Then an expressive-TypeScript pass:** apply the `meta-design-expressive-typescript` skill and
   nothing else.
6. **Then run it for real.** Green tests and a working tool are different claims. Drive every
   variant by hand (the runner on a real repo, `init` into a scratch project), track each case in a
   file, and mark, fix and re-run what breaks.
7. **Review behavioural changes** with `reviewer`. An obviously simple fix with no knock-on effects
   (a stale comment, a wrong string) skips review rounds: do it, run the affected tests, done.
8. **Then docs, in the same turn:** fix only the sentences the change made false, and update the
   Open list in `docs/plan.md`.

Steps 7-8 are how the work is finished, not a tidy-up phase for later.

## Working with sub-agents

- **The orchestrator plans, briefs, verifies and records. Sub-agents make the changes**: code,
  tests, docs and config. Quick reads, and running a suite to check a sub-agent's claim, are fine.
- **Every brief says:** read `CLAUDE.md` first; read-only git is fine and every git write is the
  owner's; check your own output against `CLAUDE.md` before finishing; report any anti-pattern
  fixed or standard found missing.
- **Re-derive before you write a brief.** Its figures were measured against a tree that has since
  moved. An agent whose brief does not match the tree stops, reports it with evidence, and does not
  invent work to justify the brief.
- **A brief carries the command, not its result:** no counts, just the invocation that produces one.
- **Corrections are a required field of every report:** what in the brief proved false, with
  "nothing" written out when nothing did.
- **Name the files each agent owns** whenever more than one is working. A change needed in someone
  else's file is reported, not made.
- **The verifier is never the fixer. A verdict carries a reproduction, not a judgement.**
- **Translate reports before relaying them:** what happens to a user, why it matters, what the fix
  is. Never pass on agent-to-agent shorthand.
- **Keep a written queue** of in-flight and waiting background work, with resume commands. An
  interrupted lane must not look like a finished one.

## Scope and decisions

- **Ask before building anything a user would see or type** that the owner has not named: a
  command, flag, config key or ruleset. A plan recommending it is not the owner asking, and
  mentioning it in a status update is not asking either. Offer the alternatives, including "do
  nothing". Internal structure needs no permission.
- **Never introduce a new tool, workflow or strategy** the owner has not asked for.
- **When the owner says a suggestion came from research, default to building it.** Verify the facts,
  not the worth. A stale figure makes a number wrong, never the idea.
- **A guard is not a feature.** A test, lint rule, checker or written standard stays in scope even
  when the work is "fixes only".
- **Fix causes, not symptoms.** When a sweep finds problems, write them up (symptom, reproduction,
  suspected cause) and work out the cause with the owner before fixing anything.
- **A loop that keeps firing is evidence.** If review rounds keep finding the same kind of defect,
  fix what produces it. Never cap the rounds.

## Verification

- **Verify before declaring a criterion met.** Name the measurement, run it, and use the honest word:
  "narrows" is not "closes".
- **Report what happened, including nulls and failures.** A run with blank output and exit 0, or a
  test run that collected zero tests, has not passed.
- **A matching name is not proof.** A rule counts as implemented on an engine only once its fixture
  fires there.

## Tests

- **Do not change an existing test** unless a bug fix makes its old assertion wrong, the edit leaves
  what it tests unchanged, or the owner says so. Say exactly which assertions changed and why.
- **Tests survive a refactor.** If restructuring the code without changing its behaviour turns an
  integration or end-to-end test red, it was testing the implementation.
- **Never broaden a failing assertion to make it pass.** Mark a known gap (`it.fails`, or a
  commented `KNOWN GAP:` with the strict assertion kept).
- **Assert members, not counts**, with `toStrictEqual`. A count cannot see a swap.
- **Pin a refusal next to an allowed case** in the same file, or a guard that has swallowed its whole
  domain still passes.
- **No inline test data** (use factories), **no untested parsing helpers inside test files**, and
  **no ticket IDs in test names**. An unused binding in a test usually marks a missing assertion:
  triage it before deleting it.
- **In an `it.fails` test, only the assertion may throw.** Run the tool (oxlint, say) in
  `beforeAll`, or the test "passes" when the tool itself crashes.
- **Break each new decision point and watch a test fail.** After implementing, a script breaks one
  line at a time, serving the broken module without writing the source file (a Vite `load` hook,
  say), and asserts a test fails for each break. A break no test catches gets a test, or a reason
  measured as the next bullet says. Before counting, the unbroken run is clean or its failures are
  explained, and a scratch copy builds whatever the tests load: `packages/lint-rules`' integration
  tests run the engines on the built `dist`, so a break not built into it reaches none of them.
- **"This break changes nothing" needs a run of the real tool** on the exact config the break
  writes, not on a similar one.

## Code

- **The owner's standard:** expressive TypeScript that reads declaratively, and function names that
  say what the code does. More code is fine when it is more readable and testable. Passing tests are
  table stakes, not the goal.
- **No casts except at parse boundaries.** No `as unknown as`. No non-null assertions or silent
  fallbacks (`?.`, `??`, `|| []`) on data that must exist: look it up and throw on a miss.
- **No backward-compatibility shims before 1.0.** Remove old code cleanly.
- **Named exports only** (except where a tool loads `default`, e.g. `*.config.*`). Kebab-case files.
  No magic strings or numbers.
- **Comments only where the code is unintuitive.** No banner or section-divider comments.
- **An `eslint-disable` needs proof after `--`:** the compiler error or the concrete thing that
  breaks, never "the rule is annoying here". A caught error reports its cause; never rename it to
  `_error` to silence lint.
- **No machine-specific absolute paths in code or config.**
- **Generated files are never hand-edited.** Change the source data or the generator.

## Docs

- **Docs change in the same turn as the thing they describe,** and only where something became
  false. Prefer deleting a claim to rewriting it; every rewrite is a new claim that can rot.
- **Record corrections** (old, new, why) instead of silently overwriting.
- **No line numbers in docs.** Name the function and the file.
- **Carry the command, not the count.** One owner per fact; everywhere else links to it.
- **Be concise.** Cut any sentence that would not change what someone does.

## Talking to the owner

- **Short.** Lead with the outcome; stay under about 10 lines. Interim updates during long runs are
  one or two sentences.
- **Plain language first,** identifiers second. When naming a ticket or rule, say what it is.
- **Compact the session at about 500k context used,** between units of work, not mid-dispatch.

## Git

- **Never run a git write** (`add`, `commit`, `push`, `checkout`, `restore`, `reset`, `stash`,
  `clean`, `rebase`, `merge`, `tag`) unless the owner asks in that turn. Permission does not carry
  forward, and do not keep offering. Read-only git (`status`, `log`, `diff`, `show`, `blame`) is
  always fine. The same applies to sub-agents.
- **No git worktrees.**
