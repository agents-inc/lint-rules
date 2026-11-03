import { describe, expect, it } from 'vitest'
import {
  IMPORTERS_BESIDE_THE_TEAMS_LIST,
  IMPORTERS_BESIDE_THE_TEAMS_OTHER_KEYS,
  legacyNSettingsPackageFiles,
  NO_MISSING_IMPORT,
  OWED_BY_THE_TEAMS_N_SETTINGS,
  TEAMS_N_SETTINGS_MODULE_TEXT,
} from './__tests__/cases/team-legacy-n-settings.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, type MergedAndTeamAloneEslintCliRuns, setUpMergedAndTeamAloneEslintCliRuns } from './__tests__/consumer-cli-runs.ts'
import { CONSUMER_CONFIG_FILES } from './__tests__/factories/consumer-project-factories.ts'
import { type FindingsByFileAndRule, findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { teamSettingsMonoreposOf } from './__tests__/team-settings-monorepos.ts'
import { installedPackage } from './__tests__/temp-projects.ts'

// Our settings.n stays out of every file where a team block sets, under settings.node, tryExtensions,
// typescriptExtensionMap or tsconfigPath: eslint-plugin-n reads the last two from settings.n wherever
// it is set at all, even empty, so ours would hide the team's. Run by the ESLint CLI from the monorepo's root.

allowEveryTestForParallelLoad()

const PLUGIN_THE_TEAM_IMPORTS = installedPackage('eslint-plugin-n')

/** The team's rule's findings in the importers given, every package's unless given, by file. */
function teamsRuleFindingsIn(
  run: MergedAndTeamAloneEslintCliRuns['merged'],
  importers: readonly string[] = Object.keys(OWED_BY_THE_TEAMS_N_SETTINGS),
): FindingsByFileAndRule {
  return findingsByFileAndRule(eslintEngineFindingsOf(run), importers, [NO_MISSING_IMPORT])
}

const PROJECTS = teamSettingsMonoreposOf(TEAMS_N_SETTINGS_MODULE_TEXT, legacyNSettingsPackageFiles)

for (const { project, files } of PROJECTS) {
  describe(`a TS module's import of a .jsx name beside a .tsx file, a team config setting eslint-plugin-n's settings under settings.node or settings.n in some packages alone and running its own n/no-missing-import, in ${project}, linted by the ESLint CLI from the monorepo's root through the built package`, () => {
    const runs = setUpMergedAndTeamAloneEslintCliRuns(files, CONSUMER_CONFIG_FILES.teamAloneEslint, [PLUGIN_THE_TEAM_IMPORTS])

    it('is linted with no fatal message, merged and by the team config alone', () => {
      expect({ merged: eslintFatalMessagesOf(runs().merged), teamAlone: eslintFatalMessagesOf(runs().teamAlone) }).toStrictEqual({ merged: [], teamAlone: [] })
    })

    // Else each package would pass beside a team rule that reports nothing anywhere, or everywhere.
    it("is reported by the team's config alone where eslint-plugin-n reads the package's tsconfig.json, and not where it reads the team's typescriptExtensionMap or tsconfigPath", () => {
      expect(teamsRuleFindingsIn(runs().teamAlone)).toStrictEqual(OWED_BY_THE_TEAMS_N_SETTINGS)
    })

    // Where the team sets the list, every setting of ours leaves its files, and none may stay behind:
    // an empty settings.n would hide the team's typescriptExtensionMap beside it.
    it("is reported by the team's rule, merged, as by its config alone where the team sets settings.node's list, alone or beside typescriptExtensionMap, nothing, or its version alone", () => {
      expect(teamsRuleFindingsIn(runs().merged, IMPORTERS_BESIDE_THE_TEAMS_LIST)).toStrictEqual(teamsRuleFindingsIn(runs().teamAlone, IMPORTERS_BESIDE_THE_TEAMS_LIST))
    })

    it("is reported by the team's rule, merged, as by its config alone where the team sets typescriptExtensionMap or tsconfigPath under settings.node without the list or under settings.n, or settings.node's version alone", () => {
      expect(teamsRuleFindingsIn(runs().merged, IMPORTERS_BESIDE_THE_TEAMS_OTHER_KEYS)).toStrictEqual(
        teamsRuleFindingsIn(runs().teamAlone, IMPORTERS_BESIDE_THE_TEAMS_OTHER_KEYS),
      )
    })
  })
}
