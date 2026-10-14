import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { EslintPluginRegistry } from './core/build-eslint-config.ts'
import { withCompatLayerWhereNeeded } from './core/eslint-compat.ts'

/** Every ESLint plugin we ship, keyed by rule-ID prefix, each through the compat layer where its prefix needs it. */
export const eslintPluginRegistry: EslintPluginRegistry = Object.fromEntries(
  Object.entries(eslintPlugins).map(([prefix, plugin]) => [prefix, withCompatLayerWhereNeeded(prefix, plugin)]),
)
