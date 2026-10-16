# Spec: lane answers2 (#56, q61, q62, the published-package finding after `init`)

Four owner answers or bugs, none built. Every "before" below was measured on this lane's copy
(ESLint 10.12, oxlint 1.87, the built package); the scripts and scenarios are in
`<session>/scratch-backup/finish-answers/answers2-spec/measure/` (`run-project.mjs` runs one
scenario through the editor ESLint merge, the editor oxlint merge and `check`; `raw-ignores.mjs`
runs ignores lists through the bare engines; `init-check.sh` runs `init` then `check`).

## For every agent in this lane

- Work only in the lane copy, `<session>/scratch-backup/lanes/answers2/repo`. Its untouched twin,
  `../base`, is what to diff against (the copy has no `.git`).
- Node: a shell that skips the profile gets Node 18 and the build fails. Put
  `~/.local/share/fnm/node-versions/v22.23.2/installation/bin` first on `PATH`.
- Gate, from the lane repo: `bun run build --force`, `bun run typecheck --force`,
  `bunx turbo test --force --continue --concurrency=1 -- --maxWorkers=2`. The integration tests run
  the engines on the built `dist`, so build before every test run that should see a change.
- `packages/rule-data/src/generated/` is generated: after a `rules.json` edit run `bun run generate`
  in `packages/rule-data` and diff the output against `../base` (only the edited rule may change).
- One owner per file. `merge-eslint-config.test.ts` is touched by items 2 and 3 (different
  describes), and `docs/plan.md` and `docs/work/questions.md` by all four: give each to one agent,
  or run those steps one after the other.

Out of scope: #54 (eslint-plugin-jsx-a11y-x) and the plugin upgrades, which other lanes build in
the real repo; StrykerJS, which runs after this workflow; negated `ignores` values; entry `files`;
any tool config file but our three; `oxlint --rules` as the source of the name check.

## 1. #56: an oxlint outside our range is checked by its rule list, not refused

**Before.** A project whose installed oxlint (the one `oxlint/package.json` resolves to from
`tsconfigRootDir`) is outside `^1.86.0` (2.0.0, 1.85.9, 1.87.0-beta.1) cannot load either editor
config. oxlint: `Failed to parse oxlint configuration file … the oxlint installed for <dir> is 2.0.0,
outside the range @agents-inc/lint-rules supports (^1.86.0)`. ESLint: `eslint.config.mjs: could not
read your oxlint config at …: …outside the range…`. `check` has no version check and is unaffected.

**After.** No version check at all, in either direction. The merge reads that oxlint's
`configuration_schema.json`, as it does today for versions in the range, and refuses only when it
cannot read the schema or the schema lacks a rule or plugin name the merge may write. The
messages stay as they are, "install another oxlint within ^1.86.0" included: the range is still
the tested one. The peer range in `package.json` stays `^1.86.0` (my-d7).

**Where.** `refuseUnsupportedInstalledOxlint` in `core/installed-oxlint.ts`: the range test and
everything only it uses go (`isInCaretRange`, `outsideTheRange`, the version patterns and
`Release`). Its JSDoc says the oxlint "must be in this package's oxlint peer range": rewrite it. The
name is the developer's call; "unsupported" now means "lacks our names".

**Tests owed.**
- Unit, `merge-oxlint-config.installed-oxlint.test.ts`: an oxlint outside the range whose schema
  holds every name is accepted (the four versions the file already names); one outside the range
  whose schema lacks a name is refused with `lackingNamesError`, naming the name and the version
  (the refusal beside the allowed case); one outside the range with no schema is refused with
  `unreadableSchemaError`.
- Real engines, new: a project as the `consumer-files` fixture whose installed oxlint reports
  `2.0.0`: oxlint `-c oxlint.config.mts` lints and reports `src/debugger.ts:2 eslint(no-debugger)`,
  and ESLint loads `eslint.config.mjs` with no fatal message. Beside it, the same install with a
  schema lacking `no-debugger`: oxlint refuses to load the config (`oxlintCliOutcomeOf` gives
  `refused`) and its output holds our message naming `no-debugger` and `2.0.0`. Gotcha: the
  existing fake install (`buildInstalledOxlintFiles`) has an entry that exports nothing, so the
  fixture's `import { defineConfig } from 'oxlint'` breaks. The shape measured to work is the real
  oxlint package with every entry linked and only `package.json` rewritten with the new version.

**Existing tests the answer makes wrong** (`merge-oxlint-config.installed-oxlint.test.ts`):
"refuses one $where, $version, naming the installed version and the range" (4 cases) and "refuses
one outside the range by its version alone, reading no schema". The file's two header comments
(the range "must" hold; the floor and the versions refused) become false too.

**Docs owed.** `docs/architecture.md` step 7: delete the clause "when the oxlint that resolves
from `tsconfigRootDir` is outside our oxlint peer range, or". `docs/plan.md` Open, "Answered by the
owner, not yet built": drop the #56 half, keep #54 (another lane builds it). `questions.md` #56:
built.

**Calls (cards).**
- The brief says `oxlint --rules`; the check reads the schema instead. Keep the schema: it is
  oxlint's own rule list (on 1.87 its rule map holds every rule `oxlint --rules -f json` prints,
  measured), it needs no process per config load, and it is already read once per process.
- An older oxlint that has every name but refuses an option or key we write fails with oxlint's
  own load error (the #64 family). Written limit, no code.

## 2. q61: on JS files the plain rule follows the reach of your setting

**Before** (the editor ESLint part, in a project without oxlint; measured with `redundancy` and
`rules: { '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }] }`): TS files report
the TypeScript version everywhere, `scripts/a.ts` and `tool.config.ts` included, but
`scripts/a.js` and `tool.config.js` report nothing. `no-unused-vars` ships with ignores
(`**/scripts/**`, `**/*.config.{ts,js,mjs,cjs}`, stories), and the plain rule kept them. The agent
build (`check`) and the editor beside oxlint already report both JS files once, through ESLint's
`@typescript-eslint/no-unused-vars`. An entry naming the TypeScript version (`files: ['scripts/**',
'src/**']`) behaves the same way.

**After.** Without oxlint, where a layer (the top level or an entry) names typescript-eslint's
version of a rule and not the plain rule, the plain rule runs on that layer's JS files with that
setting wherever the layer reaches: the top level, every file our `ignores` leave in; an entry,
its files. The ruleset's file limit no longer applies. `scripts/a.js` and `tool.config.js` report
`no-unused-vars` once. Each file still reports once, by one name.

Unchanged: the agent build and the editor beside oxlint; a layer naming the plain rule (it keeps
the ruleset's limit, as today, on TS and JS alike); a layer naming both names (each keeps its own
setting); a ruleset alone. Where the plain rule refuses the options given to the TypeScript version,
the JS files outside the ruleset's limit still get neither (a written limit, below).

**Where.** `coreSettingTakenFrom` in `core/build-eslint-config.ts` gives the plain rule the
extension's setting within the plain rule's shipped scope (`shippedScopeOf(core)`). Only one pair
we ship has a shipped scope today: `no-unused-vars` (`rules.json`).

**Tests owed.**
- Unit, `merge-eslint-config.test.ts`, the D9 describe: `scripts/a.js` gets `no-unused-vars` at the
  setting as ESLint calculates it, the TypeScript version off; the same through an entry naming the
  TypeScript version. Refusal beside: a layer naming the plain rule leaves `scripts/a.js` with
  neither name.
- The written limit pinned (an `it`, since it is the decided behaviour): options the plain rule
  refuses leave `scripts/a.js` with neither name.
- Real engines, new (pattern: the second describe of `unpublished-imports.integration.test.ts`,
  the ESLint CLI on the built package): a project without oxlint holding `src/a.ts`, `src/a.js`,
  `scripts/a.ts`, `scripts/a.js` and `tool.config.js`, each with one unused variable. With the
  TypeScript version in `rules`, findings by file are the TypeScript version on each TS file and
  `no-unused-vars` on each JS file. Beside it, with the plain rule in `rules`: nothing in
  `scripts/` or `tool.config.js`.
- Real engines, the other builds unchanged: the same files through `setUpBothEnginesRuns` (agent
  build, merged into empty team configs): each file once, `scripts/a.js` by
  `@typescript-eslint/no-unused-vars`.

**Existing tests the answer makes wrong.** `merge-eslint-config.test.ts`, "runs the extension our
rules set in every TS file, and the core rule with that setting only in the JS files it ships for":
its `inAJsFileItShipsIgnoring` member (`scripts/a.js`: neither name) and its name.

**Docs owed.** `docs/plan.md` Open "#60, #61": drop the #61 half. `plan.md`'s `fileOverrides` row,
"An entry's `rules` keep each rule's shipped `files` and `ignores`, so softening a rule never widens
where it runs", is false for a TypeScript version named in place of its plain rule (on TS files it
already was): say so in one clause. `questions.md` #61: built. `architecture.md`: change a sentence
only if one is false (the without-oxlint bullet of step 6 is the place to look).

**Calls (cards).**
- Beside oxlint nothing changes: those JS files are already checked once, by ESLint's TypeScript
  version, and moving them to oxlint's plain rule would also move `scripts/*.ts`, which the answer
  did not ask for.
- Entries follow the same rule as the top level: one code path, and it matches the agent build.
- Where the plain rule refuses the options, JS files outside the ruleset's limit get neither name.
  Running the TypeScript version there instead (q60's note allows reusing it on JS) is the
  alternative.

## 3. q62: one meaning for `ignores` in both engines, like .gitignore

**Before** (measured; team oxlint config with `correctness` off):

| `ignores` | today |
| --- | --- |
| `legacy/` | ESLint leaves out the root `legacy/` only; oxlint every `legacy/`. Our ESLint rules still report in `src/legacy/` (editor and `check`). |
| `./src/a.js`, `./a.js` | ESLint leaves the file out; oxlint matches nothing. The editor oxlint merge still reports there; `check` does not, because it lints only the files ESLint's `isPathIgnored` leaves in. |
| `/src/a.js` | ESLint matches nothing; oxlint leaves the file out. Our ESLint rules report there (editor and `check`). |
| `/a.js` | The editor oxlint merge writes `excludeFiles: ["a.js", "a.js/**"]`, which oxlint's override globs read at any depth: our oxlint rules run in no file named `a.js` anywhere. |

**After.** Each top-level `ignores` value, negated or not, means what it would mean as a
.gitignore line, the same in ESLint and oxlint and in every build: the agent build's global
ignores and `ignorePatterns`, `check`'s file list, and both editor merges.
- No slash: at any depth (today's reading).
- Only a trailing slash (`legacy/`): every folder of that name, at any depth.
- A leading `./` or `/`: anchored where `src/a.js` is anchored today (the project root), a file or
  folder name with no other slash included (`./a.js` is the root `a.js` alone).
- Any other slash (`src/legacy/`, `src/a.js`, `legacy/**`) and `**/…`: as today. Both engines
  already agree on these.
- A negated value follows the same rules after its `!`.
- Only top-level `ignores`. Entry `files` and shipped scopes keep today's reading.

Not changed, a written limit: a negated value taking back files under a folder another value
leaves out (`lib/**` with `!lib/a.js`, `**/legacy/` with `!legacy/keep/`). ESLint keeps those files
out and oxlint takes them back; the answer's two forms do not cover it.

**Measured facts for the developer** (bare engines, `raw-ignores.mjs`):
- Read alike: `**/legacy/`, `**/legacy`, `legacy/**`, `**/legacy/**`, `src/a.js`, `src/legacy/`.
- Each engine reads the other's root form as matching nothing: ESLint `/x`, oxlint `./x`. So the
  pair `./x` and `/x` leaves out the root `x` alone in both, for files, folders and negated values.
- In an oxlint override's `files` and `excludeFiles`, `./a.js` is the root `a.js` alone and `a.js`
  matches at any depth. The oxlint merge writes our ignores through `overrideFilesOf`
  (`core/oxlint-override-files.ts`), so a root path with no other slash must be written with `./`
  there. Without that fix, `./a.js` would turn our oxlint rules off in every `a.js`, as `/a.js`
  does today.
- `layers.ignores` (`normalizeGlob` in `resolveRuleLayers`) feeds every build and both readings in
  `core/ignores-read-by-each-engine.ts`. Those readings already model `./x`, `/x` and `**/x/` as
  each engine reads them. `normalizeGlob` also normalises entry `files`, shipped scopes and
  `CONSUMER_CONFIG_FILES`, which must not change.

**Tests owed.**
- Unit: value to normalised form(s) for each rule above. The refusal beside each allowed case:
  `src/legacy/`, `legacy/**` and `**/legacy/` unchanged, and an entry's `files: ['legacy/']`
  unchanged.
- Real engines, new: for each of `legacy`, `legacy/`, `./legacy/`, `/legacy/`, `./legacy`,
  `./a.js`, `/a.js`, `./src/a.js`, `/src/a.js`, `src/legacy/`, `**/legacy/`, and
  `['**/a.js', '!./a.js']`, over `a.js`, `src/a.js`, `legacy/a.js`, `src/legacy/a.js` and
  `legacy/keep/a.js`: the files our oxlint rule reports in (`no-debugger`) equal those our ESLint
  rule reports in (`no-throw-literal`). Both equal a literal list written for each row, in the
  agent build and merged into empty team configs, with the team's oxlint `correctness` off (oxlint's
  default copies would otherwise report too). The scenario in `measure/ign-*.json` is the shape.
- The written limit pinned with the strict assertion it fails (`it.fails`, the engines run in
  `beforeAll`): `['lib/**', '!lib/a.js']` leaves out different files in the two engines.

**Existing tests the answer makes wrong.**
- `merge-eslint-config.test.ts`, "our ignores, written as each form a folder or file is named in,
  beside an empty team config": the `legacy/` row's `leftOut` gains `src/legacy/index.js`.
- `editor-merges.twin-pairs.integration.test.ts`, the `TWIN_CASES` case "…our ignores name
  legacy/, which each engine reads its own way": `src/legacy/a.ts` now owes nothing, and its `how`
  and comment are false.
- `core/ignores-read-by-each-engine.integration.test.ts`: the ESLint side gives the real ESLint the
  raw list, which equalled the layers' list only while normalising left these forms alone. It must
  get the list the agent build gives ESLint, `eslintGlobalIgnoresOf` of the layers, as the oxlint
  side already does. That changes how the test is wired, not what it tests. Its check that ESLint
  leaves out only the root `legacy/` under `['legacy/']` now owes every `legacy` folder. The limit
  lists in `__tests__/cases/eslint-ignores-values.ts` and `oxlint-ignores-values.ts` must be
  re-measured: each changed member is reported with its measurement. Their header, "as our layers
  hold them", becomes "as a consumer writes them".
- `editor-merges.ignores-readings.integration.test.ts`, its `OXLINT_READING_LIMITS` (lists such as
  `['legacy/', '!keep/']`): `legacy/` and `keep/` now mean every such folder, so each
  `takenBackByTheReadingOnly` is re-measured the same way.
- `merge-oxlint-config.integration.test.ts`, "…beside our ignores the engines read differently",
  the row "a folder ending in a slash, legacy/, which ESLint leaves out at the root alone": the
  assertion holds, but the title and the describe's comment are false.
- Any other red test: report it, with why, before changing it.

**Docs owed.** `docs/plan.md` Open, the #62 bullet: replace it with the negated-value limit in one
sentence. `plan.md`'s `ignores` row: one sentence giving the .gitignore reading. `questions.md` #62:
built. `src/index.ts`: a one-line JSDoc on `ignores`, the only place a consumer reads it. The
header comment of `core/ignores-read-by-each-engine.ts` ("each engine reading the same values its
own way") now holds only for negated values.

**Calls (cards).**
- A leading `/` anchors at the root too, as in .gitignore. The card named only `./`, but today `/`
  is read two ways (ESLint: nothing; oxlint: root), which is the defect the answer removes.
- The negated-value difference stays, as a written limit (above).
- Entry `files` are not touched. Measured: `./src/**` and `./legacy/**` apply in every build. An
  entry with `files: ['legacy/']` matches nothing in either engine: consistent, so no #62 defect,
  though a team may not expect it.

## 4. `check` right after `init` reports our config file in a package npm may publish

**Before** (measured, `init-check.sh`). In a package without `"private": true` and without a
`"files"` field, `check` right after `init` reports `agents-inc.lint.mts:1 n/no-unpublished-import
— "@agents-inc/lint-rules" is not published.` The team's `eslint.config.mjs` (our package) and
`oxlint.config.mts` (our package and `oxlint`) are reported the same way. A private package, or one
with `"files": ["dist"]`, reports nothing.

**After.** `n/no-unpublished-import` ships with the three consumer config files at any depth in
its `ignores` (`**/agents-inc.lint.mts`, `**/oxlint.config.mts`, `**/eslint.config.mjs`), as
`perfectionist/sort-objects` does, in every build. Any other file importing a devDependency in such
a package is still reported (measured today: `src/uses-dev.ts:… n/no-unpublished-import`).

**Where.** `packages/rule-data/data/rules.json` (the `n/no-unpublished-import` entry), then
`bun run generate`. The names come from `consumerConfigFiles`
(`packages/rule-data/src/consumer-config-files.ts`).

**Tests owed.**
- `packages/rule-data/src/consumer-config-files.test.ts`: a new test pinning
  `n/no-unpublished-import`'s shipped ignores as the three files at any depth (leave the existing
  two-rule test as it is).
- Real engines, through the rule as it ships: the q71 case in
  `packages/rule-data/src/__tests__/cases/changed-settings.ts` is the pattern (`silentIn` and
  `reportedIn`). Silent in the three config files at the root and in `apps/web/`; reported in
  `src/app.ts` importing the same devDependency (the refusal beside the allowed case). The rule
  needs a published manifest listing the import under `devDependencies`. Check whether the shared
  `PROJECT_MANIFEST` can take one without changing another case's result.
- What a user sees, `init.integration.test.ts`, "check right after init, the config untracked":
  the variant "published, tsconfig not including it, no opt-in comment, @types/node" now passes.
  The two published variants a tsconfig takes in still fail, on the other gap
  (`agents-inc.lint.mts:4 @typescript-eslint/no-unsafe-assignment`, measured). They keep their
  `it.fails`, and the comment names only that gap. For all three, a new passing test: no
  `n/no-unpublished-import` among the findings. And in a published package where the team writes
  `eslint.config.mjs` and `oxlint.config.mts` as plan.md shows, plus `src/uses-dev.ts` importing a
  devDependency, `check` reports `n/no-unpublished-import` in `src/uses-dev.ts` alone.

**Existing tests the answer makes wrong.** `init.integration.test.ts`, "reports nothing in
agents-inc.lint.mts: $kind" over `PUBLISHED_VARIANTS` (`it.fails.each`): one variant now passes, so
`it.fails` fails for it. Split the variants as the private ones already are.

**Docs owed.** `docs/plan.md` Open: delete the bullet "In a package npm may publish (no `"files"`
field), `check` right after `init` reports…". `docs/architecture.md` step 8, "The two shipped rules
they break, `perfectionist/sort-objects` and `unicorn/no-top-level-side-effects`, carry them in
`ignores`", is now false: name `n/no-unpublished-import` too.

**Call (card).** Only our three files. Exempting every tool's config file (`*.config.*`), as q71
did for `no-top-level-side-effects`, was not asked for. Common tools are in the rule's
`allowModules` already.

## Success criteria

| Criterion | How to verify |
| --- | --- |
| An oxlint reporting 2.0.0 with a full schema: both editor configs load and lint | the new real-engine test (item 1) |
| The same oxlint lacking `no-debugger`: refused, naming it and 2.0.0 | the same test's refusal case |
| Without oxlint, `scripts/a.js` and `tool.config.js` report `no-unused-vars` once, under `@typescript-eslint/no-unused-vars` in `rules` | the new ESLint CLI test (item 2) |
| With the plain rule named, `scripts/` still reports nothing; agent build and beside-oxlint unchanged | the same file's refusal and the `setUpBothEnginesRuns` describe |
| Every value form in the item 3 table: the files are equal across engines and builds, and equal the literal list | the new real-engine test (item 3) |
| `./a.js` and `/a.js` leave out the root `a.js` alone in the editor oxlint merge | the same test, the `a.js` rows |
| `check` after `init` in a published package: no `n/no-unpublished-import` in the three config files; still in `src/uses-dev.ts` | `init.integration.test.ts` (item 4) |
| Each new decision point broken by hand makes a test fail | CLAUDE.md "Break each new decision point" (StrykerJS is not run in this lane) |
| Build, typecheck and tests green; every `it.fails` here fails only on its assertion | the gate |
| Generated files changed only for `n/no-unpublished-import` | `diff -r ../base/packages/rule-data/src/generated packages/rule-data/src/generated` |
| No git writes; nothing outside the lane copy | the report |

## Baseline

The untouched lane copy, before any change, through the gate's three commands: build succeeded,
typecheck exited 0, and every test file passed in all three packages, with no failure; lint-rules'
`it.fails` count is the baseline the lane's report compares against (log:
`<session>/scratch-backup/finish-answers/answers2-spec/baseline-test.log`).
