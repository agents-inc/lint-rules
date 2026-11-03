import { describe, expect, it } from 'vitest'
import {
  importXResolverPackageFiles,
  NO_UNRESOLVED,
  OWED_BY_THE_TEAMS_RESOLVERS,
  OWED_MERGED_BESIDE_OUR_TYPESCRIPT_RESOLVER,
  TEAMS_IMPORT_X_MODULE_TEXT,
} from './__tests__/cases/team-import-x-resolvers.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, type MergedAndTeamAloneEslintCliRuns, setUpMergedAndTeamAloneEslintCliRuns } from './__tests__/consumer-cli-runs.ts'
import { CONSUMER_CONFIG_FILES } from './__tests__/factories/consumer-project-factories.ts'
import { type FindingsByFileAndRule, findingsByFileAndRule, type RuleByItsNames } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { teamSettingsMonoreposOf } from './__tests__/team-settings-monorepos.ts'
import { installedPackage } from './__tests__/temp-projects.ts'

// Our import-x/resolver-next stays out of every file where a team block sets import-x/resolver or
// resolver-next: import-x reads resolver-next first, so ours would beat a team's legacy resolver. Run by
// the ESLint CLI from the monorepo's root, merged and with the team's config alone.

allowEveryTestForParallelLoad()

const PLUGIN_THE_TEAM_IMPORTS = installedPackage('eslint-plugin-import-x')
const { teamEslintModule } = CONSUMER_CONFIG_FILES

// Of our modules ruleset; oxlint runs it where the project lists oxlint. It reports the team module's default import of importX.
const NO_NAMED_AS_DEFAULT: RuleByItsNames = { rule: 'import-x/no-named-as-default', names: ['import-x/no-named-as-default'] }

const NAMED_AS_DEFAULT_IN_THE_TEAM_MODULE: Readonly<Record<string, readonly string[]>> = {
  'a project whose package.json lists oxlint': [],
  'a project whose package.json lists no oxlint': [`${teamEslintModule}:1 ${NO_NAMED_AS_DEFAULT.rule}`],
}

/** The team's rule's findings in each package's importer, by file. */
function teamsRuleFindingsIn(run: MergedAndTeamAloneEslintCliRuns['merged']): FindingsByFileAndRule {
  return findingsByFileAndRule(eslintEngineFindingsOf(run), Object.keys(OWED_BY_THE_TEAMS_RESOLVERS), [NO_UNRESOLVED])
}

const PROJECTS = teamSettingsMonoreposOf(TEAMS_IMPORT_X_MODULE_TEXT, importXResolverPackageFiles)

for (const { project, files } of PROJECTS) {
  describe(`a TS module's import of a TS module by a name without its extension, a team config setting import-x's resolvers in some packages alone and running its own import-x/no-unresolved, in ${project}, linted by the ESLint CLI from the monorepo's root through the built package`, () => {
    const runs = setUpMergedAndTeamAloneEslintCliRuns(files, CONSUMER_CONFIG_FILES.teamAloneEslint, [PLUGIN_THE_TEAM_IMPORTS])

    it('is linted with no fatal message, merged and by the team config alone', () => {
      expect({ merged: eslintFatalMessagesOf(runs().merged), teamAlone: eslintFatalMessagesOf(runs().teamAlone) }).toStrictEqual({ merged: [], teamAlone: [] })
    })

    // Else each project would pass in the other's place.
    it('draws import-x/no-named-as-default in the team module, merged, where the project lists no oxlint alone', () => {
      expect(findingsByFileAndRule(eslintEngineFindingsOf(runs().merged), [teamEslintModule], [NO_NAMED_AS_DEFAULT])).toStrictEqual({
        [teamEslintModule]: { [NO_NAMED_AS_DEFAULT.rule]: NAMED_AS_DEFAULT_IN_THE_TEAM_MODULE[project] },
      })
    })

    // Else each package would pass beside a team rule that reports nothing anywhere, or everywhere.
    it("is reported unresolved by the team's config alone where no resolver of the team's tries .ts, and not where one does", () => {
      expect(teamsRuleFindingsIn(runs().teamAlone)).toStrictEqual(OWED_BY_THE_TEAMS_RESOLVERS)
    })

    // Where the team sets no resolver key our TypeScript resolver is the one import-x reads, so the team's
    // rule resolves `./b` there, merged, as its config alone does not.
    it("is reported by the team's rule, merged, in no package: where the team sets a resolver key as by its config alone, and where it sets none resolved by ours", () => {
      expect(teamsRuleFindingsIn(runs().merged)).toStrictEqual(OWED_MERGED_BESIDE_OUR_TYPESCRIPT_RESOLVER)
    })
  })
}
