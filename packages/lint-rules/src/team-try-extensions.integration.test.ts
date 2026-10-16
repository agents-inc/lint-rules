import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
  OWED_BY_EACH_PACKAGES_SETTINGS,
  TEAMS_OWN_UNPUBLISHED_IMPORT_BLOCK,
  TEAMS_SETTINGS_BLOCKS,
  tryExtensionsPackageFiles,
} from './__tests__/cases/team-try-extensions.ts'
import { NO_UNPUBLISHED_IMPORT } from './__tests__/cases/workspace-package-imports.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { projectMergingOurEslintPartText, teamEslintModuleOfBlocksText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings, MODULES_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, buildPackageJsonListingOxlint, type PackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import type { ProjectFiles } from './__tests__/temp-projects.ts'

// Our `settings.n.tryExtensions` is ours only where the team's config sets neither
// `settings.n.tryExtensions` nor the older `settings.node.tryExtensions` (decisions.md, 2026-10-14
// "fix round 4 closed"; O8). Fix round 4's review: ours reached the team's own n/* rules in the
// editor merges and beat its legacy key, as eslint-plugin-n reads settings.n first. Where the team
// sets neither, ours stays in force, for its own n/* rules too. Run by the ESLint CLI through the
// built package from the monorepo's root, so an import is measured as it is there: by our copy of
// n/no-unpublished-import, and by the team's where it turns its own on.

allowEveryTestForParallelLoad()

const TEAM_ESLINT_MODULE = 'team.eslint.mjs'

/** The monorepo with the packages, its package.json given, and an eslint.config.mjs merging our ESLint part into the team's blocks. */
function monorepoFiles(packageJson: PackageJson, teamBlocks: readonly Linter.Config[]): ProjectFiles {
  return {
    'package.json': packageJsonText(packageJson),
    ...projectMergingOurEslintPartText({
      settings: buildConsumerSettings(MODULES_IN_BOTH_SETS),
      team: { file: TEAM_ESLINT_MODULE, text: teamEslintModuleOfBlocksText(teamBlocks) },
      teamOxlint: 'setting no rule',
    }),
    ...tryExtensionsPackageFiles,
  }
}

// The project's name and whose copy of the rule runs, in full in the title, which $-interpolation would cut short.
const RUNS = [
  {
    project: 'a project whose package.json lists oxlint, our copy of the rule running',
    files: monorepoFiles(buildPackageJsonListingOxlint(), TEAMS_SETTINGS_BLOCKS),
  },
  {
    project: 'a project whose package.json lists no oxlint, our copy of the rule running',
    files: monorepoFiles(buildPackageJson(), TEAMS_SETTINGS_BLOCKS),
  },
  {
    project: "a project whose package.json lists no oxlint, the team's own copy of the rule running",
    files: monorepoFiles(buildPackageJson(), [...TEAMS_SETTINGS_BLOCKS, TEAMS_OWN_UNPUBLISHED_IMPORT_BLOCK]),
  },
]

RUNS.forEach(({ project, files }) => {
  describe(`imports through each package's alias, a team config setting the extensions eslint-plugin-n tries in some packages alone, in ${project}, linted by the ESLint CLI from the monorepo's root through the built package`, () => {
    const run = setUpConsumerEslintCliRun(files)

    it('are linted with no fatal message', () => {
      expect(eslintFatalMessagesOf(run())).toStrictEqual([])
    })

    it("are reported unpublished where our list resolves them to the unpublished TS file, and not where the team's own list, settings.n's or the legacy settings.node's, resolves them to the published JSON file", () => {
      expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), Object.keys(OWED_BY_EACH_PACKAGES_SETTINGS), [NO_UNPUBLISHED_IMPORT])).toStrictEqual(
        OWED_BY_EACH_PACKAGES_SETTINGS,
      )
    })
  })
})
