import { describe, expect, it } from 'vitest'
import { IMPORTER_IN, PRESERVE, PRESERVING_TSCONFIG_PATH, TEAMS_N_SETTINGS_BLOCKS } from './__tests__/cases/team-legacy-n-settings.ts'
import { NO_UNPUBLISHED_IMPORT } from './__tests__/cases/workspace-package-imports.ts'
import { editorProjects, modulesRulesetMergedInto, nSettingsReaderOf } from './__tests__/editor-merges-read-by-eslint.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { typescriptSettingsEslintPluginNReads } from './__tests__/eslint-plugin-n-settings.ts'
import { isRecord } from './core/is-record.ts'

// eslint-plugin-n reads typescriptExtensionMap and tsconfigPath from settings.n wherever it is set,
// else from settings.node, so our settings.n stays out of every file where a team block sets
// settings.node's tryExtensions or either of those keys, and stays where it sets another key alone.

const { ruleSeverityFor, settingsFor } = setUpEslintConfigOracle()
const nSettingsFor = nSettingsReaderOf(settingsFor)

const PROJECTS = editorProjects()

for (const { project, tsconfigRootDir } of PROJECTS) {
  describe(`eslint-plugin-n's settings, in the editor part of ${project}, merged into a team config setting settings.node or settings.n in some packages alone`, () => {
    // Else each package owed no settings.n of ours would pass beside a part that gives none anywhere.
    it('hold, merged into a team config with no block, a settings.n of ours', async () => {
      expect(isRecord(await nSettingsFor(modulesRulesetMergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone))).toBe(true)
    })

    // Else settings.n would pass beside a ruleset that runs no rule reading it.
    it('are read by n/no-unpublished-import, which our modules ruleset runs, merged into a team config with no block', async () => {
      expect(await ruleSeverityFor(modulesRulesetMergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone, NO_UNPUBLISHED_IMPORT.rule)).toBe('error')
    })

    // Our one key under settings.n is the list, so where the team sets it under settings.node every
    // setting of ours leaves those files: none may stay behind, not even an empty settings.n.
    it("hold no settings.n where a team block sets settings.node's list, alone or beside typescriptExtensionMap, and ours where it sets none or settings.node's version alone", async () => {
      const ours = await nSettingsFor(modulesRulesetMergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone)
      const merged = modulesRulesetMergedInto(TEAMS_N_SETTINGS_BLOCKS, tsconfigRootDir)

      expect({
        teamSetsNone: await nSettingsFor(merged, IMPORTER_IN.teamSetsNone),
        teamSetsLegacyList: await nSettingsFor(merged, IMPORTER_IN.teamSetsLegacyList),
        teamSetsLegacyListAndMap: await nSettingsFor(merged, IMPORTER_IN.teamSetsLegacyListAndMap),
        teamSetsLegacyVersion: await nSettingsFor(merged, IMPORTER_IN.teamSetsLegacyVersion),
      }).toStrictEqual({
        teamSetsNone: ours,
        teamSetsLegacyList: undefined,
        teamSetsLegacyListAndMap: undefined,
        teamSetsLegacyVersion: ours,
      })
    })

    it("hold no settings.n where a team block sets settings.node's typescriptExtensionMap or tsconfigPath, which ours does not set, alone or beside its version, and ours where it sets its version alone", async () => {
      const ours = await nSettingsFor(modulesRulesetMergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone)
      const merged = modulesRulesetMergedInto(TEAMS_N_SETTINGS_BLOCKS, tsconfigRootDir)

      expect({
        teamSetsLegacyMap: await nSettingsFor(merged, IMPORTER_IN.teamSetsLegacyMap),
        teamSetsLegacyTsconfigPath: await nSettingsFor(merged, IMPORTER_IN.teamSetsLegacyTsconfigPath),
        teamSetsLegacyVersion: await nSettingsFor(merged, IMPORTER_IN.teamSetsLegacyVersion),
        teamSetsLegacyVersionAndMap: await nSettingsFor(merged, IMPORTER_IN.teamSetsLegacyVersionAndMap),
      }).toStrictEqual({
        teamSetsLegacyMap: undefined,
        teamSetsLegacyTsconfigPath: undefined,
        teamSetsLegacyVersion: ours,
        teamSetsLegacyVersionAndMap: undefined,
      })
    })

    it("give eslint-plugin-n the team's typescriptExtensionMap or tsconfigPath in each package where the team sets one, under settings.node or settings.n, and neither in the others", async () => {
      const merged = modulesRulesetMergedInto(TEAMS_N_SETTINGS_BLOCKS, tsconfigRootDir)
      async function readIn(file: string): Promise<Readonly<Record<string, unknown>>> {
        return typescriptSettingsEslintPluginNReads(await settingsFor(merged, file))
      }

      expect({
        teamSetsNone: await readIn(IMPORTER_IN.teamSetsNone),
        teamSetsLegacyList: await readIn(IMPORTER_IN.teamSetsLegacyList),
        teamSetsLegacyListAndMap: await readIn(IMPORTER_IN.teamSetsLegacyListAndMap),
        teamSetsLegacyMap: await readIn(IMPORTER_IN.teamSetsLegacyMap),
        teamSetsLegacyTsconfigPath: await readIn(IMPORTER_IN.teamSetsLegacyTsconfigPath),
        teamSetsLegacyVersion: await readIn(IMPORTER_IN.teamSetsLegacyVersion),
        teamSetsLegacyVersionAndMap: await readIn(IMPORTER_IN.teamSetsLegacyVersionAndMap),
        teamSetsNMap: await readIn(IMPORTER_IN.teamSetsNMap),
      }).toStrictEqual({
        teamSetsNone: {},
        teamSetsLegacyList: {},
        teamSetsLegacyListAndMap: { typescriptExtensionMap: PRESERVE },
        teamSetsLegacyMap: { typescriptExtensionMap: PRESERVE },
        teamSetsLegacyTsconfigPath: { tsconfigPath: PRESERVING_TSCONFIG_PATH },
        teamSetsLegacyVersion: {},
        teamSetsLegacyVersionAndMap: { typescriptExtensionMap: PRESERVE },
        teamSetsNMap: { typescriptExtensionMap: PRESERVE },
      })
    })
  })
}
