import { catalog } from '@workspace/rule-data'
import { ESLint, type Linter } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'
import { STAND_IN_FIXTURES, type StandInFixture } from './__tests__/cases/eslint-stand-ins.ts'
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

// spec-core.md C4 (#55, r2-d49-51; spec-next-batch S-5): in a project without oxlint, ESLint stands
// in for five oxc rules, which ESLint has no version of, with unicorn rules: each fires on its
// fixture through the ESLint merge. Beside oxlint, and in the agent build, oxlint runs the oxc rule
// and no stand-in is stated. Each stand-in is read from the real catalog.

// The rulesets shipping the five oxc rules.
const SHIPPING_THE_OXC_RULES = { quality: ['correctness', 'redundancy'] }

/** The fixture file of each stand-in, by the oxc rule's ID: `src/` and the oxc rule's name. */
function fixtureFileOf({ oxlintRule }: StandInFixture): string {
  return `src/${oxlintRule.replace('/', '-')}.js`
}

/** The rule the catalog records standing in for the oxlint-only rule without oxlint. */
function standInOf({ oxlintRule }: StandInFixture): string {
  const standIn = catalog.eslintStandIns.get(oxlintRule)
  if (standIn === undefined) throw new Error(`${oxlintRule}: the catalog records no ESLint stand-in for it`)
  return standIn
}

const STAND_IN_IDS: ReadonlySet<string> = new Set(STAND_IN_FIXTURES.map(standInOf))
const FIXTURE_FILES = STAND_IN_FIXTURES.map(fixtureFileOf)

const tempProjects = setUpTempProjects()
const PROJECT_DIR = tempProjects.create({ files: Object.fromEntries(STAND_IN_FIXTURES.map((standIn) => [fixtureFileOf(standIn), standIn.fixture])) })

/** Each fixture file's findings of a stand-in, by rule ID, sorted. */
async function standInsReportedWith(config: Linter.Config[]): Promise<Readonly<Record<string, readonly string[]>>> {
  const findings = eslintFindingsIn(await new ESLint({ cwd: PROJECT_DIR, overrideConfigFile: true, overrideConfig: config }).lintFiles(FIXTURE_FILES), PROJECT_DIR)
  return Object.fromEntries(
    FIXTURE_FILES.map((file) => [
      file,
      findings
        .filter((found) => found.file === file && STAND_IN_IDS.has(found.rule))
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
    expect(await standInsReportedWith(editorMergeOf(false))).toStrictEqual(Object.fromEntries(STAND_IN_FIXTURES.map((standIn) => [fixtureFileOf(standIn), [standInOf(standIn)]])))
  })

  it('are stated by no block of the ESLint merge of a project with oxlint, which runs the oxc rules', async () => {
    expect(await standInsReportedWith(editorMergeOf(true))).toStrictEqual(NONE_IN_ANY_FIXTURE)
  })

  it('are stated by no block of the agent build, whose oxlint runs the oxc rules', async () => {
    const config = buildEslintConfig({ ...buildLintRules(SHIPPING_THE_OXC_RULES), tsconfigRootDir: PROJECT_DIR }, catalog, eslintPluginRegistry, buildProjectFacts())

    expect(await standInsReportedWith(config)).toStrictEqual(NONE_IN_ANY_FIXTURE)
  })
})

// The fixtures cover exactly the catalog's stand-ins.
describe('the stand-in fixtures', () => {
  let standInsOfTheCatalog: string[]

  beforeAll(() => {
    standInsOfTheCatalog = [...catalog.eslintStandIns.keys()].toSorted()
  })

  it("cover exactly the real catalog's stand-ins", () => {
    expect(STAND_IN_FIXTURES.map(({ oxlintRule }) => oxlintRule).toSorted()).toStrictEqual(standInsOfTheCatalog)
  })
})
