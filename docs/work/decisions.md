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
- Owner 2026-10-23 (workboard): q-lint-never-default-standard, "Add it to CLAUDE.md's Code section" (done). Accepted,
  built by lane LA: s-lint-rules-never-default-check, as a rule this repo runs on its own code alone
  (`house-repo/no-throwing-default-in-exhaustive-switch`, in `repoOwnPlugin`, turned on by `eslint.config.mjs`); shipping
  it, or narrowing `considerDefaultExhaustiveForUnions`, is an owner call in plan.md Open. s-lint-rules-collect-time-throws:
  CLAUDE.md, Tests, and `test-collection.test.ts`, the calls already there pinned for the owner (plan.md Open).
  s-lint-rules-hand-split-guard: `rule-id-splits.test.ts`. s-lint-rules-parallel-load-timeouts: the allowance added to
  each test file running an engine without one.
- Owner 2026-10-23, "accept" (board suggestion s-lint-rules-narrow-mutation-runs, "A committed way to mutation-test one
  lane's lines with only the specs that reach them"): built as `--only <file>,<file>:<startLine>-<endLine>` on
  `scripts/mutate-changed-lines.mts`, beside Stryker's own `--testFiles`, which the lane gives (mutation-testing.md).
- Owner 2026-10-23, "accept" (board suggestion s-lint-rules-own-lint-gate, "Finish the repo's own lint clean-up so its
  own ESLint and oxlint can run as a gate"): the clean-up's spec is `docs/work/spec-own-lint.md`.
- Owner 2026-10-24, "The script re-checks Stryker's --testFiles" (board card q-lint-only-misspelt-spec), asked what the
  mutation round script does with a `--testFiles` entry matching no file, which Stryker drops, running every test when
  none match: before Stryker starts, `scripts/mutate-changed-lines.mts` refuses a list holding no entry and names each
  entry matching no file, in every spelling (`mutation-testing/test-files-given.ts`).
- Owner 2026-10-24, "The script warns" (board card q-lint-only-module-load), asked what follows a round given
  `--testFiles`, which turns a load-time (static) mutant on only after the test files load, so its Survived proves
  nothing: the script prints a warning naming each such Survived mutant, to re-run without `--testFiles`, and leaves
  the exit code as it was (`mutation-testing/load-time-mutants-survived.ts`).
- Owner 2026-10-24, "Widen it to helper modules" (board card q-lint-collect-time-reach), asked whether
  `test-collection.test.ts` also reads the top level of the modules a test file loads: it follows a test file's
  imports, and its helpers', into modules under `__tests__/` (not through `import type`) and reports each call at their
  top level reaching a throw of ours (`__tests__/collect-time-throws.ts`; learnings, Lint guards).
- Owner 2026-10-24, "The lane names them (as built)" (board card q-lint-only-who-picks-specs), asked whether, in a
  mutation round narrowed to a lane's lines, the lane names the specs to run or the script works them out: the lane
  names them with Stryker's `--testFiles` (`scripts/mutate-changed-lines.mts`; mutation-testing.md). Nothing changed.
- Owner 2026-10-24, "Keep --only" (board card q-lint-only-option-name), asked whether the mutation round script's
  option narrowing a round to given files or line ranges keeps the name lane LB gave it: it stays `--only`
  (`scripts/mutate-changed-lines.mts`; mutation-testing.md). Nothing changed.
- Owner 2026-10-24, "Leave consumers as they are" (board card q-lint-ship-never-default-check), asked whether
  consumers' code is also reported for a switch covering every case of a union that ends in `default: throw`: it is
  not. `house-repo/no-throwing-default-in-exhaustive-switch` stays in `repoOwnPlugin` alone, and the shipped
  `switch-exhaustiveness-check` keeps `considerDefaultExhaustiveForUnions: true` (`rule-data/data/rules.json`).
  Nothing changed.
- Owner 2026-10-24, "Move each into its test or a hook" (board card q-lint-collect-time-left), asked whether the calls
  that can throw while vitest collects a test file, found when the check was written, move or stay pinned as a known
  gap: each moved into its test or a hook, every test's title and verdict unchanged, so no known-gap list is left and
  `test-collection.test.ts` asserts none is found (`__tests__/collect-time-throws.ts`).
- Owner 2026-10-24, "Allow `let` for this pattern" (board card q-lint-no-let-it-fails), asked whether the `let` that
  carries an `it.fails` suite's run from its `beforeAll` to the test, which this repo's own `functional/no-let`
  refuses, is allowed there or replaced by another pattern: allowed. Not built yet: no disable or override for it
  exists; `docs/work/spec-own-lint.md` requirement 4 gives each such `let` a disable carrying the proof.
- Owner 2026-10-24, "Report them (as built)" (board card q-lint-never-default-forms), asked whether
  `house-repo/no-throwing-default-in-exhaustive-switch` keeps reporting the two other defaults that keep a missing
  case a type error, ``throw new Error(`${x satisfies never}`)`` and `throw unreachable(x)` with
  `unreachable(value: never)`: it does. It reports any default ending in a throw that binds nothing to never
  (`throwsInPlaceOfANeverDefault`, `rules/no-throwing-default-in-exhaustive-switch.ts`). Nothing changed.
- Owner 2026-10-24, "Yes, the same override covers both" (board card q-lint-own-rule-file-overrides), asked whether
  the override turning `functional/immutable-data` off in the house rule files also turns off
  `functional/no-expression-statements` and `functional/no-return-void`, which ESLint's visitors and report helpers
  draw: it does, in the one `fileOverrides` entry over the house plugin's rule files (not their tests), `src/shared/`
  and `house-rule-tester.ts` (`agents-inc.lint.mts`).
- Owner 2026-10-24, "Override it off for `**/*.test-d.ts` in this repo" (board card q-lint-own-type-test-files), asked
  how to handle `unicorn/no-top-level-side-effects` reporting every call in the type test
  `define-lint-rules.test-d.ts`: a `fileOverrides` entry turns it off for `**/*.test-d.ts` (`agents-inc.lint.mts`);
  nothing shipped changes.
- Owner 2026-10-24 (board https://claude.ai/artifact/4GpMMzy64wzXqSPZaghWTJ, the rule-candidate cards; a card is `rc-`
  and the rule ID with `@` dropped and `/` turned into `-`). Each verdict is in `rule-candidates.json`, the card named:
  - Accepted, `recommended` until built, by the ruleset each goes to (the card's, else the accepted-rules spec's pick):
    redundancy `unicorn/no-unnecessary-default-arguments`, `unicorn/no-repeated-call-wrappers`,
    `unicorn/prefer-logical-operator-over-ternary`; modern-js `prefer-named-capture-group`,
    `sonarjs/prefer-native-axios-alternative`; comments, on only where suppressions are allowed,
    `@eslint-community/eslint-comments/disable-enable-pair`, `@eslint-community/eslint-comments/no-duplicate-disable`,
    `@eslint-community/eslint-comments/require-description`; zod `zod/no-coerce-boolean`, `zod/no-conflicting-checks`,
    `zod/no-duplicate-schema-methods`, `zod/no-empty-custom-schema`, `zod/no-optional-and-default-together`,
    `zod/no-throw-in-refine`, `zod/no-transform-in-record-key`, `zod/prefer-trim-before-string-length-checks`,
    `zod/require-brand-type-parameter`; tanstack-query `@tanstack/query/exhaustive-deps`,
    `@tanstack/query/infinite-query-property-order`, `@tanstack/query/no-rest-destructuring`,
    `@tanstack/query/no-unstable-deps`, `@tanstack/query/no-void-query-fn`, `@tanstack/query/stable-query-client`;
    tanstack-router `@tanstack/router/create-route-property-order`, `@tanstack/router/route-param-names`; playwright
    `playwright/no-duplicate-slow`, `playwright/no-element-handle`, `playwright/no-networkidle`,
    `playwright/no-unnecessary-assertions`, `playwright/no-wait-for-selector`, `playwright/prefer-web-first-assertions`,
    `playwright/require-to-pass-timeout`, `playwright/valid-test-tags`; security `drizzle-security/no-unsafe-query`;
    drizzle `drizzle-security/no-unscoped-mutation`; node `e18e/prefer-throw-if-no-entry`; tailwind (opt-in)
    `shadcn/no-raw-colors`.
  - Accepted, `recommended`, off by default: `playwright/no-focused-test`, `playwright/no-identical-title`,
    `playwright/prefer-hooks-on-top`, `playwright/require-to-throw-message`. Each reports the same line as a shipped
    `vitest/*` rule in Vitest and Jest test files; owner, "Don't ship them by default" (q-lint-playwright-vitest-twins):
    none ships, and a team turns them on for its Playwright folder with `fileOverrides`.
  - Accepted, `recommended`, each built only once its card is answered: jest-dom `jest-dom/prefer-checked`,
    `jest-dom/prefer-empty`, `jest-dom/prefer-in-document`, `jest-dom/prefer-pressed`, `jest-dom/prefer-required`,
    `jest-dom/prefer-to-have-attribute`, `jest-dom/prefer-to-have-class` (q-lint-jest-dom-without-jest-dom); react-ssr
    `hydration-proof/no-browser-global-in-render`, `hydration-proof/no-locale-without-explicit-locale`,
    `hydration-proof/no-storage-in-initial-render`, `hydration-proof/no-timezone-without-explicit-timezone`,
    `hydration-proof/no-window-render-branch`, `hydration-proof/require-stable-server-snapshot`
    (q-lint-react-ssr-in-client-apps).
  - Accepted into the later category for the newest language features, enabled by Node version, so `parked` and off
    beside those parked 2026-10-11: `unicorn/prefer-uint8array-hex`, `unicorn/prefer-iterator-zip`,
    `e18e/prefer-get-or-insert`. Each one's fix, or suggestion for `prefer-iterator-zip`, writes an API Node 22.23
    lacks (`Uint8Array#toHex`, `Iterator.zip`, `Map.prototype.getOrInsert`; measured, Node 22.23.2 and 23.10.0).
  - Rejected, `dropped` with the card as `decidedBy`: `no-console`, `@typescript-eslint/prefer-includes`,
    `@typescript-eslint/promise-function-async`, `unicorn/prefer-json-import`, `jest-dom/prefer-to-have-style`,
    `anti-slop-effect/no-manual-tag-comparison`, `anti-slop-effect/no-manual-tagged-construction`,
    `anti-slop-effect/no-service-constructor-imports`, `anti-slop-effect/prefer-effect-match`,
    `anti-slop/require-safety-comment-for-type-assertion`, `erasable-syntax-only/*`, `llm-core/no-redundant-comments`,
    `react-google-translate/no-conditional-text-nodes-with-siblings`.
  - `compat/compat`, no choice, the note: "we should accept this but can the rule default to including only relevant
    browsers like the major ones?" Yes: the rule takes a browserslist query as its one option (`schema`,
    eslint-plugin-compat 7.0.2), so the `browser-targets` ruleset can ship one. Recorded `recommended`; the default
    target is card q-lint-compat-default-target.
  - Effect: the owner wants an Effect ruleset, holding `anti-slop-effect/no-manual-effect-error-tag` ported as a house
    rule (`recommended`); its name and domain are card q-lint-effect-ruleset-name.
  - `rc-bulk-considering`, `rc-bulk-recommended`, `rc-bulk-rejected`: unanswered, nothing recorded.
- Lane A 2026-10-24 (`docs/work/spec-accepted-rules.md`): `prefer-named-capture-group` and
  `sonarjs/prefer-native-axios-alternative` (modern-js) and `unicorn/prefer-logical-operator-over-ternary` (redundancy)
  ship, their `rule-candidates.json` entries removed. `unicorn/no-unnecessary-default-arguments` and
  `unicorn/no-repeated-call-wrappers` tripped the spec's false-alarm stop: not shipped, `recommended`, until the owner
  answers q-lint-rc-default-args-measured and q-lint-rc-call-wrappers-measured.
- Owner 2026-10-24 (board https://claude.ai/artifact/4GpMMzy64wzXqSPZaghWTJ), the three cards lanes A and DEP raised:
  - "Ship it outside test files" (q-lint-rc-call-wrappers-measured): `unicorn/no-repeated-call-wrappers` ships in
    redundancy with the test-file globs as its `ignores`, its `rule-candidates.json` entry removed. Every measured hit
    was in a test file.
  - Rejected, `dropped` with the card as `decidedBy`, the reason in each `why`:
    - `unicorn/no-unnecessary-default-arguments`, "Don't ship it" (q-lint-rc-default-args-measured): most defaults it
      reports are written out on purpose, and none read was clearly redundant.
    - `drizzle-security/no-unsafe-query` and `drizzle-security/no-unscoped-mutation`, "Leave it out for now"
      (q-lint-dep-drizzle-advisory), the note: "Leave it out for now but document why it is not included, along with
      all the other documented rejections of rules." eslint-plugin-drizzle-security stays uninstalled: its optional
      peer takes no stable drizzle-orm after 0.30, so in a Drizzle project npm nests drizzle-orm 0.30.10, under a high
      security advisory (GHSA-gpj5-g38j-94v9), beneath our package. "For now": a later card may take them back up once
      the plugin takes a current drizzle-orm.
- Owner 2026-10-24, "Literal lists, checked by a test" (board card q-lint-collect-time-titles), asked how the last
  collect-time calls, which computed test titles and rows, should move: `TWINNED_MOVED_RULES`
  (`eslint-fallback.integration.test.ts`) and each merge differential's `SHAPE_NAMES` and `COVERAGE` are literal lists,
  each held to what the code computes by a test of its own, as `package-manifests.test.ts`'s `INLINED_NAMES` already
  was. `test-collection.test.ts` now asserts no call is left; CLAUDE.md, Tests, states the standard.
- Owner 2026-10-24, "Suggest a const first" (board card q-lint-never-default-unnarrowable), asked what
  `house-repo/no-throwing-default-in-exhaustive-switch` does at a `default: throw` in a switch on a value TypeScript
  cannot narrow (a call, `x!`, a cast, `??`, `typeof`), where no never default compiles as written: it keeps
  reporting, and its message says to hold the value in a const, switch on the const and bind the const, where that
  rewrite compiles (`throwingDefaultOnAValueToHoldInAConst`, `rules/no-throwing-default-in-exhaustive-switch.ts`;
  learnings, Lint guards).
- Owner 2026-10-24, "Suggest the binding, then a throw" (board card q-lint-never-default-no-return), asked what the
  same rule suggests at a file's top level, in a class static block and in a setter, where `return unhandled` does not
  compile: `const unhandled: never = x` before the throw, and it accepts that form (`isWhereNothingReturns`,
  `rules/no-throwing-default-in-exhaustive-switch.ts`).
- Owner 2026-10-24, "Keep it to test helper modules" (board card q-lint-collect-time-production), asked whether
  `test-collection.test.ts` also reads the top level of production modules a test file loads: it does not. Nothing
  changed.
- Owner 2026-10-24, "Rebuild it" (board card q-lint-never-default-approach), asked, after round 6 again found shapes
  where `house-repo/no-throwing-default-in-exhaustive-switch`'s own copy of TypeScript's narrowing was wrong, whether
  to keep patching it, change the approach, or accept the dead-code-only differences. Built in house round 7: the rule
  always asks TypeScript which value a never default can bind, each part of the switch's value, then, where none is
  never there, a const holding it (`shared/program-with-a-file-rewritten.ts`); its own copy of the narrowing is gone.
- Owner 2026-10-24, "Allow it, if nothing accepted before is refused" (board card q-lint-own-published-types), asked
  whether, in the own-lint clean-up, a fix may change the published type declarations of `mergeEslintConfig`,
  `mergeOxlintConfig` and `AtLeastOneFileGlob` (`functional/prefer-immutable-types`, `@typescript-eslint/array-type`)
  if they still accept everything they accepted before: it may, the type-error tests showing nothing accepted before is
  refused. Not built yet: `docs/work/spec-own-lint.md` (Q1) leaves those sites to its lane Z.
- Owner 2026-10-24, "List them for review" (board card q-lint-own-calls), asked whether the calls the lint session made
  itself (the entries here marked "mine" or "orchestrator") stand as made or go to the owner one card each: those no
  owner answer covers are cards q-lint-own-1 to q-lint-own-10 on the board.
- Owner 2026-10-27, "Only in test files" (board card q-lint-rc-pw-puppeteer-page), asked where
  `playwright/no-element-handle` and `playwright/no-wait-for-selector` run, since they know Playwright's page by its
  name, not its import, and so also report Puppeteer's `page.$` and `page.waitForSelector`, in source files as in tests
  (measured, eslint-plugin-playwright 2.12.1): both ship in playwright with the test-file globs as their `files`, their
  `rule-candidates.json` entries removed. The consequence the owner accepted: Puppeteer code outside the test files is
  never reported, and neither is a Playwright helper, such as a page object, outside them. The Puppeteer source file in
  `accepted-pw.ts` pins it.
- Owner 2026-10-24, "Make react-ssr opt-in" (board card q-lint-react-ssr-in-client-apps), asked whether `init` keeps
  listing `react-ssr` in every new config, since the accepted hydration-proof rules fire in React apps that never render
  on a server: `react-ssr` is opt-in (`optIn: true`, `ruleset-definitions.json`; lane HP). `init` names it in a comment
  and a team that renders on a server adds it.
- Owner 2026-10-24, "Make jest-dom opt-in" (board card q-lint-jest-dom-without-jest-dom), asked whether `init` keeps
  listing `jest-dom`, since the accepted jest-dom rules fire, and their fixes break tests, in projects without jest-dom:
  `jest-dom` is opt-in (`optIn: true`; lane JD). `init` names it in a comment; configs that already list it keep it.
- Owner 2026-10-24, "Major browsers as Vite targets them, set as the rule's option" (board card
  q-lint-compat-default-target), asked which browsers `compat/compat` checks by default: the `browser-targets` ruleset
  gives the rule a browserslist query as its option. Which list that means was asked again on 2026-10-28
  (q-lint-compat-vite-target, below).
- Owner 2026-10-24, "`libs: { effect: ['effect'] }`" (board card q-lint-effect-ruleset-name), asked what teams type to
  list the Effect ruleset: a new `libs` domain `effect` holding the ruleset `effect`, which `init` lists. The port ships
  there as `house/no-manual-effect-error-tag`, and the upstream candidate entry is gone (lane EFF).
- Owner 2026-10-28 (workboard; each card's text and the choice verbatim in the session's answers bundle). The lanes are in
  `docs/work/spec-answers-4.md`; nothing below is built yet unless it says so:
  - "Vite's fixed list" (q-lint-compat-vite-target), asked whether compat checks exactly what Vite builds for or
    browserslist's "widely available" list: Vite 8's fixed build target, as the query
    `chrome >= 111, edge >= 111, firefox >= 114, safari >= 16.4, ios_saf >= 16.4`. It changes only when lint-rules moves
    to a new Vite major; a test compares it with the target Vite resolves. Lane CPT-SHIP.
  - "Add it" (q-lint-compat-install-size), asked whether to add the plugin though every install grows about 52 MB:
    `eslint-plugin-compat` becomes a dependency and `compat/compat` ships in `browser-targets`. Lane CPT-SHIP.
  - "Silence it inside check" (q-lint-compat-stale-data-warning), asked whether `check` silences browserslist's "browsers
    data is N months old" message: `check` sets `BROWSERSLIST_IGNORE_OLD_DATA` in its own process; `init`, editors and
    `npx eslint` unchanged. The message already printed before compat (through `unicorn/no-unnecessary-polyfills` in a
    project naming its browsers), and the same switch hides baseline-browser-mapping's old-data warning. Lane CPT-SILENCE.
  - "Ship it" (q-lint-hp-timezone-hold), asked whether the time-zone rule ships or waits with the two held react-ssr
    rules: `hydration-proof/no-timezone-without-explicit-timezone` ships in `react-ssr` with three others. Lane HP-SHIP.
  - "Ship now, add the setting later" (q-lint-hp-server-components-gap), asked whether to accept that a Next.js page only
    the server renders still gets reports, or hold the rules until the plugin's Next.js setting can be passed: the four
    ship, the false report is a written limit, and lane HP-SETTINGS passes `serverComponents: 'next-app'`. How the config
    knows a project is a Next.js app went back to the owner (proposed card q-lint-hp-next-setting-where); nothing is
    built for it until answered.
  - "Leave them off" (q-lint-rc-hydration-false-alarms-measured), asked whether two react-ssr rules that raised only false
    alarms ship: `hydration-proof/no-browser-global-in-render` and `hydration-proof/no-locale-without-explicit-locale` do
    not ship and stay in `rule-candidates.json`. "Stay listed as candidates" fits no recorded state (`recommended` is
    queued to build, `dropped` is decided against), so they stay `recommended` and held, and how to record them went to
    the owner (proposed card q-lint-hp-left-off-record). Lane HP-SHIP.
  - "Report only, no auto-fix" (q-lint-rc-jest-dom-fixes-measured), asked how six jest-dom rules whose fixes break passing
    tests ship: `jest-dom/prefer-checked`, `prefer-empty`, `prefer-in-document`, `prefer-required`,
    `prefer-to-have-attribute` and `prefer-to-have-class` ship in `jest-dom`, their fixes withheld by `check`
    (`cli/check/withheld-fixes.json`). Editors still offer them (proposed card q-lint-jd-editor-fixes). Lane JD.
  - "Ship with the auto-fix" (q-lint-rc-pressed-fix-measured), asked how `jest-dom/prefer-pressed` ships, its fix breaking
    tests on jest-dom before 6.7.0: on 6.9.1 too its fix turns a passing presence-only `aria-pressed` test into a failing
    one, which the card did not say. Its false alarms are measured first; it stays held and the question goes back to the
    owner (proposed card q-lint-rc-pressed-fix-current-jest-dom). Lane JD (JD-PRESSED).
  - "Not in test files" (q-lint-unicorn-gethtml-jsdom), asked what to do about `unicorn/prefer-dom-node-html-methods`
    rewriting test code to `getHTML()`, which jsdom lacks: it takes the test-file globs as its `ignores`. Setup and helper
    files outside the globs, and source files a jsdom test imports, are still rewritten. Lane SCOPE-HTML.
  - "Leave entry files alone" (q-lint-own-r-barrel-entry), asked whether `unicorn/no-barrel-files` leaves a package's main
    entry file alone: measured, the rule takes no options and no file pattern matches main entries exactly, so by the
    answer's own terms it went back to the owner (proposed card q-lint-barrel-entry-how). The rule ships as before; our
    `packages/rule-data/src/index.ts` finding stays, and own-lint lane Z adds no disable and no split for it. Lane
    SCOPE-BARREL.
  - "Refuse it, naming the file" (q-lint-oxlint-null-options), asked what happens when a team's oxlint config sets
    `options`, or `categories` with no config extended, to null: both merges refuse it with one line naming the file and
    the key. `check` and `init` never read a team's oxlint config, so they do not change. A null `categories` beside an
    extended config, other null keys and `plugins: null` went to the owner. Lane OXLINT-NULL.
  - No option chosen (q-lint-own-gate-per-file), asked whether the own-lint gate also checks each file alone; the note:
    "why is this investigate first. running eslint should surface all errors thats the point". The gate stays one
    whole-repo run, and that run missing findings is a defect: is-immutable-type's cache makes
    `functional/prefer-immutable-types` answer by what it checked first. It is fixed by wrapping that rule in the plugin
    registry, so `check` and editors are fixed too; no per-file pass is added. Lane LINT-RUN-SET.
- Owner 2026-10-11 (old candidates page https://claude.ai/artifact/VR852bgmX4krED5ZEbNawF, its Accept/Reject verdicts;
  recorded 2026-10-28). Never applied until now. Recorded in `rule-candidates.json` under the decision label
  `owner-2026-10-11` (lane R11); `docs/work/spec-accepted-rules-1011.md` builds the accepts, each as the page proposed it
  (r1's pick, `docs/work/rule-candidates-r1.md` §1):
  - Accepted, `recommended` until its lane ships it. correctness: `accessor-pairs` (test files ignored),
    `no-array-constructor`, `no-empty`, `no-new-wrappers`, `no-self-compare`, `no-sequences`, `radix`,
    `sonarjs/no-duplicated-branches`, `unicorn/no-async-iterator-callback`, `unicorn/no-conflicting-constraints`,
    `unicorn/no-incomplete-accessor-override`, `unicorn/no-invalid-intl-options`,
    `unicorn/no-invalid-property-descriptor`, `unicorn/no-invalid-response-options`, `unicorn/no-invalid-temporal-arithmetic`,
    `unicorn/no-invalid-url-protocol-comparison`, `unicorn/no-unsafe-json-serialization`,
    `unicorn/no-unused-builtin-method-return`, `unicorn/no-unused-iterator-helper`, `unicorn/no-url-in-search-params`,
    `unicorn/no-using-resource-escape`, `unicorn/require-text-decoder-streaming`. type-safety:
    `@typescript-eslint/no-namespace`, `@typescript-eslint/use-unknown-in-catch-callback-variable`,
    `@typescript-eslint/parameter-properties` (was `considering`; r1 picked no ruleset, the spec reads type-safety).
    security: `unicorn/no-ineffective-csp-directives`, `unicorn/no-invalid-integrity`. performance:
    `anti-slop/no-reduce-accumulator-copy`, to be ported as `house/no-reduce-accumulator-copy`. immutability:
    `@typescript-eslint/prefer-readonly`. modern-js: `no-object-constructor`, `prefer-object-has-own`,
    `@typescript-eslint/prefer-string-starts-ends-with`, `unicorn/prefer-at`, `unicorn/prefer-temporal-conversion`.
    redundancy: `no-useless-assignment`, `@typescript-eslint/no-unnecessary-qualifier`,
    `unicorn/no-useless-set-construction`, `unicorn/prefer-single-call`. conventions: `symbol-description`,
    `@typescript-eslint/consistent-type-exports`, `@typescript-eslint/consistent-type-imports`,
    `@typescript-eslint/dot-notation`, `unicorn/prefer-literal-ascii`. tests: `sonarjs/composite-assertions`,
    `sonarjs/no-duplicate-parameterized-test-case`, `sonarjs/no-empty-parameterized-test-dataset`,
    `sonarjs/synchronous-exception-assertions`. react: `sonarjs/no-debounce-throttle-in-render`. browser:
    `unicorn/no-invalid-boolean-attribute-value`, `unicorn/no-invalid-dom-token`,
    `unicorn/no-invalid-style-set-property`, `unicorn/no-prevent-default-in-passive-listener`.
  - His notes on three accepts: `unicorn/no-async-iterator-callback`, "If this is already covered don't add this to";
    `unicorn/no-invalid-property-descriptor`, "If this is already handled don't add it"; `unicorn/prefer-single-call`,
    "It's not bad that some lines will have multiple rule violations as long as they're not the same violations" (the
    candidates page note above).
  - Rejected, recorded `dropped`: `@typescript-eslint/no-unsafe-enum-assignment` (his note: "Same as a number of others
    that are already handled by another rule"), `jsx-a11y/anchor-ambiguous-text`, `anti-slop/no-runtime-typeof`,
    `anti-slop/no-unknown-parameters`, `anti-slop/no-unknown-returns` (anti-slop is not installed; r1 §3).
  - No verdict, a note only, left to their bulk cards (unanswered): `ai-guard/no-console-in-handler`
    (rc-bulk-considering); `anti-slop/no-known-value-widening`, `anti-slop/no-unsafe-dictionary-type`
    (rc-bulk-rejected); `no-case-declarations`, `unicorn/prefer-escaped-irregular-whitespace` (rc-bulk-recommended).
  - Knock-on: with `unicorn/prefer-literal-ascii` accepted, r2-d68 (`docs/work/spec-next-batch.md`, row D68) drops
    `unicorn/no-hex-escape`, decided by `r2-d68`, in lane UNI.
- Owner 2026-10-27, "Treat it like a file's top level" (board card q-lint-house-namespace-body), asked what
  `house-repo/no-throwing-default-in-exhaustive-switch` suggests at a `default: throw` in a `namespace` body, where
  `return unhandled` does not compile: as at a file's top level, `const unhandled: never = x` before the throw, and it
  accepts that form; a function inside the namespace keeps the return form (`isWhereNothingReturns`,
  `rules/no-throwing-default-in-exhaustive-switch.ts`).
- Owner 2026-10-27, "Accept it, give that test more time" (board card q-lint-house-rebuild-cost), asked whether the
  rebuilt rule's cost on very large switches is accepted: it is, no behaviour change; "stays silent on a throwing default
  the last of thousands of cases falls into" runs under its own timeout (`THOUSANDS_OF_CASES_TIMEOUT_MS`,
  `rules/no-throwing-default-in-exhaustive-switch.test.ts`; lane LINT-HOUSE-SLOW-SPEC).
- Owner 2026-10-27, "Only their own config" (board card q-lint-unshipped-rules-channel), asked where a team turns on a
  rule we do not ship: in its own ESLint or oxlint config only. `rules` takes only the rules we ship, and naming any other
  there, an unknown ID included, stops the config as it loads with a message pointing to that config
  (`refuseRulesWeDoNotShip`, `core/rules-we-do-not-ship.ts`; lane LINT-UNSHIPPED-CHANNEL). This overrules "a consumer adds
  any rule we support via `rules`" (2026-10-11 above). Held on q-lint-unshipped-ts-twin: typescript-eslint's copy of a
  rule we ship, and the core rule a shipped copy extends, are routed as before.
- Owner 2026-10-27, "Run them in ESLint unless tested" (board card q-lint-unshipped-rules-untested), asked which engine
  runs a rule turned on through `rules` that no fixture proves: moot under q-lint-unshipped-rules-channel, as `rules`
  takes no rule we do not ship; nothing built.
- Owner 2026-10-27, "Yes, update the test" (board card q-lint-itfails-function-files), asked whether the test still
  expecting our copy of a rule outside the files a team block's function matches, which the 2026-10-14 ruling replaced
  (a rule the team sets anywhere is theirs in every file), may change: its `it.fails` test is deleted and the passing
  one renamed to say the team's entry stands in every file, its assertion unchanged ("a team block whose files are a
  function", `merge-eslint-config.test.ts`). No behaviour changed.
- Board card q-lint-no-let-it-fails ("Allow `let` for this pattern", above) is built: each `let` a hook assigns and an
  `it.fails` test reads carries its own `eslint-disable-next-line functional/no-let` with the proof
  `docs/work/spec-own-lint.md` requirement 4 gives; no override.
- Owner 2026-10-27, "The gate reports it" (board card q-gap-lint-stryker-leftover-sandbox), asked what handles the copy
  of the repo a killed mutation run leaves in `.stryker-tmp`, which slows every test that walks the repo:
  `scripts/report-leftover-stryker-copies.mts`, run from the root, names each `.stryker-tmp/sandbox-*` copy unless a
  Stryker run started from the root is live (workers a killed run leaves in its copy do not count as one); it removes
  nothing and exits 0. It reads `/proc`, so it reports only on Linux. Not wired into `bun run test` yet: that needs the
  root `package.json` and `turbo.json`.
- Owner 2026-10-27, "A written rule only" (board card q-gap-lint-stryker-untested-lines), asked what catches a mutation
  run that totals 0 survived while a changed line got no tested break: CLAUDE.md, Tests, says to list each changed line
  with no Killed mutant and break each by hand; nothing checks that it was done.
- Owner 2026-10-27, note "What do these have to do with the lint rules repo remove the jobs" (board card
  q-gap-lint-ai-benchmarking-items), asked whether the two lint jobs only ai-benchmarking can do (its gate defects, and
  an A/B for each ruleset switched on in the benchmark) get a session there or stay written down: both are removed from
  this repo's docs (`questions.md` Open #8, the A/B note in `plan.md` Open); nothing is done in ai-benchmarking.
- Correction 2026-10-29 to the "The gate reports it" entry above: it is wired. `bun run test` runs the root script
  `report-leftover-stryker-copies`, uncached, before every package's test (`turbo.json`).
- Owner 2026-10-27, chat ruling on board card q-lint-cmt-editor-reach, overriding its choice "Keep it (editors too)": "we
  have two separate configs for a reason so nothing should be in editor config without being listed in the editor config
  directly". The card asked whether rules that run wherever suppressions are allowed also run in every team's editor,
  where they always are. They do not: a rule `allowSuppressions` turns on that belongs to a ruleset
  (`unicorn/no-abusive-eslint-disable`, comments; `react-hooks/rule-suppression`, react; the comment rules RULES-CMT
  ships) runs in the editor parts only in files whose `editorRulesets` list its ruleset. The agent build is unchanged.
  Pinned in `allow-suppressions.test.ts` (lane LINT-EDITOR-LISTED-ONLY). Open, asked of the owner: whether
  `@typescript-eslint/ban-ts-comment`, on in every config and in no ruleset, stays in editors.
- Owner 2026-10-26/27, "Ship it" (board card q-lint-rc-duplicate-disable-measured), asked whether
  `@eslint-community/eslint-comments/no-duplicate-disable` ships though check already reports a second disable of an
  ESLint-run rule as an unused suppression: it ships in `comments`, run by ESLint at its defaults only where suppressions
  are allowed, like `unicorn/no-abusive-eslint-disable`. A duplicate disable of an oxlint-run rule draws its one report;
  of an ESLint-run rule, two on the same comment. With q-lint-cmt-editor-reach built,
  `@eslint-community/eslint-comments/disable-enable-pair` ships the same way. Cases in rule-data's
  `__tests__/cases/accepted-cmt.ts`; the double report is pinned nowhere (lane RULES-CMT).
- Owner 2026-10-26/27, "Only switch-off comments" (board card q-lint-cmt-require-description-scope), asked whether
  `@eslint-community/eslint-comments/require-description` also asks a reason of enable and global comments: it does
  not; it ships with an ignore list of those kinds. Held, not shipped, on q-lint-cmt-inline-config-reason: the rule
  skips whole kinds of comment only, and an inline rule-setting comment (`eslint no-console: "off"`) is one kind whether
  it switches a check off or only changes a setting (measured, eslint-comments 4.8.1). Its case is held in
  `accepted-cmt.ts` (lane RULES-CMT).
- Owner 2026-10-26/27, the measured cards on Playwright, TanStack and zod rules accepted 2026-10-24 (lane
  LINT-HELD-RULES):
  - "Report only, fix withheld" (board card q-lint-rc-stable-query-client-fix-measured), asked how
    `@tanstack/query/stable-query-client` ships, its fix writing `React.useState(() => new QueryClient())` in files that do
    not bind `React`: it ships in `tanstack-query`, its fix withheld by `check` (`cli/check/withheld-fixes.json`).
  - "Report only, fix withheld" (q-lint-rc-zod-trim-fix-measured), asked how
    `zod/prefer-trim-before-string-length-checks` ships, its fix changing which values a schema accepts: it ships in `zod`,
    its fix withheld the same way. Editors still offer both fixes, as for the jest-dom rules (q-lint-jd-editor-fixes).
    Pinned in `check-withheld-tanstack-zod-fixes.integration.test.ts`.
  - "Ship everywhere" (q-lint-rc-unnecessary-assertions-measured): `playwright/no-unnecessary-assertions` ships in
    `playwright` with no `files`, so Vitest and Jest files get its reports too. It has suggestions and no fix, so `check`
    rewrites nothing. Its message names a Playwright Locator and `toBeVisible()` in those files as well.
  - "Ship with sorting told to skip these calls" (q-lint-rc-tanstack-property-order-measured), asked how
    `@tanstack/query/infinite-query-property-order` and `@tanstack/router/create-route-property-order` ship beside
    `ordering`: not built. Where a spread sits between the keys a rule reorders, `check` applies its fix, which moves
    `queryFn` or `loaderDeps` across the spread, so the spread's value wins: a passing test failed, TypeScript reported
    TS2783 and a second `check` reported nothing (measured, @tanstack/react-query 5.104.2, @tanstack/react-router
    1.170.19). Both stay `recommended` and held, and the skip (`perfectionist/sort-objects`
    `useConfigurationIf.callingFunctionNamePattern` with `type: 'unsorted'`) is held with them. How they ship went back
    to the owner (proposed card q-lint-rc-tanstack-property-order-fix-spread).
  - "Report only, everywhere" (q-lint-rc-web-first-assertions-measured), its note asking to keep
    `playwright/prefer-web-first-assertions` on everywhere only if it works in unit tests: it does not, so
    q-lint-rc-web-first-assertions-tested asked again. Its note ("folder or filename matching ... include this as a
    comment in the config because it's opt in") is not built, nor the same example for the four Playwright rules that
    repeat a Vitest rule: `defineLintRules` refuses a rule we do not ship in `rules` and `fileOverrides`
    (q-lint-unshipped-rules-channel), so the example uncommented stops the config loading, and nothing ships switched
    off. All five stay `recommended` and held; how a team turns them on for its Playwright tests went back to the owner.
- Correction 2026-10-29 to the 2026-10-24 entry on the four Playwright rules that repeat a Vitest rule: a team cannot
  turn them on with `fileOverrides`, which refuses a rule we do not ship (q-lint-unshipped-rules-channel). Only its own
  ESLint config can, and `check` does not run that.
- Owner 2026-10-26/27, four answers on the merge and shipped rules (lane LINT-MERGE-ANSWERS):
  - "Count it as ours" (q-gap-lint-a11y-original-prefix), note "this should be the same as if it was set on in our
    config": a team plugin carrying the original `eslint-plugin-jsx-a11y`'s name is our jsx-a11y plugin under whatever
    prefix the team gives it, so `a11y/alt-text` is our `jsx-a11y/alt-text`: one report, at the team's setting, and its
    'off' silences ours. Pinned in `merge-eslint-config.team-plugin-identity.test.ts`.
  - "Say what to do instead" (q-gap-lint-ts-comment-message): where `@ts-expect-error` is banned too, `ban-ts-comment`'s
    message for a `@ts-ignore` says to fix the type error, not to use `@ts-expect-error`; one more wrapped copy of a
    typescript-eslint rule. The wording is ours; the test pins its meaning. Pinned in
    `check-ts-ignore-message.integration.test.ts`. Whether the editor suggestion "Replace @ts-ignore with
    @ts-expect-error" goes too went back to the owner.
  - "Check them too" (q-gap-lint-unused-vars-scripts-config): `no-unused-vars` no longer ships ignoring `**/scripts/**`
    and `**/*.config.{ts,js,mjs,cjs}`; it still ships ignoring stories. Pinned in
    `typescript-version-named-alone.integration.test.ts` and `editor-merges.twin-pairs.integration.test.ts`.
  - "Yes, treat them as test files" (q-lint-setup-files-as-tests): not built. Which files are test setup files is not
    given: names such as `vitest.setup.*` miss our own bridge (`mutation-testing/child-process-bridge.ts`), whose
    disable comments the answer expects to go, and reading a runner's `setupFiles` is a new mechanism. Went back to the
    owner.
- Owner 2026-10-26/27, "Move to 8.71.2" (q-gap-lint-typescript-eslint-version), asked because @eslint-react 5.26.5 asks
  for typescript-eslint's packages at `^8.71.2` while we pinned 8.71.1 (lane LINT-DEPS): every package that lists
  typescript-eslint, `@typescript-eslint/utils`, `parser` or `rule-tester` pins 8.71.2
  (`git ls-files '*package.json' | xargs grep -n typescript-eslint`), bun.lock is relocked by a plain `bun install`
  (only typescript-eslint entries move) and the inventory is regenerated. The card's consequence, "one copy installs",
  does not hold (measured 2026-10-29): a user's npm install still gets a second version of eight `@typescript-eslint/*`
  packages, the newest release (8.72.1), which the plugins' `^` ranges and is-immutable-type's `^8.0.0` take; and this
  repo's own lock keeps 8.71.1 copies beside the 8.71.2 ones (`grep -E '^    "[^"]+/@typescript-eslint/' bun.lock`).
  Whether to chase one copy, and whether to relock from scratch (which moves unrelated packages), went back to the
  owner.
- Owner 2026-10-29, "Count it as ours" (board card q-lint-unshipped-ts-twin), asked whether the other copy of a rule we
  ship counts as a rule we ship: it does, either way round (typescript-eslint's copy of a core rule we ship, and the core
  rule a typescript-eslint copy we ship extends), so a team may name it in `rules` and `fileOverrides` as before. This
  lifts the hold in the "Only their own config" entry above; no behaviour changed (`isTwinOfARuleWeShip`,
  `core/rules-we-do-not-ship.ts`; pinned in `unshipped-rules-refused.twins.test.ts`; lane TS-TWIN).
- Owner 2026-10-29, "Refuse it, naming the file" (board card q-lint-oxlint-null-beside-extends), asked whether a team's
  oxlint config holding `categories: null` beside a config it extends is refused too: both merges refuse it as
  `categories`, as where it extends nothing, and the ESLint merge no longer reads the extended config's categories in
  its place. Lane OXLINT-NULL-MORE.
- Owner 2026-10-29, "Refuse them all, naming the file" (board card q-lint-oxlint-null-other-keys): a null at any key
  oxlint 1.87 refuses it at (every key but `$schema`, `jsPlugins` and `plugins`), in the team's config or in any config
  it extends at any depth, stops both merges with one line naming the key, what oxlint takes there, and where the null
  sits: the JSON file extended by path that holds it, or the path to the object extended (`extends[0].`)
  (`nullOxlintRefusesIn`, `core/oxlint-config-reading.ts`; pinned in `merge-other-engine-config.refusals.test.ts` and
  `team-oxlint-config-null-keys.integration.test.ts`). A null oxlint refuses inside an override or inside a key's value
  is read as before; whether to refuse it went back to the owner. Lane OXLINT-NULL-MORE.
- Owner 2026-10-29, "Ship it anyway" (board card q-lint-core-dead-store-reported-twice), asked whether
  `no-useless-assignment` ships although the shipped `sonarjs/no-dead-store` reports the same line on 17 of its 70 corpus
  lines: it ships, in oxlint, in redundancy beside `sonarjs/no-dead-store`, and those lines get two reports. An exception
  to #35 (no duplicate reports) the owner accepted for the 53 lines only it finds. oxlint 1.87 has no fix for it.
- Owner 2026-10-29, "Report only, fix withheld" (board card q-lint-core-new-wrappers-fix): `no-new-wrappers` ships, in
  oxlint, in correctness; check reports it and never applies oxlint's fix, which deletes `new` and so turns
  `new Boolean(false)`, always truthy, into `Boolean(false)` (`withheld-fixes.json`; pinned in
  `check-withheld-new-wrappers-and-test-row-fixes.integration.test.ts`).
- Owner 2026-10-29, "Ship it in ESLint with type information" (board card q-lint-tse-type-imports-decorator-metadata):
  `@typescript-eslint/consistent-type-imports` ships typed in ESLint, not in oxlint, in conventions with
  `{ disallowTypeAnnotations: false }`, its reason in `eslintBecause`. Under `emitDecoratorMetadata` the typed version
  leaves a decorated class's constructor parameter import alone, so the emitted `design:paramtypes` keeps naming the
  class; without it, it fixes the import to `import type` (pinned in
  `check-type-imports-under-decorator-metadata.integration.test.ts`). The owner accepted the slower run.
- Owner 2026-10-29, "Report only, fix withheld" (board card q-lint-snr-duplicate-test-rows-fix):
  `sonarjs/no-duplicate-parameterized-test-case` ships, in ESLint, in tests; check reports a repeated `it.each` row and
  never applies the fix, which deletes it even where each row calls something giving a new value (`withheld-fixes.json`;
  pinned beside `no-new-wrappers`).
- Owner 2026-10-29, "Don't ship it" (board card q-lint-snr-duplicated-branches-false-alarms):
  `sonarjs/no-duplicated-branches` is recorded `dropped` in `rule-candidates.json`, decided by that card, superseding its
  2026-10-11 accept: 4 of its 21 corpus reports were false alarms, and where every branch is identical beside an else or
  default it repeats `sonarjs/no-all-duplicated-branches`.
- Owner 2026-10-29, "Allow a patched copy" (board card q-lint-own-immutability-patch), confirmed in chat as "Also add the
  patched copy": this repo installs is-immutable-type 5.0.4 patched (`patches/is-immutable-type@5.0.4.patch`, root
  `patchedDependencies`, as the Stryker runner is). The copy keeps each answer under the type asked about, its type node
  and the immutability limit asked under, never under the recursion identity every instantiation of one generic shares
  (its issue #625); that identity only marks a type being worked out within one call, so a type recursing without end
  still ends (its issue #98). npm gives teams the original, so the per-call wrapper
  (`core/immutability-cache-per-call.ts`) stays as it is for them and our runs go through both. Measured on one build,
  the original swapped in by a loader hook for every other run (`<r44>/resume-1029/evidence/PATCHED-COPY/developer/`,
  `timing-ab.txt`): the rule's own time in a whole-repo lint fell from 40–52 s to 18–20 s, the run from 117–152 s to
  93–100 s, with the same findings. Pinned in `is-immutable-type-patch.test.ts`. Offering the fix upstream is deferred
  by the owner; nothing was built for it. Lane PATCHED-COPY.
- Owner 2026-10-29, "Count it only where oxlint runs it" (board card q-lint-oxlint-override-category-plugins),
  superseding the accepted limit of 2026-10-14: where the team's oxlint config writes a category on, a plugin listed only
  in overrides counts toward the rules the team sets unless every override listing plugins lists one set holding each
  root plugin, as oxlint 1.87 then runs that plugin's category rules in no file (measured,
  `<r44>/resume-1029/evidence/OXLINT-OVERRIDE-PLUGINS/tester/boundary.out`); there both merges keep our copy
  (`pluginsItsCategoriesReach` in `core/oxlint-config-reading.ts`). Overrides listing different sets stay the team's, as
  whether two match one file is not read from their globs. Held for the owner, nothing built: an override that leaves
  out a root plugin, where oxlint runs those rules in its files alone and nobody reports them elsewhere, since both
  merges leave a rule to the team in every file or none (`rulesTheTeamSets`).
- Owner 2026-10-29, "Ship it anyway" (board card q-lint-ug-async-iterator-foreach-reported-twice):
  `unicorn/no-async-iterator-callback` ships, in ESLint, in correctness, on all six iterator methods; on `.forEach` it
  reports the same line as the typed `@typescript-eslint/no-misused-promises`, a double report the owner accepted. Lane
  HELD-1011-UG-UNI.
- Owner 2026-10-29, "Ship ESLint's version instead" (board card q-lint-uni-prefer-at-node-lists): `unicorn/prefer-at`
  ships in ESLint, not oxlint, in modern-js, its reason in `eslintBecause`: ESLint's version leaves the last item of a
  NodeList or of `.children` alone, where oxlint's reports it and its fix there throws or does not compile. check applies
  ESLint's fix, whose `T | undefined` result can fail to type-check, as the card disclosed; on the lane's real run it
  reddened no test (`<r44>/resume-1029/evidence/HELD-1011-UG-UNI/tester/measure-predicted-oxlint/`). Pinned in
  `check-prefer-at-and-single-call-in-eslint.integration.test.ts`.
- Owner 2026-10-29, "Ship ESLint's version instead" (board card q-lint-uni-single-call-custom-push):
  `unicorn/prefer-single-call` ships in ESLint, in redundancy, its reason in `eslintBecause`; ESLint's version leaves a
  class's own `push` alone. check reports it and never applies its fix (`withheld-fixes.json`), which keeps the answer's
  "check never applies the change" true. Correction to the card, which said ESLint's version only suggests: it applies
  its fix to two `classList.add()` or `remove()` calls, two `importScripts()` calls and pushes of fixed values onto a
  known array, and suggests elsewhere (measured on `classList.add` and pushes of literals, eslint-plugin-unicorn 78.0.0).
  Pinned beside prefer-at.
- Owner 2026-10-29, "Ship it only where accessor-pairs is silent" (board card
  q-lint-ug-accessor-override-reported-twice): nothing built. `unicorn/no-incomplete-accessor-override` takes no options
  and reports getter-only and setter-only overrides under one message, so neither a file scope nor any report filter
  this repo has keeps only getter-only overrides and test files. Held on card
  q-lint-ug-accessor-override-only-where-silent.
- Owner 2026-10-29, "Ship it only where it adds a shape" (board card q-lint-uni-unused-return-reported-twice): nothing
  built. `unicorn/no-unused-builtin-method-return` takes no options, and only type information tells the mutable array
  `sonarjs/no-ignored-return` reports from the readonly one it misses, so no file scope or filter this repo has limits it
  to the shapes the shipped rule misses. Held on card q-lint-uni-unused-return-only-new-shapes.
- Correction 2026-10-30 to the "Allow a patched copy" entry above: old, the copy keeps each answer it works out for
  the whole process; new, only one worked out without reading a type around it that is still being worked out. An
  answer that read one (a recursion the copy ended early, which an instantiation of one generic also sets off for
  another, or a partial answer) is kept for that one question, as is the work around it out to the type it read. Why:
  kept for the process, such an answer reached later questions, so a parameter whose type holds an overwritable Pick,
  first met inside another Pick, went unreported with parameters held to ReadonlyDeep or Immutable, where the per-call
  wrapper alone reports it; at the shipped ReadonlyShallow nothing changed. Pinned in `is-immutable-type-patch.test.ts`
  (cases in `work-in-progress-parameter-sources.ts`). Measured as before
  (`<r44>/resume-1029/evidence/PATCHED-COPY/developer/fix-round-1/`, `timing-ab.txt`): the rule's own time fell from
  44 s to 21 s on the quiet pair (61 to 32 s and 121 to 20 s on two pairs under other lanes' load), the findings are
  identical in every pair, and `npx eslint .` and `NODE_ENV=test npx eslint .` give one list. Lane PATCHED-COPY.
- Owner 2026-10-29, "Stop editors offering them too" (board card q-lint-jd-editor-fixes), widened by the owner's words to
  every rule whose fix `check` withholds: in the editor merges each such rule still reports, with no quick fix, and
  fix-on-save leaves its line. Read from `cli/check/withheld-fixes.json` (`WITHHELD_FIXES`), so a later report-only
  answer reaches editors with nothing more. ESLint: `mergeEslintPart` gives each such rule our blocks run a module
  reporting `fix: null` (`withWithheldFixesLeftOut`, `core/fixes-withheld-in-editors.ts`); its suggestions stay. oxlint: 1.87's editor integration (`oxlint --lsp`) offers `no-new-wrappers`' fix as a quick fix
  and in fix-all, its `fixKind: none` drops every rule's fixes and is a setting of the team's editor, and the config
  refuses a per-rule fix option (measured, `<r44>/resume-1029/evidence/LINT-EDITOR-WITHHELD-FIXES/tester/lsp/`). So
  beside oxlint the ESLint part takes over each oxlint-routed rule whose fix `check` withholds and that ESLint can take
  over (a version, not in `eslint-fallback-skips.json`; `runsInEslintBesideOxlint`, `editor-parts.ts`), and the oxlint
  merge turns oxlint's default copy off (`turnedOnInEslint`). ESLint's `no-new-wrappers` has no fix and reports
  everything oxlint's does, plus `new (Boolean)(true)`. `check` is unchanged. A withheld oxlint rule ESLint cannot take
  over has no route: `editor-withheld-fixes.integration.test.ts`, which pins the rest, goes red for it. Not decided,
  returned to the owner, and left as before: a withheld rule the team sets itself in its ESLint or oxlint config keeps
  its fix (it is the team's, as every rule it sets), and the suggestions some of these rules offer stay (proposed cards
  q-lint-editor-withheld-fix-team-set, q-lint-editor-withheld-fix-suggestions). Correction to the two entries above
  that say editors still offer these fixes (jest-dom, and stable-query-client with zod's trim): old, editors offer
  them; new, they do not; why, this answer. Beside oxlint, a `// oxlint-disable-next-line no-new-wrappers` comment (the
  form oxlint's editor quick fix writes) no longer hides that finding in editors, because ESLint runs the rule there; the
  `eslint-disable` form works in editors and in `check` (measured,
  `<r44>/resume-1029/evidence/LINT-EDITOR-WITHHELD-FIXES/reviewer/oxlint-comment-beside-oxlint.out`). Lane
  LINT-EDITOR-WITHHELD-FIXES.
- Owner 2026-10-29, "No switch: editors never apply them" (board card q-lint-editor-withheld-fix-switch): no setting
  lets a team switch a withheld fix back on in its editors; `agents-inc.lint.mts` gets none. Lane
  LINT-EDITOR-WITHHELD-FIXES.
- Owner 2026-10-29, "Report only, fix withheld" (board card q-lint-rc-tanstack-property-order-fix-spread):
  `@tanstack/query/infinite-query-property-order` ships in `tanstack-query` and
  `@tanstack/router/create-route-property-order` in `tanstack-router`, at the plugins' defaults, untyped. check reports
  each and never applies its fix (`withheld-fixes.json`): where a spread sits between the keys it reorders, the fix moves
  a key across the spread, so the spread's value wins (measured, @tanstack/eslint-plugin-query 5.104.5,
  @tanstack/eslint-plugin-router 1.162.0). Editors offer neither fix, as for every fix check withholds
  (q-lint-jd-editor-fixes). With them ships the answer to q-lint-rc-tanstack-property-order-measured ("Ship with
  sorting told to skip these calls"): `ordering`'s `perfectionist/sort-objects` gains a first option,
  `useConfigurationIf.callingFunctionNamePattern` with `type: 'unsorted'`, so it leaves the options of the calls the two
  rules order alone; options passed to any other call, a TanStack one included, and an object nested in those options
  are still sorted. Pinned in `check-ordering-beside-tanstack-property-order.integration.test.ts` and
  `accepted-tsq.integration.test.ts`. Correction to the 2026-10-26/27 entry on q-lint-rc-tanstack-property-order-measured:
  old, both rules and the skip stay held; new, they ship; why, the owner answered the card they waited on. Lane
  HELD-RULES-ANSWERS.
- Correction 2026-10-30 to the "Allow a patched copy" entry and its 2026-10-30 correction above: old, an answer worked
  out without reading a type around it still being worked out is kept for the process; new, not when the step that
  finishes a type read the answer the library last worked out for another type. Why: is-immutable-type hands that step
  its last answer, which for a type whose every child refers back to it, or one with only an index signature, comes
  from a type beside it; kept for the process, it reached later questions, so a parameter holding only
  `type Loop = { readonly next: Loop }` was reported with parameters held to Immutable, and one that is a read-only
  string-keyed record or undefined was reported as Mutable at the shipped ReadonlyShallow; the per-call wrapper alone
  reports neither. Pinned in `is-immutable-type-patch.test.ts` (cases in `work-in-progress-parameter-sources.ts`).
  Measured (`<r44>/resume-1029/evidence/PATCHED-COPY/developer/fix-round-2/`, `rule-time.txt`): the rule's own time
  fell from 43 s to 28 s on one pair, and from 102 s to 19 s on one under other lanes' load, where the previous copy,
  run next, also took 19 s; every run, `npx eslint .` and `NODE_ENV=test npx eslint .` give one list. Lane PATCHED-COPY.
- Correction 2026-10-30 to the 2026-10-29 entry on q-lint-rc-tanstack-property-order-fix-spread ("Report only, fix
  withheld"): old, both TanStack property-order rules ship report only, with `ordering`'s `perfectionist/sort-objects`
  skipping the calls they order; new, neither ships, the skip is not built, and both wait as `recommended`. Why: neither
  can ship exactly as answered with what exists. sort-objects can skip a call only by its name (perfectionist 5.12.1
  matches `callingFunctionNamePattern` on the callee's text, with no import filter), so in every project with
  `ordering` the skip also left unsorted the options of `@hono/zod-openapi`'s `createRoute`, which the CLI monorepo's
  API server uses, and of `@pinia/colada`'s `useInfiniteQuery` (measured). And
  `@tanstack/router/create-route-property-order` throws on a spread of anything but a plain name
  (`...routeDefaults()`, `...(devOnly ? { ssr: false } : {})`) in any call named `createRoute`, `createFileRoute`,
  `createRootRoute` or `createRootRouteWithContext`, Hono's included, so check left the whole file unchecked and exited
  2 where it found nothing else (measured, @tanstack/eslint-plugin-router 1.162.0, the newest). The answer stays
  recorded and is built once the two proposed cards are answered: q-lint-rc-tanstack-property-order-skip-by-name (both
  rules and the skip) and q-lint-rc-tanstack-router-order-spread-crash (the Router rule). `withheld-fixes.json` keys
  neither while they are held, as for every rule that does not ship. Pinned in `accepted-tsq.integration.test.ts` and
  `check-ordering-beside-tanstack-property-order.integration.test.ts`. Lane HELD-RULES-ANSWERS.
- Correction 2026-10-30 to the 2026-10-30 correction on q-lint-rc-tanstack-property-order-fix-spread ("neither ships"):
  old, sort-objects can skip a call only by its name, and both rules and the skip wait on card
  q-lint-rc-tanstack-property-order-skip-by-name; new, it can also skip by an AST selector
  (`useConfigurationIf.matchesAstSelector`, perfectionist 5.12.1), so only where the file imports the call's name from
  `@tanstack/`, and the card is q-lint-rc-tanstack-property-order-which-skip, offering both. Why: both TanStack rules
  check a call by its name alone, whatever it is imported from, so neither skip matches them. By name, `ordering` also
  leaves unsorted the options of another library's call of those names (`@pinia/colada`'s `useInfiniteQuery`,
  `@hono/zod-openapi`'s `createRoute`); by import, those are sorted, but a TanStack call reached through a re-export
  (`./query-client`, `@/lib/query`) is sorted and still checked, so where both rulesets are on no order of its options
  satisfies both (measured, `<r44>/resume-1029/evidence/HELD-RULES-ANSWERS/reviewer/review-2/selector-skip.out` and
  `.../developer/fix-round-2/skip-matrix.out`). Both rules stay held; the Router rule's card
  q-lint-rc-tanstack-router-order-spread-crash is unchanged. Lane HELD-RULES-ANSWERS.
- Owner 2026-10-29, no option chosen, the note the answer (board card q-lint-pw-off-by-default-where): "there are many
  rules that we have as off by default but we should still ship them. how else will a consumer be able to switch them
  on? these rules should still be shipped, but just be shipped as off". Built: an accepted rule kept off by default
  ships with `offByDefault: true` in `data/rules.json`, in no ruleset, so `agents-inc.lint.mts` accepts it in `rules`
  and in a `fileOverrides` entry's `rules`, and it runs, in `check` and in the editor parts alike, only where a team
  names it. Seven ship so: the four Playwright rules that repeat a Vitest rule, `playwright/prefer-web-first-assertions`
  (its fix withheld in `withheld-fixes.json`, so editors withhold it too, as q-lint-rc-web-first-assertions-measured
  answered), and `unicorn/prefer-dispose` and `unicorn/prefer-iterator-zip`, whose only rewrite is a suggestion `check`
  never applies. `init` writes the five Playwright rules as a commented-out `fileOverrides` entry for `e2e/**`. A rule
  we do not ship is still refused (q-lint-unshipped-rules-channel). Pinned in `rules-shipped-off.test.ts`,
  `check-rules-shipped-off.integration.test.ts`, `config-text.test.ts`, `init.integration.test.ts`,
  `canonical-list.test.ts`, `catalog.test.ts` and `accepted-pw.integration.test.ts`. Correction to the 2026-10-26/27
  entry on q-lint-rc-web-first-assertions-measured and the 2026-10-29 correction on the four Playwright rules that
  repeat a Vitest rule: old, all five stay held and only a team's own ESLint config can turn them on; new, they ship off
  and a team turns them on in `agents-inc.lint.mts`; why, this answer. Lane SHIP-OFF-BY-DEFAULT.
- Held 2026-10-30 on a new card, q-lint-newest-language-fix: the other nine parked newest-language rules
  (`e18e/prefer-get-or-insert`, and unicorn's `prefer-error-is-error`, `prefer-get-or-insert-computed`,
  `prefer-iterator-concat`, `prefer-promise-try`, `prefer-regexp-escape`, `prefer-temporal`, `prefer-uint8array-base64`
  and `prefer-uint8array-hex`) do not ship off with the two above. Each declares an automatic fix writing an API Node 22
  lacks, which `check` would apply wherever a team turned the rule on: with the fix of `prefer-regexp-escape`,
  `prefer-error-is-error` or `prefer-promise-try` applied, a passing test threw a TypeError on Node 22.23.2 (measured,
  `<r44>/resume-1029/evidence/SHIP-OFF-BY-DEFAULT/tester/fix-measure/runs.out`; the other six unmeasured). Whether
  `check` applies those fixes is the owner's. They stay `parked` in `rule-candidates.json`, each why naming the card.
  Pinned in `rule-candidates.test.ts`, `accepted-candidates.test.ts`, `catalog.test.ts` and `rules-shipped-off.test.ts`.
  Lane SHIP-OFF-BY-DEFAULT.
- Owner 2026-10-30, "Also list the nine other typescript-eslint packages at 8.71.2" (q-lint-tseslint-one-copy), the
  first question the "Move to 8.71.2" entry sent back: `@agents-inc/lint-rules` lists every typescript-eslint package a
  user's install reaches (`eslint-plugin`, `parser`, `project-service`, `scope-manager`, `tsconfig-utils`, `type-utils`,
  `types`, `typescript-estree`, `utils`, `visitor-keys`, and `typescript-eslint`) at typescript-eslint's version, so the
  plugins' `^` ranges take ours and npm installs no newer copy, until a plugin needs a newer one. Measured 2026-10-30 on
  a packed stand-in's npm install: 24 copies before, 11 after, one each at 8.71.2
  (`<r44>/resume-1029/evidence/TSESLINT-ONE-COPY/developer/consumer.json`). A plain `bun install` moved only
  typescript-eslint entries in bun.lock, which keeps nested 8.71.1 copies; relocking from scratch stays the owner's.
  Pinned in `package-manifests.test.ts` and `packed-install.integration.test.ts`. Lane TSESLINT-ONE-COPY.
- Owner 2026-10-30, "Drop them too" (q-lint-editor-withheld-fix-suggestions): in the editor merges each rule our blocks
  run whose fix `check` withholds reports with no suggestion as well as no fix, so an editor's quick-fix menu lists no
  rewrite for it (`fix: null, suggest: null`, `core/fixes-withheld-in-editors.ts`). Of the withheld rules only
  `jest-dom/prefer-in-document` and `unicorn/prefer-single-call` pass one (`@tanstack/query/stable-query-client`
  declares suggestions and passes none; measured,
  `<r44>/resume-1029/evidence/EDITOR-WITHHELD-SUGGESTIONS/tester/has-suggestions.out`); both run in ESLint with or
  without oxlint, so the oxlint merge is unchanged. Pinned in `editor-withheld-fixes.integration.test.ts`. Correction
  to the "Stop editors offering them too" entry: old, "its suggestions stay" and "the suggestions some of these rules
  offer stay"; new, editors list none; why, this answer. Lane EDITOR-WITHHELD-SUGGESTIONS.
- Owner 2026-10-30, "Refuse them all, naming the file" (board card q-lint-oxlint-null-deeper), asked whether a null
  oxlint refuses below a key is refused too: both merges refuse, with one line naming the file, the path to the null and
  what to write there, every null oxlint 1.87 refuses whatever the rule or plugin, in the team's config and in each
  config it extends at any depth: an override's `files`, `excludeFiles` or `rules`; one rule's or category's severity,
  its first slot included (`overrides[0].rules["no-debugger"][0]`); one `env` or `globals` entry; a plugin's `settings`
  (`jest`, `jsdoc`, `jsx-a11y`, `next`, `react`, `vitest`); a slot in `extends`, `overrides`, `plugins`,
  `ignorePatterns`, `jsPlugins` or an override's globs, `plugins` or `jsPlugins`; a JS plugin's `name` or `specifier`
  (`nullOxlintRefusesIn`, `core/nulls-oxlint-refuses.ts`; pinned in `merge-other-engine-config.refusals.test.ts` and
  `team-oxlint-config-null-keys.integration.test.ts`; measured,
  `<r44>/resume-1029/evidence/OXLINT-NULL-DEEPER/tester/oxlint-itself-*.out`). Read as before, oxlint taking them: an
  override's `env`, `globals`, `plugins` and `jsPlugins` null, every option null, and a settings key no plugin of
  oxlint's reads. Held: a null among a rule's options or in a field of a plugin's settings, which oxlint refuses for
  some rules and fields and takes for others (`no-debugger` refuses `["error", null]`, `no-unused-vars` takes it;
  `react.version` takes null, `jsdoc.ignoreInternal` refuses it); whether to refuse them went back to the owner on a
  new card. Lane OXLINT-NULL-DEEPER.
- Owner 2026-10-30, "Keep it the team's in every file" (board card q-lint-oxlint-override-leaves-out-root-plugin), the
  owner noting "Typescript won't be long added for one folder only": where a team's oxlint config lists typescript in
  one override alone and that override leaves out a plugin its root lists, each merge leaves typescript's category
  rules to the team in every file, though oxlint runs them in that override's files alone, so outside them nobody
  reports them. No code: the reading as it stands, pinned in `editor-merges.team-sets-a-rule.integration.test.ts`
  ("is the team's in every file where one override alone lists typescript beside a root listing unicorn") and
  `core/oxlint-config-reading.test.ts` ("one override lists typescript beside a root listing import, which the
  override leaves out"). Lane OXLINT-NULL-DEEPER.
- Correction to the 2026-10-29 entry on q-lint-oxlint-null-other-keys: old, "A null oxlint refuses inside an override
  or inside a key's value is read as before; whether to refuse it went back to the owner"; new, it is refused as the
  q-lint-oxlint-null-deeper entry above says, a rule's options and a plugin's settings fields aside; why, the owner's
  answer to that card. Lane OXLINT-NULL-DEEPER.
- Owner 2026-10-29, "Report only, no auto-fix" (board card q-lint-rc-pressed-fix-current-jest-dom), asked how
  `jest-dom/prefer-pressed` ships now that its fix breaks a passing test on jest-dom 6.9.1 too: it ships in `jest-dom`
  like the other six, and check and editors withhold its fix (`withheld-fixes.json`), which turns a passing test that
  `aria-pressed` is present on a button not pressed into a failing `toBePressed()` (measured, jest-dom 6.9.1). False
  alarms: 9 hits in one file of 7,861, none false. Pinned in `check-withheld-jest-dom-fixes.integration.test.ts` and
  `editor-withheld-fixes.integration.test.ts`. Lane JD-PRESSED.
- Owner 2026-10-29, "Decided against for now" (board card q-lint-hp-left-off-record), asked whether the two react-ssr
  rules left off (q-lint-rc-hydration-false-alarms-measured, "Leave them off") are decided against or wait on something
  named: `hydration-proof/no-browser-global-in-render` and `hydration-proof/no-locale-without-explicit-locale` are
  recorded `dropped` in `rule-candidates.json`, decided by that card, like the two drizzle rules; a later card can bring
  them back. Their held cases are gone (in git at 707df6e). Pinned in `rule-candidates.test.ts` and
  `accepted-candidates.test.ts`. Lane HP-LEFT-OFF-RECORD.
- Owner 2026-10-30, "Yes, the rule is the team's" (board card q-lint-editor-withheld-fix-team-set), the owner noting
  "we have no say over functionality they add or remove from their respective configs make sure that's consistent": a
  rule a team sets in its own ESLint or oxlint config keeps everything its plugin gives it, fix and suggestions
  included, in both merges; our withheld fixes and suggestions reach only the rules our blocks run (unchanged, pinned).
  Made consistent in the ESLint merge: our `ban-ts-comment` message ("remove it and fix the type error it hides") wraps
  only the copy our blocks run (`withOurTsIgnoreMessage`, `core/ts-ignore-message.ts`, no longer in the plugin
  registry), so a team that sets the rule and relies on the plugin we register gets typescript-eslint's own message, as
  it does registering the plugin itself; `check` keeps ours. Beside oxlint, a rule name the team's ESLint config turns
  on gets no do-nothing rule, and a prefix no plugin of ours or the team's backs gets no plugin of stubs once the team
  turns a rule on under it (`stubsLeavingUndefinedWhatTheTeamTurnsOn`): ESLint refuses a rule no plugin defines with
  the error the team's config alone gets, where before the rule silently did nothing. Turned off, or set nowhere, the
  stub stays, so a suppression of an oxlint-run rule still loads. Still reaching a team's rule, waiting on card
  q-lint-team-set-repaired-copies: where the team relies on the plugins we register, the re-export-cycle and
  immutability repairs (`consistent-type-exports`, `no-deprecated`, `prefer-immutable-types`); and the compat layer
  (`withCompatLayerWhereNeeded`, `core/eslint-compat.ts`: `css-modules`, `react`, `react-hook-form`), which
  `pluginUnder` also applies to a plugin the team registers itself, so a team-set `react-hook-form/no-use-watch` or
  `css-modules/no-undef-class` reports merged where the team's config alone throws (`context.getScope` /
  `context.getFilename is not a function`; measured, ESLint 10). Consistent with O8 (the team's settings win where set):
  our settings fill only keys the team leaves unset, so a team that sets `import-x/no-unresolved` and gives no resolver
  runs it on ours (measured: `@/b` resolves merged; alone, "Unable to resolve path to module '@/b'"). Pinned in
  `editor-merges.team-set-rules-as-shipped.integration.test.ts`. Correction to the 'Stop editors offering them too'
  entry: old, "a withheld rule the team sets itself keeps its fix ... returned to the owner"; new, decided as above;
  why, this answer. Lane TEAM-SET-CONSISTENT.
- Owner 2026-10-29, "Where the nearest package.json lists next" (board card q-lint-hp-next-setting-where), asked how our
  config knows a project is a Next.js app, to pass the setting that stops the `react-ssr` rules reporting pages only the
  server renders: both builds give `settings['hydration-proof'].serverComponents: 'next-app'` to each JS and TS file
  whose own nearest `package.json` lists `next` in `dependencies` or `devDependencies`, read from manifests alone, never
  `node_modules`, in a block `agents-inc/next-js-server-components` given only where a `hydration-proof` rule of ours
  runs (`build-eslint-config.ts`, `core/next-js-apps.ts`). A Remix or React Router app, and a monorepo's other apps,
  whose own `package.json` lists no `next`, stay checked. Accepted consequence: in a Next.js app the rules also skip a
  file without `'use client'` in any other folder named `app` (a Pages Router app's too) and miss a component without
  it that a `'use client'` file imports (both pinned as KNOWN GAP); `check` gives a team no way to turn it off, and in
  the editor merge a team block after ours giving the setting decides. Pinned in
  `server-components-in-next-apps.integration.test.ts` and `check-server-components-in-next-apps.integration.test.ts`.
  Lane HP-SETTINGS.
- Owner 2026-10-29, "Skip every src/index file" (board card q-lint-barrel-entry-how), asked how `unicorn/no-barrel-files`,
  which takes no options, recognises a package's main entry to leave it alone: the rule ships with
  `ignores: ["**/src/index.*"]` in `rules.json`, the glob the card's measurement used, so a file named `index` directly
  in any `src` folder is never reported, whatever its extension (`src/index.d.ts` too); every other barrel still is.
  Accepted consequence: an entry at a package root, named otherwise or named only by a build script stays flagged, and a
  `src/index` that is no package's entry is spared. Correction to the "Leave entry files alone" entry: old, "our
  `packages/rule-data/src/index.ts` finding stays"; new, it is no longer reported, with no change to the file; why, this
  answer. Pinned in `check-barrel-entry-files.integration.test.ts` and the rule's case in `changed-settings.ts`. Lane
  SCOPE-BARREL.
- Owner 2026-10-29, "Report only, fix withheld" (board cards q-lint-jsdom-add-event-listener-fix,
  q-lint-jsdom-css-escape, q-lint-jsdom-dataset-fix, q-lint-jsdom-keyboard-event-key-fix,
  q-lint-jsdom-modern-dom-apis-fix, q-lint-jsdom-query-selector-fix, q-lint-jsdom-src-prefer-https and
  q-lint-presence-queries-attribute-fix), each asked whether `check` keeps applying a shipped rule's fix that turned a
  passing jsdom test red or stopped it typechecking: `unicorn/prefer-add-event-listener`, `require-css-escape`,
  `dom-node-dataset`, `prefer-keyboard-event-key`, `prefer-modern-dom-apis`, `prefer-query-selector`, `prefer-https` and
  `testing-library/prefer-presence-queries` ship where they did, and `check` reports each line and never rewrites it
  (`withheld-fixes.json`; oxlint's fix run turns `dom-node-dataset` off under its oxlint name, `fixRunConfigOf`); editors
  withhold the fix too (`fixes-withheld-in-editors.ts`, and `editor-parts.ts` hands `dom-node-dataset` to ESLint). With this
  and the next two entries, on a packed install's real Vitest suite of 29 tests (jsdom 30.1.3 and 29.1.1): before, 15
  and 17 failed after `check` and `tsc` failed; after, all 29 pass, `tsc` passes and a second `check` rewrites nothing
  (`<r44>/resume-1029/evidence/FIXES-WITHHELD-1029/`). Pinned in `check-withheld-jsdom-fixes.integration.test.ts` and
  `editor-withheld-fixes.integration.test.ts`. Lane FIXES-WITHHELD-1029.
- Owner 2026-10-29, "Turn the rule off" (board cards q-lint-jsdom-src-prefer-dom-node-html-methods and
  q-lint-jsdom-src-prefer-location-assign), both answered in chat: `unicorn/prefer-dom-node-html-methods` (its fix writes
  `getHTML()`, which jsdom lacks) and `unicorn/prefer-location-assign` (its fix writes `location.assign()`, which a test's
  stand-in location lacks) no longer ship in `browser`, so `check` neither reports nor rewrites them. Held on a new card,
  q-lint-jsdom-off-rules-fix, rather than shipped off as q-lint-pw-off-by-default-where builds a rule kept off: a team
  that turned either on would get the fix that broke the test, and whether `check` applies it there is the owner's, as
  for the newest-language rules (q-lint-newest-language-fix). Both are `parked` in `rule-candidates.json`, each why
  naming the cards. Correction to the "Not in test files" entry (q-lint-unicorn-gethtml-jsdom): old, the rule ships and
  skips test files; new, it does not ship; why, this answer. Pinned in `check-withheld-jsdom-fixes.integration.test.ts`
  (each refused as a rule we do not ship; a `location.href` write neither reported nor rewritten),
  `check-html-reads-in-test-files.integration.test.ts` and the test-file skips in `canonical-list.test.ts`. Lane
  FIXES-WITHHELD-1029.
- Owner 2026-10-29, "Run it in ESLint" (board card q-lint-jsdom-src-no-useless-spread): `unicorn/no-useless-spread` runs
  in ESLint, never oxlint (`engine: "eslint"` with an `eslintBecause` in `rules.json`), as "Ship ESLint's version
  instead" is built for `prefer-at` and `prefer-single-call`. oxlint's version (1.87.0) removes the spread around an
  iterator's `.map()`, so `[...list.values().map(f)]` returned an iterator and a passing test failed in jsdom, Node and
  browsers alike; ESLint's (eslint-plugin-unicorn 78.0.0) leaves it alone and still reports and fixes a plain useless
  spread. Accepted consequence: `[...array.map(f)]` is no longer reported, and the rule runs at ESLint's speed. Pinned in
  `check-withheld-jsdom-fixes.integration.test.ts`, `eslint-fallback.integration.test.ts` and the routed list in
  `canonical-list.test.ts`. Lane FIXES-WITHHELD-1029.
- Owner 2026-10-29, "Keep the fix" (board cards q-lint-jsdom-src-prefer-queue-microtask,
  q-lint-jsdom-src-no-unnecessary-fetch-options and q-lint-jsdom-src-no-selector-as-dom-name): `check` keeps rewriting
  `process.nextTick(f)` to `queueMicrotask(f)`, `fetch(url, { method: 'GET' })` to `fetch(url)` and
  `classList.add('.active')` to `classList.add('active')`. Accepted consequences: a suite faking `nextTick` (Vitest's
  threads pool) must wait another way, an assertion on the dropped option fails once, and a snapshot holding the dotted
  class fails once and is accepted with `vitest -u`. No change; pinned in `check-withheld-jsdom-fixes.integration.test.ts`
  and `editor-withheld-fixes.integration.test.ts` (each fix applied). Lane FIXES-WITHHELD-1029.
- Correction 2026-10-30 to the 2026-10-29 entry on q-lint-jsdom-src-no-useless-spread ("Run it in ESLint"): old,
  `unicorn/no-useless-spread` runs in ESLint, whose version leaves `[...list.values().map(f)]` alone; new, it does not
  ship, `parked` in `rule-candidates.json` and held on card q-lint-useless-spread-loop-copy. Why: ESLint's version removes
  the copy in `for (const child of [...parent.childNodes]) child.remove()` and in a loop over
  `[...root.getElementsByClassName('item')]` that removes the class, so the loop walks the live list it shrinks and skips
  items; on a packed install two passing jsdom tests failed after `check` (measured, eslint-plugin-unicorn 78.0.0, jsdom
  29.1.1). oxlint 1.87.0 reported both lines and rewrote neither. The answer's "no wrong rewrite" does not hold, and the
  rule takes no option that limits it, so how it ships is the owner's. Pinned in
  `check-withheld-jsdom-fixes.integration.test.ts` (each loop and a plain useless spread neither reported nor rewritten;
  the rule refused as one we do not ship). Lane FIXES-WITHHELD-1029.
- Owner 2026-10-29, "Yes, always a reason" (board card q-lint-cmt-inline-config-reason), asked whether a comment that
  sets a rule for its file (`/* eslint no-console: "off" */`, or `/* eslint eqeqeq: ["error", "smart"] */`, which only
  changes an option) needs a reason after `--`: it does. `@eslint-community/eslint-comments/require-description` stays
  held, now on q-lint-cmt-oxlint-disable-reason: it reads an `oxlint-disable*` comment only where its
  `additionalDirectives` option names that spelling (measured, eslint-comments 4.8.1: named, each of the three forms is
  reported and a described one or an `oxlint-enable` is not), and no answer says whether that spelling needs a reason.
  Shipped without it, an agent skips the reason by writing `oxlint-disable` (reproduced on a packed install). Correction
  to the "Only switch-off comments" entry: old, held on q-lint-cmt-inline-config-reason; new, held on
  q-lint-cmt-oxlint-disable-reason; why, this answer settled rule-setting comments. Its case, rule-setting comments
  included, is held in `accepted-cmt.ts` (lane RULES-CMT-REASON).
- Owner 2026-10-29, "Move it into a ruleset" (board card q-lint-ban-ts-comment-editor), answered the question the
  q-lint-cmt-editor-reach entry left open: whether `@typescript-eslint/ban-ts-comment`, on in every config and in no
  ruleset, stays in every team's editor. It moves into `type-safety`, whose membership test in
  [critique r1](ruleset-critique-r1.md) names `@ts-` comments and which that critique already gave it ("removing it
  changes what tsc reports"). Editors run it only where their rulesets list `type-safety`; the agent build still sets it
  by `allowSuppressions` whatever is listed. Correction to the 2026-10-10 entry "Both are ALWAYS ON": old, both
  suppression bans always on, in no ruleset; new, only `house/no-suppressions`; why, this answer. Pinned in rule-data's
  `canonical-list.test.ts` and `catalog.test.ts` (lane BAN-TS-COMMENT-RULESET).
- Owner 2026-10-29, "Leave `using` declarations alone" (board card q-lint-immediate-return-using-fix):
  `sonarjs/prefer-immediate-return` neither reports nor rewrites a returned variable that a `using` or `await using`
  declaration holds; everywhere else it is unchanged, and `unicorn/no-using-resource-escape` reports the escape. Its fix,
  `return openFile()`, drops the `using` and so the disposal, and in a TypeScript file check rewrote the line before
  unicorn's report could be read (measured, eslint-plugin-sonarjs 4.2.2, eslint-plugin-unicorn 78.0.0). The rule takes no
  option and check's filters go by rule id, so our plugin registry gives sonarjs a copy of the rule that drops those
  reports, for check and editors alike (`withReturnedUsingResourcesLeftAlone`, `core/returned-using-resources.ts`). A
  thrown `using` variable is outside the answer and keeps its report and fix. Pinned in
  `check-immediate-return-of-a-using-resource.integration.test.ts`,
  `editor-immediate-return-of-a-using-resource.integration.test.ts` and, for the thrown variable,
  `core/returned-using-resources.test.ts` (lane IMMEDIATE-RETURN-USING).
- Owner 2026-10-30, "Leave thrown `using` alone too" (board card q-lint-immediate-return-thrown-using):
  `sonarjs/prefer-immediate-return` neither reports nor rewrites a thrown variable that a `using` or `await using`
  declaration holds either, so nothing reports that line; its fix, `throw open()`, drops the `using` and so the disposal
  (measured, eslint-plugin-sonarjs 4.2.2; eslint-plugin-unicorn 78.0.0's `no-using-resource-escape` reports a returned one
  only). Correction to the 2026-10-29 entry "A thrown `using` variable is outside the answer and keeps its report and
  fix": old, reported and fixed; new, left alone; why, this answer. Pinned in `core/returned-using-resources.test.ts`,
  `check-immediate-return-of-a-using-resource.integration.test.ts` and
  `editor-immediate-return-of-a-using-resource.integration.test.ts` (lane THROWN-USING).
- Owner 2026-10-30, "Ship it everywhere" (board card q-lint-ug-accessor-override-only-where-silent):
  `unicorn/no-incomplete-accessor-override` ships in `correctness`, in ESLint (oxlint has no version), untyped, with no
  options, in every file. Accepted consequence: a setter-only override outside test files is reported twice, by it and
  by `accessor-pairs`. It has no fix or suggestion, so nothing is withheld (measured, eslint-plugin-unicorn 78.0.0).
  Correction to the 2026-10-29 entry "Ship it only where accessor-pairs is silent": old, held on this card; new, ships
  everywhere; why, this answer. Pinned in rule-data's `accepted-1011-ug.integration.test.ts`, the double report
  included (lane HELD-ANSWERS-1030).
- Owner 2026-10-30, "Ship both" (board card q-lint-uni-unused-return-only-new-shapes):
  `unicorn/no-unused-builtin-method-return` ships in `correctness` beside `sonarjs/no-ignored-return`, in ESLint (oxlint
  has no version), untyped (it reports without type information), with no options. Accepted consequence: a discarded
  array `.map()` in TypeScript is reported twice. It has no fix or suggestion (measured, eslint-plugin-unicorn 78.0.0).
  Correction to the 2026-10-29 entry "Ship it only where it adds a shape": old, held on this card; new, ships; why, this
  answer. Pinned in rule-data's `accepted-1011-uni.integration.test.ts`, the double report included (lane
  HELD-ANSWERS-1030).
- Owner 2026-10-30, "Leave both rules out" (board card q-lint-rc-tanstack-property-order-which-skip): neither
  `@tanstack/query/infinite-query-property-order` nor `@tanstack/router/create-route-property-order` ships, and
  `perfectionist/sort-objects` keeps no skip; none had been built (`rules.json`'s only `useConfigurationIf` is on
  `sort-arrays`, and `withheld-fixes.json` keys neither rule). Both are `dropped` in `rule-candidates.json`, the Query
  rule decided by this card. Correction to the 2026-10-26/27 entry on q-lint-rc-tanstack-property-order-measured, the
  2026-10-29 entry on q-lint-rc-tanstack-property-order-fix-spread and the two 2026-10-30 corrections to it: old, both
  ship once sorting's skip is settled; new, neither ships; why, this answer. Pinned in `accepted-tsq.integration.test.ts`,
  `accepted-candidates.test.ts` and `rule-candidates.test.ts` (lane HELD-ANSWERS-1030).
- Owner 2026-10-30, "Leave it out" (board card q-lint-rc-tanstack-router-order-spread-crash):
  `@tanstack/router/create-route-property-order` is `dropped`, decided by this card, its why naming the which-skip
  answer too. Pinned in `rule-candidates.test.ts` (lane HELD-ANSWERS-1030).
- Owner 2026-10-30, "Ship them off, fix held back" (board card q-lint-newest-language-fix): the nine newest-language
  rules (`e18e/prefer-get-or-insert`, and unicorn's `prefer-error-is-error`, `prefer-get-or-insert-computed`,
  `prefer-iterator-concat`, `prefer-promise-try`, `prefer-regexp-escape`, `prefer-temporal`, `prefer-uint8array-base64`
  and `prefer-uint8array-hex`) ship off by default (`offByDefault`, ESLint, no options, untyped), so a team turns one on
  in `agents-inc.lint.mts`; `check` reports it and rewrites nothing, and editors offer neither its fix nor its
  suggestions (`withheld-fixes.json`, each why naming the API Node 22.23.2 lacks, measured). `prefer-temporal` has a fix
  too: with `checkDateNow` on, `Date.now()` becomes `Temporal.Now.instant().epochMilliseconds` (measured,
  eslint-plugin-unicorn 78.0.0). Correction to the "Held 2026-10-30 on a new card, q-lint-newest-language-fix" entry:
  old, they stay `parked`, unshipped; new, they ship off with their fix withheld; why, this answer. Pinned in
  `canonical-list.test.ts`, `catalog.test.ts`, `rule-candidates.test.ts` (none also ships),
  `accepted-e18.integration.test.ts`, `rules-shipped-off.test.ts`, `check-rules-shipped-off.integration.test.ts` and
  `editor-withheld-fixes.integration.test.ts`. Lane SHIP-OFF-ANSWERS-1030E.
- Owner 2026-10-30, "Ship them off, fix held back" (board card q-lint-jsdom-off-rules-fix):
  `unicorn/prefer-dom-node-html-methods` and `unicorn/prefer-location-assign` ship off by default, as above, in every
  file a team names them for: `prefer-dom-node-html-methods` skipped test files only for its fix, now withheld. `check`
  reports them and rewrites nothing, and editors offer no fix. Correction to the 2026-10-29 "Turn the rule off" entry: old, held on this
  card, pinned in `check-withheld-jsdom-fixes.integration.test.ts` (each refused as a rule we do not ship); new, they
  ship off with their fix withheld, pinned in `rules-shipped-off.test.ts`, `check-rules-shipped-off.integration.test.ts`
  and `editor-withheld-fixes.integration.test.ts`, and that file keeps only `unicorn/no-useless-spread` refused; why,
  this answer. Lane SHIP-OFF-ANSWERS-1030E.
- Owner 2026-10-30, "Keep the repairs" (board card q-lint-team-set-repaired-copies): a rule a team sets keeps our crash
  repairs. Where the team relies on the plugins our merge registers, typescript-eslint's `no-deprecated` and
  `consistent-type-exports` run our copy that ends a re-export cycle and functional's `prefer-immutable-types` our
  per-call cache; the ESLint 10 compat layer reaches `css-modules`, `react` and `react-hook-form` where the team
  registers them itself too. No code: today's behaviour. Pinned in
  `editor-merges.team-set-rules-as-shipped.integration.test.ts` (the two typescript-eslint rules end on a re-export
  cycle; `react-hook-form/no-use-watch` reports through the compat layer); `prefer-immutable-types`, and the compat layer
  for `css-modules` and `react`, which take the same `withCompatLayerWhereNeeded` path, are not. Correction to the "Yes,
  the rule is the team's" entry: old, "Still reaching a team's rule, waiting on card q-lint-team-set-repaired-copies";
  new, they reach it; why, this answer. Lane SHIP-OFF-ANSWERS-1030E.
- Owner 2026-10-30, "Leave them to oxlint" (board card q-lint-oxlint-null-rule-options-and-settings): both merges read a
  null among a rule's options or in a field of a plugin's settings as before, and oxlint refuses those it refuses
  itself, naming the rule but not the file. No code: today's behaviour. Pinned in
  `merge-other-engine-config.refusals.test.ts` (the "left for oxlint to refuse" cases,
  `NULLS_OXLINT_REFUSES_FOR_SOME_RULES_OR_SETTINGS` in `team-oxlint-config-null-keys.ts`). Correction to the
  q-lint-oxlint-null-deeper entry, and to its correction of the q-lint-oxlint-null-other-keys entry: old, those nulls
  "Held" and "whether to refuse them went back to the owner"; new, left to oxlint; why, this answer. Lane
  SHIP-OFF-ANSWERS-1030E.
- Owner 2026-10-30, "The usual names, and rename our bridge to one" (board card q-lint-setup-files-which), which the
  "Yes, treat them as test files" point of the 2026-10-26/27 merge entry sent back: a file named `vitest.setup.*`,
  `jest.setup.*`, `setupTests.*` or `test-setup.*` gets test files' relaxed rules. Every rule whose `ignores` in
  `data/rules.json` names test files skips it too; `ban-ts-comment` allows a described `@ts-expect-error` there
  (`TEST_FILE_GLOBS` in `generate/build-routing.ts`, the files of `bannedInTestFiles`); Vitest's and Jest's globals are
  read-only there in every JS and TS extension (`TEST_RUNNER_GLOBALS`, `core/framework-globals.ts`). No runner's config
  is read. The rules that run in test files alone (Testing Library's, and Playwright's two) keep their `files`: whether
  they reach setup files went back to the owner. Our mutation-testing bridge is `mutation-testing/vitest.setup.ts`, and
  its disable comments for `functional/no-return-void` and `functional/no-expression-statements`, which setup files now
  skip, are gone; those for rules test files keep stay. Pinned in `setup-files.integration.test.ts` and rule-data's
  `canonical-list.test.ts` ("has no ignores list naming test files without every setup-file glob") and
  `catalog.test.ts`. Correction to that point: old, not built, went back to the owner; new, built as above; why, this
  answer. Lane MERGE-ANSWER-4.
- Owner 2026-10-30, "Keep typescript-eslint's advice there" (board card q-lint-ts-ignore-message-editor): our message
  for a `@ts-ignore` ("remove it and fix the type error it hides") replaces typescript-eslint's only where
  `@ts-expect-error` is banned too, which is `check` outside test and setup files; editors, which always allow a
  described `@ts-expect-error`, and test and setup files keep typescript-eslint's advice to use one. No code beyond
  setup files: `editor-ts-ignore-message.integration.test.ts` is corrected to it, and `setup-files.integration.test.ts`
  pins it in setup files. Lane MERGE-ANSWER-4.
- Owner 2026-10-30, "Remove it there" (board card q-lint-ts-ignore-quick-fix): where our blocks run `ban-ts-comment`
  banning `@ts-expect-error` too, its report on a `@ts-ignore` carries no suggestion, so nothing offers the swap into
  the other ban (`suggest: null` beside our message, `core/ts-ignore-message.ts`). Elsewhere typescript-eslint's
  'Replace "@ts-ignore" with "@ts-expect-error".' stays, and a `ban-ts-comment` the team sets itself keeps all of
  typescript-eslint's. Today that is `check`'s build outside test and setup files, which prints no suggestion; the
  editor parts allow suppressions everywhere (`core/editor-parts.ts`), so no editor reaches it. Pinned in
  `ts-ignore-quick-fix.integration.test.ts` and `core/ts-ignore-message.test.ts`. Correction to the "Say what to do
  instead" point of the 2026-10-26/27 merge entry: old, whether the suggestion goes too went back to the owner; new,
  it goes where both are banned; why, this answer. Lane MERGE-ANSWER-4.
- Owner 2026-10-30, "Yes, both spellings" (board card q-lint-cmt-oxlint-disable-reason): a switch-off comment written
  oxlint's way needs a reason after `--`, as ESLint's does. `@eslint-community/eslint-comments/require-description`
  ships in `comments`, on only where suppressions are allowed, with `additionalDirectives` naming `oxlint-disable`,
  `oxlint-disable-line` and `oxlint-disable-next-line` (the option the plugin's schema and `parseDirectiveText` read,
  eslint-comments 4.8.1). `oxlint-enable` is not named: enable comments need no reason (the "Only switch-off comments"
  entry). The rule has no fix, so `withheld-fixes.json` is unchanged. Where suppressions are banned nothing changes:
  `house/no-suppressions` reports both spellings. Pinned in rule-data's `canonical-list.test.ts` and `accepted-cmt.ts`,
  and in `check-comment-reasons.integration.test.ts` and `editor-comment-reasons.integration.test.ts`. Correction to
  the "Yes, always a reason" entry: old, held on q-lint-cmt-oxlint-disable-reason; new, ships reading both spellings;
  why, this answer. Lane RULES-CMT-REASON-2.
- Correction to the "Yes, both spellings" entry (2026-10-31): old, `additionalDirectives` named only oxlint's three
  forms; new, it names `eslint-disable` too; why, oxlint obeys ESLint's whole-file `// eslint-disable <rule>` written
  as a line comment, which the rule reads only from a block comment unless `additionalDirectives` names
  `eslint-disable` (`parseDirectiveComment` in eslint-comments 4.8.1's `lib/internal/utils.js`), so that comment
  silenced a check with no reason asked. Pinned in `canonical-list.test.ts`, `accepted-cmt.ts`,
  `gate-equivalence.test.ts` and `check-comment-reasons.integration.test.ts`. Lane RULES-CMT-REASON-2, review 1.
- Owner 2026-10-30, "The bug decides" (board card q-lint-crit2-bug-checks-in-tidying-groups): a rule that catches a real
  bug sits in `correctness`, however tidy its rewrite looks; a team can still turn any one rule off in `rules`.
  `no-debugger`, `no-unused-expressions` and `no-new` move there from `redundancy`. Each other rule in a tidying group
  with `correctness` as its alternative (the command in `ruleset-critique-r2.md` §1) was run alone on code it reports
  (ESLint 10.12, eslint-plugin-regexp 3.3.1, eslint-plugin-unicorn 78.0.0, Node 23.10); three move and two stay:
  - `regexp/no-dupe-disjunctions` (from `redundancy`) moves: it reports the second `js` in `/\.(?:js|ts|js)$/`, written
    for `jsx`, which then does not match `App.jsx`.
  - `unicorn/no-break-in-nested-loop` (from `complexity`) moves: it reports a `break` in a `switch` inside a `for…of`,
    written to stop at `END`, which leaves only the `switch`, so `["a", "b", "END", "c"]` keeps `c`.
  - `unicorn/no-subtraction-comparison` (from `redundancy`) moves: `a.updatedAt - b.updatedAt > 0` on ISO date strings
    is `NaN > 0`, false where the comparison it suggests is true.
  - `regexp/optimal-lookaround-quantifier` stays in `redundancy`: `/^(?=[A-Z]+)\w+$/` and its rewrite agree on every
    input tried, so it removes no bug.
  - `unicorn/prefer-else-if` stays in `complexity`: it reports two exclusive tests, where `else` only tidies, and two
    `if`s meant to run one after the other, where the `else` it suggests skips the second.
  The rules already in `correctness` with a tidying alternative stay. This replaces round 1's question 10 (an order for
  choosing between groups) for these rules. Reproductions: `<r44>/resume-1029/evidence/CRIT2-ANSWERS/tester/repro-q1/`.
  Lane CRIT2-ANSWERS.
- Owner 2026-10-30, "Both ways" (board card q-lint-crit2-type-safety-scope): `type-safety` holds the rules about weaker
  type checking. `@typescript-eslint/no-unnecessary-type-parameters` (from `redundancy`) and
  `functional/prefer-property-signatures` (from `immutability`) move into it; the three bans on TypeScript-only syntax
  Node cannot run, enums (`no-restricted-syntax`), namespaces (`@typescript-eslint/no-namespace`) and parameter
  properties (`@typescript-eslint/parameter-properties`), move to `conventions`, so leaving `type-safety` out no longer
  allows them. Lane CRIT2-ANSWERS.
- Owner 2026-10-30, "Move all eleven" (board card q-lint-crit2-modern-js-scope): `modern-js` holds the rules whose
  rewrite needs a newer language or platform feature. To `redundancy`: `unicorn/prefer-has-check`,
  `prefer-array-flat-map`, `prefer-array-from-map`, `prefer-object-iterable-methods`, `prefer-math-abs` and
  `prefer-temporal-conversion`, `no-object-constructor`, and `no-array-constructor` (from `correctness`). To
  `conventions`: `unicorn/prefer-object-destructuring-defaults` and `prefer-map-from-entries`. Into `modern-js` from
  `complexity`: `unicorn/prefer-includes-over-repeated-comparisons`. Lane CRIT2-ANSWERS.
- Owner 2026-10-30, "conventions" (board card q-lint-crit2-no-children-prop): `react/no-children-prop` leaves `react`
  for `conventions`, under the 2026-10-10 ruling that `react` keeps what depends on React. A team that leaves
  `conventions` out loses it, on Hono's classic `jsx()` too, whose empty elements then go unreported. Lane
  CRIT2-ANSWERS.
- Owner 2026-10-30, "Move both to correctness" (board card q-lint-crit2-late-event-rules):
  `unicorn/no-late-event-control` and `unicorn/no-late-current-target-access` move from `browser` to `correctness`, as
  Node's `EventTarget` has the same bug. Lane CRIT2-ANSWERS.
- Owner 2026-10-30, "Stop shipping it" (board card q-lint-crit2-post-message-origin):
  `unicorn/require-post-message-target-origin` is dropped (`rule-candidates.json`), so naming it in
  `agents-inc.lint.mts` is refused, and a `window.postMessage` with no target origin goes unreported. Lane
  CRIT2-ANSWERS.
- Owner 2026-10-30, "Stop shipping it" (board card q-lint-crit2-adjacent-inline): `react/no-adjacent-inline-elements` is
  dropped (`rule-candidates.json`); run-together inline elements go unreported. Lane CRIT2-ANSWERS.
- Owner 2026-10-30, "Leave them where they are" (board card q-lint-crit2-library-rules): `sonarjs/memoize-cache-key`
  (`correctness`), `sonarjs/prefer-native-lodash-alternative` and `prefer-native-axios-alternative` (`modern-js`) and
  `sonarjs/no-default-utility-imports` (`modules`) keep their groups; no lodash or axios group. It answers round 1's
  question 12. No change. Lane CRIT2-ANSWERS.
- Owner 2026-10-30, "Only in declaration files" (board card q-lint-crit2-namespace-keyword):
  `@typescript-eslint/prefer-namespace-keyword` runs only in `.d.ts`, `.d.*.ts`, `.d.mts` and `.d.cts` files, where
  `no-namespace` is silent, so its fix no longer writes a `namespace` another rule reports. It runs in ESLint, since
  the oxlint build turns no rule on in files of its own, and it keeps `modern-js`. Where `no-namespace` is off, no lint
  rule reports `module Shapes` in other files, though TypeScript 6 rejects it. Pinned in rule-data's
  `namespace-keyword-in-declaration-files.integration.test.ts` and in `check-ruleset-moves.integration.test.ts`. Lane
  CRIT2-ANSWERS.
- Owner 2026-10-30, "Confirm all" (board card q-lint-crit2-single-placements): four rules move, `n/no-unpublished-bin`
  from `node` to `modules`, `@typescript-eslint/dot-notation` from `conventions` to `redundancy`,
  `promise/no-promise-in-callback` from `correctness` to `modern-js` and `unicorn/prefer-add-event-listener` from
  `browser` to `conventions`; seven stay: `@typescript-eslint/prefer-enum-initializers` (`correctness`),
  `unicorn/no-negated-array-predicate`, `consistent-function-scoping` and `no-declarations-before-early-exit`
  (`complexity`), `@typescript-eslint/no-dynamic-delete` and `unicorn/no-array-front-mutation` (`immutability`), and
  `@typescript-eslint/no-deprecated` (`modern-js`). Lane CRIT2-ANSWERS.
- Owner 2026-10-30, "No to both" (board card q-lint-crit2-suspicious-style): no `suspicious` group and no `style` list.
  It answers round 1's questions 13 and 14. No change. Lane CRIT2-ANSWERS.
- Owner 2026-10-10 ruling ("`react` keeps what depends on React"), built on the owner's "do them" of 2026-10-30:
  `@eslint-react/x-no-leaked-conditional-rendering` moves from `react` to `correctness`, as its purpose is wrong output
  and Hono renders the leaked `0` (`ruleset-critique-r2.md`, M1). Lane CRIT2-ANSWERS.
- Owner 2026-10-30, "Keep it unshipped" (board card q-lint-useless-spread-fix-when-on): `unicorn/no-useless-spread`
  stays `parked` in `rule-candidates.json`, so no team can turn it on through `agents-inc.lint.mts`, and naming it
  there is refused. No change but its `why`. Lane CRIT2-ANSWERS.
- All of the 2026-10-30 moves above carry `by: owner-2026-10-30` and the card as `note` in `data/rules.json`, with no
  `alternative`. Pinned in rule-data's `ruleset-moves.test.ts` and lint-rules' `ruleset-moves.test.ts`. Lane
  CRIT2-ANSWERS.
- Owner 2026-10-27, "Keep them in ESLint" (board card q-lint-slice2-autofix), asked whether a rule whose automatic
  fix only ESLint's version makes, on code oxlint's version reports alike, moves to oxlint anyway: it stays in ESLint,
  so `check` keeps fixing that code, with the lost fix as its `eslintBecause`, naming the card. Measured 2026-10-31
  (oxlint 1.87), that keeps `@typescript-eslint/no-inferrable-types`, `no-useless-return` and unicorn's
  `prefer-array-flat`, `prefer-array-index-of`, `prefer-array-some`, `prefer-date-now`, `prefer-dom-node-remove`,
  `prefer-export-from`, `prefer-modern-math-apis`, `prefer-native-coercion-functions`, `prefer-number-properties`,
  `prefer-object-from-entries` and `prefer-string-slice` in ESLint (`jq -r '.[] | select((.eslintBecause // "") |
  test("q-lint-slice2-autofix")) | .id' packages/rule-data/data/rules.json`). Pinned by the routing guard in
  `canonical-list.test.ts` (`FIXES_ONLY_ESLINT_MAKES`, `__tests__/cases/routed-to-eslint-for-a-reason.ts`).
  `unicorn/prefer-modern-dom-apis`, whose fix `check` and the editors withhold anyway, stays in ESLint until the owner
  answers q-lint-prefer-modern-dom-apis-engine (`RULES_WAITING_ON_AN_OWNER_ANSWER`).
  Lanes S2-CASES and S2-DATA.
