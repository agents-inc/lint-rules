import type { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { isRecord } from '../../core/is-record.ts'
import type { OxlintDiagnostic, OxlintSpan } from './oxlint-output.ts'

export type UnusedSuppression = { readonly line: number; readonly ruleName: string }

type SuppressionForm = 'eslint' | 'oxlint'

type UnusedInOxlint = UnusedSuppression & { readonly form: SuppressionForm }

type UnusedMessage = { readonly form: SuppressionForm; readonly start: RegExp }

type OxlintUnusedReport = { readonly form: SuppressionForm; readonly span: OxlintSpan }

/** `bytes`: the UTF-8 bytes oxlint's spans count in; `comments`: null where the text does not parse. */
type FileText = { readonly text: string; readonly bytes: Buffer; readonly comments: readonly Comment[] | null }

/** Delimiters included. */
type Comment = { readonly text: string; readonly start: number; readonly end: number }

type Spanned = Comment & { readonly line: number }

type ParsedComment = { readonly range: readonly [number, number] }

// ESLint's parser contract passes the options second; typescript-eslint types its parser with the
// text alone. The path decides JSX (`.tsx`, JS kinds) or a type assertion (`.ts`).
type ParseForEslint = (text: string, options: { readonly filePath: string }) => Parsed

type Parsed = { readonly ast: unknown }

// Each engine reports a name the other runs as unused (ESLint 10.12, oxlint 1.87). So an
// `eslint-disable` name is unused where both say so; an `oxlint-disable` one, which ESLint never
// reads, where oxlint says so.
const ESLINT_UNUSED = /^Unused eslint-disable directive \(no problems were reported from (?<names>.+)\)\.$/u
const QUOTED_NAME = /'(?<name>[^']+)'/gu
// `Unused oxlint-disable directive (…)` (oxlint 1.87).
const OXLINT_UNUSED_MESSAGES: readonly UnusedMessage[] = [
  { form: 'eslint', start: /^Unused eslint-disable directive/u },
  { form: 'oxlint', start: /^Unused oxlint-disable directive/u },
]
// oxlint reports an enable comment that re-enables nothing with no code too (1.87). It suppresses nothing.
const ON_A_DIRECTIVE_COMMENT = /^Unused (?:eslint|oxlint)-(?:disable|enable) directive/u
const READ_BY_OXLINT_ALONE: SuppressionForm = 'oxlint'
// oxlint gives a comment wholly unused as the comment's span, and one name of a comment partly used as that name's span.
const COMMENT_START = /^(?:\/\/|\/\*)/u
const DIRECTIVE = /^(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable|enable)(?:-next-line|-line)?(?<names>[\s\S]*?)(?:\*\/)?$/u
const ENABLE_DIRECTIVE = /^(?:\/\/|\/\*)\s*(?:eslint|oxlint)-enable(?![\w-])/u
// A disable or enable comment that holds until the next of the other kind: never `-line` or `-next-line`.
const REGION_COMMENT = /^(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable|enable)(?![\w-])/u
const JUSTIFICATION = /--[\s\S]*$/u
const NAME_SEPARATORS = /[\s,]+/u
const LINE_FEED = '\n'

const parseForEslint: ParseForEslint = tseslint.parser.parseForESLint

/** `file` is the path, which says how to parse the text. */
export function namesSuppressingNothing(
  messages: readonly Linter.LintMessage[],
  diagnostics: readonly OxlintDiagnostic[],
  { file, text }: { readonly file: string; readonly text: string },
): UnusedSuppression[] {
  const unusedByEslint = new Set(unusedInEslint(messages).map(keyOf))
  return unusedInOxlint(diagnostics, file, text).filter((unused) => unused.form === READ_BY_OXLINT_ALONE || unusedByEslint.has(keyOf(unused)))
}

/** Such a diagnostic has no code, but is no parse error. */
export function isAboutADirectiveComment(message: string): boolean {
  return ON_A_DIRECTIVE_COMMENT.test(message)
}

function unusedInEslint(messages: readonly Linter.LintMessage[]): UnusedSuppression[] {
  return messages.flatMap(({ ruleId, message, line }) => {
    if (ruleId !== null) return []
    return namesEslintCallsUnusedIn(message).map((ruleName) => ({ line, ruleName }))
  })
}

/** The file is parsed only where oxlint reports one. */
function unusedInOxlint(diagnostics: readonly OxlintDiagnostic[], file: string, text: string): UnusedInOxlint[] {
  const reports = diagnostics.flatMap(unusedReportOf)
  if (reports.length === 0) return []
  const fileText = { text, bytes: Buffer.from(text), comments: commentsIn(file, text) }
  return reports.flatMap((report) => namesOxlintCallsUnusedIn(report, fileText))
}

function unusedReportOf(diagnostic: OxlintDiagnostic): OxlintUnusedReport[] {
  const form = formOfAnUnusedSuppression(diagnostic)
  const [span] = diagnostic.spans
  return form === null || span === undefined ? [] : [{ form, span }]
}

/**
 * A span no comment holds now was read from a text the file no longer holds. An `eslint-disable`
 * name is then left to ESLint's own report; an `oxlint-disable` one is dropped for this run.
 */
function namesOxlintCallsUnusedIn({ form, span }: OxlintUnusedReport, file: FileText): UnusedInOxlint[] {
  const spanned = spannedBy(file.bytes, span)
  if (form === READ_BY_OXLINT_ALONE && liesInNoCommentNow(file, spanned)) return []
  return namesIn(spanned.text).map((ruleName) => ({ line: lineOfTheDisableComment(file, spanned, ruleName), ruleName, form }))
}

function formOfAnUnusedSuppression({ code, message }: OxlintDiagnostic): SuppressionForm | null {
  if (code !== null) return null
  const unused = OXLINT_UNUSED_MESSAGES.find(({ start }) => start.test(message))
  return unused === undefined ? null : unused.form
}

function namesEslintCallsUnusedIn(message: string): string[] {
  const names = ESLINT_UNUSED.exec(message)?.groups?.['names']
  if (names === undefined) return []
  return [...names.matchAll(QUOTED_NAME)].flatMap(({ groups }) => (groups?.['name'] === undefined ? [] : [groups['name']]))
}

/** As typescript-eslint reads them, so comment-like text in a string is none. Null where it cannot parse what the engines did. */
function commentsIn(file: string, text: string): readonly Comment[] | null {
  const parsed = parsedOrNull(file, text)
  if (parsed === null) return null
  return parsedCommentsIn(parsed.ast).map(({ range: [start, end] }) => ({ text: text.slice(start, end), start, end }))
}

/** Null whatever the parser throws: reading the comments never refuses the run. */
function parsedOrNull(file: string, text: string): Parsed | null {
  try {
    return parseForEslint(text, { filePath: file })
  } catch {
    return null
  }
}

/** Parse boundary: typescript-eslint's AST, which its parser's type leaves unknown. */
function parsedCommentsIn(ast: unknown): readonly ParsedComment[] {
  if (!isRecord(ast) || !Array.isArray(ast['comments'])) throw new Error("typescript-eslint's parser gave no list of comments")
  return ast['comments'] as readonly ParsedComment[]
}

/**
 * oxlint gives an unused `disable` … `enable` pair at its enable comment, ESLint at its disable
 * comment (1.87, 10.12), so this finds the disable comment the enable one closes, in either form.
 * Where that fails, oxlint's line.
 */
function lineOfTheDisableComment({ text, comments }: FileText, spanned: Spanned, ruleName: string): number {
  if (comments === null) return spanned.line
  const comment = commentAt(comments, spanned)
  if (comment === null || !ENABLE_DIRECTIVE.test(comment.text)) return spanned.line
  const opening = disableCommentOpenAt(comments, comment, ruleName)
  return opening === null ? spanned.line : lineAt(text, opening.start)
}

/** oxlint read a text the file no longer holds. */
function liesInNoCommentNow({ comments }: FileText, spanned: Spanned): boolean {
  return comments !== null && commentAt(comments, spanned) === null
}

/** oxlint spans a wholly unused comment whole, else the name inside it. */
function commentAt(comments: readonly Comment[], spanned: Spanned): Comment | null {
  if (COMMENT_START.test(spanned.text)) return spanned
  return comments.find(({ start, end }) => start <= spanned.start && spanned.end <= end) ?? null
}

function disableCommentOpenAt(comments: readonly Comment[], enable: Comment, ruleName: string): Comment | null {
  return comments
    .filter(({ text, end }) => end <= enable.start && REGION_COMMENT.test(text) && namesIn(text).includes(ruleName))
    .reduce<Comment | null>(disableCommentOpenAfter, null)
}

function disableCommentOpenAfter(openBefore: Comment | null, comment: Comment): Comment | null {
  if (ENABLE_DIRECTIVE.test(comment.text)) return null
  return openBefore === null ? comment : openBefore
}

/** oxlint gives the offset and length in UTF-8 bytes. */
function spannedBy(bytes: Buffer, span: OxlintSpan): Spanned {
  const covered = bytes.subarray(span.offset, span.offset + span.length).toString()
  const start = indexOfByte(bytes, span.offset)
  return { text: covered.trim(), start, end: start + covered.length, line: span.line }
}

function indexOfByte(bytes: Buffer, offset: number): number {
  return bytes.subarray(0, offset).toString().length
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split(LINE_FEED).length
}

function namesIn(spanned: string): string[] {
  if (!COMMENT_START.test(spanned)) return [spanned]
  const names = DIRECTIVE.exec(spanned)?.groups?.['names']
  if (names === undefined) return []
  return names
    .replace(JUSTIFICATION, '')
    .split(NAME_SEPARATORS)
    .filter((name) => name !== '')
}

function keyOf({ line, ruleName }: UnusedSuppression): string {
  return `${String(line)} ${ruleName}`
}
