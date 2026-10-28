import { join } from 'node:path'
import { realpathSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  A_CLEAN_COMPONENT,
  A_DEFAULT_EXPORT_NAMED_APART,
  A_DEFAULT_EXPORT_NAMED_APART_ITS_VALUE_CHANGED,
  A_DISABLE_ON_ONE_LINE_ABOVE_A_DEBUGGER,
  A_DISABLE_OVER_SEVERAL_LINES_ABOVE_A_DEBUGGER,
  A_LITERAL_THROWN,
  AN_ENABLE_CLOSING_NOTHING,
  AN_ENABLE_CLOSING_NOTHING_WITH_A_DEBUGGER_ADDED,
  A_SUPPRESSION_OF_NOTHING,
  A_TABLE,
  A_TABLE_WITH_DUPLICATES_ADDED,
  A_WHOLLY_UNUSED_OXLINT_DISABLE,
  A_WHOLLY_UNUSED_OXLINT_DISABLE_BELOW_A_STRING_HOLDING_ITS_TEXT,
  A_SUPPRESSION_OVER_A_FINDING,
  A_SELECTOR_ESLINT_THROWS_ON,
  A_SELECTOR_ESLINT_THROWS_ON_MESSAGE,
  A_SYNTAX_ERROR,
  ANOTHER_COPY_OF_THE_PACKAGE,
  aSuppressionPartlyUnused,
  ENABLES_CLOSING_NOTHING_ABOVE_A_DEBUGGER,
  GUARDED_BY_A_USELESS_CATCH,
  GUARDED_BY_FINALLY,
  movedDownByAnotherWriter,
  noDebuggerPairAround,
  OXLINT_CONFIG_TURNING_NO_DEBUGGER_OFF,
  OXLINT_FORM_SUPPRESSIONS_ONE_UNUSED,
  RETHROWN_BY_A_USELESS_CATCH,
  RETHROWN_WITH_A_COMMENT_ADDED,
  SUPPRESSIONS_TWO_UNUSED,
  THROWING_ESLINT_CONFIG,
  withACharacterAddedToTheFirstLine,
} from './__tests__/cases/check-sources.ts'
import { NO_CONSOLE_OPTION_OXLINT_REFUSES, OXLINT_REFUSAL_OF_AN_OPTION } from './__tests__/cases/oxlint-refusals.ts'
import {
  A_PAIR_AROUND_A_STRING_HOLDING_AN_ENABLE,
  A_PAIR_AROUND_A_TEMPLATE_HOLDING_AN_ENABLE,
  A_PAIR_BELOW_A_STRING_HOLDING_A_DISABLE,
  A_PAIR_BELOW_A_STRING_HOLDING_NO_COMMENT,
} from './__tests__/cases/suppression-pairs.ts'
import { findingMessagesIn, findingsIn, findingsInFile, lastLineOf, notCheckedIn } from './__tests__/check-output.ts'
import {
  anotherWriterAsOxlintsLintRunEnds,
  type BackgroundRun,
  checkInTheBackground,
  checkSignalledOnceItsConfigAppears,
  type CliRun,
  EXIT,
  idOfAnEndedProcess,
  nodeBelowTheFloor,
  runCheck,
  runCli,
  runInit,
  RUNS_IN_THE_BACKGROUND,
  setUpCheckAfterTheAgent,
  tempConfigNameOf,
  tempConfigPatternOf,
  tempConfigsIn,
} from './__tests__/cli-runs.ts'
import {
  A_TSCONFIG_TAKING_IN_THE_REPO,
  blockDisable,
  CHECK_ESLINT_FAILED,
  CHECK_INTERRUPTED,
  checkConfigText,
  checkConfigTextExportingACopy,
  checkConfigTextHanding,
  checkedPackageFiles,
  CONFIG_FILE,
  DEBUGGER_STATEMENT,
  ERRORS_SUMMARY_TAIL,
  eslintMessageWhileLinting,
  exportedConstant,
  moduleText,
  NESTED_PACKAGE,
  NOT_EVERYTHING_CHECKED_SUMMARY,
  notCheckedByEslint,
  notCheckedByOxlint,
  NOTHING_TO_CHECK,
  PACKAGE_JSON_FILE,
  REDUNDANCY,
  type SuppressionForm,
  SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED,
  unusedSuppressionMessageOf,
  USAGE,
} from './__tests__/factories/check-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { type FolderWatch, watchFolder } from './__tests__/folder-watch.ts'
import { createGitProject, gitStatusOf } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { entriesUnder, INSTALLED_OXLINT, setUpEmptyFolders, THIS_PACKAGE } from './__tests__/temp-projects.ts'
import type { TwoSetLintRulesInput } from './core/lint-rules-input.ts'
import { refuseATsconfigRootDirThatIsNoFolder } from './core/tsconfig-root-dir-folder.ts'

// The fixtures fire only rules that never fix, so the fix step changes nothing here:
// check-fixes.integration.test.ts covers it.

allowEveryTestForParallelLoad()

const REDUNDANCY_AND_NAMING = { quality: ['redundancy', 'naming'] } as const
const REDUNDANCY_AND_MODERN_JS = { quality: ['redundancy', 'modern-js'] } as const
const REDUNDANCY_AND_CORRECTNESS = { quality: ['redundancy', 'correctness'] } as const
const CORRECTNESS_AND_REACT = { quality: ['correctness'], libs: { ui: ['react'] } } as const
const CORRECTNESS_AND_MODULES = { quality: ['correctness', 'modules'] } as const

// typescript-eslint 8.71's message for `export const = 2`; oxlint reports the same line as "Unexpected token".
const ESLINT_PARSE_ERROR_MESSAGE = 'Parsing error: Variable declaration expected.'

describe('check on the files and lines changed since the last commit', () => {
  const EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']
  const NOT_JS_OR_TS = { 'src/ext/a.json': '{ "debugger": true }\n', 'src/ext/a.md': moduleText(DEBUGGER_STATEMENT), 'src/ext/a.css': 'a { color: red; }\n' }

  const runs = setUpCheckAfterTheAgent(
    {
      ...checkedPackageFiles(REDUNDANCY, { ignores: ['src/generated/**'] }),
      'eslint.config.mjs': THROWING_ESLINT_CONFIG,
      '.oxlintrc.json': OXLINT_CONFIG_TURNING_NO_DEBUGGER_OFF,
      'src/.oxlintrc.json': OXLINT_CONFIG_TURNING_NO_DEBUGGER_OFF,
      'src/partly.ts': moduleText(exportedConstant('partly'), DEBUGGER_STATEMENT),
      'src/staged-only.ts': moduleText(exportedConstant('stagedOnly')),
      'src/unstaged-only.ts': moduleText(exportedConstant('unstagedOnly')),
    },
    (project) => {
      project.append('src/partly.ts', moduleText(DEBUGGER_STATEMENT))
      project.append('src/staged-only.ts', moduleText(DEBUGGER_STATEMENT))
      project.git('add', 'src/staged-only.ts')
      project.append('src/unstaged-only.ts', moduleText(DEBUGGER_STATEMENT))
      project.write('src/new-untracked.ts', moduleText(exportedConstant('fresh'), DEBUGGER_STATEMENT, DEBUGGER_STATEMENT))
      project.write('src/with space.ts', moduleText(exportedConstant('spaced'), DEBUGGER_STATEMENT))
      project.write('src/ünïcode.ts', moduleText(exportedConstant('accented'), DEBUGGER_STATEMENT))
      for (const extension of EXTENSIONS) project.write(`src/ext/a.${extension}`, moduleText(DEBUGGER_STATEMENT))
      for (const [file, content] of Object.entries(NOT_JS_OR_TS)) project.write(file, content)
      project.write('src/generated/gen.ts', moduleText(DEBUGGER_STATEMENT))
      project.write('src/broken.ts', moduleText(...A_SYNTAX_ERROR))
    },
  )

  it('reports every line of an untracked file', () => {
    expect(findingsInFile(runs().stdout, 'src/new-untracked.ts')).toStrictEqual(['src/new-untracked.ts:2 no-debugger', 'src/new-untracked.ts:3 no-debugger'])
  })

  it('reports a finding on a changed line of a tracked file, and not the one on its unchanged line', () => {
    expect(findingsInFile(runs().stdout, 'src/partly.ts')).toStrictEqual(['src/partly.ts:3 no-debugger'])
  })

  it('checks a path with a space and one with letters outside ASCII, and prints each as it is', () => {
    const { stdout } = runs()

    expect([...findingsInFile(stdout, 'src/with space.ts'), ...findingsInFile(stdout, 'src/ünïcode.ts')]).toStrictEqual([
      'src/with space.ts:2 no-debugger',
      'src/ünïcode.ts:2 no-debugger',
    ])
  })

  it('counts a change only staged and a change not staged alike', () => {
    const { stdout } = runs()

    expect([...findingsInFile(stdout, 'src/staged-only.ts'), ...findingsInFile(stdout, 'src/unstaged-only.ts')]).toStrictEqual([
      'src/staged-only.ts:2 no-debugger',
      'src/unstaged-only.ts:2 no-debugger',
    ])
  })

  it('lints a changed file of each of the eight JS and TS extensions, and no .json, .md or .css file', () => {
    expect(
      findingsIn(runs().stdout)
        .filter((finding) => finding.startsWith('src/ext/'))
        .toSorted(),
    ).toStrictEqual(EXTENSIONS.map((extension) => `src/ext/a.${extension}:1 no-debugger`).toSorted())
  })

  it("reports nothing in a changed file the config's ignores name, in either engine, and leaves it out of the count", () => {
    const { stdout } = runs()

    expect({ inTheIgnoredFile: findingsInFile(stdout, 'src/generated/gen.ts'), summary: lastLineOf(stdout) }).toStrictEqual({
      inTheIgnoredFile: [],
      summary: `check: 16 errors and 0 warnings in 15 of 15 changed files. ${ERRORS_SUMMARY_TAIL}`,
    })
  })

  it("imports neither the project's own ESLint config, which throws, nor reads its oxlint configs, which turn the rule off", () => {
    const { exitCode, stderr, stdout } = runs()

    expect({ exitCode, stderr, partly: findingsInFile(stdout, 'src/partly.ts') }).toStrictEqual({
      exitCode: EXIT.findings,
      stderr: '',
      partly: ['src/partly.ts:3 no-debugger'],
    })
  })

  it("reports a syntax error once, as a parse error with ESLint's message, and exits 1", () => {
    const { exitCode, stdout } = runs()

    expect({
      exitCode,
      findings: findingsInFile(stdout, 'src/broken.ts'),
      message: findingMessagesIn(stdout).get('src/broken.ts:2 parse error'),
    }).toStrictEqual({ exitCode: EXIT.findings, findings: ['src/broken.ts:2 parse error'], message: ESLINT_PARSE_ERROR_MESSAGE })
  })

  it('reports nothing beyond these', () => {
    expect(findingsIn(runs().stdout).toSorted()).toStrictEqual(
      [
        'src/new-untracked.ts:2 no-debugger',
        'src/new-untracked.ts:3 no-debugger',
        'src/partly.ts:3 no-debugger',
        'src/with space.ts:2 no-debugger',
        'src/ünïcode.ts:2 no-debugger',
        'src/staged-only.ts:2 no-debugger',
        'src/unstaged-only.ts:2 no-debugger',
        ...EXTENSIONS.map((extension) => `src/ext/a.${extension}:1 no-debugger`),
        'src/broken.ts:2 parse error',
      ].toSorted(),
    )
  })
})

describe('check on moved files', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        ...checkedPackageFiles(REDUNDANCY),
        'src/git-moved.ts': moduleText(exportedConstant('gitMoved'), DEBUGGER_STATEMENT, exportedConstant('gitMovedAfter')),
        'src/plain-moved.ts': moduleText(exportedConstant('plainMoved'), DEBUGGER_STATEMENT, exportedConstant('plainMovedAfter')),
      },
    })
    project.git('mv', 'src/git-moved.ts', 'src/git-moved-to.ts')
    project.append('src/git-moved-to.ts', moduleText(DEBUGGER_STATEMENT))
    project.move('src/plain-moved.ts', 'src/plain-moved-to.ts')
    project.append('src/plain-moved-to.ts', moduleText(DEBUGGER_STATEMENT))
    project.write('src/unpaired.ts', moduleText(DEBUGGER_STATEMENT, exportedConstant('unpaired'), DEBUGGER_STATEMENT))
    const statusBefore = gitStatusOf(project)
    const indexBefore = project.readBytes('.git/index')
    const run = runCheck(project.dir)
    return { run, statusBefore, statusAfter: gitStatusOf(project), indexBefore, indexAfter: project.readBytes('.git/index') }
  })

  it('reports only the line appended to a file moved with git mv', () => {
    expect(findingsInFile(runs().run.stdout, 'src/git-moved-to.ts')).toStrictEqual(['src/git-moved-to.ts:4 no-debugger'])
  })

  it('pairs a file moved with a plain mv with its old path, reporting only the line appended', () => {
    expect(findingsInFile(runs().run.stdout, 'src/plain-moved-to.ts')).toStrictEqual(['src/plain-moved-to.ts:4 no-debugger'])
  })

  it('still reports every line of a new file that pairs with no old path', () => {
    expect(findingsInFile(runs().run.stdout, 'src/unpaired.ts')).toStrictEqual(['src/unpaired.ts:1 no-debugger', 'src/unpaired.ts:3 no-debugger'])
  })

  it('leaves the real index byte for byte as it was, and git status unchanged', () => {
    const { run, statusBefore, statusAfter, indexBefore, indexAfter } = runs()

    expect({
      plainMovePaired: findingsInFile(run.stdout, 'src/plain-moved-to.ts'),
      indexUnchanged: indexAfter.equals(indexBefore),
      statusAfter,
    }).toStrictEqual({ plainMovePaired: ['src/plain-moved-to.ts:4 no-debugger'], indexUnchanged: true, statusAfter: statusBefore })
  })
})

describe('check on deleted files', () => {
  const run = setUpCheckAfterTheAgent(
    {
      ...checkedPackageFiles(REDUNDANCY),
      'src/deleted-from-disk.ts': moduleText(exportedConstant('deletedFromDisk'), DEBUGGER_STATEMENT),
      'src/deleted-by-git.ts': moduleText(exportedConstant('deletedByGit'), DEBUGGER_STATEMENT),
      'src/kept.ts': moduleText(exportedConstant('kept')),
    },
    (project) => {
      project.remove('src/deleted-from-disk.ts')
      project.git('rm', '--quiet', 'src/deleted-by-git.ts')
      project.append('src/kept.ts', moduleText(DEBUGGER_STATEMENT))
    },
  )

  it('never reports or counts a deleted file, whether git or the disk deleted it', () => {
    const { exitCode, stdout } = run()

    expect({ exitCode, findings: findingsIn(stdout), summary: lastLineOf(stdout) }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: ['src/kept.ts:2 no-debugger'],
      summary: `check: 1 error and 0 warnings in 1 of 1 changed file. ${ERRORS_SUMMARY_TAIL}`,
    })
  })
})

describe('check in a repo with no commits', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'no commits',
      files: {
        ...checkedPackageFiles(REDUNDANCY),
        '.gitignore': 'src/ignored-by-git.ts\n',
        'src/staged.ts': moduleText(exportedConstant('staged'), DEBUGGER_STATEMENT),
        'src/untracked.ts': moduleText(exportedConstant('untracked'), DEBUGGER_STATEMENT),
        'src/ignored-by-git.ts': moduleText(DEBUGGER_STATEMENT),
      },
    })
    project.git('add', 'src/staged.ts')
    return runCheck(project.dir)
  })

  it('counts every tracked or untracked file git does not ignore as wholly changed, the config included', () => {
    const { exitCode, stdout } = run()

    expect({ exitCode, findings: findingsIn(stdout).toSorted(), summary: lastLineOf(stdout) }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: ['src/staged.ts:2 no-debugger', 'src/untracked.ts:2 no-debugger'],
      summary: `check: 2 errors and 0 warnings in 2 of 3 changed files. ${ERRORS_SUMMARY_TAIL}`,
    })
  })
})

describe('check with no changed JS or TS file, then with only the config changed', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...checkedPackageFiles(REDUNDANCY), 'README.md': '# A project\n', 'src/a.ts': moduleText(exportedConstant('a')) },
    })
    project.append('README.md', 'A line the agent added.\n')
    const statusBefore = gitStatusOf(project)
    const entriesBefore = entriesUnder(project.dir)
    const watched = watchFolder(project.dir)
    const nothingToCheck = runCheck(project.dir)
    const namesSeen = await watched.namesSeen()
    watched.close()
    const afterNothingToCheck = { statusAfter: gitStatusOf(project), entriesAfter: entriesUnder(project.dir) }
    project.append(CONFIG_FILE, '// A line an agent added.\n')
    const configChanged = runCheck(project.dir)
    return { nothingToCheck, namesSeen, statusBefore, entriesBefore, ...afterNothingToCheck, configChanged }
  }, RUNS_IN_THE_BACKGROUND)

  it('says there is nothing to check and exits 0 when only a file that is not JS or TS changed', () => {
    const { nothingToCheck } = runs()

    expect(nothingToCheck).toStrictEqual({ exitCode: EXIT.clean, signal: null, stdout: NOTHING_TO_CHECK, stderr: '' })
  })

  it('creates no temporary config, not even for a moment, and writes no file then', () => {
    const { nothingToCheck, namesSeen, statusBefore, statusAfter, entriesBefore, entriesAfter } = runs()

    expect({ stdout: nothingToCheck.stdout, namesSeen, statusAfter, entriesAfter }).toStrictEqual({
      stdout: NOTHING_TO_CHECK,
      namesSeen: [],
      statusAfter: statusBefore,
      entriesAfter: entriesBefore,
    })
  })

  it('says nothing about an agents-inc.lint.mts an agent changed, and lints it as a changed file', () => {
    expect(runs().configChanged).toStrictEqual({ exitCode: EXIT.clean, signal: null, stdout: 'check: no findings in 1 changed file.\n', stderr: '' })
  })

  it('says nothing about the rulesets the config leaves out, where it lists one of them', () => {
    const { nothingToCheck, configChanged } = runs()

    expect({ stderr: [nothingToCheck.stderr, configChanged.stderr], exitCodes: [nothingToCheck.exitCode, configChanged.exitCode] }).toStrictEqual({
      stderr: ['', ''],
      exitCodes: [EXIT.clean, EXIT.clean],
    })
  })
})

describe('what check leaves behind', () => {
  const emptyFolder = setUpEmptyFolders()
  const APP = 'app'
  const RUN_FROM = 'app/src'
  const CHANGED_WHEN_ESLINT_FAILS = [CONFIG_FILE, 'src/clean.ts', 'src/finding.ts']

  /** What one run left: whether its temporary config appeared in the git top level and in the config's folder, any left in the folders it touches, and any file outside the project. */
  type LeftBehind = BackgroundRun & {
    readonly tempConfigSeenInTheGitTopLevel: boolean
    readonly tempConfigSeenInTheConfigFolder: boolean
    readonly leftovers: readonly string[]
    readonly outside: readonly string[]
  }

  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...checkedPackageFiles(REDUNDANCY, {}, `${APP}/`), [`${APP}/src/committed.ts`]: moduleText(exportedConstant('committed')) },
    })
    const configFolder = project.pathOf(APP)
    const runFolder = project.pathOf(RUN_FROM)

    // HOME, XDG_STATE_HOME and TMPDIR each an empty folder of its own: what check writes outside the project lands in one.
    async function runLeaving(start: (env: Readonly<Record<string, string>>, watched: FolderWatch) => Promise<BackgroundRun>): Promise<LeftBehind> {
      const outside = { HOME: emptyFolder(), XDG_STATE_HOME: emptyFolder(), TMPDIR: emptyFolder() }
      const watchedTopLevel = watchFolder(project.dir)
      const watchedConfigFolder = watchFolder(configFolder)
      const started = await start(outside, watchedTopLevel)
      const [namesSeenInTheTopLevel, namesSeenInTheConfigFolder] = await Promise.all([watchedTopLevel.namesSeen(), watchedConfigFolder.namesSeen()])
      watchedTopLevel.close()
      watchedConfigFolder.close()
      function isItsConfig(name: string): boolean {
        return tempConfigPatternOf(started.pid).test(name)
      }
      return {
        ...started,
        tempConfigSeenInTheGitTopLevel: namesSeenInTheTopLevel.some(isItsConfig),
        tempConfigSeenInTheConfigFolder: namesSeenInTheConfigFolder.some(isItsConfig),
        leftovers: [...tempConfigsIn(configFolder), ...tempConfigsIn(runFolder), ...tempConfigsIn(project.dir)],
        outside: Object.values(outside).flatMap((folder) => entriesUnder(folder)),
      }
    }

    function toTheEnd(env: Readonly<Record<string, string>>): Promise<BackgroundRun> {
      return checkInTheBackground(runFolder, { env })
    }
    function signalledWith(signal: NodeJS.Signals) {
      return (env: Readonly<Record<string, string>>, watched: FolderWatch): Promise<BackgroundRun> =>
        checkSignalledOnceItsConfigAppears(runFolder, watched, signal, { env })
    }

    project.write(`${APP}/src/clean.ts`, moduleText(exportedConstant('clean')))
    const clean = await runLeaving(toTheEnd)
    project.write(`${APP}/src/finding.ts`, moduleText(exportedConstant('finding'), DEBUGGER_STATEMENT))
    const findings = await runLeaving(toTheEnd)
    const interrupted = await runLeaving(signalledWith('SIGINT'))
    const terminated = await runLeaving(signalledWith('SIGTERM'))
    const committedConfig = project.read(`${APP}/${CONFIG_FILE}`)
    project.write(`${APP}/${CONFIG_FILE}`, checkConfigText(REDUNDANCY, { rules: { 'no-restricted-syntax': ['error', A_SELECTOR_ESLINT_THROWS_ON] } }))
    const engineFailure = await runLeaving(toTheEnd)
    project.write(`${APP}/${CONFIG_FILE}`, committedConfig)

    const fromAnEndedProcess = tempConfigNameOf(idOfAnEndedProcess(), 'left-by-an-ended-run')
    const fromALiveProcess = tempConfigNameOf(process.pid, 'held-by-a-live-run')
    project.write(fromAnEndedProcess, '{}\n')
    project.write(fromALiveProcess, '{}\n')
    const sweep = await checkInTheBackground(runFolder)
    const afterTheSweep = tempConfigsIn(project.dir)

    function eslintFailedOn(file: string): string {
      return notCheckedByEslint(file, eslintMessageWhileLinting(A_SELECTOR_ESLINT_THROWS_ON_MESSAGE, project.pathOf(`${APP}/${file}`)))
    }
    return { clean, findings, interrupted, terminated, engineFailure, notCheckedWhereEslintFails: CHANGED_WHEN_ESLINT_FAILS.map(eslintFailedOn), sweep, fromALiveProcess, afterTheSweep }
  }, RUNS_IN_THE_BACKGROUND)
  type CheckRuns = ReturnType<typeof runs>

  it.each<{ readonly kind: string; readonly exitCode: number; readonly ran: () => CheckRuns['clean'] }>([
    { kind: 'a clean run', exitCode: EXIT.clean, ran() { return runs().clean } },
    { kind: 'a run with findings', exitCode: EXIT.findings, ran() { return runs().findings } },
  ])("writes its temporary oxlint config in the git top level, not the config's folder, while it runs, and leaves none behind, after $kind", ({ exitCode, ran }) => {
    const { run, tempConfigSeenInTheGitTopLevel, tempConfigSeenInTheConfigFolder, leftovers } = ran()

    expect({ exitCode: run.exitCode, tempConfigSeenInTheGitTopLevel, tempConfigSeenInTheConfigFolder, leftovers }).toStrictEqual({
      exitCode,
      tempConfigSeenInTheGitTopLevel: true,
      tempConfigSeenInTheConfigFolder: false,
      leftovers: [],
    })
  })

  // finding.ts holds an oxlint-found error, so the run exits 1.
  it('lists each file ESLint failed on as not checked, prints nothing on stderr, and leaves no temporary config behind', () => {
    const { engineFailure, notCheckedWhereEslintFails } = runs()
    const { run, tempConfigSeenInTheGitTopLevel, leftovers } = engineFailure

    expect({ exitCode: run.exitCode, notChecked: notCheckedIn(run.stdout), stderr: run.stderr, tempConfigSeenInTheGitTopLevel, leftovers }).toStrictEqual({
      exitCode: EXIT.findings,
      notChecked: notCheckedWhereEslintFails,
      stderr: '',
      tempConfigSeenInTheGitTopLevel: true,
      leftovers: [],
    })
  })

  it.each<{ readonly signal: NodeJS.Signals; readonly exitCode: number; readonly ran: () => CheckRuns['interrupted'] }>([
    { signal: 'SIGINT', exitCode: EXIT.interrupted, ran() { return runs().interrupted } },
    { signal: 'SIGTERM', exitCode: EXIT.terminated, ran() { return runs().terminated } },
  ])('exits $exitCode on $signal, says it was interrupted, and leaves no temporary config behind', ({ exitCode, ran }) => {
    const { signalled, run, leftovers } = ran()

    expect({ signalled, exitCode: run.exitCode, stderr: run.stderr, leftovers }).toStrictEqual({ signalled: true, exitCode, stderr: CHECK_INTERRUPTED, leftovers: [] })
  })

  // check-fixes.integration.test.ts covers a signal after check fixed files, which it names.
  it.each<{ readonly signal: NodeJS.Signals; readonly ran: () => CheckRuns['interrupted'] }>([
    { signal: 'SIGINT', ran() { return runs().interrupted } },
    { signal: 'SIGTERM', ran() { return runs().terminated } },
  ])('prints no autofixed line on $signal, where it had fixed nothing', ({ ran }) => {
    const { signalled, run } = ran()

    expect({ signalled, stdout: run.stdout }).toStrictEqual({ signalled: true, stdout: '' })
  })

  it('writes nothing outside the project in any of those runs: no log, no scratch index left', () => {
    const { clean, findings, interrupted, terminated, engineFailure } = runs()

    expect([clean, findings, interrupted, terminated, engineFailure].map(({ run, outside }) => ({ exitCode: run.exitCode, outside }))).toStrictEqual([
      { exitCode: EXIT.clean, outside: [] },
      { exitCode: EXIT.findings, outside: [] },
      { exitCode: EXIT.interrupted, outside: [] },
      { exitCode: EXIT.terminated, outside: [] },
      { exitCode: EXIT.findings, outside: [] },
    ])
  })

  it('removes a temporary config in the git top level left by a process that has ended, and keeps one whose process lives', () => {
    const { sweep, afterTheSweep, fromALiveProcess } = runs()

    expect({ exitCode: sweep.run.exitCode, afterTheSweep }).toStrictEqual({ exitCode: EXIT.findings, afterTheSweep: [fromALiveProcess] })
  })
})

describe('two checks started together in one project', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY) })
    project.write('src/a.ts', moduleText(exportedConstant('a'), DEBUGGER_STATEMENT))
    const both = await Promise.all([checkInTheBackground(project.dir), checkInTheBackground(project.dir)])
    return { both, leftovers: tempConfigsIn(project.dir) }
  }, RUNS_IN_THE_BACKGROUND)

  it('each exit 1 with the same findings, and leave no temporary config behind', () => {
    const { both, leftovers } = runs()

    expect({ runs: both.map(({ run }) => ({ exitCode: run.exitCode, findings: findingsIn(run.stdout) })), leftovers }).toStrictEqual({
      runs: [
        { exitCode: EXIT.findings, findings: ['src/a.ts:2 no-debugger'] },
        { exitCode: EXIT.findings, findings: ['src/a.ts:2 no-debugger'] },
      ],
      leftovers: [],
    })
  })
})

/** The message defineLintRules throws for these settings, which check prints as it is. */
function validationMessageFor({ tsconfigRootDir }: TwoSetLintRulesInput): string {
  try {
    refuseATsconfigRootDirThatIsNoFolder(tsconfigRootDir)
  } catch (error) {
    if (error instanceof Error) return error.message
    throw error
  }
  throw new Error('defineLintRules accepted settings the test needs it to refuse')
}

describe('check where it cannot run', () => {
  // A relative tsconfigRootDir: defineLintRules refuses it.
  const REFUSED_SETTINGS: TwoSetLintRulesInput = {
    tsconfigRootDir: '.',
    agentRulesets: { quality: [], libs: {}, runtimes: [] },
    editorRulesets: { quality: [], libs: {}, runtimes: [] },
  }
  const OLD_NODE = nodeBelowTheFloor()

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const notARepo = createGitProject(tempProjects, { repo: 'not a repo', files: checkedPackageFiles(REDUNDANCY) })
    const noConfig = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [PACKAGE_JSON_FILE]: packageJsonText(buildPackageJson()), 'src/a.ts': moduleText(exportedConstant('a')) },
    })
    noConfig.writeAbove(CONFIG_FILE, checkConfigText(REDUNDANCY))
    const configError = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [PACKAGE_JSON_FILE]: packageJsonText(buildPackageJson()), [CONFIG_FILE]: checkConfigTextHanding(REFUSED_SETTINGS) },
    })
    const notInstalled = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY), linkedPackages: [INSTALLED_OXLINT] })
    const otherCopyDir = realpathSync(tempProjects.create({ files: ANOTHER_COPY_OF_THE_PACKAGE }))
    const otherCopy = createGitProject(tempProjects, {
      repo: 'committed',
      files: checkedPackageFiles(REDUNDANCY),
      linkedPackages: [{ name: THIS_PACKAGE.name, dir: otherCopyDir }, INSTALLED_OXLINT],
    })
    const gitFails = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY) })
    gitFails.write('.git/index', 'not an index\n')
    const oldNode = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY) })
    const initOnOldNode = createGitProject(tempProjects, { repo: 'not a repo', files: { [PACKAGE_JSON_FILE]: packageJsonText(buildPackageJson()) } })
    return {
      notARepo: { dir: notARepo.dir, run: runCheck(notARepo.dir) },
      noConfig: { dir: noConfig.dir, run: runCheck(noConfig.dir), fromBelow: runCheck(noConfig.pathOf('src')) },
      configError: { message: validationMessageFor(REFUSED_SETTINGS), run: runCheck(configError.dir) },
      notInstalled: runCheck(notInstalled.dir),
      otherCopy: { otherCopyDir, run: runCheck(otherCopy.dir) },
      gitFails: runCheck(gitFails.dir),
      oldNode: OLD_NODE === undefined ? null : { check: runCheck(oldNode.dir, { node: OLD_NODE.path }), init: runInit(initOnOldNode.dir, { node: OLD_NODE.path }), initDir: initOnOldNode.dir },
    }
  })

  it('exits 2 outside a git repository', () => {
    const { dir, run } = runs().notARepo

    expect(run).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: `check: could not run: ${dir} is not inside a git repository, and check reads the changed files from git.\n`,
    })
  })

  it('exits 2 where no agents-inc.lint.mts is in the folder or any above it up to the git top level', () => {
    const { dir, run } = runs().noConfig

    expect(run).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: `check: could not run: there is no agents-inc.lint.mts in ${dir} or any folder above it up to ${dir}. Run "agents-inc-lint init" in the folder of the package to lint.\n`,
    })
  })

  it('does not use an agents-inc.lint.mts above the git top level, run from a folder below it', () => {
    const { dir, fromBelow } = runs().noConfig

    expect(fromBelow).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: `check: could not run: there is no agents-inc.lint.mts in ${join(dir, 'src')} or any folder above it up to ${dir}. Run "agents-inc-lint init" in the folder of the package to lint.\n`,
    })
  })

  it('exits 2 and prints the error the config throws as it is', () => {
    const { message, run } = runs().configError

    expect(run).toStrictEqual({ exitCode: EXIT.couldNotRun, signal: null, stdout: '', stderr: `check: could not run: ${message}\n` })
  })

  it('exits 2 where @agents-inc/lint-rules does not resolve from the config', () => {
    expect(runs().notInstalled).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: "check: could not run: @agents-inc/lint-rules is not installed where agents-inc.lint.mts can import it. Run your package manager's install.\n",
    })
  })

  it('exits 2 naming both copies where the config imports another copy of the package than this check, before importing it', () => {
    const { otherCopyDir, run } = runs().otherCopy

    expect(run).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: `check: could not run: agents-inc.lint.mts imports @agents-inc/lint-rules from ${otherCopyDir}, and this check is ${realpathSync(THIS_PACKAGE.dir)}. Run the check that project installed.\n`,
    })
  })

  it("exits 2 quoting git's first line where git fails", () => {
    const { exitCode, stdout, stderr } = runs().gitFails

    expect({ exitCode, stdout, quotesGit: /^check: could not run: git failed: (?:fatal|error): .+\n$/u.test(stderr) }).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      stdout: '',
      quotesGit: true,
    })
  })

  // Runs where PATH holds a Node older than 22.18; skipped, and so reported, where it holds none.
  it.runIf(OLD_NODE !== undefined)('exits 2 on a Node older than 22.18, check and init alike, saying which Node it is', () => {
    const { oldNode } = runs()
    if (oldNode === null || OLD_NODE === undefined) throw new Error('the old Node runs were not made')
    const version = OLD_NODE.version.replace(/^v/u, '')
    function floorLine(command: string): RegExp {
      return new RegExp(`^${command}: could not run: Node 22\\.18 or later is needed; this is Node v?${version.replaceAll('.', '\\.')}\\.\\n$`, 'u')
    }

    expect({
      check: { exitCode: oldNode.check.exitCode, stdout: oldNode.check.stdout, floor: floorLine('check').test(oldNode.check.stderr) },
      init: { exitCode: oldNode.init.exitCode, floor: floorLine('init').test(oldNode.init.stderr), wroteNothing: entriesUnder(oldNode.initDir) },
    }).toStrictEqual({
      check: { exitCode: EXIT.couldNotRun, stdout: '', floor: true },
      init: { exitCode: EXIT.couldNotRun, floor: true, wroteNothing: [PACKAGE_JSON_FILE] },
    })
  })
})

function suppressionsOffIn(files: readonly string[]): Parameters<typeof checkedPackageFiles>[1] {
  // @ts-expect-error a files list that may be empty is a type error: this pins what the config does without types
  return { allowSuppressions: true, fileOverrides: [{ files: [...files], allowSuppressions: false }] }
}

describe('check where a file override lists no file', () => {
  // The types refuse an empty `files`; check loads the config with them stripped, so defineLintRules lets it
  // through, and ESLint refuses the block check builds for that entry's component files.
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    function checkedWith(files: readonly string[]): CliRun {
      const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, suppressionsOffIn(files)) })
      project.write('src/a.ts', moduleText(exportedConstant('a'), DEBUGGER_STATEMENT))
      return runCheck(project.dir)
    }
    return { listingNone: checkedWith([]), listingSrc: checkedWith(['src/**']) }
  })

  it("stops, naming that entry's block, beside an entry listing src/**, which check runs", () => {
    const { listingNone, listingSrc } = runs()

    expect({
      stopped: { exitCode: listingNone.exitCode, namesTheBlock: listingNone.stderr.startsWith(`${CHECK_ESLINT_FAILED}Config "agents-inc/check/component-files/file-overrides/0": Key "files":`) },
      ran: { exitCode: listingSrc.exitCode, findings: findingsIn(listingSrc.stdout) },
    }).toStrictEqual({ stopped: { exitCode: EXIT.couldNotRun, namesTheBlock: true }, ran: { exitCode: EXIT.findings, findings: ['src/a.ts:2 no-debugger'] } })
  })
})

describe('check where the config exports a copy of the ESLint part defineLintRules returned', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [PACKAGE_JSON_FILE]: packageJsonText(buildPackageJson()), [CONFIG_FILE]: checkConfigTextExportingACopy(REDUNDANCY), 'src/a.ts': moduleText(exportedConstant('a')) },
    })
    const nothingChanged = runCheck(project.dir)
    project.append('src/a.ts', `${exportedConstant('b')}\n`)
    return { nothingChanged, aFileChanged: runCheck(project.dir) }
  })

  it('exits 2 naming the fix where a TS file changed', () => {
    expect(runs().aFileChanged).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: 'check: could not run: agents-inc.lint.mts: the part given is not one defineLintRules returned: pass `eslint` or `oxlint` exactly as the file exports it\n',
    })
  })

  it('says there is nothing to check and exits 0 where no file changed, reading no settings from the part', () => {
    expect(runs().nothingChanged).toStrictEqual({ exitCode: EXIT.clean, signal: null, stdout: NOTHING_TO_CHECK, stderr: '' })
  })
})

describe('check on a React file in a project that does not install React', () => {
  const run = setUpCheckAfterTheAgent(checkedPackageFiles(CORRECTNESS_AND_REACT), (project) => {
    project.write('src/hello.tsx', moduleText(...A_CLEAN_COMPONENT))
  })

  it('exits 0 with no findings', () => {
    const { exitCode, stdout } = run()

    expect({ exitCode, stdout }).toStrictEqual({ exitCode: EXIT.clean, stdout: 'check: no findings in 1 changed file.\n' })
  })

  it('prints nothing to stderr', () => {
    expect(run().stderr).toBe('')
  })
})

describe('a wrong call', () => {
  const WRONG_CALLS = [['check', '--help'], ['check', 'foo'], [], ['foo'], ['--help'], ['init', 'x']]

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const checked = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY) })
    const notInitialised = createGitProject(tempProjects, { repo: 'committed', files: { [PACKAGE_JSON_FILE]: packageJsonText(buildPackageJson()) } })
    const wrongCalls = WRONG_CALLS.map((args) => ({ args, run: runCli(notInitialised.dir, args) }))
    const entriesAfterTheWrongCalls = entriesUnder(notInitialised.dir).filter((entry) => !entry.startsWith('.git'))
    return { wrongCalls, entriesAfterTheWrongCalls, check: runCheck(checked.dir), init: runInit(notInitialised.dir) }
  })

  it.each(WRONG_CALLS.map((args) => ({ args, call: ['agents-inc-lint', ...args].join(' ') })))('prints the usage to stderr and exits 2 for `$call`', ({ args }) => {
    const wrongCall = runs().wrongCalls.find((call) => call.args === args)
    if (wrongCall === undefined) throw new Error(`no run was made for ${args.join(' ')}`)

    expect(wrongCall.run).toStrictEqual({ exitCode: EXIT.couldNotRun, signal: null, stdout: '', stderr: USAGE })
  })

  it('writes nothing for any of them, `init x` included', () => {
    const { wrongCalls, entriesAfterTheWrongCalls } = runs()

    expect({ usages: wrongCalls.map(({ run }) => run.stderr), entriesAfterTheWrongCalls }).toStrictEqual({
      usages: wrongCalls.map(() => USAGE),
      entriesAfterTheWrongCalls: [PACKAGE_JSON_FILE],
    })
  })

  it('runs `check` and `init`, beside them', () => {
    const { check, init } = runs()

    expect({ check: [check.exitCode, check.stdout], init: init.exitCode }).toStrictEqual({ check: [EXIT.clean, NOTHING_TO_CHECK], init: EXIT.clean })
  })
})

/** A run of check from a folder, made before the suite. */
type RunFromCase = { readonly from: string; readonly ran: () => CliRun }

describe('check in a monorepo package, after changes in it, in another package and at the repo root', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { ...A_TSCONFIG_TAKING_IN_THE_REPO, ...checkedPackageFiles(REDUNDANCY, {}, `${NESTED_PACKAGE}/`) } })
    project.write(`${NESTED_PACKAGE}/src/in-the-package.ts`, moduleText(exportedConstant('inThePackage'), DEBUGGER_STATEMENT))
    project.write('packages/b/src/in-another-package.ts', moduleText(exportedConstant('inAnotherPackage'), DEBUGGER_STATEMENT))
    project.write('scripts/at-the-root.ts', moduleText(exportedConstant('atTheRoot'), DEBUGGER_STATEMENT))
    return {
      fromThePackage: runCheck(project.pathOf(NESTED_PACKAGE)),
      fromBelowIt: runCheck(project.pathOf(`${NESTED_PACKAGE}/src`)),
    }
  })

  it.each<RunFromCase>([
    { from: 'the folder of its agents-inc.lint.mts', ran() { return runs().fromThePackage } },
    { from: 'a folder below it', ran() { return runs().fromBelowIt } },
  ])("run from $from, lints every changed file in the repo with the config found, with paths from the config's folder, and notes nothing", ({ ran }) => {
    expect(ran()).toStrictEqual({
      exitCode: EXIT.findings,
      signal: null,
      stdout: [
        '../../scripts/at-the-root.ts:2 no-debugger — `debugger` statement is not allowed',
        '../b/src/in-another-package.ts:2 no-debugger — `debugger` statement is not allowed',
        'src/in-the-package.ts:2 no-debugger — `debugger` statement is not allowed',
        `check: 3 errors and 0 warnings in 3 of 3 changed files. ${ERRORS_SUMMARY_TAIL}`,
        '',
      ].join('\n'),
      stderr: '',
    })
  })
})

// A name starting with two dots, as ..pkg does, is not the folder above.
describe('check in a package whose folder, at the repo root, and a changed file in it are each named with two leading dots', () => {
  const PACKAGE = '..pkg'

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { ...A_TSCONFIG_TAKING_IN_THE_REPO, ...checkedPackageFiles(REDUNDANCY, {}, `${PACKAGE}/`) } })
    project.write(`${PACKAGE}/..x.ts`, moduleText(exportedConstant('dotDotX'), DEBUGGER_STATEMENT))
    project.write(`${PACKAGE}/src/in-the-package.ts`, moduleText(exportedConstant('inThePackage'), DEBUGGER_STATEMENT))
    project.write('scripts/at-the-root.ts', moduleText(exportedConstant('atTheRoot'), DEBUGGER_STATEMENT))
    return {
      fromThePackage: runCheck(project.pathOf(PACKAGE)),
      fromBelowIt: runCheck(project.pathOf(`${PACKAGE}/src`)),
    }
  })

  it.each<RunFromCase>([
    { from: 'the folder of its agents-inc.lint.mts', ran() { return runs().fromThePackage } },
    { from: 'a folder below it, finding the config in the ..pkg folder', ran() { return runs().fromBelowIt } },
  ])("run from $from, prints ..x.ts as a file in the config's folder, and the file at the repo root from the folder above it", ({ ran }) => {
    expect(ran()).toStrictEqual({
      exitCode: EXIT.findings,
      signal: null,
      stdout: [
        '../scripts/at-the-root.ts:2 no-debugger — `debugger` statement is not allowed',
        '..x.ts:2 no-debugger — `debugger` statement is not allowed',
        'src/in-the-package.ts:2 no-debugger — `debugger` statement is not allowed',
        `check: 3 errors and 0 warnings in 3 of 3 changed files. ${ERRORS_SUMMARY_TAIL}`,
        '',
      ].join('\n'),
      stderr: '',
    })
  })
})

describe('check on suppression comments', () => {
  const run = setUpCheckAfterTheAgent(checkedPackageFiles(REDUNDANCY_AND_MODERN_JS, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED), (project) => {
    project.write('src/allowed/unused.ts', moduleText(...SUPPRESSIONS_TWO_UNUSED))
    project.write('src/banned-unused.ts', moduleText(...A_SUPPRESSION_OF_NOTHING))
    project.write('src/banned-over-a-finding.ts', moduleText(...A_SUPPRESSION_OVER_A_FINDING))
  })

  it('reports an unused suppression of an ESLint-run rule and of an oxlint-run rule, each once, where suppressions are allowed, and not one that suppressed a finding', () => {
    const { stdout } = run()
    const messages = findingMessagesIn(stdout)

    expect({
      findings: findingsInFile(stdout, 'src/allowed/unused.ts'),
      messages: ['src/allowed/unused.ts:2 unused suppression', 'src/allowed/unused.ts:4 unused suppression'].map((finding) => messages.get(finding)),
    }).toStrictEqual({
      findings: ['src/allowed/unused.ts:2 unused suppression', 'src/allowed/unused.ts:4 unused suppression'],
      messages: [unusedSuppressionMessageOf('no-var'), unusedSuppressionMessageOf('no-debugger')],
    })
  })

  it('reports no unused suppression where suppressions are banned, only the ban', () => {
    expect(findingsInFile(run().stdout, 'src/banned-unused.ts')).toStrictEqual(['src/banned-unused.ts:2 house/no-suppressions'])
  })

  it('reports a banned suppression comment over a finding as exactly one finding, the ban', () => {
    expect(findingsInFile(run().stdout, 'src/banned-over-a-finding.ts')).toStrictEqual(['src/banned-over-a-finding.ts:2 house/no-suppressions'])
  })
})

describe('check on findings spanning lines, and on findings about a whole file', () => {
  const run = setUpCheckAfterTheAgent(
    {
      ...checkedPackageFiles(REDUNDANCY_AND_NAMING),
      'src/catch-start.ts': moduleText(...GUARDED_BY_FINALLY),
      'src/catch-inside.ts': moduleText(...RETHROWN_BY_A_USELESS_CATCH),
      'src/old.ts': moduleText(...A_DEFAULT_EXPORT_NAMED_APART),
    },
    (project) => {
      project.write('src/catch-start.ts', moduleText(...GUARDED_BY_A_USELESS_CATCH))
      project.write('src/catch-inside.ts', moduleText(...RETHROWN_WITH_A_COMMENT_ADDED))
      project.write('src/old.ts', moduleText(...A_DEFAULT_EXPORT_NAMED_APART_ITS_VALUE_CHANGED))
      project.write('src/fresh.ts', moduleText(...A_DEFAULT_EXPORT_NAMED_APART))
    },
  )

  it('keeps a finding spanning several lines whose first line changed', () => {
    expect(findingsInFile(run().stdout, 'src/catch-start.ts')).toStrictEqual(['src/catch-start.ts:4 no-useless-catch'])
  })

  // oxlint reports no-useless-catch at lines 4 and 5, not as one span, and a finding counts at any changed place.
  it('reports a finding spanning several lines where only a later one of them changed, at that line, beside the one whose first line changed', () => {
    const { stdout } = run()

    expect({ firstLineChanged: findingsInFile(stdout, 'src/catch-start.ts'), laterLineChanged: findingsInFile(stdout, 'src/catch-inside.ts') }).toStrictEqual({
      firstLineChanged: ['src/catch-start.ts:4 no-useless-catch'],
      laterLineChanged: ['src/catch-inside.ts:5 no-useless-catch'],
    })
  })

  it('keeps a finding at line 0 in a new file', () => {
    expect(findingsInFile(run().stdout, 'src/fresh.ts')).toStrictEqual(['src/fresh.ts:0 sonarjs/file-name-differ-from-class'])
  })

  it('drops a finding at line 0 in a tracked file only part of which changed, beside the new file whose one it keeps', () => {
    const { stdout } = run()

    expect({ kept: findingsInFile(stdout, 'src/fresh.ts'), dropped: findingsInFile(stdout, 'src/old.ts') }).toStrictEqual({
      kept: ['src/fresh.ts:0 sonarjs/file-name-differ-from-class'],
      dropped: [],
    })
  })
})

describe('check on findings oxlint gives at several places, an agent having added the later one', () => {
  // import-x/no-duplicates has a fix, which would rewrite the older import's line: the guard drops
  // it in both files, so the fix step changes nothing here either.
  const run = setUpCheckAfterTheAgent(
    {
      ...checkedPackageFiles(CORRECTNESS_AND_MODULES),
      'src/table.ts': moduleText(...A_TABLE),
      'src/old-duplicates.ts': moduleText(...A_TABLE_WITH_DUPLICATES_ADDED),
    },
    (project) => {
      project.write('src/table.ts', moduleText(...A_TABLE_WITH_DUPLICATES_ADDED))
      project.append('src/old-duplicates.ts', moduleText(exportedConstant('added')))
    },
  )

  it("reports a second import, a duplicate key and a duplicate case an agent added beside the code they repeat, each at the agent's line, and exits 1", () => {
    const { exitCode, stdout } = run()

    expect({ exitCode, findings: findingsInFile(stdout, 'src/table.ts') }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: ['src/table.ts:2 import-x/no-duplicates', 'src/table.ts:7 no-dupe-keys', 'src/table.ts:14 no-duplicate-case'],
    })
  })

  it('reports none of those findings where every place of each is older than the change, beside them', () => {
    expect(findingsInFile(run().stdout, 'src/old-duplicates.ts')).toStrictEqual([])
  })
})

// What check cannot run is skipped and listed after the findings, and the run never exits 0: errors left
// exit 1, else 2.

describe('check where oxlint refuses an option the team gave a rule', () => {
  const REFUSED_OPTION = { rules: { 'no-console': ['error', NO_CONSOLE_OPTION_OXLINT_REFUSES] } } as const

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    function runAfterAdding(files: Readonly<Record<string, string>>): CliRun {
      const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY_AND_CORRECTNESS, REFUSED_OPTION) })
      for (const [file, text] of Object.entries(files)) project.write(file, text)
      return runCheck(project.dir)
    }
    return {
      clean: runAfterAdding({ 'src/a.ts': moduleText(exportedConstant('a')) }),
      eslintError: runAfterAdding({ 'src/a.ts': moduleText(exportedConstant('a')), 'src/b.js': moduleText(exportedConstant('b'), A_LITERAL_THROWN) }),
    }
  })

  it("lists oxlint's rules as not checked, quoting all oxlint printed, says not everything was checked, and exits 2 where nothing else is found", () => {
    expect(runs().clean).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: `${notCheckedByOxlint(OXLINT_REFUSAL_OF_AN_OPTION)}\n${NOT_EVERYTHING_CHECKED_SUMMARY}\n`,
      stderr: '',
    })
  })

  it("still prints ESLint's findings, and exits 1 where one is an error, beside that run", () => {
    const { exitCode, stdout, stderr } = runs().eslintError

    expect({ exitCode, findings: findingsIn(stdout), notChecked: notCheckedIn(stdout), stderr }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: ['src/b.js:2 no-throw-literal'],
      notChecked: [notCheckedByOxlint(OXLINT_REFUSAL_OF_AN_OPTION)],
      stderr: '',
    })
  })
})

describe('check where ESLint throws as it lints each file, on a selector it cannot read', () => {
  const FILES = ['src/a.ts', 'src/b.ts']
  const ESLINT_THROWING = { 'no-restricted-syntax': ['error', A_SELECTOR_ESLINT_THROWS_ON] } as const
  // no-restricted-syntax takes selectors, as strings or objects.
  const AN_OPTION_ESLINT_REFUSES = 123

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    function runWhereNoDebuggerIs(setting: 'warn' | 'error'): { readonly result: CliRun; readonly notChecked: readonly string[] } {
      const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, { rules: { ...ESLINT_THROWING, 'no-debugger': setting } }) })
      project.write('src/a.ts', moduleText(exportedConstant('a')))
      project.write('src/b.ts', moduleText(exportedConstant('b'), DEBUGGER_STATEMENT))
      const notChecked = FILES.map((file) => notCheckedByEslint(file, eslintMessageWhileLinting(A_SELECTOR_ESLINT_THROWS_ON_MESSAGE, project.pathOf(file))))
      return { result: runCheck(project.dir), notChecked }
    }
    const refusing = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, { rules: { 'no-restricted-syntax': ['error', AN_OPTION_ESLINT_REFUSES] } }) })
    refusing.write('src/a.ts', moduleText(exportedConstant('a')))
    return { oxlintWarns: runWhereNoDebuggerIs('warn'), oxlintErrs: runWhereNoDebuggerIs('error'), refusedBeforeLinting: runCheck(refusing.dir) }
  })

  it("lists every file as not checked, quoting ESLint's message, still prints oxlint's findings in them, and exits 2 where none is an error", () => {
    const { result, notChecked } = runs().oxlintWarns

    expect({ exitCode: result.exitCode, findings: findingsIn(result.stdout), notChecked: notCheckedIn(result.stdout), stderr: result.stderr }).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      findings: ['src/b.ts:2 no-debugger (warning)'],
      notChecked,
      stderr: '',
    })
  })

  it('exits 1 where oxlint found an error in them, beside that run', () => {
    const { result, notChecked } = runs().oxlintErrs

    expect({ exitCode: result.exitCode, findings: findingsIn(result.stdout), notChecked: notCheckedIn(result.stdout), stderr: result.stderr }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: ['src/b.ts:2 no-debugger'],
      notChecked,
      stderr: '',
    })
  })

  // ESLint checks each rule's options against its schema when it computes a file's config, before it lints any.
  it('stops, quoting ESLint, where ESLint refuses the config before it lints any file, beside the runs it goes on in', () => {
    const { exitCode, stdout, stderr } = runs().refusedBeforeLinting

    expect({ exitCode, stdout, quotesEslint: stderr.startsWith(`${CHECK_ESLINT_FAILED}Key "rules": Key "no-restricted-syntax":`) }).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      stdout: '',
      quotesEslint: true,
    })
  })
})

describe("check on suppression comments in oxlint's own form", () => {
  const run = setUpCheckAfterTheAgent(checkedPackageFiles(REDUNDANCY, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED), (project) => {
    project.write('src/allowed/oxlint-form.ts', moduleText(...OXLINT_FORM_SUPPRESSIONS_ONE_UNUSED))
    project.write('src/banned-oxlint-form.ts', moduleText(...OXLINT_FORM_SUPPRESSIONS_ONE_UNUSED))
  })

  it('reports the one that suppresses nothing, once, and not the one over a finding, where suppressions are allowed', () => {
    const { stdout } = run()

    expect({
      findings: findingsInFile(stdout, 'src/allowed/oxlint-form.ts'),
      message: findingMessagesIn(stdout).get('src/allowed/oxlint-form.ts:2 unused suppression'),
    }).toStrictEqual({
      findings: ['src/allowed/oxlint-form.ts:2 unused suppression'],
      message: unusedSuppressionMessageOf('no-debugger'),
    })
  })

  it('reports no unused suppression where suppressions are banned, only the ban of each comment', () => {
    expect(findingsInFile(run().stdout, 'src/banned-oxlint-form.ts')).toStrictEqual([
      'src/banned-oxlint-form.ts:2 house/no-suppressions',
      'src/banned-oxlint-form.ts:4 house/no-suppressions',
    ])
  })
})

describe("check counting the changed files outside its config folder", () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { ...A_TSCONFIG_TAKING_IN_THE_REPO, ...checkedPackageFiles(REDUNDANCY, {}, `${NESTED_PACKAGE}/`) } })
    project.write('README.md', moduleText(DEBUGGER_STATEMENT))
    project.write('packages/b/settings.json', `${JSON.stringify({ debugger: true })}\n`)
    project.write('scripts/at-the-root.ts', moduleText(exportedConstant('atTheRoot')))
    return runCheck(project.pathOf(NESTED_PACKAGE))
  })

  it('counts the JS and TS file among them alone, which it lints, and notes nothing', () => {
    expect(run()).toStrictEqual({ exitCode: EXIT.clean, signal: null, stdout: 'check: no findings in 1 changed file.\n', stderr: '' })
  })
})

describe('check on block suppression comments, and on enable comments that turn back on nothing', () => {
  const run = setUpCheckAfterTheAgent({ ...checkedPackageFiles(REDUNDANCY, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED), 'src/legacy.ts': moduleText(...AN_ENABLE_CLOSING_NOTHING) }, (project) => {
    project.write('src/legacy.ts', moduleText(...AN_ENABLE_CLOSING_NOTHING_WITH_A_DEBUGGER_ADDED))
    project.write('src/allowed/stray-enables.ts', moduleText(...ENABLES_CLOSING_NOTHING_ABOVE_A_DEBUGGER))
    project.write('src/allowed/eslint-open.ts', moduleText(blockDisable('eslint', 'no-debugger'), exportedConstant('open')))
    project.write('src/allowed/eslint-pair.ts', moduleText(...noDebuggerPairAround('eslint', exportedConstant('eslintPair'))))
    project.write('src/allowed/oxlint-pair.ts', moduleText(...noDebuggerPairAround('oxlint', exportedConstant('oxlintPair'))))
    project.write('src/allowed/pair-over-a-finding.ts', moduleText(...noDebuggerPairAround('eslint', DEBUGGER_STATEMENT)))
  })

  it('reports the finding an agent added below a committed enable comment that turns back on nothing, and no parse error, where suppressions are banned', () => {
    expect(findingsInFile(run().stdout, 'src/legacy.ts')).toStrictEqual(['src/legacy.ts:4 no-debugger'])
  })

  // Undecided whether check reports an enable comment that turns nothing back on; it reports nothing for now.
  it('reports the finding below enable comments an agent added that turn back on nothing, in either form, and nothing on the comments, where suppressions are allowed', () => {
    expect(findingsInFile(run().stdout, 'src/allowed/stray-enables.ts')).toStrictEqual(['src/allowed/stray-enables.ts:6 no-debugger'])
  })

  it('reports a block pair that silenced nothing once, at its disable comment, in either form, as it does a disable comment left open, and none over a finding', () => {
    const { stdout } = run()
    const unused = ['src/allowed/eslint-open.ts:1 unused suppression', 'src/allowed/eslint-pair.ts:1 unused suppression', 'src/allowed/oxlint-pair.ts:1 unused suppression']
    const messages = findingMessagesIn(stdout)

    expect({
      findings: ['src/allowed/eslint-open.ts', 'src/allowed/eslint-pair.ts', 'src/allowed/oxlint-pair.ts'].flatMap((file) => findingsInFile(stdout, file)),
      messages: unused.map((finding) => messages.get(finding)),
      overAFinding: findingsInFile(stdout, 'src/allowed/pair-over-a-finding.ts'),
    }).toStrictEqual({ findings: unused, messages: unused.map(() => unusedSuppressionMessageOf('no-debugger')), overAFinding: [] })
  })
})

describe('check on unused pairs beside comment-like text in a string or a template literal, where suppressions are allowed', () => {
  // Comment-like text inside a string is no comment: read as one, check refused the run or placed the
  // pair where ESLint does not.

  const run = setUpCheckAfterTheAgent(checkedPackageFiles(REDUNDANCY, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED), (project) => {
    project.write('src/allowed/string.ts', moduleText(...A_PAIR_AROUND_A_STRING_HOLDING_AN_ENABLE))
    project.write('src/allowed/template.ts', moduleText(...A_PAIR_AROUND_A_TEMPLATE_HOLDING_AN_ENABLE))
    project.write('src/allowed/string-before.ts', moduleText(...A_PAIR_BELOW_A_STRING_HOLDING_A_DISABLE))
    project.write('src/allowed/no-string.ts', moduleText(...A_PAIR_BELOW_A_STRING_HOLDING_NO_COMMENT))
    project.write('src/other.ts', moduleText(exportedConstant('other'), DEBUGGER_STATEMENT))
  })

  it('reports each pair once, at its disable comment, as it does the pair below a string with no comment text, beside the finding in another file, and exits 1', () => {
    const { exitCode, stderr, stdout } = run()

    expect({ exitCode, stderr, findings: findingsIn(stdout) }).toStrictEqual({
      exitCode: EXIT.findings,
      stderr: '',
      findings: [
        'src/allowed/no-string.ts:2 unused suppression',
        'src/allowed/string-before.ts:2 unused suppression',
        'src/allowed/string.ts:1 unused suppression',
        'src/allowed/template.ts:1 unused suppression',
        'src/other.ts:2 no-debugger',
      ],
    })
  })
})

/** A comment another writer changes after oxlint read it: its file, its text as oxlint read it, and the writer's text. */
type OutOfDateComment = { readonly file: string; readonly asOxlintReadIt: readonly string[]; readonly writersText: string }

function writersTextOf(form: SuppressionForm): string {
  return moduleText(...movedDownByAnotherWriter(aSuppressionPartlyUnused(form)))
}

describe('check where another writer changes suppression comments after oxlint read them, where suppressions are allowed', () => {
  // Another writer edits each file between oxlint's read and check's: a report that no longer fits the text
  // goes unreported, never refusing the run, and the next run reports the comment where it is.
  const MOVED = [
    { file: 'src/allowed/eslint-moved.ts', form: 'eslint' },
    { file: 'src/allowed/oxlint-moved.ts', form: 'oxlint' },
  ] as const
  const IN_PLACE = [
    { file: 'src/allowed/eslint-in-place.ts', form: 'eslint' },
    { file: 'src/allowed/oxlint-in-place.ts', form: 'oxlint' },
  ] as const
  // oxlint's span on the unused name now covers `no-consol`, a name the comment does not hold.
  const SHIFTED = { file: 'src/allowed/oxlint-shifted.ts', asOxlintReadIt: aSuppressionPartlyUnused('oxlint') }
  // oxlint's span on the whole comment now covers a string holding its text.
  const UNDER_A_STRING = { file: 'src/allowed/oxlint-under-a-string.ts', asOxlintReadIt: A_WHOLLY_UNUSED_OXLINT_DISABLE }

  function outOfDate(): OutOfDateComment[] {
    return [
      ...MOVED.map(({ file, form }) => ({ file, asOxlintReadIt: aSuppressionPartlyUnused(form), writersText: writersTextOf(form) })),
      { ...SHIFTED, writersText: moduleText(...withACharacterAddedToTheFirstLine(SHIFTED.asOxlintReadIt)) },
      { ...UNDER_A_STRING, writersText: moduleText(...A_WHOLLY_UNUSED_OXLINT_DISABLE_BELOW_A_STRING_HOLDING_ITS_TEXT) },
    ]
  }

  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const outOfDateComments = outOfDate()
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED) })
    for (const { file, form } of IN_PLACE) project.write(file, moduleText(...aSuppressionPartlyUnused(form)))
    for (const { file, asOxlintReadIt } of outOfDateComments) project.write(file, moduleText(...asOxlintReadIt))
    project.write('src/other.ts', moduleText(exportedConstant('other'), DEBUGGER_STATEMENT))
    const result = runCheck(project.dir, anotherWriterAsOxlintsLintRunEnds(outOfDateComments.map(({ file, writersText }) => ({ path: project.pathOf(file), text: writersText }))))
    return { result, textsNow: outOfDateComments.map(({ file }) => project.read(file)), nextRun: runCheck(project.dir) }
  })

  it("reports none of the comments it read out of date, in either form, and refuses nothing: reports the comments nobody changed and the finding in another file, keeps the writer's text, and exits 1", () => {
    const { result, textsNow } = run()
    const messages = findingMessagesIn(result.stdout)

    expect({
      exitCode: result.exitCode,
      stderr: result.stderr,
      findings: findingsIn(result.stdout),
      inPlaceMessages: IN_PLACE.map(({ file }) => messages.get(`${file}:2 unused suppression`)),
      textsNow,
    }).toStrictEqual({
      exitCode: EXIT.findings,
      stderr: '',
      findings: ['src/allowed/eslint-in-place.ts:2 unused suppression', 'src/allowed/oxlint-in-place.ts:2 unused suppression', 'src/other.ts:2 no-debugger'],
      inPlaceMessages: [unusedSuppressionMessageOf('no-console'), unusedSuppressionMessageOf('no-console')],
      textsNow: outOfDate().map(({ writersText }) => writersText),
    })
  })

  it('reports each of those comments where it is now on the next run', () => {
    const { stdout } = run().nextRun

    expect(outOfDate().flatMap(({ file }) => findingsInFile(stdout, file))).toStrictEqual([
      'src/allowed/eslint-moved.ts:3 unused suppression',
      'src/allowed/oxlint-moved.ts:3 unused suppression',
      'src/allowed/oxlint-shifted.ts:2 unused suppression',
      'src/allowed/oxlint-under-a-string.ts:3 unused suppression',
    ])
  })
})

describe('check on a block eslint-disable comment over several lines, where suppressions are allowed', () => {
  const run = setUpCheckAfterTheAgent(checkedPackageFiles(REDUNDANCY, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED), (project) => {
    project.write('src/allowed/several-lines.ts', moduleText(...A_DISABLE_OVER_SEVERAL_LINES_ABOVE_A_DEBUGGER))
    project.write('src/allowed/one-line.ts', moduleText(...A_DISABLE_ON_ONE_LINE_ABOVE_A_DEBUGGER))
  })

  it("reports a name on a later line of it that suppresses nothing, at that name's line, and not the name that suppressed the debugger, as it reports the one-line form at its line", () => {
    const { stdout } = run()

    expect({
      severalLines: findingsInFile(stdout, 'src/allowed/several-lines.ts'),
      message: findingMessagesIn(stdout).get('src/allowed/several-lines.ts:3 unused suppression'),
      oneLine: findingsInFile(stdout, 'src/allowed/one-line.ts'),
    }).toStrictEqual({
      severalLines: ['src/allowed/several-lines.ts:3 unused suppression'],
      message: unusedSuppressionMessageOf('no-console'),
      oneLine: ['src/allowed/one-line.ts:1 unused suppression'],
    })
  })
})
