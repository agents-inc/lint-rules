# Changelog

All notable changes to this project will be documented in this file.

Each release has detailed notes in its own file under [`changelogs/`](./changelogs/). This file serves as a summary index.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-11-03

**Ten more ESLint plugins and the rules accepted on 11, 24 and 28 October ship at `error`, the round-2 critique regroups rules, oxlint runs 36 more, and a team config names only rules we ship**

- #83: nine more ESLint plugins are pinned dependencies; eslint-plugin-drizzle-security stays out.
- owner-2026-10-11: the rules accepted on the old candidates page ship, `house/no-reduce-accumulator-copy` in `performance` among them.
- 2026-10-24 rule-candidate cards (`rc-…`): zod, TanStack, Playwright, e18e, shadcn and four core rules ship.
- q-lint-jest-dom-without-jest-dom: `jest-dom` is opt-in and ships seven rules, their fixes withheld.
- q-lint-react-ssr-in-client-apps: `react-ssr` is opt-in and ships four hydration rules.
- q-lint-compat-default-target: `compat/compat` ships in `browser-targets`, at Vite 8's build target.
- q-lint-effect-ruleset-name: a new `effect` ruleset holds `house/no-manual-effect-error-tag`.
- q-lint-rc-duplicate-disable-measured: three eslint-comments rules ship in `comments`, run where suppressions are allowed.
- q-lint-pw-off-by-default-where: 18 rules ship off by default, on where `rules` names them.
- #7: the round-2 critique moves 23 shipped rules between rulesets.
- q-lint-slice2-autofix: oxlint runs 36 more rules; 18 stay in ESLint, each naming its card.
- q-lint-unshipped-rules-channel: `rules` and `fileOverrides[].rules` refuse a rule we do not ship (#4).
- q-lint-oxlint-null-options: the editor merges refuse a null oxlint refuses, naming the file.
- q-lint-presence-queries-attribute-fix: `check` reports and never rewrites eight rules whose fixes broke jsdom tests.
- q-lint-jd-editor-fixes: editors get no fix and no suggestion for a rule whose fix `check` withholds.
- q-lint-cmt-editor-reach: editors run a rule only where `editorRulesets` lists its ruleset; `ban-ts-comment` moves into `type-safety`.
- q-gap-lint-ts-comment-message: where `@ts-expect-error` is banned too, a `@ts-ignore` is told to fix the type error.
- q-gap-lint-a11y-original-prefix: the editor merges read more of a team's plugins and oxlint overrides as the team's.
- q-gap-lint-unused-vars-scripts-config: `no-unused-vars` checks `scripts/` and `*.config.*` files.
- q-lint-setup-files-which: test setup files get test files' rules.
- q-lint-compat-stale-data-warning: `check` silences browserslist's old-data message.
- q-gap-lint-typescript-eslint-version: every typescript-eslint package a user's install reaches is listed at 8.71.2.
- q-lint-own-published-types: the merges take a read-only `theirs`.
- Tests: a proof per engine for every shipped rule, and no test calls what can throw while vitest collects it.
- Tooling: the mutation round script, the leftover-Stryker report and the typecheck of the root lint configs.
- Refactor: the repo passes its own lint, with no change in behaviour.
- q-lint-own-gate-per-file: `functional/prefer-immutable-types` answers each call afresh.
- q-lint-immediate-return-using-fix: `sonarjs/prefer-immediate-return` leaves a `using` variable alone.
- q-lint-barrel-entry-how: `unicorn/no-barrel-files` skips `src/index.*`.
- q-lint-check-no-config-folder-twice: `check` names the folder once.
- check labels oxlint's react-hooks findings as react-hooks/…, as ESLint's are.
- check survives a changed file deleted while oxlint runs, keeping oxlint's other findings.
- `plugins: null` in a team's oxlint config: both merges read it as oxlint does.
- Globs cover every JS and TS extension: `.mts`, `.cts`, `.mjs` and `.cjs` test files, and stories.
- #7, r2-d68, q-lint-useless-spread-fix-when-on: four rules no longer ship.

See [changelogs/0.3.0.md](./changelogs/0.3.0.md) for full details.

## [0.2.0] - 2026-10-23

**A rule the team's oxlint config states is the team's even in a line oxlint skips, and our typed blocks ask per file whether a tsconfig takes it in**

- O5 (LD-O5b): a line of the team's oxlint config makes the rule the team's even where oxlint skips it, so both our parts drop it.
- O7 (LD-O7b, q-lint-o7-cast): our typed blocks ask, as ESLint lints each file, whether a tsconfig takes it in, so a TS file made after the config loaded needs no restart.
- status.md rows 14, 16 and 17: exhaustive switches end in a `never` default, `RuleRoute` is a union on `engine`, and `oxlintCodeOfRule` cuts names with `ruleNameOf`.
- Tests: the CLI's folder walk, package-manager pick, config lookup, command parsing and changed lines have unit tests, and two Stryker gaps on the O5 and O7 lines are closed.
- status.md row 15: `house/hook-file-naming` counts `export enum` and `export namespace` as values, as it does `export class`.

See [changelogs/0.2.0.md](./changelogs/0.2.0.md) for full details.

## [0.1.1] - 2026-10-22

**The specs catch what Stryker's mutants on the rounds' changed lines showed they missed; no behaviour change**

- Tests: nine spec files gain the cases that kill those mutants; `learnings.md` records the ones left alive and why.

See [changelogs/0.1.1.md](./changelogs/0.1.1.md) for full details.

## [0.1.0] - 2026-10-22

**`check` runs its own pinned ESLint and oxlint, and deleting a one-line banner no longer runs code together**

- #24: `eslint` 10.12.0 and `oxlint` 1.87.0 are pinned dependencies rather than peers, so `check` runs whatever ESLint and oxlint a project installs, ESLint 9 included.
- #73: the README's new Install section says the package is ESM only.
- q-npm-peer-warnings: the README says the two `ERESOLVE` warnings npm prints beside ESLint 10 are expected.
- Expressive-TypeScript rounds 1–3: the three packages read as named steps and shared helpers, with no change in behaviour.
- Tests, tooling and docs: `it.fails` suites read their runs in a `beforeAll`, the packed-install test survives `npm publish --dry-run`, the rounds' gaps have tests, and the typecheck covers `scripts/`.
- `no-section-banner`: deleting a one-line banner between code adds a space where the code either side would read as one token.

See [changelogs/0.1.0.md](./changelogs/0.1.0.md) for full details.
