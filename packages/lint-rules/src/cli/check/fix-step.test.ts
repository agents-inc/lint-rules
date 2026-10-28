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
import { eslintFailedOn, goneWhileCheckRan, oxlintRulesFailed } from './not-checked.ts'

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

/** Reading the path then fails with ENOENT, EISDIR and ENOTDIR in turn. */
type NoFileThere = { readonly how: string; readonly remove: (projectDir: string) => void; readonly left: PathHolds }

type PathHolds = 'a file' | 'a folder' | 'nothing'

type FixStepEnding = { readonly settled: Settled<FixStepResult>; readonly rewritten: ReadonlySet<string> }

/** `wrote` settles, with the paths, once the stand-in has written every file. */
type OxlintRunningOn = { readonly fixer: InPlaceFixer; readonly wrote: Promise<readonly string[]> }

const NO_FILE_THERE: readonly NoFileThere[] = [
  {
    how: 'deletes it',
    remove(projectDir) {
      rmSync(join(projectDir, SECOND))
    },
    left: 'nothing',
  },
  {
    how: 'puts a folder in its place',
    remove(projectDir) {
      rmSync(join(projectDir, SECOND))
      mkdirSync(join(projectDir, SECOND))
    },
    left: 'a folder',
  },
  {
    how: 'puts a file in the place of its folder',
    remove(projectDir) {
      rmSync(join(projectDir, SECOND_FOLDER), { recursive: true })
      writeFileSync(join(projectDir, SECOND_FOLDER), ANOTHER_WRITERS_TEXT)
    },
    left: 'nothing',
  },
]

/** The whole first file changed, the second's line 2; ESLint reads both. */
function filesIn(projectDir: string): CheckedFile[] {
  return [
    { path: join(projectDir, FIRST), changed: wholeFileChanged(), readByEslint: true },
    { path: join(projectDir, SECOND), changed: linesChanged(SECOND_CHANGED_LINE), readByEslint: true },
  ]
}

/** Each wholly changed: every fix in them passes the guard. ESLint reads each. */
function wholeFilesIn(projectDir: string, files: readonly string[]): CheckedFile[] {
  return files.map((file) => ({ path: join(projectDir, file), changed: wholeFileChanged(), readByEslint: true }))
}

async function fixStepOver(files: readonly CheckedFile[], engines: FixStepEngines, signal = new AbortController().signal): Promise<FixStepEnding> {
  const rewritten = new Set<string>()
  function record(path: string): void {
    // eslint-disable-next-line functional/immutable-data -- the stand-in records each file the step names, which the test reads once the step settles
    rewritten.add(path)
  }
  const settled = await settledOf(applyFixes(files, snapshotsOf(files.map(({ path }) => path)), engines, { signal, rewritten: { record } }))
  return { settled, rewritten }
}

/** Writes its fixes, then runs on until the signal kills it. */
function oxlintRunningOnUntilKilled(projectDir: string): OxlintRunningOn {
  const { promise: wrote, resolve: resolveWrote } = Promise.withResolvers<readonly string[]>()
  const fixer: InPlaceFixer = async (paths, signal) => {
    await oxlintFixRunWriting(projectDir, AFTER_OXLINT)(paths, signal)
    resolveWrote(paths)
    await new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason))
    })
  }
  return { fixer, wrote }
}

const oxlintFixingNothing: InPlaceFixer = async () => undefined

const ESLINT_FINDING_NOTHING: EslintEngine = {
  async isIgnored() {
    return false
  },
  async allowsSuppressionsIn() {
    return true
  },
  async fixed(path) {
    return buildLintResult(path)
  },
  async linted(path) {
    return buildLintResult(path)
  },
}

/** `whileFixing` runs as it fixes each file; it crashes on `crashesOn`, where one is given. */
function eslintFixingLets({ whileFixing, crashesOn }: { readonly whileFixing: (path: string) => void; readonly crashesOn: string | null }): EslintEngine {
  return {
    ...ESLINT_FINDING_NOTHING,
    async fixed(path, text) {
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
    function anotherWriter(): void {
      writeFileSync(join(projectDir, SECOND), ANOTHER_WRITERS_TEXT)
    }
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
    function anotherWriterIntoTheFirstWhileFixingIt(path: string): void {
      if (path === join(projectDir, FIRST)) writeFileSync(path, ANOTHER_WRITERS_TEXT)
    }
    const { settled, rewritten } = await fixStepOver(wholeFilesIn(projectDir, [FIRST, THIRD]), {
      oxlint: oxlintFixingNothing,
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

describe("a fix step git's failure stops after oxlint fixed", () => {
  it("keeps oxlint's fix the guard passes, writes back the one it fails before git is read, records the kept one, and passes the failure on", async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    function gitFailing(): ChangedLines {
      throw GIT_FAILED
    }
    const { settled, rewritten } = await fixStepOver(filesIn(projectDir), { oxlint: oxlintFixRunWriting(projectDir, AFTER_OXLINT), eslint: ESLINT_FINDING_NOTHING, changedLinesNow: gitFailing })

    expect({ settled, rewritten, contents: textsOf(projectDir, FIRST_AND_SECOND) }).toStrictEqual({
      settled: { threw: GIT_FAILED },
      rewritten: recorded(projectDir, FIRST),
      contents: { [FIRST]: FIRST_AFTER_OXLINT, [SECOND]: SECOND_BEFORE_FIXES },
    })
  })

})

// What check cannot run is skipped and listed; the step goes on.
describe('a fix step past a failure that is no signal', () => {
  it("keeps oxlint's fix the guard passes where oxlint's own run fails after writing, writes back the one the guard fails, records the kept one, and goes on to ESLint's fixes", async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const crashingAfterWriting: InPlaceFixer = async (paths, signal) => {
      await oxlintFixRunWriting(projectDir, AFTER_OXLINT)(paths, signal)
      throw OXLINT_CRASH
    }
    const fixedByEslint: string[] = []
    const eslint = eslintFixingLets({
      whileFixing(path) {
        // eslint-disable-next-line functional/immutable-data -- the stand-in records each file ESLint is given, which the test reads once the step settles
        fixedByEslint.push(path)
      },
      crashesOn: null,
    })
    const { settled, rewritten } = await fixStepOver(filesIn(projectDir), { oxlint: crashingAfterWriting, eslint, changedLinesNow: GIT_READ_AS_IT_IS })

    expect({ completed: 'gave' in settled, fixedByEslint, rewritten, contents: textsOf(projectDir, FIRST_AND_SECOND) }).toStrictEqual({
      completed: true,
      fixedByEslint: FIRST_AND_SECOND.map((file) => join(projectDir, file)),
      rewritten: recorded(projectDir, FIRST),
      contents: { [FIRST]: FIRST_AFTER_OXLINT, [SECOND]: SECOND_BEFORE_FIXES },
    })
  })

  // Another writer edits a file after oxlint's run, while ESLint fixes an earlier one; ESLint then reads
  // that writer's text, fixes and writes it; then ESLint fails on a later file.
  it("keeps ESLint's fix of the text another writer wrote before ESLint read it, that writer's line with it, records the file, and goes on past a later file ESLint fails on", async () => {
    const projectDir = tempProjects.create({ files: { [FIRST]: FIRST_BEFORE_FIXES, [SECOND]: moduleText(exportedLet('second')), [THIRD]: THIRD_BEFORE_FIXES } })
    const writersText = moduleText(exportedLet('second'), exportedConstant('writtenByAnotherWriter'))
    function anotherWriterWhileFixingTheFirst(path: string): void {
      if (path === join(projectDir, FIRST)) writeFileSync(join(projectDir, SECOND), writersText)
    }
    const { settled, rewritten } = await fixStepOver(wholeFilesIn(projectDir, [FIRST, SECOND, THIRD]), {
      oxlint: oxlintFixingNothing,
      eslint: eslintFixingLets({ whileFixing: anotherWriterWhileFixingTheFirst, crashesOn: join(projectDir, THIRD) }),
      changedLinesNow: GIT_READ_AS_IT_IS,
    })

    expect({ completed: 'gave' in settled, rewritten, contents: textsOf(projectDir, [FIRST, SECOND, THIRD]) }).toStrictEqual({
      completed: true,
      rewritten: recorded(projectDir, FIRST, SECOND),
      contents: {
        [FIRST]: FIRST_AFTER_ESLINT,
        [SECOND]: moduleText(exportedConstFixedFromLet('second'), exportedConstant('writtenByAnotherWriter')),
        [THIRD]: THIRD_BEFORE_FIXES,
      },
    })
  })
})

describe('the files a fix step gives ESLint', () => {
  it("are those ESLint reads, and none of the component files beside them, which oxlint's rules alone lint", async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const [first, second] = filesIn(projectDir)
    if (first === undefined || second === undefined) throw new Error('the project holds no two files')
    const givenToEslint: string[] = []
    const eslint = eslintFixingLets({
      whileFixing(path) {
        // eslint-disable-next-line functional/immutable-data -- the stand-in records each file ESLint is given, which the test reads once the step settles
        givenToEslint.push(path)
      },
      crashesOn: null,
    })
    await fixStepOver([first, { ...second, readByEslint: false }], { oxlint: oxlintFixingNothing, eslint, changedLinesNow: GIT_READ_AS_IT_IS })

    expect(givenToEslint).toStrictEqual([first.path])
  })
})

describe('what a fix step lists as not checked', () => {
  it("lists oxlint's rules where oxlint's fix run fails, a file ESLint fails on, and one another writer deletes while ESLint fixes it, each once, beside a file it fixes", async () => {
    const projectDir = tempProjects.create({ files: { [FIRST]: FIRST_BEFORE_FIXES, [SECOND]: SECOND_BEFORE_FIXES, [THIRD]: THIRD_BEFORE_FIXES } })
    const crashing: InPlaceFixer = async () => {
      throw OXLINT_CRASH
    }
    function deletingTheSecondWhileFixingIt(path: string): void {
      if (path === join(projectDir, SECOND)) rmSync(path)
    }
    const eslint = eslintFixingLets({ whileFixing: deletingTheSecondWhileFixingIt, crashesOn: join(projectDir, THIRD) })
    const { settled } = await fixStepOver(wholeFilesIn(projectDir, [FIRST, SECOND, THIRD]), { oxlint: crashing, eslint, changedLinesNow: GIT_READ_AS_IT_IS })
    if (!('gave' in settled)) throw new Error('the fix step stopped')

    expect({ notChecked: settled.gave.notChecked, linted: settled.gave.eslintMessages.keys().toArray() }).toStrictEqual({
      notChecked: [oxlintRulesFailed(OXLINT_CRASH), goneWhileCheckRan(join(projectDir, SECOND)), eslintFailedOn(join(projectDir, THIRD), RULE_CRASH)],
      linted: [join(projectDir, FIRST)],
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
    const signalled: unknown = interruption.signal.reason
    const { settled, rewritten } = await ending

    expect({ settled, rewritten, contents: textsOf(projectDir, FIRST_AND_SECOND) }).toStrictEqual({
      settled: { threw: signalled },
      rewritten: recorded(projectDir, FIRST),
      contents: { [FIRST]: FIRST_AFTER_OXLINT, [SECOND]: SECOND_BEFORE_FIXES },
    })
  })

  // No file is left for ESLint, whose loop would see the signal too: a signal is never listed as oxlint failing.
  it("throws the signal that stops oxlint's fix run where ESLint reads none of the files, as component files are", async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const interruption = new AbortController()
    const oxlint = oxlintRunningOnUntilKilled(projectDir)
    const components = filesIn(projectDir).map((file) => ({ ...file, readByEslint: false }))
    const ending = fixStepOver(components, { oxlint: oxlint.fixer, eslint: ESLINT_FINDING_NOTHING, changedLinesNow: GIT_READ_AS_IT_IS }, interruption.signal)
    await oxlint.wrote
    interruption.abort()
    const signalled: unknown = interruption.signal.reason

    expect((await ending).settled).toStrictEqual({ threw: signalled })
  })

  it("keeps ESLint's fix written before the signal, records the file, fixes no file after it, and throws the signal", async () => {
    const projectDir = tempProjects.create({ files: { [FIRST]: FIRST_BEFORE_FIXES, [THIRD]: THIRD_BEFORE_FIXES } })
    const interruption = new AbortController()
    function signalWhileFixingTheFirst(path: string): void {
      if (path === join(projectDir, FIRST)) interruption.abort()
    }
    const { settled, rewritten } = await fixStepOver(
      wholeFilesIn(projectDir, [FIRST, THIRD]),
      { oxlint: oxlintFixingNothing, eslint: eslintFixingLets({ whileFixing: signalWhileFixingTheFirst, crashesOn: null }), changedLinesNow: GIT_READ_AS_IT_IS },
      interruption.signal,
    )
    const signalled: unknown = interruption.signal.reason

    expect({ settled, rewritten, contents: textsOf(projectDir, [FIRST, THIRD]) }).toStrictEqual({
      settled: { threw: signalled },
      rewritten: recorded(projectDir, FIRST),
      contents: { [FIRST]: FIRST_AFTER_ESLINT, [THIRD]: THIRD_BEFORE_FIXES },
    })
  })
})

describe('a file whose path another writer leaves with no file while oxlint fixes', () => {
  // check lists the path as not checked, and goes on.
  it.each(NO_FILE_THERE)("where it $how: keeps oxlint's fix in the other file, records it, leaves the path as that writer left it, and goes on", async ({ remove, left }) => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const fixingThenRemoved: InPlaceFixer = async (paths, signal) => {
      await oxlintFixRunWriting(projectDir, AFTER_OXLINT)(paths, signal)
      remove(projectDir)
    }
    const { settled, rewritten } = await fixStepOver(filesIn(projectDir), { oxlint: fixingThenRemoved, eslint: ESLINT_FINDING_NOTHING, changedLinesNow: GIT_READ_AS_IT_IS })

    expect({ completed: 'gave' in settled, rewritten, first: readFileSync(join(projectDir, FIRST), 'utf8'), second: whatIsAt(projectDir, SECOND) }).toStrictEqual({
      completed: true,
      rewritten: recorded(projectDir, FIRST),
      first: FIRST_AFTER_OXLINT,
      second: left,
    })
  })
})
