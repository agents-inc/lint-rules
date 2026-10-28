import { beforeAll, describe, expect, it } from 'vitest'
import { type BothEnginesRuns, setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
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
import type { EngineFinding } from './__tests__/engine-clis.ts'
import { EMPTY_TEAM_ESLINT_MODULE_FILE, projectMergingOurEslintPartText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings, MODULES_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { type FindingsByFileAndRule, findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'

// n/no-unpublished-import measures an import it resolves to no file from the folder the process runs
// in. The `resolverConfig: { tsconfig: true }` we ship on it and n/no-unpublished-require reaches a JS
// file's import or require through tsconfig.json's alias, so that is owed; it reaches nothing else,
// pinned as known gaps. Given as the plugin's setting instead, it made n/no-extraneous-import report
// aliases named like packages, so neither rule of ours may report those.

allowEveryTestForParallelLoad()

/** What the ESLint CLI reported: every finding, and every fatal message. */
type EslintCliReading = { readonly findings: readonly EngineFinding[]; readonly fatalMessages: readonly string[] }

const RULES = [NO_UNPUBLISHED_IMPORT]
const RULES_RESOLVING_IMPORTS = [NO_EXTRANEOUS_IMPORT, NO_UNPUBLISHED_IMPORT]
const REQUIRE_RULES = [NO_UNPUBLISHED_REQUIRE]

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
    ourRulesets: MODULES_IN_BOTH_SETS,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  // Read before the tests, so only the assertion can fail inside it.fails.
  // eslint-disable-next-line functional/no-let -- it.fails: only the assertion may throw, so the run is in beforeAll and its result crosses to the test (CLAUDE.md, Tests; q-lint-no-let-it-fails)
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

  // KNOWN GAP: the plugin reads aliases from tsconfig.json alone, and enhanced-resolve's `tsconfig`
  // option finds no tsconfig.app.json either (measured, ESLint 10.12).
  it.fails("report, by the agent build, the devDependency alone where Vite's layout keeps the alias in tsconfig.app.json", () => {
    expect(owedIn(theRuns().agent, OWED_THROUGH_THE_APP_TSCONFIG_ALIAS)).toStrictEqual(OWED_THROUGH_THE_APP_TSCONFIG_ALIAS)
  })

  // KNOWN GAP: as above, for jsconfig.json, named or not (measured, ESLint 10.12).
  it.fails('report, by the agent build, the devDependency alone where a JS project keeps the alias in jsconfig.json', () => {
    expect(owedIn(theRuns().agent, OWED_THROUGH_THE_JSCONFIG_ALIAS)).toStrictEqual(OWED_THROUGH_THE_JSCONFIG_ALIAS)
  })

  // KNOWN GAP: SvelteKit's `$app/…` modules exist only in its Vite plugin and types, so no resolver
  // finds a file, and `allowModules` reads package names alone.
  it.fails("report, by the agent build, the devDependency alone beside SvelteKit's virtual module", () => {
    expect(owedIn(theRuns().agent, OWED_BESIDE_A_KIT_MODULE)).toStrictEqual(OWED_BESIDE_A_KIT_MODULE)
  })
})

describe("imports eslint-plugin-n cannot resolve, in a monorepo's packages, our modules ruleset on, in a project whose package.json lists no oxlint, linted by the ESLint CLI from the monorepo's root through the built package", () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    ...projectMergingOurEslintPartText({
      settings: buildConsumerSettings(MODULES_IN_BOTH_SETS),
      team: EMPTY_TEAM_ESLINT_MODULE_FILE,
      teamOxlint: 'setting no rule',
    }),
    ...unresolvableImportFiles,
  })
  // As above, read before the tests, so only the assertion can fail inside it.fails.
  // eslint-disable-next-line functional/no-let -- it.fails: only the assertion may throw, so the run is in beforeAll and its result crosses to the test (CLAUDE.md, Tests; q-lint-no-let-it-fails)
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
