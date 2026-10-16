# Learnings

Facts found while working. Terse. Full reports (session scratch, may vanish):
`scratchpad/understand/*.md`; per-rule join of the gate's live configs: `scratchpad/understand/data/enabled-join.json`.

## Rule IDs and routing
- oxlint does NOT accept every ESLint ID: rejects `n/` (use `node/`), `@vitest/` (`vitest/`), `react-refresh/` (`react/`), `@eslint-react/`, renamed rules (`unicorn/no-for-each` → oxlint `unicorn/no-array-for-each`). So each oxlint-run rule stores its native oxlint name. (plan.md "accepts it as-is" is false.)
- oxlint silently ignores a rule whose plugin is not in `plugins` (exit 0, no findings). Factory must derive `plugins` from the rules.
- oxlint `react` scope = 61 `react/` + 24 `react-hooks/` rules; split per rule, not per scope.
- `rulesets.json` draft: 162 IDs not canonical (`eslint/` 114, `typescript/` 19, `react/`→`react-hooks/` 16, `import/`→`import-x/` 12, 1 rename). Re-keyed, the 1,014 are unique.
- Gate split is 278 oxlint / 639 ESLint untyped / 97 ESLint typed; 0 overlap. oxlint half comes from `build_lint_config.py` (categories + NAMED − DEDUPE), not `rule-triage.json`.
- 23 enabled rules are file-scoped (16 only-under-globs: storybook 13, functional 2, max-lines; 10 off-under-globs). Canonical schema needs `files`/`ignores` per rule.
- `typed` cannot come from plugin meta (15 of 97 lack `requiresTypeChecking`); store it.
- Options: 82 rules; ESLint ones from triage `enable`, oxlint 5 from `NAMED`; `max-lines {max:200}` only as a `.tsx/.jsx` override.

## Engines
- oxlint 1.82 local; npm latest oxlint 1.87, ESLint 10.12, typescript-eslint 8.71.1 (TS <6.1), globals 17.13.
- `defineConfig` exported from `oxlint` since 1.43. oxlint has no Node lint API: runner must spawn CLI.
- oxlint `extends` keeps jsPlugins/typeAware/categories/rules/plugins/overrides; drops ignorePatterns/env/globals/settings.
- oxlint severity-only override resets options to defaults (ESLint keeps them). Emit full `[sev, ...opts]`.
- Slash-free globs: `*.test.ts` matches any depth in oxlint, root only in ESLint.
- Drop a runtime's globals: ESLint `'off'` per global; oxlint `env: { browser: false }`.
- One ESLint config with typed rules: a file outside tsconfig that the project service is set for gets a fatal parse error and loses untyped rules too (gate uses 2 passes). Where the project service is ours, our typed blocks now ignore each TS file no tsconfig takes in, listed when the config loads, so only a file created after that is still fatal.
- Node will not strip types from `.ts` in `node_modules`: the published package ships JS.
- Node loads workspace `.ts` source only if relative imports carry `.ts`.
- oxlint exit codes only 0/1; `-f json` stdout not always JSON (config errors, "No files found").
- Patches (css-modules, react-hook-form) are replaced by `@eslint/compat` `fixupPluginRules` (measured).

## Tests
- Batch fixture proof: ~18 s CLI for all 1,056 fixtures, needs `moduleDetection: force`. Gate's proof pools engines and matches bare names: not per-engine proof.
- Fix round 2: three reviews running stopped on a decision point the developer had just added with no test, though the developer's own breaks had already found it uncaught. Each fix round now has a guards step after the developer that tests every developer break changing findings, before the review.
- house: 15 rules, 1,700-line JS; defect D1 (`no-section-banner` autofix joined lines) fixed in the port; multi-line block banners fixed 2026-10-10. Still joins tokens for a one-line banner with no spaces (`typeof/*----*/b`), 0 corpus hits.

## Monorepo (from ~/dev/cli)
- Private `@workspace/*` packages export `./src/*.ts`, no build; published package bundles them (tsdown `dts: { eager: true }`; tsup breaks on TS 6).
- Factories: `build<T>(overrides?: Partial<T>)`, overrides last; asserted-on fields have no default.

## Slice 1 build
- The agents' Stop hook (generated into `.claude/agents/*.md` by agents-inc) runs the root `typecheck` on every stop. Tests-first makes it red by design (tests import modules not yet written); testers hit it 8× each.
- ESLint 10.12: `off` for an unknown rule/plugin is accepted; a second, different plugin object under one name throws `Cannot redefine plugin`; calculated config fills default options and keeps earlier options under a bare severity.
- typescript-eslint 8.71.1 rule types do not fit ESLint 10's `ESLint.Plugin` without a cast (rule context still declares removed methods).
- tsdown inlines `@typescript-eslint/utils` unless it is a dependency of lint-rules (house imports it at runtime).
- Generated inventory: 1,995 rules, 1,860 `RuleId`s (deprecated non-canonical excluded).
- `oxc/approx-constant` (oxlint) and `unicorn/prefer-math-constants` (ESLint) both ship in correctness and flag the same literal.
- eslint-plugin-react `settings.react.version: 'detect'` crashes under ESLint 10 (`context.getFilename is not a function`) unless the plugin goes through `fixupPluginRules`; without `react` installed it still warns once.
- typescript-eslint types `Program.parent` as undefined; at runtime it is `null`.
- tsdown keeps `/** */` comments in `dist/`: a doc comment naming a private `@workspace/` package leaks into the bundle.
- house port differential (legacy vs TS) over 72,185 files: 0 non-D1 differences after fixing a `hook-file-naming` default-export bug the 136 tests missed. Harness: `scratchpad/house-diff/differential.mjs`.
- Generated files' idempotency: compare hashes while they are untracked (`git status` cannot see a change to an untracked file).
- typescript-eslint 8.71: one project service per process, built from the first file's options; `allowDefaultProject` refuses `**` and bare `*`, max 8 files; a file matched by it AND in the tsconfig is a fatal parse error.
- oxlint 1.87 accepts, per rule: its scope prefixes plus each prefix's npm package form (`eslint-plugin-unicorn/x`, `typescript-eslint/x`); refuses `n/`, `@vitest/`, `react-refresh/`. Checked for all 871 rules (`oxlint-spellings.integration.test.ts`).
- TypeScript's default include drops `a.tsx` when `a.ts` sits beside it. Where the type information is ours, `tsFilesOutsideEveryTsconfig` lists `a.tsx`, so it gets untyped rules only and no fatal error (measured 2026-10-12, agent build and editor merge; with the list left empty it is the fatal "not found by the project service" error).
- A lint reproduction must check for a fatal message before counting a silent rule as a pass (a `.ts` under `/tmp` with no tsconfig is fatal and silences every rule).
- ESLint checks a rule's options only on files the rule applies to: bad options pass silently until a matching file exists.

## Round 5 investigations (scratchpad/investigate-{deps,rules}/)
- Workflow subagents can receive a user message sent to the main session and act on it instead of their brief: 3 of 5 did (one disabled the Ralph Loop plugin in ~/.claude/settings.json). Briefs now say relayed messages are not theirs.
- npm audit "6 high" = 2 advisories, neither reachable at lint time: braces (via check-file → micromatch; braces 3.0.3 is latest, no fix; check-file calls only isMatch/capture) and deepmerge-ts <8 (via functional 10.0.1; fix waits on functional PR #1102; consumer-side `overrides` works, ours does nothing).
- ESLint 10: eslint-plugin-react 7.37.5 needs `fixupPluginRules` (6 of 14 shipped rules crash unwrapped with `version: 'detect'`); css-modules and react-hook-form crash unwrapped too. No ESLint-10-native release of any of them yet (react PR #4022 open).
- eqeqeq ⊇ no-eq-null. unicorn/prefer-math-constants catches `3.14`; oxc/approx-constant misses it and fires in type positions where Math.PI cannot go. react-hooks/hooks and rules-of-hooks each catch cases the other misses.
- perfectionist sort-union-types × unicorn/prefer-type-literal-last: 2,284 circular fixes on 6,654 generated unions with shipped options; 0 with object types grouped last (config in investigate-rules report).
- functional/no-loop-statements has no options and bans for…of. `no-restricted-syntax` selectors (For/ForIn/While/DoWhile) ban exactly classic loops, but one rule ID = one ruleset, so merging moves the loop ban into type-safety.
- core prefer-arrow-callback ({allowNamedFunctions}) skips generators and `this`/`arguments`/`new.target` callbacks; house/prefer-arrow-callbacks flags them (false positives) and loses no true positive if dropped.
- Fix convergence must be measured with ESLint's own "fixed" flag (`output` present), not "text unchanged": an even-length fix cycle returns to the start text.
- Suppression ban: ESLint's `linterOptions.noInlineConfig: true` (per files block; a later block can undo it) makes ESLint ignore every directive and warn per directive; without it `/* eslint-disable */` silences the ban itself. oxlint: `options.respectEslintDisableDirectives: false` is root-only and nothing stops `oxlint-*` directives, so oxlint can still be suppressed; the ESLint-side ban reports the directive anyway. oxlint also treats a LINE `// eslint-disable` as a file-level disable (ESLint ignores line-form).

## Runner cost (2026-10-11, one file, every ruleset, scratchpad/time-rebuild/)
- Per run: load package + plugins ~1.35 s (any design pays it: ESLint must load the plugins), build both configs + write a temp oxlint file ~30 ms (~3 ms warm), oxlint ~60 ms (275 rules), ESLint with typed rules ~0.6 s.
- `npx` installs a package missing from the project into npm's cache (`~/.npm/_npx`), outside `node_modules`, so the project cannot `import type` from it (npm docs via Context7).
- Built types (`dist/index-*.d.mts`): 66 KB, self-contained (no imports); 63 KB is the `RuleId` union on one line.
- Of the 275 shipped oxlint-run rules, 181 have an ESLint version in plugins we install (0 typed, 1 deprecated); 94 have none: jsx-a11y 34, vitest 22, oxc 18, react-hooks 16, react-perf 4 (rules.json × generated inventory.json).
- Loading the built entries alone: `index.mjs` ~14 ms, `oxlint.mjs` ~13 ms, `eslint.mjs` ~2 s (it imports every ESLint plugin).
- import-x 4.17 reads exports only from files matching `import-x/extensions` (default `.js/.mjs/.cjs`): `default`, `named`, `namespace`, `no-cycle`, `no-named-as-default*`, `no-rename-default` are silent on `.ts` targets even when they resolve. `createNodeResolver()` adds no TS extensions/aliases/paths; its `tsconfig: 'auto'` does nothing (import-x calls the directory-based `sync()`). `createTypeScriptImportResolver` lives in eslint-import-resolver-typescript, not import-x.
- oxlint 1.87 resolves TS imports (extensionless, `.js`→`.ts`, `paths` aliases) for its import rules with no settings.


## Merging into a team's configs (2026-10-11, fix round 1, scratchpad/fix-run/)
- oxlint 1.87 runs the `eslint` scope's rules whatever `plugins` lists. A plugin listed only in an override, or in a config extended as an object, still switches that plugin's `categories` on (measured).
- ESLint's `--cache` key stringifies each plugin from its top-level `name`/`version` first, then `meta.name`/`meta.version`; a plugin with neither keys nothing, so an upgrade can serve stale results.
- typescript-eslint marks its extension rules with `meta.docs.extendsBaseRule` (true = same name). oxlint's list of core rules typescript-eslint extends misses some (`only-throw-error` → `no-throw-literal`, `prefer-promise-reject-errors`, `prefer-destructuring`, `no-unused-private-class-members`); `recommendedTypeChecked` turns on `only-throw-error` and `prefer-promise-reject-errors`.
- A team block that turns type information off later (`disableTypeChecked`), or a typed block with `basePath`, makes any typed rule outside that scope throw for the whole ESLint run.
- `npm install` of our tarball beside eslint-plugin-react 7.37.5 and ESLint 10 fails with ERESOLVE (its peer range stops at ESLint 9).
- oxlint 1.87 overrides take `excludeFiles`. A `!glob` in `files` doesn't exclude: it also matches every file the glob doesn't. A plugin's rule statement only takes effect where that plugin is listed in the same place (root, or that override); elsewhere oxlint ignores it, `off` included. Once a plugin is listed at the root, an `off` stays off and a later override's `plugins` doesn't switch categories back on; when it isn't, a later listing does. With `extends`, oxlint adds its default plugins (`oxc`, `typescript`, `unicorn`) unless every config in the chain lists `plugins` (fix rounds 2–3 probes).
- typescript-eslint: only `project` or `projectService` set to false/null switches type information off; `program: null` alone does not, and `projectService: false` after a block typed through `project` leaves types on.
- An ESLint config block reads all its globs from its one `basePath`, so our globs can't ride on a team block's basePath; the team's globs are rebased onto the project root instead.
- oxlint 1.87's config resolution (oxc tag `oxlint_v1.87.0`, `crates/oxc_linter/src/config/config_store.rs` `apply_overrides`, `config_builder.rs`): extended configs merge their `plugins`, and one that omits `plugins` adds the defaults; in each file, the first matching override whose `plugins` differ from every plugin listed for that file switches categories on for the non-root plugins, filling only rules with no setting yet (so it can undo an earlier override's `off`). The merge is now derived from this code, and a differential test checks it against the CLI.
- antfu's ESLint config registers typescript-eslint's own plugin object as `ts` and our `@eslint-react` object as `react` (the prefix eslint-plugin-react normally takes).
- oxlint 1.87 reads a rule key with `parse_rule_key`: an `@`-scoped key is cut at its last `/`, any other at its first; the prefix
  goes through package-name normalisation and plugin aliases (`react_hooks`, `typescript_eslint`, `jsx-a11y-x`, `oxlint-plugin-*`,
  `@next`); a bare key is the first rule of that name in oxlint's plugin order (the order `oxlint --rules` lists them), which the
  catalog doesn't record. A prefix naming no oxlint plugin is a JS plugin's rule.
- @eslint-react 5.24.10 registers 53 rule modules under two names each (`x-no-missing-key` and `no-missing-key` are one object).
- `it.fails` passes on any thrown error: run a tool that can fail to load (oxlint) in `beforeAll`, so a crash fails the file.
- oxlint 1.87 refuses a path in the `extends` of a JS/TS config at any depth ("`extends[0]` must be a config object (strings/paths are not supported)"); the same config as JSON loads. Objects in `extends` are accepted.
- An oxlint override with `plugins: []` or `plugins: ["eslint"]` still counts as a listing that differs from the file's plugins, so it switches categories on for the non-root plugins listed for that file (e.g. react from an earlier override); an override with no `plugins` key doesn't (round 6 review probe).
- `@agents-inc/lint-rules`'s `exports` point at `dist`, so the integration tests always load the built package: a scratch copy for deliberate breaks must rebuild `dist`, or no break reaches those tests.
- `npm init` ignores `--prefix` and writes `package.json` (listing every package in `node_modules` as a dependency) into the
  current directory; run from the repo, it rewrote the untracked root manifest. Write scratch manifests with `printf`.
- `npm install` in a copy of this repo fails (`EUNSUPPORTEDPROTOCOL "workspace:"`). To run the suites against another oxlint:
  `npm install --prefix <empty dir> oxlint@<version>`, copy its `oxlint` and `@oxlint/binding-*` into the copy's
  `node_modules`, set the copy's oxlint peer range to admit that version, then `bun run build` there and run the suites.

## Merge rework (2026-10-14, scratch-backup/merge-model/)
- oxlint 1.87 runs a nursery rule once a config turns `nursery` on (`nursery: 'warn'` runs `no-unreachable-loop`). A code comment marked "measured", its oracle, that oracle's test and the spec all said it never does; no one had run the CLI.
- oxlint 1.87 reads a path in a JSON config's `extends` from the extending file's folder, comments and trailing commas allowed (`oxlint -c cfg/.oxlintrc.json --print-config`).
- Node 22.23 and 23.10, `require()` of an ES module (`.mts` too): two modules requiring each other throw `ERR_REQUIRE_CYCLE_MODULE`; one with top-level await throws `ERR_REQUIRE_ASYNC_MODULE`; a second `require()` of a file returns the cached module and runs none of its code again.
- typescript-eslint 8.71.1's `ban-ts-comment` with `ts-ignore: true` reports a `@ts-ignore` as "Use "@ts-expect-error" instead", whatever `ts-expect-error` is set to.
- ESLint 10.12's `defineConfig` keeps any key (`defineConfig({ private: true })` returns it as a block), so it cannot tell a `package.json` from a config; a code comment said it refused non-configs. oxlint 1.87 refuses a top-level key its schema lacks ("unknown field `foo`") in JSON and JS configs alike, and loads `$schema` in both.
- A break-a-line pass by hand, rebuilding `dist` and running the full suite per break, costs ~3 min a break: the rework's 69 would have taken ~3.5 h and were stopped (owner: try StrykerJS).

## StrykerJS (2026-10-14, [mutation testing](mutation-testing.md))
- `@stryker-mutator/vitest-runner` 10.0.0 joins suite and test names with a space, and Vitest 5 matches `describe > test`, so every mutant run filtered by test name runs no test and is reported Survived (stryker-js #6210, open; its fix PRs #6214, #6220 and #6247 unmerged). `patches/` carries a two-line fix through `patchedDependencies` in the root `package.json`: drop both when a Stryker release fixes #6210.

## Answers build, core lane (2026-10-15, scratch-backup/answers-build/core-*/)
- eslint-plugin-react 7.37.5: where `detect` finds no React it assumes `999.999.999` (`ULTIMATE_LATEST_SEMVER`, `lib/util/version.js`, not exported), warns once per process and caches the version (`warnedForMissingVersion`, `cachedDetectedReactVersion`; a test resets both with `resetWarningFlag` and `resetDetectedVersion`, or an earlier run makes a console check pass vacuously). `999.999.999` given outright behaves the same and prints nothing.
- oxlint 1.87 honours a suppression of a rule it runs under another name only in its own spelling (`unicorn/no-array-for-each`, not `unicorn/no-for-each`), which unicorn 77 does not define, so ESLint needs a stub under that name.
- typescript-eslint 8.71's project service is one per process (`createParseSettings.js`: `TSSERVER_PROJECT_SERVICE ??=`): the first config parsed fixes `allowDefaultProject` and the default project's options for every later config, and the 8-file limit counts across the process. Its default project reads the root `tsconfig.json` (`defaultProject`). So a default project cannot be set per project: one ESLint run over a monorepo's packages failed a later package's files, a tsconfig we shipped as `defaultProject` included (measured 2026-10-15).
- The imported-only trap: a file no tsconfig lists, but that a file a tsconfig takes in imports (`oxlint.config.mts` → `./agents-inc.lint.mts`), is in the project service's program through the importer, so naming it in `allowDefaultProject` is the fatal "was included by allowDefaultProject but also was found in the project service".
- TypeScript 6.0.3 loads no `@types/*` package a tsconfig's `types` does not list: `import.meta.dirname` is then an error type, which typed rules report (`no-unsafe-assignment`), even with `@types/node` installed.
- Node 22.23's `path.matchesGlob` prints an ExperimentalWarning, so the basePath reading matches globs itself.
- eslint-import-resolver-typescript 4.4.5 given several tsconfigs (`project`) prints a warning once per process unless `noWarnOnMultipleProjects`; given none, it reads the tsconfig in the process's cwd, if any; and where any path given holds glob syntax (`[id]`), it reads every path as a glob (`normalize-options.js`).

## `check` and `init` (2026-10-15, scratch-backup/answers-build/cli-*; probes: cli-docs/probes.sh)
- oxlint 1.87's `-f json` carries no fix data, so its `--fix` cannot be kept to some lines: `check` guards the result instead.
- Node 18 fails a static named import that a built-in module lacks (`findPackageJSON` from `node:module`) at link time, before any line runs; the bin checks the Node floor, then imports the rest dynamically.
- `findPackageJSON` (Node 22.23) returns a symlinked package's path through the link: compare real paths.
- Each oxlint code (`plugin(rule)`) names one RuleId in the catalog (command: spec-cli.md, Commands).
- `git add --intent-to-add` writes the empty blob into the repo's objects even under a scratch `GIT_INDEX_FILE`; a scratch `GIT_OBJECT_DIRECTORY`, with the repo's objects as an alternate, keeps it out.
- oxlint's spans count UTF-8 bytes (`offset`, `length`). Its unused-suppression report names no rule: its span covers the unused name, or the whole comment where every name in it is unused (K-23 spike).
- oxlint labels a duplicate (`no-dupe-keys`, `no-duplicate-case`) at each place, the earlier first.
- oxlint refusing its config prints the reason from the third line, after `Failed to parse oxlint configuration file.` and a blank line.
- oxlint never lints a `*.min.js` file, even with `--no-ignore` ("No files found to lint").
- Node 23.10 prints an `ExperimentalWarning` for type stripping on importing a `.mts` file; 22.23 prints nothing.
- ESLint lints on the main thread, so a SIGINT or SIGTERM handler waits for it: seconds at high load (real run).
- Without a TTY, `npx <bin>` fetches a missing package of that name from the registry without asking (npm 10.9.8): where ours is not installed, `npx agents-inc-lint` asks for `agents-inc-lint`, a name nobody holds (real run, review).
