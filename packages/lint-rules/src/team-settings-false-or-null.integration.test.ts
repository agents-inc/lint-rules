import { describe, expect, it } from 'vitest'
import type { OurRulesets } from './__tests__/cases/both-engines-corpus.ts'
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
import { agentsIncLintModuleTextRootedAtItsFolder, mergedEslintConfigText, teamAloneEslintConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, buildPackageJsonListingOxlint, type PackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { type FindingsByFileAndRule, findingsByFileAndRule, type RuleByItsNames } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { TEAM_OXLINT_CONFIG_SETTING_NO_RULE, teamOxlintConfigSettingNoRuleFiles } from './__tests__/team-configs-of-the-other-engine.ts'
import { installedPackage, type ProjectFiles } from './__tests__/temp-projects.ts'

// A team block that sets a setting ours yields to has set it whatever the value, false and null
// included, so ours stays out of its files (O8; decisions.md, 2026-10-14 "fix round 5 review").
// Counted only where the value is truthy, ours was read in place of the team's, and the team's own
// rules reported, merged, what its config alone does not (fix round 6's break G1: our
// import-x/resolver-next beside the team's import-x/resolver set to false) or not what it does (its
// break G3: our settings.n list beside the team's settings.node list set to null). Run by the ESLint
// CLI through the built package from the monorepo's root, as merged and as the team's config alone.

allowEveryTestForParallelLoad()

const LINT_RULES_MODULE = 'agents-inc.lint.mts'
const TEAM_ESLINT_MODULE = 'team.eslint.mjs'
const TEAM_ALONE_CONFIG = 'eslint.team-alone.mjs'
// The ruleset that ships import-x's and eslint-plugin-n's rules, in both sets.
const MODULES: OurRulesets = { agentRulesets: { quality: ['modules'] }, editorRulesets: { quality: ['modules'] } }
const PLUGINS_THE_TEAM_IMPORTS = [installedPackage('eslint-plugin-import-x'), installedPackage('eslint-plugin-n')]

/** The monorepo with the packages, its package.json given, an eslint.config.mjs merging our ESLint part into the team's config, and one holding the team's alone. */
function monorepoFiles(packageJson: PackageJson): ProjectFiles {
  return {
    'package.json': packageJsonText(packageJson),
    [LINT_RULES_MODULE]: agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings(MODULES)),
    'eslint.config.mjs': mergedEslintConfigText(LINT_RULES_MODULE, TEAM_ESLINT_MODULE, TEAM_OXLINT_CONFIG_SETTING_NO_RULE),
    ...teamOxlintConfigSettingNoRuleFiles,
    [TEAM_ALONE_CONFIG]: teamAloneEslintConfigText(TEAM_ESLINT_MODULE),
    [TEAM_ESLINT_MODULE]: TEAMS_FALSE_OR_NULL_SETTINGS_MODULE_TEXT,
    ...falseOrNullSettingsPackageFiles,
  }
}

/** The team's rules' findings in the importers given, every package's unless given, by file: of the rules given, both unless given. */
function teamsRulesFindingsIn(
  run: MergedAndTeamAloneEslintCliRuns['merged'],
  importers: readonly string[] = Object.keys(OWED_BY_THE_TEAMS_CONFIG_ALONE),
  rules: readonly RuleByItsNames[] = [NO_UNRESOLVED, NO_MISSING_IMPORT],
): FindingsByFileAndRule {
  return findingsByFileAndRule(eslintEngineFindingsOf(run), importers, rules)
}

// The project's name in full in its title, which $-interpolation would cut short.
const PROJECTS = [
  { project: 'a project whose package.json lists oxlint', files: monorepoFiles(buildPackageJsonListingOxlint()) },
  { project: 'a project whose package.json lists no oxlint', files: monorepoFiles(buildPackageJson()) },
]

PROJECTS.forEach(({ project, files }) => {
  describe(`a TS module's import of a TS module by a name without its extension, a team config setting one of import-x's or eslint-plugin-n's settings to false or null in some packages alone and running its own import-x/no-unresolved and n/no-missing-import, in ${project}, linted by the ESLint CLI from the monorepo's root through the built package`, () => {
    const runs = setUpMergedAndTeamAloneEslintCliRuns(files, TEAM_ALONE_CONFIG, PLUGINS_THE_TEAM_IMPORTS)

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
})
