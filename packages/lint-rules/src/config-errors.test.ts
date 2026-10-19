import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { oxlintPartOf } from './__tests__/agent-configs.ts'
import { VALUES_DESCRIBED_BY_KIND } from './__tests__/cases/values-described-by-kind.ts'
import {
  buildConsumerLintRulesWithoutAgentRulesets,
  buildConsumerLintRulesWithoutEditorRulesets,
  buildConsumerLintRulesWithoutTsconfigRootDir,
  buildEveryRulesetLintRules,
  EMPTY_TSCONFIG_ROOT_DIR,
  GLOBS_GIVEN_FOR_SUPPRESSIONS,
} from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, createProjectListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_ESLINT_CONFIG, NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules, type LintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

const validLintRules = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR)
const PACKAGE_JSON = 'package.json'

// Types are stripped when agents-inc.lint.mts loads, so a name the types refuse still reaches the
// runtime check; each call below is marked where the types refuse it.
const withMisspelledAgentRuleset = {
  ...validLintRules,
  agentRulesets: { ...validLintRules.agentRulesets, quality: ['corectness'] },
}
const withMisspelledEditorRuleset = {
  ...validLintRules,
  editorRulesets: { ...validLintRules.editorRulesets, quality: ['corectness'] },
}

describe('an error in agents-inc.lint.mts', () => {
  it('is named by defineLintRules, with the agent set in its path', () => {
    // @ts-expect-error corectness is no quality ruleset
    expect(() => defineLintRules(withMisspelledAgentRuleset)).toThrowError(
      new Error('agents-inc.lint.mts: agentRulesets.quality: unknown ruleset "corectness"'),
    )
  })

  it('is named by defineLintRules, with the editor set in its path', () => {
    // @ts-expect-error corectness is no quality ruleset
    expect(() => defineLintRules(withMisspelledEditorRuleset)).toThrowError(
      new Error('agents-inc.lint.mts: editorRulesets.quality: unknown ruleset "corectness"'),
    )
  })

  it('is named by defineLintRules when the agent set is missing', () => {
    // @ts-expect-error agentRulesets is required
    expect(() => defineLintRules(buildConsumerLintRulesWithoutAgentRulesets(EMPTY_TSCONFIG_ROOT_DIR))).toThrowError(
      new Error('agents-inc.lint.mts: agentRulesets: missing'),
    )
  })

  it('is named by defineLintRules when the editor set is missing', () => {
    // @ts-expect-error editorRulesets is required
    expect(() => defineLintRules(buildConsumerLintRulesWithoutEditorRulesets(EMPTY_TSCONFIG_ROOT_DIR))).toThrowError(
      new Error('agents-inc.lint.mts: editorRulesets: missing'),
    )
  })

  it('is absent from a valid config, both sets given', () => {
    expect(() => defineLintRules(validLintRules)).not.toThrow()
  })
})

// Each value fails one condition alone, beside one passing all; each message names the condition it
// fails, as a wrong reason sends the consumer after the wrong problem.
describe('tsconfigRootDir in agents-inc.lint.mts', () => {
  const tempProjects = setUpTempProjects()
  const projectDir = createProjectListingOxlint(tempProjects)
  const refusedValues = [
    { value: '.', refused: 'as a relative path to a folder', reason: 'is not an absolute path' },
    { value: join(projectDir, 'no-such-folder'), refused: 'as an absolute path to nothing', reason: 'does not exist' },
    { value: join(projectDir, PACKAGE_JSON), refused: 'as an absolute path to a file', reason: 'is not a folder' },
  ]

  it('is refused left out, naming the file, the key and that it is missing', () => {
    // @ts-expect-error tsconfigRootDir is required
    expect(() => defineLintRules(buildConsumerLintRulesWithoutTsconfigRootDir())).toThrowError(
      new Error('agents-inc.lint.mts: tsconfigRootDir: missing'),
    )
  })

  it('is refused when it is no string, naming the file, the key, the value and that it is no string', () => {
    // @ts-expect-error tsconfigRootDir is a string
    expect(() => defineLintRules({ ...validLintRules, tsconfigRootDir: 42 })).toThrowError(
      new Error('agents-inc.lint.mts: tsconfigRootDir: "42" is not a string'),
    )
  })

  it.each(VALUES_DESCRIBED_BY_KIND)('is refused when it is $given, describing it', ({ value, described }) => {
    // @ts-expect-error tsconfigRootDir is a string
    expect(() => defineLintRules({ ...validLintRules, tsconfigRootDir: value })).toThrowError(
      new Error(`agents-inc.lint.mts: tsconfigRootDir: ${described} is not a string`),
    )
  })

  it.each(refusedValues)('is refused $refused, naming the file, the key, the value and the condition it fails', ({ value, reason }) => {
    expect(() => defineLintRules({ ...validLintRules, tsconfigRootDir: value })).toThrowError(
      new Error(`agents-inc.lint.mts: tsconfigRootDir: "${value}" ${reason}`),
    )
  })

  it('is accepted as the absolute path of an existing folder', () => {
    expect(() => defineLintRules({ ...validLintRules, tsconfigRootDir: projectDir })).not.toThrow()
  })
})

describe('allowSuppressions in agents-inc.lint.mts', () => {
  it.each(VALUES_DESCRIBED_BY_KIND)('is refused when it is $given, describing it', ({ value, described }) => {
    // @ts-expect-error allowSuppressions is true or false
    expect(() => defineLintRules({ ...validLintRules, allowSuppressions: value })).toThrowError(
      new Error(`agents-inc.lint.mts: allowSuppressions: ${described} is not true or false`),
    )
  })

  it("is refused in a file override when it is an object, describing it, with the index of the entry in the path", () => {
    // @ts-expect-error allowSuppressions is true or false
    expect(() => defineLintRules({ ...validLintRules, fileOverrides: [{ files: ['legacy/**'], allowSuppressions: GLOBS_GIVEN_FOR_SUPPRESSIONS }] })).toThrowError(
      new Error('agents-inc.lint.mts: fileOverrides[0].allowSuppressions: an object is not true or false'),
    )
  })

  it.each([[true], [false]])('is accepted as %s', (allowSuppressions) => {
    expect(() => defineLintRules({ ...validLintRules, allowSuppressions })).not.toThrow()
  })
})

describe('a library ruleset in agents-inc.lint.mts', () => {
  it('is accepted in its own domain', () => {
    expect(() => defineLintRules({ ...validLintRules, agentRulesets: { ...validLintRules.agentRulesets, libs: { data: ['drizzle'] } } })).not.toThrow()
  })

  it("is refused in another domain, naming the domain", () => {
    // @ts-expect-error zod belongs to the validation domain, not data
    expect(() => defineLintRules({ ...validLintRules, agentRulesets: { ...validLintRules.agentRulesets, libs: { data: ['zod'] } } })).toThrowError(
      new Error('agents-inc.lint.mts: agentRulesets.libs.data: "zod" is not a data ruleset'),
    )
  })
})

// allowSuppressions alone decides the suppression rules, so setting one in rules is refused.
describe('a suppression rule set in agents-inc.lint.mts', () => {
  it('is refused in rules when it is house/no-suppressions, naming allowSuppressions', () => {
    // @ts-expect-error house/no-suppressions is set by allowSuppressions
    expect(() => defineLintRules({ ...validLintRules, rules: { 'house/no-suppressions': 'off' } })).toThrowError(
      new Error('agents-inc.lint.mts: rules: "house/no-suppressions" is set by allowSuppressions'),
    )
  })

  it('is refused in rules when it is @typescript-eslint/ban-ts-comment, naming allowSuppressions', () => {
    // @ts-expect-error @typescript-eslint/ban-ts-comment is set by allowSuppressions
    expect(() => defineLintRules({ ...validLintRules, rules: { '@typescript-eslint/ban-ts-comment': 'warn' } })).toThrowError(
      new Error('agents-inc.lint.mts: rules: "@typescript-eslint/ban-ts-comment" is set by allowSuppressions'),
    )
  })

  it('is refused in rules when it is unicorn/no-abusive-eslint-disable, naming allowSuppressions', () => {
    // @ts-expect-error unicorn/no-abusive-eslint-disable is set by allowSuppressions
    expect(() => defineLintRules({ ...validLintRules, rules: { 'unicorn/no-abusive-eslint-disable': 'error' } })).toThrowError(
      new Error('agents-inc.lint.mts: rules: "unicorn/no-abusive-eslint-disable" is set by allowSuppressions'),
    )
  })

  it("is refused in a file override's rules, with the index of the entry in the path", () => {
    expect(() =>
      defineLintRules({
        ...validLintRules,
        fileOverrides: [
          { files: ['legacy/**'], allowSuppressions: true },
          // @ts-expect-error @typescript-eslint/ban-ts-comment is set by allowSuppressions
          { files: ['legacy/**'], rules: { 'no-debugger': 'off', '@typescript-eslint/ban-ts-comment': 'off' } },
        ],
      }),
    ).toThrowError(
      new Error('agents-inc.lint.mts: fileOverrides[1].rules: "@typescript-eslint/ban-ts-comment" is set by allowSuppressions'),
    )
  })

  it('is absent from a config that allows suppressions through allowSuppressions and sets other rules', () => {
    const allowingSuppressions = {
      ...validLintRules,
      allowSuppressions: true,
      rules: { 'no-debugger': 'off' },
      fileOverrides: [{ files: ['strict/**'], allowSuppressions: false, rules: { 'no-debugger': 'error' } }],
    } satisfies LintRules

    expect(() => defineLintRules(allowingSuppressions)).not.toThrow()
  })
})

// A team's eslint.config.mjs is untyped, and an oxlint.config.mts may be checked loosely, so either
// may hand a merge the other engine's part. The error names the config file that passed it.
describe("a part handed to the other engine's merge", () => {
  const tempProjects = setUpTempProjects()
  const projectWithOxlint = tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) },
    linkedPackages: [INSTALLED_OXLINT],
  })

  /** Both parts of a project whose package.json lists oxlint, the oxlint one checked present. */
  function bothParts() {
    const parts = defineLintRules(buildEveryRulesetLintRules(projectWithOxlint)).editorRulesets
    return { eslint: parts.eslint, oxlint: oxlintPartOf(parts) }
  }

  it('is refused by mergeEslintConfig when it is the oxlint part, the error naming eslint.config.mjs', () => {
    const { oxlint } = bothParts()

    // @ts-expect-error the oxlint part is no ESLint part
    expect(() => mergeEslintConfig([], oxlint, NO_TEAM_OXLINT_CONFIG)).toThrowError(/^eslint\.config\.mjs: /u)
  })

  it('is accepted by mergeEslintConfig when it is the ESLint part', () => {
    const { eslint } = bothParts()

    expect(() => mergeEslintConfig([], eslint, NO_TEAM_OXLINT_CONFIG)).not.toThrow()
  })

  it('is refused by mergeOxlintConfig when it is the ESLint part, the error naming oxlint.config.mts', () => {
    const { eslint } = bothParts()

    // @ts-expect-error the ESLint part is no oxlint part
    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), eslint, NO_TEAM_ESLINT_CONFIG)).toThrowError(/^oxlint\.config\.mts: /u)
  })

  it('is accepted by mergeOxlintConfig when it is the oxlint part', () => {
    const { oxlint } = bothParts()

    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, NO_TEAM_ESLINT_CONFIG)).not.toThrow()
  })
})
