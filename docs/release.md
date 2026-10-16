# Commits and releases

Adapted from `~/dev/cli`'s commit protocol. Only `@agents-inc/lint-rules` (`packages/lint-rules`) is
published; the other packages are bundled into it ([plan](plan.md#monorepo-layout)).

## Commits

- **Conventional commits:** `<type>(<scope>): <subject>`. Types: `feat`, `fix`, `docs`, `test`,
  `refactor`, `chore`, `style`, `perf`.
- **The scope is the workspace:** `lint-rules`, `rule-data`, `eslint-plugin-house`, `work`
  (`docs/work/`) or `claude` (`.claude/`). No scope for the root workspace or the top-level docs.
- **The subject says what is now true:** `feat(rule-data): one canonical list routes every rule to
  an engine and a ruleset`, not `add canonical list`.
- **Generated output goes in its own commit,** `chore(<scope>): regenerate …`.
- **No Claude co-author line and no session link.**
- **Stage by explicit paths only,** never `git add -A` or `git add .`.
- **Git writes only when the owner asks in that turn** ([CLAUDE.md](../CLAUDE.md#git)).

## Release checklist

Every release does every step.

1. **Bump `version`** in `packages/lint-rules/package.json`, then run `bun install`; `bun.lock`
   records the version. Before 1.0: minor for a feature cluster or anything that breaks a
   consumer's setup (a new `error` rule fails their CI), patch for fixes only.
2. **Build and test from the root:** `bun run build && bun run typecheck && bun run test`.
   `npm publish` packs whatever `dist/` holds; `prepublishOnly` repeats this once added.
3. **Write `packages/lint-rules/changelogs/<version>.md`** in the [detailed format](#detailed-changelogsversionmd).
4. **Prepend the [summary block](#summary-changelogmd)** to `packages/lint-rules/CHANGELOG.md`.
   Every `###` subheading in the detailed file gets its own bullet there.
5. **Never edit an older entry,** in `CHANGELOG.md` or `changelogs/`.
6. **The release commit:** `chore(release): <version> — <summary>`, with an em-dash (`—`, not `-`),
   carrying `package.json`, `bun.lock`, `CHANGELOG.md` and the new `changelogs/<version>.md`.
7. **Push,** only on the owner's explicit yes.
8. **`npm publish` from `packages/lint-rules`,** only on the owner's explicit yes.

This repo has no ticket IDs. Where a change came from a [question](work/questions.md) or a recorded
decision, cite its number (`#38`) or label (`O6`).

### Summary (`CHANGELOG.md`)

```markdown
## [<version>] - <YYYY-MM-DD>

**One-line summary**

- Two or three highlights, each citing its source where it has one.

See [changelogs/<version>.md](./changelogs/<version>.md) for full details.
```

### Detailed (`changelogs/<version>.md`)

```markdown
# Release <version> (<YYYY-MM-DD>)

<One-line headline, with every question number or decision label shipped in parentheses>

**Before you upgrade.** <Only when the release breaks a consumer's setup: what they must change.>

## Added

### #38 — <title>

- What it does, with context.

## Changed

## Fixed

## Removed
```

A release that bundles several sources gives each its own `###` subheading. Then, when they apply
and in this order: `## Backlog` (questions opened or `plan.md` Open items this
work raised), `## Findings` (the `docs/work/` files written this cycle), `## Proposed standards`
(doc or standard changes recommended but not landed). Leave out an empty section.

## Before the first publish

`packages/lint-rules/package.json` is being changed by another lane right now, so these manifest
edits happen at the first release. Commands run from the repo root.

| Blocks the publish today | Check |
| --- | --- |
| `"private": true` | `jq .private packages/lint-rules/package.json` prints `null` |
| No licence: no `license` field, no `LICENSE` file | `jq .license packages/lint-rules/package.json`; `ls packages/lint-rules/LICENSE` |
| No README for the package | `ls packages/lint-rules/README.md` |
| `files` lists only `dist`. npm packs `README.md` and `LICENSE` regardless, but not `CHANGELOG.md` (measured, npm 10.9.2) | `npm pack --dry-run` in `packages/lint-rules` lists `CHANGELOG.md`, `README.md` and `LICENSE` |
| No `prepublishOnly` script, so `npm publish` packs whatever `dist/` holds. At the first release add `"prepublishOnly": "bun run build && bun run typecheck && bun run test"` (the package's own scripts, so it runs from `packages/lint-rules`) | `jq .scripts.prepublishOnly packages/lint-rules/package.json` |
| No `publishConfig`. A scoped package publishes as restricted unless its access is public | `jq .publishConfig packages/lint-rules/package.json` gives `access: "public"` and `registry: "https://registry.npmjs.org/"` |
| No `repository` field | `jq .repository packages/lint-rules/package.json` names `https://github.com/agents-inc/lint-rules` with `directory: "packages/lint-rules"` |
| The `@agents-inc` npm scope must exist, and the publisher must belong to it | `npm whoami`; `npm org ls agents-inc` lists that user |
| `@workspace/rule-data` and `@workspace/eslint-plugin-house` are never published, so they must be inlined into `dist` | `deps.alwaysBundle` in `packages/lint-rules/tsdown.config.ts`; `dist.test.ts`; `packed-install.integration.test.ts` ([questions](work/questions.md) #58) |

Also before publishing: the `npm audit` advisories and the packaging problems (#38) in
[plan](plan.md#open)'s Open list.
