import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { IMPORTER_IN, TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS, TEAMS_NODE_RESOLVER_OPTIONS } from './__tests__/cases/team-settings-false-or-null.ts'
import { OUR_RESOLVER_NAME } from './__tests__/cases/team-import-x-resolvers.ts'
import { editorProjectsIn, ourEditorEslintPartMergedInto } from './__tests__/editor-merges-read-by-eslint.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { type ResolversImportXReads, resolversImportXReads } from './__tests__/import-x-settings.ts'
import { buildConsumerLintRules, MODULES_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { isRecord } from './core/is-record.ts'

// A team block that sets a setting ours yields to has set it whatever the value, false and null
// included, so ours stays out of its files.

const { settingsFor } = setUpEslintConfigOracle()
const tempProjects = setUpTempProjects()
const N_SETTINGS_KEY = 'n'

const OURS: ResolversImportXReads = { key: 'import-x/resolver-next', names: [OUR_RESOLVER_NAME] }

/** The editor ESLint part of our settings with the ruleset that ships import-x's and eslint-plugin-n's rules, rooted where given, merged into the team's blocks. */
function mergedInto(teamBlocks: readonly Linter.Config[], tsconfigRootDir: string): Linter.Config[] {
  return ourEditorEslintPartMergedInto(teamBlocks, buildConsumerLintRules(tsconfigRootDir, MODULES_IN_BOTH_SETS))
}

async function resolversReadFor(config: Linter.Config[], file: string): Promise<ResolversImportXReads> {
  return resolversImportXReads(await settingsFor(config, file))
}

/** The file's settings.n, undefined where no block gives one. */
async function nSettingsFor(config: Linter.Config[], file: string): Promise<unknown> {
  return (await settingsFor(config, file))[N_SETTINGS_KEY]
}

const PROJECTS = editorProjectsIn(tempProjects)

PROJECTS.forEach(({ project, tsconfigRootDir }) => {
  describe(`the settings import-x and eslint-plugin-n read, in the editor part of ${project}, merged into a team config setting one of theirs to false or null in some packages alone`, () => {
    // Else each package owed no setting of ours would pass beside a part that gives none anywhere.
    it('hold, merged into a team config with no block, our resolver-next and a settings.n of ours', async () => {
      const merged = mergedInto([], tsconfigRootDir)

      expect({
        resolvers: await resolversReadFor(merged, IMPORTER_IN.teamSetsNone),
        nSettingsIsAnObject: isRecord(await nSettingsFor(merged, IMPORTER_IN.teamSetsNone)),
      }).toStrictEqual({ resolvers: OURS, nSettingsIsAnObject: true })
    })

    it("give import-x the team's import-x/resolve where it sets import-x/resolver to false beside it, and our resolver-next where it sets nothing or settings.node's list alone", async () => {
      const merged = mergedInto(TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS, tsconfigRootDir)

      expect({
        teamSetsNone: await resolversReadFor(merged, IMPORTER_IN.teamSetsNone),
        teamSetsResolverFalse: await resolversReadFor(merged, IMPORTER_IN.teamSetsResolverFalse),
        teamSetsNodeListNull: await resolversReadFor(merged, IMPORTER_IN.teamSetsNodeListNull),
      }).toStrictEqual({
        teamSetsNone: OURS,
        teamSetsResolverFalse: { key: 'import-x/resolve', value: TEAMS_NODE_RESOLVER_OPTIONS },
        teamSetsNodeListNull: OURS,
      })
    })

    it("hold no settings.n where the team sets settings.node's list to null, and ours where it sets nothing or import-x's settings alone", async () => {
      const ours = await nSettingsFor(mergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone)
      const merged = mergedInto(TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS, tsconfigRootDir)

      expect({
        teamSetsNone: await nSettingsFor(merged, IMPORTER_IN.teamSetsNone),
        teamSetsResolverFalse: await nSettingsFor(merged, IMPORTER_IN.teamSetsResolverFalse),
        teamSetsNodeListNull: await nSettingsFor(merged, IMPORTER_IN.teamSetsNodeListNull),
      }).toStrictEqual({
        teamSetsNone: ours,
        teamSetsResolverFalse: ours,
        teamSetsNodeListNull: undefined,
      })
    })
  })
})
