import { describe, expect, it } from 'vitest'
import {
  falseOrNullSettingsPackageFiles,
  IMPORTER_IN,
  IMPORTERS_WHERE_THE_TEAM_SETS_NO_N_SETTING,
  NO_MISSING_IMPORT,
  NO_UNRESOLVED,
  OWED_BY_THE_TEAMS_CONFIG_ALONE,
  OWED_MERGED_WHERE_THE_TEAM_SETS_NO_N_SETTING,
  TEAMS_FALSE_OR_NULL_SETTINGS_MODULE_TEXT,
} from './__tests__/cases/team-settings-false-or-null.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, type MergedAndTeamAloneEslintCliRuns, setUpMergedAndTeamAloneEslintCliRuns } from './__tests__/consumer-cli-runs.ts'
import { CONSUMER_CONFIG_FILES } from './__tests__/factories/consumer-project-factories.ts'
import { type FindingsByFileAndRule, findingsByFileAndRule, type RuleByItsNames } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { teamSettingsMonoreposOf } from './__tests__/team-settings-monorepos.ts'
import { installedPackage } from './__tests__/temp-projects.ts'

// A team block that sets a setting ours yields to has set it whatever the value, false and null
// included, so ours stays out of its files: read in place of the team's, ours changed what the team's
// rules report. Run by the ESLint CLI from the monorepo's root, merged and with the team's config alone.

allowEveryTestForParallelLoad()

const PLUGINS_THE_TEAM_IMPORTS = [installedPackage('eslint-plugin-import-x'), installedPackage('eslint-plugin-n')]

/** The team's rules' findings in the importers given, every package's unless given, by file: of the rules given, both unless given. */
function teamsRulesFindingsIn(
  run: MergedAndTeamAloneEslintCliRuns['merged'],
  importers: readonly string[] = Object.keys(OWED_BY_THE_TEAMS_CONFIG_ALONE),
  rules: readonly RuleByItsNames[] = [NO_UNRESOLVED, NO_MISSING_IMPORT],
): FindingsByFileAndRule {
  return findingsByFileAndRule(eslintEngineFindingsOf(run), importers, rules)
}

const PROJECTS = teamSettingsMonoreposOf(TEAMS_FALSE_OR_NULL_SETTINGS_MODULE_TEXT, falseOrNullSettingsPackageFiles)

for (const { project, files } of PROJECTS) {
  describe(`a TS module's import of a TS module by a name without its extension, a team config setting one of import-x's or eslint-plugin-n's settings to false or null in some packages alone and running its own import-x/no-unresolved and n/no-missing-import, in ${project}, linted by the ESLint CLI from the monorepo's root through the built package`, () => {
    const runs = setUpMergedAndTeamAloneEslintCliRuns(files, CONSUMER_CONFIG_FILES.teamAloneEslint, PLUGINS_THE_TEAM_IMPORTS)

    it('is linted with no fatal message, merged and by the team config alone', () => {
      expect({ merged: eslintFatalMessagesOf(runs().merged), teamAlone: eslintFatalMessagesOf(runs().teamAlone) }).toStrictEqual({ merged: [], teamAlone: [] })
    })

    // Else each package would pass beside a team rule that reports nothing anywhere, or everywhere.
    it("is reported by the team's config alone as missing everywhere, and as unresolved but where its import-x/resolve tries .ts", () => {
      expect(teamsRulesFindingsIn(runs().teamAlone)).toStrictEqual(OWED_BY_THE_TEAMS_CONFIG_ALONE)
    })

    it("is reported by the team's import-x/no-unresolved, merged, as by its config alone where the team sets import-x/resolver to false beside import-x/resolve", () => {
      const importers = [IMPORTER_IN.teamSetsResolverFalse]

      expect(teamsRulesFindingsIn(runs().merged, importers, [NO_UNRESOLVED])).toStrictEqual(teamsRulesFindingsIn(runs().teamAlone, importers, [NO_UNRESOLVED]))
    })

    it("is reported by the team's n/no-missing-import, merged, as by its config alone where the team sets settings.node's list to null", () => {
      const importers = [IMPORTER_IN.teamSetsNodeListNull]

      expect(teamsRulesFindingsIn(runs().merged, importers, [NO_MISSING_IMPORT])).toStrictEqual(
        teamsRulesFindingsIn(runs().teamAlone, importers, [NO_MISSING_IMPORT]),
      )
    })

    // Beside the refusals: ours stays where the team sets no setting of eslint-plugin-n's.
    it("is not reported by the team's n/no-missing-import, merged, where the team sets nothing, nor where it sets import-x's settings alone, as our list in force there tries .ts", () => {
      expect(teamsRulesFindingsIn(runs().merged, IMPORTERS_WHERE_THE_TEAM_SETS_NO_N_SETTING, [NO_MISSING_IMPORT])).toStrictEqual(
        OWED_MERGED_WHERE_THE_TEAM_SETS_NO_N_SETTING,
      )
    })
  })
}
