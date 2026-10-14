import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import { isObject } from '../is-object.ts'

// oxlint's package exports no path to its CLI; the CLI sits at bin/oxlint beside its manifest.
export const OXLINT_BIN = join(dirname(createRequire(import.meta.url).resolve('oxlint/package.json')), 'bin', 'oxlint')

/** What the installed oxlint made of a config file: the native rule names it resolved, or its refusal. */
export type PrintedOxlintConfig =
  | { readonly status: 'loaded'; readonly ruleNames: readonly string[] }
  | { readonly status: 'refused'; readonly output: string }

/** Runs the installed oxlint with `--print-config`, which resolves every rule key without linting. */
export function printOxlintConfig(configPath: string): PrintedOxlintConfig {
  const { status, stdout, stderr } = spawnSync(process.execPath, [OXLINT_BIN, '-c', configPath, '--print-config'], {
    encoding: 'utf8',
  })
  if (status !== 0) return { status: 'refused', output: `${stdout}${stderr}` }
  return { status: 'loaded', ruleNames: printedRuleNamesOf(stdout) }
}

/** The rule names a printed config sets, in ascending code-unit order. */
export function printedRuleNamesOf(printed: string): readonly string[] {
  const config: unknown = JSON.parse(printed)
  if (!isObject(config) || !('rules' in config) || !isObject(config.rules)) {
    throw new Error(`oxlint --print-config printed no rules object: ${printed}`)
  }
  return Object.keys(config.rules).toSorted()
}
