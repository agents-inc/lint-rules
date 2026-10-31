import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { ESLint } from 'eslint'
import type { EslintPluginRegistry } from './core/build-eslint-config.ts'
import { withCompatLayerWhereNeeded } from './core/eslint-compat.ts'
import { withImmutabilityCachedPerCall } from './core/immutability-cache-per-call.ts'
import { withReExportCyclesCut } from './core/re-export-cycles.ts'
import { withReturnedUsingResourcesLeftAlone } from './core/returned-using-resources.ts'

export const eslintPluginRegistry: EslintPluginRegistry = Object.fromEntries(Object.entries(eslintPlugins).map(([prefix, plugin]) => [prefix, registered(prefix, plugin)]))

/** Each wrapper changes only the plugins it names, and gives every other back as it is. */
function registered(prefix: string, plugin: Readonly<ESLint.Plugin>): ESLint.Plugin {
  return withCompatLayerWhereNeeded(prefix, withImmutabilityCachedPerCall(prefix, withReExportCyclesCut(prefix, withReturnedUsingResourcesLeftAlone(prefix, plugin))))
}
