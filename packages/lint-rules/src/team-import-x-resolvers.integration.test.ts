import { describe, expect, it } from 'vitest'
import {
  importXResolverPackageFiles,
  NO_UNRESOLVED,
  OWED_BY_THE_TEAMS_RESOLVERS,
  OWED_MERGED_BESIDE_OUR_TYPESCRIPT_RESOLVER,
  TEAMS_IMPORT_X_MODULE_TEXT,
} from './__tests__/cases/team-import-x-resolvers.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, type MergedAndTeamAloneEslintCliRuns, setUpMergedAndTeamAloneEslintCliRuns } from './__tests__/consumer-cli-runs.ts'
import { projectMergingOurEslintPartText, teamAloneEslintConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings, MODULES_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, buildPackageJsonListingOxlint, type PackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { type FindingsByFileAndRule, findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { installedPackage, type ProjectFiles } from './__tests__/temp-projects.ts'

// Our import-x/resolver-next stays out of every file where a team block sets import-x/resolver or
// resolver-next: import-x reads resolver-next first, so ours would beat a team's legacy resolver. Run by
// the ESLint CLI from the monorepo's root, merged and with the team's config alone.

allowEveryTestForParallelLoad()

const TEAM_ESLINT_MODULE = 'team.eslint.mjs'
const TEAM_ALONE_CONFIG = 'eslint.team-alone.mjs'
const PLUGIN_THE_TEAM_IMPORTS = installedPackage('eslint-plugin-import-x')

/** The monorepo with the packages, its package.json given, an eslint.config.mjs merging our ESLint part into the team's config, and one holding the team's alone. */
function monorepoFiles(packageJson: PackageJson): ProjectFiles {
  return {
    'package.json': packageJsonText(packageJson),
    ...projectMergingOurEslintPartText({
      settings: buildConsumerSettings(MODULES_IN_BOTH_SETS),
      team: { file: TEAM_ESLINT_MODULE, text: TEAMS_IMPORT_X_MODULE_TEXT },
      teamOxlint: 'setting no rule',
    }),
    [TEAM_ALONE_CONFIG]: teamAloneEslintConfigText(TEAM_ESLINT_MODULE),
    ...importXResolverPackageFiles,
  }
}

/** The team's rule's findings in each package's importer, by file. */
function teamsRuleFindingsIn(run: MergedAndTeamAloneEslintCliRuns['merged']): FindingsByFileAndRule {
  return findingsByFileAndRule(eslintEngineFindingsOf(run), Object.keys(OWED_BY_THE_TEAMS_RESOLVERS), [NO_UNRESOLVED])
}

// The project's name in full in its title, which $-interpolation would cut short.
const PROJECTS = [
  { project: 'a project whose package.json lists oxlint', files: monorepoFiles(buildPackageJsonListingOxlint()) },
  { project: 'a project whose package.json lists no oxlint', files: monorepoFiles(buildPackageJson()) },
]

PROJECTS.forEach(({ project, files }) => {
  describe(`a TS module's import of a TS module by a name without its extension, a team config setting import-x's resolvers in some packages alone and running its own import-x/no-unresolved, in ${project}, linted by the ESLint CLI from the monorepo's root through the built package`, () => {
    const runs = setUpMergedAndTeamAloneEslintCliRuns(files, TEAM_ALONE_CONFIG, [PLUGIN_THE_TEAM_IMPORTS])

    it('is linted with no fatal message, merged and by the team config alone', () => {
      expect({ merged: eslintFatalMessagesOf(runs().merged), teamAlone: eslintFatalMessagesOf(runs().teamAlone) }).toStrictEqual({ merged: [], teamAlone: [] })
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
})
