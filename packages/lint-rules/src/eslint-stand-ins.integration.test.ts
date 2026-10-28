import { catalog } from '@workspace/rule-data'
import { STAND_IN_CASES, type StandInCase } from '@workspace/rule-data/test-support/stand-in-cases'
import { ESLint, type Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { eslintFindingsIn } from './__tests__/engine-clis.ts'
import { buildLintRules, buildTwoSetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { lintRulesPackageVersion } from './__tests__/factories/package-json-factories.ts'
import { buildProjectFacts } from './__tests__/factories/project-facts-factories.ts'
import { NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { buildEslintConfig } from './core/build-eslint-config.ts'
import { editorPartsOf } from './core/editor-parts.ts'
import { mergeEslintPart } from './core/merge-eslint-config.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

// Without oxlint, ESLint stands in for oxc rules, on the code rule-data measured both reporting; beside
// oxlint, and in the agent build, oxlint runs the oxc rule and no stand-in is stated.

// The rulesets shipping the oxc rules with a stand-in.
const SHIPPING_THE_OXC_RULES = { quality: ['correctness', 'redundancy'] }

/** A file of a case, in a folder of the oxc rule's name, so no two cases' files meet. */
type FixtureFile = { readonly path: string; readonly source: string; readonly standInCase: StandInCase }

/** The rule the catalog records standing in for the oxlint-only rule without oxlint. */
function standInOf({ oxlintRule }: StandInCase): string {
  const standIn = catalog.eslintStandIns.get(oxlintRule)
  if (standIn === undefined) throw new Error(`${oxlintRule}: the catalog records no ESLint stand-in for it`)
  return standIn
}

function fixtureFilesOf(standInCase: StandInCase): FixtureFile[] {
  const folder = `src/${standInCase.oxlintRule.replace('/', '-')}`
  return standInCase.reportedIn.map(({ path, source }) => ({ path: `${folder}/${path}`, source, standInCase }))
}

const FIXTURES = STAND_IN_CASES.flatMap(fixtureFilesOf)
const FIXTURE_FILES = FIXTURES.map(({ path }) => path)

const tempProjects = setUpTempProjects()
const PROJECT_DIR = tempProjects.create({ files: Object.fromEntries(FIXTURES.map(({ path, source }) => [path, source])) })

/** Each fixture file's findings of a stand-in, by rule ID, sorted. */
async function standInsReportedWith(config: readonly Linter.Config[]): Promise<Readonly<Record<string, readonly string[]>>> {
  const standInIds: ReadonlySet<string> = new Set(FIXTURES.map(({ standInCase }) => standInOf(standInCase)))
  const findings = eslintFindingsIn(await new ESLint({ cwd: PROJECT_DIR, overrideConfigFile: true, overrideConfig: [...config] }).lintFiles(FIXTURE_FILES), PROJECT_DIR)
  return Object.fromEntries(
    FIXTURE_FILES.map((file) => [
      file,
      findings
        .filter((found) => found.file === file && standInIds.has(found.rule))
        .map(({ rule }) => rule)
        .toSorted(),
    ]),
  )
}

function editorMergeOf(usesOxlint: boolean): Linter.Config[] {
  const { eslint } = editorPartsOf({ ...buildTwoSetLintRules({ editorRulesets: SHIPPING_THE_OXC_RULES }), tsconfigRootDir: PROJECT_DIR }, catalog, usesOxlint)
  return mergeEslintPart([], eslint, catalog, eslintPluginRegistry, lintRulesPackageVersion(), NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG)
}

const NONE_IN_ANY_FIXTURE = Object.fromEntries(FIXTURE_FILES.map((file) => [file, []]))

describe('the ESLint stand-ins for oxc rules, each on its fixture', () => {
  it('fire, each on its own fixture alone, through the ESLint merge of a project without oxlint', async () => {
    expect(await standInsReportedWith(editorMergeOf(false))).toStrictEqual(Object.fromEntries(FIXTURES.map(({ path, standInCase }) => [path, [standInOf(standInCase)]])))
  })

  it('are stated by no block of the ESLint merge of a project with oxlint, which runs the oxc rules', async () => {
    expect(await standInsReportedWith(editorMergeOf(true))).toStrictEqual(NONE_IN_ANY_FIXTURE)
  })

  it('are stated by no block of the agent build, whose oxlint runs the oxc rules', async () => {
    const config = buildEslintConfig({ ...buildLintRules(SHIPPING_THE_OXC_RULES), tsconfigRootDir: PROJECT_DIR }, catalog, eslintPluginRegistry, buildProjectFacts())

    expect(await standInsReportedWith(config)).toStrictEqual(NONE_IN_ANY_FIXTURE)
  })
})

describe('the stand-in fixtures', () => {
  it("cover exactly the real catalog's stand-ins", () => {
    expect(STAND_IN_CASES.map(({ oxlintRule }) => oxlintRule).toSorted()).toStrictEqual(catalog.eslintStandIns.keys().toArray().toSorted())
  })
})
