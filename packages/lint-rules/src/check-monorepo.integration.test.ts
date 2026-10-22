import { beforeAll, describe, expect, it } from 'vitest'
import {
  A_DEBUGGER_AND_A_LITERAL_THROWN,
  A_FLOATING_CALL_BESIDE_AN_AWAITED_ONE,
  AN_ASYNC_LOAD,
  aNameTheAliasedModuleLacks,
  aValueReadFrom,
  THE_ALIASED_MODULE,
} from './__tests__/cases/check-sources.ts'
import { findingMessagesIn, findingsIn, findingsInFile, lastLineOf } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import {
  A_TSCONFIG_TAKING_IN_THE_REPO,
  aLegacyEslintignoreIn,
  aliasOfTheLibFolder,
  API_PACKAGE,
  checkedPackageFiles,
  DEBUGGER_STATEMENT,
  ERRORS_SUMMARY_TAIL,
  ESLINTIGNORE_WARNING,
  exportedConstant,
  installedAtTheRepoRoot,
  monorepoPackageFiles,
  moduleText,
  NODE_MODULES_IGNORED_BY_GIT,
  packageTsconfigText,
  REDUNDANCY,
  TAKING_IN_SRC,
  WEB_PACKAGE,
} from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { runMadeFor, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'

// The config found from where check runs lints every changed file in the repo, paths printed from its folder.
// packages/web holds it; packages/api holds a tsconfig and package.json of its own.

allowEveryTestForParallelLoad()

const MONOREPO_RULESETS = { quality: ['redundancy', 'correctness', 'modules'] } as const
const REDUNDANCY_AND_CORRECTNESS = { quality: ['redundancy', 'correctness'] } as const
const CORRECTNESS = { quality: ['correctness'] } as const
const LISTED_BY_API = 'listed-by-api'
const LISTED_BY_NONE = 'listed-by-none'
// A TS file no tsconfig takes in: each package's tsconfig takes in src alone.
const OUTSIDE_EVERY_TSCONFIG = 'scripts/seed.ts'
// Turns off an oxlint-run rule and an ESLint-run one, with the untyped rule that reports where the typed one is off (measured).
const OFF = { 'no-debugger': 'off', '@typescript-eslint/only-throw-error': 'off', 'no-throw-literal': 'off' } as const

describe('check run in a package of a monorepo, after changes in it and in another package', () => {
  const API_FROM_WEB = '../api'

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        ...NODE_MODULES_IGNORED_BY_GIT,
        ...installedAtTheRepoRoot(LISTED_BY_API),
        ...installedAtTheRepoRoot(LISTED_BY_NONE),
        ...checkedPackageFiles(MONOREPO_RULESETS, {}, `${WEB_PACKAGE}/`),
        ...monorepoPackageFiles(WEB_PACKAGE, { include: ['src'], paths: aliasOfTheLibFolder('@web') }),
        [`${WEB_PACKAGE}/src/lib/value.ts`]: moduleText(...THE_ALIASED_MODULE),
        ...monorepoPackageFiles(API_PACKAGE, { include: ['src'], paths: aliasOfTheLibFolder('@api') }, { dependencies: { [LISTED_BY_API]: '*' } }),
        [`${API_PACKAGE}/src/lib/value.ts`]: moduleText(...THE_ALIASED_MODULE),
        [`${API_PACKAGE}/src/lib/load.ts`]: moduleText(...AN_ASYNC_LOAD),
      },
    })
    project.write(`${WEB_PACKAGE}/src/index.ts`, moduleText(exportedConstant('web'), DEBUGGER_STATEMENT))
    project.write(`${WEB_PACKAGE}/src/aliased.ts`, moduleText(...aNameTheAliasedModuleLacks('@web')))
    project.write(`${WEB_PACKAGE}/${OUTSIDE_EVERY_TSCONFIG}`, moduleText(exportedConstant('seed'), DEBUGGER_STATEMENT))
    project.write(`${API_PACKAGE}/src/index.ts`, moduleText(...A_FLOATING_CALL_BESIDE_AN_AWAITED_ONE))
    project.write(`${API_PACKAGE}/src/listed.ts`, moduleText(...aValueReadFrom(LISTED_BY_API)))
    project.write(`${API_PACKAGE}/src/unlisted.ts`, moduleText(...aValueReadFrom(LISTED_BY_NONE)))
    project.write(`${API_PACKAGE}/src/aliased.ts`, moduleText(...aNameTheAliasedModuleLacks('@api')))
    project.write(`${API_PACKAGE}/${OUTSIDE_EVERY_TSCONFIG}`, moduleText(exportedConstant('seed'), DEBUGGER_STATEMENT))
    return { apiSeed: project.pathOf(`${API_PACKAGE}/${OUTSIDE_EVERY_TSCONFIG}`), result: runCheck(project.pathOf(WEB_PACKAGE)) }
  })
  // A run that failed throws here, before the tests, so only the assertion can fail inside it.fails.
  beforeAll(() => {
    runs()
  })

  it("lints a changed file in another package, its typed rule reading that package's own tsconfig, beside the awaited call it leaves alone, and the config folder's own file, printing paths from the config's folder", () => {
    const { stdout } = runs().result

    expect({ api: findingsInFile(stdout, `${API_FROM_WEB}/src/index.ts`), web: findingsInFile(stdout, 'src/index.ts') }).toStrictEqual({
      api: [`${API_FROM_WEB}/src/index.ts:4 @typescript-eslint/no-floating-promises`],
      web: ['src/index.ts:2 no-debugger'],
    })
  })

  it("prints ESLint's parse error of a TS file in another package that no tsconfig takes in at line 0, then oxlint's findings in it, beside the same file in the config's folder, which gets the untyped rules and no parse error", () => {
    const { apiSeed, result } = runs()

    expect({
      api: findingsInFile(result.stdout, `${API_FROM_WEB}/${OUTSIDE_EVERY_TSCONFIG}`),
      message: findingMessagesIn(result.stdout).get(`${API_FROM_WEB}/${OUTSIDE_EVERY_TSCONFIG}:0 parse error`),
      noLineUndefined: !result.stdout.includes(':undefined '),
      web: findingsInFile(result.stdout, OUTSIDE_EVERY_TSCONFIG),
    }).toStrictEqual({
      api: [`${API_FROM_WEB}/${OUTSIDE_EVERY_TSCONFIG}:0 parse error`, `${API_FROM_WEB}/${OUTSIDE_EVERY_TSCONFIG}:2 no-debugger`],
      message: `Parsing error: ${apiSeed} was not found by the project service. Consider either including it in the tsconfig.json or including it in allowDefaultProject.`,
      noLineUndefined: true,
      web: [`${OUTSIDE_EVERY_TSCONFIG}:2 no-debugger`],
    })
  })

  it("reads each package's own dependencies: a package installed at the repo root that the importing package lists passes, one no package lists is reported", () => {
    const { stdout } = runs().result

    expect({ listed: findingsInFile(stdout, `${API_FROM_WEB}/src/listed.ts`), unlisted: findingsInFile(stdout, `${API_FROM_WEB}/src/unlisted.ts`) }).toStrictEqual({
      listed: [],
      unlisted: [`${API_FROM_WEB}/src/unlisted.ts:1 import-x/no-extraneous-dependencies`],
    })
  })

  it("reports a name the aliased module lacks through an alias of the config folder's own tsconfig", () => {
    expect(findingsInFile(runs().result.stdout, 'src/aliased.ts')).toStrictEqual(['src/aliased.ts:1 import-x/named'])
  })

  // KNOWN GAP: import-x resolves through the tsconfigs under the config's folder alone (a written limit).
  it.fails("reports a name the aliased module lacks through an alias only another package's tsconfig defines", () => {
    expect(findingsInFile(runs().result.stdout, `${API_FROM_WEB}/src/aliased.ts`)).toStrictEqual([`${API_FROM_WEB}/src/aliased.ts:1 import-x/named`])
  })

  it('reports nothing beyond these, prints nothing on stderr, and exits 1', () => {
    const { exitCode, stderr, stdout } = runs().result

    expect({ exitCode, stderr, findings: findingsIn(stdout).filter((finding) => !finding.startsWith(`${API_FROM_WEB}/src/aliased.ts:`)) }).toStrictEqual({
      exitCode: EXIT.findings,
      stderr: '',
      findings: [
        `${API_FROM_WEB}/${OUTSIDE_EVERY_TSCONFIG}:0 parse error`,
        `${API_FROM_WEB}/${OUTSIDE_EVERY_TSCONFIG}:2 no-debugger`,
        `${API_FROM_WEB}/src/index.ts:4 @typescript-eslint/no-floating-promises`,
        `${API_FROM_WEB}/src/unlisted.ts:1 import-x/no-extraneous-dependencies`,
        `${OUTSIDE_EVERY_TSCONFIG}:2 no-debugger`,
        'src/aliased.ts:1 import-x/named',
        'src/index.ts:2 no-debugger',
      ],
    })
  })
})

describe("check run in a package of a monorepo, on a changed TS file at the config folder's root that no tsconfig takes in", () => {
  // ESLint reads a path at the config folder's root, as its build names such a file, from where it runs alone.
  const AT_THE_ROOT = 'vite.config.ts'

  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...checkedPackageFiles(MONOREPO_RULESETS, {}, `${WEB_PACKAGE}/`), ...monorepoPackageFiles(WEB_PACKAGE, TAKING_IN_SRC) },
    })
    project.write(`${WEB_PACKAGE}/${AT_THE_ROOT}`, moduleText(exportedConstant('config'), DEBUGGER_STATEMENT))
    return runCheck(project.pathOf(WEB_PACKAGE))
  })

  it('gives it the untyped rules and no parse error, as it gives such a file in a folder below the config folder', () => {
    const { exitCode, stderr, stdout } = run()

    expect({ exitCode, stderr, findings: findingsIn(stdout) }).toStrictEqual({ exitCode: EXIT.findings, stderr: '', findings: [`${AT_THE_ROOT}:2 no-debugger`] })
  })
})

describe("check in a monorepo whose other package holds a config of its own, leaving out the ruleset the found config lists", () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        ...checkedPackageFiles(REDUNDANCY, {}, `${WEB_PACKAGE}/`),
        ...monorepoPackageFiles(WEB_PACKAGE, TAKING_IN_SRC),
        ...checkedPackageFiles(CORRECTNESS, {}, `${API_PACKAGE}/`),
        ...monorepoPackageFiles(API_PACKAGE, TAKING_IN_SRC),
      },
    })
    project.write(`${WEB_PACKAGE}/src/a.ts`, moduleText(exportedConstant('web'), DEBUGGER_STATEMENT))
    project.write(`${API_PACKAGE}/src/a.ts`, moduleText(exportedConstant('api'), DEBUGGER_STATEMENT))
    return { fromWeb: runCheck(project.pathOf(WEB_PACKAGE)), fromApi: runCheck(project.pathOf(API_PACKAGE)) }
  })

  it("lints the other package's files with the config found, never searching for theirs: run from web, its ruleset's rule reports in both packages", () => {
    const { exitCode, stdout } = runs().fromWeb

    expect({ exitCode, findings: findingsIn(stdout) }).toStrictEqual({ exitCode: EXIT.findings, findings: ['../api/src/a.ts:2 no-debugger', 'src/a.ts:2 no-debugger'] })
  })

  it("lints both packages with the other package's config where check runs there, which leaves that ruleset out, beside the run from web", () => {
    const { exitCode, stdout } = runs().fromApi

    expect({ exitCode, findings: findingsIn(stdout), summary: lastLineOf(stdout) }).toStrictEqual({
      exitCode: EXIT.clean,
      findings: [],
      summary: 'check: no findings in 2 changed files.',
    })
  })
})

describe("check in a monorepo, where the config's file overrides name a folder of the config's and files at any depth", () => {
  // Each tsconfig takes in its package's tests, which typing needs.
  const FILE_OVERRIDES = [
    { files: ['src/**'], rules: OFF },
    { files: ['**/*.test.ts'], rules: OFF },
  ] as const
  const SRC_AND_TESTS = { include: ['src', 'tests'], paths: {} }
  const CONFIG_FOLDERS = [
    { folder: WEB_PACKAGE, kind: 'web' },
    { folder: 'packages/(web)', kind: '(web), with glob syntax in its name' },
  ]

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    CONFIG_FOLDERS.map(({ folder, kind }) => {
      const project = createGitProject(tempProjects, {
        repo: 'committed',
        files: {
          ...checkedPackageFiles(REDUNDANCY_AND_CORRECTNESS, { fileOverrides: FILE_OVERRIDES }, `${folder}/`),
          ...monorepoPackageFiles(folder, SRC_AND_TESTS),
          ...monorepoPackageFiles(API_PACKAGE, SRC_AND_TESTS),
        },
      })
      const changed = [`${folder}/src/a.ts`, `${API_PACKAGE}/src/a.ts`, `${folder}/tests/a.test.ts`, `${API_PACKAGE}/tests/a.test.ts`]
      changed.forEach((file) => project.write(file, moduleText(...A_DEBUGGER_AND_A_LITERAL_THROWN)))
      return { kind, result: runCheck(project.pathOf(folder)) }
    }),
  )

  it.each(CONFIG_FOLDERS)("silence the config folder's own src/ with an override on src/**, in both engines, and not another package's src/: $kind", ({ kind }) => {
    const { stdout } = runMadeFor(runs(), kind).result

    expect({ own: findingsInFile(stdout, 'src/a.ts'), other: findingsInFile(stdout, '../api/src/a.ts') }).toStrictEqual({
      own: [],
      other: ['../api/src/a.ts:2 no-debugger', '../api/src/a.ts:3 @typescript-eslint/only-throw-error'],
    })
  })

  it.each(CONFIG_FOLDERS)("silence both packages' test files with an override on **/*.test.ts, in both engines, having linted all four files: $kind", ({ kind }) => {
    const { exitCode, stdout } = runMadeFor(runs(), kind).result

    expect({ exitCode, own: findingsInFile(stdout, 'tests/a.test.ts'), other: findingsInFile(stdout, '../api/tests/a.test.ts'), summary: lastLineOf(stdout) }).toStrictEqual({
      exitCode: EXIT.findings,
      own: [],
      other: [],
      summary: `check: 2 errors and 0 warnings in 1 of 4 changed files. ${ERRORS_SUMMARY_TAIL}`,
    })
  })
})

describe("check, where the config's file overrides name files at its folder's root, one glob led by ./ and one by /", () => {
  // As at the config's folder before check linted other packages: both engines read a `./` glob from that folder, and neither reads a `/` one as any file.
  const LED_BY_DOT_SLASH = 'led-by-dot-slash.ts'
  const LED_BY_SLASH = 'led-by-slash.ts'
  const FILE_OVERRIDES = [
    { files: [`./${LED_BY_DOT_SLASH}`], rules: OFF },
    { files: [`/${LED_BY_SLASH}`], rules: OFF },
  ] as const
  const AT_ITS_ROOT = { include: ['*.ts'], paths: {} }
  const CONFIG_FOLDERS = [
    { folder: WEB_PACKAGE, kind: 'a config in a package' },
    { folder: '', kind: 'a config at the git top level' },
  ]

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    CONFIG_FOLDERS.map(({ folder, kind }) => {
      const under = folder === '' ? '' : `${folder}/`
      const project = createGitProject(tempProjects, {
        repo: 'committed',
        files: { ...checkedPackageFiles(REDUNDANCY_AND_CORRECTNESS, { fileOverrides: FILE_OVERRIDES }, under), [`${under}tsconfig.json`]: packageTsconfigText(AT_ITS_ROOT) },
      })
      const changed = [LED_BY_DOT_SLASH, LED_BY_SLASH]
      changed.forEach((file) => project.write(`${under}${file}`, moduleText(...A_DEBUGGER_AND_A_LITERAL_THROWN)))
      return { kind, result: runCheck(project.pathOf(folder)) }
    }),
  )

  it.each(CONFIG_FOLDERS)('silences the file the ./ glob names in both engines, and the one the / glob names in neither: $kind', ({ kind }) => {
    const { stdout } = runMadeFor(runs(), kind).result

    expect({ dotSlash: findingsInFile(stdout, LED_BY_DOT_SLASH), slash: findingsInFile(stdout, LED_BY_SLASH) }).toStrictEqual({
      dotSlash: [],
      slash: [`${LED_BY_SLASH}:2 no-debugger`, `${LED_BY_SLASH}:3 @typescript-eslint/only-throw-error`],
    })
  })
})

describe("check in a monorepo, where the config's file override on src/** meets a changed file in a src folder at the git top level", () => {
  const SRC_FILE = 'src/a.ts'

  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        ...A_TSCONFIG_TAKING_IN_THE_REPO,
        ...checkedPackageFiles(REDUNDANCY_AND_CORRECTNESS, { fileOverrides: [{ files: ['src/**'], rules: OFF }] }, `${WEB_PACKAGE}/`),
        ...monorepoPackageFiles(WEB_PACKAGE, TAKING_IN_SRC),
      },
    })
    const changed = [SRC_FILE, `${WEB_PACKAGE}/${SRC_FILE}`]
    changed.forEach((file) => project.write(file, moduleText(...A_DEBUGGER_AND_A_LITERAL_THROWN)))
    return runCheck(project.pathOf(WEB_PACKAGE))
  })

  it("reads the override from the config's folder in both engines: it silences that folder's src/, not the one at the git top level", () => {
    expect(findingsIn(run().stdout)).toStrictEqual([`../../${SRC_FILE}:2 no-debugger`, `../../${SRC_FILE}:3 @typescript-eslint/only-throw-error`])
  })
})

describe("check in a monorepo where nothing outside the config's folder changed, and with the config at the git top level", () => {
  const NESTED = 'packages/a'

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const nested = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, {}, `${NESTED}/`) })
    nested.write(`${NESTED}/src/a.ts`, moduleText(exportedConstant('a'), DEBUGGER_STATEMENT))
    const atTheTop = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY) })
    atTheTop.write(`${NESTED}/src/a.ts`, moduleText(exportedConstant('a'), DEBUGGER_STATEMENT))
    return { nested: runCheck(nested.pathOf(NESTED)), atTheTop: runCheck(atTheTop.pathOf(NESTED)) }
  })

  it.each([
    { kind: "a config in a package, only that package's file changed", file: 'src/a.ts', ran: () => runs().nested },
    { kind: 'a config at the git top level, run from a package below it', file: `${NESTED}/src/a.ts`, ran: () => runs().atTheTop },
  ])('prints as it did before it linted other packages: $kind', ({ file, ran }) => {
    expect(ran()).toStrictEqual({
      exitCode: EXIT.findings,
      signal: null,
      stdout: `${file}:2 no-debugger — \`debugger\` statement is not allowed\ncheck: 1 error and 0 warnings in 1 of 1 changed file. ${ERRORS_SUMMARY_TAIL}\n`,
      stderr: '',
    })
  })
})

describe("check in a monorepo where nothing outside the config's folder changed, with rules that read paths from the folder ESLint runs in", () => {
  // check-file judges each folder below it; import-x reads a team's dependency globs from it.
  const SPACED_FOLDER = 'packages/web app'
  const NAMING = { quality: ['naming'] } as const
  const MODULES = { quality: ['modules'] } as const
  const DEV_ONLY = 'dev-only'
  const DEV_DEPENDENCY_GLOBS = { rules: { 'import-x/no-extraneous-dependencies': ['error', { devDependencies: ['vite.config.ts', 'scripts/**'] }] } } as const
  const FILES_THE_GLOBS_NAME = ['vite.config.ts', 'scripts/seed.ts']
  const IMPORTING_DEV_ONLY = [...FILES_THE_GLOBS_NAME, 'src/app.ts']

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const spaced = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...checkedPackageFiles(NAMING, {}, `${SPACED_FOLDER}/`), ...monorepoPackageFiles(SPACED_FOLDER, TAKING_IN_SRC) },
    })
    spaced.write(`${SPACED_FOLDER}/src/a.ts`, moduleText(exportedConstant('value')))
    spaced.write(`${SPACED_FOLDER}/src/bad name/b.ts`, moduleText(exportedConstant('value')))
    const devDependencies = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        ...NODE_MODULES_IGNORED_BY_GIT,
        ...installedAtTheRepoRoot(DEV_ONLY),
        ...checkedPackageFiles(MODULES, DEV_DEPENDENCY_GLOBS, `${WEB_PACKAGE}/`),
        ...monorepoPackageFiles(WEB_PACKAGE, { include: ['src', ...FILES_THE_GLOBS_NAME], paths: {} }, { devDependencies: { [DEV_ONLY]: '*' } }),
      },
    })
    IMPORTING_DEV_ONLY.forEach((file) => devDependencies.write(`${WEB_PACKAGE}/${file}`, moduleText(...aValueReadFrom(DEV_ONLY))))
    return {
      spaced: runCheck(spaced.pathOf(SPACED_FOLDER)),
      fromTheConfigFolder: runCheck(devDependencies.pathOf(WEB_PACKAGE)),
      fromAFolderBelowIt: runCheck(devDependencies.pathOf(`${WEB_PACKAGE}/src`)),
    }
  })

  it("judges the folders below the config's folder alone, as it did before it linted other packages: the folder holding the config may break the naming rule, one below it may not", () => {
    expect(runs().spaced).toStrictEqual({
      exitCode: EXIT.findings,
      signal: null,
      stdout: `src/bad name/b.ts:1 check-file/folder-naming-convention — The folder "bad name" does not match the "!(*[ !#$&;<>?|]*)" pattern\ncheck: 1 error and 0 warnings in 1 of 2 changed files. ${ERRORS_SUMMARY_TAIL}\n`,
      stderr: '',
    })
  })

  it.each([
    { kind: "run from the config's folder", ran: () => runs().fromTheConfigFolder },
    { kind: 'run from a folder below it', ran: () => runs().fromAFolderBelowIt },
  ])("reads a team's dependency globs from the config's folder, as it did before: the files they name may import a dev dependency, one they do not name may not: $kind", ({ ran }) => {
    const { exitCode, stderr, stdout } = ran()

    expect({ exitCode, stderr, findings: findingsIn(stdout) }).toStrictEqual({ exitCode: EXIT.findings, stderr: '', findings: ['src/app.ts:1 import-x/no-extraneous-dependencies'] })
  })
})

describe('check run in a package of a monorepo whose git top level holds a legacy .eslintignore', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        ...NODE_MODULES_IGNORED_BY_GIT,
        ...aLegacyEslintignoreIn(),
        ...checkedPackageFiles(REDUNDANCY, {}, `${WEB_PACKAGE}/`),
        ...monorepoPackageFiles(WEB_PACKAGE, TAKING_IN_SRC),
        ...monorepoPackageFiles(API_PACKAGE, TAKING_IN_SRC),
      },
    })
    project.write(`${WEB_PACKAGE}/src/index.ts`, moduleText(exportedConstant('web'), DEBUGGER_STATEMENT))
    const insideAlone = runCheck(project.pathOf(WEB_PACKAGE))
    project.write(`${API_PACKAGE}/src/index.ts`, moduleText(exportedConstant('api'), DEBUGGER_STATEMENT))
    return { insideAlone, outsideToo: runCheck(project.pathOf(WEB_PACKAGE)) }
  })

  it("prints nothing on stderr where every changed file is in the config's folder, beside a change in another package, for which ESLint, run from the git top level, warns of the file", () => {
    const { insideAlone, outsideToo } = runs()

    expect({ insideAlone: insideAlone.stderr, outsideToo: outsideToo.stderr.includes(ESLINTIGNORE_WARNING) }).toStrictEqual({ insideAlone: '', outsideToo: true })
  })

  it('reports the changed files either way', () => {
    const { insideAlone, outsideToo } = runs()

    expect({ insideAlone: findingsIn(insideAlone.stdout), outsideToo: findingsIn(outsideToo.stdout) }).toStrictEqual({
      insideAlone: ['src/index.ts:2 no-debugger'],
      outsideToo: ['../api/src/index.ts:2 no-debugger', 'src/index.ts:2 no-debugger'],
    })
  })
})

describe('check run in a package of a monorepo whose config folder holds a legacy .eslintignore', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        ...NODE_MODULES_IGNORED_BY_GIT,
        ...aLegacyEslintignoreIn(`${WEB_PACKAGE}/`),
        ...checkedPackageFiles(REDUNDANCY, {}, `${WEB_PACKAGE}/`),
        ...monorepoPackageFiles(WEB_PACKAGE, TAKING_IN_SRC),
        ...monorepoPackageFiles(API_PACKAGE, TAKING_IN_SRC),
      },
    })
    project.write(`${API_PACKAGE}/src/index.ts`, moduleText(exportedConstant('api'), DEBUGGER_STATEMENT))
    const outsideAlone = runCheck(project.pathOf(WEB_PACKAGE))
    project.write(`${WEB_PACKAGE}/src/index.ts`, moduleText(exportedConstant('web'), DEBUGGER_STATEMENT))
    return { outsideAlone, insideToo: runCheck(project.pathOf(WEB_PACKAGE)) }
  })

  it("prints nothing on stderr where every changed file is in another package, beside a change in the config's folder, for which ESLint, run from there, warns of the file", () => {
    const { outsideAlone, insideToo } = runs()

    expect({ outsideAlone: outsideAlone.stderr, insideToo: insideToo.stderr.includes(ESLINTIGNORE_WARNING) }).toStrictEqual({ outsideAlone: '', insideToo: true })
  })

  it('reports the changed files either way', () => {
    const { outsideAlone, insideToo } = runs()

    expect({ outsideAlone: findingsIn(outsideAlone.stdout), insideToo: findingsIn(insideToo.stdout) }).toStrictEqual({
      outsideAlone: ['../api/src/index.ts:2 no-debugger'],
      insideToo: ['../api/src/index.ts:2 no-debugger', 'src/index.ts:2 no-debugger'],
    })
  })
})
