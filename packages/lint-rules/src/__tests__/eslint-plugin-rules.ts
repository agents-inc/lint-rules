import { foundOr } from '@workspace/rule-data/collections'
import type { ESLint } from 'eslint'

export function rulesOf(plugin: Readonly<ESLint.Plugin>): NonNullable<ESLint.Plugin['rules']> {
  return foundOr(plugin.rules, 'the plugin has no rules')
}
