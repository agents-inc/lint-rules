# Changelog

All notable changes to this project will be documented in this file.

Each release has detailed notes in its own file under [`changelogs/`](./changelogs/). This file serves as a summary index.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
