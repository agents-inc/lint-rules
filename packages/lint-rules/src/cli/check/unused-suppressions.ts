import type { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { isRecord } from '../../core/is-record.ts'
import type { OxlintDiagnostic, OxlintSpan } from './oxlint-output.ts'

/** A rule a suppression comment names that reported nothing where the comment applies, by the comment's line. */
export type UnusedSuppression = { readonly line: number; readonly ruleName: string }

/** The engine a suppression comment is written for: `// eslint-disable…` or `// oxlint-disable…`. */
type SuppressionForm = 'eslint' | 'oxlint'

/** A name oxlint reports unused, with the form of the comment that gives it. */
type UnusedInOxlint = UnusedSuppression & { readonly form: SuppressionForm }

/** How oxlint's message on an unused suppression starts, for a comment of the form. */
type UnusedMessage = { readonly form: SuppressionForm; readonly start: RegExp }

/** oxlint's report of a comment that silenced nothing: the comment's form, and where oxlint places it. */
type OxlintUnusedReport = { readonly form: SuppressionForm; readonly span: OxlintSpan }

/** A file's text; its UTF-8 bytes, which oxlint's spans count in; and its comments, null where the text does not parse. */
type FileText = { readonly text: string; readonly bytes: Buffer; readonly comments: readonly Comment[] | null }

/** A comment of the file, delimiters included, by where it starts and ends in the file's text. */
type Comment = { readonly text: string; readonly start: number; readonly end: number }

/** What an oxlint span covers, trimmed, where it starts and ends in the file's text, and oxlint's line for it. */
type Spanned = Comment & { readonly line: number }

/** A comment as typescript-eslint's parser gives it: where it starts and ends in the text. */
type ParsedComment = { readonly range: readonly [number, number] }

// ESLint's parser contract passes the parser options second; typescript-eslint types its parser for
// configs, with the text alone. The file's path tells it the file's kind: JSX is read in `.tsx` and
// the JS kinds, a type assertion in `.ts`.
type ParseForEslint = (text: string, options: { readonly filePath: string }) => Parsed

/** What typescript-eslint's parser gives: its tree of the text, whose type it leaves unknown. */
type Parsed = { readonly ast: unknown }

// Each engine reports a name the other runs as unused, since it saw nothing from it (measured,
// ESLint 10.12, oxlint 1.87). So a name in an `eslint-disable` comment, which both engines read, is
// unused where both say so: the engine that runs the rule says so only where it reported nothing.
// ESLint never reads an `oxlint-disable` comment, so oxlint alone says a name in one is unused.
const ESLINT_UNUSED = /^Unused eslint-disable directive \(no problems were reported from (?<names>.+)\)\.$/u
const QUOTED_NAME = /'(?<name>[^']+)'/gu
// oxlint's message names the comment's form: `Unused oxlint-disable directive (…)` (measured, 1.87).
const OXLINT_UNUSED_MESSAGES: readonly UnusedMessage[] = [
  { form: 'eslint', start: /^Unused eslint-disable directive/u },
  { form: 'oxlint', start: /^Unused oxlint-disable directive/u },
]
// oxlint reports an enable comment that turns back on nothing with no code too: `Unused
// eslint-enable directive (no matching eslint-disable directives were found for no-debugger).`
// (measured, 1.87). It is a report on a comment, as an unused suppression is, and suppresses nothing.
const ON_A_DIRECTIVE_COMMENT = /^Unused (?:eslint|oxlint)-(?:disable|enable) directive/u
const READ_BY_OXLINT_ALONE: SuppressionForm = 'oxlint'
// oxlint gives a comment wholly unused as the comment's span, and one name of a comment partly used as that name's span.
const COMMENT_START = /^(?:\/\/|\/\*)/u
const DIRECTIVE = /^(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable|enable)(?:-next-line|-line)?(?<names>[\s\S]*?)(?:\*\/)?$/u
const ENABLE_DIRECTIVE = /^(?:\/\/|\/\*)\s*(?:eslint|oxlint)-enable(?![\w-])/u
// A disable or enable comment that holds until the next of the other kind, block or line, in either
// form: never a `-line` or `-next-line` one.
const REGION_COMMENT = /^(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable|enable)(?![\w-])/u
const JUSTIFICATION = /--[\s\S]*$/u
const NAME_SEPARATORS = /[\s,]+/u
const LINE_FEED = '\n'

const parseForEslint: ParseForEslint = tseslint.parser.parseForESLint

/** Each name a suppression comment gives that silenced nothing, by the comment's line. `file` is the file's path, which says how to parse its text. */
export function namesSuppressingNothing(
  messages: readonly Linter.LintMessage[],
  diagnostics: readonly OxlintDiagnostic[],
  { file, text }: { readonly file: string; readonly text: string },
): UnusedSuppression[] {
  const unusedByEslint = new Set(unusedInEslint(messages).map(keyOf))
  return unusedInOxlint(diagnostics, file, text).filter((unused) => unused.form === READ_BY_OXLINT_ALONE || unusedByEslint.has(keyOf(unused)))
}

/** Whether the message of an oxlint diagnostic with no code reports on a suppression or enable comment, which is no parse error. */
export function isAboutADirectiveComment(message: string): boolean {
  return ON_A_DIRECTIVE_COMMENT.test(message)
}

/** Each name ESLint reports a suppression comment silenced nothing of. */
function unusedInEslint(messages: readonly Linter.LintMessage[]): UnusedSuppression[] {
  return messages.flatMap(({ ruleId, message, line }) => {
    if (ruleId !== null) return []
    return namesEslintCallsUnusedIn(message).map((ruleName) => ({ line, ruleName }))
  })
}

/** Each name oxlint reports a suppression comment silenced nothing of. The file is parsed only where oxlint reports one. */
function unusedInOxlint(diagnostics: readonly OxlintDiagnostic[], file: string, text: string): UnusedInOxlint[] {
  const reports = diagnostics.flatMap(unusedReportOf)
  if (reports.length === 0) return []
  const fileText = { text, bytes: Buffer.from(text), comments: commentsIn(file, text) }
  return reports.flatMap((report) => namesOxlintCallsUnusedIn(report, fileText))
}

/** The diagnostic as a report of a comment that silenced nothing: none where it reports anything else. */
function unusedReportOf(diagnostic: OxlintDiagnostic): OxlintUnusedReport[] {
  const form = formOfAnUnusedSuppression(diagnostic)
  const [span] = diagnostic.spans
  return form === null || span === undefined ? [] : [{ form, span }]
}

/**
 * The names oxlint reports a comment silenced nothing of, read from the file at its span, each at
 * the line of the disable comment that names it. A span no comment holds now was read from a text
 * the file no longer holds, as where another writer added a line above after oxlint read it: in an
 * `eslint-disable` comment's report, ESLint's own report decides the name; in an `oxlint-disable`
 * one, only that out-of-date text names it, so it is dropped for this run (decided 2026-10-15).
 */
function namesOxlintCallsUnusedIn({ form, span }: OxlintUnusedReport, file: FileText): UnusedInOxlint[] {
  const spanned = spannedBy(file.bytes, span)
  if (form === READ_BY_OXLINT_ALONE && liesInNoCommentNow(file, spanned)) return []
  return namesIn(spanned.text).map((ruleName) => ({ line: lineOfTheDisableComment(file, spanned, ruleName), ruleName, form }))
}

/** The form of the comment where the diagnostic reports one that silenced nothing: null where it reports anything else, which a rule's code or a parse error's message says. */
function formOfAnUnusedSuppression({ code, message }: OxlintDiagnostic): SuppressionForm | null {
  if (code !== null) return null
  const unused = OXLINT_UNUSED_MESSAGES.find(({ start }) => start.test(message))
  return unused === undefined ? null : unused.form
}

/** The names ESLint's message on an unused suppression quotes: none in a message on anything else. */
function namesEslintCallsUnusedIn(message: string): string[] {
  const names = ESLINT_UNUSED.exec(message)?.groups?.['names']
  if (names === undefined) return []
  return [...names.matchAll(QUOTED_NAME)].flatMap(({ groups }) => (groups?.['name'] === undefined ? [] : [groups['name']]))
}

/**
 * The file's comments, as typescript-eslint's parser reads them: text that looks like a comment in
 * a string or a template literal is none. Null where the parser cannot read the text, which the
 * engines did read: their parsers and options differ.
 */
function commentsIn(file: string, text: string): readonly Comment[] | null {
  const parsed = parsedOrNull(file, text)
  if (parsed === null) return null
  return parsedCommentsIn(parsed.ast).map(({ range: [start, end] }) => ({ text: text.slice(start, end), start, end }))
}

/** What the parser makes of the text: null where it cannot read it, whatever it throws, as reading the comments never refuses the run. */
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
 * The line of the disable comment that turned the rule off: oxlint's line, unless the comment is an
 * enable comment. oxlint gives a `disable` … `enable` pair that silenced nothing at its enable
 * comment, where ESLint gives it at its disable comment (measured, 1.87 and 10.12). The enable
 * comment closes what the first disable comment naming the rule since the last enable comment
 * naming it opened, whatever the form of either: oxlint's message names that disable comment's form
 * (measured, 1.87). The pairing never refuses the run (decided 2026-10-15): where the text does not
 * parse, no comment holds the span, or no disable comment above names the rule, it is oxlint's line.
 */
function lineOfTheDisableComment({ text, comments }: FileText, spanned: Spanned, ruleName: string): number {
  if (comments === null) return spanned.line
  const comment = commentAt(comments, spanned)
  if (comment === null || !ENABLE_DIRECTIVE.test(comment.text)) return spanned.line
  const opening = disableCommentOpenAt(comments, comment, ruleName)
  return opening === null ? spanned.line : lineAt(text, opening.start)
}

/** Whether the file's text parses and none of its comments holds the span: oxlint read a text the file no longer holds. */
function liesInNoCommentNow({ comments }: FileText, spanned: Spanned): boolean {
  return comments !== null && commentAt(comments, spanned) === null
}

/**
 * The comment the span is in: the span itself where it covers a whole comment, as oxlint spans one
 * wholly unused, else the comment that holds the name it spans. Null where no comment holds it.
 */
function commentAt(comments: readonly Comment[], spanned: Spanned): Comment | null {
  if (COMMENT_START.test(spanned.text)) return spanned
  return comments.find(({ start, end }) => start <= spanned.start && spanned.end <= end) ?? null
}

/** The disable comment above the enable comment that turned the rule off there: null where the rule is on there. */
function disableCommentOpenAt(comments: readonly Comment[], enable: Comment, ruleName: string): Comment | null {
  return comments
    .filter(({ text, end }) => end <= enable.start && REGION_COMMENT.test(text) && namesIn(text).includes(ruleName))
    .reduce<Comment | null>(disableCommentOpenAfter, null)
}

/** The rule's disable comment open after the comment, given the one open before it: an enable comment closes it, and a disable comment opens one only where none is open. */
function disableCommentOpenAfter(openBefore: Comment | null, comment: Comment): Comment | null {
  if (ENABLE_DIRECTIVE.test(comment.text)) return null
  return openBefore === null ? comment : openBefore
}

/** What the span covers, trimmed, and where: oxlint gives its offset and length in UTF-8 bytes. */
function spannedBy(bytes: Buffer, span: OxlintSpan): Spanned {
  const covered = bytes.subarray(span.offset, span.offset + span.length).toString()
  const start = indexOfByte(bytes, span.offset)
  return { text: covered.trim(), start, end: start + covered.length, line: span.line }
}

/** The index in the file's text of the byte at the offset given. */
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
