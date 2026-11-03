import { describe, expect, it } from 'vitest'
import { agentConfigsOf, oxlintPartOf } from './__tests__/agent-configs.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, createProjectListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { rulesOnInEslint, rulesOnInOxlint } from './__tests__/rules-on-engines.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { agentSettingsOf } from './agent-settings.ts'
import type { LintRulesInput } from './core/lint-rules-input.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules, type LintRules } from './index.ts'

// The internal hook `check` uses: each part's agent projection, the agent set as the core's
// `rulesets`, in each file override too.

const PROJECTS_MADE: RunsBeforeTheSuiteOptions = { timeoutMs: 10_000, whatFailed: 'the projects listing oxlint and not could not be made before the suite' }

const projects = setUpRunsBeforeTheSuite(
  (tempProjects) => ({
    withOxlint: createProjectListingOxlint(tempProjects),
    withoutOxlint: tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) } }),
  }),
  PROJECTS_MADE,
)

const AGENT_RULESETS = { quality: ['correctness'], libs: { ui: ['react'] }, runtimes: ['node'], languages: [] } satisfies LintRules['agentRulesets']
const EDITOR_RULESETS = { quality: ['naming'], libs: {}, runtimes: ['browser'], languages: [] } satisfies LintRules['editorRulesets']

function lintRules(): LintRules {
  return buildConsumerLintRules(
    projects().withOxlint,
    { agentRulesets: AGENT_RULESETS, editorRulesets: EDITOR_RULESETS },
    {
      ignores: ['dist/**'],
      allowSuppressions: true,
      rules: { 'no-debugger': 'warn' },
      fileOverrides: [
        { files: ['apps/api/**'], agentRulesets: { runtimes: ['node'] }, rules: { 'max-lines': 'off' } },
        { files: ['apps/web/**'], editorRulesets: { runtimes: ['browser'] } },
        { files: ['apps/cli/**'], agentRulesets: { quality: [] }, editorRulesets: { quality: ['naming'] }, allowSuppressions: false },
        { files: ['legacy/**'], allowSuppressions: true },
      ],
    },
  )
}

function agentSettings(): LintRulesInput {
  return {
    tsconfigRootDir: projects().withOxlint,
    rulesets: AGENT_RULESETS,
    ignores: ['dist/**'],
    allowSuppressions: true,
    rules: { 'no-debugger': 'warn' },
    fileOverrides: [
      { files: ['apps/api/**'], rulesets: { runtimes: ['node'] }, rules: { 'max-lines': 'off' } },
      { files: ['apps/web/**'] },
      { files: ['apps/cli/**'], rulesets: { quality: [] }, allowSuppressions: false },
      { files: ['legacy/**'], allowSuppressions: true },
    ],
  }
}

function hasTheRuleNoDebugger(rules: ReadonlyArray<{ readonly id: string }>): boolean {
  return rules.some(({ id }) => id === 'no-debugger')
}

describe('agentSettingsOf', () => {
  it('returns the agent settings for the ESLint part: the shared keys, and the agent set as rulesets, per entry too', () => {
    expect(agentSettingsOf(defineLintRules(lintRules()).editorRulesets.eslint)).toStrictEqual(agentSettings())
  })

  it('returns the same settings for the oxlint part of the same config', () => {
    const oxlint = oxlintPartOf(defineLintRules(lintRules()).editorRulesets)

    expect(agentSettingsOf(oxlint)).toStrictEqual(agentSettings())
  })

  it('refuses a part defineLintRules did not return, even a copy equal to one it did', () => {
    const { eslint } = defineLintRules(lintRules()).editorRulesets

    expect(() => agentSettingsOf({ ...eslint })).toThrow(/^agents-inc\.lint\.mts: /u)
  })

  it('accepts the part defineLintRules returned, beside that copy', () => {
    const { eslint } = defineLintRules(lintRules()).editorRulesets

    expect(() => agentSettingsOf(eslint)).not.toThrow()
  })
})

function sameSetsForBoth(): LintRules {
  return buildConsumerLintRules(projects().withoutOxlint, {
    agentRulesets: { quality: ['correctness', 'redundancy'] },
    editorRulesets: { quality: ['correctness', 'redundancy'] },
  })
}

// The agent build always runs oxlint, as `check` brings its own; the editor part without oxlint runs
// the rule in ESLint.
describe('the agent build of a project whose package.json lists no oxlint', () => {
  it('runs an oxlint-routed rule in oxlint and not in ESLint, where the editor part runs it in ESLint', () => {
    const defined = defineLintRules(sameSetsForBoth())
    const agent = agentConfigsOf(defined)
    const editorEslint = mergeEslintConfig([], defined.editorRulesets.eslint, writeTeamOxlintConfigSettingNoRule(defined.editorRulesets.eslint))

    expect({
      agentOxlint: hasTheRuleNoDebugger(rulesOnInOxlint(agent.oxlint)),
      agentEslint: hasTheRuleNoDebugger(rulesOnInEslint(agent.eslint)),
      editorOxlintPart: defined.editorRulesets.oxlint,
      editorEslint: hasTheRuleNoDebugger(rulesOnInEslint(editorEslint)),
    }).toStrictEqual({ agentOxlint: true, agentEslint: false, editorOxlintPart: undefined, editorEslint: true })
  })
})
