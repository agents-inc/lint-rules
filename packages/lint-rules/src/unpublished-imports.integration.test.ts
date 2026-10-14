import { describe, expect, it } from 'vitest'
import { setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import type { OurRulesets } from './__tests__/cases/both-engines-corpus.ts'
import {
  aliasedFilesOfEachExtension,
  BOTH_MODULE,
  EVERY_EXTENSION_MODULE,
  NO_UNPUBLISHED_IMPORT,
  OWED_IN_THE_STORY,
  OWED_THROUGH_THE_ALIAS,
  STORY_FILE,
  workspacePackageFiles,
} from './__tests__/cases/workspace-package-imports.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { agentsIncLintModuleTextRootedAtItsFolder, emptyTeamEslintModuleText, mergedEslintConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, TEAM_OXLINT_CONFIG_SETTING_NO_RULE, teamOxlintConfigSettingNoRuleFiles } from './__tests__/team-configs-of-the-other-engine.ts'

// n/no-unpublished-import reads a path a project's tsconfig maps (`@/…`) as the file it names, not
// as a package (decisions.md, 2026-10-14 "real run 3, scale lane"). Real run 3, case R-ALL-6: in
// turborepo-monorepo's packages/ui, ESLint run from the monorepo's root reported every story's
// `@/internal/story/story` as unpublished, a file the package publishes. Beside it, what the package
// does not publish stays reported: a package it lists in devDependencies alone, and a file outside
// its `files`, through an alias and a relative path. ESLint runs the rule in every build; it runs
// here in another folder than the package's, as from a monorepo's root.

allowEveryTestForParallelLoad()

// The ruleset that ships n/no-unpublished-import, in both sets.
const MODULES: OurRulesets = { agentRulesets: { quality: ['modules'] }, editorRulesets: { quality: ['modules'] } }
const LINT_RULES_MODULE = 'agents-inc.lint.mts'
const EMPTY_TEAM_ESLINT_MODULE = 'empty-team.eslint.mjs'

describe("imports in a monorepo package's story, through its tsconfig's alias to what it publishes and to what it does not, our modules ruleset on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: workspacePackageFiles,
    ourRulesets: MODULES,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })

  it('are linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it('are reported unpublished by the agent build where they name what the package does not publish, and not through the alias to src', () => {
    expect(findingsByFileAndRule(runs().agent, [STORY_FILE], [NO_UNPUBLISHED_IMPORT])).toStrictEqual(OWED_IN_THE_STORY)
  })

  it('are reported unpublished merged into empty team configs where they name what the package does not publish, and not through the alias to src', () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, [STORY_FILE], [NO_UNPUBLISHED_IMPORT])).toStrictEqual(OWED_IN_THE_STORY)
  })
})

describe("imports in a monorepo package's story, through its tsconfig's alias to what it publishes and to what it does not, our modules ruleset on, in a project whose package.json lists no oxlint, linted by the ESLint CLI from the monorepo's root through the built package", () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    [LINT_RULES_MODULE]: agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings(MODULES)),
    'eslint.config.mjs': mergedEslintConfigText(LINT_RULES_MODULE, EMPTY_TEAM_ESLINT_MODULE, TEAM_OXLINT_CONFIG_SETTING_NO_RULE),
    ...teamOxlintConfigSettingNoRuleFiles,
    [EMPTY_TEAM_ESLINT_MODULE]: emptyTeamEslintModuleText(),
    ...workspacePackageFiles,
  })

  it('are linted with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it('are reported unpublished where they name what the package does not publish, and not through the alias to src', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), [STORY_FILE], [NO_UNPUBLISHED_IMPORT])).toStrictEqual(OWED_IN_THE_STORY)
  })
})

// eslint-plugin-n finds the file behind an alias by trying each extension in turn: every extension we
// lint first, then .json and .node (eslint-settings.ts). With one of ours missing, an import of a
// published file of that extension is reported; with .json missing, one of a JSON file; with .json
// tried before .ts, `@/both` resolves to the published both.json rather than to both.ts, which
// TypeScript resolves it to, and an unpublished import goes unreported.
describe("imports through a monorepo package's tsconfig alias to a published file of each extension we lint and to a JSON file, and to a name both a published JSON file and an unpublished TS file hold, our modules ruleset on, in a project whose package.json lists oxlint", () => {
  const runs = setUpBothEnginesRuns({
    sources: aliasedFilesOfEachExtension,
    ourRulesets: MODULES,
    ours: {},
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
  const files = [EVERY_EXTENSION_MODULE, BOTH_MODULE]

  it('are linted by every ESLint run with no fatal message', () => {
    expect(runs().eslintFatalMessages).toStrictEqual([])
  })

  it('are reported unpublished by the agent build only where the name resolves, as TypeScript resolves it, to the TS file the package does not publish', () => {
    expect(findingsByFileAndRule(runs().agent, files, [NO_UNPUBLISHED_IMPORT])).toStrictEqual(OWED_THROUGH_THE_ALIAS)
  })

  it('are reported unpublished merged into empty team configs only where the name resolves, as TypeScript resolves it, to the TS file the package does not publish', () => {
    expect(findingsByFileAndRule(runs().mergedIntoEmptyTeamConfigs, files, [NO_UNPUBLISHED_IMPORT])).toStrictEqual(OWED_THROUGH_THE_ALIAS)
  })
})
