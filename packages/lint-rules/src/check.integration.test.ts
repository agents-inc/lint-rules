import { join } from 'node:path'
import { realpathSync } from 'node:fs'
import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import {
  A_CLEAN_COMPONENT,
  AN_ENABLE_CLOSING_NOTHING,
  AN_ENABLE_CLOSING_NOTHING_WITH_A_DEBUGGER_ADDED,
  A_SUPPRESSION_OF_NOTHING,
  A_TABLE,
  A_TABLE_WITH_DUPLICATES_ADDED,
  A_SUPPRESSION_OVER_A_FINDING,
  A_SELECTOR_ESLINT_THROWS_ON,
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
} from './__tests__/cases/check-sources.ts'
import { NO_CONSOLE_OPTION_OXLINT_REFUSES, OXLINT_REFUSAL_OF_AN_OPTION } from './__tests__/cases/oxlint-refusals.ts'
import {
  A_PAIR_AROUND_A_STRING_HOLDING_AN_ENABLE,
  A_PAIR_AROUND_A_TEMPLATE_HOLDING_AN_ENABLE,
  A_PAIR_BELOW_A_STRING_HOLDING_A_DISABLE,
  A_PAIR_BELOW_A_STRING_HOLDING_NO_COMMENT,
} from './__tests__/cases/suppression-pairs.ts'
import { findingMessagesIn, findingsIn, findingsInFile, lastLineOf } from './__tests__/check-output.ts'
import {
  anotherWriterAsOxlintsLintRunEnds,
  type BackgroundRun,
  checkInTheBackground,
  checkSignalledOnceItsConfigAppears,
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
  blockDisable,
  CHECK_ESLINT_FAILED,
  CHECK_INTERRUPTED,
  checkConfigText,
  checkConfigTextHanding,
  checkedPackageFiles,
  CONFIG_FILE,
  DEBUGGER_STATEMENT,
  ERRORS_SUMMARY_TAIL,
  exportedConstant,
  moduleText,
  NESTED_PACKAGE,
  PACKAGE_JSON_FILE,
  REDUNDANCY,
  type SuppressionForm,
  SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED,
  unusedSuppressionMessageOf,
} from './__tests__/factories/check-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { type FolderWatch, watchFolder } from './__tests__/folder-watch.ts'
import { createGitProject, gitStatusOf } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { entriesUnder, INSTALLED_OXLINT, setUpEmptyFolders, THIS_PACKAGE } from './__tests__/temp-projects.ts'
import { validateLintRules } from './core/validate-lint-rules.ts'

// spec-cli.md "K: check": `agents-inc-lint check` lints the JS and TS lines changed since the last
// commit with the agent build of the nearest agents-inc.lint.mts, and prints what is left. Each suite
// makes a git project, changes it as an agent would, and runs the built bin (dist/cli.mjs) on it.
// The engines run for real; the fixtures fire only rules that report and never fix (no-debugger,
// no-useless-catch, sonarjs/no-empty-test-file), so the fix step changes nothing here:
// check-fixes.integration.test.ts covers it.

allowEveryTestForParallelLoad()

const REDUNDANCY_AND_TESTS = { quality: ['redundancy', 'tests'] } as const
const REDUNDANCY_AND_MODERN_JS = { quality: ['redundancy', 'modern-js'] } as const
const CORRECTNESS_AND_REACT = { quality: ['correctness'], libs: { ui: ['react'] } } as const
const CORRECTNESS_AND_MODULES = { quality: ['correctness', 'modules'] } as const

const NOTHING_TO_CHECK = 'check: no changed JS or TS files.\n'
const USAGE = `usage: agents-inc-lint <command>
  init   add @agents-inc/lint-rules and agents-inc.lint.mts to the package in this folder
  check  lint the JS and TS lines changed since the last commit
`
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
      EXTENSIONS.forEach((extension) => project.write(`src/ext/a.${extension}`, moduleText(DEBUGGER_STATEMENT)))
      Object.entries(NOT_JS_OR_TS).forEach(([file, content]) => project.write(file, content))
      project.write('src/generated/gen.ts', moduleText(DEBUGGER_STATEMENT))
      project.write('src/broken.ts', moduleText(...A_SYNTAX_ERROR))
    },
  )

  it('reports every line of an untracked file (K-2)', () => {
    expect(findingsInFile(runs().stdout, 'src/new-untracked.ts')).toStrictEqual(['src/new-untracked.ts:2 no-debugger', 'src/new-untracked.ts:3 no-debugger'])
  })

  it('reports a finding on a changed line of a tracked file, and not the one on its unchanged line (K-3)', () => {
    expect(findingsInFile(runs().stdout, 'src/partly.ts')).toStrictEqual(['src/partly.ts:3 no-debugger'])
  })

  it('checks a path with a space and one with letters outside ASCII, and prints each as it is (K-5)', () => {
    const { stdout } = runs()

    expect([...findingsInFile(stdout, 'src/with space.ts'), ...findingsInFile(stdout, 'src/ünïcode.ts')]).toStrictEqual([
      'src/with space.ts:2 no-debugger',
      'src/ünïcode.ts:2 no-debugger',
    ])
  })

  it('counts a change only staged and a change not staged alike (K-6)', () => {
    const { stdout } = runs()

    expect([...findingsInFile(stdout, 'src/staged-only.ts'), ...findingsInFile(stdout, 'src/unstaged-only.ts')]).toStrictEqual([
      'src/staged-only.ts:2 no-debugger',
      'src/unstaged-only.ts:2 no-debugger',
    ])
  })

  it('lints a changed file of each of the eight JS and TS extensions, and no .json, .md or .css file (K-8)', () => {
    expect(
      findingsIn(runs().stdout)
        .filter((finding) => finding.startsWith('src/ext/'))
        .toSorted(),
    ).toStrictEqual(EXTENSIONS.map((extension) => `src/ext/a.${extension}:1 no-debugger`).toSorted())
  })

  it("reports nothing in a changed file the config's ignores name, in either engine, and leaves it out of the count (K-9)", () => {
    const { stdout } = runs()

    expect({ inTheIgnoredFile: findingsInFile(stdout, 'src/generated/gen.ts'), summary: lastLineOf(stdout) }).toStrictEqual({
      inTheIgnoredFile: [],
      summary: `check: 16 errors and 0 warnings in 15 of 15 changed files. ${ERRORS_SUMMARY_TAIL}`,
    })
  })

  it("imports neither the project's own ESLint config, which throws, nor reads its oxlint configs, which turn the rule off (K-10)", () => {
    const { exitCode, stderr, stdout } = runs()

    expect({ exitCode, stderr, partly: findingsInFile(stdout, 'src/partly.ts') }).toStrictEqual({
      exitCode: EXIT.findings,
      stderr: '',
      partly: ['src/partly.ts:3 no-debugger'],
    })
  })

  it("reports a syntax error once, as a parse error with ESLint's message, and exits 1 (K-13)", () => {
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

describe('check on moved files (K-4, q-c7)', () => {
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

  it('reports only the line appended to a file moved with git mv (K-4)', () => {
    expect(findingsInFile(runs().run.stdout, 'src/git-moved-to.ts')).toStrictEqual(['src/git-moved-to.ts:4 no-debugger'])
  })

  it('pairs a file moved with a plain mv with its old path, reporting only the line appended (K-4b)', () => {
    expect(findingsInFile(runs().run.stdout, 'src/plain-moved-to.ts')).toStrictEqual(['src/plain-moved-to.ts:4 no-debugger'])
  })

  it('still reports every line of a new file that pairs with no old path (K-4b)', () => {
    expect(findingsInFile(runs().run.stdout, 'src/unpaired.ts')).toStrictEqual(['src/unpaired.ts:1 no-debugger', 'src/unpaired.ts:3 no-debugger'])
  })

  it('leaves the real index byte for byte as it was, and git status unchanged (K-4b)', () => {
    const { run, statusBefore, statusAfter, indexBefore, indexAfter } = runs()

    expect({
      plainMovePaired: findingsInFile(run.stdout, 'src/plain-moved-to.ts'),
      indexUnchanged: indexAfter.equals(indexBefore),
      statusAfter,
    }).toStrictEqual({ plainMovePaired: ['src/plain-moved-to.ts:4 no-debugger'], indexUnchanged: true, statusAfter: statusBefore })
  })
})

describe('check on deleted files (K-6)', () => {
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

describe('check in a repo with no commits (K-7, q-c8)', () => {
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

describe('check with no changed JS or TS file, then with only the config changed (K-1, K-24, K-25, q-c14, q-c17)', () => {
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

  it('says there is nothing to check and exits 0 when only a file that is not JS or TS changed (K-1)', () => {
    const { nothingToCheck } = runs()

    expect(nothingToCheck).toStrictEqual({ exitCode: EXIT.clean, signal: null, stdout: NOTHING_TO_CHECK, stderr: '' })
  })

  it('creates no temporary config, not even for a moment, and writes no file then (K-1)', () => {
    const { nothingToCheck, namesSeen, statusBefore, statusAfter, entriesBefore, entriesAfter } = runs()

    expect({ stdout: nothingToCheck.stdout, namesSeen, statusAfter, entriesAfter }).toStrictEqual({
      stdout: NOTHING_TO_CHECK,
      namesSeen: [],
      statusAfter: statusBefore,
      entriesAfter: entriesBefore,
    })
  })

  it('says nothing about an agents-inc.lint.mts an agent changed, and lints it as a changed file (K-24, q-c14)', () => {
    expect(runs().configChanged).toStrictEqual({ exitCode: EXIT.clean, signal: null, stdout: 'check: no findings in 1 changed file.\n', stderr: '' })
  })

  it('says nothing about the rulesets the config leaves out, where it lists one of them (K-25, q-c17)', () => {
    const { nothingToCheck, configChanged } = runs()

    expect({ stderr: [nothingToCheck.stderr, configChanged.stderr], exitCodes: [nothingToCheck.exitCode, configChanged.exitCode] }).toStrictEqual({
      stderr: ['', ''],
      exitCodes: [EXIT.clean, EXIT.clean],
    })
  })
})

describe('what check leaves behind (K-11, K-20)', () => {
  const emptyFolder = setUpEmptyFolders()
  const APP = 'app'
  const RUN_FROM = 'app/src'

  /** What one run left: whether its temporary config appeared in the config's folder, any left in the folders it touches, and any file outside the project. */
  type LeftBehind = BackgroundRun & {
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
      const watched = watchFolder(configFolder)
      const started = await start(outside, watched)
      const namesSeen = await watched.namesSeen()
      watched.close()
      return {
        ...started,
        tempConfigSeenInTheConfigFolder: namesSeen.some((name) => tempConfigPatternOf(started.pid).test(name)),
        leftovers: [...tempConfigsIn(configFolder), ...tempConfigsIn(runFolder), ...tempConfigsIn(project.dir)],
        outside: Object.values(outside).flatMap((folder) => entriesUnder(folder)),
      }
    }

    const toTheEnd = (env: Readonly<Record<string, string>>): Promise<BackgroundRun> => checkInTheBackground(runFolder, { env })
    const signalledWith =
      (signal: NodeJS.Signals) =>
      (env: Readonly<Record<string, string>>, watched: FolderWatch): Promise<BackgroundRun> =>
        checkSignalledOnceItsConfigAppears(runFolder, watched, signal, { env })

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
    project.write(`${APP}/${fromAnEndedProcess}`, '{}\n')
    project.write(`${APP}/${fromALiveProcess}`, '{}\n')
    const sweep = await checkInTheBackground(runFolder)
    const afterTheSweep = tempConfigsIn(configFolder)

    return { clean, findings, interrupted, terminated, engineFailure, sweep, fromALiveProcess, afterTheSweep }
  }, RUNS_IN_THE_BACKGROUND)

  it.each([
    { kind: 'a clean run', exitCode: EXIT.clean, ran: () => runs().clean },
    { kind: 'a run with findings', exitCode: EXIT.findings, ran: () => runs().findings },
  ])("writes its temporary oxlint config in the config's folder while it runs, and leaves none behind, after $kind (K-11)", ({ exitCode, ran }) => {
    const { run, tempConfigSeenInTheConfigFolder, leftovers } = ran()

    expect({ exitCode: run.exitCode, tempConfigSeenInTheConfigFolder, leftovers }).toStrictEqual({ exitCode, tempConfigSeenInTheConfigFolder: true, leftovers: [] })
  })

  it('exits 2 when ESLint fails, and leaves no temporary config behind (K-11)', () => {
    const { run, tempConfigSeenInTheConfigFolder, leftovers } = runs().engineFailure

    expect({
      exitCode: run.exitCode,
      couldNotRun: run.stderr.startsWith(CHECK_ESLINT_FAILED),
      tempConfigSeenInTheConfigFolder,
      leftovers,
    }).toStrictEqual({ exitCode: EXIT.couldNotRun, couldNotRun: true, tempConfigSeenInTheConfigFolder: true, leftovers: [] })
  })

  it.each([
    { signal: 'SIGINT', exitCode: EXIT.interrupted, ran: () => runs().interrupted },
    { signal: 'SIGTERM', exitCode: EXIT.terminated, ran: () => runs().terminated },
  ])('exits $exitCode on $signal, says it was interrupted, and leaves no temporary config behind (K-11)', ({ exitCode, ran }) => {
    const { signalled, run, leftovers } = ran()

    expect({ signalled, exitCode: run.exitCode, stderr: run.stderr, leftovers }).toStrictEqual({ signalled: true, exitCode, stderr: CHECK_INTERRUPTED, leftovers: [] })
  })

  // check-fixes.integration.test.ts covers a signal after check fixed files, which it names.
  it.each([
    { signal: 'SIGINT', ran: () => runs().interrupted },
    { signal: 'SIGTERM', ran: () => runs().terminated },
  ])('prints no autofixed line on $signal, where it had fixed nothing (P2)', ({ ran }) => {
    const { signalled, run } = ran()

    expect({ signalled, stdout: run.stdout }).toStrictEqual({ signalled: true, stdout: '' })
  })

  it('writes nothing outside the project in any of those runs: no log, no scratch index left (K-20, c13-again)', () => {
    const { clean, findings, interrupted, terminated, engineFailure } = runs()

    expect([clean, findings, interrupted, terminated, engineFailure].map(({ run, outside }) => ({ exitCode: run.exitCode, outside }))).toStrictEqual([
      { exitCode: EXIT.clean, outside: [] },
      { exitCode: EXIT.findings, outside: [] },
      { exitCode: EXIT.interrupted, outside: [] },
      { exitCode: EXIT.terminated, outside: [] },
      { exitCode: EXIT.couldNotRun, outside: [] },
    ])
  })

  it("removes a temporary config left by a process that has ended, and keeps one whose process lives (K-11)", () => {
    const { sweep, afterTheSweep, fromALiveProcess } = runs()

    expect({ exitCode: sweep.run.exitCode, afterTheSweep }).toStrictEqual({ exitCode: EXIT.findings, afterTheSweep: [fromALiveProcess] })
  })
})

describe('two checks started together in one project (K-12)', () => {
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

describe('check where it cannot run (K-16, q-c2)', () => {
  // A ruleset name no catalog has: defineLintRules refuses it.
  const REFUSED_SETTINGS: Omit<Parameters<typeof validateLintRules>[0], 'tsconfigRootDir'> = {
    agentRulesets: { quality: ['no-such-ruleset'], libs: {}, runtimes: [] },
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
      configError: { message: validationMessageFor({ ...REFUSED_SETTINGS, tsconfigRootDir: configError.dir }), run: runCheck(configError.dir) },
      notInstalled: runCheck(notInstalled.dir),
      otherCopy: { otherCopyDir, run: runCheck(otherCopy.dir) },
      gitFails: runCheck(gitFails.dir),
      oldNode: OLD_NODE === undefined ? null : { check: runCheck(oldNode.dir, { node: OLD_NODE.path }), init: runInit(initOnOldNode.dir, { node: OLD_NODE.path }), initDir: initOnOldNode.dir },
    }
  })

  /** The message defineLintRules throws for these settings, which check prints as it is. */
  function validationMessageFor(settings: Parameters<typeof validateLintRules>[0]): string {
    try {
      validateLintRules(settings, catalog)
    } catch (error) {
      if (error instanceof Error) return error.message
      throw error
    }
    throw new Error('defineLintRules accepted settings the test needs it to refuse')
  }

  it('exits 2 outside a git repository', () => {
    const { dir, run } = runs().notARepo

    expect(run).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: `check: could not run: ${dir} is not inside a git repository, and check reads the changed files from git.\n`,
    })
  })

  it('exits 2 where no agents-inc.lint.mts is in the folder or any above it up to the git top level (q-c6)', () => {
    const { dir, run } = runs().noConfig

    expect(run).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: `check: could not run: there is no agents-inc.lint.mts in ${dir} or any folder above it up to ${dir}. Run "agents-inc-lint init" in the folder of the package to lint.\n`,
    })
  })

  it('does not use an agents-inc.lint.mts above the git top level, run from a folder below it (q-c6)', () => {
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
  it.runIf(OLD_NODE !== undefined)('exits 2 on a Node older than 22.18, check and init alike, saying which Node it is (#59)', () => {
    const { oldNode } = runs()
    if (oldNode === null || OLD_NODE === undefined) throw new Error('the old Node runs were not made')
    const version = OLD_NODE.version.replace(/^v/u, '')
    const floorLine = (command: string): RegExp =>
      new RegExp(`^${command}: could not run: Node 22\\.18 or later is needed; this is Node v?${version.replaceAll('.', '\\.')}\\.\\n$`, 'u')

    expect({
      check: { exitCode: oldNode.check.exitCode, stdout: oldNode.check.stdout, floor: floorLine('check').test(oldNode.check.stderr) },
      init: { exitCode: oldNode.init.exitCode, floor: floorLine('init').test(oldNode.init.stderr), wroteNothing: entriesUnder(oldNode.initDir) },
    }).toStrictEqual({
      check: { exitCode: EXIT.couldNotRun, stdout: '', floor: true },
      init: { exitCode: EXIT.couldNotRun, floor: true, wroteNothing: [PACKAGE_JSON_FILE] },
    })
  })
})

describe('check on a React file in a project that does not install React (K-18, X5)', () => {
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

describe('a wrong call (K-19, q-c16)', () => {
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

describe('check in a monorepo package (K-22, q-c6)', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, {}, `${NESTED_PACKAGE}/`) })
    project.write(`${NESTED_PACKAGE}/src/in-the-package.ts`, moduleText(exportedConstant('inThePackage'), DEBUGGER_STATEMENT))
    project.write('packages/b/src/in-another-package.ts', moduleText(exportedConstant('inAnotherPackage'), DEBUGGER_STATEMENT))
    project.write('scripts/at-the-root.ts', moduleText(exportedConstant('atTheRoot'), DEBUGGER_STATEMENT))
    return {
      packageDir: project.pathOf(NESTED_PACKAGE),
      fromThePackage: runCheck(project.pathOf(NESTED_PACKAGE)),
      fromBelowIt: runCheck(project.pathOf(`${NESTED_PACKAGE}/src`)),
    }
  })

  it.each([
    { from: 'the folder of its agents-inc.lint.mts', ran: () => runs().fromThePackage },
    { from: 'a folder below it', ran: () => runs().fromBelowIt },
  ])("run from $from, lints the changed files under the config's folder, with paths from it, and notes those it skipped", ({ ran }) => {
    const { packageDir } = runs()

    expect(ran()).toStrictEqual({
      exitCode: EXIT.findings,
      signal: null,
      stdout: `src/in-the-package.ts:2 no-debugger — \`debugger\` statement is not allowed\ncheck: 1 error and 0 warnings in 1 of 1 changed file. ${ERRORS_SUMMARY_TAIL}\n`,
      stderr: `check: note: skipped 2 changed files outside ${packageDir}.\n`,
    })
  })
})

// q-c6: check lints the changed files under the nearest agents-inc.lint.mts, from the folder it runs
// in up to the git top level. A name starting with two dots, as ..pkg does, is not the folder above.
describe('check in a package whose folder, at the repo root, and a changed file in it are each named with two leading dots', () => {
  const PACKAGE = '..pkg'

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, {}, `${PACKAGE}/`) })
    project.write(`${PACKAGE}/..x.ts`, moduleText(exportedConstant('dotDotX'), DEBUGGER_STATEMENT))
    project.write(`${PACKAGE}/src/in-the-package.ts`, moduleText(exportedConstant('inThePackage'), DEBUGGER_STATEMENT))
    project.write('scripts/at-the-root.ts', moduleText(exportedConstant('atTheRoot'), DEBUGGER_STATEMENT))
    return {
      packageDir: project.pathOf(PACKAGE),
      fromThePackage: runCheck(project.pathOf(PACKAGE)),
      fromBelowIt: runCheck(project.pathOf(`${PACKAGE}/src`)),
    }
  })

  it.each([
    { from: 'the folder of its agents-inc.lint.mts', ran: () => runs().fromThePackage },
    { from: 'a folder below it, finding the config in the ..pkg folder', ran: () => runs().fromBelowIt },
  ])('run from $from, lints ..x.ts as a file in the config\'s folder, and skips only the file outside it', ({ ran }) => {
    const { packageDir } = runs()

    expect(ran()).toStrictEqual({
      exitCode: EXIT.findings,
      signal: null,
      stdout: `..x.ts:2 no-debugger — \`debugger\` statement is not allowed\nsrc/in-the-package.ts:2 no-debugger — \`debugger\` statement is not allowed\ncheck: 2 errors and 0 warnings in 2 of 2 changed files. ${ERRORS_SUMMARY_TAIL}\n`,
      stderr: `check: note: skipped 1 changed file outside ${packageDir}.\n`,
    })
  })
})

describe('check on suppression comments (K-14, K-23, q-c15)', () => {
  const run = setUpCheckAfterTheAgent(checkedPackageFiles(REDUNDANCY_AND_MODERN_JS, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED), (project) => {
    project.write('src/allowed/unused.ts', moduleText(...SUPPRESSIONS_TWO_UNUSED))
    project.write('src/banned-unused.ts', moduleText(...A_SUPPRESSION_OF_NOTHING))
    project.write('src/banned-over-a-finding.ts', moduleText(...A_SUPPRESSION_OVER_A_FINDING))
  })

  it('reports an unused suppression of an ESLint-run rule and of an oxlint-run rule, each once, where suppressions are allowed, and not one that suppressed a finding (K-23)', () => {
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

  it('reports no unused suppression where suppressions are banned, only the ban (K-23)', () => {
    expect(findingsInFile(run().stdout, 'src/banned-unused.ts')).toStrictEqual(['src/banned-unused.ts:2 house/no-suppressions'])
  })

  it('reports a banned suppression comment over a finding as exactly one finding, the ban (K-14)', () => {
    expect(findingsInFile(run().stdout, 'src/banned-over-a-finding.ts')).toStrictEqual(['src/banned-over-a-finding.ts:2 house/no-suppressions'])
  })
})

describe('check on findings spanning lines, and on findings about a whole file (K-26, q-c9)', () => {
  const run = setUpCheckAfterTheAgent(
    {
      ...checkedPackageFiles(REDUNDANCY_AND_TESTS),
      'src/catch-start.ts': moduleText(...GUARDED_BY_FINALLY),
      'src/catch-inside.ts': moduleText(...RETHROWN_BY_A_USELESS_CATCH),
      'src/old.test.ts': moduleText(exportedConstant('before'), exportedConstant('unchanged')),
    },
    (project) => {
      project.write('src/catch-start.ts', moduleText(...GUARDED_BY_A_USELESS_CATCH))
      project.write('src/catch-inside.ts', moduleText(...RETHROWN_WITH_A_COMMENT_ADDED))
      project.write('src/old.test.ts', moduleText(exportedConstant('after'), exportedConstant('unchanged')))
      project.write('src/fresh.test.ts', moduleText(exportedConstant('nothing')))
    },
  )

  it('keeps a finding spanning several lines whose first line changed', () => {
    expect(findingsInFile(run().stdout, 'src/catch-start.ts')).toStrictEqual(['src/catch-start.ts:4 no-useless-catch'])
  })

  // KNOWN GAP (an owner card): oxlint gives no-useless-catch at two places, the caught `error`
  // (line 4) and the rethrow (line 5), not as one span from line 4 to 6 (measured, oxlint 1.87). A
  // finding at several places now counts at any of them that changed (the cli review's Must Fix 1,
  // so that a duplicate an agent adds below the code it repeats is reported), so check reports this
  // one at line 5, where only a comment was added. Whether such a finding counts by its first place
  // (q-c9 as this assertion reads it) or at any place waits on the owner. Flip to `it` if the owner
  // keeps the first place.
  it.fails('drops a finding spanning several lines where only a later one of them changed, beside the one it keeps', () => {
    const { stdout } = run()

    expect({ kept: findingsInFile(stdout, 'src/catch-start.ts'), dropped: findingsInFile(stdout, 'src/catch-inside.ts') }).toStrictEqual({
      kept: ['src/catch-start.ts:4 no-useless-catch'],
      dropped: [],
    })
  })

  it('keeps a finding at line 0 in a new file', () => {
    expect(findingsInFile(run().stdout, 'src/fresh.test.ts')).toStrictEqual(['src/fresh.test.ts:0 sonarjs/no-empty-test-file'])
  })

  it('drops a finding at line 0 in a tracked file only part of which changed, beside the new file whose one it keeps', () => {
    const { stdout } = run()

    expect({ kept: findingsInFile(stdout, 'src/fresh.test.ts'), dropped: findingsInFile(stdout, 'src/old.test.ts') }).toStrictEqual({
      kept: ['src/fresh.test.ts:0 sonarjs/no-empty-test-file'],
      dropped: [],
    })
  })
})

describe('check on findings oxlint gives at several places, an agent having added the later one (q-c9)', () => {
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

describe("check where oxlint refuses an option the team gave a rule (K-16, read-q64)", () => {
  const run = setUpCheckAfterTheAgent(checkedPackageFiles(REDUNDANCY, { rules: { 'no-console': ['error', NO_CONSOLE_OPTION_OXLINT_REFUSES] } }), (project) => {
    project.write('src/a.ts', moduleText(exportedConstant('a')))
  })

  it('exits 2 quoting all oxlint printed, the reason included', () => {
    expect(run()).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: `check: could not run: oxlint failed: ${OXLINT_REFUSAL_OF_AN_OPTION}\n`,
    })
  })
})

describe("check on suppression comments in oxlint's own form (K-23, q-c15)", () => {
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

describe('check counting the changed files outside its config folder (K-22, q-c6)', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, {}, `${NESTED_PACKAGE}/`) })
    project.write('README.md', moduleText(DEBUGGER_STATEMENT))
    project.write('packages/b/settings.json', `${JSON.stringify({ debugger: true })}\n`)
    project.write('scripts/at-the-root.ts', moduleText(exportedConstant('atTheRoot')))
    return { packageDir: project.pathOf(NESTED_PACKAGE), result: runCheck(project.pathOf(NESTED_PACKAGE)) }
  })

  it('notes the JS and TS files among them alone, and has nothing to check in its folder', () => {
    const { packageDir, result } = run()

    expect(result).toStrictEqual({
      exitCode: EXIT.clean,
      signal: null,
      stdout: NOTHING_TO_CHECK,
      stderr: `check: note: skipped 1 changed file outside ${packageDir}.\n`,
    })
  })
})

describe('check on block suppression comments, and on enable comments that turn back on nothing (K-23, q-c10, q-c15)', () => {
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

  // Whether check reports an enable comment that turns back on nothing is an owner card; until it is
  // answered, check reports nothing on one.
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

describe('check on unused pairs beside comment-like text in a string or a template literal, where suppressions are allowed (K-23, q-c15)', () => {
  // Text that looks like a comment inside a string is no comment (cli review, r14). Read as one, it
  // made check refuse the whole run (exit 2), hiding the finding in src/other.ts, or report a pair
  // at the string's line, where ESLint does not, so that it went unreported.

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

describe('check where another writer moves a partly unused suppression comment down after oxlint read it, where suppressions are allowed (K-23, q-c15)', () => {
  // cli review n3: another writer adds a line above a suppression comment after oxlint's last run
  // read the file, and before check reads it to place what oxlint reported. oxlint's span on the name
  // that silenced nothing then falls in that writer's line, which no comment holds, and check refused
  // the whole run (exit 2), hiding the finding in src/other.ts. The pairing never refuses the run
  // (decided 2026-10-15): the moved comment goes unreported in this run, in either form, and the next
  // run reports it where it is now. Here the writer writes as oxlint's lint run ends, every time.
  const MOVED = [
    { file: 'src/allowed/eslint-moved.ts', form: 'eslint' },
    { file: 'src/allowed/oxlint-moved.ts', form: 'oxlint' },
  ] as const
  const IN_PLACE = [
    { file: 'src/allowed/eslint-in-place.ts', form: 'eslint' },
    { file: 'src/allowed/oxlint-in-place.ts', form: 'oxlint' },
  ] as const

  function writersTextOf(form: SuppressionForm): string {
    return moduleText(...movedDownByAnotherWriter(aSuppressionPartlyUnused(form)))
  }

  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, SUPPRESSIONS_ALLOWED_UNDER_SRC_ALLOWED) })
    const partlyUnused = [...MOVED, ...IN_PLACE]
    partlyUnused.forEach(({ file, form }) => project.write(file, moduleText(...aSuppressionPartlyUnused(form))))
    project.write('src/other.ts', moduleText(exportedConstant('other'), DEBUGGER_STATEMENT))
    const result = runCheck(project.dir, anotherWriterAsOxlintsLintRunEnds(MOVED.map(({ file, form }) => ({ path: project.pathOf(file), text: writersTextOf(form) }))))
    return { result, movedNow: MOVED.map(({ file }) => project.read(file)) }
  })

  it("reports neither moved comment and refuses nothing: reports the comment nobody moved, in either form, and the finding in another file, keeps the writer's text, and exits 1", () => {
    const { result, movedNow } = run()
    const messages = findingMessagesIn(result.stdout)

    expect({
      exitCode: result.exitCode,
      stderr: result.stderr,
      findings: findingsIn(result.stdout),
      inPlaceMessages: IN_PLACE.map(({ file }) => messages.get(`${file}:2 unused suppression`)),
      movedNow,
    }).toStrictEqual({
      exitCode: EXIT.findings,
      stderr: '',
      findings: ['src/allowed/eslint-in-place.ts:2 unused suppression', 'src/allowed/oxlint-in-place.ts:2 unused suppression', 'src/other.ts:2 no-debugger'],
      inPlaceMessages: [unusedSuppressionMessageOf('no-console'), unusedSuppressionMessageOf('no-console')],
      movedNow: MOVED.map(({ form }) => writersTextOf(form)),
    })
  })
})
