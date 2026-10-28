# Spec: answers 4 (the owner's 2026-10-28 lint-rules answers)

Sources: the answers bundle `<r44>/resume-1028/answers.md` (each card's text and the owner's choice, verbatim); six
source specs, `<r44>/resume-1028/specs/{ANS-CPT,ANS-HP,ANS-JD,ANS-SCOPE,ANS-OXLINT-NULL,LINT-RUN-SET}.md`, each checked
by a reviewer whose findings are applied here; evidence under `<r44>/resume-1028/evidence/<spec>/` (the reviews'
reproductions in `ANS-CPT-REVIEW/`, `ANS-HP-REVIEW/`, `ANS-JD/spec-review/`, `ANS-SCOPE-review/`,
`ANS-OXLINT-NULL/reviewer/`, `LINT-RUN-SET/review/`). `<r44>` is the programme's session folder; the queue file
`<r44>/resume-1028/queue.md` names it and orders the lanes. Assembled 2026-10-28 ~14:40 CET against HEAD `c48d0f5` plus
the eleventh run's uncommitted work (`git status --short`). **Where this file and a source spec differ, this file
wins.** The source specs carry the current-state tables, probes and commands: read your lane's, and re-derive before
acting. Each answer is recorded in [decisions.md](decisions.md) ("Owner 2026-10-28").

## For every lane

- Read [CLAUDE.md](../../CLAUDE.md) first and keep its order: red tests, code, green, the expressive-TypeScript pass
  (that skill only), real run, reviewer (never the fixer). Read-only git. Never edit the cli repo's `todo/`; never
  read, list or run anything in the cv-launch checkout, and filter it out of any corpus or file list. Docs are the
  docs lane's: list each sentence your change made false (file, section).
- **Nothing starts while the owner's hold of 2026-10-28 ~13:50 stands**; the queue file says when it lifts.
- `<lock>` = `flock <r44>/lint-build.lock timeout 1800 bash -c 'cd <lint-rules root> && <command>'`: every build,
  typecheck, test, generate, `bun install`, own lint, Stryker run and pack. `<S>` =
  `<r44>/resume-1028/evidence/<lane>/<role>/`; a scratch project gets a real `node_modules` from an install, never a
  link into the tree. Node 22.18+ for the repo; 22.23.2's npm for consumer runs (CLAUDE.md, Environment).
- **The rule-data queue.** `packages/rule-data/data/*.json`, `src/generated/**`, `bun.lock` and the shared pins
  (`src/__tests__/cases/{accepted-on-2026-10-24,dropped-rules,changed-settings,test-file-globs}.ts`,
  `src/canonical-list.test.ts`, `src/eslint-plugins.test.ts`) take one lane at a time: the eleventh run's EFF, R11,
  CORE, TSE, SNR, UG, UNI, HRA and its slice-2 S2-DATA, then this file's data lanes. A data lane takes **one turn,
  tester then developer back to back, and writes its red tests only inside that turn**, since every lane's full-suite
  gate sees them. Re-read each shared file just before editing it.
- **Generated files: measure the regenerate's own effect**, not a diff against HEAD (the tree holds other lanes' landed,
  uncommitted data). (a) `cp -r packages/rule-data/src/generated <S>/generated-before`, `<lock>` generate,
  `diff -r <S>/generated-before packages/rule-data/src/generated`: empty, else another lane is mid-turn, so stop.
  (b) Edit the data, generate, the same `diff -r` shows only your entries. (c) Generate again: nothing changes.
- **After any regenerate, `<lock>` `bun run build` before a `packages/lint-rules` test.** The built package inlines
  rule-data (`alwaysBundle` in `packages/lint-rules/tsdown.config.ts`) and nothing flags a stale build.
- **Hand breaks run in a scratch copy**, never the tree: copy `git -C <root> ls-files -co --exclude-standard` into
  `<S>/break/`, `bun install --frozen-lockfile --backend=copyfile`, break, regenerate, build, run the named tests,
  restore, green. Record both runs.
- **Gates** (`<lock>`, from the root, unfiltered, output visible, exit codes written): `bun run build`;
  `bun run typecheck` (knip first); `bun run test --continue=always`. If the only failure is eslint-plugin-house's
  "stays silent on a throwing default the last of thousands of cases falls into", rerun once and record both. A red in
  another lane's file is reported, not fixed. Zero tests collected, or blank output with exit 0, is not a pass.
- **Own lint on changed files:** `npx eslint <files>` and `npx oxlint --disable-nested-config <files>`. Until
  LINT-RUN-SET lands, also each file alone, since a whole run can hide `functional/prefer-immutable-types` findings: a
  lane-local check, not an answer to q-lint-own-gate-per-file. A finding present at HEAD in a line you did not touch,
  or one LINT-RUN-SET reveals in a file you did not write, is own-lint lane Z's: list it, do not fix it.
- **Mutation** where source lines change: `<lock>` `node scripts/mutate-changed-lines.mts`, and
  `stryker.static.config.mjs` for module-load code; each Survived or NoCoverage gets a test or a measured reason.
  Data-only lanes: the hand break stands in.
- **Real runs** (whenever `check` behaviour changes): packed install into a scratch git project, `init`, the files,
  `check` twice, md5 of every file before and after each; every case tracked in `<S>/real-runs.md`. **Read an absence
  from a `check` output only when its summary says "The list is complete"**; without it `check` cut its list
  (`cutAtTheCap`, `cli/check/report.ts`): run narrower, one project per rule, and read those.
- **Holding a rule** (a stop fires, or an answer goes back to the owner): its `accepted-on-2026-10-24.ts` entry and every
  held case of it carry `heldBy` the **new card the orchestrator posts** (`heldCasesOutOfPlace` refuses a mismatch), and
  its `rule-candidates.json` `why` names that card beside the accepting one (`acceptedRulesOutOfPlace`). No card posted
  yet: the rule stays on the card it has, unchanged, and the lane says so. Never a default, never a card's
  recommendation.
- **Report:** per rule or case, red-then-green evidence; **Corrections** (what in this file proved false, or
  "nothing"); owner questions in plain words; doc sentences made false; the exact change wanted in a file you do not own.

## Order

Beside the rule-data queue (disjoint files): LINT-RUN-SET, CPT-SILENCE, OXLINT-NULL. In the rule-data queue, after
the eleventh run's data lanes: SCOPE-HTML, HP-SHIP, JD, CPT-SHIP. Waiting on the owner: HP-SETTINGS, SCOPE-BARREL, and
the follow-ups of JD-PRESSED and HP's two left-off rules. Then the docs lane; own-lint Z last. Hard orders: CPT-SHIP
after CPT-SILENCE; JD's real run after SCOPE-HTML; HP-SETTINGS after HP-SHIP; Z after LINT-RUN-SET and SCOPE-BARREL.
The queue file carries the rest.

---

## CPT-SILENCE: `check` silences browserslist's old-data message

**Answer:** q-lint-compat-stale-data-warning, "Silence it inside check" ("No message; the browser data stays as old as
the project's packages."). Source: ANS-CPT §3, §5.

**What a user sees:** `check` never prints browserslist's three stderr lines "browsers data (caniuse-lite) is N months
old. Please run: npx update-browserslist-db@latest". This already prints today, before compat ships, for a project
whose `package.json` names browsers once its caniuse-lite is 6+ months old, through `unicorn/no-unnecessary-polyfills`
(modern-js). The same variable also hides baseline-browser-mapping's old-data warning, reachable only through a
project's own `baseline …` query. Not changed: `init`, editors, `npx eslint`, exit codes, every other line.

**Tests first** (web-tester), new `packages/lint-rules/src/browserslist-old-data.integration.test.ts`, shaped as
`node-warnings.integration.test.ts`, its preload as the `--import` preloads in `src/__tests__/cli-runs.ts`:
1. New `src/__tests__/clock-moved-forward.mjs` (plain JS: a `.ts` preload warns on Node 23) moves `Date.now()` and
   `new Date()` forward by the months a variable names. One `CliOptions` builder in `cli-runs.ts` sets `NODE_OPTIONS`
   (joined with the inherited value), that variable and `BROWSERSLIST_IGNORE_OLD_DATA: ''`.
2. Control, green before and after: under that clock and env, the browserslist copy `eslint-plugin-unicorn` resolves,
   called in a child Node, prints stderr starting `Browserslist: browsers data (caniuse-lite) is `.
3. **Red today:** a `package.json` naming browsers, `quality: ['modern-js']`, one file with no finding, clock +8
   months: the whole run `toStrictEqual`
   `{ exitCode: EXIT.clean, signal: null, stdout: 'check: no findings in 1 changed file.\n', stderr: '' }`.
4. Green before and after: the same project, clock unmoved, gives the identical run; `node-warnings.integration.test.ts`
   unchanged.

**Implementation** (web-developer): a named function in a new `src/cli/check/` file sets
`process.env['BROWSERSLIST_IGNORE_OLD_DATA']` to a non-empty constant, unconditionally, as the first statement of
`checkIn` (`run-check.ts`). Not in `main.ts`: `main.test.ts` mocks `checkIn`, and `init` would get it. The write's
`eslint-disable` carries its proof after `--`, as `main.ts`'s `process.on` lines do.

**Real run:** ANS-CPT §5 "Real run" (bin called directly, clock +0 and +8, variable unset: stderr empty both times,
stdout identical, no file rewritten; the control in the same shell prints the message).

**Files.** Owns the new test, the preload and the new `src/cli/check/` file. Shares `run-check.ts` (one call),
`src/__tests__/cli-runs.ts` (one builder; LINT-RUN-SET reads the file), `src/__tests__/factories/package-json-factories.ts`
(only if a `browserslist` field needs it; HP-SETTINGS names it too, so this lane goes first). No rule-data file.
**Stops:** ANS-CPT §5 "Stops".

## CPT-SHIP: `compat/compat` ships with Vite 8's fixed list

**Answers:** q-lint-compat-vite-target, "Vite's fixed list"; q-lint-compat-install-size, "Add it". Built on
q-lint-compat-default-target and rc-compat-compat. Source: ANS-CPT §4, §6, §7.

**What a user sees:** a project listing `browser-targets` (opt-in; `init` still names it only in a comment) gets a report
where its code calls, without testing for it first, a browser API that Chrome or Edge 111, Firefox 114 or Safari / iOS
Safari 16.4 lacks (`requestIdleCallback`, `toSorted()`). The list moves only when lint-rules moves to a new Vite major. A
project naming its own browsers is checked against its list and ours. Every install grows about 52 MB.

**The option:** `chrome >= 111, edge >= 111, firefox >= 114, safari >= 16.4, ios_saf >= 16.4`, a literal in `rules.json`
(the card's measured query); nothing reads Vite at runtime.

**Tests first** (web-tester, in the queue turn): ANS-CPT §6 items 1–6, with:
- `accepted-cpt.ts` holds **one literal table of pairs**, `['chrome111', 'chrome >= 111']` through
  `['ios16.4', 'ios_saf >= 16.4']`. `MAJOR_BROWSERS_AS_VITE_TARGETS` is the second column joined with `', '`; the guard
  "Vite still builds for the browsers the option names" (`resolveConfig` from `vite` in a temp root, inside the test)
  compares `build.target` with the first column. One edit then moves the guard and the entry test together. The guard
  reads rule-data's `vite`; it is pinned in three packages (`grep -n '"vite"' packages/*/package.json`), which move
  together. Prove the guard with a hand break (one version changed, red; restored, green).
- Every held case ships: the held lists, `COMPAT_VITE_TARGET` and the `HeldCase` import go. New case: `[...names].toSorted()`
  reported (Firefox 114), `[...names].sort()` silent. Write every outcome from a run in the repo's own resolution (a
  scratch copy with the data step applied), never by guess.
- Item 6, in CPT-SILENCE's test file: a `browser-targets` project calling `requestIdleCallback`, clock +8: exit
  `EXIT.findings`, its compat line (measure the exact text), stderr `''`, and equal to the unmoved run. Its control, a
  browserslist call through `eslint-plugin-compat`'s copy, is **red until the data step's `bun install`** (module not
  found).
- Expected red: the case tests (`unknown rule ID "compat/compat"`), the entry test, both registry tests, item 6 and its
  control. Items 2–4 stay green. Any other red: stop.

**Implementation** (web-developer): ANS-CPT §6 "Implementation" with the Vite 8 query (never run
`apply-predicted-data.sh` as it is: it writes `baseline widely available`). `eslint-plugin-compat` 7.0.2 in both packages'
`dependencies`; `compat` in `eslintPlugins` (`packages/rule-data/src/eslint-plugins.ts`) and
`src/generate/eslint-plugin-package-names.ts`; the `rules.json` entry (`ruleset: browser-targets`, `engine: eslint`,
`options: [<query>]`, `typed: false`, `assignment` note `rc-compat-compat`, by `owner-2026-10-24`); compat's
`rule-candidates.json` entry removed; `<lock>` `bun install`; generate.

**Real run:** ANS-CPT §6 "Real run". The install delta compares the after tarball with the same tarball without
`eslint-plugin-compat`, each in a fresh consumer, `du -sb node_modules`. The earlier figures to compare with come from
`du -sb <r44>/resume-1025/RULES-CPT/install-size/fresh-base/node_modules <r44>/resume-1025/RULES-CPT/install-size/fresh-compat/node_modules`,
not from `du-base.txt` / `du-compat.txt`, which another install rewrote.

**Files.** Owns `accepted-cpt.ts`, `accepted-cpt.integration.test.ts`, `rule-data/src/eslint-plugins.ts`,
`src/generate/eslint-plugin-package-names.ts`, the `eslint-plugin-compat` line in both `package.json`s, item 6. Shares
the rule-data queue files, `bun.lock`, `accepted-on-2026-10-24.ts` (compat's `heldBy` goes), `canonical-list.test.ts`
(`'browser-targets'` leaves `LIBRARY_RULESETS_CREATED_EMPTY`, a set HP-SHIP and JD also edit), `eslint-plugins.test.ts`.

**Stops** (hold the rule as "For every lane" says: restore the held lists, every `heldBy` on the new card; all three
compat cards are answered, so a hold needs one): Vite's resolved target is not the five names, or npm names a new Vite
major (a card on the target); a re-measured outcome differs from ANS-CPT §3, or the toSorted case is silent (same); the
install delta exceeds 53,000,000 bytes (a card on install size); any non-compat finding changes, a new npm warning, or a
red outside the lane's pins (report). **Must not:** ANS-CPT §7.

## HP-SHIP: four hydration-proof rules ship; two stay off

**Answers:** q-lint-hp-timezone-hold, "Ship it"; q-lint-hp-server-components-gap, "Ship now, add the setting later"
(the rules ship, a Next.js page only the server renders can get a false report, written up in the docs, and a queued lane
passes the setting: HP-SETTINGS); q-lint-rc-hydration-false-alarms-measured, "Leave them off" ("They stay listed as
candidates; react-ssr ships with four rules."). Earlier, built: q-lint-react-ssr-in-client-apps, "Make react-ssr opt-in".
Source: ANS-HP "Lane HP-SHIP".

**Ships**, in `react-ssr`: `hydration-proof/no-storage-in-initial-render`, `no-timezone-without-explicit-timezone`,
`no-window-render-branch`, `require-stable-server-snapshot`. None autofixes, so `check` rewrites nothing for them.

**The two left off** (`hydration-proof/no-browser-global-in-render`, `no-locale-without-explicit-locale`) **stay exactly
as the tree has them**: `recommended`, held, their held cases kept, so they do not ship. "Still listed as candidates"
fits none of the repo's states cleanly (`cases/candidate-states.ts`: `recommended` is queued to build, `parked` waits on a
named condition, `considering` and `needs-owner` are undecided; `dropped` is decided against and not a candidate status),
so how to record them goes to the owner. The source spec's `dropped` reading is not built and `DROPPED_RULES` does not
change. Once the orchestrator posts that card, the two move their `heldBy` to it ("For every lane", holding).

**Tests first** (web-tester, in the queue turn):
- `accepted-hp.ts`: the four rules' cases move, unchanged, into `ACCEPTED_HYDRATION_PROOF_CASES` in rule-ID order;
  `ACCEPTED_HP_HELD_CASES` keeps the two left-off rules' cases. The KNOWN GAP comment (`app/invoices/page.tsx`, its strict
  case still commented) stays, re-pointed: answered, and HP-SETTINGS's test takes the case over. Rewrite only the
  comments made false: `ACCEPTED_HYDRATION_PROOF_CASES`'s doc, the file header, the held list's doc, the header of
  `accepted-hp.integration.test.ts`. **Red:** the four `it.each` cases throw `<rule> is not shipped`; "ship, and no other
  hydration-proof rule does…" finds none.
- `accepted-on-2026-10-24.ts`: the four become `{ card, waitsAs: 'recommended' }`; the two unchanged.
  `HYDRATION_TIMEZONE_HOLD`, `HYDRATION_SERVER_COMPONENTS_GAP` and the "Waits on HYDRATION_SERVER_COMPONENTS_GAP as well"
  comment go.
- `canonical-list.test.ts`: `'react-ssr'` leaves `LIBRARY_RULESETS_CREATED_EMPTY` (an assertion change; green before,
  needed after).

**Implementation** (web-developer): `rules.json` gains the four, sorted by `id`: `ruleset: "react-ssr"`,
`engine: "eslint"`, `options: []`, `typed: false`, `assignment: { confidence: "high", note: "<rc card>", by: "owner-2026-10-24" }`
(the shape `<r44>/resume-1025/RULES-HP/scripts/apply-predicted-data.py` writes; do not run it). `rule-candidates.json`:
the four entries removed; the two unchanged, or their `why` names the new card if one is posted. Generate: expected
change `routing.json` only (`<r44>/resume-1025/RULES-HP/dev/generated-routing.json.diff`). Hand break (scratch): drop
`no-storage-in-initial-render`, its case fails; restore, green.

**Real run:** ANS-HP HP-SHIP §8, from `<r44>/resume-1025/RULES-HP` (`scripts/measure-check.sh`, `scripts/dump-cases.mts`,
`cases-dump/`, `dev/control-as-init-wrote-it.sh`). The earlier one-project run was cut (`measure-dev-real/check-1.txt`
prints "+1 more finding"), so use one project per rule as `per-rule-dev-real/` did unless the summary says "The list is
complete". Owed: each `reportedIn` line reported; no `hydration-proof/` line on a `silentIn` file; no line of the two
left-off rules; `app/invoices/page.tsx` reported by the time-zone rule (the known limit); the second run identical,
nothing rewritten; other shipped rules on `reportedIn` lines classed same or different problem; the control (config as
`init` wrote it) shows no `hydration-proof/` line.

**Files.** Owns `accepted-hp.ts`, `accepted-hp.integration.test.ts` (header). Shares `accepted-on-2026-10-24.ts` (the HP
rows and constants), `canonical-list.test.ts`, the data files. **Stops:** ANS-HP HP-SHIP §9; a stop holds the rule on a
new card.

## HP-SETTINGS: pass the plugin's Next.js setting (blocked on the owner)

**Answer:** q-lint-hp-server-components-gap, "Ship now, add the setting later": "a queued lane that lets the config pass
the Next.js setting". Source: ANS-HP "Lane HP-SETTINGS".

**Build nothing until the owner answers q-lint-hp-next-setting-where** (below); option 3 also needs the option's name and
whether `init` writes it. With `settings['hydration-proof'].serverComponents: 'next-app'` the plugin skips every file
without `'use client'` in any folder named `app`: right for Next.js App Router server pages, a real miss for a
directive-less component a `'use client'` file imports, for `src/components/app/…`, and for Remix routes (measured,
ANS-HP HP-SETTINGS §3).

**After the answer:** ANS-HP HP-SETTINGS §4–§8, with: **option 1 decides per file, by that file's own nearest
`package.json`** (as the option says), not by folder, plus a twin case where a monorepo root's `package.json` lists
`next` and a nested Remix app with its own `package.json` stays checked. A Next.js page silent and a Remix route reported
sit in one file. The commented KNOWN GAP case in `accepted-hp.ts` goes once the new test holds it.

**Files.** Owns the new integration test and its cases module, `core/eslint-settings.ts`; option 1
`core/project-facts.ts` and its test; option 3 `core/lint-rules-input.ts` and `src/define-lint-rules.test-d.ts`. Shares
`core/build-eslint-config.ts` (SCOPE-BARREL option 2 also edits it, so one after the other; it holds a
`functional/prefer-immutable-types` site that LINT-RUN-SET reveals, which is lane Z's), `package-json-factories.ts`
(after CPT-SILENCE) or `lint-rules-factories.ts` (the eleventh run edits it), `accepted-hp.ts` (after HP-SHIP); option 2
adds `ruleset-definitions.json`, the generator and `src/generated/**` (a rule-data queue turn). No answer lane shares
`core/merge-eslint-config.ts`. **Stops:** ANS-HP HP-SETTINGS §9.

## JD: six jest-dom rules report only; prefer-pressed measured first

**Answers:** q-lint-rc-jest-dom-fixes-measured, "Report only, no auto-fix"; q-lint-rc-pressed-fix-measured, "Ship with the
auto-fix" (its card: the false-alarm rate is measured before it ships either way). Earlier, built and unchanged:
q-lint-jest-dom-without-jest-dom, "Make jest-dom opt-in". Source: ANS-JD.

**JD-SIX.** `jest-dom/prefer-checked`, `prefer-empty`, `prefer-in-document`, `prefer-required`,
`prefer-to-have-attribute`, `prefer-to-have-class` ship in `jest-dom`, and `check` withholds their fixes through
`cli/check/withheld-fixes.json` (`eslintFixFilter`). A team listing `jest-dom` gets reports naming the jest-dom matcher;
`check` never rewrites the test. Editors still offer the fixes (an owner question that blocks nothing; nothing built).

**Tests first** (web-tester; every file in the queue turn):
1. New `packages/lint-rules/src/check-withheld-jest-dom-fixes.integration.test.ts`, its sources in new
   `src/__tests__/cases/jest-dom-sources.ts` (the seven breaking `reportedIn` sources of `accepted-jd.ts`, all but
   `share-button-without-jest-dom`): ANS-JD §4.1. **Red today: the findings assertion only** (no jest-dom rule ships);
   the byte-identical-texts assertion passes today and is first seen failing in the hand break. The control in the same
   file is a shipped, fixed ESLint rule of a listed control ruleset (`testing-library/no-global-regexp-flag-in-query`
   was measured to fire and be fixed, and the shipped testing-library rules report nothing on the seven); keep
   jest-dom-reportable shapes, such as `.toBeTruthy()` on a query, out of the control file.
2. `accepted-jd.ts`: the six cases move to `ACCEPTED_JEST_DOM_CASES` in rule-ID order; prefer-pressed stays held.
   Rewrite what becomes false: the header ("each case is held … no jest-dom rule ships yet", "None ships yet") and the
   docblock of `ACCEPTED_JD_HELD_CASES` (its "Six fixes change what a test asserts…" paragraph; its prefer-pressed
   sentence gains the jest-dom 6.9.1 break). `JEST_DOM_FIXES_MEASURED` goes once unused.
3. `accepted-on-2026-10-24.ts`: `heldBy` leaves the six rows. `canonical-list.test.ts`: `'jest-dom'` leaves
   `LIBRARY_RULESETS_CREATED_EMPTY`. Green before and after.

**Implementation** (web-developer): six `rules.json` entries (`ruleset: "jest-dom"`, `engine: "eslint"`, `options: []`,
`typed: false`, `assignment` note the rc card, by `owner-2026-10-24`), removed from `rule-candidates.json`; six
`withheld-fixes.json` keys, each reason naming the card and the measured break (ANS-JD §5.2); generate. Hand break
(scratch): ANS-JD §7.

**Real run:** ANS-JD §8, **after SCOPE-HTML has landed**: until then unicorn's getHTML fix rewrites a prefer-empty
`reportedIn` line of `quiet-status-markup.test.tsx` in any project listing `browser`, and the §9 rewrite stop fires
although the withholding works. Add to §8.2: every non-jest-dom finding on a `reportedIn` line of the six (from
`check-1.txt`) listed in `real-runs.md` and classed same or different problem (spec-accepted-rules "Per lane"; §9's first
stop reads that list).

**JD-PRESSED** (ANS-JD "JD-PRESSED"): re-derive the jest-dom 6.9.1 reproduction (`<r44>/resume-1028/evidence/ANS-JD/verdict-691/`;
the reviewer reproduced it at 13:20); measure false alarms on the cv-launch-free corpus `files2.txt` (never read
`jest-dom.jsonl` unfiltered); class other shipped rules on its lines. **Expected: it stays held** and the orchestrator
posts the owner question; its `heldBy` (accepted-on entry, held case) then names that card, and so does its `why`. "Ship
with the fix" only if the reproduction fails, no false alarm is found and no rule reports the same problem; the real run
then shows the italic case rewritten to `.not.toBePressed()` and the other to `toBePressed()`. If the new card is answered
before the turn, build that answer ("report only": a seventh withheld key; "not at all": it stays held).

**Files.** Owns the two new lint-rules files, `accepted-jd.ts`, `accepted-jd.integration.test.ts` (a title only if
false). Shares `accepted-on-2026-10-24.ts` and `canonical-list.test.ts` (the eleventh run edits both; also HP-SHIP,
CPT-SHIP and the queued heldBy-as-a-list lane), the data files, `withheld-fixes.json` (the queued LINT-HELD-RULES lane:
one at a time). Not touched: `ruleset-definitions.json`, `init`, `eslint-fix-filter.ts`, `oxlint-run.ts`,
`run-check.ts`, `check-fixes.integration.test.ts`. **Stops:** ANS-JD §9.

## SCOPE-HTML: `unicorn/prefer-dom-node-html-methods` leaves test files alone

**Answer:** q-lint-unicorn-gethtml-jsdom, "Not in test files" ("The rule keeps checking source files and leaves test
files alone."). Source: ANS-SCOPE "Lane ANS-SCOPE-HTML".

The rule (`browser`, listed by `init`) gains `ignores` = the three `TEST_FILE_GLOBS`, in the order
`unicorn/no-repeated-call-wrappers` lists them. No `files`, no options, no withheld key. **Written limits**, reported
and not built around: setup and helper files outside the globs, `.test.mts` / `.test.cjs` files, and a source file a
jsdom test imports are still rewritten to `.getHTML()`, and that test still fails.

**Tests first:** ANS-SCOPE HTML 4: the check-level test (the source rewritten and each test-file form untouched, in one
file); one `CHANGED_SETTING_CASES` case written out, not through `skippingTestFiles`; `RULES_SKIPPING_TEST_FILES` gains
the ID, and the canonical-list test's title and comment stay true (assertion unchanged). **Implementation:** HTML 5, its
generated check and hand break as "For every lane" says (build before the check-level test). **Real run:** HTML 8, with
its control on a tarball packed before the data change.

**Files.** Owns the two new lint-rules files. Shares `changed-settings.ts`, `test-file-globs.ts`, `canonical-list.test.ts`
(title and comment; the eleventh run, HP-SHIP, JD and CPT-SHIP edit other parts), `rules.json`, generated.
**Stops:** HTML 9, stop 3 read as "For every lane" (a).

## SCOPE-BARREL: `unicorn/no-barrel-files` and package entry files (blocked on the owner)

**Answer:** q-lint-own-r-barrel-entry, "Leave entry files alone" ("… It is measured first, and comes back to you if the
rule can't be told to skip them."). Source: ANS-SCOPE "Lane ANS-SCOPE-BARREL".

**Measured:** the rule takes no options (`schema: []`), and only the catalog's file scope can approximate "a package's
main entry"; no approximation matches exactly, so by the answer's own terms it goes back to the owner. **Build nothing
until answered.** The rule ships as today; nothing goes in `accepted-on-2026-10-24.ts` (it shipped long before).

**Ground truth for the card** (ANS-SCOPE BARREL 4, corrected): 10 flagged main entries: ours; cli's matrix, api-mocks
and compile; four corpus libraries' `src/index.ts`; semiotic's `src/components/semiotic.ts` (only its build script names
it); appflowy's nested `filters` package, whose `package.json` names `index.js` while only the flagged `index.ts` exists
beside it. Both options spare 8 and miss semiotic's and `filters`; neither spares a non-entry file. The measured
`package.json` reader matches exact paths, so it misses a source compiled in place beside the name `package.json` gives.
The cli repo has two flagged subpath entries, not one (`agents-inc/config` is built from `src/cli/config-exports.ts`, named
only by its build config).

**After the answer:** ANS-SCOPE BARREL 6 for the chosen option. Option 2's definition states whether a `main` or `exports`
path ending `.js` also names a `.ts` source at the same path, as the card words it.

**Lane Z:** its Done criterion "ESLint reports nothing over the whole repo" cannot pass until this is answered and built
(the repo lists `modules`; `packages/rule-data/src/index.ts` stays flagged). The disable or split options in lane Z's
hand-off are superseded by "ours stays as it is". If this lands before Z, Z's "No shipped rule changed" check shows its
data change.

## OXLINT-NULL: refuse a team oxlint config's null `options` / `categories`, naming the file

**Answer:** q-lint-oxlint-null-options, "Refuse it, naming the file". Source: ANS-OXLINT-NULL.

**What a user sees:** a team oxlint config with `options: null`, or `categories: null` extending no config object, stops
the editor, `npx eslint` and `npx oxlint` with one line naming the file and the key (ANS-OXLINT-NULL §2, P1–P4) instead
of a raw `TypeError` naming no file. **`check` and `init` do not change**, although the option's text said they stop:
neither reads a team's oxlint config (`grep -rn "readTheTeams\|mergeEslintConfig\|mergeOxlintConfig" packages/lint-rules/src/cli --include='*.ts'`
prints nothing; `check.integration.test.ts` pins it). Never make them read it to match the wording.

| The team's root oxlint config | Outcome |
| --- | --- |
| `options: null`, with or without `extends` | refused, `options` |
| `categories: null`, `extends` left out or `[]` | refused, `categories` |
| `categories: null` in a module whose `extends` holds only paths (oxlint refuses a path there, so it extends no config object; today a `TypeError`; reading it as unset is the option the owner rejected) | refused, `categories` |
| both null | refused, `options` (the order is pinned) |
| `categories: null` beside an `extends` holding a config object | as today (owner question) |
| a null `options` / `categories` inside an extended config; any other key null | as today (owner question) |
| `{}`, or the key left out | read (the allowed pair) |

**Tests first** (web-tester): ANS-OXLINT-NULL §4, with:
- The end-to-end tests link `CONSUMER_INSTALL` (`src/__tests__/temp-projects.ts`): with only our package linked, E3–E5
  fail on "Cannot find package 'oxlint'". E1 and E2 put an `eslint.config.mjs` naming `.oxlintrc.json` in `files` (the
  fixture's names `oxlint.config.mts`; never edit the fixture).
- M2 adds the module whose `extends` holds only paths (refused, `categories`). M3 adds `categories: null` with
  `extends: []` on the oxlint merge (refused). M4 adds scope pins on both merges: a JSON config extending `base.json`
  that holds `options: null` is read, and `mergeOxlintConfig` given `extends: [{ options: null }]` does not throw.
- In `core/oxlint-config-reading.test.ts`, delete tests (1) and (3) and `READ_ON_NULL`, and rewrite the comment above
  the describe "ruleIdsTheTeamsOxlintConfigSets, given a team JSON config holding null where oxlint takes an object",
  which becomes false.

**Implementation:** ANS-OXLINT-NULL §5, with: check the root config only, never at depth (unlike `refuseAPathInExtends`,
which walks `configsInOxlintOrder`); in `mergeOxlintConfig`, **after** `refuseAPathInExtends` (a path in `extends` keeps
its own message) and before the reading-mode hand-over.

**Gates:** "For every lane", plus: `dist/eslint.d.mts`, `dist/oxlint.d.mts` and the `editor-parts-*.d.mts` chunk keep
byte-identical content (its hashed name may change); `index.d.mts` embeds rule-data's generated ruleset names, which other
lanes change. `src/oxlint.ts` already has a `functional/prefer-immutable-types` finding at HEAD on `mergeOxlintConfig`'s
`theirs` parameter: lane Z's (q-lint-own-published-types), because fixing it changes the published signature.

**Files.** ANS-OXLINT-NULL §6. No source or test file shared with another answer lane; reads `src/__tests__/engine-clis.ts`
(LINT-RUN-SET adds an optional parameter). **Stops:** ANS-OXLINT-NULL §9.

## LINT-RUN-SET: one ESLint run over the whole repo reports every finding

**Answer:** q-lint-own-gate-per-file: no option chosen; the note, "why is this investigate first. running eslint should
surface all errors thats the point". Built as: one whole-repo ESLint run reports every finding; no per-file pass is added.
Source: LINT-RUN-SET.

**Cause** (LINT-RUN-SET §3): is-immutable-type 5.0.4 keeps a process-wide cache keyed by a type's recursion identity,
which every instantiation of one generic mapped type shares (`Pick`, `Omit`, `Partial`, `Required`). So
`functional/prefer-immutable-types` (eslint-plugin-functional 10.0.1, `declarative`) answers by what it checked first:
findings hidden, false ones added, even in one file linted alone. The plugin switches the cache off when `NODE_ENV` is
`"test"`. Upstream issue #625 is open and unfixed.

**What a user sees:** `check`, `npx eslint` and editors flag every overwritable `Pick` / `Omit` / `Partial` / `Required`
parameter and stop flagging read-only ones, whatever else the run checks. `init` lists `declarative` in
`agentRulesets.quality` only (`editorRulesets.quality` is `[]`), so editors are affected where a team lists it there, as
this repo does. Cost: the rule runs about 30 times slower; this repo's whole run goes from 67–69 s to about 108 s.

**Fix:** in `eslint-plugin-registry.ts`, a wrapper for `functional/prefer-immutable-types` only, whose type checker maps
each recursion identity to a token of that call's own (prototype A, `<r44>/resume-1028/evidence/LINT-RUN-SET/prototype/wrappers.mjs`:
evidence, not code). It keeps the plugin's `meta`. Entries keyed by a type's syntax node still go to the library's
process-wide map, so it is close to the `NODE_ENV=test` mode, not identical (gate 6's equality is the guard).
`derivedFrom` and `isProgram` move out of `re-export-cycles.ts` into one core module both import. No env variable,
patch, vendored copy or rule-data change. `functional/type-declaration-immutability` also calls is-immutable-type; it
does not ship (`not-reviewed`), and if it is ever accepted it needs the same wrapper.

**Tests first** (web-tester): LINT-RUN-SET §5, with:
- **Vitest sets `NODE_ENV=test`** (its CLI runs `process.env.NODE_ENV ??= "test"`), and the children `runCheck` and
  `runEslintCli` start inherit it, so as specified every behaviour test is green today and stays green without the
  wrapper, and Stryker cannot kill its mutants. Each behaviour test runs with `NODE_ENV` set to something other than
  `"test"` (the plugin compares `!== "test"`; measure `''` first): 5.1 through `runCheck`'s `CliOptions.env` (a named
  constant in the cases module); 5.2 through a new optional env parameter of `runEslintCli` in
  `src/__tests__/engine-clis.ts` (this tester's one additive change there); 5.3 with `vi.stubEnv` / `vi.unstubAllEnvs`
  around the in-process lint. Re-prove each red with that env.
- The sources add a `Required` pair beside the `Pick` ones (it collides too, and the wrapper fixes it).
- Unit: compare the wrapper's input and output per prefix, as the `withReExportCyclesCut` describe in
  `re-export-cycles.test.ts` does, and assert the registry wiring (its `functional` plugin's `prefer-immutable-types` is
  the wrapped module) separately. No in-process typed-lint helper exists: run the typed case through the ESLint CLI in a
  temp project (5.2's shape), or add a helper under `__tests__/` with its own test. The recursive "turtles" case asserts
  the reported value `Mutable` (a cache keyed by type gives `Unknown`), not only that it ends in time.

**Gates:** "For every lane", plus gate 6 (LINT-RUN-SET §8): `npx eslint .` and `NODE_ENV=test npx eslint .` on one
build give identical site lists; wall times written. **Real runs:** LINT-RUN-SET §9. **Stops:** LINT-RUN-SET §10, except
the speed stop: compare the rule's own `--stats` time, the median of at least two alternating runs each of the wrapped
run and the `NODE_ENV=test` run on one build (wall time on a loaded machine is noise at this margin).

**Files.** LINT-RUN-SET §7, plus the env parameter in `engine-clis.ts`. `cli-runs.ts` is read only (CPT-SILENCE adds a
builder). Sibling answer lanes: CPT, HP, JD, SCOPE, OXLINT-NULL; none edits a file this lane owns.

**Hand-off:** the sites it reveals go to lane Z (re-derive from gate 6; at HEAD four, one of them in
`core/build-eslint-config.ts`, which stays hidden even when that file is linted alone). After it lands, HP-SETTINGS's and
SCOPE-BARREL option 2's own lint on that file shows that site: lane Z's, not theirs. Land before lane Z.

---

## Docs sentences made false (the docs lane, after the lanes land and after the eleventh run's ACC-DOCS)

- `docs/plan.md`: the `init` example's `ui: ['react', 'nextjs', 'react-ssr']` and the libs row marking only `tailwind`
  opt-in (`react-ssr` and `jest-dom` are opt-in; HP); a limit sentence owed by q-lint-hp-server-components-gap: react-ssr's
  rules can report a Next.js App Router file without `'use client'` until HP-SETTINGS lands (HP); "Considered and
  dropped", "Target versions … driving rules": a correction row, since compat now ships a browserslist target (CPT); Open:
  a team that sets `functional/prefer-immutable-types` itself runs its own copy and keeps the order-dependent answers
  (LINT-RUN-SET; whether to write it is the docs lane's call); Open: the owner questions below once posted.
- `docs/architecture.md`: "The oxlint merge" step's list of throws and "Loading"'s list of refusals lack the null
  `options` / `categories` refusal (OXLINT-NULL); the `agents-inc/base` bullet's list of wrapped plugins lacks the
  immutability wrapper (LINT-RUN-SET); HP-SETTINGS's settings sentence once built.
- `docs/work/spec-accepted-rules.md` (each a correction row, old, new, why): "The compat answer" (`baseline widely
  available` called Vite's default target; the corpus file count; C1 option 1's rationale) and lane CPT and "What a
  consumer sees" (20.6 MB → about 52 MB, SHIP's re-measured figure) (CPT); the verdict table's HP row, lane HP's "6
  entries → react-ssr" and "What a consumer sees" react-ssr row: opt-in, four rules, two left off (HP); "What a consumer
  sees" jest-dom row: opt-in, six report-only, prefer-pressed waits; "Files no lane touches": `withheld-fixes.json` is now
  edited (JD); "Current state (measured 2026-10-24)" says `react-ssr` and `jest-dom` are not opt-in: dated, true when
  measured, so a correction row only if the docs lane judges it read as current.
- `docs/work/spec-own-lint.md` "Hardening verdict", first bullet ("The gate holds the class once briefs carry it"): it
  did not hold for `functional/prefer-immutable-types` until LINT-RUN-SET (a correction row).
- `packages/lint-rules/CHANGELOG.md` at release: compat in `browser-targets` and the install growth; `check` no longer
  prints browserslist's old-data message; four react-ssr rules; six jest-dom rules, report only; the getHTML rule leaves
  test files alone; the null-key refusal; the immutability fix and its cost.

## Owner questions (plain words; the orchestrator words the cards; ids proposed)

1. **q-lint-hp-next-setting-where** (HP-SETTINGS waits). Our config can now pass Next.js's setting that stops the
   server-rendering rules flagging pages only the server renders. How should it know a project is a Next.js app? The
   setting skips every file without `'use client'` in a folder named `app`. Even in a Next.js app it hides real problems
   in shared components that a `'use client'` file imports. Turned on everywhere it would also skip code that runs in the
   browser: Remix and React Router apps keep their pages in `app/` (measured). On the server-rendered projects we have,
   the rules flag nothing either way. (1) "Where the package lists Next.js": on for each file whose nearest
   `package.json` lists `next`; nothing for a team to do; a Pages Router app loses checks in any folder named `app`, and
   in `check` a team cannot turn it off. (2) "Where the config lists nextjs": on wherever the ui list includes `nextjs`;
   but `init` lists `nextjs` in every new config, so a Remix app that adds `react-ssr` goes unchecked in `app/` until it
   removes `nextjs`. (3) "A setting the team types": a new option in `agents-inc.lint.mts`, off unless set; you also name
   it and say whether `init` writes it.
2. **q-lint-hp-left-off-record** (nothing waits). You left two server-rendering rules off and said they stay candidates.
   Our list of unshipped rules has two kinds: waiting for something named, or decided against. Which are these: decided
   against for now (a later card can bring them back, as with the drizzle rules), or waiting for something you name?
   Either way they do not ship.
3. **q-lint-rc-pressed-fix-current-jest-dom** (prefer-pressed waits). You chose to ship jest-dom's prefer-pressed with its
   auto-fix. The card said the fix only breaks tests on jest-dom before 6.7.0, but it also breaks a passing test on
   today's 6.9.1: a test that only checks a button has an `aria-pressed` attribute is rewritten to "the button is
   pressed", which fails when it is not pressed. That is the kind of break you chose "report only" for on the other six.
   Ship it with the auto-fix anyway, report only, or not at all for now? Its false-alarm count is added once measured.
4. **q-lint-jd-editor-fixes** (nothing waits). `check` will never rewrite tests for the six report-only jest-dom rules.
   But a team that adds jest-dom to the rules its editors show still gets the editor's quick fix and fix-on-save, as it
   already does for the six fixes `check` withholds today (read from the code; the reviewer confirms it with one run).
   Leave editors as they are, or also stop editors offering these fixes (new work)?
5. **q-lint-barrel-entry-how** (SCOPE-BARREL and lane Z wait). The barrel rule cannot be told which file is a package's
   main entry, so which rough rule should it use? Measured on 10 real main entries (ours, 3 in the cli repo, 6 in the test
   corpus), both ways below spare 8 and miss 2: one only a build script names, and one whose `package.json` names
   `index.js` while only `index.ts` exists beside it. Neither spares any other file. Either way our own file stops being
   flagged; entry files of sub-paths (`pkg/handlers`) stay flagged, since you named the main entry. (1) "Skip every
   `src/index` file": one pattern in the rule's data; could also spare a `src/index` that is not an entry (none found)
   and misses entries named otherwise or outside `src/`. (2) "Read each package's package.json": new code run per file
   in `check` and the editor; spares any file `package.json` names, or whose built copy it names, wherever it is; misses
   entries only a build config names. (3) "Keep flagging": back to the card's other options (split ours, or silence ours
   with a disable).
6. **q-lint-gethtml-imported-sources** (for information; nothing waits). "Not in test files" for the getHTML rule still
   lets `check` rewrite `.innerHTML` to `.getHTML()` in a source file that a jsdom test imports, so that test still fails
   as before. It is built as you answered. Should the queued jsdom audit cover this too?
7. **q-lint-oxlint-null-beside-extends** (nothing waits). A team's oxlint config sets `categories` to null but also
   extends another config. oxlint refuses that file. Our ESLint merge carries on, reading the extended config's
   categories, and our oxlint merge passes the null on to oxlint, which then refuses it. Should our merges refuse it too,
   naming the file, or keep doing what they do today?
8. **q-lint-oxlint-null-other-keys** (nothing waits). oxlint refuses null for `env`, `globals`, `settings`, `rules`,
   `overrides`, `extends` and `ignorePatterns`, and for `options` or `categories` inside a config the team extends. Our
   merges either stop with the same error that names no file, or read the key as if it were not set. Should "refuse it,
   naming the file" cover all of these?
9. **q-lint-oxlint-null-plugins** (a defect for a new row; nothing waits). A team's oxlint config with `plugins: null`:
   oxlint 1.87 accepts it and lints, though its own type disallows it; both our merges stop with "TypeError: Cannot read
   properties of null (reading 'map')". Fixing it first needs a measurement of what oxlint does with a null plugin list
   (its default plugins, or none). OK to measure and fix it in a later lane?
10. **q-lint-own-immutability-patch** (nothing waits). Our fix makes the read-only-parameters check give right answers,
    but about 30 times slower: a full lint of this repo takes about 108 s instead of 67–69 s, and `check` pays about
    55 ms per changed file on average. The bug is in a library the check uses; its authors know of it and have not fixed
    it. We know of no faster fix that gives right answers; a patched copy of the library might be faster, but nobody has
    built or timed one, and you ruled that consumers never get patched packages. Keep our fix, offer a fix to the
    library's authors and keep ours until they release it, or allow a patched copy?

**For the owner's information, no answer needed:** browserslist's old-data message already prints today in projects
that name their browsers, and silencing it in `check` also hides baseline-browser-mapping's own old-data warning (CPT);
`check` and `init` never read a team's oxlint config, so the null-key refusal shows in the editor, `npx eslint` and
`npx oxlint` only (OXLINT-NULL); the immutability fix's cost (question 10).

## Where this file departs from the reviews, and why

All findings were applied. Where a finding offered a choice: JD's real run waits for SCOPE-HTML (a hard order) rather
than narrowing its stop, because both are queued anyway and the narrowed stop would need an exclusion list; OXLINT-NULL's
types gate compares the three type files that cannot carry rule-data's names, rather than a second build from HEAD
sources, which needs a second install; SCOPE's `filters` counts as a main entry both options miss, since its
`package.json` names it, by a path that does not exist; LINT-RUN-SET's speed stop reads the rule's `--stats` time.

## Corrections (the brief and the source specs)

- Brief: a held rule's card goes in `accepted-on-2026-10-24.ts`. SCOPE's two rules are not in that file (both shipped
  long before); holding them means leaving their entries as they are.
- ANS-HP recorded the two left-off rules as `dropped`, its own reading; withdrawn (above). It also named
  `merge-eslint-config.ts` as possibly OXLINT-NULL's (it is not) and left out `dropped-rules.ts`'s other editors, R11 and
  UNI (moot now). Its real run read absences from a cut `check` list.
- ANS-JD's header said the eleventh run's edits were "none of them this lane's"; EFF had edited both shared pins at 12:56.
- ANS-CPT: the install figures it cited came from files another install rewrote; vite is pinned in three packages, not two.
- LINT-RUN-SET: `init` does not list `declarative` for editors; its tests could not fail under vitest.
- ANS-OXLINT-NULL cited a Corrections section it lacks; the item is the `check` / `init` note above.
- ANS-SCOPE: 10 flagged main entries, not 9; the cli repo has 2 flagged subpath entries, not 1.
- The queued heldBy-as-a-list lane's motivating case, the time-zone rule waiting on two cards, is gone once HP-SHIP lands:
  both cards are answered.

## Every answer, and where it is

q-lint-compat-vite-target, q-lint-compat-install-size → CPT-SHIP · q-lint-compat-stale-data-warning → CPT-SILENCE ·
q-lint-hp-timezone-hold, q-lint-rc-hydration-false-alarms-measured → HP-SHIP · q-lint-hp-server-components-gap → HP-SHIP,
HP-SETTINGS · q-lint-rc-jest-dom-fixes-measured, q-lint-rc-pressed-fix-measured → JD · q-lint-unicorn-gethtml-jsdom →
SCOPE-HTML · q-lint-own-r-barrel-entry → SCOPE-BARREL (back to the owner, as the answer said) · q-lint-oxlint-null-options →
OXLINT-NULL · q-lint-own-gate-per-file (note only) → LINT-RUN-SET · built earlier, recorded in decisions.md only:
q-lint-react-ssr-in-client-apps, q-lint-jest-dom-without-jest-dom, q-lint-compat-default-target.
