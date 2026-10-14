import { fixupPluginRules } from '@eslint/compat'
import type { ESLint } from 'eslint'

// These plugins call context methods ESLint removed; the compat layer puts them back, replacing
// the patch-package patches the gate carried. react calls `context.getFilename()` to detect the
// React version, so without it the `react.version: 'detect'` setting aborts the run.
const PREFIXES_NEEDING_COMPAT: ReadonlySet<string> = new Set(['css-modules', 'react', 'react-hook-form'])

/**
 * The plugin through the compat layer when its prefix needs it, whoever registers it: a team's raw
 * object under one of these prefixes crashes too once our settings apply to it (measured, react).
 */
export function withCompatLayerWhereNeeded(prefix: string, plugin: ESLint.Plugin): ESLint.Plugin {
  return PREFIXES_NEEDING_COMPAT.has(prefix) ? fixupPluginRules(plugin) : plugin
}
