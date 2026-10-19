# Spec: answers 3 (every owner answer not built yet, 2026-10-17)

Sources: `<session>/scratch-backup/answers-3/readings.md`, the card texts in
`remaining-questions/items.json`, the raw answers in `questions-page/answers/db-2026-10-17b/`, the
earlier stores (`owner-answers-2026-10-14.json`, `remaining-page-answers-2026-10-14.json`,
`db-2026-10-15/`, `db-2026-10-16/`), `answers-audit/audit.json`, and the queue in
[status.md](status.md). No answer changed between snapshots (diffed by id). Every "before" was read
from HEAD (`39bccf2`) or measured on the built dist with Node 22.23, ESLint 10.12, oxlint 1.87.
Where this spec and a card differ, the card's answer wins; report it.

## For every lane

- Read [CLAUDE.md](../../CLAUDE.md) first and follow its order: tests first and watched failing,
  then code, then the expressive-TypeScript pass, then a real run, then review. Read-only git only.
  Check your output against CLAUDE.md before finishing; report any anti-pattern fixed or standard
  found missing. **Corrections** (what in this spec proved false, or "nothing") is a required field.
- Work in your lane copy. Node: put `~/.local/share/fnm/node-versions/v22.23.2/installation/bin`
  first on `PATH`.
- Gate, from the lane repo: `bun run build --force`, `bun run typecheck --force`,
  `bunx turbo test --force --continue --concurrency=1 -- --maxWorkers=2`. Integration tests run the
  engines on the built `dist`: build before any run that should see a change.
- After a `rules.json` or `ruleset-definitions.json` edit: `bun run --cwd packages/rule-data generate`,
  then diff `src/generated/` (only the rules you changed may move).
- Own only your lane's files (below). A change needed in another lane's file is reported, not made.
- Docs: do not edit `docs/plan.md`, `docs/architecture.md`, `docs/release.md` or `docs/work/questions.md`.
  List, in your report, each sentence your change made false (file and section); item 49 fixes them.
- Card ids below are the owner's answers; quote them in commit subjects' bodies, never in test names.

## Lanes, files and landing order

| Lane | Items | Owns | Lands |
| --- | --- | --- | --- |
| A rule data | 1–12 | `packages/rule-data/**`; `packages/lint-rules/test-fixtures/eslint-fallback/**`; `packages/lint-rules/src/{eslint-fallback,eslint-stand-ins,covered-by}.integration.test.ts` | **1st** (after E's 42 and 43) |
| C core and merges | 13–22 | `packages/lint-rules/src/core/**`; `src/{index,eslint,oxlint,agent-configs,agent-settings,eslint-plugin-registry}.ts`; every other `src/*.test.ts` and `src/__tests__/**` file not owned by A or B; `test-fixtures/**` but eslint-fallback; `stryker.config.json` | **2nd** (rebases on A) |
| B check and init | 23–35, 50 | `packages/lint-rules/src/cli/**`, `src/cli.ts`; `src/check*.integration.test.ts`, `src/init.integration.test.ts`, `src/cli-dist.test.ts`, `src/node-warnings.integration.test.ts`; `src/__tests__/{cli-runs.ts,git-projects.ts,check-output.ts,check-output.test.ts}`, `src/__tests__/factories/{check,init}-factories*.ts`, `src/__tests__/cases/{check-sources,check-stdouts,init-config-texts,init-package-json-edits,git-diffs}.ts` | **3rd** (rebases on A and C) |
| D house | 36–38 | `packages/eslint-plugin-house/**` | any time after A; re-run rule-data's generated-files test |
| E repo, release, internal, docs | 39–49 | `packages/typescript-config/node.json`, `CLAUDE.md` (the one bullet), root `agents-inc.lint.mts`, `eslint.config.mjs`, `oxlint.config.mts`, root `package.json`, `bun.lock`, `LICENSE`; `packages/lint-rules/{package.json,LICENSE}`; then, once A–D land, the files 44–47 name; `docs/**` last | **42 and 43 before every other lane's break step**; 40, 41 any time; 39 after B and D; 44–47 after A–D; 48 after A and 39; 49 last |

B and C build in parallel: C's item 13 is the contract B's item 23 calls (named there). B rebases
on C before counting its integration tests.

---

## Lane A: rule data

**1. `if (b = a)` reported once** (read-cond-assign-cover, r2-d57)
- Before: `no-cond-assign` and `sonarjs/no-nested-assignment` both report `if (b = a) {}`. After: only sonarjs's, wherever `complexity` is on.
- `no-cond-assign` gains `coveredBy: { rule: 'sonarjs/no-nested-assignment', because: 'read-cond-assign-cover: …' }`, as `no-return-assign` has.
- Tests: `changed-settings.integration.test.ts` (or `covered-by.integration.test.ts`), real engines, agent build: `if (b = a) {}` reports `sonarjs/no-nested-assignment` alone with `complexity` listed; beside it, without `complexity`, `no-cond-assign` reports it.
- Wrong now: `canonical-list.test.ts` "records "covered by" on exactly the covered rules of the cards an (S) option was chosen on…" and its case list `__tests__/cases/rule-relations.ts` (owner said so). The `no-return-assign` entry's `because` ("no-cond-assign keeps reporting beside it") becomes false: fix it.
- Docs: none beyond item 49's list.

**2. `default-case-last` back, in `conventions`** (my-move-default-case-last, a3-read-default-case-last-ruleset)
- Before: not shipped; a team without the opt-in `ordering` gets no report on `default:` mid-`switch`. After: reported wherever `conventions` is listed; with `ordering` too it is reported twice beside `perfectionist/sort-switch-case` (accepted).
- Entry: engine oxlint (`default-case-last`, as routing.json already records), `ruleset: 'conventions'`, default options, `assignment.by` the card.
- Tests: real engines: agent build and the editor oxlint part report `switch (k) { default: return 0; case 'a': return 1 }`; beside it, `default` last reports nothing. ESLint without oxlint: its fixture in `test-fixtures/eslint-fallback/fixtures.json` fires (or it goes on the skip list with a reason).
- Wrong now: `__tests__/cases/round-2-drops.ts` lists it as dropped, so "ships none of the round 2 drops…" fails: remove it from the drops (owner said so).

**3. `import-x/first` back in `import-order`** (my-move-import-first)
- Before: in `modules`, on by default. After: in the opt-in `import-order`; a team that does not list it loses the check (the card's stated effect).
- Tests: `canonical-list.test.ts` pin replaced: "ships import-x/first in import-order…".
- Wrong now: `canonical-list.test.ts` "ships import-x/first in modules, run by oxlint as import/first at its defaults". Lane B's `init.integration.test.ts` "the sorting rulesets, opt-in…": "…as init wrote it, and still reports the import below other code" now expects no finding and exit 0 (B updates it; owner said so); `cases/check-sources.ts`'s comment on `AN_IMPORT_BELOW_CODE` (B).

**4. Eleven library rulesets, created empty** (read-library-rulesets-created, a3-init-empty-library-rulesets, lib-structure)
- Before: `libs` has ui, testing, forms, styling; runtimes node, browser. After: `ruleset-definitions.json` adds, in this order: ui `nextjs`, `react-ssr`; testing `playwright`, `jest-dom`; styling `tailwind` (`optIn: true`); new domains `data` (`tanstack-query`, `drizzle`), `routing` (`tanstack-router`), `validation` (`zod`), `auth` (`jsonwebtoken`); runtime `browser-targets` (`optIn: true`, `env: null`, call C1). None holds a rule.
- `init` then lists the nine that are not opt-in and names `tailwind` and `browser-targets` in its opt-in comments (data-driven, no code change; lane B's tests see it).
- Tests: `defineLintRules` accepts `libs: { data: ['drizzle'] }` and refuses `libs: { data: ['zod'] }` (wrong domain), runtime and type level (C adds the type cases to the renamed type test, item 18). `init` writes the new names (B's `init.integration.test.ts`, derived from the catalog: should pass unchanged; say if not).
- Wrong now: `canonical-list.test.ts` "defines the owner's rulesets, in the owner's order…" (its constants, and its `env: name` for runtimes). The generated `ruleset-names.ts` changes.

**5. Option changes** (one entry each in `rules.json`)

| Rule | Change | Card | Real-engine case (agent build), with the refusal beside it |
| --- | --- | --- | --- |
| `unicorn/comment-content` | `checkUniformCase: false` | q-dogfood-comment-casing | `// run git` not reported; `// Github` still reported |
| `functional/readonly-type` | `'keyword'` | q-dogfood-readonly-style | `type R = { readonly a: string }` passes; `type R = Readonly<{ a: string }>` reported |
| `no-unused-vars` | add `ignoreRestSiblings: true` beside `caughtErrors: 'none'` | q-dogfood-rest-siblings | `({ drop, ...rest }) => rest` passes in oxlint and in ESLint without oxlint (TS file too, through the typescript-eslint twin); `({ drop }) => 1` still reported |
| `unicorn/name-replacements` | allow `dirs`, `envs`, `repo`, `dist` | q-dogfood-short-names | `const distDir` and `gitRepoAt` pass; `const btn`, a default replacement, is still reported |
| `functional/no-expression-statements` | `ignoreVoid: true` | q-dogfood-void-statements | `writeFileSync(p, t)` passes; `stack.push(x)` reported |
| `import-x/no-extraneous-dependencies` | `includeTypes: true` | q-import-type-unlisted | `import type { Plugin } from 'vite'` unlisted reported; listed passes |
| `unicorn/consistent-boolean-name` | `ignore` the pattern `^_*(?!(?:is\|has\|was\|does\|requires)[A-Z0-9])[a-z]+s[A-Z0-9]` (measured on the card; the `\|` are table escapes, the pattern has plain `|`) | a3-boolean-name-verbs, q-dogfood-boolean-names | `const runsOnEveryRender = true` and `const suppressionsAllowed = true` pass; `const typeAware = true` is still reported, and so is `const isOneOf = 'x'` (an `is` name that is no boolean) |
| `@typescript-eslint/no-floating-promises` | add `@vitest/expect`'s `Promisify` to `allowForKnownSafeCalls` | my-vitest-3-resolves | on Vitest 3.2.4 types, an unawaited `.resolves` is reported once (by the vitest rule); the file's own unawaited promise is still reported |

- Tests: rule-data's `changed-settings.integration.test.ts` cases, real engines, each row's pair.
- Wrong now: any pin of these entries' options (grep each ID in `canonical-list.test.ts`, `catalog.test.ts`).

**6. Nine rules no longer shipped** (q-dogfood-function-style-pair, q-dogfood-wrapped-comments, q-global-assign-twice, q-dogfood-os-command-path, q-dogfood-off-five)
- Removed from `rules.json`: `unicorn/prefer-short-arrow-method`, `unicorn/no-manually-wrapped-comments`, `no-implicit-globals`, `sonarjs/no-os-command-from-path`, `sonarjs/no-empty-test-file`, `sonarjs/strings-comparison`, `sonarjs/function-return-type`, `unicorn/no-unreadable-new-expression`, `unicorn/no-unsafe-string-replacement`. Each gets a `dropped` entry (item 12). They stay RuleIds a team can turn on.
- After: `window = {}` in a JS file beside oxlint is reported once (`no-global-assign`).
- Tests: real engines: each rule silent by default; turned on through `rules` it still runs (one case suffices for the mechanism, `no-implicit-globals`).
- Wrong now: `canonical-list.test.ts` "ships no-implicit-globals in the browser runtime"; `eslint-fallback/fixtures.json` entry for `no-implicit-globals`. Lane B: `check.integration.test.ts` "check on findings spanning lines, and on findings about a whole file (K-26…)" uses `sonarjs/no-empty-test-file` for its line-0 cases ("keeps a finding at line 0 in a new file", "drops a finding at line 0…"): B picks another shipped rule that reports at line 0 (measured), leaving what the tests test unchanged.

**7. `oxc/no-map-spread` left out under `declarative`** (q-dogfood-map-spread-pair)
- `coveredBy: { rule: 'functional/immutable-data', because: … }`. Its stand-in, if item 11 adopts one, follows (the ESLint part states a stand-in only where it states the rule).
- Tests: real engines: `xs.map((x) => ({ ...x, done: true }))` silent with `declarative`; reported by oxc without it.
- Wrong now: the "covered by" pin in `canonical-list.test.ts` (same as item 1).

**8. Test files: type tests count; ten rules and Testing Library keep to their place** (q-dogfood-type-test-files, q-dogfood-test-files-skip, q-dogfood-testing-library-scope)
- Every rule-data glob list that singles out test files also holds the type-test form `**/*.{test,spec}-d.{ts,tsx,js,jsx}` (Vitest's `*.test-d.*`).
- The ten rules gain the test-file ignores (`**/*.{test,spec}.{ts,tsx,js,jsx}`, `**/__tests__/**`, the `-d` form): `functional/no-expression-statements`, `functional/no-return-void`, `sonarjs/max-lines-per-function`, `unicorn/no-incorrect-template-string-interpolation`, `sonarjs/no-undefined-assignment`, `@typescript-eslint/no-unsafe-type-assertion`, `unicorn/prefer-await`, `functional/no-classes`, `functional/no-this-expressions`, `sonarjs/file-name-differ-from-class`. All ESLint-run (checked), so `files`/`ignores` are allowed.
- The 26 `testing-library` rules gain `files`: the test-file globs and the story globs (`**/*.stories.{ts,tsx,js,jsx,mjs}`).
- A guard (new test): every rule entry whose `files` or `ignores` names a test-file glob names the full set, `-d` form included. Say what else would catch a missed `-d`: nothing.
- Tests: real engines: `describe('x', () => { expect(1).toBe(1) })` in `a.test.ts` and `a.test-d.ts` draws none of the ten; the same statement in `a.ts` still draws `no-expression-statements`. `const renderer = rendererNameOf(f)` in `src/a.ts` draws no testing-library report; in `a.test.tsx` the plugin's rules run (one rule's report).
- Wrong now: `canonical-list.test.ts` "runs max-lines on JSX files only, skipping hooks, tests and stories…" (its ignores gain the `-d` form), and any other test pinning those five rules' ignores (grep `__tests__/\*\*`).

**9. `<html lang>`: a new kind of relation, data half** (q-html-lang-twice; closes r2-d27)
- `jsx-a11y/html-has-lang` is left out wherever oxlint runs it and `jsx-a11y/lang` is on: the agent build (check always runs oxlint) and the editor oxlint part. Without oxlint the ESLint part keeps both.
- Data: a relation like `coveredBy` but for the oxlint part only (name the field; suggested `coveredInOxlintBy: { rule, because }`), read by the catalog, checked by an offenders test beside `relation-offenders.ts` (both rules oxlint-run and shipped, in rulesets of their own). C's item 16 consumes it.
- Tests and wrong-now: item 16.

**10. `@ts-expect-error` with a description in test files: data half** (q-dogfood-ts-expect-error-tests)
- `@typescript-eslint/ban-ts-comment`'s `whenSuppressions` gains the setting it has in test and type-test files while suppressions are banned: `ts-expect-error: 'allow-with-description'`, `ts-ignore` and `ts-nocheck` still `true`. Name the field and expose it through the catalog with the test-file globs; C's item 17 consumes it.
- Wrong now: `canonical-list.test.ts` "ships @typescript-eslint/ban-ts-comment always on, run by ESLint, banning @ts-expect-error, @ts-ignore and @ts-nocheck outright" (owner said so).

**11. ESLint stand-ins for the ten oxlint-only rules** (read-oxc-stand-ins)
- Research each shipped `oxc/*` rule with no stand-in: `bad-array-method-on-arguments`, `bad-min-max-func`, `const-comparisons`, `missing-throw`, `no-accumulating-spread`, `no-async-endpoint-handlers`, `no-map-spread`, `number-arg-out-of-range`, `only-used-in-recursion`, `uninvoked-array-callback`. Search every installed ESLint plugin; adopt one only where a fixture fires in both engines (measured, in `eslint-stand-ins.json` with the card and the measurement, as today's five); otherwise record "none" with the search done (shape yours).
- Guard (new test): every shipped `oxc/*` rule has a stand-in or a recorded none.
- Tests: `eslint-stand-ins.integration.test.ts`: each adopted stand-in fires on the rule's fixture in a project without oxlint; beside it, with oxlint, only the oxc rule reports.

**12. A recorded state for every installed rule we do not ship** (my-dropped-rules-unrecorded, a3-why-entries-scope: "every installed rule we don't ship")
- Before: a rule we decided against is in no list. After: every RuleId in `src/generated/routing.json` that `rules.json` does not ship has exactly one entry in `rule-candidates.json`. New states: `dropped` (with `why` and the card or decision label that decided it) and `not-reviewed` (`why: "not reviewed yet"`, as the chosen option says).
- `dropped`: this round's nine (item 6), the 60 round 2 drops (`cases/round-2-drops.ts` holds the cards' pairs), the earlier drops `canonical-list.test.ts` pins ("ships none of the dropped rules…"), `no-use-before-define` (owner 2026-10-10), and any other drop decisions.md records. Every other unshipped RuleId: `not-reviewed`. Count with `jq '[.[] | select(.shipped == null)] | length' packages/rule-data/src/generated/routing.json`.
- Keep every entry with a `why`, an `evidence` pointer and `recorded`, so "has no entry without a reason, an evidence pointer and the date…" stays unchanged.
- Guard: a test that names each unshipped RuleId with no entry, so a plugin upgrade fails it with the new IDs listed.
- Wrong now: `rule-candidates.test.ts` "has no status other than considering, recommended, parked or needs-owner"; "considers none of the round 2 drops" (owner said so, my-dropped-rules-unrecorded).

## Lane C: core and merges

**13. The one config reaches every changed file: core half** (a4-check-other-packages-one-config; O1 answered)
- Contract for B: a function in `core/` takes the two configs `buildAgentConfigs` returns (unchanged) and the config folder's path from the git top level (`/`-separated, empty when the config sits at the top), and returns both with that path put in front of every folder-tied glob. Globs are `files` and `ignores` in the ESLint config, `ignorePatterns` and each override's `files` and `excludeFiles` in the oxlint one (read the built configs for others). Tied to a folder: holds a `/` and does not start with `**/`, after any `!` (`src/**`, `./x` with its `./` replaced, and the TS files no tsconfig takes in, which the ESLint build names by path). Not tied (`**/dist/**`; `*.config.ts`, which the build already writes as `**/*.config.ts`): left as they are. The path goes in as a literal, since a folder may be named `(web)` or `[id]`. An empty path returns both configs equal to the input.
- Pattern source: `core/globs.ts` (`normalizeGlob`, `keepingNegation`, `withoutLeadingDotSlash`, `literalGlobOf`).
- Why one run from the git top level: ESLint refuses a file outside its `cwd` ("File ignored because outside of base path"), and oxlint run from the config's folder matches the config's globs against outside files inconsistently (measured 2026-10-17: an override `**/*.test.ts` and `./**/*.test.ts` reach `../api/src/a.test.ts`, `src/**` does not, `ignorePatterns: ['**/b.ts']` does not). The prefix keeps each folder-tied glob meaning the config's folder.
- No second build, no walk of the git top level, no search for other configs; `tsconfigRootDir` stays the config's own. Measured 2026-10-17 (`answers-4/probes/mono-outside.sh`, plus a dependency and an alias case on its layout): type information and each package's dependencies work; a file no tsconfig takes in and another package's path alias do not (written limits). Item 23 pins each as a test.
- Tests (core): a table of globs and their prefixed forms: `src/**`, `./x` and `!src/keep.ts` change; `**/dist/**`, `**/*.config.ts` and `!**/keep.ts` stay; beside it the empty path. Guard: build a config holding `ignores`, a `fileOverrides` entry and a TS file no tsconfig takes in, with a path, then assert every value under a key named `files`, `ignores`, `ignorePatterns` or `excludeFiles` starts with `**/`, `!**/` or the path. A glob under another key escapes it: only item 23's real-engine cases would show that.
- Wrong now: none in C's files (B lists its own).

**14. React 18.3 for both engines, always** (a4-react-version-fixed-or-looked-up; replaces a3-react-version-lookup and my-react-version-monorepo)
- Before: ESLint gets `detect` where React resolves from `tsconfigRootDir`, else `999.999.999`; oxlint gets no version (acts as newest). After: both get `18.3.0` in the agent build and the editor parts. `reactIsInstalled`, `detect`, the `999.999.999` constant and the React look-up in `projectFactsOf` go.
- Oxlint merge: a team's own `settings.react.version` stands; otherwise ours is added beside the team's other `settings.react` keys (the ESLint merge already lets the team's settings win, its blocks coming after ours).
- Tests: real engines, agent build and each editor part: a class component with `UNSAFE_componentWillMount` and `this.refs.box` reports `react/no-unsafe` in oxlint; beside it, a team oxlint config setting `settings.react.version: '16.2.0'` stops that report in the merged config. No warning printed in a project without React (react-version.integration.test.ts's "prints nothing" cases stay).
- Wrong now: `react-version.integration.test.ts` "is the version the plugin assumes without React, and detect where React is installed…"; `core/build-eslint-config.test.ts` "carries the import-x TypeScript resolver … and the React version eslint-plugin-react assumes without React" and describe `buildEslintSettings`; `core/project-facts.test.ts` describe "projectFactsOf's reading of React…"; `merge-eslint-config.test.ts` describe "the team's language options, settings and linter options" (`reactVersion: '999.999.999'`); `__tests__/factories/project-facts-factories.ts`.
- Docs: "the react ruleset expects React 18.3 or later" (item 49).

**15. The oxlint merge stops adding `options.reportUnusedDisableDirectives`** (q-monorepo-oxlint-options; #66)
- Before: `optionsKeepingTheTeams` adds `reportUnusedDisableDirectives: 'off'`, which oxlint refuses outside the root config, so `npx oxlint` from a monorepo root lints nothing. After: `options` are the team's as written. The agent build's own `options` are unchanged.
- Tests: real engines: a root `oxlint.config.mts` and a merged `apps/web/oxlint.config.mts`: `oxlint` from the root and from `apps/web` both lint and report web's planted finding. Beside it: a team that writes `options.typeAware` in `apps/web` still gets oxlint's own refusal (the written limit, a4-oxlint-type-aware).
- Wrong now: `merge-oxlint-config.test.ts` "keeps the team's options, with unused disable directives unreported, which ESLint's suppressions would be"; any fixture expecting the option (grep `reportUnusedDisableDirectives` in C's tests).

**16. `<html lang>` reported once where oxlint runs** (q-html-lang-twice; consumes item 9)
- After: `<html><body /></html>`: check and the editor beside oxlint report `jsx-a11y/lang` alone; ESLint without oxlint still reports `html-has-lang` (unchanged; an empty `lang=""` there stays twice, as the card says). A team naming `html-has-lang` in `rules` keeps it, as with `coveredBy`.
- Tests: real engines, the three setups above, the missing-lang case each; beside it, `<html lang="en">` reports nothing.

**17. `@ts-expect-error` with a description allowed in test files while suppressions are banned** (q-dogfood-ts-expect-error-tests; consumes item 10)
- After: in `*.test.*`, `*.spec.*`, `__tests__/` and `*.{test,spec}-d.*` files, banned mode runs `ban-ts-comment` with item 10's setting; `eslint-disable`, `@ts-ignore` and `@ts-nocheck` stay banned there, and `noInlineConfig` stays true. A team cannot undo it (`rules` cannot name the rule): written limit.
- Tests: real engines, check: `// @ts-expect-error tsconfigRootDir is required` over a type error in `src/a.test.ts` and `src/a.test-d.ts`: no report. Beside: the same in `src/a.ts` is reported; in the test file, `@ts-expect-error` with no description and `@ts-ignore` are reported, and `// eslint-disable-next-line no-debugger` draws `house/no-suppressions`.

**18. Type-test files get the test-runner globals; ours is renamed** (q-dogfood-type-test-files, code half)
- `TEST_RUNNER_GLOBALS` (`core/framework-globals.ts`) adds `**/*.{test,spec}-d.{…JS and TS extensions}`. Rename `src/define-lint-rules.type-test.ts` to `src/define-lint-rules.test-d.ts`; update `names-no-rule.test.ts`'s `TEST_SOURCE` and `stryker.config.json`'s exclude. Add item 4's type cases to it.
- Tests: real engines, agent build: `describe` in `a.test-d.js` draws no `no-undef`; in `a-test.js`, which is no test file, it does.

**19. Config errors describe a wrong value** (q-dogfood-error-value-text)
- Before: `allowSuppressions: "[object Object]" is not true or false`; an array prints its items. After: `allowSuppressions: an object is not true or false`, `an array`, `null`, or the value itself, through `describeValue` (`core/other-engine-config.ts`). Same for `tsconfigRootDir` and `suppressionModeSetBy`.
- Tests: `config-errors.test.ts`'s refused values gain an object, an array and null for both keys, messages verbatim; the string and number cases stay. Real engine: `check` with `allowSuppressions: {}` prints `check: could not run: …: allowSuppressions: an object is not true or false…`; beside it, `true` loads.

**20. `TypeError` where an error follows a type check** (q-dogfood-type-error-class)
- `rangeListedIn` and `versionOf` (`core/package-json-files.ts`, C) and `readsInlineConfigUnder` (`cli/check/eslint-run.ts`, B) throw `TypeError`, same messages. Where ESLint or oxlint print a config-load error, it starts `TypeError:`.
- Tests: each throw's unit test asserts the class and message; beside it, a throw that follows no type check stays `Error`.

**21. Config files no tsconfig takes in: the known gaps become the decided behaviour** (q-config-files-several-projects, read-typed-config-files-scope)
- The owner chose "Only where a tsconfig takes the files in". The `it.fails` tests asserting typed rules there now pin a dropped wish: turn each into an `it` asserting no typed rule runs there, and reword their `KNOWN GAP` comments. Owner said so.
- Files: `typed-config-files.integration.test.ts` (the top comment, the `takesInTheTwo: false` cases), `consumer-files.integration.test.ts` (its `KNOWN GAP` and `itWhereTheTsconfigTakesThemIn`), `core/build-eslint-config.test.ts` ("gives the two at tsconfigRootDir the typed rule where no tsconfig takes them in, when $how").

**22. The 3,000-case property test stops timing out under load** (status.md queue)
- `core/file-conditions.test.ts` "match the files the sets give, in each of 3000 drawn cases": give it its own timeout, measured alone with headroom, as `SHAPE_TEST_TIMEOUT_MS` does. Keep 3,000 cases.

## Lane B: check and init

**23. `check` lints every changed file in the repo with the one config it found** (a4-check-other-packages-one-config; supersedes q-check-nested-config, a3-monorepo-other-package, q-monorepo-agent-lines)
- Before: changed files outside the config's folder are skipped (`check: note: skipped 2 changed files outside /repo/packages/web.` on stderr), and exit reflects that folder alone. After: every changed JS and TS file in the git repo is linted with the config found from where `check` runs (the nearest one up, q-c6), whatever package the file is in. That config is built as today, passed through item 13's function, and both engines run from the git top level. No search for other configs: a package with its own `agents-inc.lint.mts` is linted with the found one too. No skip note (`skippedNote` and `isInsideTheConfigFolder` go). Paths print from the config's folder (`../api/src/index.ts`), as today. The editor configs are not touched.
- The one temporary oxlint config is written in the git top level, not the config's folder (`tempOxlintConfigIn`), and removed at exit, on SIGINT and on SIGTERM as today.
- Written limits: one set of rulesets for every package; a TS file no tsconfig takes in, outside the config's folder, draws ESLint's parse error (printed at line 0, item 29) and no other ESLint finding, where one inside the folder gets the untyped rules (C9); a path alias defined only in another package's tsconfig does not resolve for `import-x` (C10).
- Tests (real engines, `check.integration.test.ts`, the layout of `answers-4/probes/mono-outside.sh`; scratch monorepo: `packages/web` with the config, `packages/api` with its own tsconfig and `package.json` and no config; changes in both; run in `packages/web`):
  - Findings in `src/index.ts` and `../api/src/index.ts` (with `@typescript-eslint/no-floating-promises`, from api's tsconfig; the awaited call beside it is silent), `../api/scripts/seed.ts:2 no-debugger`, exit 1, nothing on stderr.
  - `../api/scripts/seed.ts`, which no tsconfig takes in, prints its parse error at line 0, never `undefined` (item 29's real-engine path); beside it, the same file inside `packages/web` gets the untyped rules and no parse error.
  - A package installed at the repo root and listed only in api's `package.json`: imported in api, passes; one listed in neither, reported by `import-x/no-extraneous-dependencies`.
  - A path alias in api's tsconfig only: `KNOWN GAP` with the strict assertion kept (a name the aliased module lacks, imported in api, reports `import-x/named`); beside it, the same alias in web's tsconfig, used in web, reports it.
  - Web's `fileOverrides: [{ files: ['src/**'], rules: … 'off' }]` silences web's `src/` and not api's; beside it, an override on `**/*.test.ts` silences both packages' test files. Each case with one ESLint-run rule and one oxlint-run rule. The same `src/**` override in a config folder named `(web)` still silences that folder alone.
  - api holding its own config that leaves a ruleset out: api's files still draw that ruleset's rule.
  - Nothing changed outside the config's folder: output as today; a config at the git top level: output as today.
  - "What check leaves behind": the temporary config appears in the git top level and not in the config's folder, and none is left in either after exit 0, exit 1, SIGINT or SIGTERM.
- Wrong now: "check in a monorepo package (K-22, q-c6)"; "check in a package whose folder, at the repo root, and a changed file in it are each named with two leading dots" (its "skips only the file outside it"); "check counting the changed files outside its config folder (K-22, q-c6)"; `check-fixes.integration.test.ts` "check fixing only what it checks (F-9)" (`lib/outside.ts` is now fixed); "what check leaves behind (K-11, K-20)" (`tempConfigSeenInTheConfigFolder` is now the git top level); the comment on `TempOxlintConfig` in `oxlint-run.ts` ("Written in the config's folder"). `skippedNote` goes.

**24. What `check` cannot run is skipped, listed, and never exits 0** (a3-check-skip-and-report, my-check-stops-when-unsure, my-check-deleted-file-mid-run)
- Before: a deleted file, a rule crash or an oxlint failure stops `check`: exit 2, no findings. After:
  - a file deleted or replaced while `check` runs: `check: not checked: src/b.ts (it was deleted or replaced while check ran)`;
  - ESLint throwing while it fixes or lints a file: that file's ESLint result is skipped (its oxlint findings still print): `check: not checked: src/b.ts (ESLint failed: <ESLint's message>)`;
  - oxlint failing in either run: `check: not checked: oxlint's rules (oxlint failed: <all oxlint printed>)`, ESLint's findings still print;
  - an oxlint code the catalog lacks: no skip; the finding prints under oxlint's own name, `src/a.ts:3 eslint(no-foo) — …`.
  These lines go on stdout after the findings and the cut line, before the summary. With no finding left and a skip, the summary reads `check: no findings, but not everything was checked: report the lines above.`
- Exit: errors left → 1; else any skip → 2; else 0. Still a stop (stderr `check: could not run: …`, exit 2): not in git, git failing, no config, a config error, another copy, not installed, ESLint refusing before any file is linted, the Node floor. Fixes kept are never undone.
- Tests, real engines: the K-11 config whose `no-restricted-syntax` selector ESLint throws on: every file listed as not checked, oxlint's findings printed, exit 2; beside it, the same with an oxlint-found error: exit 1. The K-16 refused oxlint option: ESLint's findings and the oxlint line, exit 2; beside it, with an ESLint error, exit 1. A file another writer deletes during oxlint's fix run (the existing interleaving helpers): listed, the other files' findings printed. An unknown code: a unit test in `findings.test.ts` at the parse boundary (`check` runs its own oxlint, whose every code the catalog holds, so no real-engine path is known: say so); beside it, a known code still prints our rule ID.
- Wrong now: `check.integration.test.ts` "exits 2 when ESLint fails, and leaves no temporary config behind (K-11)" (its stderr check), "check where oxlint refuses an option the team gave a rule (K-16, read-q64)"; `check-fixes.integration.test.ts` "check that could not run once oxlint had written its fixes: ESLint failed…" (both its); `cli/check/fix-step.test.ts` "a file whose path another writer leaves with no file while oxlint fixes" (three cases, "fails on it") and, if the skip is caught in the fix step, "a fix step a failure stops after oxlint fixed". Say which changed and why.

**25. Autofix error-level rules only** (my-check-fix-warnings)
- Before: a rule a team sets to `warn` is autofixed on changed lines. After: listed as a warning, not fixed, in both engines (ESLint's fix predicate takes severity 2 only; oxlint's fix run has every `warn` rule off, root and overrides).
- Tests: real engines: a fixable ESLint-run and a fixable oxlint-run rule each set to `warn`: file unchanged, finding listed with `(warning)`, exit 0; beside: each at `error`, fixed, no finding. Unit: `eslint-fix-filter.test.ts`.
- Wrong now: `check-fixes.integration.test.ts` "fixes a finding a team set to warn, as it does an error (P4)" (owner said so).

**26. `.vue`, `.svelte` and `.astro` files** (q-check-framework-files)
- After: their changed lines get oxlint's fixes and findings; ESLint never gets them. The config's ignores apply to them. Unused suppressions there: the `oxlint-disable` form where suppressions are allowed; the `eslint-disable` form is never reported, and no suppression is banned there (ESLint's rules): written limits.
- Texts: `check: no changed JS, TS, Vue, Svelte or Astro files.`; usage `  check  lint the JS, TS, Vue, Svelte and Astro lines changed since the last commit`.
- Tests: real engines: `debugger` added in each file kind's script: `src/a.vue:N no-debugger` and the same for the other two, no parse error; an oxlint fix on a changed script line applied. Beside: one the ignores name stays unreported; `.json`, `.md`, `.css` still unlinted.
- Wrong now: `NOTHING_TO_CHECK` and `USAGE` constants in `check.integration.test.ts` and `check-git-reading.integration.test.ts`; K-8 "lints a changed file of each of the eight JS and TS extensions…" (extended); F-9 (as item 23).

**27. An unused name on a later line of a multi-line `/* eslint-disable */`** (my-check-multiline-disable-missed)
- Before: never reported (ESLint gives the comment's first line, oxlint the name's). After: matched by comment and name; reported at the name's line.
- Tests: real engines, suppressions allowed: `/* eslint-disable\n  no-debugger,\n  no-console\n*/` over a `debugger`: `src/a.ts:3 unused suppression — suppresses no-console, which reported nothing here`; beside: `no-debugger` not reported; the one-line form unchanged.

**28. Every out-of-date `oxlint-disable` report dropped for the run** (my-check-stale-suppression-reports)
- After: a name that is none of the comment's own names (`no-debugge`), and a whole-comment span where no comment now is, are dropped; the next run reports the comment where it is.
- Tests: extend "check where another writer moves a partly unused suppression comment down after oxlint read it…" with both cases: nothing printed for them; beside: the comment nobody moved still reported.

**29. A parse error with no line prints at line 0** (status.md queue)
- Reproduced: `../api/scripts/seed.ts:undefined parse error — Parsing error: … was not found by the project service` (probe variant "ESLint at the git top level"). After: an ESLint fatal message without a line counts as line 0, as oxlint's span-less parse errors do. Item 13 does not close this: item 23's `seed.ts` case (a TS file in another package that no tsconfig takes in) still prints `:undefined` until this item lands. Two guards: a unit test at the parse boundary (`findings.test.ts`), where a fatal message with no line gives `:0` and, beside it, one with a line keeps it; and item 23's real-engine `seed.ts` case, which must print `:0`.

**30. A finding at any changed place: the known gap is decided** (read-two-place-findings: "Any place")
- `check.integration.test.ts` K-26 `it.fails` "drops a finding spanning several lines where only a later one of them changed…" pins what the owner declined; make it an `it` asserting `src/catch-inside.ts:5 no-useless-catch` is reported, and reword its name and comment.

**31. `init` prints a command that never downloads** (a3-npx-never-download, q-npx-unclaimed-name)
- After: npm `npx --no agents-inc-lint check`, bun `bun run agents-inc-lint check`; pnpm and yarn unchanged. In `cli/init/package-manager.ts`.
- Tests: real run: with the bin installed, both commands run our `check`; beside: without it, `bun run …` exits 1 ("Script not found") and `npx --no …` exits 1 without installing (network, as `packed-install` runs every time).
- Wrong now: `__tests__/factories/init-factories.ts` `NPM`/`BUN` runners, so `init.integration.test.ts` "the package manager init names (I-10, q-i5)".

**32. `init` says git could not be run** (my-init-git-missing)
- After, where git cannot start: `init: note: git could not be run, and check needs it.` Commands still come from this folder alone.
- Wrong now: `init.integration.test.ts` "writes both files where git is not installed, as it does outside a git repo, notes that check needs one, and exits 0…"; beside it, the outside-git case keeps `outsideGitNote`.

**33. `init` writes `/// <reference types="node" />` first** (q-typescript-6-node-types)
- Measure first on TypeScript 5.9 and 6.0.3: with `@types/node` installed and a tsconfig taking the file in, `tsc` passes and `check` reports nothing in it (`@typescript-eslint/triple-slash-reference`'s defaults allow it where nothing imports `node`). The `@types/node` note stays.
- Tests: the `KNOWN GAP` `it.fails` in `init.integration.test.ts` ("type-checks with tsc in a project that has @types/node"; "reports nothing in agents-inc.lint.mts" for the variants a tsconfig takes in) become `it`; beside: without `@types/node`, `tsc` fails and the note prints. C updates `test-fixtures/consumer-files/agents-inc.lint.mts` and `cases/consumer-files-as-plan-md-shows.ts` to plan.md's new text, which closes `typed-config-files.integration.test.ts`'s "listing no types" gap (report to C).
- Wrong now: `init-factories.ts`'s config text, `cases/init-config-texts.ts`.

**34. `init`'s ignores skip generated folders** (q-dogfood-generated-folder-ignore)
- `IGNORES` gains `**/generated/**`, `**/__generated__/**` after `**/.yarn/**`.
- Tests: "the ignores init writes, in check (I-12…)": files in `src/generated/` and `src/__generated__/` unreported; beside: `src/generated-x/a.ts` reported.
- Wrong now: `INIT_IGNORES` in `init-factories.ts`.

**35. No spec labels in test names** (status.md queue; CLAUDE.md "no ticket IDs in test names")
- Remove card ids and spec labels (`(K-11)`, `(q-c15)`, `(I-4, X6)`, `#59`, `read-q64`) from `describe`/`it` titles in every package, rewording where a title is only a label. Titles only; no assertion changes. Run `grep -rnoE "\((q-[a-z0-9-]+|[A-Z]{1,3}-?[0-9]+[a-z]?|#[0-9]+|r[0-9]-[a-z0-9-]+|q[0-9]+)([ ,]+(q-[a-z0-9-]+|[A-Z]{1,3}-?[0-9]+[a-z]?|#[0-9]+|r[0-9]-[a-z0-9-]+|q[0-9]+))*\)['\"\`]" --include='*.ts' --exclude-dir=node_modules packages`, then read for forms it misses (`read-q64`). B does its files and lists the others' (C's, D's) for them to do after landing.

**50. An unexplained hang** (found by the `answers-4` alias probe)
- **Symptom:** an alias probe with an import cycle through the alias made `check` spin at 100% CPU for over 8 minutes.
- **Setup:** ESLint running from the git top level, in a scratch copy.
- **Reproduction:** `bash <session>/scratch-backup/answers-4/probes/probe-alias.sh`. Run it under `timeout`, with output to a file, not a pipe.
- **Owed:**
  - find the cause (which engine or rule loops: import-x's cycle check, the resolver, or our code);
  - fix it with a test that times out on the bug and passes after;
  - search for the same kind of loop elsewhere.
- **If the cause is in a third-party plugin and can't be fixed on our side:** a bounded guard plus a written limit, with an owner card.

## Lane D: house

**36. One reader for an attribute's fixed text** (q-dogfood-hidden-input-template: "Can't string inside bracket always convert to string only")
- After: `"x"`, `{'x'}` and `` {`x`} `` (nothing interpolated) read as `x` wherever a house rule reads an attribute's fixed value: `type` (`hasLiteralHiddenType`, `staticStringOf` in no-controlled-field-without-change-handler), `aria-hidden` (no-focusable-content-in-aria-hidden; `{true}` stays), `placeholder` (no-placeholder-only-field), `tabIndex`, `dialog-has-accessible-name`'s `literalValueOf`. Find the rest by grepping the rules for `AST_NODE_TYPES.Literal` on attribute values.
- Tests (RuleTester, one set per rule, first): the three forms behave alike; beside: `` {`${x}`} `` stays dynamic, as today.

**37. `require-class-helper`'s message names the `Variants` ending** (my-variants-message)
- After: `Give {{attribute}} a string, a name, or a call to a class helper ({{helpers}}) or to a cva-made function whose name ends in \`Variants\`, and compose classes inside that call. A helper drops empty, false and undefined parts; composed by hand they render as stray spaces or the class "undefined".` (call C3).
- Tests: the rule's message pinned; beside: `buttonVariants(…)` still passes.

**38. The house test gaps found before the refactor** (status.md queue; `refactor/results/review-house.md`)
- Re-derive each by its break: `createContext` in a custom hook (`no-create-context-in-render`); effects through `window.`/`globalThis.` (`no-side-effect-in-state-updater`'s `memberPathOf`); the function-boundary stop in `keyAttributeAround` (`no-unstable-list-keys`); an unknown option key refused by each rule taking a string list. A break no test catches gets a test; one some test already catches is reported as closed.

## Lane E: repo, release, internal, docs

**39. This repo's own three config files** (a3-whole-repo-lint, q-dogfood-whole-repo-lint)
- Add at the root `agents-inc.lint.mts` (as `init` writes it, after items 4, 33, 34), `eslint.config.mjs` and `oxlint.config.mts` as plan.md shows a team's, with `editorRulesets` equal to `agentRulesets`. Root `package.json` lists `@agents-inc/lint-rules` (`workspace:*`), `eslint` 10.12.0 and `oxlint` 1.87.0 as devDependencies (the ESLint merge reads oxlint from it); `bun install`. Ignores add `packages/lint-rules/test-fixtures/**` and `.stryker-tmp/**` (call C4). Agents here still do not run `check` unless the owner says.
- Tests: from the root after `bun run build`, `npx eslint . -f json` and `npx oxlint -f json` both exit with findings and no config error; the full gate stays green (a test that ran ESLint without `overrideConfigFile` inside the tree would now find the root config: report any). `package-manifests.test.ts`'s bun.lock cases pass.

**40. MIT licence** (q-licence)
- `"license": "MIT"` in `packages/lint-rules/package.json`; `LICENSE` at the root and in `packages/lint-rules`, the text of `~/dev/cli/LICENSE` with `Copyright (c) 2026 Vincent` (call C5).
- Tests: `package-manifests.test.ts` pins `license`; `npm pack --dry-run` in `packages/lint-rules` lists `LICENSE`.

**41. `prepublishOnly`** (my-prepublish)
- `"prepublishOnly": "bun run build && bun run typecheck && bun run test"` (release.md's text). Test: pinned in `package-manifests.test.ts`.

**42. TypeScript's lib knows the Node 22 APIs four rules' fixes use** (my-dogfood-typescript-lib)
- `lib: ['ES2024', 'ES2025.Collection', 'ES2025.Iterator']` in `packages/typescript-config/node.json`.
- Guard: a type test (`*.test-d.ts`, lint-rules) using `toArray()`, the Set methods, `Map.groupBy` and `Promise.withResolvers`, with `@ts-expect-error` on `Promise.try`, `RegExp.escape` and `Float16Array`.

**43. CLAUDE.md's break rule becomes the StrykerJS wording** (q-claude-md-stryker-rule: "Replace the bullet with this")
- Replace the bullet "**Break each new decision point and watch a test fail.** …" with the card's text verbatim (it names `node scripts/mutate-changed-lines.mts` and `stryker.static.config.mjs`, both present). Keep the next bullet. Nothing else in CLAUDE.md.

**44. `foundOr` at every look-up-or-throw** (my-dogfood-found-or) — after A–D land
- A helper in rule-data's `src/collections.ts` (exported as `@workspace/rule-data/collections`), used in rule-data and lint-rules source wherever a look-up throws on a miss, each place keeping its message. The house plugin depends on neither: list its sites, leave them (call C6). Find them with `grep -rnE "=== undefined\) throw" packages/rule-data/src packages/lint-rules/src`, then read for other shapes.

**45. The three backtracking regexes** (my-dogfood-backtracking-regexes) — after C lands
- In `core/jsonc.ts` and `core/globs-read-from-above.ts`: pin cases of what each matches today, then rewrite where the pins prove the same matches; otherwise leave it with a comment naming the slow input and why no rewrite matches the same.

**46. Two more suites run their setup through the shared helper** (my-dogfood-shared-suite-runs) — after C lands
- `__tests__/engine-run.ts` and `editor-configs.integration.test.ts` move to `setUpRunsBeforeTheSuite`. Show it: a broken setup now fails each test instead of skipping it.

**47. The test-only export carries the rest** (my-dogfood-test-support-export) — after A and C land
- `buildShippedRule` and the oxlint CLI run move behind rule-data's `./test-support/…` exports; lint-rules' copies go.

**48. The whole-repo pass, again** (blocked by a3-whole-repo-lint until now) — after A and 39
- From the root: `npx eslint . -f json > eslint.json` and `npx oxlint -f json > oxlint.json` into the session's scratch folder; counts by rule and by test or source file, for the clean-up spec. The clean-up itself is not in this spec.

**49. Docs** — last, from every lane's list of sentences made false, and these:
- plan.md: the Runner and Scope rows and "The runner" (item 23, 24, 25, 26; drop "proposed" from P1 and P3, which my-check-fix-changed-lines and my-check-withhold-catch-fix answered); the init example config (items 4, 33, 34) and "Files init adds"; Rulesets (item 4; `no-implicit-globals` gone from `browser`, item 6; `default-case-last`, `import-x/first`); "Rules under consideration" and "Where oxlint's 870 rules stood" (item 12); Suppression comments row (item 17); Requirements: React 18.3 or later (item 14) and the two expected npm warnings, from eslint-plugin-react and eslint-plugin-react-perf (q-npm-peer-warnings); Open: remove what this build settles (#66, the html lang pair, typed rules' engine and `--type-aware` (a4-oxlint-type-aware: our typed rules stay in ESLint), the class-helper defaults (a3-read-class-helper-config), the TS 6 `@types/node` items, the sorting owner calls, "A recorded state and reason…"), and mark accepted, as written limits: a3-editor-globals-short's table, q-second-ctrl-c (the stop takes 0.3 to 3.9 s; a second Ctrl+C does not shorten it), q-check-edit-lost-during-oxlint-fix, my-check-unused-enable-comment, my-basepath-glob-limits, my-resolver-limits, my-config-file-import-detection, my-covered-by-components (now in check too, item 26), my-check-oxlint-disable-eslint-rule-message, q-dogfood-keep-three (the three rewrites), q-dogfood-required-mutation; "Does not carry over": the `--type-aware` row.
- architecture.md: "How check runs" steps 1–5 (items 23–26), step 3–4 settings (item 14), step 7 options (item 15), step 5 (item 16).
- release.md "Before the first publish": the licence and `prepublishOnly` rows done (items 40, 41).
- questions.md: #66's text (it says the merge writes no options; it did until item 15).

---

## Open points (both answered 2026-10-17)

- **O1. Which of the config's globs reach files outside its folder: answered** (items 13, 23; decisions.md, 2026-10-17, two entries). The config of the folder the agent is opened in applies to every file it changes; a glob tied to a folder (`src/**`, `./x`) keeps meaning that folder, one that is not (`**/dist/**`, `*.config.ts`) reaches every package; the editor setup stays tied to its package.
- **O2. A docs line on oxlint `options` in a package's config: answered, no docs line** (decisions.md, 2026-10-17). After item 15 only a team's own option meets oxlint's refusal, and its error names the setting, the file and the fix.

## Calls made here (carded for the owner to verify; building goes on)

- C1. `browser-targets` sets no globals (`env: null`); `browser` does that.
- C2. The not-checked lines, the skip summary sentence (item 24) and the usage and nothing-to-check texts (item 26) are worded here; an ESLint failure on a file still prints oxlint's findings for it.
- C3. The `require-class-helper` message text (item 37).
- C4. This repo's config also ignores `packages/lint-rules/test-fixtures/**` (code that breaks rules on purpose) and `.stryker-tmp/**`; the root `package.json` gains three devDependencies (item 39).
- C5. `LICENSE` copies the CLI's text with this year.
- C6. `foundOr` lives in rule-data; the house plugin keeps its look-ups written out.
- C7. A parse error with no line prints at line 0 (item 29); a multi-line comment's unused name at the name's line (item 27).
- C8. Item 12's `not-reviewed` entries keep an evidence pointer, so the existing completeness test stays unchanged.
- C9. A TS file in another package that no tsconfig takes in gets ESLint's parse error and no other ESLint finding (item 23).
- C10. A path alias defined only in another package's tsconfig does not resolve for `import-x` under the config's settings; the test is a `KNOWN GAP` with the strict assertion kept (item 23).

## Not in this spec

The repo's lint clean-up (needs item 48's counts); the other publish blockers in release.md (`private`, README, `files`, `publishConfig`, `repository`, the npm scope), which no answer settles; `npm audit`; the Stryker round on the landed lines (the orchestrator's next step); anything in `~/dev/ai-benchmarking` or `~/dev/cli`.

## Success criteria

| Criterion | How to verify |
| --- | --- |
| Gate green, every lane landed | the gate commands above, uncached; report test counts and every expected fail by name |
| Each item's tests were seen failing first | each lane's report: the failing run's output before the change |
| Each refusal sits beside its allowed case | reviewer reads each new test file |
| Inside-folder output of `check` unchanged where nothing outside changed | item 23's "as today" case |
| No file outside a lane's list changed by it | `git diff --stat` per lane copy against its base |
| Every answer below is built or shown built | the table, each row checked by the reviewer |
| Generated files fresh | `generated-files.test.ts` |

---

## Every answer, and where it is

**To build: item numbers.** read-cond-assign-cover, r2-d57 → 1 · my-move-default-case-last, a3-read-default-case-last-ruleset → 2 · my-move-import-first → 3 · read-library-rulesets-created, a3-init-empty-library-rulesets, lib-structure, q-r2-library-rulesets → 4 · q-dogfood-comment-casing, q-dogfood-readonly-style, q-dogfood-rest-siblings, q-dogfood-short-names, q-dogfood-void-statements, q-import-type-unlisted, a3-boolean-name-verbs, q-dogfood-boolean-names, my-vitest-3-resolves → 5 · q-dogfood-function-style-pair, q-dogfood-wrapped-comments, q-global-assign-twice, q-dogfood-os-command-path, q-dogfood-off-five → 6 · q-real-run-duplicates (its four cards: q-import-type-unlisted → 5, q-global-assign-twice → 6, q-switch-default and q-void-arrow-twice nothing) · q-dogfood-map-spread-pair → 7 · q-dogfood-type-test-files → 8, 18 · q-dogfood-test-files-skip, q-dogfood-testing-library-scope → 8 · q-html-lang-twice, r2-d27 → 9, 16 · q-dogfood-ts-expect-error-tests → 10, 17 · read-oxc-stand-ins → 11 · my-dropped-rules-unrecorded, a3-why-entries-scope → 12 · a4-check-other-packages-one-config (supersedes q-check-nested-config, a3-monorepo-other-package, q-monorepo-agent-lines) → 13, 23 · a4-react-version-fixed-or-looked-up (supersedes a3-react-version-lookup, my-react-version-monorepo) → 14 · q-monorepo-oxlint-options, q66 → 15 · q-dogfood-error-value-text → 19 · q-dogfood-type-error-class → 20 · q-config-files-several-projects, read-typed-config-files-scope, typed-config-files → 21 · a3-check-skip-and-report, my-check-stops-when-unsure, my-check-deleted-file-mid-run → 24 · my-check-fix-warnings → 25 · q-check-framework-files → 26 · my-check-multiline-disable-missed → 27 · my-check-stale-suppression-reports → 28 · read-two-place-findings → 30 · a3-npx-never-download, q-npx-unclaimed-name → 31 · my-init-git-missing → 32 · q-typescript-6-node-types → 33 · q-dogfood-generated-folder-ignore → 34 · q-dogfood-hidden-input-template → 36 · my-variants-message → 37 · a3-whole-repo-lint, q-dogfood-whole-repo-lint → 39, 48 · q-licence, decisions "2026-10-14 evening" → 40 · my-prepublish → 41 · my-dogfood-typescript-lib → 42 · q-claude-md-stryker-rule → 43 · my-dogfood-found-or → 44 · my-dogfood-backtracking-regexes → 45 · my-dogfood-shared-suite-runs → 46 · my-dogfood-test-support-export → 47 · docs only, item 49: q-npm-peer-warnings, a3-editor-globals-short (q-no-implied-eval-editor-globals, my-globals-only-where-no-undef), q-second-ctrl-c, q-check-edit-lost-during-oxlint-fix, my-basepath-glob-limits, my-resolver-limits, my-config-file-import-detection, my-covered-by-components, my-check-oxlint-disable-eslint-rule-message, my-check-unused-enable-comment, q-dogfood-keep-three, q-dogfood-required-mutation, a4-oxlint-type-aware, a3-read-class-helper-config (read-variants-with-helpers), my-check-fix-changed-lines and my-check-withhold-catch-fix ("proposed" marks) · settled by O2, no docs line: q-monorepo-team-oxlint-options, a3-read-oxlint-options-docs.

**Built (evidence).**

| Answer | Evidence |
| --- | --- |
| q-r2-plugin-upgrades (audit: not built) | `packages/lint-rules/package.json`: `eslint-plugin-unicorn` 78.0.0, `@eslint-react/eslint-plugin` 5.26.5 |
| q61 (audit: not built) | `typescript-version-named-alone.integration.test.ts`; questions.md #61 |
| q62 (audit: not built) | `ignores-as-gitignore-lines.integration.test.ts`; questions.md #62 |
| decisions "Owner 2026-10-15, decided" (audit: not built) | `ruleset-definitions.json`: `import-order`, `ordering` `optIn: true`; `FORMATTER_WARNING` in `cli/init/config-text.ts`; its two follow-ups are items 2, 3 |
| decisions "Owner 2026-10-15 (sequence)", "~180 answers" (audit: partly) | status.md: Stryker pass, commit round and refactors landed 2026-10-16/17; q61, q62 above |
| my-check-autofixed-line-own-fixes | `autofixedFilesOf` in `run-check.ts` records only kept fixes |
| my-check-no-undo, a3-read-check-just-stops | `applyFixes`: a kept fix is never undone; `stdoutIfStopped` |
| my-check-node-23-warning | `printWarningsButTypeStripping` in `cli/main.ts` |
| my-check-unused-pair-line | `lineOfTheDisableComment` in `unused-suppressions.ts` |
| my-check-init-texts, q-cut-list-complete | `cli/check/texts.ts`, `summaryLine` drops "The list is complete" when cut |
| my-init-broken-package-json-above | `printedOnceWritten` runs before `writeEveryFileOrSayNoneChanged` (`run-init.ts`) |
| my-char-at-stand-in | `eslint-stand-ins.json`: `oxc/bad-char-at-comparison` |
| my-error-boundary-names | `rules.json`: `**/*{ErrorBoundary,error-boundary}*.{ts,tsx,js,jsx}` |
| my-testing-calls-broad-entry | `rules.json` `no-floating-promises`: `{ package: 'vitest', name: '__type' }` and user-event |
| my-split-pairs-in-eslint | `rules.json` `eslintBecause` entries; `canonical-list.test.ts` "the rules routed to ESLint for a measured reason" |
| my-resolver-multiple-projects-warning | `noWarnOnMultipleProjects: true` in `core/eslint-settings.ts` |
| my-runtime-globals-section-names ("Always numbered") | `agents-inc/runtime-globals/<n>` blocks (architecture step 6) |
| my-config-file-tests-own-process | `setUpEslintRunsInItsOwnProcess` in `typed-config-files.integration.test.ts` |
| my-packed-install-network | `packed-install.integration.test.ts` has no skip |
| my-dogfood-cli-loops | `function* changedFilesFrom` (`git-changes.ts`); `cli/init/package-json-edit.test.ts` |
| my-dogfood-temp-dir-runner | `runner:` in both packages' `vitest.config.ts` |
| my-dogfood-oxlint-stand-in | one stand-in, `oxlintFixRunWriting`, in both fix tests |
| my-dogfood-parse-names-messages | `rule-data/src/parse-names.test.ts` pins the messages |
| read-eslint-10-check | `refuseUnsupportedInstalledEslint` (`core/installed-eslint.ts`) |
| read-hooks-suppression-rule | `whenSuppressions` on `react-hooks/rule-suppression`; `canonical-list.test.ts` |
| read-init-ignores | `IGNORES` in `cli/init/config-text.ts` |
| read-test-runner-globals | `TEST_RUNNER_GLOBALS` (`core/framework-globals.ts`) |
| read-unused-suppressions | `findingsIn` filters by `isOnChangedLines`; ESLint's own fixes never apply (`eslintFixFilter`) |
| read-variants-by-name | `CVA_FUNCTION_SUFFIX` in `require-class-helper.ts` |
| q-dogfood-init-fitting-rulesets ("Keep listing every ruleset") | `listedRulesets` in `config-text.ts` |
| q-r2-switch-default → q-switch-default ("Leave it off") | nothing shipped; nothing to build |

**Nothing to build** (accepted as built, or moot): my-bugs-fixed-without-asking, my-covered-by-entry-rules, my-covered-by-test-files, my-deprecated-apis-twice, my-resolver-serves-team, my-split-pairs-team-double, q-void-arrow-twice, q-dogfood-library-types-readonly; moot per readings.md: answer-mts, folded. The 2026-10-14 page answers and the 61 of 2026-10-15 the audit marked built or nothing to build were not re-audited one by one; the six the audit marked not built or partly are in the tables above.
