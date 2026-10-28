// Reads what `check` prints to stdout: the autofixed line, one `file:line label — message` line per finding
// (` (warning)` after a warning's label), the cut line, the `check: not checked: …` entries, and the summary last.

const LINE_END = '\n'
const MESSAGE_SEPARATOR = ' — '
const FINDING_LOCATION = /^.+:\d+ \S/u
const AUTOFIXED_PREFIX = 'check: autofixed '
const AUTOFIXED_SUFFIX = '; read them again before editing them.'
const PATH_SEPARATOR = ', '
const NOT_CHECKED_PREFIX = 'check: not checked: '
// Every line check writes itself starts so; the text an engine printed, quoted in an entry, need not.
const CHECK_LINE_PREFIX = 'check: '
const NOT_FOUND = -1

export function linesOf(output: string): string[] {
  const lines = output.split(LINE_END)
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines
}

/** As `file:line label`, a warning's ` (warning)` kept and its message left out, in the order printed. */
export function findingsIn(stdout: string): string[] {
  return findingLinesIn(stdout).map(({ location }) => location)
}

/** By the file's path relative to the config's folder. */
export function findingsInFile(stdout: string, file: string): string[] {
  return findingsIn(stdout).filter((finding) => finding.startsWith(`${file}:`))
}

/** By each finding's `file:line label`. */
export function findingMessagesIn(stdout: string): ReadonlyMap<string, string> {
  return new Map(findingLinesIn(stdout).map(({ location, message }) => [location, message]))
}

/** None where there is no such line. */
export function autofixedFilesIn(stdout: string): string[] {
  const autofixedLine = linesOf(stdout).find((line) => line.startsWith(AUTOFIXED_PREFIX))
  if (autofixedLine === undefined) return []
  if (!autofixedLine.endsWith(AUTOFIXED_SUFFIX)) throw new Error(`the autofixed line does not end as the spec says: ${autofixedLine}`)
  return autofixedLine.slice(AUTOFIXED_PREFIX.length, -AUTOFIXED_SUFFIX.length).split(PATH_SEPARATOR)
}

/** Its newline included. */
export function autofixedLineOf(files: readonly string[]): string {
  return `${AUTOFIXED_PREFIX}${files.join(PATH_SEPARATOR)}${AUTOFIXED_SUFFIX}${LINE_END}`
}

/** check's summary; throws where nothing was printed. */
export function lastLineOf(stdout: string): string {
  const last = linesOf(stdout).at(-1)
  if (last === undefined) throw new Error('check printed nothing to stdout')
  return last
}

/** Each `check: not checked: …` entry, in the order printed, one quoting text over several lines kept whole. */
export function notCheckedIn(stdout: string): string[] {
  const lines = linesOf(stdout)
  return lines.flatMap((line, index) => (line.startsWith(NOT_CHECKED_PREFIX) ? entryStartingAt(lines, index) : []))
}

/** Up to the next line check starts itself. */
function entryStartingAt(lines: readonly string[], start: number): string {
  const end = lines.findIndex((line, index) => index > start && line.startsWith(CHECK_LINE_PREFIX))
  return lines.slice(start, end === NOT_FOUND ? lines.length : end).join(LINE_END)
}

type FindingLine = { readonly location: string; readonly message: string }

function findingLinesIn(stdout: string): FindingLine[] {
  return linesOf(stdout).flatMap((line): FindingLine[] => {
    const separatorAt = line.indexOf(MESSAGE_SEPARATOR)
    if (separatorAt === -1) return []
    const location = line.slice(0, separatorAt)
    return FINDING_LOCATION.test(location) ? [{ location, message: line.slice(separatorAt + MESSAGE_SEPARATOR.length) }] : []
  })
}
