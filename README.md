# lint-rules

An opinionated oxlint + ESLint rule set from Agents Inc: one file to configure it, with each rule
routed to whichever engine runs it. `defineLintRules` and the merge functions for a team's own
configs are built; the runner and `init` are not.

- [CLAUDE.md](CLAUDE.md): where the existing rules, their configs and their tests live in ai-benchmarking, and the rules for working here.
- [docs/plan.md](docs/plan.md): the plan, every decision so far, and what is still open.
- [docs/architecture.md](docs/architecture.md): the packages, the data flow, and how to change a rule.
- [packages/rule-data/data/rules.json](packages/rule-data/data/rules.json): the canonical list: every rule we ship, with its engine and what turns it on.
