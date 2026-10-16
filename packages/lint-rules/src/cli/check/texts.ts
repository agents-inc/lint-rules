// Every line `check` prints (spec-cli.md "Output contract"; owner, q-c4: as concise as possible
// while giving sub-agents enough context). stdout carries the findings and the summary, stderr the
// notes and why check could not run.

import { noteLine } from '../command-lines.ts'

const COMMAND = 'check'
// What to do with the errors listed, after "Fix " or "The list is complete: fix ".
const ERRORS_ADVICE = "what is in code you wrote, then run check again. Do not read the lint configuration or this package's source; each line says what to fix."
const LIST_IS_COMPLETE = 'The list is complete'

/** A finding's label where the file does not parse, in place of a rule ID (q-c10). */
export const PARSE_ERROR_LABEL = 'parse error'
/** A finding's label for a suppression comment that silenced nothing (q-c15, P8). */
export const UNUSED_SUPPRESSION_LABEL = 'unused suppression'
export const WARNING_MARK = ' (warning)'
export const MESSAGE_SEPARATOR = ' — '

export const NOTHING_TO_CHECK = `${COMMAND}: no changed JS or TS files.`

/** `1 error`, `2 errors`. */
export function countOf(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`
}

export function unusedSuppressionMessage(ruleName: string): string {
  return `suppresses ${ruleName}, which reported nothing here`
}

/** The first stdout line where check changed files (P2): an agent's next edit of a file it holds open would fail otherwise. */
export function autofixedLine(files: readonly string[]): string {
  return `${COMMAND}: autofixed ${files.join(', ')}; read them again before editing them.`
}

/** In place of the findings past the cut (c5-again). */
export function cutLine(findingCount: number, fileCount: number): string {
  return `+${countOf(findingCount, 'more finding', 'more findings')} in ${countOf(fileCount, 'file', 'files')}. Fix the ones above, then run check again to see them.`
}

/** Whether the findings printed are all of them, or the cut left some out. */
export type ListPrinted = 'complete' | 'cut'

export type SummaryCounts = {
  readonly errors: number
  readonly warnings: number
  readonly filesWithFindings: number
  readonly changedFiles: number
  readonly list: ListPrinted
}

/** The last stdout line: errors left, warnings only, or nothing (q-c3, q-c4). Under a cut, it does not call the list complete. */
export function summaryLine({ errors, warnings, filesWithFindings, changedFiles, list }: SummaryCounts): string {
  const ofChangedFiles = `${String(filesWithFindings)} of ${countOf(changedFiles, 'changed file', 'changed files')}`
  if (errors > 0) {
    return `${COMMAND}: ${countOf(errors, 'error', 'errors')} and ${countOf(warnings, 'warning', 'warnings')} in ${ofChangedFiles}. ${errorsAdvice(list)}`
  }
  if (warnings > 0) {
    const warningsLeft = `${COMMAND}: no errors; ${countOf(warnings, 'warning', 'warnings')} in ${ofChangedFiles}.`
    return list === 'complete' ? `${warningsLeft} ${LIST_IS_COMPLETE}.` : warningsLeft
  }
  return `${COMMAND}: no findings in ${countOf(changedFiles, 'changed file', 'changed files')}.`
}

/** What to do with the errors listed: the list is called complete only where the cut left none out. */
function errorsAdvice(list: ListPrinted): string {
  return list === 'complete' ? `${LIST_IS_COMPLETE}: fix ${ERRORS_ADVICE}` : `Fix ${ERRORS_ADVICE}`
}

/** The one note (q-c6): changed files outside the config's folder, which check leaves to that folder's own config. */
export function skippedNote(count: number, configFolder: string): string {
  return noteLine(COMMAND, `skipped ${countOf(count, 'changed file', 'changed files')} outside ${configFolder}.`)
}

export function notInGit(cwd: string): string {
  return `${cwd} is not inside a git repository, and check reads the changed files from git.`
}

export function noConfig(cwd: string, gitTopLevel: string, configFile: string): string {
  return `there is no ${configFile} in ${cwd} or any folder above it up to ${gitTopLevel}. Run "agents-inc-lint init" in the folder of the package to lint.`
}

export function anotherCopy(configFile: string, packageName: string, importedFrom: string, ours: string): string {
  return `${configFile} imports ${packageName} from ${importedFrom}, and this check is ${ours}. Run the check that project installed.`
}

export function notInstalled(configFile: string, packageName: string): string {
  return `${packageName} is not installed where ${configFile} can import it. Run your package manager's install.`
}

/** The config imported, but exports no part defineLintRules returned. */
export const NO_ESLINT_PART_EXPORTED =
  'it exports no `eslint` part that defineLintRules returned: end it with `export const { eslint, oxlint } = config.editorRulesets`'

export const OXLINT_PRINTED_NOTHING = 'it printed nothing'

export function gitFailed(firstLine: string): string {
  return `git failed: ${firstLine}`
}

export function oxlintFailed(printed: string): string {
  return `oxlint failed: ${printed}`
}

export function eslintFailed(message: string): string {
  return `ESLint failed: ${message}`
}
