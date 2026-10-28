import type { Catalog } from '@workspace/rule-data'
import type { ESLint, Linter } from 'eslint'
import { type EslintPluginRegistry, eslintBlocksBeforeTheOffSwitch, pluginsForEveryBlock } from '../core/build-eslint-config.ts'
import type { EslintPart } from '../core/editor-parts.ts'
import { buildEslintSettings } from '../core/eslint-settings.ts'
import { projectFactsOf } from '../core/project-facts.ts'

const NO_TEAM_PLUGINS: ReadonlyMap<string, ESLint.Plugin> = new Map()
const NO_RULE_NAMES: ReadonlyMap<string, readonly string[]> = new Map()

/**
* Our ESLint part laid out as the agent build lays it out, without the merge: the oracle for the rules it states
* with no team config.
*/
export function eslintPartAlone(part: EslintPart, catalog: Readonly<Catalog>, registry: EslintPluginRegistry): Linter.Config[] {
  const projectFacts = projectFactsOf(part.tsconfigRootDir)
  const { globalIgnores, base, afterTheBase } = eslintBlocksBeforeTheOffSwitch(
    {
      layers: part.layers,
      plugins: pluginsForEveryBlock(registry, NO_TEAM_PLUGINS, { ruleNamesRun: NO_RULE_NAMES, ruleNamesStubbed: NO_RULE_NAMES }),
      linterOptions: null,
      settings: buildEslintSettings(projectFacts),
      typeInformation: {
        from: 'ours',
        tsconfigRootDir: part.tsconfigRootDir,
        isOutsideEveryTsconfig: projectFacts.isOutsideEveryTsconfig,
      },
      twinsOnTsFiles: !part.usesOxlint,
    },
    catalog,
  )
  return [...globalIgnores, base, ...afterTheBase]
}
