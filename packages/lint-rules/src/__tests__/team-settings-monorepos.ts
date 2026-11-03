import { CONSUMER_CONFIG_FILES, projectMergingOurEslintPartText, teamAloneEslintConfigText } from './factories/consumer-project-factories.ts'
import { buildConsumerSettings, MODULES_IN_BOTH_SETS } from './factories/lint-rules-factories.ts'
import { buildPackageJson, buildPackageJsonListingOxlint, type PackageJson, packageJsonText } from './factories/package-json-factories.ts'
import type { ProjectFiles } from './temp-projects.ts'

type TeamSettingsMonorepo = { readonly project: string; readonly files: ProjectFiles }

const { teamEslintModule, teamAloneEslint } = CONSUMER_CONFIG_FILES

/**
* One listing oxlint and one not, each named in full for a title, which $-interpolation would cut short; each holds
* the team's config alone too, at `CONSUMER_CONFIG_FILES.teamAloneEslint`.
*/
export function teamSettingsMonoreposOf(teamModuleText: string, packageFiles: ProjectFiles): readonly TeamSettingsMonorepo[] {
  return [
    { project: 'a project whose package.json lists oxlint', files: monorepoHoldingTheTeamsConfigAloneFiles(buildPackageJsonListingOxlint(), teamModuleText, packageFiles) },
    { project: 'a project whose package.json lists no oxlint', files: monorepoHoldingTheTeamsConfigAloneFiles(buildPackageJson(), teamModuleText, packageFiles) },
  ]
}

/** An eslint.config.mjs merging our ESLint part, with the modules ruleset, into the team's module. */
export function monorepoMergingOurEslintPartFiles(packageJson: PackageJson, teamModuleText: string, packageFiles: ProjectFiles): ProjectFiles {
  return {
    'package.json': packageJsonText(packageJson),
    ...projectMergingOurEslintPartText({
      settings: buildConsumerSettings(MODULES_IN_BOTH_SETS),
      team: { file: teamEslintModule, text: teamModuleText },
      teamOxlint: 'setting no rule',
    }),
    ...packageFiles,
  }
}

function monorepoHoldingTheTeamsConfigAloneFiles(packageJson: PackageJson, teamModuleText: string, packageFiles: ProjectFiles): ProjectFiles {
  return monorepoMergingOurEslintPartFiles(packageJson, teamModuleText, { [teamAloneEslint]: teamAloneEslintConfigText(teamEslintModule), ...packageFiles })
}
