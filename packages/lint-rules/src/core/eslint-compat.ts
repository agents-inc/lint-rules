import { fixupPluginRules } from '@eslint/compat'
import type { ESLint } from 'eslint'

// These plugins call context methods ESLint removed; the compat layer puts them back. Without it, react's
// `version: 'detect'` aborts the run.
const PREFIXES_NEEDING_COMPAT: ReadonlySet<string> = new Set(['css-modules', 'react', 'react-hook-form'])

/** Whoever registers it: a team's raw object under one of these prefixes crashes too once our settings apply (measured, react). */
export function withCompatLayerWhereNeeded(prefix: string, plugin: ESLint.Plugin): ESLint.Plugin {
  return PREFIXES_NEEDING_COMPAT.has(prefix) ? fixupPluginRules(plugin) : plugin
}
