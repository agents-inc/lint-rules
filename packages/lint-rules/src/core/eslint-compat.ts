import { fixupPluginRules } from '@eslint/compat'
import { PREFIXES_NEEDING_COMPAT } from '@workspace/rule-data/eslint-plugins'
import type { ESLint } from 'eslint'

/** Whoever registers it: a team's raw object under one of these prefixes crashes too once our settings apply (measured, react). */
export function withCompatLayerWhereNeeded(prefix: string, plugin: Readonly<ESLint.Plugin>): ESLint.Plugin {
  return PREFIXES_NEEDING_COMPAT.has(prefix) ? fixupPluginRules(plugin) : plugin
}
