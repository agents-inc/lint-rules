# Spec: core lane (joint with the data lane), the owner's answers of 2026-10-14

Joint spec by pm-lanes (2026-10-14), then checked against the core lane copy and the answers and revised for the core lane by pm-core the same day. The core lane builds sections 3 and 5–7. Card IDs are the digest's (`scratch-backup/answers-digest-2026-10-14.md`). Sources: [decisions](decisions.md), [questions](questions.md), [plan](../plan.md), [spec-next-batch](spec-next-batch.md) (lanes E and M, addendum items 3 and 4, round 2 tables). Where an answer differs from spec-next-batch, the answer wins. pm-core's changes are listed in section 9 (items 8 onwards).

**Two differences from the data lane's copy (`spec-data.md`)**:
- 2.5 and 2.6 gain `readsRuntimeGlobals`, which C7 needs.
- 2.7 gains the case-file rule.

The orchestrator relays both (8.1). Section 4 belongs to the data lane, and its copy is authoritative; it is kept here because C0 and the fallout read it.

## 1. What changes for a user

- **One report per problem** for the round 2 pairs, using two new mechanisms:
  - **"Covered by" (S, C2):** a narrow rule is left out wherever the broader rule covering it is on. A team that turns the broader rule's ruleset off gets the narrow rule back.
  - **"Split by types" (T, C3):** in files where the typed rule runs with type information, its untyped partner is off. Every other file keeps the untyped rule, as does every file in a layer where the typed rule is off.
- **Without oxlint, ESLint stands in** for five `oxc/*` rules with unicorn rules (C4: #55, r2-d49-51).
- **import-x understands TypeScript imports in ESLint** (C1: #33 fix C, q-r3, q-r4):
  - It follows extensionless imports, `.js`→`.ts` and tsconfig path aliases.
  - `import-x/order` then files aliases as internal, which gives new findings on code sorted today.
  - Without oxlint, four more import-x rules run in ESLint.
- **A suppression may name oxlint's spelling of a renamed rule:** `unicorn/no-array-for-each` loads in ESLint (C5: my-renamed-in-eslint).
- **`mergeEslintConfig` refuses an ESLint below 10** installed for the project. The message names `eslint.config.mjs` (C6: q-r7).
- **Editor merges add our runtime globals only where our own `no-undef` runs** (C7: #68, read-q68). A team's own `no-undef` reports `window` in a Node file again.
- **A team ESLint block with `basePath: '..'`** is read as ESLint applies it (C8: my-basepath-bug).
- **`agents-inc.lint.mts` and `oxlint.config.mts` get the type-aware rules** where the type information is ours (C9: typed-config-files).
- **JS test files get the test runners' globals:** no `no-undef` on `describe`, `it`, `expect`, `vi` or `jest` (C10: q76).
- **Our package is installed by npm from its packed tarball in a test** (C11: q58).
- **`check` builds exactly what the tests test** (C12, the interface for the cli lane).
- **No eslint-plugin-react warning in a project without React** (C13).
- Data lane:
  - the round 2 drops and option changes
  - q-r1 and r2-d22
  - the renamed rules running in oxlint
  - the eight modern-js rules parked
  - `consistent-return` and `no-implied-eval` shipped (q-r6)
  - #70, #71, #79
  - the `class-names` ruleset

## 2. The interface between the lanes

The data lane owns every file below. The core lane reads only the exported surface (2.5).

### 2.1 `data/rules.json`: new optional fields

| Field | On | Shape | Meaning |
| --- | --- | --- | --- |
| `coveredBy` | the narrow rule of an S pair | `{ "rule": "<RuleId>", "because": "<card id>: <one line>" }` | Left out of a layer wherever `rule` is on there (C2). |
| `splitByTypesWith` | the untyped rule of a T pair | `{ "rule": "<RuleId>", "because": "<card id>: <one line>" }` | Off where `rule`, a typed rule, runs with type information (C3). |
| `readsRuntimeGlobals` **(pm-core)** | each rule our runtime envs' globals serve | `true` | Our runtime globals are emitted in the editor merges only where such a rule of ours runs (C7). Today `no-undef` alone. |

Absent on every other rule. `because` stays in `rules.json`, as `eslintBecause` does; the generated routing carries only the rule ID. The data lane may choose another JSON shape for `readsRuntimeGlobals`; the core reads only 2.5.

### 2.2 `data/eslint-stand-ins.json` (new)

Shape: `{ "<oxlint-only RuleId>": { "standIn": "<RuleId>", "because": "<card id>: <why, with the measurement>" } }`, keys sorted. Exactly these five:

| oxlint-only rule | Stand-in | From |
| --- | --- | --- |
| `oxc/bad-comparison-sequence` | `unicorn/no-chained-comparison` | #55 |
| `oxc/double-comparisons` | `unicorn/no-double-comparison` (silent on `x == y \|\| x < y`: record it) | #55 |
| `oxc/bad-char-at-comparison` | `unicorn/no-invalid-character-comparison` | r2-d49-51 |
| `oxc/misrefactored-assign-op` | `unicorn/no-misrefactored-assignment` | r2-d49-51 |
| `oxc/erasing-op` | `unicorn/no-constant-zero-expression` | r2-d49-51 |

### 2.3 `data/ruleset-definitions.json`

- Every entry gains `"optIn": false`. No ruleset is opt-in this round; `init`, in the cli lane, reads the field.
- New entry `class-names`: list `libs`, domain `styling`, env `null`, `optIn: false`, after `css-modules`.

### 2.4 Generated `src/generated/routing.json`

`shipped.coveredBy` and `shipped.splitByTypesWith` hold the other rule's ID, present only on a rule that `rules.json` gives the field. `shipped.readsRuntimeGlobals` is present (`true`) only where given. Nothing else changes shape.

### 2.5 Exported surface of `@workspace/rule-data` (what the core compiles against)

| Type | New member | Value |
| --- | --- | --- |
| `ShippedRule` | `readonly coveredBy: string \| null` | the covering rule's ID; `null` where there is none |
| `ShippedRule` | `readonly splitByTypesWith: string \| null` | the typed partner's ID; `null` where there is none |
| `ShippedRule` | `readonly readsRuntimeGlobals: boolean` **(pm-core)** | `false` where absent |
| `Catalog` | `readonly eslintStandIns: ReadonlyMap<string, string>` | oxlint-only rule ID → stand-in ID |
| `RulesetDefinition` | `readonly optIn: boolean` | |

Absence in JSON becomes `null`, `false` or an empty map at the catalog's parse, which is the parse boundary. No other export changes.

### 2.6 What the data guarantees and the core may assume

The data's tests guarantee these. The core still throws on a breach, as `oxlintSettingsOf` does today.

- **S:**
  - Both rules are shipped in a ruleset (not `alwaysOn`, not `whenSuppressions`).
  - The cover is not itself covered (no chains), and it is not the rule itself.
- **T:**
  - The untyped rule: `typed: false`, ESLint-routed, no `files` or `ignores`, in a ruleset, no `coveredBy`.
  - The typed rule: `typed: true`, ESLint-routed, no `files` or `ignores`, in a ruleset, carrying neither field.
  - Each typed rule is named by one untyped rule.
- **Stand-ins:**
  - Each key is a shipped oxlint-run rule that ESLint has no version of.
  - Each stand-in is an ESLint-run RuleId: untyped, not shipped, not in `rule-candidates.json`, not on the skip list, and used once.
  - Every entry has a `because`.
- **`readsRuntimeGlobals` (pm-core):** exactly `no-undef` (pinned), a shipped rule.

### 2.7 How the core lane builds before the data lands

- **Scaffold.** In its own copy only, the core developer adds the 2.5 members to `packages/rule-data/src/catalog.ts` and `src/ruleset-definitions.ts`, with today's values:
  - no pairs and no stand-ins
  - no ruleset opt-in
  - `readsRuntimeGlobals` true on `no-undef` alone, since that is what our runtime globals serve today

  It changes nothing else in `packages/rule-data` but `data/eslint-fallback-skips.json` (C1).
- **Factories.** Core tests take a catalog from the factories in `src/__tests__/factories/catalog-factories.ts`. `buildCatalog`, `buildShippedRule` and the `build*Ruleset` functions gain the new members with those defaults.
- **Derived catalogs (pm-core).** A test that needs pairs or stand-ins before the data has them takes a catalog derived from the real one. The derived catalog sets the fields from a case file:
  - `src/__tests__/cases/covered-by-pairs.ts`, from 4.4
  - `src/__tests__/cases/split-by-types-pairs.ts`, from 4.5
  - `src/__tests__/cases/eslint-stand-ins.ts`, from 2.2

  Each case file has one pin, `it.fails` until the data lands, with a `KNOWN GAP:` comment: the case file's pairs `toStrictEqual` the real catalog's. The fallout step (2.8) removes the `.fails`, then replaces each derived catalog with the real one and deletes the case files, so each fact keeps one owner.
- **Real catalog.** A test reading the real catalog computes its expectation from the fields, so it holds before and after the data lands.
- **Builders and merges.** A derived catalog reaches the builders and merges through their `catalog` parameter: `buildEslintConfig`, `buildOxlintConfig`, `editorPartsOf` and `mergeEslintPart`. `twin-pairs.test.ts` (`twinCatalog`) shows the pattern. `defineLintRules` and `mergeEslintConfig` read the real catalog.

### 2.8 Landing (orchestrator)

1. Data lands first.
2. Core lands second.
   - Its hunks in `packages/rule-data/src` are the 2.7 scaffold. Check that they declare exactly the 2.5 members, then drop them.
   - Its `data/eslint-fallback-skips.json` hunk lands.
3. **Fallout step** (a tester, then the gate):
   - Only the lint-rules assertions that pin a fact this spec's data changes are updated.
   - The data lane's report lists each one: at its end it runs the lint-rules suite in its own copy and records every failure with the card that makes it expected. A failure not on that list is a bug.
   - The 2.7 case files go in this step.
   - The house lane's owed lines also land in this step: `test-fixtures/engines/class-helper.tsx`, and the comment in `engines.integration.test.ts`.

## 3. Core lane (packages/lint-rules)

**Owns:**
- `packages/lint-rules/src/**`
- `packages/lint-rules/test-fixtures/**`, except the cli lane's `test-fixtures/check/` and `test-fixtures/init/`
- `dependencies` in `packages/lint-rules/package.json` (`bin` is the cli lane's)
- `docs/work/spec-core.md`
- the doc sentences named per item

**By the joint agreement, outside the brief's list (8.5):**
- `packages/rule-data/data/eslint-fallback-skips.json`
- the 2.7 scaffold

**Contested with the cli lane (8.3):** `src/agent-configs.ts`.

**Order:**
1. C0
2. the scaffold
3. C12
4. C2, C3, C4, C5, C6, C7, C8, C9, C10, C13
5. C11
6. C1, once installed
7. C14, if assigned

**For every item (CLAUDE.md "Tests"):**
- Write the tests first and watch them fail.
- Use factories, not inline data.
- Pin each refusal beside an allowed case.
- Give each any/every decision an input where the two differ.
- Compare with `toStrictEqual` on members, not counts.
- Integration tests run on the built `dist`: rebuild first.
- Prefer extending an existing helper in `src/__tests__/` (`setUpEngineRun`, the merge factories) over adding one (plan.md: the DRY to-do).
- A change to a builder's parameters edits its call sites in tests mechanically, with no assertion changed. Put new inputs behind one factory (suggested `buildProjectFacts`), so the next fact changes one place.

### C0. Swap example rules the data changes (tester, first)

- In core tests that use a rule only as an example (not as the subject), swap any rule this spec's data changes for one it leaves alone. The new rule must match the old on engine, typed-ness, scope and options shape. What each test tests is unchanged, which CLAUDE.md allows.
- "Changes" covers:
  - every ID in 4.2–4.6
  - every 2.2 key
  - every T untyped rule (4.5), and `no-constant-condition` and `unicorn/no-await-in-promise-methods`, which change engine
  - a 4.4 covered rule, in a test whose rulesets list its cover's ruleset
  - `no-unused-vars`, whose options change (r2-d71)
- **Known users** (grep, re-derived here):
  - `react/jsx-key`: `merge-eslint-config.test.ts`, `__tests__/oxlint-rules-the-team-sets.test.ts`, `__tests__/oxlint-part-alone.test.ts`, `__tests__/oxlint-findings-owed.test.ts`, `__tests__/oxlint-rule-keys.test.ts`, `core/build-eslint-config.test.ts`, `core/file-overrides.test.ts`, `merge-oxlint-config.test.ts`, `merge-oxlint-config.integration.test.ts`, `cases/oxlint-merge-shapes.ts`, `cases/oxlint-team-project.ts`, `cases/team-eslint-projects.ts`
  - `oxc/erasing-op`: `cases/oxlint-merge-shapes.ts`, `merge-oxlint-config.integration.test.ts`
  - `unicorn/no-nested-ternary`: `cases/oxlint-merge-shapes.ts`
  - `@eslint-react/jsx-no-comment-textnodes`: `merge-eslint-config.test.ts`, `cases/team-sets-a-rule.ts`, `cases/editor-merge-sources.ts`, `editor-merges.team-sets-a-rule.integration.test.ts`
  - `unicorn/no-for-each`: `__tests__/eslint-entries-owed.test.ts`, `__tests__/other-eslint-names*.ts`, `merge-eslint-config.test.ts`, `cases/eslint-merge-shapes.ts`
  - `n/no-extraneous-import`: `unresolvable-imports.integration.test.ts`, `cases/unresolvable-imports.ts`
  - `prefer-const`: `editor-merges.off-blocks|twin-pairs|ignores-readings.integration.test.ts`, `cases/both-engines-corpus.ts`
  - `no-unused-expressions`: `cases/team-sets-a-rule.ts`, `cases/team-eslint-projects.ts`, `merge-eslint-config.integration.test.ts`, `editor-merges.team-sets-a-rule.integration.test.ts`
- Find the rest with the grep under Commands. Do not swap where a test is about the changed rule itself: that is fallout (2.8), not C0.
- **Report:** each swap as file, test, old → new. A test where no swap keeps what it tests goes to fallout.

### C1. import-x resolves TypeScript imports (#33 fix C; q-r3; q-r4; q-r4-import-fix-speed)

- **User:**
  - ESLint's import-x rules follow extensionless TS imports, `.js`→`.ts` and tsconfig aliases.
  - Without oxlint, `import-x/namespace`, `no-cycle`, `no-named-as-default` and `no-self-import` run in ESLint.
  - `import-x/order` files aliases as internal.
- **Precondition, the orchestrator's:**
  - Install `eslint-import-resolver-typescript` 4.4.5 (exact) in the real repo, then hard-link it and `is-bun-module` into the core copy. Its other dependencies are already installed.
  - Today `ls node_modules/eslint-import-resolver-typescript` fails, and `npm view` gives 4.4.5 as latest.
  - The core lane adds it to `dependencies` and never installs.
  - Until it is there, write C1's tests, build every other item, and report.
- **Behaviour** (spec-next-batch E1):
  - `import-x/resolver-next` is that package's `createTypeScriptImportResolver`, given the list of every `tsconfig.json` and `jsconfig.json` under `tsconfigRootDir` outside `node_modules` and `.git`.
    - The list is read by the same walk as `tsFilesOutsideEveryTsconfig`, extended to return both.
    - Not `project: tsconfigRootDir`: it misses per-package aliases.
    - Not a `**` glob: it read `node_modules` tsconfigs and crashed ESLint.
  - `import-x/extensions` is `.ts .tsx .cts .mts .js .jsx .cjs .mjs`.
  - Both builds get them:
    - The agent build gets them through C12's facts.
    - In the editor merge, `mergeEslintPart` reads them where `typeInformationFor` already walks: once per merge, whoever gives type information.
    - `buildEslintConfig` and `buildEslintSettings` take the list as input and stay pure.
  - Our `resolver-next` still yields to a team's `import-x/resolver`, `resolver-next`, `resolver-legacy` and `resolve` (O8, `TEAM_SETTINGS_YIELDED_TO`). Our `import-x/extensions` is ours where no team block sets that key: ESLint's settings merge already gives the team's.
  - A project with no tsconfig: no crash, and an extensionless relative import of a `.ts` file still resolves.
  - The `index` and `oxlint` entries load no resolver module.
- **q-r3, in `eslint-fallback-skips.json`:**
  - Remove the skips of `import-x/namespace`, `no-cycle`, `no-named-as-default` and `no-self-import`.
  - Keep `import-x/default` and `no-named-as-default-member`. Rewrite each reason with this round's measurement: what ESLint's version reports, with the resolver, that oxlint's does not.
  - Removing the four makes `eslint-fallback.integration.test.ts` "fires $id on its fixture" run them (it is data-driven): that is the failing test first.
- **Tests owed:**
  - **`src/import-x-resolution.integration.test.ts`** with `test-fixtures/import-x-ts/`: spec-next-batch E-1's probes in the agent build, and every import-x fixture importing a `.ts` file with no extension.
  - **E-2:** a broken `tsconfig.json` inside `node_modules` is never read (no fatal message).
  - **No tsconfig:** an extensionless import resolves.
  - **Editor merge:** a team setting `import-x/resolver` in one package keeps ours out there only (beside `team-import-x-resolvers.test.ts`).
  - **`dist-loading.test.ts` (E-3):** `ESLINT_SIDE_PACKAGE` also names `eslint-import-resolver-[^/]+` and `unrs-resolver`, so the oxlint side is shown to resolve neither. This extends the guard; it changes no assertion.
- **Made wrong:**
  - `core/build-eslint-config.test.ts`, "carries the import-x node resolver, the immutability type overrides, the extensions eslint-plugin-n tries, ours first, and React version detection": now the TypeScript resolver and the extensions (C13 also changes its React part).
  - `cases/team-import-x-resolvers.ts` `OUR_RESOLVER_NAME` becomes the TypeScript resolver's `name`. Its users `team-import-x-resolvers.test.ts` and `team-settings-false-or-null.test.ts` are unchanged otherwise.
  - `team-import-x-resolvers.integration.test.ts`, "is reported by the team's rule, merged, in each package as by the team's config alone":
    - In the packages where the team sets no resolver key (`team-sets-none`, `team-sets-core-modules`), the team's `import-x/no-unresolved` now reads our TypeScript resolver (O8). It stops reporting `./b`, which the team's config alone reports.
    - Those rows owe "not reported, merged". This is call 13.
    - The same check applies to `team-settings-false-or-null.integration.test.ts`: run it and list the rows.
- **Report:** ESLint's time on this repo's `src`, agent set, before and after, as the median of 3. The owner accepted twice as slow on cv-launch; over +25% here goes to the owner.
- **Docs:**
  - architecture.md step 4 (`buildEslintSettings`), step 6 (the facts read in the merge) and step 5 (the skip list's four).
  - plan.md Open: the #33 line goes.
  - questions.md #33: built.

### C2. "Covered by" (S)

- **User:** with both rulesets on, the narrow rule is left out. Any of these brings it back:
  - leaving out the cover's ruleset
  - `rules` turning the cover off
  - `rules` naming the narrow rule
- **Behaviour** (round2-s-covered-by is read as applying only to the cards that chose S; 4.4):
  - In each layer, a shipped rule whose `coveredBy` rule is on (any severity but `off`) is left out, unless the consumer's top-level `rules` state it at any severity. "On" means as the layer's rulesets plus the top-level `rules` turn it on: `rulesOnUnder` in `resolve-rule-layers.ts` computes that per layer. The layers are the top level and each `fileOverrides` entry.
  - An entry whose lists drop the cover's ruleset gets the covered rule back in its files. One that adds the cover's ruleset leaves the rule out there. Both arrive through `rulesetChanges`.
  - An entry's own `rules` naming the covered rule win in its files (applied after its ruleset changes).
  - **Overlapping entries:** where an entry re-states what an earlier entry changed (`restatedBy`), a covered rule counts as in its own list and in its cover's list. Otherwise a later entry re-adding the cover's ruleset leaves the earlier entry's "covered rule back on" standing, and both rules report.
  - **Limit (call 2):** an entry's own `rules` do not move S, in either direction:
    - turning the cover off does not bring the covered rule back in that entry's files
    - turning the cover on does not take the covered rule out there
  - **Naming a twin is not naming the rule:** the consumer naming the covered rule's typescript-eslint twin (`@typescript-eslint/no-unused-expressions` for `no-unused-expressions`) does not count as naming the covered rule. The twin runs as stated: D9's "extension alone", with the core rule not in force.
  - **File scope is not read.** Where the cover runs only in some files, the covered rule is still left out of the whole layer. "Some files" means: the cover's `files` or `ignores`, type information, or an engine that skips a file type. The cards accepted this for r2-d25, d72, d74 and d78. It is not on the cards for r2-d36 or the oxlint-run covered rules (call 12).
  - **Engine-neutral, decided in `resolveRuleLayers`:**
    - The agent build and both editor parts see layers without the covered rule.
    - In the editor merges, S is decided before the team's rules are left out (call 3).
- **Tests owed:**
  - **`core/resolve-rule-layers.test.ts`, factories:** each bullet above, the limit in both directions, and the twin case, each refusal beside an allowed case. The and/or input: a cover on by `rules` alone, beside a cover on by its ruleset alone.
  - **Real engines:** one pair end to end in the agent build and one in each editor merge, with a derived catalog (2.7). One report where two were, beside the cover's ruleset unlisted: the narrow rule's report.
  - **`gate-equivalence.test.ts` and `editor-equivalence.test.ts`:** their expected lists leave out each covered rule whose cover is on, computed from the catalog (no change before the data lands).
- **Made wrong:** none before landing. The equivalence oracles gain the S step, so the expected lists change only once the data has pairs.
- **Docs:**
  - architecture.md step 2: one paragraph, its limit and the twin case.
  - plan.md Open: the round 2 line is the data lane's.

### C3. "Split by types" (T)

- **User:** one report per file for each T pair: the typed rule in typed TS files, the untyped rule everywhere else.
- **Behaviour:**
  - In a layer's files where the untyped rule U and its typed partner T are both on, U is `off` wherever our typed blocks run T: `agents-inc/typed`, an entry's `…/typed`, and their copies within a team's type-information blocks.
  - U keeps its setting in:
    - JS files
    - TS files outside every tsconfig
    - the consumer config files where C9 leaves them untyped
    - any layer where T is off, by ruleset or by `rules`, top level or entry
  - Both rules are ESLint-routed and unscoped (2.6), so no oxlint config changes.
  - **Pitfalls the tests must catch**, because blocks layer:
    1. An entry restating U on (by `rules` or a ruleset change) while T is on there needs its own typed block stating U `off`. Its plain block comes after `agents-inc/typed`, so U would otherwise run in typed files.
    2. An entry turning T off must restate U at its setting in the entry's typed files. U is unchanged, so the entry states nothing of it, and the top-level typed block's `off` would stand.
    3. A copy that states its rules off where a team block takes type information away (`typedBlockOf`'s `rulesWithoutTypes`) must restate U at its setting, not `off`. The pattern is `rulesBackToTheCore` in `build-eslint-config.ts`.
  - **Independent otherwise:** each rule keeps its own setting and options. They are not D9 twins: D9 and D10 apply to oxlint-routed core rules alone (`extensionsOfACoreRuleRoutedToOxlint`, O12).
  - **"The team sets":**
    - The three twin pairs among them (`no-throw-literal`, `consistent-return` and `no-implied-eval` with their extensions) are still one rule (`rulesTheTeamSets` closes over twins).
    - The other T pairs are two rules. T is decided on the layers after the team's rules are left out (call 3).
- **Tests owed** (real ESLint, derived catalog where the data has no pair yet):
  1. `flag === true` in a typed TS file, a JS file and a TS file outside every tsconfig: exactly one report each, the typed rule in the first and unicorn's in the other two.
  2. `rules` turning T off: unicorn's in the typed file.
  3. Pitfall 2: an entry turning T off in `legacy/**`: unicorn's there, T elsewhere.
  4. Pitfall 1: an entry setting U to `warn`: in its typed files T alone, in its JS files U at `warn`.
  5. An entry adding T's ruleset in `src/**`, where the top level lacks it.
  6. A pair spanning rulesets (r2-d41) with an entry dropping T's ruleset.
  7. Pitfall 3: an editor merge where the team gives type information and one team block switches it off. U runs there; T runs where the team's types are.
  8. `throw 'x'`: one report per file kind (spec-next-batch E-5).

  Every assertion sits beside its refusal.
- **Made wrong:** none before landing.
- **Docs:**
  - architecture.md step 4 (U in the typed blocks) and step 6 (copies within the team's blocks).
  - questions.md #35: data's.

### C4. ESLint stands in for oxc rules without oxlint (#55, r2-d49-51; spec-next-batch addendum item 3, E5)

- **User:** a project without oxlint gets `unicorn/no-chained-comparison` (and four more) where oxlint would run the `oxc/` rule.
- **Behaviour:**
  - Without oxlint, the editor ESLint part (`eslintPartWithoutOxlint`, `editor-parts.ts`) states each stand-in wherever the layers state its oxc rule: the top level, scopes and entries.
    - It takes the oxc rule's severity (`off` included), `files` and `ignores`, and none of its options.
    - The oxc rule stays unstated there.
  - Where a layer also states the stand-in's own ID, that statement wins and the rule is stated once.
  - Beside oxlint, and in the agent build, no stand-in is stated.
  - A stand-in the team's config sets is the team's, as any rule is: our stand-in leaves (`ourLayersLeavingOut`).
  - The stand-ins are read from `catalog.eslintStandIns`, and no rule is named in code.
- **Tests owed:**
  - **Factories:** S-3, S-4 and S-6 of the addendum.
  - **S-5, real ESLint:** each stand-in fires on its fixture through `mergeEslintPart` with the 2.2 derived catalog, in a project without oxlint. The fixtures are `a < b < c`, `x === y || x < y`, `s.charAt(0) === 'ab'`, `t += t + n` and `x * 0`.
  - **Index pin:** a stand-in fixture index covers exactly the catalog's stand-ins (2.7's `it.fails` rule applies).
- **Made wrong:** `editor-equivalence.test.ts` "runs every ESLint-routed rule and every moved rule not skipped…" (no oxlint). Its expected list gains each stand-in whose oxc rule is on, with `[]`, computed from `catalog.eslintStandIns`: no change before landing.
- **Docs:**
  - architecture.md step 5 (without oxlint).
  - plan.md Decisions "Editor export": "Only the `oxc/*` rules have no ESLint version" gains "five of them have a unicorn stand-in".
  - plan.md Open: the "#54–#56" line loses #55.

### C5. Stubs for oxlint's spelling of renamed rules (my-renamed-in-eslint)

- **Measured** (oxlint 1.87, by pm-lanes): oxlint honours a suppression naming `unicorn/no-array-for-each` and ignores one naming `unicorn/no-for-each`.
- **Re-derived here:** unicorn 77 has `no-for-each`, `dom-node-dataset` and a deprecated `prefer-dom-node-dataset`, but no `no-array-for-each`. So where suppressions are allowed, a comment in oxlint's spelling would make ESLint report "Definition for rule … was not found".
- **Behaviour:** the stub names (`oxlintRuleNamesByPrefix`, `build-eslint-config.ts`; used by the agent build and by the ESLint merge beside oxlint) also hold, for each oxlint-routed rule whose oxlint rule name differs from its ID's rule name, that name under the ID's own prefix, where the plugin lacks it. After the data lands, that is `unicorn/no-array-for-each` alone.
- **Limit (stated on the my-renamed-in-eslint card, so no new card):** where suppressions are allowed, a suppression of these rules must use oxlint's spelling.
- **Tests owed (factories):**
  - A route whose oxlint rule name differs gets the stub.
  - Where the plugin already has that name, there is none.
  - A route whose oxlint name differs only in prefix (`typescript/…`) gets none.
  - Place them beside `core/build-eslint-config.test.ts` "gives each stub plugin one rule per oxlint-routed ID under its prefix, listed or not".
- **Made wrong:** none.
- **Docs:** architecture.md step 4, last paragraph (the stubs).

### C6. Refuse ESLint below 10 (q-r7)

- **User:** a team on ESLint 9 that calls `mergeEslintConfig` gets one clear error instead of an unmeasured merge.
- **Behaviour:**
  - `mergeEslintConfig` (`eslint.ts`) first resolves `eslint/package.json` from `tsconfigRootDir`: the team's ESLint, read the way `installed-oxlint.ts` reads oxlint's. ESLint 10.12 exports `./package.json`.
  - If the version's major is below 10, it throws.
  - If ESLint 10 or any later major resolves, the merge goes on.
  - **If none resolves, the merge goes on (changed from the joint spec; call 9):**
    - The ESLint running the config is then installed elsewhere, and we cannot read it.
    - Refusing there would also refuse every merge test whose `tsconfigRootDir` is a temp folder (`EMPTY_TSCONFIG_ROOT_DIR`, `setUpTempProjects`), which is most of the suite.
  - The check runs on every call, reading mode included, so an oxlint merge reading this file fails with the same message.
- **Text (verbatim):** `eslint.config.mjs: the ESLint installed for <dir> is <version>; @agents-inc/lint-rules needs ESLint 10 or later: install eslint 10`
- **Version parsing:**
  - Do not use `semver` (a devDependency).
  - Read the major at the parse boundary. The floor is a named constant.
  - A version not starting with digits and a dot throws an internal error naming the manifest's path.
- **Tests owed:** new `src/merge-eslint-config.installed-eslint.test.ts`, mirroring `merge-oxlint-config.installed-oxlint.test.ts`, with temp projects holding a fake `node_modules/eslint/package.json`:
  - 9.39.1 is refused, with the full message.
  - 10.0.0, 11.0.0 and `10.0.0-rc.1` are accepted beside it.
  - With none installed, the merge is accepted.
- **Made wrong:** none, by the change above.
- **Docs:**
  - plan.md Requirements: "ESLint 10 or later; the merge refuses 9".
  - architecture.md step 6: one clause.
  - questions.md: nothing (q-r7 was a card).

### C7. Our runtime globals only where our `no-undef` runs (#68, read-q68)

- **User:** in the editor merges, our runtimes' globals stop silencing a team's own `no-undef`. A team that sets `no-undef` gets `window` reported in its Node files again.
- **Behaviour:**
  - Editor merges only; the agent build is unchanged. This needs 2.5's `readsRuntimeGlobals`, because the core may not name `no-undef` (`names-no-rule.test.ts`).
  - Our runtime globals and env are emitted only in the files where a rule of ours with `readsRuntimeGlobals` runs, in that part's own engine. They come from the top level and from each entry's env changes.
  - **ESLint merge:**
    - Beside oxlint, none (oxlint runs `no-undef`).
    - Where the team sets `no-undef`, none: it is the team's, so ours runs nowhere.
    - Without oxlint, only the JS files our `no-undef` reaches, after its shipped `ignores`, our `ignores` and entries turning it off.
  - **oxlint merge:**
    - Our runtime env only in the files our `no-undef` runs in. That leaves out TS files, by its shipped `ignores`, and, after the data lands, `.svelte` files (q79).
    - Where the team sets `no-undef`, none.
    - The team's root env keys still win where set (step 7).
  - **Unchanged:** non-runtime envs (`builtin`, `es2024`), the framework globals (Svelte, Vue, Astro) and C10's test globals.
  - **Pattern:** "where our part runs a rule" is `whereOurOxlintPartRuns` (`where-our-parts-run.ts`) and `ourEslintPartOf`; confining a block of ours to files is `confinedBeside` (`merge-eslint-config.ts`).
- **Tests owed**, each merge, with and without oxlint, real engines:
  - **Refusal:** the team sets `no-undef` and our editor set lists `browser`. `window` in a Node JS file is reported by the team's rule.
  - **Allowed, beside it:** the team does not set it. Our `no-undef` runs with our env: `window` passes and `process` is reported, in a browser-only set.
  - **Entry:** an entry turning `no-undef` off in `lib/**`: no runtime globals of ours in `lib/**`.
- **Made wrong (#68 reverses #47 for runtime env):**
  - `merge-eslint-config.test.ts`, "stand in the team block's files, and ours elsewhere: the parser, a parser option, a global and a setting, in a project $project". Its editor set lists only `browser`, so `window` elsewhere is no longer `false`. To keep what it tests, give ours a running `no-undef` (correctness, no oxlint) or probe a non-runtime language option. C13 also changes its `reactVersion`.
  - `merge-oxlint-config.test.ts`: "keeps our runtime's env in every file, where the team's root states every rule our part runs", and "keeps the env an override of the team's sets in its files, and ours elsewhere". Both have a `browser`-only editor set, so ours does not run `no-undef`. "keeps the env key the team's root sets, and our runtime's beside it, in every file": check its `es2024` half, which is non-runtime.
  - `merge-oxlint-config.integration.test.ts`, "declare their globals for the team's no-undef in that entry's files: …". The team sets `no-undef`, so `lib/i.js`'s `window` is reported too.
  - Run the suite: any other env/globals failure goes in the report, mapped to #68 or flagged as a bug.
- **Docs:**
  - architecture.md steps 6 and 7 (env/globals).
  - plan.md Open: the #68 line goes.
  - questions.md #68: built.

### C8. A team block whose `basePath` lies outside the project (my-basepath-bug)

- **User:** a team's typed block or settings under `basePath: '..'` reach the project's files, as ESLint applies them.
- **Behaviour:**
  - Every reading of a team block's `files` and `ignores` with a `basePath` outside the root reads the globs as ESLint does. They are read from that path, and the project's files they match are the block's.
  - The readings are `teamFilesFromTheRoot` and its three callers: `typeInformationBlocksOf`, `filesTheTeamBlockAppliesTo` and `eslintDefaultIgnoresHoldBeside`, which is conservative today for an outside block with a negated glob.
  - **Examples:**
    - `basePath: '..'` with `files: ['**/*.ts']` reaches every TS file of the project.
    - `['<folder>/src/**']` reaches the project's `src`.
    - `'../elsewhere'`, or a glob naming a sibling folder, reaches none.
  - **The how is the developer's.** Either put our globs under the root's path from the team's `basePath` (the mirror of `teamFilesUnder`), or translate the team's globs. The result must equal ESLint's own reading.
- **Oracle:** ESLint's calculated config for the project's files (`eslint-config-oracle.ts`), for:
  - `..`
  - `../elsewhere`
  - an absolute path outside the project
  - `<folder>/src/**` from `..`
  - a wildcard segment (`*/src/**`) from `..`
  - a sibling folder
  - ignores with a negated glob, from `..`
- **Made wrong:** `merge-eslint-config.test.ts`, "runs in no file where the basePath of the only block giving types lies outside the project, %s".
  - Its `..` row now runs (`error`). Its comment, which says ESLint applies such a block to no file, was the bug.
  - The `../elsewhere` row stays.
  - Any other row the oracle shows wrong is reported, not flipped silently.
- **Docs:**
  - architecture.md step 6: "A team `basePath` is applied…", one clause for outside.
  - plan.md Open: the "ESLint merge defect: … basePath" line goes.
  - decisions.md: the 2026-10-13 entry stands as history.

### C9. Type-aware rules on our config files (typed-config-files; my-own-files-untyped's note)

- **User:** `agents-inc.lint.mts` and `oxlint.config.mts` at `tsconfigRootDir` get the typed rules where the type information is ours, without a fatal parse error whatever the tsconfig shape.
- **Behaviour:**
  - **Where the type information is ours** (the agent build, and the ESLint merge where no team block gives type information), the two files get the typed rules.
    - A file that a tsconfig takes in gets them through that tsconfig.
    - A file that none takes in gets them through typescript-eslint's default project: `allowDefaultProject`, naming exactly those files, literal paths relative to `tsconfigRootDir`, never `**`.
    - Never both for one file. That combination was the fatal parse error that made us leave them out.
  - **The imported-only trap (D-h):** `oxlint.config.mts`, and with `allowJs` `eslint.config.mjs`, import `./agents-inc.lint.mts`. Where a tsconfig takes in an importer and not `agents-inc.lint.mts` itself:
    - the walk lists `agents-inc.lint.mts` as outside every tsconfig
    - the project service finds it through the import, so `allowDefaultProject` on it is fatal

    A required test case covers this. The fix is the developer's: for example, counting a config file as taken in where a taken-in file imports it.
  - **The default project must resolve `@agents-inc/lint-rules`.** Our `package.json` has `exports` only (#38). Measure three options, and take the simplest that gives no typed finding on plan.md's files in every shape tested:
    - TypeScript's defaults
    - the project's root `tsconfig.json` as `defaultProject`
    - a tsconfig we ship
  - **Other files:**
    - `eslint.config.mjs` is a JS file, and our typed rules run on TS files only, so nothing changes for it.
    - Config files below the root (another package's, seen from a monorepo root) are any TS file: typed where a tsconfig takes them in, else untyped (call 6). Where the type information is ours, the typed blocks therefore stop ignoring `CONSUMER_CONFIG_FILES` and ignore only the files outside every tsconfig.
    - Where the team gives type information, nothing changes: they stay out of our typed rules (call 6).
    - Unchanged: `perfectionist/sort-objects` and `unicorn/no-top-level-side-effects` skip them (my-own-files-pass).
- **Tests owed** (real ESLint, agent build and ESLint merge):
  - Lint `test-fixtures/consumer-files` in every layout of `cases/tsconfig-layouts.ts` (solution-style included), plus `IMPORTED_ONLY_LAYOUT`, plus these:
    - (a) the root tsconfig takes the files in
    - (b) a tsconfig takes in `oxlint.config.mts` alone
    - (c) no tsconfig
  - In each: no fatal message, and a typed rule fires on a floating promise planted in each `.mts` file.
  - plan.md's verbatim files draw no typed finding where `@types/node` is installed (linked into the temp project).
  - **Without `@types/node`:** measure `tsconfigRootDir: import.meta.dirname` and report any finding to the owner (q-i9 kept that line). Do not silence it.
- **Made wrong:**
  - `consumer-files.integration.test.ts`, "run no typed rule on %s, which gets no project service" (both files, both tsconfigs): it now owes the typed rules.
  - Any `core/build-eslint-config.test.ts` assertion that the typed block ignores the consumer files where the type information is ours.
  - Every integration test that writes `agents-inc.lint.mts` into a temp project now lints it typed. A new finding or fatal message there is a C9 bug or a measured typed finding to report; it is never an assertion to loosen.
- **Docs:**
  - architecture.md step 8 (rewrite: which files, how).
  - plan.md "Considered and dropped": the row "Typed linting of the consumer's config files (`allowDefaultProject`)" goes, with a Corrections row (old, new, why).
  - plan.md Open: the limits of call 6.

### C10. Test-runner globals in test files (q76)

- **User:** JS tests using Vitest's or Jest's globals stop drawing `no-undef`.
- **Behaviour:**
  - Vitest's and Jest's globals, read-only, as each engine gives them:
    - oxlint: env `vitest` and `jest`, both in oxlint 1.87's schema (verify that `no-undef` honours them).
    - ESLint: the `globals` package's `vitest` and `jest`.
  - They apply in test files: `**/*.{test,spec}.<JS and TS extensions>` and `**/__tests__/**` of those extensions. These are the shapes the shipped test-file `ignores` use.
  - They apply whatever rulesets are listed, in both builds and both merges, as the framework globals do (`framework-globals.ts`; call 5). The oxlint side is an override; the ESLint side is a block named `agents-inc/test-runner-globals`, right after `agents-inc/svelte-runes`.
  - An ESLint block naming them names JS and TS files only, so ESLint lints no file it would not lint without us (my-no-added-files).
- **Tests owed** (real engines; agent build and both merges):
  - A JS test using `describe`, `it`, `expect`, `vi` and `jest.fn()` gets no `no-undef` report.
  - The same names in a non-test JS file are reported.
  - A `.test.json` file is not linted by ESLint.
- **Made wrong** (one constant each, what they test unchanged):
  - `cases/svelte-components.ts` `FRAMEWORK_GLOBALS_OXLINT_OVERRIDES` gains the test override, or a sibling constant spread beside it in `core/build-oxlint-config.test.ts` and `core/file-overrides.test.ts`.
  - The block-name lists gain `agents-inc/test-runner-globals`:
    - `core/build-eslint-config.test.ts`, "emits named blocks in order: ignores, base, Svelte runes, typed, built-in scopes, file overrides, off-switch"
    - `merge-eslint-config.test.ts`, "keep the names they have outside a merge, each stating the rules owed, where …"
    - `merge-eslint-config.test.ts`, "move each rule into a copy of its block, where the team takes them back …"
- **Docs:**
  - architecture.md step 3 (overrides) and step 4 (blocks).
  - plan.md Open: the #76 clause goes from the "Raised by real run 3" line.
  - questions.md #76: built.

### C11. Install the packed package with npm (q58)

- **New `src/packed-install.integration.test.ts`:**
  - `npm pack` the built `packages/lint-rules` (the gate builds first) into a temp folder.
  - Make a fresh temp project whose `package.json` lists the tarball, `eslint` 10.12.0, `oxlint` 1.87.0 and `typescript` 6.0.3 (in our peer range).
  - Run `npm install --ignore-scripts --no-audit --no-fund`.
  - Write plan.md's three files from `test-fixtures/consumer-files`, plus a source file with one known finding per engine, from rules this spec leaves alone.
- **Asserts:**
  - The install exits 0.
  - ESLint and oxlint each load their config and report exactly the planted finding, by rule ID.
  - No "Cannot find module" appears anywhere.
- **Runtime:**
  - It needs the network and takes about a minute: give it a generous timeout.
  - It fails, never skips, when it cannot install. Run the tool in `beforeAll`.
  - Temp folders are removed in `afterAll`.
  - The cli lane's X7, `npx agents-inc-lint check` in the installed project, is added once that lane lands.
- **Docs:** plan.md Open: the "#58" line goes. questions.md #58: built.

### C12. One builder of the agent set's configs (spec-next-batch E4; the interface for `check`)

- **New `src/agent-configs.ts`:**
  - It exports `buildAgentConfigs(agentSettings: LintRulesInput): AgentConfigs` and `AgentConfigs = { readonly oxlint: OxlintConfig; readonly eslint: Linter.Config[] }`.
  - It reads the project facts once: the walk of `tsconfigRootDir` (TS files outside every tsconfig, plus C1's tsconfig list), and whether `react/package.json` resolves from `tsconfigRootDir` (C13). It then calls both builders with the real catalog and registry.
  - It is not a package export.
- **Test helper:** `src/__tests__/agent-configs.ts`'s `agentConfigsOf(defined)` becomes `buildAgentConfigs(agentSettingsOf(defined.editorRulesets.eslint))`.
- **`check` (cli lane)** calls `buildAgentConfigs(agentSettingsOf(eslint))`. The cli lane's spec names this file and `agentConfigsOf` as its own (8.3).
- **Tests owed:** a project with a sub-package tsconfig and a stray TS file. `buildAgentConfigs` gives the resolver that tsconfig and leaves that file out of the typed block. This goes through the real walk; the C1, C9 and C13 tests cover the rest.
- **Docs:** architecture.md "Data flow" and step 1 (`agentSettingsOf` → `buildAgentConfigs`).

### C13. No eslint-plugin-react warning without React (spec-next-batch E3)

- **Behaviour:**
  - Where `react/package.json` does not resolve from `tsconfigRootDir`, `settings.react.version` is `999.999.999`. That is the version eslint-plugin-react 7.37.5 assumes when detection fails (`ULTIMATE_LATEST_SEMVER` in `lib/util/version.js`, not exported), so the plugin behaves the same and prints nothing.
  - Write it as a named constant citing that file.
  - Where React resolves, the setting is `detect`.
  - Both builds.
  - Limit (call 15): React resolving only from a package below `tsconfigRootDir` (pnpm, no hoisting) gets the latest version assumed.
- **Tests owed:**
  - **Console spy:** nothing printed for a JSX file in a project without React.
  - **Positive control beside it:** `detect` in that project prints the warning.
  - **Flag reset:** the plugin warns once per process and caches the version (`warnedForMissingVersion`, `cachedDetectedReactVersion`), so reset both with the exported `resetWarningFlag` and `resetDetectedVersion` before each case. Otherwise any earlier ESLint run makes the spy pass vacuously.
  - **React installed:** React is installed nowhere in this repo, so use a fake package (`package.json` plus an `index.js` exporting `version`) to show `detect` where React is installed.
- **Made wrong:**
  - `core/build-eslint-config.test.ts`: the settings test named under C1.
  - `merge-eslint-config.test.ts`, "stand in the team block's files, and ours elsewhere: … a setting …" (`reactVersion: 'detect'` → `999.999.999`; also C7).
- **Docs:** architecture.md step 4 (settings). decisions.md "settings.react.version: 'detect'" is history; add the new decision.

### C14. No oxlint version refusal (#56; spec-next-batch addendum item 4, M3), only if the orchestrator assigns it (8.4)

- Build spec-next-batch Item 4 as written.
- **Re-derived here:**
  - `refuseUnsupportedInstalledOxlint` (`core/installed-oxlint.ts`) still refuses by our peer range (`ourOxlintPeerRange` → `rangeListedIn`, `isInCaretRange`).
  - It still resolves `oxlint/package.json` with `createRequire(...).resolve`.
  - The refusal texts still say "install another oxlint within <range>".
- Every file it touches is core's.
- **M2** (peers to `dependencies`, then `bun install`) is the orchestrator's at landing, after M3: lanes cannot install.

### Core: do not

- Name a rule in code (`names-no-rule.test.ts`), apart from the data's own fields.
- Change any data but `eslint-fallback-skips.json`, or edit rule-data beyond the 2.7 scaffold.
- Run an install, read a tsconfig inside `node_modules`, or use a cast or a function matcher.
- Build #77 (the cli lane's `init` list) or any data item.

## 4. Data lane (packages/rule-data): the data lane's, kept for reference

**Owns:**
- `packages/rule-data/**`, generated files only through `bun run --cwd packages/rule-data generate`, except `data/eslint-fallback-skips.json` (core's)
- `docs/work/spec-data.md`
- the doc sections in 6

It places `house/require-class-helper`; the house lane owns its code.

**How every rule change is made:**
- Every rule change below is a `rules.json` edit, then a regenerate.
- An option or scope change is proven on the engine that runs the rule (4.8).
- A dropped rule leaves `rules.json` and becomes an unshipped `RuleId`, with no candidates entry (one state per rule).
- A dropped oxlint rule also leaves `oxlint-file-types.json` and `__tests__/cases/oxlint-rule-triggers.ts` where it appears.

### 4.1 The interface (2.1–2.6), including `optIn`, the stand-ins file and (pm-core) `readsRuntimeGlobals`.

### 4.2 Drops

| Card | Rules leaving `rules.json` |
| --- | --- |
| r2-d1 | `react/jsx-key` |
| r2-d2 | `@eslint-react/jsx-no-comment-textnodes` |
| r2-d3 | `react/no-did-mount-set-state`, `react/no-did-update-set-state`, `react/no-will-update-set-state` |
| r2-d4 | `@eslint-react/x-no-component-will-mount`, `x-no-component-will-receive-props`, `x-no-component-will-update`, `x-no-unsafe-component-will-mount`, `x-no-unsafe-component-will-receive-props`, `x-no-unsafe-component-will-update` |
| r2-d5 | `react/no-unused-class-component-methods` |
| r2-d6 | `react/no-unstable-nested-components`, `@eslint-react/x-static-components` |
| r2-d7, d8, d9, d10, d13 | `@eslint-react/x-no-unstable-default-props`, `dom-no-dangerously-set-innerhtml-with-children`, `dom-no-void-elements-with-children`, `x-no-unstable-context-value`, `jsx-no-children-prop-with-children` |
| r2-d11, d12, d15 | `react/iframe-missing-sandbox`, `react/jsx-no-script-url`, `react/style-prop-object` |
| r2-d14 | `react/jsx-no-leaked-render` |
| r2-d18 | `functional/no-class-inheritance`, `react/prefer-stateless-function` |
| r2-d20 | `react-hooks/set-state-in-effect` |
| r2-d26, d28 | `jsx-a11y/no-aria-hidden-on-focusable`, `jsx-a11y/anchor-has-content` |
| r2-d29, d44, d45, d55, d56, d61 | `sonarjs/object-alt-content`, `no-return-type-any`, `class-name`, `call-argument-line`, `array-callback-without-return`, `async-test-assertions` |
| r2-d35, d36, d43 | `@typescript-eslint/prefer-for-of`, `no-non-null-asserted-nullish-coalescing`, `no-unsafe-unary-minus` |
| r2-d42, d52 | `oxc/bad-object-literal-comparison`, `oxc/bad-match-all-arg`, `oxc/bad-replace-all-arg` |
| r2-d47, d64-66 | `regexp/no-legacy-features`, `regexp/no-non-standard-flag` |
| r2-d48, d54 | `promise/no-multiple-resolved`, `promise/prefer-await-to-then` |
| r2-d53, d69, d77, d80 | `unicorn/require-module-specifiers`, `no-nested-ternary`, `no-this-outside-of-class`, `prefer-reflect-apply` |
| r2-c1, c3, c4 | `unicorn/no-useless-recursion`, `no-unnecessary-splice`, `prefer-single-replace` |
| r2-d59 | `n/no-extraneous-import`, `n/no-extraneous-require` |
| r2-d76 | `default-case-last` |
| r2-c10 | `sonarjs/shorthand-property-grouping` |
| r2-n3 | `react/prefer-es6-class` |
| q-r4 | `import-x/no-rename-default` |
| r2-d49-51 | `unicorn/no-invalid-character-comparison`, `no-misrefactored-assignment`, `no-constant-zero-expression`: unshipped, then stand-ins (2.2) |
| modern-js (third sweep; spec-next-batch D7) | `unicorn/prefer-regexp-escape`, `prefer-error-is-error`, `prefer-iterator-concat`, `prefer-uint8array-base64`, `prefer-temporal`, `prefer-get-or-insert-computed`, `prefer-promise-try`, `prefer-dispose`: each into `rule-candidates.json` as `parked` (D7's text); the Node-version category stays a plan.md to-do |

**The owner's r2-d7 note:**
- Where a drop leaves an oxlint-run rule as the only reporter, that rule must have an ESLint version and no skip, so teams without oxlint keep the check.
- Each rule on the list below passes today (inventory and skip list read here); the test keeps it so.
- From the cards: `react/jsx-no-comment-textnodes`, `react/no-object-type-as-default-prop`, `react/no-danger-with-children`, `react/void-dom-elements-no-children`, `react/jsx-no-constructed-context-values`, `react/no-unsafe`, `jsx-a11y/control-has-associated-label`, `jsx-a11y/alt-text`, `no-constant-binary-expression`, `no-unexpected-multiline`, `no-invalid-regexp`, `no-useless-call`, `import-x/no-empty-named-blocks`, `@typescript-eslint/no-useless-empty-export`, `@typescript-eslint/no-explicit-any`, `vitest/valid-expect`.
- Pin the list in a test. A rule on it that fails the check goes to the owner, not to the skip list.

### 4.3 Options and scope

| Card | Rule | Change |
| --- | --- | --- |
| r2-d4 | `react/no-unsafe` | `[{ "checkAliases": true }]` (oxlint 1.87 accepts it and then reports `componentWillMount` too; measured here) |
| r2-d19 | `react/jsx-no-bind` | add `"allowBind": true` |
| r2-d46 | `@typescript-eslint/no-deprecated` | an `allow` list of the APIs the autofixing rules report (`substr`, `trimLeft`/`trimRight`, `keyCode`/`charCode`/`which`, the legacy RegExp statics, Node's deprecated APIs n/no-deprecated-api reports), each measured silent under the option |
| r2-d62 | `@typescript-eslint/no-floating-promises` | `allowForKnownSafeCalls` for the calls `testing-library/await-async-utils`, `await-async-queries`, `await-async-events` and `vitest/valid-expect` report (each `findBy*`/`findAllBy*` name listed) |
| r2-d62 | `testing-library/await-async-events` | `ignores` story files |
| r2-d63 | `testing-library/no-dom-import` | `ignores` story files (the glob `storybook/use-storybook-testing-library` uses) |
| r2-d67 | `no-irregular-whitespace` | `[{ "skipRegExps": true }]`; oxlint accepts the key (measured); measure that it is honoured, or route the rule to ESLint with `eslintBecause` |
| r2-d71 | `no-unused-vars` | `caughtErrors: "none"` |
| r2-c11 | `unicorn/class-reference-in-static-methods` | `[{ "preferThis": false }]` |
| r2-c14 | `no-void` | `[{ "allowAsStatement": true }]` (oxlint 1.87 honours it: `void save();` silent, `const x = void 0` still reported; measured here) |
| r2-c17 | `functional/no-classes` | `ignoreCodePattern` matching error boundaries (`componentDidCatch` / `getDerivedStateFromError`), measured on a boundary and a plain class |
| r2-c17-this (read-c17-this) | `functional/no-this-expressions` | it takes no options: `ignores` naming error-boundary files if a file-name pattern finds them in the corpus; otherwise drop the rule (then r2-d77's S pair is not recorded) |
| r2-n4 | `sonarjs/function-name` | the format accepts a leading `UNSAFE_` |
| r2-n5 | `check-file/folder-naming-convention` | `(` and `)` allowed in folder names |
| q-r2-array-literal-assertions | `@typescript-eslint/consistent-type-assertions` | add `"arrayLiteralTypeAssertions": "never"` |
| q71 | `unicorn/no-top-level-side-effects` | `ignores` add `**/*.config.{js,mjs,cjs,ts,mts,cts}` |
| q79 | `no-undef` | `ignores` add `**/*.svelte` (Svelte's own checker reports undeclared names there) |
| q70 | `no-implicit-globals` | moves from `correctness` to the `browser` runtime ruleset: Node code stops getting it, browser scripts keep it (a reading: section 7) |

### 4.4 S pairs (`coveredBy`), from the cards where an (S) option was chosen

| Card | Covered rule(s) | Cover |
| --- | --- | --- |
| r2-d16 | `jsx-a11y/aria-props` | `@eslint-react/dom-no-unknown-property` |
| r2-d18 | `@eslint-react/x-no-class-component` | `functional/no-classes` |
| r2-d24 | `react-hooks/globals` | `unicorn/no-top-level-assignment-in-function` |
| r2-d25 | `react-hooks/immutability` | `functional/immutable-data` |
| r2-d35 | `unicorn/no-for-loop`, `guard-for-in`, `@typescript-eslint/no-for-in-array` | `house/no-classic-loops` |
| r2-d36 | `@typescript-eslint/no-non-null-asserted-optional-chain`, `no-confusing-non-null-assertion`, `no-extra-non-null-assertion` | `@typescript-eslint/no-non-null-assertion` |
| r2-d57 | `no-return-assign` (and not `no-cond-assign`: the orchestrator's reading; section 8) | `sonarjs/no-nested-assignment` |
| r2-d60 | `testing-library/no-debugging-utils` | `sonarjs/no-debug-commands-in-ui-tests` |
| r2-d72 | `no-new`, `no-unused-expressions` | `functional/no-expression-statements` |
| r2-d73 | `@typescript-eslint/no-extraneous-class` | `functional/no-classes` |
| r2-d74 | `unicorn/no-array-sort`, `unicorn/no-array-reverse`, `unicorn/no-array-front-mutation` | `functional/immutable-data` |
| r2-d75 | `prefer-const` | `functional/no-let` |
| r2-d77 | `@typescript-eslint/no-invalid-this` (only if `functional/no-this-expressions` still ships after r2-c17-this) | `functional/no-this-expressions` |
| r2-d78 | `react/prefer-read-only-props` | `functional/prefer-immutable-types` |
| r2-n1 | `sonarjs/prefer-while`, `unicorn/prefer-while-loop-condition` | `house/no-classic-loops` |

### 4.5 T pairs (`splitByTypesWith`) and q-r6

| Card | Untyped rule | Typed rule |
| --- | --- | --- |
| r2-d32 | `unicorn/no-useless-template-literals` | `@typescript-eslint/no-unnecessary-template-expression` |
| r2-d33 | `unicorn/no-unnecessary-boolean-comparison` | `@typescript-eslint/no-unnecessary-boolean-literal-compare` |
| r2-d34 | `unicorn/no-useless-coercion` | `@typescript-eslint/no-unnecessary-type-conversion` |
| r2-d40 | `unicorn/no-await-in-promise-methods` | `@typescript-eslint/await-thenable` |
| r2-d41 | `no-constant-condition` | `@typescript-eslint/no-unnecessary-condition` |
| q-r5 (D31) | `no-throw-literal` | `@typescript-eslint/only-throw-error` |
| q-r6 | `consistent-return` (new: `correctness`, ESLint, untyped, `[]`) | `@typescript-eslint/consistent-return` |
| q-r6 | `no-implied-eval` (new: `security`, ESLint, untyped, `[]`) | `@typescript-eslint/no-implied-eval` |

- `no-constant-condition` and `unicorn/no-await-in-promise-methods` move from oxlint to ESLint, and `no-implied-eval` ships in ESLint, each with `eslintBecause`. The reason: oxlint's part is not told which files have type information, so its copy would report beside the typed rule (call 1). Add the three to `__tests__/cases/routed-to-eslint-for-a-reason.ts`.
- New entries carry `assignment.by: "owner-2026-10-14"`.

### 4.6 Suppressions, routing, rulesets

- **q-r1:** `unicorn/no-abusive-eslint-disable` runs in oxlint (`engine: oxlint`, `oxlintName: unicorn/no-abusive-eslint-disable`). Its `whenSuppressions` stays. There is no house blanket mode: q-r1 replaces #22's.
- **r2-d22:** `react-hooks/rule-suppression` gets `whenSuppressions: { "banned": "off", "allowed": "on" }`, so `rules` can no longer name it.
- **my-renamed-in-eslint:**
  - `unicorn/no-for-each` (oxlint name `unicorn/no-array-for-each`) and `unicorn/dom-node-dataset` (oxlint name `unicorn/prefer-dom-node-dataset`) run in oxlint.
  - `catalog.test.ts`'s rule that a renamed rule stays in ESLint is reversed.
  - Record oxlint's suppression spelling (C5).
- **lib-structure, q-r2, q-r2b:**
  - The `class-names` ruleset (2.3) holds `house/require-class-helper`: ESLint, `[]`, untyped, `assignment.by: "owner-2026-10-14"`.
  - Its `rule-candidates.json` entry goes.
  - The card's other names (`nextjs`, `react-ssr`, `playwright`, `jest-dom`, `tailwind`, `tanstack-query`, `drizzle`, `tanstack-router`, `zod`, `jsonwebtoken`, `browser-targets`) hold no rule yet. Each is created when its first rule ships (call 10).
- **`readsRuntimeGlobals` (pm-core, C7):** set on `no-undef`.
- **Unchanged by an answer:**
  - r2-d17, d21, d27, d30, d38, d39, d47-sonarjs, d58, d68, d70, d79
  - r2-c5, c6, c12
  - r2-n2

### 4.7 Data tests owed (written first, watched failing)

- `canonical-list.test.ts`:
  - The 2.6 invariants (with `readsRuntimeGlobals`), each an offenders list that must be empty, each refusal pinned beside the real data.
  - The 4.4 and 4.5 pairs pinned with `toStrictEqual`.
  - Every definition has `optIn`, and `class-names` is in its domain.
- A stand-ins test mirroring `eslint-fallback-skips.test.ts`: exactly 2.2's pairs.
- `catalog.test.ts`: the catalog parses `coveredBy`, `splitByTypesWith`, `readsRuntimeGlobals`, `eslintStandIns` and `optIn` as 2.5 says, with defaults where absent.
- The r2-d7 list (4.2) has ESLint versions and no skip.
- `rule-candidates.test.ts`: the eight modern-js rules are `parked`, and `house/require-class-helper` is gone.
- Generated files are fresh (`generated-files.test.ts`).

### 4.8 Each changed option, proven on its engine

- A new rule-data integration test (e.g. `src/option-changes.integration.test.ts`) runs each 4.3 entry on the engine that runs it, read from the catalog (not a copy).
- Each entry gets one input where the option changes the result, beside one where it does not.
- Where oxlint refuses or ignores an option, the rule moves to ESLint with `eslintBecause` (owner, 2026-10-14) and the test runs it there.

### Data: do not

- Ship any other candidate.
- Touch `eslint-fallback-skips.json`, or anything in `packages/lint-rules` or `packages/eslint-plugin-house`.
- Change versions or install.

## 5. Existing tests the answers make wrong (core copy)

**Before landing, in the core lane:** each item's "Made wrong" above, and C0's swaps. In short:

| Item | File | Test | Why |
| --- | --- | --- | --- |
| C1, C13 | `core/build-eslint-config.test.ts` | "carries the import-x node resolver, the immutability type overrides, the extensions eslint-plugin-n tries, ours first, and React version detection" | #33 fix C; E3 |
| C1 | `__tests__/cases/team-import-x-resolvers.ts` | `OUR_RESOLVER_NAME` (constant) | #33 |
| C1 | `team-import-x-resolvers.integration.test.ts` (and to check: `team-settings-false-or-null.integration.test.ts`) | "is reported by the team's rule, merged, in each package as by the team's config alone": the packages setting no resolver key | #33 with O8 (call 13) |
| C1 | `dist-loading.test.ts` | `ESLINT_SIDE_PACKAGE` names the resolver packages (guard extended) | E-3 |
| C7 | `merge-eslint-config.test.ts` | "stand in the team block's files, and ours elsewhere: the parser, a parser option, a global and a setting, in a project $project" (also C13) | #68 |
| C7 | `merge-oxlint-config.test.ts` | "keeps our runtime's env in every file, where the team's root states every rule our part runs"; "keeps the env an override of the team's sets in its files, and ours elsewhere"; check "keeps the env key the team's root sets, and our runtime's beside it, in every file" | #68 |
| C7 | `merge-oxlint-config.integration.test.ts` | "declare their globals for the team's no-undef in that entry's files: …" | #68 |
| C8 | `merge-eslint-config.test.ts` | "runs in no file where the basePath of the only block giving types lies outside the project, %s": the `..` row | my-basepath-bug |
| C9 | `consumer-files.integration.test.ts` | "run no typed rule on %s, which gets no project service" | typed-config-files |
| C10 | `core/build-eslint-config.test.ts`; `merge-eslint-config.test.ts` | the block-name lists named under C10 | q76 |
| C10 | `__tests__/cases/svelte-components.ts` | `FRAMEWORK_GLOBALS_OXLINT_OVERRIDES` (constant), or a sibling | q76 |

For each changed assertion, the report says which assertion and why it is allowed: a bug fix or answer made it wrong, or the edit leaves what it tests unchanged.

**In the data copy:** the data lane's spec section 5.

**At landing (2.8), expected in lint-rules:**
- `test-fixtures/eslint-fallback/fixtures.json`: fixtures of dropped oxlint rules go. The renamed rules, `unicorn/no-abusive-eslint-disable` and `no-implied-eval` each need one.
- `gate-equivalence.test.ts` (`SUPPRESSION_RULE_IDS` gains `react-hooks/rule-suppression`) and `editor-equivalence.test.ts`.
- `allow-suppressions.test.ts`, `suppression-ban.integration.test.ts`, `config-errors.test.ts`, `define-lint-rules.type-test.ts` and `cases/suppression-comments.ts` (q-r1, r2-d22).
- The Svelte and framework-globals tests (q79).
- `consumer-files.integration.test.ts` (q71).
- `engines.integration.test.ts` (class helper shipped).
- Tests pinning `no-unused-vars`' options (r2-d71).
- The 2.7 case files.

## 6. Success criteria, gate, docs

| Criterion | How to verify |
| --- | --- |
| The core gate is green in the core copy, and no suite collects zero tests | From the core repo: `bun run build --force`, `bun run typecheck --force`, `bunx turbo test --force --continue --concurrency=1 -- --maxWorkers=2`. Report the counts per package. |
| No file outside the lane | `sh <lanes>/lane-diff.sh <lanes>/core` lists only section 3's files, plus the 2.7 scaffold and `eslint-fallback-skips.json` |
| No rule named in core code | `names-no-rule.test.ts` green, with C7 reading `readsRuntimeGlobals` |
| Each new decision point breaks a test | The developer breaks up to five; the guard step (or Stryker, once adopted) covers the rest (CLAUDE.md). Unbroken runs are clean first. |
| Each item's owed tests were watched failing first | The tester's report: the command and the failing test names before the code |
| C1 is blocked until the install | C1's tests are written and failing for the right reason (the resolver absent), and the rest is built |
| Core real run (CLAUDE.md step 6), each case tracked in a scratch file | Scratch projects through the built package (`npm pack`):<br>1. a team without oxlint: the four import rules, TS imports resolved<br>2. typed rules on the two `.mts` files: tsconfig takes them in; tsconfig leaves them out; `oxlint.config.mts` alone taken in<br>3. ESLint 9 installed: refused, the message verbatim<br>4. a `basePath: '..'` team block giving types<br>5. a JS test file with Vitest globals<br>6. a team setting `no-undef` beside our `browser`<br>7. without React: stderr empty<br>8. the packed install<br>9. after landing: a `.svelte` file without `no-undef` (q79), and each S, T and stand-in example once, with and without oxlint |

**#77 is the cli lane's** (I-12). Drop "generated files ignored by default" from the core real run.

**Docs**, each item's sentences only, in the same turn. Prefer deleting a claim to rewriting it; record corrections (old, new, why).
- **architecture.md:**
  - "Data flow" and step 1 (C12)
  - step 2 (C2)
  - step 3 (C10)
  - step 4 (C1, C3, C5, C10, C13)
  - step 5 (C4, the skip list)
  - step 6 (C1, C3, C6, C7, C8)
  - step 7 (C7; C14 if built)
  - step 8 (C9)
- **plan.md:**
  - Decisions "Editor export" (C4)
  - Requirements (C6)
  - "Considered and dropped" and Corrections (C9)
  - Open: the #33, #58, #68, #76 and basePath lines, the #55 part of "#54–#56", and C9's limits
- **questions.md:** #33, #58, #68, #76 marked built.
- **decisions.md:** an entry for this round's decisions and calls.
- **learnings.md:**
  - eslint-plugin-react's fallback version and once-per-process flag
  - oxlint honours only its own spelling of a renamed rule
  - the imported-only trap for `allowDefaultProject`

## 7. Calls for the owner (each a card on the questions page, the same turn)

1. **T pairs whose untyped rule oxlint ran** (`no-constant-condition`, `unicorn/no-await-in-promise-methods`) now run in ESLint. Alternatives:
   - (a) oxlint keeps them, off on every TS file: TS files outside every tsconfig get neither.
   - (b) oxlint keeps them, off on the typed TS files our walk lists. This works where the type information is ours, but not in editor merges where the team gives it. It costs code in both oxlint builders.
2. **S works per layer:**
   - The consumer's `rules` naming a covered rule win.
   - An entry's own `rules` do not move S: turning the cover off does not bring the narrow rule back there, and turning it on does not take it out.
   - Naming the covered rule's typescript-eslint twin is not naming it.
3. **In the editor merges, S is decided before the team's rules are left out**, so a team setting the cover keeps ours out.
   - A non-twin T pair is two rules to "the team sets".
   - Cost: a team whose typescript-eslint type-checked preset sets the typed rule gets two reports in typed files, its own and our untyped rule. The five round 2 pairs were reported twice before T too.
   - Alternative: decide T before as well, which is more code.
4. **q70 is read as moving `no-implicit-globals` to the `browser` runtime ruleset.** A project listing both runtimes keeps it everywhere unless an entry drops `browser`.
5. **q76's test globals apply whatever rulesets are listed** (as the framework globals do), not through the `tests` ruleset the card's title named, and #68 does not limit them.
6. **typed-config-files:**
   - `eslint.config.mjs` is JS and gets no typed rule.
   - Where the team gives type information, the two `.mts` files stay out of our typed rules.
   - Config files below `tsconfigRootDir` that no tsconfig takes in stay untyped: `allowDefaultProject` refuses `**` and counts files.
7. **r2-d22:** `react-hooks/rule-suppression` runs, where suppressions are allowed, whatever rulesets are listed. It reports nothing without React hooks.
8. *(Dropped: the my-renamed-in-eslint card's option text already says suppressions then need oxlint's name.)*
9. **q-r7, revised by pm-core:**
   - The ESLint checked is the one resolving from `tsconfigRootDir`.
   - Where none resolves, the merge goes on. ESLint is installed elsewhere, so we cannot read its version.
   - The joint spec refused that case, which also refused nearly every test project.
10. **lib-structure:** only `class-names` is created now.
11. **Dropped rules** are recorded in no list (shipped, considering or neither).
12. **(pm-core) S losses the cards did not name:**
    - r2-d36's cover (`@typescript-eslint/no-non-null-assertion`) ships `ignores` for test files, so test files lose all three narrow checks (`a?.b!` among them).
    - Covered oxlint rules under an ESLint-run cover lose `.vue`, `.svelte` and `.astro` files, which our ESLint part does not lint: `guard-for-in` (r2-d35), `@typescript-eslint/no-extraneous-class` (r2-d73), `prefer-const` (r2-d75).
    - Recommend accepting, as a written limit.
    - Alternative: leave the covered rule on within its cover's shipped `ignores` where the cover has no `files`. That fixes d36 only, with more code.
13. **(pm-core) C1: our TypeScript resolver also serves a team's own import-x rules** where its config sets no resolver key (O8), so its `import-x/no-unresolved` stops reporting extensionless TS imports there. Recommend accepting: those reports were false.
14. **(pm-core) C7: where our `no-undef` does not run, our other rules lose our runtime globals too.** These are TS files and, after q79, `.svelte` files. `no-global-assign` no longer knows `window` there in the editor merges, while the agent build is unchanged. Recommend accepting: TypeScript's own checker covers TS files.
15. **(pm-core) C13: where React resolves only from a package below `tsconfigRootDir`** (pnpm, no hoisting), eslint-plugin-react assumes the latest React instead of detecting it. Recommend accepting.

## 8. Open points for the orchestrator

1. **Relay to the data lane now: C7 needs `readsRuntimeGlobals`** (2.1, 2.5, 2.6; set on `no-undef`). Without it, #68 cannot be built: the core may not name a rule. The data lane's copy of the interface lacks it.
2. **C1's dependency** (lanes never install): install `eslint-import-resolver-typescript` 4.4.5 in the real repo. Then hard-link it and `is-bun-module` into the core copy.
3. **`src/agent-configs.ts` is claimed by both lanes.**
   - The cli lane's spec owns it, exporting `agentConfigsOf`, and owns `src/agent-configs.test.ts`.
   - This spec's C12 makes it `buildAgentConfigs(agentSettings)`.
   - Recommend that core owns it: its body is exactly what C1, C9 and C13 change. `check` then calls `buildAgentConfigs(agentSettingsOf(eslint))`, and the cli lane's copy is dropped at landing, like the data scaffold. Tell the cli lane either way.
4. **M3 (#56) and M2 have no owner.**
   - The cli lane's spec gives them to core.
   - Core's brief gives "manifest fields" to the cli lane.
   - All of M3's files are in core's `src`. Recommend core takes it as C14.
   - M2 needs `bun install`, so it is the orchestrator's at landing, after M3. If M2 lands first, every `mergeOxlintConfig` throws.
5. **Ownership outside core's brief:**
   - `packages/rule-data/data/eslint-fallback-skips.json`: q-r3 depends on C1's resolver, so only the core lane can measure it. Both lanes' copies agree.
   - The 2.7 scaffold.
   - Confirm both.
6. **#77 is the cli lane's** (q77, q-i7; I-12 there). Both specs agree, so remove it from the core lane's items and real run.
7. **r2-d57 against the reading:** the reading keeps `no-cond-assign` beside `sonarjs/no-nested-assignment`, but r2-d57 chose S for exactly that pair (and `no-return-assign`). Applied: S for `no-return-assign` only. Ask the owner whether r2-d57 wins (data).
8. **Not in these lanes:**
   - the plugin upgrades (q-r2-plugin-upgrades: unicorn 78, @eslint-react 5.26.5) and eslint-plugin-jsx-a11y-x (installs)
   - #72 and #73 (docs)
   - spec-next-batch E2's swap for the ESLint-run core rules whose extension we do not ship (`default-param-last`, `prefer-promise-reject-errors`), which no answer covers
9. **Cards:** section 7 items 1–7 and 9–15 go on the questions page, the same turn.

## 9. Corrections

pm-lanes (1–7):
1. Brief, "#79 … core": it is a data change (`no-undef`'s `ignores`), so it moved to the data lane.
2. Brief, "#77 … core": q77's option text ("listed where a team can see and remove them") and q-i7 make it `init`'s list (cli lane).
3. Brief, "the three config files get the type-aware rules": `eslint.config.mjs` is JS, and our typed rules run on TS files only.
4. Cards r2-d77 and r2-d73 name `no-invalid-this` and `no-extraneous-class`; the shipped rules are `@typescript-eslint/no-invalid-this` and `@typescript-eslint/no-extraneous-class` (`jq` under Commands).
5. spec-next-batch M1's install never ran: `eslint-import-resolver-typescript` and `is-bun-module` are absent (`ls`), and 4.4.5 is still the latest (`npm view`). *(pm-core: spec-next-batch's "only it and is-bun-module are new" holds; the other dependencies are installed.)*
6. spec-next-batch D2 (#22's house blanket mode) is replaced by q-r1, D3's ruleset `conventions` by `class-names`, and Q-R7's "test first" by "refuse below 10".
7. The orchestrator's S reading conflicts with r2-d57 (8.7).

pm-core (8 onwards), each measured or read in the core copy:

8. **C6.** Joint spec: "Not resolvable: throw".
   - Old: an `eslint` that does not resolve from `tsconfigRootDir` is refused.
   - New: the merge goes on.
   - Why: most merge tests use a `tsconfigRootDir` in the OS temp folder (`EMPTY_TSCONFIG_ROOT_DIR`, `setUpTempProjects`), from which no `eslint` resolves.
9. **C7.** It could not be built as written: `names-no-rule.test.ts` forbids `'no-undef'` in core code. It needs `readsRuntimeGlobals` (2.5).
10. **C1, made wrong.** The test's title is now "carries the import-x node resolver, the immutability type overrides, the extensions eslint-plugin-n tries, ours first, and React version detection". The joint spec missed three made-wrong entries:
    - `OUR_RESOLVER_NAME`
    - `team-import-x-resolvers.integration.test.ts`
    - the `dist-loading.test.ts` guard
11. **C1, the walk.** Joint spec: "in the editor merge the list is read at the `eslint.ts` boundary". The merge reads its walk in `mergeEslintPart` (`typeInformationFor`), not in `eslint.ts`.
12. **C13.** Joint spec: "read it from the plugin's `lib/util/version.js`". The value is not exported: it is `ULTIMATE_LATEST_SEMVER = '999.999.999'`. The warning flag and the detected version are cached per process, so the test must reset them. React is installed nowhere in this repo.
13. **C12.** The cli lane's spec (`spec-cli.md`) also creates `src/agent-configs.ts` (8.3).
14. **C10.** The joint spec named no made-wrong tests. These change: the block-name lists and `FRAMEWORK_GLOBALS_OXLINT_OVERRIDES`.
15. **C9.** The joint spec missed the imported-only trap (D-h, `IMPORTED_ONLY_LAYOUT`): `oxlint.config.mts` imports `agents-inc.lint.mts`.
16. **C2.** Two things the joint spec missed:
    - "The owner accepted this per card" holds for r2-d25, d72, d74 and d78, not for r2-d36 or the oxlint-run covered rules (call 12).
    - The mirror of the entry limit (cover turned on by an entry's `rules`).
17. **C3.** The joint spec missed three pitfalls of block order (an entry restating U, an entry turning T off, the without-types copies).
18. **C8.** The callers of `teamFilesFromTheRoot` are three, the global-ignores reading included.
19. **Brief to this planner: "M3 … was given to the cli lane".** The cli lane's spec gives M2 and M3 to core (8.4).
20. **Joint spec section 3, "Owns".** `eslint-fallback-skips.json` and the scaffold are outside core's brief list (8.5).

Nothing else in the joint spec proved false against the core copy.

## Commands

From the repo root of the core lane copy.

```sh
# engine, ruleset, typed, options and scope of any rule named in this spec
jq -r --arg id '<rule id>' '.[] | select(.id==$id)' packages/rule-data/data/rules.json
# after the data lands: the S and T pairs, and the runtime-globals readers
jq -r '.[] | select(.coveredBy) | "\(.id) <- \(.coveredBy.rule)"' packages/rule-data/data/rules.json
jq -r '.[] | select(.splitByTypesWith) | "\(.id) -> \(.splitByTypesWith.rule)"' packages/rule-data/data/rules.json
jq -r '.[] | select(.readsRuntimeGlobals) | .id' packages/rule-data/data/rules.json
# core tests using a rule this spec's data changes (C0; repeat per ID)
grep -rlF -- '<rule id>' packages/lint-rules/src packages/lint-rules/test-fixtures
# the resolver is installed (C1 precondition)
ls node_modules/eslint-import-resolver-typescript/package.json node_modules/is-bun-module/package.json
npm view eslint-import-resolver-typescript version dependencies
# oxlint: an option accepted, a suppression honoured (oxlint's name only), an env known
node_modules/.bin/oxlint -c <config.json> --format json <file>
jq -r '.definitions.OxlintEnv.description' node_modules/oxlint/configuration_schema.json | grep -E '^- (jest|vitest) '
# the rule names unicorn has (C5)
node --input-type=module -e "const u = (await import('eslint-plugin-unicorn')).default; console.log(['no-array-for-each','no-for-each','prefer-dom-node-dataset'].map((n) => [n, Object.hasOwn(u.rules, n)]))"
# eslint-plugin-react's fallback version and its once-per-process flag (C13)
grep -n "ULTIMATE_LATEST_SEMVER\|warnedForMissingVersion\|module.exports" node_modules/eslint-plugin-react/lib/util/version.js
# ESLint exposes its manifest (C6)
jq '.exports["./package.json"]' node_modules/eslint/package.json
# merge tests whose tsconfigRootDir resolves no eslint (C6's reason)
grep -rln "mergeEslintConfig" packages/lint-rules/src
```
