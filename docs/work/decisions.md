# Decisions (my working instructions)

Maintained as I go. Overrides my defaults; `CLAUDE.md` and `docs/plan.md` still rule.

## How I work (owner, 2026-10-10)
- Implement. Tests first, watch them fail, then code.
- Docs: only necessary learnings and findings. No doc sprawl. `docs/work/*` stays terse.
- Workflows: sensible and small. No re-testing the same thing with many agents. One verifier where
  a claim is risky, none where it is cheap to check myself.
- Track progress in `status.md`; open questions in `questions.md`; facts in `learnings.md`.
- No docs that mirror the whole app (not the `~/dev/cli` `.ai-docs` style). Document only the
  architecture and crucial flows, in one `docs/architecture.md`, written as each piece lands and
  kept true as it changes.

- Every brief says: run shell commands directly, with absolute paths. No `bash -c "…"`/`sh -c`
  wrappers and no `cd … &&` inside quoted strings: the permission checker cannot read them and
  stops the run for a human.

## Build decisions
- Slice 1: scaffold, `rule-data` canonical list, `defineLintRules`, `oxlintConfig`, `eslintConfig`.
- Runner and `init` wait for the owner to name their CLI surface (CLAUDE.md: ask before user-facing).
- Ruleset names and assignments come from data (`rulesets.json`); code never hard-codes them.
- house rules keep typescript-eslint's types. rule-data's load-time check (`checkedPlugin`) is the parse
  boundary that turns any plugin into an ESLint plugin: no cast. (Lane C's option A.)
- Porting house comments: keep a rule's purpose as `meta.docs.description`; drop measurements and history.
- The runtime plugin registry is `prefix → plugin`; npm package names live in a separate table for the
  generator and tests, so no private package name reaches `dist/`.
- `settings.react.version`: `detect` where React resolves from `tsconfigRootDir`, else `999.999.999`, the version eslint-plugin-react assumes when detection fails, given outright so it prints nothing (spec-core.md C13).
- ESLint test assertions on calculated config compare severity only: ESLint fills defaults and keeps
  earlier options when a later block gives a bare severity.
- turbo's `AGENTS.md`: opt out (`agentGuidance: false`) and delete it.
- Generator runs under `node` (bun 1.2.6 cannot load the plugins).
- An entry's own `rules` keep the rule's shipped `files`/`ignores` (AND with the entry's globs), as the
  top-level `rules` do: softening a rule never widens where it runs.
- Extras guards refuse every spelling an engine accepts for one of our rules (oxlint: `eslint/x`, bare,
  `typescript/x`, `typescript-eslint/x`, `eslint-plugin-*/x`, …), whichever engine runs the rule.
- A rule whose canonical name differs from oxlint's (`unicorn/no-for-each` = oxlint `no-array-for-each`,
  `unicorn/dom-node-dataset`) runs in ESLint, so one suppression comment works in both engines.
- The three files a consumer writes for us (`agents-inc.lint.mts`, `oxlint.config.mts`, `eslint.config.mjs`)
  must pass our own rules: `unicorn/no-top-level-side-effects` and `perfectionist/sort-objects` ship with
  `ignores` for them (real run: both fire on plan.md's verbatim files).
- Config errors name the file to fix (`agents-inc.lint.mts: …`, `oxlint.config.mts: …`, `eslint.config.mjs: …`).
- Owner 2026-10-10: consumer config files are `agents-inc.lint.mts` and `oxlint.config.mts`; `eslint.config.mjs`
  imports `./agents-inc.lint.mts`. Every mention of the `.ts` names (data ignores, allowDefaultProject,
  error-message prefixes, fixtures, plan.md) follows.
- Owner 2026-10-10: `no-use-before-define` ships off (hoisting is the house style). It leaves the canonical list.
- Scripts (owner delegated): `lint:oxlint` = `oxlint`, `lint:eslint` = `eslint .`, `lint` = `run-s --continue-on-error
  lint:oxlint lint:eslint`; `lint:fix:*` twins with `--fix`, `lint:fix` likewise (oxlint first). Consumer devDependency
  `npm-run-all2`. Interim until the runner exists.
- Overlapping fileOverrides: an entry re-states only the lists it gives (runtimes, libs, quality, languages);
  a list it leaves out keeps whatever earlier entries set for those files, as the engines layer blocks natively.
- The consumer config files (`agents-inc.lint.mts`, `oxlint.config.mts`): their names have one source, exported by
  rule-data.

## Superseded (old → new → why)
- `settings.react.version: 'detect'` everywhere → only where React resolves → in a project without React, `detect` printed eslint-plugin-react's warning on every run (spec-core.md C13).
- "Each entry re-states every rule and runtime an earlier entry changed" → re-states only the lists it gives
  → a rules-only entry must not undo an earlier entry's runtimes (implementer's reading, owner-reviewable).
- Consumer files `.ts` + `allowDefaultProject` → `.mts` + left out of the typed block → owner chose `.mts`;
  `allowDefaultProject` is a fatal parse error when the tsconfig also includes the file.
- Consumer config files left out of the typed block → our typed rules where a tsconfig takes them in → owner
  2026-10-14, typed-config-files (architecture.md step 8; plan.md Corrections).
- Owner 2026-10-10: `house/hook-file-naming` is configurable: `{ filenameCase: 'camelCase' | 'kebab-case' }`, default `kebab-case`.
- Owner 2026-10-10: the agents-inc completion gate (Stop hook running `typecheck`) is removed from `.claude/agents/*.md`.
  It is emitted by `~/dev/cli/packages/compile/src/agent-source.ts` (`completionGateHooks`), so a recompile restores it.
- Suppression known gap: when no extras block registers a prefix holding oxlint-only rule names, register a copy of
  our plugin with do-nothing stubs for them (never mutate a plugin). If extras register that prefix, the gap stays.
- Owner 2026-10-10 rule changes (measured, scratchpad/investigate-rules/):
  - Classic loops banned, `for…of` allowed: new `house/no-classic-loops` (declarative) replaces `functional/no-loop-statements`.
  - Dropped: `house/prefer-arrow-callbacks` (core `prefer-arrow-callback` covers it; house only added false reports),
    `no-eq-null` (eqeqeq covers it), `oxc/approx-constant` (unicorn/prefer-math-constants catches more, no type-position FPs),
    `unicorn/prefer-type-literal-last` (replaced by perfectionist `sort-union-types` groups with object types last).
  - Kept: `react-hooks/hooks` and `react-hooks/rules-of-hooks` (each catches cases the other misses), `react-hooks/rule-suppression`.
- Owner 2026-10-10: Ralph Loop plugin re-enabled (a sub-agent had disabled it globally without a brief).
- Owner 2026-10-10: suppression comments are banned. New `house/no-suppressions` reports every eslint-disable*,
  oxlint-disable* and inline rule-config comment; `@typescript-eslint/ban-ts-comment` bans `@ts-expect-error` too.
  Both are ALWAYS ON: in no ruleset, so removing rulesets never removes them; a user may still turn either off
  explicitly in `rules` (owner: "it can be disabled in the lint config of a user"). A shipped rule now has either a
  ruleset or `alwaysOn: true`, never both. Stubs for oxlint-only names stay (they matter once a user turns the ban off).
- Owner 2026-10-10 (round of answers on candidates and suppressions):
  - A house rule requiring a class helper: className/class must be a literal, an identifier/member/lookup, a prop,
    or a call to a configured helper (default cn, clsx, cx, cva, twMerge); template literals, concatenation and
    inline ternaries are reported. Measure false positives before shipping.
  - `allowSuppressions: boolean` (default false) in agents-inc.lint.mts and per fileOverrides entry. true = house/no-suppressions
    off, inline config read again, `@ts-expect-error` allowed with a description (`@ts-ignore`/`@ts-nocheck` stay banned),
    and `unicorn/no-abusive-eslint-disable` on. false = the ban on, that unicorn rule off (no double report). The managed
    rules are not settable in `rules` (one place to control it). Engine files may still set `noInlineConfig` either way.
  - `no-unreachable-loop`: enable (correctness, oxlint).
  - `shadcn/no-arbitrary-values`: too early; kept in the considering list. `shadcn/no-raw-colors`: a strict opt-in
    candidate, waiting on an opt-in category design.
  - A durable list of rules under consideration (one state per rule: shipped, considering, or neither).
- Owner 2026-10-10, consumer model: AGENTS ONLY to start. A consumer adds the package and `agents-inc.lint.mts`;
  nothing else of theirs changes (editors, CI, their own configs, scripts, suppressions). Only sub-agents run our
  rules, through the runner, on the lines they change (whole file when created/refactored).
- Owner 2026-10-11, after options 1–5: the runner builds both engine configs itself each run (option 1). ESLint's via
  the Node API, oxlint's as a temp file it deletes. No env-var switch, no engine files of ours.
  Install = devDependency ("a dep is better"); `agents-inc.lint.mts` imports from the package as today. Rejected and
  why: plan.md "Considered and dropped" (npx with no install, types file, types at the bottom, JSON+$schema, Claude memory).
- Owner 2026-10-11 answers: the runner brings its OWN eslint + oxlint (deps, not peers). Runs ONLY our rules (project
  rules could conflict); a consumer adds any rule we support via `rules`. Changed files/lines come from `git diff`
  inside `check` (agent passes no ranges). Commands: `init`, `check` (`check` from the owner's "check.ts command").
- Owner 2026-10-11: agents fix their own code (instruction only; `check` filters nothing). `check` = changed lines from git,
  NO whole-file option: the owner tells agents when to redo a whole file.
- Owner 2026-10-10 (missed until 2026-10-11): TWO sets, `agentRulesets` (what `check` runs) and `editorRulesets` (exported;
  a team imports it into its own ESLint and oxlint configs). `rulesets` is renamed. Open: #30 (overlap, ESLint-only teams, init's default).
- Owner 2026-10-10: opt-in rulesets (option A): a ruleset flagged opt-in is listed only in a comment by `init`.
  First one: `strict-design-tokens` (libs.styling, needs Tailwind), starting with `shadcn/no-raw-colors`.
- Open: runner shape (a command, an exported runner a consumer's own .mts file calls, or both). Suggested: both.

## Superseded (2026-10-11)
- "`oxlintConfig`/`eslintConfig` stay public for teams that opt humans in" (my reading) → owner confirmed 2026-10-11: exported.
- Interim `lint` scripts (`run-s … lint:oxlint lint:eslint`, npm-run-all2) as what `init` writes → dropped: agents only.
- "No `editorRulesets`" (my inference from the agents-only message, 2026-10-10) → the owner's two sets. Never the owner's call.
- Owner 2026-10-11 proposal (feasibility answered, build not yet asked): editor export returns `{ eslint, oxlint }` from `editorRulesets`;
  oxlint part only if the project's package.json lists oxlint, else ESLint takes the oxlint-run rules it has. Agent told to redo a
  whole file handles it itself; nothing in `check`.
- Owner 2026-10-11: if adding our part to a team's config can't avoid "Cannot redefine plugin", `eslint`/`oxlint` are functions the team
  calls in each config with its own config; they merge and dedupe. File shape: only `rulesets` → `agentRulesets` + `editorRulesets`,
  and `export default` → `export const { eslint, oxlint }`; nothing else changes. Relayed to the spec agent.
- Owner 2026-10-11 (corrects the line above): `const config = defineLintRules({ … })` then `export const { eslint, oxlint } = config.editorRulesets`.
  Exports come from the editor rulesets, not the whole config. No default export, no other export. Relayed to the spec agent.
- Owner 2026-10-11 (corrects the two lines above): `eslint`/`oxlint` are VALUES (the editor set's rules per engine), not functions.
  Each team config imports a merge/dedupe function from our package that takes theirs and ours. Name not chosen yet. Relayed.
- Owner 2026-10-11: names are mine to pick, changeable later: `mergeEslintConfig(theirs, eslint)` from `@agents-inc/lint-rules/eslint`,
  `mergeOxlintConfig(theirs, oxlint)` from `@agents-inc/lint-rules/oxlint`. Spec defaults D1–D6 and Q4/Q5/Q7 recommendations applied.
  Owner away for hours: build fully, collect questions in questions.md, continue until nothing is left without owner input.

- Owner 2026-10-11: the candidate rules (~150) wait for the owner's approval. Adopt none; the page only lists them for review.
- 2026-10-11 (mine, while the owner is away; revertible, questions.md #41–#43): a rule either editor part states is decided only by
  us, so every other ESLint name of it in the team's config goes off, typescript-eslint twins included (#41) and also when we
  state it `off` (#42); a team oxlint config extending a file by path gets no extra `off`s (#43). Our typed ESLint rules run only
  where the team's own config gives type information.
- 2026-10-11 (mine, replaces the twin part of the entry above): typescript-eslint twins are a different rule, so the team's twin goes
  off only where ours runs, both directions, and our `off` leaves it alone (#41, #42). Same-rule names keep "ours decides everywhere".
- 2026-10-11 (mine, #44–#46): the oxlint merge changes nothing for rules we don't state (each file gets what the team's config
  alone gives, checked against the oxlint CLI); a team plugin registered under another prefix is recognised as ours by its object.
- 2026-10-11 (mine, round 5): the oxlint merge reads a team's rule keys the way oxlint 1.87 does (`parse_rule_key`: package-name and
  alias prefixes, `@`-scoped keys cut at the last `/`, a bare key resolved in oxlint's plugin order, an unknown prefix is a JS
  plugin's rule). A plugin we register is recognised under any team prefix by its object or meta name, except where that prefix
  already holds a name our own blocks state (#45).
- 2026-10-11 (mine, round 6, applies #42): a plugin that registers one rule module under two names (@eslint-react's
  `no-missing-key` and `x-no-missing-key`) is one rule with two names, so the other name is a same-rule name.
- 2026-10-11 (mine, round 6): beside a config the team extends by path, our catch-all's statements whose plugins count nowhere
  else are repeated under each team listing override (same files, excludes, plugins), so our `off` holds there (D2). The extra
  react findings when the extended file lists no plugins (D1) can't be fixed without reading that file: pinned as a known gap;
  refuse / read / keep goes to the owner (#43).
- Owner 2026-10-11 (questions page, sweep in progress; to apply together once the sweep ends):
  #30 install the four ESLint plugins teams without oxlint lack ("an eslint version of all oxlint rules so that there is no diff
  if you have no oxlint"). #32 Q4: without oxlint, run typescript-eslint's version of the 8 skipped core rules on TS files (asked
  why oxlint matters). #32 Q7: keep refusing an unsupported oxlint, but the range "should be as large as possible". #32 D6, D3, D5
  confirmed. #32 D4 reversed: "theirs should override whenever there is a conflict". #32 D2 reversed: turning a rule off for agents
  doesn't turn it off for editors ("they are separate configs"). #32 D1: a package whose own package.json lacks oxlint uses ESLint
  even when the monorepo root lists oxlint. #34: asked why Node 22.18.
- Owner 2026-10-11 (questions page, continued): #36 (b) typed rules only on files the tsconfig includes (fixes #3 too). #39 keep
  no-loop-func and no-loss-of-precision ("prefer the ts eslint rules over the non-TS eslint rules"). #40 stop at the first match.
  #41 the team's twin off only where ours runs. #42 reversed: "the rules we switch off in our config (editor or agent) don't impact
  the engine specific configs, it just says ours off". #43 keep ("we just give a merge function to merge rules and dedupe; if
  they import other rules or configs that's none of our concern"). #44 team's results unchanged.
- Owner 2026-10-11 (chat): "changes inside engine specific configs override our editor rules as theirs land after ours from the
  merge. The agents config isn't influenced by the users engine specific configs." My reading of all answers, and what stays open
  (whether `rules` reaches the editor set; Node floor via a plain-JS config), is on the questions page (version 2).
- Owner 2026-10-11 (questions page, second sweep): `rules` reaches both of our sets and the exported editor config, and never
  overrides a consumer's engine-specific rules (O1/#52 settled). Keep `agents-inc.lint.mts` (asked why `.mts` over `.ts`).
  Modern-js 8: leave on ("doesn't the whole lib require 22 anyway?" — re-asked: the fixes need APIs Node 22 lacks). Explorer
  folder "will be removed". `init`/`check`: no flags. #9: remove the stop hook from generated sub-agents (a ~/dev/cli change).
  #22: report a bare `// eslint-disable` with house/no-suppressions where suppressions are allowed. #23: ship
  house/require-class-helper with classNames/classnames added; keep reporting two-class ternaries. #30: `init` writes no editor
  rulesets, with a comment saying to add them; agent rulesets default to all except strict design tokens (the opt-in ruleset).
  #33: add the TypeScript resolver (fix C). #35: no duplicate reports wanted; settle every pair in ruleset round 2. #47: env
  follows the same rule as everything else: theirs where they set it, ours where they don't. #49: later. #50: a committed
  break-a-line check, but it belongs to agents-inc: document as a follow-up (how agents-inc shares it across projects, plus a
  prompt adding it to the SDLC). #51: add all three test standards to CLAUDE.md, plus the break-a-line-and-assert-a-test-fails
  step. Candidates: the owner reviews them one by one on the candidates page.
- Owner 2026-10-11 (questions page, third sweep): use eslint-plugin-jsx-a11y-x (ESLint 10 fork) in place of eslint-plugin-jsx-a11y.
  Ship the 8 modern-js rules off for now; to-do: later, a category for the newest language features, enabled by Node version.
  Without oxlint, run unicorn/no-chained-comparison and unicorn/no-double-comparison in place of the two oxc rules.
  Newer oxlint: "outside this range, yes, just check if these rules are still valid" — my reading: a version outside the tested
  peer range is not refused for its version; it is checked against the installed oxlint's own rule list and refused only when a
  name the merge writes is missing. All four land after the running build (wf_ec970377-570), with the next batch.
- Owner 2026-10-11 (candidates page note): "It's not bad that some lines will have multiple rule violations as long as they're not the same
  violations." Only two rules reporting the same problem count as a duplicate; rules reporting different problems on one line stay.
  Candidates: "if this is already covered, don't add it".
- 2026-10-11 build `wf_ec970377-570` review (orchestrator, from the owner's answers). Code comments cite these labels.
  - D1: the cross-engine off (Q-C) applies only in files where our part for the other engine runs the rule: never in files
    our `ignores` match or where our own per-file settings turn it off. It exists only to stop double reports (#35, q35 "no
    duplicated reports"); where ours does not run there is no double, and D-a/#44 say the team's rules stand there. Where the
    team's own oxlint config turns the rule off, the ESLint copy stays off for now: fixing that needs the ESLint merge to read
    the team's oxlint config (questions.md #57).
  - D2–D5, test expectations corrected under #44 (delete no team entry) and #39. D2: "holds none of the options…" becomes
    exactly `[0,'disable-absolute-first']` (ESLint keeps the team's options under our later severity-only off). D3: the
    `require-await` row is a typescript-eslint extension on TS files. D4: the `disableTypeChecked`-first test uses a team block
    that only switches type information off (the team's own `off` wins under the contract). D5: lane C's two wrong tests.
  - D6: the stale callers pass an empty list.
  - D7: peer `oxlint: ^1.86.0` (D-d; C-3 passed by the real run's route).
  - D8: `engines` narrowed to the Node versions ESLint 10 supports as well (`^22.18.0 || >=24`; Node 23 gets EBADENGINE from
    ESLint). The root `package.json` describes the dev setup and keeps `>=22.18`.
  - D9: twin pairs (#39, #41, q35): the highest layer stating either name decides the setting; the extension runs on TS files
    and the core rule on JS files, never both in one file. If that setting is the extension's and the core rule refuses its
    options, the core rule on JS keeps the setting from the layer below.
- 2026-10-12 fix round 1 review (orchestrator, from D9, q35 and "`rules` reaches both of our sets"):
  - D10: D9 holds beside oxlint too. Where our layers state both twins and oxlint runs one of the names, the highest layer
    stating either name still decides the setting in both engines, and each file reports the pair once. Which engine runs it
    in a file follows the beside-oxlint model (O6: what our oxlint part runs, ESLint's copies off there). Found by
    `probe-d9-beside-oxlint.mts`: one five-parameter function reported twice, max 2 from ESLint and max 4 from oxlint.
  - The cross-engine off (D1) and our own rules read "where our part for an engine runs" with that engine's own reading of
    our `ignores` (ESLint's global ignores, oxlint's ignorePatterns, negated lines included) and that engine's file types.
    Each merge kept its own copy of that reading and the test oracles shared it, which produced F2 and then D1's
    trailing-slash, negated-line and `.vue` defects: fix round 2 replaces the copies with one reading checked against the
    real engines.
- 2026-10-12 fix round 2, after its tester and developer (orchestrator):
  - D10 covers the agent build too (q35): with oxlint, the agent build also reported the five-parameter function twice
    (max 4 from oxlint, max 2 from ESLint).
  - Beside oxlint, a twin pair runs where O6 puts it: oxlint runs the core rule and ESLint's copies are off there, so the
    test expecting the typescript-eslint `no-unused-vars` in ESLint beside oxlint now owes `off` (D10).
  - The cross-engine off follows each oxlint rule's own file types (oxlint's `no-unused-vars` reports nothing in `.vue`,
    `.svelte` or `.astro`), so it can be several numbered blocks; the block-order test owes them (G2).
  - Which file types each oxlint rule runs on is rule data: it lives in `packages/rule-data`, not in `src/core`
    (names-no-rule guard), and is checked against the real oxlint.
  - A leading `./` and a trailing-slash folder in our `ignores` mean different files in the two engines: question #62.
    Meanwhile each engine keeps its own reading (as F2), in the agent build and the merges alike.
- 2026-10-12 fix round 2, after its developer (orchestrator, from D9 and D10):
  - D11: no config we write gives oxlint options its rule refuses. Where a twin pair's decided setting carries options oxlint's
    copy refuses (`@typescript-eslint/no-redeclare` with `ignoreDeclarationMerge`), ESLint runs that setting there (the
    extension, on TS files) and oxlint's copy is off there; on JS files D9's refusal clause holds, run where O6 puts it. Found
    by `d10-refused-option.mts`: oxlint refused the whole config, in the agent build and the editor merge.
  - No block we write makes ESLint lint a file it would not lint without our part: the cross-engine off fell back to `files`
    for an entry over `**/*.ts` and `**/*.vue`, and ESLint failed to parse the `.vue` files. A bug, fixed in this round.
  - The shared ESLint reading missed a take-back (`['**/legacy/**','!**/keep/**']`, `keep/legacy/a.js`): a bug, fixed there.
  - Components with a plain `<script>` count as TS until the owner answers #63. The oxlint reading takes too much back in 10
    of 39 measured values: a limit, pinned.
- 2026-10-12 fix round 2, after its review (orchestrator, from D1, D9, D11 and q35):
  - D12: a twin pair is one rule for the cross-engine off too. Where our ESLint part runs a typescript-eslint extension, the
    oxlint merge turns the team's oxlint copy of the core rule it extends off there, as the ESLint merge's twin switches do on
    their side. Found by the review: one finding from both engines in `stories/x.stories.ts` (before this round too) and in
    `legacy/a.ts` (D11).
  - D11 also covers an option oxlint accepts but does not honour (`class-methods-use-this` with
    `ignoreClassesThatImplementAnInterface`, measured by the fix developer): it counts as refused, so the decided setting is
    never silently dropped. Measured per extension-only option of the twin pairs and kept as rule data.
  - D11 in `.vue`, `.svelte` and `.astro` files: our ESLint part does not lint them, so oxlint's core rule keeps the setting
    from the layer below there (the fix developer's choice, accepted).
  - The shared reading takes the same ignore list each engine is given, the agent build's additions (`**/node_modules/**`)
    and ESLint's default ignores included: our oxlint rules ran in `node_modules` in the editor merge (a round-2 regression).
  - A consumer's own options that oxlint refuses (`eqeqeq: ['error','allow-null']`) still make oxlint reject the whole config,
    as before this round: question #64.
- 2026-10-12 fix round 2, after its second review (orchestrator):
  - In the editor merges our `ignores` are not global (D-a), so ESLint's default ignores hold there whatever our negated lines
    say: the editor's ESLint reading puts the defaults after our ignores. With `['!node_modules/','node_modules/*',
    '!node_modules/mylib/']` the team's oxlint finding in `node_modules/mylib/a.js` was lost. The agent build, where our ignores
    are global, lints that file and the editor cannot: a limit, pinned.
  - Our editor-merge block names stay as they were (`agents-inc/base` holds the base rules). Keeping our rules out of ESLint's
    default ignores must not rename or empty our blocks: the `…/confined/<n>` copies were a change to what a user sees in the
    config inspector that nobody asked for.
  - A fix-only option (`no-unused-vars` `enableAutofixRemoval`) counts under D11: the decided setting includes what its fix
    does. Options are matched by key, so an extension-only option set to its default also moves the setting to ESLint:
    correct, a little slower, accepted.
  - D12's reverse (the team's type-aware oxlint extensions where our ESLint part runs the core rule) is not built: without
    type-aware oxlint, which is not installed, they report nothing, so no double report can be measured. A limit.
  - Process ("a loop that keeps firing is evidence"): three reviews running stopped on the developer's own new decision points
    having no test, though the developer's breaks had already found them. Each fix round now has a guards step after the
    developer that covers every developer break changing findings, before the review.
- 2026-10-13 fix round 2, after its closing developer (orchestrator):
  - Block names: kept in the usual case. Only where the team's ESLint takes files back from ESLint's defaults are our blocks
    still split into `…/confined/<n>` copies: `ignores` on the base block would also stop our parser and plugins there.
  - A team block whose `basePath` lies outside the project root is read as reaching no file, though ESLint applies it to every
    file (measured): a bug in how we read the team's config, there before this round; fixed in the next round, not this one.
  - The mirror of #57 (the team's ESLint global ignores leave `dist/` out, so the team's oxlint copy we turned off there is
    lost) needs the oxlint merge to read the team's ESLint config: question #65.
- 2026-10-13 fix round 2, after its closing review (orchestrator):
  - The review's last must-fix is a missing test only (`holdsANegatedGlob`: no input tells "any negated glob" from "every"). A
    tester adds it, checks every any/every decision of the round the same way, and I verify with the uncached gate and the
    break results; no further review round (CLAUDE.md: a simple fix with no knock-on effects skips review).
  - Proposed standard, the owner's to approve (a CLAUDE.md change): a test of an any/every (and/or) decision includes an input
    where the two give different answers. Fourth review running to stop on an untested direction of a new decision.
- 2026-10-13 fix round 2 closed (orchestrator): the closing tester broke all 43 any/every and and/or decisions of the round; 9
  untested ones now have tests, 8 change no finding or cannot be reached (measured). My uncached gate passes. Known gaps stay
  pinned (it.fails): the reading limits, the nested `.git` loss, #63. Open for the owner: #57, #60–#65, the test standard.
- 2026-10-14 real run 3 (setup and merges lanes; reports in scratch-backup/real-run/<lane>/report.md), triage (orchestrator):
  - Bugs, fixed in fix round 3 (tests first):
    - A top-level set (`agentRulesets`, `editorRulesets`) with a list left out means that list is empty, as inside a
      `fileOverrides` entry. plan.md's `editorRulesets: {}` (what `init` writes, #30) crashed both engines ("quality is not
      iterable"), and `{}` is also a type error today.
    - `tsconfigRootDir` is checked when the config is defined: required, an absolute path, an existing folder; otherwise an
      error naming `agents-inc.lint.mts`. Left out it gave a raw TypeError; `'.'` gave every TS file a parse error blaming
      `parserOptions`; a missing folder blamed `package.json`.
    - A twin pair named in one layer with different settings, beside oxlint: TS files keep the TypeScript version's setting
      (D9, D10; D11 where oxlint refuses its options). oxlint applied the plain rule's setting to TS files (case O2d); a code
      comment called it a limit, but no decision did.
  - Owner questions #66-#74 (questions.md). Known items hit: #35 (three new duplicate pairs, for ruleset round 2), #57,
    #62, #64, #65, #38.
- 2026-10-14 real run 3, scale lane (report scratch-backup/real-run/scale/report.md; 35 cases: 21 pass, 5 fail, 5 known,
  4 undocumented), triage (orchestrator):
  - Bugs (false reports on valid code), fixed in fix round 4 after round 3:
    - Svelte 5 runes (`$state`, `$props`, `$derived`, `$effect`, `$bindable`) are globals in `.svelte`, `.svelte.js` and
      `.svelte.ts` files: oxlint's `no-undef` reported them in every Svelte 5 component (30 of 31 findings in one repo).
    - `n/no-unpublished-import` must not read a tsconfig path alias (`@/…`) as a package (9 false reports in one repo).
  - The 17 new duplicate pairs (R-ALL-5) join ruleset round 2 with the other #35 pairs.
  - For `check` (not built): its temporary oxlint config goes inside the project, since oxlint resolves `ignorePatterns`
    against the config's folder (R-TUR-4: written to the OS temp dir, a user's root-relative ignores stopped working).
  - Owner questions #75-#77.
- 2026-10-14 fix round 3 closed (review: ship). From its review, into fix round 4: beside oxlint, a layer naming both twins
  with the plain rule `off` still got the TypeScript version on JS files in ESLint; D9 says the plain rule decides JS files, so
  it is a bug (pinned it.fails, now to fix), not a new question. The `tsconfigRootDir` refusal tests pin the full messages.
- 2026-10-14 fix round 4 closed (review: ship; reports scratch-backup/fix-round-4/round/). From its review (orchestrator), into
  fix round 5:
  - Svelte rune globals apply to every file Svelte itself treats as a rune module: a name containing `.svelte.` and ending
    in `.js` or `.ts` (so `counter.svelte.test.js`, the pattern Svelte's testing docs use).
  - The Svelte block and override stay in every config, Svelte project or not: they reach only Svelte file names.
  - `settings.n.tryExtensions` is ours only where the team sets neither `settings.n.tryExtensions` nor the older
    `settings.node.tryExtensions` (O8: the team's non-rule keys win where set).
  - Framework globals, the same class as the runes: Vue's `<script setup>` compiler macros in `.vue`, Astro's `Astro` in
    `.astro`, Svelte's `$$props`, `$$restProps` and `$$slots` in `.svelte`. Svelte's `$store` subscriptions (any `$name`)
    cannot be listed as globals: measured, then fixed or recorded as a limit.
  - `n/no-unpublished-import` on other imports the plugin cannot resolve (an alias in `tsconfig.app.json`, aliases in JS
    files, virtual modules) is measured from the folder ESLint runs in: fixed with the plugin's own settings where they
    suffice, otherwise a measured limit for the owner.
- 2026-10-14 fix round 5 review: do not ship (14 red tests, one uncaught decision point, item 4 not fixed); the closing
  re-check of every real-run FAIL case passed or maps to an owner question. Into fix round 6 (orchestrator):
  - `n/no-unpublished-import` ships the rule option `resolverConfig: { tsconfig: true }` (rules.json): it fixes aliases from
    JS files, adds no `n/no-extraneous-import` reports (the plugin-wide setting did), and real unpublished files stay
    reported. A rule option of ours decides our copy of our rule, as our `allowModules` already does.
  - eslint-plugin-n reads `typescriptExtensionMap` and `tsconfigPath` from `settings.n ?? settings.node` as a whole object,
    so any `settings.n` of ours hid a team's `settings.node`. Where a team block sets any `settings.node` key we also set
    under `n`, or one the plugin reads as a whole object, our `settings.n` stays out of those files (O8).
  - Our `import-x/resolver-next` stays out of files where a team sets `import-x/resolver` or `import-x/resolver-next` (O8:
    import-x reads `resolver-next` first, so ours beat a team's legacy resolver everywhere).
  - The shape tests owe the four framework overrides (the fix made the old fixture wrong); comments cite measurements as
    "(measured, oxlint 1.87)", never scratch paths.
  - A write to a read-only global drawing both `no-global-assign` and `no-implicit-globals` joins the #35 pairs.
  - Owner questions #78 (aliases the plugin can't resolve) and #79 (Svelte `$store` and `no-undef`).
- Owner 2026-10-14 (chat, after asking why the merge needs so much code; replaces O6 and the merges' half of D1, D10, D12):
  - "If a user sets a rule in either the oxlint or the eslint config, that will override our editor config": a rule the team's
    ESLint or oxlint config sets anywhere (any block or override, a preset it extends, an oxlint category it turns on) is
    theirs in every file; our editor part drops that rule from both engines. Twin names count as one rule (D9's reading).
  - A rule the team sets in neither config is ours: the oxlint version if the project has oxlint, otherwise the ESLint one.
  - "This is not the best experience, but it's the most practical approach, as long as we make it clear that their config
    files override this editor config": the docs say so plainly (rules in our editor set that the team also sets are dropped).
  - "Have the merge also get the path to the other config": each merge also takes the path of the team's other engine config.
  - Where oxlint's version of a rule is measurably worse than ESLint's, we don't route it to oxlint: the rule runs in ESLint
    and the reason is documented (rules.json and its doc), instead of special handling in the merges.
  - Superseded by this: O6 (ours wins across engines), the cross-engine off of the team's copies (D1 in the merges, D12),
    questions #57, #63, #65, #67, #69. Not changed: the agent build, D9-D11 within our own layers, our `ignores` (D-a).
- 2026-10-14 fix round 6 closed (review: ship; reports scratch-backup/fix-round-6/round/). From its review (orchestrator):
  - Into the merge rework: our `import-x/resolver-next` also yields to a team's `import-x/resolver-legacy` and
    `import-x/resolve` (O8, the same one-line rule); `n/no-unpublished-require` gets the same `resolverConfig` option as
    `n/no-unpublished-import` (it reported `require('@/util.cjs')` the same way); the false comment in `buildEslintSettings`
    (import-x does not throw without a resolver) goes.
  - Accepted: where a team sets `settings.node.typescriptExtensionMap` or `tsconfigPath`, our `tryExtensions` leave those
    files too, so R-ALL-6's alias report can come back there (their settings win; copying their keys into ours would be
    the merge second-guessing them). Accepted: a team whose import-x resolver package is not installed gets resolve errors
    from our import-x rules too, as from its own.
- Owner 2026-10-14 (questions on the merge rework spec, docs/work/spec-merge-model.md section 6):
  - Point 1, oxlint's implicit default categories: only what the team writes counts as the team setting a rule. Where
    oxlint's silent default would run a rule we run in ESLint, the oxlint merge switches that default copy off (the spec
    recommended the opposite; overrides it).
  - Point 5, routing: move the 16 rules oxlint refuses an option of to ESLint now, as the spec says. "This is a perfect
    example of where we need to accept the limitations … realistically I think people don't care that much."
  - Point 4, the ~1.4 s oxlint start cost of reading the ESLint config: accepted. "We can always iterate and make this
    better … not have an over engineered thing before it's even proven."
  - Spec points 2 and 3 and calls C1-C5 are cards on the questions page (My calls: editor merges).
- Owner 2026-10-14 (on the hand-made break checks): "investigate StrykerJS and if it works, adopt it", and "add a to-do to go
  over later where we will remove all duplication in tests and make sure we are more dry". For now: the tests must exist and
  the break check must not take three hours. The 3.5-hour break run of the merge rework was stopped (25 of 69 run).
- 2026-10-14 merge rework review: do not ship (scratch-backup/merge-model/round/review.md). Into a short fix round
  (orchestrator):
  - A wrong file as the other-config path (package.json, tsconfig.json) is refused with the spec's "not a config" error
    (T9; call C5, failures throw), checked by the keys each engine's config can hold.
  - Tests for the four uncaught breaks (ES2, L16, J2, L14, probes ready in the review's repro/); the test-only default
    parameter of `mergeEslintPart` goes; refusal tests pin full messages; stale comments (O6, eslint-file-types header) go;
    inline team configs in merge-other-engine-config.test.ts move to factories.
  - Accepted as written-down limits (owner prefers practical): blocks a team adds after the merge call are not seen (T14);
    the silent-default off applies in every file, so where our ignores keep our ESLint rule out nobody reports it; a project
    listing oxlint but passing `oxlintConfig: null` can get oxlint's default copies twice; a category plus an override
    listing under a root listing none makes the rule the team's even where oxlint runs it nowhere.
  - The routing (19 rules to ESLint) applies to the agent build too: one canonical list for both builds.
  - The docs name the `disableTypeChecked` case: a team spreading it makes those typed rules the team's everywhere.
- Owner 2026-10-14 (questions pages, ~180 answers; digest: scratch-backup/answers-digest-2026-10-14.md, the answers' record):
  "answered, now I want you to parallelise as much as possible": act on all of them. Readings settled by the orchestrator:
  "covered by" (S) only for the round 2 pairs where an (S) option was chosen (the general card said "Keep both", its
  example pair keeps both); "split by types" (T) approved; q-r1 (unicorn/no-abusive-eslint-disable to oxlint) replaces #22's
  house mode; renamed rules run in oxlint; #59 keep the 22.18 floor; #64 leave to oxlint's error; #68 our globals only where
  our no-undef runs; #72 and #73 documented; #58 packed-install test; #66 debugged before deciding; typed-config-files: the
  three config files get the type-aware lint rules; lib-structure approved as proposed; check: autofix first, no run log,
  cut long output; init: the gate's ignores plus generated files, the approved text.
- Owner 2026-10-14: "We need to deploy this to npm as well. You should see how change logs are handled inside the CLI
  monorepo and set that up here too. And then we will later bump the version, add to change logs and publish to npm."
  Correction to plan.md's "Publishing: changesets": old, changesets; new, hand-written changelogs as in `~/dev/cli`
  (`packages/lint-rules/CHANGELOG.md` summary index plus `changelogs/<version>.md` per release; checklist in
  docs/release.md); why, the owner asked for the CLI's setup. Readings by the orchestrator, carded for the owner:
  "a new `error` rule is a major release" means a minor bump while the version is 0.x (npm's `^0.x` treats the minor as
  breaking; the CLI is at 0.168); before each publish a `prepublishOnly` script builds, typechecks and tests, as the CLI
  does, added with the other manifest fixes at the first release. Open for the owner: the licence (the CLI is MIT).
- Owner 2026-10-15 (proposal, not yet decided): "the sorting rules should also be opt in (perfectionist/sort-*). Because if
  you run this in a new repo, you just get bombarded by what is essentially just sorting stuff." The sorting rules sit in
  two rulesets: `ordering` (21 rules: 18 perfectionist sort-*, regexp/sort-alternatives, regexp/sort-flags, plus
  default-case-last and sonarjs/shorthand-property-grouping) and `import-order` (7: import-x/order, five perfectionist
  sort-*, plus import-x/first). The lanes add an `optIn` flag on every ruleset, all false; opt-in means `init` leaves the
  ruleset out of a new config and names it in a comment. Orchestrator's proposal to the owner: flag both opt-in after the
  lanes land; first move the two rules that don't sort (default-case-last, import-x/first) to rulesets that stay on.
- Owner 2026-10-15, decided: "I don't mind having these rules, but I agree that yes, these rules in ESLint should be
  opt-in … If they choose to opt into these sorting rules, then they would have to make sure it doesn't conflict … We
  could literally add a comment there to say these will conflict with formatter sorting. Choose one or something."
  So: `ordering` and `import-order` become opt-in, and `init`'s opt-in comment says they conflict with a formatter that
  sorts the same code; pick one. Built after the cli, core and data lanes land (they add the opt-in flag and `init`).
  Orchestrator's calls, carded: `default-case-last` moves to `conventions` and `import-x/first` to `modules` (neither
  sorts, neither autofixes the order away); `sonarjs/shorthand-property-grouping` stays in `ordering`.
- Orchestrator 2026-10-15 (carded): `check` no longer puts files back after an interrupted or failed run. Two review rounds
  in a row found the undo overwriting edits other agents made meanwhile (CLAUDE.md: fix what produces a loop). Fixes
  already written stay, as with `eslint --fix`, and before exiting 130, 143 or 2 `check` prints the "autofixed" line
  naming the files it rewrote. The undo was the cli spec's design ("the pass is undone"), not an owner answer.
- Orchestrator 2026-10-15, correction to the sorting opt-in entry: `default-case-last` is not moved to `conventions`; the
  owner's earlier answer r2-d76 dropped it (perfectionist's `sort-switch-case` covers it), and the data lane has landed
  that drop. With `ordering` opt-in, teams that don't opt in lose the check, so whether to bring it back is now an owner
  card. `sonarjs/shorthand-property-grouping` is likewise dropped (r2-c10). `import-x/first` still moves to `modules`.
- Owner 2026-10-14 evening, on the remaining-questions page (read 2026-10-15): licence MIT, like the CLI; below 1.0 a new
  `error` rule is a minor bump; a `prepublishOnly` script builds, typechecks and tests before every publish. All three
  land with the first release's manifest edits (docs/release.md's "Before the first publish").
- Owner 2026-10-15 (sequence): finish the current round; then a StrykerJS pass over every change not yet run through it;
  then an expressive-TypeScript pass (the `meta-design-expressive-typescript` skill) over the whole codebase, making
  reused or imperative code declarative and shared ("now that we have a well covered code base"); then wait for the
  owner's next answers, which inform the next tests. Docs as concise as possible. Extends the 2026-10-14 "make the tests
  DRY" to-do to all code.
- Owner 2026-10-17 (spec-answers-3 open points). O1, in the owner's words: the config "lives in package a and Claude was
  started in package a and then used to make changes to app b … it points to this linting setup and should use it
  everywhere. As for editor config that will probably only apply to where this was defined … it should be very simple".
  Reading (carded): `check` applies the config's rules to every changed file in the repo; patterns not tied to a folder
  (`**/…`, `*.ext`) reach every package; folder-anchored ones (`src/**`) stay where the config sits; the editor merges stay
  local. O2: no docs line on oxlint `options` (oxlint's own error is enough).
- Owner 2026-10-17, restating O1: the agent config of the folder an AI is opened in applies to every file it changes
  in the monorepo, other packages' configs included, with no convoluted logic; only the editor setup is tied to its
  package. Orchestrator's design (spec item 13 rewritten): `check` runs both engines from the git top level with that one
  config, prefixing folder-anchored patterns with the config folder's path; no second build, no config search.
- Correction 2026-10-18 to the entry above: `check` runs oxlint from the git top level, as designed, but ESLint
  from the config's folder, with the config as built, for the files in that folder, and from the git top level, with
  the prefixed config, for the rest (`eslintEngineByFolder`). Run from the git top level, ESLint read what it resolves
  from its `cwd` (import-x's `devDependencies` globs) from there, which changed what the files in the config's folder
  drew; the spec keeps their output as it was (lane B's call, fix round 2).
- 2026-10-19 owner: an invalid config is refused by TypeScript's types, not by a runtime check of ours ("if they use mjs it's on them"), as far as the types can express it. First cases: `files: []` and a `files` entry starting with `/`. Follow-up: the runtime checks on the config that a type can replace.
- Owner 2026-10-22 (https://claude.ai/artifact/BT8ZY5tazeBkXzgG6ZE8zp; status.md Open tasks rows 14-17, built by lanes L1 and L2):
  - A switch covering every case of a union gets a `never` default, `default: { const unhandled: never = x; return unhandled }`:
    no default draws `consistent-return`, and `default: throw` drops TS2366. plan.md's q-dogfood-keep-three line follows.
    `build-eslint-config.ts`'s three `TypeInformation` checks become such switches.
  - `house/hook-file-naming` counts `export enum` and `export namespace` as values, as it does `export class`.
  - `RuleRoute` (`catalog.ts`) is a union on `engine`, so `isOxlintRoute` loses its run-time throw.
  - The test helper `oxlintCodeOfRule` cuts the name with `ruleNameOf`, as production does (the card recommended the hand cut).
  - questions.md defaults: O11 and O14 approved. O8, O9 and the renamed rules were answered 2026-10-14 (my-db "Team's win
    where set", my-mm-shared-prefix "It counts as theirs", my-renamed-ids "Current names") but stayed listed. O5 and O7 stay
    open, on https://claude.ai/artifact/Hy6Axo9JeeCj5qw3XikBKk.
- Orchestrator 2026-10-22, no owner answer, nothing built: status.md row 18 closed, since ESLint's last block
  (`agents-inc/oxlint-rules-off`) switches off every rule oxlint runs, so an earlier block naming one changes no file's
  result, and the one known leak is pinned by two tests. The draft `rulesets.json` card needed no answer: it was folded into
  `rules.json` and deleted in slice 1, and never shipped.
- Owner 2026-10-22 (https://claude.ai/artifact/Hy6Axo9JeeCj5qw3XikBKk, cards LD-O5b and LD-O7b; built by lane LO57), both
  reversing the default questions.md listed:
  - O5: "if a rule is skipper in the user's eslint or oxlint config then it overrules our config rule". A line of the team's
    oxlint config that oxlint skips, its plugin listed neither at the root nor in that override, counts as the team setting
    the rule, at any severity (the card's "Counts, whatever it says"): both our parts drop it, and the line stays skipped,
    so nothing reports the rule until the team lists the plugin.
  - O7: "Is this needed? why not just compare files against the include to see if it should be linted? if this is solved
    using a function do that". Where the type information is ours, each typed block's `files` ANDs a function that asks,
    as ESLint lints the file, whether a tsconfig takes it in, in place of the list of literal paths made as the config
    loaded; a TS file made after it loaded needs no restart.
- Owner 2026-10-23, "Allow the cast there" (workboard card q-lint-o7-cast): the one assertion in
  `filesEntryAlsoMatching` (`core/eslint-file-types.ts`), there because ESLint's types hold only globs in `files`, stays.
  A `fileOverrides` entry in this repo's `agents-inc.lint.mts` turns `@typescript-eslint/no-unsafe-type-assertion` off
  in that file alone; it stays on everywhere else. oxlint runs no copy of it (ESLint-routed; oxlint's is type-aware).
- Owner 2026-10-23, "Leave both as they are" (workboard card q-leaked-keys; status.md Open tasks row 11): the four keys
  in two agent transcripts of 2026-10-20 are not rotated and the transcripts are not cleaned, so the values stay valid
  and stay in those files.
