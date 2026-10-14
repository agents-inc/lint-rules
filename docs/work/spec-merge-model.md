# Spec: the editor merges on the owner's model (2026-10-14)

Drafted 2026-10-14 by pm, for the merge rework. The model is decisions.md, "Owner 2026-10-14";
this spec does not restate it. Measurements were taken on oxlint 1.87, ESLint 10.12,
typescript-eslint 8.71.1, Node 22.23.2 and 23.10, with the `dist` built 2026-10-14. The probes are
in the session backup, `scratch-backup/merge-model/pm/` (`notes.md` lists each, M1-M9); each figure
below names the probe or command that gives it.

<goal>

Each merge drops from our editor part, in both engines and every file, every rule the team's ESLint
or oxlint config sets anywhere, reading the team's other engine config from a path it is given; the
code that turned the team's copies off across engines goes.

**User story:** As a team merging the editor set, I want any rule my engine configs set to stay
entirely mine, and every other rule to run once, so the merge never second-guesses my configs.

</goal>

<context>

**Today:** ours is left out only in the files a team block sets a rule in (`whereOursMayRun`,
`merge-eslint-config.ts`; `setByTheTeamsRoot`, `merge-oxlint-config.ts`), and the team's copies of
our rules are turned off in the other engine (`crossEngineOffs`, `twinSwitches`, `crossEngineOffsOf`,
`OxlintPart.offInOxlint`). Neither merge sees the team's other config, which is #57, #65, #67, #69.

**After:** one rule, read the same way by both merges: set by the team anywhere means the team's
everywhere; set nowhere means ours, on its routed engine.

**Priority:** High. Every open editor-merge defect of the cross-engine class closes with it.

</context>

## 1. Scope

### 1.1 Precedence, per key

| Key | Who decides | Semantics |
| --- | --- | --- |
| A rule R, with its same-rule names and its twins | The team, where its ESLint config **or** its oxlint config sets R (1.2) anywhere; else ours | All or nothing per rule: where the team sets R anywhere, our part states no name of R or of its twin, in either engine, in any file. Otherwise ours, as our part alone gives it, on R's routed engine. |
| Our `ignores` | Ours | Unchanged (D-a): they keep our rules out of their files. |
| Non-rule keys (`languageOptions`, `settings`, `linterOptions`, oxlint `env`, `globals`, `options`) | The team's where set, ours elsewhere | Unchanged (D-b, O8; the fix round 5-6 plugin-settings precedence). |
| Plugin object under a prefix both register | One object | Unchanged, but our module goes in only for the rules our part still runs after the drop. |

"Twins" are `twinsOf` (`catalog-lookups.ts`): a core rule and each current typescript-eslint
extension of it. The set of rules the team sets, S, is closed under twins and same-rule names
before anything is dropped. **Invariant:** both merges compute the same S for the same pair of team
configs.

### 1.2 How "the team sets a rule" is read

**ESLint config.** Every rule key of every block of `defineConfig(theirs)`, at any severity, `off`
included, whatever the block's `files`, `ignores` or `basePath`, blocks from presets and `extends`
included. A key counts for R when it is R, another ESLint name of R (`otherEslintNamesOf`), or one of
those under a prefix the team registers one of our plugins under (`prefixesOfOurPluginsIn`: the very
object, or one of the same name). A key under a prefix both register (antfu's `react`, holding
@eslint-react beside our eslint-plugin-react) counts for every rule of ours it names there: the
@eslint-react rule through the team's prefix, and the eslint-plugin-react rule by the literal key
(see 6, call C1). The ESLint merge reads the `theirs` it is given. The oxlint merge reads the file
at its path (1.3).

**oxlint config**, as the installed oxlint resolves it (the reading `merge-oxlint-config.ts` already
implements: `teamResolutionOf`, `oxlintRuleKeyed`, `resolvedPluginsOf`, `resolvedCategoriesOf`,
`configsInOxlintOrder`). R counts when any of:

1. a `rules` key of the root, of any override, or of any config extended (at any depth) is read as R
   by `parse_rule_key`, at any severity, where oxlint counts the statement: R in the `eslint` scope,
   or R's plugin listed at the resolved root or in that override. A statement oxlint ignores does not
   count (O5 stands);
2. R's category is `warn` or `error` in the resolved `categories`, R is in the `eslint` scope or its
   plugin is listed at the resolved root or in any override, R is not `nursery`, and R is not type-aware
   unless the config sets `options.typeAware: true`. Whether oxlint's own default `correctness: warn`
   counts where the config gives no `correctness` is open point 1;
3. a key under a JS plugin's prefix (no oxlint plugin of that name) that is an ESLint name of R, the
   prefix read through `jsPlugins` (`{ name, specifier }` gives the prefix; the specifier names the
   plugin).

**What is not readable, and what happens:**

| Not readable | Then |
| --- | --- |
| A path in `extends` of a JS or TS oxlint config | oxlint itself refuses that config: "`extends[0]` must be a config object (strings/paths are not supported)" (`node_modules/oxlint/dist/js_config.js`, `validateConfigExtends`; #43). The merge refuses it first, with the error in 1.3 (open point 3). |
| A path in `extends` of a JSON oxlint config (`.oxlintrc.json`) | Readable: read as oxlint reads it, the path resolved against the extending file's folder, recursively, comments allowed (M5: `oxlint --print-config` resolves it). A path naming no file: the unreadable error in 1.3. |
| `--type-aware` given on the oxlint command line | Not in the config: type-aware rules count only by an explicit statement or `options.typeAware`. A documented limit. |
| Blocks a team's `eslint.config.mjs` adds outside the config it passes to `mergeEslintConfig` | Neither merge reads them (each reads what is passed to the merge). A documented limit: pass the whole config. |
| A rule set only through an inline config comment in a source file | Not config; not read. |

### 1.3 The other engine's config: parameter, loading, failures

**Parameter (open point 2 for the name and shape):**

- `mergeEslintConfig(theirs, eslint, { oxlintConfig })`
- `mergeOxlintConfig(theirs, oxlint, { eslintConfig })`

Each value is a path string or `null`. A relative path is resolved against `tsconfigRootDir`, which
each part carries (the folder `agents-inc.lint.mts` names); an absolute one is taken as it is.
`null` says the project has no such config: then the team's ESLint sets no rule, and the team's
oxlint is read as oxlint reads an empty config (its defaults). `oxlintConfig` is required where the part says the project uses
oxlint, and not read where it does not (no oxlint runs there). `eslintConfig` is always required. The
TypeScript types make each required key required.

**Loading (measured M1, M2, M3):** synchronously, with `require()` of the file (Node's `require` of
ES modules, type stripping covering `.mts`; measured on Node 22.23 and 23.10, not on 22.18 or 24,
the ends of our `engines` range), so the merges stay
synchronous and their call shape changes only by the third argument. Both configs naming each other
is a module cycle, which Node refuses (`ERR_REQUIRE_CYCLE_MODULE`, M3), so a merge reading the other
file puts the process in **reading mode** for the duration of that one synchronous read: a merge
called in reading mode returns the team's config as given (`defineConfig(theirs)` for ESLint,
`theirs` for oxlint) and reads no other file; it still validates its own arguments. What the reader
takes from the file is the `theirs` that file passed to our merge in reading mode, or, where the file
calls no merge of ours, its default export. A JSON oxlint config is parsed, not loaded.

**Failures.** Each is a `configErrorIn` error naming the file to fix, the underlying error as
`cause`. Verbatim, ESLint side (the oxlint side mirrors it with `oxlint.config.mts`,
`mergeOxlintConfig`, `eslintConfig`, "ESLint config", `'eslint.config.mjs'`):

| Case | Error |
| --- | --- |
| Key left out (beside oxlint) | `eslint.config.mjs: mergeEslintConfig needs the path of your oxlint config as its third argument, { oxlintConfig: 'oxlint.config.mts' }, or { oxlintConfig: null } if this project has none: the package.json nearest to tsconfigRootDir lists oxlint` |
| Not a string or `null` | `eslint.config.mjs: oxlintConfig must be a path or null, and was given <describe value>` |
| No file at the path | `eslint.config.mjs: oxlintConfig names <absolute path>, where there is no file` |
| The file throws, or its default export is not a config | `eslint.config.mjs: could not read your oxlint config at <absolute path>: <cause message>` |
| It, or a module it imports, uses top-level await | the row above, the cause `ERR_REQUIRE_ASYNC_MODULE`, with: `a config read while another loads cannot use top-level await` |
| A path in `extends` of the oxlint config the oxlint merge is given | `oxlint.config.mts: extends[<i>] is a path, which oxlint refuses in a JS or TS config: import that file and put the object in extends` |

**Limits (documented, not fixed):** a change to the other engine's config reaches an editor's running
engine when that engine restarts (Node caches the module it read; a change to
`agents-inc.lint.mts` already needs the same). Reading `eslint.config.mjs` from oxlint's side loads
our ESLint entry: 1.4 s (M2), so a merged `oxlint` CLI run goes from about 0.1 s to 1.5 s (Should
have 1).

### 1.4 The ESLint merge, step by step

1. Check the part (as today) and the third argument (1.3).
2. In reading mode: return the team's config (1.3).
3. S = the rules `defineConfig(theirs)` sets, with oxlint the rules the oxlint config at
   `oxlintConfig` sets, closed under twins and same-rule names.
4. Our ESLint part's layers less every rule of S (each layer: top-level rules, TS-file rules, each
   entry's ruleset changes, `allowSuppressions` rules and own rules); our oxlint part's layers
   (`oxlintLayers`) likewise, read only for step 6.
5. Our blocks from those layers, as today: base, typed, scopes, entries; settings split per O8
   (`ourSettingsBeside`); kept out of our ignores and, where the team's global ignores take files
   back, out of ESLint's default ignores (`confinedBeside` for D-a only). Then the team's blocks
   exactly as `defineConfig` returns them, only the plugin objects swapped. No statement of the team's
   is deleted.
6. Beside oxlint, after the team's blocks: each typescript-eslint extension our ESLint part still
   runs, off where our oxlint part runs a core rule it extends (D10 within our layers), by the agent
   build's `extensionsOffWhereOxlintRunsTheirCore` (`build-eslint-config.ts`) on the reduced layers.
   Nothing else follows the team's blocks.

### 1.5 The oxlint merge, step by step

1. Refuse a missing oxlint part, an unsupported installed oxlint (`refuseUnsupportedInstalledOxlint`),
   a bad third argument, and a path in `extends` (1.3).
2. In reading mode: return `theirs`.
3. S = the rules `theirs` sets, and those the ESLint config at `eslintConfig` sets, closed as in 1.4.
4. Our oxlint part's layers less S; our on-statements from them as today (`ourOnStatements`: where
   our part alone runs each rule, our ignores as oxlint reads them), with no root-only test of the
   team's statements left in it.
5. As today: every plugin listed at the root and the compensations putting back what that changes for
   the team (`offWhereTheRootRunsThem`, `categorySwitchesOf`; #44); the team's ignored statements
   dropped (O5); our env and globals less the keys the team's root sets (O8); `placedFirstInLine`;
   `options` (#66 stays open).
6. No override follows the team's.

### 1.6 Also in this rework (decisions.md, "fix round 6 closed")

- Our `import-x/resolver-next` also yields to a team's `import-x/resolver-legacy` and `import-x/resolve`
  (`TEAM_SETTINGS_YIELDED_TO`, `eslint-settings.ts`). Evidence:
  `scratch-backup/fix-round-6/review/repro/item4-import-x.txt` (packages `x-resolver-legacy`,
  `x-resolve`).
- `n/no-unpublished-require` ships `resolverConfig: { tsconfig: true }` beside its `allowModules`, as
  `n/no-unpublished-import` does (`rules.json`). Evidence: `item2-unresolvable.txt` there
  (`require('@/util.cjs')` reported).
- The comment above `IMPORT_X_RESOLVER_NEXT` in `buildEslintSettings` that says import-x throws
  without a resolver goes.

### 1.7 Out of scope

- The agent build's behaviour, and D9-D11 within our layers (decisions.md: not changed).
- Routing any rule we do not ship (#64 stays open; list in 3.3).
- #43's broader question, #62, #66, #68, #70, #72, #74: unchanged and still open.
- Any change to what `defineLintRules` returns beyond dropping `offInOxlint` and `eslintLayers`.

## 2. Code that goes, and what stays

All paths under `packages/lint-rules/src/core/` unless stated. Remove cleanly: no re-export, no
alias, no dead branch.

| Goes | Only existed for |
| --- | --- |
| `merge-eslint-config.ts`: `crossEngineOffs`, `crossEngineOffOf`, `crossEngineOffName`, `CROSS_ENGINE_OFF`, `eslintNamesOfOxlintRules`, `eslintNamesOf`, `EslintNamesOfAnOxlintRule` | the cross-engine off (O6, D1) |
| `merge-eslint-config.ts`: `twinSwitches`, `twinsOfOurRules`, `twinOffWhere`, `whereTheTwinIsOff`, `whereOurPartRuns`, `whereOurEslintPartRunsAsOurs`, `whereOurOxlintPartRunsTheRule`, `filesLeftRunning`, `filesWhereItStaysOn`, `statementOf`, `runsTheRule`, `readBlockOf`, `OFF_SEVERITIES`, `ReadBlock`, `Statement`, `WhereOursRuns` | the team's twin off where ours runs (#41) and the merge's own copy of D10; D10 is now the agent build's function (1.4 step 6) |
| `merge-eslint-config.ts`: `whereTheTeamSets`, `teamBlocksStating`, `teamBlockScopeAt`, `sortedIndices`, `teamBlocksStatingEachName`, the `teamBlocksStating` and `teamBlockScopes` fields, the team term of `whereOursMayRun` | "ours elsewhere" per file |
| `merge-eslint-config.ts`: `namesUnderAPrefixOfBoth`, `withoutRules` and the `rules` branch of `teamBlockBeside` | the deletion of a team statement under a prefix both register (Q-F), made moot by 1.2 (call C1) |
| `merge-oxlint-config.ts`: `crossEngineOffsOf`, `offsOfTheRulesOurEslintPartRuns`, `offsOfTheCoreRulesOfItsExtensions`, `coreRulesExtendedBy`, `whereOurOxlintPartRunsTheCoreRule`, `overridesTurningOff`, `areOffInTheSameFiles`, `CrossEngineOff`, `OurParts`, `setByTheTeamsRoot`'s rule part (replaced by S) | the cross-engine off (D1, D12) |
| `merge-oxlint-config.ts`: `mergedBesideAConfigOutOfSight`, `offsRestatedUnderItsListing`, `offRestatedWithin`, `statementsOfRulesOf`, `rootPluginsSeenIn`, `withThePluginsOfItsRules`, `pluginsKeyListing` | a team config extending by path, whose output oxlint refuses from a TS config (open point 3; goes only if it resolves to "refuse") |
| `editor-parts.ts`: `OxlintPart.offInOxlint`, `OxlintPart.eslintLayers`, `oneOxlintSpellingOfEach`, `oneOxlintSpellingOf`, the `runByEslint` step of `partsBesideOxlint` | the off of the team's oxlint copies |
| `where-our-parts-run.ts`: `whereOurEslintPartRuns`, `whereEachStatementTurningItOnStands`, `eslintStatementsOf`, `statementOf`, `entrySettingsOf`, `filesTheStatementReaches`, `EslintStatement`, the `layers` field of `OurEslintPart`, the header's "each merge asks it of the other engine's part" | where our ESLint part runs, for the oxlint merge's offs |
| `__tests__/oxlint-codes-eslint-runs.ts` and its test | the oxlint oracle's cross-engine input |

| Stays | Why |
| --- | --- |
| `where-our-parts-run.ts`: `ourOxlintPartOf`, `ourOxlintPartInLine`, `whereOurOxlintPartRuns`, `whereTheOverrideLeavesItOn`, `whereTheOverrideApplies`, `filesTheOverrideAppliesTo`, `CATCH_ALL_FILES`, `ourEslintPartOf` (its `leftOut` fields) | the agent build's `twins-off` and the ESLint merge's D10 off (1.4 step 6); `ourOnStatements`; D-a in the ESLint merge |
| `oxlint-file-types.ts`, `packages/rule-data/data/oxlint-file-types.json`, its module and integration test | `whereOurOxlintPartRuns`, which both D10 offs ask |
| `twin-pairs.ts`, `packages/rule-data/data/oxlint-refused-options.json` and its module and test | D9-D11 (3.4: routing does not replace D11) |
| `eslint-off-blocks.ts`, `ignores-read-by-each-engine.ts`, `file-conditions.ts`, `oxlint-override-files.ts`, `eslint-file-types.ts` | the agent build, D10 offs, D-a, the compensations |
| The team-oxlint reading in `merge-oxlint-config.ts` (`teamResolutionOf` and the key, plugin and category readers) | moved, not removed: both merges read it (1.2) |
| `prefixesOfOurPluginsIn`, `isTheSamePlugin`, `otherEslintNamesOf`, `twinsOf` | moved or shared: both merges read the team's ESLint keys with them |

## 3. The routing check

### 3.1 Criterion

oxlint's version of a rule we ship and route to oxlint is **measurably worse** when, on files both
engines lint for us (JS and TS, declaration files included), oxlint misses a finding or reports a
false one that ESLint's version does not, or oxlint refuses or ignores an option ESLint's version
takes that changes what the rule reports. Not worse, and not routed, when the gap is covered by
TypeScript's own check, or ESLint's version is worse in turn (on `eslint-fallback-skips.json`).

### 3.2 Result (shipped rules)

| Rule | Evidence | Route |
| --- | --- | --- |
| `@typescript-eslint/ban-ts-comment` | M7: `// @ts-ignore` in a `.js` file: ESLint reports, oxlint skips JS (`oxlint-file-types.json`) | ESLint |
| `@typescript-eslint/no-this-alias` | M7: `const self = this` in `.js`, likewise | ESLint |
| `@typescript-eslint/triple-slash-reference` | M7: `/// <reference path>` in `.js`, likewise | ESLint |
| `eqeqeq`, `import-x/named`, `import-x/no-unassigned-import`, `max-depth`, `preserve-caught-error`, `promise/valid-params`, `react-hooks/exhaustive-deps`, `react-hooks/rules-of-hooks`, `react/jsx-no-duplicate-props`, `react/no-children-prop`, `unicorn/no-empty-file`, `unicorn/prefer-add-event-listener`, `unicorn/prefer-array-find`, `unicorn/prefer-set-has`, `vitest/no-conditional-expect`, `vitest/no-focused-tests` | M9: an option list ESLint's schema takes that oxlint refuses, and then loads no part of the config (`allow-null`, `maximum`, `additionalHooks`, `allowComments`, …) | ESLint |
| `getter-return` | M7: oxlint skips TS files, but `tsc` reports the same getter there (TS2378, measured) | stays oxlint |
| `import-x/no-cycle` | M9 refuses options, but ESLint's version misses TS imports (`eslint-fallback-skips.json`) | stays oxlint |
| `no-unused-vars` with `@typescript-eslint/no-unused-vars` (enableAutofixRemoval) | refused or ignored option (`oxlint-refused-options.json`) | stays: D11 (3.4) |
| `no-implicit-globals` | false reports in CommonJS files (real run P3); ESLint's version reports nothing under our parser (skip list) | decided with #70 |
| 29 rules refusing only `{}` (`scratch-backup/merge-model/pm/refused-empty-only.txt`: 15 `jsx-a11y/*`, 14 `react-hooks/*` compiler rules) | M9: `[{}]` refused | open point 5 |

Re-derive: `jq -r 'select(.part=="B" and .refused!=null) | [.rule, (.options|tojson)] | @tsv'
scratch-backup/fix-round-2/dev-c/logs/options-reaching-oxlint.jsonl`, joined with
`jq -r '.[] | select(.engine=="oxlint") | .id' packages/rule-data/data/rules.json`; the file-type
probe is `scratch-backup/merge-model/pm/probes/routing-project/` (`eslint.file-types.config.mjs`,
`oxlintrc.json`). Options oxlint *accepts but ignores* were swept for the twin pairs only: a sweep
for every routed rule is owed before the list is complete (open point 5).

### 3.3 Where the reason lives

Each rule moved: `engine: "eslint"`, no `oxlintName`, and a new field `eslintBecause` holding the
reason and the measurement, in `rules.json` (the owner's "rules.json and its doc").
`canonical-list.test.ts` checks that a rule with `eslintBecause` is ESLint-routed and that oxlint has
an untyped version of it. The doc is plan.md, "Routing: the canonical list", one bullet with the
command listing them: `jq -r '.[] | select(.eslintBecause) | .id + ": " + .eslintBecause'
packages/rule-data/data/rules.json`. Rules we do not ship with options oxlint refuses (28 RuleIds,
`scratch-backup/merge-model/pm/refused-unshipped.tsv`) stay with #64.

### 3.4 Does routing remove D11?

No. Routing D11's three core rules (`no-redeclare`, `class-methods-use-this`, `no-unused-vars`) to
ESLint would run ESLint's core rule on TS files, where it misreports: ESLint's core `no-redeclare`
reports each overload signature, oxlint's does not (M8, `probes/routing-project/twin/`). Only the
takeover (extension on TS files, core rule on JS) avoids that, and it runs without oxlint only. D11
and its data stay.

## 4. Tests owed

Write first, watch fail (`web-tester`), then implement. Every scenario runs the real CLIs through
the built package (`bun run build` first) with `setUpConsumerCliRuns` (`__tests__/consumer-cli-runs.ts`):
both configs merged, each naming the other, compared against the team's configs alone. Assert
members with `toStrictEqual`; data from factories.

### 4.1 Success criteria

| # | Scenario | Owed |
| --- | --- | --- |
| T1 | Team ESLint only: `eqeqeq: ['error', 'smart']` (ours: oxlint) | `a == 1` reported once, by ESLint; `x == null` by nobody; oxlint reports no `eqeqeq`. Beside it, `no-debugger` (set nowhere) reported once, by oxlint. |
| T2 | Team oxlint only: `typescript/array-type` (ours: ESLint) | `array-type` findings from oxlint alone, as the team's config alone gives them; ESLint reports none. Beside it, another ESLint rule of ours still reported by ESLint. |
| T3 | Both: `eqeqeq` in each config, different options | Each engine's `eqeqeq` findings equal that engine's team-alone findings; none of ours. |
| T4 | ESLint preset: typescript-eslint's `recommended` (link `typescript-eslint`) | Our `no-unused-vars` and `no-unused-expressions` report nowhere; the team's report as alone. oxlint preset: `extends: [object]` setting a rule likewise. |
| T5 | oxlint category: `categories: { style: 'warn' }`, `plugins: ['typescript']` | Our ESLint `@typescript-eslint/array-type` drops; the team's oxlint reports. Refusal beside it: the same category with `plugins: ['unicorn']` (typescript listed nowhere): ours stays. |
| T6 | Twin: team ESLint sets `@typescript-eslint/no-unused-vars` only; team oxlint sets `no-unused-vars` only, ours naming the extension | Each: no report of either name of ours; the team's alone. Beside it: `no-debugger` ours. |
| T7 | One override only: team oxlint `overrides: [{ files: ['legacy/**'], rules: { 'no-debugger': 'off' } }]`; team ESLint block on `legacy/**` setting `max-lines` | `debugger` in `src/a.ts` reported by nobody (the old contract reported ours there: the any/every input). |
| T8 | Set nowhere, with oxlint / without oxlint | `no-debugger` once from oxlint / once from ESLint. |
| T9 | Third argument | Each 1.3 failure row, its message in full, beside the allowed case `null` (loads, ours run) and a valid path. |
| T10 | Invariant | For each scenario above, the rules absent from our merged ESLint part equal those absent from our merged oxlint part (unit test on both merges with one team pair). |
| T11 | Implicit default category (after open point 1) | A team oxlint config with no `categories`, `no-debugger` in `src`: owed per the decision. |
| T12 | Type-aware category rule | Team `categories: { correctness: 'error' }`, no `typeAware`: our `@typescript-eslint/no-floating-promises` still reports in ESLint; with `options.typeAware: true` it drops. |
| T13 | JSON oxlint config with `extends: ['./base.json']`, base setting a rule, read by the ESLint merge | That rule drops from ours. Path naming no file: the unreadable error. |
| T14 | Blocks added outside the call in `eslint.config.mjs` | Pinned as the documented limit (1.2), strict assertion kept. |
| T15 | 1.6 | Team `import-x/resolver-legacy` / `import-x/resolve`: our `resolver-next` out of those files; allowed beside: `import-x/core-modules` alone keeps ours. `require('@/util.cjs')` through a tsconfig alias not reported; a real unpublished `require` still reported. |
| T16 | Routing | Each moved rule fires on its fixture in ESLint (`eslint-fallback.integration.test.ts` proof) and is in no oxlint config we write. |

Technical: `bun run typecheck` and `bun run test -- --force` (turbo's cache bypassed) green; `git diff -- packages/lint-rules/src/core/build-oxlint-config.ts packages/lint-rules/src/core/twin-pairs.ts` shows no behavioural change; the break-a-line step (CLAUDE.md, Tests) covers every new decision point, including each `or` of S and each condition of 1.2.

Non-functional: ESLint config load with `oxlintConfig` within 60 ms of without (M1: 32-34 ms read);
the oxlint config load with `eslintConfig` measured and reported (M2: 1.4 s today).

### 4.2 Existing tests the model makes wrong

Each may change (owner, 2026-10-14). A test that only gains the third argument is not listed
(command: `grep -rln "mergeEslintConfig\|mergeOxlintConfig" packages/lint-rules/src
packages/lint-rules/test-fixtures`). `__tests__/cases/consumer-files-as-plan-md-shows.ts` follows
plan.md's new call shape.

**Oracles rewritten to the 1.1 contract:** `__tests__/findings-beside-the-team.ts`
(`owedBesideTheTeam`: the team's alone for each rule the team sets, ours alone otherwise),
`__tests__/eslint-entries-owed.ts` (`owedEntry`) and its test, `__tests__/oxlint-findings-owed.ts`
(`ownerOfOxlintFindings`) and its test. Every test reading them is recomputed; those named below also
assert behaviour that is gone.

`merge-eslint-config.test.ts`:
- "a rule our part states, which the team sets too" › "turns the team's eqeqeq off in ESLint in a project whose package.json lists oxlint, which runs it".
- "a rule our part states, which a team block sets in some files under one of its names" › its one test ("…and ours elsewhere…").
- "our off and our ignores, beside a team block setting the rule in the files they cover" › "leaves every name of the rule as the team's config alone gives it there, and ours elsewhere…".
- "a team rule our part does not state" › "keeps firing in ESLint when we route it to oxlint but do not run it, beside one our oxlint part runs, which is off…" (its name; the clean fixture hides it).
- "a rule our oxlint part runs with options of an entry of ours…" › its one test.
- "a rule our oxlint part states, which the team sets in ESLint…" › "is off in the entry's files where only an entry of ours runs it…".
- "a rule our oxlint part runs in some files only, which the team sets in ESLint…" › its one test.
- "an alias of a rule our part runs" › "is decided where the team turns it on" (oxlint row), "is off with the options the team gives it…", "keeps the team's entry where the team registers our import-x under import" (oxlint row).
- "another ESLint name of a rule either editor part states" › "is the team's in every file where the team turns it on, but off beside oxlint…"; "is off for $twin…" (both projects); "is the team's on TS files, where our part runs $twin itself, and off on JS files…"; "decides typescript-eslint's twin of no-unused-vars…" (the oxlint row's name); "is the team's on TS files and off on JS files, where our core rule runs…"; "is decided for typescript-eslint's deprecated no-loop-func…" (oxlint row).
- "another name a plugin of ours binds to the module of a rule either editor part states" › "is the team's in every file where the team turns it on, but off beside oxlint…".
- "typescript-eslint's twin of a rule either editor part states, which the team turns on" › every test asserting the twin `off` in some file (all but "…where our top-level rules turn $ours off", "…options where $ours does not run…", "…where our top-level rules turn our rule off, and so is the same rule…", which the tester re-reads).
- "a plugin of ours, which the team registers under a prefix of its own" › "has its twin of a rule of ours off only in the files where ours runs…"; "is decided in every file under its name for a rule only our off-switch states beside oxlint…" (oxlint row).
- "our @eslint-react plugin, which the team registers under react…" › "keeps running our @eslint-react rule whose name under @eslint-react is that of an eslint-plugin-react rule our oxlint part runs…".
- "the merged blocks" › "are ours, starting with the base block…" (oxlint row: nothing after the team's).
- "our blocks, beside a team config that takes nothing back from ESLint's default ignores" › the case "a team block turns array-type off in scripts/**, which moves into the copy of our base block kept out of them".

`merge-eslint-config.integration.test.ts`: "a team on typescript-eslint's recommended config…, in a project whose package.json lists oxlint" › "leaves an unused variable and an unused expression to oxlint…".

`merge-eslint-config.differential.test.ts`: "mergeEslintConfig $mode…" › "shape N runs no two names of one rule in one file" becomes "adds no name of a rule to a file beyond those the team's config alone runs there".

`merge-oxlint-config.test.ts`: "…given a team config setting every key" › "puts ours first in line, in a first extended config, then the team's overrides, then the cross-engine offs"; "turns off, under one of its oxlint spellings, an ESLint-run rule of ours…". "…extending a config by path…" › every test (open point 3). "the overrides mergeOxlintConfig writes…" › "state no rule off but the rules our ESLint part runs…", "leave to the team an ESLint-routed rule our part only turns off…". "…given a rule our ESLint part runs that oxlint has, which the team turns on at its root" › all three.

`merge-oxlint-config.integration.test.ts`: "our rules, merged into a team oxlint config that sets them otherwise" › the override rows of "give the team's findings where the team sets them $where, and ours elsewhere"; "…in a config it extends by path" (open point 3); "a team oxlint config, merged with our part" › "loses only the finding of an ESLint-run rule of ours…"; every test in the four describes starting "a rule our ESLint part runs that oxlint has, merged into a team oxlint config that turns it on", "max-lines, which our ESLint part runs and oxlint has…", "the rules our ESLint part runs, merged into a team oxlint config that extends a config by path…".

`merge-oxlint-config.beside-a-path.differential.integration.test.ts`: the whole file (open point 3).

`editor-parts.test.ts`: "the oxlint part of a project whose package.json lists oxlint" › all four rows (the field goes).

`editor-equivalence.test.ts`: "turn off in oxlint, under one of its spellings, every rule ESLint runs…" (goes); "state in ESLint exactly the oxlint-routed rules the oxlint part runs…" (owed: none stated).

`editor-merges.*.integration.test.ts`, every "…merged into the team's configs, ours where our part reports a rule and the team's alone elsewhere, from one engine" (oracle; in `both-engines`, `ignores-readings`, `off-blocks`, `oxlint-file-types`, `twin-pairs`, each describe holding one); plus:
- `both-engines`: "rules our oxlint part runs, merged into a team ESLint config that runs them in its .vue…" › both tests; "a rule our ESLint part runs, merged into a team oxlint config that turns it on, beside .vue…" › its test; the `.git` describe's `it.fails` is expected to pass under the model (not run): then a plain test.
- `ignores-readings`: "our rules, where our ignores take node_modules/mylib back…" › "report, merged into the team's configs, ours in src, and the team's oxlint no-var in each package in node_modules…".
- `oxlint-file-types`: the `.vue` plain-script `it.fails` (#63) is expected to pass under the model (not run): then a plain test.
- `off-blocks`: its corpus exercised the cross-engine off of `eqeqeq`; rebuilt on a D10 pair, or removed with the behaviour.

## 5. Docs owed (same turn as the code)

**The wording** (plan.md's "The team's own configs", the JSDoc of `mergeEslintConfig`,
`mergeOxlintConfig` and `LintRules.editorRulesets`):

> Your engine configs override the editor set. If your `eslint.config.mjs` or `oxlint.config.mts`
> sets a rule anywhere (in any block or override, in a preset you extend, or through an oxlint
> category you turn on), the editor set drops that rule from both engines, in every file, and your
> setting decides it. That includes a rule you only turn off, or set for some files. A core rule and
> typescript-eslint's version of it count as one rule. Each merge reads your other engine's config
> from the path you pass it.

Measured effect for the docs (M6): typescript-eslint's `recommended` with ESLint's own recommended
rules takes 77 of the 1,008 rules our rulesets ship.

**plan.md:** the Editor export row (its precedence, cross-engine and #41 sentences, replaced by a
link to the wording); "The team's own configs" (both calls gain the third argument; the wording); the
Corrections table (rows: cross-engine off → gone; "ours everywhere else" → the team's everywhere;
O4 categories → count; Q-F deletion → read as both rules); "Routing: the canonical list"
(`eslintBecause`, 3.3); Open: remove #57, #63, #65, #67, #69 and the "ours winning across the two
engines" default, add the 1.2/1.3 limits.

**architecture.md:** data flow (the merges read the other config); step 5 (no `offInOxlint`,
`eslintLayers`; `oxlintLayers` for D10 only); step 6 (1.4 replaces the off-switch, the per-file
leave-out, the twin switches and Q-F); step 7 (1.5 replaces the cross-engine offs and the
beside-a-path branch); a new "Reading the team's configs" paragraph (1.2, 1.3, reading mode); the
`rules.json` row (`eslintBecause`).

## 6. Open points for the owner

1. **oxlint's default `correctness: warn`.** Recommended: counts, as the installed oxlint resolves it
   (no rule ever runs twice; a team keeps ours with `categories: { correctness: 'off' }`). Cost: 94 of
   our oxlint-routed rules become the team's (warn, oxlint's options) in a team config that leaves
   `correctness` out (`probes/default-category.mts`). Alternative: only categories the team writes
   count; no double today (0 ESLint-routed rules we ship have an untyped oxlint `correctness`
   version), but the moves in 3.2 (`exhaustive-deps`, `vitest/*`, `no-this-alias`, …) would double
   in a team listing their plugins with default categories.
2. **Parameter name and shape.** Recommended: a third argument `{ oxlintConfig }` / `{ eslintConfig }`,
   a path or `null`, relative to `tsconfigRootDir`, required where the other engine runs.
   Alternatives: a positional path; finding the file ourselves (not what the owner said).
3. **A path in `extends` of the oxlint config the oxlint merge is given.** Recommended: refuse
   (oxlint refuses that config from a TS file anyway, #43 round 6) and delete the beside-a-path
   branch. Alternative: keep it (#43 (c)), minus its cross-engine offs.
4. **Synchronous reading.** Recommended: `require()` (1.3), which keeps the merges synchronous and
   cannot interleave two configs' reads. Limits: top-level await in the other config refused;
   changes reach a running editor engine on restart; the oxlint CLI run gains 1.4 s unless our ESLint
   entry stops loading plugins in reading mode (Should have 1). Alternative: async `import()` with
   cache busting: the team writes `await` in `oxlint.config.mts`, and two configs loading at once in
   one process could see each other's reading mode.
5. **Routing breadth.** Recommended: move the 19 rules of 3.2; leave the 29 that refuse only `{}`
   (asking the defaults oxlint runs) to #64/#74; run the "accepted but ignored" sweep for every routed
   rule before calling the list complete. Alternative: move the 29 too.

**My calls (cards for the questions page):** C1, a key under a prefix both register counts for both
rules it names, so Q-F's deletion goes and a team-set rule runs on the team's module (1.2); C2,
`null` for the oxlint path reads as oxlint's defaults (1.3); C3, explicit statements of type-aware
rules count without `typeAware`, categories do not (1.2); C4, the field name `eslintBecause` (3.3);
C5, failures throw rather than warn (1.3; CLAUDE.md: no silent fallbacks).

**Should have:** 1. Our ESLint entry loads its plugins only when a merge runs outside reading mode,
so reading `eslint.config.mjs` from oxlint costs only the team's own imports (real run: 0.37-0.72 s
for a team's config alone).

## Pattern files

| Priority | File | What to reuse |
| --- | --- | --- |
| 1 | `core/merge-oxlint-config.ts`, `teamResolutionOf` and the readers it calls | The oxlint reading, as oxlint 1.87 resolves (1.2) |
| 2 | `core/build-eslint-config.ts`, `extensionsOffWhereOxlintRunsTheirCore` | D10 off of our own extensions (1.4 step 6) |
| 3 | `core/merge-eslint-config.ts`, `sameRuleNamesOf`, `prefixesOfOurPluginsIn` | The ESLint key reading |
| 4 | `core/resolve-rule-layers.ts`, `layersKeepingRules` | Dropping S from every layer |
| 5 | `core/config-error.ts`, `configErrorIn`; `eslint.ts`, `eslintPartGiven` | Errors naming the file to fix |
| 6 | `__tests__/consumer-cli-runs.ts`, `setUpConsumerCliRuns`; `__tests__/both-engines-runs.ts`, `EMPTY_TEAM_OXLINT_CONFIG` | Real-CLI scenarios; an oxlint config that sets nothing |

<implementation_notes>

**web-tester:** 4.1 first, including the any/every inputs: set in one config vs both (T1-T3), in one
override vs everywhere (T7), either twin name (T6), category with the plugin listed vs not (T5),
`typeAware` on vs off (T12). Pin each 1.3 refusal beside `null`. Rewrite the three oracles to 1.1
before touching any test that reads them; list each assertion changed and why (4.2).

**web-developer, in order:** move the oxlint reading into a module both merges import; the ESLint key
reading likewise; the other-config loader (1.3: resolution, reading mode, failures); the ESLint merge
(1.4); the oxlint merge (1.5); the part shapes (2); removals (2); `rules.json` (3.2, 3.3, 1.6) and a
regenerate; 1.6's settings. The oxlint part stays plain data; the oxlint merge loads ESLint's side
only to read a config at `eslintConfig`.

**Decisions already made:** S closed under twins (owner); D9-D11 untouched (owner); routing, not merge
code, for oxlint's worse rules (owner); D11 stays (3.4, measured).

**reviewer:** the invariant (T10); no team statement deleted; no block or override of ours after the
team's but D10's; every removed symbol gone (no dead export); reading mode set only for one
synchronous read; errors name the file to fix.

</implementation_notes>

## Corrections (to the brief)

- "An oxlint extends by path is not readable": in a JSON config it is (M5); in a JS or TS config
  oxlint refuses the whole config.
- The superseded list omits two defaults the model also replaces: O4 (categories now count) and Q-F's
  deletion (call C1). O5 stands.
- Routing D11's core rules to ESLint does not remove D11 (3.4).
