import { beforeAll, describe, expect, it } from 'vitest'
import { type BothEnginesRuns, setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import type { OurRulesets } from './__tests__/cases/both-engines-corpus.ts'
import { NO_UNDEF } from './__tests__/cases/svelte-components.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, eslintLintedFilesOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { agentsIncLintModuleTextRootedAtItsFolder, emptyTeamEslintModuleText, mergedEslintConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, TEAM_OXLINT_CONFIG_SETTING_NO_RULE, teamOxlintConfigSettingNoRuleFiles } from './__tests__/team-configs-of-the-other-engine.ts'

// q76 (spec-core.md C10): Vitest's and Jest's globals, read-only, in test files, whatever rulesets
// are listed, as the framework globals are given (call 5): oxlint's `vitest` and `jest` envs, and
// the `globals` package's in a block of ESLint's that names JS and TS files alone. The test files
// are the shapes the shipped test-file ignores use: `*.test.*` and `*.spec.*`, and any file under
// `__tests__`. Beside oxlint, oxlint runs no-undef in JS files, in the agent build and the editor
// merges; without it, ESLint does.

allowEveryTestForParallelLoad()

// The ruleset that ships no-undef, in both sets: no testing ruleset is listed.
const CORRECTNESS: OurRulesets = { agentRulesets: { quality: ['correctness'] }, editorRulesets: { quality: ['correctness'] } }
const RULES = [NO_UNDEF]
const LINT_RULES_MODULE = 'agents-inc.lint.mts'
const EMPTY_TEAM_ESLINT_MODULE = 'empty-team.eslint.mjs'

// Each test runner's globals, one to a line: describe (1), it (2), vi (3), jest (4), expect (5).
const TEST_SOURCE = `describe('sum', () => {
  it('adds', () => {
    const spy = vi.fn()
    const mock = jest.fn()
    expect([spy, mock]).toHaveLength(2)
  })
})
`

const FILES = {
  testFile: 'src/sum.test.js',
  specFile: 'src/sum.spec.mjs',
  underTestsFolder: 'src/__tests__/sum.js',
  notATest: 'src/sum.js',
  testJson: 'src/sum.test.json',
} as const

const sources = {
  [FILES.testFile]: TEST_SOURCE,
  [FILES.specFile]: TEST_SOURCE,
  [FILES.underTestsFolder]: TEST_SOURCE,
  [FILES.notATest]: TEST_SOURCE,
  [FILES.testJson]: '{ "cases": [] }\n',
}

/** The runner globals reported where a file is no test, by the engine's name for no-undef. */
function everyGlobalReportedIn(file: string, ruleName: string): string[] {
  return [1, 2, 3, 4, 5].map((line) => `${file}:${String(line)} ${ruleName}`)
}

function owedBy(ruleName: string): Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> {
  return {
    [FILES.testFile]: { 'no-undef': [] },
    [FILES.specFile]: { 'no-undef': [] },
    [FILES.underTestsFolder]: { 'no-undef': [] },
    [FILES.notATest]: { 'no-undef': everyGlobalReportedIn(FILES.notATest, ruleName) },
  }
}

const OWED_BY_OXLINT = owedBy('eslint(no-undef)')
const OWED_BY_ESLINT = owedBy('no-undef')
const JS_FILES = Object.keys(OWED_BY_OXLINT)

describe("a JS test file using Vitest's and Jest's globals, beside a file that is no test using them, our correctness ruleset on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({ sources, ourRulesets: CORRECTNESS, ours: {}, teamEslintRules: {}, teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG })
  // Read before the tests, so a run the engines cannot make fails the file.
  let made: BothEnginesRuns | undefined

  beforeAll(() => {
    made = runs()
  })

  function theRuns(): BothEnginesRuns {
    if (made === undefined) throw new Error('no run was made before the tests of the test files')
    return made
  }

  it("draw no no-undef in a test file, and every runner global in the file that is no test, by the agent build", () => {
    expect(findingsByFileAndRule(theRuns().agent, JS_FILES, RULES)).toStrictEqual(OWED_BY_OXLINT)
  })

  it("draw no no-undef in a test file, and every runner global in the file that is no test, merged into empty team configs", () => {
    expect(findingsByFileAndRule(theRuns().mergedIntoEmptyTeamConfigs, JS_FILES, RULES)).toStrictEqual(OWED_BY_OXLINT)
  })

  it('leave the .test.json file out of ESLint, in the agent build and merged into empty team configs', () => {
    const { eslintLintedFiles } = theRuns()

    expect({
      agent: eslintLintedFiles.agent.includes(FILES.testJson),
      mergedIntoEmptyTeamConfigs: eslintLintedFiles.mergedIntoEmptyTeamConfigs.includes(FILES.testJson),
    }).toStrictEqual({ agent: false, mergedIntoEmptyTeamConfigs: false })
  })
})

describe("a JS test file using Vitest's and Jest's globals, beside a file that is no test using them, our correctness ruleset on, in a project whose package.json lists no oxlint, linted by the ESLint CLI through the built package", () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    [LINT_RULES_MODULE]: agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings(CORRECTNESS)),
    'eslint.config.mjs': mergedEslintConfigText(LINT_RULES_MODULE, EMPTY_TEAM_ESLINT_MODULE, TEAM_OXLINT_CONFIG_SETTING_NO_RULE),
    ...teamOxlintConfigSettingNoRuleFiles,
    [EMPTY_TEAM_ESLINT_MODULE]: emptyTeamEslintModuleText(),
    ...sources,
  })

  it('are linted with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it('draw no no-undef in a test file, and every runner global in the file that is no test', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), JS_FILES, RULES)).toStrictEqual(OWED_BY_ESLINT)
  })

  it('leave the .test.json file out of ESLint', () => {
    expect(eslintLintedFilesOf(run()).includes(FILES.testJson)).toBe(false)
  })
})
