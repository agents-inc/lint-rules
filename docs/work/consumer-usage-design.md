# Agents see every rule, people see fewer: design

**Superseded 2026-10-11:** the owner chose agents only, with the runner building its configs per run and no
config of ours in the project (plan.md Decisions). C2's environment switch is dropped; `editorRulesets` stays,
exported for a team's own configs. Section 3 (the runner pipeline) stands as the proposal.

Proposal, 2026-10-10. Nothing is built. Any name in `code` that a user would see or type is a
placeholder until the owner names it. Evidence is in the folders listed under [Evidence](#evidence).

## In short

- **It works.** Both engines can run the full rule set for agents while editors show less.
  This was measured three ways (section 2).
- **The real cost is two standards in one codebase.** On a real React app, a three-ruleset view hides
  95% of the findings from people (1,781 down to 88). So code written by people drifts away from
  the rules, and an agent that edits a person's file inherits that file's findings.
- **What CI enforces decides whether hiding is worth doing.** If CI runs the full set, hiding the
  squiggles only moves the failures to CI.
- **The best layout found is new: C2, "one switch".** The consumer keeps today's three files, and a
  switch picks the rule set. Editors and plain `eslint`/`oxlint` get a lighter set for people, and
  the runner turns the switch on to get everything. I measured it. It needs none of the four package
  fixes that renamed config files (option B) need.
- **Yes, supply the runner.** It is "the TypeScript file a sub-agent calls", and plan.md already
  plans it. The research settles its order: oxlint fixes, then ESLint fixes, then the project's own
  formatter, then the checks run in parallel (typecheck, oxlint, ESLint), then the report.
  Typecheck does not go first.
- **Ship it as a command in `@agents-inc/lint-rules`.** The sub-agent runs it because one line in
  its instructions says to. There are no hooks.

## 1. Is "agent-only" valid?

**How many squiggles people see.** Measured on bulletproof-react `apps/react-vite` @9506629:
128 TS/TSX files, 6,960 lines.

| Rule set in the editor | Findings | Files marked | Lines marked |
| --- | --- | --- | --- |
| Full | 1,781 | 125 of 128 | 1,375 (19.8%) |
| Without the style-type `quality` rulesets | 473 | 93 | 400 (5.7%) |
| `correctness`, `security`, `accessibility` only | 88 | 40 | 87 (1.25%) |

Most of it is style: by lines marked, `ordering` 458, `declarative` 226, `conventions` 225,
`react` 194, `import-order` 126. 729 of the 1,540 ESLint findings have an autofix.

| For showing people fewer rules | Against |
| --- | --- |
| Under the full set, almost every file is red (125 of 128). | **Two standards.** People's code never meets the full set. Agent code meets it until a person edits it, and nothing notices. |
| Rules steer agents more than people: an agent reads every finding and fixes it in seconds. | **An agent inherits people's findings.** There are about 14 per file on average. If the agent passes the whole file, it rewrites people's code. If it passes line ranges, the file stays mixed. |
| A team can adopt the rules gradually. | **Reviewers can't see why agent code looks different** (sorted props, function declarations, readonly types). |
| | **If CI enforces the full set, people meet the rules anyway**, only later and in CI. |

**Verdict.** It is valid when the team accepts that the full set is a standard for code agents write,
enforced when they write it. If the team wants the full set to hold for all code, keep option A:
the editor is the cheapest place to see what CI will fail.

## 2. Options

| | A. Today's plan | B. Agent-only, renamed configs | C1. Hybrid, two rules files | **C2. Hybrid, one switch** | D. Editor downgrades |
| --- | --- | --- | --- | --- | --- |
| People see | Full set | Their own config, or oxlint's default rules | Chosen subset | Chosen subset, or none of ours | Full set shown as info or hidden (VS Code only) |
| Runner sees | Full | Full, without the project's own rules | Full | Full | Full |
| Plain `eslint .` / `oxlint` / CI | Full | ESLint exits 2; oxlint runs its own 96 defaults | Subset | Subset; full with the switch | Full |
| Consumer's files | 3 | 3 under new names, plus their own | 5 | 3, the same as A | 3 + `.vscode/settings.json` |
| Package work | None | 4 fixes (below) | B's 4 + a third name | Small (below) | Generated per-rule lists, or docs only |
| What breaks | Nothing | See B | B's problems on the agent side | Nothing found. Editors not run | Rulesets don't map to plugin prefixes; JetBrains not covered by the research |

**Before, in every option:** the project's own `eslint.config.*`, its `.oxlintrc.json`, or neither.

### A. Today's plan

- **Files:** `agents-inc.lint.mts`, `oxlint.config.mts`, `eslint.config.mjs` at the root.
  `init` moves the project's old config into these.
- **Commands:** agent: `<runner> <paths>`; people and CI: `npm run lint`.
- **Right for:** new or agent-first repos, and the benchmark.

### B. Agent-only: our configs under names editors don't look for

- **Files:** `agents-inc.lint.mts`, `agents-inc.oxlint.config.mts` and `agents-inc.eslint.config.mjs`,
  all at the root. The project's own `eslint.config.*` and `.oxlintrc.json` stay as they are.
- **Commands:** the runner passes `--config` / `-c` (or ESLint's `overrideConfigFile`).
- **Package work:**
  1. Add the new names to `consumerConfigFiles`. Without them, the renamed files draw
     `unicorn/no-top-level-side-effects` and a fatal "not found by the project service" parse error,
     and config errors name the wrong file.
  2. Add `basePath` to the ESLint factory, or always run from the root. With `--config`, ESLint
     resolves `ignores` from the working directory, so running from `src/` leaked
     `src/generated/gen.ts`.
  3. Keep the configs at the root. In a subfolder, oxlint resolves `ignores` from that folder and
     leaks.
  4. Document that `-c` / `--config` switches off per-folder configs in both engines.
- **Still broken after those fixes:**
  - The agent run drops the project's own rules. The project's suppressions then fail with
    `Definition for rule 'simple-import-sort/imports' was not found`.
  - A whole preset can't be passed as extras: `@eslint/js` recommended throws `"constructor-super"
    belongs in agents-inc.lint.mts`.
  - Editors with no config show oxlint's default rules unless the developer sets `oxc.requireConfig`.
    VS Code's ESLint status bar shows an error.

### C1. Hybrid with a second rules file (discovery's layout)

- **Files:** an editor-only rules file (`editor.lint.mts`) that imports `agents-inc.lint.mts` and
  narrows `rulesets`, read by the discovered engine files. A second pair of engine files under new
  names imports the full set.
- **Package work:** B's four fixes plus protection for the third name. Without it, `editor.lint.mts`
  draws the same fatal parse error.

### C2. Hybrid with one switch (measured for this design)

The same three files as A. `agents-inc.lint.mts` holds the full set and a lighter set for people,
and the engine files pick one based on an environment variable.

```ts
// agents-inc.lint.mts (the form measured)
const everyRuleset = defineLintRules({ /* as today */ })
export const forPeople = defineLintRules({
  ...everyRuleset,
  rulesets: { ...everyRuleset.rulesets, quality: ['correctness', 'security', 'accessibility'] },
})
export default everyRuleset
```
```js
// eslint.config.mjs (oxlint.config.mts the same)
export default eslintConfig(process.env.AGENTS_INC_LINT === 'full' ? everyRuleset : forPeople)
```

| Run | ESLint findings | oxlint findings |
| --- | --- | --- |
| People: plain `eslint .`, `oxlint` | 1 | 1 |
| Agent: the same with `AGENTS_INC_LINT=full` | 7 | 3 |
| Agent, run from `src/` | 7, and `src/generated/` stays ignored | 3 |
| Agent, through the ESLint Node API in one process | 7 | — |
| People's set with every ruleset removed | 0, exit 0 | 0, exit 0 |

- **What this avoids:** none of B's four fixes are needed.
  - The config files keep their standard names, so they keep their protection: no findings on them.
  - Nothing passes `-c`, so ignores and per-folder configs behave as in A. Per-folder configs were
    not measured; that follows from not passing the flag.
  - The project's own rules stay in the extras for both sets.
- **Suggested built form:** move the switch into our factories, so the consumer's engine files stay
  exactly as plan.md shows them.
  - Add one optional key to `agents-inc.lint.mts` (placeholder `editorRulesets`), shaped like
    `rulesets` and checked to be a subset of it.
  - If the key is absent, people see the full set, which is option A.
  - The runner sets the variable and checks that it took effect.
- **Package work:**
  - The key, its validation and its types.
  - The factories choose the set.
  - Tests:
    - a rule from a hidden ruleset fires with the switch and stays silent without it;
    - the always-on suppression ban fires in both.
  - A rule for `fileOverrides` entries that set `rulesets`. Suggested: intersect them with the
    people's set.
  - Docs.
- **Risks:**
  - A developer whose shell exports the variable sees the full set. That doubles as "show me what
    the agent sees".
  - Turborepo's default strict mode drops undeclared variables, so a CI `turbo lint` needs the
    variable in `env`. That also adds it to the cache key
    ([Turborepo env modes](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/crafting-your-repository/using-environment-variables.mdx)).
    The runner calls the engines directly, so it is not affected.
  - Not measured here:
    - editors: behaviour comes from docs and extension source;
    - the always-on suppression ban in the people's set, because the tarball predates the ban.

### D. One config, quieter editor

- **How:** in `.vscode/settings.json`, `eslint.rules.customizations` sets severity by rule, with
  wildcards (`off`, `info`, `downgrade`). `oxc.lint.customization` does the same per rule, with no
  wildcards.
- **Commands:** CLI, CI and the runner are unchanged.
- **Why not:** it works in VS Code only. A ruleset is not a plugin prefix, so every rule would need
  its own entry, from a list we generate. CI still enforces everything.

## 3. The runner

### Pipeline

| # | Step | Writes files | Why here (measured on 8 real files, 3,753 lines) |
| --- | --- | --- | --- |
| 0 | **Preflight:** resolve the paths, keep JS/TS extensions, snapshot each file, select the full set, load both configs. | No | A config that will not load means "could not run". The snapshots tell the report which files were rewritten and let it map ranges. |
| 1 | **oxlint `--fix`**, safe fixes only | Yes | It makes few fixes (15, against ESLint's 494). The two fixer orders give different code in 1 of 8 files, so the order is fixed, and ESLint, which repeats its passes until nothing changes, goes last. |
| 2 | **ESLint fix** through the Node API, with a fix filter | Yes | The filter holds back the five fixers the gate withholds as unsafe (107 fixes on the probe). It also keeps fixes inside line ranges: fixing lines 1-60 changed only lines 5-56. |
| 3 | **The project's own formatter**, if it has one | Yes | Formatting first, then fixing, left 7 of 8 files unformatted. oxfmt output failed `prettier --check` on all 8, so it must be the project's own formatter. |
| 4 | **Checks, in parallel:** typecheck; oxlint; ESLint, in the same process and only on files changed since step 2; unused suppressions, only if the ban is off | No | Judge the code as it will be committed: formatting added 6 findings (28 to 34). Typecheck runs after the fixers because a fixer can break the build (the gate saw one). It costs 0.1-4 s, so it runs alongside the others. |
| 5 | **Report, one log line, exit** | No | |

- **One round is enough.** Rounds 2 and 3 changed 0 files. Every step runs even after an earlier one
  fails, and nothing loops.
- **Why typecheck does not go first.** Its result is stale once the fixers rewrite files, and it
  cannot catch a fixer that breaks the build. What typecheck-first gets right is reading type errors
  first, so they come first in the report. On the probe, 38% of the remaining lint findings were a
  cascade from 52 unresolved imports.
- **Time:** about 4-9 s for 1-3 files. Re-checking in the same process took 2.2 s against 5.2 s as a
  second command.

### Scope

- **Whole file:** for files the agent created or is refactoring. It owns every finding in them
  (plan.md, Scope).
- **Line ranges:** for files that already existed.
  - ESLint fixes stay inside the ranges.
  - oxlint has no fix filter (its JSON output carries no fix data), so the runner skips oxlint's fixes
    on these files and only reports.
  - The formatter runs only if the file was formatter-clean at git HEAD (the gate's rule).
  - The runner reports findings whose lines overlap a range, after mapping the ranges through the
    rewrites.
  - Known gap: ESLint's later fix passes see shifted line numbers. The drift is small and was
    measured.
- **Ranges matter more under C2:** a file people wrote has about 14 findings under the full set.
- **Typecheck covers the whole program.** Errors in the passed files fail the run. Errors elsewhere
  are listed with a count but do not fail it, since they may be another agent's work in progress.

### Exit codes and output

| Exit | Meaning |
| --- | --- |
| 0 | Clean. Warnings may be listed. |
| 1 | At least one error. |
| 2 | A step could not run: a missing binary, a config error, a crash, a timeout, or Node older than 22.18. This holds even if everything else was clean. |

- **Read each tool's output, not its exit code.** oxlint exits 1 both for findings and for a broken
  config. tsc 6 exits 2 on errors; tsc 7 exits 1.
- **Order:**
  1. One status line: the verdict, counts per step, the files the runner rewrote (the agent must
     re-read them), and the time taken.
  2. The path of the full report.
  3. Type errors.
  4. Lint errors by file and line.
  5. Warnings.
- **Rule IDs:** the canonical ESLint IDs. oxlint's `typescript(no-explicit-any)` is translated.
- **Length:** stdout stops under about 9,000 characters with "+N more in the report", and the report
  file always holds everything. The reason was measured: a failing command's output of 42,600
  characters reached the agent as the first and last ~5,000 of its first 30,000 characters, with no
  file path.

An illustrative report (the type error is invented):

```
FAIL · 1 type error, 2 lint errors in 1 file · rewrote src/probe.ts (re-read it) · 6.2 s
Full report: <report path>
Type errors
  src/probe.ts:4:7  TS2322  Type 'string' is not assignable to type 'number'.
Lint errors
  src/probe.ts
    8:3  @typescript-eslint/no-floating-promises — Promises must be awaited, …
    8:3  functional/no-expression-statements — Using expressions to cause side-effects not allowed
```

### What a codebase can change

| Setting | Detected default |
| --- | --- |
| Typecheck | `tsc --noEmit` against the nearest tsconfig of each passed file, `--incremental`, with its build info outside the tree. Override for `vue-tsc`, `tsc -b` or a turbo task. None if there is no tsconfig. |
| Formatter | Found from the project's config: Prettier, oxfmt, Biome or dprint. None if there is none. |
| Type errors outside the passed files | Listed, not failed |
| Files passed with ranges | Skip oxlint's fixes. Format only if formatter-clean at HEAD. |

- **Fixed by the package:**
  - the step order;
  - both engines always run, and every step runs;
  - safe fixes only;
  - which fixers are withheld (a per-rule field in `rules.json`, because it is a property of the
    rule);
  - exit codes, output order and length, the report file and the log line;
  - the runner always uses the full set.
- **Where overrides live:** start with detection only and no keys. Plan.md's own rule applies:
  adding a key later breaks nobody. When a codebase needs an override, it goes in one of:
  - an optional file of its own (the owner's "TypeScript file");
  - a section of `agents-inc.lint.mts`, which re-opens the Decisions row that keeps that file to
    rules only;
  - flags.

### How a sub-agent calls it

There are no hooks (plan.md Decisions). The orchestrator decides when the runner runs, and the
sub-agent's instructions carry the command:

```
After changing code, run: npx <command> <file>[:<from>-<to>,…] …
- Pass a file whole if you created it or are refactoring it; otherwise pass the line ranges you changed.
- Exit 0: done. Exit 1: fix every finding listed, re-read each file the runner says it rewrote, run it again.
- Exit 2: a step could not run. Stop and report its output; do not work around it.
- Never add a suppression comment.
```

### How it ships

- **One command** (a bin) in `@agents-inc/lint-rules`, shared with `init`. There is also a Node
  export, so a codebase can call it from a file of its own.
- **It uses the project's own tools:** oxlint, ESLint, formatter and `tsc`. It adds no dependencies.
- **The five withheld fixers** move into `rules.json`.
- **Internal layout** (a private package, or a folder in `lint-rules`) needs no permission.
- **TypeScript 7 caveat:** `tsc` 7 can run the typecheck step, but our 97 typed ESLint rules need
  TypeScript 6's API (typescript-eslint 8.71.1 peers on `<6.1.0`). This bears on the Open item about
  which engine runs the typed rules.

## 4. Recommendation

1. Build the runner as described in section 3. It always runs the full set, whatever people see.
2. Keep A as what `init` writes.
3. Offer C2 as the one way to show people less, including none of our rules, through one optional
   key. Don't build B, C1 or D. B can be added later without breaking anyone.
4. Say plainly in the docs that a lighter set for people means two standards, and state what CI
   enforces.
5. First, the owner names everything below.

## 5. Questions for the owner

| # | Question | Suggested answer | Alternatives |
| --- | --- | --- | --- |
| 1 | Support a lighter set for people at all? | Yes, as C2, opt-in. A stays the default. | Do nothing (A only); B |
| 2 | Its shape and name | One optional key in `agents-inc.lint.mts`, shaped like `rulesets` and a subset of it (placeholder `editorRulesets`) | A list of rulesets to hide; a second exported object (the measured form); a separate file |
| 3 | The switch | An environment variable that the runner sets (placeholder `AGENTS_INC_LINT=full`) | Renamed config files (B or C1) |
| 4 | What CI enforces when people see less | The people's set on the whole repo. The full set only through the runner, on agent changes. | The full set in CI (then don't hide it); the runner on each PR's changed lines |
| 5 | The runner's command | One bin with two subcommands (placeholders `agents-inc-lint check <paths>` and `agents-inc-lint init`) | Separate bins; a consumer-owned `.mts` file run with `node` |
| 6 | Syntax for paths and ranges | `src/a.ts:10-40,55-60` | Repeated `--range` flags; a JSON file |
| 7 | Files passed with ranges | Skip oxlint's fixes. Format only if formatter-clean at HEAD. | Fix and format the whole file; never format |
| 8 | Type errors outside the passed files | List them with a count; don't fail | Fail; ignore |
| 9 | Runner settings | Detection only for now, no keys | An optional file; a section in `agents-inc.lint.mts`; flags |
| 10 | Extra steps (stylelint, tests) | Not in the runner | Configurable extra steps |
| 11 | Where the report file goes | `node_modules/.cache/<package>/`: inside the project, ignored by git, readable by the agent | The OS temp folder; a `.agents-inc/` folder |
| 12 | Agent instructions | `init` prints the lines to paste and edits no CLAUDE.md or agent file | `init` writes them |
| 13 | Decisions row "Runner … matches the editor and CI" | Reword it: matches CI, and matches the editor unless a lighter set is configured | Keep it as is and drop the lighter set |

## Found along the way

- **plan.md's `oxlint.config.mts` template fails our own `import-x/order`**
  (`'@agents-inc/lint-rules/oxlint' import should occur before import of 'oxlint'`). So does
  `test-fixtures/consumer-files/oxlint.config.mts`.
- **plan.md's interim `lint:fix` (`eslint --fix .`) applies the five fixers the gate withholds as
  unsafe.** That was 107 fixes on the probe.
- **plan.md says the runner checks unused suppressions.** Under the suppression ban (owner,
  2026-10-10), that only matters when a consumer turns the ban off. For the same reason, the
  discovery finding "agent suppressions put squiggles in people's editors" does not apply while the
  ban is on.

## Evidence

All of it is under `/tmp/claude-1000/-home-vince-dev-agents-inc-lint-rules/a25168ef-5c3c-4f9b-b5bd-1ca853c645f7/scratchpad/consumer-usage/`.

- **`design-probes/reproduce.sh`** re-runs C2 (its output is in `reproduce.log`). It uses
  `discovery/app/node_modules`. The test projects are `env-switch/` (three rulesets) and
  `env-switch-empty/` (none).
- **`discovery/reproduce.sh`** covers B, C1, the editor API probe and the squiggle counts.
- **`sequencing/notes.md`** covers the pipeline. Re-run any step order with
  `node pipeline.mjs probe runs/<name> tools <steps>`.

## Sources

- ESLint: [config files and ignores](https://eslint.org/docs/latest/use/configure/configuration-files#specify-files-and-ignores),
  [Node API](https://eslint.org/docs/latest/integrate/nodejs-api)
- oxlint: [config](https://oxc.rs/docs/guide/usage/linter/config.html),
  [nested config](https://oxc.rs/docs/guide/usage/linter/nested-config.html),
  [type-aware linting](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable)
- Editors: [vscode-eslint](https://github.com/microsoft/vscode-eslint), [oxc-vscode](https://github.com/oxc-project/oxc-vscode),
  [WebStorm ESLint](https://www.jetbrains.com/help/webstorm/eslint.html), [oxc-intellij-plugin](https://github.com/oxc-project/oxc-intellij-plugin)
- Other tools' ordering: [lint-staged](https://cdn.jsdelivr.net/npm/lint-staged@17.0.8/README.md),
  [ultracite usage](https://www.ultracite.ai/usage), [Prettier and linters](https://prettier.io/docs/integrating-with-linters),
  [TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- Same rules for people and agents, or not: [Factory](https://factory.com/using-linters-to-direct-agents),
  [a separate `lint:ai` config](https://dev.to/fhaponenka/making-ai-code-consistent-with-linters-27pl)
- [Turborepo environment modes](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/crafting-your-repository/using-environment-variables.mdx) (via Context7 `/vercel/turborepo`)
