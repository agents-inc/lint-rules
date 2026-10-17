import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import type { ESLint, Linter } from 'eslint'
import type { ChangedLines } from '../../cli/check/changed-lines.ts'
import type { FileReports } from '../../cli/check/findings.ts'
import type { InPlaceFixer } from '../../cli/check/fix-writes.ts'
import type { OxlintDiagnostic, OxlintSpan } from '../../cli/check/oxlint-output.ts'
import type { CheckFinding } from '../../cli/check/report.ts'
import type { LintRules } from '../../index.ts'
import type { ProjectFiles } from '../temp-projects.ts'
import { agentsIncLintModuleTextRootedAtItsFolder } from './consumer-project-factories.ts'
import { buildConsumerSettings } from './lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './package-json-factories.ts'

type Rulesets = LintRules['agentRulesets']
type SharedFields = Partial<Omit<LintRules, 'tsconfigRootDir' | 'agentRulesets' | 'editorRulesets'>>

export const CONFIG_FILE = consumerConfigFiles.lintRules
export const PACKAGE_JSON_FILE = 'package.json'
export const DEBUGGER_STATEMENT = 'debugger'

const BUILT_PACKAGE = '@agents-inc/lint-rules'
const LINE_END = '\n'
const ESLINT_ERROR = 2
const ESLINT_WARNING = 1
// What oxlint's JSON report gives a finding of a rule set to warn (measured, 1.87).
const OXLINT_WARNING = 'warning'
const BLOCK_COMMENT_START = '/*'
const BLOCK_COMMENT_END = '*/'
const NOT_FOUND = -1
const UNUSED_SUPPRESSION_LABEL = 'unused suppression'
export const REPORTED_FILE = 'src/a.ts'

/** Their fixtures fire rules that report and never fix. */
export const REDUNDANCY = { quality: ['redundancy'] } as const

export const SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED: SharedFields = { fileOverrides: [{ files: ['src/allowed/**'], allowSuppressions: true }] }

export const NESTED_PACKAGE = 'packages/a'

export const CHECK_INTERRUPTED = 'check: interrupted\n'

export const CHECK_ESLINT_FAILED = 'check: could not run: ESLint failed: '

export function checkConfigText(agentRulesets: Partial<Rulesets>, fields: SharedFields = {}): string {
  return agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings({ agentRulesets }, fields))
}

/** Hands defineLintRules the settings as they are, which may be ones it refuses. */
export function checkConfigTextHanding(settings: unknown): string {
  return `import { defineLintRules } from '${BUILT_PACKAGE}'

export const { eslint, oxlint } = defineLintRules({ tsconfigRootDir: import.meta.dirname, ...${JSON.stringify(settings, null, 2)} }).editorRulesets
`
}

/** Under the folder given, '' for the project's root. */
export function checkedPackageFiles(agentRulesets: Partial<Rulesets>, fields: SharedFields = {}, folder = ''): ProjectFiles {
  return {
    [`${folder}${PACKAGE_JSON_FILE}`]: packageJsonText(buildPackageJson()),
    [`${folder}${CONFIG_FILE}`]: checkConfigText(agentRulesets, fields),
  }
}

export function moduleText(...lines: readonly string[]): string {
  return lines.map((line) => `${line}${LINE_END}`).join('')
}

export function exportedConstant(name: string): string {
  return `export const ${name} = 1`
}

export function exportedValue(name: string, value: unknown): string {
  return `export const ${name} = ${JSON.stringify(value)}`
}

/** Node emits the warning once the module running it has loaded. */
export function emittingAWarning(name: string, message: string): string {
  return `process.emitWarning(${JSON.stringify(message)}, ${JSON.stringify(name)})`
}

export function exportedString(name: string, text: string): string {
  return `export const ${name} = ${JSON.stringify(text)}`
}

/** Parses as `.tsx` and not as `.ts`. */
export function exportedElement(name: string): string {
  return `export const ${name} = <div />`
}

export function exportedTemplate(name: string, middleLine: string): string[] {
  return [`export const ${name} = \``, middleLine, '`']
}

/** oxlint's prefer-const reports it and fixes it to `const`. */
export function exportedLet(name: string): string {
  return `export let ${name} = 1`
}

export function exportedConstFixedFromLet(name: string): string {
  return `export const ${name} = 1`
}

/** A stand-in oxlint fix run: rewrites each file given, leaving others alone as oxlint leaves a file with nothing to fix. */
export function oxlintFixRunWriting(projectDir: string, afterFixes: ProjectFiles): InPlaceFixer {
  return async (paths) => {
    Object.entries(afterFixes).forEach(([file, fixed]) => {
      if (paths.includes(join(projectDir, file))) writeFileSync(join(projectDir, file), fixed)
    })
  }
}

export function wholeFileChanged(): ChangedLines {
  return { wholeFile: true }
}

export function linesChanged(...lines: readonly number[]): ChangedLines {
  return { wholeFile: false, lines: new Set(lines) }
}

/** By its path relative to the config's folder: an error unless given. */
export function buildCheckFinding(fields: Partial<CheckFinding> = {}): CheckFinding {
  return { file: 'src/a.ts', line: 1, label: 'no-console', severity: 'error', message: 'Unexpected console statement.', ...fields }
}

export const ESLINT_FINDING_MESSAGE = 'a fixable finding'

/** At error severity; no rule for one of ESLint's own. */
export function buildLintMessage({ ruleId, line }: { readonly ruleId: string | null; readonly line: number }): Linter.LintMessage {
  return { ruleId, line, column: 1, message: ESLINT_FINDING_MESSAGE, severity: ESLINT_ERROR }
}

export function buildLintWarning({ ruleId, line }: { readonly ruleId: string; readonly line: number }): Linter.LintMessage {
  return { ...buildLintMessage({ ruleId, line }), severity: ESLINT_WARNING }
}

export function buildLintResult(filePath: string, fields: Partial<ESLint.LintResult> = {}): ESLint.LintResult {
  return {
    filePath,
    messages: [],
    suppressedMessages: [],
    errorCount: 0,
    fatalErrorCount: 0,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    usedDeprecatedRules: [],
    ...fields,
  }
}

export type SuppressionForm = 'eslint' | 'oxlint'

/** REPORTED_FILE, suppressions allowed and nothing reported, unless given. */
export function buildFileReports({
  file = REPORTED_FILE,
  lines,
  changed,
  suppressionsAllowed = true,
  eslintMessages = [],
  oxlintDiagnostics = [],
}: {
  readonly file?: string
  readonly lines: readonly string[]
  readonly changed: ChangedLines
  readonly suppressionsAllowed?: boolean
  readonly eslintMessages?: FileReports['eslintMessages']
  readonly oxlintDiagnostics?: FileReports['oxlintDiagnostics']
}): FileReports {
  return { file, text: moduleText(...lines), changed, suppressionsAllowed, eslintMessages, oxlintDiagnostics }
}

/**
* As oxlint spans a suppression comment that silenced nothing: the line (from 1), and its offset and length in
* UTF-8 bytes.
*/
export function spanOfLine(text: string, line: number): OxlintSpan {
  const lines = text.split(LINE_END)
  const spanned = lines[line - 1]
  if (spanned === undefined) throw new Error(`the text has no line ${String(line)}`)
  const before = lines.slice(0, line - 1).map((earlier) => `${earlier}${LINE_END}`)
  return { line, offset: Buffer.byteLength(before.join('')), length: Buffer.byteLength(spanned) }
}

export const OXLINT_FINDING_MESSAGE = 'a finding at each place'

/** oxlint's first label first. */
export function buildOxlintDiagnostic(code: string, ...spans: readonly OxlintSpan[]): OxlintDiagnostic {
  return { code, message: OXLINT_FINDING_MESSAGE, severity: 'error', filename: REPORTED_FILE, spans }
}

export function buildOxlintWarning(code: string, ...spans: readonly OxlintSpan[]): OxlintDiagnostic {
  return { ...buildOxlintDiagnostic(code, ...spans), severity: OXLINT_WARNING }
}

/** oxlint gives it no code (measured, 1.87). */
export function oxlintUnusedSuppression(form: SuppressionForm, span: OxlintSpan): OxlintDiagnostic {
  return { code: null, message: `Unused ${form}-disable directive (no problems were reported).`, severity: 'error', filename: REPORTED_FILE, spans: [span] }
}

/** Where another rule the comment names silenced something: no code, spanning that rule's name (measured, 1.87). */
export function oxlintPartlyUnusedSuppression(form: SuppressionForm, ruleName: string, span: OxlintSpan): OxlintDiagnostic {
  return { code: null, message: `Unused ${form}-disable directive (no problems were reported from ${ruleName}).`, severity: 'error', filename: REPORTED_FILE, spans: [span] }
}

/** No rule reports it (measured, ESLint 10.12). */
export function eslintUnusedSuppression(ruleName: string, line: number): Linter.LintMessage {
  return { ruleId: null, line, column: 1, message: eslintUnusedSuppressionText(ruleName), severity: ESLINT_ERROR }
}

export function eslintUnusedSuppressionText(ruleName: string): string {
  return `Unused eslint-disable directive (no problems were reported from '${ruleName}').`
}

export function suppressionOfTheNextLine(form: SuppressionForm, ruleName: string): string {
  return `// ${form}-disable-next-line ${ruleName}`
}

export const A_SUPPRESSION_REASON = 'kept, while it is debugged'

/** Both engines read the reason after `--`. */
export function suppressionOfTheNextLineWithAReason(form: SuppressionForm, ruleName: string, reason: string): string {
  return `${suppressionOfTheNextLine(form, ruleName)} -- ${reason}`
}

export function blockDisable(form: SuppressionForm, ruleName: string): string {
  return `/* ${form}-disable ${ruleName} */`
}

/** `ruleName` null turns every rule back on. */
export type EnableComment = { readonly form: SuppressionForm; readonly ruleName: string | null }

export function blockEnable({ form, ruleName }: EnableComment): string {
  return ruleName === null ? `/* ${form}-enable */` : `/* ${form}-enable ${ruleName} */`
}

export function blockPairAround(form: SuppressionForm, ruleName: string, between: string): string[] {
  return [blockDisable(form, ruleName), between, blockEnable({ form, ruleName })]
}

export function unusedSuppressionMessageOf(ruleName: string): string {
  return `suppresses ${ruleName}, which reported nothing here`
}

/** In REPORTED_FILE unless a file is given. */
export type UnusedSuppressionAt = { readonly line: number; readonly ruleName: string; readonly file?: string }

export function buildUnusedSuppressionFinding({ line, ruleName, file = REPORTED_FILE }: UnusedSuppressionAt): CheckFinding {
  return buildCheckFinding({ file, line, label: UNUSED_SUPPRESSION_LABEL, message: unusedSuppressionMessageOf(ruleName) })
}

/**
* An enable comment turning back on nothing: no code. oxlint spans the rule it names, or else the comment's text
* inside its delimiters (measured, 1.87).
*/
export function oxlintUnusedEnable(enable: EnableComment, text: string, line: number): OxlintDiagnostic {
  const { form, ruleName } = enable
  const forTheRule = ruleName === null ? '' : ` for ${ruleName}`
  const spanned = ruleName === null ? blockEnable(enable).slice(BLOCK_COMMENT_START.length, -BLOCK_COMMENT_END.length) : ruleName
  return {
    code: null,
    message: `Unused ${form}-enable directive (no matching ${form}-disable directives were found${forTheRule}).`,
    severity: 'error',
    filename: REPORTED_FILE,
    spans: [spanOfTextOnLine(text, line, spanned)],
  }
}

/** No code, and its parser's message (measured, 1.87, at the `=` of `export const = 2`). */
export function oxlintParseError(span: OxlintSpan): OxlintDiagnostic {
  return { code: null, message: 'Unexpected token', severity: 'error', filename: REPORTED_FILE, spans: [span] }
}

export function spanOfTextOnLine(text: string, line: number, spanned: string): OxlintSpan {
  const whole = spanOfLine(text, line)
  const lineText = Buffer.from(text).subarray(whole.offset, whole.offset + whole.length).toString()
  const at = lineText.indexOf(spanned)
  if (at === NOT_FOUND) throw new Error(`line ${String(line)} of the text has no ${spanned}`)
  return { line, offset: whole.offset + Buffer.byteLength(lineText.slice(0, at)), length: Buffer.byteLength(spanned) }
}

/** The fixes check never applies, rule ID to why: one reason for all. */
export function buildWithheldFixes(...ruleIds: readonly string[]): ReadonlyMap<string, string> {
  return new Map(ruleIds.map((ruleId) => [ruleId, 'reorders what the program observes']))
}

export const ERRORS_SUMMARY_TAIL =
  "The list is complete: fix what is in code you wrote, then run check again. Do not read the lint configuration or this package's source; each line says what to fix."

/** After a cut the list is not complete, so the summary does not say it is. */
export const ERRORS_SUMMARY_TAIL_AFTER_A_CUT =
  "Fix what is in code you wrote, then run check again. Do not read the lint configuration or this package's source; each line says what to fix."

/** A finding line's length for which 80 lines fill check's 8,000-character cap, whether or not their newlines count. */
export const LINE_LENGTH_FILLING_THE_CAP_IN_80 = 99

/** The line check prints for the finding. */
export function findingLineOf({ file, line, label, severity, message }: CheckFinding): string {
  const warningMark = severity === 'warning' ? ' (warning)' : ''
  return `${file}:${String(line)} ${label}${warningMark} — ${message}`
}

/** `count` errors in the file, on lines 1 to `count`, each of whose lines is `length` characters long. */
export function findingsOfLineLength(file: string, count: number, length: number): CheckFinding[] {
  return Array.from({ length: count }, (_unused, index) => {
    const unpadded = buildCheckFinding({ file, line: index + 1, message: '' })
    return { ...unpadded, message: 'm'.padEnd(length - findingLineOf(unpadded).length, '.') }
  })
}
