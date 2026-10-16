# Mutation testing playbook

A recipe for adopting StrykerJS in a TypeScript monorepo tested with vitest, to follow step by step
in `~/dev/cli`. It distils this repo's adoption (2026-10-14 to 2026-10-16). How to run it here, and
why each part of this repo's setup exists: [mutation testing](mutation-testing.md).

`<backup>` is this repo's session backup, holding the notes, scripts and reports of those runs:
`~/.claude/projects/-home-vince-dev-agents-inc-lint-rules/a25168ef-5c3c-4f9b-b5bd-1ca853c645f7/scratch-backup`.

## 1. What it does and doesn't do

- It makes one small break at a time (`&&` for `||`, a condition forced true, a call or literal
  emptied) and runs the tests that cover it. A break no test catches marks code no test checks: a
  list of weak tests, not a score.
- It cannot drop a field, reorder blocks, stop after one step, or remove a wrapping call or a spread
  element. Those breaks are still made by hand (`CLAUDE.md`, "Break each new decision point").
- Run it on the changed lines once a change's gate is green, and on a whole package only once the
  code has stopped moving: mutating code that is about to be deleted wastes hours.

## 2. Preflight (read-only)

1. **Count mutants per package** without running Stryker, with its own `Instrumenter`:
   `<backup>/cli-estimate/inventory.mjs` (usage in its header). It also counts the mutants in code
   that runs while modules load, and in files no test imports. Nothing inside `x as T` is mutated.
2. **For each package, record how its tests reach the code:** in-process, through a built `dist`, in
   a spawned process, or in a browser. Each path has its own setup step below; a browser has none.
3. **Check versions** (Stryker's three packages, vitest, Node 22.18+), and **list the blockers:**
   tests that call `process.chdir`, read source text, need the network, write fixed temp paths, or
   need a browser.
4. **Estimate:** wall time ≈ initial run + (tested mutants × seconds per mutant per worker) ÷ concurrency.
   - **Initial run:** the whole suite on one worker. Measured: house 6 s, rule-data 27 s,
     lint-rules 11–24 min.
   - **Tested mutants:** the TypeScript checker refuses roughly 40% at almost no cost (20–58%
     measured); a mutant no test covers costs nothing.
   - **Seconds per tested mutant per worker** (mutant-phase time × concurrency ÷ tested mutants, at a
     machine load of 25–70 on 16 cores): in-process, 3–4 s (house), 21–36 s where every mutant runs
     every test (rule-data), 72–200 s (lint-rules' second pass); 98–480 s where mutants rerun tests
     that spawn ESLint and oxlint (lint-rules' first pass).
   - **Concurrency N:** half the processes check types until checking ends, then all N run tests
     (`concurrency-token-provider.js` in Stryker core). Each process took 0.7–1.3 GB here.

## 3. Setup, in a copy of the repo, never the live tree

A run writes `.stryker-tmp/`, `reports/` and dependencies, and another session works in the live
tree. rsync it to a scratch copy without `node_modules`, `.turbo` and build output, then run
`bun install --frozen-lockfile --ignore-scripts`. Keep notes and reports out of `/tmp`, which a
restart wipes.

1. **Dependencies:** `@stryker-mutator/core`, `vitest-runner` and `typescript-checker` at one exact
   version (10.0.0 here) in the root `package.json`; no install scripts needed. Gitignore
   `.stryker-tmp/` and `/reports/`. Run the gate after: the install moved shared dependencies here.
2. **One config per package**, kept at the repo root and run from it: from a package folder, tests
   that reach outside it by a relative path fail to load, and the run still passes. Copy this repo's
   pattern: one JSON config, and `.mjs` configs that spread it and replace `vitest.configFile`,
   `tsconfigFile`, `mutate`, `buildCommand` and `incrementalFile`. Each package's
   `vitest.mutation.config.ts` sets `root` back to the package. `mutate` takes source only (no tests,
   test helpers, `generated/`, `.d.ts`, or files a test compares on disk). `vitest.related: false`
   makes the initial run take every test, not only those importing the mutated files.
3. **Timeouts:** `dryRunTimeoutMinutes: 30`; the default 5 failed, since the initial run uses one
   worker. Where mutants rerun tests that spawn processes, `timeoutMS: 1800000`: the default budget
   reported 7 Survived as Timeouts, which count as caught. In-process configs need far less.
4. **`ignoreStatic`:** a mutant in code that runs while modules load runs every test. Leave it off
   where the suite takes seconds (rule-data, house). Where it takes minutes, turn it on and add a
   second-pass config with `ignoreStatic: false`, over in-process tests only, with its own
   `incrementalFile` (or the first pass's results are reused). It must be a file: Stryker's command
   line can only turn `ignoreStatic` on. Why: [Known limits](mutation-testing.md#known-limits).
5. **Reporters and type checks:** `clear-text` (`reportTests: false`), `progress-append-only`
   (`progress` prints nothing outside a terminal), `html`, and `json` for the round script;
   `cleanTempDir: always`. Limit `disableTypeChecks` to mutated folders, or `false`: its default
   writes `// @ts-nocheck` into test fixtures too, which shifted line numbers tests assert.
6. **`buildCommand`,** when tests load a built `dist`: Stryker runs it once in the copy after
   instrumenting; without it, tests load the copied `dist`, which holds no mutants. The copy ignores
   `.gitignore`, so list build output, caches, docs and `reports` in `ignorePatterns`. A package
   imported by its name (`@workspace/x`) resolves to the original tree: give it its own config.
7. **Spawned processes:** Stryker tells only the test worker which mutant is on, and reads coverage
   only from it. lint-rules' bridge hands the mutant to child processes and brings their coverage
   back ([how](mutation-testing.md#how-the-integration-tests-see-a-mutant)). It relies on Stryker
   internals: after an upgrade, check that a mutant only children reach is still Killed. Code a test
   loads from `dist` in its own process needs no bridge.
8. **Sandbox tweaks:** the copy sits in the gitignored `.stryker-tmp/` with no `.git`, so oxlint
   (which honours `.gitignore` up to the nearest `.git`) found nothing to lint and failed the initial
   run; an empty `.git` made by the mutation vitest config fixed it. Expect the same from any tool
   that reads `.gitignore` or asks git. Tests that walk the repo also walk the copies.
9. **Runner patches,** only for the exact versions that need them. Vitest 5 names a test
   `describe > test` and runner 10.0.0 joins names with a space, so every mutant ran 0 tests and was
   reported Survived (stryker-js #6210) until `patches/` fixed it. Vitest 4.1 joins with a space:
   the patch must not go there. Symptom of a mismatch: every Survived ran 0 tests.
10. **Thread pool:** the runner forces `pool: 'threads'` and `maxWorkers: 1` (`#getVitestPoolConfig`
    in `vitest-test-runner.js`); vitest 4.1 applies that to every project, and `process.chdir` throws
    in a worker thread. Patch the runner to `forks` (untried: prove it with a dry run) or change
    those tests (stryker-js #6236).
11. **Proof:** `tsc --noEmit` first: one type error makes the checker refuse the whole run. Then
    `bun run mutation <config> --dryRunOnly` from the root, with no other `.stryker-tmp/` around. Its
    "Ran N tests" must equal a plain `vitest run` (for the second pass, with its excludes): a test
    file that fails to load adds no tests and the run still passes. Then a real run on a small range.

## 4. Running

- **A round** mutates the changed lines: `scripts/mutate-changed-lines.mts` passes each hunk of
  `git diff -U0 HEAD`, and every untracked file whole, to each package's config in turn, and fails
  when a mutant Survived after 0 tests ([Run it](mutation-testing.md#run-it)). A port needs its own
  hunk parser: it imports lint-rules' `addedSpanOf`. `--mutate` columns count from 0, the report's from 1.
- One area at a time, one Stryker per copy: runs share `.stryker-tmp/` and `reports/`. Keep a notes
  file as you go: each command, its start time, how to resume it, its results. Never rebuild `dist`
  while a run's tests run: it produced false kills. `--logLevel debug` crashes the runner.
- `--force` after a change outside the mutated and test files (data, fixtures, dependencies), which
  incremental mode cannot see, and after any run with a Survived that ran 0 tests.
- Stryker saves a partial incremental file on Ctrl-C or SIGTERM, but none on a hard kill or restart.
  After each run, back up `mutation.json` and the incremental file: the next run replaces them.

## 5. Reading results

- **Survived or NoCoverage:** a test, or a measured reason: a probe of the real tool with and without
  the mutant, plus a control mutant that does differ. For an unreachable line, name its guard.
- **Survived in load-time code** under `ignoreStatic` proves nothing: the mutant was switched on
  after the modules loaded, so only child processes saw it. Check it with the second pass (in the
  adoption, 64 of 95 kills were of this kind).
- **Survived after 0 tests** is no result: a test file failed to load. Mid-run, a mutant broke shared
  state (a helper wrote into a shared temp folder; 72 mutants ran 0 tests). Fix the cause, then `--force`.
- **Survived in load-time code after fewer tests than the initial run** (`testsCompleted` in
  `mutation.json`): the mutant crashed a module at load, failing only the files importing it
  (rule-data: 212 of 316). A plain vitest run with the mutant served shows the failures; the round
  script does not catch this.
- **Timeout** counts as caught but proves nothing. Re-run each alone (`--concurrency 2`, a `timeoutMS`
  just above the covering tests' time). Stryker's hit counter stops an endless loop in the test
  process, not in a child; a synchronous loop also ignores SIGTERM and outlives its worker, so run
  an orphan killer beside the pass (`<backup>/stryker-pass/cli/kill-orphans.sh`).
- **A test title holding a random path** changes every run, so Stryker never selects that test: fix it.
- **Every "equivalent" claim** gets a kill attempt by someone else; the verifier here broke one.
- **After a refactor,** compare with HEAD: `git archive HEAD` into a scratch folder, link
  `node_modules`, mutate HEAD's version of the changed code there, and match mutants by mutator and
  text (`<backup>/land-refactors/stryker/tools/compare.mjs`). A mutant HEAD's tests killed that now
  survives is a regression.

## 6. Agent workflow

1. **Setup agent:** section 3 in the copy, with the gate before and after and the dry-run counts.
2. **Area agents, one after another:** pass 1, the second pass on load-time survivors, Timeouts
   alone, then a test or a measured reason for each mutant left; the gate at the end.
3. **A separate verify agent** re-runs sample kills with `disableBail` (every killing test listed),
   tries to kill each equivalence claim, scans every report for 0-test Survived, checks initial
   counts against plain vitest, and shows each real bug's test fail on the unfixed code (served by a
   load hook, the source file untouched).

A real bug gets a failing test first and goes to the owner before the fix (`CLAUDE.md`, "Fix
causes"). Follow the target repo's `CLAUDE.md` where it differs.

## 7. The CLI repo

From the read-only estimate of 2026-10-16 (`<backup>/cli-estimate/results/`) unless another source
is named. The tree has moved since: re-count before relying on a number.

- **Order:** its plan (`~/dev/cli/todo/plans/REPO-44-tech-debt-and-lint.md`) runs Stryker at step 8,
  after the lint rollout and test prune, on `packages/compile`, `packages/matrix` and pure `cli/lib`
  modules. Ask the owner whether "soon" changes that.
- **Mutants** (`inventory.md`): cli 21,475; editor 5,939; compile 2,372; matrix 1,098; server 757;
  ui 609; api-mocks 492; api 23. vitest is 4.1.10, and the root `vitest.config.mjs` throws on
  purpose: point each config at the workspace's own (`tests.md`).
- **Leave out the three data tables** (`default-stacks.ts`, `skill-audit.ts`, `default-rules.ts`):
  7,343 mutants in load-time code, each running the whole suite (7–9 min): about 1,000
  worker-hours (`tests.md`).
- **Forks instead of threads:** 35 cli test files (all 21 command files, 3 integration, 11 unit;
  782 tests) call `process.chdir` (`tests.md`; list: `<backup>/cli-estimate/chdir-tests.txt`).
- **Commands load `dist`:** oclif runs in the test process but loads `./dist/commands`, so the copy
  rebuilds with `buildCommand` (tsup, 174 ms); without it the global setup refuses the stale `dist`.
  That check reads `../matrix|compile|api/src`, so the copy is the whole monorepo, and cli runs
  cannot mutate those packages. No bridge needed (`tests.md`).
- **Leave out the 21 gate files** that read or lint source text (264 tests, 42% of test time): in
  the copy they read instrumented code (`tests.md`; list: `<backup>/cli-estimate/text-gates.txt`).
- **Unsupported:** the editor's Playwright suite (no Playwright runner; 2,523 editor mutants only it
  reaches) and ui's Storybook stories in browser mode (`inventory.md`, `tests.md`). e2e and smoke
  tests start the built CLI at about 27 s per file: targeted ranges only, with a bridge.
- **The server's Cloudflare workers pool** sets its pool again in `configureVitest`; whether that
  beats Stryker's override needs a trial (`tests.md`).
- **Global setup** downloads the marketplace on each machine's first run (cached in `/tmp`), so it
  needs the network after a restart, and concurrent workers may race on it or on fixtures at fixed
  temp paths (`tests.md`; the `//test` note in `~/dev/cli/packages/cli/package.json`). Warm it first.
- **Memory:** a Stryker run of lint-rules took about 4.3 GB and a cli e2e run about 6 GB; together
  they pushed the machine to its limit (CLI session `7c9bdf02`, 2026-10-15). Don't overlap them.
- **Estimate:** `tests.md`'s worker-hours without the tables, e2e, Playwright and browser mode sum to
  19–99: about 3–17 h at 6 workers and 2–8 h at 12, plus each config's initial run. The server adds
  6.5–15 worker-hours if its pool works. The low end is optimistic: it took our trial's 3.7 s as per
  worker, but that was wall time at concurrency 4, about 15 s per worker.
- **First step (proposed):** a trial of about an hour in a copy, on one small in-process package
  (matrix or compile) and one `cli/lib` slice whose covering tests include a `process.chdir` file.
  It proves the setup (dry-run count equals plain vitest, the fork pool works, the global setup
  holds) and measures this repo's seconds per mutant, which replace the estimate's bands.
