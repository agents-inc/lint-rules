import type { Catalog } from '@workspace/rule-data'
import type { ESLint, Linter } from 'eslint'
import { type EslintPluginRegistry, eslintBlocksBeforeTheOffSwitch, pluginsForEveryBlock } from '../core/build-eslint-config.ts'
import type { EslintPart } from '../core/editor-parts.ts'
import { tsFilesOutsideEveryTsconfig } from '../core/ts-files-outside-every-tsconfig.ts'

const NO_TEAM_PLUGINS: ReadonlyMap<string, ESLint.Plugin> = new Map()
const NO_RULE_NAMES: ReadonlyMap<string, readonly string[]> = new Map()

/**
 * Our ESLint part as a config of its own, built without the merge and laid out as the agent build
 * lays out its ESLint config: our ignores as global ignores, then the base block and every block
 * after it, on our own type information, which leaves out the TS files outside every tsconfig. What
 * our part gives with no team config: the oracle for the rules it states. It states no ESLint name
 * of a rule our oxlint part runs, and registers the plugins as the registry holds them.
 */
export function eslintPartAlone(part: EslintPart, catalog: Catalog, registry: EslintPluginRegistry): Linter.Config[] {
  const { globalIgnores, base, afterTheBase } = eslintBlocksBeforeTheOffSwitch(
    {
      layers: part.layers,
      plugins: pluginsForEveryBlock(registry, NO_TEAM_PLUGINS, { ruleNamesRun: NO_RULE_NAMES, ruleNamesStubbed: NO_RULE_NAMES }),
      linterOptions: null,
      typeInformation: {
        from: 'ours',
        tsconfigRootDir: part.tsconfigRootDir,
        tsFilesOutsideEveryTsconfig: tsFilesOutsideEveryTsconfig(part.tsconfigRootDir),
      },
      twinsOnTsFiles: !part.usesOxlint,
    },
    catalog,
  )
  return [...globalIgnores, base, ...afterTheBase]
}
