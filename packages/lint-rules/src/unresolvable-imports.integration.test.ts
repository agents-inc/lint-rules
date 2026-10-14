import { beforeAll, describe, expect, it } from 'vitest'
import { type BothEnginesRuns, setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import type { OurRulesets } from './__tests__/cases/both-engines-corpus.ts'
import {
  NO_EXTRANEOUS_IMPORT,
  NO_UNPUBLISHED_REQUIRE,
  OWED_BESIDE_A_KIT_MODULE,
  OWED_THROUGH_ALIASES_NAMED_LIKE_PACKAGES,
  OWED_THROUGH_THE_APP_TSCONFIG_ALIAS,
  OWED_THROUGH_THE_JSCONFIG_ALIAS,
  OWED_WHERE_OUR_RESOLVER_OPTION_REACHES,
  OWED_WHERE_OUR_RESOLVER_OPTION_REACHES_A_REQUIRE,
  unresolvableImportFiles,
} from './__tests__/cases/unresolvable-imports.ts'
import { NO_UNPUBLISHED_IMPORT } from './__tests__/cases/workspace-package-imports.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { agentsIncLintModuleTextRootedAtItsFolder, emptyTeamEslintModuleText, mergedEslintConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { type EngineFinding, type FindingsByFileAndRule, findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, TEAM_OXLINT_CONFIG_SETTING_NO_RULE, teamOxlintConfigSettingNoRuleFiles } from './__tests__/team-configs-of-the-other-engine.ts'

// n/no-unpublished-import on imports eslint-plugin-n cannot resolve, run outside the package as from a
// monorepo's root (decisions.md, 2026-10-14 "fix round 4 closed" and "fix round 5 review"). Fix round
// 4's review: such imports are still reported unpublished, the same class as real run 3's R-ALL-6.
// The cause, in the plugin's code (unresolvable-imports.ts): an import it resolves to no file is
// measured from the folder the process runs in. The `resolverConfig: { tsconfig: true }` option we
// ship on the rule, and on n/no-unpublished-require (decisions.md, 2026-10-14 "fix round 6 closed"),
// reaches a JS file's import or require through tsconfig.json's alias, so that is owed; it
// reaches nothing else, so those are pinned as known gaps (questions.md #78). Beside each, what the
// package does not publish stays reported: a package it lists in devDependencies alone, and an alias
// to its unpublished scripts folder. Given as the plugin's setting instead, the same resolverConfig
// reaches every rule of the plugin, and n/no-extraneous-import reported imports through aliases
// named like packages, and through baseUrl, as extraneous (fix round 5's review), so neither rule of
// ours may report those. The agent build and the merged runs lint in this process, outside the
// project; the ESLint CLI runs from the project's root.

allowEveryTestForParallelLoad()

/** What the ESLint CLI reported: every finding, and every fatal message. */
type EslintCliReading = { readonly findings: readonly EngineFinding[]; readonly fatalMessages: readonly string[] }

// The ruleset that ships n/no-unpublished-import, in both sets.
const MODULES: OurRulesets = { agentRulesets: { quality: ['modules'] }, editorRulesets: { quality: ['modules'] } }
const RULES = [NO_UNPUBLISHED_IMPORT]
const RULES_RESOLVING_IMPORTS = [NO_EXTRANEOUS_IMPORT, NO_UNPUBLISHED_IMPORT]
const REQUIRE_RULES = [NO_UNPUBLISHED_REQUIRE]
const LINT_RULES_MODULE = 'agents-inc.lint.mts'
const EMPTY_TEAM_ESLINT_MODULE = 'empty-team.eslint.mjs'

/** The findings of the files the owed findings name, by file and rule, to compare with them. */
function owedIn(findings: readonly EngineFinding[], owed: FindingsByFileAndRule): FindingsByFileAndRule {
  return findingsByFileAndRule(findings, Object.keys(owed), RULES)
}

/** As `owedIn`, for the rule of ours reading a require. */
function owedOfRequiresIn(findings: readonly EngineFinding[], owed: FindingsByFileAndRule): FindingsByFileAndRule {
  return findingsByFileAndRule(findings, Object.keys(owed), REQUIRE_RULES)
}

/** As `owedIn`, for both rules of ours that resolve an import to a package or a file. */
function owedOfBothIn(findings: readonly EngineFinding[], owed: FindingsByFileAndRule): FindingsByFileAndRule {
  return findingsByFileAndRule(findings, Object.keys(owed), RULES_RESOLVING_IMPORTS)
}

describe("imports eslint-plugin-n cannot resolve, in a monorepo's packages, our modules ruleset on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: unresolvableImportFiles,
    ourRulesets: MODULES,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  // The runs are read before the tests, so a run the engines cannot make fails the file: inside
  // it.fails it would pass as the failure expected. Only the assertion fails inside it.fails.
  let made: BothEnginesRuns | undefined

  beforeAll(() => {
    made = runs()
  })

  function theRuns(): BothEnginesRuns {
    if (made === undefined) throw new Error("no run was made before the tests of a monorepo's unresolvable imports")
    return made
  }

  it('are linted by every ESLint run with no fatal message', () => {
    expect(theRuns().eslintFatalMessages).toStrictEqual([])
  })

  it("are reported unpublished by the agent build where they name what the package does not publish, and not through tsconfig.json's alias to src from a JS file, nor by Vite's `virtual:` prefix", () => {
    expect(owedIn(theRuns().agent, OWED_WHERE_OUR_RESOLVER_OPTION_REACHES)).toStrictEqual(OWED_WHERE_OUR_RESOLVER_OPTION_REACHES)
  })

  it("are reported unpublished merged into empty team configs where they name what the package does not publish, and not through tsconfig.json's alias to src from a JS file, nor by Vite's `virtual:` prefix", () => {
    expect(owedIn(theRuns().mergedIntoEmptyTeamConfigs, OWED_WHERE_OUR_RESOLVER_OPTION_REACHES)).toStrictEqual(OWED_WHERE_OUR_RESOLVER_OPTION_REACHES)
  })

  it("report a require unpublished, by the agent build, where it names what the package does not publish, and not through tsconfig.json's alias to src from a CommonJS file", () => {
    expect(owedOfRequiresIn(theRuns().agent, OWED_WHERE_OUR_RESOLVER_OPTION_REACHES_A_REQUIRE)).toStrictEqual(OWED_WHERE_OUR_RESOLVER_OPTION_REACHES_A_REQUIRE)
  })

  it("report a require unpublished, merged into empty team configs, where it names what the package does not publish, and not through tsconfig.json's alias to src from a CommonJS file", () => {
    expect(owedOfRequiresIn(theRuns().mergedIntoEmptyTeamConfigs, OWED_WHERE_OUR_RESOLVER_OPTION_REACHES_A_REQUIRE)).toStrictEqual(
      OWED_WHERE_OUR_RESOLVER_OPTION_REACHES_A_REQUIRE,
    )
  })

  it('report nothing, by the agent build, through aliases named like packages nor through baseUrl, as extraneous or unpublished', () => {
    expect(owedOfBothIn(theRuns().agent, OWED_THROUGH_ALIASES_NAMED_LIKE_PACKAGES)).toStrictEqual(OWED_THROUGH_ALIASES_NAMED_LIKE_PACKAGES)
  })

  it('report nothing, merged into empty team configs, through aliases named like packages nor through baseUrl, as extraneous or unpublished', () => {
    expect(owedOfBothIn(theRuns().mergedIntoEmptyTeamConfigs, OWED_THROUGH_ALIASES_NAMED_LIKE_PACKAGES)).toStrictEqual(OWED_THROUGH_ALIASES_NAMED_LIKE_PACKAGES)
  })

  // KNOWN GAP (questions.md #78): the plugin reads aliases from tsconfig.json alone (get-tsconfig.js),
  // and enhanced-resolve's `tsconfig` option, given through `resolverConfig`, appends tsconfig.json to
  // each reference path and joins a named config file to the importing file's folder: neither finds
  // tsconfig.app.json (measured, ESLint 10.12).
  it.fails("report, by the agent build, the devDependency alone where Vite's layout keeps the alias in tsconfig.app.json", () => {
    expect(owedIn(theRuns().agent, OWED_THROUGH_THE_APP_TSCONFIG_ALIAS)).toStrictEqual(OWED_THROUGH_THE_APP_TSCONFIG_ALIAS)
  })

  // KNOWN GAP: as above, for jsconfig.json, named or not (measured, ESLint 10.12).
  it.fails('report, by the agent build, the devDependency alone where a JS project keeps the alias in jsconfig.json', () => {
    expect(owedIn(theRuns().agent, OWED_THROUGH_THE_JSCONFIG_ALIAS)).toStrictEqual(OWED_THROUGH_THE_JSCONFIG_ALIAS)
  })

  // KNOWN GAP: SvelteKit's `$app/…` modules exist only in its Vite plugin and its ambient types, so
  // no resolver setting finds a file, and `allowModules` reads package names alone, which `$app`
  // fails the pattern of.
  it.fails("report, by the agent build, the devDependency alone beside SvelteKit's virtual module", () => {
    expect(owedIn(theRuns().agent, OWED_BESIDE_A_KIT_MODULE)).toStrictEqual(OWED_BESIDE_A_KIT_MODULE)
  })
})

describe("imports eslint-plugin-n cannot resolve, in a monorepo's packages, our modules ruleset on, in a project whose package.json lists no oxlint, linted by the ESLint CLI from the monorepo's root through the built package", () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    [LINT_RULES_MODULE]: agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings(MODULES)),
    'eslint.config.mjs': mergedEslintConfigText(LINT_RULES_MODULE, EMPTY_TEAM_ESLINT_MODULE, TEAM_OXLINT_CONFIG_SETTING_NO_RULE),
    ...teamOxlintConfigSettingNoRuleFiles,
    [EMPTY_TEAM_ESLINT_MODULE]: emptyTeamEslintModuleText(),
    ...unresolvableImportFiles,
  })
  // As above: the run and what ESLint reported are read before the tests, so only the assertion
  // fails inside it.fails.
  let made: EslintCliReading | undefined

  beforeAll(() => {
    const cliRun = run()
    made = { findings: eslintEngineFindingsOf(cliRun), fatalMessages: eslintFatalMessagesOf(cliRun) }
  })

  function theRun(): EslintCliReading {
    if (made === undefined) throw new Error("no run was made before the tests of a monorepo's unresolvable imports")
    return made
  }

  it('are linted with no fatal message', () => {
    expect(theRun().fatalMessages).toStrictEqual([])
  })

  it("are reported unpublished where they name what the package does not publish, and not through tsconfig.json's alias to src from a JS file, nor by Vite's `virtual:` prefix", () => {
    expect(owedIn(theRun().findings, OWED_WHERE_OUR_RESOLVER_OPTION_REACHES)).toStrictEqual(OWED_WHERE_OUR_RESOLVER_OPTION_REACHES)
  })

  it("report a require unpublished where it names what the package does not publish, and not through tsconfig.json's alias to src from a CommonJS file", () => {
    expect(owedOfRequiresIn(theRun().findings, OWED_WHERE_OUR_RESOLVER_OPTION_REACHES_A_REQUIRE)).toStrictEqual(OWED_WHERE_OUR_RESOLVER_OPTION_REACHES_A_REQUIRE)
  })

  it('report nothing through aliases named like packages nor through baseUrl, as extraneous or unpublished', () => {
    expect(owedOfBothIn(theRun().findings, OWED_THROUGH_ALIASES_NAMED_LIKE_PACKAGES)).toStrictEqual(OWED_THROUGH_ALIASES_NAMED_LIKE_PACKAGES)
  })

  // KNOWN GAP: as in the describe above.
  it.fails("report the devDependency alone where Vite's layout keeps the alias in tsconfig.app.json", () => {
    expect(owedIn(theRun().findings, OWED_THROUGH_THE_APP_TSCONFIG_ALIAS)).toStrictEqual(OWED_THROUGH_THE_APP_TSCONFIG_ALIAS)
  })

  // KNOWN GAP: as in the describe above.
  it.fails('report the devDependency alone where a JS project keeps the alias in jsconfig.json', () => {
    expect(owedIn(theRun().findings, OWED_THROUGH_THE_JSCONFIG_ALIAS)).toStrictEqual(OWED_THROUGH_THE_JSCONFIG_ALIAS)
  })

  // KNOWN GAP: as in the describe above.
  it.fails("report the devDependency alone beside SvelteKit's virtual module", () => {
    expect(owedIn(theRun().findings, OWED_BESIDE_A_KIT_MODULE)).toStrictEqual(OWED_BESIDE_A_KIT_MODULE)
  })
})
