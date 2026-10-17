import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildLintResult,
  exportedConstant,
  exportedConstFixedFromLet,
  exportedLet,
  linesChanged,
  moduleText,
  oxlintFixRunWriting,
  wholeFileChanged,
} from '../../__tests__/factories/check-factories.ts'
import { type Settled, settledOf } from '../../__tests__/settled-runs.ts'
import { setUpTempProjects, textsOf } from '../../__tests__/temp-projects.ts'
import type { ChangedLines } from './changed-lines.ts'
import type { EslintEngine } from './eslint-run.ts'
import { applyFixes, type CheckedFile, type FixStepEngines, type FixStepResult } from './fix-step.ts'
import { type InPlaceFixer, snapshotsOf } from './fix-writes.ts'

const tempProjects = setUpTempProjects()

// Its every line changed, so oxlint's fix in it passes the guard.
const FIRST = 'src/first.ts'
const FIRST_BEFORE_FIXES = moduleText(exportedLet('first'))
const FIRST_AFTER_OXLINT = moduleText(exportedConstFixedFromLet('first'))
// The same text, as the ESLint stand-in below fixes it.
const FIRST_AFTER_ESLINT = moduleText(exportedConstFixedFromLet('first'))
// Only its second line changed, and oxlint's fix is on its first, so the fix fails the guard.
const SECOND_FOLDER = 'lib'
const SECOND = `${SECOND_FOLDER}/second.ts`
const SECOND_CHANGED_LINE = 2
const SECOND_BEFORE_FIXES = moduleText(exportedLet('second'), exportedConstant('addedBelow'))
const SECOND_AFTER_OXLINT = moduleText(exportedConstFixedFromLet('second'), exportedConstant('addedBelow'))
const THIRD = 'src/third.ts'
const THIRD_BEFORE_FIXES = moduleText(exportedLet('third'))
const THIRD_AFTER_ESLINT = moduleText(exportedConstFixedFromLet('third'))
const BEFORE_FIXES = { [FIRST]: FIRST_BEFORE_FIXES, [SECOND]: SECOND_BEFORE_FIXES }
const AFTER_OXLINT = { [FIRST]: FIRST_AFTER_OXLINT, [SECOND]: SECOND_AFTER_OXLINT }
const FIRST_AND_SECOND = [FIRST, SECOND]
const ANOTHER_WRITERS_TEXT = moduleText(exportedConstant('rewrittenMeanwhile'))
const GIT_FAILED = new Error('git failed: fatal: unable to read the index')
const OXLINT_CRASH = new Error('oxlint failed: it crashed')
// A failure that is no signal: a rule's crash, say.
const RULE_CRASH = new Error('ESLint failed: a rule crashed')
// The one fix the ESLint stand-in makes, as prefer-const would: an exported `let` becomes a `const`.
const EXPORTED_LET = 'export let '
const EXPORTED_CONST = 'export const '

/** `code`: what reading the path then fails with. */
type NoFileThere = { readonly how: string; readonly code: string; readonly remove: (projectDir: string) => void; readonly left: PathHolds }

type PathHolds = 'a file' | 'a folder' | 'nothing'

type FixStepEnding = { readonly settled: Settled<FixStepResult>; readonly rewritten: ReadonlySet<string> }

/** `wrote` settles once the stand-in has written every file. */
type OxlintRunningOn = { readonly fixer: InPlaceFixer; readonly wrote: Promise<void> }

const NO_FILE_THERE: readonly NoFileThere[] = [
  { how: 'deletes it', code: 'ENOENT', remove: (projectDir) => rmSync(join(projectDir, SECOND)), left: 'nothing' },
  {
    how: 'puts a folder in its place',
    code: 'EISDIR',
    remove: (projectDir) => {
      rmSync(join(projectDir, SECOND))
      mkdirSync(join(projectDir, SECOND))
    },
    left: 'a folder',
  },
  {
    how: 'puts a file in the place of its folder',
    code: 'ENOTDIR',
    remove: (projectDir) => {
      rmSync(join(projectDir, SECOND_FOLDER), { recursive: true })
      writeFileSync(join(projectDir, SECOND_FOLDER), ANOTHER_WRITERS_TEXT)
    },
    left: 'nothing',
  },
]

/** The whole first file changed, the second's line 2. */
function filesIn(projectDir: string): CheckedFile[] {
  return [
    { path: join(projectDir, FIRST), changed: wholeFileChanged() },
    { path: join(projectDir, SECOND), changed: linesChanged(SECOND_CHANGED_LINE) },
  ]
}

/** Each wholly changed: every fix in them passes the guard. */
function wholeFilesIn(projectDir: string, files: readonly string[]): CheckedFile[] {
  return files.map((file) => ({ path: join(projectDir, file), changed: wholeFileChanged() }))
}

async function fixStepOver(files: readonly CheckedFile[], engines: FixStepEngines, signal = new AbortController().signal): Promise<FixStepEnding> {
  const rewritten = new Set<string>()
  const record = (path: string): void => {
    rewritten.add(path)
  }
  const settled = await settledOf(applyFixes(files, snapshotsOf(files.map(({ path }) => path)), engines, { signal, rewritten: { record } }))
  return { settled, rewritten }
}

/** Writes its fixes, then runs on until the signal kills it. */
function oxlintRunningOnUntilKilled(projectDir: string): OxlintRunningOn {
  let hasWritten: () => void = () => undefined
  const wrote = new Promise<void>((resolve) => {
    hasWritten = resolve
  })
  const fixer: InPlaceFixer = async (paths, signal) => {
    await oxlintFixRunWriting(projectDir, AFTER_OXLINT)(paths, signal)
    hasWritten()
    await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
  }
  return { fixer, wrote }
}

const OXLINT_FIXING_NOTHING: InPlaceFixer = async () => undefined

const ESLINT_FINDING_NOTHING: EslintEngine = {
  isIgnored: async () => false,
  allowsSuppressionsIn: async () => true,
  fixed: async (path) => buildLintResult(path),
  linted: async (path) => buildLintResult(path),
}

/** `whileFixing` runs as it fixes each file; it crashes on `crashesOn`, where one is given. */
function eslintFixingLets({ whileFixing, crashesOn }: { readonly whileFixing: (path: string) => void; readonly crashesOn: string | null }): EslintEngine {
  return {
    ...ESLINT_FINDING_NOTHING,
    fixed: async (path, text) => {
      if (path === crashesOn) throw RULE_CRASH
      whileFixing(path)
      const output = text.replaceAll(EXPORTED_LET, EXPORTED_CONST)
      return output === text ? buildLintResult(path) : buildLintResult(path, { output })
    },
  }
}

/** What git says the first file's lines are once oxlint fixed it, after `meanwhile` has run. */
function changedLinesAfter(meanwhile: () => void): (path: string) => ChangedLines {
  return () => {
    meanwhile()
    return wholeFileChanged()
  }
}

const GIT_READ_AS_IT_IS = changedLinesAfter(() => undefined)

function whatIsAt(projectDir: string, file: string): PathHolds {
  const path = join(projectDir, file)
  if (!existsSync(path)) return 'nothing'
  return statSync(path).isDirectory() ? 'a folder' : 'a file'
}

function recorded(projectDir: string, ...files: readonly string[]): ReadonlySet<string> {
  return new Set(files.map((file) => join(projectDir, file)))
}

describe("oxlint's fixes that fail the guard", () => {
  it('writes the file back as it was before them, and keeps the fix that passed', async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    await fixStepOver(filesIn(projectDir), { oxlint: oxlintFixRunWriting(projectDir, AFTER_OXLINT), eslint: ESLINT_FINDING_NOTHING, changedLinesNow: GIT_READ_AS_IT_IS })

    expect(textsOf(projectDir, FIRST_AND_SECOND)).toStrictEqual({ [FIRST]: FIRST_AFTER_OXLINT, [SECOND]: SECOND_BEFORE_FIXES })
  })

  // No test reaches the write-back's own guard (one synchronous pass), so this writer comes after the
  // write-back, while git is read.
  it('leaves the text another writer writes over a file it wrote back, while git is read, as that writer left it', async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const anotherWriter = (): void => writeFileSync(join(projectDir, SECOND), ANOTHER_WRITERS_TEXT)
    await fixStepOver(filesIn(projectDir), { oxlint: oxlintFixRunWriting(projectDir, AFTER_OXLINT), eslint: ESLINT_FINDING_NOTHING, changedLinesNow: changedLinesAfter(anotherWriter) })

    expect(textsOf(projectDir, FIRST_AND_SECOND)).toStrictEqual({ [FIRST]: FIRST_AFTER_OXLINT, [SECOND]: ANOTHER_WRITERS_TEXT })
  })

  it('records the file whose fix the guard kept, for the autofixed line, and not the one it wrote back', async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const { settled, rewritten } = await fixStepOver(filesIn(projectDir), { oxlint: oxlintFixRunWriting(projectDir, AFTER_OXLINT), eslint: ESLINT_FINDING_NOTHING, changedLinesNow: GIT_READ_AS_IT_IS })

    expect({ completed: 'gave' in settled, rewritten }).toStrictEqual({ completed: true, rewritten: recorded(projectDir, FIRST) })
  })
})

describe("ESLint's fixes", () => {
  it('writes none over the text another writer wrote into the file while ESLint fixed it, and records not that file, beside a file nobody else wrote, whose fix it writes and records', async () => {
    const projectDir = tempProjects.create({ files: { [FIRST]: FIRST_BEFORE_FIXES, [THIRD]: THIRD_BEFORE_FIXES } })
    const anotherWriterIntoTheFirstWhileFixingIt = (path: string): void => {
      if (path === join(projectDir, FIRST)) writeFileSync(path, ANOTHER_WRITERS_TEXT)
    }
    const { settled, rewritten } = await fixStepOver(wholeFilesIn(projectDir, [FIRST, THIRD]), {
      oxlint: OXLINT_FIXING_NOTHING,
      eslint: eslintFixingLets({ whileFixing: anotherWriterIntoTheFirstWhileFixingIt, crashesOn: null }),
      changedLinesNow: GIT_READ_AS_IT_IS,
    })

    expect({ completed: 'gave' in settled, rewritten, contents: textsOf(projectDir, [FIRST, THIRD]) }).toStrictEqual({
      completed: true,
      rewritten: recorded(projectDir, THIRD),
      contents: { [FIRST]: ANOTHER_WRITERS_TEXT, [THIRD]: THIRD_AFTER_ESLINT },
    })
  })
})

describe('a fix step a failure stops after oxlint fixed', () => {
  it("keeps oxlint's fix the guard passes, writes back the one it fails before git is read, records the kept one, and passes the failure on", async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const gitFailing = (): ChangedLines => {
      throw GIT_FAILED
    }
    const { settled, rewritten } = await fixStepOver(filesIn(projectDir), { oxlint: oxlintFixRunWriting(projectDir, AFTER_OXLINT), eslint: ESLINT_FINDING_NOTHING, changedLinesNow: gitFailing })

    expect({ settled, rewritten, contents: textsOf(projectDir, FIRST_AND_SECOND) }).toStrictEqual({
      settled: { threw: GIT_FAILED },
      rewritten: recorded(projectDir, FIRST),
      contents: { [FIRST]: FIRST_AFTER_OXLINT, [SECOND]: SECOND_BEFORE_FIXES },
    })
  })

  it("keeps oxlint's fix the guard passes where oxlint's own run fails after writing, writes back the one the guard fails, records the kept one, and passes oxlint's failure on", async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const crashingAfterWriting: InPlaceFixer = async (paths, signal) => {
      await oxlintFixRunWriting(projectDir, AFTER_OXLINT)(paths, signal)
      throw OXLINT_CRASH
    }
    const { settled, rewritten } = await fixStepOver(filesIn(projectDir), { oxlint: crashingAfterWriting, eslint: ESLINT_FINDING_NOTHING, changedLinesNow: GIT_READ_AS_IT_IS })

    expect({ settled, rewritten, contents: textsOf(projectDir, FIRST_AND_SECOND) }).toStrictEqual({
      settled: { threw: OXLINT_CRASH },
      rewritten: recorded(projectDir, FIRST),
      contents: { [FIRST]: FIRST_AFTER_OXLINT, [SECOND]: SECOND_BEFORE_FIXES },
    })
  })

  // Another writer edits a file after oxlint's run, while ESLint fixes an earlier one; ESLint then reads
  // that writer's text, fixes and writes it; then the run fails.
  it("keeps ESLint's fix of the text another writer wrote before ESLint read it, that writer's line with it, records the file, and passes a later failure on", async () => {
    const projectDir = tempProjects.create({ files: { [FIRST]: FIRST_BEFORE_FIXES, [SECOND]: moduleText(exportedLet('second')), [THIRD]: THIRD_BEFORE_FIXES } })
    const writersText = moduleText(exportedLet('second'), exportedConstant('writtenByAnotherWriter'))
    const anotherWriterWhileFixingTheFirst = (path: string): void => {
      if (path === join(projectDir, FIRST)) writeFileSync(join(projectDir, SECOND), writersText)
    }
    const { settled, rewritten } = await fixStepOver(wholeFilesIn(projectDir, [FIRST, SECOND, THIRD]), {
      oxlint: OXLINT_FIXING_NOTHING,
      eslint: eslintFixingLets({ whileFixing: anotherWriterWhileFixingTheFirst, crashesOn: join(projectDir, THIRD) }),
      changedLinesNow: GIT_READ_AS_IT_IS,
    })

    expect({ settled, rewritten, contents: textsOf(projectDir, [FIRST, SECOND, THIRD]) }).toStrictEqual({
      settled: { threw: RULE_CRASH },
      rewritten: recorded(projectDir, FIRST, SECOND),
      contents: {
        [FIRST]: FIRST_AFTER_ESLINT,
        [SECOND]: moduleText(exportedConstFixedFromLet('second'), exportedConstant('writtenByAnotherWriter')),
        [THIRD]: THIRD_BEFORE_FIXES,
      },
    })
  })
})

describe('a fix step a signal stops', () => {
  it("keeps oxlint's fix the guard passes where the signal stops oxlint's run after it wrote, writes back the one the guard fails, records the kept one, and throws the signal", async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const interruption = new AbortController()
    const oxlint = oxlintRunningOnUntilKilled(projectDir)
    const ending = fixStepOver(filesIn(projectDir), { oxlint: oxlint.fixer, eslint: ESLINT_FINDING_NOTHING, changedLinesNow: GIT_READ_AS_IT_IS }, interruption.signal)
    await oxlint.wrote
    interruption.abort()
    const { settled, rewritten } = await ending

    expect({ settled, rewritten, contents: textsOf(projectDir, FIRST_AND_SECOND) }).toStrictEqual({
      settled: { threw: interruption.signal.reason },
      rewritten: recorded(projectDir, FIRST),
      contents: { [FIRST]: FIRST_AFTER_OXLINT, [SECOND]: SECOND_BEFORE_FIXES },
    })
  })

  it("keeps ESLint's fix written before the signal, records the file, fixes no file after it, and throws the signal", async () => {
    const projectDir = tempProjects.create({ files: { [FIRST]: FIRST_BEFORE_FIXES, [THIRD]: THIRD_BEFORE_FIXES } })
    const interruption = new AbortController()
    const signalWhileFixingTheFirst = (path: string): void => {
      if (path === join(projectDir, FIRST)) interruption.abort()
    }
    const { settled, rewritten } = await fixStepOver(
      wholeFilesIn(projectDir, [FIRST, THIRD]),
      { oxlint: OXLINT_FIXING_NOTHING, eslint: eslintFixingLets({ whileFixing: signalWhileFixingTheFirst, crashesOn: null }), changedLinesNow: GIT_READ_AS_IT_IS },
      interruption.signal,
    )

    expect({ settled, rewritten, contents: textsOf(projectDir, [FIRST, THIRD]) }).toStrictEqual({
      settled: { threw: interruption.signal.reason },
      rewritten: recorded(projectDir, FIRST),
      contents: { [FIRST]: FIRST_AFTER_ESLINT, [THIRD]: THIRD_BEFORE_FIXES },
    })
  })
})

describe('a file whose path another writer leaves with no file while oxlint fixes', () => {
  // The run stops on the path with no file (exit 2).
  it.each(NO_FILE_THERE)("where it $how: keeps oxlint's fix in the other file, records it, leaves the path as that writer left it, and fails on it", async ({ code, remove, left }) => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const fixingThenRemoved: InPlaceFixer = async (paths, signal) => {
      await oxlintFixRunWriting(projectDir, AFTER_OXLINT)(paths, signal)
      remove(projectDir)
    }
    const { settled, rewritten } = await fixStepOver(filesIn(projectDir), { oxlint: fixingThenRemoved, eslint: ESLINT_FINDING_NOTHING, changedLinesNow: GIT_READ_AS_IT_IS })

    expect({ settled, rewritten, first: readFileSync(join(projectDir, FIRST), 'utf8'), second: whatIsAt(projectDir, SECOND) }).toStrictEqual({
      settled: { threw: expect.objectContaining({ code }) },
      rewritten: recorded(projectDir, FIRST),
      first: FIRST_AFTER_OXLINT,
      second: left,
    })
  })
})
