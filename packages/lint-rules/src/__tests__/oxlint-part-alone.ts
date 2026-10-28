import type { Catalog } from '@workspace/rule-data'
import type { OxlintConfig, RuleCategories } from 'oxlint'
import {
  oxlintEnvOf,
  oxlintIgnorePatternsOf,
  oxlintOverridesOf,
  oxlintPluginsOf,
  topLevelRuleMap,
} from '../core/build-oxlint-config.ts'
import type { OxlintPart } from '../core/editor-parts.ts'
import { ruleSettingsOfEveryLayer } from '../core/resolve-rule-layers.ts'

// With every category off, a plugin listed runs only the rules a config names.
const EVERY_CATEGORY_OFF = {
  correctness: 'off',
  nursery: 'off',
  pedantic: 'off',
  perf: 'off',
  restriction: 'off',
  style: 'off',
  suspicious: 'off',
} as const satisfies Required<RuleCategories>

/**
* Our oxlint part laid out as the agent build lays it out: the oracle for the rules it states with no team
* config. The rules the ESLint part runs, oxlint does not run here.
*/
export function oxlintPartAlone({ layers }: OxlintPart, catalog: Readonly<Catalog>): OxlintConfig {
  return {
    categories: { ...EVERY_CATEGORY_OFF },
    plugins: oxlintPluginsOf(ruleSettingsOfEveryLayer(layers), catalog),
    env: oxlintEnvOf(layers),
    ignorePatterns: oxlintIgnorePatternsOf(layers),
    rules: topLevelRuleMap(layers, catalog),
    overrides: oxlintOverridesOf(layers, catalog),
  }
}
