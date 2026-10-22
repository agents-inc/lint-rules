# lint-rules

An opinionated oxlint + ESLint rule set from Agents Inc: one file to configure it, with each rule
routed to whichever engine runs it. `defineLintRules`, the merge functions for a team's own
configs, and the `agents-inc-lint` command (`check` and `init`) are built.

- [CLAUDE.md](CLAUDE.md): where the existing rules, their configs and their tests live in ai-benchmarking, and the rules for working here.
- [docs/plan.md](docs/plan.md): the plan, every decision so far, and what is still open.
- [docs/architecture.md](docs/architecture.md): the packages, the data flow, and how to change a rule.
- [docs/release.md](docs/release.md): how commits are written, and the checklist for releasing to npm.
- [packages/rule-data/data/rules.json](packages/rule-data/data/rules.json): the canonical list: every rule we ship, with its engine and what turns it on.

## Install

Not on npm yet ([before the first publish](docs/release.md#before-the-first-publish)).

```sh
npm install --save-dev @agents-inc/lint-rules
npx --no agents-inc-lint init
```

`init` writes `agents-inc.lint.mts` and prints the lines to add to your agents' instructions.

- **Beside ESLint 10, npm warns `ERESOLVE overriding peer dependency`** for ESLint plugins that do
  not list ESLint 10 yet. The warnings are expected, and the install succeeds.
- **ESM only.** An ESLint config that imports the package must be ESM, such as `eslint.config.mjs`.
  From an `eslint.config.cjs`, Node throws `ERR_PACKAGE_PATH_NOT_EXPORTED`, which does not say why.
