import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// A team's global ignores read from a basePath, even one above the project, may take a file back from
// ESLint's default ignores. Taking none back, our blocks keep their names; taking one back moves each
// rule of ours into a copy of its block kept out of the files our part never lints.

const tempProjects = setUpTempProjects()
const NO_VAR = 'no-var'
const CONFINED_COPY = '/confined/'
// The copy of our base block, which states no-var.
const OUR_BASE_BLOCK_CONFINED = 'agents-inc/base/confined/0'

const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()) } })
const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { [NO_VAR]: 'error' } })).editorRulesets

/** The names of our blocks the merge moved a rule into a copy of: none where they keep their names. */
function confinedCopiesIn(merged: readonly Linter.Config[]): (string | undefined)[] {
  return merged.map(({ name }) => name).filter((name) => name !== undefined && name.includes(CONFINED_COPY))
}

describe("our blocks, beside a team's global ignores read from a basePath, which leave dist/ out and take a keep.js back", () => {
  it('keep the names they have outside a merge, where the basePath is a folder of the project, whose keep.js no default ignore leaves out', () => {
    const merged = mergeEslintConfig([buildTeamEslintBlock('team/global-ignores', { basePath: 'packages/app', ignores: ['dist/', '!dist/keep.js'] })], eslint, NO_TEAM_OXLINT_CONFIG)

    expect(confinedCopiesIn(merged)).toStrictEqual([])
  })

  it.each(['..', '../elsewhere'])('keep the names they have outside a merge, where the basePath is outside the project, %s, whose keep.js is no file of the project', (basePath) => {
    const merged = mergeEslintConfig([buildTeamEslintBlock('team/global-ignores', { basePath, ignores: ['dist/', '!dist/keep.js'] })], eslint, NO_TEAM_OXLINT_CONFIG)

    expect(confinedCopiesIn(merged)).toStrictEqual([])
  })

  it("move each rule into a copy kept out of the files our part never lints, where the basePath is the project's parent and takes every node_modules folder back", () => {
    const merged = mergeEslintConfig([buildTeamEslintBlock('team/global-ignores', { basePath: '..', ignores: ['dist/', '!**/node_modules/'] })], eslint, NO_TEAM_OXLINT_CONFIG)

    expect(confinedCopiesIn(merged)).toStrictEqual([OUR_BASE_BLOCK_CONFINED])
  })
})
