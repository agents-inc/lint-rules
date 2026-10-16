import { describe, expect, it } from 'vitest'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_ESLINT_CONFIG, NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// A team's config is untyped JS, so it may hand a merge the other engine's part, the object holding
// both, or anything at all (editor-parts.ts, describePartGiven): each merge refuses all but its own
// part, naming the config file calling it, what it takes, and what it was given. Each refusal sits
// beside the merge of the part it takes.

const tempProjects = setUpTempProjects()
const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }, linkedPackages: [INSTALLED_OXLINT] })
const editorRulesets = defineLintRules(buildEveryRulesetLintRules(projectDir)).editorRulesets
const { eslint, oxlint } = editorRulesets

const NEITHER_PART = 'a value that is neither of its parts'

/** What a team's config may hand a merge in place of its part, other than the other engine's: neither part, by how the error describes it. */
const VALUES_THAT_ARE_NEITHER_PART = [
  { what: 'the object holding both parts', value: editorRulesets },
  { what: 'null', value: null },
  { what: 'a string', value: 'eslint' },
]

describe('mergeEslintConfig, handed what a team config gives as its second argument', () => {
  it('is refused where it is the oxlint part, the error naming it', () => {
    // @ts-expect-error mergeEslintConfig takes the eslint part
    expect(() => mergeEslintConfig([], oxlint, NO_TEAM_OXLINT_CONFIG)).toThrowError(
      new Error('eslint.config.mjs: mergeEslintConfig takes the eslint part agents-inc.lint.mts exports, and was given its oxlint part'),
    )
  })

  it.each(VALUES_THAT_ARE_NEITHER_PART)('is refused where it is $what, the error saying it is neither part', ({ value }) => {
    // @ts-expect-error mergeEslintConfig takes the eslint part
    expect(() => mergeEslintConfig([], value, NO_TEAM_OXLINT_CONFIG)).toThrowError(
      new Error(`eslint.config.mjs: mergeEslintConfig takes the eslint part agents-inc.lint.mts exports, and was given ${NEITHER_PART}`),
    )
  })

  it('merges where it is the eslint part', () => {
    expect(() => mergeEslintConfig([], eslint, NO_TEAM_OXLINT_CONFIG)).not.toThrow()
  })
})

describe('mergeOxlintConfig, handed what a team config gives as its second argument', () => {
  it('is refused where it is the eslint part, the error naming it', () => {
    // @ts-expect-error mergeOxlintConfig takes the oxlint part
    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), eslint, NO_TEAM_ESLINT_CONFIG)).toThrowError(
      new Error('oxlint.config.mts: mergeOxlintConfig takes the oxlint part agents-inc.lint.mts exports, and was given its eslint part'),
    )
  })

  it.each(VALUES_THAT_ARE_NEITHER_PART)('is refused where it is $what, the error saying it is neither part', ({ value }) => {
    // @ts-expect-error mergeOxlintConfig takes the oxlint part
    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), value, NO_TEAM_ESLINT_CONFIG)).toThrowError(
      new Error(`oxlint.config.mts: mergeOxlintConfig takes the oxlint part agents-inc.lint.mts exports, and was given ${NEITHER_PART}`),
    )
  })

  it('merges where it is the oxlint part', () => {
    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, NO_TEAM_ESLINT_CONFIG)).not.toThrow()
  })
})
