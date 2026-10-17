import { describe, expect, it } from 'vitest'
import { agentConfigsOf, oxlintPartOf } from './__tests__/agent-configs.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, createProjectListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { rulesOnInEslint, rulesOnInOxlint } from './__tests__/rules-on-engines.ts'
import { writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { agentSettingsOf } from './agent-settings.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules, type LintRules } from './index.ts'

// The internal hook `check` uses: each part's agent projection, the agent set as the core's
// `rulesets`, in each file override too.

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = createProjectListingOxlint(tempProjects)
const PROJECT_WITHOUT_OXLINT = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) } })

const AGENT_RULESETS = { quality: ['correctness'], libs: { ui: ['react'] }, runtimes: ['node'], languages: [] } satisfies LintRules['agentRulesets']
const EDITOR_RULESETS = { quality: ['naming'], libs: {}, runtimes: ['browser'], languages: [] } satisfies LintRules['editorRulesets']

const lintRules = buildConsumerLintRules(
  PROJECT_WITH_OXLINT,
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

const AGENT_SETTINGS = {
  tsconfigRootDir: PROJECT_WITH_OXLINT,
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

describe('agentSettingsOf', () => {
  it('returns the agent settings for the ESLint part: the shared keys, and the agent set as rulesets, per entry too', () => {
    expect(agentSettingsOf(defineLintRules(lintRules).editorRulesets.eslint)).toStrictEqual(AGENT_SETTINGS)
  })

  it('returns the same settings for the oxlint part of the same config', () => {
    const oxlint = oxlintPartOf(defineLintRules(lintRules).editorRulesets)

    expect(agentSettingsOf(oxlint)).toStrictEqual(AGENT_SETTINGS)
  })

  it('refuses a part defineLintRules did not return, even a copy equal to one it did', () => {
    const { eslint } = defineLintRules(lintRules).editorRulesets

    expect(() => agentSettingsOf({ ...eslint })).toThrowError(/^agents-inc\.lint\.mts: /u)
  })

  it('accepts the part defineLintRules returned, beside that copy', () => {
    const { eslint } = defineLintRules(lintRules).editorRulesets

    expect(() => agentSettingsOf(eslint)).not.toThrow()
  })
})

// The agent build always runs oxlint, as `check` brings its own; the editor part without oxlint runs
// the rule in ESLint.
describe('the agent build of a project whose package.json lists no oxlint', () => {
  const sameSetsForBoth = buildConsumerLintRules(PROJECT_WITHOUT_OXLINT, {
    agentRulesets: { quality: ['redundancy'] },
    editorRulesets: { quality: ['redundancy'] },
  })

  it('runs an oxlint-routed rule in oxlint and not in ESLint, where the editor part runs it in ESLint', () => {
    const defined = defineLintRules(sameSetsForBoth)
    const agent = agentConfigsOf(defined)
    const editorEslint = mergeEslintConfig([], defined.editorRulesets.eslint, writeTeamOxlintConfigSettingNoRule(defined.editorRulesets.eslint))
    const runs = (rules: readonly { readonly id: string }[]): boolean => rules.some(({ id }) => id === 'no-debugger')

    expect({
      agentOxlint: runs(rulesOnInOxlint(agent.oxlint)),
      agentEslint: runs(rulesOnInEslint(agent.eslint)),
      editorOxlintPart: defined.editorRulesets.oxlint,
      editorEslint: runs(rulesOnInEslint(editorEslint)),
    }).toStrictEqual({ agentOxlint: true, agentEslint: false, editorOxlintPart: undefined, editorEslint: true })
  })
})
