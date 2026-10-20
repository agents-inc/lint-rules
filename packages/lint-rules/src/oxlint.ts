import { catalog } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import type { OxlintConfig } from 'oxlint'
import { configProblemIn } from './core/config-error.ts'
import type { OxlintPart } from './core/editor-parts.ts'
import { ruleIdsTheTeamsEslintConfigSets } from './core/eslint-config-reading.ts'
import { refuseUnsupportedInstalledOxlint } from './core/installed-oxlint.ts'
import { mergeOxlintPart, refuseAPathInExtends } from './core/merge-oxlint-config.ts'
import { handOverToTheRead, isInReadingMode, readTheTeamsEslintConfig } from './core/other-engine-config.ts'

/** The team's ESLint config path, relative to tsconfigRootDir, or null if there is none. */
type TeamEslintConfigPath = { readonly eslintConfig: string | null }

const NO_OXLINT_PART = configProblemIn(
  consumerConfigFiles.oxlintConfig,
  'the package.json nearest to tsconfigRootDir does not list oxlint under dependencies or devDependencies, so there is no oxlint part to merge',
)

/**
 * Your oxlint config with the editor set's oxlint part merged in as overrides before yours. A rule
 * your ESLint or oxlint config sets anywhere is left to your setting. `extends` must hold objects, not paths.
 */
export function mergeOxlintConfig(theirs: OxlintConfig, oxlint: OxlintPart | undefined, teamEslintConfig: TeamEslintConfigPath): OxlintConfig {
  const part = foundOr(oxlint, NO_OXLINT_PART)
  refuseUnsupportedInstalledOxlint(part.tsconfigRootDir, catalog)
  const eslintConfigPath = teamEslintConfig.eslintConfig
  refuseAPathInExtends(theirs, consumerConfigFiles.oxlintConfig)
  if (isInReadingMode()) return handedOverToTheRead(theirs)
  const { blocks, ourPlugins } = readTheTeamsEslintConfig(eslintConfigPath, part.tsconfigRootDir)
  return mergeOxlintPart(theirs, part, catalog, ruleIdsTheTeamsEslintConfigSets(blocks, ourPlugins, catalog))
}

/** While an ESLint merge reads this config: hand it the team's config, unmerged. */
function handedOverToTheRead(theirs: OxlintConfig): OxlintConfig {
  handOverToTheRead({ engine: 'oxlint', config: theirs })
  return theirs
}
