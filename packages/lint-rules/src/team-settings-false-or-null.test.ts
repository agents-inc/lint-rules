import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { IMPORTER_IN, TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS, TEAMS_NODE_RESOLVER_OPTIONS } from './__tests__/cases/team-settings-false-or-null.ts'
import { OURS } from './__tests__/cases/team-import-x-resolvers.ts'
import { NO_UNPUBLISHED_IMPORT } from './__tests__/cases/workspace-package-imports.ts'
import { editorProjects, modulesRulesetMergedInto, nSettingsReaderOf } from './__tests__/editor-merges-read-by-eslint.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { type ResolversImportXReads, resolversImportXReads } from './__tests__/import-x-settings.ts'
import { isRecord } from './core/is-record.ts'

// A team block that sets a setting ours yields to has set it whatever the value, false and null
// included, so ours stays out of its files.

const { ruleSeverityFor, settingsFor } = setUpEslintConfigOracle()
const nSettingsFor = nSettingsReaderOf(settingsFor)

async function resolversReadFor(config: readonly Linter.Config[], file: string): Promise<ResolversImportXReads> {
  return resolversImportXReads(await settingsFor(config, file))
}

const PROJECTS = editorProjects()

for (const { project, tsconfigRootDir } of PROJECTS) {
  describe(`the settings import-x and eslint-plugin-n read, in the editor part of ${project}, merged into a team config setting one of theirs to false or null in some packages alone`, () => {
    // Else each package owed no setting of ours would pass beside a part that gives none anywhere.
    it('hold, merged into a team config with no block, our resolver-next and a settings.n of ours', async () => {
      const merged = modulesRulesetMergedInto([], tsconfigRootDir)

      expect({
        resolvers: await resolversReadFor(merged, IMPORTER_IN.teamSetsNone),
        nSettingsIsAnObject: isRecord(await nSettingsFor(merged, IMPORTER_IN.teamSetsNone)),
      }).toStrictEqual({ resolvers: OURS, nSettingsIsAnObject: true })
    })

    // Else these settings would pass beside a ruleset that runs no rule reading them.
    it('are read by n/no-unpublished-import, which our modules ruleset runs, merged into a team config with no block', async () => {
      expect(await ruleSeverityFor(modulesRulesetMergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone, NO_UNPUBLISHED_IMPORT.rule)).toBe('error')
    })

    it("give import-x the team's import-x/resolve where it sets import-x/resolver to false beside it, and our resolver-next where it sets nothing or settings.node's list alone", async () => {
      const merged = modulesRulesetMergedInto(TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS, tsconfigRootDir)

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
      const ours = await nSettingsFor(modulesRulesetMergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone)
      const merged = modulesRulesetMergedInto(TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS, tsconfigRootDir)

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
}
