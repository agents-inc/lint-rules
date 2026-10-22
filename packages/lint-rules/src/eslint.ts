import { catalog } from '@workspace/rule-data'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import type { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import { configErrorIn } from './core/config-error.ts'
import { type EslintPart, isEslintPart, isOxlintPart } from './core/editor-parts.ts'
import { refuseUnsupportedInstalledEslint } from './core/installed-eslint.ts'
import { mergeEslintPart, type TeamEslintConfig } from './core/merge-eslint-config.ts'
import { ruleIdsTheTeamsOxlintConfigSets } from './core/oxlint-config-reading.ts'
import { handOverToTheRead, isInReadingMode, pathOfTheTeamsOxlintConfigGiven, readTheTeamsOxlintConfig } from './core/other-engine-config.ts'
import { ourPackageJsonFile, versionOf } from './core/package-json-files.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

/** The team's oxlint config path, relative to tsconfigRootDir, or null if there is none. */
type TeamOxlintConfigPath = { readonly oxlintConfig: string | null }

const OXLINT_IS_LISTED = 'the package.json nearest to tsconfigRootDir lists oxlint'

/**
 * Your ESLint config with the editor set's ESLint part merged in before your blocks. A rule your
 * ESLint or oxlint config sets anywhere is left to your setting. Requires ESLint 10+.
 */
export function mergeEslintConfig(theirs: TeamEslintConfig, eslint: EslintPart, teamOxlintConfig: TeamOxlintConfigPath): Linter.Config[] {
  const part = eslintPartGiven(eslint)
  refuseUnsupportedInstalledEslint(part.tsconfigRootDir)
  const oxlintConfigPath = part.usesOxlint ? pathOfTheTeamsOxlintConfigGiven(teamOxlintConfig, OXLINT_IS_LISTED) : null
  if (isInReadingMode()) return handedOverToTheRead(theirs)
  const setByTheTeamsOxlintConfig = ruleIdsSetByTheTeamsOxlintConfig(part, oxlintConfigPath)
  return mergeEslintPart(theirs, part, catalog, eslintPluginRegistry, versionOf(ourPackageJsonFile()), setByTheTeamsOxlintConfig)
}

/** None where the project does not list oxlint. */
function ruleIdsSetByTheTeamsOxlintConfig({ usesOxlint, tsconfigRootDir }: EslintPart, oxlintConfigPath: string | null): string[] {
  if (!usesOxlint) return []
  return ruleIdsTheTeamsOxlintConfigSets(readTheTeamsOxlintConfig(oxlintConfigPath, tsconfigRootDir), catalog)
}

/** While an oxlint merge reads this config: hand it the team's blocks and our plugins, unmerged. */
function handedOverToTheRead(theirs: TeamEslintConfig): Linter.Config[] {
  const blocks = defineConfig(theirs)
  handOverToTheRead({ engine: 'eslint', config: { blocks, ourPlugins: eslintPluginRegistry } })
  return blocks
}

/** A team's eslint.config.mjs is untyped, so it may hand over the oxlint part, or anything at all. */
function eslintPartGiven(given: unknown): EslintPart {
  if (isEslintPart(given)) return given
  throw configErrorIn(
    consumerConfigFiles.eslintConfig,
    `mergeEslintConfig takes the eslint part ${consumerConfigFiles.lintRules} exports, and was given ${whatWasGivenInPlaceOfTheEslintPart(given)}`,
  )
}

function whatWasGivenInPlaceOfTheEslintPart(given: unknown): string {
  return isOxlintPart(given) ? 'its oxlint part' : 'a value that is neither of its parts'
}
