import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NO_DEBUGGER, OURS_NO_EXPLICIT_ANY_AND_DEBUGGER } from '../__tests__/cases/other-engine-configs.ts'
import { CONSUMER_CONFIG_FILES, mergedEslintConfigText, projectNamingEachConfigText } from '../__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from '../__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from '../__tests__/factories/package-json-factories.ts'
import { severityStatedFor } from '../__tests__/other-engine-merges.ts'
import { mergedConfigsOf, setUpOxlintMergesInOneProcess } from '../__tests__/oxlint-merges-in-one-process.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from '../__tests__/team-configs-of-the-other-engine.ts'
import { installedPackage } from '../__tests__/temp-projects.ts'

// While mergeOxlintConfig reads the team's ESLint config, the mergeEslintConfig call in it hands the team's config over
// unmerged, after checking its third argument as it does when ESLint loads the config. Our oxlint part is merged in a
// process loading the built package, as a team's oxlint run does.

const SOURCE_FILE = 'src/a.ts'
const TYPESCRIPT_ESLINT = installedPackage('typescript-eslint')
const ONE_MERGE = { theirs: EMPTY_TEAM_OXLINT_CONFIG, eslintConfig: CONSUMER_CONFIG_FILES.eslint, times: 1 }

describe("mergeOxlintConfig, reading a team ESLint config whose mergeEslintConfig call is given a third argument", () => {
  const settings = buildConsumerSettings({}, { rules: OURS_NO_EXPLICIT_ANY_AND_DEBUGGER })
  const projectFiles = {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    ...projectNamingEachConfigText(settings, { eslintBlockSources: [], oxlint: EMPTY_TEAM_OXLINT_CONFIG }),
  }
  const namingTheOxlintConfig = setUpOxlintMergesInOneProcess(projectFiles, ONE_MERGE, [TYPESCRIPT_ESLINT])
  const namingNoPath = setUpOxlintMergesInOneProcess(
    {
      ...projectFiles,
      // @ts-expect-error the third argument holds oxlintConfig, the path of the oxlint config or null
      [CONSUMER_CONFIG_FILES.eslint]: mergedEslintConfigText(CONSUMER_CONFIG_FILES.lintRules, CONSUMER_CONFIG_FILES.teamEslintModule, {}),
    },
    ONE_MERGE,
    [TYPESCRIPT_ESLINT],
  )

  it('merges where it names the oxlint config, our no-debugger kept on', () => {
    expect(mergedConfigsOf(namingTheOxlintConfig()).map((merged) => severityStatedFor(merged, SOURCE_FILE, NO_DEBUGGER))).toStrictEqual(['error'])
  })

  it('is refused where it names no path, the error saying what the third argument must hold, as when ESLint loads the config', () => {
    const { projectDir, outcome } = namingNoPath()

    expect(outcome).toStrictEqual({
      refused: `oxlint.config.mts: could not read your ESLint config at ${join(projectDir, CONSUMER_CONFIG_FILES.eslint)}: eslint.config.mjs: mergeEslintConfig needs the path of your oxlint config as its third argument, { oxlintConfig: 'oxlint.config.mts' }, or { oxlintConfig: null } if this project has none: the package.json nearest to tsconfigRootDir lists oxlint`,
    })
  })
})
