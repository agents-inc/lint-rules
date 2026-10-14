# Spec: applying the owner's 2026-10-11 answers (precedence, the ESLint-only fallback, loading)

Drafted 2026-10-11 by pm, for `docs/work/spec-owner-answers.md`. It amends
[spec-agent-editor-sets](spec-agent-editor-sets.md). The owner's answers are the last entries of
[decisions](decisions.md). Four read-only research reports (R1 oxlint range, R2 typed rules on
tsconfig files, R3 fallback plugins and the typescript-eslint preference, R4 merge precedence) are
the evidence. Their scratch files are under `scratchpad/` and may vanish. Each figure below is given
as the command that produces it, under [Commands](#commands).

## What changes for a user

- **The team's own configs win.** If a team's `eslint.config.mjs` or `oxlint.config.mts` sets one of our rules, under any of its names, the team's setting applies in the files where it sets it. This includes `off` and its own options. Everywhere else our editor set applies.
- **Turning a rule off in `agents-inc.lint.mts` only turns ours off.** The same goes for `ignores`. The team's own setting of that rule, under any name, is untouched.
- **A rule never runs twice.** It is recognised under every name it has: alias, old name, the second name a plugin registers it under, a team prefix such as `ts/`.
- **A monorepo package whose own package.json does not list oxlint uses ESLint only**, even when the root lists oxlint.
- **The oxlint merge accepts any oxlint 1.x from 1.86 (or 1.87, see C2).** It refuses one that lacks a rule name the merge may write, and says which names are missing.
- **Teams without oxlint get ESLint versions of 76 more of our oxlint rules**, through four new plugin dependencies.
  - On TS files they get typescript-eslint's version of eight core rules.
  - What still differs from an oxlint team: 18 `oxc/*` rules and 2 react-hooks rules (see Corrections).
- **Typed rules run only on files a tsconfig includes**, for agents and editors. A stray `.ts` file outside every tsconfig no longer gets a fatal parse error that switches off every rule in it.

**Goal:** apply the owner's precedence model and his fallback and loading answers to the editor merges and the agent build, each change fenced and checkable.

**User story:** As a team merging the editor set into my own lint configs, I want my settings to win wherever I state them, and no rule to report twice, so adopting the editor set never overrides or duplicates what my team already decided.

## What this amends in spec-agent-editor-sets.md

| There | Now | Why |
| --- | --- | --- |
| §2 "Our settings win for every rule ID our ESLint part states": deleted from team blocks, ours after theirs | Ours first, team blocks after and untouched; ours left out of every file where the team sets the rule | Owner: "theirs should override whenever there is a conflict" (#32 D4 reversed) |
| §2 off-switch: every other ESLint name of each rule either part states, off after everything | Only the cross-engine part stays (Q-C default), and only for rules the other part *runs* | #42 reversed: our off only removes ours |
| §3 catch-all after the team's overrides | Ours first in line; the team's overrides after; no `off` of ours | Owner model; R4 probe o10 |
| D2 (a `rules` off is stated off over the team's) | Removed | #32 D2 reversed, #42 |
| D4 (a rule our part states is decided only by ours, everywhere) | Removed | #32 D4 reversed |
| Must have 4: walk up until one package.json lists oxlint | The nearest package.json decides | #32 D1, #40 |
| §5 the 8 core rules with a typescript-eslint extension are skipped | Without oxlint: the extension on TS files, the core rule on JS | #39, #32 Q4 |
| Q7: `~1.87.0` | `^1.86.0`, with a name check | #32 Q7 |

---

## The precedence contract

**Layers, lowest first:**
1. Our rulesets' shipped settings (`editorRulesets`).
2. `agents-inc.lint.mts`: `rules`, `fileOverrides`, `ignores`.
3. The team's `eslint.config.mjs` / `oxlint.config.mts`.

The agent set uses layers 1 and 2 only and never reads layer 3.

**Same-rule names of a rule R:**
- R itself.
- In ESLint, the other names the catalog records for it (`otherEslintNamesOf`, `catalog-lookups.ts`): aliases, a renamed rule's old name, the other name a plugin binds the same module to, and an oxlint spelling that is an ESLint rule ID.
- Each of those under a prefix the team registers one of our plugins under (`prefixesOfOurPluginsIn`, `merge-eslint-config.ts`).
- In oxlint, every key `parse_rule_key` reads as R (`oxlintRuleKeyed`, `merge-oxlint-config.ts`).
- A typescript-eslint **twin** (`twinsOf`) is another rule, not a same-rule name.

**The team sets R in a file f:**
- ESLint: a team block that applies to f states a same-rule name of R, at any severity, `off` included.
- oxlint: a statement oxlint counts (Q-B), in the resolved root or in an override matching f. Categories do not count (Q-A).

### ESLint merge, per file

| What | Result in file f |
| --- | --- |
| R our ESLint part states; the team sets R in f | Every same-rule name has the entry the team's config alone gives it, options included. Ours of R does not run in f. |
| R our ESLint part states; the team does not set R in f | Ours, as our part alone gives it |
| R we state only `off` (top-level `rules`, an entry, a dropped ruleset, `ignores`) | Ours absent; the team's as its config alone gives |
| A team twin T of a rule R ours runs in f | T off in f (#41, kept). Ours does not run where the team sets R, so T is the team's there. |
| A rule we do not state | The team's config alone (#44, kept) |
| Beside oxlint: any ESLint name of a rule our oxlint part runs somewhere | Off in every file, after the team's blocks (Q-C default: today's off-switch, minus rules our oxlint part only states `off`) |
| Files our `ignores` match | None of our rules; every team rule as its config alone gives (derived default D-a) |
| `languageOptions` (parser, parserOptions, globals), `settings`, `linterOptions` | The team's per key wherever its block sets that key; ours elsewhere (Q-E default). `reportUnusedDisableDirectives` is `off` beside oxlint unless the team sets it. `noInlineConfig` is never ours. |
| Plugin object under a shared prefix | One object, ours as the module for each rule we run (Q-F default, today's) |
| A name under a prefix where the team registers a *different* plugin than ours (antfu's `react` holding @eslint-react) | If our blocks state that exact name, it stays ours, as today (Q-F default) |
| Typed rules | As today where the team gives type information. Otherwise ours only in TS files a tsconfig includes (C3). |

**Block order:**
1. Ours: base, typed, scopes, entries, each rule confined as above, and no global-ignores block.
2. The team's blocks exactly as `defineConfig(theirs)` returns them, except that each plugin object is swapped for the shared one.
3. Ours again: the cross-engine off-switch (beside oxlint), then the twin switches.

### oxlint merge, per file

| What | Result in file f |
| --- | --- |
| The team's resolved root (its own and every object it extends) states R under any spelling, its plugin listed there or R in the eslint scope | The team's everywhere. Ours of R dropped from every override of ours (R4 probe o1). |
| A team override (own or extended object) states R, matching f, its plugin counting there | The team's in f. Ours sits before it in line (R4 o2, o4, o6). |
| A team category runs R; ours runs R in f | Ours (Q-A default) |
| R we state only `off`, or not in f | Not written. The team's config alone holds there, categories included (R4 o10). |
| An ESLint-run rule of ours that oxlint has | Off in every file, after every team override (Q-C default, R4 o9). Only rules the ESLint part runs somewhere. |
| Files our `ignores` match | `excludeFiles` of each override of ours. The team's `ignorePatterns` stay exactly the team's (D-a). |
| `options` | The team's keys; `reportUnusedDisableDirectives: 'off'` only where the team leaves it out (Q-E) |
| `env` | Ours, less every key the team's resolved root env sets. A team override's env after ours wins in its files (Q-E). |
| `categories`, `rules`, `globals`, `settings`, `jsPlugins` | The team's, untouched |
| `plugins` | Every plugin listed, as today, with today's compensations putting back what that changes for the team |

**Override order:**
1. The compensations (`offWhereTheRootRunsThem`, `categorySwitchesOf`, as today).
2. Ours: on-statements only.
3. The team's extended overrides.
4. The team's own overrides, with ignored statements dropped (as today).
5. The cross-engine offs.

Where the team extends objects, items 1–2 go in a first extended config (`placedFirstInLine`), as the compensations do today. Beside a config extended by path, the same order applies to what the merge can see (D-g).

---

## Lanes

Four lanes, no file owned twice. Shared existing files under `src/__tests__/` are frozen unless a lane lists them; a lane adds new helpers in new files it owns. A change needed in another lane's file is reported, not made. All paths are under `packages/lint-rules/` unless they start with `packages/` or name the root.

### Lane A1: the ESLint merge and the editor parts

**Owns:**
- `src/core/merge-eslint-config.ts`, `src/core/editor-parts.ts`, `src/eslint.ts`
- Tests: `src/merge-eslint-config.test.ts`, `src/merge-eslint-config.integration.test.ts`, `src/editor-equivalence.test.ts`, `src/editor-parts.test.ts`
- Helpers: `src/__tests__/eslint-config-oracle.ts` (and its test), `src/__tests__/other-eslint-names.ts` (and its test), `src/__tests__/factories/eslint-merge-factories.ts`, `src/__tests__/factories/team-config-factories.ts`
- Cases: `src/__tests__/cases/editor-merge-sources.ts`, `eslint-merge-sources.ts`, `team-eslint-projects.ts`
- New: an ESLint differential test (suggested `src/merge-eslint-config.differential.test.ts`) and its helpers in new files

**Must:**
1. Put our blocks first and the team's after, as `defineConfig(theirs)` returns them. Delete no team rule entry, except a Q-F collision name.
2. Leave ours out of every file where the team sets R. This must be exact, options included.
   - Measured: a later bare severity keeps an earlier block's options, and an `off` block between does not reset them (spec §2; R4 e1).
   - Building blocks measured exact:
     - Ours off in a team block's own scope, by copying its `files`, `ignores` and `basePath`, for a different name of R (R4 e3).
     - Dropping R from ours where a team block naming no files states it.
     - Static blocks of our scope AND NOT the team blocks' scopes, one per DNF term (R4 e6). Group rules by the set of team blocks that state them, so blocks do not multiply per rule.
   - A team block whose `files` or `ignores` holds a function cannot be expressed in globs: pin it as a known gap with `it.fails`.
3. Our `off` statements and our `ignores` only remove ours. Remove `withRulesTurnedOffStated` from `editor-parts.ts`; the open `rules` question keeps today's projection otherwise. Our ignores go on our blocks, with no global-ignores block.
4. Cross-engine (Q-C default): beside oxlint, keep a last block turning off every ESLint name (ID, aliases, other names, team-prefix names) of each rule the oxlint part *runs* somewhere (`ruleIdsOnIn`, not `ruleIdsStatedIn`). For the oxlint part, restrict `offInOxlint` to the rules the ESLint part runs.
5. Twins (#41): the team's twin T of R is off exactly where ours runs R. This now excludes files where the team sets R.
   - Twin switches go after the team's blocks.
   - The rule that a twin our part states itself is not the team's (`teamTwinsOf` filters `ourRuleIds` globally) becomes per file. Without oxlint our part states the core rule on JS and its twin on TS (C4), so a team's `@typescript-eslint/no-unused-vars` on a JS file must be off where our core rule runs (R3's precedence gotcha).
6. Without oxlint, there is no `agents-inc/aliases-off` block.
7. Wire Lane C's interfaces:
   - Pass the files outside every tsconfig into `TypeInformation`'s `'ours'` case, computed lazily at the `eslint.ts` boundary only when no team block gives type information.
   - Set C's twin flag to `!part.usesOxlint`.
   - Import `literalGlobOf` from `globs.ts` and delete the local copy and `GLOB_SYNTAX`.
8. Write the ESLint differential (a guard is not a feature):
   - Pairwise shapes of team blocks: files, ignores with `!`, `basePath`, bare and full entries, `off`, alias, old name, same-module name, `ts/` prefix, twin.
   - Pairwise shapes of ours: top-level, an entry on, an entry off, `ignores`.
   - Compare **full calculated entries** (`calculateConfigForFile`) per file and name against an oracle built from the team alone and ours alone, using the table above.
   - The oracle reads same-rule names from `other-eslint-names.ts`, never from `merge-eslint-config.ts`.

**Must NOT:**
- Change the agent build's output.
- Put a function in any `files` or `ignores` (Q-D), or use a cast.
- Change type-information handling for a team that gives types.
- Edit `build-eslint-config.ts` (Lane C): report what is needed.
- Turn a team's twin off where ours does not run.

### Lane A2: the oxlint merge

**Owns:**
- `src/core/merge-oxlint-config.ts`
- `src/core/build-oxlint-config.ts`: additive exports only. `buildOxlintConfig`'s output must not change.
- `src/merge-oxlint-config.test.ts`, `src/merge-oxlint-config.integration.test.ts`
- `src/merge-oxlint-config.differential.integration.test.ts`, `src/merge-oxlint-config.beside-a-path.differential.integration.test.ts`
- `src/__tests__/cases/oxlint-merge-shapes.ts`, `oxlint-team-project.ts`
- `src/__tests__/oxlint-codes.ts`, `oxlint-config-oracle.ts`, `oxlint-part-alone.ts` and their tests
- `src/__tests__/factories/shape-factories.ts`, `src/__tests__/pairwise-shapes.ts` and its test

**Must:**
1. Apply the oxlint table and override order above.
2. Write no `off` of ours, except the compensations and the cross-engine offs.
   - Each rule of ours is on exactly where our part alone runs it, with that part's options there, through `files` and `excludeFiles` (all OR lists, so exact; R4 o10).
   - Drop `oxlintNamesStatedOnlyInEntries` (O3) and `offUnderItsIgnores` in the merge.
3. Drop R from all of ours where the team's resolved root states it effectively (O2).
4. Path branch (`mergedBesideAConfigOutOfSight`):
   - Same order for the team's visible root and own overrides.
   - Drop `catchAllRestatedUnderItsListing`: it exists only for our `off`.
   - Statements inside the path-extended file stay out of sight (#43, kept), pinned as a known gap.
5. Replace the differential oracle `oxlintCodesStatedBy` (any severity, every file) with R4's per-file split. Per file f and code c:
   - **The team's findings** where the team sets c in f, or where our part alone does not run c in f.
   - **Ours** otherwise.
   - **Codes our ESLint part runs:** none, in every file.
   - "Ours runs c in f" comes from `oxlintSeverityFor(oxlintPartAlone(part), f, name)`.
   - "The team sets c in f" is a statement-only model of `apply_overrides`, written independently of `merge-oxlint-config.ts`.
6. Add dimension values: team statements of an oxlint-run rule our part states (at the root, extended root, listing override, non-listing override, extended override, as `off`, under another spelling, ignored); our `ignores`; our entry turning a rule off.
7. Delete the describe "mergeOxlintConfig, given a project's installed oxlint" once Lane C's new test file holds its cases.

**Must NOT:**
- Read or refuse a path in `extends` (#43).
- Count categories or ignored statements as the team setting a rule (Q-A, Q-B).
- Spawn oxlint at merge time.
- Change the compensations' behaviour for rules we do not state.
- Edit `installed-oxlint.ts` or `oxlint.ts` (Lane C).

### Lane B: rule data, the four plugins, the fallback proof

**Owns:**
- All of `packages/rule-data/`. Generated files change only through `bun run --cwd packages/rule-data generate`.
- `packages/lint-rules/package.json` and the root `bun.lock` (the install)
- `test-fixtures/eslint-fallback/`
- `src/eslint-fallback.integration.test.ts`, `src/__tests__/eslint-versions.ts` (and its test)
- `src/dist-loading.test.ts`, `src/__tests__/record-resolved-modules.ts`
- `src/core/eslint-compat.ts` (only if a plugin crashes), `src/eslint-plugin-registry.ts` (only if the registry needs it)

**Must:**
1. **First, before any other lane depends on it:** edit both manifests and run the install.
   - Add `eslint-plugin-jsx-a11y` 6.10.2, `@vitest/eslint-plugin` 1.6.27, `eslint-plugin-react-hooks` 7.1.1 and `eslint-plugin-react-perf` 3.3.3 as exact dependencies of `rule-data` and `lint-rules` (latest on npm, 2026-10-11).
   - Make Lane C's peer changes in `lint-rules/package.json`:
     - `oxlint: ^1.86.0`, or `^1.87.0` if C2's 1.86 run fails.
     - A `typescript` peer with typescript-eslint's own peer range, read with `npm view typescript-eslint@8.71.1 peerDependencies`.
2. Register the four plugins:
   - In `eslintPlugins` under `jsx-a11y`, `vitest`, `react-hooks` and `react-perf`, through `checkedPlugin` where their types do not fit.
   - In `eslintPluginPackageNames`.
   - Add a prefix to `PREFIXES_NEEDING_COMPAT` only on a measured crash; R3 measured none.
   - Regenerate.
3. Prove every newly moved rule (the fallback test iterates the catalog):
   - A fixture per rule, copied from the gate's `tests/lint-fixtures/fixtures.json` and re-keyed by canonical ID.
   - New fixtures for `react-hooks/error-boundaries` (JSX inside try/catch) and `react-hooks/use-memo` (a `useMemo` callback with a parameter, and an async one). R3 measured these shapes firing.
   - A skip entry with its measured reason for `react-hooks/rule-suppression` (fires only with options oxlint refuses) and `react-hooks/preserve-manual-memoization` (7 shapes silent in both engines), and for any other rule whose fixture does not fire.
4. The 8 moved core rules with a current typescript-eslint extension leave the skip list (#39). Rewrite the skip-list assertions (below).
5. Ship `max-params` with `[{ "max": 4 }]` in place of `[4]` in `data/rules.json`.
   - Measured: `@typescript-eslint/max-params` refuses `[4]` with a config error ("Value 4 should be object"). Core `max-params` and oxlint 1.87 accept the object form.
6. Restructure the fallback proof for twinned rules: for each pair, the twin fires on a TS fixture and the core rule on a JS fixture, without oxlint. Add the missing JS or TS fixture per pair.
7. Add `@vitest` and `typescript` to the module guard in `dist-loading.test.ts`. Both are now ESLint-side packages; what the test proves is unchanged.

**Must NOT:**
- Ship any of the rule IDs the new plugins add. They become `RuleId`s a consumer may set in `rules`, which the owner's "rules accepts any rule of the plugins we ship" already covers.
- Change any rule's engine or ruleset, or any options other than `max-params`'.
- Add `oxc/*` substitutes (O10), an ESLint-only options field (O11), or the jsx-a11y fork (O13).
- Change import-x resolver settings (questions #33).

### Lane C: loading, typed rules, the twin blocks

**Owns:**
- `src/core/project-uses-oxlint.ts` (and its test), `src/core/package-json-files.ts`, `src/core/installed-oxlint.ts`, `src/oxlint.ts`, `src/index.ts`
- `src/core/build-eslint-config.ts` (and its test), `src/core/globs.ts` (and its test), `src/core/catalog-lookups.ts`
- New: a module computing the TS files outside every tsconfig (suggested `src/core/ts-files-outside-every-tsconfig.ts`) and its test
- New: the installed-oxlint test file (suggested `src/merge-oxlint-config.installed-oxlint.test.ts`)
- New: an agent-build integration test for a stray TS file
- `src/__tests__/agent-configs.ts`, `src/__tests__/factories/package-json-factories.ts`
- `src/editor-configs.integration.test.ts` and `test-fixtures/consumer-files*/`, `tsdown.config.ts`, `src/dist.test.ts`

**Must:**

**C1 Nearest package.json decides (#32 D1, #40).**
- `projectUsesOxlint` reads only the first package.json from `tsconfigRootDir` up. Oxlint is in use when that file lists oxlint under `dependencies` or `devDependencies`.
- No package.json anywhere means no oxlint. A malformed nearest file throws, naming it. Nothing above the nearest is read.
- Error text and doc comment, verbatim:
  - `mergeOxlintConfig`: `oxlint.config.mts: the package.json nearest to tsconfigRootDir does not list oxlint under dependencies or devDependencies, so there is no oxlint part to merge`
  - `DefinedLintRules` in `index.ts`: "`oxlint` is undefined where the package.json nearest to `tsconfigRootDir` does not list oxlint."

**C2 The oxlint range (#32 Q7).**
- Parse the caret range our manifest gives; `isInTildeRange` today throws on anything but `~x.y.z`.
- An installed version outside the range keeps today's message: `oxlint.config.mts: the oxlint installed for <dir> is <version>, outside the range @agents-inc/lint-rules supports (<range>)`.
- Inside the range, read `configuration_schema.json` next to the resolved `oxlint/package.json`. It is in `files` of every release, not in `exports`. Rule keys are under `definitions.DummyRuleMap.properties`; plugin names are the enum of `definitions.LintPluginOptionsSchema`.
- Refuse when it lacks any `oxlintName` in `catalog.oxlintRules`, or any plugin of those rules. Those are every name the merge can write: the compensations range over the whole catalog (R1, corrected; D-c). Message: `oxlint.config.mts: the oxlint installed for <dir> is <version>, which has no rule or plugin named <sorted names, comma-separated>; @agents-inc/lint-rules writes these names, so oxlint would refuse the merged config: install another oxlint within <range>`
- An unreadable schema, or one of another shape, is refused: `oxlint.config.mts: the oxlint installed for <dir> (<version>) has no rule list @agents-inc/lint-rules can read at <path>, so it cannot check that oxlint knows every name the merge writes: install another oxlint within <range>`
- Read the schema at most once per process for each installed oxlint path.
- The floor: `^1.86.0` when both oxlint differential suites pass against oxlint 1.86.0 in a scratch copy (step 6); otherwise `^1.87.0`. A one-off run in scratch is verification, not a new workflow.

**C3 Typed rules only on files a tsconfig includes (#36 b, #3).**
- The new module lists the TS files (`**/*.{ts,mts,cts,tsx}`) under `tsconfigRootDir` that no tsconfig takes in. It copies the project service's own search, nearest first (R2):
  - `tsconfig.json`, then `jsconfig.json`, in each directory up to `tsconfigRootDir` and no higher.
  - A config counts if it, or a config it references transitively, includes the file.
  - References are skipped under `disableReferencedProjectLoad`.
  - Only the nearest config before TypeScript 5.7; every ancestor from 5.7.
- It uses the TypeScript instance typescript-eslint resolves, kept out of `dist/`.
- It skips `node_modules`, `.git` and unreadable directories. R2's walk threw EACCES on `~/dev/ai-benchmarking`.
- `TypeInformation`'s `'ours'` case carries the list. Every block that can run a typed rule ignores the escaped literal paths beside `CONSUMER_CONFIG_FILES`: one helper replaces the three uses in `typedBlocks`, `ruleIgnoresOf` and `entryTypedBlocksIfNotEmpty`.
- `buildEslintConfig` takes the list as a parameter, so it stays pure.
- Move `literalGlobOf` and `GLOB_SYNTAX` into `globs.ts`.

**C4 The typescript-eslint preference without oxlint (#39, #32 Q4).**
- `EslintBlocksSource` gains a flag; A1 sets it to `!part.usesOxlint`, and the agent build sets it false.
- With the flag on, for every stated core rule ESLint takes over from oxlint that has a current typescript-eslint extension, in every block that states the core rule (base, scope, entry):
  - TS files get the extension with the core rule's setting, and the core rule off.
  - JS files keep the core rule.
- Pairs come from `catalog.coreRuleExtensions` less the extensions recorded as aliases, which are the deprecated ones. No rule is named in code (`names-no-rule.test.ts`).
- A typed extension (today `prefer-destructuring`'s) runs only where types exist (the typed blocks); the core rule runs elsewhere (D-f).
- Where the options given are ones the extension refuses, the core rule keeps running on TS files there instead of a config error (D-e).

**C5** Move the installed-oxlint cases out of `merge-oxlint-config.test.ts` into C's new file, rewritten for the new range: below, above, inside, the installed version, a missing name, an unreadable schema. Its fake install writes a schema too.

**Must NOT:**
- Add a flag, config key or export.
- Use `allowDefaultProject`, a function matcher, or a cast.
- Spawn `oxlint --rules` (that is option E, an open question).
- Change any rule's engine.
- Apply C4 beside oxlint or to ESLint-routed core rules (O12).
- Edit the merges (A1, A2).

### Order between lanes (keep it in the written queue)

1. B1, the manifests and the install, before C2's tests can pass and before B2–B6.
2. C lands the `EslintBlocksSource` and `TypeInformation` fields, and `literalGlobOf` in `globs.ts`, before A1 wires them.
3. C5's file holds the version cases before A2 deletes the old describe.
4. B6's pair proofs turn green only after C4 and A1's flag.
5. Then CLAUDE.md steps 5–8: the expressive-TS pass; the run for real, including C2's 1.86 run; review; docs.

Each lane writes its tests first and watches them fail.

---

## Success criteria

| # | Criterion | How to verify |
| --- | --- | --- |
| **A1-1** | Where the team sets a rule we state, under any same-rule name, each name's calculated entry in its files equals the team config alone's, options included; elsewhere ours | The new ESLint differential (full entries); unit cases for ID, alias, old name, same-module name, `ts/` and `react` prefixes |
| A1-2 | Our `off` (any layer) and our `ignores` leave every team setting of that rule, under every name, as the team's config alone gives it | Unit tests per layer, each beside an allowed case where ours runs |
| A1-3 | No two same-rule names on in one file, in any differential shape | Differential assertion |
| A1-4 | Twins: every existing twin test passes unchanged; the team's `@typescript-eslint/no-unused-vars` is off on JS where our core rule runs without oxlint, and the team's own on TS | `merge-eslint-config.test.ts` twins describe plus a new case |
| A1-5 | Beside oxlint, the ESLint names of a rule our oxlint part runs are off; of one it only states `off`, they are the team's | Existing cross-engine tests; a new case |
| A1-6 | The team's `reportUnusedDisableDirectives`, parser and settings stand in its files; unset, ours applies | New unit tests |
| A1-7 | Merged order: ours, then the team's blocks deep-equal to `defineConfig(theirs)` but plugin objects, then cross-engine offs and twin switches | Unit test on the merged array |
| A1-8 | The merge adds no fatal message the team config alone lacks | Existing integration tests |
| **A2-1** | Every differential shape: merged findings equal the per-file owed findings; G2, G3 and the path D1 stay pinned. If the new order fixes one, its `it.fails` turns red and is converted, with a report. | `bun run --cwd packages/lint-rules test merge-oxlint-config` |
| A2-2 | The merged config holds no `off` of ours but compensations and cross-engine offs | A unit test walking our overrides |
| A2-3 | Team root, own override and extended override win; the path case is a pinned #43 limit | `merge-oxlint-config.integration.test.ts` |
| A2-4 | The agent oxlint config is unchanged | `core/build-oxlint-config.test.ts` unchanged and green; a dump of `buildOxlintConfig` for the every-ruleset config, before and after, diffs empty |
| **B-1** | The four plugins are registered and match their installed versions; the generated files are fresh | `eslint-plugins.test.ts`, `generated-files.test.ts` |
| B-2 | Without oxlint, only `oxc/*` rules lack an ESLint version | The §5 count command with `== null`, grouped by prefix (Commands) |
| B-3 | Every moved rule fires on its fixture or has a measured skip reason; no skipped rule runs | `eslint-fallback.integration.test.ts` |
| B-4 | No moved core rule with a current extension is skipped | `eslint-fallback-skips.test.ts` |
| B-5 | Each twin pair: the twin fires on TS, the core on JS, no fatal message | The fallback proof |
| B-6 | `index` and `oxlint` entries still load no ESLint-side module, `@vitest` and `typescript` included | `dist-loading.test.ts` |
| B-7 | `npm install` of the packed tarball into a scratch ESLint 10.12 project exits 0 with one ESLint (warnings recorded) | Step 6, tracked in a file |
| **C-1** | Nearest package.json decides, in each case listed in C1 | `core/project-uses-oxlint.test.ts` |
| C-2 | Range plus name check: accepts 1.86.0 (if floor), 1.87.x and 1.99.0 with a full schema; refuses 1.85.x and 2.0.0 with today's text; refuses a missing name or an unreadable schema with the verbatim texts | C5's file |
| C-3 | Both oxlint differential suites green against oxlint 1.86.0 | Scratch copy with `oxlint@1.86.0` installed and `dist` rebuilt (Commands) |
| C-4 | The tsconfig computation matches typescript-eslint's project service, file for file, on generated layouts covering every shape in C3, and on this repo's own tree | New test comparing against the real project service |
| C-5 | A TS file outside every tsconfig: no fatal message, every untyped rule fires, in the agent build and through `mergeEslintConfig` with a team giving no types | New agent integration test; S11 comparison extended; `build-eslint-config.test.ts` "leaves out the config files…" table gains such a file |
| C-6 | Without oxlint: twin on TS, core on JS, in base, scope (`no-unused-vars`' ignores) and entry blocks; typed twin only in typed files; consumer `max-params: ['error', 5]` gives no config error | `build-eslint-config.test.ts` |
| C-7 | `dist/` imports nothing undeclared | `dist.test.ts` |
| **All** | Typecheck and tests green; no suite collects zero tests | `bun run build`, `bun run typecheck`, `bun run test` (turbo `--force`) |
| All | Agent set unchanged except the typed-block ignores | `gate-equivalence`, `engines`, `suppression-ban`, `file-overrides` tests unchanged in assertion |
| All | Nothing outside scope changed | `git -C ~/dev/ai-benchmarking status --short` the same before and after; `~/dev/cli` untouched |

**Non-functional (measure and report the command and figure):**
- The tsconfig computation on this repo: median of 3 under 100 ms (R2 measured it near 33 ms).
- The name check: once per process (R1 measured about 6 ms).
- `dist/eslint.mjs` import time before and after the four plugins.
- ESLint time over this repo's `src` with the merged every-ruleset config beside typescript-eslint `recommendedTypeChecked`, before and after. Over +25% goes to the owner before merging.

---

## Existing assertions the owner's decisions make wrong

Only these may change (CLAUDE.md: a decision made the old assertion wrong). Every other existing assertion stays.

**`merge-eslint-config.test.ts` (A1). Reason, unless noted: the team's setting now wins (#32 D4).**
- "a rule our part states, which the team sets too" (with the describe's "Deleting is required" comment):
  - "runs, with our options, where the team turned it off": now nothing is reported.
  - "runs with our options where the team gave others": now the team's options.
  - "runs eqeqeq with our options where the team gave smart…": now `== null` is not reported.
  - "is ours alone in every file…": now the team's `max-lines {max:1}` in `.ts` and `.tsx`.
  - "…when only an entry of ours states it": now the team's in both files.
  - "is off everywhere where our top-level rules turn it off": now the team's error (#42).
  - Kept: "turns the team's eqeqeq off in ESLint… lists oxlint" (Q-C).
- "an alias of a rule our part runs", both tests: change **only in the project without oxlint** (now the team's `import/first`, with its own options). With oxlint, `import-x/first` is oxlint-run, so the alias stays off (Q-C).
- "another ESLint name…":
  - The walk: `stillOn` becomes the names of rules our ESLint part states, plus rules either part states only `off`; with oxlint, names of rules our oxlint part runs stay off. `walked` is unchanged.
  - The two `TWINS_OXLINT_DOES_NOT_SPELL` rows marked `'skipped'`, and "decides typescript-eslint's twin of no-unused-vars" in the project without oxlint: no longer skipped (#39). Our part runs the twin on TS, and the team's same-name statement decides there.
  - "is off for unicorn's old name of no-for-each": now the team's old name stays on.
  - "…deprecated no-loop-func… where an entry turns ours off too": changes only without oxlint (now the team's error).
  - The small-catalog `n/no-process-exit` case: now the team's `node/no-process-exit` error, both cases.
- "another name a plugin of ours binds…":
  - The walk: still on.
  - "reports a finding… once, under our name": now under the team's name.
  - "…our top-level rules turn our name off": now the team's error (#42).
  - The allowed-cases test: `@eslint-react/no-missing-key` becomes error; the other two are unchanged.
- Twins describe, "…while the same rule's alias is off": `import/first` becomes error in both projects. Our rule is off-only, so nothing reaches across engines (#42).
- "a plugin of ours, which the team registers under a prefix of its own":
  - "…ours alone deciding the rule": the team's `ts/array-type` error, ours off.
  - "…a rule our top-level rules turn off": the team's error.
  - "…a rule only our off-switch states": only without oxlint, both names error.
  - "…named as ours at its top level": the team's error.
  - "…the very object… carries no name": the team's error.
- "our @eslint-react plugin, which the team registers under react":
  - "is off in every file under its name for an @eslint-react rule our part states…": the team's error, ours off.
  - Both "reports a finding… once, under our name": now under the team's name.
  - "…our top-level rules turn off": the team's error.
  - "is off under its name for an @eslint-react rule… whose name eslint-plugin-react has too…": the team's error, reported once under its name.
  - Both "…the other name of an @eslint-react rule…": the team's error.
  - Kept: "keeps our eslint-plugin-react rule of a name @eslint-react has too…" (Q-F default).
- "loses our rule IDs set in a config it extends: ours decide them": now the team's `off` wins.
- "the merged blocks", all three: ours first, then the team's; no `agents-inc/ignores` (D-a); no `agents-inc/aliases-off`.

**`editor-equivalence.test.ts` (A1).**
- "runs every ESLint-routed rule and every moved rule not skipped…" (no oxlint): the expected list gains each extension run on TS in place of its core rule (#39).
- "turns off the aliases of every rule it runs": removed. Other names are now the team's to set (#42), and A1-1 covers them.

**`merge-eslint-config.integration.test.ts` (A1).** Only the comment above "reports an unused variable once…" (it cites the skip). The assertion stays; it now holds because the team's same-name statement wins.

**`merge-oxlint-config.test.ts` (A2).**
- The `extends` member of "keeps the categories, rules, env… extends of the team, untouched": ours lead in a first extended config, and the team's objects follow unchanged.
- Both "puts the team's ignore patterns first and ours after them": now the team's patterns exactly (D-a).
- Both "keeps the team's overrides first, then a catch-all override, then ours": now ours first.
- "puts our rules in the catch-all, with their options…": the team's root states `eslint/no-debugger`, so the team's entry decides.
- "turns off a rule our top-level rules turn off, over the team's setting of it": now the team's error (#42).
- The describe "…given a project's installed oxlint": moves to C5's file, rewritten for `^1.86.0` (#32 Q7).

**`merge-oxlint-config.integration.test.ts` (A2).** "win where the team sets them $where": the root, own-override and extended-object rows now expect the team's results. The path row stays as the #43 limit, now marked KNOWN GAP.

**Differential tests (A2).**
- The owed findings come from the new oracle.
- Owed results change for `OUR_REACT_RULE_OFF_IN_AN_ENTRY`, `OUR_ENTRY_TURNING_OFF_A_RULE_WE_DO_NOT_RUN` and `OUR_REACT_RULE_ONLY_IN_AN_ENTRY`, and on the path side for `OVERRIDE_SETTING_RULES_OTHERWISE` and `ONE_LISTING_STATING_OUR_RULE` (whose comment "our off must come after it" is false).

**`core/project-uses-oxlint.test.ts` (C), #32 D1.**
- "answers yes when only a parent package.json lists it…": now answers no.
- "throws on a malformed package.json in a parent…": now answers no; the parent is never read.

**`packages/rule-data/src/eslint-fallback-skips.test.ts` (B), #39.**
- "skips each moved core rule a current typescript-eslint rule extends…": now none is skipped.
- "holds, in that reason, what typescript-eslint's recommended and strict configs turn on…": removed, since the reason it pins is gone.

**`eslint-fallback.integration.test.ts` (B).** "fires $id on its fixture" for twinned core rules: the twin on TS, the core on JS (#39).

**`dist-loading.test.ts` (B).** The guard's package list gains `@vitest` and `typescript`. This strengthens it; what it tests is unchanged.

---

## For each agent

**Developer (each lane).**
- Read, in order:
  - This spec's tables.
  - `merge-eslint-config.ts`: `mergeEslintPart`, `twinsSwitchedAlong`, `teamFilesFromTheRoot`, `prefixesOfOurPluginsIn`.
  - `merge-oxlint-config.ts`: the oxlint-resolution comment at the top, `placedFirstInLine`, `oxlintRuleKeyed`, `mergedBesideAConfigOutOfSight`.
  - `build-eslint-config.ts`: `eslintBlocksBeforeTheOffSwitch`, `keptToTypedFiles`, `filesMatchedByBoth`.
  - `editor-parts.ts`, `installed-oxlint.ts`, `project-uses-oxlint.ts`.
- Decided:
  - The agent set never reads the team's configs.
  - Rule names always come from the catalog.
  - Every refusal names the file to fix (`configErrorIn`).

**Tester.**
- Write first and watch fail: every criterion above.
- Use factories, not inline data.
- Pin each refusal beside an allowed case.
- Every known gap is `it.fails` with the strict assertion, the tool run in `beforeAll`.
- Compare members with `toStrictEqual`.
- Integration tests load the built `dist`: rebuild before running them.

**Reviewer.** Check that:
- No option leaks in any differential shape.
- No `off` of ours remains in the oxlint merge but the compensations and cross-engine offs.
- Ignores are scoped (D-a).
- The agent configs are unchanged except the typed ignores.
- No cast or function matcher was added.
- The name check covers the whole catalog.
- TypeScript is not bundled.
- Rerun one deliberate break per new branch on the exact config it writes (questions #50–#51).

---

## Defaults this spec applies (owner-reviewable)

| | Default | Why |
| --- | --- | --- |
| D-a | `ignores` in `agents-inc.lint.mts` remove only our rules in the editor merges: no ESLint global ignores, no oxlint `ignorePatterns`. The agent set keeps them global. | Follows from #42 and #44. Today our ignores silence the team's own rules in those files. |
| D-b | Non-rule keys follow block order: the team's win per key where it sets them (Q-E) | "theirs should override whenever there is a conflict"; the block order is the owner's |
| D-c | The name check covers every rule and plugin in the catalog's oxlint list | The merge may write any of them (compensations); a superset never wrongly accepts |
| D-d | Floor 1.86.0 if C-3 passes, else 1.87.0 | "as large as possible"; R1 measured 1.86 identical to 1.87 |
| D-e | Options a typescript-eslint extension refuses keep the core rule running on TS there | A refused option is a config error that ends ESLint's run (measured for `max-params`) |
| D-f | Where the typed extension cannot run (no types), the core rule runs | Keeps the check; with oxlint, oxlint's version runs there too |
| D-g | The path branch takes the new order for what it can see | #43 "keep"; the path file stays out of sight |
| D-h | An imported-only TS file, in the program but in no tsconfig's list, loses typed rules | The safe direction; matching it needs a full program (about 1.5 s here, R2) |

## Open questions for the owner (today's behaviour kept meanwhile)

| # | Question | Meanwhile |
| --- | --- | --- |
| O1 | Does `rules` in `agents-inc.lint.mts` reach the editor set at all? | Both sets, except that an off removes only ours |
| O2 | On an oxlint newer than measured, a release that adds a rule or moves one between categories makes the team see extra or missing findings (#44 slips). Option E reads the installed oxlint's own rule list (`oxlint --rules`) when its version differs from ours: about 35 ms once per process (R1), and it must run from an empty directory with an empty config to avoid recursion. | Name check only (C2) |
| O3 | A CI job running the differential suites against each new oxlint release: a new workflow | Not built |
| O4 (Q-A) | Does a team oxlint category count as the team setting a rule? Yes would let the implicit `correctness: warn` override every correctness rule we state. | No |
| O5 (Q-B) | Does a team statement oxlint ignores count? | No (dropped, as today) |
| O6 (Q-C) | Cross-engine copies (the team's ESLint runs a rule our oxlint part runs, or the reverse): ours wins across engines, or accept double reports? Two separate merges cannot give both "theirs win" and "never twice" (R4 o9). | Ours wins, only for rules the other part runs |
| O7 (Q-D) | May the ESLint merge put a function in `files`/`ignores`? It works in ESLint 10.12 (also with `--cache` and `--print-config`) but is undocumented and outside ESLint's types, so it needs a cast or a wider return type. It would make leaving ours out exact for every team shape, and close #36 for TS files created after the config loaded (today's editor gap: fatal until `eslint.config.mjs` is re-read). | Static globs; function-scoped team blocks and the editor gap pinned as known gaps |
| O8 (Q-E) | Confirm D-b for parser, settings, `linterOptions` (D3) and oxlint `env`/`options` | D-b |
| O9 (Q-F) | Where the team sets a rule we also run, it runs on our module under a shared prefix. Use the team's module instead (our options may not fit it elsewhere)? | Our module; a colliding name under a prefix holding a different plugin stays ours |
| O10 | Without oxlint, run `unicorn/no-chained-comparison` (which the gate rejected) and `unicorn/no-double-comparison` (partial) in place of two `oxc/*` rules? This needs new internal data. 9 `oxc/*` rules have no ESLint equivalent. | No |
| O11 | `react-hooks/rule-suppression` fires in ESLint only with options oxlint refuses: an ESLint-only options field, or skip? | Skip, with reason |
| O12 | Extend "prefer typescript-eslint" to ESLint-routed core rules in both sets: `default-param-last`, `prefer-promise-reject-errors`, and `no-throw-literal` (whose extension `only-throw-error` we also ship: double reports, #35)? | No change |
| O13 | `eslint-plugin-jsx-a11y` (your pick; its peer range stops at ESLint 9, and our install only warns) or its fork `eslint-plugin-jsx-a11y-x` (ESLint 10 peer, same 34 rules fire, R3)? | The plugin you named |
| O14 | Reword the three refusal texts in C1 and C2? | As written |

## Docs this makes false (step 8, same turn)

- **plan.md:**
  - Decisions "oxlint" row: its plugin figure. Carry the command.
  - "Editor export" row: our settings win; other names off; the fallback plugins "we do not install".
  - The `ignores` key row (D-a).
  - "Does not carry over": the jsx-a11y row.
  - Open: the typed-rules item, #30, #32, #36, #39–#45.
  - Add Corrections rows.
- **architecture.md:**
  - Step 1: the `projectUsesOxlint` walk.
  - Step 4: the typed block and its comment.
  - Step 5: rules turned off are stated `off`; the off-switch.
  - Step 6: block order, deletion, `aliases-off`, twins.
  - Step 7: the catch-all after theirs, the peer range.
  - Step 8: the consumer config files beside the outside-tsconfig list.
- **questions.md:** #3, #30, #32, #36, #39–#45 answered; O1–O14 added where new.
- **learnings.md:** "One ESLint config with typed rules: a file outside tsconfig gets a fatal parse error…" (now narrowed).
- **spec-agent-editor-sets.md:** add this spec's amendments to its Corrections list.

## Corrections

1. **Brief, oxlint floor:** "any 1.x from 1.87" can be 1.86. R1 measured identical rule lists, categories, `--print-config` and findings. Adopted only if C-3 passes.
2. **Brief, name check:** "lacks a rule name our oxlint part states" is too narrow. The compensations (`oxlintNamesOnlyTheMergedRootRuns`, `categoryRulesOf`) write names from all of `catalog.oxlintRules`. I read `merge-oxlint-config.ts` to confirm.
3. **Brief, "no diff if you have no oxlint":** the four plugins cover the jsx-a11y, vitest, react-hooks and react-perf groups only. After them, the oxlint-run rules with no ESLint version are the `oxc/*` group: R3 found 7 already covered by shipped ESLint-run equivalents, 2 with unshipped equivalents, and 9 with none. In addition, 2 react-hooks rules cannot be proven in ESLint. Re-derived with the count commands below.
4. **R4's test verdicts:**
   - Several change only in the project without oxlint, because with oxlint the rule is oxlint-run and the Q-C default keeps the cross-engine off: the alias pair; the deprecated `no-loop-func` alias; "…a rule only our off-switch states". R4 marked them wrong in both projects.
   - "keeps our eslint-plugin-react rule of a name @eslint-react has too…" stays under the Q-F default.
   - R4 missed: the `extends` member of "keeps the categories…"; editor-equivalence's no-oxlint run test; the skip-list and fallback-proof tests; and the two ignore-pattern tests (from D-a).
5. **R3's correction 1** is not a correction of spec-agent-editor-sets.md: its §5 already says the `== null` variant counts the other group. Re-derived: the two runs give the two counts.
6. **Found here, in no report:** today our `ignores` become global ignores in both team configs, silencing the team's own rules in those files. No differential shape gives ours `ignores`, so the #44 guard cannot see it. Lanes A1 and A2 now include such shapes.
7. **spec-agent-editor-sets.md:** nothing false found beyond its own Corrections list. Superseded items are under "What this amends".
8. **Decisions D1–D9 after the build** amend this spec. All but D5 and D6 are recorded, unlabelled, in [decisions](decisions.md) (the build `wf_ec970377-570` review); code comments cite D1 and D9.
   - **D1, the cross-engine off (Q-C):** both tables' cross-engine rows said "Off in every file" (so did Lane A1 Must 4). The off now holds only in the files where our part for the other engine runs the rule: never where our `ignores` match, nor where our own settings turn it off. The "Files our ignores match" row wins the conflict the real run found (its failure 2). Why: the off exists only to stop double reports (#35), and where ours does not run there is none. Where the team's own oxlint config turns the rule off, the ESLint copy stays off ([questions](questions.md) #57).
   - **D2:** "Existing assertions" missed the test of an alias only our off-switch states, beside oxlint ("holds none of the options the team gives it…", now "is off with the options the team gives it…"). It expects exactly `[0, 'disable-absolute-first']`: Must 1 deletes no team entry, and ESLint keeps the team's options under our later severity-only `off`.
   - **D3:** the `require-await` row without oxlint reads "run by ESLint, as the extension on TS files" (#39), linted on a real file under `tsconfigRootDir` so the typed block reaches it.
   - **D4:** "runs where the block switching type information off comes before the block that gives it" uses a team block that only switches type information off in its parser options, not `disableTypeChecked`, whose own `off` wins under the contract. What it tests, the order of type information, is unchanged.
   - **D5, D6:** test errors, not spec changes. Two new Lane C tests now expect what ESLint 10.12 computes (`no-unused-vars` with its default options filled in on JS; `off` for the `.ts` file in the `.mts` row). Lane C changed `buildEslintConfig`'s arguments, but its file list missed `core/file-overrides.test.ts` and `core/resolve-rule-layers.test.ts`, which call it: they pass an empty list, and no assertion changed.
   - **D7, the oxlint floor (D-d):** `^1.86.0`. C-3 passed by the real run's route: the command under [Commands](#commands) fails in a bun workspace (`EUNSUPPORTEDPROTOCOL`) and leaves the copy's peer range refusing 1.86 ([learnings](learnings.md) has the route). The version-refusal cases sit below 1.86.
   - **D8, added:** `engines.node` is `^22.18.0 || >=24`, since ESLint 10 does not support Node 23 (npm warned `EBADENGINE` in the real run). [Questions](questions.md) #59 is about a dependency's narrower range.
   - **D9, twin pairs in our own layers (C4):** "TS files get the extension with the core rule's setting" is replaced. In each layer of ours, the highest part stating either name decides the pair, the layer's `rules` over its rulesets; the extension runs on TS files and the core rule on JS files, never both in one file. Where that setting is the extension's and the core rule refuses its options, the core rule keeps its own setting on JS files. Why: the review found a consumer's own `@typescript-eslint/max-params` overridden on TS files by the core rule's shipped setting, and a layer stating both names running both (#39, #41).
9. **D10 and D11 ([decisions](decisions.md), fix rounds 1 and 2)** amend D9 beside oxlint, and with it "The agent configs are unchanged except the typed ignores". Old: the extension runs on TS files and the core rule on JS files. New: beside oxlint, and in the agent build, which always runs oxlint, oxlint runs the core rule with the pair's decided setting, and ESLint's extension is off wherever it does (D10); where that setting carries options oxlint's copy refuses, ESLint runs the extension on TS files and oxlint's copy is off there (D11). Why: one five-parameter function was reported twice, by both engines (`probe-d9-beside-oxlint.mts`), and oxlint refused the whole config for `@typescript-eslint/no-redeclare`'s `ignoreDeclarationMerge` (`d10-refused-option.mts`).
10. **D11 widened, and D12 ([decisions](decisions.md), fix round 2, after its review)** amend item 9 and the oxlint table's cross-engine row. Old: D11 applies where oxlint's copy refuses the setting's options, and the cross-engine off covers only rules of ours oxlint has. New: D11 also applies where oxlint accepts an option without honouring it (`class-methods-use-this` with `ignoreClassesThatImplementAnInterface`); and the oxlint merge also turns off the core rule of each typescript-eslint extension our ESLint part runs, where it runs the extension, except where our oxlint part runs that core rule (D12). Why: oxlint reported a method the consumer's option exempts, and the review found one finding reported by both engines in `stories/x.stories.ts` and `legacy/a.ts`.

## Commands

From the repo root unless noted.

```sh
# oxlint-run rules ESLint has a version of (!=) / has none of (==); then grouped by prefix
jq -r --slurpfile inv packages/rule-data/src/generated/inventory.json '
  ($inv[0].rules | map({key: .id, value: .eslint}) | from_entries) as $eslint
  | [.[] | select(.engine == "oxlint" and $eslint[.id] != null) | .id] | length' packages/rule-data/data/rules.json
jq -r --slurpfile inv packages/rule-data/src/generated/inventory.json '
  ($inv[0].rules | map({key: .id, value: .eslint}) | from_entries) as $eslint
  | [.[] | select(.engine == "oxlint" and $eslint[.id] == null) | .id | split("/")[0]]
  | group_by(.) | map("\(.[0]) \(length)") | .[]' packages/rule-data/data/rules.json
# typescript-eslint extensions of core rules, typed and deprecated
jq -c '.rules[] | select(.eslint != null and .eslint.extendsCoreRule != null)
  | {id, core: .eslint.extendsCoreRule, typed: .eslint.typed, deprecated: .eslint.deprecated}' packages/rule-data/src/generated/inventory.json
# skip list size
jq length packages/rule-data/data/eslint-fallback-skips.json
# oxlint versions, and the four plugins' versions and ESLint peers
npm view oxlint dist-tags --json
for p in eslint-plugin-jsx-a11y @vitest/eslint-plugin eslint-plugin-react-hooks eslint-plugin-react-perf eslint-plugin-jsx-a11y-x; do npm view "$p" version peerDependencies.eslint; done
# the installed oxlint's rule and plugin names, from its schema
node -e 'const s=require("./node_modules/oxlint/configuration_schema.json"); console.log(Object.keys(s.definitions.DummyRuleMap.properties).length, s.definitions.LintPluginOptionsSchema.enum.join())'
```

- `max-params` option forms: `node <scratch>/pm-owner-answers/max-params.mjs <repo>/packages/lint-rules`. The script runs ESLint's `Linter` on one five-parameter function with each rule and option form. Measured: `@typescript-eslint/max-params` with `[4]` throws "Value 4 should be object"; `[{max:4}]` works for both rules.
- **C-3:** copy the repo into scratch (a plain copy, no worktree). In the copy, run `npm install --no-save oxlint@1.86.0`, then `bun run build`, then `bun run --cwd packages/lint-rules test merge-oxlint-config.differential merge-oxlint-config.beside-a-path`.
