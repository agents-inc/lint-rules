import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { EslintPluginRegistry } from './core/build-eslint-config.ts'
import { withCompatLayerWhereNeeded } from './core/eslint-compat.ts'
import { withReExportCyclesCut } from './core/re-export-cycles.ts'

export const eslintPluginRegistry: EslintPluginRegistry = Object.fromEntries(
  Object.entries(eslintPlugins).map(([prefix, plugin]) => [prefix, withCompatLayerWhereNeeded(prefix, withReExportCyclesCut(prefix, plugin))]),
)
