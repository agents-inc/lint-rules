import { spawnSync } from 'node:child_process'

/** Where a Node script runs, how long it may run, and how a test names its failure. */
export type NodeScriptRun = { readonly cwd?: string; readonly timeoutMs?: number; readonly whatFailed: string }

/** In a Node process of its own: what it printed to stdout. Throws, quoting stderr, where it exits other than 0. */
export function runNodeScript(script: string, args: readonly string[], { cwd, timeoutMs, whatFailed }: NodeScriptRun): string {
  const { status, stdout, stderr } = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: timeoutMs })
  if (status !== 0) throw new Error(`${whatFailed} (exit ${String(status)}): ${stderr}`)
  return stdout
}
