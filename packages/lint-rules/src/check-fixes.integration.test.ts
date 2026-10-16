import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import {
  A_SELECTOR_ESLINT_THROWS_ON,
  ATTEMPT,
  ATTEMPT_CATCHING,
  componentWithAScript,
  IDS_AS_A_SET,
  IDS_AS_AN_ARRAY,
  IDS_FIXED,
  NAMES,
  SHORTHAND_FIRST,
  SHORTHAND_SECOND,
  SHORTHAND_SECOND_FIXED,
  UNITS,
  WRAP,
  WRAP_FIXED,
} from './__tests__/cases/check-sources.ts'
import { autofixedFilesIn, autofixedLineOf, findingsIn, findingsInFile } from './__tests__/check-output.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/consumer-cli-runs.ts'
import {
  checkedPackageFiles,
  DEBUGGER_STATEMENT,
  exportedConstant,
  exportedConstFixedFromLet,
  exportedLet,
  moduleText,
} from './__tests__/factories/check-factories.ts'
import {
  type BackgroundRun,
  type CliRun,
  checkRunningOnBesideAnotherWriter,
  checkSignalledAfterAnotherWriter,
  checkSignalledOnceItFixedAnotherWritersText,
  checkSignalledOnceTheFileChanges,
  createGitProject,
  EXIT,
  type GitProject,
  runCheck,
  setUpAsyncRunsBeforeTheSuite,
} from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import type { TempProjects } from './__tests__/temp-projects.ts'

// spec-cli.md "The fix step" (q-c11, P1): check applies the autofixes first, then lints, and
// reports what is left. A fix may change only lines already changed: ESLint applies a fix only when
// its finding is on a changed line, and a guard drops an engine's fixes in a file where they would
// delete or modify a line nobody changed. The gate's withheld fixes stay withheld (X2).
//
// The fixable rules, each measured on the agent build (oxlint 1.87, ESLint 10.12):
// - prefer-const, oxlint: `let` never reassigned becomes `const`.
// - object-shorthand, ESLint: `{ m: m }` becomes `{ m }`.
// - @typescript-eslint/array-type, ESLint: `Array<\n  number\n>` becomes `number[]`, deleting two lines.
// - perfectionist/sort-arrays, ESLint: reorders a constant array; the gate withholds its fix.
// - unicorn/prefer-optional-catch-binding, ESLint: removes an unused catch binding, after which
//   preserve-caught-error, which has no fix, no longer reports the missing `cause` (P3).
// - no-debugger, oxlint: reports and is never fixed by `--fix`.

allowEveryTestForParallelLoad()

const FIXES = { quality: ['correctness', 'redundancy', 'modern-js', 'immutability', 'conventions'] } as const
const ORDERING_AND_MODERN_JS = { quality: ['ordering', 'modern-js'] } as const
const REDUNDANCY = { quality: ['redundancy'] } as const
const IMMUTABILITY = { quality: ['immutability'] } as const

// A project both engines fix, for a run a signal stops while check fixes. ESLint fixes the files
// one at a time, in path order, once oxlint's fix run has written its fixes into all of them. So
// once the first file holds ESLint's fix, the others hold oxlint's, and ESLint has each of them
// still to lint: a signal sent then lands while check is fixing. The last changed file holds
// nothing either engine fixes.
const OXLINT_AND_ESLINT_FIXES = { quality: ['immutability', 'modern-js'] } as const
const FIXED_BY_ESLINT_FIRST = 'src/a-shorthand.ts'
const FILES_OXLINT_FIXES = 30
const FIXED_BY_OXLINT = Array.from({ length: FILES_OXLINT_FIXES }, (_unused, index) => `src/f${String(index + 1).padStart(2, '0')}.ts`)
const FIXED_BY_BOTH_ENGINES = [FIXED_BY_ESLINT_FIRST, ...FIXED_BY_OXLINT]
const NOTHING_TO_FIX = 'src/untouched.ts'
const NOTHING_TO_FIX_TEXT = moduleText(exportedConstant('untouched'))
const EVERY_CHANGED_FILE = [...FIXED_BY_BOTH_ENGINES, NOTHING_TO_FIX]
const INTERRUPTED = 'check: interrupted\n'
const ESLINT_FAILED = 'check: could not run: ESLint failed: '

/** The files' texts, by path. */
function textsOf(project: GitProject, files: readonly string[]): Record<string, string> {
  return Object.fromEntries(files.map((file) => [file, project.read(file)]))
}

/** The `let` the file at the index of FIXED_BY_OXLINT exports. */
function letOfFileAt(index: number): string {
  return exportedLet(`value${String(index)}`)
}

/** That `let` as oxlint's prefer-const leaves it. */
function letFixedOfFileAt(index: number): string {
  return exportedConstFixedFromLet(`value${String(index)}`)
}

/** A committed project, and the files an agent then added to it: each but the last of which one engine or the other fixes. */
function projectBothEnginesFix(tempProjects: TempProjects): GitProject {
  const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(OXLINT_AND_ESLINT_FIXES) })
  project.write(FIXED_BY_ESLINT_FIRST, moduleText(...WRAP))
  FIXED_BY_OXLINT.forEach((file, index) => project.write(file, moduleText(letOfFileAt(index))))
  project.write(NOTHING_TO_FIX, NOTHING_TO_FIX_TEXT)
  return project
}

/** Every changed file of that project, by path, as both engines' fixes leave it. */
function textsAfterEveryFix(): Record<string, string> {
  return {
    [FIXED_BY_ESLINT_FIRST]: moduleText(...WRAP_FIXED),
    ...Object.fromEntries(FIXED_BY_OXLINT.map((file, index) => [file, moduleText(letFixedOfFileAt(index))])),
    [NOTHING_TO_FIX]: NOTHING_TO_FIX_TEXT,
  }
}

function ruleEngine(ruleId: string): string {
  const route = catalog.rules.get(ruleId)
  if (route === undefined) throw new Error(`${ruleId} is not in the catalog`)
  return route.engine
}

describe('the rules the fixtures rely on', () => {
  it.each([
    { ruleId: 'prefer-const', engine: 'oxlint' },
    { ruleId: 'no-debugger', engine: 'oxlint' },
    { ruleId: 'object-shorthand', engine: 'eslint' },
    { ruleId: '@typescript-eslint/array-type', engine: 'eslint' },
    { ruleId: 'perfectionist/sort-arrays', engine: 'eslint' },
    { ruleId: 'unicorn/prefer-optional-catch-binding', engine: 'eslint' },
  ])('$ruleId runs in $engine', ({ ruleId, engine }) => {
    expect(ruleEngine(ruleId)).toBe(engine)
  })
})

describe('check fixing what agents changed', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        ...checkedPackageFiles(FIXES),
        'src/eslint-partly.ts': moduleText(...SHORTHAND_FIRST),
        'src/oxlint-guard.ts': moduleText(exportedLet('first')),
        'src/eslint-guard.ts': moduleText(...IDS_AS_A_SET),
        'src/caught-partly.ts': moduleText(...ATTEMPT),
        'src/shifted.ts': moduleText(NAMES, DEBUGGER_STATEMENT),
      },
    })
    project.write('src/both-fixable.ts', moduleText(exportedLet('count'), 'export const point = { count: count }'))
    project.append('src/eslint-partly.ts', moduleText(...SHORTHAND_SECOND))
    project.append('src/oxlint-guard.ts', moduleText(exportedLet('second')))
    project.write('src/eslint-guard.ts', moduleText(...IDS_AS_AN_ARRAY, ...WRAP))
    project.write('src/caught-partly.ts', moduleText(...ATTEMPT_CATCHING))
    project.write('src/caught-new.ts', moduleText(...ATTEMPT_CATCHING))
    project.write('src/shifted.ts', moduleText(NAMES, ...IDS_AS_AN_ARRAY, DEBUGGER_STATEMENT))
    const changedFiles = ['src/both-fixable.ts', 'src/eslint-partly.ts', 'src/oxlint-guard.ts', 'src/eslint-guard.ts', 'src/caught-partly.ts', 'src/caught-new.ts', 'src/shifted.ts']
    const before = textsOf(project, changedFiles)
    const result = runCheck(project.dir)
    return { result, before, after: textsOf(project, changedFiles) }
  })

  it('fixes an ESLint-fixable and an oxlint-fixable finding in a new file, reports neither, and names the file in the autofixed line (F-1)', () => {
    const { result, after } = run()

    expect({
      text: after['src/both-fixable.ts'],
      findings: findingsInFile(result.stdout, 'src/both-fixable.ts'),
      autofixed: autofixedFilesIn(result.stdout).includes('src/both-fixable.ts'),
    }).toStrictEqual({ text: moduleText(exportedConstFixedFromLet('count'), 'export const point = { count }'), findings: [], autofixed: true })
  })

  it('fixes an ESLint finding on a changed line, and leaves the same finding on an unchanged line, byte for byte, and unreported (F-2)', () => {
    const { result, after } = run()

    expect({ text: after['src/eslint-partly.ts'], findings: findingsInFile(result.stdout, 'src/eslint-partly.ts') }).toStrictEqual({
      text: moduleText(...SHORTHAND_FIRST, ...SHORTHAND_SECOND_FIXED),
      findings: [],
    })
  })

  it("drops oxlint's fixes in a file where they would modify an unchanged line, reporting the finding on the changed one (F-3)", () => {
    const { result, before, after } = run()

    expect({
      text: after['src/oxlint-guard.ts'],
      findings: findingsInFile(result.stdout, 'src/oxlint-guard.ts'),
      autofixed: autofixedFilesIn(result.stdout).includes('src/oxlint-guard.ts'),
    }).toStrictEqual({ text: before['src/oxlint-guard.ts'], findings: ['src/oxlint-guard.ts:2 prefer-const'], autofixed: false })
  })

  it("drops every one of ESLint's fixes in a file where one would rewrite unchanged lines, reporting both findings (F-3)", () => {
    const { result, before, after } = run()

    expect({
      text: after['src/eslint-guard.ts'],
      findings: findingsInFile(result.stdout, 'src/eslint-guard.ts'),
      autofixed: autofixedFilesIn(result.stdout).includes('src/eslint-guard.ts'),
    }).toStrictEqual({
      text: before['src/eslint-guard.ts'],
      findings: ['src/eslint-guard.ts:1 @typescript-eslint/array-type', 'src/eslint-guard.ts:5 object-shorthand'],
      autofixed: false,
    })
  })

  it.each([
    { kind: 'a file only part of which changed', file: 'src/caught-partly.ts' },
    { kind: 'a new file', file: 'src/caught-new.ts' },
  ])("never loses a caught error's cause silently, in $kind: the file keeps a cause, or check reports it missing (F-5, P3)", ({ file }) => {
    const { result, after } = run()
    const text = after[file]
    if (text === undefined) throw new Error(`${file} was not read after the run`)

    expect({
      ran: result.exitCode === EXIT.findings,
      causeAccountedFor: text.includes('cause') || findingsInFile(result.stdout, file).includes(`${file}:5 preserve-caught-error`),
    }).toStrictEqual({ ran: true, causeAccountedFor: true })
  })

  it('reads the changed lines again after fixing: a fix that deletes lines does not make the finding below them, older than the change, reported (F-10)', () => {
    const { result, after } = run()

    expect({
      text: after['src/shifted.ts'],
      findings: findingsInFile(result.stdout, 'src/shifted.ts'),
      autofixed: autofixedFilesIn(result.stdout).includes('src/shifted.ts'),
    }).toStrictEqual({ text: moduleText(NAMES, IDS_FIXED, DEBUGGER_STATEMENT), findings: [], autofixed: true })
  })
})

describe('check on a fix it withholds, and on a warning (F-4, P4)', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(ORDERING_AND_MODERN_JS, { rules: { 'object-shorthand': 'warn' } }) })
    project.write('src/units.ts', moduleText(...UNITS))
    project.write('src/warned.ts', moduleText(...WRAP))
    const result = runCheck(project.dir)
    return { result, after: textsOf(project, ['src/units.ts', 'src/warned.ts']) }
  })

  it('keeps an array whose order the program observes in its order, and reports it (F-4)', () => {
    const { result, after } = run()

    expect({ exitCode: result.exitCode, text: after['src/units.ts'], findings: findingsInFile(result.stdout, 'src/units.ts') }).toStrictEqual({
      exitCode: EXIT.findings,
      text: moduleText(...UNITS),
      findings: ['src/units.ts:1 perfectionist/sort-arrays'],
    })
  })

  it('fixes a finding a team set to warn, as it does an error (P4)', () => {
    const { result, after } = run()

    expect({ text: after['src/warned.ts'], findings: findingsInFile(result.stdout, 'src/warned.ts') }).toStrictEqual({ text: moduleText(...WRAP_FIXED), findings: [] })
  })
})

describe('check where nothing it finds can be fixed (F-8)', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...checkedPackageFiles(REDUNDANCY), 'src/old.ts': moduleText(exportedConstant('old')) },
    })
    project.write('src/unfixable.ts', moduleText(exportedConstant('unfixable'), DEBUGGER_STATEMENT))
    project.append('src/old.ts', moduleText(DEBUGGER_STATEMENT))
    const files = ['src/unfixable.ts', 'src/old.ts']
    const before = textsOf(project, files)
    const result = runCheck(project.dir)
    return { result, before, after: textsOf(project, files) }
  })

  it('changes no file and prints no autofixed line', () => {
    const { result, before, after } = run()

    expect({ exitCode: result.exitCode, after, autofixed: autofixedFilesIn(result.stdout), findings: findingsIn(result.stdout) }).toStrictEqual({
      exitCode: EXIT.findings,
      after: before,
      autofixed: [],
      findings: ['src/old.ts:2 no-debugger', 'src/unfixable.ts:2 no-debugger'],
    })
  })
})

describe('check fixing only what it checks (F-9)', () => {
  const APP = 'app'
  const UNTOUCHABLE = ['lib/outside.ts', `${APP}/src/generated/generated.ts`, `${APP}/src/component.vue`]

  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(IMMUTABILITY, { ignores: ['src/generated/**'] }, `${APP}/`) })
    project.write('lib/outside.ts', moduleText(exportedLet('outside')))
    project.write(`${APP}/src/generated/generated.ts`, moduleText(exportedLet('generated')))
    project.write(`${APP}/src/component.vue`, componentWithAScript(exportedLet('inAComponent')))
    project.write(`${APP}/src/fixable.ts`, moduleText(exportedLet('fixable')))
    const before = textsOf(project, UNTOUCHABLE)
    const result = runCheck(project.pathOf(APP))
    return { result, before, after: textsOf(project, [...UNTOUCHABLE, `${APP}/src/fixable.ts`]) }
  })

  it("fixes no file outside the config's folder, none its ignores name, and none that is not JS or TS, while it fixes the one beside them", () => {
    const { result, before, after } = run()

    expect({ exitCode: result.exitCode, after }).toStrictEqual({
      exitCode: EXIT.clean,
      after: { ...before, [`${APP}/src/fixable.ts`]: moduleText(exportedConstFixedFromLet('fixable')) },
    })
  })
})

// An interrupted or failed check puts no file back (decided 2026-10-15): each fix it wrote is a whole
// fix the guard kept, as `eslint --fix` leaves one, and putting files back wrote over other writers'
// edits (cli review, r8, r12, r13). So it prints the autofixed line before it exits 130, 143 or 2,
// naming the files it rewrote so far, for the agent to read them again (P2).

describe('check interrupted while ESLint fixes, after oxlint wrote its fixes (spec-cli.md "Signals and leftovers")', () => {
  const runs = setUpAsyncRunsBeforeTheSuite(async (tempProjects) => {
    const signalledWith = async (signal: NodeJS.Signals): Promise<{ readonly stopped: BackgroundRun; readonly after: Record<string, string> }> => {
      const project = projectBothEnginesFix(tempProjects)
      const stopped = await checkSignalledOnceTheFileChanges(project.dir, project.pathOf(FIXED_BY_ESLINT_FIRST), signal)
      return { stopped, after: textsOf(project, EVERY_CHANGED_FILE) }
    }
    return { SIGINT: await signalledWith('SIGINT'), SIGTERM: await signalledWith('SIGTERM') }
  })

  it.each([
    { signal: 'SIGINT', exitCode: EXIT.interrupted },
    { signal: 'SIGTERM', exitCode: EXIT.terminated },
  ] as const)("keeps every fix it wrote, oxlint's and ESLint's alike, names each file it fixed in the autofixed line, says it was interrupted, and exits $exitCode on $signal", ({ signal, exitCode }) => {
    const { stopped, after } = runs()[signal]

    expect({ signalled: stopped.signalled, run: stopped.run, after }).toStrictEqual({
      signalled: true,
      run: { exitCode, signal: null, stdout: autofixedLineOf(FIXED_BY_BOTH_ENGINES), stderr: INTERRUPTED },
      after: textsAfterEveryFix(),
    })
  })
})

describe('check interrupted while it fixes, after another writer rewrote a file oxlint fixed and a file with nothing to fix (spec-cli.md "Signals and leftovers", F-6)', () => {
  // r8: another agent or an editor rewrites the last file oxlint fixed, which ESLint has still to
  // lint, and the file neither engine fixes, between ESLint's first fix and the signal. The text it
  // writes has nothing to fix.
  const REWRITTEN_MEANWHILE = FIXED_BY_OXLINT[FILES_OXLINT_FIXES - 1]
  const ANOTHER_WRITERS_TEXT = moduleText(exportedConstant('writtenByAnotherWriter'))
  const ANOTHER_WRITERS_TEXT_WHERE_NOTHING_WAS_FIXED = moduleText(exportedConstant('alsoWrittenByAnotherWriter'))

  const run = setUpAsyncRunsBeforeTheSuite(async (tempProjects) => {
    if (REWRITTEN_MEANWHILE === undefined) throw new Error('there is no last file oxlint fixes')
    const project = projectBothEnginesFix(tempProjects)
    const anotherWriter = (): void => {
      project.write(REWRITTEN_MEANWHILE, ANOTHER_WRITERS_TEXT)
      project.write(NOTHING_TO_FIX, ANOTHER_WRITERS_TEXT_WHERE_NOTHING_WAS_FIXED)
    }
    const interrupted = await checkSignalledAfterAnotherWriter(project.dir, project.pathOf(FIXED_BY_ESLINT_FIRST), anotherWriter, 'SIGINT')
    return { interrupted, rewritten: REWRITTEN_MEANWHILE, after: textsOf(project, EVERY_CHANGED_FILE) }
  })

  it("keeps that writer's text in both files and every other file's fix, names only the files check fixed in the autofixed line, says it was interrupted, and exits 130", () => {
    const { interrupted, rewritten, after } = run()

    expect({ signalled: interrupted.signalled, run: interrupted.run, after }).toStrictEqual({
      signalled: true,
      run: { exitCode: EXIT.interrupted, signal: null, stdout: autofixedLineOf(FIXED_BY_BOTH_ENGINES), stderr: INTERRUPTED },
      after: { ...textsAfterEveryFix(), [rewritten]: ANOTHER_WRITERS_TEXT, [NOTHING_TO_FIX]: ANOTHER_WRITERS_TEXT_WHERE_NOTHING_WAS_FIXED },
    })
  })
})

describe('check interrupted once ESLint fixed what another writer wrote into a file after oxlint ended (spec-cli.md "Signals and leftovers", F-6)', () => {
  // r13: another writer adds a function ESLint fixes to a file oxlint fixed, after oxlint's run and
  // check's read of every file after it; ESLint then reads that writer's text, fixes it and writes
  // it, and the signal comes once it has. The file is the middle one: ESLint reaches it well after
  // the writer writes and well before its last file.
  const MIDDLE = FILES_OXLINT_FIXES / 2
  const WRITTEN_MEANWHILE = FIXED_BY_OXLINT[MIDDLE]
  const ANOTHER_WRITERS_TEXT = moduleText(letFixedOfFileAt(MIDDLE), ...WRAP)
  const ANOTHER_WRITERS_TEXT_FIXED = moduleText(letFixedOfFileAt(MIDDLE), ...WRAP_FIXED)

  const run = setUpAsyncRunsBeforeTheSuite(async (tempProjects) => {
    if (WRITTEN_MEANWHILE === undefined) throw new Error('there is no middle file oxlint fixes')
    const project = projectBothEnginesFix(tempProjects)
    const anotherWriter = (): void => project.write(WRITTEN_MEANWHILE, ANOTHER_WRITERS_TEXT)
    const fixed = { path: project.pathOf(WRITTEN_MEANWHILE), text: ANOTHER_WRITERS_TEXT_FIXED }
    const interrupted = await checkSignalledOnceItFixedAnotherWritersText(project.dir, project.pathOf(FIXED_BY_ESLINT_FIRST), anotherWriter, fixed, 'SIGINT')
    return { interrupted, written: WRITTEN_MEANWHILE, after: textsOf(project, EVERY_CHANGED_FILE) }
  })

  it("keeps that writer's line, as ESLint fixed it, and every other file's fix, names each file it fixed in the autofixed line, says it was interrupted, and exits 130", () => {
    const { interrupted, written, after } = run()

    expect({ signalled: interrupted.signalled, run: interrupted.run, after }).toStrictEqual({
      signalled: true,
      run: { exitCode: EXIT.interrupted, signal: null, stdout: autofixedLineOf(FIXED_BY_BOTH_ENGINES), stderr: INTERRUPTED },
      after: { ...textsAfterEveryFix(), [written]: ANOTHER_WRITERS_TEXT_FIXED },
    })
  })
})

describe('check that runs to its end while another writer rewrites a changed file it fixes nothing in (P2)', () => {
  const ANOTHER_WRITERS_TEXT = moduleText(exportedConstant('writtenByAnotherWriter'))

  const run = setUpAsyncRunsBeforeTheSuite(async (tempProjects) => {
    const project = projectBothEnginesFix(tempProjects)
    const anotherWriter = (): void => project.write(NOTHING_TO_FIX, ANOTHER_WRITERS_TEXT)
    const ranOn = await checkRunningOnBesideAnotherWriter(project.dir, project.pathOf(FIXED_BY_ESLINT_FIRST), anotherWriter)
    return { ranOn, after: textsOf(project, EVERY_CHANGED_FILE) }
  })

  it('names only the files its own fixes rewrote in the autofixed line, not the one that writer changed, and keeps that writer\'s text', () => {
    const { ranOn, after } = run()

    expect({ wrote: ranOn.wrote, run: ranOn.run, after }).toStrictEqual({
      wrote: true,
      run: { exitCode: EXIT.clean, signal: null, stdout: `${autofixedLineOf(FIXED_BY_BOTH_ENGINES)}check: no findings in ${String(EVERY_CHANGED_FILE.length)} changed files.\n`, stderr: '' },
      after: { ...textsAfterEveryFix(), [NOTHING_TO_FIX]: ANOTHER_WRITERS_TEXT },
    })
  })
})

describe('check that could not run once oxlint had written its fixes: ESLint failed (spec-cli.md "Signals and leftovers", P2)', () => {
  // oxlint's fix run comes before ESLint, which throws on the selector as it lints the first file.
  const FILES = ['src/first.ts', 'src/second.ts']
  const ESLINT_THROWING = { rules: { 'no-restricted-syntax': ['error', A_SELECTOR_ESLINT_THROWS_ON] } } as const

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const runOn = (lineOfFileAt: (index: number) => string): { readonly result: CliRun; readonly after: Record<string, string> } => {
      const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(IMMUTABILITY, ESLINT_THROWING) })
      FILES.forEach((file, index) => project.write(file, moduleText(lineOfFileAt(index))))
      const result = runCheck(project.dir)
      return { result, after: textsOf(project, FILES) }
    }
    return { oxlintFixed: runOn(letOfFileAt), nothingFixed: runOn(letFixedOfFileAt) }
  })

  it("keeps oxlint's fixes, names the files in the autofixed line, says why it could not run, and exits 2", () => {
    const { result, after } = runs().oxlintFixed

    expect({ exitCode: result.exitCode, stdout: result.stdout, couldNotRun: result.stderr.startsWith(ESLINT_FAILED), after }).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      stdout: autofixedLineOf(FILES),
      couldNotRun: true,
      after: Object.fromEntries(FILES.map((file, index) => [file, moduleText(letFixedOfFileAt(index))])),
    })
  })

  it('prints no autofixed line where it rewrote nothing before it could not run, beside that run', () => {
    const { result } = runs().nothingFixed

    expect({ exitCode: result.exitCode, stdout: result.stdout, couldNotRun: result.stderr.startsWith(ESLINT_FAILED) }).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      stdout: '',
      couldNotRun: true,
    })
  })
})
