import { notAnObject } from './texts.ts'

/** A member of a JSON object in the text: its key, and where its key and value are. */
type Member = { readonly key: string; readonly keyStart: number; readonly valueStart: number; readonly valueEnd: number }

/** A JSON object in the text: where its braces are, and its members in file order. */
type ObjectInText = { readonly open: number; readonly close: number; readonly members: readonly Member[] }

/** How the file is laid out: one level of indentation, and its line end. */
type Layout = { readonly indent: string; readonly eol: string }

const DEV_DEPENDENCIES = 'devDependencies'
const DEFAULT_INDENT = '  '
const CRLF = '\r\n'
const LF = '\n'
const QUOTE = '"'
const BACKSLASH = '\\'
const OPEN_OBJECT = '{'
const CLOSE_OBJECT = '}'
const OPEN_ARRAY = '['
const CLOSE_ARRAY = ']'
const COMMA = ','
const JSON_WHITESPACE = new Set([' ', '\t', '\n', '\r'])
const LITERAL_ENDS = new Set([COMMA, CLOSE_OBJECT, CLOSE_ARRAY, ...JSON_WHITESPACE])
const TOP_LEVEL_DEPTH = 1
const DEPENDENCY_DEPTH = 2

/**
 * The package.json text with `"<name>": "<range>"` in devDependencies (q-i4): before the first key
 * that sorts after it, else last, and a devDependencies it lacks added as the last key. The text is
 * edited, never re-serialised, so its indentation, key order, line ends and final newline stay as
 * they are. `text` is valid JSON, read already; `path` names it in an error.
 */
export function withDevDependency(text: string, path: string, name: string, range: string): string {
  const top = objectAt(text, afterWhitespace(text, 0))
  const layout = layoutOf(text, top)
  const entry = memberText(name, JSON.stringify(range))
  const devDependencies = top.members.find(({ key }) => key === DEV_DEPENDENCIES)
  if (devDependencies === undefined) {
    const field = memberText(DEV_DEPENDENCIES, objectHolding(entry, DEPENDENCY_DEPTH, layout))
    return withMember(text, top, field, undefined, TOP_LEVEL_DEPTH, layout)
  }
  if (text.charAt(devDependencies.valueStart) !== OPEN_OBJECT) throw new Error(notAnObject(path, DEV_DEPENDENCIES))
  const dependencies = objectAt(text, devDependencies.valueStart)
  const before = dependencies.members.find(({ key }) => key > name)
  return withMember(text, dependencies, entry, before, DEPENDENCY_DEPTH, layout)
}

/** The text with the member written into the object at `depth`: before the member given, else last. */
function withMember(text: string, object: ObjectInText, member: string, before: Member | undefined, depth: number, layout: Layout): string {
  const indent = indentAt(layout, depth)
  const last = object.members.at(-1)
  if (last === undefined) return spliced(text, object.open, object.close + 1, objectHolding(member, depth, layout))
  if (before === undefined) return spliced(text, last.valueEnd, last.valueEnd, `${COMMA}${layout.eol}${indent}${member}`)
  return spliced(text, before.keyStart, before.keyStart, `${member}${COMMA}${layout.eol}${indent}`)
}

/** The indentation of the first top-level member, and the line end the file uses. */
function layoutOf(text: string, top: ObjectInText): Layout {
  const eol = text.includes(CRLF) ? CRLF : LF
  const first = top.members.at(0)
  if (first === undefined) return { indent: DEFAULT_INDENT, eol }
  const lineStart = text.lastIndexOf(LF, first.keyStart) + 1
  const indent = lineStart > top.open ? text.slice(lineStart, first.keyStart) : ''
  return { indent: indent === '' ? DEFAULT_INDENT : indent, eol }
}

/** `"<key>": <value>`, the value given as JSON text. */
function memberText(key: string, valueText: string): string {
  return `${JSON.stringify(key)}: ${valueText}`
}

/** An object holding only the member: the member on a line of its own at `depth`, the closing brace one level out. */
function objectHolding(member: string, depth: number, layout: Layout): string {
  return `${OPEN_OBJECT}${layout.eol}${indentAt(layout, depth)}${member}${layout.eol}${indentAt(layout, depth - 1)}${CLOSE_OBJECT}`
}

function indentAt({ indent }: Layout, depth: number): string {
  return indent.repeat(depth)
}

function spliced(text: string, start: number, end: number, insert: string): string {
  return `${text.slice(0, start)}${insert}${text.slice(end)}`
}

// A scanner over text JSON.parse has accepted, so it reads well-formed JSON only.

function objectAt(text: string, open: number): ObjectInText {
  const members: Member[] = []
  let next = afterWhitespace(text, open + 1)
  while (text.charAt(next) !== CLOSE_OBJECT) {
    const keyEnd = stringEndAt(text, next)
    // Parse boundary: a key of text JSON.parse accepted.
    const key = String(JSON.parse(text.slice(next, keyEnd)))
    const valueStart = afterWhitespace(text, afterWhitespace(text, keyEnd) + 1)
    const valueEnd = valueEndAt(text, valueStart)
    members.push({ key, keyStart: next, valueStart, valueEnd })
    next = afterSeparator(text, valueEnd)
  }
  return { open, close: next, members }
}

function arrayEndAt(text: string, open: number): number {
  let next = afterWhitespace(text, open + 1)
  while (text.charAt(next) !== CLOSE_ARRAY) next = afterSeparator(text, valueEndAt(text, next))
  return next + 1
}

function valueEndAt(text: string, start: number): number {
  const first = text.charAt(start)
  if (first === QUOTE) return stringEndAt(text, start)
  if (first === OPEN_OBJECT) return objectAt(text, start).close + 1
  if (first === OPEN_ARRAY) return arrayEndAt(text, start)
  let end = start
  while (end < text.length && !LITERAL_ENDS.has(text.charAt(end))) end += 1
  return end
}

/** The index after a string's closing quote, given its opening one. */
function stringEndAt(text: string, open: number): number {
  let next = open + 1
  while (next < text.length && text.charAt(next) !== QUOTE) next += text.charAt(next) === BACKSLASH ? 2 : 1
  return next + 1
}

/** After a value: past the comma and whitespace to the next member, or at the closing bracket. */
function afterSeparator(text: string, valueEnd: number): number {
  const next = afterWhitespace(text, valueEnd)
  return text.charAt(next) === COMMA ? afterWhitespace(text, next + 1) : next
}

function afterWhitespace(text: string, from: number): number {
  let next = from
  while (JSON_WHITESPACE.has(text.charAt(next))) next += 1
  return next
}
