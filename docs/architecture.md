# Architecture

How the built pieces fit, and the flows that matter. What was decided and why: [plan.md](plan.md).

## Packages

| Package | Owns |
| --- | --- |
| `packages/rule-data` (private) | The hand-edited data in `data/`: `rules.json` (the canonical list: every rule we ship, with its ruleset or `alwaysOn`, engine, options and file scope, plus `whenSuppressions` on the rules `allowSuppressions` sets, `eslintBecause` on each rule ESLint runs because oxlint's version is measurably worse, `coveredBy`, `coveredInOxlintBy` or `splitByTypesWith` on a rule that reports what another does ([plan](plan.md#ruleset-assignment)), `allowancesLeftTo` on a rule whose options allow calls another shipped rule reports (each entry, its option's key, that rule and why), and `readsRuntimeGlobals` on each rule our runtimes' globals serve), `ruleset-definitions.json` (every ruleset with its list, libs domain, runtime env, `optIn` and `sortsCode`, in the order a consumer lists them), `eslint-stand-ins.json` (for an `oxc/*` rule ESLint has no version of, the ESLint rule that reports the same code, each with its card and measurement, checked by `eslint-stand-ins.test.ts`), `without-an-eslint-stand-in.json` (each other shipped `oxc/*` rule, with the search that found none, checked by the same test), `oxlint-scopes.json` (oxlint scope → ESLint prefix, plus per-rule exceptions), `eslint-fallback-skips.json` (the oxlint-run rules an ESLint part without oxlint leaves out, each with its reason, checked by `eslint-fallback-skips.test.ts`), `rule-candidates.json` (every installed rule we do not ship, and candidates from plugins we do not install, each with a status and reason, checked by `rule-candidates.test.ts`), `oxlint-file-types.json` (the file types oxlint lints, and the rules whose guard skips some of them, each with where it was read or measured, checked against the installed oxlint by `oxlint-file-types.integration.test.ts`) and `oxlint-refused-options.json` (the options of a typescript-eslint extension that oxlint's copy of the core rule refuses or accepts without honouring, with where each was measured, checked against the installed oxlint by `oxlint-refused-options.integration.test.ts`). The ESLint plugin registry, `eslintPlugins` in `src/eslint-plugins.ts` (rule-ID prefix → plugin). The generator in `src/generate/` and its committed output in `src/generated/`. The `catalog` in `src/catalog.ts`. `consumerConfigFiles` in `src/consumer-config-files.ts`, the one source of the consumer's file names. |
| `packages/eslint-plugin-house` (private) | The `house/*` rules, one file each in `src/rules/`, exported as `housePlugin`; and `repoOwnPlugin` (`src/repo-own-plugin.ts`), rules in the same folder that this repo's `eslint.config.mjs` runs on its own code and that are not shipped. |
| `packages/lint-rules` (published as `@agents-inc/lint-rules`) | The consumer API: `defineLintRules` (`.`), `mergeOxlintConfig` (`./oxlint`), `mergeEslintConfig` (`./eslint`); the `agents-inc-lint` bin (`src/cli.ts`), with `check` in `src/cli/check/` and `init` in `src/cli/init/`; the internal `agentSettingsOf` (`src/agent-settings.ts`) and `buildAgentConfigs` (`src/agent-configs.ts`), which no export names, for `check`; and the core in `src/core/`. tsdown inlines the private packages into `dist/`; every ESLint plugin is a `dependency`, as are `eslint` and `oxlint`, pinned, and `typescript` is the one peer. `dist.test.ts` checks that no `@workspace/` name and no undeclared import reaches `dist/`. |
| `packages/typescript-config` (private) | Shared tsconfigs. |

The private packages export their `.ts` source with no build step.

`bun run typecheck` first runs knip from the root (`bun run unused-exports`), which fails on an export or a file
in the packages that nothing imports, test helpers included. What counts, and each exemption with its reason:
`knip.jsonc`; its limit: [plan](plan.md#open).

Mutation testing of the lint-rules, rule-data and house sources (StrykerJS), and how it reaches the integration tests,
which load the built `dist/`: [mutation testing](work/mutation-testing.md).

## Data flow

```
data/rules.json, ruleset-definitions.json, oxlint-scopes.json      (hand-edited)
installed oxlint, ESLint and the plugins in eslintPlugins
        │  generate: readInstalledEngines → buildInventory → buildRouting
        ▼
src/generated/inventory.json, routing.json, rule-ids.ts, ruleset-names.ts   (committed)
        │
        ▼
catalog: every RuleId → engine, oxlint name and spellings, ESLint aliases, same-module names, shipped settings
        │
        ▼
core: resolveRuleLayers → editor set: editorPartsOf → mergeOxlintPart | mergeEslintPart
                        → agent set: buildAgentConfigs → buildOxlintConfig | buildEslintConfig
        │
        ▼
entry points: defineLintRules (index.ts), mergeOxlintConfig (oxlint.ts), mergeEslintConfig (eslint.ts),
              the agents-inc-lint bin (cli.ts)
```

- `readInstalledEngines` (`read-installed.ts`) lists oxlint's rules (`oxlint --rules --format=json`),
  ESLint's built-in rules and every registered plugin's rules. `buildInventory` joins them on the
  canonical (ESLint) ID through `oxlint-scopes.json`. `buildRouting` makes every rule a `RuleId`
  except a deprecated ESLint-only rule we do not ship, and gives each an engine: the canonical list's,
  else oxlint when oxlint has a version that needs no type information, else ESLint
  (`defaultEngineOf`).
- `lint-rules` reads rules, rulesets and the rules `allowSuppressions` sets (`isSuppressionRoute`)
  from the `catalog`, and names none (`names-no-rule.test.ts`).
- Each merge also reads the team's configs: [Reading the team's configs](#reading-the-teams-configs).

## How a consumer's config becomes two engine configs

1. **Load and validate** (`defineLintRules`, `index.ts`). A team's `oxlint.config.mts` and
   `eslint.config.mjs` each import `agents-inc.lint.mts`. TypeScript's types refuse an invalid
   config, each name checked where it is written, in a const given there too, but for a const a
   value typed `LintRules` holds ([Open](plan.md#open)) (owner 2026-10-19).
   `defineLintRules` checks only what no type sees: that `tsconfigRootDir` is the absolute path of
   an existing folder (`refuseATsconfigRootDirThatIsNoFolder`). A config nobody type-checks gets no
   other config error of ours; an unknown rule ID stops at the catalog look-up, which names no file.
   Every config error names the file to fix (`configErrorIn`). It then reads whether the project
   uses oxlint (`projectUsesOxlint`: whether the `package.json` nearest to `tsconfigRootDir` lists
   `oxlint` in `dependencies` or `devDependencies`; none above it is read, nor is `node_modules`),
   returns the editor parts (step 5), and records the agent set under each part
   (`recordAgentSettings`), from which `agentSettingsOf` gives `buildAgentConfigs` its input: it
   reads the project's facts once (step 4) and builds both agent configs (steps 3 and 4).
2. **Resolve layers** (`resolveRuleLayers`, engine-neutral).
   - Top level: every always-on rule and every rule of a listed ruleset at `error` with its shipped
     options (`isTurnedOnUnder`), then `rules` on top, then the rules `allowSuppressions` sets, at
     their setting in its mode (`suppressionRulesIn`), which is `banned` unless it is true. A
     severity alone keeps the options in force. A shipped rule keeps its own `files` and `ignores`
     wherever it is set, so softening a rule never widens where it runs, but for a core rule ESLint
     runs at its typescript-eslint version's setting (step 6). The env is each listed
     runtime's.
   - Each `fileOverrides` entry: a list it gives replaces the top-level list for its files (`libs`
     whole, so `libs: {}` is none); a list it leaves out is inherited. It is emitted as a
     difference from the top level (`rulesetChanges`: dropped rules `off`, added rules on, rules whose
     options change; and env changes), then the entry's own `rules`. An always-on rule is on whatever an entry lists, so
     only `rules` turn it off; `listOfRulesetRule` throws if a ruleset change ever names one.
   - An entry that gives `allowSuppressions` sets every rule it decides at the entry's mode
     (`suppressionsSetBy`), so it wins over the top level and earlier entries. One that leaves it
     out sets none of them, and the mode before it stands.
   - Overlap: entries keep their order and the later wins. An entry re-states, at its own setting,
     every rule and env an earlier entry changed in a list this entry gives. A list it leaves out
     keeps what earlier entries set there (`restatedBy`).
   - Covered by (rule-data's `coveredBy`): in each layer, a shipped rule whose cover is on is left
     out, unless the top-level `rules` name it (`withoutCoveredRules`); naming its typescript-eslint
     twin does not count. In an entry's files, the entry's lists decide it the same way (its
     `rulesetChanges`; `listsChanging` for overlap), and its own `rules` naming it win there, but
     its `rules` turning the cover on or off do not move it. Where the cover runs in some files
     alone, the rule is still left out of the whole layer. Every build and merge reads these layers,
     so all of them leave it out. Beside oxlint (the agent build, and both editor parts where the
     project lists oxlint), `coveredInOxlintBy` leaves a rule out the same way
     (`resolveRuleLayersBesideOxlint`); an ESLint part without oxlint keeps it, as ESLint's version of
     the cover reports less.
   - Allowances left to another rule (rule-data's `allowancesLeftTo`): an options entry allowing
     calls another shipped rule reports, as `no-floating-promises` leaves an unawaited Vitest
     assertion to `vitest/valid-expect` and Testing Library's async calls to the
     `testing-library/await-async-*` rules, is kept in the files where that rule runs in the layer (on
     by the layer's lists or the top-level `rules`, within its own `files` and `ignores`), and dropped
     elsewhere (`withAllowancesWhereTheirRulesRun`), so each such call is reported once. Where that
     rule runs on some files alone, the entry moves to the setting's `optionsInFiles`: one per set of
     those rules' scopes, smallest set first, so the last to apply in a file holds every rule running
     there. Options a `rules` entry writes are used as written; a severity alone gets the options in
     force there, file by file. An entry restates the rule holding the entry where its lists
     change it (`listsChanging` counts the other rule's list), and its own `rules` turning that rule on
     or off do not move it, as for a cover.
   - A slash-free glob gets `**/` (`normalizeGlob`): oxlint matches it at any depth, ESLint only at
     the root. Each value of our `ignores` becomes the forms both engines read as that .gitignore
     line (`formsOfAnIgnoresValue`; [plan](plan.md), the `ignores` row).
3. **The agent set's oxlint config** (`buildOxlintConfig`). No `extends`. Every category is `off`,
   so only named rules run. `plugins` holds the plugin of every rule emitted anywhere, because oxlint silently skips a rule
   whose plugin is missing. Each rule is written under its `oxlintName` as `[severity, ...options]`,
   because a bare severity resets oxlint's options. `env` is `builtin`, `es2024` and the runtimes;
   `ignorePatterns` is `**/node_modules/**` plus `ignores`; `reportUnusedDisableDirectives` is off;
   `settings.react.version` is `18.3.0` (`REACT_VERSION`), the oldest React the `react` ruleset expects.
   Overrides: first each framework's globals in its files (`framework-globals.ts`), whatever
   rulesets are listed: the `svelte` env (Svelte 5's runes) on Svelte's components and rune modules,
   `$$props`, `$$restProps` and `$$slots` read-only on its components, and the `vue` and `astro`
   envs on theirs; and the `vitest` and `jest` envs on test files (`TEST_RUNNER_GLOBALS`:
   `*.test.*`, `*.spec.*`, `*.test-d.*`, `*.spec-d.*` and any file under `__tests__`, JS and TS); then one per top-level rule
   with `ignores`, turning it off there, then the top level's TS-file rules; then per entry, one
   for its ruleset, env and `allowSuppressions` changes, one for its own rules, one per rule it turns on that has
   `ignores` (as `excludeFiles`), ones turning a core rule off on its TS files alone (D11 in
   [decisions](work/decisions.md)), and last its TS-file rules. A layer has TS-file rules
   (`tsFileRules`, `twin-pairs.ts`) only where it names both a core rule and typescript-eslint's
   extension of it: the core rule at the extension's setting on the layer's TS files, within its own
   `ignores`, or off there where oxlint refuses an option of it; and the extension at its setting
   there, off in the layer's other files (D9, D11). An oxlint rule cannot be turned on in `files` of
   its own: `oxlintSettingsOf` throws, and `canonical-list.test.ts` keeps such a rule out of the data.
4. **The agent set's ESLint config** (`buildEslintConfig`). It reads nothing from disk: it takes
   the project's facts (`projectFactsOf`, `project-facts.ts`), read by one walk of
   `tsconfigRootDir`: the TS files outside every tsconfig (step 8), and every `tsconfig.json` and
   `jsconfig.json` outside `node_modules` and `.git`. Named
   blocks, in this order:
   - `agents-inc/ignores`: the global ignores.
   - `agents-inc/base`: every JS and TS file, `tseslint.parser`, every plugin (with `css-modules`,
     `react` and `react-hook-form` through `fixupPluginRules` in `core/eslint-compat.ts`, and
     typescript-eslint's `no-deprecated` and `consistent-type-exports` given a checker that ends a
     re-export cycle, `core/re-export-cycles.ts`), the stub
     plugins, `buildEslintSettings`, the runtime globals, and the untyped rules. import-x resolves
     modules with eslint-import-resolver-typescript, given those tsconfigs, and reads TS modules'
     exports (`import-x/extensions`; #33 fix C). `settings.react.version` is `18.3.0`, as in step 3.
   - `agents-inc/svelte-runes`: the same runes (the `globals` package's `svelte` env) on Svelte's
     rune modules, each file whose name holds `.svelte.` and ends in `.js` or `.ts`; naming `.svelte`
     files would make ESLint lint them, which our parser cannot read.
   - `agents-inc/test-runner-globals`: the `globals` package's `vitest` and `jest` on the test files
     of step 3, whatever rulesets are listed.
   - `agents-inc/typed`: TS files with the project service, only when a typed rule is on, less the
     files without type information (step 8). Where a typed rule and the untyped rule split by types
     with it (rule-data's `splitByTypesWith`) are both on, it states the untyped one `off`; an
     entry's `/typed` block states it again where the entry states either rule: `off` where the
     typed one runs there, else at its setting (`untypedStatementsOfAnEntry`).
   - `agents-inc/scope/<id>`: one block per rule with its own `files` or `ignores`, then one per
     rule the top level gives its TS files alone (step 3), as an entry's `/scope/<id>` blocks end
     with its own. A nested `files` array ANDs globs (`filesMatchingAll`).
   - `agents-inc/options-in-files/<n>/<id>`, and an entry's `/options-in-files/<n>/<id>`: a rule's
     `optionsInFiles` (step 2), a block each in order, within the rule's own files and ignores. Our
     oxlint config writes none, so rule-data refuses an entry left to a rule with `files` or `ignores`
     by a rule oxlint runs.
   - `agents-inc/test-files`, and an entry's `/test-files`: where suppressions are banned, a rule
     `allowSuppressions` decides at its setting for test and type-test files (rule-data's
     `bannedInTestFiles`), so `ban-ts-comment` allows `@ts-expect-error` with a description there.
   - `agents-inc/file-overrides/<n>`, with `/typed`, `/scope/<id>` and `/options-in-files/<n>/<id>` blocks: each entry's changes
     and rules. A dropped runtime turns off only the globals no remaining runtime defines.
   - `agents-inc/twins-off/<n>`: sub-agents always run oxlint, which runs a core rule and
     typescript-eslint's extension of it as one rule, so each extension our blocks run is off
     wherever our oxlint part runs the core rule it extends (`extensionsOffWhereOxlintRunsTheirCore`;
     the pair's setting is decided as beside oxlint by `agentBuildLayersOf`, `twin-pairs.ts`; D10 in
     [decisions](work/decisions.md)).
   - `agents-inc/oxlint-rules-off`: every oxlint-routed ID and its ESLint aliases `off`, so no
     earlier block runs a rule twice.

   `agents-inc/base` sets `linterOptions.noInlineConfig` from the top-level mode
   (`readsNoDirectivesIn`): true where suppressions are banned. A directive applies before any rule
   runs, so without this `/* eslint-disable */` would switch the ban off for its own file. An entry
   that gives `allowSuppressions` sets the option on its own block (`inlineConfigGuardOf`), which is
   emitted even when it sets no rule; an entry that leaves it out leaves the option alone, so it
   layers as the mode does. oxlint has no such guard.

   Each oxlint-routed ID under a plugin prefix gets a do-nothing rule, so a suppression comment for
   it loads where the ban is off: in a stub plugin when no plugin registers its prefix, and in a
   copy of our plugin (never the plugin itself) when ours lacks the name. So does oxlint's name of
   the rule under the ID's prefix, where it names another rule (`unicorn/no-array-for-each`), since
   oxlint honours a suppression only under its own name (`oxlintRuleNamesByPrefix`).
5. **The editor parts** (`editorPartsOf`, `editor-parts.ts`): plain data, no plugin objects, so
   importing a part loads nothing of ESLint's. The editor set is resolved with suppressions
   allowed (an `allowSuppressions` anywhere decides for sub-agents only).
   - Beside oxlint, the oxlint part holds the oxlint-routed rules and `turnedOnInEslint`, every rule
     the ESLint part turns on (step 7). The ESLint part holds the rest, plus the oxlint part's layers
     (`oxlintLayers`), from which its merge works out where our oxlint part runs a rule, as oxlint
     reads it, for D10 (step 6): `whereOurOxlintPartRuns` in `where-our-parts-run.ts`, which the
     agent build's `twins-off` blocks (step 4) ask too. It reads, oxlint's way
     (`ignores-read-by-each-engine.ts`), the agent build's `ignorePatterns`, which is
     `**/node_modules/**` and our `ignores` (`filesOxlintLeavesOutOf`), and keeps to the file types
     each rule runs on (rule-data's `oxlint-file-types.json`). The files our ESLint part does not
     lint in a merge (`ourEslintPartOf`) are read ESLint's way: our `ignores`, which are not global
     in an editor merge, then its own default ignores (`**/node_modules/`, `.git/`), which hold there
     whatever our negated lines say (`filesEslintLeavesOutOf` of
     `ignoresEslintAppliesToOurEditorPart`).
   - Without oxlint there is no oxlint part. The ESLint part also takes each oxlint-routed rule
     ESLint has a version of, but those in rule-data's `eslint-fallback-skips.json`
     (`runsInEslintWithoutOxlint`). Where a layer states a rule ESLint has no version of that has a
     stand-in (the catalog's `eslintStandIns`), it states the stand-in too, at the rule's severity,
     `files` and `ignores` and with none of its options, unless it states the stand-in itself
     (`withStandIns`).
6. **The ESLint merge** (`mergeEslintConfig` in `eslint.ts`, then `mergeEslintPart` in
   `merge-eslint-config.ts`). It refuses an ESLint below 10 that resolves from
   `tsconfigRootDir`, and goes on where none resolves (`refuseUnsupportedInstalledEslint`,
   `installed-eslint.ts`). The team's config goes through ESLint's `defineConfig`; two objects
   under one prefix in it is a config error. Every merge reads the project's facts (step 4).
   - One plugin object per prefix (`pluginsForEveryBlock`): where the team registers a prefix of
     ours, its object, with our module for each rule we run, a stub for each oxlint-only name beside
     oxlint, and the compat layer where the prefix needs it. Every plugin we register carries our
     version beside its own, so ESLint's `--cache` key changes with our package
     (`withOurVersionInEachCacheKey`).
   - Block order: our blocks, as in step 4 from `agents-inc/base` to the file overrides, with our
     runtime globals' blocks right after the base (below); where a
     team block sets a setting one of ours yields to (an eslint-plugin-n setting, under `settings.n`
     or `settings.node`, that the plugin would read ours in place of, or an import-x resolver
     setting: `settingsOfOurs`, `eslint-settings.ts`), ours moves from
     `agents-inc/base` into `agents-inc/base/settings/<n>` blocks kept to the files no team block
     sets one in (`ourSettingsBeside`; a team block whose `files` or `ignores` holds a function is
     read as reaching every file it may); the team's blocks as `defineConfig` returns them, changed
     only by the shared plugin objects, none of their statements deleted; beside oxlint, last, each
     typescript-eslint extension our blocks still run, off where our oxlint part runs a core rule it
     extends (`extensionsOffWhereOxlintRunsTheirCore`, the agent build's `twins-off`; D10).
   - Every rule the team sets ([Reading the team's configs](#reading-the-teams-configs)) is left
     out of both our parts' layers before any block is built (`ourLayersLeavingOut`,
     `rules-the-team-sets.ts`). Coming first is not enough: a later bare severity keeps an earlier
     block's options. Our rules are also kept out of the files our `ignores` leave out as ESLint
     reads them: a block of ours whose rules may not run everywhere it applies is split into copies
     kept to their files (`confinedBeside`; the file conditions are in `file-conditions.ts`). Where
     the team's global ignores may take files back from ESLint's default ignores
     (`eslintDefaultIgnoresHoldBeside`), ours are kept out of all that step 5's ESLint reading
     leaves out, so every block of ours that states rules is split and `agents-inc/base/confined/0`
     holds the base rules; otherwise those defaults keep every block out of `node_modules` and
     `.git`, and our blocks keep their names.
   - Our runtimes' globals are in blocks of their own, `agents-inc/runtime-globals/<n>` and, for an
     entry's change, `agents-inc/file-overrides/<i>/runtime-globals/<n>`, kept to the files where
     a rule of ours that reads them (rule-data's `readsRuntimeGlobals`) runs in our ESLint part
     (`whereOurEslintPartRuns`). Beside oxlint that is no file, and a rule the team sets is not
     ours, so our globals never silence a team's own `no-undef` (#68).
   - Without oxlint (`twinsOnTsFiles`), each core rule the ESLint part takes over from oxlint that
     typescript-eslint has a current extension of runs as that extension on TS files, in a
     `…/ts-extensions` block after the block stating it; JS files keep the core rule
     (`blocksTakingOverOnTsFiles`, `build-eslint-config.ts`). In each layer (the top level, an
     entry) the two names are one rule: the setting the layer's own `rules` give either name, else
     its rulesets', decides both. Where it is the extension's, the core rule runs with it on every
     JS file the layer reaches, its own shipped `files` and `ignores` aside (q61); where the core
     rule refuses the extension's options, it keeps its own setting on JS files (`takeoverOf`). A
     typed extension's `…/typed-ts-extensions` block keeps to the files with type information, so
     the core rule runs in the rest, and where an extension refuses the options given, the core
     rule keeps running on TS files there (`acceptsEntry`).
   - Typed rules: where a team block turns on `project` or `projectService`, ours give no type
     information, and each typed block of ours becomes a copy within each team block that switches
     type information on, or, stating its typed rules `off` and any untyped rule it states at its
     setting, off again, in the team's order (`typeInformationFor`, `keptToTypedFiles`). A team
     `basePath` is applied by putting its globs under that path from the root, or, for a folder
     above the root, by reading them past the root's folders (`teamFilesFromTheRoot`,
     `globs-read-from-above.ts`).
   - `reportUnusedDisableDirectives` is `off` beside oxlint only; `noInlineConfig` is never set.
     The team's blocks come after ours, so its own `languageOptions`, `settings` and
     `linterOptions` stand wherever its blocks set them.
7. **The oxlint merge** (`mergeOxlintConfig` in `oxlint.ts`, then `mergeOxlintPart` in
   `merge-oxlint-config.ts`). It throws when there is no oxlint part, when the
   `configuration_schema.json` of the oxlint that resolves from `tsconfigRootDir`, whatever its
   version, cannot be read or lacks a rule or plugin name of the catalog's
   oxlint list, any of which the merge may write (`refuseUnsupportedInstalledOxlint`,
   `installed-oxlint.ts`; the schema is read once per process), and when the team's config extends
   a config by path at any depth, which oxlint refuses in a JS or TS config (`refuseAPathInExtends`;
   #43). It reads the team's config as oxlint 1.87 resolves it, rule keys included
   (`oxlintRuleKeyed`); the comment at the top of `oxlint-config-reading.ts` says how, and
   `merge-oxlint-config.differential.integration.test.ts` checks the result against the CLI.
   - Root `plugins`: every plugin the team's config lists or gets from oxlint's defaults, at its
     roots and in its overrides, plus the plugin of each rule the merge states in an override of
     ours (`everyPluginListed`).
   - Overrides, in order: what the merged root changes for the team, put back
     (`offWhereTheRootRunsThem`, `categorySwitchesOf`); where neither the team's config nor any
     config it extends writes `correctness`, oxlint's default copy of each rule our ESLint part
     turns on (`turnedOnInEslint`, twins included) that the team does not set, off in every file
     (`copiesOxlintsDefaultRunsBesideOurEslintPart`; owner 2026-10-14); ours, which only turn rules
     on, each exactly where our part alone runs it and with its options there, kept out of
     `**/node_modules/**`, our `ignores` and the files a later override of ours turns it off in by
     `excludeFiles` (`ourOnStatements`; our `ignores` read as oxlint reads them, step 5, so the
     files a negated line takes back get an override of their own); the team's, without the
     statements oxlint ignores for it. Nothing of ours follows the team's. Every rule the team sets
     ([Reading the team's configs](#reading-the-teams-configs)) is left out of ours
     (`ourLayersLeavingOut`), and our env and globals leave out each key the team's root env and
     globals set. Our runtimes' env keys go only where a rule of ours that reads them runs, as
     oxlint reads our part alone (`whereOurRuntimeEnvsAreRead`; #68). Where the team extends
     objects, the first three go in a first extended config (`placedFirstInLine`), so they still
     come before the team's extended overrides.
   - `extends`: each config the team extends as an object, without the statements oxlint ignores
     for it. `options`: the team's, as written, since oxlint refuses any option in a config below the one
     it starts from. `settings`: the team's, with `react.version` added where it gives none (step 3).
     Every other key, `ignorePatterns` included, is the team's.
8. **The consumer's own config files** (`consumerConfigFiles`). The three shipped rules they break,
   `perfectionist/sort-objects`, `unicorn/no-top-level-side-effects` and, in a package npm may
   publish, `n/no-unpublished-import`, carry them in `ignores`.
   A typed rule on a TS file without type information is a fatal parse error that switches off
   every rule in the file, so every block of ours that can run a typed rule ignores
   (`filesWithoutTypeInformation`) the consumer's config files at any depth where the team gives
   type information. Where it is ours, each such block ANDs a function with the globs of its
   `files` (`keptToFilesATsconfigTakesIn`), which ESLint calls as it lints a file, so the block
   skips each TS file no tsconfig takes in, the consumer's files at `tsconfigRootDir` included, and
   a TS file made after the config loaded is read as the disk then holds it (owner 2026-10-22).
   ESLint documents only globs there, and its types hold no more (one assertion,
   `filesEntryAlsoMatching`); `eslint-function-in-files.test.ts` fails where a later ESLint stops
   calling the function. No default project is named for those files:
   typescript-eslint sets it up once per process from the first config parsed, which failed a
   later project of a monorepo linted from its root whose tsconfig took those files in, or left
   them out, otherwise than the first project's did. One of them that no tsconfig lists, but that
   another one a tsconfig takes in imports by its relative path (`oxlint.config.mts` imports
   `./agents-inc.lint.mts`), is in the project service's program already, so it counts as taken in
   (`isConsumerFileFoundThroughAnImporter`, `project-facts.ts`). `tsconfigWalkOf`
   (`ts-files-outside-every-tsconfig.ts`) answers by the project service's own search, with the
   TypeScript typescript-eslint resolves, reading each tsconfig once; a file the walk did not find
   is asked of the tsconfigs read afresh.

## Reading the team's configs

Both merges drop the same rules (owner 2026-10-14): those the team's ESLint config or its oxlint
config sets, closed under typescript-eslint twins (`rulesTheTeamSets`, `rules-the-team-sets.ts`).
Each merge reads the config it is given, and the team's config for the other engine from the path
its third argument gives (`{ oxlintConfig }` or `{ eslintConfig }`, relative to `tsconfigRootDir`,
or `null`; `other-engine-config.ts`).

- **ESLint config** (`ruleIdsTheTeamsEslintConfigSets`, `eslint-config-reading.ts`): every rule key
  of every block `defineConfig` returns, at any severity, whatever the block's `files`, `ignores`
  or `basePath`, read as each rule of ours it is an ESLint name of. A key under a prefix the team
  registers one of our plugins under (the same object, or one of the same name) names our rule too
  (`prefixesOfOurPluginsIn`): antfu's `ts/x` sets our `@typescript-eslint/x`, and under antfu's
  `react`, which holds @eslint-react where we register eslint-plugin-react, a key sets the rule of
  each.
- **oxlint config** (`ruleIdsTheTeamsOxlintConfigSets`, `oxlint-config-reading.ts`), as oxlint 1.87
  resolves it, configs it extends included: a rule key at any severity, at a root or in an
  override, a statement oxlint skips as its plugin is listed neither there nor at the root
  included (owner 2026-10-22); each rule of
  a plugin listed anywhere that a category the config writes on runs, nursery included, and a
  type-aware one only with `options.typeAware: true`; and a key under a JS plugin's prefix that is
  an ESLint name of ours. oxlint's own `correctness: warn`, where no config writes `correctness`,
  sets no rule (step 7 turns its copies of our ESLint rules off).
- **Loading**, with `require()`, so the merges stay synchronous. Two configs each naming the other
  would be a module cycle, which Node refuses, so a read puts the process in reading mode while it
  runs: a merge called then returns the team's config as given and hands it to the read, which
  takes it, or, where the file calls no merge of ours, its default export. A JSON oxlint config is
  parsed, each path it extends read from the extending file's folder. Each refusal is a
  `configErrorIn` error naming the config file calling the merge: the third argument left out or
  holding neither a path nor `null` (by the ESLint merge alone, and only where the project lists
  oxlint; the oxlint merge leaves both to its types), a path with no file, a file that throws, uses top-level await, exports no config, holds a key no config of that
  engine holds (a `package.json`, say: `refuseKeysNoConfigHolds`, with oxlint's keys from the
  schema of the oxlint our package resolves), or calls our merge more than once. What neither merge
  reads: [plan.md, Open](plan.md#open).

## How `check` runs

`checkIn` (`src/cli/check/run-check.ts`). The bin, `src/cli.ts`, checks the Node floor before it
imports anything an older Node lacks. Every text `check` prints is in `texts.ts`; the exit codes,
shared with `init`, are in `src/cli/exit-codes.ts`.

1. **Find:** the git top level, then the nearest `agents-inc.lint.mts` up to it (`nearestConfig`).
   A config importing another copy of our package is refused (`refuseAnotherCopy`); the config's
   `eslint` export gives the agent build (`agentSettingsOf`, then `buildAgentConfigs`; steps 3 and
   4 above). For the files outside the config's folder, both configs get the config's folder, from
   the git top level, in front of each glob tied to a folder: one holding a `/` that does not start
   with `**/`, but for a `files` glob led by `/`, which names no file in either engine
   (`configsReadFromTheGitTopLevel`).
2. **Pair** (`gitRepoAt`, `git-changes.ts`): a scratch git folder in the OS temp folder holds a copy
   of the index, where there is one, and its own objects, reading the repo's as an alternate.
   Untracked files are added there as intent-to-add, so `git diff --find-renames=1% HEAD` pairs a
   plain `mv` with its old path, and the repo is never written. A file with no old path, or any file
   in a repo with no commits, is wholly changed; otherwise its lines are those `git diff -U0` adds.
   JS, TS, Vue, Svelte and Astro files anywhere in the repo that exist and that the ESLint config
   does not ignore go on; Vue, Svelte and Astro files to oxlint alone (`lintedFileOf`).
3. **Fix** (`applyFixes`, `fix-step.ts`), oxlint's then ESLint's: `oxlint --fix` with the withheld
   rules and every rule at `warn` off (`fixRunConfigOf`, `withheld-fixes.json`), then ESLint with a
   `fix` predicate allowing an `error` rule's fix on a changed line (`eslintFixFilter`). ESLint runs
   with the config's folder as `cwd` and the config as built for the files in that folder, and from
   the git top level with the prefixed config for the rest (`eslintEngineByFolder`, `eslint-run.ts`).
   After each engine, every line nobody changed must still be there, in order (`keepsUnchangedLines`,
   `fix-guard.ts`), or that engine's fixes in that file are undone. ESLint's output is written only
   while the file holds the text it read. A file deleted or replaced meanwhile, or one ESLint throws
   on, is not checked, and nor are oxlint's rules where oxlint fails (`not-checked.ts`); the rest goes
   on.
4. **Lint:** oxlint again, from the git top level with a temporary config there, with
   unused-suppression reports on (`lintRunConfigOf`), as ESLint has them throughout (`eslint-run.ts`). ESLint's
   messages are the fix step's.
5. **Attribute** (`findingsIn`, `findings.ts`), on the lines read again where a fix changed the
   file: a finding counts where the line it starts on changed (for oxlint, its first label's), line
   0 only in a wholly changed file; a parse error counts once per file, wherever it is; an oxlint
   code names its rule through the catalog, or prints as oxlint's own where the catalog lacks it; a
   suppressed name is unused where both engines report it so (`unused-suppressions.ts`).
6. **Report** (`checkReport`, `report.ts`): the findings, then what was not checked; exit 1 where an
   error is left, else 2 where anything was not checked, else 0. The temporary config and the scratch
   folder are removed on exit, after SIGINT or SIGTERM too (`leftovers.ts`). No fix is undone, however the run ends: a
   run a signal or a failure stops prints the autofixed line naming the files its fixes rewrote so
   far (`stdoutIfStopped`, `src/cli/outcome.ts`).

`init` (`initIn`, `src/cli/init/run-init.ts`) writes the text `initConfigText` makes from the
ruleset definitions, and edits `package.json`'s text (`withDevDependency`), both or neither
(`writeAllOrNone`).

## Change a rule

Run the generator and the tests after every data change. `canonical-list.test.ts` lists offenders:
unsorted or duplicate IDs, a rule its engine lacks, an `oxlintName` that does not map back, an
unknown ruleset, `files` or `typed` on an oxlint rule, neither or both of a ruleset and `alwaysOn`, a
missing assignment, an `eslintBecause` on a rule oxlint runs or that oxlint has no untyped version of,
a `coveredBy`, `coveredInOxlintBy`, `splitByTypesWith` or `allowancesLeftTo` that does not hold (`relation-offenders.ts`),
a `files` or `ignores` naming test files without every test-file glob.

- **Change a shipped rule** (options, ruleset or `alwaysOn`, `files`, `ignores`): edit its entry in `data/rules.json`.
- **Ship a rule:** add an entry, sorted by `id`: the ESLint ID, `ruleset` or `alwaysOn: true` (on
  whatever rulesets are listed), `engine`, `oxlintName`
  exactly when oxlint runs it (oxlint's `--rules` spelling), `options`, `typed`, optional `files`
  and `ignores`, and `assignment`; and remove its entry from `rule-candidates.json`, which holds every
  installed rule we do not ship. A shipped `oxc/*` rule ESLint has no version of needs a stand-in in
  `eslint-stand-ins.json` or its search in `without-an-eslint-stand-in.json`, each pinned in
  `__tests__/cases/rule-relations.ts`.
- **Stop shipping a rule:** remove its entry, and add a `dropped` one to `rule-candidates.json` naming
  the card or decision (`decidedBy`), which `__tests__/cases/dropped-rules.ts` pins too.
- **Move a rule between engines:** change `engine`, add or remove `oxlintName`. An oxlint rule
  carries neither `files` nor `typed`. `catalog.test.ts` pins the oxlint rules whose ESLint name
  differs from oxlint's, since a suppression reaches oxlint only under oxlint's name. A rule moved
  to ESLint because oxlint's version is measurably worse gets `eslintBecause`, the reason and the
  measurement ([plan](plan.md#routing-the-canonical-list)), and its ID goes into the list
  `src/__tests__/cases/routed-to-eslint-for-a-reason.ts` pins. Consumers change nothing.
- **Add an ESLint plugin:** add it to the `dependencies` of `rule-data` and `lint-rules`, register it
  in `eslintPlugins` (through `checkedPlugin` when its types do not fit `ESLint.Plugin`), name its
  package in `src/generate/eslint-plugin-package-names.ts`, and add its prefix to
  `PREFIXES_NEEDING_COMPAT` in `lint-rules/src/core/eslint-compat.ts` if it calls context methods ESLint 10
  removed. `eslint-plugins.test.ts` checks the registry against the dependencies. Each of its rules
  we do not ship needs an entry in `rule-candidates.json` (`not-reviewed` until someone looks);
  `rule-candidates.test.ts` names any left out.
- **Add a ruleset** (users type its name, so the owner names it): add it to
  `data/ruleset-definitions.json` in the order consumers list it, and update the pinned list in
  `canonical-list.test.ts`.
- **Add a house rule:** a file in `eslint-plugin-house/src/rules/` with its test, registered in
  `housePlugin` and in the names `plugin.test.ts` pins; then ship it, or give it a `rule-candidates.json`
  entry, as any installed rule.
  A rule for this repo's own code alone is registered in `repoOwnPlugin` instead, which no catalog
  reads, and turned on in `eslint.config.mjs`.

## Keeping the generated files fresh

- `bun run --cwd packages/rule-data generate` writes the four files in `src/generated/`. The script
  runs under Node, because bun cannot load the plugins.
- `generated-files.test.ts` builds them in memory (`generateFiles`) and fails when any differs from
  the committed file. A data edit without a regenerate fails it, and so does an engine or plugin
  upgrade, since `inventory.json` records every version. `eslint-plugins.test.ts` also compares the
  installed plugin versions with the inventory's.
