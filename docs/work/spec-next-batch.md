# Spec: `check` and `init`, four rule changes, ruleset round 2

Drafted 2026-10-11 by pm. It follows [spec-owner-answers](spec-owner-answers.md), whose build (`wf_ec970377-570`) is still running. The owner's decisions are the last entries of [decisions](decisions.md). The evidence is three read-only research reports, kept in scratch, which may vanish:
- `check`/`init`: `scratchpad/check-research/`
- the rule changes: `scratchpad/research-22-23-33-ts/`
- round 2: `scratchpad/round2/`

All three sit under `/tmp/claude-1000/-home-vince-dev-agents-inc-lint-rules/a25168ef-5c3c-4f9b-b5bd-1ca853c645f7/`. Each figure is given as the command that produces it, under [Commands](#commands). In this spec, "measured" means someone ran it, and "read" means it was read from source.

## What changes for a user

- **`check` exists.** A sub-agent runs it with no arguments.
  - It finds the changed JS and TS files and lines in git.
  - It lints them with the agent rulesets plus the consumer's `rules`, using its own ESLint and oxlint.
  - It prints `file:line rule — message` and exits 0 (clean), 1 (findings) or 2 (could not run).
  - It never reads the project's own lint configs and never writes into the project, apart from a temporary oxlint config that it deletes.
- **`init` exists.** It writes `agents-inc.lint.mts` and adds the package to `devDependencies`.
  - Every ruleset that is not opt-in goes into the agent set. The editor set starts empty, with a comment saying to add rulesets there.
  - It changes no other file.
- **A blanket suppression is reported where suppressions are allowed.** This covers `// eslint-disable`, `/* eslint-disable */` and the `oxlint-disable` forms. `house/no-suppressions` reports them in place of `unicorn/no-abusive-eslint-disable`, which leaves the shipped list.
- **`house/require-class-helper` ships.** It accepts `classNames(…)` and `classnames(…)` as helpers.
- **import-x understands TypeScript imports in ESLint**: extensionless imports, `.js`→`.ts`, and tsconfig path aliases.
  - `import-x/order` starts treating aliases as internal. That is new findings on code sorted by today's rule.
- **typescript-eslint's version of a core rule runs on TS files, in every set:** `default-param-last`, `prefer-promise-reject-errors` and `no-throw-literal`. `throw 'x'` stops being reported twice.

**Goal:** give sub-agents one command that lints exactly what they changed, give projects a one-command setup, and apply the owner's four rule decisions. Each change is fenced and checkable.

**User story:** As an orchestrator, I want each sub-agent to run `check` after editing and get a complete, short list of what it broke, so that agents fix their own code without reading lint configs.

---

## Where this batch starts

1. **After the running build lands** (`wf_ec970377-570`: lanes A1, A2, B, C, its review and its docs). It owns files this batch changes later. Each is listed under the lane that takes it over:

   | This batch's lane | Files the running build also changes (its lane) |
   | --- | --- |
   | M | `packages/lint-rules/package.json`, root `bun.lock` (B) |
   | E | `src/core/build-eslint-config.ts` and its test, `src/core/ts-files-outside-every-tsconfig.ts` and its test, `src/core/catalog-lookups.ts`, `src/__tests__/agent-configs.ts` (C); `src/eslint.ts`, `src/core/merge-eslint-config.ts`, `src/merge-eslint-config.test.ts` (A1); `src/dist-loading.test.ts`, `src/eslint-fallback.integration.test.ts`, `test-fixtures/eslint-fallback/` (B) |
   | D | all of `packages/rule-data/` (B); `src/editor-equivalence.test.ts`, `src/editor-parts.test.ts` (A1); `src/__tests__/oxlint-codes.test.ts` (A2) |
   | K | `tsdown.config.ts` (C) |

   **Seen mid-edit at 18:38:** Lane C was writing C4 into `build-eslint-config.ts`. `twinsOnTsFiles` is now in source, and `buildEslintConfig` takes C3's outside-every-tsconfig list. This spec assumes both land as spec-owner-answers describes.

2. **The owner's third sweep (decisions.md, last entry) is not in this brief.** decisions.md says it lands "with the next batch", and status.md plans a pm addendum. If it is folded in, its items go into these lanes, so no file has two owners:
   - The jsx-a11y-x fork: its manifests go to M; its registry, generated files and data go to D; its fallback fixtures go to E.
   - The eight modern-js rules shipped off: D.
   - unicorn stand-ins for two `oxc/*` rules without oxlint: data to D. The code reading them is not owned here, so the addendum names it.
   - "oxlint is not refused for its version; check names against the installed oxlint's rule list": `src/core/installed-oxlint.ts` and `src/merge-oxlint-config.installed-oxlint.test.ts`. No lane here owns these.
   - **That last item is a precondition of M2.** Today the merge reads *our oxlint peer range* (`refuseOxlintOutsideOurPeerRange`). Moving oxlint from a peer to a dependency without it makes every `mergeOxlintConfig` call throw "lists no version range for oxlint".

## Pattern files to read first

| What | File and symbol | Why |
| --- | --- | --- |
| Git listing and changed lines | `~/dev/ai-benchmarking/agents-inc/vendor/lint/gate.mjs`: `git`, `changedFiles`, `addedLines`, `noteCrash`, the closing message (read-only repo) | Proven: argv-only git, `-z`, rename pairs, `-U0` hunks, crash detection. The closing line stopped agents reading the config. |
| Running both engines | `packages/lint-rules/src/__tests__/engine-run.ts`: `runBothEngines`, `runOxlintWith`, `runOxlint` | ESLint's Node API with `overrideConfigFile: true`; oxlint from our bin with `-c`, cwd the project |
| The agent build | `src/__tests__/agent-configs.ts`: `agentConfigsOf`; `src/agent-settings.ts`: `agentSettingsOf` | Exactly what `check` builds; the WeakMap needs one shared module |
| Errors that name the file | `src/core/config-error.ts`: `configErrorIn` | Every config error is already `agents-inc.lint.mts: …` |
| package.json reading | `src/core/package-json-files.ts`: `readPackageJsonFile`, `ourPackageJsonFile`, `versionOf` | Parse boundary, and our own version |
| The template `init` writes | `test-fixtures/consumer-files/agents-inc.lint.mts`; `packages/rule-data/data/ruleset-definitions.json` via `rulesetDefinitions` | Layout and order |
| Working prototype of `check` | `scratchpad/check-research/tools/check-proto.mjs` | Steps 1–12, measured |
| A house rule with options | `packages/eslint-plugin-house/src/rules/hook-file-naming.ts` (`defaultOptions`, `filledFileNamingOf`) | Option pattern for #22 |
| The rule #22 changes | `src/rules/no-suppressions.ts`: `labelOf`, `isSuppression` | |
| A report a directive cannot hide | `node_modules/eslint-plugin-unicorn/rules/no-abusive-eslint-disable.js` (read) | Where it reports, so the comment's own directive does not swallow the report |
| A rule `allowSuppressions` sets with options | `@typescript-eslint/ban-ts-comment` in `data/rules.json` (`whenSuppressions.allowed.options`) | Data shape for #22 |
| ESLint settings | `src/core/eslint-settings.ts`: `buildEslintSettings` | #33 and the React noise |
| C4, the typescript-eslint preference | `src/core/build-eslint-config.ts` (`twinsOnTsFiles`), `src/core/catalog-lookups.ts`: `twinsOf` | What the prefer-TS change extends |

---

## Lanes

No file is owned twice. A change needed in another lane's file is reported, not made. Paths are under `packages/lint-rules/` unless they start with `packages/`. Each lane's tester writes the tests first and watches them fail.

| Lane | Builds | Starts |
| --- | --- | --- |
| **M** | The manifests and the install | First, alone. M2 waits for the third-sweep oxlint item. |
| **E** | The ESLint builder: #33, typescript-eslint versions of ESLint-run core rules, React-version noise, one agent-config builder | After M1 |
| **D** | Rule data and house rules: the opt-in flag, #22, #23, #33's skip list, the equivalence tests; part 2 is round 2 verdicts | After the running build; D1 first |
| **K** | The `bin` entry and `check` | After M1. Integrates E4 once it lands. |
| **I** | `init` | After D1 and K's exit-code module |

**Order (keep it in the written queue):**
1. M1.
2. D1 (opt-in field), E4 (agent-config builder) and K's `src/cli/exit-codes.ts`, the small shared pieces.
3. K, I, E and D in parallel.
4. D's #33 skip-list edit after E1 is green on fixtures.
5. M2 after the third-sweep oxlint item.
6. CLAUDE.md steps 5–8: the expressive-TS pass, the real run (cases below), review, docs.
7. D part 2 only after the owner's round 2 verdicts.

### Lane M: manifests and install

**Owns:** `packages/lint-rules/package.json`, root `bun.lock`.

**Must:**
1. **M1:**
   - Add `eslint-import-resolver-typescript` 4.4.5 (exact) to `dependencies`. Research measured that only it and `is-bun-module` are new; `unrs-resolver` is already installed.
   - Add a `bin` entry, named per Q-C1 (meanwhile `agents-inc-lint`), pointing at `./dist/cli.mjs`.
   - Run `bun install`.
2. **M2** (after the third-sweep oxlint item): move `eslint` 10.12.0 and `oxlint` 1.87.0 from `peerDependencies` to `dependencies`, exact, at the versions `packages/rule-data/src/generated/inventory.json` records. Remove them from `devDependencies`. Keep the `typescript` peer.

**Must NOT:**
- Change any other version. `generated-files.test.ts` must stay green with no regenerate.
- Add `exports` subpaths.

### Lane K: the `bin` entry and `check`

**Owns:**
- New: `src/cli.ts` (the bin entry), `src/cli/exit-codes.ts`, `src/cli/check/**` (the suggested home of every check module)
- New tests: `src/cli/check/**/*.test.ts`, `src/check.integration.test.ts`, `src/cli-dist.test.ts`
- New helpers: `src/__tests__/git-projects.ts` (temp git repos), `src/__tests__/factories/check-factories.ts`, `test-fixtures/check/`
- Existing: `tsdown.config.ts` (add the entry), `src/agent-settings.ts` (comment only, if it turns false)

#### Command surface

- **No flags, no environment variables, no config keys** (owner).
- `<bin> check` and `<bin> init` (Lane I) are the only valid calls. Anything else goes to usage on stderr, exit 2 (Q-C16): no command, another command, or anything after the command, `--help` included.
- No `--json`, `--quiet` or `--verbose`. Output is the same on a TTY and in a pipe: no ANSI colour and no progress output.

#### `check`, in order (the contract, not the code)

1. **Node floor.** Below 22.18, exit 2 with the message below, before loading anything that needs the newer Node. Proven with `/usr/bin/node`, which is 18.20.8.
2. **The repo.** Find the git top level from the current folder. If there is none, exit 2.
3. **The config.** Find the nearest `agents-inc.lint.mts` from the current folder up to the git top level (Q-C6). If there is none, exit 2 and say to run `init`.
4. **Same package copy.** Compare the `@agents-inc/lint-rules` the config resolves (`findPackageJSON` from `node:module`; research measured it works on 22.23) with this package's own root, after `realpath`. On a mismatch, exit 2 naming both paths. `agentSettingsOf`'s own message would mislead here.
5. **Load it.**
   - Import the config. A config error is printed as is, exit 2.
   - If `@agents-inc/lint-rules` does not resolve, exit 2 and say to run the install.
   - Take the agent settings from its `eslint` export (`agentSettingsOf`).
6. **Changed files.**
   - Base is `HEAD`. In a repo with no commits, the base is the empty tree (`git hash-object -t tree /dev/null` gives `4b825dc642cb6eb9a060e54bf8d69288fbee4904`; measured here).
   - Tracked changes against the base, staged and unstaged: added, copied, modified and renamed (old and new path kept). Deletions are left out.
   - Untracked files that are not ignored.
   - Paths are NUL-separated, and git always gets an argv array, never a shell string.
   - Keep the extensions `js mjs cjs jsx ts mts cts tsx`. Research measured that the gate's own regex misses four of them.
   - Keep files under the config's folder; skip the others with a note.
   - Keep files that exist and that our built config does not ignore (ESLint's `isPathIgnored` on our config). Both engines then get the same list.
7. **Changed lines.**
   - An untracked file is wholly changed (owner).
   - Otherwise the added lines come from a zero-context diff against the base. A renamed file is diffed against its old path; research measured that without it a `git mv` plus one line reads as six added lines.
   - A pure deletion adds no line. Q-C7 decides whether a plain `mv` is paired.
8. **Nothing left:** print the "no changed files" line and exit 0. Neither engine starts, and no temp file is written. Research measured that both engines lint the whole folder when given no paths.
9. **Build** both configs from the agent settings with E4's builder, the same function the tests use.
10. **Run both engines at once on the file list.**
    - **ESLint** through its Node API: cwd the config's folder, our config only, the project's `eslint.config.*` never loaded (research: a project config that throws was never imported), and ignored files left silent.
    - **oxlint** from *our own* installed bin, with JSON output and cwd the config's folder.
    - **oxlint's config is a temp file in the config's own folder**, named `.agents-inc-check-<pid>-<random>.json`. It must not be in another folder: there, rooted `ignores` globs do nothing (measured here: `src/generated/**` was ignored with the config in the project folder and not with it elsewhere). Never `.oxlintrc.json` or `oxlint.config.*`, which editors and oxlint's nested lookup would find.
    - The temp file is deleted on every exit path. A leftover `.agents-inc-check-*` whose process is gone is removed. One whose process lives is kept.
11. **Read oxlint's output, not its exit code.** It exits 1 for findings and for a broken config alike, and prints both to stdout (measured here). A config parse failure, or no JSON at all, exits 2, quoting oxlint.
12. **Rule IDs.**
    - oxlint's `plugin(rule)` codes map to canonical ESLint IDs through `catalog.oxlintRules`. An oxlint diagnostic with no code is a parse error.
    - ESLint's own non-fatal messages with no rule ID are left out: the "has no effect because of noInlineConfig" notice beside every banned suppression (round 2, D23). A fatal message is a parse error.
13. **Keep a finding** when:
    - its start line is a changed line, or
    - it is anywhere in a wholly changed file, or
    - it has no line (or line 0) and its file is wholly changed.

    A parse error in any changed file is always kept, once per file; both engines report it. Identical findings are printed once.
14. **Unused suppressions:** part 3 below.
15. **Print, append one log line, exit.**

**Part 3: unused suppressions.** plan.md decides this. It applies only in files where suppressions are allowed.
- Each rule a suppression comment on a changed line names is reported when it reported nothing there. The message is drafted under Q-C15.
- ESLint-run rules: ESLint's own unused-directive report, kept only for names ESLint runs.
- oxlint-run rules: research has a design sketch only. oxlint's `--report-unused-disable-directives` names no rule and flags ESLint-only names.
- **Spike first.** If no mechanism works for oxlint-run rules, stop and report with the evidence. Do not build a half that reports only ESLint's rules.

#### Output contract

- **stdout:** findings, then the summary. **stderr:** notes and "could not run". Payload and diagnostics never mix.
- **Lines** (drafts verbatim; Q-C4):
  - `src/cart.ts:12 @typescript-eslint/no-floating-promises — <message>`
  - Warning: `src/cart.ts:30 no-console (warning) — <message>`
  - Parse error: `src/broken.ts:4 parse error — <message>`, ESLint's message when both engines report it.
  - Paths are relative to the config's folder, with forward slashes.
  - Errors come first, sorted by path then line; then warnings, sorted the same way.
- **Cap** (Q-C5, meanwhile on): stop before 8,000 characters and print `+<N> more findings in <M> files. Fix the ones above, then run check again to see them.`
- **Summary, the last stdout line:**
  - Errors: `check: <E> errors and <W> warnings in <F> of <C> changed files. The list is complete: fix what is in code you wrote, then run check again. Do not read the lint configuration or this package's source; each line says what to fix.`
  - Warnings only: `check: no errors; <W> warnings in <F> of <C> changed files. The list is complete.`
  - Clean: `check: no findings in <C> changed files.`
  - Nothing to check: `check: no changed JS or TS files.`
  - Singular forms where a count is 1.
- **Notes (stderr):**
  - `check: note: skipped <N> changed files outside <config folder>.`
  - `check: note: agents-inc.lint.mts has changed. Agents must not edit it; this run used the changed file.` (Q-C14)
  - `check: note: could not write the log at <path>: <reason>.`
- **Could not run (stderr, exit 2):** each line starts `check: could not run: `.
  - `Node 22.18 or later is needed; this is Node <version>.`
  - `<cwd> is not inside a git repository, and check reads the changed files from git.`
  - `there is no agents-inc.lint.mts in <cwd> or any folder above it up to <git top level>. Run "<bin> init" in the folder of the package to lint.`
  - `<the config error, as thrown>`
  - `agents-inc.lint.mts imports @agents-inc/lint-rules from <path A>, and this check is <path B>. Run the check that project installed.`
  - `@agents-inc/lint-rules is not installed where agents-inc.lint.mts can import it. Run your package manager's install.`
  - `oxlint failed: <oxlint's own first message line>` / `ESLint failed: <its message>`
- **Usage (stderr, exit 2):**
  ```
  usage: agents-inc-lint <command>
    init   add @agents-inc/lint-rules and agents-inc.lint.mts to the package in this folder
    check  lint the JS and TS lines changed since the last commit
  ```

#### Exit codes

Named constants in `src/cli/exit-codes.ts`, shared with `init`:

| Constant | Code | When |
| --- | --- | --- |
| `EXIT_CLEAN` | 0 | No error findings (warnings may be listed), or nothing to check. `init`: wrote both files. |
| `EXIT_FINDINGS` | 1 | At least one error finding or parse error. `init`: refused because the config exists, nothing changed. |
| `EXIT_COULD_NOT_RUN` | 2 | Usage, Node too old, not git, no config, config error, other package copy, engine failure. `init`: no or bad package.json, a failed write. |
| `EXIT_INTERRUPTED` | 130 | SIGINT |
| `EXIT_TERMINATED` | 143 | SIGTERM |

`check` fails **closed**. The gate failed open because it was a hook; `check` is called on purpose.

#### Signals and leftovers

- On SIGINT or SIGTERM, `check` kills the oxlint child, deletes its temp config, prints `check: interrupted` on stderr and exits 130 or 143.
- A second Ctrl+C exits at once; cleanup is a single delete.
- **Invariant:** after any exit, no `.agents-inc-check-<own pid>-*` file remains.

#### Log line (plan.md decides one per call; Q-C13 decides where)

- Meanwhile: one JSON object per line, appended to `${XDG_STATE_HOME:-$HOME/.local/state}/agents-inc-lint/<repo folder name>-<first 12 hex of sha256(repo top level)>.log`.
- Fields: `time`, `repo`, `config`, `files`, `errors`, `warnings`, `exit`, `ms`, `version`.
- Never inside the work tree. A failed write is a note and never changes the exit code.

#### Must NOT (Lane K)

- Read, import or spawn the project's own ESLint or oxlint config, or the project's own ESLint or oxlint.
- Write any file into the project but the temp config. Run any git write, or touch the real index.
- Autofix, format or type-check (Q-C11, Q-C12). Filter findings by who wrote them (owner).
- Add any flag, environment variable, export or `exports` subpath.
- Edit the builders (E) or rule data (D).

### Lane I: `init`

**Owns:** new `src/cli/init/**` and its unit tests, `src/init.integration.test.ts`, `src/__tests__/factories/init-factories.ts`, `test-fixtures/init/`. Lane K wires `init` into `src/cli.ts`, calling one entry function I exports.

**Behaviour, in order:**
1. The Node floor and argument check are the same as `check`'s.
2. The current folder must hold a `package.json` that parses as an object. Otherwise exit 2 and change nothing (Q-I2).
3. If `agents-inc.lint.mts` exists there, exit 1 and change nothing (Q-I1).
4. **Write `agents-inc.lint.mts`**, generated from `rulesetDefinitions` in their order, never from a hand-kept list.
   - Layout as the consumer-files fixture.
   - `agentRulesets`: every ruleset not flagged opt-in, by list, with `libs` grouped by domain. An empty list is written `[]`.
   - An opt-in ruleset appears only in a line comment directly above the list it belongs to. Draft: `// Opt-in, so not listed: 'strict-design-tokens'`. No comment when there is none, as today.
   - `editorRulesets`: `quality: []`, `libs: {}`, `runtimes: []`, `languages: []`, under the comment `// What people's editors show once your team merges it into its own lint configs: add rulesets here.` Research measured that this exact text passes every rule.
   - Then `ignores: []`, `rules: {}`, `fileOverrides: []`, and `export const { eslint, oxlint } = config.editorRulesets`.
   - The full default text is under Q-I6.
5. **Edit `package.json`.**
   - Add `"@agents-inc/lint-rules": "^<our version>"` to `devDependencies` unless it is already listed under `dependencies` or `devDependencies`, whose range then stays (Q-I4).
   - Insert alphabetically. Create `devDependencies` last if it is absent.
   - Keep the file's indentation (spaces or tab), key order and trailing newline.
6. **Either both files change or neither.** Compute both texts first. Write each atomically (temp file, then rename). If the second write fails, put the first back and exit 2.
7. **Print to stdout:**
   - `init: wrote agents-inc.lint.mts and added @agents-inc/lint-rules ^<version> to devDependencies in package.json.` (or "kept the existing entry")
   - `Next: run "<install command>".` The package manager comes from the first lockfile found from the folder up: `bun.lock` or `bun.lockb` gives `bun install`; `pnpm-lock.yaml` gives `pnpm install`; `yarn.lock` gives `yarn install`; otherwise `npm install`.
   - The agent instructions (Q-I3; draft there), with the runner matching the package manager: `bunx`, `pnpm exec`, `yarn` or `npx`.
   - Outside git, to stderr: `init: note: <folder> is not in a git repository, and check needs one.` Still exit 0.

**Must NOT:**
- Run an install. Touch the lockfile, `node_modules`, the team's lint configs, scripts or agent files (owner: two files only).
- Add flags.
- Hand-list rulesets.

### Lane E: the ESLint builder

**Owns:**
- `src/core/eslint-settings.ts`, `src/core/build-eslint-config.ts` and its test
- `src/core/ts-files-outside-every-tsconfig.ts` and its test (additive exports only)
- `src/core/catalog-lookups.ts`, `src/eslint.ts`, `src/core/merge-eslint-config.ts`, `src/merge-eslint-config.test.ts`
- `src/__tests__/agent-configs.ts`
- `src/dist-loading.test.ts`, `src/eslint-fallback.integration.test.ts`, `test-fixtures/eslint-fallback/`
- New: `src/core/build-agent-configs.ts` (suggested name), `src/import-x-resolution.integration.test.ts`, `test-fixtures/import-x-ts/`

**E1: the import-x TypeScript resolver (#33, fix C).**
- **The settings** give import-x `eslint-import-resolver-typescript`'s resolver, built with the list of first-party tsconfig paths.
  - The list holds every `tsconfig.json` and `jsconfig.json` under `tsconfigRootDir`, outside `node_modules` and `.git`, taken from the same walk C3 does.
  - Not `project: tsconfigRootDir`: research measured that it misses each package's own aliases in a monorepo with no root tsconfig.
  - Not a `**/tsconfig.json` glob: on cv-launch it read tsconfigs inside `node_modules` and crashed ESLint.
- **They also give `import-x/extensions`** for `.ts .tsx .cts .mts .js .jsx .cjs .mjs`. Research measured that both halves are needed: the resolver alone leaves every export-reading rule silent.
- **Both sets get it:** the agent build and the editor merge, where it is computed at the `eslint.ts` boundary.
- `buildEslintConfig` stays pure: the list arrives as input.
- **A project with no tsconfig:** no crash, and extensionless relative imports of `.ts` files still resolve.
- **The guard #33 asked for:** every import-x fixture imports a `.ts` target with no extension.

**E2: typescript-eslint's version of ESLint-run core rules, in every set** (the owner's "prefer the typescript-eslint rules", extending C4).
- For each stated core rule that ESLint runs, in the agent build and in both editor shapes, which has a current extension (`catalog.coreRuleExtensions` less aliases; no rule named in code):
  - TS files get the extension with the core rule's setting, and the core rule off there.
  - JS files keep the core rule.
  - A typed extension runs only where type information exists; elsewhere the core rule runs.
  - The research command lists today's three (Commands).
- **Where the extension is itself shipped and stated** (`@typescript-eslint/only-throw-error`), the swap does not restate it. It only turns the core rule off where the extension runs (Q-R5 default). Turning `no-throw-literal` off in an entry then leaves `only-throw-error` as stated, and where the extension is off the core rule runs.
- Refused options keep the core rule on TS files there (C4's D-e).
- **The editor merge:** a team's twin is off exactly where ours runs the rule, beside oxlint too. A1's per-file twin switch must no longer be limited to projects without oxlint.

**E3: no eslint-plugin-react noise.**
- Where `react` does not resolve from `tsconfigRootDir`, the settings name an explicit React version, so the plugin prints nothing. Read in `eslint-plugin-react/lib/util/version.js`: it prints a "react package is not installed" warning once per process.
- Where React resolves, `detect` as today.

**E4: one builder of the agent set's two configs.**
- A production function takes the agent settings, the catalog, the plugin registry and the project facts. The facts are the TS files outside every tsconfig, the first-party tsconfigs and whether React resolves, all read by one walk of `tsconfigRootDir`.
- It returns `{ oxlint, eslint }`.
- `check` and `src/__tests__/agent-configs.ts` both call it, so the tests test what `check` runs.

**Must NOT:**
- Name a rule in code (`names-no-rule.test.ts`).
- Change any rule's data (D).
- Read a tsconfig inside `node_modules`.
- Make the `index` or `oxlint` entries load the resolver.
- Change C4 for oxlint-run core rules beside oxlint, which oxlint runs.
- Use a cast or a function matcher.

### Lane D: rule data and house rules

**Owns:**
- All of `packages/rule-data/` (generated files only through `bun run --cwd packages/rule-data generate`)
- All of `packages/eslint-plugin-house/`
- In lint-rules: `src/suppression-ban.integration.test.ts`, `src/allow-suppressions.test.ts`, `src/config-errors.test.ts`, `src/define-lint-rules.type-test.ts`, `src/gate-equivalence.test.ts`, `src/editor-equivalence.test.ts`, `src/editor-parts.test.ts`, `src/engines.integration.test.ts`, `src/__tests__/oxlint-codes.test.ts`, `src/__tests__/cases/suppression-comments.ts`, `test-fixtures/suppression-ban/`, `test-fixtures/engines/`
- D's tester writes the equivalence expectations for E2 too, since D owns those files.

**D1: the opt-in flag.**
- Each entry in `ruleset-definitions.json` gets `optIn: false`. `RulesetDefinition` carries it.
- No ruleset is opt-in yet; `strict-design-tokens` is not built.

**D2: #22, a blanket mode for `house/no-suppressions`.** Build it last in this lane: Q-R1 may replace it.
- **The option:** an internal one (suggested `blanketOnly`), default off, so today's behaviour is unchanged. When on, the rule reports only a comment that silences every rule.
- **A blanket comment:** its label is one of the six disable forms (`eslint-disable`, `-line`, `-next-line`, and the three `oxlint-` forms), and the text after the label names no rule. That text is cut at the first `--` and split on commas and whitespace.
  - So `// eslint-disable-next-line --no-space` is blanket, as oxlint reads it.
  - `/* eslint-disable because */` names a rule called "because", so it is not blanket.
- **Its report must survive the comment's own directive** where ESLint reads directives. The pattern is unicorn's report position.
- **The new message, verbatim:** `This comment silences every lint rule. Name the rules it is for.`
- **Data:**
  - `house/no-suppressions` gets `whenSuppressions: { banned: "on", allowed: { options: [{ blanketOnly: true }] } }`, with `options: []` kept.
  - `unicorn/no-abusive-eslint-disable` leaves `rules.json`. It becomes a plain `RuleId` that `rules` may set.
  - Add the pair to the "dropped and replaced" pin.
- No lint-rules core change is expected; the routing already reads `{ options }`. Report one if it turns out to be needed.

**D3: #23, ship `house/require-class-helper`.**
- Add `classNames` and `classnames` to the default helpers in the rule and in the cases file's copy. Two-class ternaries stay reported (owner).
- Add the `rules.json` entry: `conventions` (Q-R2), ESLint, `options: []`, untyped, assignment `by: owner-2026-10-11`.
- Delete its candidate entry.

**D4: #33's skip list.** After E1 is green on the fallback fixtures:
- Remove the skips of `import-x/namespace`, `no-cycle`, `no-named-as-default` and `no-self-import`.
- Keep `import-x/default` and `no-named-as-default-member` (Q-R3), each with the measured reason: with the resolver, ESLint's version reports what oxlint does not on the same code.

**D5:** the expectation changes listed under [Existing assertions](#existing-assertions-the-owners-decisions-make-wrong).

**D part 2: after the owner's round 2 verdicts.** Only the data-only ones: drop a rule, change options, add `ignores`. The S and T mechanisms need code and get a spec of their own once approved.

**Must NOT:**
- Ship any other candidate rule (the owner reviews each).
- Apply any round 2 proposal before its verdict.
- Change engines or rulesets beyond D2–D4.

---

## Success criteria

**K: `check`.** The integration tests run the built bin on temp git repos.

| # | Criterion | How to verify |
| --- | --- | --- |
| K-1 | No changed JS or TS files: the line, exit 0, and no temp config was ever created (a watcher on the folder) | `check.integration.test.ts` |
| K-2 | An untracked file: findings on every line | same |
| K-3 | A tracked file with a finding on an unchanged line and one on a changed line: only the second | same |
| K-4 | `git mv` plus one appended line: only that line's findings | same |
| K-5 | A file named with a space and one with non-ASCII: both checked, paths printed correctly | same |
| K-6 | Staged-only and unstaged-only changes both counted; a deleted file never reported | same |
| K-7 | A repo with no commits: every file wholly changed | same |
| K-8 | All eight extensions linted; `.json`, `.md` and `.css` changes ignored | same |
| K-9 | A file under `ignores: ['src/generated/**']` is reported by neither engine | same |
| K-10 | A project `eslint.config.mjs` that throws on import, and a project `.oxlintrc.json` turning a rule off: neither has any effect | same |
| K-11 | No `.agents-inc-check-*` remains after a clean run, a findings run, an engine failure and SIGINT (exit 130); a dead pid's leftover is removed; a live pid's is kept | same, plus a unit test on the leftover rule |
| K-12 | Two runs started together both exit correctly and leave no temp file | same |
| K-13 | A syntax error in a changed file: one `parse error` line, exit 1 | same |
| K-14 | A banned suppression comment: exactly one finding (`house/no-suppressions`), ESLint's own notice left out | same |
| K-15 | Every oxlint code in `catalog.oxlintRules` translates to its canonical ID | unit test over the whole catalog |
| K-16 | Exit 2, with its verbatim line, for each case: Node 18 (`/usr/bin/node`), not a git repo, no config, a config error, the package not installed, another package copy, an oxlint config failure (from recorded oxlint output) | integration and unit |
| K-17 | Sorting, relative paths, warnings after errors and not failing the run, the cap line, singular and plural summaries | unit tests on the report |
| K-18 | stderr is empty on a clean run in a project without React | integration (needs E3) |
| K-19 | Anything after `check` gives usage, exit 2 | integration |
| K-20 | One log line per run, with every field, outside the work tree; a failed log write never changes the exit code | integration with `XDG_STATE_HOME` pointed at a temp folder |
| K-21 | `dist/cli.mjs` finds the agent settings of a config `dist/index.mjs` defined (a shared chunk) | `cli-dist.test.ts` |
| K-22 | Changed files outside the config's folder are skipped with the note | integration |
| K-23 | Part 3: in an allowed file, a suppression naming a rule that reported nothing gets one finding naming the rule, for an ESLint-run and an oxlint-run rule; a banned file gets none of these; or a spike report showing why the oxlint half cannot be built | integration, or the report |

**I: `init`.**

| # | Criterion | How to verify |
| --- | --- | --- |
| I-1 | package.json with 2-space, 4-space and tab indentation, with and without a trailing newline, with and without `devDependencies`: the entry is added alphabetically and everything else is byte-identical | `init.integration.test.ts` and unit tests |
| I-2 | The agent rulesets equal every non-opt-in ruleset in data order; a fake opt-in ruleset appears only in its comment | unit test with a catalog factory |
| I-3 | `defineLintRules` accepts the written file (imported in a test), and `tsc --noEmit` accepts it in a scratch project with `@types/node` | integration |
| I-4 | `check` right after `init` (file untracked) reports nothing for `agents-inc.lint.mts`, in a private and in a non-private package, with and without the fake opt-in comment | integration (needs K) |
| I-5 | An existing config: both files byte-identical, exit 1, the message | integration |
| I-6 | No package.json, or a malformed one: nothing written, exit 2, the file named | integration |
| I-7 | The package already listed: its range kept, the config written | integration |
| I-8 | Outside git: written, the note on stderr, exit 0 | integration |
| I-9 | In a scratch git repo, `git status --porcelain` afterwards lists exactly the two files | integration |
| I-10 | The printed install command and runner match each lockfile | unit |

**E: the ESLint builder.**

| # | Criterion | How to verify |
| --- | --- | --- |
| E-1 | Each of the six ESLint-run import-x rules fires on its probe in the agent build, and on the four un-skipped oxlint-run ones without oxlint. Probes: an extensionless `.ts` import, `.js`→`.ts`, an `@/` alias, a per-package alias with no root tsconfig, a cycle, a self-import, a renamed default from a TS module, `../../x`, a relative import into another package, a value import from a `types`-only package | `import-x-resolution.integration.test.ts`; `eslint-fallback.integration.test.ts` |
| E-2 | A broken `tsconfig.json` inside `node_modules` is never read: no fatal message | same |
| E-3 | The `index` and `oxlint` entries load no resolver module | `dist-loading.test.ts` |
| E-4 | Without oxlint and beside it, agent and editor: on TS files, `@typescript-eslint/default-param-last` runs with the core rule's setting and `default-param-last` does not; on JS, the reverse. `prefer-promise-reject-errors` follows the same split, but its extension needs types: typed TS gets the extension, while untyped TS and JS get the core rule. | `build-eslint-config.test.ts` (calculated entries per file) |
| E-5 | `throw 'x'` draws exactly one report: typed TS `only-throw-error`; JS and untyped TS `no-throw-literal` | engine-run test |
| E-6 | An entry turning `no-throw-literal` off leaves `only-throw-error` on there; turning `only-throw-error` off puts `no-throw-literal` back on typed TS | `build-eslint-config.test.ts` |
| E-7 | Beside oxlint, a team stating `@typescript-eslint/default-param-last` gets one report per finding through `mergeEslintConfig` | `merge-eslint-config.test.ts` |
| E-8 | No eslint-plugin-react output in a project without React; `detect` where React is installed | unit (a console spy), plus K-18 |
| E-9 | `check` and `agentConfigsOf` call the same builder | review, plus a unit test that the helper's output deep-equals the builder's |

**D: rule data and house rules.**

| # | Criterion | How to verify |
| --- | --- | --- |
| D-1 | Blanket mode: each blanket form in research's list is reported once with inline config read (`lintWithHouseRule`); each comment naming a rule, enable comment and rule-config comment is not | `no-suppressions.test.ts` |
| D-2 | Banned mode: every existing case passes unchanged | same |
| D-3 | Agent build, every ruleset, `allowSuppressions: true`: `// eslint-disable`, `/* eslint-disable */` and `// oxlint-disable` each draw exactly one error, `house/no-suppressions`. This is the guard against any other rule doubling it. | `suppression-ban.integration.test.ts` |
| D-4 | `rules` may set `unicorn/no-abusive-eslint-disable` (type and runtime); the other suppression rules stay refused beside it | `define-lint-rules.type-test.ts`, `config-errors.test.ts` |
| D-5 | `require-class-helper`: `classNames(…)` and `classnames(…)` silent, a two-class ternary still reported, shipped in its ruleset, not a candidate, generated files fresh | house tests, `catalog.test.ts`, `rule-candidates.test.ts`, `generated-files.test.ts` |
| D-6 | Every ruleset definition has `optIn` | `canonical-list.test.ts` |
| D-7 | The four import-x rules leave the skip list; the two kept give the measured reason | `eslint-fallback-skips.test.ts` |
| D-8 | Every changed equivalence expectation follows from #22, #23 or E2, and no other line changes | `git diff` of the two files, reviewed |

**All lanes.**

| Criterion | How to verify |
| --- | --- |
| Build, typecheck and tests green; no suite collects zero tests | `bun run build`, `bun run typecheck`, `bun run test` (turbo `--force`) |
| Nothing outside scope changed | `git -C ~/dev/ai-benchmarking status --short` the same before and after; `~/dev/cli` untouched |
| Real run (CLAUDE.md step 6), each case tracked in a scratch file | `npm pack`, then install into: (a) a scratch copy of a real project, then `init`, `install`, edit, `check`; (b) a monorepo with the config in one package; (c) a project with no oxlint in package.json; (d) a project with ESLint 9 installed, after M2; (e) bun and npm installs |

**Non-functional (report the figure and the command):**
- `check` on one changed file in this repo, median of 3, and peak memory. Over 5 s goes to the owner. Research measured about 2.2 s and 480 MB from TS source.
- The E4 walk on `~/dev/ai-benchmarking` (read-only). Over 300 ms, report it: a changed-files variant would be E's.
- ESLint time over this repo's `src` with the agent set, before and after E1. Over +25% goes to the owner. Research measured faster here and about twice as slow for the six rules on cv-launch.

---

## Existing assertions the owner's decisions make wrong

Only these change. Every other existing assertion stays.

**#22** (D): `unicorn/no-abusive-eslint-disable` leaves the shipped list, and `house/no-suppressions` takes options in allowed mode.
- `suppression-ban.integration.test.ts`:
  - `BLANKET_DISABLE_RULE` becomes `house/no-suppressions`. Its comments change too.
  - "suppressions allowed by allowSuppressions: true" gains `forms/eslint-disable-line-comment.ts` as a case.
  - What each case tests is unchanged: one error per blanket comment.
- `allow-suppressions.test.ts`:
  - `blanketDisableRule` goes.
  - `suppressionBan` compares the full entry, because the house rule now has options in both modes.
  - The header comment changes.
- `config-errors.test.ts`: "is refused in rules when it is unicorn/no-abusive-eslint-disable, naming allowSuppressions" becomes an accepted case.
- `define-lint-rules.type-test.ts`: the two `@ts-expect-error` lines on unicorn stop compiling, and become accepted cases.
- `gate-equivalence.test.ts`: `SUPPRESSION_RULE_IDS` and `SUPPRESSION_RULES_ALLOWED` (the house rule with the blanket option, no unicorn).
- `editor-equivalence.test.ts`: the unicorn rows become the house rule with the blanket option.
- `__tests__/oxlint-codes.test.ts`: "holds the code of each rule the ESLint part turns on…" loses `unicorn(no-abusive-eslint-disable)`.
- `no-suppressions.test.ts`: "has one message" becomes two.
- Comments only: `editor-parts.test.ts`; `__tests__/cases/suppression-comments.ts`.

**#23** (D): `classNames` is now a default helper.
- `require-class-helper.test.ts`: `OTHER_HELPER` and the case `callToAnotherHelper` become a name that is not a default (e.g. `joinClasses`). Affected: "reports a call to a helper the default helpers do not name", "stays silent on a call to a helper its helpers option names", and "reports a call to cn when the helpers option names others…". What they test is unchanged.
- `catalog.test.ts`: "makes house/require-class-helper a RuleId run by ESLint and shipped in no ruleset" now expects its ruleset.
- `engines.integration.test.ts`: the "not shipped" comment only.

**#33** (E for code, D for data): the resolver and TS extensions.
- `build-eslint-config.test.ts`: "carries the import-x node resolver, the immutability type overrides and React version detection" now expects the TypeScript resolver and extensions, and, with no React in the fake root, the explicit version (E3).
- `eslint-fallback-skips.test.ts`: whichever assertion pins the six import-x skips.

**"Prefer the typescript-eslint rules"** (E2; the expectations in D's files are written by D):
- `build-eslint-config.test.ts`: "keeps an ESLint-routed core rule on TS files though typescript-eslint extends it" flips.
- `gate-equivalence.test.ts` and `editor-equivalence.test.ts`: the extensions run on TS files with the core rules' options.

**Opt-in** (D1): `canonical-list.test.ts` "defines the owner's rulesets, in the owner's order…" gains `optIn: false` per entry. What it tests is unchanged.

---

## For each agent

**Developers (each lane).**
- Read the pattern table first.
- Decided:
  - git always gets argv arrays.
  - Rule names come from the catalog.
  - Every refusal names what to fix.
  - Every user-facing text lives in one module per command, verbatim as above.
  - `buildEslintConfig` and `buildOxlintConfig` stay pure.
  - The agent set never reads team configs.
  - `check` reports and never fixes.
- Why the temp config sits beside `agents-inc.lint.mts`: rooted globs only match there. Absolute globs fixed `files` but not `ignorePatterns`, and `--ignore-pattern` fixed ignores but not overrides (research).

**Testers.**
- Factories, not inline data. Pin each refusal beside an allowed case. Compare members with `toStrictEqual`.
- A known gap is `it.fails` with the strict assertion, and the tool runs in `beforeAll`.
- Integration tests load the built `dist`: rebuild first.
- **Known gap to pin (D):** with suppressions allowed, `/* eslint-disable house/no-suppressions */` turns blanket mode off for the rest of its file. unicorn has the same gap today.

**Reviewer.** Check that:
- No path in `check` can exit 0 after a crash.
- No temp file survives any exit.
- No git write happens and the project's configs are never loaded.
- `init` changes exactly two files.
- No rule is named in code.
- The resolver stays out of the `index` and `oxlint` entries.
- One deliberate break per new branch is re-run on the exact config it writes (CLAUDE.md Tests).

---

## Owner questions

Each has options, what the build does meanwhile, and a recommendation.

### `check`

- **Q-C1. What is the command called?** Agents would type `npx agents-inc-lint check`.
  - Options: `agents-inc-lint`; `lint-rules`; another name.
  - Meanwhile: `agents-inc-lint`. **Recommend it:** a generic name can collide with other packages' commands. With one command in the package, `npx @agents-inc/lint-rules check` works too.
- **Q-C2. Exit codes:** 0 clean, 1 findings, 2 could not run, 130/143 interrupted.
  - Meanwhile and **recommended:** as listed.
- **Q-C3. Warnings** (rules you set to `warn`).
  - Options: listed after errors without failing the run; or failing it.
  - **Recommend listing them without failing.**
- **Q-C4. What a finding looks like:** `src/a.ts:12 rule — message`. No column. Paths relative to the folder with `agents-inc.lint.mts`. Errors, then warnings. The summary wording is drafted above.
  - Alternative: paths relative to where `check` ran.
  - **Recommend as drafted.**
- **Q-C5. Should long output be cut?** The gate showed every finding (2026-09-11). Claude Code once showed an agent only part of a 42,600-character output, with the middle missing.
  - Options: cut at about 8,000 characters with "+N more, fix these and run again"; cut, plus write the full list to a file outside the repo; no cut.
  - Meanwhile: cut, with no file. **Recommend that:** agents re-run anyway.
- **Q-C6. Where does `check` look for `agents-inc.lint.mts`?**
  - Options: the nearest one from the current folder up to the repo root, skipping changed files outside it with a note; or the repo root only.
  - **Recommend the nearest.** In a monorepo with one config per package, the agent runs `check` from each package it changed.
- **Q-C7. A file moved with plain `mv`.** By your rule, the moved file is new, so every old finding in it is reported to an agent that only moved it. `git mv` is already handled.
  - Options: keep your rule; or pair moves the way the gate does, through a temporary git index, with no change to the real one.
  - Meanwhile: your rule. **Recommend pairing:** an agent should not inherit a file's old findings.
- **Q-C8. A repo with no commits:** every file counts as changed. **Recommend yes.**
- **Q-C9. A finding spanning lines** counts by its first line. One with no line counts only in a new file. **Recommend yes.**
- **Q-C10. A syntax error** in a changed file is always reported, once, as a failure. **Recommend yes.**
- **Q-C11. Autofix:** none; `check` only reports. **Recommend none for now.** The gate measured about half its findings as mechanical, if you want it later.
- **Q-C12. Type-check or formatter steps:** none ("only our rules"). **Recommend none.**
- **Q-C13. The one-line log of each run.**
  - Options: under `~/.local/state/agents-inc-lint/`, one file per repo; or a path the benchmark harness sets through an environment variable.
  - Meanwhile and **recommended:** the first. An environment variable is a new setting you would have to name.
- **Q-C14. An agent edits `agents-inc.lint.mts`**, for example to switch a rule off.
  - Options: a one-line note; fail the run; nothing.
  - Meanwhile: the note. **Recommend the note,** plus "never edit it" in the agent instructions.
- **Q-C15. Unused suppressions** (only where you allow suppressions). Message: `suppresses <rule>, which reported nothing here`, as an error.
  - Meanwhile: built only if the oxlint half proves possible (Lane K part 3). **Recommend as drafted.**
- **Q-C16. A wrong call** (`check --help`, `check foo`, no command) prints usage and exits 2. **Recommend yes.** No flags means `--help` is no exception.
- **Q-C17. Rulesets a new release adds are off until listed.** plan.md says someone should tell the team.
  - Options: `check` prints a note when the config lists fewer rulesets than exist; or nothing for now.
  - Meanwhile: nothing. **Recommend nothing:** agents cannot act on it, and it costs tokens every run.

### `init`

- **Q-I1. `agents-inc.lint.mts` already exists.**
  - Options: refuse and change nothing (exit 1); overwrite; merge.
  - **Recommend refusing.**
- **Q-I2. No `package.json` in the folder:** refuse, exit 2. **Recommend yes.**
- **Q-I3. The lines for the agents' instructions** (open in plan.md).
  - Options: print them to paste; or write them into `CLAUDE.md`, `AGENTS.md` or `.claude/agents/*`, which would be a third file.
  - Meanwhile and **recommended:** print. Draft, with the runner matching the package manager:
    > After changing code, run `npx agents-inc-lint check` with no arguments. Exit 0: done. Exit 1: fix every finding in code you wrote, then run it again; when only findings in code you did not write remain, you are done. Exit 2: stop and report its output. Never add a suppression comment, and never edit agents-inc.lint.mts.
  - The "only findings in code you did not write" clause is new. Without it, an agent whose neighbour is mid-edit can never reach exit 0, because `check` filters nothing.
- **Q-I4. The package is already listed:** keep its version. **Recommend yes.**
- **Q-I5. The install:** print the command; do not run it, since that changes the lockfile and `node_modules`. **Recommend printing.**
- **Q-I6. The file's text.** Default: plan.md's template, with the agent set filled from data and these comments:
  - above the agent set: `// What \`check\` runs on the lines sub-agents change.`
  - above the editor set: `// What people's editors show once your team merges it into its own lint configs: add rulesets here.`
  - an opt-in ruleset: `// Opt-in, so not listed: '<name>'`
  - `languages: []` with no comment.

  **Recommend this.** Say if you want other wording.
- **Q-I7. What `ignores` starts with.**
  - Options: `[]`; or the gate's list (`dist`, `build`, `coverage`, `*.d.ts`, `*.gen.ts`, `.next`, `*.min.js`).
  - Meanwhile: `[]` as plan.md shows. **Recommend `[]`:** `check` only sees changed files, and those folders are usually gitignored.
- **Q-I8. Outside a git repo:** write the files and warn. **Recommend yes.**
- **Q-I9. A team without Node's types.** Research measured that `import.meta.dirname` is a type error in a team's own `tsc` when the tsconfig takes in root `.mts` files and the project has no `@types/node`.
  - Options: keep the line (plan.md's); or have `init` say so when `@types/node` is missing.
  - **Recommend keeping it** and adding a note to the printed output.

### Rule changes

- **Q-R1. #22: your house rule mode, or a data-only change?** Research found that oxlint's own `unicorn/no-abusive-eslint-disable` reports every blanket form (30 of 30). Only ESLint's version misses them, and that is the one we run.
  - The other option: move that rule to oxlint, with no new house code. Teams without oxlint would miss only `/* eslint-disable , */`. For them, the line form and the oxlint forms silence nothing anyway.
  - Meanwhile: your choice (Lane D builds it last). **Recommend the data-only move:** the same coverage, no new rule code, and no undocumented reporting trick.
- **Q-R2. #23: which ruleset holds `require-class-helper`?**
  - Options: `conventions` (consistency rules); `correctness` (for the "undefined" class bug, a small share of reports); opt-in.
  - **Recommend `conventions`.**
- **Q-R2b. #23: calls to cva-made functions** (`buttonVariants(…)`, 18 reports in research's corpus).
  - Options: keep reporting them (as decided); or accept names ending in `Variants`.
  - **Recommend accepting `*Variants` calls:** they are the likely false positives left.
- **Q-R3. #33: which rules start running without oxlint?**
  - Options: four (`namespace`, `no-cycle`, `no-named-as-default`, `no-self-import`); or all six.
  - On cv-launch, `default` and `no-named-as-default-member` reported 27 and 37 findings in ESLint, against 0 and 2 in oxlint.
  - Meanwhile and **recommended:** four.
- **Q-R4. #33: keep `import-x/no-rename-default`?** With the fix, most of its reports here are about npm packages' compiled default exports (`_default` as `tseslint`).
  - **Recommend dropping it.** The fix also makes ESLint's six import rules about twice as slow on cv-launch, and faster here. Accept that?
- **Q-R5. Keep shipping `@typescript-eslint/only-throw-error` on its own, beside `no-throw-literal`?**
  - Options: keep, so each can be turned off alone (the typed files still get one report); or drop it, so `no-throw-literal` controls both.
  - **Recommend keeping it.**
- **Q-R6. `consistent-return` and `no-implied-eval` ship only as typescript-eslint's typed versions**, so JS files and TS files outside every tsconfig get no check.
  - Options: also ship the core rules, split by type information; or leave.
  - Meanwhile: leave. **Recommend shipping both** (a candidate decision, so it is yours).
- **Q-R7. Teams on ESLint 9 using the editor merge.** Once ESLint is our own dependency (your call), npm no longer warns them, and the merge is unmeasured on ESLint 9.
  - Options: test it in the real run and decide then; or refuse ESLint below 10 in the merge with a clear error.
  - **Recommend testing first.**

---

## Ruleset round 2 proposals

You said: "We don't want any duplicated reports." Each row below is one decision. The evidence is under `scratchpad/round2/`:
- counts: `out/overlap.tsv`
- probe IDs (P1a, T1a, …): `out/probe-agent-full.txt`, `react2.txt`, `misc.txt`, `thisp.txt`, `esc.txt`
- autofix runs (c01–c18, n2–n4): `out/`

I re-derived every rule's engine and ruleset from `rules.json` (Commands). These are proposals only; nothing changes before your verdict.

Engines are written (ox) for oxlint and (es) for ESLint. Each rule's ruleset is shown only where the two differ.

**Two ways out need your OK first**, because they are new:
- **S, "covered by":** where a narrow rule's ruleset and a broader rule's ruleset are both on, the build leaves the narrow one out. A team that removes the broader ruleset still gets the narrow rule. *Do you approve S?*
- **T, "split by type information":** the typed rule where types exist, the untyped one elsewhere. This is the split you approved for core rules (C4), extended to any recorded pair. *Do you approve T?*

Where neither fits and both rules catch something the other misses, **a double stays** unless you pick a loss. Those rows say so.

### React

| # | The problem, and an example | Rules | Proposal | Alternative |
| --- | --- | --- | --- | --- |
| D1 | List item without `key`: `items.map(i => <li>{i}</li>)` (P1a) | react/jsx-key (ox) · @eslint-react/x-no-missing-key (es) | Drop react/jsx-key: only @eslint-react's catches a keyless `<>…</>` (P1b) | Drop @eslint-react's (oxlint is faster; the fragment case is lost) |
| D2 | A `// comment` written as JSX text: `<div>// x</div>` (P24a) | react/jsx-no-comment-textnodes (ox) · @eslint-react/jsx-no-comment-textnodes (es) | Drop @eslint-react's: same catches, and a tie goes to oxlint | Drop react/'s |
| D3 | setState in componentDidMount/DidUpdate/WillUpdate (P2a) | react/no-did-mount-set-state, no-did-update-set-state, no-will-update-set-state (ox) · @eslint-react/x-no-set-state-in-component-did-mount, -did-update, -will-update (es) | Drop the three react/ rules: they also flag setState inside a `setTimeout` callback, which is fine (P2c; measured for didMount only) | Drop the @eslint-react three |
| D4 | Old lifecycle methods: `UNSAFE_componentWillMount(){}` (P3a) | react/no-unsafe (ox) · six @eslint-react `x-no-component-will-*` and `x-no-unsafe-component-will-*` (es) | Keep react/no-unsafe with `checkAliases: true` (it then flags old and `UNSAFE_` names; measured in oxlint); drop the six. Also settles round-1 #15 | Keep the six (their rename fix trips each other) |
| D5 | Unused method in a class component (P15a) | react/no-unused-class-component-methods · @eslint-react/x-no-unused-class-component-members (both es) | Drop react/'s (a tie; @eslint-react needs no compat layer) | Drop @eslint-react's |
| D6 | A component defined inside a component, four reports (P4a) | react/no-unstable-nested-components (ox) · @eslint-react/x-no-nested-component-definitions, x-static-components, x-no-nested-lazy-component-declarations (es) | Keep the nested-definitions and nested-lazy rules. Drop x-static-components (it reports each case twice: where the component is made and where it is used). Drop react/'s (it misses `flag ? () => … : () => …`) | Keep react/'s only, losing the ternary case |
| D7 | An object literal as a default prop `({ o = {} })` (P5a–c) | react/no-object-type-as-default-prop (ox) · @eslint-react/x-no-unstable-default-props (es) | Drop @eslint-react's (a tie) | Reverse |
| D8 | `dangerouslySetInnerHTML` together with children | react/no-danger-with-children (ox) · @eslint-react/dom-no-dangerously-set-innerhtml-with-children (es) | Drop @eslint-react's (a tie) | Reverse |
| D9 | Children on a void element `<img>x</img>` | react/void-dom-elements-no-children (ox) · @eslint-react/dom-no-void-elements-with-children (es) | Drop @eslint-react's (a tie) | Reverse |
| D10 | A new object as a context value `<Ctx.Provider value={{ a: 1 }}>`, three reports (P8a) | react/jsx-no-constructed-context-values (ox) · @eslint-react/x-no-unstable-context-value (es) · react-perf/jsx-no-new-object-as-prop (ox) | Drop @eslint-react's: react/'s also catches `value={new Map()}` and React 19's `<Ctx value>` (P8b); one gate case is lost. **A double stays:** react/ and react-perf on literals, with no option that separates them | Also drop react-perf/jsx-no-new-object-as-prop, so object literals passed to ordinary props go unreported |
| D11 | iframe with no sandbox `<iframe src="x"/>` (P9a/b) | react/iframe-missing-sandbox (ox) · @eslint-react/dom-no-missing-iframe-sandbox, dom-no-unsafe-iframe-sandbox (es) | Drop react/'s: @eslint-react's also catch `src={fileUrl}` | Drop @eslint-react's |
| D12 | `href="javascript:…"`, three reports (P10a) | react/jsx-no-script-url (ox, security) · @eslint-react/dom-no-script-url (es, security) · jsx-a11y/anchor-is-valid (ox, accessibility) | Drop react/jsx-no-script-url: dom-no-script-url also catches `<iframe src="javascript:">` (P10b). **A double stays** with anchor-is-valid, whose check also covers `href="#"` | Also drop anchor-is-valid, losing `#` |
| D13 | `children` passed as a prop and as children | react/no-children-prop (ox) covers @eslint-react/jsx-no-children-prop-with-children (es) | Drop @eslint-react's | — |
| D14 | `{count && <X/>}` rendering `0` (P14a) | react/jsx-no-leaked-render (es) · @eslint-react/x-no-leaked-conditional-rendering (es, needs types) | Drop react/'s: it also flags a boolean `{open && <X/>}`, which is fine (P14b). Cost: JS files and files outside every tsconfig lose the check | T split |
| D15 | `style="color:red"` (A7) | react/style-prop-object (ox) · @eslint-react/dom-no-string-style-prop (es) | Drop react/'s: @eslint-react's sees through `as` | Reverse |
| D16 | Misspelt `aria-labeledby` (P17a) | jsx-a11y/aria-props (ox, accessibility), covered by @eslint-react/dom-no-unknown-property (es, react) | S | Keep both (double): its `ignore` option takes exact names only |
| D17 | `eval` in a component (P25a) | no-eval (ox, security) · @eslint-react/x-unsupported-syntax (es, react) | Keep both. **A double stays** on `eval`; x-unsupported-syntax also flags IIFEs in JSX | Drop x-unsupported-syntax |
| D18 | A class component, four reports (P12a) | functional/no-classes covers functional/no-class-inheritance (both declarative); no-classes covers @eslint-react/x-no-class-component (react), which covers react/prefer-stateless-function | Drop no-class-inheritance and prefer-stateless-function (its one extra is `createReactClass`); S for no-classes over x-no-class-component | Keep all four |
| D19 | `onClick={f.bind(null)}` (c16) | react-perf/jsx-no-new-function-as-prop (ox) · react/jsx-no-bind (es) | Keep both, with jsx-no-bind `allowBind: true`; jsx-no-bind alone flags a function made in render and passed by name. The option is not measured yet. Settles round-1 #16 | Leave the double on `.bind` |
| D20 | setState in an effect `useEffect(() => { setV(value + '!') }, [value])` (F1) | react-hooks/set-state-in-effect (ox) · you-might-not-need-an-effect's no-derived-state, no-initialize-state, no-adjust-state-on-prop-change, no-chain-state-updates (es) | Drop set-state-in-effect: over 12 shapes and the gate it never fired alone, and the others name the fix and catch indirect setState. Against: it is React's own rule. Corpus false positives were not measured | Drop the four |
| D21 | A conditional hook (P29a) | react-hooks/rules-of-hooks · react-hooks/hooks (both ox) | Asked again: you kept both on 2026-10-10 (each catches what the other misses), at the price of a double on the common case | Drop one, losing its extras |
| D22 | A comment suppressing a hooks rule while suppressions are banned | house/no-suppressions · react-hooks/rule-suppression (ox) | `allowSuppressions` also sets rule-suppression: off while banned, on while allowed. `rules` can then no longer name it, like the other suppression rules | Keep both |
| D23 | Every banned suppression also gets ESLint's own "has no effect" warning | ESLint itself · house/no-suppressions | Settled by `check`, which leaves ESLint's own notices out (Lane K) | Show them |
| D24 | A component assigning a module variable: `let n = 0; function C() { n = n + 1 }` | react-hooks/globals (ox, react), covered by unicorn/no-top-level-assignment-in-function (es, immutability) | S | Drop globals |
| D25 | Mutating props: `props.box.n = 1` (P31a) | react-hooks/immutability (ox, react), covered by functional/immutable-data (es, declarative) | S | Keep both |
| D30 | React Hook Form's `watch()` | react-hooks/incompatible-library (ox, react) · react-hook-form/no-use-watch (es, react-hook-form) | Keep both. **A double stays** (each catches what the other misses) | Drop one |

### Accessibility

| # | The problem | Rules | Proposal | Alternative |
| --- | --- | --- | --- | --- |
| D26 | `<button aria-hidden="true">` (A1–A5) | house/no-focusable-content-in-aria-hidden covers jsx-a11y/no-aria-hidden-on-focusable | Drop jsx-a11y's: house also catches a focusable child (A5) | — |
| D27 | `<html>` with no `lang` (P19a) | jsx-a11y/lang covers jsx-a11y/html-has-lang (in oxlint) | Keep both until the post-fallback re-run: ESLint's `lang` misses a missing lang, so dropping html-has-lang hurts teams without oxlint | Drop html-has-lang |
| D28 | `<a href="/x"/>` with no content | jsx-a11y/control-has-associated-label covers anchor-has-content | Drop anchor-has-content | — |
| D29 | `<object data=…/>` with no alt | jsx-a11y/alt-text covers sonarjs/object-alt-content | Drop sonarjs's | — |

### TypeScript, JavaScript and promises

| # | The problem | Rules | Proposal | Alternative |
| --- | --- | --- | --- | --- |
| D31 | `throw 'failed'` (T1a) | no-throw-literal · @typescript-eslint/only-throw-error | Settled by Lane E2 | — |
| D32 | `` `${'a'}b` `` (T2a) | @typescript-eslint/no-unnecessary-template-expression (types) · unicorn/no-useless-template-literals | T | Keep the TS rule only (JS loses it) |
| D33 | `flag === true` (T3a) | no-unnecessary-boolean-literal-compare (types) · unicorn/no-unnecessary-boolean-comparison | T | Drop unicorn's (JS loses it) |
| D34 | `String(text)` on a string (T4a) | no-unnecessary-type-conversion (types; also catches `!!flag`) covers unicorn/no-useless-coercion | T | Drop unicorn's |
| D35 | An index `for` loop, three reports (L1a) | house/no-classic-loops (declarative) covers unicorn/no-for-loop and @typescript-eslint/prefer-for-of, which are the same rule (modern-js); house covers guard-for-in and no-for-in-array (correctness) | Drop prefer-for-of (unicorn's autofixes); S for the rest under house | Keep |
| D36 | `maybe?.v!` (T5a–d) | no-non-null-assertion (type-safety) covers no-non-null-asserted-optional-chain, no-confusing-non-null-assertion (correctness), no-extra-non-null-assertion (redundancy), no-non-null-asserted-nullish-coalescing (type-safety) | Drop the nullish-coalescing one (same ruleset); S for the other three | Keep |
| D37 | `void sideEffect()` (T6a) | no-void covers no-meaningless-void-operator | Goes away with round-1 #14's fix | — |
| D38 | `` `${obj}` `` (T7a) | restrict-template-expressions · no-base-to-string | Keep both. **A double stays** (no option separates them) | Drop one |
| D39 | `return await count` (T8a) | await-thenable · return-await | Keep both. **A double stays** | Drop one |
| D40 | `Promise.all([await p])` (T27a) | await-thenable (types) covers unicorn/no-await-in-promise-methods | T | Drop unicorn's (JS loses it) |
| D41 | `if (true)` (T9a) | no-unnecessary-condition (types, redundancy) covers no-constant-condition (correctness) | T | S |
| D42 | `x === {}` (T9d) | no-constant-binary-expression covers oxc/bad-object-literal-comparison | Drop the oxc rule | — |
| D43 | `-text` (T10a) | sonarjs/non-number-in-arithmetic-expression covers no-unsafe-unary-minus | Drop the TS rule | — |
| D44 | `(): any` (T11a) | no-explicit-any covers sonarjs/no-return-type-any | Drop sonarjs's | — |
| D45 | `class lowerThing` | naming-convention covers sonarjs/class-name | Drop sonarjs's | — |
| D46 | `text.substr(1)` (T24a–c) | no-deprecated (types, modern-js) · unicorn/prefer-string-slice, prefer-string-trim-start-end (modern-js), prefer-keyboard-event-key (browser), regexp/no-legacy-features (modern-js), n/no-deprecated-api (node) | no-deprecated gets an `allow` list of those APIs; the specific rules autofix and need no types. Caveat: without the browser or node ruleset, those APIs go unreported | Leave the doubles |
| D47 | `new Promise.resolve(1)`, three reports (R1f) | unicorn/no-nonstandard-builtin-properties covers regexp/no-legacy-features; overlaps no-extend-native, promise/no-new-statics, sonarjs/new-operator-misuse | Drop regexp/no-legacy-features; keep promise/no-new-statics (autofix); sonarjs/new-operator-misuse is your call | — |
| D48 | `resolve(1); resolve(2)` (R1a) | promise/no-multiple-resolved (ox), covered by unicorn/no-multiple-promise-resolver-calls | Drop the promise one (it misses the plain case) | — |
| D49–51 | `s.charAt(0) === 'ab'`; `t += t + n`; `x * 0` | oxc/bad-char-at-comparison = unicorn/no-invalid-character-comparison; oxc/misrefactored-assign-op = unicorn/no-misrefactored-assignment; oxc/erasing-op = unicorn/no-constant-zero-expression | The oxc rule beside oxlint; the unicorn rule only without oxlint, the stand-in you chose for two other oxc rules | Drop the unicorn rules, leaving teams without oxlint no check (research's proposal; see Corrections) |
| D52 | `s.matchAll(/a/u)` | regexp/no-missing-g-flag covers oxc/bad-match-all-arg, bad-replace-all-arg | Drop both oxc rules (regexp's autofixes) | — |
| D53 | `import {} from 'x'` | unicorn/require-module-specifiers · import-x/no-empty-named-blocks · @typescript-eslint/no-useless-empty-export | Drop unicorn's: it flags `export {}`, which marks a file as a module | — |
| D54 | `.then(v => v + 1)` (R1b) | unicorn/prefer-await covers promise/prefer-await-to-then | Drop the promise one | — |
| D55 | A call split across a line, `use\n(1)` | no-unexpected-multiline = sonarjs/call-argument-line | Drop sonarjs's | — |
| D56 | `.map(v => { v + 1 })` | array-callback-return = sonarjs/array-callback-without-return (types) | Drop sonarjs's | — |
| D57 | `if (b = a)` | sonarjs/no-nested-assignment (complexity) covers no-cond-assign, no-return-assign (correctness) | S | Keep |
| D58 | `'http://…'` | unicorn/prefer-https · sonarjs/no-clear-text-protocols (security) | Keep both. **A double stays** | Drop one |
| D59 | `require('scheduler')` not in package.json | import-x/no-extraneous-dependencies covers n/no-extraneous-import, n/no-extraneous-require | Drop both n/ rules; re-check workspace packages after E1 | — |
| D80 | `f.apply(null, [1])` (c07b) | no-useless-call (ox) · unicorn/prefer-reflect-apply | Drop prefer-reflect-apply: its fix writes `Reflect.apply(…)`, hiding the simpler `f(1)` (round-1 #7, as it now stands) | — |

### Regex, tests, declarative style

| # | The problem | Rules | Proposal | Alternative |
| --- | --- | --- | --- | --- |
| D64–66 | `/[^\d]/u` and two other shapes | regexp/prefer-d × negation; no-misleading-capturing-group × optimal-quantifier-concatenation; no-invalid-regexp covers regexp/no-non-standard-flag | Drop regexp/no-non-standard-flag. **Doubles stay** for the other two | — |
| D67 | A non-breaking space in a regex (without oxlint) | no-irregular-whitespace · regexp/no-invisible-character | The core rule gets `skipRegExps: true` | — |
| D68 | `/\x41/u` | unicorn/no-hex-escape (deprecated) · prefer-unicode-code-point-escapes | Keep both until you decide prefer-literal-ascii, then drop no-hex-escape | — |
| D69 | `a ? 1 : b ? 2 : 3` | sonarjs/no-nested-conditional covers unicorn/no-nested-ternary | Drop unicorn's (its fix does not satisfy sonarjs; round-1 #8) | — |
| D60 | `screen.debug()` | sonarjs/no-debug-commands-in-ui-tests (tests) covers testing-library/no-debugging-utils | S | — |
| D61 | `expect(p).resolves.toBe(1)` not awaited (X1d) | vitest/valid-expect covers sonarjs/async-test-assertions | Drop sonarjs's (chai's `eventually` not measured) | — |
| D62 | `waitFor(…)` not awaited | no-floating-promises · testing-library await-async-utils, -queries, -events, vitest/valid-expect, storybook/await-interactions | no-floating-promises gets `allowForKnownSafeCalls` for those calls; await-async-events ignores stories | — |
| D63 | `@testing-library/dom` imported in a story | storybook/use-storybook-testing-library · testing-library/no-dom-import | no-dom-import ignores story files (storybook's fix satisfies both). Settles round-1 #18 | — |
| D70 | An unused local with a computed value | no-unused-vars (ox) · sonarjs/no-dead-store | Keep both. **A double stays** (dead-store alone catches overwritten values) | Drop dead-store |
| D71 | `catch (error)` with `error` unused | no-unused-vars covers unicorn/prefer-optional-catch-binding | no-unused-vars gets `caughtErrors: "none"` (works in oxlint 1.87) | — |
| D72 | `new Date()` as a statement | functional/no-expression-statements covers no-new, no-unused-expressions | S | — |
| D73 | A class with only static members | functional/no-classes covers no-extraneous-class | S | — |
| D74 | `a.sort()` | functional/immutable-data · unicorn/no-array-sort, no-array-reverse, no-array-front-mutation | S | Keep |
| D75 | `let x = 1`, never reassigned | functional/no-let covers prefer-const | S (loses prefer-const's autofix where declarative is on) | Keep |
| D76 | `default` first in a `switch` | perfectionist/sort-switch-case covers default-case-last | Drop default-case-last | — |
| D77 | Top-level `this` (W6) | functional/no-this-expressions covers unicorn/no-this-outside-of-class, which covers no-invalid-this | Drop unicorn's (its extras are object-literal methods, a false positive, and capitalised functions); S for no-this-expressions | — |
| D78 | A mutable props type | functional/prefer-immutable-types · react/prefer-read-only-props | S | Keep |
| D79 | `x < x` | oxc/const-comparisons · sonarjs/no-identical-expressions | Keep both. **A double stays** | — |

### Round-1 conflicts (critique §5), re-checked, and new ones

| # | What happens | Proposal | Alternative |
| --- | --- | --- | --- |
| §1 | Tail recursion: unicorn/no-useless-recursion wants a loop, and house/no-classic-loops bans it (c01) | Drop no-useless-recursion | Accept |
| §3 | `l.splice(0, 1)`: no-unnecessary-splice's fix writes `shift()`, which no-array-front-mutation flags (c03) | Drop no-unnecessary-splice | Accept |
| §4 | `.replace(/a/gu,'x').replace(/b/gu,'x')`: prefer-single-replace's fix drops the `u` flag require-unicode-regexp wants (c04) | Drop prefer-single-replace | Accept |
| §5 | `useEffect(function () {…})`: prefer-arrow-callback's fix makes an arrow, and house/named-hook-callback then reports it (c05) | Accept: naming the function satisfies both | — |
| §6 | `F.prototype.m = …`: sonarjs/class-prototype asks for a class, and functional/no-classes bans one (c06) | Accept (a factory function satisfies both) | Drop class-prototype |
| §10 | `{ b: 1, a, g: 2, d }`: sort-objects' fix splits the shorthand group sonarjs/shorthand-property-grouping wants (c10) | Drop shorthand-property-grouping | — |
| §11 | `static f() { return K.x }`: class-reference-in-static-methods asks for `this`, and no-this-expressions bans it (c11) | `preferThis: false` | — |
| §12 | `reduce((a, k) => ({ ...a, [k]: 1 }), {})`: oxc/no-accumulating-spread's advice is banned by immutable-data (c12) | Accept: prefer-object-from-entries' fix satisfies all three | — |
| §14 | `save()` / `void save()`: no-floating-promises asks for `void`, and no-void bans it (c14) | no-void `allowAsStatement: true` | no-floating-promises `ignoreVoid: false` |
| §17 | Error boundaries must be classes; no-classes, no-class-inheritance and no-this-expressions flag them (c17) | `ignoreCodePattern` on the first two (not measured); no-this-expressions has no options, so file ignores or accept | — |
| §7, §8, §15, §16, §18 | Now D80, D69, D4 (+N4), D19, D63 | — | — |
| N1 | sonarjs/prefer-while and unicorn/prefer-while-loop-condition autofix into a `while` that house/no-classic-loops bans (n2) | S under house | Drop both |
| N2 | preserve-caught-error (ox) adds `{ cause }`; unicorn/prefer-optional-catch-binding (es) removes the binding. With ESLint fixing first, the cause is lost and nothing reports it (n4, n4-ef). This matters only where fixes are applied (editors) | Accept for now (`check` does not fix) | Drop prefer-optional-catch-binding |
| N3 | react/prefer-es6-class asks for a class, which x-no-class-component and no-classes ban | Drop prefer-es6-class | — |
| N4 | sonarjs/function-name flags React's `UNSAFE_*` methods: its format allows no underscore after the first letter | Allow a leading `UNSAFE_` in its format | — |
| N5 | check-file/folder-naming-convention flags Next.js route groups `src/(group)/` (found by the `check` research) | Allow `(` and `)` in folder names | Keep |

Not covered here: critique §4 (ambiguous ruleset assignments) and corpus false-positive rates. The fallback numbers predate Lane B; re-run them after the running build lands.

---

## Corrections

1. **Brief, "the current build does this [typescript-eslint preference] for teams without oxlint":** at research time C4 existed only in tests. By 18:38, Lane C was writing it into `build-eslint-config.ts`. It lands with the running build, not before it.
2. **Brief, #22, "which oxlint reads as a whole-file disable":** oxlint disables from the comment to the end of the file. A `debugger` above it is still reported (research, measured). questions.md #22's "unicorn doesn't flag it" holds only for ESLint's unicorn; oxlint's flags every blanket form.
3. **Brief, "brings its own ESLint and oxlint (dependencies, not peers)":** decided, not applied. `packages/lint-rules/package.json` still lists both as peers. The oxlint merge reads our oxlint *peer* range (`refuseOxlintOutsideOurPeerRange`), so the move breaks it unless the third-sweep oxlint item lands first (Lane M2).
4. **Brief scope:** decisions.md's third sweep (jsx-a11y-x, modern-js off, unicorn stand-ins, no version refusal) says it lands "with the next batch", but the brief leaves it out. Placed under [Where this batch starts](#where-this-batch-starts), not specified.
5. **Research, round 2 D49–D51:** "drop the unicorn rule" would leave teams without oxlint with no check, because the oxc rules have no ESLint version. Corrected to the stand-in proposal.
6. **questions.md #33:**
   - The fix does not cover workspace packages.
   - 6 of the 12 oxlint-run rules do run without oxlint (`named` with 35 false positives on cv-launch).
   - `no-cycle` was faster, not slower.
   - `project: tsconfigRootDir` misses per-package aliases.
   - Its scratch harness path no longer exists.
7. **questions.md #35:** the `jsx-no-comment-textnodes` pair doubles in the agent set too, not only without oxlint.
8. **Research's #23 figures** drifted rather than being wrong (the corpus grew).
9. **Research's own correction** that `consumer-usage-design.md` §3 is not history only: confirmed; plan.md links it as the proposal.

Nothing else in the brief proved false.

## Docs this makes false (step 8, same turn)

- **plan.md:**
  - Decisions "Suppression comments" (unicorn's role).
  - The "proposed: eslint and oxlint are still peers" paragraph.
  - The sections "`init` (proposed)" and "The runner".
  - Open: flags, #22, #23, #33, round 2.
  - Add Corrections rows.
- **architecture.md:**
  - The packages row ("eslint and oxlint are peers").
  - Step 4 (settings).
  - A short new flow for `check` (it is a crucial flow).
- **questions.md:** #6, #22, #23, #33, #35 answered. The new owner questions above, where new.

## Commands

From the repo root unless noted.

```sh
# core rules we ship with a current typescript-eslint extension (E2's set)
jq -r --slurpfile inv packages/rule-data/src/generated/inventory.json '($inv[0].rules | map(select(.eslint != null and .eslint.extendsCoreRule != null and (.eslint.deprecated|not))) | map({key:.eslint.extendsCoreRule, value:{ext:.id, typed:.eslint.typed}}) | from_entries) as $ext | (map({key:.id,value:.})|from_entries) as $s | .[] | select($ext[.id]!=null) | "\(.id) \(.engine) \(.ruleset) -> \($ext[.id].ext) typed=\($ext[.id].typed) extShipped=\($s[$ext[.id].ext]!=null)"' packages/rule-data/data/rules.json
# import-x rules by engine
jq -r '.[] | select(.id|startswith("import-x/")) | "\(.engine) \(.id)"' packages/rule-data/data/rules.json | sort
# round 2: every rule's engine and ruleset (list in the scratch file)
jq -r --rawfile ids <scratch>/pm-next-batch/ids.txt '($ids | split("\n") | map(select(length>0))) as $want | (map({key:.id,value:.})|from_entries) as $s | $want[] | . as $id | if $s[$id] then "\($id)\t\($s[$id].engine)\t\($s[$id].ruleset // "alwaysOn")" else "\($id)\tNOT-SHIPPED" end' packages/rule-data/data/rules.json
# the empty tree for a repo with no commits
git hash-object -t tree /dev/null
# Node for the floor test
/usr/bin/node --version
# suites
bun run build && bun run typecheck && bun run test
bun run --cwd packages/rule-data generate
```

- **oxlint's rooted globs depend on the config's folder (measured here):**
  - Write the same config (`ignorePatterns: ["src/generated/**"]`) into the project folder and into another folder.
  - In the project, run `node node_modules/oxlint/bin/oxlint -c <config> --format json src/a.ts src/generated/gen.ts`. Only `src/a.ts` is reported from the project folder; both are reported from the other folder.
  - A config naming an unknown plugin exits 1, with "Failed to parse oxlint configuration file" on stdout and nothing on stderr.
- **Research's commands** are in their reports:
  - `check-research/tools/check-proto.mjs <projectDir> [tmp|root]`
  - `research-22-23-33-ts/scripts/{write-suppress-cases,run-eslint,summarise-suppress,measure-class-helper,probe-mono,summarise-eslint}.mjs`
  - `round2/scripts/{measure.mjs,analyze.py,overlap.py,fixloop.mjs,show_probe.py}`, with the hash check `sha256sum -c round2/out/hashes-start.txt`

## Addendum: the owner's third sweep

Drafted 2026-10-11 by pm, read-only. Source: decisions.md, the entry "Owner 2026-10-11 (questions page, third sweep)". It adds four changes to the lanes above. Every fact below was re-derived at about 19:00. The running build (`wf_ec970377-570`) edited `src/core/installed-oxlint.ts` at 18:51 and again at 19:00 while I read it. Its behaviour was the same both times: a version-range check first, then the name check against the schema. Re-read the file when that build lands. Evidence scripts are in `scratchpad/pm-third-sweep/`, which may be deleted. Each script is listed under [Third-sweep commands](#third-sweep-commands).

### What changes for a user

- **jsx-a11y in ESLint now comes from `eslint-plugin-jsx-a11y-x`.** This fork accepts ESLint 10 and keeps the same `jsx-a11y/…` rule names. Installing stops warning about jsx-a11y's ESLint range. The fork dropped three deprecated rules (`jsx-a11y/accessible-emoji`, `jsx-a11y/label-has-for`, `jsx-a11y/no-onchange`), so `rules` can no longer set them.
- **Eight modern-js rules stop running.** Their fixes write code that needs APIs Node 22 lacks. `rules` can still turn any of them on.
- **Without oxlint, the editor ESLint part runs two unicorn stand-ins.** `unicorn/no-chained-comparison` runs where `oxc/bad-comparison-sequence` would run, and `unicorn/no-double-comparison` where `oxc/double-comparisons` would. Findings carry the unicorn names.
- **`mergeOxlintConfig` no longer refuses an oxlint because of its version.** It refuses only when the installed oxlint's rule list lacks a name the merge writes, or when it has no rule list the merge can read. The refusal text names a version that works, not a range.
- `check` is unaffected by the last two changes, because it always runs its own oxlint.

### Who owns what (amends the lane lists; no file has two owners)

| File | Lane now | Before |
| --- | --- | --- |
| `packages/rule-data/package.json` | **M** | D ("all of packages/rule-data/"): carved out, so the lane that runs the install owns both manifests |
| `src/core/installed-oxlint.ts`, `src/merge-oxlint-config.installed-oxlint.test.ts` | **M** (M3) | no lane |
| `src/oxlint.ts` (call site and doc comment only), `src/core/package-json-files.ts` | **M** (M3) | no lane. K and I only import from `package-json-files.ts`; any change they need there is reported to M |
| `src/__tests__/factories/package-json-factories.ts` | **M** (M3) | no lane. I only imports from it |
| `src/core/editor-parts.ts` | **E** (E5) | no lane |
| `src/core/resolve-rule-layers.ts` and its test | **E**, only if E5 needs a helper there | no lane |
| `src/__tests__/eslint-versions.ts` and its test | **E** | no lane |
| New: `packages/rule-data/data/eslint-stand-ins.json` (suggested name), `packages/rule-data/src/eslint-stand-ins.test.ts` | D | — |
| New: a stand-in fixture index and fixtures in `test-fixtures/eslint-fallback/` | E | E already owns the folder |

Add these rows to the table under "Where this batch starts", because the running build also changes these files:
- M: `installed-oxlint.ts`, `oxlint.ts`, `package-json-files.ts`, `package-json-factories.ts`, `merge-oxlint-config.installed-oxlint.test.ts` (its lane C), and `packages/rule-data/package.json` (its lane B).
- E: `editor-parts.ts` (its lane A1), and `eslint-versions.ts` with its test (its lane B).

M now needs a tester and a developer, for M3.

### Order (replaces steps 1–5)

1. M1, which also adds the fork beside the original.
2. D1, E4 and K's exit codes. Also D6 (the registry swap) and D8 (stand-in data and the two catalog fields).
3. M4 (drop the original jsx-a11y) once D6 is green. Then K, I, E (with E5), D (with D7) and M3 in parallel.
4. D's #33 skip-list edit, after E1 is green on the fixtures (unchanged).
5. M2, after M3 is green.

Steps 6 and 7 are unchanged; the real-run cases (f)–(h) are added under the items below.

---

### Item 1: eslint-plugin-jsx-a11y-x in place of eslint-plugin-jsx-a11y

**Re-derived:**
- The fork is at 0.2.0, with an ESLint peer of `^9.0.0 || ^10.0.0`. The original 6.10.2 stops at `^9`.
- The fork's own docs register it as `jsx-a11y-x`.
- Its rules are the original's minus `accessible-emoji`, `label-has-for` and `no-onchange`. Every shipped `jsx-a11y/*` rule is among them.
- It is an ES module and ships its own type declarations.
- Its `meta.name` is `eslint-plugin-jsx-a11y-x`. The original's is `eslint-plugin-jsx-a11y`.
- No shipped or candidate rule is one of the three dropped rules. Every shipped jsx-a11y rule is oxlint-run, and none is on the fallback skip list.

**M1 (added):** add `eslint-plugin-jsx-a11y-x` 0.2.0, exact, to `dependencies` in both manifests, then run `bun install`. The original stays for now.

**D6:**
- `src/eslint-plugins.ts`: the `jsx-a11y` prefix holds the fork. Use `checkedPlugin` only if the fork's declarations do not fit `ESLint.Plugin`.
- `src/generate/eslint-plugin-package-names.ts`: `jsx-a11y` maps to `eslint-plugin-jsx-a11y-x`.
- `src/untyped-eslint-plugins.d.ts`: delete the original's block.
- Regenerate with `bun run --cwd packages/rule-data generate`.

**M4:** remove `eslint-plugin-jsx-a11y` from both manifests, then run `bun install`.

**E5 (part):**
- Run the fallback proof with the fork. Each shipped jsx-a11y rule must still fire on its fixture.
- If one does not, report it to D with the measurement, and D adds a skip entry with that reason.
- The case title in `eslint-versions.test.ts` names the fork.

**Must NOT:**
- Re-key any rule or rename the `jsx-a11y` prefix.
- Add `jsx-a11y-x` as an alias in the data.
- Keep both plugins after M4.
- Change any other version.

**Decided:**
- **Register the fork under `jsx-a11y`.** This keeps every rule ID, every consumer's `rules` keys, the fixtures, and the "one suppression comment works in both engines" rule, since oxlint spells the scope `jsx-a11y` too.
- **Add the fork first, swap the registry, then drop the original.** The tree loads at every step this way. Swapping the manifests in one go breaks every import of the registry until D6 lands.
- **Side effect on team configs:** the ESLint merge recognises a team's copy of our plugin by package name.
  - A team registering the fork under `jsx-a11y-x` is now recognised as ours.
  - A team registering the original under a prefix other than `jsx-a11y` no longer is.
  - The same prefix behaves as before: the team's object stays the base, with our modules in it.

| # | Criterion | How to verify |
| --- | --- | --- |
| J-1 | Both manifests list only the fork, and the lock file has no original | `jq -r '.dependencies \| to_entries[] \| select(.key\|startswith("eslint-plugin-jsx-a11y")) \| "\(.key) \(.value)"' <repo>/packages/lint-rules/package.json <repo>/packages/rule-data/package.json` prints only `eslint-plugin-jsx-a11y-x 0.2.0`, twice. `grep -n 'eslint-plugin-jsx-a11y@\|"eslint-plugin-jsx-a11y"' <repo>/bun.lock` prints nothing |
| J-2 | The registry, package table, dependencies and inventory version agree on the fork | `bun run --cwd <repo>/packages/rule-data test` (`eslint-plugins.test.ts`, `generated-files.test.ts`). `jq -r '.versions.eslintPlugins["jsx-a11y"]' <repo>/packages/rule-data/src/generated/inventory.json` prints `0.2.0` |
| J-3 | Shipped jsx-a11y IDs, engines and rulesets are unchanged | The jsx-a11y `jq` under Commands, saved before D6 and diffed after: no difference |
| J-4 | The three dropped rules are no `RuleId` | `grep -n 'jsx-a11y/accessible-emoji\|jsx-a11y/label-has-for\|jsx-a11y/no-onchange' <repo>/packages/rule-data/src/generated/rule-ids.ts` prints nothing |
| J-5 | Without oxlint, every shipped jsx-a11y rule fires on its fixture, or has a skip with its measured reason | `bun run --cwd <repo>/packages/lint-rules build`, then `bun run --cwd <repo>/packages/lint-rules test eslint-fallback.integration` |
| J-6 | The `index` and `oxlint` entries load no jsx-a11y module | `dist-loading.test.ts` passes unchanged |
| J-7 (Should, E) | A team's fork under `jsx-a11y-x` is recognised as our plugin; a plugin named `eslint-plugin-jsx-a11y` under another prefix is not | `merge-eslint-config.test.ts`, the two cases side by side |
| J-8 (real run h) | `npm install` of the packed tarball beside ESLint 10 prints no peer warning naming jsx-a11y. A project without oxlint gets `jsx-a11y/alt-text` on `<img src="x" />` | Install output, then ESLint output, tracked in the scratch case file |

### Item 2: ship the eight modern-js rules off

**The rules:** `unicorn/prefer-regexp-escape`, `unicorn/prefer-error-is-error`, `unicorn/prefer-iterator-concat`, `unicorn/prefer-uint8array-base64`, `unicorn/prefer-temporal`, `unicorn/prefer-get-or-insert-computed`, `unicorn/prefer-promise-try` and `unicorn/prefer-dispose`. Each is ESLint-run in `modern-js` today. No test or fixture names any of them, so every expectation that covers them is computed from the catalog.

**D7:**
- Remove the eight from `data/rules.json`.
- Add each to `data/rule-candidates.json`, in ascending ID order:
  - status `parked`
  - why: its fix writes an API Node 22 lacks; the owner shipped it off on 2026-10-11 until a category for the newest language features, enabled by Node version, exists
  - evidence: questions.md "Parked" and decisions.md, third sweep
  - recorded: the build date
- Regenerate.
- New pins:
  - `catalog.test.ts`: each of the eight is a `RuleId` run by ESLint, with `shipped` null. This follows the `no-use-before-define` pin.
  - `rule-candidates.test.ts`: each of the eight is `parked`.

**Must NOT:**
- Build the Node-version category. It is a plan.md to-do only.
- Touch other modern-js rules, `engines.node`, or the Node floor.

**Decided:** "off" means the rule is unshipped and parked. The list already parks `unicorn/prefer-iterator-zip` and `unicorn/prefer-uint8array-hex` for the same reason, and each rule stays in exactly one state.

| # | Criterion | How to verify |
| --- | --- | --- |
| G-1 | None of the eight ships; each is parked | The modern-js `jq` under Commands prints eight `… parked` lines from `rule-candidates.json` and no line from `rules.json` |
| G-2 | Each is still a `RuleId` that `rules` may turn on | The new `catalog.test.ts` pin |
| G-3 | Generated files are fresh; the agent and editor equivalences stay green with no edit | `bun run --cwd <repo>/packages/rule-data test`, then `bun run --cwd <repo>/packages/lint-rules test gate-equivalence editor-equivalence` |
| G-4 | plan.md's Open list holds the to-do | Docs step (below) |

### Item 3: unicorn stand-ins for two oxc rules without oxlint

**Re-derived:**
- The pairs, from the rule descriptions and the gate's rejected list (each recorded there as a verified duplicate on the same fixture):
  - `oxc/bad-comparison-sequence` (correctness) is stood in for by `unicorn/no-chained-comparison`.
  - `oxc/double-comparisons` (redundancy) is stood in for by `unicorn/no-double-comparison`.
- Both oxc rules ship with `[]` options and no files or ignores.
- Both unicorn rules are installed (unicorn 77), untyped, unshipped, not candidates, and have no oxlint version.
- Measured:
  - `no-chained-comparison` fires on the gate's fixture `a < b < c`.
  - `no-double-comparison` fires on `x === y || x < y` and `x > y || x === y`.
  - `no-double-comparison` is **silent on the gate's own fixture `x == y || x < y`**. This is the "partial" in questions.md #55.
- The rule IDs and the code that reads stand-ins are in `src/core/editor-parts.ts`: `eslintPartWithoutOxlint` and `runsInEslintWithoutOxlint`.

**D8 (data):**
- A data file beside the skip list. Suggested shape: oxc rule ID → `{ standIn, why }`.
- A catalog field holding it (suggested `eslintStandIns`).
- A data test that mirrors `eslint-fallback-skips.test.ts`, with each offenders list empty. Each key must be a shipped oxlint-run rule that ESLint has no version of. Each stand-in must be a `RuleId` that ESLint runs, untyped, not shipped, not in `rule-candidates.json`, not skipped, and used for one key only. Every entry gives a reason.
- The `why` text records the `==` gap.

**E5 (code):**
- Without oxlint, the editor ESLint part states the stand-in wherever the resolved layers state its oxc rule, in every layer (top level, scopes and entries). It takes the oxc rule's severity (`off` included), files and ignores, and none of its options.
- The oxc rule itself stays unstated, as today.
- Where a layer also states the stand-in's own ID, that statement wins in that layer, and the rule is stated once.
- Beside oxlint, and in the agent set, no stand-in is stated.
- Fallback proof:
  - A stand-in fixture index (oxc rule ID → fixture), using the `a < b < c` and `x === y || x < y` shapes.
  - A test that the index covers exactly the catalog's stand-ins.
  - A test that each stand-in fires on its fixture without oxlint.

**D (tests in its files, written first for E5):**
- `editor-parts.test.ts`: the cases in S-3 and S-4.
- `editor-equivalence.test.ts`: see [Existing assertions](#existing-assertions-the-third-sweep-makes-wrong).

**Must NOT:**
- Put a stand-in in `rules.json`. Shipped, it would also run beside oxlint and double the oxc rule's report.
- Run a stand-in beside oxlint or in the agent set.
- Copy options across.
- Treat a team's own unicorn rule as a twin or alias of our oxc rule beside oxlint. The owner asked only about projects without oxlint.
- Name a rule in code (`names-no-rule.test.ts`).
- Add round 2's D49–D51 stand-ins before the owner's verdict. The data file is where they would go.

| # | Criterion | How to verify |
| --- | --- | --- |
| S-1 | The catalog maps exactly the two pairs | The new rule-data test, `toStrictEqual` |
| S-2 | Each data offenders list is empty, and each refusal is pinned beside the real data | `bun run --cwd <repo>/packages/rule-data test eslint-stand-ins` |
| S-3 | Without oxlint, the ESLint part states both stand-ins with the oxc rules' severity, files and ignores, `[]` options, and neither oxc rule. Beside oxlint it states neither stand-in, and the oxlint part states both oxc rules | `editor-parts.test.ts` |
| S-4 | `rules` turning the oxc rule off turns its stand-in off. An entry setting the oxc rule to `warn` in `legacy/**` gives the stand-in `warn` there. A consumer's own setting of the stand-in ID wins, stated once | `editor-parts.test.ts` |
| S-5 | Without oxlint, ESLint reports each stand-in on its fixture; the index covers exactly the stand-ins | `bun run --cwd <repo>/packages/lint-rules test eslint-fallback.integration` (build first) |
| S-6 | The agent set is unchanged | `gate-equivalence.test.ts` passes with no edit |
| S-7 (real run f) | A project without oxlint: `a < b < c` gets `unicorn/no-chained-comparison` through `mergeEslintConfig`. With oxlint listed: `oxc(bad-comparison-sequence)` from oxlint, and no unicorn report | Scratch project, tracked in the case file |

### Item 4: no version refusal; check every installed oxlint against its own rule list (M3, precondition of M2)

**Today, as of 19:00:**
- `mergeOxlintConfig` calls `refuseUnsupportedInstalledOxlint` (`src/core/installed-oxlint.ts`).
- That function finds the installed manifest with `require.resolve('oxlint/package.json')` from `tsconfigRootDir`.
- It refuses any version outside our `peerDependencies.oxlint` caret range (`ourOxlintPeerRange`, `isInCaretRange`, `outsideTheRange`).
- It then reads `configuration_schema.json` beside the manifest, once per install path, and refuses when a catalog oxlint name or plugin is missing.

**Measured on published releases:**
- 1.0.0–1.64.0 ship a schema with **no rule map**, so they are refused as unreadable.
- 1.65.0, 1.68.0 and 1.70.0 each **lack catalog names**. 1.86.0 and 1.87.0 lack none.
- 1.43.0–1.58.0 publish an `exports` map **without `./package.json`**. Today's lookup throws for them and reports "does not resolve: install it", which is false.
  - `findPackageJSON('oxlint', …)` from `node:module` finds them.
  - It keeps a symlinked path as the link, whereas `require.resolve` resolves the symlink.
- `excludeFiles`, which the merge writes, first appears in the schema in 1.68.0. 1.65.0–1.67.0 have a rule list but not this key.

**M3 Must:**
- Accept an installed oxlint of **any version** whose rule list holds every name the catalog's oxlint list holds (rules spelled as the schema spells them, and their plugins).
- Read our package.json for no oxlint range. Delete what only served the range: the caret parsing, `ourOxlintPeerRange`, `outsideTheRange`, and in `package-json-files.ts` `rangeListedIn` and the `peerDependencies` field, once nothing reads them.
- Find the installed manifest even when `exports` hides it. Keep using its real path (symlinks resolved) for the schema read, the per-install cache and the messages, as the existing tests pin.
- Keep, as today:
  - the not-installed refusal: `oxlint.config.mts: a package.json lists oxlint, yet it does not resolve from <dir>: install it`
  - one schema read per install per process
  - refusal of a schema that is missing, is not JSON, or has another shape
- Texts, verbatim. `<v>` is the catalog's oxlint version (D8's `oxlintVersion`, read from `inventory.json`):
  - Lacking: `oxlint.config.mts: the oxlint installed for <dir> is <version>, which has no rule or plugin named <sorted names, comma-separated>; @agents-inc/lint-rules writes these names, so oxlint would refuse the merged config: install oxlint <v>, which has every name it writes`
  - Unreadable: `oxlint.config.mts: the oxlint installed for <dir> (<version>) has no rule list @agents-inc/lint-rules can read at <path>, so it cannot check that oxlint knows every name the merge writes: install oxlint <v>, whose rule list it can read`
- The function's name must still say what it checks.
- Test factories: the fake consumer's oxlint listing stops reading our peer range (suggested: `^<catalog oxlint version>`), and `oxlintPeerFloor` goes. Today `oxlintPeerRange()` throws once the peer is gone, and every test that builds a project listing oxlint uses it.

**M3 Must NOT:**
- Spawn oxlint (`oxlint --rules`).
- Edit `merge-oxlint-config.ts` or `project-uses-oxlint.ts`.
- Check config keys such as `excludeFiles` in the schema.
- Touch the manifests (M2 does that, afterwards).

**Decided:**
- **Keep the D-c superset: every catalog name, not just the names one merge writes.** It is also what keeps out 1.65.0–1.67.0, which lack `excludeFiles`. Q-T2 asks the owner about this.
- **Keep the schema as the rule list.** Releases with no rule map are older than 1.65.0, which already lacks names, so a process spawn would very likely refuse them anyway.
- **The remedy names the catalog's version.** The catalog's names were read from that version, so it has every one of them by construction.

| # | Criterion | How to verify |
| --- | --- | --- |
| O-1 | Fake installs at 1.85.9, 1.87.9, 1.99.0 and 2.0.0 that carry this repo's schema are all accepted | `bun run --cwd <repo>/packages/lint-rules test merge-oxlint-config.installed-oxlint` |
| O-2 | A schema lacking a rule, a plugin, or both is refused with the new text, names sorted. The same version with nothing missing is accepted | same |
| O-3 | A missing schema, one that is not JSON, one without a rule map (as 1.0.0–1.64.0 ship) and one without a plugin list are each refused with the new text and the real path | same |
| O-4 | An install whose `exports` leaves out `./package.json` (as 1.43.0–1.58.0 ship) is found and accepted with a full schema. Beside it: a package.json listing oxlint with nothing installed gets the not-installed refusal (no test pins this today) | same |
| O-5 | Nothing reads our oxlint range | `grep -rn 'ourOxlintPeerRange\|isInCaretRange\|outsideTheRange\|oxlintPeerRange\|oxlintPeerFloor\|rangeListedIn' <repo>/packages/lint-rules/src` prints nothing |
| O-6 | After M2, with eslint and oxlint only in `dependencies`, everything passes | `jq '.peerDependencies' <repo>/packages/lint-rules/package.json` shows only `typescript`; then `bun run build && bun run typecheck && bun run test` (turbo `--force`) |
| O-7 (real run g) | Scratch projects with oxlint 1.86.0, 1.70.0 and 1.50.0 (npm) give: loaded / refused, naming the missing names / refused as unreadable (not "does not resolve") | In each project, with Node 22.18 or later: `node -e 'import(process.argv[1]).then(() => console.log("loaded"), (error) => console.log(error.message))' <abs>/oxlint.config.mts` |

### Existing assertions the third sweep makes wrong

Only these change. What each one tests stays the same unless stated.

**`merge-oxlint-config.installed-oxlint.test.ts` (M3).** Reason: the owner's third sweep says no oxlint is refused for its version.
- "refuses one $where, naming the installed version and the range" (1.85.9 and 2.0.0): flips to accepted, since each carries this repo's schema.
- "accepts $which…": the "floor of the range" row goes, because there is no range. The other two rows stay.
- "refuses one outside the range by its version alone, reading no schema": flips to "refused as unreadable, naming its path".
- The `lackingNamesError` and `unreadableSchemaError` texts take the new remedy.
- Comments only: the header comment, and the describe titles "…inside the range…".

**`merge-eslint-config.test.ts` (E):** comment only. The comment on `PROJECT_WITH_OXLINT`, "only one in the package's peer range merges", becomes "only one whose rule list holds every name we write".

**`packages/rule-data/src/eslint-plugins.test.ts` (D6):** the `jsx-a11y` row of `PACKAGE_NAME_BY_PREFIX` becomes `eslint-plugin-jsx-a11y-x`.

**`src/__tests__/eslint-versions.test.ts` (E):** the title "a rule of eslint-plugin-jsx-a11y, which we install" names the fork. The assertion is unchanged.

**`editor-equivalence.test.ts` (D, for E5):** in "runs every ESLint-routed rule and every moved rule not skipped…" (no oxlint), the expected list gains `unicorn/no-chained-comparison` and `unicorn/no-double-comparison`, each with `[]`. "states no skipped rule and none ESLint has no version of…" stays.

**Checked and unchanged:**
- `gate-equivalence.test.ts`, the fallback "lack an ESLint version only under oxc" test, and `canonical-list.test.ts`.
- `other-eslint-names.test.ts`'s "notInstalled: jsx-a11y/alt-text". Its label has been stale since the running build installed jsx-a11y, but the fork binds each rule to its own module, so the assertion still holds.

### Owner questions (new)

- **Q-T1. The two refusal texts.** Options: as drafted above, or other wording. Meanwhile: as drafted.
- **Q-T2. Should the oxlint name check cover only the names one merge writes, rather than every name in the catalog's oxlint list?**
  - Today a newer oxlint that drops any one rule refuses every team, even teams whose merge never writes that rule. For example, 1.70.0 had `react/react-compiler`, which 1.87.0 does not.
  - A per-merge check would refuse only where it matters. It needs code in `merge-oxlint-config.ts`, and it would let through 1.65.0–1.67.0, which lack `excludeFiles`.
  - Meanwhile and **recommended:** keep every name.

### Docs this makes false (step 8, same turn)

- **plan.md:**
  - The "does not carry over" jsx-a11y row ("not a dependency").
  - The parked modern-js line becomes an Open to-do: later, a category for the newest language features, enabled by Node version, with the eight parked rules moving there.
  - Open: #54, #55 and #56 answered.
  - Corrections rows.
  - One line on what the oxlint check does not catch: a newer release that moves a rule between categories (#56).
- **architecture.md:**
  - Step 7: the version-range sentence. It also still names `refuseOxlintOutsideOurPeerRange`.
  - The ESLint part without oxlint: stand-ins.
  - The packages row: the fork.
- **questions.md:** Parked modern-js, #54, #55 and #56 answered.
- **learnings.md:**
  - The oxlint schema facts above.
  - `findPackageJSON` compared with `require.resolve`.
  - The fork's `meta.name` and the rules it dropped.
  - The `==` gap of `no-double-comparison`.

### Left out on purpose

- The Node-version category: owner to-do.
- D49–D51: the owner's verdict is pending.
- Stand-ins beside oxlint.
- Checking config keys against the schema.
- Detecting category moves in a newer oxlint: accepted under #56.

### Gotchas

- `installed-oxlint.ts` was being edited by the running build while I read it.
- The `==` gap is in the stand-in itself, not in our code. eqeqeq already reports the loose comparison.
- `findPackageJSON` keeps a symlinked path as the link, so the real path has to be taken explicitly.
- `rules.json` and `rule-candidates.json` are untracked, so `git diff` cannot compare them. Save a before-copy in scratch for J-3 and G-1.

### Corrections

1. Spec, "Where this batch starts": "the merge reads our oxlint peer range (`refuseOxlintOutsideOurPeerRange`)". The function is now `refuseUnsupportedInstalledOxlint` (the running build's C2). It still reads the range, through `ourOxlintPeerRange`, so the behaviour claim holds.
2. Spec: "its manifests go to M; its registry, generated files and data go to D". D owns all of `packages/rule-data/`, so its `package.json` had two owners. It is now carved out to M.
3. Spec: M2's only precondition is the merge's range read. Also false: the test factory `oxlintPeerRange()` reads our oxlint peer and throws without it. M3 now covers it.
4. Brief: "every installed oxlint checked against its own rule list". Releases 1.0.0–1.64.0 ship no rule list in their schema, so they are refused as unreadable, not checked. Releases 1.43.0–1.58.0 are wrongly reported as not installed today. Measured.
5. decisions.md "(the two oxc rules)" named neither rule. Re-derived as above, along with the measured partial coverage of `no-double-comparison`.

### Third-sweep commands

Run from `<repo>`. `<s>` is `<scratchpad>/pm-third-sweep`.

```sh
# the fork: version, ESLint peer, rules against the original's, plugin names
npm view eslint-plugin-jsx-a11y-x version peerDependencies.eslint
npm pack eslint-plugin-jsx-a11y-x@0.2.0 --pack-destination <s>/tarball && tar -xzf <s>/tarball/eslint-plugin-jsx-a11y-x-0.2.0.tgz -C <s>/unpacked
diff <(ls node_modules/eslint-plugin-jsx-a11y/lib/rules | sed 's/\.js$//') <(ls <s>/unpacked/package/lib/rules | grep -v '\.d\.ts$' | sed 's/\.js$//')
grep -n "meta" node_modules/eslint-plugin-jsx-a11y/lib/index.js <s>/unpacked/package/lib/index.js
# shipped jsx-a11y rules (J-3: save before D6, diff after)
jq -r '.[] | select(.id|startswith("jsx-a11y/")) | "\(.id) \(.engine) \(.ruleset)"' packages/rule-data/data/rules.json
# the eight modern-js rules, shipped or considered (G-1)
jq -r '.[] | select(.id|test("^unicorn/prefer-(regexp-escape|error-is-error|iterator-concat|uint8array-base64|temporal|get-or-insert-computed|promise-try|dispose)$")) | "\(.id) \(.status // .ruleset)"' packages/rule-data/data/rules.json packages/rule-data/data/rule-candidates.json
# the two oxc rules and their stand-ins
jq -c '.[] | select(.id=="oxc/bad-comparison-sequence" or .id=="oxc/double-comparisons")' packages/rule-data/data/rules.json
jq -c '.rules[] | select(.id=="unicorn/no-chained-comparison" or .id=="unicorn/no-double-comparison")' packages/rule-data/src/generated/inventory.json
~/.local/share/fnm/node-versions/v22.23.2/installation/bin/node <s>/standin-probe.mjs <repo>
# an oxlint release: rule map present, excludeFiles known, package.json exported
npm pack oxlint@<v> --pack-destination <s>/ox/<v> && tar -xzf <s>/ox/<v>/oxlint-<v>.tgz -C <s>/ox/<v>
node -e 'const [schema, manifest] = process.argv.slice(1).map((p) => require(p)); console.log(manifest.version, Boolean(schema.definitions?.DummyRuleMap?.properties), JSON.stringify(schema).includes("excludeFiles"), JSON.stringify(manifest.exports ?? null))' <s>/ox/<v>/package/configuration_schema.json <s>/ox/<v>/package/package.json
# the catalog names a release's schema lacks
node <s>/lacking.mjs packages/rule-data/src/generated/inventory.json <s>/ox/<v>/package
# how an install is found (a hidden package.json, a symlink, none)
~/.local/share/fnm/node-versions/v22.23.2/installation/bin/node <s>/resolve-probe.mjs <project dir>
```
