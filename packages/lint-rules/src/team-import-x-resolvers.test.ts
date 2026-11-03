import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
  IMPORTER_IN,
  OURS,
  TEAMS_IMPORT_X_SETTINGS_BLOCKS,
  TEAMS_LEGACY_RESOLVERS,
  TEAMS_NODE_RESOLVER_OPTIONS,
  TEAMS_RESOLVER_NAME,
} from './__tests__/cases/team-import-x-resolvers.ts'
import { editorProjects, modulesRulesetMergedInto } from './__tests__/editor-merges-read-by-eslint.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { type ResolversImportXReads, resolversImportXReads } from './__tests__/import-x-settings.ts'

// Our import-x/resolver-next stays out of every file where a team block sets import-x/resolver,
// resolver-next, resolver-legacy or resolve, and stays where it sets another key alone: import-x reads
// resolver-next first, so ours would beat a team's legacy resolver.

const { lintedConfigFor, ruleSeverityFor } = setUpEslintConfigOracle()

// Two rules of our modules ruleset that resolve imports: oxlint runs no-cycle where the project lists it.
const NO_USELESS_PATH_SEGMENTS = 'import-x/no-useless-path-segments'
const NO_CYCLE = 'import-x/no-cycle'

async function resolversReadFor(config: readonly Linter.Config[], file: string): Promise<ResolversImportXReads> {
  return resolversImportXReads((await lintedConfigFor(config, file)).settings)
}

const PROJECTS = editorProjects()

for (const { project, tsconfigRootDir } of PROJECTS) {
  describe(`the resolvers import-x reads, in the editor part of ${project}, merged into a team config setting import-x's settings in some packages alone`, () => {
    // Else each package owed ours would pass beside a part that gives import-x no resolver at all.
    it('are, merged into a team config with no block, our node resolver under resolver-next', async () => {
      expect(await resolversReadFor(modulesRulesetMergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone)).toStrictEqual(OURS)
    })

    // Else the resolver would pass beside a ruleset that runs no rule reading it.
    it('are read by import-x/no-useless-path-segments, which our modules ruleset runs, merged into a team config with no block', async () => {
      expect(await ruleSeverityFor(modulesRulesetMergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone, NO_USELESS_PATH_SEGMENTS)).toBe('error')
    })

    it("are the team's where it sets import-x/resolver, resolver-next, resolver-legacy or resolve, alone or beside another key, and ours in every other package, one where it sets another key of import-x's alone included", async () => {
      const merged = modulesRulesetMergedInto(TEAMS_IMPORT_X_SETTINGS_BLOCKS, tsconfigRootDir)

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

// Else each project above would pass in the other's place.
describe('import-x/no-cycle, a rule of our modules ruleset reading the resolver, merged into a team config with no block', () => {
  it('runs in ESLint in the project whose package.json lists no oxlint alone: beside oxlint, oxlint runs it', async () => {
    const severities = await Promise.all(
      PROJECTS.map(async ({ project, tsconfigRootDir }): Promise<[string, Linter.StringSeverity | undefined]> => [
        project,
        await ruleSeverityFor(modulesRulesetMergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone, NO_CYCLE),
      ]),
    )

    expect(Object.fromEntries(severities)).toStrictEqual({
      'a project whose package.json lists oxlint': undefined,
      'a project whose package.json lists no oxlint': 'error',
    })
  })
})
