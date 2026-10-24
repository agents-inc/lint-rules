import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { IMPORTER_IN, PRESERVE, PRESERVING_TSCONFIG_PATH, TEAMS_N_SETTINGS_BLOCKS } from './__tests__/cases/team-legacy-n-settings.ts'
import { editorProjectsIn, ourEditorEslintPartMergedInto } from './__tests__/editor-merges-read-by-eslint.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { typescriptSettingsEslintPluginNReads } from './__tests__/eslint-plugin-n-settings.ts'
import { buildConsumerLintRules, MODULES_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { isRecord } from './core/is-record.ts'

// eslint-plugin-n reads typescriptExtensionMap and tsconfigPath from settings.n wherever it is set,
// else from settings.node, so our settings.n stays out of every file where a team block sets
// settings.node's tryExtensions or either of those keys, and stays where it sets another key alone.

const { settingsFor } = setUpEslintConfigOracle()
const tempProjects = setUpTempProjects()
const N_SETTINGS_KEY = 'n'

/** The editor ESLint part of our settings with the ruleset that ships n/no-unpublished-import, rooted where given, merged into the team's blocks. */
function mergedInto(teamBlocks: readonly Linter.Config[], tsconfigRootDir: () => string): Linter.Config[] {
  return ourEditorEslintPartMergedInto(teamBlocks, buildConsumerLintRules(tsconfigRootDir(), MODULES_IN_BOTH_SETS))
}

/** The file's settings.n, undefined where no block gives one. */
async function nSettingsFor(config: Linter.Config[], file: string): Promise<unknown> {
  return (await settingsFor(config, file))[N_SETTINGS_KEY]
}

const PROJECTS = editorProjectsIn(tempProjects)

PROJECTS.forEach(({ project, tsconfigRootDir }) => {
  describe(`eslint-plugin-n's settings, in the editor part of ${project}, merged into a team config setting settings.node or settings.n in some packages alone`, () => {
    // Else each package owed no settings.n of ours would pass beside a part that gives none anywhere.
    it('hold, merged into a team config with no block, a settings.n of ours', async () => {
      expect(isRecord(await nSettingsFor(mergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone))).toBe(true)
    })

    // Our one key under settings.n is the list, so where the team sets it under settings.node every
    // setting of ours leaves those files: none may stay behind, not even an empty settings.n.
    it("hold no settings.n where a team block sets settings.node's list, alone or beside typescriptExtensionMap, and ours where it sets none or settings.node's version alone", async () => {
      const ours = await nSettingsFor(mergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone)
      const merged = mergedInto(TEAMS_N_SETTINGS_BLOCKS, tsconfigRootDir)

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
      const ours = await nSettingsFor(mergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone)
      const merged = mergedInto(TEAMS_N_SETTINGS_BLOCKS, tsconfigRootDir)

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
      const merged = mergedInto(TEAMS_N_SETTINGS_BLOCKS, tsconfigRootDir)
      const readIn = async (file: string): Promise<Readonly<Record<string, unknown>>> => typescriptSettingsEslintPluginNReads(await settingsFor(merged, file))

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
})
