import { describe, expect, it } from 'vitest'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_ESLINT_CONFIG, NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import type { EditorParts } from './core/editor-parts.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// A team's eslint.config.mjs is untyped JS, so it may hand mergeEslintConfig anything: the merge refuses all but its
// own part, naming the config file calling it, what it takes, and what it was given. mergeOxlintConfig's part is
// refused by its type alone (merge-oxlint-config.test-d.ts; what an untyped oxlint.config.mts gets instead:
// untyped-oxlint-config.test.ts).

const tempProjects = setUpTempProjects()
const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }, linkedPackages: [INSTALLED_OXLINT] })

const NEITHER_PART = 'a value that is neither of its parts'

/** A value as a title names it, and the value, made as the test reads it. */
type GivenValue = { readonly what: string; readonly given: () => unknown }

function ourEditorParts(): EditorParts {
  return defineLintRules(buildEveryRulesetLintRules(projectDir)).editorRulesets
}

/** What a team's config may hand a merge in place of its part, other than the other engine's: neither part, by how the error describes it. */
const VALUES_THAT_ARE_NEITHER_PART: readonly GivenValue[] = [
  { what: 'the object holding both parts', given: ourEditorParts },
  {
    what: 'null',
    given() {
      return null
    },
  },
  {
    what: 'a string',
    given() {
      return 'eslint'
    },
  },
]

describe('mergeEslintConfig, handed what a team config gives as its second argument', () => {
  it('is refused where it is the oxlint part, the error naming it', () => {
    const { oxlint } = ourEditorParts()

    // @ts-expect-error mergeEslintConfig takes the eslint part
    expect(() => mergeEslintConfig([], oxlint, NO_TEAM_OXLINT_CONFIG)).toThrow(
      new Error('eslint.config.mjs: mergeEslintConfig takes the eslint part agents-inc.lint.mts exports, and was given its oxlint part'),
    )
  })

  it.each(VALUES_THAT_ARE_NEITHER_PART)('is refused where it is $what, the error saying it is neither part', ({ given }) => {
    const value = given()

    // @ts-expect-error mergeEslintConfig takes the eslint part
    expect(() => mergeEslintConfig([], value, NO_TEAM_OXLINT_CONFIG)).toThrow(
      new Error(`eslint.config.mjs: mergeEslintConfig takes the eslint part agents-inc.lint.mts exports, and was given ${NEITHER_PART}`),
    )
  })

  it('merges where it is the eslint part', () => {
    const { eslint } = ourEditorParts()

    expect(() => mergeEslintConfig([], eslint, NO_TEAM_OXLINT_CONFIG)).not.toThrow()
  })
})

describe('mergeOxlintConfig, handed what a team config gives as its second argument', () => {
  it('merges where it is the oxlint part', () => {
    const { oxlint } = ourEditorParts()

    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, NO_TEAM_ESLINT_CONFIG)).not.toThrow()
  })
})
