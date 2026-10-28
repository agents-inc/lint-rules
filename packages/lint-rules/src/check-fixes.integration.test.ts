import { catalog } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { describe, expect, it } from 'vitest'
import {
  A_SELECTOR_ESLINT_THROWS_ON,
  ATTEMPT,
  A_SELECTOR_ESLINT_THROWS_ON_MESSAGE,
  A_USELESS_RENAME,
  A_USELESS_RENAME_FIXED,
  ATTEMPT_CATCHING,
  IDS_AS_A_SET,
  IDS_AS_AN_ARRAY,
  IDS_FIXED,
  NAMES,
  SHORTHAND_FIRST,
  SHORTHAND_SECOND,
  SHORTHAND_SECOND_FIXED,
  UNITS,
  vueComponentScripting,
  WRAP,
  WRAP_FIXED,
} from './__tests__/cases/check-sources.ts'
import { autofixedFilesIn, autofixedLineOf, findingsIn, findingsInFile, lastLineOf, notCheckedIn } from './__tests__/check-output.ts'
import {
  type BackgroundRun,
  checkRunningOnBesideAnotherWriter,
  checkSignalledAfterAnotherWriter,
  checkSignalledOnceItFixedAnotherWritersText,
  checkSignalledOnceTheFileChanges,
  type CliRun,
  EXIT,
  type RunBesideAnotherWriter,
  runCheck,
  RUNS_IN_THE_BACKGROUND,
} from './__tests__/cli-runs.ts'
import {
  A_TSCONFIG_TAKING_IN_THE_REPO,
  CHECK_INTERRUPTED,
  checkedPackageFiles,
  DEBUGGER_STATEMENT,
  eslintMessageWhileLinting,
  exportedConstant,
  exportedConstFixedFromLet,
  exportedLet,
  moduleText,
  NOT_EVERYTHING_CHECKED_SUMMARY,
  notCheckedAsGone,
  notCheckedByEslint,
  REDUNDANCY,
} from './__tests__/factories/check-factories.ts'
import { createGitProject, type GitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { runMadeFor, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { type TempProjects, textsOf } from './__tests__/temp-projects.ts'

// The fixable rules here, measured on the agent build (oxlint 1.87, ESLint 10.12): prefer-const
// (oxlint); object-shorthand, @typescript-eslint/array-type (deletes two lines), perfectionist/sort-arrays
// (fix withheld by the gate) and unicorn/prefer-optional-catch-binding (ESLint), after whose fix
// preserve-caught-error no longer reports the missing `cause`. no-debugger is never fixed by `--fix`.

allowEveryTestForParallelLoad()

const FIXES = { quality: ['correctness', 'redundancy', 'modern-js', 'immutability', 'conventions'] } as const
const ORDERING_AND_MODERN_JS = { quality: ['ordering', 'modern-js'] } as const
const IMMUTABILITY = { quality: ['immutability'] } as const
const IMMUTABILITY_AND_REDUNDANCY = { quality: ['immutability', 'redundancy'] } as const
const MODERN_JS_AND_IMMUTABILITY = { quality: ['modern-js', 'immutability'] } as const

// ESLint fixes files one at a time, in path order, after oxlint's fix run, so once the first file
// holds ESLint's fix, a signal lands while check is still fixing. The last file holds nothing to fix.
const OXLINT_AND_ESLINT_FIXES = { quality: ['immutability', 'modern-js'] } as const
const FIXED_BY_ESLINT_FIRST = 'src/a-shorthand.ts'
const FILES_OXLINT_FIXES = 30
const FIXED_BY_OXLINT = Array.from({ length: FILES_OXLINT_FIXES }, (_unused, index) => `src/f${String(index + 1).padStart(2, '0')}.ts`)
const FIXED_BY_BOTH_ENGINES = [FIXED_BY_ESLINT_FIRST, ...FIXED_BY_OXLINT]
const NOTHING_TO_FIX = 'src/untouched.ts'
const NOTHING_TO_FIX_TEXT = moduleText(exportedConstant('untouched'))
const EVERY_CHANGED_FILE = [...FIXED_BY_BOTH_ENGINES, NOTHING_TO_FIX]

/** The `let` the file at the index of FIXED_BY_OXLINT exports. */
function letOfFileAt(index: number): string {
  return exportedLet(`value${String(index)}`)
}

/** That `let` as oxlint's prefer-const leaves it. */
function letFixedOfFileAt(index: number): string {
  return exportedConstFixedFromLet(`value${String(index)}`)
}

/** A committed project, and the files an agent then added: each but the last fixed by one engine or the other. */
function projectBothEnginesFix(tempProjects: TempProjects): GitProject {
  const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(OXLINT_AND_ESLINT_FIXES) })
  project.write(FIXED_BY_ESLINT_FIRST, moduleText(...WRAP))
  for (const [index, file] of FIXED_BY_OXLINT.entries()) project.write(file, moduleText(letOfFileAt(index)))
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
        'src/restored-by-oxlint.ts': moduleText(exportedConstant('count'), 'export const point = { count: count }'),
      },
    })
    project.write('src/both-fixable.ts', moduleText(exportedLet('count'), 'export const point = { count: count }'))
    project.append('src/eslint-partly.ts', moduleText(...SHORTHAND_SECOND))
    project.append('src/oxlint-guard.ts', moduleText(exportedLet('second')))
    project.write('src/eslint-guard.ts', moduleText(...IDS_AS_AN_ARRAY, ...WRAP))
    project.write('src/caught-partly.ts', moduleText(...ATTEMPT_CATCHING))
    project.write('src/caught-new.ts', moduleText(...ATTEMPT_CATCHING))
    project.write('src/shifted.ts', moduleText(NAMES, ...IDS_AS_AN_ARRAY, DEBUGGER_STATEMENT))
    project.write('src/restored-by-oxlint.ts', moduleText(exportedConstant('count'), 'export let point = { count: count }'))
    const changedFiles = ['src/both-fixable.ts', 'src/eslint-partly.ts', 'src/oxlint-guard.ts', 'src/eslint-guard.ts', 'src/caught-partly.ts', 'src/caught-new.ts', 'src/shifted.ts', 'src/restored-by-oxlint.ts']
    const before = textsOf(project.dir, changedFiles)
    const result = runCheck(project.dir)
    return { result, before, after: textsOf(project.dir, changedFiles) }
  })

  it('fixes an ESLint-fixable and an oxlint-fixable finding in a new file, reports neither, and names the file in the autofixed line', () => {
    const { result, after } = run()

    expect({
      text: after['src/both-fixable.ts'],
      findings: findingsInFile(result.stdout, 'src/both-fixable.ts'),
      autofixed: autofixedFilesIn(result.stdout).includes('src/both-fixable.ts'),
    }).toStrictEqual({ text: moduleText(exportedConstFixedFromLet('count'), 'export const point = { count }'), findings: [], autofixed: true })
  })

  it('fixes an ESLint finding on a changed line, and leaves the same finding on an unchanged line, byte for byte, and unreported', () => {
    const { result, after } = run()

    expect({ text: after['src/eslint-partly.ts'], findings: findingsInFile(result.stdout, 'src/eslint-partly.ts') }).toStrictEqual({
      text: moduleText(...SHORTHAND_FIRST, ...SHORTHAND_SECOND_FIXED),
      findings: [],
    })
  })

  it("drops oxlint's fixes in a file where they would modify an unchanged line, reporting the finding on the changed one", () => {
    const { result, before, after } = run()

    expect({
      text: after['src/oxlint-guard.ts'],
      findings: findingsInFile(result.stdout, 'src/oxlint-guard.ts'),
      autofixed: autofixedFilesIn(result.stdout).includes('src/oxlint-guard.ts'),
    }).toStrictEqual({ text: before['src/oxlint-guard.ts'], findings: ['src/oxlint-guard.ts:2 prefer-const'], autofixed: false })
  })

  it("drops every one of ESLint's fixes in a file where one would rewrite unchanged lines, reporting both findings", () => {
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
  ])("never loses a caught error's cause silently, in $kind: the file keeps a cause, or check reports it missing", ({ file }) => {
    const { result, after } = run()
    const text = after[file]
    if (text === undefined) throw new Error(`${file} was not read after the run`)

    expect({
      ran: result.exitCode === EXIT.findings,
      causeAccountedFor: text.includes('cause') || findingsInFile(result.stdout, file).includes(`${file}:5 preserve-caught-error`),
    }).toStrictEqual({ ran: true, causeAccountedFor: true })
  })

  it('reads the changed lines again after fixing: a fix that deletes lines does not make the finding below them, older than the change, reported', () => {
    const { result, after } = run()

    expect({
      text: after['src/shifted.ts'],
      findings: findingsInFile(result.stdout, 'src/shifted.ts'),
      autofixed: autofixedFilesIn(result.stdout).includes('src/shifted.ts'),
    }).toStrictEqual({ text: moduleText(NAMES, IDS_FIXED, DEBUGGER_STATEMENT), findings: [], autofixed: true })
  })

  it("reads the changed lines again after oxlint's fix: a line oxlint turned back into its committed text is one ESLint leaves unfixed", () => {
    const { result, after } = run()

    expect({
      text: after['src/restored-by-oxlint.ts'],
      findings: findingsInFile(result.stdout, 'src/restored-by-oxlint.ts'),
      autofixed: autofixedFilesIn(result.stdout).includes('src/restored-by-oxlint.ts'),
    }).toStrictEqual({ text: moduleText(exportedConstant('count'), 'export const point = { count: count }'), findings: [], autofixed: true })
  })
})

describe('check on a fix it withholds, and on a warning', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(ORDERING_AND_MODERN_JS, { rules: { 'object-shorthand': 'warn' } }) })
    project.write('src/units.ts', moduleText(...UNITS))
    project.write('src/warned.ts', moduleText(...WRAP))
    const result = runCheck(project.dir)
    return { result, after: textsOf(project.dir, ['src/units.ts', 'src/warned.ts']) }
  })

  it('keeps an array whose order the program observes in its order, and reports it', () => {
    const { result, after } = run()

    expect({ exitCode: result.exitCode, text: after['src/units.ts'], findings: findingsInFile(result.stdout, 'src/units.ts') }).toStrictEqual({
      exitCode: EXIT.findings,
      text: moduleText(...UNITS),
      findings: ['src/units.ts:1 perfectionist/sort-arrays'],
    })
  })

  it('lists a finding a team set to warn as a warning, and fixes it not', () => {
    const { result, after } = run()

    expect({ text: after['src/warned.ts'], findings: findingsInFile(result.stdout, 'src/warned.ts') }).toStrictEqual({
      text: moduleText(...WRAP),
      findings: ['src/warned.ts:2 object-shorthand (warning)'],
    })
  })
})

describe('check where nothing it finds can be fixed', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...checkedPackageFiles(REDUNDANCY), 'src/old.ts': moduleText(exportedConstant('old')) },
    })
    project.write('src/unfixable.ts', moduleText(exportedConstant('unfixable'), DEBUGGER_STATEMENT))
    project.append('src/old.ts', moduleText(DEBUGGER_STATEMENT))
    const files = ['src/unfixable.ts', 'src/old.ts']
    const before = textsOf(project.dir, files)
    const result = runCheck(project.dir)
    return { result, before, after: textsOf(project.dir, files) }
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

describe("check on fixable rules a team set to warn, in its rules or a file override, beside the same rules at error", () => {
  // object-shorthand (ESLint) on line 2 of src/wrap.ts, prefer-const (oxlint) on line 1 of src/count.ts.
  const WARNED = { 'object-shorthand': 'warn', 'prefer-const': 'warn' } as const
  const FILES = ['src/count.ts', 'src/wrap.ts']
  const BEFORE = { 'src/count.ts': moduleText(exportedLet('count')), 'src/wrap.ts': moduleText(...WRAP) }
  const FIXED = { 'src/count.ts': moduleText(exportedConstFixedFromLet('count')), 'src/wrap.ts': moduleText(...WRAP_FIXED) }
  const SET_TO_WARN = [
    { kind: 'in its rules', fields: { rules: WARNED } },
    { kind: 'in a file override', fields: { fileOverrides: [{ files: ['src/**'], rules: WARNED }] } },
  ]
  const AT_ERROR = { kind: 'at error, as they ship', fields: {} }
  const SETTINGS = [...SET_TO_WARN, AT_ERROR]

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    SETTINGS.map(({ kind, fields }) => {
      const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(MODERN_JS_AND_IMMUTABILITY, fields) })
      for (const [file, text] of Object.entries(BEFORE)) project.write(file, text)
      const result = runCheck(project.dir)
      return { kind, run: { exitCode: result.exitCode, findings: findingsIn(result.stdout), autofixed: autofixedFilesIn(result.stdout), texts: textsOf(project.dir, FILES) } }
    }),
  )

  it.each(SET_TO_WARN)('lists each as a warning, fixes neither, in either engine, and exits 0: set to warn $kind', ({ kind }) => {
    expect(runMadeFor(runs(), kind).run).toStrictEqual({
      exitCode: EXIT.clean,
      findings: ['src/count.ts:1 prefer-const (warning)', 'src/wrap.ts:2 object-shorthand (warning)'],
      autofixed: [],
      texts: BEFORE,
    })
  })

  it('fixes both at error and reports neither, beside them', () => {
    expect(runMadeFor(runs(), AT_ERROR.kind).run).toStrictEqual({ exitCode: EXIT.clean, findings: [], autofixed: FILES, texts: FIXED })
  })
})

describe('check fixing what it checks', () => {
  const APP = 'app'
  const FILES = ['lib/outside.ts', `${APP}/src/generated/generated.ts`, `${APP}/src/component.vue`, `${APP}/src/fixable.ts`]

  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...A_TSCONFIG_TAKING_IN_THE_REPO, ...checkedPackageFiles(IMMUTABILITY_AND_REDUNDANCY, { ignores: ['src/generated/**'] }, `${APP}/`) },
    })
    project.write('lib/outside.ts', moduleText(exportedLet('outside')))
    project.write(`${APP}/src/generated/generated.ts`, moduleText(exportedLet('generated')))
    project.write(`${APP}/src/component.vue`, moduleText(...vueComponentScripting(A_USELESS_RENAME)))
    project.write(`${APP}/src/fixable.ts`, moduleText(exportedLet('fixable')))
    const before = textsOf(project.dir, FILES)
    const result = runCheck(project.pathOf(APP))
    return { result, before, after: textsOf(project.dir, FILES) }
  })

  it("fixes a changed file outside the config's folder and a Vue component, beside the file in the folder, and none the config's ignores name", () => {
    const { result, before, after } = run()

    expect({ exitCode: result.exitCode, after }).toStrictEqual({
      exitCode: EXIT.clean,
      after: {
        ...before,
        'lib/outside.ts': moduleText(exportedConstFixedFromLet('outside')),
        [`${APP}/src/component.vue`]: moduleText(...vueComponentScripting(A_USELESS_RENAME_FIXED)),
        [`${APP}/src/fixable.ts`]: moduleText(exportedConstFixedFromLet('fixable')),
      },
    })
  })
})

// An interrupted check puts no file back, which would overwrite other writers' edits; it names the
// files it rewrote so far.

describe('check interrupted while ESLint fixes, after oxlint wrote its fixes', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    async function signalledWith(signal: NodeJS.Signals): Promise<{ readonly stopped: BackgroundRun; readonly after: Record<string, string> }> {
      const project = projectBothEnginesFix(tempProjects)
      const stopped = await checkSignalledOnceTheFileChanges(project.dir, project.pathOf(FIXED_BY_ESLINT_FIRST), signal)
      return { stopped, after: textsOf(project.dir, EVERY_CHANGED_FILE) }
    }
    return { SIGINT: await signalledWith('SIGINT'), SIGTERM: await signalledWith('SIGTERM') }
  }, RUNS_IN_THE_BACKGROUND)

  it.each([
    { signal: 'SIGINT', exitCode: EXIT.interrupted },
    { signal: 'SIGTERM', exitCode: EXIT.terminated },
  ] as const)("keeps every fix it wrote, oxlint's and ESLint's alike, names each file it fixed in the autofixed line, says it was interrupted, and exits $exitCode on $signal", ({ signal, exitCode }) => {
    const { stopped, after } = runs()[signal]

    expect({ signalled: stopped.signalled, run: stopped.run, after }).toStrictEqual({
      signalled: true,
      run: { exitCode, signal: null, stdout: autofixedLineOf(FIXED_BY_BOTH_ENGINES), stderr: CHECK_INTERRUPTED },
      after: textsAfterEveryFix(),
    })
  })
})

describe('check interrupted while it fixes, after another writer rewrote a file oxlint fixed and a file with nothing to fix', () => {
  // Another writer rewrites the last file oxlint fixed, and the file neither engine fixes, between
  // ESLint's first fix and the signal.
  const REWRITTEN_MEANWHILE = FIXED_BY_OXLINT[FILES_OXLINT_FIXES - 1]
  const ANOTHER_WRITERS_TEXT = moduleText(exportedConstant('writtenByAnotherWriter'))
  const ANOTHER_WRITERS_TEXT_WHERE_NOTHING_WAS_FIXED = moduleText(exportedConstant('alsoWrittenByAnotherWriter'))

  const run = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const rewritten = foundOr(REWRITTEN_MEANWHILE, 'there is no last file oxlint fixes')
    const project = projectBothEnginesFix(tempProjects)
    function anotherWriter(): void {
      project.write(rewritten, ANOTHER_WRITERS_TEXT)
      project.write(NOTHING_TO_FIX, ANOTHER_WRITERS_TEXT_WHERE_NOTHING_WAS_FIXED)
    }
    const interrupted = await checkSignalledAfterAnotherWriter(project.dir, project.pathOf(FIXED_BY_ESLINT_FIRST), anotherWriter, 'SIGINT')
    return { interrupted, rewritten, after: textsOf(project.dir, EVERY_CHANGED_FILE) }
  }, RUNS_IN_THE_BACKGROUND)

  it("keeps that writer's text in both files and every other file's fix, names only the files check fixed in the autofixed line, says it was interrupted, and exits 130", () => {
    const { interrupted, rewritten, after } = run()

    expect({ signalled: interrupted.signalled, run: interrupted.run, after }).toStrictEqual({
      signalled: true,
      run: { exitCode: EXIT.interrupted, signal: null, stdout: autofixedLineOf(FIXED_BY_BOTH_ENGINES), stderr: CHECK_INTERRUPTED },
      after: { ...textsAfterEveryFix(), [rewritten]: ANOTHER_WRITERS_TEXT, [NOTHING_TO_FIX]: ANOTHER_WRITERS_TEXT_WHERE_NOTHING_WAS_FIXED },
    })
  })
})

describe('check interrupted once ESLint fixed what another writer wrote into a file after oxlint ended', () => {
  // Another writer adds a function ESLint fixes to a file oxlint fixed, after check read it. The middle
  // file: ESLint reaches it well after the write and well before its last file.
  const MIDDLE = FILES_OXLINT_FIXES / 2
  const WRITTEN_MEANWHILE = FIXED_BY_OXLINT[MIDDLE]
  const ANOTHER_WRITERS_TEXT = moduleText(letFixedOfFileAt(MIDDLE), ...WRAP)
  const ANOTHER_WRITERS_TEXT_FIXED = moduleText(letFixedOfFileAt(MIDDLE), ...WRAP_FIXED)

  const run = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const written = foundOr(WRITTEN_MEANWHILE, 'there is no middle file oxlint fixes')
    const project = projectBothEnginesFix(tempProjects)
    function anotherWriter(): void {
      project.write(written, ANOTHER_WRITERS_TEXT)
    }
    const fixed = { path: project.pathOf(written), text: ANOTHER_WRITERS_TEXT_FIXED }
    const interrupted = await checkSignalledOnceItFixedAnotherWritersText(project.dir, project.pathOf(FIXED_BY_ESLINT_FIRST), anotherWriter, fixed, 'SIGINT')
    return { interrupted, written, after: textsOf(project.dir, EVERY_CHANGED_FILE) }
  }, RUNS_IN_THE_BACKGROUND)

  it("keeps that writer's line, as ESLint fixed it, and every other file's fix, names each file it fixed in the autofixed line, says it was interrupted, and exits 130", () => {
    const { interrupted, written, after } = run()

    expect({ signalled: interrupted.signalled, run: interrupted.run, after }).toStrictEqual({
      signalled: true,
      run: { exitCode: EXIT.interrupted, signal: null, stdout: autofixedLineOf(FIXED_BY_BOTH_ENGINES), stderr: CHECK_INTERRUPTED },
      after: { ...textsAfterEveryFix(), [written]: ANOTHER_WRITERS_TEXT_FIXED },
    })
  })
})

describe('check that runs to its end while another writer rewrites a changed file it fixes nothing in', () => {
  const ANOTHER_WRITERS_TEXT = moduleText(exportedConstant('writtenByAnotherWriter'))

  const run = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const project = projectBothEnginesFix(tempProjects)
    function anotherWriter(): void {
      project.write(NOTHING_TO_FIX, ANOTHER_WRITERS_TEXT)
    }
    const ranOn = await checkRunningOnBesideAnotherWriter(project.dir, project.pathOf(FIXED_BY_ESLINT_FIRST), anotherWriter)
    return { ranOn, after: textsOf(project.dir, EVERY_CHANGED_FILE) }
  }, RUNS_IN_THE_BACKGROUND)

  it('names only the files its own fixes rewrote in the autofixed line, not the one that writer changed, and keeps that writer\'s text', () => {
    const { ranOn, after } = run()

    expect({ wrote: ranOn.wrote, run: ranOn.run, after }).toStrictEqual({
      wrote: true,
      run: { exitCode: EXIT.clean, signal: null, stdout: `${autofixedLineOf(FIXED_BY_BOTH_ENGINES)}check: no findings in ${String(EVERY_CHANGED_FILE.length)} changed files.\n`, stderr: '' },
      after: { ...textsAfterEveryFix(), [NOTHING_TO_FIX]: ANOTHER_WRITERS_TEXT },
    })
  })
})

describe('check where ESLint throws on each file once oxlint wrote its fixes', () => {
  // oxlint's fix run comes before ESLint, which throws on the selector as it lints each file.
  const FILES = ['src/first.ts', 'src/second.ts']
  const ESLINT_THROWING = { rules: { 'no-restricted-syntax': ['error', A_SELECTOR_ESLINT_THROWS_ON] } } as const

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    function runOn(lineOfFileAt: (index: number) => string): { readonly result: CliRun; readonly notChecked: string; readonly after: Record<string, string> } {
      const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(IMMUTABILITY, ESLINT_THROWING) })
      for (const [index, file] of FILES.entries()) project.write(file, moduleText(lineOfFileAt(index)))
      const result = runCheck(project.dir)
      const notChecked = FILES.map((file) => `${notCheckedByEslint(file, eslintMessageWhileLinting(A_SELECTOR_ESLINT_THROWS_ON_MESSAGE, project.pathOf(file)))}\n`).join('')
      return { result, notChecked, after: textsOf(project.dir, FILES) }
    }
    return { oxlintFixed: runOn(letOfFileAt), nothingFixed: runOn(letFixedOfFileAt) }
  })

  it("keeps oxlint's fixes, names the files in the autofixed line, lists each file as not checked, says not everything was checked, and exits 2", () => {
    const { result, notChecked, after } = runs().oxlintFixed

    expect({ result, after }).toStrictEqual({
      result: { exitCode: EXIT.couldNotRun, signal: null, stdout: `${autofixedLineOf(FILES)}${notChecked}${NOT_EVERYTHING_CHECKED_SUMMARY}\n`, stderr: '' },
      after: Object.fromEntries(FILES.map((file, index) => [file, moduleText(letFixedOfFileAt(index))])),
    })
  })

  it('prints no autofixed line where it rewrote nothing, beside that run', () => {
    const { result, notChecked } = runs().nothingFixed

    expect(result).toStrictEqual({ exitCode: EXIT.couldNotRun, signal: null, stdout: `${notChecked}${NOT_EVERYTHING_CHECKED_SUMMARY}\n`, stderr: '' })
  })
})

describe('check where another writer deletes a changed file while oxlint fixes', () => {
  // ESLint reaches the deleted file, last in path order, well after oxlint's fix run wrote the first file.
  const WITH_A_FINDING = 'src/a-debugger.ts'
  const DELETED = 'src/untouched.ts'

  const run = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(IMMUTABILITY_AND_REDUNDANCY) })
    project.write(WITH_A_FINDING, moduleText(exportedConstant('withAFinding'), DEBUGGER_STATEMENT))
    for (const [index, file] of FIXED_BY_OXLINT.entries()) project.write(file, moduleText(letOfFileAt(index)))
    project.write(DELETED, NOTHING_TO_FIX_TEXT)
    const [firstFixed] = FIXED_BY_OXLINT
    if (firstFixed === undefined) throw new Error('there is no file oxlint fixes')
    return checkRunningOnBesideAnotherWriter(project.dir, project.pathOf(firstFixed), () => project.remove(DELETED))
  }, RUNS_IN_THE_BACKGROUND)

  it("lists that file as not checked, keeps and names oxlint's fixes, prints the other files' findings, and exits 1", () => {
    const { wrote, run: ran } = run()

    expect({
      wrote,
      exitCode: ran.exitCode,
      autofixed: autofixedFilesIn(ran.stdout),
      findings: findingsIn(ran.stdout),
      notChecked: notCheckedIn(ran.stdout),
      stderr: ran.stderr,
    }).toStrictEqual({
      wrote: true,
      exitCode: EXIT.findings,
      autofixed: FIXED_BY_OXLINT,
      findings: [`${WITH_A_FINDING}:2 no-debugger`],
      notChecked: [notCheckedAsGone(DELETED)],
      stderr: '',
    })
  })
})

/** A run beside another writer, made before the suite, and what check owes it. */
type GoneComponentCase = {
  readonly kind: string
  readonly ran: () => RunBesideAnotherWriter
  readonly wrote: boolean
  readonly exitCode: number
  readonly notChecked: readonly string[]
  readonly summary: string
}

describe('check where another writer deletes a changed component while oxlint fixes', () => {
  // Only the report reads a component again: ESLint never reads one, and oxlint skips a path with no file (measured, oxlint 1.87).
  const FIXED = 'src/fixed.ts'
  const COMPONENT = 'src/untouched.vue'

  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    function projectOf(): GitProject {
      const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(IMMUTABILITY) })
      project.write(FIXED, moduleText(exportedLet('fixed')))
      project.write(COMPONENT, moduleText(...vueComponentScripting([exportedConstant('untouched')])))
      return project
    }
    const deletedFrom = projectOf()
    const keptIn = projectOf()
    return {
      deleted: await checkRunningOnBesideAnotherWriter(deletedFrom.dir, deletedFrom.pathOf(FIXED), () => deletedFrom.remove(COMPONENT)),
      nothingDeleted: { wrote: false, run: runCheck(keptIn.dir) },
    }
  }, RUNS_IN_THE_BACKGROUND)

  it.each<GoneComponentCase>([
    { kind: 'deleted', ran() { return runs().deleted }, wrote: true, exitCode: EXIT.couldNotRun, notChecked: [notCheckedAsGone(COMPONENT)], summary: NOT_EVERYTHING_CHECKED_SUMMARY },
    { kind: 'nothing deleted', ran() { return runs().nothingDeleted }, wrote: false, exitCode: EXIT.clean, notChecked: [], summary: 'check: no findings in 2 changed files.' },
  ])("lists the component as not checked and never exits 0 where it is gone by the report, keeping oxlint's fix, beside a run where it stays: $kind", ({ ran, ...expected }) => {
    const { wrote, run } = ran()

    expect({ wrote, exitCode: run.exitCode, autofixed: autofixedFilesIn(run.stdout), notChecked: notCheckedIn(run.stdout), summary: lastLineOf(run.stdout), stderr: run.stderr }).toStrictEqual({
      wrote: expected.wrote,
      exitCode: expected.exitCode,
      autofixed: [FIXED],
      notChecked: expected.notChecked,
      summary: expected.summary,
      stderr: '',
    })
  })
})
