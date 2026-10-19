import { type OxlintCliOutput, oxlintCliOutputIn } from '@workspace/rule-data/test-support/oxlint-cli'

/** The real oxlint CLI over the paths given, with the config file given and a JSON report asked for, as `check` runs it. */
export function rawOxlintOutput(projectDir: string, configFile: string, paths: readonly string[]): OxlintCliOutput {
  return oxlintCliOutputIn(projectDir, ['-c', configFile, '-f', 'json', ...paths])
}

/** As a root git hook or CI runs it: no config file named, so oxlint takes the one in the folder it starts in and each one below. */
export function rawOxlintOutputFindingItsConfigs(cwd: string, paths: readonly string[]): OxlintCliOutput {
  return oxlintCliOutputIn(cwd, ['-f', 'json', ...paths])
}
