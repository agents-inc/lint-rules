import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
  IMPORTER_IN,
  OUR_RESOLVER_NAME,
  TEAMS_IMPORT_X_SETTINGS_BLOCKS,
  TEAMS_LEGACY_RESOLVERS,
  TEAMS_NODE_RESOLVER_OPTIONS,
  TEAMS_RESOLVER_NAME,
} from './__tests__/cases/team-import-x-resolvers.ts'
import { editorProjectsIn, ourEditorEslintPartMergedInto } from './__tests__/editor-merges-read-by-eslint.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { type ResolversImportXReads, resolversImportXReads } from './__tests__/import-x-settings.ts'
import { buildConsumerLintRules, MODULES_IN_BOTH_SETS } from './__tests__/factories/lint-rules-factories.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'

// Our import-x/resolver-next stays out of every file where a team block sets import-x/resolver,
// resolver-next, resolver-legacy or resolve, and stays where it sets another key alone: import-x reads
// resolver-next first, so ours would beat a team's legacy resolver.

const { lintedConfigFor } = setUpEslintConfigOracle()
const tempProjects = setUpTempProjects()

const OURS: ResolversImportXReads = { key: 'import-x/resolver-next', names: [OUR_RESOLVER_NAME] }

/** The editor ESLint part of our settings with the ruleset that ships import-x's rules, rooted where given, merged into the team's blocks. */
function mergedInto(teamBlocks: readonly Linter.Config[], tsconfigRootDir: () => string): Linter.Config[] {
  return ourEditorEslintPartMergedInto(teamBlocks, buildConsumerLintRules(tsconfigRootDir(), MODULES_IN_BOTH_SETS))
}

async function resolversReadFor(config: readonly Linter.Config[], file: string): Promise<ResolversImportXReads> {
  return resolversImportXReads((await lintedConfigFor(config, file)).settings)
}

const PROJECTS = editorProjectsIn(tempProjects)

for (const { project, tsconfigRootDir } of PROJECTS) {
  describe(`the resolvers import-x reads, in the editor part of ${project}, merged into a team config setting import-x's settings in some packages alone`, () => {
    // Else each package owed ours would pass beside a part that gives import-x no resolver at all.
    it('are, merged into a team config with no block, our node resolver under resolver-next', async () => {
      expect(await resolversReadFor(mergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone)).toStrictEqual(OURS)
    })

    it("are the team's where it sets import-x/resolver, resolver-next, resolver-legacy or resolve, alone or beside another key, and ours in every other package, one where it sets another key of import-x's alone included", async () => {
      const merged = mergedInto(TEAMS_IMPORT_X_SETTINGS_BLOCKS, tsconfigRootDir)

      expect({
        teamSetsNone: await resolversReadFor(merged, IMPORTER_IN.teamSetsNone),
        teamSetsResolver: await resolversReadFor(merged, IMPORTER_IN.teamSetsResolver),
        teamSetsResolverNext: await resolversReadFor(merged, IMPORTER_IN.teamSetsResolverNext),
        teamSetsCoreModules: await resolversReadFor(merged, IMPORTER_IN.teamSetsCoreModules),
        teamSetsResolverAndCoreModules: await resolversReadFor(merged, IMPORTER_IN.teamSetsResolverAndCoreModules),
        teamSetsResolverLegacy: await resolversReadFor(merged, IMPORTER_IN.teamSetsResolverLegacy),
        teamSetsResolve: await resolversReadFor(merged, IMPORTER_IN.teamSetsResolve),
      }).toStrictEqual({
        teamSetsNone: OURS,
        teamSetsResolver: { key: 'import-x/resolver', value: TEAMS_LEGACY_RESOLVERS },
        teamSetsResolverNext: { key: 'import-x/resolver-next', names: [TEAMS_RESOLVER_NAME] },
        teamSetsCoreModules: OURS,
        teamSetsResolverAndCoreModules: { key: 'import-x/resolver', value: TEAMS_LEGACY_RESOLVERS },
        teamSetsResolverLegacy: { key: 'import-x/resolver-legacy', value: TEAMS_LEGACY_RESOLVERS },
        teamSetsResolve: { key: 'import-x/resolve', value: TEAMS_NODE_RESOLVER_OPTIONS },
      })
    })
  })
}
