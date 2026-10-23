# Plan

One rule set, published to npm, installable into any project. Drafted 2026-10-04, moved here from
ai-benchmarking (`docs/lint-rules-package.md`) on 2026-10-10. Slice 1 is built: the canonical list
and its generator, the house rules, `defineLintRules` with the agent and editor sets, and the merge
functions `mergeEslintConfig` and `mergeOxlintConfig`
([architecture](architecture.md)), and the `agents-inc-lint` bin with `check` and `init`.

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
| Scope | **The runner reads the changed files and lines from `git diff` itself** (owner 2026-10-11: fewer tokens, faster), so the sub-agent passes no ranges. An untracked file that is not a moved one (q-c7) counts as wholly changed and owns every finding in it. Every changed JS, TS, Vue, Svelte and Astro file in the git repo is checked, another sub-agent's and another package's included, with the one config found from where `check` runs (owner 2026-10-17); the agent instructions say to fix your own code, and nothing in `check` filters the rest (owner 2026-10-11). There is no whole-file option: when a whole file should be redone, the orchestrator tells the agent so, and `check` still reports only the lines the agent changed (owner 2026-10-11). |
| Who runs our rules | **Two sets in `agents-inc.lint.mts`: an agent set and an editor set** (owner 2026-10-10, names `agentRulesets` and `editorRulesets`; `rulesets` is renamed). `check` runs the agent set for sub-agents, on the lines they change. The editor set is what `agents-inc.lint.mts` exports as `eslint` and `oxlint`; a team merges each into its own config, so people's editors show those rules. Humans opt in by importing it; otherwise their editors, CI, scripts, lint configs and suppression comments stay as they were. |
| Editor export | **Owner 2026-10-11, built.** `agents-inc.lint.mts` assigns its config to a const and ends with `export const { eslint, oxlint } = config.editorRulesets`; there is no default export and no other export. `eslint` and `oxlint` are plain values, the editor set's rules for each engine, holding no plugin objects, so importing the file never loads ESLint's plugins (load times: [spec §1](work/spec-agent-editor-sets.md#1-laziness-the-parts-are-plain-data-and-only-the-eslint-merge-entry-loads-plugins)). Each of the team's configs imports a **merge function** from our package (`mergeEslintConfig` from `@agents-inc/lint-rules/eslint`, `mergeOxlintConfig` from `@agents-inc/lint-rules/oxlint`; names mine, owner: "call it whatever you like") that takes the team's config, ours, and the path of the team's config for the other engine (owner 2026-10-14), and returns one config with no duplicates. It registers the plugins, building one merged plugin object for a prefix both register (the team's object as the base, our rule modules for the rules we run; why reusing the team's object as it is fails: spec §2): adding our config after a team config that uses typescript-eslint or eslint-plugin-react throws `Cannot redefine plugin` (measured). **The team's engine configs override the editor set** (owner 2026-10-14, replacing the per-file split of #32 D4, #41 and O6): a rule the team's ESLint or oxlint config sets anywhere, under any of its names (an alias, an old name, a team prefix such as `ts/`) or its typescript-eslint twin's, is the team's in every file, and both our parts drop it; a rule it sets in neither is ours. The wording: [the team's own configs](#files-init-adds-or-changes). Turning a rule off in `agents-inc.lint.mts` removes only ours (owner 2026-10-11, [questions](work/questions.md) #42). If the project does not use oxlint (read from the `package.json` nearest to `tsconfigRootDir`, not from what is installed: our package brings its own oxlint for `check`; owner 2026-10-11, #32 D1), there is no oxlint part, and the ESLint part takes over each oxlint-run rule ESLint has a version of and that fires there on its fixture, minus a skip list with a reason per rule (`packages/rule-data/data/eslint-fallback-skips.json`). On TS files, typescript-eslint's extension of a core rule it takes over runs in its place (owner, #39). Only the `oxc/*` rules have no ESLint version, since we install the plugins for the rest (`jsx-a11y`, `@vitest`, `react-hooks`, `react-perf`; owner, #30); [the commands](work/spec-owner-answers.md#commands) count them. Where one has a stand-in (`packages/rule-data/data/eslint-stand-ins.json`), the ESLint part runs the stand-in in its place (owner 2026-10-14, #55). Editor parts always allow suppression comments; `allowSuppressions` applies to the agent set only (default applied). The specs, with every measurement: [spec-agent-editor-sets](work/spec-agent-editor-sets.md), amended by [spec-owner-answers](work/spec-owner-answers.md) and [spec-merge-model](work/spec-merge-model.md). |
| Runner | **Builds both engine configs itself on every run** from `agents-inc.lint.mts` (owner 2026-10-11): ESLint's through its Node API, oxlint's as a temporary file in the git top level, deleted after the run (owner, my-check-temp-config); each glob tied to a folder gets the config's folder in front, so it keeps meaning that folder (owner 2026-10-17). It never reads the project's engine configs. **It applies the autofixes first, then lints, and reports what is left** (owner, q-c11): only on the changed lines, dropping a fix that would change a line nobody changed (owner, my-check-fix-changed-lines), and only for rules at `error` (owner, my-check-fix-warnings). Nothing persists between runs, so restarting Claude changes nothing. The rebuild costs ~30 ms a run ([learnings](work/learnings.md)). |
| Engines and rules the runner uses | **Its own ESLint and oxlint** (owner 2026-10-11), as dependencies of our package, so a project on another ESLint version has no install conflict and the rule list matches the engine versions it was generated from. **Only our rules:** the project's own lint config is never read, because its rules could conflict with ours. To add a rule, a consumer lists it under `rules` in `agents-inc.lint.mts`, which accepts any rule of the engines and plugins we ship. |
| Commands | `init` and `check` (owner 2026-10-11). |
| Install | **`@agents-inc/lint-rules` as a devDependency** (owner 2026-10-11: "a dep is better"). `agents-inc.lint.mts` imports from it, so it is typed with no generated file. See [Considered and dropped](#considered-and-dropped) for `npx` with no install. |
| Canonical rule ID | **The ESLint rule ID.** oxlint does not accept every one in its config: it refuses `n/`, `@vitest/` and `react-refresh/` IDs and renamed rules, so each oxlint-run rule also stores oxlint's own name, and every oxlint config we write uses that. A rule whose ESLint name differs from oxlint's (`unicorn/no-for-each`, oxlint's `unicorn/no-array-for-each`) runs in oxlint like the rest (owner 2026-10-14). |
| Consumer config | `agents-inc.lint.mts` configures **only the rules we ship**, strictly typed. It is the one file we add. See [What a consumer's repo looks like](#what-a-consumers-repo-looks-like). |
| Unknown IDs | A type error; an untyped config naming one stops at the catalog look-up, which names no file. No "did you mean" suggestion. |
| Engine per rule | Not configurable by consumers; the package routes every rule. If oxlint lacks an option a rule needs, the fix is to move that rule to ESLint in the canonical list. |
| Severity | Every rule ships at `error`. Consumers may set `warn` or `off`. `no-use-before-define` is not shipped (owner 2026-10-10: use hoisting wherever possible), though it was the only guard against a temporal-dead-zone crash that `tsc` misses. |
| Suppression comments | **Banned by default** (owner 2026-10-10). `house/no-suppressions` reports every `eslint-disable*`, `oxlint-disable*` and inline rule-config comment; `@typescript-eslint/ban-ts-comment` reports `@ts-ignore`, `@ts-nocheck` and `@ts-expect-error`. **`allowSuppressions: true`**, top level or in a `fileOverrides` entry, allows them there: the ban is off, ESLint reads inline config again, `@ts-expect-error` passes with a description (`@ts-ignore` and `@ts-nocheck` stay banned), and `unicorn/no-abusive-eslint-disable` and `react-hooks/rule-suppression` are on. While banned, both are off, so a blanket disable or a suppressed hooks rule is not reported twice (owner 2026-10-14). `allowSuppressions` sets these four rules, whatever rulesets are listed. The types refuse them in `rules`, though not in every shape, and an entry's `rules` naming one sets it in the entry's files, which the owner accepts (2026-10-20; [Open](#open), "Written limit of the config's types"). While banned, `@ts-expect-error` with a description passes in test and type-test files (`*.test.*`, `*.spec.*`, `*.{test,spec}-d.*`, `__tests__/`), every other suppression staying banned there (owner, q-dogfood-ts-expect-error-tests); an entry's `rules` naming the rule undo it there, unless the entry also sets `allowSuppressions: false`. A suppressed React hooks rule is reported even where suppressions are allowed, because suppressing one switches React Compiler off for the component (owner 2026-10-14, #75). See [Suppression comments](#suppression-comments-measured-2026-10-04). |
| Rulesets | Every rule belongs to exactly one ruleset, except the four rules `allowSuppressions` sets. All rulesets but the opt-in ones are listed in the consumer's file, in four lists (`quality`, `libs`, `runtimes`, `languages`) per set, and removing one disables it there. No presets, no disable list. `import-order` and `ordering` are opt-in, since they sort code (owner 2026-10-15: a new repo gets bombarded with sorting reports). See [Rulesets](#rulesets). *Names decided 2026-10-10: these were "packs", with `code` and `tech` lists.* |

## What a consumer's repo looks like

### Files `init` adds or changes

Only these two (owner 2026-10-11). No scripts, no engine config files, no edits to the project's own
configs.

**`package.json`**
```diff
  "devDependencies": {
+   "@agents-inc/lint-rules": "^<our version>"
  }
```
`init` keeps an existing `dependencies` or `devDependencies` entry as it is (q-i4), and edits the
text, so the file's layout stays as it was.
The package name is a placeholder. The ESLint plugins we use are ordinary
dependencies of our package, so they never appear in the consumer's `package.json`.

**`agents-inc.lint.mts`**, as `init` writes it. This is the only file people normally edit. An
opt-in ruleset is not listed, only named in a comment above its list; one that sorts code is named
again, with a warning that it conflicts with a formatter that sorts the same code. The
`ignores` are the gate's list and common generated files and folders (q-i7, q77,
q-dogfood-generated-folder-ignore), there for a team to see and remove. Its first line gives
TypeScript 6 the type of `import.meta.dirname` wherever `@types/node` is installed
(q-typescript-6-node-types).
```ts
/// <reference types="node" />
import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
  tsconfigRootDir: import.meta.dirname,

  // What `check` runs on the lines sub-agents change.
  agentRulesets: {
    // Opt-in, so not listed: 'import-order', 'ordering'
    // 'import-order', 'ordering': each sorts code, so it conflicts with a formatter that sorts the same code (Biome, oxfmt's sortImports, a Prettier sort plugin): use one or the other.
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
      'naming',
      'comments',
      'conventions',
      'tests',
    ],
    libs: {
      ui: ['react', 'nextjs', 'react-ssr'],
      testing: ['vitest', 'testing-library', 'storybook', 'playwright', 'jest-dom'],
      forms: ['react-hook-form'],
      // Opt-in, so not listed: 'tailwind'
      styling: ['css-modules', 'class-names'],
      data: ['tanstack-query', 'drizzle'],
      routing: ['tanstack-router'],
      validation: ['zod'],
      auth: ['jsonwebtoken'],
    },
    // Opt-in, so not listed: 'browser-targets'
    runtimes: [
      'node',
      'browser',
    ],
    languages: [],
  },

  // What people's editors show once your team merges it into its own lint configs: add rulesets here.
  editorRulesets: {
    quality: [],
    libs: {},
    runtimes: [],
    languages: [],
  },

  ignores: [
    '**/build/**',
    '**/coverage/**',
    '**/dist/**',
    '**/.next/**',
    '**/.yarn/**',
    '**/generated/**',
    '**/__generated__/**',
    '**/*.d.ts',
    '**/*.gen.*',
    '**/*.min.js',
    '**/mockServiceWorker.js',
  ],

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
    quality: [/* … */ 'comments'],
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
| `agentRulesets` / `editorRulesets`: `.quality` / `.runtimes` / `.languages` | arrays of known ruleset names | The base rules are the listed rulesets' rules plus the rules `allowSuppressions` sets. `runtimes` also sets each engine's globals; in the editor merges, only where our `no-undef` runs (owner 2026-10-14, #68). |
| `agentRulesets.libs` / `editorRulesets.libs` | domain → array of ruleset names | Same, grouped by domain. |
| `ignores` | glob array | Each value means what it would as a .gitignore line, in both engines (q62): with no slash, or only a trailing one, it holds in any folder (`legacy/` is every `legacy` folder); a leading `./` or `/` anchors it at the project root; any other slash anchors it as written. In the agent set, oxlint's `ignorePatterns` and ESLint's global ignores. In the editor merges, they keep only our rules out of those files (owner, my-da). |
| `allowSuppressions` | `boolean`, default `false` | Whether code may carry suppression comments: see [Decisions](#decisions). In a `fileOverrides` entry it applies to the entry's files and wins over earlier entries; an entry that leaves it out keeps the setting before it. |
| `rules` | canonical ID → `'error' \| 'warn' \| 'off' \| [severity, ...options]` | Applied on top of the rulesets. A rule can be turned on even if its ruleset is removed. The types refuse the rules `allowSuppressions` sets here, though not in every shape ([Open](#open), "Written limit of the config's types"). |
| `fileOverrides` | `{ files, agentRulesets?, editorRulesets?, allowSuppressions?, rules? }[]` | Applies only to files matching the globs. `rules` has the same shape as the top level. `agentRulesets` / `editorRulesets` (owner 2026-10-10) change which rulesets apply there. A list the entry gives (e.g. `runtimes`) **replaces** the top-level one for those files; a list it leaves out is inherited. The package works out the difference from the top level and emits it per engine: oxlint `overrides` entries and ESLint config objects with `files`. Each sets the dropped rules `off`, turns on the added ones, and sets the runtime's globals. Any number of entries are allowed; each `files` names at least one glob, none led by `/`, a type error only (nothing checks it once types are stripped). A `/`-led glob after another in its list is reported on the entry's `files` key, not at the glob, the advice to write it from `./` ending the message. Where globs overlap, the later entry wins for each list it gives; a list it leaves out keeps what earlier entries set for those files, as the engines layer blocks. An entry's `rules` keep each rule's shipped `files` and `ignores`, so softening a rule never widens where it runs, but for typescript-eslint's version of a rule named in place of the plain rule: it runs in every file of the entry, and without oxlint the plain rule does too on JS files, at that setting (#61). |

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
| ESLint 9 | The editor set only: `mergeEslintConfig` refuses an older ESLint that resolves from `tsconfigRootDir` (owner 2026-10-14). `check` runs its own ESLint and oxlint, whatever the project installs (`packed-install.integration.test.ts`). |
| `eslint.config.ts` | Needs `jiti` installed, so the consumer's ESLint config stays `.mjs`. |
| React | The `react` ruleset expects React 18.3 or later: both engines lint for `18.3.0` whatever the project installs, unless the team's own config sets `settings.react.version` (owner, a4-react-version-fixed-or-looked-up). |
| npm warnings | Beside ESLint 10, `npm install` succeeds with two expected `ERESOLVE overriding peer dependency` warnings, from eslint-plugin-react and eslint-plugin-react-perf, which do not list ESLint 10 yet (owner, q-npm-peer-warnings; `packed-install.integration.test.ts` pins them). |

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
| One form works for both engines | oxlint honours `// eslint-disable-next-line <id>`, including `@typescript-eslint/` names, but a rule it runs under another name only by that name (`unicorn/no-array-for-each`, not our `unicorn/no-for-each`; measured, oxlint 1.87). Where the ban is off, consumers write the ESLint form for every rule. |
| Each engine reports the other's suppressions as unused | oxlint flagged an `eslint-disable` for a `sonarjs` rule; ESLint flagged one for an oxlint-run rule. |
| ESLint errors on names it has no plugin for | `Definition for rule '…' was not found`, e.g. for `oxc/*`. |

**Consequences for the package:** both engines' `reportUnusedDisableDirectives` is off in the
configs we build (the oxlint merge writes none, and oxlint reports none unless asked), and, where the ban is off, `check` reports unused suppressions itself
([the runner](#the-runner)).
ESLint gets a do-nothing stub rule for each oxlint-run name it lacks, so its suppression loads: in a
stub plugin under a prefix no plugin registers, or in a copy of our plugin under its prefix
(`react/no-clone-element`). In a team's config, the stubs go into the merged plugin object for that
prefix, so a suppression of an oxlint-only name loads there too.

## Rulesets

Every rule has exactly one `ruleset` field in the canonical list, except the two suppression bans,
which carry `alwaysOn: true` instead (owner 2026-10-10). The four rules `allowSuppressions` sets
also carry `whenSuppressions`, their setting in each mode, which replaces both in the generated
routing, so no ruleset turns them on. *Names decided by the owner
2026-10-10: "rulesets" (was "packs"), `quality` (was `code`), `libs` (was `tech`), and `runtimes`
was added.* The list of rulesets, in the order a consumer lists them, is
`packages/rule-data/data/ruleset-definitions.json`.

| List | Rulesets |
| --- | --- |
| `quality`: what the code should be like | `correctness`, `type-safety`, `security`, `accessibility`, `performance`, `complexity`, `declarative`, `immutability`, `modern-js`, `redundancy`, `modules`, `import-order`, `naming`, `comments`, `ordering`, `conventions`, `tests` |
| `libs`: a dependency or convention the project uses | `react`, `nextjs`, `react-ssr`, `vitest`, `testing-library`, `storybook`, `playwright`, `jest-dom`, `react-hook-form`, `css-modules`, `class-names`, `tailwind` (opt-in), `tanstack-query`, `drizzle`, `tanstack-router`, `zod`, `jsonwebtoken` |
| `runtimes`: where the code runs | `node` (`n/*` and a few unicorn rules), `browser` (DOM rules filed under unicorn, e.g. `prefer-dom-node-append`, `require-post-message-target-origin`), `browser-targets` (opt-in; it sets no globals: `browser` does) |

- **The test for a `libs` ruleset:** it must be meaningless without that dependency. That makes
  accessibility a `quality` ruleset, since it applies to any JSX. "Libs" is loose on purpose:
  Vitest and Storybook are tools, and CSS Modules is a convention. `class-names` fails the test: its
  rule asks for a class-name helper rather than needing one, and the owner put it under styling
  (2026-10-14).
- **`runtimes` also sets globals.** The gate hard-codes `env: { browser: true, node: true }`. With
  `runtimes`, a Node-only project rejects `window` in JS files, and a client-only one rejects
  `process`. `no-undef` ships with TS files in its `ignores`, so there TypeScript's `lib` and `types`
  own this.
- **`libs` is grouped by domain** (owner 2026-10-10), so the list stays scannable as it grows: `ui: [react]`, `testing: [vitest, testing-library, storybook]`, `forms: [react-hook-form]`, `styling: [css-modules, class-names]`. The owner approved one ruleset per library, grouped by domain, for the libraries still to come (2026-10-14), created empty (owner, read-library-rulesets-created): `ui` gets `nextjs` and `react-ssr`, `testing` `playwright` and `jest-dom`, `styling` `tailwind` (opt-in); new domains `data` (`tanstack-query`, `drizzle`), `routing` (`tanstack-router`), `validation` (`zod`) and `auth` (`jsonwebtoken`); and an opt-in runtime, `browser-targets`.
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
  list. That is safe; nothing points them out for now (owner, q-c17).
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
- **Two shipped rules reporting one problem** (ruleset round 2, owner 2026-10-14): one is dropped, or
  the narrower carries a relation, with the card and why. `coveredBy`: a rule in another ruleset
  reports the same problem, so this one is left out wherever that one is on (the `because` names
  any files the cover skips). `coveredInOxlintBy`: the same, only where oxlint runs both, as ESLint's
  version of the cover reports less (`jsx-a11y/html-has-lang` beside `jsx-a11y/lang`,
  q-html-lang-twice). `splitByTypesWith`: an untyped rule is off where its typed partner runs with
  type information.
  `jq -r '.[] | select(.coveredBy) | "\(.id) <- \(.coveredBy.rule)"' packages/rule-data/data/rules.json`,
  and the same with `splitByTypesWith`.

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

Owner 2026-10-10: the considering list is `packages/rule-data/data/rule-candidates.json`. It holds
every installed rule we do not ship, and candidates from plugins we do not install, each with its
status (`considering`, `recommended`, `parked`, `needs-owner`, `dropped` with the card or decision
behind it, or `not-reviewed`), the reason, where the evidence is, and the date recorded (owner,
my-dropped-rules-unrecorded, a3-why-entries-scope). A rule is shipped (`rules.json`) or listed here,
never both, and an installed rule in neither fails `rule-candidates.test.ts`, which names it. The
first sweep is [rule candidates r1](work/rule-candidates-r1.md). From it, the owner shipped
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
  whose oxlint version is measurably worse runs in ESLint (next bullet), and
  `unicorn/no-abusive-eslint-disable` runs in oxlint, which reports the line-form `// eslint-disable`
  that ESLint does not read (owner 2026-10-14).
- **Where oxlint's version is measurably worse, ESLint runs the rule** (owner 2026-10-14), instead
  of the merges handling it: oxlint misses a finding or reports a false one that ESLint's version
  does not, or refuses or ignores an option ESLint's version takes ([spec](work/spec-merge-model.md)
  §3). So does the untyped rule of a `splitByTypesWith` pair that oxlint has: oxlint cannot tell
  which files have type information, so beside the typed rule its copy would report twice there.
  The entry's `eslintBecause` holds the reason and the measurement, and
  `canonical-list.test.ts` checks that each such rule runs in ESLint and has an untyped oxlint
  version. The list:
  `jq -r '.[] | select(.eslintBecause) | .id + ": " + .eslintBecause' packages/rule-data/data/rules.json`.
- **No implementation is proven per engine yet** (slice 2). A matching name is not proof
  (CLAUDE.md), and our plugin versions are newer than the gate's (unicorn 78 against 74).
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

Consumers may turn on any of them, so every oxlint rule is a `RuleId` in the catalog. Each one we
do not ship has a recorded state and reason ([Rules under consideration](#rules-under-consideration)).

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
| Typed linting of the consumer's config files (`allowDefaultProject`) | Made those files a fatal parse error under a tsconfig that includes them, and, as typescript-eslint sets it up once per ESLint process, in a later package of a monorepo linted from its root (measured 2026-10-15, also with a tsconfig we ship as the default project). They get the typed rules only where a tsconfig takes them in. |
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
                          mergeOxlintConfig, and the agents-inc-lint bin (check, init). Bundles
                          the private packages.
    eslint-plugin-house/  our custom rules (the house/* rules), registered through rule-data
    typescript-config/    shared configs, as in ~/dev/cli
```

- **Only `@agents-inc/lint-rules` is published.** The other packages are private and bundled into it, so consumers install one thing.
- **Publishing:** hand-written changelogs as in `~/dev/cli` ([release](release.md)). A new `error` rule breaks users' CI, so it is a breaking release: a minor bump while the version is 0.x.
- **The benchmark** consumes a pinned `npm pack` tarball of the published package, replacing ai-benchmarking's hand-assembled `vendor/lint`.

## `init`

Built: `agents-inc-lint init`, with no flags (owner 2026-10-11). The spec, with each answer:
[spec-cli](work/spec-cli.md).

1. Writes `agents-inc.lint.mts` and adds the devDependency, as [shown above](#files-init-adds-or-changes),
   both or neither, and changes nothing else. It never runs an install; it prints the command for
   the lockfile it finds (q-i5).
2. Refuses where `agents-inc.lint.mts` exists (exit 1, nothing changed; q-i1) or the folder has no
   usable `package.json` (exit 2; q-i2).
3. Prints the lines to paste into the agents' instructions (q-i3).
4. Outside git, or where git cannot be run, it still writes, and notes that `check` needs git (q-i8,
   my-init-git-missing); without `@types/node` listed it notes that TypeScript types
   `import.meta.dirname` only from it (q-i9).
5. Its edits land in the project's diff. The benchmark harness must keep them out of the graded patch.

## The runner

Built: `agents-inc-lint check`, with no flags (owner 2026-10-11). The spec, with each answer:
[spec-cli](work/spec-cli.md).

- **Each run:** finds the nearest `agents-inc.lint.mts` up to the git top level (q-c6), builds both
  configs, applies the autofixes on the changed lines (oxlint's, then ESLint's), lints, reports,
  exits. No type-check and no formatter yet (q-c12).
- **Input:** none; the changed JS, TS, Vue, Svelte and Astro files of the whole git repo and their
  lines come from git, a file moved with a plain `mv` paired with its old path (q-c7), without writing
  the repository. Other untracked files count as wholly changed; in a repo with no commits, every file
  does (q-c8). The one config found applies to every package, and no other is looked for (owner
  2026-10-17). Vue, Svelte and Astro files get oxlint's fixes and findings alone
  (q-check-framework-files).
- **Fixes:** each engine's fixes in a file are dropped whole where they would delete or modify a line
  nobody changed (spec-cli P1). A rule set to `warn` is listed, not fixed (my-check-fix-warnings). Some
  fixes are never applied, the rule still reporting: the gate's `NO_AUTOFIX`, and (P3)
  `unicorn/prefer-optional-catch-binding`,
  whose fix lets a caught error's `cause` be lost (the list:
  `packages/lint-rules/src/cli/check/withheld-fixes.json`).
- **Output:** `file:line rule — message`, errors then warnings, cut before 8,000 characters with a
  `+N more` line (c5-again), then what could not be checked, then a summary. A `warn` is listed and
  does not fail the run (q-c3). A file deleted or replaced while `check` ran, or one ESLint failed on,
  is listed as `check: not checked: <file> (<why>)`, and an oxlint failure as
  `check: not checked: oxlint's rules (…)`; the rest is still checked (a3-check-skip-and-report).
- **Exit code:** 1 errors left; else 2 where something was not checked or `check` could not run (any
  wrong call too: q-c16); else 0. 130 or 143 when interrupted (q-c2).
- **What it cannot see without a baseline:** a finding on an untouched line of a changed file, or a
  magnitude rule getting worse (see the baseline comment in `gate.mjs`). `check` has no whole-file option (owner 2026-10-11).
- **Reports unused suppressions** where a user has turned the suppression ban off (q-c15): a rule
  an `eslint-disable` comment names is unused where both engines report it unused, since each
  reports the other's names unused, and one an `oxlint-disable` comment names where oxlint does,
  since ESLint never reads that form (see [Suppression comments](#suppression-comments-measured-2026-10-04)).
- **No run log** (owner, c13-again).

## Does not carry over from the gate

| Gate artefact | Fix |
| --- | --- |
| patch-package patches (`css-modules`, `react-hook-form`) | Replaced by `@eslint/compat`'s `fixupPluginRules`, which our ESLint part applies to `css-modules`, `react-hook-form` and `react` (measured). Consumers never get patches. |
| `eslint-plugin-react` peer range stops at ESLint 9 | A consumer's `npm install` only warns (`ERESOLVE overriding peer dependency`), as does bun. npm warns the same way for `eslint-plugin-react-perf`, which runs our rules in projects without oxlint (`packed-install.integration.test.ts` pins the list). |
| `GATE_ROOT` | `check` runs ESLint's Node API with the config's folder as `cwd` for the files in it, and the git top level for the rest; oxlint runs from the git top level. |
| Hook files: `state.mjs`, `check-armed.mjs`, `merge-settings.mjs`, `stamp-agent-hooks.sh`, `baseline.mjs` | Not shipped. |
| oxlint `categories` and `reportUnusedDisableDirectives` | Set by the agent build and not exposed to consumers; the oxlint merge keeps the team's as written. Categories would switch rules on outside the canonical list. |
| TS 5.9 typed tier | A ReactBench workaround (see `lint-gate.md`). Our typed rules run in ESLint, with oxlint's `--type-aware` off (owner, a4-oxlint-type-aware). |

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
| A rule whose ESLint name differs from oxlint's runs in ESLint, so one suppression comment works in both engines *(slice 1)* | It runs in oxlint, which honours a suppression of it only under oxlint's name | Owner 2026-10-14: oxlint's rules run where oxlint is enabled, unless oxlint's version is worse |
| `allowSuppressions` sets both bans and `unicorn/no-abusive-eslint-disable` (an earlier row) | Also `react-hooks/rule-suppression`, off while suppressions are banned | Owner 2026-10-14: one report per suppressed hooks rule |
| Where suppressions are allowed, `house/no-suppressions` is to report a line-form `// eslint-disable` (#22, Open) | oxlint runs `unicorn/no-abusive-eslint-disable`, which reports it; no new house mode | Owner 2026-10-14, replacing #22 |
| The consumer's config files get no typed rule (Considered and dropped: `allowDefaultProject` made them a fatal parse error under a tsconfig that includes them) | Where the type information is ours, `agents-inc.lint.mts` and `oxlint.config.mts` get the typed rules where a tsconfig takes them in ([architecture](architecture.md) step 8) | Owner 2026-10-14 (typed-config-files); not through typescript-eslint's default project, which failed monorepo runs (Considered and dropped) |
| The runner never writes an engine config into the project | `check` writes its temporary oxlint config in the config's folder, where the config's globs resolve | Owner, my-check-temp-config |
| `check` writes its temporary oxlint config in the config's folder (the my-check-temp-config row) | In the git top level, with the config's folder in front of each glob tied to a folder; ESLint runs from the config's folder for the files in it | Owner 2026-10-17 (a4-check-other-packages-one-config): the one config reaches every changed file of the repo. ESLint's folder for those files is the build's call, not the owner's, so their output stays as it was ([decisions](work/decisions.md), correction 2026-10-18) |
| The runner appends one log line per call | No run log | Owner, c13-again |
| The runner checks unused suppressions itself because it knows which engine owns each rule | A name in an `eslint-disable` comment is unused where both engines report it unused; one in an `oxlint-disable` comment, where oxlint does | Each engine reports the other's names unused, so only the engine running the rule can call one used (K-23 spike, [spec-cli](work/spec-cli.md)); ESLint never reads the `oxlint-disable` form |
| `init --check` or the runner should point out rulesets a config does not list | Nothing points them out for now | Owner, q-c17 |
| Any globs are allowed in a `fileOverrides` entry (the `fileOverrides` row) | At least one, none led by `/`, as type errors only | Owner 2026-10-19, a3v-files-empty and a3v-slash-led-override-glob |
| Runtime checks name every config error in `agents-inc.lint.mts` | Type errors only, but for `tsconfigRootDir`'s folder checks | Owner 2026-10-19: "use ts and not a runtime error. if they use mjs it's on them" |
| `rules` cannot name the rules `allowSuppressions` sets (an earlier row) | The types refuse them in `rules`, not in every shape; an entry's `rules` naming one sets it in the entry's files | Owner 2026-10-20 (lint-a5-suppression-ban-shapes): "totally fine to be able to manually switch off the ban" |
| Each merge refuses, as it runs, a part that is not its own and a third argument holding neither a path nor `null` | `mergeOxlintConfig`'s part and third argument are refused by its types only; `mergeEslintConfig` keeps both checks, since by default no type reaches `eslint.config.mjs`, and the oxlint merge keeps its check of paths in `extends` | Owner 2026-10-20 (lint-a5-this-config-only): option 2, "move only what a type fully covers" |
| A later `apps/explorer/` reading the canonical list from `rule-data` (Monorepo layout) | Dropped | Owner 2026-10-11 ([decisions](work/decisions.md), second sweep): "will be removed" |
| Our oxlint peer range is a caret range (an earlier row) | There is no oxlint peer range: ESLint and oxlint are dependencies of ours, pinned to the versions the catalog was generated from; `^1.86.0` is only the range the oxlint merge's refusals advise | Owner 2026-10-11: "its own" (Decisions, the engines row); `package-manifests.test.ts` |
| ESLint 9 is not supported: ESLint 10 or later is required (Requirements) | Only the editor set needs ESLint 10; `check` runs its own ESLint and oxlint beside any | ESLint and oxlint are dependencies of ours (the row above); `packed-install.integration.test.ts` runs `check` beside ESLint 9.34 and oxlint 1.70 |
| `consistent-return` on a switch covering every case of a union is fixed by `default: throw new Error(…)` (Open, q-dogfood-keep-three) | By a `never` default | `default: throw` drops TypeScript's error for a missing case (TS2366); the `never` default keeps one (TS2322). Owner 2026-10-22 |
| A team oxlint statement that oxlint skips, its plugin listed neither at the root nor in the override, does not count as the team setting the rule ([spec-owner-answers](work/spec-owner-answers.md) O5, a default) | It counts, at any severity: both our parts drop the rule, and the line stays skipped, so nothing reports the rule until the team lists the plugin | Owner 2026-10-22 (LD-O5b): "if a rule is skipper in the user's eslint or oxlint config then it overrules our config rule" |
| Where the type information is ours, typed blocks leave out each TS file no tsconfig takes in as a literal path listed when the config loads; no function in ESLint `files` (O7, a default) | Each typed block's `files` ANDs a function asking, as ESLint lints a file, whether a tsconfig takes it in, so a TS file made after the config loaded needs no restart | Owner 2026-10-22 (LD-O7b): "if this is solved using a function do that"; `eslint-function-in-files.test.ts` fails where a later ESLint stops calling it |

## Open

- ESLint runs some rules oxlint also has (command under [Routing](#routing-the-canonical-list)): move the untyped ones without an `eslintBecause` once each passes its fixture on oxlint.
- Per-rule, per-engine fixture proof (slice 2), including plugin majors newer than the gate's.
- Rules turned on through `rules` that no fixture proves: allowed by default.
- Ruleset critique: the ambiguous assignments ([critique r1](work/ruleset-critique-r1.md), section 4). Round 2's double reports and conflicts are settled in the data (owner 2026-10-14), and one pair remains: `unicorn/no-hex-escape`, to drop once `prefer-literal-ascii` is decided.
- Later (owner): a category for the newest language features, enabled by Node version ([decisions](work/decisions.md), third sweep).
- Later (owner, q-c12): look into a type-check and a formatter step for `check`.
- `check` and `init`, written limits ([spec-cli](work/spec-cli.md)):
  - oxlint's fixes in a partly changed file are applied only where all of them touch changed lines alone, since oxlint cannot be told which lines to fix; the same holds for ESLint's fixes in a file.
  - `check` fixes every changed line in the work tree, another agent's included, and two runs fixing one file at once can race (the last write wins).
  - ESLint runs in `check`'s own process and holds it while it works, so `check` stops 0.3 to 3.9 s after a Ctrl+C (16 s on a very busy machine), and a second Ctrl+C does not shorten that; once handled, the second exits at once, without the autofixed line naming the files fixed so far (q-second-ctrl-c). A rule that never returns holds it until it is killed, as typescript-eslint's `no-deprecated` did on a re-export cycle before our parts cut those (`core/re-export-cycles.ts`).
  - Another writer's change to a file while oxlint fixes it, or before `check` reads the file once oxlint ends, cannot be told from oxlint's fix, so a fix that fails its guard writes over it, with exit 0 and no message (q-check-edit-lost-during-oxlint-fix).
  - One set of rulesets for every package. Outside the config's folder, a TS file no tsconfig takes in draws ESLint's parse error, printed at line 0, and no other ESLint finding, and a path alias only another package's tsconfig defines does not resolve for `import-x` (a4-check-other-packages-one-config). Where a changed file lies outside the config's folder and the git top level holds a legacy `.eslintignore`, Node prints ESLint's warning about that file on stderr.
  - A finding oxlint gives at several places counts where any of them changed, so a duplicate key, case or import an agent adds below the code it repeats is reported, and a useless `catch` is reported where only its rethrow's line changed (read-two-place-findings).
  - An enable comment that turns back on nothing (a stray `eslint-enable`) is not reported, though oxlint reports it (my-check-unused-enable-comment). An `oxlint-disable` comment naming a rule only ESLint runs is reported as unused, as suppressing a rule that "reported nothing here", beside that rule's finding (my-check-oxlint-disable-eslint-rule-message).
  - In `.vue`, `.svelte` and `.astro` files: no suppression is banned (the ban is ESLint's), only the `oxlint-disable` form is reported unused where suppressions are allowed, and `guard-for-in`, `@typescript-eslint/no-extraneous-class` and `prefer-const` report nowhere, since the ESLint rules covering them do not lint those files; editors too (q-check-framework-files, my-covered-by-components).
- Raised by the `check` and `init` build, accepted (owner, read-init-ignores, lint-a4-slash-glob-not-first):
  - oxlint never lints a `*.min.js` file, even when nothing ignores it (measured, 1.87), so only ESLint's rules check one.
  - A `files` glob led by `/` after another glob of its list is reported on the entry's `files` key, not at the glob: TypeScript puts an error on a list's element only at a position the tuple type names, and `[glob, ...globs]` names the first alone (measured, TypeScript 6.0.3 and 5.9.3).
- Later (owner 2026-10-14): go over the tests and remove duplication. Partly done: an expressive-TypeScript and DRY pass landed on 2026-10-16 across all packages, covering source and the shared test helpers, with no assertion changed and StrykerJS run over every refactored line. Left: each area's lint clean-up. This repo lints itself through its own three config files, as a team's are written (`npx eslint .` and `npx oxlint` from the root, after `bun run build`).
- The editor set inside a team's existing lint configs:
  - The defaults the owner-answers build applied: [questions](work/questions.md), "Defaults applied, not confirmed by the owner".
  - #34: editors need Node 22.18 or later to import `agents-inc.lint.mts`, and a team on `.oxlintrc.json` must move to a TS oxlint config (not measured).
  - Until the editor's ESLint restarts, a TS file keeps the answer it got when first linted, so a tsconfig edited later to take it in does not bring it our typed rules: ESLint keeps each file's config by path (`getConfigWithStatus` in @eslint/config-array), and `projectFactsOf` each answer. A file first linted after the edit gets them if it was made after the config loaded; one that existed then is asked of each tsconfig as first read (`tsconfigWalkOf`).
  - #60: where a consumer's `rules` name only typescript-eslint's version of a rule, it runs on JS files too if no ruleset has the plain rule.
  - A rule the team sets runs as the team's copy, which our cut of re-export cycles (`core/re-export-cycles.ts`) does not reach: a team on typescript-eslint's `strictTypeChecked` or `all`, which turn `no-deprecated` on, still has its editor ESLint hang for good on a re-export cycle, as before (measured, 8.71.1; `check` never loads the team's config). Left written down (owner, a3v-team-no-deprecated-hang).
  - #62, a written limit: a negated value of our `ignores` taking back a file under a folder another value leaves out (`lib/**` then `!lib/a.js`) keeps it out in ESLint and takes it back in oxlint.
  - #64: a consumer's own option that oxlint refuses for a rule it runs makes oxlint reject the whole config and lint nothing, in the agent build and the editor merges.
  - #74: a wrong option in `rules` is not traced to `agents-inc.lint.mts`: ESLint shows its own error, and only once a file the rule covers exists; for an oxlint rule, oxlint lints nothing.
  - #72: in a monorepo, a package with its own config and no oxlint gets each oxlint-run problem twice when both engines run from the root.
  - Limits of reading the team's configs ([spec](work/spec-merge-model.md) §1.2, §1.3): neither merge sees blocks an `eslint.config.mjs` adds outside the config it passes to `mergeEslintConfig`, `--type-aware` on oxlint's command line, or rules set in inline config comments; where the team's oxlint config writes a category on and lists a plugin only in an override, under a root listing no plugin, oxlint runs the category's rules of that plugin in no file, yet they are the team's, so nobody reports them; an ESLint config the oxlint merge takes from a default export (no merge of ours called) is read without our plugins, so a prefix it registers one of ours under goes unrecognised; a config read this way cannot use top-level await, and a change to it reaches a running editor engine only when that engine restarts; reading `eslint.config.mjs` loads our ESLint entry and its plugins on every oxlint start (accepted, owner 2026-10-14). For a team block whose `basePath` is above the project, an extglob folder part matches no folder, braces expand within one folder part, and a glob naming the project's folder and nothing below it matches no file (my-basepath-glob-limits).
  - The TypeScript import resolver, in a project with no tsconfig, reads the tsconfig of the folder ESLint starts in, and where any tsconfig path holds glob characters it reads every path as a glob, so a tsconfig inside a folder named `[id]` may not be read (not measured; my-resolver-limits).
  - Our runtimes' globals go only where our own `no-undef` runs, so editors miss `window = {}` in a TS file, `setTimeout('code')` in a JS file beside oxlint, and either in a TS file no tsconfig takes in; `check` reports all of them (a3-editor-globals-short).
  - The oxlint merge turns oxlint's default `correctness` copies of the rules our ESLint part runs off in every file, so in the files our `ignores` keep our ESLint rules out of, neither engine reports them. Where the project lists oxlint but oxlint runs without our merge (`oxlintConfig: null`), those default copies report beside ours.
- Known limit (owner, [questions](work/questions.md) #59: the floor stays 22.18): eslint-plugin-regexp's parser declares a narrower Node range than ours, so npm warns on part of our range.
- Known limit: a project on TypeScript 7 (npm's `latest` since 2026-07-08) cannot use the package until typescript-eslint supports it. npm refuses the install (`ERESOLVE`: our `typescript` peer range is typescript-eslint's, `npm view typescript-eslint peerDependencies`), and with `--legacy-peer-deps` ESLint crashes: "typescript-eslint does not support TS 7.0" (real run, 2026-10-14).
- Type-aware rules on `agents-inc.lint.mts` and `oxlint.config.mts` (owner 2026-10-14, typed-config-files; [architecture](architecture.md) step 8):
  - Limits: `eslint.config.mjs` is JS and gets none; where the team gives type information, ours leave both files out; a config file no tsconfig takes in gets none, at `tsconfigRootDir` too (owner, q-config-files-several-projects). `agents-inc.lint.mts` counts as taken in through `oxlint.config.mts`'s import only where the import is written `./agents-inc.lint.mts`, as `init`'s files write it, at the project root (my-config-file-import-detection).
- Raised by fix round 5, a known limit (owner, q78):
  - #78: linted from a folder above the package (a monorepo's root), `n/no-unpublished-import` reports as unpublished an import it cannot resolve: an alias in `tsconfig.app.json` or `jsconfig.json`, `$app/…`. Only `settings.n.convertPath` reaches them, and it also hides genuinely unpublished files behind aliases (measured, eslint-plugin-n 18.4.1).
- Raised by the plugin upgrades (unicorn 78, @eslint-react 5.26.5, jsx-a11y-x), owner calls:
  - A team config registering the original eslint-plugin-jsx-a11y under a prefix other than `jsx-a11y` is no longer read as our plugin, so a rule it sets there and ours both report.
  - @eslint-react 5.26.5 asks for typescript-eslint's packages at `^8.71.2` and we pin 8.71.1, so a second copy installs beside ours: move typescript-eslint to 8.71.2?
- Raised by the editor-set build ([questions](work/questions.md) #49, #50): a format script for this repo's own code (later, owner; it lints itself through its own configs, a3-whole-repo-lint); a committed break-a-line check, which belongs to agents-inc ([follow-up](work/follow-up-mutation-check.md)). Out of date, 2026-10-15: StrykerJS now runs this check in this repo, on the owner's 2026-10-14 call ([mutation testing](work/mutation-testing.md)); how agents-inc ships one to other projects is still open.
- Raised by this repo's own configs (a3-whole-repo-lint): run from the root, oxlint still lints `packages/lint-rules/test-fixtures/consumer-files`, which holds an oxlint config of its own, by that config (a root `ignorePatterns` does not reach a folder with an oxlint config of its own; an ignore file naming it, or `--disable-nested-config`, would), so `npx oxlint` reports its planted `no-debugger`.
- Written limit of the config's types, accepted (owner 2026-10-20: "totally fine to be able to manually switch off the ban"): a value typed `LintRules`, or any part of it (`LintRules['rules']`, a typed `fileOverrides` entry or list), checks a const it holds only on the names both its type and the const's list, and given to `defineLintRules` it hands the call every name, which an entry beside a typed one takes too. So an unknown rule ID or libs domain held in a const beside a known one compiles there, and so does every name and value of a const typed with an index signature (`Record<string, …>`, what `Object.fromEntries` returns), the rules `allowSuppressions` sets included (KNOWN GAP in `define-lint-rules.test-d.ts`). An entry's `rules` held in a const typed `object` or `{}` compiles even given to `defineLintRules` directly. As the config loads: an unknown rule ID stops it at the catalog look-up, which names no file, so `check` and both editor engines stop; an unknown domain's rulesets are on as if listed under a known domain, and an unknown ruleset, under any domain, turns nothing on; a setting that is no rule entry is refused by the engine running the rule, so `check` stops (ESLint) or reports oxlint's rules unchecked (oxlint); a rule `allowSuppressions` sets, named in an entry's `rules`, takes that setting in the entry's files, but for `ban-ts-comment` in the test files of an entry that also sets `allowSuppressions: false`; so `'house/no-suppressions': 'off'` there stops sub-agents' disable comments being reported, and those comments then switch off the rules oxlint runs (ESLint still ignores them), and neither tsc nor `check` says so (at the top level, `allowSuppressions` wins).
- Raised by the merge-call types build, owner call: an `oxlint.config.mts` nobody type-checks gets no error of ours from `mergeOxlintConfig` for a wrong part or third argument (`untyped-oxlint-config.test.ts`). Handed the ESLint part, it builds a config setting none of our rules; handed the object holding both parts, or a string, it stops at "a package.json lists oxlint, yet it does not resolve from undefined: install it", which sends the team to reinstall oxlint; a third argument holding no path stops at a `TypeError`. Leave it, or bring back a check that names the wrong part?
- Raised by this build: on `setUpRunsBeforeTheSuite` (`__tests__/runs-before-the-suite.ts`), an `it.fails` test passes when the suite's setup throws, since the setup's error is thrown inside the test; CLAUDE.md wants only the assertion to throw there.
- Raised by the check for exports nothing imports (knip 6.32.0, which every `bun run typecheck` runs first; [architecture](architecture.md#packages)), a written limit and an owner call: knip counts an exported type as used wherever it appears in the declaration of an export something uses, and has no option to change that, so such a type nothing imports stays exported unreported. The a7 review's fourteen are un-exported. Every export the check passes with no importer, the remaining types among them, from the root: `bunx knip --trace | grep -B1 'no imports found) ✓' | grep -v -e 'no imports found' -e '^--'` (`⎆` marks an export of an entry file). Un-export the remaining types too, or leave them?
- Removing the Stop hook from generated sub-agents ([questions](work/questions.md) #9) is a `~/dev/cli` change and needs a session there.
- `npm audit` reports high-severity advisories through our dependencies (check-file → micromatch → braces; functional → deepmerge-ts): fix before publishing.
- Packaging problems to fix before publishing ([questions](work/questions.md) #38): a plugin we depend on puts an old ESLint into every consumer's `node_modules`; our package.json has `exports` but no `main` or `types`, so eslint-plugin-import reports our imports unresolved; a team on ESLint 10 that lists eslint-plugin-react itself needs `--legacy-peer-deps`.
- A ruleset switched on is a change to the setup under test; on the benchmark it needs its own A/B.
- Beside oxlint, `unicorn/no-for-each` can be suppressed only under oxlint's name, `unicorn/no-array-for-each`, which ESLint lacks and our ESLint parts stub no rule for (stubs cover rule IDs): ESLint reports `Definition for rule 'unicorn/no-array-for-each' was not found` on the comment (measured, ESLint 10.12, eslint-plugin-unicorn 77).
- Suppression ban, owner calls:
  - oxlint has no guard: it honours a suppression for its own rules, and only ESLint's report fails the file.
  - `ban-ts-comment`'s message for `@ts-ignore` still says to use `@ts-expect-error` instead, which the ban also refuses outside test files: typescript-eslint's, which ESLint now runs, as oxlint's did (measured, typescript-eslint 8.71.1).
- Accepted, written down: three rules report correct code here, each with a rewrite that passes (q-dogfood-keep-three): `@typescript-eslint/consistent-return` on a `switch` returning in every case of a union, fixed by a `never` default, `default: { const unhandled: never = x; return unhandled }`, so a missing case stays a type error (owner 2026-10-22); `@typescript-eslint/no-generated-empty-object-type` on `<V extends NonNullable<unknown>>`, fixed by a named union of the non-nullish types; `unicorn/no-non-function-verb-prefix` on a value named like `setByTheTeam`, fixed by a rename. And `functional/immutable-data` reports the mutation ESLint's rule API needs (a visitor's stack, `RuleTester.afterAll = afterAll`), so a team writing ESLint rules turns it off for those files in `fileOverrides` (q-dogfood-required-mutation).
