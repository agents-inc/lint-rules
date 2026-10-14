import { isDeepStrictEqual } from 'node:util'
import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { TEAMS_SETTINGS_BLOCKS, TEAMS_TRY_EXTENSIONS, USES_BOTH_IN } from './__tests__/cases/team-try-extensions.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { tryExtensionsEslintPluginNReads } from './__tests__/eslint-plugin-n-settings.ts'
import { buildConsumerLintRules, EMPTY_TSCONFIG_ROOT_DIR } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// Our `settings.n.tryExtensions` is ours only where the team's config sets neither
// `settings.n.tryExtensions` nor the older `settings.node.tryExtensions` (decisions.md, 2026-10-14
// "fix round 4 closed"; O8). Read from ESLint's own merge for a module in each package of
// team-try-extensions.ts, as eslint-plugin-n reads it: settings.n's list, else settings.node's.
// team-try-extensions.integration.test.ts runs the rule.

const { calculatedConfigFor } = setUpEslintConfigOracle()
const tempProjects = setUpTempProjects()
const projectListingOxlint = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) } })

/** The editor ESLint part of our settings with the ruleset that ships n/no-unpublished-import, rooted where given, merged into the team's blocks. */
function mergedInto(teamBlocks: readonly Linter.Config[], tsconfigRootDir: string): Linter.Config[] {
  const lintRules = buildConsumerLintRules(tsconfigRootDir, { agentRulesets: { quality: ['modules'] }, editorRulesets: { quality: ['modules'] } })
  const { eslint } = defineLintRules(lintRules).editorRulesets
  return mergeEslintConfig([...teamBlocks], eslint, writeTeamOxlintConfigSettingNoRule(eslint))
}

async function tryExtensionsReadFor(config: Linter.Config[], file: string): Promise<string[] | undefined> {
  const calculated = await calculatedConfigFor(config, file)
  if (calculated === undefined) throw new Error(`ESLint does not lint ${file}`)
  return tryExtensionsEslintPluginNReads(calculated.settings)
}

// The project's name in full in its title, which $-interpolation would cut short.
const PROJECTS = [
  { project: 'a project whose package.json lists oxlint', tsconfigRootDir: projectListingOxlint },
  { project: 'a project whose package.json lists no oxlint', tsconfigRootDir: EMPTY_TSCONFIG_ROOT_DIR },
]

PROJECTS.forEach(({ project, tsconfigRootDir }) => {
  describe(`the extensions eslint-plugin-n tries, in the editor part of ${project}, merged into a team config setting them in some packages alone`, () => {
    // Else each package where ours is owed would pass on any list at all, the team's included.
    it("are, merged into a team config with no block, a list of ours that is not the team's", async () => {
      const ours = await tryExtensionsReadFor(mergedInto([], tsconfigRootDir), USES_BOTH_IN.teamSetsNone)

      expect({ isAList: Array.isArray(ours), isTheTeams: isDeepStrictEqual(ours, TEAMS_TRY_EXTENSIONS) }).toStrictEqual({
        isAList: true,
        isTheTeams: false,
      })
    })

    it("are the team's where it sets settings.n's or settings.node's list, and ours in every other package, one where it sets another key of either included", async () => {
      const ours = await tryExtensionsReadFor(mergedInto([], tsconfigRootDir), USES_BOTH_IN.teamSetsNone)
      const merged = mergedInto(TEAMS_SETTINGS_BLOCKS, tsconfigRootDir)

      expect({
        teamSetsNone: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsNone),
        teamSetsLegacyKey: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsLegacyKey),
        teamSetsNKey: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsNKey),
        teamSetsLegacyKeysVersion: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsLegacyKeysVersion),
        teamSetsNKeysVersion: await tryExtensionsReadFor(merged, USES_BOTH_IN.teamSetsNKeysVersion),
      }).toStrictEqual({
        teamSetsNone: ours,
        teamSetsLegacyKey: TEAMS_TRY_EXTENSIONS,
        teamSetsNKey: TEAMS_TRY_EXTENSIONS,
        teamSetsLegacyKeysVersion: ours,
        teamSetsNKeysVersion: ours,
      })
    })
  })
})
