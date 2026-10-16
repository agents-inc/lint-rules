// Reads what `check` prints to stdout (spec-cli.md, "Output contract"): the autofixed line, one
// line per finding, `file:line label — message` with ` (warning)` after a warning's label, the cut
// line, and the summary last.

const LINE_END = '\n'
const MESSAGE_SEPARATOR = ' — '
const FINDING_LOCATION = /^.+:\d+ \S/u
const AUTOFIXED_PREFIX = 'check: autofixed '
const AUTOFIXED_SUFFIX = '; read them again before editing them.'
const PATH_SEPARATOR = ', '

/** Each line printed, without the newline that ends it. */
export function linesOf(output: string): string[] {
  const lines = output.split(LINE_END)
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines
}

/** Each finding line as `file:line label`, a warning's ` (warning)` kept and its message left out, in the order printed. */
export function findingsIn(stdout: string): string[] {
  return findingLinesIn(stdout).map(({ location }) => location)
}

/** The findings `findingsIn` gives in the one file, by its path relative to the config's folder. */
export function findingsInFile(stdout: string, file: string): string[] {
  return findingsIn(stdout).filter((finding) => finding.startsWith(`${file}:`))
}

/** The message each finding line gives, by its `file:line label`. */
export function findingMessagesIn(stdout: string): ReadonlyMap<string, string> {
  return new Map(findingLinesIn(stdout).map(({ location, message }) => [location, message]))
}

/** The files the autofixed line names, in the order it names them: none where there is no such line. */
export function autofixedFilesIn(stdout: string): string[] {
  const autofixedLine = linesOf(stdout).find((line) => line.startsWith(AUTOFIXED_PREFIX))
  if (autofixedLine === undefined) return []
  if (!autofixedLine.endsWith(AUTOFIXED_SUFFIX)) throw new Error(`the autofixed line does not end as the spec says: ${autofixedLine}`)
  return autofixedLine.slice(AUTOFIXED_PREFIX.length, -AUTOFIXED_SUFFIX.length).split(PATH_SEPARATOR)
}

/** stdout's autofixed line naming the files given, its newline included (P2). */
export function autofixedLineOf(files: readonly string[]): string {
  return `${AUTOFIXED_PREFIX}${files.join(PATH_SEPARATOR)}${AUTOFIXED_SUFFIX}${LINE_END}`
}

/** The last line printed: check's summary. Throws where nothing was printed. */
export function lastLineOf(stdout: string): string {
  const last = linesOf(stdout).at(-1)
  if (last === undefined) throw new Error('check printed nothing to stdout')
  return last
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
