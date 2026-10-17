import { oxlintFindingsIn, runOxlintCli, writeOxlintConfigFile } from './engine-clis.ts'
import type { ProjectFiles } from './temp-projects.ts'

const CONFIG_FILE = 'ignore-patterns.oxlintrc.json'
// oxlint refuses to run when every path it is given is ignored, so it is always given one more file,
// which no list of ours names.
const FILE_NO_LIST_IGNORES = 'unignored.cts'
// What every file holds: a statement no-debugger reports in every file oxlint lints.
const STATEMENT_REPORTED_EVERYWHERE = 'debugger\n'

export function projectFilesOxlintReportsIn(files: readonly string[]): ProjectFiles {
  return Object.fromEntries([...files, FILE_NO_LIST_IGNORES].map((file) => [file, STATEMENT_REPORTED_EVERYWHERE]))
}

/** Each file given by its path, as an editor hands it one: the files no-debugger reports in. */
export function filesOxlintLintsUnderIgnorePatterns(projectDir: string, ignorePatterns: readonly string[], files: readonly string[]): string[] {
  writeOxlintConfigFile(projectDir, CONFIG_FILE, { categories: { correctness: 'off' }, rules: { 'no-debugger': 'error' }, ignorePatterns: [...ignorePatterns] })
  const reported = oxlintFindingsIn(runOxlintCli(projectDir, CONFIG_FILE, [...files, FILE_NO_LIST_IGNORES]).report).map(({ file }) => file)
  if (!reported.includes(FILE_NO_LIST_IGNORES)) throw new Error(`${FILE_NO_LIST_IGNORES} is ignored by ${JSON.stringify(ignorePatterns)}: oxlint linted nothing it could be told apart from`)
  return files.filter((file) => reported.includes(file))
}
