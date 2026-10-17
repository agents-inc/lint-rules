import { isDeepStrictEqual } from 'node:util'
import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { TEAMS_SETTINGS_BLOCKS, TEAMS_TRY_EXTENSIONS, USES_BOTH_IN } from './__tests__/cases/team-try-extensions.ts'
import { editorProjectsIn, ourEditorEslintPartMergedInto } from './__tests__/editor-merges-read-by-eslint.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { tryExtensionsEslintPluginNReads } from './__tests__/eslint-plugin-n-settings.ts'
import { buildConsumerLintRules, MODULES_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'

// Our `settings.n.tryExtensions` is ours only where the team's config sets neither it nor the older
// `settings.node.tryExtensions`; eslint-plugin-n reads settings.n's list, else settings.node's.

const { lintedConfigFor } = setUpEslintConfigOracle()
const tempProjects = setUpTempProjects()

/** The editor ESLint part of our settings with the ruleset that ships n/no-unpublished-import, rooted where given, merged into the team's blocks. */
function mergedInto(teamBlocks: readonly Linter.Config[], tsconfigRootDir: string): Linter.Config[] {
  return ourEditorEslintPartMergedInto(teamBlocks, buildConsumerLintRules(tsconfigRootDir, MODULES_IN_BOTH_SETS))
}

async function tryExtensionsReadFor(config: Linter.Config[], file: string): Promise<string[] | undefined> {
  return tryExtensionsEslintPluginNReads((await lintedConfigFor(config, file)).settings)
}

const PROJECTS = editorProjectsIn(tempProjects)

PROJECTS.forEach(({ project, tsconfigRootDir }) => {
  describe(`the extensions eslint-plugin-n tries, in the editor part of ${project}, merged into a team config setting them in some packages alone`, () => {
    // Else each package where ours is owed would pass on any list at all, the team's included.
    it("are, merged into a team config with no block, a list of ours that is not the team's", async () => {
      const ours = await tryExtensionsReadFor(mergedInto([], tsconfigRootDir), USES_BOTH_IN.teamSetsNone)

      expect({ isAList: Array.isArray(ours), isTheTeams: isDeepStrictEqual(ours, TEAMS_TRY_EXTENSIONS) }).toStrictEqual({
        isAList: true,
        isTheTeams: false,
      })
    })

    it("are the team's where it sets settings.n's or settings.node's list, and ours in every other package, one where it sets another key of either included", async () => {
      const ours = await tryExtensionsReadFor(mergedInto([], tsconfigRootDir), USES_BOTH_IN.teamSetsNone)
      const merged = mergedInto(TEAMS_SETTINGS_BLOCKS, tsconfigRootDir)

      expect({
        teamSetsNone: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsNone),
        teamSetsLegacyKey: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsLegacyKey),
        teamSetsNKey: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsNKey),
        teamSetsLegacyKeysVersion: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsLegacyKeysVersion),
        teamSetsNKeysVersion: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsNKeysVersion),
      }).toStrictEqual({
        teamSetsNone: ours,
        teamSetsLegacyKey: TEAMS_TRY_EXTENSIONS,
        teamSetsNKey: TEAMS_TRY_EXTENSIONS,
        teamSetsLegacyKeysVersion: ours,
        teamSetsNKeysVersion: ours,
      })
    })
  })
})
