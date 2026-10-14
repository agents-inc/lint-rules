# Spec: slice 1 (scaffold, rule-data, house port, config factories)

Read `CLAUDE.md`, `docs/plan.md`, `docs/work/{decisions,learnings,questions}.md` first. Git is read-only for
every lane. `~/dev/ai-benchmarking` (`AB`) is read-only. Research behind this spec: the session scratchpad
`understand/*.md`. Tests first: every test file below exists and is seen red before the code it covers.

## Goal

The consumer API in plan.md ("What a consumer's repo looks like") works end to end: `defineLintRules`, `oxlintConfig`
and `eslintConfig` turn one `agents-inc.lint.ts` into a complete oxlint config and a complete ESLint config that
together run the gate's enabled rules, each on one engine.

## Pattern sources (read before writing)

| Source | What to copy |
| --- | --- |
| `~/dev/cli/package.json`, `~/dev/cli/turbo.json` | root workspace, `packageManager`, `^build` on `typecheck`/`test` |
| `~/dev/cli/packages/typescript-config/{base,node}.json` | shared tsconfig, copied, plus the changes under Decisions |
| `~/dev/cli/packages/matrix/package.json` | private `@workspace/*` package: `exports` → `./src/*.ts`, no build |
| `~/dev/cli/packages/vitest-config/node.js` (`nodeConfig`) | per-package vitest settings: node env, `globals: false`, `clearMocks` |
| `~/dev/cli/packages/compile/src/__tests__/factories/agent-config-factories.ts` (`buildAgentConfig`) | factory shape: asserted-on fields required, overrides last |
| `~/dev/cli/packages/cli/package.json` (`generate:*:check`) | committed generated files plus a staleness check |
| `AB/agents-inc/vendor/lint/house/index.js` | the 15 rules to port |
| `AB/agents-inc/vendor/lint/eslint.config.mjs`, `eslint.typed.config.mjs` | parser options, `import-x/resolver-next`, `settings.immutability` RegExps |
| scratchpad `understand/config-generation.md` §7 | the checklist both factories must meet |

## Lanes and file tree

**A0 runs first and alone** (scaffold, every `package.json` with every dependency from the version table, one
`bun install`, `src/catalog.ts` types). Then A1, B and C run in parallel. **Only lane A edits a `package.json` or
`bun.lock`**; another lane that needs a dependency reports it. Lane C's step C1 (legacy re-export) unblocks A1's generator.

```
package.json  turbo.json  .gitignore(edit)                       A0
packages/typescript-config/{package.json,base.json,node.json}    A0
packages/rule-data/                                              A
  package.json tsconfig.json vitest.config.ts                    A0
  data/rules.json                 canonical list (hand-edited; written once by the import)
  data/oxlint-scopes.json         oxlint scope → {oxlintPlugin, eslintPrefix, aliasPrefixes}; per-rule exceptions
  data/ruleset-definitions.json   [{name, list, domain|null, env|null}], in the order below
  src/catalog.ts                  types (A0) + `catalog` value (A1)
  src/eslint-plugins.ts           plugin registry: prefix → {packageName, plugin}
  src/rule-id-parts.ts            pluginPrefixOf, canonicalIdOf
  src/generate/{read-installed,build-inventory,build-routing,render-generated,run-generate}.ts
  src/generated/{inventory.json,routing.json,rule-ids.ts,ruleset-names.ts}   generated, committed
  src/index.ts  src/**/*.test.ts  src/__tests__/factories/inventory-factories.ts
  rulesets.json                   DELETED (folded into data/rules.json; questions.md #4)
packages/eslint-plugin-house/                                    C (package.json/tsconfig: A0)
  src/index.ts  src/rules/<rule-id>.ts ×15  src/shared/*.ts
  src/plugin.test.ts  src/rules/<rule-id>.test.ts ×15
  src/__tests__/cases/<rule-id>.ts  src/__tests__/factories/rule-case-factories.ts
  src/legacy/index.js             temporary verbatim copy of AB's house/index.js; deleted before C finishes
packages/lint-rules/                                             B (package.json: A0)
  tsdown.config.ts tsconfig.json vitest.config.ts turbo.json (test dependsOn build)
  src/index.ts (defineLintRules + types)  src/oxlint.ts  src/eslint.ts      bind the real catalog
  src/core/{validate-lint-rules,resolve-rule-layers,globs,build-oxlint-config,build-eslint-config,eslint-settings}.ts
  src/core/*.test.ts  src/define-lint-rules.type-test.ts  src/gate-equivalence.test.ts
  src/engines.integration.test.ts  src/dist.test.ts
  src/__tests__/factories/{catalog-factories,lint-rules-factories}.ts
  test-fixtures/engines/**        source files the integration test lints
```

## Interfaces between lanes

`@workspace/rule-data` (A). B codes against these names; `src/catalog.ts` types land in A0.

```ts
type Engine = 'oxlint' | 'eslint'
type RulesetList = 'quality' | 'libs' | 'runtimes' | 'languages'
type RulesetDefinition = { name: string; list: RulesetList; domain: string | null; env: string | null }
type ShippedRule = { ruleset: string; options: readonly unknown[]; files: readonly string[] | null; ignores: readonly string[] | null }
type RuleRoute = { id: string; engine: Engine; oxlintName: string | null; oxlintPlugin: string | null;
                   typed: boolean; eslintAliases: readonly string[]; shipped: ShippedRule | null }
type Catalog = { rules: ReadonlyMap<string, RuleRoute>; rulesets: readonly RulesetDefinition[] }
export const catalog: Catalog                                       // real data (A1)
export type RuleId, QualityRulesetName, RuntimeRulesetName, LanguageRulesetName   // generated unions (A1)
export type LibsRulesets   // generated: { readonly ui?: readonly ('react')[]; readonly testing?: …; … }
```

- `shipped` is non-null exactly for canonical-list rules.
- `oxlintName`/`oxlintPlugin` are non-null exactly when `engine` is `oxlint` (`oxlintName` in `--rules` spelling:
  `jsx_a11y/alt-text`, bare core names). `eslintAliases`: other ESLint spellings of an oxlint-routed rule that are
  **not** themselves `RuleId`s (e.g. `import/no-cycle` for `import-x/no-cycle`).
- `@workspace/rule-data/eslint-plugins` exports `eslintPlugins: Readonly<Record<string, { packageName: string; plugin: ESLint.Plugin }>>`,
  keyed by ESLint prefix, house included, core excluded.

`@workspace/eslint-plugin-house` (C) exports `housePlugin`: `meta.namespace` `'house'`, `rules` keyed by the 15 rule names.

## Dependencies (exact pins; `npm view <pkg> version`, 2026-10-10)

| Package | Pin | Notes |
| --- | --- | --- |
| bun (`packageManager`) | 1.2.6 | installed; cli precedent |
| turbo | 2.11.7 | root |
| typescript | 6.0.3 | 7.0.2 is latest, but typescript-eslint 8.71.1 peers `typescript <6.1.0` |
| vitest, vite | 5.0.3, 8.3.4 | vitest 5 lists `vite` as a required peer |
| @types/node | 22.20.5 | matches the `>=22.18` floor |
| tsdown | 0.23.0 | lint-rules only; `dts: { eager: true }`, `deps.alwaysBundle: [/^@workspace\//]` (learnings.md) |
| oxlint | 1.87.0 | dev in rule-data and lint-rules; lint-rules peer `~1.87.0` (plan: narrow range) |
| eslint | 10.12.0 | dev; lint-rules peer `^10.0.0` |
| typescript-eslint, @typescript-eslint/utils, @typescript-eslint/rule-tester | 8.71.1 | utils + rule-tester: house only |
| @eslint/compat, globals | 2.1.1, 17.13.0 | lint-rules |
| ESLint plugins (rule-data deps; lint-rules deps) | latest | @eslint-react/eslint-plugin 5.24.10, check-file 3.3.2, css-modules 2.12.0, functional 10.0.1, import-x 4.17.1, n 18.4.1, no-secrets 2.3.3, perfectionist 5.12.1, promise 7.3.0, react 7.37.5, react-hook-form 0.3.1, react-you-might-not-need-an-effect 1.0.2, regexp 3.3.1, sonarjs 4.2.2, storybook 10.6.1, testing-library 7.16.2, unicorn 77.0.0 (`eslint-plugin-` prefix except the first) |

- **ESLint 10 peer conflict.** `eslint-plugin-react` 7.37.5 peers `eslint ^9.7` at most. Measured in a scratch
  install: bun 1.2.6 prints `warn: incorrect peer dependency "eslint@10.12.0"` and exits 0; `npm install` fails with
  ERESOLVE. Slice 1 uses bun, so it proceeds; npm consumers are the publishing slice's problem (plan.md "Does not carry over").
- **`eslint-plugin-jsx-a11y` is not a dependency:** no enabled jsx-a11y rule runs in ESLint; its names get stubs.
- **Measured at these versions:** every enabled ESLint-run rule exists and none is deprecated; every oxlint-run native name
  exists in 1.87. Behaviour changes since the gate's versions (unicorn 74 → 77) are unproven until slice 2.

## The one-time import (A1, scratch script outside the repo)

Reads the scratchpad's `enabled-join.json` (engine, native name, options, typed, `scoped`), `oxlint-print-config.json`
overrides and `eslint-enabled.json` entries, and the draft `packages/rule-data/rulesets.json` (joined on `rulesets_id`).
Writes `data/rules.json`, sorted by `id`: `{id, ruleset, engine, oxlintName?, options, typed, files?, ignores?, assignment}`.

- `eslint-typed` → `engine: eslint, typed: true`; options `null` → `[]`; severity dropped (always `error`).
- `files` = union of the enabling entries' globs. `ignores` = union of `off` entries **after** the first
  enabling entry, on the rule's own engine; entries on the engine that does not run the rule are inert, dropped.
- The draft now has no `UNPLACED` (owner 2026-10-10, critique r1 applied). `assignment` = `{confidence, alternative?, note?, by}` from the draft.
- Ruleset definitions, in this order (owner 2026-10-10): quality = correctness, type-safety, security, accessibility,
  performance, complexity, declarative, immutability, modern-js, redundancy, modules, import-order, naming, comments,
  ordering, conventions, tests; libs = ui: [react], testing: [vitest, testing-library, storybook], forms: [react-hook-form],
  styling: [css-modules]; runtimes = node (env node), browser (env browser); languages = none.
- `unicorn/prefer-dom-node-dataset` → canonical `unicorn/dom-node-dataset` (questions.md #3). `unicorn/no-hex-escape` keeps its ID.
- `import-x/no-extraneous-dependencies`: drop the gate's `packageDir` placeholder (options `[]`).

## Behaviour contracts

**Generator (A).** `RuleId` = canonical IDs ∪ every oxlint rule's canonical ID ∪ non-deprecated ESLint core, plugin
and house IDs. Route: canonical list's engine; else oxlint if oxlint has a non-type-aware version; else ESLint
(questions.md #2). oxlint → canonical via `oxlint-scopes.json` (exceptions first: the `react`→`react-hooks` names,
`react/only-export-components`, the two unicorn renames). Plugin prefixes follow ESLint's own parse: `n/prefer-global/buffer`
→ `n`, `@next/next/x` → `@next/next`. Throws on two IDs with one `oxlintName`. Output is deterministic (sorted keys).

**Config shape and validation (B).** Types per plan.md's table. Required: `tsconfigRootDir`, `rulesets.quality`,
`rulesets.libs`, `rulesets.runtimes`. Optional: `rulesets.languages`, `ignores`, `rules`, `fileOverrides` (Open #6).
`validateLintRules` runs in `defineLintRules` and in both factories (types are stripped at load). It throws, naming the
value and its path (`rules`, `fileOverrides[1].rulesets.libs.ui`), on: unknown ruleset, a ruleset in the wrong list or libs
domain, unknown domain, unknown rule ID, invalid severity. No suggestions (plan).

**Rule layers (B, engine-neutral).** Base = every rule whose ruleset is listed, at `error` with its options; then `rules`
on top (severity/options; can enable any `RuleId`, including one whose ruleset is unlisted). A shipped rule keeps its
`files`/`ignores` wherever it is enabled from the top level. Each `fileOverrides` entry: a list it gives replaces the
top-level list for its files (`libs` replaced whole; `libs: {}` = none), a list it omits is inherited; emitted as the
difference: dropped rules `off`, added rules on with options, runtime globals switched; then the entry's `rules`, which
apply to exactly its `files`. Entries keep their order (later wins). Slash-free globs get `**/` (consumer and data globs, both engines).

**`oxlintConfig(rules, extras?)`** returns a complete config: no `extends`; all 7 categories `off`; `plugins` = the
`oxlintPlugin` of every rule emitted anywhere; rules under `oxlintName`; overrides always carry `[severity, ...options]`;
`env` = `builtin`, `es2024` + listed runtimes; `ignorePatterns` = normalised `ignores` (+ Open #3);
`options.reportUnusedDisableDirectives` off. Built-in `ignores` → an override turning the rule `off` there; a rule added
by a `fileOverrides` entry gets `excludeFiles` = its `ignores`. Extras: `rules` and `globals`/`env`/`settings` merged,
`jsPlugins` concatenated, `overrides` appended after ours; throws if extras set `categories`, `options` or `extends`
(plan: managed by the package), or any rule key that is a `RuleId` or an `oxlintName`.

**`eslintConfig(rules, ...extras)`** returns blocks in this order, each `name`d `agents-inc/…`: global ignores; base
(`files` = all JS/TS extensions, `tseslint.parser`, `ecmaFeatures.jsx`, `ecmaVersion: 'latest'`, `sourceType: 'module'`,
our plugins with css-modules and react-hook-form through `fixupPluginRules`, stub plugins, `import-x/resolver-next`,
`immutability` settings, runtime globals, `linterOptions.reportUnusedDisableDirectives: 'off'`, untyped ESLint-routed
rules); typed (TS extensions, `projectService: true`, `tsconfigRootDir`, typed rules; one config, questions.md #1);
built-in scope blocks (a fileOverride adding a `files`-scoped rule uses nested-array `files` = override glob AND rule
glob, plus the rule's `ignores`); consumer overrides; extras, in order; **final**: every oxlint-routed `RuleId` and its
`eslintAliases` `off`. Stub plugins: one per prefix of an oxlint-routed ID that neither we nor any extras block register,
holding a do-nothing rule per such ID. Throws if an extras block's `rules` sets a `RuleId`.

**Data guard (A):** no oxlint-routed rule may carry `files`: oxlint overrides cannot AND two globs, so a fileOverride
adding it could not be scoped. Today every `files` rule is ESLint-routed; the guard turns a future move into a red test.

## Tests (members with `toStrictEqual`; factories for test data; temp dirs only, never the tree)

| File | Asserts | Red first on |
| --- | --- | --- |
| A `rule-id-parts.test.ts` | `pluginPrefixOf`: `n/prefer-global/buffer`→`n`, `@next/next/no-img-element`→`@next/next`, `no-debugger`→core; `canonicalIdOf`: `typescript/x`→`@typescript-eslint/x`, `eslint/no-debugger`→`no-debugger`, `react/rules-of-hooks`→`react-hooks/rules-of-hooks`, `node/no-exports-assign`→`n/no-exports-assign`; unknown scope throws beside a known one | missing module |
| A `generate/build-routing.test.ts` | factory inventories: canonical engine wins; oxlint+ESLint untyped → oxlint; type-aware → ESLint; ESLint-only → ESLint; deprecated non-canonical ESLint ID absent from `RuleId`, present when canonical; aliases exclude `RuleId`s; `oxlintName` collision throws | missing module |
| A `canonical-list.test.ts` (real data) | lists of offenders each `[]`: duplicate/unsorted IDs, ID absent from inventory on its engine, `oxlintName` not mapping back to its ID, unknown ruleset, `files` on an oxlint rule, `typed` on an oxlint rule, unassigned IDs. Pins: `react-hooks/rules-of-hooks`, `unicorn/dom-node-dataset`, `max-lines` (files+ignores), `storybook/default-exports` (files) | missing data |
| A `generate/generated-files.test.ts` | real readers + builders, in memory: each generated file equals the committed one | files not yet generated |
| A `eslint-plugins.test.ts` | registry prefixes = the dependency table's plugins + `house`; each plugin's installed version = the inventory's | missing module |
| C `plugin.test.ts` | `Object.keys(housePlugin.rules)` = the 15 names, written in the test (from AB `fixtures.json`'s `house/*` keys); `meta.namespace` `'house'` | missing module |
| C `rules/<rule>.test.ts` ×15 | RuleTester (typescript-eslint parser): invalid = the AB `fixtures.json` `house/*` source with messageId, line and, for the 2 fixable rules, `output`; valid = each AB negative split into self-contained, parseable cases (9 rules); one valid case for each of the other 6. Cases are copied into `src/__tests__/cases/`; no test reads AB | missing module; then green against `src/legacy` |
| C `rules/no-section-banner.test.ts`, D1 cases | `export const x = 1 // helpers⏎export const y = 2⏎` and the `/* ---- */` variant fix to `export const x = 1⏎export const y = 2⏎`; a banner alone on its line still loses the whole line | **red against `src/legacy`** (joins lines) |
| B `core/validate-lint-rules.test.ts` | each throw from "Config shape" with its message, each beside an allowed config | missing module |
| B `define-lint-rules.type-test.ts` | `@ts-expect-error` on each refusal (unknown ruleset, wrong list, wrong domain, unknown ID, unknown key), allowed case beside it; checked by `typecheck` | generated types absent |
| B `core/resolve-rule-layers.test.ts` | base = union of listed rulesets; unlisted ruleset absent; `rules` warn/off/options; enabling a rule of an unlisted ruleset keeps its `files`; an available-but-off ID lands on its routed engine | missing module |
| B `core/file-overrides.test.ts` | replace vs inherit per list; `libs: {}`; dropped `off`, added on with options; dropping `browser` with `node` kept leaves `console` defined; entry order kept; entry `rules` after its diff | missing module |
| B `core/globs.test.ts` | `*.test.ts`→`**/*.test.ts`; `src/*.ts`, `**/x` unchanged | missing module |
| B `core/build-oxlint-config.test.ts` | every bullet of the oxlint contract, incl. `excludeFiles`, plugin from an override-only rule, extras merge, each throw beside an accepted extras | missing module |
| B `core/build-eslint-config.test.ts` | block `name` order; plugins/parser/settings; typed block; nested-array AND for an added `files` rule; final block holds canonical + alias names and no ESLint-routed twin (`@typescript-eslint/no-unused-vars`); stub for an unregistered prefix, none for a prefix an extras block registers; extras before final; `RuleId` in extras throws, `import/no-cycle` accepted | missing module |
| B `gate-equivalence.test.ts` (real catalog) | every ruleset listed, no overrides: `{id, engine, options}` of rules on in either output = all canonical rules; no ID on in both engines | factories absent |
| B `engines.integration.test.ts` (real oxlint 1.87 CLI, ESLint Node API) | oxlint loads the full config (exit 0/1, JSON parses); `--print-config` rules (as canonical) = emitted oxlint rules, and a real run's `number_of_rules` equals that list's length (no rule silently dropped). ESLint loads the full config and lints every fixture without a fatal message. Fires on the expected engine only, under the exact ID: `react-hooks/rules-of-hooks` (oxlint), `n/no-exports-assign` enabled via `rules` (oxlint, as `node/`), `n/prefer-global/buffer` (ESLint), `@typescript-eslint/no-floating-promises` (ESLint typed), `house/no-section-banner`, `css-modules/no-undef-class` (sibling `.module.css`), `storybook/default-exports` on `x.stories.tsx` and silent on the same code in `x.tsx`. An `oxc/*` suppression loads in ESLint. **KNOWN GAP `it.fails`:** a suppression for `react/no-clone-element` (oxlint-only name under a plugin we register) loads | factories absent |
| B `dist.test.ts` | built `dist/*.mjs` and `*.d.mts` contain no `@workspace/`; every bare import is in `dependencies` or `peerDependencies` | no build |

## Success criteria

| Criterion | Command |
| --- | --- |
| Install works | `bun install` exits 0 (eslint-plugin-react peer warnings expected) |
| Types | `bun run typecheck` exits 0 |
| Tests | `bun run test` exits 0, each workspace reports > 0 tests, and the only `it.fails` are the KNOWN GAPs named above |
| Generator idempotent | `bun run --cwd packages/rule-data generate` then `git status --short packages/rule-data/src/generated` is empty |
| Build | `bun run build` writes `packages/lint-rules/dist/{index,oxlint,eslint}.{mjs,d.mts}` |
| Draft folded, legacy gone | `ls packages/rule-data/rulesets.json packages/eslint-plugin-house/src/legacy` both fail |
| No casts | `grep -rn "as unknown as" packages/*/src` is empty; each other `as` is at a JSON/CLI parse boundary |
| AB untouched | `git -C ~/dev/ai-benchmarking status --porcelain` same before and after |
| Run for real | `npm pack` lint-rules into a scratch project with eslint 10.12 + oxlint 1.87, plan.md's three files verbatim, Node 22.23: `oxlint` and `eslint .` both run, each with a planted violation reported once. Cases tracked in a scratch file; failures to `docs/work/learnings.md` |
| Docs | after all lanes land: one `docs/architecture.md` (packages, data flow source → generated → factories, the two config shapes); `docs/plan.md` Open list updated by the orchestrator |

## Decisions taken here

- Generated files are committed with a staleness test (cli precedent), not written at build time as plan.md says.
- No runtime schema library: data is static, so its invariants are tests (`canonical-list.test.ts`), not consumer cost.
- `node.json` adds `erasableSyntaxOnly` and `module`/`moduleResolution: nodenext`, so `tsc` rejects extensionless relative
  imports, which Node cannot load when the repo later imports workspace source (learnings.md).
- The final ESLint block names every oxlint-routed ID unconditionally: measured, ESLint 10.12 accepts `off` for a rule or
  plugin it does not know. Stubs go only under prefixes nobody registers: measured, a second different plugin object
  under one key throws `Cannot redefine plugin`. So registered plugins are never copied to add stubs (the KNOWN GAP).
- House port (C): legacy copy wired first so the suites pin today's behaviour; then TS, one file per rule via
  `ESLintUtils.RuleCreator.withoutDocs`, `meta.defaultOptions` instead of `??` fallbacks, ESLint-10-removed API shims
  deleted. Shared helpers only where copies behave identically (keep each rule's own component regex). Only D1 changes
  behaviour (questions.md #5). If the plugin type needs a cast to fit ESLint's, stop and report.

## Open decisions (default applies unless the owner says otherwise)

1. **Unassigned rules:** resolved; every rule has a ruleset (owner 2026-10-10). `ruleset` is non-null in the data.
2. **Extras that set our IDs.** Plan says a factory throws, and also that extras such as `eslint-config-next` are tamed by
   the final block; but that config sets `react-hooks/*`, which are `RuleId`s, so it throws. Default: throw.
3. **Built-in ignores.** Default: only `**/node_modules/**`, added to oxlint (ESLint ignores it already), so both engines
   see the same files. The gate's other patterns (`dist`, `*.d.ts`, …) become the consumer's `ignores`.
4. **Deprecated ESLint rules** outside the canonical list are not `RuleId`s (keeps renamed duplicates such as
   `unicorn/prefer-dom-node-dataset` out). They stay settable in the engine file.
5. **Plugin versions:** latest (above) rather than the gate's proven versions; unicorn is three majors ahead.
6. **Optional config keys** (Config shape): plan.md's customised example omits `languages`; the rest is a default.

## Out of scope

The runner, `init`, per-rule fixture proof (slice 2), the explorer, changesets and publishing, linting this repo,
off-with-reason entries in the canonical list, any ruleset assignment change, house defects other than D1 (D2-D7), a
formatter, and every file under `.claude/`, `.agents-inc/`, `docs/plan.md`, `CLAUDE.md` and `docs/work/` other than this spec.
