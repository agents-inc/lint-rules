import { catalog } from '@workspace/rule-data'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import type { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import { configErrorIn } from './core/config-error.ts'
import { describePartGiven, type EslintPart, isEslintPart } from './core/editor-parts.ts'
import { mergeEslintPart, type TeamEslintConfig } from './core/merge-eslint-config.ts'
import { ruleIdsTheTeamsOxlintConfigSets } from './core/oxlint-config-reading.ts'
import { handOverToTheRead, isInReadingMode, pathOfTheOtherConfigGiven, readTheTeamsOxlintConfig, TEAMS_OXLINT_CONFIG } from './core/other-engine-config.ts'
import { ourPackageJsonFile, versionOf } from './core/package-json-files.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

/** The path of the team's oxlint config, relative to tsconfigRootDir, or null where the project has none. */
type TeamOxlintConfigPath = { readonly oxlintConfig: string | null }

const OXLINT_IS_LISTED = 'the package.json nearest to tsconfigRootDir lists oxlint'

/**
 * The team's ESLint config with the editor set's ESLint part merged in: ours, then the team's
 * blocks. `theirs` is anything ESLint's `defineConfig` takes; `eslint` is the part exactly as
 * `agents-inc.lint.mts` exports it; `oxlintConfig` the path of the team's oxlint config, relative
 * to tsconfigRootDir, or null where the project has none, read only where the project lists oxlint.
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
export function mergeEslintConfig(theirs: TeamEslintConfig, eslint: EslintPart, teamOxlintConfig: TeamOxlintConfigPath): Linter.Config[] {
  const part = eslintPartGiven(eslint)
  const oxlintConfigPath = part.usesOxlint ? pathOfTheOtherConfigGiven(teamOxlintConfig, TEAMS_OXLINT_CONFIG, OXLINT_IS_LISTED) : null
  if (isInReadingMode()) return handedOverToTheRead(theirs)
  const setByTheTeamsOxlintConfig = part.usesOxlint ? ruleIdsTheTeamsOxlintConfigSets(readTheTeamsOxlintConfig(oxlintConfigPath, part.tsconfigRootDir), catalog) : []
  return mergeEslintPart(theirs, part, catalog, eslintPluginRegistry, versionOf(ourPackageJsonFile()), setByTheTeamsOxlintConfig)
}

/** While an oxlint merge reads the file calling this one: the team's config as given, handed to that read with our plugins. */
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
    `mergeEslintConfig takes the eslint part ${consumerConfigFiles.lintRules} exports, and was given ${describePartGiven(given)}`,
  )
}
