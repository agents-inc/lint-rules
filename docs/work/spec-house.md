# Spec: lane "house", shipping `house/require-class-helper`

Planner, 2026-10-14. Sources: the answers digest (`scratch-backup/answers-digest-2026-10-14.md`; cards q-r2b-cva-variants, q-r2-class-helper-ruleset, lib-structure), [decisions](decisions.md) (#23 on 2026-10-11, the 2026-10-14 entries) and [spec-next-batch](spec-next-batch.md) (D3, Q-R2, Q-R2b). Where they differ, the 2026-10-14 answer wins.

**This lane owns** `packages/eslint-plugin-house/` and this file. Expected changes: `src/rules/require-class-helper.ts`, `src/rules/require-class-helper.test.ts`, `src/__tests__/cases/require-class-helper.ts`. `plugin.test.ts` is unchanged (still seventeen rules).

**Must not:** add a rule option or change the schema; add a fix or suggestion; touch another house rule; edit `packages/rule-data` or `packages/lint-rules` (see [Owed by other lanes](#owed-by-other-lanes-reported-not-made-here)). No ticket or card IDs in test names.

## What changes for a user

- `className={classNames(…)}` and `className={classnames(…)}` are no longer reported.
- A call to a function whose name ends in `Variants`, as cva-made functions are named (`buttonVariants({ variant })`), is no longer reported, whatever the `helpers` option says.
- The message's helper list becomes `cn, clsx, cx, cva, twMerge, classNames, classnames`.
- Unchanged: two-class ternaries, templates that interpolate, `+`, `&&`/`||`/`??`, `.join` and calls to other functions (`getButtonClassName()`) stay reported. `cx` and `cva` stay helpers.
- Which ruleset turns it on is the data lane's change: `libs.styling`, `class-names` (lib-structure).

## Item 1: `classNames` and `classnames` become default helpers

- **From:** #23 (decisions.md, 2026-10-11: "ship house/require-class-helper with classNames/classnames added").
- **Behaviour:** both names join the rule's `DEFAULT_CLASS_HELPERS` after `twMerge`, exact case, matched through `calleeNameOf` like every helper (so `x.classNames(…)` and `classNames?.(…)` pass too). As today, a `helpers` option replaces the whole default list.
- **Tests:** add both names to the cases file's own `DEFAULT_CLASS_HELPERS` copy. The existing `.map` then yields "stays silent on a call to classNames, a default helper" and the same for `classnames`; both fail before the rule changes. The copy stays separate from the rule's list: imported, a dropped name would drop its own test.
- **Existing tests this answer makes wrong.** `OTHER_HELPER` and the case `callToAnotherHelper` use `classNames`, which is now a default. Rename the helper in both to one no default names (`joinClasses`). What each test checks stays the same. Affected tests in `require-class-helper.test.ts`:
  - "reports a call to a helper the default helpers do not name": would turn silent.
  - "stays silent on a call to a helper its helpers option names": would pass without proving the option.
  - "reports a call to cn when the helpers option names others, as the option replaces the defaults": same result, same constant.

## Item 2: two-class ternaries stay reported

- **From:** #23 (decisions.md, 2026-10-11: "keep reporting two-class ternaries").
- No change. "reports a ternary choosing one of two classes" stays as it is and guards this.

## Item 3: calls to `*Variants` functions pass; `cva` and `cx` stay helpers

- **From:** q-r2b-cva-variants, "Accept `*Variants` calls". The card's effect: "A call to any function whose name ends in `Variants` passes, the same as a named helper". The owner's note: "cva or class variance authority is fine and so is cx".
- **Behaviour:**
  - After the existing unwrapping, a class value is accepted like a helper call if it is a call whose callee name ends in `Variants`. The name is read by `calleeNameOf` and matched case-sensitively. Its arguments are not inspected.
  - This does not depend on `helpers`: it holds at the defaults and when `helpers` names others (A1).
  - The suffix is a named constant (CLAUDE.md: no magic strings).
  - `cva` and `cx` are already in `DEFAULT_CLASS_HELPERS`; no change. The existing `.map` cases cover them.
- **Tests** (new cases in the cases file, one export per shape):
  - **Silent at defaults; each fails before the change:**
    - `buttonVariants({ variant, className })`
    - `dropdownMenuItemVariants()`
    - `ui.buttonVariants()`
    - `buttonVariants?.()`
    - a ternary inside a variants call's argument: `buttonVariants({ size: large ? 'lg' : 'sm' })`
    - bare `Variants()` (A2)
  - **Reported beside them**, one report each, checked by line. These pass before and after; they fence the suffix:
    - `buttonVariant()`
    - `buttonvariants()`
    - `variants()`
    - `buttonVariantsFor()`
    - `getButtonClassName()`: research's 40 `get…ClassName()` calls "stay reported either way"
    - a template wrapping a variants call: `` `${buttonVariants()} extra` ``
  - **With `helpers: ['joinClasses']`:** one file where `buttonVariants()` is silent and `cn()` is reported, so exactly one report, on `cn`'s line. This fails before the change, when both are reported. Here "the suffix is accepted on its own" and "the suffix is accepted only with the default helpers" give different results.
- **Existing tests made wrong:** none. `composingOutsideClassAttributes` already has a `buttonVariants = cva(…)` outside `className`.

## Item 4: which ruleset

- **From:** q-r2-class-helper-ruleset (note: "isnt there a styling category? if not put in conventions") and lib-structure ("One ruleset per library, grouped by domain"). Its card lists "styling: css-modules, **class-names** (`house/require-class-helper`…)".
- No file in this lane changes. What the data lane needs is under [Owed by other lanes](#owed-by-other-lanes-reported-not-made-here).

## Docs owed in this lane

- The rule's `meta.docs.description` gains the `*Variants` call. That is the one sentence the change makes false. Message wording is unchanged apart from Item 1's list (A3).
- The cases-file header says every shape "was measured on the JSX and TSX files under ~/dev". That is not true of the new fence shapes: reword that sentence only.
- The test file's header comment quotes only the 2026-10-10 decision: add the 2026-10-14 answer in one line.

## Break check (CLAUDE.md, "Break each new decision point")

Serve the broken rule module without writing the source file: a Vite `load` hook in a scratch vitest config pointed at the lane copy. Run `require-class-helper.test.ts` and record which test fails for each break. House tests load `src`, so no build is needed. Run the unbroken suite first; it must be clean.

| Break | Must fail |
| --- | --- |
| Drop `classNames`; separately, drop `classnames` | the matching "…, a default helper" case |
| Remove the suffix check | the silent `*Variants` cases |
| Accept every call | `getButtonClassName()`, and `joinClasses` at defaults |
| `endsWith` becomes `includes` | `buttonVariantsFor()` |
| Case-insensitive suffix | `buttonvariants()` |
| Suffix `Variant` | `buttonVariant()` |
| Suffix only when `helpers` is unset | the `helpers: ['joinClasses']` case |
| Name **and** suffix in place of **or** | the default-helper and `*Variants` silent cases |

## Real run (CLAUDE.md step 6)

Research's measuring script went with `/tmp`, so write a new one under `scratch-backup/answers-build/<name>/`:
- **Corpus:** every `.jsx` and `.tsx` under `~/dev`, read-only. Prune `~/dev/cli` (never read it) and every `node_modules`.
- **Runs:** lint each file twice with the rule at its defaults, through ESLint and the typescript-eslint parser. Once with `lanes/house/base`'s plugin, once with `lanes/house/repo`'s.
- **Pass:**
  - The fatal-parse count is the same in both runs.
  - The repo run has no report the base run lacks.
  - The base-run reports missing from the repo run are exactly those whose value is a call to `classNames`, `classnames` or a `*Variants` function.
- **Record:** the report count before and after, and how many were dropped per shape. Research's figures (1,134 → 962, 18 cva calls) are for orientation only: the corpus has grown.

## Gate

From the lane copy's root: `bun run build --force`, `bun run typecheck --force`, `bunx turbo test --force --continue --concurrency=1 -- --maxWorkers=2`. No suite may collect zero tests. Then the expressive-TypeScript pass (the `meta-design-expressive-typescript` skill, nothing else), then review.

## Owed by other lanes (reported, not made here)

- **Data lane** (`packages/rule-data`):
  - `ruleset-definitions.json`: a `class-names` ruleset in `libs.styling`. `canonical-list.test.ts`'s `LIBS_RULESETS_BY_DOMAIN` follows.
  - `rules.json` gets an entry for `house/require-class-helper`:
    - ruleset `class-names`, run in ESLint
    - `options: []`: the defaults carry the helpers
    - untyped (the inventory has `typed: false`)
    - assigned by the owner, 2026-10-14 (q-r2-class-helper-ruleset, lib-structure)
  - `rule-candidates.json`: delete the rule's `needs-owner` entry, and its text with it.
  - `catalog.test.ts`: "makes house/require-class-helper a RuleId run by ESLint and shipped in no ruleset" now expects `class-names`. The owner's answer made the old assertion wrong.
  - Nothing in the answers makes `class-names` opt-in, so `init` puts it in every team's agent set.
- **Whoever owns the `packages/lint-rules` tests:**
  - The comment in `engines.integration.test.ts` saying the rule is "not shipped until the owner decides" becomes false.
  - Add a `classNames(…)` line and a `buttonVariants(…)` line to `test-fixtures/engines/class-helper.tsx`. Both must stay silent, which proves the built package's shipped defaults end to end.
  - The existing "fires in ESLint, once" assertion stays.
- **Docs, on landing** (orchestrator or data lane):
  - plan.md, Rulesets: the `libs` row gains `class-names`.
  - plan.md, the bullet "The test for a `libs` ruleset: it must be meaningless without that dependency": this is false for `class-names`, whose rule means something with no helper installed. It needs the exception that the owner's lib-structure answer made (A5).
  - questions.md #23, and status.md's "Answered, not built: class-helper ship (#23)": now built.

## Ambiguities, with recommendations

- **A1. With `helpers` set, still accept `*Variants` calls?** The card says "the same as a named helper", but `helpers` holds names, not suffixes. **Recommend yes, regardless of `helpers`.** A cva-made function returns a class whichever helper composes it. Otherwise a team adding its own helper would lose the acceptance with no way to get it back. No new option (CLAUDE.md: no config key the owner has not named).
- **A2. A bare `Variants(…)` call.** The card's literal reading ("ends in `Variants`") accepts it. **Recommend the literal reading, pinned by a test,** so that narrowing it later is a visible decision.
- **A3. Should the message mention `*Variants`?** **Recommend no.** Only reported code shows the message, and naming the suffix invites renaming `getButtonClassName` to get past the rule.
- **A4. `cva('x')()` written inline is reported** (its callee is a call, so it has no name; probe below). The owner's "cva … is fine" reads as keeping `cva` a helper, which it already is. **Recommend leaving the inline form reported,** with no test.
- **A5. `class-names` and plan.md's test for a `libs` ruleset.** lib-structure decided the placement; only the plan.md sentence needs changing. This is for the orchestrator, not the owner.

## Success criteria

| # | Criterion | How to verify |
| --- | --- | --- |
| H-1 | `classNames(…)` and `classnames(…)` silent at defaults; a `joinClasses` call reported at defaults and silent when `helpers` names it | `require-class-helper.test.ts` |
| H-2 | Every silent `*Variants` shape in Item 3 is silent; every fence shape is reported once, at its line | same |
| H-3 | With `helpers: ['joinClasses']`: `buttonVariants()` silent, `cn()` reported, one report in all | same |
| H-4 | A two-class ternary is still reported; `cx` and `cva` are still silent | same (existing cases) |
| H-5 | The new silent cases and the H-3 case were seen failing before the rule changed | the tester's saved output |
| H-6 | Every break in the table fails a test | the break-check output |
| H-7 | The real run passes as defined, with its counts recorded | the real-run output |
| H-8 | The gate is green and no suite collects zero tests | the three gate commands |
| H-9 | The lane diff touches only `packages/eslint-plugin-house/` and this file | `sh scratch-backup/lanes/lane-diff.sh scratch-backup/lanes/house` |

## Evidence

- Baseline, lane copy: `bun run --cwd packages/eslint-plugin-house test src/rules/require-class-helper.test.ts` gives 1 file, all passed.
- Probe (`scratch-backup/answers-build/house-pm/probe/probe.mts <repo>`; Node 23.10 with type stripping; ESLint and the typescript-eslint parser from the house package):
  - Reported today: `classNames`, `classnames`, `buttonVariants`, `ui.buttonVariants`, `buttonVariants?.()`, `Variants()`, `buttonVariant()`, `buttonvariants()`, `getButtonClassName()`, `cva('x')()`.
  - Silent today: `cx(…)`, `cva(…)`.

## Corrections

- spec-next-batch D3 put the rule in `conventions` (its Q-R2 recommendation). The owner's note and lib-structure put it in `libs.styling`, `class-names`.
- spec-next-batch D3 named only `classNames` and `classnames`. q-r2b adds `*Variants` calls.
- The brief's "cva / cx as helpers": both are already default helpers, so there is nothing to add.
