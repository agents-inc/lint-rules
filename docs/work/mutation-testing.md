# Mutation testing

StrykerJS breaks the `src/` of `packages/lint-rules`, `packages/rule-data` and
`packages/eslint-plugin-house` one small change at a time (a mutant: `&&` for `||`, a condition
forced true, a `filter` removed) and runs that package's tests that cover it. A mutant no test
catches marks code no test checks. Each package has its own config at the repo root:
[`stryker.config.json`](../../stryker.config.json) (lint-rules),
[`stryker.rule-data.config.mjs`](../../stryker.rule-data.config.mjs) and
[`stryker.eslint-plugin-house.config.mjs`](../../stryker.eslint-plugin-house.config.mjs). Run
everything from the repo root, on Node 22.18 or later.

To set it up in another repo, such as `~/dev/cli`: [playbook](mutation-testing-playbook.md).

## Run it

- **A round's changed lines:** `node scripts/mutate-changed-lines.mts`. It passes Stryker each hunk
  of `git diff -U0 HEAD` (the work tree against the last commit, so staged and unstaged changes both
  count) and every untracked file whole: each package's config in turn, on the files it mutates. A
  config file given as the first argument runs alone instead. The other arguments go on to Stryker
  (`--force`, `--dryRunOnly`). After each run it reads `mutation.json`; it exits 1 when a run failed
  or reported a mutant Survived after running no test (see Swallowed errors below).
- **One lane's changed lines, with the specs that reach them:** add
  `--only <file>,<file>:<startLine>-<endLine>` (paths from the repo root) and Stryker's own
  `--testFiles <spec>,<spec>`. The round then mutates only the changed lines inside those files and
  ranges, and its first test run takes only those specs: name every spec that reaches the lines,
  those running the built CLI included, or their mutants read as not caught. The script refuses a
  file that is not on disk or that no config of the round mutates, and a `--testFiles` entry that
  matches no file, or a list with none. After such a run it names each load-time mutant reported
  Survived, which proves nothing there (Load-time code below).
- **Lines you name:** `bun run mutation --mutate "<file>:<startLine>-<endLine>,..."`; a file with no
  range is mutated whole. For rule-data or house, name its config first:
  `bun run mutation stryker.rule-data.config.mjs --mutate ...`.
- **Everything a config mutates:** `bun run mutation`, with a config named first for rule-data or house.

Each run prints the mutants that survived, with their diffs, and writes `reports/mutation/mutation.html`
and `mutation.json`, replacing the last run's. Each config's incremental file
(`reports/stryker-incremental*.json`) lets its next run reuse the result of every mutant whose code
and covering tests did not change. Stryker works in a copy of the repo under
`.stryker-tmp/`, deleted after each run (delete it by hand after a run you killed). Both folders are
gitignored.

What each result means:

- **Survived** or **NoCoverage:** no test caught it. Add a test, or show with a run of the real tool
  that the mutant changes nothing. Two kinds of Survived prove nothing: one in code that runs while
  modules load, in lint-rules or under `--testFiles`, and one that ran fewer tests than it should, 0
  among them (Known limits).
- **Killed:** a test failed. **CompileError:** the TypeScript checker refused the mutant, so it never ran.
- **Timeout:** Stryker counts it as caught. It is not proof: re-run that mutant alone, with a
  `--mutate` range around it (see Ranges below for its columns).
- **Ignored:** only code that runs while a test file loads reaches it (`ignoreStatic`, on in
  lint-rules' config alone). The second pass under Load-time code runs it. Without `--testFiles`,
  the rule-data and house configs run such a mutant with every test of the package, on before any
  test file loads.

## How the integration tests see a mutant

lint-rules' integration tests run the real ESLint and oxlint CLIs in child processes, which load the
built `dist/`. Stryker rebuilds `dist/` from the mutated source in its copy (`buildCommand`), but it
tells only the test worker which mutant is on, and reads coverage only from that worker. rule-data's
`read-installed.integration.test.ts` runs rule-data's source in a Node process of its own.

`packages/lint-rules/vitest.mutation.config.ts` and `packages/rule-data/vitest.mutation.config.ts`,
which only Stryker loads, add `packages/lint-rules/mutation-testing/child-process-bridge.ts` to their
package's vitest config. In a mutant run, the bridge
hands the active mutant to every child through the `__STRYKER_ACTIVE_MUTANT__` variable, which the
mutated code reads. In the initial run, it loads `mutation-testing/child-coverage-hook.mjs` into every
child (`NODE_OPTIONS`), so the mutants a child covers are credited to the test that spawned it, and
the mutants a file's `beforeAll` and `afterAll` hooks cover go to every test of that file.

The bridge also gives the copy an empty `.git` folder. oxlint honours `.gitignore` up to the nearest
folder holding `.git`, so without one it reads the repo's own `.gitignore`, which ignores
`.stryker-tmp/`, finds no file to lint in the copy, and `oxlint --rules` exits 1 (measured).

The bridge relies on Stryker's internals: the `__stryker__` global and the order of its hooks. A
Stryker upgrade can break it without an error. After one, run
`bun run mutation --force --mutate packages/lint-rules/src/core/project-uses-oxlint.ts`: the mutant
that empties the `OXLINT` string must be Killed. The test worker reaches that constant only while
modules load, so without the bridge's coverage the mutant is Ignored (measured).

The vitest runner also carries a patch (`patches/`): without it, every mutant runs no test and is
reported Survived. When to drop it: [learnings](learnings.md#strykerjs-2026-10-14-mutation-testing).

## Known limits

From the trial on 2026-10-14 and the adoption runs:

- **What it cannot break.** Stryker changes operators, conditions, literals and calls one at a time.
  A break that changes a decision is still written by hand: drop a field, reorder blocks, stop after
  one step, remove a call that wraps another, remove a spread element.
- **Load-time code.** In lint-rules, a Survived in code that runs while modules load (a constant, a
  top-level table) is not proof. When a CLI test's child process also reaches that code, Stryker runs
  only the tests that cover it and turns the mutant on after each test file has loaded: the code
  already ran unmutated in the test worker, so only the child processes see the mutant, and an
  in-process test that would catch it never does (measured 2026-10-15). Check such a Survived with the second
  pass, [`stryker.static.config.mjs`](../../stryker.static.config.mjs): the same config with
  `ignoreStatic` off, so the mutant is on before any test file loads and runs every test, over the
  in-process tests only (`packages/lint-rules/vitest.mutation.in-process.config.ts`). Run
  `bun run mutation stryker.static.config.mjs --mutate <ranges>`, or for a round
  `node scripts/mutate-changed-lines.mts stryker.static.config.mjs`. A mutant either pass kills is
  caught. The pass keeps its own incremental file, and its reports replace the first pass's. Or break
  the line by hand and serve it through a Vite `load` hook. Given `--testFiles`, every config, the
  second pass among them, turns such a mutant on only after the test files load, so its Survived
  proves nothing there either: re-run it without `--testFiles`.
- **Ranges.** A mutant counts only if it lies wholly inside a range, so a changed line inside a longer
  expression or block gets the mutants of its own parts, not of the whole. A deleted line gives none.
  Ranges count columns from 0; the report counts them from 1.
- **Time.** Every run starts by running its package's whole suite on one worker, or the specs
  `--testFiles` names. A mutant the CLI test files cover reruns those files, which can take many
  minutes for one mutant. `timeoutMS` is 30 minutes, so a slow mutant is not reported as Timeout
  (and so as caught); a mutant that never ends takes that long too.
- **Swallowed errors.** A test file that fails to load (an import that breaks, a hook that throws
  while the file is collected) adds no tests, and the run still passes. Before counting, check that
  the initial run's test count ("Ran N tests") equals the tests a plain `vitest run` of the package
  runs (of the same spec files, after `--testFiles`; for the second pass, one given `--exclude` for
  each file `vitest.mutation.in-process.config.ts` leaves out). It happens mid-run too: a mutant that breaks
  something the tests share makes every later test file fail to load, and each later mutant is
  reported Survived after running 0 tests (measured 2026-10-15). A Survived that ran 0 tests is not
  a result. The round script fails on one; after `bun run mutation`, each mutant's `testsCompleted`
  in `mutation.json` gives the count. Fix the cause, then re-run with `--force`: incremental mode
  reuses such a result. A mutant that makes a module throw while it loads fails to load only the test
  files that import that module, so it is reported Survived after running some tests (measured
  2026-10-15: in rule-data's `catalog.ts`, a mutant emptying the object `parseShippedRule` passes to
  `parseTurnedOnBy` was reported Survived after running 212 of 316 tests, and a plain vitest run of
  it fails 8 test files). The round script does
  not catch this. Without `--testFiles`, a Survived in code that runs while modules load ran every
  test (rule-data, house, the second pass), so it is a result only when its `testsCompleted` equals
  the initial run's count.
- **Incremental mode.** The runner reports which file a test is in but not where, so an edit to a test
  file counts as a change to every test in it. A change outside the mutated and test files (the data
  JSON, fixtures, a dependency) goes unnoticed: pass `--force` after one.
- **Type checks.** In lint-rules, `disableTypeChecks` covers `src/core/` alone. Stryker's default puts
  `// @ts-nocheck` atop the test fixtures too, which shifts the line numbers the CLI tests assert. The
  rule-data and house configs turn it off: nothing builds them, and rule-data's test of its generated
  files compares them on disk, which is also why those files are not mutated.
- `--logLevel debug` crashes the vitest runner.
