import { pluginPrefixOf } from '../rule-id-parts.ts'

const PREFIX_SEPARATOR = '/'

/**
 * A rule ID without its plugin prefix, split where ESLint splits it: `n/prefer-global/buffer` →
 * `prefer-global/buffer`. An oxlint name splits the same way: its scope is one segment.
 */
export function ruleNameOf(ruleId: string): string {
  const prefix = pluginPrefixOf(ruleId)
  return prefix === null ? ruleId : ruleId.slice(prefix.length + PREFIX_SEPARATOR.length)
}
