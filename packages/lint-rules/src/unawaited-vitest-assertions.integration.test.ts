import vitestPlugin from '@vitest/eslint-plugin'
import { catalog } from '@workspace/rule-data'
import { ESLint, type Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { buildAgentConfigs } from './agent-configs.ts'
import { describeFinding, eslintFindingsIn, oxlintFindingsIn, runOxlintCli, writeOxlintConfigFile } from './__tests__/engine-clis.ts'
import { moduleText } from './__tests__/factories/check-factories.ts'
import { buildFileOverride, buildLintRules, buildTwoSetFileOverride, buildTwoSetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, lintRulesPackageVersion, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { oxlintCodeOf } from './__tests__/oxlint-codes.ts'
import { type RunOfAKind, runMadeFor, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { installedPackage, type TempProjects } from './__tests__/temp-projects.ts'
import { editorPartsOf } from './core/editor-parts.ts'
import { ruleIdsTheTeamsEslintConfigSets } from './core/eslint-config-reading.ts'
import { mergeEslintPart } from './core/merge-eslint-config.ts'
import { mergeOxlintPart } from './core/merge-oxlint-config.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

// An unawaited Vitest assertion is reported once, whichever rulesets are listed: by vitest/valid-expect where
// tests is listed, and by no-floating-promises where it is not, through the real engines in each build. Vitest 5
// is linked, so the typed rule sees the assertion's type; the file's own unawaited promise is reported in every
// build, so a build that runs no typed rule cannot pass.

const FLOATING_PROMISES = '@typescript-eslint/no-floating-promises'
const VALID_EXPECT = 'vitest/valid-expect'
const VALID_EXPECT_IN_OXLINT = oxlintCodeOf(VALID_EXPECT, catalog)
const NAMES: ReadonlySet<string> = new Set([FLOATING_PROMISES, VALID_EXPECT, VALID_EXPECT_IN_OXLINT])
const SRC_TEST_FILE = 'src/load.test.ts'
const LEGACY_TEST_FILE = 'legacy/load.test.ts'
const LEGACY_FILES = 'legacy/**'
const UNAWAITED_ASSERTION_LINE = 8
const OWN_UNAWAITED_PROMISE_LINE = 12
const UNAWAITED_ASSERTIONS = moduleText(
  "import { expect, it } from 'vitest'",
  '',
  'async function load(): Promise<number> {',
  '  return 1',
  '}',
  '',
  "it('loads', () => {",
  '  expect(load()).resolves.toBe(1)',
  '})',
  '',
  "it('loads again', () => {",
  '  load()',
  '})',
)
const OXLINT_CONFIG_FILE = 'unawaited-vitest-assertions.oxlintrc.json'
const WITHOUT_TESTS = { quality: ['correctness'], libs: { testing: ['vitest'] } }
const WITH_TESTS = { quality: ['correctness', 'tests'], libs: { testing: ['vitest'] } }
const CORRECTNESS_ALONE = { quality: ['correctness'] }
// The team turns vitest/valid-expect off, with the plugin a team installs: it is the team's, in every file.
const TEAM_ESLINT_CONFIG_TURNING_VALID_EXPECT_OFF: readonly Linter.Config[] = [buildTeamEslintBlock('team/vitest', { plugins: { vitest: vitestPlugin }, rules: { [VALID_EXPECT]: 'off' } })]
const NO_TEAM_ESLINT_CONFIG: readonly Linter.Config[] = []

type Rulesets = Parameters<typeof buildLintRules>[0]

/** What a run lists: the top-level rulesets, and those of an entry for legacy/**, where it gives one. */
type Listed = { readonly rulesets: Rulesets; readonly legacyEntry: Rulesets | null }

/** The configs of one build: an oxlint config where oxlint runs, and an ESLint config. */
type BuildConfigs = { readonly oxlint: OxlintConfig | null; readonly eslint: Linter.Config[] }

/** A build as a test names it, its configs for what is listed, and how it spells vitest/valid-expect's finding. */
type Build = { readonly build: string; readonly configsFor: (projectDir: string, listed: Listed) => BuildConfigs; readonly validExpect: string }

type FindingsRun = RunOfAKind & {
  readonly withoutTests: readonly string[]
  readonly withTests: readonly string[]
  readonly testsDroppedForLegacy: readonly string[]
}

function agentBuild(projectDir: string, { rulesets, legacyEntry }: Listed): BuildConfigs {
  const fileOverrides = legacyEntry === null ? [] : [buildFileOverride([LEGACY_FILES], { rulesets: legacyEntry })]
  return buildAgentConfigs({ ...buildLintRules(rulesets, { fileOverrides }), tsconfigRootDir: projectDir })
}

function editorMerge(projectDir: string, { rulesets, legacyEntry }: Listed, usesOxlint: boolean, teamEslintConfig: readonly Linter.Config[]): BuildConfigs {
  const fileOverrides = legacyEntry === null ? [] : [buildTwoSetFileOverride([LEGACY_FILES], { editorRulesets: legacyEntry })]
  const { eslint, oxlint } = editorPartsOf({ ...buildTwoSetLintRules({ editorRulesets: rulesets }, { fileOverrides }), tsconfigRootDir: projectDir }, catalog, usesOxlint)
  const ruleIdsTheTeamSets = ruleIdsTheTeamsEslintConfigSets(defineConfig([...teamEslintConfig]), eslintPluginRegistry, catalog)
  return {
    oxlint: oxlint === undefined ? null : mergeOxlintPart(EMPTY_TEAM_OXLINT_CONFIG, oxlint, catalog, ruleIdsTheTeamSets),
    eslint: mergeEslintPart([...teamEslintConfig], eslint, catalog, eslintPluginRegistry, lintRulesPackageVersion(), NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG),
  }
}

const AGENT_BUILD: Build = { build: 'the agent build', configsFor: agentBuild, validExpect: VALID_EXPECT_IN_OXLINT }
const EDITOR_MERGES_LISTING_OXLINT: Build = {
  build: 'the editor merges, in a project listing oxlint',
  configsFor(projectDir, listed) {
    return editorMerge(projectDir, listed, true, NO_TEAM_ESLINT_CONFIG)
  },
  validExpect: VALID_EXPECT_IN_OXLINT,
}
const ESLINT_MERGE_LISTING_NO_OXLINT: Build = {
  build: 'the ESLint merge, in a project listing no oxlint',
  configsFor(projectDir, listed) {
    return editorMerge(projectDir, listed, false, NO_TEAM_ESLINT_CONFIG)
  },
  validExpect: VALID_EXPECT,
}
const BUILDS: readonly Build[] = [AGENT_BUILD, EDITOR_MERGES_LISTING_OXLINT, ESLINT_MERGE_LISTING_NO_OXLINT]
const EDITOR_PROJECTS = [
  { project: 'listing oxlint', usesOxlint: true },
  { project: 'listing no oxlint', usesOxlint: false },
]

/** A typed project: its tsconfig takes in both test files, and Vitest is installed. */
function typedProjectWithUnawaitedAssertions(tempProjects: TempProjects): string {
  return tempProjects.create({
    files: {
      'package.json': packageJsonText(buildPackageJsonListingOthers()),
      'tsconfig.json': `${JSON.stringify(buildTsconfig({ include: ['src', 'legacy'] }))}\n`,
      [SRC_TEST_FILE]: UNAWAITED_ASSERTIONS,
      [LEGACY_TEST_FILE]: UNAWAITED_ASSERTIONS,
    },
    linkedPackages: [installedPackage('vitest')],
  })
}

/** Each finding of either rule, from either engine, as `file:line rule`, sorted. */
async function findingsIn(projectDir: string, { oxlint, eslint }: BuildConfigs): Promise<string[]> {
  const eslintFindings = eslintFindingsIn(await new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: eslint }).lintFiles(['.']), projectDir)
  const oxlintFindings = oxlint === null ? [] : oxlintFindingsOf(projectDir, oxlint)
  return [...eslintFindings, ...oxlintFindings]
    .filter(({ rule }) => NAMES.has(rule))
    .map(describeFinding)
    .toSorted()
}

function oxlintFindingsOf(projectDir: string, config: Readonly<OxlintConfig>): ReturnType<typeof oxlintFindingsIn> {
  writeOxlintConfigFile(projectDir, OXLINT_CONFIG_FILE, config)
  return oxlintFindingsIn(runOxlintCli(projectDir, OXLINT_CONFIG_FILE).report)
}

async function findingsRunIn(projectDir: string, { build, configsFor }: Build): Promise<FindingsRun> {
  return {
    kind: build,
    withoutTests: await findingsIn(projectDir, configsFor(projectDir, { rulesets: WITHOUT_TESTS, legacyEntry: null })),
    withTests: await findingsIn(projectDir, configsFor(projectDir, { rulesets: WITH_TESTS, legacyEntry: null })),
    testsDroppedForLegacy: await findingsIn(projectDir, configsFor(projectDir, { rulesets: WITH_TESTS, legacyEntry: CORRECTNESS_ALONE })),
  }
}

/** In both test files: the line each rule reports in a file, and the file's own unawaited promise. */
function inBothFiles(assertionReportedBy: (file: string) => string): string[] {
  return [SRC_TEST_FILE, LEGACY_TEST_FILE]
    .flatMap((file) => [`${file}:${String(UNAWAITED_ASSERTION_LINE)} ${assertionReportedBy(file)}`, `${file}:${String(OWN_UNAWAITED_PROMISE_LINE)} ${FLOATING_PROMISES}`])
    .toSorted()
}

describe('an unawaited Vitest assertion, in a test file a tsconfig takes in', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const projectDir = typedProjectWithUnawaitedAssertions(tempProjects)
    return {
      byBuild: await Promise.all(BUILDS.map((build) => findingsRunIn(projectDir, build))),
      teamTurningValidExpectOff: await Promise.all(
        EDITOR_PROJECTS.map(async ({ project, usesOxlint }) => ({
          kind: project,
          findings: await findingsIn(projectDir, editorMerge(projectDir, { rulesets: WITH_TESTS, legacyEntry: null }, usesOxlint, TEAM_ESLINT_CONFIG_TURNING_VALID_EXPECT_OFF)),
        })),
      ),
    }
  })

  it.each(BUILDS)('is reported by no-floating-promises where tests is not listed, in $build', ({ build }) => {
    expect(runMadeFor(runs().byBuild, build).withoutTests).toStrictEqual(inBothFiles(() => FLOATING_PROMISES))
  })

  it.each(BUILDS)('is reported by vitest/valid-expect alone where tests is listed, in $build', ({ build, validExpect }) => {
    expect(runMadeFor(runs().byBuild, build).withTests).toStrictEqual(inBothFiles(() => validExpect))
  })

  it.each(BUILDS)('is reported by no-floating-promises in the files of an entry dropping tests, and by vitest/valid-expect alone elsewhere, in $build', ({ build, validExpect }) => {
    expect(runMadeFor(runs().byBuild, build).testsDroppedForLegacy).toStrictEqual(inBothFiles((file) => (file === LEGACY_TEST_FILE ? FLOATING_PROMISES : validExpect)))
  })

  // The team's setting decides vitest/valid-expect, as it decides a cover: the allowance is ours, decided by our lists.
  it.each(EDITOR_PROJECTS)("is reported by neither where tests is listed and the team's ESLint config turns vitest/valid-expect off, in the editor merges of a project $project", ({ project }) => {
    expect(runMadeFor(runs().teamTurningValidExpectOff, project).findings).toStrictEqual(
      [SRC_TEST_FILE, LEGACY_TEST_FILE].map((file) => `${file}:${String(OWN_UNAWAITED_PROMISE_LINE)} ${FLOATING_PROMISES}`).toSorted(),
    )
  })
})
