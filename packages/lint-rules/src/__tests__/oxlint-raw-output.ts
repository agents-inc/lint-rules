import { spawnSync } from 'node:child_process'
import { oxlintBin } from '../cli/check/oxlint-run.ts'

/** What the oxlint CLI printed to each stream, and its exit code, unread. */
export type OxlintRawOutput = { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string }

/** The real oxlint CLI over the paths given, with the config file given and a JSON report asked for, as `check` runs it. */
export function rawOxlintOutput(projectDir: string, configFile: string, paths: readonly string[]): OxlintRawOutput {
  const { status, stdout, stderr } = spawnSync(process.execPath, [oxlintBin(), '-c', configFile, '-f', 'json', ...paths], {
    cwd: projectDir,
    encoding: 'utf8',
  })
  return { exitCode: status, stdout, stderr }
}
