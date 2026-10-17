import { noteLine } from '../command-lines.ts'

const COMMAND = 'check'
// Follows "Fix " or "The list is complete: fix ".
const ERRORS_ADVICE = "what is in code you wrote, then run check again. Do not read the lint configuration or this package's source; each line says what to fix."
const LIST_IS_COMPLETE = 'The list is complete'

export const PARSE_ERROR_LABEL = 'parse error'
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

/** First: an agent's next edit of a file it holds open would fail otherwise. */
export function autofixedLine(files: readonly string[]): string {
  return `${COMMAND}: autofixed ${files.join(', ')}; read them again before editing them.`
}

export function cutLine(findingCount: number, fileCount: number): string {
  return `+${countOf(findingCount, 'more finding', 'more findings')} in ${countOf(fileCount, 'file', 'files')}. Fix the ones above, then run check again to see them.`
}

export type ListPrinted = 'complete' | 'cut'

export type SummaryCounts = {
  readonly errors: number
  readonly warnings: number
  readonly filesWithFindings: number
  readonly changedFiles: number
  readonly list: ListPrinted
}

/** Under a cut, it does not call the list complete. */
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

function errorsAdvice(list: ListPrinted): string {
  return list === 'complete' ? `${LIST_IS_COMPLETE}: fix ${ERRORS_ADVICE}` : `Fix ${ERRORS_ADVICE}`
}

/** Changed files outside the config's folder are left to that folder's own config. */
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
