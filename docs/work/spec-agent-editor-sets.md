# Spec: agent and editor rulesets, the editor set in a team's own configs

Drafted 2026-10-11 by pm. The owner settled this shape in three messages on 2026-10-11, the last one
overriding the first two. Measurements were taken against the build in `packages/lint-rules/dist`
(fresh on 2026-10-11, oxlint 1.87, ESLint 10.12, Node 23.10 and 22.23). The probes are in session
scratch, `scratchpad/spec-sets/`, which may vanish. Every command to re-derive a figure is given
below.

## Goal

`agents-inc.lint.mts` holds two sets of rulesets. `check` (not built) runs `agentRulesets` for
sub-agents. `editorRulesets` is exported as plain data, one value per engine, and a team passes
each value, together with its existing config, to a merge function from our package inside its own
ESLint and oxlint configs.

```ts
// agents-inc.lint.mts
import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,
  agentRulesets: { quality: [/* … */], libs: { /* … */ }, runtimes: [/* … */], languages: [] },
  editorRulesets: { quality: [/* … */], libs: { /* … */ }, runtimes: [/* … */], languages: [] },
  ignores: [],
  rules: {},
  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
```
```js
// the team's eslint.config.mjs (function name and entry: Q1)
import { mergeEslintConfig } from '@agents-inc/lint-rules/eslint'
import { eslint } from './agents-inc.lint.mts'

export default mergeEslintConfig(theirExistingConfig, eslint)
```
```ts
// the team's oxlint.config.mts
import { mergeOxlintConfig } from '@agents-inc/lint-rules/oxlint'
import { defineConfig } from 'oxlint'
import { oxlint } from './agents-inc.lint.mts'

export default defineConfig(mergeOxlintConfig(theirExistingConfig, oxlint))
```

This replaces the plan.md row "Editor export", which said the team's configs import only from
`agents-inc.lint.mts`. Now they also import a merge function from our package.

## Why each decision (brief items 1–8)

### 1. Laziness: the parts are plain data, and only the ESLint merge entry loads plugins

- **Measured.** Importing `dist/index.mjs` takes ~11–12 ms, `dist/oxlint.mjs` ~12 ms, and
  `dist/eslint.mjs` 1.4–1.9 s. A resolve hook (`module.registerHooks`) recorded **0** modules from
  ESLint-side packages for `index.mjs` and `oxlint.mjs`, and 3,650 for `eslint.mjs`, on both Node
  versions. To re-measure, run the timing command from the brief once per entry.
- **Mechanism.** `config.editorRulesets.eslint` and `.oxlint` hold data only: no functions, no
  plugin objects and no parser. This means `export const { eslint, oxlint } = …` can read both
  properties and still cost only the catalog. Plugins, the parser, `globals`, `@eslint/compat` and
  the import-x resolver load only when the ESLint merge entry is imported.
- **The test** runs a child Node process with a resolve-recording hook that writes the URLs to a
  file. Writing them to stdout at exit truncated the output in a measured run. The child imports
  the built `index.mjs`, calls `defineLintRules` for a project that lists oxlint, reads both parts,
  imports the built oxlint merge entry and merges `{}`. It then asserts that no recorded URL lies
  under `node_modules/{eslint,typescript-eslint,@typescript-eslint,eslint-plugin-*,@eslint-react,@eslint,globals}/`.
  A second case in the same file imports the built ESLint merge entry and asserts that
  `eslint-plugin-unicorn` **is** recorded. That second case pins the refusal next to an allowed one.

### 2. The ESLint merge: one merged plugin object per shared prefix, and our rules decide our IDs

- **Spreading fails.** Run
  `node <scratch>/spread-probe/probe.mjs packages/lint-rules <scratch>/spread-probe/project`. Both
  team configs throw `Cannot redefine plugin "@typescript-eslint"` and `… "react"`. In a wider
  probe (`spec-sets/merge-probe.mjs`) spreading also threw for `react-hooks`, `unicorn` and
  `import-x`. Our objects can never be the team's objects, for four reasons:
  - our stub copies (`@typescript-eslint` gets `ban-types`, `react` gets 3 oxlint-only names);
  - the `fixupPluginRules` wrappers;
  - stub-only plugins under `react-hooks`, `jsx-a11y`, `vitest`, `jest`, `@next/next` and others;
  - the team's own, different install of a plugin.
- **Reusing the team's object as it is also fails** (`REUSE=1` in the same probe). It threw in 4 of
  9 team setups:
  - typescript-eslint 8.58 lacks `no-generated-empty-object-type`, which we ship;
  - unicorn 56 lacks `better-dom-traversing`;
  - raw eslint-plugin-react crashes under ESLint 10 once our `react.version: 'detect'` applies to
    it (`getFilename is not a function`).
- **Decision: merge, as below. This is not the owner's "reuse the team's object" taken literally,
  and the probe above is why.** For each prefix that both the team's config and our part register,
  build one plugin object and register it in place of the team's object everywhere:
  - The base is the team's object, so its meta, processors, configs and rule modules are kept.
  - Our rule module replaces theirs for every rule our part runs under that prefix.
  - Our stubs are added for oxlint-only names that neither plugin has.
  - For `PREFIXES_NEEDING_COMPAT` (`core/eslint-compat.ts`), the merged object goes through `fixupPluginRules`.
  - The result: across the same 9 setups in both modes, nothing throws, no fatal message is
    reported, and no finding the team's config produced on a rule we do not state is lost.
  - The setups measured: typescript-eslint 8.58 `recommended`, `recommendedTypeChecked` with
    `projectService.allowDefaultProject` and with `project`, eslint-plugin-react 7.37.5 raw and
    team-fixed-up, react-hooks 7.1.1, unicorn 56.0.1, eslint-plugin-import 2.32.0 and import-x
    4.10.0.
- **Our settings win for every rule ID our ESLint part states.** That rule is deleted from the
  `rules` of every team block, and our blocks follow the team's. Deleting is required: when a later
  block gives a severity with no options, ESLint keeps the earlier block's options, and an `off`
  block in between does not reset them (`spec-sets/bare-severity.mjs`).
  - With these settings, `@typescript-eslint/array-type` still fires after the team sets it `off`.
  - Without oxlint, `eqeqeq: always` fires on `== null` after the team sets `eqeqeq: smart`.
- **The off-switch is narrowed.** When the project uses oxlint, it holds the oxlint-routed rules
  our oxlint part states. In either mode it holds every other ESLint name of each rule either part
  states (an alias, a renamed rule's old name, another name its plugin registers the same rule
  module under, as `@eslint-react` does with `no-missing-key` and `x-no-missing-key`, or an oxlint
  spelling that is an ESLint rule ID), but a name the ESLint part runs (`otherEslintNamesOff`,
  `editor-parts.ts`). Each name in it is deleted from the team's blocks, so we decide it in every
  file, even where we state the rule `off`
  (questions.md #42). The agent build's switch still turns off every oxlint-routed rule in the
  catalog. Measured with the narrowed switch: the team's `react/react-in-jsx-scope`, which we route
  to oxlint but do not ship, keeps firing. The agent build's switch silences it. This closes the "team silently loses rules it had" item under Open in
  plan.md.
- **Twins** (questions.md #41). typescript-eslint's extension of a core rule and the core rule are
  two rules that report the same finding (`twinsOf`, `catalog-lookups.ts`); an extension deprecated
  as an alias of its core rule is the same rule. The team's twin of a rule ours turns on is off in
  the files where ours runs, whichever engine runs ours and whichever of the two is ours. Where we
  state the rule `off`, the team's twin keeps its own settings.
- **A team prefix holding one of our plugins** (questions.md #45). The team may register a plugin
  of ours under a prefix of its own: antfu's config registers typescript-eslint as `ts`. The merge
  recognises it by its object or its name, and reads `ts/x` as a name of `@typescript-eslint/x`,
  as above. Where we register another plugin under that prefix, a name our blocks state there is
  ours (`prefixesOfOurPluginsIn`, `merge-eslint-config.ts`).
- **Type information.** If any team block turns on `parserOptions.project` or `.projectService`,
  our blocks set neither, and our typed rules run only where the team's config gives type
  information (`typeInformationFor`, `merge-eslint-config.ts`):
  - each typed block of ours becomes a copy within each team block that turns type information on,
    in the team's order;
  - a team block that sets the option back to `false` or `null`, as typescript-eslint's
    `disableTypeChecked` does, gets a copy stating those rules `off`;
  - a team block's `basePath` is applied by putting its globs under that path from the project
    root (`teamFilesFromTheRoot`).
  - Measured: `project` set beside `projectService` is a fatal parse error.
  - Measured: our `projectService: true` replacing the team's `{ allowDefaultProject }` made a root
    `.js` file fatal. typescript-eslint builds one project service per process, so this is not
    limited to one block.
  - When the team gives no type information, ours applies, as today.
- **What the team passes in.** Whatever ESLint's `defineConfig` (`eslint/config`) accepts: an
  object, an array, nested arrays, or `extends`. The merge normalizes it through `defineConfig`
  first.

### 3. The oxlint merge: the team's results kept, and ours in a catch-all override after theirs

Measured with `spec-sets/oxlint-merge-probe.mjs` and the probes in `spec-sets/ox/`:

- **Two spellings of one rule in one `rules` map: the last key wins.** A team override beats a root
  rule, and so does an override inside an extended config. So our rules cannot sit in the root
  `rules`.
- **Ours go in a catch-all override appended after the team's overrides.** The override is
  `files: ['**/*']` and carries our env and every rule our part states: a rule it states only in a
  `fileOverrides` entry is `off` there, so the team's setting of it does not survive outside the
  entry (D4). Our per-rule-ignores overrides and our `fileOverrides` overrides come after it.
  - Measured: it wins over the team's root rule under any spelling, over the team's overrides, and
    over extended overrides, whether `extends` holds an object or a path.
  - Measured: it matches root-level, nested, `.js`, `.ts` and `.tsx` files, and `env` inside it
    works.
- **Every key, and what the merge does with it:**

  | Key | Merge |
  | --- | --- |
  | `plugins` | At the root: every plugin the team lists anywhere (its root; oxlint's default `oxc`, `typescript`, `unicorn` where a config in its chain leaves `plugins` out; every override), plus the plugin of every rule our part states (`everyPluginListed`). Measured: an explicit list without `typescript` silently drops `typescript/*` rules. |
  | `categories` | The team's, untouched; we never set it. oxlint's default correctness category stays on when the team leaves it out (96 rules with `{}`). What the merged root would switch on beyond the team's root is put back by the first overrides (below). |
  | `rules`, `env`, `globals`, `settings`, `jsPlugins`, `$schema` | The team's, untouched. |
  | `extends` | Each config the team extends as an object, without the statements oxlint ignores for the team, after a first extended config holding the first overrides where there are any. A config extended by path: below. |
  | `ignorePatterns` | The team's, then ours (global). |
  | `overrides` | The first overrides (unless the team extends objects), the team's without the statements oxlint ignores for it, the catch-all, then ours. |
  | `options` | The team's, with `reportUnusedDisableDirectives: 'off'` (D3). |
  | Our ESLint-run rules that oxlint also has | `off` in the catch-all, under one of the rule's `oxlintSpellings`, so the team's categories or rules cannot run them twice. Measured: the team's `typescript/array-type` stopped and our ESLint version runs instead. |
- **Listing every plugin at the root changes what oxlint runs for the team**, so the merge puts it
  back (questions.md #44: each rule our part does not state runs in each file as the team's config
  alone runs it). The merge reads the team's config as oxlint 1.87 resolves it (the comment at the
  top of `merge-oxlint-config.ts`):
  - *First overrides*, first among the overrides, or in a first extended config where the team
    extends objects (`placedFirstInLine`): `off`, each rule the merged root turns on that the
    team's root did not; then the rules oxlint switches on by category in the team's overrides that
    list plugins (`categorySwitchesOf`).
  - *Ignored statements dropped:* a team statement oxlint ignores, because its rule's plugin is
    listed neither at the root nor in that override, is dropped, not replayed.
  - *Rule keys* are read as oxlint's `parse_rule_key` reads them (`oxlintRuleKeyed`): package-name
    and alias prefixes, an `@`-scoped key cut at its last `/`, a bare key resolved in oxlint's
    plugin order, and a prefix naming no plugin of oxlint's read as a JS plugin's rule.
  - *Extended by path* anywhere in the chain (questions.md #43): the merge cannot see that config,
    so the team's config stays as it is, and our catch-all and entry overrides list the plugins of
    our rules that the team's roots do not (`mergedBesideAConfigOutOfSight`). After the catch-all,
    each team override that lists plugins gets an override with its `files`, `excludeFiles` and
    `plugins`, repeating the catch-all's statements of rules whose plugin counts nowhere else, so
    our `off` holds there (`catchAllRestatedUnderItsListing`). oxlint 1.87 refuses a path in a JS or
    TS config's `extends` ("`extends[0]` must be a config object"), so this output loads only when
    written as JSON, not from `oxlint.config.mts`.
  - *Known gaps* G2 and G3 (questions.md #48), pinned with `it.fails` in
    `merge-oxlint-config.differential.integration.test.ts`, which checks the merge against the CLI.
- **Spelling knowledge is still needed** for that `off` entry and for reading the team's rule keys:
  the catalog's `oxlintSpellings`. The refusal of team spellings is removed.
- **Measured result:** the team's JS-plugin rule still runs. With explicit `plugins` and
  `categories`, no finding the team's config produced was lost. With the default plugins, the only
  finding lost was the deduped `typescript(array-type)`.

### 4. Suppressions in the editor parts: allowed (**default applied, owner-reviewable**)

The editor parts always use `allowSuppressions: true` semantics:
- `house/no-suppressions` is off;
- `@typescript-eslint/ban-ts-comment` allows `@ts-expect-error` with a description;
- `unicorn/no-abusive-eslint-disable` is on.

`allowSuppressions`, at the top level and in any entry, applies to the agent set only. The ESLint
part never sets `noInlineConfig`, so the team's setting stands. Reason: the owner said humans may
keep adding suppressions and only sub-agents may not.

### 5. ESLint-only proof for the rules that move to ESLint without oxlint

- **Count.** A rule moves when its `engine` is `oxlint` and the inventory has an `eslint` entry.
  From the repo root:
  ```sh
  jq -r --slurpfile inv packages/rule-data/src/generated/inventory.json '
    ($inv[0].rules | map({key: .id, value: .eslint}) | from_entries) as $eslint
    | [.[] | select(.engine == "oxlint" and $eslint[.id] != null) | .id] | length' packages/rule-data/data/rules.json
  ```
  Measured: 181. All are untyped. One is deprecated (`unicorn/no-hex-escape`), and one is a
  suppression rule (`@typescript-eslint/ban-ts-comment`). With `== null` in place of `!= null`, the
  same command counts the rules ESLint has no version of.
- **Fixtures** (`spec-sets/moved-fixtures-probe.mjs`). The gate's `fixtures.json` has one for 180
  of them, under the canonical ID, the oxlint name or `eslint/<id>`. `no-unreachable-loop` has none
  there, but this repo has `test-fixtures/engines/unreachable-loop.ts`, which has not been measured
  in ESLint.
  - 170 fire in ESLint with today's settings, once import-x's sibling files are copied too
    (`mod_nodefault.ts`, `mod_both.ts`, `cycle-b.ts`, `named-target.js`, and the fixture's own name
    for `no-cycle` and `no-self-import`).
  - 10 cannot be proven as things stand:

  | Rule(s) | Why it does not fire in ESLint (measured) |
  | --- | --- |
  | `import-x/default`, `namespace`, `no-cycle`, `no-named-as-default`, `no-named-as-default-member`, `no-self-import` | import-x does not resolve extensionless TS imports under our settings. A TS-aware `createNodeResolver({ extensions })` made `no-self-import` fire and none of the others (Q5). |
  | `no-implicit-globals` | ESLint checks scripts only, and our parser sets `sourceType: 'module'` for every file. |
  | `no-inner-declarations` | With the shipped options and modules in strict mode, it has nothing to report. |
  | `no-nonoctal-decimal-escape` | `"\8"` is a syntax error in a module: a fatal parse error. |
  | `unicorn/no-hex-escape` | Deprecated in unicorn 77, and silent on its fixture. |
- **Decision.** A moved rule runs in the ESLint part only when its fixture fires there (CLAUDE.md:
  a matching name is not proof). Each rule that cannot be proven goes on a skip list in rule-data,
  with its reason, and is treated like the rules with no ESLint version: not stated, so the
  team's own setting of it stands. A test fails when a moved rule has neither a firing fixture nor
  a skip entry. Without oxlint, a team therefore gets every moved rule but those on the skip list
  (`jq length packages/rule-data/data/eslint-fallback-skips.json`).
- **Known quality risk (Q4).** 10 moved core rules have a typescript-eslint extension:
  `max-params no-dupe-class-members no-loop-func no-loss-of-precision no-shadow no-unused-expressions no-unused-private-class-members no-unused-vars no-useless-constructor prefer-destructuring`.
  Measured: under typescript-eslint `recommended` with no oxlint, the same unused variable was
  reported twice, by `no-unused-vars` (ours) and `@typescript-eslint/no-unused-vars` (theirs).
  Default applied (questions.md #32, #39): 8 are on the skip list; `no-loop-func` and
  `no-loss-of-precision` move, as their typescript-eslint versions are deprecated in favour of the
  core rule.

### 6. The internal hook for `check`

`check` imports `agents-inc.lint.mts` and sees only `eslint` and `oxlint`. `defineLintRules` records
the validated input in a module-level `WeakMap`, keyed by both part objects. An internal lookup
(the developer names it, for example `agentSettingsOf(part)`) returns the agent projection: the
shared keys plus `agentRulesets` as the core's single `rulesets`. With it the existing builders
produce the complete agent oxlint config and the complete agent ESLint config. Both are oxlint-on
always, whatever the package.json says.

The lookup is internal:
- it is not listed in package.json `exports`;
- it is not named in any `dist/*.d.mts`;
- an object that `defineLintRules` did not return makes it throw a named error.

The registry must sit in a module that both `index` and the future `check` entry import, so that
the build puts it in one shared chunk.

### 7. What goes, what stays

- **Goes:**
  - `eslintConfig` and `oxlintConfig` as public functions;
  - the extras arguments: `buildEslintConfig`'s `extras` and `buildOxlintConfig`'s `extras` (and
    `withExtras`);
  - every extras guard (`refuseCatalogRulesInExtras`, `refuseExtrasThePackageManages`,
    `PACKAGE_MANAGED_EXTRAS`, `catalogRuleProblems`, `ruleMapsOf`);
  - the extras-aware stub exclusion (`prefixesRegisteredBy`);
  - validation inside the builders (validation happens once, on the two-set input);
  - `defineLintRules` returning its input.
- **Stays:**
  - the `./eslint` and `./oxlint` subpaths, which now hold the merge functions (Q1). They already
    keep the 1.4–1.9 s side apart from the ~12 ms side.
  - the agent builders, without extras;
  - the catalog's `oxlintSpellings` (§3);
  - stubs, which now live in the merged objects. That closes the known gap where a prefix
    registered by the team got no stubs.
- **Tests removed or with a changed assertion:** listed under "For Tester" below.

### 8. Consumer fixture and `consumerConfigFiles`

- **`consumerConfigFiles` keeps its three names.** The team's engine configs still live under the
  names our docs show.
  - Measured on the new templates with every ruleset: `unicorn/no-top-level-side-effects` fires on
    both engine-config templates (`export default merge…(…)`), and `perfectionist/sort-objects`
    fires on `agents-inc.lint.mts`.
  - `unicorn/no-top-level-side-effects` **no longer** fires on the new `agents-inc.lint.mts`. Its
    ignore for that file is kept so the list stays one uniform list: the decision is recorded, and
    no rule-data test changes.
- **Fixture projects.** `test-fixtures/consumer-files/` moves to the new shape. A second fixture
  project covers a team without oxlint: its package.json lists no oxlint, and it has no
  `oxlint.config.mts`.

## Requirements

### Must have

1. **Input.** `LintRules` has `agentRulesets` and `editorRulesets`, each in today's four-list shape,
   and `rulesets` is gone. A `fileOverrides` entry may give `agentRulesets`, `editorRulesets`,
   both, or neither. `tsconfigRootDir`, `ignores`, `rules`, `allowSuppressions` and `fileOverrides`
   are shared. `allowSuppressions` applies to the agent set only (§4).
2. **Validation.** `validateLintRules` validates both sets, and its error paths name the set:
   `agents-inc.lint.mts: agentRulesets.quality: unknown ruleset "x"` and
   `fileOverrides[1].editorRulesets.libs.ui: …`. A missing set is
   `agents-inc.lint.mts: agentRulesets: missing`, and the same for `editorRulesets`.
3. **Return value.** `defineLintRules` returns exactly `{ editorRulesets: { eslint, oxlint } }`.
   `oxlint` is `undefined` when the project does not use oxlint. No other key is visible.
4. **Detecting oxlint.** Walk up from `tsconfigRootDir` to the filesystem root and read each
   `package.json`, nearest first, until one lists `oxlint` in `dependencies` or `devDependencies`:
   the project then uses oxlint (D1). A directory without one is skipped. A malformed one read on
   the way throws, naming that file; one above the first that lists oxlint is never read
   (questions.md #40). Module resolution is never consulted.
5. **Engine split of the editor set.**
   - *With oxlint:*
     - oxlint-routed rules go to the oxlint part, and ESLint-routed rules to the ESLint part.
     - The ESLint part states `off` for every oxlint-routed rule the oxlint part states.
     - The oxlint part states `off` for every ESLint-run rule it does not run but oxlint has a
       version of.
   - *Without oxlint:*
     - The ESLint part runs ESLint-routed rules, plus every moved rule that is not skipped (§5).
     - It states no skipped rule and no rule ESLint has no version of.
   - *Both cases:*
     - a rule that the top-level `rules` sets `off` is stated `off` (D2);
     - the ESLint part states `off` every other ESLint name of each rule either part states, but a
       name it runs (§2).
6. **The ESLint merge**, as in §2.
   - Our blocks keep today's kinds, order and `agents-inc/*` names: ignores (global), base, typed,
     scopes, file overrides, then the narrowed off-switch (`agents-inc/oxlint-rules-off`, or
     `agents-inc/aliases-off` without oxlint). They come after the team's blocks. Blocks named
     after ours with `/twins-off`, `/twins-restored` and `/without-types` switch the team's twins
     and our typed rules where §2 says.
   - The base block sets the parser, globals and settings for JS/TS files.
   - It sets `reportUnusedDisableDirectives: 'off'` only when the project uses oxlint (D3).
   - Stubs only when the project uses oxlint.
   - If the team registers two different objects under one prefix, the merge throws an error that
     names the prefix (D5).
7. **The oxlint merge**, as in §3. If `oxlint` is `undefined`, it throws an error naming
   package.json: the project lists no oxlint, so there is no oxlint part to merge. It also throws
   when the oxlint that resolves from `tsconfigRootDir` is outside our peer range, or does not
   resolve (Q7; `refuseOxlintOutsideOurPeerRange`, `installed-oxlint.ts`).
8. **The agent hook** (§6), used by every existing engine-run suite.
9. **The ESLint-only fallback** (§5): a skip list in rule-data, fixtures in this repo, and the proof
   test.

### Must NOT

- `check`, `init`, installing ESLint plugins for the rules ESLint lacks, `strict-design-tokens`,
  the line-form disable gap (questions.md #22), or the class-helper rule.
- Changing import-x resolver or parser settings (Q5): the 6 import-x rules are skipped in this
  slice.
- Moving `eslint` or `oxlint` from peerDependencies to dependencies. That belongs to `check`'s
  slice.
- Any key or export a user would see beyond the owner's shape and Q1.
- Committing old plugin versions as devDependencies. Real-version checks happen in the run-for-real
  step (CLAUDE.md step 6) in a scratch project.

## Scope

**Modify** (all under `packages/lint-rules/` unless noted):

| File | Change |
| --- | --- |
| `src/index.ts` | Types and `defineLintRules` as in Must have 1–3. |
| `src/eslint.ts` | Exports the ESLint merge function instead of `eslintConfig`. |
| `src/oxlint.ts` | Exports the oxlint merge function instead of `oxlintConfig`. |
| `src/core/lint-rules-input.ts` | The two-set input type, plus a projection to the single-set input the core keeps. `resolveRuleLayers` stays single-set, so its tests stay as they are. |
| `src/core/validate-lint-rules.ts` | Both sets, the set-named paths, and the missing-set error. |
| `src/core/build-eslint-config.ts` | Drop the extras and the guard. Expose the block builders the merge reuses. |
| `src/core/build-oxlint-config.ts` | Drop the extras, `withExtras` and the guards. |
| `test-fixtures/consumer-files/*` | The new shape (§8). |
| The tests | As listed under "For Tester". |
| `packages/rule-data/` | A skip-list data file (suggested: `data/eslint-fallback-skips.json`, `{ id: reason }`), exposed through the catalog, with a rule-data test: every key is a shipped oxlint-routed rule that has an ESLint version, and every reason is non-empty. |

**Create** (names are suggestions, kebab-case):

| File | Purpose |
| --- | --- |
| `src/core/project-uses-oxlint.ts` | The package.json walk. |
| `src/core/editor-parts.ts` | The data for each engine. It must not import plugins, `globals`, typescript-eslint, `@eslint/compat` or `eslint-plugin-import-x`; `eslint-settings.ts` imports import-x. |
| `src/core/merge-eslint-config.ts`, `src/core/merge-oxlint-config.ts` | The two merges. |
| `src/agent-settings.ts` | The internal registry and the lookup. |
| `test-fixtures/eslint-fallback/` | Gate fixtures for the 181 moved rules, re-keyed by canonical ID, plus import-x's sibling files. Copied from the gate; the gate is read-only. |
| `test-fixtures/consumer-files-without-oxlint/` | The second fixture project (§8). |

**Do not touch:** `~/dev/ai-benchmarking` (read-only), `~/dev/cli`, `packages/eslint-plugin-house`,
`packages/rule-data/data/rules.json`, the generated files (except through the generator), and
`.claude/`.

## Success criteria

| # | Criterion | How to verify |
| --- | --- | --- |
| S1 | Importing the oxlint side resolves no ESLint-side module, while importing the ESLint merge entry does. | The child-process test (§1), run against `dist`. |
| S2 | The parts are data. | A deep walk of `config.editorRulesets` finds no `typeof === 'function'`. |
| S3 | Oxlint detection: listed in the project's own package.json, listed only in a parent's, listed under `dependencies`; listed nowhere while oxlint is resolvable through `node_modules`, so the part is absent; a malformed package.json is a named error. | `project-uses-oxlint` tests, using temp directories. |
| S4 | With oxlint, merging an empty team config runs each editor rule exactly once, on its engine, with its options. Without oxlint, the ESLint part runs each ESLint-routed and each proven moved rule, and no skipped rule. | Equivalence tests in the shape of `gate-equivalence.test.ts`, reading the merged configs. |
| S5 | The ESLint merge loads without throwing when a team block registers, under one of our prefixes, a different object, an object lacking a rule we run, or a raw object of a compat prefix. Our rule decides where the team set it `off` or gave other options. A team rule we do not state keeps firing. Aliases of the rules we run are off. | Unit tests with `buildFakePlugin`, plus one integration test with the repo's own installed typescript-eslint and eslint-plugin-react configs (distinct objects from ours). |
| S6 | Our rules win in the oxlint merge over the team's root (other spelling), its override, and its extended override (object and path). Default plugins are kept when the team leaves `plugins` out. The team's oxlint spelling of an ESLint-run rule of ours is off. `categories`, `jsPlugins`, `env`, `globals` and `settings` are kept. | Integration tests with the real oxlint CLI, as in `oxlint-merge-probe.mjs`. |
| S7 | Every moved rule that is not skipped fires in ESLint on its fixture, and every moved rule has either a fixture or a skip entry. | `eslint-fallback.integration.test.ts` iterates the catalog, not a hand-kept list. |
| S8 | The editor parts are "allowed" whatever `allowSuppressions` says; the agent build stays banned by default. The team's `noInlineConfig: true` stands. | `allow-suppressions.test.ts`, with the editor and agent cases side by side. |
| S9 | With oxlint and a team that registers `react`, a suppression of `react/no-clone-element` loads with no "Definition for rule" error. | A new passing test replaces the `it.fails` KNOWN GAP. |
| S10 | The hook returns the agent settings; the agent build has oxlint on even when package.json lacks oxlint; the hook rejects a foreign object; `dist/*.d.mts` does not name the hook. | `agent-settings.test.ts`, plus a grep in `dist.test.ts`. |
| S11 | Under a team type setup (`project` or `projectService`), the merge adds no fatal parse error the team's config alone does not have. Without one, ours applies. | Tests that compare fatal messages with the team's config alone. |
| S12 | Both fixture projects load for real: ESLint through the fixture's `eslint.config.mjs` and oxlint through `-c oxlint.config.mts`, with no fatal message. One sentinel rule per engine fires, and without oxlint, a moved sentinel fires in ESLint. | `editor-configs.integration.test.ts`, with `node_modules/@agents-inc/lint-rules` and `node_modules/oxlint` linked into the temp project. |
| S13 | Typecheck and tests are green. | `bun run typecheck`, `bun run test`; no suite collects zero tests. |
| S14 | Nothing changed outside scope. | `git -C ~/dev/ai-benchmarking status --short` is the same before and after the build; it already lists the owner's own uncommitted changes. `git status --short` here covers only the files listed above. |

## For Developer

- **Before code:** Q1 needs an owner answer, since the public names are user-visible. Read, in
  order: `build-eslint-config.ts` (`pluginsForEveryBlock`, `withStubsFor`, block builders),
  `build-oxlint-config.ts` (`buildOxlintConfig`, `fileOverrideOverrides`), `resolve-rule-layers.ts`,
  `core/eslint-compat.ts` (`PREFIXES_NEEDING_COMPAT`), and the four probes in `spec-sets/`.
- **Order:**
  1. the input projection and validation;
  2. `project-uses-oxlint`;
  3. the editor parts as data;
  4. the hook;
  5. the merges;
  6. the fallback data and fixtures;
  7. remove the extras code and dead tests last.
- **Decided:**
  - The data lists the rule settings and where they apply (top level, per-rule scope, per entry),
    plus the shared settings they depend on: ignores, runtime env names, tsconfigRootDir. It holds
    no engine-config keys. This is how "just the rules" is read: a flat rules map cannot carry
    `fileOverrides`.
  - The merge reuses the agent builders' block code, so the two cannot drift apart.

## For Tester

**Write first and watch fail:** S1–S12.

**Existing tests removed** (reason: extras or the public factories are gone):

- `oxlint-extras-spellings.test.ts`: the whole file.
- `core/build-oxlint-config.test.ts` → `extras`: the whole describe (11 `it` / 14 cases).
- `core/build-eslint-config.test.ts`:
  - `extras`: 5 tests;
  - the two tests in "when an extras block registers the same plugin under that prefix";
  - "the lint rules it is given → are validated before anything is built …" (validation leaves the
    builders).
- `core/build-oxlint-config.test.ts`: the same "are validated before anything is built".
- `config-errors.test.ts`:
  - "is named by oxlintConfig" and "is named by eslintConfig";
  - "is refused by oxlintConfig, which runs one of them" and "is refused by eslintConfig, which runs
    another";
  - the 4 tests of "an error in the extras of an engine file".
- `allow-suppressions.test.ts` → "an ESLint extras block": 3 tests. The team's `noInlineConfig` case
  returns under S8.
- `engines.integration.test.ts`:
  - the 2 tests of "… with suppressions allowed, when an extras block registers the plugin of its
    prefix", including the `it.fails` KNOWN GAP, which S9 replaces;
  - the 1 test of "… with the ban on, when an extras block registers …".

**Existing assertions that change:**

- `config-errors.test.ts`:
  - `rulesets.quality` becomes `agentRulesets.quality` in the error message;
  - "is absent from a valid config, which defineLintRules returns as given" and "… allows
    suppressions through allowSuppressions …": `toBe(input)` changes, because the input is no
    longer returned.
- `core/validate-lint-rules.test.ts`: the 7 messages with a `rulesets.` path gain the set name. One
  of them is the `fileOverrides[1].rulesets.libs.ui` case.
- `core/build-eslint-config.test.ts` → "emits named blocks in order …": the extras blocks leave the
  expected list.
- `consumer-files.integration.test.ts` → "still report those findings on the same text in any other
  file": per template. A copy of `agents-inc.lint.mts` draws only `perfectionist/sort-objects`, and
  a copy of an engine-config template draws only `unicorn/no-top-level-side-effects`.
- `define-lint-rules.type-test.ts`: every `rulesets` becomes the two sets. Add
  `@ts-expect-error` cases for a missing set, for `config.agentRulesets`, and for `rulesets` in an
  entry.

**Unchanged in assertion, changed in harness:** the following move to the agent build through the
hook, with `setUpEngineRun` losing `eslintExtras`:
- `gate-equivalence.test.ts`
- `suppression-ban.integration.test.ts`
- `sort-union-types.integration.test.ts`
- the rest of `engines.integration.test.ts`
- the calls that drop `[]` for extras in `file-overrides.test.ts` and `resolve-rule-layers.test.ts`

**Unchanged:** rule-data's `consumer-config-files.test.ts` (§8).

**Run for real (CLAUDE.md step 6):** rerun `merge-probe.mjs` and `oxlint-merge-probe.mjs`, rewritten
against the built merge functions. Use the scratch team project with typescript-eslint 8.58, unicorn
56.0.1, import-x 4.10.0, react-hooks 7.1.1 and eslint-plugin-import 2.32.0. Track each case in a
file.

## For Reviewer

- Our settings must win without the team's options leaking through. Check that the deletion from
  team blocks covers every rule our ESLint part states, including rules stated only in an entry.
- No ESLint-side import may be reachable from `index` or the oxlint entry (S1 guards this).
- Merged plugin objects are copies: no team or registry plugin is mutated. ESLint's `--cache` keys
  on plugin meta: check whether that can give a stale cache after an upgrade of our package. (It
  could, measured; every plugin our blocks register now carries our version beside its own,
  `withOurVersionInEachCacheKey`.)
- The skip list holds only measured reasons.

## Defaults applied (owner-reviewable)

| | Default | Why |
| --- | --- | --- |
| D1 | oxlint counts when listed in `dependencies` or `devDependencies` of any package.json from `tsconfigRootDir` up to the filesystem root. | The config file has no other known directory; `init` sets `tsconfigRootDir` to it. |
| D2 | A rule the top-level `rules` sets `off` is stated `off` in the editor parts, so it overrides the team's setting. `rules` is shared, so turning a rule off for agents also turns it off in editors. | "Our settings win for our rule IDs." |
| D3 | `reportUnusedDisableDirectives` is `off` in the team's oxlint config, and in its ESLint config when oxlint is used. | Each engine flags the other's suppressions as unused (measured 2026-10-04). |
| D4 | A rule our part states is decided only by our part, in every file. The team's settings of it are removed everywhere, so a team `max-lines` on `.ts` is gone although ours applies only to `.tsx`. `ignores` are global in both team configs. | Deleting is needed for options (§2). |
| D5 | Two different plugin objects under one prefix in the team's config is a named error. | ESLint itself throws on this when both blocks apply to one file. |
| D6 | `allowSuppressions` is ignored by the editor parts (§4). | Owner: humans may keep suppressions. |

## Open questions

Q1 is answered (owner 2026-10-11: the recommended names). Q4, Q5 and Q7 have their
recommendations applied as defaults (questions.md #32, #33, #39); Q6 is questions.md #34.

- **Q1 (blocks the build).** What are the merge functions' names and entries? Recommended:
  `mergeEslintConfig(theirs, eslint)` from `@agents-inc/lint-rules/eslint`, and
  `mergeOxlintConfig(theirs, oxlint)` from `@agents-inc/lint-rules/oxlint`.
- **Q4.** Without oxlint, should the 10 core rules with typescript-eslint extensions move as
  decided? The measured cost is double reports beside the team's typescript-eslint, and the core
  rule's known misreports on TS. The alternatives are to skip them, or to run the extension on TS
  files. Recommended: skip for now, since it reuses the skip list.
- **Q5.** import-x does not resolve extensionless TS imports under our ESLint settings. That
  affects the 6 skipped rules and possibly ESLint-routed import-x rules today (for example
  `no-rename-default`, `no-useless-path-segments`). Should it be fixed in its own slice?
  Recommended: yes, with fixtures.
- **Q6 (not measured).** Editors must run Node 22.18 or later to import a `.mts` file. VS Code's
  ESLint and oxc extensions may use their own Node. A team on `.oxlintrc.json` must move to a TS
  oxlint config to import the editor set.
- **Q7.** The team's own oxlint runs names generated from oxlint 1.87. Measured: oxlint 1.87 refuses
  an unknown plugin or rule name even when it is set `off`, so an older oxlint may refuse the merged
  config. Should a version range be enforced?

## Docs this makes false (step 8, same turn)

- **plan.md:**
  - the "Editor export" row ("import only from `agents-inc.lint.mts`");
  - "What a consumer's repo looks like": the `export default`, `rulesets`, and factory examples;
  - "Rules we do not ship: the engine files" (the extras section);
  - "Known gap" under Suppression comments;
  - the Open item "The editor set inside a team's existing lint configs";
  - Monorepo layout (`defineLintRules, eslintConfig, oxlintConfig`).
- **architecture.md:**
  - the packages row for lint-rules;
  - "How a consumer's config becomes two engine configs": steps 1, 4 (the extras position) and 5
    (Extras guards).
- **questions.md:** #2 (moot) and #30 (answered here, apart from what `init` writes into
  `editorRulesets` and the four ESLint plugins, which stay open there).

## Corrections (2026-10-11, after the build and fix rounds 1–6)

- §2 off-switch: "turns off only the oxlint-routed rules that our oxlint part states, plus their
  aliases" → those rules, plus every other ESLint name of each rule either part states, in both
  modes. Why: questions.md #42.
- §2 type information: "our typed rules use the team's type information" → they run only where the
  team's blocks give it, in the team's order. Why: a typed rule in a file without types ends the
  whole ESLint run (`keptToTypedFiles`, `build-eslint-config.ts`).
- §2 twins and a team prefix holding our plugin: added. Why: questions.md #41, #45.
- §3 catch-all: "our env and our top-level rules" → every rule our part states. Why: a rule stated
  only in an entry kept the team's setting outside it (D4).
- §3 heading "the team's config untouched" → "the team's results kept"; `plugins` "the team's …
  united with ours" → every plugin the team lists anywhere, plus ours; `extends` and `overrides`
  rows rewritten; first overrides, dropped statements, rule keys and extends by path added. Why:
  questions.md #43, #44; the differential test against the oxlint CLI.
- §5 "Default: as the owner decided, they move" → 8 skipped, 2 move; "171 of the 275 rules" and
  "the 94" → commands. Why: questions.md #32, #39.
- Must have 4 "read each `package.json`" → until one lists oxlint. Why: questions.md #40.
- Must have 5 "plus those rules' aliases" and "turns off the aliases of every rule it runs" → in
  both cases, every other ESLint name of each rule either part states. Why: questions.md #42.
- Must have 6 and 7: the twin, `without-types` and `aliases-off` blocks and the oxlint version
  check added. Why: questions.md #32, #41; §2.
- §2 `PREFIXES_NEEDING_COMPAT` lives in `core/eslint-compat.ts`, not `eslint.ts`.
- For Developer: `eslint.ts` (`PREFIXES_NEEDING_COMPAT`) → `core/eslint-compat.ts`;
  `pluginsWithStubs` → `pluginsForEveryBlock`. Why: the merge build moved the first and replaced
  the second; the §2 correction above missed this mention.
- §2 off-switch: the other names listed "an alias, a renamed rule's old name, an oxlint spelling" →
  also another name the plugin registers the same rule module under. Why: `@eslint-react` 5.24.10
  registers rule modules under two names each (`sameModuleAs` in the generated inventory);
  questions.md #42.
- §3 extended by path: "our overrides list the plugins of our rules that the team's roots do not" →
  only the catch-all and entry overrides; each team override that lists plugins gets one repeating
  the catch-all's statements, and the output loads only as JSON. Why: our `off` was ignored where
  only the team's override listed the rule's plugin (round 6, D2); oxlint 1.87 refuses a path in a
  JS or TS config's `extends`.

Amended by [spec-owner-answers](spec-owner-answers.md), the owner's answers of 2026-10-11:

- §2 "Our settings win for every rule ID our ESLint part states" (deleted from team blocks, ours
  after theirs) → ours first, the team's blocks after and untouched, and ours left out of every
  file where a team block sets the rule under any of its names. Why: questions.md #32 D4 reversed
  ("theirs should override whenever there is a conflict").
- §2 off-switch "every other ESLint name of each rule either part states", in both modes → beside
  oxlint only, every ESLint name of each rule the oxlint part runs; and the oxlint part's `off` only
  for rules the ESLint part runs. Why: #42 reversed (our off removes only ours); Q-C default.
- §2 twins: the team's twin is off where ours runs → not where the team sets the rule it twins,
  since ours does not run there; and without oxlint, on TS files the twin is the rule ours runs, so
  the team's statement of it decides as for any rule of ours. Why: the precedence contract; #39.
- §2 type information "when the team gives no type information, ours applies" → only in TS files a
  tsconfig takes in. Why: #36 (b).
- §3 catch-all after the team's overrides, our `off` statements in it → ours first in line and on
  only; the team's overrides after; no `off` of ours but the compensations and the cross-engine
  offs. Beside a config extended by path, `catchAllRestatedUnderItsListing` is gone: only the
  cross-engine offs are repeated under a team listing. Why: the owner's precedence; #42.
- §3 `ignorePatterns` "the team's, then ours (global)", and ESLint's global ignores → the team's
  untouched; our `ignores` keep only our rules out of their files. Why: D-a, from #42 and #44.
- D2 (a `rules` off is stated off over the team's) and D4 (a rule our part states is decided only
  by ours) → removed. Why: #32 D2 and D4 reversed, #42.
- Must have 4 "until one lists oxlint" (corrected above) → the nearest package.json decides. Why:
  #32 D1, #40.
- §5 the 8 core rules with a current typescript-eslint extension skipped → without oxlint, the
  extension on TS files and the core rule on JS. Why: #39, #32 Q4.
- Q7 `~1.87.0` → a caret range, plus a check that the installed oxlint's schema holds every rule
  and plugin name the merge may write. Why: #32 Q7.
