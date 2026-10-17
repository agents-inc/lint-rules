import { spawnSync } from 'node:child_process'
import { oxlintBin } from '../cli/check/oxlint-run.ts'
import { oxlintPluginListedAs } from './oxlint-rule-keys.ts'

/** One rule as `oxlint --rules -f json` prints it: its plugin as `scope` (`jsx_a11y`), its name as `value`. */
type ListedRule = { readonly scope: string; readonly value: string }

/** As the catalog spells them, one per run of one plugin's rules: a plugin whose rules are not kept together comes twice. */
export function pluginsInTheInstalledOxlintsRuleOrder(): string[] {
  const plugins = installedOxlintRules().map(({ scope }) => oxlintPluginListedAs(scope))
  return plugins.filter((plugin, index) => plugins[index - 1] !== plugin)
}

function installedOxlintRules(): readonly ListedRule[] {
  const { status, stdout, stderr } = spawnSync(process.execPath, [oxlintBin(), '--rules', '-f', 'json'], { encoding: 'utf8' })
  if (status !== 0) throw new Error(`oxlint --rules exited ${String(status)}: ${stderr}`)
  // Parse boundary: oxlint's JSON rule list.
  return JSON.parse(stdout) as ListedRule[]
}
