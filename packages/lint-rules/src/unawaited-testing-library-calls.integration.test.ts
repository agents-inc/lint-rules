import { catalog } from '@workspace/rule-data'
import { ESLint, type Linter } from 'eslint'
import testingLibraryPlugin from 'eslint-plugin-testing-library'
import { describe, expect, it } from 'vitest'
import { buildAgentConfigs } from './agent-configs.ts'
import { describeFinding, eslintFindingsIn } from './__tests__/engine-clis.ts'
import { moduleText } from './__tests__/factories/check-factories.ts'
import { buildFileOverride, buildLintRules, buildTwoSetFileOverride, buildTwoSetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, lintRulesPackageVersion, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { stubPackageFiles, stubPackageNamed } from './__tests__/factories/stub-package-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { buildBundlerTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { type RunOfAKind, runMadeFor, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import type { TempProjects } from './__tests__/temp-projects.ts'
import { editorPartsOf } from './core/editor-parts.ts'
import type { RuleSettingsInput } from './core/lint-rules-input.ts'
import { mergeEslintPart } from './core/merge-eslint-config.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

// An unawaited Testing Library call is reported once, whichever rulesets are listed: by the testing-library rule
// that reports it where that rule runs (its ruleset or the top-level rules turn it on, in its files), and by
// no-floating-promises everywhere else, through the real ESLint in each build. Every rule involved is ESLint's,
// so oxlint is not run. The packages are rule-data's stubs, shaped as the real ones, so the typed rule sees each
// call's declaration; the file's own unawaited promise is reported in every run, so a build that runs no typed
// rule cannot pass.

const FLOATING_PROMISES = '@typescript-eslint/no-floating-promises'
const AWAIT_ASYNC_UTILS = 'testing-library/await-async-utils'
const AWAIT_ASYNC_QUERIES = 'testing-library/await-async-queries'
const AWAIT_ASYNC_EVENTS = 'testing-library/await-async-events'
const NAMES: ReadonlySet<string> = new Set([FLOATING_PROMISES, AWAIT_ASYNC_UTILS, AWAIT_ASYNC_QUERIES, AWAIT_ASYNC_EVENTS])
const SRC_TEST_FILE = 'src/button.test.ts'
const STORY_FILE = 'src/button.stories.ts'
// Neither a test nor a story file, so no testing-library rule runs in it.
const HELPER_FILE = 'src/render-helpers.ts'
const LEGACY_TEST_FILE = 'legacy/button.test.ts'
const FILES = [SRC_TEST_FILE, STORY_FILE, HELPER_FILE, LEGACY_TEST_FILE]
const TEST_FILES: ReadonlySet<string> = new Set([SRC_TEST_FILE, LEGACY_TEST_FILE])
const LEGACY_FILES = 'legacy/**'
const UNAWAITED_CALLS = moduleText(
  "import { screen, waitFor } from '@testing-library/dom'",
  "import userEvent from '@testing-library/user-event'",
  '',
  'async function save(): Promise<void> {}',
  '',
  'export function act(element: Element): void {',
  '  waitFor(() => 1)',
  "  screen.findByText('save')",
  '  userEvent.click(element)',
  '  const user = userEvent.setup()',
  '  user.click(element)',
  '  save()',
  '}',
)

/** A call in UNAWAITED_CALLS, and the testing-library rule that reports it where that rule runs. */
type UnawaitedCall = { readonly line: number; readonly reportedBy: string }

// One for each allowForKnownSafeCalls entry no-floating-promises leaves to a testing-library rule.
const UNAWAITED_TESTING_LIBRARY_CALLS: readonly UnawaitedCall[] = [
  { line: 7, reportedBy: AWAIT_ASYNC_UTILS },
  { line: 8, reportedBy: AWAIT_ASYNC_QUERIES },
  // user-event's own method, then a session's, which is typed anonymously.
  { line: 9, reportedBy: AWAIT_ASYNC_EVENTS },
  { line: 11, reportedBy: AWAIT_ASYNC_EVENTS },
]
const OWN_UNAWAITED_PROMISE_LINE = 12

const CORRECTNESS_ALONE = { quality: ['correctness'] }
const WITH_TESTING_LIBRARY = { quality: ['correctness'], libs: { testing: ['testing-library'] } }
const DROPPING_TESTING_LIBRARY = { libs: { testing: [] } }
const ADDING_TESTING_LIBRARY = { libs: { testing: ['testing-library'] } }
// As the testing-library rules ship: await-async-events skips story files, which the other two lint.
const SHIPPED_RULES_OF_A_TEST_FILE = [AWAIT_ASYNC_UTILS, AWAIT_ASYNC_QUERIES, AWAIT_ASYNC_EVENTS]
const SHIPPED_RULES_OF_A_STORY_FILE = [AWAIT_ASYNC_UTILS, AWAIT_ASYNC_QUERIES]
const NO_RULE: readonly string[] = []
// The team turns await-async-events off, with the plugin a team installs: it is the team's, in every file.
const TEAM_ESLINT_CONFIG_TURNING_AWAIT_ASYNC_EVENTS_OFF: readonly Linter.Config[] = [
  buildTeamEslintBlock('team/testing-library', { plugins: { 'testing-library': testingLibraryPlugin }, rules: { [AWAIT_ASYNC_EVENTS]: 'off' } }),
]
const NO_TEAM_ESLINT_CONFIG: readonly Linter.Config[] = []

type Rulesets = Parameters<typeof buildLintRules>[0]

/** What a run lists and states: at the top level, and the rulesets of an entry for legacy/**, where it gives one. */
type Listed = { readonly rulesets: Rulesets; readonly rules: RuleSettingsInput; readonly legacyEntry: Rulesets | null }

/** A build as a test names it, and its ESLint config for what is listed. */
type Build = { readonly build: string; readonly eslintConfigFor: (projectDir: string, listed: Listed) => Linter.Config[] }

/** The testing-library rules running in each file, by file. */
type RulesRunning = Readonly<Record<string, readonly string[]>>

type Case = { readonly lists: string; readonly listed: Listed; readonly rulesRunning: RulesRunning }

type CaseRun = RunOfAKind & { readonly findings: readonly string[] }

type FindingsRun = RunOfAKind & { readonly byCase: readonly CaseRun[] }

function agentBuild(projectDir: string, { rulesets, rules, legacyEntry }: Listed): Linter.Config[] {
  const fileOverrides = legacyEntry === null ? [] : [buildFileOverride([LEGACY_FILES], { rulesets: legacyEntry })]
  return buildAgentConfigs({ ...buildLintRules(rulesets, { rules, fileOverrides }), tsconfigRootDir: projectDir }).eslint
}

function editorMerge(projectDir: string, { rulesets, rules, legacyEntry }: Listed, usesOxlint: boolean, teamEslintConfig: readonly Linter.Config[]): Linter.Config[] {
  const fileOverrides = legacyEntry === null ? [] : [buildTwoSetFileOverride([LEGACY_FILES], { editorRulesets: legacyEntry })]
  const { eslint } = editorPartsOf({ ...buildTwoSetLintRules({ editorRulesets: rulesets }, { rules, fileOverrides }), tsconfigRootDir: projectDir }, catalog, usesOxlint)
  return mergeEslintPart([...teamEslintConfig], eslint, catalog, eslintPluginRegistry, lintRulesPackageVersion(), NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG)
}

const BUILDS: readonly Build[] = [
  { build: 'the agent build', eslintConfigFor: agentBuild },
  {
    build: 'the editor ESLint merge, in a project listing oxlint',
    eslintConfigFor(projectDir, listed) {
      return editorMerge(projectDir, listed, true, NO_TEAM_ESLINT_CONFIG)
    },
  },
  {
    build: 'the ESLint merge, in a project listing no oxlint',
    eslintConfigFor(projectDir, listed) {
      return editorMerge(projectDir, listed, false, NO_TEAM_ESLINT_CONFIG)
    },
  },
]
const EDITOR_PROJECTS = [
  { project: 'listing oxlint', usesOxlint: true },
  { project: 'listing no oxlint', usesOxlint: false },
]

function listing(rulesets: Rulesets, fields: Partial<Omit<Listed, 'rulesets'>> = {}): Listed {
  return { rulesets, rules: {}, legacyEntry: null, ...fields }
}

/** The rules each file of the project runs where the ruleset's rules run as shipped, the given files running none. */
function shippedRulesRunning(filesRunningNone: readonly string[] = []): RulesRunning {
  return {
    [SRC_TEST_FILE]: SHIPPED_RULES_OF_A_TEST_FILE,
    [STORY_FILE]: SHIPPED_RULES_OF_A_STORY_FILE,
    [HELPER_FILE]: NO_RULE,
    [LEGACY_TEST_FILE]: SHIPPED_RULES_OF_A_TEST_FILE,
    ...Object.fromEntries(filesRunningNone.map((file) => [file, NO_RULE])),
  }
}

function noRuleRunning(): RulesRunning {
  return Object.fromEntries(FILES.map((file) => [file, NO_RULE]))
}

function shippedRulesRunningBut(ruleTurnedOff: string): RulesRunning {
  return Object.fromEntries(Object.entries(shippedRulesRunning()).map(([file, rules]) => [file, rules.filter((rule) => rule !== ruleTurnedOff)]))
}

const CASES: readonly Case[] = [
  { lists: 'correctness alone', listed: listing(CORRECTNESS_ALONE), rulesRunning: noRuleRunning() },
  { lists: 'testing-library', listed: listing(WITH_TESTING_LIBRARY), rulesRunning: shippedRulesRunning() },
  {
    lists: 'testing-library, an entry for legacy/** dropping it',
    listed: listing(WITH_TESTING_LIBRARY, { legacyEntry: DROPPING_TESTING_LIBRARY }),
    rulesRunning: shippedRulesRunning([LEGACY_TEST_FILE]),
  },
  {
    lists: 'correctness alone, an entry for legacy/** adding testing-library',
    listed: listing(CORRECTNESS_ALONE, { legacyEntry: ADDING_TESTING_LIBRARY }),
    rulesRunning: { ...noRuleRunning(), [LEGACY_TEST_FILE]: SHIPPED_RULES_OF_A_TEST_FILE },
  },
  {
    lists: 'testing-library, the top-level rules turning await-async-utils off',
    listed: listing(WITH_TESTING_LIBRARY, { rules: { [AWAIT_ASYNC_UTILS]: 'off' } }),
    rulesRunning: shippedRulesRunningBut(AWAIT_ASYNC_UTILS),
  },
  {
    lists: 'correctness alone, the top-level rules turning await-async-events on at warn',
    listed: listing(CORRECTNESS_ALONE, { rules: { [AWAIT_ASYNC_EVENTS]: 'warn' } }),
    rulesRunning: { ...noRuleRunning(), [SRC_TEST_FILE]: [AWAIT_ASYNC_EVENTS], [LEGACY_TEST_FILE]: [AWAIT_ASYNC_EVENTS] },
  },
]

/** A typed project: its tsconfig takes in every file, and the Testing Library packages resolve to rule-data's stubs. */
function typedProjectWithUnawaitedCalls(tempProjects: TempProjects): string {
  return tempProjects.create({
    files: {
      'package.json': packageJsonText(buildPackageJsonListingOthers()),
      'tsconfig.json': `${JSON.stringify(buildBundlerTsconfig({}, ['src', 'legacy']))}\n`,
      ...Object.fromEntries(FILES.map((file) => [file, UNAWAITED_CALLS])),
      ...stubPackageFiles([stubPackageNamed('@testing-library/dom'), stubPackageNamed('@testing-library/user-event')]),
    },
  })
}

/** Each finding of the four rules, as `file:line rule`, sorted. */
async function findingsIn(projectDir: string, eslintConfig: readonly Linter.Config[]): Promise<string[]> {
  const results = await new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: [...eslintConfig] }).lintFiles(['.'])
  return eslintFindingsIn(results, projectDir)
    .filter(({ rule }) => NAMES.has(rule))
    .map(describeFinding)
    .toSorted()
}

async function findingsRunIn(projectDir: string, { build, eslintConfigFor }: Build): Promise<FindingsRun> {
  return {
    kind: build,
    byCase: await Promise.all(CASES.map(async ({ lists, listed }) => ({ kind: lists, findings: await findingsIn(projectDir, eslintConfigFor(projectDir, listed)) }))),
  }
}

/** Each call reported by its rule where that rule runs in the file, else by no-floating-promises, and each file's own unawaited promise. */
function findingsOwed(rulesRunning: RulesRunning, reportsNothing: (file: string, call: UnawaitedCall) => boolean = () => false): string[] {
  return FILES.flatMap((file) => [
    ...UNAWAITED_TESTING_LIBRARY_CALLS.filter((call) => !reportsNothing(file, call)).map(
      (call) => `${file}:${String(call.line)} ${rulesRunningIn(rulesRunning, file).includes(call.reportedBy) ? call.reportedBy : FLOATING_PROMISES}`,
    ),
    `${file}:${String(OWN_UNAWAITED_PROMISE_LINE)} ${FLOATING_PROMISES}`,
  ]).toSorted()
}

/** Where the team's config turns await-async-events off: a user-event call in a test file, where our copy would run. */
function isLeftToTheTeam(file: string, { reportedBy }: UnawaitedCall): boolean {
  return reportedBy === AWAIT_ASYNC_EVENTS && TEST_FILES.has(file)
}

function rulesRunningIn(rulesRunning: RulesRunning, file: string): readonly string[] {
  const rules = rulesRunning[file]
  if (rules === undefined) throw new Error(`the case states no rules running in ${file}`)
  return rules
}

describe('an unawaited Testing Library call, in files a tsconfig takes in', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const projectDir = typedProjectWithUnawaitedCalls(tempProjects)
    return {
      byBuild: await Promise.all(BUILDS.map((build) => findingsRunIn(projectDir, build))),
      teamTurningAwaitAsyncEventsOff: await Promise.all(
        EDITOR_PROJECTS.map(async ({ project, usesOxlint }) => ({
          kind: project,
          findings: await findingsIn(projectDir, editorMerge(projectDir, listing(WITH_TESTING_LIBRARY), usesOxlint, TEAM_ESLINT_CONFIG_TURNING_AWAIT_ASYNC_EVENTS_OFF)),
        })),
      ),
    }
  })

  describe.each(BUILDS)('in $build', ({ build }) => {
    it.each(CASES)('is reported once, by the testing-library rule where it runs and by no-floating-promises elsewhere, listing $lists', ({ lists, rulesRunning }) => {
      expect(runMadeFor(runMadeFor(runs().byBuild, build).byCase, lists).findings).toStrictEqual(findingsOwed(rulesRunning))
    })
  })

  // The team's setting decides await-async-events, as it decides a cover: the entries are ours, kept where our
  // rule would run, so in test files nothing reports a user-event call, and elsewhere no-floating-promises does.
  it.each(EDITOR_PROJECTS)("is reported by neither in test files where the team's ESLint config turns await-async-events off, in the editor merges of a project $project", ({ project }) => {
    expect(runMadeFor(runs().teamTurningAwaitAsyncEventsOff, project).findings).toStrictEqual(findingsOwed(shippedRulesRunningBut(AWAIT_ASYNC_EVENTS), isLeftToTheTeam))
  })
})
