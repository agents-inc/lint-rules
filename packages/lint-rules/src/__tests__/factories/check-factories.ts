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
/** The file a unit test's reports are on, as check prints it. */
export const REPORTED_FILE = 'src/a.ts'

/** The agent rulesets most check runs use: their fixtures fire rules that report and never fix. */
export const REDUNDANCY = { quality: ['redundancy'] } as const

/** Settings that allow suppression comments in the files under src/allowed (q-c15). */
export const SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED: SharedFields = { fileOverrides: [{ files: ['src/allowed/**'], allowSuppressions: true }] }

/** A package's folder below the repo's top level, as in a monorepo. */
export const NESTED_PACKAGE = 'packages/a'

/** check's stderr where a signal stopped it (q-c2). */
export const CHECK_INTERRUPTED = 'check: interrupted\n'

/** How check's stderr starts where ESLint failed. */
export const CHECK_ESLINT_FAILED = 'check: could not run: ESLint failed: '

/** agents-inc.lint.mts listing the agent rulesets given and the other settings given, the editor set empty. */
export function checkConfigText(agentRulesets: Partial<Rulesets>, fields: SharedFields = {}): string {
  return agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings({ agentRulesets }, fields))
}

/**
 * agents-inc.lint.mts handing defineLintRules the settings given as they are, which may be ones it
 * refuses, rooted at its own folder.
 */
export function checkConfigTextHanding(settings: unknown): string {
  return `import { defineLintRules } from '${BUILT_PACKAGE}'

export const { eslint, oxlint } = defineLintRules({ tsconfigRootDir: import.meta.dirname, ...${JSON.stringify(settings, null, 2)} }).editorRulesets
`
}

/** A package's own files for check: its package.json and agents-inc.lint.mts, under the folder given ('' for the project's root). */
export function checkedPackageFiles(agentRulesets: Partial<Rulesets>, fields: SharedFields = {}, folder = ''): ProjectFiles {
  return {
    [`${folder}${PACKAGE_JSON_FILE}`]: packageJsonText(buildPackageJson()),
    [`${folder}${CONFIG_FILE}`]: checkConfigText(agentRulesets, fields),
  }
}

/** A module's text: the lines given, each ending in a newline. */
export function moduleText(...lines: readonly string[]): string {
  return lines.map((line) => `${line}${LINE_END}`).join('')
}

/** A line exporting a constant, named so no two files share it. */
export function exportedConstant(name: string): string {
  return `export const ${name} = 1`
}

/** A line exporting a constant that holds the value given, written as JSON. */
export function exportedValue(name: string, value: unknown): string {
  return `export const ${name} = ${JSON.stringify(value)}`
}

/** A line that has Node emit a warning of the name and message given, once the module running it has loaded. */
export function emittingAWarning(name: string, message: string): string {
  return `process.emitWarning(${JSON.stringify(message)}, ${JSON.stringify(name)})`
}

/** A line exporting a string constant that holds the text given, in double quotes. */
export function exportedString(name: string, text: string): string {
  return `export const ${name} = ${JSON.stringify(text)}`
}

/** A line exporting a JSX element: it parses as a `.tsx` file and not as a `.ts` one. */
export function exportedElement(name: string): string {
  return `export const ${name} = <div />`
}

/** Three lines exporting a template literal whose middle line is the text given. */
export function exportedTemplate(name: string, middleLine: string): string[] {
  return [`export const ${name} = \``, middleLine, '`']
}

/** A line exporting a `let` nothing reassigns: oxlint's prefer-const reports it and fixes it to `const`. */
export function exportedLet(name: string): string {
  return `export let ${name} = 1`
}

/** That line as prefer-const's fix leaves it. */
export function exportedConstFixedFromLet(name: string): string {
  return `export const ${name} = 1`
}

/**
 * oxlint's fix run as a stand-in: it writes the text after its fixes of each file given that has one,
 * by its path in the project, and leaves any other file alone, as oxlint leaves a file it finds
 * nothing to fix in.
 */
export function oxlintFixRunWriting(projectDir: string, afterFixes: ProjectFiles): InPlaceFixer {
  return async (paths) => {
    Object.entries(afterFixes).forEach(([file, fixed]) => {
      if (paths.includes(join(projectDir, file))) writeFileSync(join(projectDir, file), fixed)
    })
  }
}

/** A file whose lines all change: ESLint's ChangedLines for it. */
export function wholeFileChanged(): ChangedLines {
  return { wholeFile: true }
}

/** A file of which only the lines given changed. */
export function linesChanged(...lines: readonly number[]): ChangedLines {
  return { wholeFile: false, lines: new Set(lines) }
}

/** A finding as check reports it, by its path relative to the config's folder: an error unless given. */
export function buildCheckFinding(fields: Partial<CheckFinding> = {}): CheckFinding {
  return { file: 'src/a.ts', line: 1, label: 'no-console', severity: 'error', message: 'Unexpected console statement.', ...fields }
}

/** The message of every message buildLintMessage makes. */
export const ESLINT_FINDING_MESSAGE = 'a fixable finding'

/** One ESLint message, at error severity, with the rule and line given: no rule for one of ESLint's own. */
export function buildLintMessage({ ruleId, line }: { readonly ruleId: string | null; readonly line: number }): Linter.LintMessage {
  return { ruleId, line, column: 1, message: ESLINT_FINDING_MESSAGE, severity: ESLINT_ERROR }
}

/** As buildLintMessage, of a rule a team set to warn. */
export function buildLintWarning({ ruleId, line }: { readonly ruleId: string; readonly line: number }): Linter.LintMessage {
  return { ...buildLintMessage({ ruleId, line }), severity: ESLINT_WARNING }
}

/** ESLint's result on the file at the path given: no message and no fixed text, unless given. */
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

/** A suppression comment's form: which engine's name it starts with. */
export type SuppressionForm = 'eslint' | 'oxlint'

/** A file both engines reported on, with the lines given: REPORTED_FILE, suppressions allowed, and neither engine reported anything, unless given. */
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
 * Where the whole of one line of the module text is, as oxlint gives a span: the line (from 1), and
 * its offset and length in UTF-8 bytes. oxlint spans a suppression comment that silenced nothing this way.
 */
export function spanOfLine(text: string, line: number): OxlintSpan {
  const lines = text.split(LINE_END)
  const spanned = lines[line - 1]
  if (spanned === undefined) throw new Error(`the text has no line ${String(line)}`)
  const before = lines.slice(0, line - 1).map((earlier) => `${earlier}${LINE_END}`)
  return { line, offset: Buffer.byteLength(before.join('')), length: Buffer.byteLength(spanned) }
}

/** The message of every finding buildOxlintDiagnostic makes. */
export const OXLINT_FINDING_MESSAGE = 'a finding at each place'

/** An oxlint finding of the rule whose code is given, at each place given, oxlint's first label first. */
export function buildOxlintDiagnostic(code: string, ...spans: readonly OxlintSpan[]): OxlintDiagnostic {
  return { code, message: OXLINT_FINDING_MESSAGE, severity: 'error', filename: REPORTED_FILE, spans }
}

/** As buildOxlintDiagnostic, of a rule a team set to warn. */
export function buildOxlintWarning(code: string, ...spans: readonly OxlintSpan[]): OxlintDiagnostic {
  return { ...buildOxlintDiagnostic(code, ...spans), severity: OXLINT_WARNING }
}

/** oxlint's report of a suppression comment, at its span, that silenced nothing: oxlint gives it no code (measured, 1.87). */
export function oxlintUnusedSuppression(form: SuppressionForm, span: OxlintSpan): OxlintDiagnostic {
  return { code: null, message: `Unused ${form}-disable directive (no problems were reported).`, severity: 'error', filename: REPORTED_FILE, spans: [span] }
}

/**
 * oxlint's report of one rule a suppression comment names that silenced nothing, where another it
 * names silenced something: no code, spanning that rule's name (measured, 1.87).
 */
export function oxlintPartlyUnusedSuppression(form: SuppressionForm, ruleName: string, span: OxlintSpan): OxlintDiagnostic {
  return { code: null, message: `Unused ${form}-disable directive (no problems were reported from ${ruleName}).`, severity: 'error', filename: REPORTED_FILE, spans: [span] }
}

/** ESLint's report of a suppression comment on the line given that silenced nothing of the rule named: no rule reports it (measured, 10.12). */
export function eslintUnusedSuppression(ruleName: string, line: number): Linter.LintMessage {
  return { ruleId: null, line, column: 1, message: eslintUnusedSuppressionText(ruleName), severity: ESLINT_ERROR }
}

/** The text of ESLint's report of a suppression comment that silenced nothing of the rule named. */
export function eslintUnusedSuppressionText(ruleName: string): string {
  return `Unused eslint-disable directive (no problems were reported from '${ruleName}').`
}

/** A suppression comment, in the form given, of the rule named on the next line. */
export function suppressionOfTheNextLine(form: SuppressionForm, ruleName: string): string {
  return `// ${form}-disable-next-line ${ruleName}`
}

/** A reason a suppression comment gives after `--`. */
export const A_SUPPRESSION_REASON = 'kept, while it is debugged'

/** As suppressionOfTheNextLine, giving the reason after `--`, as both engines read it. */
export function suppressionOfTheNextLineWithAReason(form: SuppressionForm, ruleName: string, reason: string): string {
  return `${suppressionOfTheNextLine(form, ruleName)} -- ${reason}`
}

/** A block comment, in the form given, turning the rule named off for the lines below it, up to an enable comment of it. */
export function blockDisable(form: SuppressionForm, ruleName: string): string {
  return `/* ${form}-disable ${ruleName} */`
}

/** A block comment turning back on the rule it names, or every rule where it names none (`ruleName` null). */
export type EnableComment = { readonly form: SuppressionForm; readonly ruleName: string | null }

export function blockEnable({ form, ruleName }: EnableComment): string {
  return ruleName === null ? `/* ${form}-enable */` : `/* ${form}-enable ${ruleName} */`
}

/** A block disable comment in the form given of the rule named, the line given, then its enable comment. */
export function blockPairAround(form: SuppressionForm, ruleName: string, between: string): string[] {
  return [blockDisable(form, ruleName), between, blockEnable({ form, ruleName })]
}

/** What check says of a suppression comment of the rule named that silenced nothing (q-c15). */
export function unusedSuppressionMessageOf(ruleName: string): string {
  return `suppresses ${ruleName}, which reported nothing here`
}

/** A suppression comment of the rule named that silenced nothing, at its line: in REPORTED_FILE unless a file is given. */
export type UnusedSuppressionAt = { readonly line: number; readonly ruleName: string; readonly file?: string }

/** That suppression as check reports it (q-c15). */
export function buildUnusedSuppressionFinding({ line, ruleName, file = REPORTED_FILE }: UnusedSuppressionAt): CheckFinding {
  return buildCheckFinding({ file, line, label: UNUSED_SUPPRESSION_LABEL, message: unusedSuppressionMessageOf(ruleName) })
}

/**
 * oxlint's report of the enable comment on the line given of the text, where it turns back on
 * nothing a disable comment turned off: no code, as an unused suppression has none. oxlint spans the
 * rule the comment names, or, where it names none, the comment's text inside its delimiters
 * (measured, 1.87).
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

/** oxlint's report of a parse error at the span given: no code, and its parser's message (measured, 1.87, at the `=` of `export const = 2`). */
export function oxlintParseError(span: OxlintSpan): OxlintDiagnostic {
  return { code: null, message: 'Unexpected token', severity: 'error', filename: REPORTED_FILE, spans: [span] }
}

/** Where the text given first appears on the line given of the module text, as oxlint gives a span. */
export function spanOfTextOnLine(text: string, line: number, spanned: string): OxlintSpan {
  const whole = spanOfLine(text, line)
  const lineText = Buffer.from(text).subarray(whole.offset, whole.offset + whole.length).toString()
  const at = lineText.indexOf(spanned)
  if (at === NOT_FOUND) throw new Error(`line ${String(line)} of the text has no ${spanned}`)
  return { line, offset: whole.offset + Buffer.byteLength(lineText.slice(0, at)), length: Buffer.byteLength(spanned) }
}

/** The fixes check never applies, rule ID to why: here one. */
export function buildWithheldFixes(...ruleIds: readonly string[]): ReadonlyMap<string, string> {
  return new Map(ruleIds.map((ruleId) => [ruleId, 'reorders what the program observes']))
}

/** The end of check's summary when errors are left (q-c4). */
export const ERRORS_SUMMARY_TAIL =
  "The list is complete: fix what is in code you wrote, then run check again. Do not read the lint configuration or this package's source; each line says what to fix."

/**
 * The end of the summary when errors are left and the cut left some out: the list is not complete
 * there, so the summary does not say it is (the cut line above it says to run check again).
 */
export const ERRORS_SUMMARY_TAIL_AFTER_A_CUT =
  "Fix what is in code you wrote, then run check again. Do not read the lint configuration or this package's source; each line says what to fix."

/** A finding line's length for which 80 lines fill check's 8,000-character cap, whether or not their newlines count. */
export const LINE_LENGTH_FILLING_THE_CAP_IN_80 = 99

/** The line spec-cli.md's "Output contract" prints for the finding. */
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
