import { catalog, routeOf } from '@workspace/rule-data'
import { ESLint, type Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { describeFinding, eslintFindingsIn, oxlintFindingsIn, runOxlintCli, writeOxlintConfigFile } from './__tests__/engine-clis.ts'
import { buildLintRules, buildTwoSetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { lintRulesPackageVersion } from './__tests__/factories/package-json-factories.ts'
import { buildProjectFacts } from './__tests__/factories/project-facts-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { buildEslintConfig } from './core/build-eslint-config.ts'
import { buildOxlintConfig } from './core/build-oxlint-config.ts'
import { editorPartsOf } from './core/editor-parts.ts'
import { ruleIdsTheTeamsEslintConfigSets } from './core/eslint-config-reading.ts'
import { mergeEslintPart } from './core/merge-eslint-config.ts'
import { mergeOxlintPart } from './core/merge-oxlint-config.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

// "Covered by" (S; spec-core.md C2) on the real engines, one pair end to end: r2-d75's prefer-const,
// which oxlint runs, under functional/no-let, which ESLint runs. With both rulesets listed a `let`
// never reassigned draws functional/no-let's report alone, in the agent build and in each editor
// merge; with the cover's ruleset unlisted it draws prefer-const's. In the editor merges S is
// decided before the team's rules are left out (call 3), so a team setting the cover keeps both of
// ours out. The pair is read from the real catalog.

const SOURCE_FILE = 'src/total.js'
const NEVER_REASSIGNED_LET = 'let total = 1\nexport { total }\n'
const OXLINT_CONFIG_FILE = 'covered-by.oxlintrc.json'
const BOTH_RULESETS = { quality: ['immutability', 'declarative'] }
const COVERED_RULESET_ALONE = { quality: ['immutability'] }
// r2-d75: prefer-const, run by oxlint, under functional/no-let, run by ESLint, both untyped and unscoped.
const covered = 'prefer-const'
const cover = coverOf(covered)
const PAIR_NAMES: ReadonlySet<string> = new Set([covered, cover, `eslint(${covered})`])
// The team turns the cover off: it is the team's, in every file.
const TEAM_ESLINT_CONFIG_SETTING_THE_COVER: Linter.Config[] = [buildTeamEslintBlock('team/no-let', { rules: { [cover]: 'off' } })]

const tempProjects = setUpTempProjects()
const PROJECT_DIR = tempProjects.create({ files: { [SOURCE_FILE]: NEVER_REASSIGNED_LET } })

/** The rule the catalog records covering the rule. */
function coverOf(rule: string): string {
  const { shipped } = routeOf(rule, catalog)
  if (shipped === null || shipped.coveredBy === null) throw new Error(`${rule}: the catalog records no rule covering it`)
  return shipped.coveredBy
}

/** The configs of one build: an oxlint config where oxlint runs, and an ESLint config. */
type BuildConfigs = { readonly oxlint: OxlintConfig | null; readonly eslint: Linter.Config[] }

/** Each finding of the pair in the source file, from either engine, as `file:line rule`, sorted. */
async function pairFindingsWith({ oxlint, eslint }: BuildConfigs): Promise<string[]> {
  const eslintFindings = eslintFindingsIn(await new ESLint({ cwd: PROJECT_DIR, overrideConfigFile: true, overrideConfig: eslint }).lintFiles([SOURCE_FILE]), PROJECT_DIR)
  const oxlintFindings = oxlint === null ? [] : oxlintFindingsOf(oxlint)
  return [...eslintFindings, ...oxlintFindings]
    .filter(({ rule }) => PAIR_NAMES.has(rule))
    .map(describeFinding)
    .toSorted()
}

function oxlintFindingsOf(config: OxlintConfig): ReturnType<typeof oxlintFindingsIn> {
  writeOxlintConfigFile(PROJECT_DIR, OXLINT_CONFIG_FILE, config)
  return oxlintFindingsIn(runOxlintCli(PROJECT_DIR, OXLINT_CONFIG_FILE, [SOURCE_FILE]).report)
}

function agentBuild(quality: { readonly quality: readonly string[] }): BuildConfigs {
  const lintRules = { ...buildLintRules(quality), tsconfigRootDir: PROJECT_DIR }
  return {
    oxlint: buildOxlintConfig(lintRules, catalog),
    eslint: buildEslintConfig(lintRules, catalog, eslintPluginRegistry, buildProjectFacts()),
  }
}

function editorMerge(quality: { readonly quality: readonly string[] }, usesOxlint: boolean, teamEslintConfig: Linter.Config[] = []): BuildConfigs {
  const { eslint, oxlint } = editorPartsOf({ ...buildTwoSetLintRules({ editorRulesets: quality }), tsconfigRootDir: PROJECT_DIR }, catalog, usesOxlint)
  const setByTheTeamsEslintConfig = ruleIdsTheTeamsEslintConfigSets(defineConfig(teamEslintConfig), eslintPluginRegistry, catalog)
  return {
    oxlint: oxlint === undefined ? null : mergeOxlintPart(EMPTY_TEAM_OXLINT_CONFIG, oxlint, catalog, setByTheTeamsEslintConfig),
    eslint: mergeEslintPart(teamEslintConfig, eslint, catalog, eslintPluginRegistry, lintRulesPackageVersion(), NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG),
  }
}

const COVERS_FINDING = `${SOURCE_FILE}:1 ${cover}`
const COVEREDS_FINDING_BY_OXLINT = `${SOURCE_FILE}:1 eslint(${covered})`
const COVEREDS_FINDING_BY_ESLINT = `${SOURCE_FILE}:1 ${covered}`

const BUILDS = [
  { build: 'the agent build', configsFor: agentBuild, coveredsFinding: COVEREDS_FINDING_BY_OXLINT },
  { build: 'the editor merges, in a project listing oxlint', configsFor: (quality: typeof BOTH_RULESETS) => editorMerge(quality, true), coveredsFinding: COVEREDS_FINDING_BY_OXLINT },
  { build: 'the ESLint merge, in a project listing no oxlint', configsFor: (quality: typeof BOTH_RULESETS) => editorMerge(quality, false), coveredsFinding: COVEREDS_FINDING_BY_ESLINT },
]

describe("prefer-const, covered by functional/no-let, on a let never reassigned", () => {
  it.each(BUILDS)("draws the cover's report alone where both rulesets are listed, in $build", async ({ configsFor }) => {
    expect(await pairFindingsWith(configsFor(BOTH_RULESETS))).toStrictEqual([COVERS_FINDING])
  })

  it.each(BUILDS)("draws its own report where the cover's ruleset is not listed, in $build", async ({ configsFor, coveredsFinding }) => {
    expect(await pairFindingsWith(configsFor(COVERED_RULESET_ALONE))).toStrictEqual([coveredsFinding])
  })

  it.each([
    { project: 'listing oxlint', usesOxlint: true },
    { project: 'listing no oxlint', usesOxlint: false },
  ])('draws no report of ours where the team sets the cover, both rulesets listed, in the editor merges of a project $project', async ({ usesOxlint }) => {
    expect(await pairFindingsWith(editorMerge(BOTH_RULESETS, usesOxlint, TEAM_ESLINT_CONFIG_SETTING_THE_COVER))).toStrictEqual([])
  })
})
