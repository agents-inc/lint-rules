import { catalog } from '@workspace/rule-data'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import type { OxlintConfig } from 'oxlint'
import { configErrorIn } from './core/config-error.ts'
import { describePartGiven, isOxlintPart, type OxlintPart } from './core/editor-parts.ts'
import { ruleIdsTheTeamsEslintConfigSets } from './core/eslint-config-reading.ts'
import { refuseUnsupportedInstalledOxlint } from './core/installed-oxlint.ts'
import { mergeOxlintPart, refuseAPathInExtends } from './core/merge-oxlint-config.ts'
import { handOverToTheRead, isInReadingMode, pathOfTheOtherConfigGiven, readTheTeamsEslintConfig, TEAMS_ESLINT_CONFIG } from './core/other-engine-config.ts'

/** The path of the team's ESLint config, relative to tsconfigRootDir, or null where the project has none. */
type TeamEslintConfigPath = { readonly eslintConfig: string | null }

/**
 * The team's oxlint config with the editor set's oxlint part merged in: the team's keys kept, ours
 * in overrides before the team's. `oxlint` is the part exactly as `agents-inc.lint.mts` exports it,
 * undefined where the package.json nearest to `tsconfigRootDir` does not list oxlint; `eslintConfig`
 * the path of the team's ESLint config, relative to tsconfigRootDir, or null where the project has
 * none. A config `theirs` extends must be an object: oxlint refuses a path there in a JS or TS config.
 *
 * Your engine configs override the editor set. If your `eslint.config.mjs` or `oxlint.config.mts`
 * sets a rule anywhere (in any block or override, in a preset you extend, or through an oxlint
 * category you write on), the editor set drops that rule from both engines, in every file, and your
 * setting decides it. That includes a rule you only turn off, or set for some files. A core rule and
 * typescript-eslint's version of it count as one rule. Each merge reads your other engine's config
 * from the path you pass it.
 * oxlint's own `correctness: warn`, which runs where your oxlint config leaves correctness out,
 * sets no rule: where it would run oxlint's copy of a rule the editor set runs in ESLint, the
 * oxlint merge turns that copy off.
 */
export function mergeOxlintConfig(theirs: OxlintConfig, oxlint: OxlintPart | undefined, teamEslintConfig: TeamEslintConfigPath): OxlintConfig {
  if (oxlint === undefined) {
    throw configErrorIn(
      consumerConfigFiles.oxlintConfig,
      'the package.json nearest to tsconfigRootDir does not list oxlint under dependencies or devDependencies, so there is no oxlint part to merge',
    )
  }
  const part = oxlintPartGiven(oxlint)
  refuseUnsupportedInstalledOxlint(part.tsconfigRootDir, catalog)
  const eslintConfigPath = pathOfTheOtherConfigGiven(teamEslintConfig, TEAMS_ESLINT_CONFIG, null)
  refuseAPathInExtends(theirs, consumerConfigFiles.oxlintConfig)
  if (isInReadingMode()) return handedOverToTheRead(theirs)
  const { blocks, ourPlugins } = readTheTeamsEslintConfig(eslintConfigPath, part.tsconfigRootDir)
  return mergeOxlintPart(theirs, part, catalog, ruleIdsTheTeamsEslintConfigSets(blocks, ourPlugins, catalog))
}

/** While an ESLint merge reads the file calling this one: the team's config as given, handed to that read. */
function handedOverToTheRead(theirs: OxlintConfig): OxlintConfig {
  handOverToTheRead({ engine: 'oxlint', config: theirs })
  return theirs
}

/** A team's oxlint config may be untyped, so it may hand over the eslint part, or anything at all. */
function oxlintPartGiven(given: unknown): OxlintPart {
  if (isOxlintPart(given)) return given
  throw configErrorIn(
    consumerConfigFiles.oxlintConfig,
    `mergeOxlintConfig takes the oxlint part ${consumerConfigFiles.lintRules} exports, and was given ${describePartGiven(given)}`,
  )
}
