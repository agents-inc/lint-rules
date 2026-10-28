import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { TEAMS_N_SETTINGS_BLOCKS } from './__tests__/cases/team-legacy-n-settings.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// Every block the merge adds is named under agents-inc/, as ESLint's config inspector and errors show
// it. The team's blocks set settings.node in some packages, so ours of eslint-plugin-n stay out of them.

const tempProjects = setUpTempProjects()

const OUR_PREFIX = 'agents-inc/'

const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()) } })

/** The names of the merged blocks that are not the team's, each as the block gives it. */
function namesOfOurBlocks(merged: readonly Linter.Config[], teamBlocks: readonly Linter.Config[]): ReadonlyArray<string | undefined> {
  const teamNames = new Set(teamBlocks.map(({ name }) => name))
  return merged.map(({ name }) => name).filter((name) => !teamNames.has(name))
}

describe('mergeEslintConfig, given team blocks giving settings our eslint-plugin-n settings yield to in some packages', () => {
  it('names each block it adds under agents-inc/, the blocks keeping our settings to other files included', () => {
    const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, { editorRulesets: { quality: ['modules'] } })).editorRulesets
    const named = namesOfOurBlocks(mergeEslintConfig([...TEAMS_N_SETTINGS_BLOCKS], eslint, NO_TEAM_OXLINT_CONFIG), TEAMS_N_SETTINGS_BLOCKS)

    expect(named.filter((name) => name?.startsWith(OUR_PREFIX) !== true)).toStrictEqual([])
  })
})
