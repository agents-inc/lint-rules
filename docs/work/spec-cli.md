# Spec: `check` and `init` (lane cli)

Drafted 2026-10-14 by pm for the answers build. Base: [spec-next-batch](spec-next-batch.md) lanes M, K and I. The owner's answers win where they differ; each is cited by its card id (answers digest, `scratch-backup/answers-digest-2026-10-14.md`; the q-c and q-i cards in `scratch-backup/answers-build/pm-cli/cards.txt`). The other lanes (core, data, house) were still writing their specs when this was written: what this lane needs from them is under [Needs from other lanes](#needs-from-other-lanes).

## What changes for a user

- **`npx agents-inc-lint check`** (q-c1). A sub-agent runs it with no arguments after editing.
  - It finds the JS and TS files and lines changed in git, a file moved with plain `mv` paired with its old path (q-c7).
  - **It first applies the autofixes on those lines, then lints, and reports what is left** (q-c11, read-q-c11). It never changes a line nobody changed.
  - It prints `file:line rule — message`, cut at about 8,000 characters with a "+N more" line (q-c4, c5-again), and exits 0 (no errors left), 1 (errors left) or 2 (could not run); 130/143 when interrupted (q-c2).
  - No run log (c13-again), no type-check, no formatter (q-c12), no note when an agent edits the config (q-c14), nothing about unlisted rulesets (q-c17).
- **`npx agents-inc-lint init`** writes `agents-inc.lint.mts` and adds `@agents-inc/lint-rules` to `devDependencies`, and changes nothing else (q-i1 to q-i9, q30a). It prints the install command and the lines to paste into the agents' instructions.
- The package gains a `bin` entry, `agents-inc-lint` (q-c1). No new flag, environment variable, config key or `exports` subpath.

**Goal:** one command that fixes and reports exactly what sub-agents changed, and one command that sets a project up, both as the owner answered.

---

## The answers this spec applies

| Card | Behaviour here |
| --- | --- |
| q-c1 | Bin name `agents-inc-lint` |
| q-c2 | Exit codes 0, 1, 2, 130, 143, shared with `init` |
| q-c3 | A `warn` finding is listed after the errors and never fails the run |
| q-c4 | Output lines and summaries as drafted in spec-next-batch, verbatim; as short as possible |
| c5-again | Cut before 8,000 characters, then `+<N> more findings in <M> files. Fix the ones above, then run check again to see them.` |
| q-c6 | Nearest `agents-inc.lint.mts` from the current folder up to the git top level |
| q-c7 | A plain `mv` is paired with its old path, as the gate does, without touching the real index |
| q-c8 | No commits: every JS/TS file is wholly changed |
| q-c9 | A finding counts by its start line; a line-0 finding only in a wholly changed file |
| q-c10 | A syntax error: one `parse error` line per file, exit 1 |
| q-c11, read-q-c11 | Autofixes first, then both linters, then report what is left |
| q-c12 | No type-check, no formatter. Open-list to-do: look into them later |
| c13-again | No run log |
| q-c14 | Nothing is printed when `agents-inc.lint.mts` is among the changed files |
| q-c15 | Unused suppressions reported as drafted (only after the spike shows the oxlint half works) |
| q-c16 | Any wrong call, `--help` included: usage on stderr, exit 2 |
| q-c17 | Nothing printed about rulesets the config does not list |
| my-check-temp-config | The temporary oxlint config is written in the config's own folder |
| q-i1 | Config exists: refuse, change nothing, exit 1 |
| q-i2 | No usable `package.json`: refuse, exit 2 |
| q-i3 | Print the agent-instruction lines (draft text verbatim) |
| q-i4 | An existing `@agents-inc/lint-rules` entry keeps its range |
| q-i5 | Print the install command; never run it |
| q-i6 | The proposed text, wording approved |
| q-i7, q77, q-i6 note | `ignores` starts with the gate's list plus common generated files |
| q-i8 | Outside git: write both files, warn, exit 0 |
| q-i9 | Keep `tsconfigRootDir: import.meta.dirname`; print a note when `@types/node` is missing |
| q30a (decisions.md, 2026-10-11 second sweep) | Agent rulesets: all but the opt-in ones; editor rulesets: none, under a comment |

Superseded in spec-next-batch by these answers: the log line and K-20 (c13-again), the config-changed note (q-c14), "Must NOT autofix" (q-c11), `ignores: []` (q-i7), and N2's "accept for now, `check` does not fix" (its premise is gone: see open point P3).

---

## Files this lane owns

Paths under `packages/lint-rules/` unless they start with `packages/` or `docs/`.

| File | What |
| --- | --- |
| `package.json` | the `bin` field only |
| `tsdown.config.ts` | adds the `cli` entry |
| new `src/cli.ts` | the bin entry: the Node floor, then a dynamic import of `src/cli/main.ts` |
| new `src/cli/main.ts`, `src/cli/exit-codes.ts`, `src/cli/usage.ts` | argument check, dispatch, signals; the shared constants |
| new `src/cli/check/**` | every `check` module; every user-facing `check` text in one module (`texts.ts`) |
| new `src/cli/init/**` | every `init` module; its texts in one module |
| new `src/agent-configs.ts` | the production agent build (spec-next-batch E4): what `check` builds, moved out of the test helper's body |
| new tests | `src/cli/**/*.test.ts`, `src/check.integration.test.ts`, `src/check-fixes.integration.test.ts`, `src/init.integration.test.ts`, `src/cli-dist.test.ts`, `src/agent-configs.test.ts` |
| new test helpers | `src/__tests__/git-projects.ts`, `src/__tests__/factories/check-factories.ts`, `src/__tests__/factories/init-factories.ts`, `test-fixtures/check/`, `test-fixtures/init/` |
| `docs/work/spec-cli.md` | this file |
| `docs/plan.md` | the Decisions "Runner" row, "Files `init` adds or changes", "`init` (proposed)", "The runner", and the Open lines they settle |

Not this lane's (spec-next-batch put them in M; the answers build gives them to core): moving `eslint` and `oxlint` from peers to `dependencies` (M2) and its precondition M3, the resolver dependency (#33), the jsx-a11y-x fork. Report any need; edit none.

---

## Needs from other lanes

Each is a request to the orchestrator. "Meanwhile" says how this lane builds and tests alone.

| # | From | Need | Meanwhile |
| --- | --- | --- | --- |
| X1 | data | **An opt-in flag on every ruleset definition** (spec-next-batch D1: `optIn: boolean` in `ruleset-definitions.json`, carried by `RulesetDefinition`), in the name the joint core/data spec fixes. `init` reads it (q30a). | The init generator takes the definitions as a parameter and is tested with factories. The one production call compiles once D1 lands: land data before cli, or apply D1's exact change in this lane copy and drop it at landing. |
| X2 | data | **The fixes `check` never applies**, as rule data (`names-no-rule.test.ts` forbids naming rules in this package): rule ID → why. Suggested: `packages/rule-data/data/check-withheld-fixes.json` and a catalog field `checkWithheldFixes: ReadonlyMap<string, string>`, with a data test that each key is a shipped rule whose fixer exists. Starting list: the gate's `NO_AUTOFIX` (below), the fifth re-measured; open point P3 may add one. | `check` takes the map as a parameter; tests pass a factory map. |
| X3 | core | **#77 (default ignores for generated files) is in both the core lane's items and this lane's (q-i7).** Two places would ignore the same files twice, and a built-in default is one a team cannot remove (q77's card: "listed so a team can see and remove them"). | Recommend one place, the list `init` writes. Until the orchestrator decides, this lane writes the list. |
| X4 | core | `src/__tests__/agent-configs.ts` becomes a re-export of the new `src/agent-configs.ts`, at landing. Any change core makes to `buildEslintConfig`'s or `buildOxlintConfig`'s arguments (typed-config-files, split by types) applies to the new file too. | `src/agent-configs.test.ts` pins that both give deep-equal configs. |
| X5 | core | spec-next-batch E3 (no eslint-plugin-react version warning in a project without React). K-18 needs it. | K-18 is `it.fails` with a `KNOWN GAP:` comment if E3 has not landed. |
| X6 | core | typed-config-files must leave `init`'s file with no findings under `check`, with a tsconfig that includes it and one that does not, with and without `@types/node`. | I-4 measures it; a finding goes to core with the reproduction. |
| X7 | core | #58's packed-install test: once this lane lands, also run `npx agents-inc-lint check` in the installed project. | — |

Comment-only, in core's files, made false by this lane (report at landing): `src/agent-settings.ts` ("the future `check` entry"), `src/dist.test.ts` ("The internal lookup `check` will use").

---

## Pattern files to read first

| What | Where | Why |
| --- | --- | --- |
| Git listing, rename pairing, changed lines | `~/dev/ai-benchmarking/agents-inc/vendor/lint/gate.mjs` (read-only): `git`, `RENAMES`, `SCRATCH_INDEX`, `GIT_ENV`, `changedFiles`, `addedLines` | Proven: argv-only git, `-z`, the scratch index plus `--find-renames=1%` (q-c7) |
| The gate's autofix and why it fixed after attribution | same file: `NO_AUTOFIX`, `autofix`, the "ONLY NOW fix" block | The measured hazards this spec's fix design answers |
| The closing message that stopped agents reading the config | same file, the last `console.error` | Source of q-c4's summary |
| Running both engines | `src/__tests__/engine-run.ts`: `runBothEngines`, `runOxlintWith`, `runOxlint` | ESLint's Node API with `overrideConfigFile: true`; oxlint from the installed bin with `-c`, cwd the project |
| The agent build | `src/__tests__/agent-configs.ts`: `agentConfigsOf`; `src/agent-settings.ts`: `agentSettingsOf` | Exactly what `check` builds; one shared registry module |
| oxlint code → RuleId | `src/__tests__/oxlint-codes.ts`: `oxlintCodeOfRule`; `catalog.oxlintRules` | The mapping K-15 checks |
| Errors naming the file | `src/core/config-error.ts`: `configErrorIn` | Config errors already start `agents-inc.lint.mts: ` |
| package.json reading | `src/core/package-json-files.ts`: `readPackageJsonFile`, `ourPackageJsonFile`, `versionOf`, `nearestPackageJsonPath` | Parse boundary and our version |
| The text `init` writes | `test-fixtures/consumer-files/agents-inc.lint.mts`; `packages/rule-data/src/ruleset-definitions.ts` (`rulesetDefinitions`); `packages/rule-data/src/consumer-config-files.ts` | Layout, order, file names |
| Temp projects | `src/__tests__/temp-projects.ts`: `setUpTempProjects`, `THIS_PACKAGE`, `INSTALLED_OXLINT` | Linking the built package and oxlint into a project |

---

## M: the `bin` entry

- `package.json`: `"bin": { "agents-inc-lint": "./dist/cli.mjs" }` (q-c1). `files` already holds `dist`.
- `tsdown.config.ts`: entry `cli: 'src/cli.ts'`.
- `dist/cli.mjs` starts with `#!/usr/bin/env node`.
- **`src/cli.ts` imports nothing statically but what Node 18 has.** It checks the Node version, then dynamically imports `./cli/main.ts`. Why: a static named import Node 18 lacks (`findPackageJSON` from `node:module`) is a link error before any line runs, so the floor message would never print.
- The cli's shared modules must not reach the `index` or `oxlint` entries' chunks: `dist-loading.test.ts` must pass unchanged. `agent-settings.ts` must be one module shared by `dist/index.mjs` and `dist/cli.mjs`, or `agentSettingsOf` finds no settings (K-21).

---

## K: `check`

### Command surface

- Valid calls: `agents-inc-lint check` and `agents-inc-lint init`. Anything else, `--help` and `check foo` included, prints usage to stderr and exits 2 (q-c16). No flags, environment variables or config keys (owner, decisions.md 2026-10-11 second sweep).
- Usage text, verbatim (q-c16 card):
  ```
  usage: agents-inc-lint <command>
    init   add @agents-inc/lint-rules and agents-inc.lint.mts to the package in this folder
    check  lint the JS and TS lines changed since the last commit
  ```
- The same output on a TTY and in a pipe: no colour, no progress.

### Steps, in order (the contract, not the code)

1. **Node floor.** Below 22.18: exit 2. #59 keeps the floor at 22.18.
2. **Git.** The git top level of the current folder; none: exit 2.
3. **Config.** The nearest `agents-inc.lint.mts` from the current folder up to the git top level (q-c6); none: exit 2.
4. **Same package copy.** `findPackageJSON('@agents-inc/lint-rules', <config file URL>)` from `node:module`, real paths compared with this package's root. Not resolvable: exit 2, "not installed". Another copy: exit 2 naming both. Done before importing the config, so neither failure surfaces as an import error.
5. **Load.** Import the config. A thrown error is printed as is, exit 2. The agent settings come from its `eslint` export through `agentSettingsOf`.
6. **Changed files**, with git always given an argv array and `-z`:
   - **With commits:** build a scratch index, a copy of the real one (`git rev-parse --git-path index`) in the OS temp folder, and run `git add --intent-to-add -A .` from the top level with `GIT_INDEX_FILE` pointing at it. Then `git diff --name-status -z --find-renames=1% --diff-filter=ACMR HEAD`. A renamed pair keeps its old path. The real index is never written (q-c7). A failure to build the scratch index or run git is exit 2, quoting git.
   - **No commits** (`git rev-parse --verify -q HEAD` fails): every tracked or untracked, not-ignored file is wholly changed (`git ls-files -z --cached --others --exclude-standard`), with no pairing (q-c8).
   - Keep the extensions `js mjs cjs jsx ts mts cts tsx`.
   - Keep files under the config's folder. Skip the rest with the note (q-c6).
   - Keep files that exist and that our built ESLint config does not ignore (`isPathIgnored`). Both engines get the same list.
7. **Changed lines.** A file with no old path (new, or untracked and unpaired) is wholly changed. Otherwise its added lines come from `git diff -U0` against `HEAD` (renamed pairs: against the old path, with the scratch index and `--find-renames=1%`). A pure deletion adds no line.
8. **Nothing left:** print `check: no changed JS or TS files.`, exit 0. No temp file, no engine, no write.
9. **Build** both agent configs with `agentConfigsOf` from `src/agent-configs.ts`.
10. **Write the temp oxlint config** in the config's folder as `.agents-inc-check-<pid>-<random>.json` (my-check-temp-config). Never `.oxlintrc.json` or `oxlint.config.*`. Before writing, remove any `.agents-inc-check-<pid>-*.json` there whose process is gone; keep one whose process lives.
11. **Fix** (q-c11), below.
12. **Re-read the changed lines** (step 7 again). Fixes only ever touch changed lines, so the new diff attributes nothing new to the agent.
13. **Lint:** oxlint over every file in scope (the final run), and the ESLint results the fix step left (ESLint re-run only on files whose ESLint fixes were dropped). Read oxlint's JSON, not its exit code: it exits 1 for findings and for a broken config alike (spec-next-batch, measured). No JSON or a config parse failure: exit 2, quoting oxlint.
14. **Rule IDs.** An oxlint code maps to its RuleId through `catalog.oxlintRules`; today each code maps to exactly one (command under [Commands](#commands)). An oxlint diagnostic with no code is a parse error. ESLint's non-fatal messages with no rule ID are left out; a fatal one is a parse error.
15. **Keep a finding** whose start line is a changed line, any finding in a wholly changed file, and a line-0 finding only in a wholly changed file (q-c9). A parse error in a changed file is always kept, once per file, ESLint's message when both report it (q-c10). Identical findings print once.
16. **Unused suppressions** (q-c15): see below.
17. **Print, delete the temp config and the scratch index, exit.**

### The fix step (q-c11)

The gate fixed whole files, after attributing findings, because a fix applied first put the fixer's edits inside the agent's "added lines": one appended line became a 46-line diff and pre-existing findings were blamed on the agent (gate.mjs, measured). It also withheld fixes that silently change behaviour (`NO_AUTOFIX`). The owner wants fixes first. Both hold if **a fix may change only lines that are already changed**:

- **Order:** oxlint's fixes, then ESLint's (the gate's order; see P3 for why it matters).
- **oxlint:** `oxlint --fix` on the files in scope, with a config whose withheld rules are off. oxlint's JSON carries no fix data (measured, oxlint 1.87), so it cannot be limited to lines; the guard decides.
- **ESLint:** the Node API with `fix` given a predicate: a fix is applied only when its message's line is a changed line (or the file is wholly changed) and its rule is not withheld. ESLint loops its own passes; keep the results' `output`, write nothing yet.
- **The guard, per file and per engine:** compare the text before that engine's fixes with the text after. If any line that was not changed (before the fix) is deleted or modified, drop all of that engine's fixes in that file. Pure insertions are allowed anywhere. A wholly changed file always passes.
- **Writes:** oxlint writes in place, so a file that fails its guard is restored from its snapshot. ESLint's output is written by `check` only when it passes the guard **and** the file on disk still equals the text ESLint read; otherwise that file keeps its text and is linted as it is.
- **Withheld fixes** (X2): the rule still reports; only its fix is never applied. Starting list, from the gate's `NO_AUTOFIX` (each ships today, ESLint-run: command under [Commands](#commands)):
  - `perfectionist/sort-objects`, `perfectionist/sort-sets`, `perfectionist/sort-maps`, `perfectionist/sort-arrays`: they reorder things whose order the program observes (gate measured `['B','KB','MB','GB','TB']` reordered, so 1 MB printed as "1.0 KB").
  - `@eslint-react/x-no-missing-context-display-name`: its fixer wrote code that did not parse in 5.19.0. Re-measure on the installed version; drop it from the list if fixed.
- **Fixes apply to errors and warnings** (P4).
- **Output:** when `check` changed any file, stdout's first line is `check: autofixed <paths, comma-separated>; read them again before editing them.` (P2). Nothing when it changed none.
- Fixes never touch a file outside the config's folder, an ignored file, or a non-JS/TS file.

### Unused suppressions (q-c15)

Unchanged from spec-next-batch part 3, with the answer: in files where suppressions are allowed, each rule a suppression comment on a changed line names, which reported nothing there, gets one error finding. Its line: `src/a.ts:3 unused suppression — suppresses no-console, which reported nothing here` (the label is P8).
- **Spike first.** oxlint's `--report-unused-disable-directives` names no rule and flags ESLint-only names (research, measured). If no mechanism covers oxlint-run rules, stop and report with the evidence. Do not build the ESLint half alone.

### Output contract

- **stdout:** the autofixed line, the findings, the cut line, the summary. **stderr:** notes and "could not run". Never mixed.
- **Finding lines** (q-c4), paths relative to the config's folder with forward slashes; errors first, then warnings, each sorted by path then line:
  - `src/cart.ts:12 @typescript-eslint/no-floating-promises — <message>`
  - `src/cart.ts:30 no-console (warning) — <message>`
  - `src/broken.ts:4 parse error — <message>`
- **Cut** (c5-again): the longest run of finding lines totalling at most 8,000 characters (a named constant), at least one whole finding, then `+<N> more findings in <M> files. Fix the ones above, then run check again to see them.` The summary still counts everything.
- **Summary**, the last stdout line, singular forms where a count is 1 (q-c4):
  - errors: `check: <E> errors and <W> warnings in <F> of <C> changed files. The list is complete: fix what is in code you wrote, then run check again. Do not read the lint configuration or this package's source; each line says what to fix.`
  - warnings only: `check: no errors; <W> warnings in <F> of <C> changed files. The list is complete.`
  - clean: `check: no findings in <C> changed files.`
  - nothing to check: `check: no changed JS or TS files.`
- **Notes (stderr):** only `check: note: skipped <N> changed files outside <config folder>.` (q-c6). No config-changed note (q-c14), no log note (c13-again), no ruleset note (q-c17).
- **Could not run** (stderr, exit 2), each starting `check: could not run: `:
  - `Node 22.18 or later is needed; this is Node <version>.`
  - `<cwd> is not inside a git repository, and check reads the changed files from git.`
  - `there is no agents-inc.lint.mts in <cwd> or any folder above it up to <git top level>. Run "agents-inc-lint init" in the folder of the package to lint.`
  - `<the config error, as thrown>`
  - `agents-inc.lint.mts imports @agents-inc/lint-rules from <path A>, and this check is <path B>. Run the check that project installed.`
  - `@agents-inc/lint-rules is not installed where agents-inc.lint.mts can import it. Run your package manager's install.`
  - `git failed: <git's first message line>` / `oxlint failed: <oxlint's first message line>` / `ESLint failed: <its message>`

### Exit codes (q-c2)

`src/cli/exit-codes.ts`, shared with `init`:

| Constant | Code | `check` | `init` |
| --- | --- | --- | --- |
| `EXIT_CLEAN` | 0 | no error left (warnings may be listed), or nothing to check | wrote both files |
| `EXIT_FINDINGS` | 1 | an error or parse error left after the fixes | refused: the config exists, nothing changed |
| `EXIT_COULD_NOT_RUN` | 2 | usage, Node, git, config, package copy, engine failure | usage, Node, no or bad package.json, a failed write |
| `EXIT_INTERRUPTED` | 130 | SIGINT | SIGINT |
| `EXIT_TERMINATED` | 143 | SIGTERM | SIGTERM |

`check` fails closed: no path exits 0 after a crash.

### Signals and leftovers

- On SIGINT or SIGTERM: kill a running oxlint child; keep every fix already written, as `eslint --fix` does; delete the temp config and the scratch index; print to stdout the autofixed line naming the files its fixes rewrote so far (P2), and to stderr `check: interrupted`; exit 130 or 143. A run that fails once a fix is written (exit 2) prints the autofixed line too. A second signal exits at once.
- **Invariants:** after any exit, no `.agents-inc-check-<own pid>-*` file and no scratch index of this process remain; no file holds a fix that failed its guard; outside the project, `check` writes only its scratch index in the OS temp folder, deleted on exit (no log).

### Must NOT (lane K)

- Read, import or spawn the project's own ESLint or oxlint config, or the project's own ESLint or oxlint.
- Write into the project anything but the temp config and fixes that passed the guard. Write the real index, or run any git command that writes the repository.
- Type-check or format (q-c12). Filter findings by author (owner, decisions.md 2026-10-11). Write a log (c13-again).
- Add a flag, environment variable, export or `exports` subpath. Name a rule in code.
- Edit the builders or rule data (X2, X4).

---

## I: `init`

### Steps, in order

1. Node floor and arguments as `check` (`init` with anything after it: usage, exit 2).
2. `package.json` in the current folder must parse as an object. Missing, not JSON, or not an object: exit 2, nothing written, the file named (q-i2).
3. `agents-inc.lint.mts` exists there: exit 1, nothing changed (q-i1).
4. **Compute both texts first** (below).
5. **Write both or neither:** each write is a temp file in the same folder then a rename; signals are held during the two renames; if the second write fails, the first file is put back, exit 2.
6. **Print** (below). Outside git, the note (q-i8); `@types/node` missing, the note (q-i9). Exit 0.

### The config text (q-i6, q30a, q-i7)

Generated from the ruleset definitions in data order, never a hand-kept list. Layout as `test-fixtures/consumer-files/agents-inc.lint.mts`: two-space indent, single quotes, trailing commas, no semicolons, a final newline.

```ts
import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  // What `check` runs on the lines sub-agents change.
  agentRulesets: {
    quality: [
      'correctness',
      …one per line, every non-opt-in quality ruleset
    ],
    libs: {
      ui: ['react'],
      …one line per domain, in order of first appearance
    },
    runtimes: [
      'node',
      'browser',
    ],
    languages: [],
  },

  // What people's editors show once your team merges it into its own lint configs: add rulesets here.
  editorRulesets: {
    quality: [],
    libs: {},
    runtimes: [],
    languages: [],
  },

  ignores: [
    '**/build/**',
    '**/coverage/**',
    '**/dist/**',
    '**/.next/**',
    '**/.yarn/**',
    '**/*.d.ts',
    '**/*.gen.*',
    '**/*.min.js',
    '**/mockServiceWorker.js',
  ],

  rules: {},

  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
```

- A list with no non-opt-in ruleset is written `[]`.
- **Opt-in rulesets** (X1) appear only in a comment directly above the key of the list they belong to: `// Opt-in, so not listed: 'a', 'b'`. A libs domain whose rulesets are all opt-in is written `domain: []` under its comment. No comment where there is none (today: none).
- **`ignores`** (q-i7, q77, the owner's q-i6 note): the gate's list as the q-i7 card showed it (`dist`, `build`, `coverage`, `*.d.ts`, `*.gen.ts`, `.next`, `*.min.js`), q77's generated files (`*.gen.*`, which covers `*.gen.ts` and `routeTree.gen.ts`; `mockServiceWorker.js`), and the gate file's `.yarn` (committed Yarn releases, q77's class). Not the gate's `.agents-inc` (its own vendored toolchain) or `node_modules` (already ignored by the build). Written in the `**/` form, which matches at any depth in both engines today and under #62's reading. Exact list: P6 and X3.

### The package.json edit (q-i4)

- `"@agents-inc/lint-rules": "^<our version>"` goes into `devDependencies`, unless `dependencies` or `devDependencies` already lists it, whose entry then stays as it is. A listing only under `peerDependencies` does not count.
- Inserted before the first key that sorts after it, else last. `devDependencies` absent: added as the last key.
- **Edit the text; never re-serialise the object** (`JSON.stringify` reflows arrays and other values). Keep indentation (spaces or tab), key order, line endings (LF or CRLF) and the trailing newline as found.
- Our version is `versionOf(ourPackageJsonFile())`: `0.0.0` today, so `^0.0.0` until a release.

### Output

stdout:
```
init: wrote agents-inc.lint.mts and added @agents-inc/lint-rules ^<version> to devDependencies in package.json.
Next: run "<install command>".
Then add these lines to your agents' instructions:

After changing code, run `<runner> agents-inc-lint check` with no arguments. Exit 0: done. Exit 1: fix every finding in code you wrote, then run it again; when only findings in code you did not write remain, you are done. Exit 2: stop and report its output. Never add a suppression comment, and never edit agents-inc.lint.mts.
```
- Kept entry: the first line reads `init: wrote agents-inc.lint.mts and kept the existing @agents-inc/lint-rules entry in package.json.`
- The paragraph is q-i3's draft, verbatim. The lead-in line is P7.
- **Package manager** (q-i5): the first folder, from the current one up to the git top level (the current folder alone outside git), holding a lockfile. In one folder, the first of `bun.lock`, `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`. bun: `bun install`, `bunx`; pnpm: `pnpm install`, `pnpm exec`; yarn: `yarn install`, `yarn`; npm or none: `npm install`, `npx`.

stderr notes, exit still 0:
- q-i8: `init: note: <folder> is not in a git repository, and check needs one.`
- q-i9, when no package.json from the folder up to the git top level (the folder alone outside git) lists `@types/node` under `dependencies` or `devDependencies`: `init: note: agents-inc.lint.mts reads import.meta.dirname, which TypeScript knows only from @types/node. If your tsconfig includes the file, add @types/node to devDependencies.` (P7)

Refusals (stderr):
- exists, exit 1: `init: agents-inc.lint.mts already exists in <folder>; nothing was changed. Delete it to start again.`
- exit 2, each starting `init: could not run: `: `there is no package.json in <folder>. Run init in the folder of the package to lint.` / `<path>: not valid JSON` / `<path>: not a JSON object` / `could not write <file>: <reason>. Nothing was changed.` / the Node floor line.

### Must NOT (lane I)

- Run an install, or touch a lockfile, `node_modules`, the team's lint configs, scripts or agent files (two files only, owner 2026-10-11).
- Add flags. Hand-list rulesets.

---

## Tests owed

Tests first, each watched failing. Integration tests run the built `dist/cli.mjs` with `node` in temp git projects linking `THIS_PACKAGE` and `INSTALLED_OXLINT`; rebuild first. Factories, not inline data; members compared with `toStrictEqual`; every refusal beside an allowed case; an any/every decision gets an input where the two differ.

**M and dist** (`cli-dist.test.ts`)

| # | Criterion |
| --- | --- |
| M-1 | `package.json`'s `bin` is exactly `{ "agents-inc-lint": "./dist/cli.mjs" }`; `dist/cli.mjs` exists and starts with `#!/usr/bin/env node` |
| M-2 | `dist-loading.test.ts` and `dist.test.ts` pass unchanged |
| K-21 | A config `dist/index.mjs` defined is found by `dist/cli.mjs` (one registry) |

**K: `check`** (`check.integration.test.ts`; unit tests for the report, the attribution and the leftovers)

| # | Criterion |
| --- | --- |
| K-1 | No changed JS/TS file: the line, exit 0, no temp config ever created (a watcher on the folder), no file written |
| K-2 | An untracked file: findings on every line |
| K-3 | A tracked file with a finding on an unchanged line and one on a changed line: only the second |
| K-4 | `git mv` plus one appended line: only that line's findings |
| K-4b | q-c7: plain `mv` plus one appended line: only that line's findings; beside it, an unpaired new file still reports every line; the real `.git/index` byte-identical before and after, and `git status --porcelain` unchanged |
| K-5 | A path with a space and one with non-ASCII: checked and printed correctly |
| K-6 | Staged-only and unstaged-only changes counted; a deleted file never reported |
| K-7 | q-c8: a repo with no commits: every file wholly changed |
| K-8 | All eight extensions linted; `.json`, `.md`, `.css` ignored |
| K-9 | A file under `ignores: ['src/generated/**']` reported by neither engine |
| K-10 | A project `eslint.config.mjs` that throws on import and a `.oxlintrc.json` turning a rule off: no effect |
| K-11 | No `.agents-inc-check-*` and no scratch index left after a clean run, a findings run, an engine failure, SIGINT (130) and SIGTERM (143); during the run the temp config is in the config's folder; a dead pid's leftover removed, a live pid's kept |
| K-12 | Two runs started together: correct exits, no leftovers |
| K-13 | q-c10: a syntax error: one `parse error` line, exit 1 |
| K-14 | A banned suppression comment: exactly one finding, `house/no-suppressions` |
| K-15 | Every code in `catalog.oxlintRules` maps to its RuleId (unit, whole catalog) |
| K-16 | Exit 2 with its verbatim line for: Node 18 (`/usr/bin/node`), not git, no config, a config error, not installed, another package copy, an oxlint config failure (recorded output), a git failure |
| K-17 | Report units: sorting, relative paths, warnings after errors and exit 0 with warnings only (q-c3), the cut at 8,000 with the `+N` line, a first finding longer than the cap still printed whole, singular and plural |
| K-18 | stderr empty on a clean run in a project without React (X5) |
| K-19 | q-c16: `check --help`, `check foo`, no command, `foo`, `init x`: usage, exit 2; beside them `check` and `init` run |
| K-20 | c13-again: no file written outside the project (XDG_STATE_HOME and HOME pointed at empty temp folders stay empty) |
| K-22 | Changed files outside the config's folder skipped with the note |
| K-23 | q-c15: in an allowed file, an unused suppression of an ESLint-run and of an oxlint-run rule each get one finding; a banned file gets none; or the spike report |
| K-24 | q-c14: `agents-inc.lint.mts` changed: stderr empty, beside the same run with it committed |
| K-25 | q-c17: a config listing fewer rulesets than exist: nothing printed about it |
| K-26 | q-c9: a multi-line finding kept by its start line and dropped when only a later line changed; a line-0 finding kept only in a wholly changed file |

**F: the fix step** (`check-fixes.integration.test.ts` on real engines; unit tests on the guard with fake engines). The tester picks shipped fixable rules from the catalog, one per engine.

| # | Criterion |
| --- | --- |
| F-1 | A new file with an ESLint-fixable and an oxlint-fixable finding: both fixed in the file, neither reported, the autofixed line names the file |
| F-2 | A partly changed file: a fixable finding on an unchanged line stays and that line is byte-identical; one on a changed line is fixed |
| F-3 | Guard: a fix that would modify an unchanged line (ESLint, and oxlint in place) leaves the file as it was for that engine, and its findings are reported; a fix that only moves a changed line between unchanged ones passes |
| F-4 | Withheld: `const UNITS = ['B','KB','MB']` in a new file stays in order and `perfectionist/sort-arrays` is reported; the same file without the withheld entry (factory map) is reordered |
| F-5 | P3's shape (`catch (error) { throw new Error('x') }` written on a changed line of a partly changed file): the `cause` is kept or a finding reports it; never lost silently |
| F-6 | A file changed by another writer between ESLint's read and the write is not overwritten (unit, fake engine) |
| F-7 | SIGINT during the oxlint fix run: each fix it wrote that passes the guard stays and is named in the autofixed line; one that fails it is written back (unit, fake fixer) |
| F-8 | Nothing fixable: no file's content changes, no autofixed line |
| F-9 | No fix reaches a file outside the config's folder, an ignored file, or a non-JS/TS file |
| F-10 | After fixes, findings are attributed with the lines re-read: a fix that adds a line to a changed region does not make a pre-existing finding below it reported |

**I: `init`** (`init.integration.test.ts`; unit tests on the text, the package.json edit and the package manager)

| # | Criterion |
| --- | --- |
| I-1 | package.json with 2-space, 4-space and tab indentation, LF and CRLF, with and without a trailing newline, with sorted, unsorted and absent `devDependencies`: the entry inserted as specified, every other byte identical |
| I-2 | The agent rulesets equal every non-opt-in ruleset in data order; a factory opt-in ruleset appears only in its comment; an all-opt-in domain is `domain: []` under its comment |
| I-3 | `defineLintRules` accepts the written file (imported in a test); `tsc --noEmit` accepts it in a project with `@types/node` |
| I-4 | `check` right after `init` (file untracked) reports nothing for it: private and non-private package, with and without the opt-in comment, tsconfig including the file and not (X6) |
| I-5 | q-i1: config exists: both files byte-identical, exit 1, the message |
| I-6 | q-i2: no package.json, invalid JSON, a JSON array: nothing written, exit 2, the file named |
| I-7 | q-i4: listed under `dependencies`, and under `devDependencies`: range kept, config written; listed only under `peerDependencies`: added |
| I-8 | q-i8: outside git: written, the note, exit 0 |
| I-9 | In a git repo, `git status --porcelain` afterwards lists exactly the two files |
| I-10 | q-i5: install command and runner per lockfile; none; two in one folder; a lockfile above the folder inside git used; one above the git top level not |
| I-11 | q-i9: the note when no package.json up to the top level lists `@types/node`; none when the folder's or a parent's does |
| I-12 | q-i7: in `check`, a file under each written pattern (`dist/a.js`, `packages/x/dist/a.js`, `src/routeTree.gen.ts`, `public/mockServiceWorker.js`, `a.min.js`, `types.d.ts`, `.next/a.js`, `.yarn/releases/y.cjs`) is reported by neither engine; a near miss (`src/distance.ts`) is |
| I-13 | q-i6: the whole text for a small factory catalog equals the expected text exactly |
| I-14 | A failed second write: exit 2, both files byte-identical (unit, injected failure) |

**Non-functional** (report the figure and the command): `check` on one changed file in this repo, median of 3, with the fix step, and peak memory. Over 5 s goes to the owner.

---

## Existing tests the answers make wrong

None in this lane. Checked: `dist.test.ts` (`ENTRY_FILES` is matched with `arrayContaining`; `PUBLIC_SUBPATHS` and the declaration checks do not see `cli`), `dist-loading.test.ts`, `package-manifests.test.ts` and `src/__tests__/package-manifests.ts` pin nothing a `bin` changes. Two stale comments sit in core's files (X list above). `src/__tests__/cases/consumer-files-as-plan-md-shows.ts` keeps testing `editorRulesets: {}` (a fix-round-3 bug); its "as plan.md shows" comment goes stale when plan.md shows `init`'s text: core's file, report it.

---

## Docs owed (same turn, prefer deleting)

- **plan.md** (this lane's sections):
  - Decisions, "Runner": the temp oxlint config is written in the config's folder (my-check-temp-config), and `check` writes fixes on changed lines (q-c11).
  - "Files `init` adds or changes": the template becomes `init`'s text.
  - "`init` (proposed)" → built: the two files, step 3 answered (printed, q-i3), the notes.
  - "The runner" → built: autofix first and its guard, withheld fixes, no log (delete "Appends one log line per call"), the cut, warnings, exit codes, unused suppressions as built or the spike's outcome; the pipeline link to consumer-usage-design §3 goes.
  - Open: add "Later (owner, q-c12): look into a type-check and a formatter step for `check`". Add the written limits: oxlint's fixes in a partly changed file are applied only when they touch changed lines alone; `check` fixes every changed line in the work tree, another agent's included.
  - Report, not edit: the Rulesets bullet "`init --check` or the runner should point out rulesets…" (q-c17: nothing for now) sits in a section other lanes edit.
- **README.md:** "the runner and `init` are not [built]".
- **architecture.md:** the packages row gains the `bin`; a short `check` flow (find, pair, fix, guard, lint, attribute, report).
- **learnings.md:** oxlint's JSON has no fix data; a static named import Node 18 lacks fails at link time, so the bin entry imports dynamically; `findPackageJSON` keeps symlinks (take the real path); each oxlint code maps to one RuleId.
- Each of P1–P10 becomes a card on the questions page (memory: my calls go on the questions page).

---

## Open points (recommendation; meanwhile)

| # | Point | Recommendation | Meanwhile |
| --- | --- | --- | --- |
| P1 | **Fixes limited to changed lines.** q-c11 says fixes first; the gate measured that whole-file fixing first blames agents for old findings and rewrites code nobody touched | As specced: fix only changed lines, guard the rest | Build it |
| P2 | The autofixed line's wording | `check: autofixed <paths>; read them again before editing them.` (an agent's next edit of a rewritten file fails otherwise) | Build it |
| P3 | **r2-n2 was accepted because "`check` does not fix".** Where oxlint's fixes in a file fail the guard, ESLint's `unicorn/prefer-optional-catch-binding` removes an unused `catch` binding before `preserve-caught-error` can add `{ cause }`, and the cause is lost silently | Withhold `prefer-optional-catch-binding`'s fix in `check` (X2); the agent removes the binding itself | Not withheld; F-5 decides |
| P4 | Fix `warn` findings too | Yes: a team that sets `warn` still runs the rule, and the fix stays on changed lines | Build it |
| P5 | `.vue`, `.svelte`, `.astro` changed files: oxlint lints their scripts and the agent build carries their globals, yet the usage text says JS and TS | Add them to the extensions (oxlint only; ESLint's agent build does not lint them) | JS/TS only, as the approved usage text says |
| P6 | init's `ignores`: `.yarn` added (vendored), `.agents-inc` and `node_modules` left out; X3's one place | As listed | As listed |
| P7 | New texts: init's lead-in line, the `@types/node` note, the "kept the existing entry" line, the refusals | As drafted | As drafted |
| P8 | The unused-suppression label `unused suppression` (q-c15's draft gave only the message) | As drafted, matching `parse error` | As drafted |
| P9 | Changed files under a nested `agents-inc.lint.mts` when `check` runs from an outer config | Skip them with a note naming the other config | Lint them with the config found (q-c6 as answered) |
| P10 | The scratch index cannot be built (another git process mid-write) | Exit 2, quoting git (fails closed, as q-c2) | Build it |

Written limits (not questions): two `check` runs fixing the same file at once can race (last write wins); `check` fixes changed lines another agent is still writing (it checks every change in the work tree, owner 2026-10-11); a second Ctrl+C exits at once, without the autofixed line.

---

## Gotchas

- `dist/cli.mjs` must not statically import anything Node 18 lacks, or K-16's floor case crashes at link time.
- oxlint exits 1 for findings and for a refused config alike; only its JSON tells them apart.
- With fix on, ESLint's result messages describe the fixed text: reusable only for files whose output was written.
- `findPackageJSON` keeps a symlinked path as the link; compare real paths.
- The scratch index goes in the OS temp folder; only the oxlint config must sit in the config's folder (rooted globs).
- `git add` under `GIT_INDEX_FILE` locks `<scratch>.lock`, not the real index. In a linked worktree the real index is `git rev-parse --git-path index`, not `<git dir>/index`.
- Re-serialising package.json reflows it: edit the text.
- ESLint's later fix passes see shifted line numbers: the predicate narrows, the guard guarantees.

## Corrections

1. Brief: "spec lanes M": M2, M3, the resolver dependency and the fork are core's in this build (answers-build.js gives core `package.json` except `bin`). This lane does only the `bin`.
2. N2 (spec-next-batch round 2, accepted as r2-n2): its premise "`check` does not fix" is false under q-c11 (P3). The brief does not mention it.
3. #77 is in both the core lane's items and this lane's q-i7 (X3).
4. No new dependency is needed for `check` or `init`.

Nothing else in the brief proved false.

### Corrections from the build (2026-10-15, cli-dev)

| Was | Now | Why |
| --- | --- | --- |
| Step 6: the scratch index, a copy of the real one | A scratch git folder in the OS temp folder: the index copy, and an objects folder git writes into, the repo's own objects read as an alternate | `git add --intent-to-add` writes the empty blob into `.git/objects` (measured; K-1 caught it), which the Must NOT forbids |
| Step 14: an oxlint diagnostic with no code is a parse error | No code and not an unused-suppression report, or a `TS(<n>)` code: oxlint's own TypeScript syntax checks (`TS(1036)`, a statement in a `.d.ts`) | Unused-suppression reports have no code either; a `TS(<n>)` code names no rule, and stopped check with exit 2 (I-12) |
| X2 meanwhile: `check` takes the map as a parameter | The list is data beside check, `src/cli/check/withheld-fixes.json`, until rule-data carries it; `names-no-rule.test.ts` scans only `.ts` | F-4 needs the list at run time |
| P3 meanwhile: not withheld | `unicorn/prefer-optional-catch-binding`'s fix withheld, as P3 recommends | F-5 fails otherwise: the cause is lost silently (the tester measured it) |
| X1 meanwhile | `run-init.ts` reads every definition as not opt-in until `optIn` lands; TypeScript reports the line (TS2783) once it does: drop it at landing | Keeps this lane's typecheck green alone |
| K-23 spike | Built: a name is unused where both engines report it unused. oxlint names it by its span (the whole comment where every name is unused, in UTF-8 bytes); ESLint in its message | Each engine reports the other's names unused (measured), so only the engine running the rule can call it used |
| Output: stderr holds only the note and why check could not run | Node 23 (outside `engines`) also prints a type-stripping `ExperimentalWarning` on importing the `.mts` config; check drops that one warning | Agents read stderr, and the tests pin it empty |

### Corrections from the review fixes (2026-10-15, cli-dev)

| Was | Now | Why |
| --- | --- | --- |
| Step 15: a finding counts by its start line | An oxlint finding at several places counts where any of them is on a changed line, printed at the first such; with none changed, by its first | oxlint gives a duplicate at the code it repeats too, the older first (measured, 1.87), so a duplicate added below it was dropped (review Must Fix 1). Owner card: a useless `catch` is two places too, the caught error and the rethrow, so K-26's "dropped" case is now reported at the rethrow (`it.fails`) |
| Unused suppressions: a name both engines report unused | In an `oxlint-disable` comment, a name oxlint reports unused; in an `eslint-disable` one, both. Only in files whose agent ESLint config reads inline config (`calculateConfigForFile`) | ESLint never reads the `oxlint-disable` form, and oxlint reports unused comments in banned files too (review Should Fix 4) |
| Output: `oxlint failed: <oxlint's first message line>` | All oxlint printed, stdout then stderr, each trimmed at its ends | A refusal's reason follows a header line (review Should Fix 3, read-q64) |
| Signals: a fix run interrupted restores its files | Any signal or failure from the fix step until the report is printed puts every file back as it was before the fixes | Only a printed report carries the autofixed line (P2); review Should Fix 2. Owner card: a run that could not finish puts its fixes back too |
| Summary: "The list is complete" | Left out under a cut | The cut line above it says more findings follow (review, nice to have) |
| init step 4: compute both texts first | The printed lines and notes too, so a `package.json` above the folder that does not parse refuses with nothing written; a git that cannot be started counts as outside git | Review Should Fix 1, q-i8 |

### Corrections from the second review fixes (2026-10-15, cli-dev)

| Was | Now | Why |
| --- | --- | --- |
| Step 14: an oxlint diagnostic with no code that is not an unused-suppression report is a parse error | One whose message starts `Unused eslint-enable`, `Unused oxlint-enable`, `Unused eslint-disable` or `Unused oxlint-disable directive` reports on a comment, never a parse error; only the disable forms feed unused suppressions | oxlint reports an enable comment that turns back on nothing with no code too (measured, 1.87); read as a parse error, it hid every finding in the file (review Must Fix 2). Owner card: `check` reports no such enable comment |
| Signals: a signal or failure after the fixes puts every file back as it was before them | It puts back each file that still holds the text `check`'s last fix in it left. A file another writer changed, deleted or replaced meanwhile stays as that writer left it, and the run's own failure is the one reported | The undo wrote over another agent's edits, and a deleted file's error replaced the run's (review Must Fix 1). Owner card: a file `check` cannot write back keeps its fix, and nothing says so |
| Writes: a file whose oxlint fixes fail the guard is restored from its snapshot | Only while it still holds oxlint's text, as ESLint's write | The same defect as Must Fix 1, found in the sweep. Another writer's change while oxlint runs, or before `check` reads the file once it ends, cannot be told from oxlint's fix (owner card) |
| Unused suppressions: a name is unused where both engines report it unused at one line | oxlint gives an unused `disable` … `enable` pair at the enable comment, ESLint at the disable one, so oxlint's report is read at the disable comment: the first naming the rule since the last enable comment naming it, in either form | The pair was never reported in the `eslint` form, and at the enable comment in the `oxlint` form (review Should Fix; measured, oxlint 1.87, ESLint 10.12) |

### Corrections from the third review fixes (2026-10-15, cli-dev)

| Was | Now | Why |
| --- | --- | --- |
| Signals: a signal or failure after the fixes puts back each file that still holds the text `check`'s last fix in it left | No file is put back. Every fix already written stays, as with `eslint --fix`, and before exiting 130, 143 or 2 `check` prints the autofixed line naming the files its fixes rewrote so far | Two review rounds in a row found the undo writing over other agents' edits (r8, r12, r13). Orchestrator's decision, carded |
| Output: the autofixed line names the files whose text differs from before the fixes | The files `check`'s own fixes rewrote and kept, in a finished run as in a stopped one | A file only another writer changed was named (tester's call, carded) |
| Unused suppressions: the disable comment of a pair is found by reading the file's text | Found among the comments typescript-eslint's parser reads, so comment-like text in a string or a template literal is none. Where no disable comment above names the rule, or the text does not parse, the pair is reported at oxlint's line; the pairing never refuses the run | A string between a pair made `check` refuse the run (exit 2) and hide every finding (review Should Fix, r14) |

### Corrections from the fourth review fixes (2026-10-15, cli-dev)

| Was | Now | Why |
| --- | --- | --- |
| Unused suppressions, the row above: "the pairing never refuses the run". It still refused it (exit 2) where oxlint reports a name unused that no comment holds now | In an `eslint-disable` comment it is read at oxlint's line, where ESLint's report decides it. In an `oxlint-disable` comment it was read from a text the file no longer holds, so it is dropped for that run; the next run reports the comment where it is now | Another writer adding a line above a suppression comment after oxlint read the file made `check` refuse the run and hide every finding (review Must Fix 1, n3). Orchestrator's decision |

### Corrections at landing (2026-10-15)

| Was | Now | Why |
| --- | --- | --- |
| X4: the lane's `src/agent-configs.ts` (`agentConfigsOf`, `agentConfigsOfPart`), pinned equal to the test helper by `src/agent-configs.test.ts` | `check` calls core's `buildAgentConfigs(agentSettingsOf(eslint))`; the lane's file, that test and its helper `differences-beside-functions.ts` are dropped | spec-core.md C12 and 8.3: core owns the one builder, which the test helper calls too |
| X1 meanwhile: `run-init.ts` reads every definition as not opt-in | `init` reads `optIn` from rule-data's definitions | The data lane landed `optIn` |
| X5: K-18's stderr test pinned `it.fails` | A plain test | Core's C13 landed; the test passes |
| X6: the published variants of "check right after init" wait on core | Still pinned, as no lane covers `n/no-unpublished-import` on the config; the private variant a tsconfig takes in is pinned too: `no-unsafe-assignment` on `import.meta.dirname` under TypeScript 6 (the owner card on typed-config-files) | Measured at landing: core's C9 gives the config the typed rules where a tsconfig takes it in |

## Commands

From the lane copy's root unless noted.

```sh
# oxlint codes shared by more than one RuleId
jq -r '.rules[] | select(.oxlint != null) | "\(.oxlint.oxlintPlugin)(\(.oxlint.oxlintName | split("/") | last)) \(.id)"' packages/rule-data/src/generated/inventory.json | sort | awk '{c[$1]++} END {n=0; for (k in c) if (c[k]>1) n++; print n}'
# the gate's withheld fixers, shipped today
jq -r '.[] | select(.id|test("perfectionist/sort-(objects|sets|maps|arrays)|context-display-name")) | "\(.id) \(.engine) \(.ruleset)"' packages/rule-data/data/rules.json
# the gate's ignore list
cat ~/dev/ai-benchmarking/agents-inc/vendor/lint/ignore-patterns.json
# oxlint's JSON carries no fix data: a fixable no-var finding, no fix field
node <repo>/node_modules/oxlint/bin/oxlint -c <config with no-var on> -f json <file with var a = 1>
# the empty tree for a repo with no commits
git hash-object -t tree /dev/null
# Node for the floor test
/usr/bin/node --version
# gate
bun run build --force && bun run typecheck --force && bunx turbo test --force --continue --concurrency=1 -- --maxWorkers=2
```
