import { catalog, routeOf } from '@workspace/rule-data'
import { ESLint, type Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import type { OxlintConfig } from 'oxlint'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeFinding, eslintFindingsIn, oxlintFindingsIn, runOxlintCli, writeOxlintConfigFile } from './__tests__/engine-clis.ts'
import { buildLintRules, buildTwoSetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { lintRulesPackageVersion } from './__tests__/factories/package-json-factories.ts'
import { buildProjectFacts } from './__tests__/factories/project-facts-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { type RunOfAKind, runMadeFor, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { buildEslintConfig } from './core/build-eslint-config.ts'
import { buildOxlintConfig } from './core/build-oxlint-config.ts'
import { editorPartsOf } from './core/editor-parts.ts'
import { ruleIdsTheTeamsEslintConfigSets } from './core/eslint-config-reading.ts'
import { mergeEslintPart } from './core/merge-eslint-config.ts'
import { mergeOxlintPart } from './core/merge-oxlint-config.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

// A rule left out where another reports what it does, through the real engines. The editor merges decide
// a cover before leaving out the team's rules, so a team setting the cover keeps both of ours out.

const SOURCE_FILE = 'src/total.js'
const NEVER_REASSIGNED_LET = 'let total = 1\nexport { total }\n'
const ASSIGNMENT_FILE = 'src/assign.js'
const ASSIGNMENT_IN_A_CONDITION = 'export function pick(a) {\n  let b = 0\n  if (b = a) {\n    return b\n  }\n  return 0\n}\n'
const LOOP_CONDITIONS_FILE = 'src/wait.js'
const ASSIGNMENTS_IN_LOOP_CONDITIONS = 'export function wait(next) {\n  let tries = 3\n  while (tries = next()) {\n    tries -= 1\n  }\n  do {\n    tries -= 1\n  } while (tries = next())\n  return tries\n}\n'
const RETURN_FILE = 'src/pick.js'
const ASSIGNMENT_RETURNED = 'export function pick(a) {\n  const box = { b: 0 }\n  return box.b = a\n}\n'
const ARROW_AND_SEQUENCE_FILE = 'src/remember.js'
const ASSIGNMENTS_AN_ARROW_AND_A_SEQUENCE_RETURN = 'const seen = { last: 0 }\nexport const remember = (item) => seen.last = item\nexport function pick(a) {\n  const box = { b: 0 }\n  return log(), box.b = a\n}\nfunction log() {}\n'
const TEST_FILE = 'src/button.test.js'
const TYPE_TEST_FILE = 'src/button.test-d.js'
const DEBUG_IN_A_TEST = "import { screen } from '@testing-library/react'\nimport { it } from 'vitest'\n\nit('shows the button', () => {\n  screen.debug()\n})\n"
const STORY_FILE = 'src/button.stories.js'
const DEBUG_IN_A_PLAY_FUNCTION = "import { screen } from '@testing-library/react'\n\nexport default { title: 'Button' }\n\nexport const Primary = {\n  play: async () => {\n    screen.debug()\n  },\n}\n"
// oxc's rule leaves a mapped parameter and an array read again after the map (its default options).
const MAP_SPREAD_FILE = 'src/map.js'
const SPREAD_IN_A_MAP = 'const items = [{ id: 1 }]\nexport const done = items.map((item) => ({ ...item, done: true }))\n'
const GLOBAL_FILE = 'src/global.js'
const READ_ONLY_GLOBAL_WRITTEN = 'window = {}\n'
const OXLINT_CONFIG_FILE = 'covered-by.oxlintrc.json'
const BOTH_RULESETS = { quality: ['immutability', 'declarative'] }
const COVERED_RULESET_ALONE = { quality: ['immutability'] }
const covered = 'prefer-const'

allowEveryTestForParallelLoad()

const tempProjects = setUpTempProjects()
const PROJECT_DIR = tempProjects.create({
  files: {
    [SOURCE_FILE]: NEVER_REASSIGNED_LET,
    [ASSIGNMENT_FILE]: ASSIGNMENT_IN_A_CONDITION,
    [LOOP_CONDITIONS_FILE]: ASSIGNMENTS_IN_LOOP_CONDITIONS,
    [RETURN_FILE]: ASSIGNMENT_RETURNED,
    [ARROW_AND_SEQUENCE_FILE]: ASSIGNMENTS_AN_ARROW_AND_A_SEQUENCE_RETURN,
    [TEST_FILE]: DEBUG_IN_A_TEST,
    [TYPE_TEST_FILE]: DEBUG_IN_A_TEST,
    [STORY_FILE]: DEBUG_IN_A_PLAY_FUNCTION,
    [MAP_SPREAD_FILE]: SPREAD_IN_A_MAP,
    [GLOBAL_FILE]: READ_ONLY_GLOBAL_WRITTEN,
  },
})

function coverOf(rule: string): string {
  const { shipped } = routeOf(rule, catalog)
  if (shipped === null || shipped.coveredBy === null) throw new Error(`${rule}: the catalog records no rule covering it`)
  return shipped.coveredBy
}

function pairNames(): ReadonlySet<string> {
  return new Set([covered, coverOf(covered), `eslint(${covered})`])
}

// The team turns the cover off: it is the team's, in every file.
function teamEslintConfigSettingTheCover(): Linter.Config[] {
  return [buildTeamEslintBlock('team/no-let', { rules: { [coverOf(covered)]: 'off' } })]
}

function coversFinding(): string {
  return `${SOURCE_FILE}:1 ${coverOf(covered)}`
}

/** The configs of one build: an oxlint config where oxlint runs, and an ESLint config. */
type BuildConfigs = { readonly oxlint: OxlintConfig | null; readonly eslint: Linter.Config[] }

/** Each finding in the file of a rule named, from either engine, as `file:line rule`, sorted. */
async function findingsOfIn({ oxlint, eslint }: BuildConfigs, file: string, names: ReadonlySet<string>): Promise<string[]> {
  const eslintFindings = eslintFindingsIn(await new ESLint({ cwd: PROJECT_DIR, overrideConfigFile: true, overrideConfig: eslint }).lintFiles([file]), PROJECT_DIR)
  const oxlintFindings = oxlint === null ? [] : oxlintFindingsOf(oxlint, file)
  return [...eslintFindings, ...oxlintFindings]
    .filter(({ rule }) => names.has(rule))
    .map(describeFinding)
    .toSorted()
}

async function pairFindingsWith(configs: BuildConfigs): Promise<string[]> {
  return findingsOfIn(configs, SOURCE_FILE, pairNames())
}

function oxlintFindingsOf(config: OxlintConfig, file: string): ReturnType<typeof oxlintFindingsIn> {
  writeOxlintConfigFile(PROJECT_DIR, OXLINT_CONFIG_FILE, config)
  return oxlintFindingsIn(runOxlintCli(PROJECT_DIR, OXLINT_CONFIG_FILE, [file]).report)
}

type Rulesets = Parameters<typeof buildLintRules>[0]

function agentBuild(rulesets: Rulesets, rules: Readonly<Record<string, 'error'>> = {}): BuildConfigs {
  const lintRules = { ...buildLintRules(rulesets, { rules }), tsconfigRootDir: PROJECT_DIR }
  return {
    oxlint: buildOxlintConfig(lintRules, catalog),
    eslint: buildEslintConfig(lintRules, catalog, eslintPluginRegistry, buildProjectFacts()),
  }
}

function editorMerge(rulesets: Rulesets, usesOxlint: boolean, teamEslintConfig: Linter.Config[] = []): BuildConfigs {
  const { eslint, oxlint } = editorPartsOf({ ...buildTwoSetLintRules({ editorRulesets: rulesets }), tsconfigRootDir: PROJECT_DIR }, catalog, usesOxlint)
  const setByTheTeamsEslintConfig = ruleIdsTheTeamsEslintConfigSets(defineConfig(teamEslintConfig), eslintPluginRegistry, catalog)
  return {
    oxlint: oxlint === undefined ? null : mergeOxlintPart(EMPTY_TEAM_OXLINT_CONFIG, oxlint, catalog, setByTheTeamsEslintConfig),
    eslint: mergeEslintPart(teamEslintConfig, eslint, catalog, eslintPluginRegistry, lintRulesPackageVersion(), NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG),
  }
}

const COVEREDS_FINDING_BY_OXLINT = `${SOURCE_FILE}:1 eslint(${covered})`
const COVEREDS_FINDING_BY_ESLINT = `${SOURCE_FILE}:1 ${covered}`

/** A build as a test names it, and its configs for the rulesets listed. */
type Build = { readonly build: string; readonly configsFor: (rulesets: Rulesets) => BuildConfigs }

const AGENT_BUILD: Build = { build: 'the agent build', configsFor: agentBuild }
const EDITOR_MERGES_LISTING_OXLINT: Build = { build: 'the editor merges, in a project listing oxlint', configsFor: (rulesets) => editorMerge(rulesets, true) }
const ESLINT_MERGE_LISTING_NO_OXLINT: Build = { build: 'the ESLint merge, in a project listing no oxlint', configsFor: (rulesets) => editorMerge(rulesets, false) }

const BUILDS = [
  { ...AGENT_BUILD, coveredsFinding: COVEREDS_FINDING_BY_OXLINT },
  { ...EDITOR_MERGES_LISTING_OXLINT, coveredsFinding: COVEREDS_FINDING_BY_OXLINT },
  { ...ESLINT_MERGE_LISTING_NO_OXLINT, coveredsFinding: COVEREDS_FINDING_BY_ESLINT },
]

describe("prefer-const, covered by functional/no-let, on a let never reassigned", () => {
  it.each(BUILDS)("draws the cover's report alone where both rulesets are listed, in $build", async ({ configsFor }) => {
    expect(await pairFindingsWith(configsFor(BOTH_RULESETS))).toStrictEqual([coversFinding()])
  })

  it.each(BUILDS)("draws its own report where the cover's ruleset is not listed, in $build", async ({ configsFor, coveredsFinding }) => {
    expect(await pairFindingsWith(configsFor(COVERED_RULESET_ALONE))).toStrictEqual([coveredsFinding])
  })

  it.each([
    { project: 'listing oxlint', usesOxlint: true },
    { project: 'listing no oxlint', usesOxlint: false },
  ])('draws no report of ours where the team sets the cover, both rulesets listed, in the editor merges of a project $project', async ({ usesOxlint }) => {
    expect(await pairFindingsWith(editorMerge(BOTH_RULESETS, usesOxlint, teamEslintConfigSettingTheCover()))).toStrictEqual([])
  })
})

const NESTED_ASSIGNMENT = 'sonarjs/no-nested-assignment'
const CONDITION_ASSIGNMENT_NAMES: ReadonlySet<string> = new Set(['no-cond-assign', 'eslint(no-cond-assign)', NESTED_ASSIGNMENT])
const CONDITION_ASSIGNMENT_BUILDS = [
  { ...AGENT_BUILD, coveredsName: 'eslint(no-cond-assign)' },
  { ...EDITOR_MERGES_LISTING_OXLINT, coveredsName: 'eslint(no-cond-assign)' },
  { ...ESLINT_MERGE_LISTING_NO_OXLINT, coveredsName: 'no-cond-assign' },
]

describe('no-cond-assign, covered by sonarjs/no-nested-assignment, on an assignment in an if', () => {
  it.each(CONDITION_ASSIGNMENT_BUILDS)("draws sonarjs's report alone where complexity is listed, in $build", async ({ configsFor }) => {
    expect(await findingsOfIn(configsFor({ quality: ['correctness', 'complexity'] }), ASSIGNMENT_FILE, CONDITION_ASSIGNMENT_NAMES)).toStrictEqual([`${ASSIGNMENT_FILE}:3 ${NESTED_ASSIGNMENT}`])
  })

  it.each(CONDITION_ASSIGNMENT_BUILDS)('draws its own report where complexity is not listed, in $build', async ({ configsFor, coveredsName }) => {
    expect(await findingsOfIn(configsFor({ quality: ['correctness'] }), ASSIGNMENT_FILE, CONDITION_ASSIGNMENT_NAMES)).toStrictEqual([`${ASSIGNMENT_FILE}:3 ${coveredsName}`])
  })
})

/** The rulesets of a run with the cover's ruleset listed, and of one without it. */
type CoverRulesets = { readonly withTheCover: Rulesets; readonly withoutTheCover: Rulesets }

/** One build's findings in a file, with the cover's ruleset listed and without it. */
type CoverRun = RunOfAKind & { readonly withTheCover: readonly string[]; readonly withoutTheCover: readonly string[] }

type CoverRunsSetUp = {
  readonly builds: readonly Build[]
  readonly rulesets: CoverRulesets
  readonly file: string
  readonly names: ReadonlySet<string>
}

/** Made before the suite, so an it.fails beside them fails only on its assertion. Registers hooks: call it in a describe block. */
function setUpCoverRuns(setUp: CoverRunsSetUp): () => CoverRun[] {
  const runs = setUpRunsBeforeTheSuite(() => Promise.all(setUp.builds.map((build) => coverRunIn(build, setUp))))
  // A run that failed throws here, before the tests.
  beforeAll(() => {
    runs()
  })
  return runs
}

async function coverRunIn({ build, configsFor }: Build, { rulesets, file, names }: CoverRunsSetUp): Promise<CoverRun> {
  return {
    kind: build,
    withTheCover: await findingsOfIn(configsFor(rulesets.withTheCover), file, names),
    withoutTheCover: await findingsOfIn(configsFor(rulesets.withoutTheCover), file, names),
  }
}

const WITH_AND_WITHOUT_COMPLEXITY: CoverRulesets = { withTheCover: { quality: ['correctness', 'complexity'] }, withoutTheCover: { quality: ['correctness'] } }

function loopConditionFindingsOf(rule: string): string[] {
  return [`${LOOP_CONDITIONS_FILE}:3 ${rule}`, `${LOOP_CONDITIONS_FILE}:8 ${rule}`]
}

// sonarjs's rule skips an assignment in a while or do-while condition on purpose.
describe('no-cond-assign, covered by sonarjs/no-nested-assignment, on an assignment in a while and in a do-while condition', () => {
  const runs = setUpCoverRuns({ builds: CONDITION_ASSIGNMENT_BUILDS, rulesets: WITH_AND_WITHOUT_COMPLEXITY, file: LOOP_CONDITIONS_FILE, names: CONDITION_ASSIGNMENT_NAMES })

  it.each(CONDITION_ASSIGNMENT_BUILDS)('draws its own report on each where complexity is not listed, in $build', ({ build, coveredsName }) => {
    expect(runMadeFor(runs(), build).withoutTheCover).toStrictEqual(loopConditionFindingsOf(coveredsName))
  })

  // KNOWN GAP: where complexity is listed nothing reports either; the owner's card my-cond-assign-loops decides.
  it.fails.each(CONDITION_ASSIGNMENT_BUILDS)('draws a report on each where complexity is listed, in $build', ({ build, coveredsName }) => {
    expect(runMadeFor(runs(), build).withTheCover).toStrictEqual(loopConditionFindingsOf(coveredsName))
  })
})

// ESLint runs both rules of each pair below, in every build.
const EVERY_BUILD: readonly Build[] = [AGENT_BUILD, EDITOR_MERGES_LISTING_OXLINT, ESLINT_MERGE_LISTING_NO_OXLINT]
const RETURN_ASSIGNMENT = 'no-return-assign'
const RETURN_ASSIGNMENT_NAMES: ReadonlySet<string> = new Set([RETURN_ASSIGNMENT, NESTED_ASSIGNMENT])

describe('no-return-assign, covered by sonarjs/no-nested-assignment, on an assignment a return statement returns', () => {
  it.each(EVERY_BUILD)("draws sonarjs's report alone where complexity is listed, in $build", async ({ configsFor }) => {
    expect(await findingsOfIn(configsFor(WITH_AND_WITHOUT_COMPLEXITY.withTheCover), RETURN_FILE, RETURN_ASSIGNMENT_NAMES)).toStrictEqual([`${RETURN_FILE}:3 ${NESTED_ASSIGNMENT}`])
  })

  it.each(EVERY_BUILD)('draws its own report where complexity is not listed, in $build', async ({ configsFor }) => {
    expect(await findingsOfIn(configsFor(WITH_AND_WITHOUT_COMPLEXITY.withoutTheCover), RETURN_FILE, RETURN_ASSIGNMENT_NAMES)).toStrictEqual([`${RETURN_FILE}:3 ${RETURN_ASSIGNMENT}`])
  })
})

// sonarjs's rule skips an assignment that is an arrow function's body or part of a sequence, on purpose.
describe('no-return-assign, covered by sonarjs/no-nested-assignment, on an assignment an arrow function returns and one ending a returned sequence', () => {
  const runs = setUpCoverRuns({ builds: EVERY_BUILD, rulesets: WITH_AND_WITHOUT_COMPLEXITY, file: ARROW_AND_SEQUENCE_FILE, names: RETURN_ASSIGNMENT_NAMES })
  const itsOwnReports = [`${ARROW_AND_SEQUENCE_FILE}:2 ${RETURN_ASSIGNMENT}`, `${ARROW_AND_SEQUENCE_FILE}:5 ${RETURN_ASSIGNMENT}`]

  it.each(EVERY_BUILD)('draws its own report on each where complexity is not listed, in $build', ({ build }) => {
    expect(runMadeFor(runs(), build).withoutTheCover).toStrictEqual(itsOwnReports)
  })

  // KNOWN GAP: where complexity is listed nothing reports either; the owner's card my-return-assign-arrows decides.
  it.fails.each(EVERY_BUILD)('draws a report on each where complexity is listed, in $build', ({ build }) => {
    expect(runMadeFor(runs(), build).withTheCover).toStrictEqual(itsOwnReports)
  })
})

const DEBUGGING_UTILS = 'testing-library/no-debugging-utils'
const DEBUG_COMMANDS = 'sonarjs/no-debug-commands-in-ui-tests'
const DEBUG_NAMES: ReadonlySet<string> = new Set([DEBUGGING_UTILS, DEBUG_COMMANDS])
const WITH_AND_WITHOUT_TESTS: CoverRulesets = { withTheCover: { quality: ['tests'], libs: { testing: ['testing-library'] } }, withoutTheCover: { libs: { testing: ['testing-library'] } } }

describe('testing-library/no-debugging-utils, covered by sonarjs/no-debug-commands-in-ui-tests, on screen.debug() in a test', () => {
  const runs = setUpCoverRuns({ builds: EVERY_BUILD, rulesets: WITH_AND_WITHOUT_TESTS, file: TEST_FILE, names: DEBUG_NAMES })

  it.each(EVERY_BUILD)("draws sonarjs's report alone where tests is listed, in $build", ({ build }) => {
    expect(runMadeFor(runs(), build).withTheCover).toStrictEqual([`${TEST_FILE}:5 ${DEBUG_COMMANDS}`])
  })

  it.each(EVERY_BUILD)('draws its own report where tests is not listed, in $build', ({ build }) => {
    expect(runMadeFor(runs(), build).withoutTheCover).toStrictEqual([`${TEST_FILE}:5 ${DEBUGGING_UTILS}`])
  })
})

// sonarjs's rule does nothing in a file not named as a test, which a story and a Vitest type test are not.
describe.each([
  { file: STORY_FILE, debugLine: 7 },
  { file: TYPE_TEST_FILE, debugLine: 5 },
])('testing-library/no-debugging-utils, covered by sonarjs/no-debug-commands-in-ui-tests, on screen.debug() in $file', ({ file, debugLine }) => {
  const runs = setUpCoverRuns({ builds: EVERY_BUILD, rulesets: WITH_AND_WITHOUT_TESTS, file, names: DEBUG_NAMES })
  const itsOwnReport = [`${file}:${debugLine} ${DEBUGGING_UTILS}`]

  it.each(EVERY_BUILD)('draws its own report where tests is not listed, in $build', ({ build }) => {
    expect(runMadeFor(runs(), build).withoutTheCover).toStrictEqual(itsOwnReport)
  })

  // KNOWN GAP: where tests is listed nothing reports it; the owner's card my-debugging-utils-stories decides.
  it.fails.each(EVERY_BUILD)('draws a report where tests is listed, in $build', ({ build }) => {
    expect(runMadeFor(runs(), build).withTheCover).toStrictEqual(itsOwnReport)
  })
})

const MAP_SPREAD = 'oxc(no-map-spread)'
const MAP_SPREAD_NAMES: ReadonlySet<string> = new Set([MAP_SPREAD, 'functional/immutable-data'])
// Only oxlint has the rule, and no ESLint rule stands in for it.
const BUILDS_RUNNING_OXLINT: readonly Build[] = [AGENT_BUILD, EDITOR_MERGES_LISTING_OXLINT]

// Its suggested fix, Object.assign(item, …), is the mutation immutable-data reports.
describe('oxc/no-map-spread, covered by functional/immutable-data, on a spread copying each item of a map', () => {
  it.each(BUILDS_RUNNING_OXLINT)('draws no report where declarative is listed, in $build', async ({ configsFor }) => {
    expect(await findingsOfIn(configsFor({ quality: ['performance', 'declarative'] }), MAP_SPREAD_FILE, MAP_SPREAD_NAMES)).toStrictEqual([])
  })

  it.each(BUILDS_RUNNING_OXLINT)("draws oxc's report where declarative is not listed, in $build", async ({ configsFor }) => {
    expect(await findingsOfIn(configsFor({ quality: ['performance'] }), MAP_SPREAD_FILE, MAP_SPREAD_NAMES)).toStrictEqual([`${MAP_SPREAD_FILE}:2 ${MAP_SPREAD}`])
  })
})

const GLOBAL_ASSIGN = 'eslint(no-global-assign)'
const IMPLICIT_GLOBALS = 'eslint(no-implicit-globals)'
const GLOBAL_WRITE_NAMES: ReadonlySet<string> = new Set([GLOBAL_ASSIGN, IMPLICIT_GLOBALS])
const IN_THE_BROWSER = { quality: ['correctness'], runtimes: ['browser'] }

describe('a write to a read-only global, which no-implicit-globals reported beside no-global-assign, in the agent build', () => {
  it('draws no-global-assign alone', async () => {
    expect(await findingsOfIn(agentBuild(IN_THE_BROWSER), GLOBAL_FILE, GLOBAL_WRITE_NAMES)).toStrictEqual([`${GLOBAL_FILE}:1 ${GLOBAL_ASSIGN}`])
  })

  it('draws no-implicit-globals too where the team turns it on by ID', async () => {
    expect(await findingsOfIn(agentBuild(IN_THE_BROWSER, { 'no-implicit-globals': 'error' }), GLOBAL_FILE, GLOBAL_WRITE_NAMES)).toStrictEqual([
      `${GLOBAL_FILE}:1 ${GLOBAL_ASSIGN}`,
      `${GLOBAL_FILE}:1 ${IMPLICIT_GLOBALS}`,
    ])
  })
})
