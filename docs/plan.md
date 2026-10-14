# Plan

One rule set, published to npm, installable into any project. Drafted 2026-10-04, moved here from
ai-benchmarking (`docs/lint-rules-package.md`) on 2026-10-10. Slice 1 is built: the canonical list
and its generator, the house rules, `defineLintRules` with the agent and editor sets, and the merge
functions `mergeEslintConfig` and `mergeOxlintConfig`
([architecture](architecture.md)). The runner and `init` are not.

**The rules currently live in [ai-benchmarking](https://github.com/vincentbollaert/agentic-benchmarking)**
as its lint gate (`~/dev/ai-benchmarking`). A file reference here with no repo prefix
(`rule-triage.json`, `gate.mjs`, `lint-gate.md`, `CLAUDE.md`, `lint_fixpoint_audit.py`, …) is a file
there, under `agents-inc/vendor/lint/`, `docs/` or `scripts/`.
[`CLAUDE.md`](../CLAUDE.md) maps each of them: the configs, the generators, the custom rules and the tests.

Unless marked **proposed** or *(slice 1)*, everything here was decided by the owner, 2026-10-04 to
2026-10-10. *(slice 1)* marks a choice made while building slice 1.

## Decisions

| | |
| --- | --- |
| Engines | **oxlint + ESLint only.** No Biome: a rough name-match gives it a same-logic equivalent for ~211 of the 1,014 enabled rules (21%), and custom rules would need a GritQL rewrite that cannot do scope or type analysis. |
| oxlint | **Required, not opt-in.** `oxc/*` rules exist nowhere in ESLint ([count](work/spec-owner-answers.md#commands)). Opt-in would mean two configs, two proof sets, and the `oxc/*` rules lost. |
| Baseline | None. |
| Hooks | None. Subagents call one runner; the Claude orchestrator decides when. |
| Scope | **The runner reads the changed files and lines from `git diff` itself** (owner 2026-10-11: fewer tokens, faster), so the sub-agent passes no ranges. An untracked file counts as wholly changed and owns every finding in it. Every change in the work tree is checked, another sub-agent's included; the agent instructions say to fix your own code, and nothing in `check` filters the rest (owner 2026-10-11). There is no whole-file option: when a whole file should be redone, the orchestrator tells the agent so, and `check` still reports only the lines the agent changed (owner 2026-10-11). |
| Who runs our rules | **Two sets in `agents-inc.lint.mts`: an agent set and an editor set** (owner 2026-10-10, names `agentRulesets` and `editorRulesets`; `rulesets` is renamed). `check` runs the agent set for sub-agents, on the lines they change. The editor set is what `agents-inc.lint.mts` exports as `eslint` and `oxlint`; a team merges each into its own config, so people's editors show those rules. Humans opt in by importing it; otherwise their editors, CI, scripts, lint configs and suppression comments stay as they were. |
| Editor export | **Owner 2026-10-11, built.** `agents-inc.lint.mts` assigns its config to a const and ends with `export const { eslint, oxlint } = config.editorRulesets`; there is no default export and no other export. `eslint` and `oxlint` are plain values, the editor set's rules for each engine, holding no plugin objects, so importing the file never loads ESLint's plugins (load times: [spec §1](work/spec-agent-editor-sets.md#1-laziness-the-parts-are-plain-data-and-only-the-eslint-merge-entry-loads-plugins)). Each of the team's configs imports a **merge function** from our package (`mergeEslintConfig` from `@agents-inc/lint-rules/eslint`, `mergeOxlintConfig` from `@agents-inc/lint-rules/oxlint`; names mine, owner: "call it whatever you like") that takes the team's config, ours, and the path of the team's config for the other engine (owner 2026-10-14), and returns one config with no duplicates. It registers the plugins, building one merged plugin object for a prefix both register (the team's object as the base, our rule modules for the rules we run; why reusing the team's object as it is fails: spec §2): adding our config after a team config that uses typescript-eslint or eslint-plugin-react throws `Cannot redefine plugin` (measured). **The team's engine configs override the editor set** (owner 2026-10-14, replacing the per-file split of #32 D4, #41 and O6): a rule the team's ESLint or oxlint config sets anywhere, under any of its names (an alias, an old name, a team prefix such as `ts/`) or its typescript-eslint twin's, is the team's in every file, and both our parts drop it; a rule it sets in neither is ours. The wording: [the team's own configs](#files-init-adds-or-changes). Turning a rule off in `agents-inc.lint.mts` removes only ours (owner 2026-10-11, [questions](work/questions.md) #42). If the project does not use oxlint (read from the `package.json` nearest to `tsconfigRootDir`, not from what is installed: our package brings its own oxlint for `check`; owner 2026-10-11, #32 D1), there is no oxlint part, and the ESLint part takes over each oxlint-run rule ESLint has a version of and that fires there on its fixture, minus a skip list with a reason per rule (`packages/rule-data/data/eslint-fallback-skips.json`). On TS files, typescript-eslint's extension of a core rule it takes over runs in its place (owner, #39). Only the `oxc/*` rules have no ESLint version, since we install the plugins for the rest (`jsx-a11y`, `@vitest`, `react-hooks`, `react-perf`; owner, #30); [the commands](work/spec-owner-answers.md#commands) count them. Editor parts always allow suppression comments; `allowSuppressions` applies to the agent set only (default applied). The specs, with every measurement: [spec-agent-editor-sets](work/spec-agent-editor-sets.md), amended by [spec-owner-answers](work/spec-owner-answers.md) and [spec-merge-model](work/spec-merge-model.md). |
| Runner | **Builds both engine configs itself on every run** from `agents-inc.lint.mts` (owner 2026-10-11): ESLint's through its Node API, oxlint's as a temporary file deleted after the run. It never writes an engine config into the project and never reads the project's. Nothing persists between runs, so restarting Claude changes nothing. The rebuild costs ~30 ms of a ~2 s one-file run ([learnings](work/learnings.md)). |
| Engines and rules the runner uses | **Its own ESLint and oxlint** (owner 2026-10-11), as dependencies of our package, so a project on another ESLint version has no install conflict and the rule list matches the engine versions it was generated from. **Only our rules:** the project's own lint config is never read, because its rules could conflict with ours. To add a rule, a consumer lists it under `rules` in `agents-inc.lint.mts`, which accepts any rule of the engines and plugins we ship. |
| Commands | `init` and `check` (owner 2026-10-11). |
| Install | **`@agents-inc/lint-rules` as a devDependency** (owner 2026-10-11: "a dep is better"). `agents-inc.lint.mts` imports from it, so it is typed with no generated file. See [Considered and dropped](#considered-and-dropped) for `npx` with no install. |
| Canonical rule ID | **The ESLint rule ID.** oxlint does not accept every one in its config: it refuses `n/`, `@vitest/` and `react-refresh/` IDs and renamed rules, so each oxlint-run rule also stores oxlint's own name, and every oxlint config we write uses that. A rule whose ESLint name differs from oxlint's (`unicorn/no-for-each`, oxlint's `unicorn/no-array-for-each`) runs in ESLint, so one suppression comment works in both engines *(slice 1)*. |
| Consumer config | `agents-inc.lint.mts` configures **only the rules we ship**, strictly typed. It is the one file we add. See [What a consumer's repo looks like](#what-a-consumers-repo-looks-like). |
| Unknown IDs | A type error, and also a runtime throw, because types are stripped when the config loads. No "did you mean" suggestion. |
| Engine per rule | Not configurable by consumers; the package routes every rule. If oxlint lacks an option a rule needs, the fix is to move that rule to ESLint in the canonical list. |
| Severity | Every rule ships at `error`. Consumers may set `warn` or `off`. `no-use-before-define` is not shipped (owner 2026-10-10: use hoisting wherever possible), though it was the only guard against a temporal-dead-zone crash that `tsc` misses. |
| Suppression comments | **Banned by default** (owner 2026-10-10). `house/no-suppressions` reports every `eslint-disable*`, `oxlint-disable*` and inline rule-config comment; `@typescript-eslint/ban-ts-comment` reports `@ts-ignore`, `@ts-nocheck` and `@ts-expect-error`. **`allowSuppressions: true`**, top level or in a `fileOverrides` entry, allows them there: the ban is off, ESLint reads inline config again, `@ts-expect-error` passes with a description (`@ts-ignore` and `@ts-nocheck` stay banned), and `unicorn/no-abusive-eslint-disable` is on. While banned, that unicorn rule is off, so a blanket disable is not reported twice. `allowSuppressions` alone sets these three rules, whatever rulesets are listed: `rules` cannot name them. See [Suppression comments](#suppression-comments-measured-2026-10-04). |
| Rulesets | Every rule belongs to exactly one ruleset, except the three rules `allowSuppressions` sets. All rulesets are listed in the consumer's file, in four lists (`quality`, `libs`, `runtimes`, `languages`) per set, and removing one disables it there. No presets, no disable list. See [Rulesets](#rulesets). *Names decided 2026-10-10: these were "packs", with `code` and `tech` lists.* |

## What a consumer's repo looks like

### Files `init` adds or changes

Only these two (owner 2026-10-11). No scripts, no engine config files, no edits to the project's own
configs.

**`package.json`**
```diff
  "devDependencies": {
+   "@agents-inc/lint-rules": "^1.0.0"
  }
```
The package name is a placeholder. **Proposed:** the ESLint plugins we use are ordinary
dependencies of our package, so they never appear in the consumer's `package.json`. `eslint` and
`oxlint` are still peer dependencies; moving them into the package (owner 2026-10-11: "its own")
belongs to `check`'s slice.

**`agents-inc.lint.mts`**, as `init` writes it. This is the only file people normally edit.
```ts
import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  agentRulesets: {
    quality: [
      'correctness',
      'type-safety',
      'security',
      'accessibility',
      'performance',
      'complexity',
      'declarative',
      'immutability',
      'modern-js',
      'redundancy',
      'modules',
      'import-order',
      'naming',
      'comments',
      'ordering',
      'conventions',
      'tests',
    ],
    libs: {
      ui: ['react'],
      testing: ['vitest', 'testing-library', 'storybook'],
      forms: ['react-hook-form'],
      styling: ['css-modules'],
    },
    runtimes: [
      'node',
      'browser',
    ],
    languages: [],   // no JSON, Markdown or CSS rules exist yet
  },

  editorRulesets: {},   // add the rulesets people's editors should show

  ignores: [],

  rules: {},

  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
```

**The team's own configs** change only if the team wants people's editors to show the editor set.
`init` does not touch them. Each imports its part and our merge function:
```js
// the team's eslint.config.mjs
import { mergeEslintConfig } from '@agents-inc/lint-rules/eslint'
import { eslint } from './agents-inc.lint.mts'

export default mergeEslintConfig(theirExistingConfig, eslint, { oxlintConfig: 'oxlint.config.mts' })
```
The team's oxlint config does the same: `export default defineConfig(mergeOxlintConfig(theirs, oxlint, { eslintConfig: 'eslint.config.mjs' }))`.
The third argument is the path of the team's config for the other engine, relative to
`tsconfigRootDir`, or `null` where the project has none; the ESLint merge reads it only where the
project lists oxlint.

> Your engine configs override the editor set. If your `eslint.config.mjs` or `oxlint.config.mts`
> sets a rule anywhere (in any block or override, in a preset you extend, or through an oxlint
> category you write on), the editor set drops that rule from both engines, in every file, and your
> setting decides it. That includes a rule you only turn off, or set for some files. A core rule and
> typescript-eslint's version of it count as one rule. Each merge reads your other engine's config
> from the path you pass it. oxlint's own `correctness: warn`, which runs where your oxlint config
> leaves correctness out, sets no rule: where it would run oxlint's copy of a rule the editor set
> runs in ESLint, the oxlint merge turns that copy off.

The same words are the doc comments of `mergeEslintConfig`, `mergeOxlintConfig` and
`editorRulesets` (owner 2026-10-14: "as long as we make it clear that their config files override
this editor config"). How each merge reads the team's configs: [architecture](architecture.md#reading-the-teams-configs).

The common case: a team that spreads typescript-eslint's `disableTypeChecked`, even on JS files
only, sets each typed rule in it `off`, so those rules and their core twins are the team's in every
file and ours run nowhere. Our typed rules it names, from the repo root:

```sh
node --input-type=module -e "import t from 'typescript-eslint'; import r from './packages/rule-data/data/rules.json' with { type: 'json' }; const ours = new Set(r.map((rule) => rule.id)); console.log(Object.keys(t.configs.disableTypeChecked.rules).filter((id) => ours.has(id)))"
```

The TypeScript files are `.mts`, so the project's `"type"` never matters (owner 2026-10-10).
The oxlint merge writes our part into the team's config itself, not into an `extends` entry,
because `extends` drops `ignorePatterns`, `env`, `globals` and `settings`.

### A customised config

```ts
// agents-inc.lint.mts
const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  agentRulesets: {
    quality: [/* … */ 'comments'],            // 'ordering' deleted: no sorting rules
    libs: {
      ui: ['react'],
      testing: ['vitest', 'testing-library'], // 'storybook' deleted
      forms: ['react-hook-form'],
      styling: ['css-modules'],
    },
    runtimes: ['browser'],                    // 'node' deleted: a client-only app
  },

  editorRulesets: {                           // what people's editors show, if the team merges it
    quality: ['correctness', 'security', 'accessibility'],
    libs: { ui: ['react'] },
    runtimes: ['browser'],
  },

  ignores: ['src/generated/**'],

  rules: {
    'max-lines': ['error', { max: 400 }],                    // ESLint runs it
    'react/no-array-index-key': 'warn',                      // oxlint runs it
    'unicorn/no-null': 'error',                              // off in the base, turned on
    'house/max-hooks-per-component': ['error', { max: 6 }],  // one of our custom rules
  },

  fileOverrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        'max-lines': 'off',
      },
    },
  ],
})

export const { eslint, oxlint } = config.editorRulesets
```

A monorepo with a Node API and a React frontend:

```ts
fileOverrides: [
  { files: ['apps/api/**'], agentRulesets: { runtimes: ['node'], libs: {} } },
  { files: ['apps/web/**'], agentRulesets: { runtimes: ['browser'] } },
]
```

| Key | Type | Effect |
| --- | --- | --- |
| `tsconfigRootDir` | `string` | Needed by the typed rules. The absolute path of an existing folder, checked when the config loads. |
| `agentRulesets` / `editorRulesets`: `.quality` / `.runtimes` / `.languages` | arrays of known ruleset names | The base rules are the listed rulesets' rules plus the rules `allowSuppressions` sets. `runtimes` also sets each engine's globals. |
| `agentRulesets.libs` / `editorRulesets.libs` | domain → array of ruleset names | Same, grouped by domain (`ui`, `testing`, `forms`, `styling`). |
| `ignores` | glob array | In the agent set, oxlint's `ignorePatterns` and ESLint's global ignores. In the editor merges, they keep only our rules out of those files (a default the owner has not confirmed: [spec-owner-answers](work/spec-owner-answers.md) D-a). |
| `allowSuppressions` | `boolean`, default `false` | Whether code may carry suppression comments: see [Decisions](#decisions). In a `fileOverrides` entry it applies to the entry's files and wins over earlier entries; an entry that leaves it out keeps the setting before it. |
| `rules` | canonical ID → `'error' \| 'warn' \| 'off' \| [severity, ...options]` | Applied on top of the rulesets. A rule can be turned on even if its ruleset is removed. The rules `allowSuppressions` sets cannot be named here. |
| `fileOverrides` | `{ files, agentRulesets?, editorRulesets?, allowSuppressions?, rules? }[]` | Applies only to files matching the globs. `rules` has the same shape as the top level. `agentRulesets` / `editorRulesets` (owner 2026-10-10) change which rulesets apply there. A list the entry gives (e.g. `runtimes`) **replaces** the top-level one for those files; a list it leaves out is inherited. The package works out the difference from the top level and emits it per engine: oxlint `overrides` entries and ESLint config objects with `files`. Each sets the dropped rules `off`, turns on the added ones, and sets the runtime's globals. Any globs and any number of entries are allowed. Where globs overlap, the later entry wins for each list it gives; a list it leaves out keeps what earlier entries set for those files, as the engines layer blocks. An entry's `rules` keep each rule's shipped `files` and `ignores`, so softening a rule never widens where it runs. |

Rule IDs and options are the same whichever engine runs the rule, so a consumer never needs to
know the engine.

### Rules we do not ship

`check` runs only our rules. To add one, a consumer lists it under `rules`, which accepts any rule of
the engines and plugins we ship (owner 2026-10-11). In a team's own configs, its other plugins and
rules stay where they are, and the merge function combines them with the editor set.

Engine sections in `agents-inc.lint.mts` were tried and dropped, because they create a second place
to edit rules and invite dumping. Adding a key later breaks nobody, while removing one is a breaking
change.

### Requirements (measured 2026-10-04: oxlint 1.82, ESLint 10.10)

| | Result |
| --- | --- |
| Node 22.23 | `oxlint.config.ts` and `eslint.config.mjs` both imported `agents-inc.lint.ts` with no extra loader (`jiti`). Node 22.23 imports the `.mts` names the same way (measured 2026-10-10). |
| Node 18 | Both fail: oxlint needs Node `^20.19 \|\| >=22.18` for a TypeScript config, and Node 18 cannot import `.ts` or `.mts` (`ERR_UNKNOWN_FILE_EXTENSION`). |
| Node 20 | Untested. It has no built-in type stripping, so ESLint importing a `.mts` file is expected to fail. Hence the 22.18 floor of `engines` in `packages/lint-rules/package.json`. |
| Node 23 | ESLint 10 does not support it (`npm view eslint engines`): installing our package on Node 23.10, npm warns `EBADENGINE` (real run, 2026-10-11). So `engines` leaves it out. |
| `eslint.config.ts` | Needs `jiti` installed, so the consumer's ESLint config stays `.mjs`. |

### Suppression comments (measured 2026-10-04)

**Banned** unless `allowSuppressions` is true (owner 2026-10-10; see [Decisions](#decisions)). ESLint applies a directive before any
rule runs, so `/* eslint-disable */` would switch the ban off for its own file. While the ban is
on, ESLint therefore reads no inline config at all: each directive draws the ban's error plus
ESLint's "has no effect" warning, and `/* global x */` does nothing either (measured, ESLint 10.12).
An engine file may still set `linterOptions.noInlineConfig` either way (owner 2026-10-10).
oxlint has no such guard: it still honours a suppression for its own rules, and ESLint's report of
the comment is what fails the file. The rest of this section applies where `allowSuppressions` is true.

| Behaviour | Measured |
| --- | --- |
| One form works for both engines | oxlint honours `// eslint-disable-next-line <id>`, including `@typescript-eslint/` names. Where the ban is off, consumers write the ESLint form for every rule. |
| Each engine reports the other's suppressions as unused | oxlint flagged an `eslint-disable` for a `sonarjs` rule; ESLint flagged one for an oxlint-run rule. |
| ESLint errors on names it has no plugin for | `Definition for rule '…' was not found`, e.g. for `oxc/*`. |

**Consequences for the package:** both engines' `reportUnusedDisableDirectives` is set off, and,
where the ban is off, the runner does the unused-suppression check itself, because it knows which
engine owns each rule.
ESLint gets a do-nothing stub rule for each oxlint-run name it lacks, so its suppression loads: in a
stub plugin under a prefix no plugin registers, or in a copy of our plugin under its prefix
(`react/no-clone-element`). In a team's config, the stubs go into the merged plugin object for that
prefix, so a suppression of an oxlint-only name loads there too.

## Rulesets

Every rule has exactly one `ruleset` field in the canonical list, except the two suppression bans,
which carry `alwaysOn: true` instead (owner 2026-10-10). The three rules `allowSuppressions` sets
also carry `whenSuppressions`, their setting in each mode, which replaces both in the generated
routing, so no ruleset turns them on. *Names decided by the owner
2026-10-10: "rulesets" (was "packs"), `quality` (was `code`), `libs` (was `tech`), and `runtimes`
was added.* The list of rulesets, in the order a consumer lists them, is
`packages/rule-data/data/ruleset-definitions.json`.

| List | Rulesets |
| --- | --- |
| `quality`: what the code should be like | `correctness`, `type-safety`, `security`, `accessibility`, `performance`, `complexity`, `declarative`, `immutability`, `modern-js`, `redundancy`, `modules`, `import-order`, `naming`, `comments`, `ordering`, `conventions`, `tests` |
| `libs`: a dependency or convention the project uses | `react`, `vitest`, `testing-library`, `storybook`, `react-hook-form`, `css-modules` |
| `runtimes`: where the code runs | `node` (`n/*` and a few unicorn rules), `browser` (DOM rules filed under unicorn, e.g. `prefer-dom-node-append`, `require-post-message-target-origin`) |

- **The test for a `libs` ruleset:** it must be meaningless without that dependency. That makes
  accessibility a `quality` ruleset, since it applies to any JSX. "Libs" is loose on purpose:
  Vitest and Storybook are tools, and CSS Modules is a convention.
- **`runtimes` also sets globals.** The gate hard-codes `env: { browser: true, node: true }`. With
  `runtimes`, a Node-only project rejects `window` in JS files, and a client-only one rejects
  `process`. `no-undef` ships with TS files in its `ignores`, so there TypeScript's `lib` and `types`
  own this.
- **`libs` is grouped by domain** (owner 2026-10-10), so the list stays scannable as it grows: `ui: [react]`, `testing: [vitest, testing-library, storybook]`, `forms: [react-hook-form]`, `styling: [css-modules]`.
- **A fourth list, `languages`** (owner 2026-10-10), for rules about non-JS file types: `json`, `markdown`, `css`. JS and TS are always linted and are not in the list. oxlint lints only JS/TS, so every `languages` rule routes to ESLint (`@eslint/json`, `@eslint/markdown`, `eslint-plugin-package-json`). Today there are **no** such rules, so the list would be empty. The value is in checks a formatter never does: duplicate JSON keys, invalid `package.json` version ranges, skipped heading levels, and linting TS inside Markdown code blocks. Prettier or oxfmt still formats these files either way; we do not ship a formatter.
- **Only runtimes that have rules exist.** `bun`, `deno`, `workers` and `edge` have no rules in our
  set. They would only switch globals, so they wait until someone needs them.
- **Regex has no ruleset.** Its rules are spread across the `quality` rulesets by what they guard
  against: ReDoS goes to `security`, empty groups to `redundancy`.
- **JSX has no ruleset either** (owner 2026-10-10). JSX-syntax and HTML rules go to `quality`
  rulesets by purpose, since some fire in JSX with no React (Hono); `react` keeps what depends on React.
- **A rule belongs in a `libs` or `runtimes` ruleset only if it is specific to that technology.** A rule that merely
  fires in components goes in `quality`. **Security wins** (owner 2026-10-10): a security rule goes
  to `security` even when it is specific to a lib or runtime, so dropping a runtime never drops a
  security rule.
- **A ruleset added in a later release is off for existing consumers** until they add it to their
  list. That is safe, but they need to be told: `init --check` or the runner should point out
  rulesets that exist but are not listed.
- **Each rule's ruleset:** see [Ruleset assignment](#ruleset-assignment).
- **Rulesets must combine without conflicts:** no two rulesets' autofixes may undo each other.
  Running `lint_fixpoint_audit.py` on the full set, and on each one-ruleset-removed variant, finds
  autofix loops between rulesets. It misses conflicts inside a ruleset and between rules without
  autofix.

## Ruleset assignment

The canonical list, `packages/rule-data/data/rules.json`, gives every rule we ship a `ruleset` (or
`alwaysOn: true`) and an `assignment`: `confidence`, an optional `alternative` and `note`, and
`by`, which records how it was assigned. *(slice 1: the draft `packages/rule-data/rulesets.json` was folded into it and deleted.)*

- **`by: plugin`:** assigned by plugin: react, @eslint-react, react-perf,
  react-you-might-not-need-an-effect, jsx-a11y, n, vitest, testing-library, storybook,
  react-hook-form, css-modules.
- **`by: agent-A` to `agent-D`:** four sub-agents, each with one batch of plugins, reading each
  rule's description and, where unclear, its docs or source.
- **`by: critique-r1`:** moved by the owner's answers to the first ruleset critique (below).
- **Tie-break used:** a technology-specific rule goes to its lib or runtime, unless it is a security
  rule. Otherwise the rule's primary purpose decides.
- **`confidence: low`** marks close calls between neighbouring rulesets (correctness/redundancy for
  regex, complexity/redundancy for readability). Unless the owner reviews them, the first pick stands.
- **Only enabled rules carry a ruleset.** Rules that ship off belong to none; a user can still turn
  one on in `rules`.

Counts, from the repo root:

```sh
jq -r '.[].ruleset' packages/rule-data/data/rules.json | sort | uniq -c | sort -rn     # per ruleset
jq -r '.[].assignment.by' packages/rule-data/data/rules.json | sort | uniq -c          # by how assigned
jq '[.[] | select(.assignment.confidence == "low")] | length' packages/rule-data/data/rules.json
```

**Owner answers, 2026-10-10.**

1. New `quality` rulesets: `performance`, `conventions` (proposed as "consistency"), and `tests`
   (runner-agnostic test rules, in `quality`, not `libs`).
2. Split out: `immutability` (from `declarative`) and `import-order` (from `ordering`). Not split:
   `limits`, `react-perf`.
3. Security beats a lib or runtime. JSX gets no ruleset. Storybook goes in `libs.testing`.
4. Overlapping and conflicting rules (measured): `house/no-classic-loops` bans classic loops and
   allows `for…of`, replacing `functional/no-loop-statements`, which also banned the `for…of` that
   `unicorn/no-for-each` asks for. `perfectionist/sort-union-types` puts object types, then `null`
   and `undefined`, last, replacing `unicorn/prefer-type-literal-last`, whose autofix looped with it.
   Dropped as covered by another rule: `house/prefer-arrow-callbacks` (core `prefer-arrow-callback`),
   `no-eq-null` (`eqeqeq`), `oxc/approx-constant` (`unicorn/prefer-math-constants`). Kept:
   `react-hooks/hooks` and `react-hooks/rules-of-hooks`, since each catches cases the other misses,
   and `react-hooks/rule-suppression`.

## Rules under consideration

Owner 2026-10-10: the considering list is `packages/rule-data/data/rule-candidates.json`. Each
entry is a rule we might ship, with its status (`considering`, `recommended`, `parked` or
`needs-owner`), the reason, where the evidence is, and the date recorded. A rule is in one state at
a time: shipped (`rules.json`), considered (this list), or neither; `rule-candidates.test.ts` checks
it. The first sweep is [rule candidates r1](work/rule-candidates-r1.md). From it, the owner shipped
`no-unreachable-loop` (`correctness`, oxlint).

## Routing: the canonical list

One entry per rule we ship, in `packages/rule-data/data/rules.json`, sorted by ID. With the
installed engines, it is the source of truth for both generated configs:

```jsonc
{
  "id": "@typescript-eslint/no-explicit-any",
  "ruleset": "type-safety",
  "engine": "oxlint",
  "oxlintName": "typescript/no-explicit-any",   // present exactly when oxlint runs the rule
  "options": [],
  "typed": false,
  // optional "files" and "ignores": max-lines runs on JSX files only, skipping tests and stories
  "assignment": { "confidence": "high", "by": "agent-D" }
}
```

- **Each rule keeps the gate's engine.** `engine` was imported from the gate's live configs, whose
  oxlint half comes from `build_lint_config.py` (categories, `NAMED`, `DEDUPE`). Exceptions: a rule
  whose ESLint name differs from oxlint's runs in ESLint *(slice 1)*, and so does one whose oxlint
  version is measurably worse (next bullet).
- **Where oxlint's version is measurably worse, ESLint runs the rule** (owner 2026-10-14), instead
  of the merges handling it: oxlint misses a finding or reports a false one that ESLint's version
  does not, or refuses or ignores an option ESLint's version takes ([spec](work/spec-merge-model.md)
  §3). The entry's `eslintBecause` holds the reason and the measurement, and
  `canonical-list.test.ts` checks that each such rule runs in ESLint and has an untyped oxlint
  version. The list:
  `jq -r '.[] | select(.eslintBecause) | .id + ": " + .eslintBecause' packages/rule-data/data/rules.json`.
- **No implementation is proven per engine yet** (slice 2). A matching name is not proof
  (CLAUDE.md), and our plugin versions are newer than the gate's (unicorn 77 against 74).
- **A rule we do not ship** is still a `RuleId` a consumer can turn on. It runs on oxlint when
  oxlint has a version that needs no type information, else on ESLint (`defaultEngineOf` in
  `build-routing.ts`).
- **Moving a rule between engines is a data change** (`engine`, and `oxlintName`) and a regenerate,
  with nothing for consumers to do. See [architecture](architecture.md#change-a-rule).

Counts, from the repo root:

```sh
# rules per engine
jq -r '.[] | .engine + (if .typed then " typed" else "" end)' packages/rule-data/data/rules.json | sort | uniq -c
# ESLint-run rules oxlint also has, by whether oxlint's version needs types
jq -r --slurpfile rules packages/rule-data/data/rules.json \
  '[$rules[0][] | select(.engine == "eslint") | .id] as $eslint | .rules[]
   | select(.oxlint != null and (.id | IN($eslint[])))
   | if .oxlint.typeAware then "type-aware in oxlint" else "untyped in oxlint" end' \
  packages/rule-data/src/generated/inventory.json | sort | uniq -c
```

**Where the full list of rule IDs comes from.** The generator
(`bun run --cwd packages/rule-data generate`) reads the versions we ship:

| Source | Read with |
| --- | --- |
| oxlint | `oxlint --rules --format=json`, which gives `scope`, `value`, `type_aware` |
| ESLint core | `builtinRules` from `eslint/use-at-your-own-risk` |
| Our ESLint plugins | each registered plugin's `rules` object (`eslintPlugins` in `packages/rule-data/src/eslint-plugins.ts`) |

It writes `packages/rule-data/src/generated/`: `inventory.json` (every installed rule by canonical
ID, with the engine versions), `routing.json` (every `RuleId` → engine, oxlint name, aliases and
shipped settings), `rule-ids.ts` (the union type behind `rules`) and `ruleset-names.ts`. They are
committed, and `generated-files.test.ts` fails when they differ from what the generator produces now
*(slice 1, as in `~/dev/cli`)*. A union of every `RuleId` is fine for TypeScript.

- **Name mapping.** oxlint groups its rules into 15 scopes (`eslint`, `typescript`, `unicorn`,
  `react`, `jsx_a11y`, `import`, `node`, `nextjs`, `jest`, `vitest`, `jsdoc`, `promise`,
  `react_perf`, `vue`, `oxc`), and these need a hand-kept table to ESLint rule IDs,
  `packages/rule-data/data/oxlint-scopes.json`: `typescript` → `@typescript-eslint`, `jsx_a11y` →
  `jsx-a11y`, `node` → `n`, `nextjs` → `@next/next`, and so on.
  oxlint's `react` scope also holds `react-hooks` and React Compiler rules, so part of the mapping
  is per rule, not per scope. `oxc/*` rules keep their own prefix.
- **The version catch.** The list is tied to the versions we generated it from, so the package
  pins its own oxlint and ESLint (owner 2026-10-11) instead of using the project's.

## Where oxlint's 870 rules stood in the gate

Measured 2026-10-04 with `oxlint --rules --format=json` (oxlint 1.82), against `lint-rules.md`
and the ledger. **Owner 2026-10-05: not triaging these yet; still investigating.** Today's figures:
the commands under [Routing](#routing-the-canonical-list).

| Rules | State |
| --- | --- |
| 278 | Run by oxlint. |
| 109 | Enabled, but ESLint runs them although oxlint has them. 37 are type-aware, and the gate does not run oxlint with `--type-aware`. **The other 72 have no recorded reason** (spot-checked: `rule-triage.json` says only `"error"`), so they are candidates to move to oxlint once each passes its fixture there. |
| 150 | From plugins the gate does not load: jest 60, vue 46, jsdoc 23, nextjs 21. |
| 1 | Rejected in the ledger. |
| 331 | **In no ledger state.** 311 sit in categories the gate switches off wholesale: style 171, restriction 74, pedantic 66. Of the other 20, 13 are set `off` in `oxlint.json` and 7 are nursery, a category the gate does not turn on. `rule_ledger.py --check` misses them because it only checks rules it already knows about. |

Consumers may turn on any of them, so every oxlint rule is a `RuleId` in the catalog. A recorded
state and reason for each rule we do not ship is not built yet.

## Why not run everything in oxlint via `jsPlugins`

Measured 2026-10-04 with oxlint 1.82, ESLint 10.10 and Node 22.23.

| | Result |
| --- | --- |
| Same findings? | **Yes, for untyped rules.** 209 sonarjs/regexp/perfectionist rules on 300 `.ts`/`.tsx` files from `~/dev/cli`: 3,591 findings in both engines, the same count per rule. |
| Faster? | **Barely:** 5.2 s against ESLint's 6.6 s. The rules are still JavaScript; oxlint's 20-40x speed-up comes only from its native rules, which we already use. |
| Typed rules | **Cannot run.** JS plugins get no type information (oxlint docs). Our typed tier has 97 rules. The 39 `@typescript-eslint` ones could move to oxlint's native type-aware mode, which covers 59 of the 61 typed typescript-eslint rules. The other **58** (sonarjs 45, functional 6, @eslint-react 5, unicorn 2) have no oxlint route. |
| Reserved plugin names | `unicorn`, `react`, `promise` and the other names oxlint implements natively must load under an alias, e.g. `unicorn-js`. Suppressions then need the alias: `// eslint-disable-next-line unicorn/no-for-loop` does not suppress in oxlint, and `unicorn-js/no-for-loop` errors in ESLint. That breaks canonical IDs for ~229 rules. |
| Stability | JS plugins are alpha and outside semver, and would carry 700+ blocking rules. |

**Verdict: keep two engines.** Revisit when JS plugins get type information and leave alpha.

## Considered and dropped

| Idea | Why dropped |
| --- | --- |
| Biome as a third engine | ~21% coverage; custom rules would need a GritQL rewrite. |
| oxlint as opt-in | See [Decisions](#decisions). |
| Users choosing the engine per rule | The package routes every rule. |
| "Did you mean" suggestions for unknown IDs | Not needed. Unknown IDs are a type error plus a plain throw. |
| Presets (`essential` / `strict` / full) | Every ruleset is listed by default and users remove what they don't want. |
| A disable list (`disabledGroups`, then `disabledPacks`) | Replaced by the explicit `rulesets` lists: removing an entry is the way to disable a ruleset. |
| Engine sections in `agents-inc.lint.mts` (`eslint`/`oxlint`, then `engineOverrides`, then `rules.eslint`/`rules.oxlint`) | A second place to edit rules, and an invitation to dump things there. Other rules stay in the team's own configs (owner 2026-10-11). |
| Third-party rule lists as user-enabled rulesets | Owner 2026-10-05: not doing this. For the record: **anti-slop** (dmmulroy) is 15 oxlint JS-plugin rules, deliberately not on npm (vendor-only). ultracite bundles it, but has to switch off 3 core rules that otherwise create a fix/break loop. **`@shadcn/lint`** 0.2.0 has 6 Tailwind design-system rules, works in ESLint 9.30+ and oxlint 1.80+, and is mostly useful only with per-project "contracts". A ruleset like either would need a conflict list and an autofix-convergence check. |
| Code-role rulesets (`tests`, `scripts`, `server-components`, …) | Owner 2026-10-10: not needed. `fileOverrides` covers path-based scoping. |
| Target versions (`engines`, `browserslist`) driving rules | Owner 2026-10-10: not needed. |
| Stability tiers (`stable` / `experimental`) | Owner 2026-10-10: not needed. |
| Per-rule tags (`typed`, `autofix`, `fast`, `agent-slop`) | Owner 2026-10-10: not needed. |
| Project kind (`project: 'app' \| 'library' \| 'cli'`) | Owner 2026-10-10: complicates things. It would also have to switch off rules owned by other rulesets (e.g. `no-console` for a CLI). |
| Sub-rulesets (`react/hooks`, `security/secrets`, …) | Owner 2026-10-10: not yet. Revisit if a ruleset gets too big to keep or drop whole; `react` (~150 rules) is the first candidate. |
| `limits` and `react-perf` rulesets | Owner 2026-10-10: not split out. |
| Generated files written at build time | Committed instead, with a staleness test *(slice 1)*, so a data change or an engine upgrade shows in review. |
| Typed linting of the consumer's config files (`allowDefaultProject`) | Made those files a fatal parse error under a tsconfig that includes them. They get every untyped rule and no project service (owner 2026-10-10). |
| `oxlint && eslint .` as the `lint` script | ESLint never ran once oxlint found anything. |
| `lint` scripts and engine config files written into the project (`run-s --continue-on-error lint:oxlint lint:eslint`, `oxlint.config.mts`, `eslint.config.mjs`) | Owner 2026-10-11: agents only. They would put our rules in people's editors, scripts and CI. |
| Our engine configs as project files: renamed files passed with `-c`/`--config`, the project's config including ours behind an environment switch ([consumer-usage design](work/consumer-usage-design.md) C2), or ours layered on the project's config, or settings under a `package.json` key | Owner 2026-10-11: the runner builds the configs itself, so there is nothing for editors or CI to find. |
| Running the package with `npx` and no install | The version is not recorded in the project. `npx` keeps the package in npm's cache, outside `node_modules`, so `agents-inc.lint.mts` cannot import its types: the import is a "Cannot find module" error in editors and the project's typecheck, and the type becomes `any`. The ways round it each cost something: a second, generated types file; the types at the bottom of the config (66 KB, 63 KB of it the rule-name list, roughly 15k tokens for an agent that reads the file, and a line Prettier splits into ~1,860); or a JSON config with a `$schema` URL instead of `.mts`. Owner 2026-10-11: "a dep is better". |
| The lint config in Claude's memory | Memory is text Claude reads; no engine runs it, so nothing is enforced. It lives in one person's home folder on one machine and is not in git. |

## Monorepo layout

Owner 2026-10-10. It mirrors the agents-inc monorepo in `~/dev/cli`: bun workspaces, Turborepo, and
shared `*-config` packages.

```
lint-rules/
  package.json            bun workspaces, private root
  turbo.json
  docs/                   this plan, architecture.md
  packages/
    rule-data/            private: the canonical list and the other hand-edited data, the ESLint
                          plugin registry, and the generator → src/generated/ (committed).
                          Later: fixtures and the false-positive log
    lint-rules/           published as @agents-inc/lint-rules: defineLintRules, mergeEslintConfig,
                          mergeOxlintConfig; later init and the runner. Bundles the private packages.
    eslint-plugin-house/  our custom rules (the house/* rules), registered through rule-data
    typescript-config/    shared configs, as in ~/dev/cli
  apps/
    explorer/             later: browse rules by ruleset, engine, false positives and fixture proof
```

- **Only `@agents-inc/lint-rules` is published.** The other packages are private and bundled into it, so consumers install one thing.
- **`rule-data` is its own package** so the explorer can read the canonical list without depending on the CLI. The explorer can be a static site built from that data, with no server.
- **No `apps/` until there is something to show.** ai-benchmarking's generated `lint-rules.md` and `lint-rules-ledger.md` are effectively the explorer's first version.
- **Publishing:** changesets. A new `error` rule is a major release.
- **The benchmark** consumes a pinned `npm pack` tarball of the published package, replacing ai-benchmarking's hand-assembled `vendor/lint`.

## `init` (proposed)

Not built. Named `init`, with no flags (owner 2026-10-11).

1. Adds the devDependency shown above.
2. Writes `agents-inc.lint.mts`: every ruleset in `agentRulesets` but the opt-in ones, which a comment lists, and none in `editorRulesets`, with a comment saying to add them ([questions](work/questions.md) #30).
3. Gives the lines for the agents' instructions: printed to paste, or written into the agent files (open).
4. Its edits land in the project's diff. The benchmark harness must keep them out of the graded patch.

## The runner

Not built. Named `check`, with no flags (owner 2026-10-11).

- **Each run:** read `agents-inc.lint.mts`, build both configs, run the engines, report, exit. ESLint
  gets its config through the Node API; oxlint, which only reads a file, gets a temporary one that
  the run deletes. The proposed pipeline (fix, format, then typecheck, oxlint and ESLint in parallel):
  [consumer-usage design](work/consumer-usage-design.md), section 3.
- **Input:** none; the changed files and lines come from `git diff`. **Output:** `file:line rule — message`, capped.
- **Exit code:** non-zero on any `error`. **Proposed:** a `warn` is listed separately and does not fail
  the call.
- **Untracked files** count as wholly changed (the gate's `gate.mjs` lists them with
  `git ls-files --others`).
- **What it cannot see without a baseline:** a finding on an untouched line of a changed file, or a
  magnitude rule getting worse (see the baseline comment in `gate.mjs`). `check` has no whole-file option (owner 2026-10-11).
- **Checks unused suppressions itself** where a user has turned the suppression ban off. Neither
  engine can do it reliably (see [Suppression comments](#suppression-comments-measured-2026-10-04)).
- **Appends one log line per call** (time, files, findings, exit) outside the work tree. With no
  hook, this is the only evidence a subagent ran it, and a score without a usage column is not a
  result.

## Does not carry over from the gate

| Gate artefact | Fix |
| --- | --- |
| patch-package patches (`css-modules`, `react-hook-form`) | Replaced by `@eslint/compat`'s `fixupPluginRules`, which our ESLint part applies to `css-modules`, `react-hook-form` and `react` (measured). Consumers never get patches. |
| `eslint-plugin-react` peer range stops at ESLint 9 | A consumer's `npm install` only warns (`ERESOLVE overriding peer dependency`), as does bun. npm warns the same way for `eslint-plugin-jsx-a11y` and `eslint-plugin-react-perf`, which run our rules in projects without oxlint (measured 2026-10-11). |
| `GATE_ROOT` | The runner passes the repo root to ESLint's Node API as `cwd`. |
| Hook files: `state.mjs`, `check-armed.mjs`, `merge-settings.mjs`, `stamp-agent-hooks.sh`, `baseline.mjs` | Not shipped. |
| oxlint `categories` and `reportUnusedDisableDirectives` | Managed by the package and not exposed to consumers. Categories would switch rules on outside the canonical list. |
| TS 5.9 typed tier | A ReactBench workaround (see `lint-gate.md`). Test `oxlint --type-aware` first. |

## Corrections (from 2026-10-10)

| Old | New | Why |
| --- | --- | --- |
| oxlint accepts the ESLint rule ID as-is | It refuses `n/`, `@vitest/`, `react-refresh/` and renamed rules; each oxlint-run rule stores oxlint's name | Probed per rule; `oxlint-spellings.integration.test.ts` checks every oxlint rule |
| The ledger is keyed on ESLint IDs | The gate's ledger and `lint-rules.md` key oxlint-run rules by oxlint names (`typescript/no-explicit-any`) | Read in ai-benchmarking's `docs/lint-rules.md` |
| 278 oxlint / 736 ESLint is the split `rule-triage.json` produces | The oxlint half comes from `build_lint_config.py`; the gate ran 278 oxlint, 639 ESLint untyped, 97 ESLint typed | Joined from the gate's generated configs |
| 110 ESLint-run rules oxlint also has, 73 untyped | 109, of which 72 untyped (bare-name matching gives 112) | Re-derived with a scope-mapped name match |
| oxlint's `extends` drops `jsPlugins` and `options.typeAware` | It keeps them; it drops `ignorePatterns`, `env`, `globals` and `settings` | Measured |
| `eslint-plugin-oxlint` pins `~1.86.0` | Figure removed; it now pins `~1.87.0` | `npm view eslint-plugin-oxlint peerDependencies` |
| `GATE_ROOT` → `basePath` | ESLint's Node API option is `cwd`; `basePath` is a config-object key | ESLint 10.12's types |
| The gate's patches cannot carry over | `fixupPluginRules` replaces them | Measured |
| npm fails with ERESOLVE on ESLint 10 | A consumer's `npm install` of our package only warns | Real run (installing the plugin directly does fail) |
| Stub rules let every oxlint-only suppression load in ESLint | Not under a prefix an extras block registers. First written as "a prefix we register"; ours now get a copy of the plugin with the stubs (`react/no-clone-element`) | `Cannot redefine plugin`; pinned as a known gap in `engines.integration.test.ts` |
| A suppression naming a rule ESLint lacks fails its config load | ESLint loads; that file gets the error `Definition for rule '…' was not found` | Measured with ESLint 10.12's `Linter`: no fatal message |
| `eslint-config-next` as extras is tamed by the last block | It throws: it sets our IDs (`react-hooks/*`) | The one-place rule; see Open |
| `runtimes` makes a Node-only project reject `window` | In JS files only: `no-undef` ignores TS files | Real run |
| The 14 `@eslint-react/dom-*` rules stay in `react` | 6 fire in JSX with no React (Hono), so they went by purpose | Ruleset critique r1 |
| CSS Modules is something in `package.json` | Vite handles `*.module.css` with no package | Vite's `cssModuleRE` |
| The fixpoint audit per removal variant covers what people configure | It misses conflicts inside a ruleset and between rules without autofix | Ruleset critique r1 |
| An implementation is emitted only once its fixture fires | Each rule keeps the gate's engine until per-engine proof (slice 2) | Not built in slice 1 |
| A user can turn either suppression ban off in `rules` | `allowSuppressions` sets both bans and `unicorn/no-abusive-eslint-disable`; `rules` cannot name them | Owner 2026-10-10: one place to control it |
| `oxlint.config.mts` imports `oxlint` before `@agents-inc/lint-rules/oxlint`; the extras example imports `./lint/local-plugin.mjs` before `./agents-inc.lint.mts` | Both reordered | Our `import-x/order` reported both (real run on the built package) |
| The sub-agent passes paths with optional line ranges | `check` reads changed files and lines from `git diff` | Owner 2026-10-11: fewer tokens, faster |
| No `editorRulesets`: agents only, nothing for editors (recorded 2026-10-10) | An agent set and an editor set; the editor set is exported for the team's own configs | The owner proposed both sets on 2026-10-10; "no `editorRulesets`" was my inference, never the owner's |
| The runner runs the project's own oxlint and ESLint and matches the editor and CI; `init` writes `lint` scripts and our engine config files, replacing the project's | Agents only: the runner builds its configs per run; `init` adds the devDependency and `agents-inc.lint.mts`, nothing else | Owner 2026-10-11 |
| Reusing the team's plugin object as it is threw for older plugin versions | Not only older versions: the team's raw eslint-plugin-react crashed under ESLint 10 too | [Spec](work/spec-agent-editor-sets.md) §2's probe |
| A prefix the team registers gets no stubs (the row on stub rules above: a known gap pinned in `engines.integration.test.ts`) | Beside oxlint, the stubs go into the one merged plugin object for that prefix; the known gap is a passing test there | Built 2026-10-11; `pluginsForEveryBlock` in `build-eslint-config.ts` |
| The merge returns a complete config rather than using oxlint's `extends` | Our part goes into the team's config itself; where the team extends configs as objects, the merge may add a first extended config, holding the overrides that keep the team's results as they were | `placedFirstInLine` in `merge-oxlint-config.ts` |
| In the team's configs, our settings win for our rule IDs and every other name of them | Where the team sets one of our rules, under any name, its setting applies in those files; ours elsewhere | Owner 2026-10-11: "theirs should override whenever there is a conflict" (questions.md #32 D4) |
| A rule we turn off in `agents-inc.lint.mts` is off in the team's configs too, under every name | Only ours is removed | Owner 2026-10-11, #42 reversed |
| Our `ignores` are global ignores in the team's configs too | In the editor merges they keep only our rules out of those files | Follows from #42 and #44 (spec-owner-answers D-a) |
| Whether a project uses oxlint: each `package.json` from `tsconfigRootDir` up, until one lists it | The nearest `package.json` alone | Owner 2026-10-11, #32 D1 |
| Without oxlint, the `jsx-a11y`, `@vitest`, `react-hooks` and `react-perf` rules have no ESLint version: we do not install those plugins | We install them; only `oxc/*` rules lack an ESLint version | Owner 2026-10-11, #30 |
| Our oxlint peer range is `~1.87.0` (the `eslint-plugin-oxlint` row above) | A caret range, and the oxlint merge refuses an installed oxlint whose schema lacks a rule or plugin name the merge may write | Owner 2026-10-11, #32 Q7: "as large as possible" |
| With one ESLint config, a TS file outside every tsconfig gets a fatal parse error and loses its untyped rules too (Open) | Typed rules leave such files out, so they get every untyped rule | Owner 2026-10-11, #36 (b) |
| The ESLint versions of oxlint's other rules were never fixture-proven (Decisions, oxlint row) | Each shipped oxlint-run rule with an ESLint version fires on its fixture in ESLint, or is on the skip list with its reason | `eslint-fallback.integration.test.ts`, built with #30 |
| Beside oxlint, a rule one of our parts runs is off in the team's config for the other engine, in every file | Only in the files where our part runs it; elsewhere, our `ignores` included, the team's setting stands | The off exists only to stop double reports ([decisions](work/decisions.md), the build `wf_ec970377-570` review) |
| Node `>=22.18` (Requirements) | Node 23 left out (`engines`) | ESLint 10 does not support Node 23 ([decisions](work/decisions.md), same review) |
| Where the team sets one of our rules, its setting applies in those files; ours elsewhere | Where the team's ESLint or oxlint config sets it anywhere, it is the team's in every file, and both our parts drop it | Owner 2026-10-14 |
| Beside oxlint, a rule one of our parts runs is off in the team's config for the other engine where our part runs it (O6); a typescript-eslint twin in the team's config is off where ours runs (#41) | No merge turns a statement of the team's off | Owner 2026-10-14: a rule is the team's or ours, never both |
| A team oxlint category does not count as the team setting a rule ([spec-owner-answers](work/spec-owner-answers.md) O4) | A category the team's config writes on counts; oxlint's own default `correctness: warn` does not, and the oxlint merge turns off its copies of the rules our ESLint part runs | Owner 2026-10-14, and his answer to [spec](work/spec-merge-model.md) §6 point 1 |
| A team statement under a prefix both register (antfu's `react`), of a name our blocks state, is deleted (Q-F) | It counts as setting the rule of each plugin; no statement of the team's is deleted | Follows from the owner's model ([spec](work/spec-merge-model.md) call C1, a card on the questions page) |
| 7 oxlint rules are nursery, which categories never enable | A `nursery` category turned on runs them | Measured, oxlint 1.87 (`no-unreachable-loop`) |

## Open

- Which engine runs the typed rules: test `oxlint --type-aware` first.
- ESLint runs some rules oxlint also has (command under [Routing](#routing-the-canonical-list)): move the untyped ones without an `eslintBecause` once each passes its fixture on oxlint.
- Per-rule, per-engine fixture proof (slice 2), including plugin majors newer than the gate's.
- Rules turned on through `rules` that no fixture proves: allowed by default.
- Ruleset critique round 2: ambiguous assignments, and conflicts between enabled rules ([critique r1](work/ruleset-critique-r1.md), sections 4 and 5), and shipped rules that report one finding twice ([questions](work/questions.md) #35; also oxlint's `no-global-assign` and `no-implicit-globals` on one write to a read-only global).
- import-x does not resolve TypeScript imports in ESLint ([questions](work/questions.md) #33): the import-x rules ESLint runs miss or misread TS imports, and the ones oxlint runs go silent in a project without oxlint. The owner chose fix C, the TypeScript resolver; not built yet.
- Later (owner): a category for the newest language features, enabled by Node version ([decisions](work/decisions.md), third sweep).
- Later (owner 2026-10-14): go over the tests and remove duplication, so they are DRY. Each tester added its own helpers; those in `packages/lint-rules/src/__tests__` that set up a project and run the engines overlap (`setUpEngineRun`, `setUpBothEnginesRuns`, `setUpCorpusRuns`, `setUpConsumerCliRuns`, `setUpMergedAndTeamAloneCliRuns`, …).
- house rule defect: `no-section-banner`'s autofix joins the tokens around a one-line banner with no space beside it (`typeof/*----*/b` becomes `typeofb`).
- ESLint merge defect: a team block whose `basePath` lies outside the project is read as reaching no file, though ESLint applies it to the project's files (measured); to fix in the next round ([decisions](work/decisions.md), 2026-10-13).
- The editor set inside a team's existing lint configs, owner calls in [questions](work/questions.md):
  - The defaults the owner-answers build applied, such as our `ignores` keeping only our rules out in the editor merges: [questions](work/questions.md), "Defaults applied, not confirmed by the owner".
  - #34: editors need Node 22.18 or later to import `agents-inc.lint.mts`, and a team on `.oxlintrc.json` must move to a TS oxlint config (not measured).
  - A TS file created after the editor's ESLint loaded its config is a fatal parse error until the config is re-read; closing it needs a function in ESLint `files`, an open question ([spec-owner-answers](work/spec-owner-answers.md) O7).
  - #60, #61: where a consumer's `rules` name only typescript-eslint's version of a rule, it runs on JS files too if no ruleset has the plain rule (#60); if a ruleset limits the plain rule to some files, the JS files outside that limit get neither (#61).
  - #62: our `ignores` mean different files in the two engines (`legacy/` matches at any depth in oxlint, at the root in ESLint; `./src/a.ts` leaves out nothing in oxlint); meanwhile each engine reads them its own way.
  - #64: a consumer's own option that oxlint refuses for a rule it runs makes oxlint reject the whole config and lint nothing, in the agent build and the editor merges.
  - #74: a wrong option in `rules` is not traced to `agents-inc.lint.mts`: ESLint shows its own error, and only once a file the rule covers exists; for an oxlint rule, oxlint lints nothing.
  - #66: in a monorepo, oxlint run from the root refuses a merged config inside a package and lints nothing, because our oxlint merge writes `options.reportUnusedDisableDirectives`, which oxlint allows only in the root config.
  - #68: where the team's config gives a JS file no globals, our runtimes' globals apply (#47), so the team's `no-undef` stops reporting `window` in a Node file.
  - #72: in a monorepo, a package with its own config and no oxlint gets each oxlint-run problem twice when both engines run from the root.
  - Limits of reading the team's configs ([spec](work/spec-merge-model.md) §1.2, §1.3): neither merge sees blocks an `eslint.config.mjs` adds outside the config it passes to `mergeEslintConfig`, `--type-aware` on oxlint's command line, or rules set in inline config comments; where the team's oxlint config writes a category on and lists a plugin only in an override, under a root listing no plugin, oxlint runs the category's rules of that plugin in no file, yet they are the team's, so nobody reports them; an ESLint config the oxlint merge takes from a default export (no merge of ours called) is read without our plugins, so a prefix it registers one of ours under goes unrecognised; a config read this way cannot use top-level await, and a change to it reaches a running editor engine only when that engine restarts; reading `eslint.config.mjs` loads our ESLint entry and its plugins on every oxlint start (accepted, owner 2026-10-14).
  - The oxlint merge turns oxlint's default `correctness` copies of the rules our ESLint part runs off in every file, so in the files our `ignores` keep our ESLint rules out of, neither engine reports them. Where the project lists oxlint but oxlint runs without our merge (`oxlintConfig: null`), those default copies report beside ours.
- Node range vs a dependency ([questions](work/questions.md) #59): eslint-plugin-regexp's parser declares a narrower Node range than ours, so npm warns on part of our range.
- Known limit: a project on TypeScript 7 (npm's `latest` since 2026-07-08) cannot use the package until typescript-eslint supports it. npm refuses the install (`ERESOLVE`: our `typescript` peer range is typescript-eslint's, `npm view typescript-eslint peerDependencies`), and with `--legacy-peer-deps` ESLint crashes: "typescript-eslint does not support TS 7.0" (real run, 2026-10-14).
- Raised by real run 3, owner calls ([questions](work/questions.md) #70, #71, #73, #76, #77): oxlint's `no-implicit-globals` reports every top-level `function` and `var` in a CommonJS project; `unicorn/no-top-level-side-effects` reports other tools' config files (`vite.config.ts`); an `eslint.config.cjs` cannot load our ESM-only package, and Node's error does not say so; JS test files get `no-undef` on the test runner's globals (`expect`, `it`, `describe`), which no ruleset sets; committed generated and vendored code (`*.gen.ts`, minified bundles) is linted in full, as our default ignores cover only `node_modules`.
- Raised by fix round 5, owner calls ([questions](work/questions.md) #78, #79):
  - #78: linted from a folder above the package (a monorepo's root), `n/no-unpublished-import` reports as unpublished an import it cannot resolve: an alias in `tsconfig.app.json` or `jsconfig.json`, `$app/…`. Only `settings.n.convertPath` reaches them, and it also hides genuinely unpublished files behind aliases (measured, eslint-plugin-n 18.4.1).
  - #79: oxlint's `no-undef` reports Svelte's `$store` subscriptions (`$count`): oxlint 1.87 takes no `no-undef` option but `typeof`, and a `$*` key in `globals` matches nothing. The alternative, that rule off in `.svelte` files, loses its check of undeclared names.
- Whether a test should install the packed package the way a consumer does ([questions](work/questions.md) #58); until then each real run does it by hand.
- Answered by the owner, not yet built ([questions](work/questions.md) #54–#56, [decisions](work/decisions.md)): eslint-plugin-jsx-a11y-x in place of eslint-plugin-jsx-a11y; without oxlint, `unicorn/no-chained-comparison` and `unicorn/no-double-comparison` in place of two `oxc/*` rules; an oxlint outside our range checked against its own rule list instead of refused; the 8 `modern-js` rules whose autofixes need APIs Node 22 lacks shipped off.
- Raised by the editor-set build ([questions](work/questions.md) #49, #50): a lint or format script for this repo's own code (later, owner); a committed break-a-line check, which belongs to agents-inc ([follow-up](work/follow-up-mutation-check.md)).
- Removing the Stop hook from generated sub-agents ([questions](work/questions.md) #9) is a `~/dev/cli` change and needs a session there.
- A recorded state and reason for each rule we do not ship.
- Renamed rules keep unicorn's current name (`unicorn/no-for-each`, `unicorn/dom-node-dataset`): a default the owner has not confirmed.
- `npm audit` reports high-severity advisories through our dependencies (check-file → micromatch → braces; functional → deepmerge-ts): fix before publishing.
- Packaging problems to fix before publishing ([questions](work/questions.md) #38): a plugin we depend on puts an old ESLint into every consumer's `node_modules`; our package.json has `exports` but no `main` or `types`, so eslint-plugin-import reports our imports unresolved; a team on ESLint 10 that lists eslint-plugin-react itself needs `--legacy-peer-deps`.
- Versioning: a new `error` rule breaks users' CI, so it is a major release. Use changesets.
- A ruleset switched on is a change to the setup under test; on the benchmark it needs its own A/B.
- Suppression ban, owner calls:
  - oxlint has no guard: it honours a suppression for its own rules, and only ESLint's report fails the file.
  - Where `allowSuppressions` is true, a line-form `// eslint-disable` silences every oxlint rule in its file and neither engine reports it: oxlint reads it as a whole-file disable, and ESLint does not treat the line form as a directive, so `unicorn/no-abusive-eslint-disable` never sees it. Where suppressions are banned, `house/no-suppressions` reports it (measured, oxlint 1.87, ESLint 10.12). The owner's answer (#22): `house/no-suppressions` reports it where suppressions are allowed too; not built yet.
  - `ban-ts-comment`'s message for `@ts-ignore` still says to use `@ts-expect-error` instead, which the ban also refuses: typescript-eslint's, which ESLint now runs, as oxlint's did (measured, typescript-eslint 8.71.1).
  - #75 ([questions](work/questions.md)): `allowSuppressions: true` cannot silence a React hooks rule: oxlint's `react(rule-suppression)` still reports the suppression.
