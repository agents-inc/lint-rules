import { notAnObject } from './texts.ts'

type Member = { readonly key: string; readonly keyStart: number; readonly valueStart: number; readonly valueEnd: number }

type ObjectInText = { readonly open: number; readonly close: number; readonly members: readonly Member[] }

type Layout = { readonly indent: string; readonly eol: string }

type Token = { readonly text: string; readonly start: number; readonly end: number }

type Tokens = ArrayIterator<Token>

const DEV_DEPENDENCIES = 'devDependencies'
const DEFAULT_INDENT = '  '
const CRLF = '\r\n'
const LF = '\n'
const OPEN_OBJECT = '{'
const CLOSE_OBJECT = '}'
const OPEN_ARRAY = '['
const CLOSE_ARRAY = ']'
const COMMA = ','
// Only whitespace lies between the tokens of text JSON.parse accepted.
const JSON_TOKEN = /"(?:[^"\\]|\\.)*"|[{}[\],:]|[^ \t\n\r{}[\],:"]+/gu
const TOP_LEVEL_DEPTH = 1
const DEPENDENCY_DEPTH = 2

/**
 * Inserted before the first key that sorts after it, else last. The text is edited, never
 * re-serialised, so its layout stays. `text` is already-parsed JSON; `path` names it in an error.
 */
export function withDevDependency(text: string, path: string, name: string, range: string): string {
  const top = objectAt(text, 0)
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

function withMember(text: string, object: ObjectInText, member: string, before: Member | undefined, depth: number, layout: Layout): string {
  const indent = indentAt(layout, depth)
  const last = object.members.at(-1)
  if (last === undefined) return spliced(text, object.open, object.close + 1, objectHolding(member, depth, layout))
  if (before === undefined) return spliced(text, last.valueEnd, last.valueEnd, `${COMMA}${layout.eol}${indent}${member}`)
  return spliced(text, before.keyStart, before.keyStart, `${member}${COMMA}${layout.eol}${indent}`)
}

function layoutOf(text: string, top: ObjectInText): Layout {
  const eol = text.includes(CRLF) ? CRLF : LF
  const first = top.members.at(0)
  if (first === undefined) return { indent: DEFAULT_INDENT, eol }
  const indent = indentOfKey(text, first, top)
  return { indent: indent === '' ? DEFAULT_INDENT : indent, eol }
}

/** Empty where the key starts its line, or shares it with its object's opening brace. */
function indentOfKey(text: string, { keyStart }: Member, { open }: ObjectInText): string {
  const lineStart = text.lastIndexOf(LF, keyStart) + 1
  return lineStart > open ? text.slice(lineStart, keyStart) : ''
}

/** `"<key>": <value>`, the value given as JSON text. */
function memberText(key: string, valueText: string): string {
  return `${JSON.stringify(key)}: ${valueText}`
}

function objectHolding(member: string, depth: number, layout: Layout): string {
  return `${OPEN_OBJECT}${layout.eol}${indentAt(layout, depth)}${member}${layout.eol}${indentAt(layout, depth - 1)}${CLOSE_OBJECT}`
}

function indentAt({ indent }: Layout, depth: number): string {
  return indent.repeat(depth)
}

function spliced(text: string, start: number, end: number, insert: string): string {
  return `${text.slice(0, start)}${insert}${text.slice(end)}`
}

// Each reader takes the tokens it reads from one shared array iterator and leaves the rest: an array
// iterator has no `return`, so a for…of that stops part way leaves it where it stopped.

function objectAt(text: string, open: number): ObjectInText {
  const tokens = tokensFrom(text, open)
  return objectOpenedBy(nextTokenIn(tokens), tokens)
}

function tokensFrom(text: string, start: number): Tokens {
  return Array.from(text.slice(start).matchAll(JSON_TOKEN), (match) => tokenOf(match, start)).values()
}

function tokenOf({ 0: token, index }: RegExpExecArray, offset: number): Token {
  const start = offset + index
  return { text: token, start, end: start + token.length }
}

function objectOpenedBy(open: Token, tokens: Tokens): ObjectInText {
  const members: Member[] = []
  for (const token of tokens) {
    if (token.text === CLOSE_OBJECT) return { open: open.start, close: token.start, members }
    if (token.text !== COMMA) members.push(memberKeyedBy(token, tokens))
  }
  throw new Error(`an object with no closing brace at ${String(open.start)}`)
}

function memberKeyedBy(key: Token, tokens: Tokens): Member {
  const value = valueAfterTheColon(tokens)
  // Parse boundary: a key of text JSON.parse accepted.
  return { key: String(JSON.parse(key.text)), keyStart: key.start, valueStart: value.start, valueEnd: readValueStartedBy(value, tokens) }
}

function valueAfterTheColon(tokens: Tokens): Token {
  nextTokenIn(tokens)
  return nextTokenIn(tokens)
}

function readValueStartedBy(first: Token, tokens: Tokens): number {
  if (first.text === OPEN_OBJECT) return objectOpenedBy(first, tokens).close + 1
  if (first.text === OPEN_ARRAY) return endOfArrayOpenedBy(first, tokens)
  return first.end
}

function endOfArrayOpenedBy(open: Token, tokens: Tokens): number {
  for (const token of tokens) {
    if (token.text === CLOSE_ARRAY) return token.end
    if (token.text !== COMMA) readValueStartedBy(token, tokens)
  }
  throw new Error(`an array with no closing bracket at ${String(open.start)}`)
}

function nextTokenIn(tokens: Tokens): Token {
  const next = tokens.next()
  if (next.done === true) throw new Error('JSON text that ends part way through a value')
  return next.value
}
