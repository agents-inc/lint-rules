import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { IMPORTER_IN, TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS, TEAMS_NODE_RESOLVER_OPTIONS } from './__tests__/cases/team-settings-false-or-null.ts'
import { OUR_RESOLVER_NAME } from './__tests__/cases/team-import-x-resolvers.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { type ResolversImportXReads, resolversImportXReads } from './__tests__/import-x-settings.ts'
import { buildConsumerLintRules, EMPTY_TSCONFIG_ROOT_DIR } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { isRecord } from './core/is-record.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// A team block that sets a setting ours yields to has set it whatever the value, false and null
// included, so ours stays out of its files (O8; decisions.md, 2026-10-14 "fix round 5 review"):
// counted only where the value is truthy, ours was read in place of the team's (fix round 6's breaks
// G1 and G3). Read from ESLint's own merge for a module in each package of
// team-settings-false-or-null.ts, as each plugin reads it. team-settings-false-or-null.integration.test.ts
// runs the team's rules.

const { calculatedConfigFor } = setUpEslintConfigOracle()
const tempProjects = setUpTempProjects()
const projectListingOxlint = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) } })
const N_SETTINGS_KEY = 'n'

const OURS: ResolversImportXReads = { key: 'import-x/resolver-next', names: [OUR_RESOLVER_NAME] }

/** The editor ESLint part of our settings with the ruleset that ships import-x's and eslint-plugin-n's rules, rooted where given, merged into the team's blocks. */
function mergedInto(teamBlocks: readonly Linter.Config[], tsconfigRootDir: string): Linter.Config[] {
  const lintRules = buildConsumerLintRules(tsconfigRootDir, { agentRulesets: { quality: ['modules'] }, editorRulesets: { quality: ['modules'] } })
  const { eslint } = defineLintRules(lintRules).editorRulesets
  return mergeEslintConfig([...teamBlocks], eslint, writeTeamOxlintConfigSettingNoRule(eslint))
}

/** The file's settings, which our base block always gives. */
async function settingsFor(config: Linter.Config[], file: string): Promise<Readonly<Record<string, unknown>>> {
  const calculated = await calculatedConfigFor(config, file)
  if (calculated === undefined) throw new Error(`ESLint does not lint ${file}`)
  const { settings } = calculated
  if (settings === undefined) throw new Error(`ESLint gives ${file} no settings`)
  return settings
}

async function resolversReadFor(config: Linter.Config[], file: string): Promise<ResolversImportXReads> {
  return resolversImportXReads(await settingsFor(config, file))
}

/** The file's settings.n, undefined where no block gives one. */
async function nSettingsFor(config: Linter.Config[], file: string): Promise<unknown> {
  return (await settingsFor(config, file))[N_SETTINGS_KEY]
}

// The project's name in full in its title, which $-interpolation would cut short.
const PROJECTS = [
  { project: 'a project whose package.json lists oxlint', tsconfigRootDir: projectListingOxlint },
  { project: 'a project whose package.json lists no oxlint', tsconfigRootDir: EMPTY_TSCONFIG_ROOT_DIR },
]

PROJECTS.forEach(({ project, tsconfigRootDir }) => {
  describe(`the settings import-x and eslint-plugin-n read, in the editor part of ${project}, merged into a team config setting one of theirs to false or null in some packages alone`, () => {
    // Else each package owed no setting of ours would pass beside a part that gives none anywhere.
    it('hold, merged into a team config with no block, our resolver-next and a settings.n of ours', async () => {
      const merged = mergedInto([], tsconfigRootDir)

      expect({
        resolvers: await resolversReadFor(merged, IMPORTER_IN.teamSetsNone),
        nSettingsIsAnObject: isRecord(await nSettingsFor(merged, IMPORTER_IN.teamSetsNone)),
      }).toStrictEqual({ resolvers: OURS, nSettingsIsAnObject: true })
    })

    it("give import-x the team's import-x/resolve where it sets import-x/resolver to false beside it, and our resolver-next where it sets nothing or settings.node's list alone", async () => {
      const merged = mergedInto(TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS, tsconfigRootDir)

      expect({
        teamSetsNone: await resolversReadFor(merged, IMPORTER_IN.teamSetsNone),
        teamSetsResolverFalse: await resolversReadFor(merged, IMPORTER_IN.teamSetsResolverFalse),
        teamSetsNodeListNull: await resolversReadFor(merged, IMPORTER_IN.teamSetsNodeListNull),
      }).toStrictEqual({
        teamSetsNone: OURS,
        teamSetsResolverFalse: { key: 'import-x/resolve', value: TEAMS_NODE_RESOLVER_OPTIONS },
        teamSetsNodeListNull: OURS,
      })
    })

    it("hold no settings.n where the team sets settings.node's list to null, and ours where it sets nothing or import-x's settings alone", async () => {
      const ours = await nSettingsFor(mergedInto([], tsconfigRootDir), IMPORTER_IN.teamSetsNone)
      const merged = mergedInto(TEAMS_FALSE_OR_NULL_SETTINGS_BLOCKS, tsconfigRootDir)

      expect({
        teamSetsNone: await nSettingsFor(merged, IMPORTER_IN.teamSetsNone),
        teamSetsResolverFalse: await nSettingsFor(merged, IMPORTER_IN.teamSetsResolverFalse),
        teamSetsNodeListNull: await nSettingsFor(merged, IMPORTER_IN.teamSetsNodeListNull),
      }).toStrictEqual({
        teamSetsNone: ours,
        teamSetsResolverFalse: ours,
        teamSetsNodeListNull: undefined,
      })
    })
  })
})
