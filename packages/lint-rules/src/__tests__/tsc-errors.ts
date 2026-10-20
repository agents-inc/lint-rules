/** One error `tsc` printed: where, its code, and its message with each chained line after the first. */
export type TscError = {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly code: string
  readonly message: string
}

/** A named group of a match: throws where the group matched nothing. */
type GroupReader = (name: string) => string

// As tsc prints an error where its output is no terminal (measured, TypeScript 6.0.3): `file(line,column): error
// TS2322: text`, then each further line of the message indented by two spaces.
const ERROR_LINE = /^(?<file>.+)\((?<line>\d+),(?<column>\d+)\): error (?<code>TS\d+): (?<text>.*)$/u
const CHAINED_LINE = /^ {2}(?<text>.*)$/u
const NEWLINE = '\n'

/** Throws on a line that neither starts an error nor goes on with one, so no output is dropped unread. */
export function tscErrorsIn(stdout: string): TscError[] {
  return stdout
    .split(NEWLINE)
    .filter((printed) => printed !== '')
    .reduce<TscError[]>((errors, printed) => withLineRead(errors, printed), [])
}

function withLineRead(errors: readonly TscError[], printed: string): TscError[] {
  const started = ERROR_LINE.exec(printed)
  if (started !== null) return [...errors, errorStartedBy(groupReaderOf(started, printed))]
  const chained = CHAINED_LINE.exec(printed)
  const last = errors.at(-1)
  if (chained === null || last === undefined) throw new Error(`tsc printed a line that is part of no error: ${printed}`)
  return [...errors.slice(0, -1), { ...last, message: `${last.message}${NEWLINE}${groupReaderOf(chained, printed)('text')}` }]
}

function errorStartedBy(group: GroupReader): TscError {
  return { file: group('file'), line: Number(group('line')), column: Number(group('column')), code: group('code'), message: group('text') }
}

function groupReaderOf({ groups }: RegExpExecArray, printed: string): GroupReader {
  return (name) => {
    const value = groups === undefined ? undefined : groups[name]
    if (value === undefined) throw new Error(`no group ${name} matched in: ${printed}`)
    return value
  }
}
