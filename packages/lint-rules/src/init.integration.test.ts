import { chmodSync } from 'node:fs'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { beforeAll, describe, expect, it } from 'vitest'
import { A_LITERAL_THROWN, AN_IMPORT_BELOW_CODE, AN_IMPORT_OF_OUR_PACKAGE, NAMED_IMPORTS_OUT_OF_ORDER, NAMED_IMPORTS_SORTED, UNITS } from './__tests__/cases/check-sources.ts'
import { ESLINT_CONFIG_TEXT, OXLINT_CONFIG_TEXT } from './__tests__/cases/consumer-files-as-plan-md-shows.ts'
import { PACKAGE_JSON_EDITS, PACKAGE_JSON_LISTING_US } from './__tests__/cases/init-package-json-edits.ts'
import { autofixedFilesIn, findingsIn, findingsInFile } from './__tests__/check-output.ts'
import { CLI_FILE, EXIT, runCheck, runCommandLine, runInit, RUNS_IN_THE_BACKGROUND, searchPathWithoutOurBin } from './__tests__/cli-runs.ts'
import { importInNode, INSTALLED_TYPES_NODE, typeCheck } from './__tests__/config-file-loads.ts'
import {
  checkConfigText,
  checkedPackageFiles,
  CONFIG_FILE,
  DEBUGGER_STATEMENT,
  exportedConstant,
  moduleText,
  NESTED_PACKAGE,
  PACKAGE_JSON_FILE,
  REDUNDANCY,
} from './__tests__/factories/check-factories.ts'
import {
  BUN,
  buildInitPackageJson,
  GIT_COULD_NOT_RUN_NOTE,
  initConfigTextListing,
  initListsOf,
  initListsOfTheCatalog,
  initStdout,
  NPM,
  npmPackageJsonText,
  OUR_PACKAGE,
  OUR_RANGE,
  outsideGitNote,
  PACKAGE_JSON_LEFT_MID_MERGE,
  packageJsonTextIn,
  PNPM,
  TYPES_NODE_ENTRY,
  TYPES_NODE_NOTE,
  YARN,
} from './__tests__/factories/init-factories.ts'
import { EVERY_RULESET } from './__tests__/factories/lint-rules-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { createGitProject, gitStatusOf } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { runMadeFor, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { CONSUMER_INSTALL, entriesUnder, setUpEmptyFolders, type TempProjects } from './__tests__/temp-projects.ts'

allowEveryTestForParallelLoad()

const A_PACKAGE = buildInitPackageJson()
const A_PACKAGE_WITH_TYPES = buildInitPackageJson({ devDependencies: TYPES_NODE_ENTRY })
const PACKAGE_JSON_WITH_TYPES = npmPackageJsonText(A_PACKAGE_WITH_TYPES)
const NO_UNPUBLISHED_IMPORT = 'n/no-unpublished-import'
const USES_DEV_FILE = 'src/uses-dev.ts'

describe('init in a package in a git repo', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES } })
    const result = runInit(project.dir)
    return { result, config: project.readIfWritten(CONFIG_FILE), packageJson: project.read(PACKAGE_JSON_FILE), status: gitStatusOf(project) }
  })

  it("exits 0, printing the install command and the lines for the agents' instructions, and no note", () => {
    expect(run().result).toStrictEqual({ exitCode: EXIT.clean, signal: null, stdout: initStdout('added', NPM), stderr: '' })
  })

  it('writes the agent set with every ruleset that is not opt-in, in data order, the sorting ones named only in a comment with the formatter warning, and the editor set empty', () => {
    expect(run().config).toBe(initConfigTextListing(initListsOfTheCatalog()))
  })

  it('adds our package to devDependencies at a caret on our version, in order', () => {
    expect(run().packageJson).toBe(npmPackageJsonText(buildInitPackageJson({ devDependencies: { [OUR_PACKAGE]: OUR_RANGE, ...TYPES_NODE_ENTRY } })))
  })

  it('changes exactly the two files, as git status shows', () => {
    expect(run().status).toStrictEqual([` M ${PACKAGE_JSON_FILE}`, `?? ${CONFIG_FILE}`])
  })
})

describe('the package.json edit', () => {
  const EDITS = [...PACKAGE_JSON_EDITS.map((edit) => ({ ...edit, entry: 'added' as const })), ...PACKAGE_JSON_LISTING_US]

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    EDITS.map(({ kind, layout, before }) => {
      const project = createGitProject(tempProjects, { repo: 'committed', files: { [PACKAGE_JSON_FILE]: packageJsonTextIn(before, layout) } })
      const result = runInit(project.dir)
      return { kind, result, packageJson: project.read(PACKAGE_JSON_FILE), configWritten: project.exists(CONFIG_FILE) }
    }),
  )

  it.each(EDITS)('edits the text alone, every other byte kept: $kind', ({ kind, layout, after, entry }) => {
    const { result, packageJson, configWritten } = runMadeFor(runs(), kind)

    expect({ exitCode: result.exitCode, firstLine: result.stdout.split('\n', 1)[0], packageJson, configWritten }).toStrictEqual({
      exitCode: EXIT.clean,
      firstLine: initStdout(entry, NPM).split('\n', 1)[0],
      packageJson: packageJsonTextIn(after, layout),
      configWritten: true,
    })
  })
})

describe('the file init writes, loaded', () => {
  const TSCONFIG_INCLUDING_THE_CONFIG = `${JSON.stringify(buildTsconfig({ include: [CONFIG_FILE] }))}\n`

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const withTypes = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES, 'tsconfig.json': TSCONFIG_INCLUDING_THE_CONFIG },
      linkedPackages: [...CONSUMER_INSTALL, INSTALLED_TYPES_NODE],
    })
    const withoutTypes = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [PACKAGE_JSON_FILE]: npmPackageJsonText(A_PACKAGE), 'tsconfig.json': TSCONFIG_INCLUDING_THE_CONFIG },
    })
    return {
      withTypes: { init: runInit(withTypes.dir), imported: importInNode(withTypes.pathOf(CONFIG_FILE)), typeChecked: typeCheck(withTypes.dir) },
      withoutTypes: { init: runInit(withoutTypes.dir), typeChecked: typeCheck(withoutTypes.dir) },
    }
  })

  it('is accepted by defineLintRules: Node imports it, and it exports both parts', () => {
    const { init, imported } = runs().withTypes

    expect({ init: init.exitCode, imported }).toStrictEqual({ init: EXIT.clean, imported: { exitCode: 0, stdout: 'eslint oxlint\n', stderr: '' } })
  })

  // TypeScript 6 loads no @types package `compilerOptions.types` does not list; the file's reference loads Node's.
  it('type-checks with tsc in a project that has @types/node', () => {
    const { init, typeChecked } = runs().withTypes

    expect({ init: init.exitCode, typeChecked }).toStrictEqual({ init: EXIT.clean, typeChecked: { exitCode: 0, stdout: '', stderr: '' } })
  })

  it('fails tsc on import.meta.dirname in a project without @types/node, which is why init notes it then', () => {
    const { init, typeChecked } = runs().withoutTypes

    expect({ init: init.exitCode, note: init.stderr, failsOnDirname: typeChecked.exitCode !== 0 && /TS2339.+'dirname'/u.test(typeChecked.stdout) }).toStrictEqual({
      init: EXIT.clean,
      note: TYPES_NODE_NOTE,
      failsOnDirname: true,
    })
  })
})

describe('check right after init, the config untracked', () => {
  // Pairwise over four choices: a private or a published package, a tsconfig that includes the
  // config or one that does not, the opt-in comment or none, @types/node or none. With the comment,
  // the file is the one init wrote; without it, the team listed the opt-in rulesets and dropped it.
  const PRIVATE_VARIANTS_NO_TSCONFIG_TAKES_IN = [
    { kind: 'private, tsconfig not including it, an opt-in comment, @types/node', isPrivate: true, includesConfig: false, optInComment: true, typesNode: true },
  ]
  const PRIVATE_VARIANTS_A_TSCONFIG_TAKES_IN = [
    { kind: 'private, tsconfig including the config, no opt-in comment, no @types/node', isPrivate: true, includesConfig: true, optInComment: false, typesNode: false },
  ]
  const PUBLISHED_VARIANTS_NO_TSCONFIG_TAKES_IN = [
    { kind: 'published, tsconfig not including it, no opt-in comment, @types/node', isPrivate: false, includesConfig: false, optInComment: false, typesNode: true },
  ]
  const PUBLISHED_VARIANTS_A_TSCONFIG_TAKES_IN_WITH_NODE_TYPES = [
    { kind: 'published, tsconfig including it, an opt-in comment, @types/node', isPrivate: false, includesConfig: true, optInComment: true, typesNode: true },
  ]
  const PUBLISHED_VARIANTS_A_TSCONFIG_TAKES_IN_WITHOUT_NODE_TYPES = [
    { kind: 'published, tsconfig including it, an opt-in comment, no @types/node', isPrivate: false, includesConfig: true, optInComment: true, typesNode: false },
  ]
  const PUBLISHED_VARIANTS = [
    ...PUBLISHED_VARIANTS_NO_TSCONFIG_TAKES_IN,
    ...PUBLISHED_VARIANTS_A_TSCONFIG_TAKES_IN_WITH_NODE_TYPES,
    ...PUBLISHED_VARIANTS_A_TSCONFIG_TAKES_IN_WITHOUT_NODE_TYPES,
  ]
  const VARIANTS = [...PRIVATE_VARIANTS_NO_TSCONFIG_TAKES_IN, ...PRIVATE_VARIANTS_A_TSCONFIG_TAKES_IN, ...PUBLISHED_VARIANTS]

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    VARIANTS.map(({ kind, isPrivate, includesConfig, optInComment, typesNode }) => {
      const devDependencies = typesNode ? TYPES_NODE_ENTRY : {}
      const packageJson = buildInitPackageJson({ published: !isPrivate, devDependencies })
      const tsconfig = buildTsconfig(includesConfig ? {} : { include: ['src'] })
      const project = createGitProject(tempProjects, {
        repo: 'committed',
        files: { [PACKAGE_JSON_FILE]: npmPackageJsonText(packageJson), 'tsconfig.json': `${JSON.stringify(tsconfig)}\n`, 'src/index.ts': moduleText(exportedConstant('index')) },
        linkedPackages: typesNode ? [...CONSUMER_INSTALL, INSTALLED_TYPES_NODE] : CONSUMER_INSTALL,
      })
      const init = runInit(project.dir)
      if (!optInComment) project.write(CONFIG_FILE, initConfigTextListing(initListsOf(EVERY_RULESET)))
      return { kind, init, check: runCheck(project.dir) }
    }),
  )
  // A run that failed throws here, before the tests, so only the assertion can fail inside it.fails.
  beforeAll(() => {
    runs()
  })

  function checkAfterInit(kind: string): { readonly init: number | null; readonly check: number | null; readonly findings: readonly string[] } {
    const made = runMadeFor(runs(), kind)
    return { init: made.init.exitCode, check: made.check.exitCode, findings: findingsIn(made.check.stdout) }
  }

  it.each(PRIVATE_VARIANTS_NO_TSCONFIG_TAKES_IN)('reports nothing in agents-inc.lint.mts: $kind', ({ kind }) => {
    expect(checkAfterInit(kind)).toStrictEqual({ init: EXIT.clean, check: EXIT.clean, findings: [] })
  })

  // KNOWN GAP: without @types/node, which init's note asks for, `import.meta.dirname` is an error type where a
  // tsconfig takes the config in, so check reports @typescript-eslint/no-unsafe-assignment at line 5.
  it.fails.each(PRIVATE_VARIANTS_A_TSCONFIG_TAKES_IN)('reports nothing in agents-inc.lint.mts: $kind', ({ kind }) => {
    expect(checkAfterInit(kind)).toStrictEqual({ init: EXIT.clean, check: EXIT.clean, findings: [] })
  })

  // In a publishable package with no `"files"` field, n/no-unpublished-import leaves our config file
  // alone, though it imports a devDependency.
  it.each(PUBLISHED_VARIANTS_NO_TSCONFIG_TAKES_IN)('reports nothing in agents-inc.lint.mts: $kind', ({ kind }) => {
    expect(checkAfterInit(kind)).toStrictEqual({ init: EXIT.clean, check: EXIT.clean, findings: [] })
  })

  it.each(PUBLISHED_VARIANTS_A_TSCONFIG_TAKES_IN_WITH_NODE_TYPES)('reports nothing in agents-inc.lint.mts: $kind', ({ kind }) => {
    expect(checkAfterInit(kind)).toStrictEqual({ init: EXIT.clean, check: EXIT.clean, findings: [] })
  })

  // KNOWN GAP: the one above, in a published package too.
  it.fails.each(PUBLISHED_VARIANTS_A_TSCONFIG_TAKES_IN_WITHOUT_NODE_TYPES)('reports nothing in agents-inc.lint.mts: $kind', ({ kind }) => {
    expect(checkAfterInit(kind)).toStrictEqual({ init: EXIT.clean, check: EXIT.clean, findings: [] })
  })

  it.each(PUBLISHED_VARIANTS)('reports no n/no-unpublished-import in agents-inc.lint.mts: $kind', ({ kind }) => {
    expect(checkAfterInit(kind).findings.filter((finding) => finding.endsWith(` ${NO_UNPUBLISHED_IMPORT}`))).toStrictEqual([])
  })
})

describe("check right after init in a package npm may publish, the team's configs merging our parts as plan.md shows, beside a file of its own importing a devDependency", () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        [PACKAGE_JSON_FILE]: npmPackageJsonText(buildInitPackageJson({ published: true, devDependencies: TYPES_NODE_ENTRY })),
        'tsconfig.json': `${JSON.stringify(buildTsconfig({ include: ['src'] }))}\n`,
        'src/index.ts': moduleText(exportedConstant('index')),
      },
      linkedPackages: [...CONSUMER_INSTALL, INSTALLED_TYPES_NODE],
    })
    const init = runInit(project.dir)
    project.write(consumerConfigFiles.eslintConfig, ESLINT_CONFIG_TEXT)
    project.write(consumerConfigFiles.oxlintConfig, OXLINT_CONFIG_TEXT)
    project.write(USES_DEV_FILE, moduleText(...AN_IMPORT_OF_OUR_PACKAGE))
    return { init, check: runCheck(project.dir) }
  })

  // By file: check applies its autofixes before it reports, which may move the import's line.
  it('reports n/no-unpublished-import in that file alone, none in the three files that import our package for the team', () => {
    const { init, check } = run()
    const filesImportingOurPackage = [...Object.values(consumerConfigFiles), USES_DEV_FILE]
    const reportingFiles = filesImportingOurPackage.filter((file) =>
      findingsInFile(check.stdout, file).some((finding) => finding.endsWith(` ${NO_UNPUBLISHED_IMPORT}`)),
    )

    expect({ init: init.exitCode, reportingFiles }).toStrictEqual({ init: EXIT.clean, reportingFiles: [USES_DEV_FILE] })
  })
})

describe('the sorting rulesets, opt-in: check in a project as init left it, beside one that lists them', () => {
  // Three files an agent adds: an array the program reads in order (perfectionist/sort-arrays, in
  // ordering; check withholds its fix and reports it), named imports out of order
  // (perfectionist/sort-named-imports, in import-order; check fixes them), and an import below other
  // code (import-x/first, in import-order too).
  const UNITS_FILE = 'src/units.ts'
  const IMPORTS_FILE = 'src/imports.ts'
  const FIRST_FILE = 'src/first.ts'
  const ADDED_FILES = { [UNITS_FILE]: moduleText(...UNITS), [IMPORTS_FILE]: moduleText(...NAMED_IMPORTS_OUT_OF_ORDER), [FIRST_FILE]: moduleText(...AN_IMPORT_BELOW_CODE) }

  /** init's exit code, then check's, the findings it printed, the files it autofixed, and the added files' texts once it ran. */
  type CheckAfterInit = {
    readonly init: number | null
    readonly exitCode: number | null
    readonly findings: readonly string[]
    readonly autofixed: readonly string[]
    readonly texts: Readonly<Record<string, string>>
  }

  /** check in a package init ran in, its config then replaced by the text given (null: kept as init wrote it), once an agent added the three files. */
  function checkAfterInit(tempProjects: TempProjects, configAfterInit: string | null): CheckAfterInit {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES } })
    const init = runInit(project.dir)
    if (configAfterInit !== null) project.write(CONFIG_FILE, configAfterInit)
    for (const [file, text] of Object.entries(ADDED_FILES)) project.write(file, text)
    const check = runCheck(project.dir)
    return {
      init: init.exitCode,
      exitCode: check.exitCode,
      findings: findingsIn(check.stdout),
      autofixed: autofixedFilesIn(check.stdout),
      texts: Object.fromEntries(Object.keys(ADDED_FILES).map((file) => [file, project.read(file)])),
    }
  }

  const runs = setUpRunsBeforeTheSuite((tempProjects) => ({
    asInitLeftIt: checkAfterInit(tempProjects, null),
    listingThem: checkAfterInit(tempProjects, initConfigTextListing(initListsOf(EVERY_RULESET))),
  }))

  it('sorts nothing and reports nothing where the config is as init wrote it, the import below other code included', () => {
    expect(runs().asInitLeftIt).toStrictEqual({
      init: EXIT.clean,
      exitCode: EXIT.clean,
      findings: [],
      autofixed: [],
      texts: ADDED_FILES,
    })
  })

  it('sorts the imports and reports the array where the config lists both sorting rulesets, and reports the import below other code', () => {
    expect(runs().listingThem).toStrictEqual({
      init: EXIT.clean,
      exitCode: EXIT.findings,
      findings: [`${FIRST_FILE}:2 import-x/first`, `${UNITS_FILE}:1 perfectionist/sort-arrays`],
      autofixed: [IMPORTS_FILE],
      texts: { ...ADDED_FILES, [IMPORTS_FILE]: moduleText(...NAMED_IMPORTS_SORTED) },
    })
  })
})

describe('init where it refuses', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const configExists = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES, [CONFIG_FILE]: checkConfigText({ quality: ['redundancy'] }) },
    })
    const configBefore = configExists.read(CONFIG_FILE)
    const noPackageJson = createGitProject(tempProjects, { repo: 'not a repo', files: {} })
    const onlyAbove = createGitProject(tempProjects, { repo: 'not a repo', files: {} })
    onlyAbove.writeAbove(PACKAGE_JSON_FILE, PACKAGE_JSON_WITH_TYPES)
    const notJson = createGitProject(tempProjects, { repo: 'not a repo', files: { [PACKAGE_JSON_FILE]: '{ "name": "consumer-project",\n' } })
    const anArray = createGitProject(tempProjects, { repo: 'not a repo', files: { [PACKAGE_JSON_FILE]: '[]\n' } })
    return {
      configExists: { dir: configExists.dir, result: runInit(configExists.dir), configBefore, configAfter: configExists.read(CONFIG_FILE), packageJsonAfter: configExists.read(PACKAGE_JSON_FILE) },
      noPackageJson: { dir: noPackageJson.dir, result: runInit(noPackageJson.dir), entries: entriesUnder(noPackageJson.dir) },
      onlyAbove: { dir: onlyAbove.dir, result: runInit(onlyAbove.dir), entries: entriesUnder(onlyAbove.dir) },
      notJson: { path: notJson.pathOf(PACKAGE_JSON_FILE), result: runInit(notJson.dir), entries: entriesUnder(notJson.dir), text: notJson.read(PACKAGE_JSON_FILE) },
      anArray: { path: anArray.pathOf(PACKAGE_JSON_FILE), result: runInit(anArray.dir), entries: entriesUnder(anArray.dir), text: anArray.read(PACKAGE_JSON_FILE) },
    }
  })
  type RefusingRuns = ReturnType<typeof runs>

  it('exits 1 and changes neither file where agents-inc.lint.mts exists', () => {
    const { dir, result, configBefore, configAfter, packageJsonAfter } = runs().configExists

    expect({ result, configAfter, packageJsonAfter }).toStrictEqual({
      result: {
        exitCode: EXIT.findings,
        signal: null,
        stdout: '',
        stderr: `init: agents-inc.lint.mts already exists in ${dir}; nothing was changed. Delete it to start again.\n`,
      },
      configAfter: configBefore,
      packageJsonAfter: PACKAGE_JSON_WITH_TYPES,
    })
  })

  it.each<{ readonly kind: string; readonly made: () => RefusingRuns['noPackageJson'] }>([
    { kind: 'no package.json at all', made() { return runs().noPackageJson } },
    { kind: 'a package.json only in the folder above', made() { return runs().onlyAbove } },
  ])('exits 2 and writes nothing where the folder has no package.json: $kind', ({ made }) => {
    const { dir, result, entries } = made()

    expect({ result, entries }).toStrictEqual({
      result: {
        exitCode: EXIT.couldNotRun,
        signal: null,
        stdout: '',
        stderr: `init: could not run: there is no package.json in ${dir}. Run init in the folder of the package to lint.\n`,
      },
      entries: [],
    })
  })

  it.each<{ readonly kind: string; readonly problem: string; readonly made: () => RefusingRuns['notJson']; readonly text: string }>([
    { kind: 'not valid JSON', problem: 'not valid JSON', made() { return runs().notJson }, text: '{ "name": "consumer-project",\n' },
    { kind: 'a JSON array', problem: 'not a JSON object', made() { return runs().anArray }, text: '[]\n' },
  ])('exits 2, naming the file, and writes nothing where package.json is $kind', ({ problem, made, text }) => {
    const { path, result, entries, text: textAfter } = made()

    expect({ result, entries, textAfter }).toStrictEqual({
      result: { exitCode: EXIT.couldNotRun, signal: null, stdout: '', stderr: `init: could not run: ${path}: ${problem}\n` },
      entries: [PACKAGE_JSON_FILE],
      textAfter: text,
    })
  })
})

describe('init outside a git repo', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'not a repo', files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES } })
    return { dir: project.dir, result: runInit(project.dir), entries: entriesUnder(project.dir) }
  })

  it('writes both files, notes that check needs a git repo, and exits 0', () => {
    const { dir, result, entries } = run()

    expect({ result, entries }).toStrictEqual({
      result: { exitCode: EXIT.clean, signal: null, stdout: initStdout('added', NPM), stderr: outsideGitNote(dir) },
      entries: [CONFIG_FILE, PACKAGE_JSON_FILE],
    })
  })
})

describe('the package manager init names', () => {
  const CASES = [
    { kind: 'bun.lock', lockfiles: ['bun.lock'], above: [], nested: false, repo: 'committed', expected: BUN },
    { kind: 'bun.lockb', lockfiles: ['bun.lockb'], above: [], nested: false, repo: 'committed', expected: BUN },
    { kind: 'pnpm-lock.yaml', lockfiles: ['pnpm-lock.yaml'], above: [], nested: false, repo: 'committed', expected: PNPM },
    { kind: 'yarn.lock', lockfiles: ['yarn.lock'], above: [], nested: false, repo: 'committed', expected: YARN },
    { kind: 'package-lock.json', lockfiles: ['package-lock.json'], above: [], nested: false, repo: 'committed', expected: NPM },
    { kind: 'no lockfile', lockfiles: [], above: [], nested: false, repo: 'committed', expected: NPM },
    { kind: 'yarn.lock and package-lock.json in one folder, yarn first in order', lockfiles: ['package-lock.json', 'yarn.lock'], above: [], nested: false, repo: 'committed', expected: YARN },
    { kind: 'a lockfile at the repo root, above the package', lockfiles: ['pnpm-lock.yaml'], above: [], nested: true, repo: 'committed', expected: PNPM },
    { kind: 'a lockfile in the package beside one at the repo root: the nearer wins', lockfiles: ['bun.lock', `${NESTED_PACKAGE}/package-lock.json`], above: [], nested: true, repo: 'committed', expected: NPM },
    { kind: 'a lockfile above the git top level, which it does not read', lockfiles: [], above: ['yarn.lock'], nested: false, repo: 'committed', expected: NPM },
    { kind: 'outside git, a lockfile in the folder', lockfiles: ['yarn.lock'], above: [], nested: false, repo: 'not a repo', expected: YARN },
    { kind: 'outside git, a lockfile only in the folder above', lockfiles: [], above: ['yarn.lock'], nested: false, repo: 'not a repo', expected: NPM },
  ] as const

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    CASES.map(({ kind, lockfiles, above, nested, repo }) => {
      const folder = nested ? `${NESTED_PACKAGE}/` : ''
      const project = createGitProject(tempProjects, {
        repo,
        files: {
          [`${folder}${PACKAGE_JSON_FILE}`]: PACKAGE_JSON_WITH_TYPES,
          ...Object.fromEntries(lockfiles.map((lockfile) => [lockfile, ''])),
        },
      })
      for (const lockfile of above) project.writeAbove(lockfile, '')
      return { kind, result: runInit(project.pathOf(folder)) }
    }),
  )

  it.each(CASES)('prints "$expected.install" and the $expected.runner runner: $kind', ({ kind, expected }) => {
    const made = runMadeFor(runs(), kind)

    expect({ exitCode: made.result.exitCode, stdout: made.result.stdout }).toStrictEqual({ exitCode: EXIT.clean, stdout: initStdout('added', expected) })
  })
})

// npm's own cache, where npx would install, no notice of a newer npm on stderr, and no bin of ours on PATH but the project's.
function runnerEnvFor(cache: string): Readonly<Record<string, string>> {
  return {
    npm_config_cache: cache,
    npm_config_update_notifier: 'false',
    PATH: searchPathWithoutOurBin(),
  }
}

describe('the command init names, as an agent runs it, for npm and bun', () => {
  // Both run the project's bin and never download a package of its name; with none, npx asks the registry
  // (network, as packed-install does) and installs nothing.
  const MANAGERS = [
    { kind: 'npm', runner: NPM.runner },
    { kind: 'bun', runner: BUN.runner },
  ]
  const BIN = 'node_modules/.bin/agents-inc-lint'
  const NPX_INSTALLS_UNDER = '_npx'
  // How npm and bun exit where no package or script has the name.
  const NOTHING_TO_RUN = 1
  const emptyFolder = setUpEmptyFolders()

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    // Its config committed, so check has nothing to check.
    const installed = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY) })
    installed.linkAbove(BIN, CLI_FILE)
    const notInstalled = createGitProject(tempProjects, { repo: 'committed', files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES }, linkedPackages: [] })
    return MANAGERS.map(({ kind, runner }) => {
      const npmCache = emptyFolder()
      const env = runnerEnvFor(npmCache)
      const withoutTheBin = runCommandLine(notInstalled.dir, runner, ['agents-inc-lint', 'check'], { env })
      return {
        kind,
        withTheBin: runCommandLine(installed.dir, runner, ['agents-inc-lint', 'check'], { env }),
        theBinRunDirectly: runCheck(installed.dir),
        withoutTheBin: { exitCode: withoutTheBin.exitCode, stderr: withoutTheBin.stderr, installed: entriesUnder(npmCache).some((entry) => entry.startsWith(NPX_INSTALLS_UNDER)) || notInstalled.exists('node_modules') },
      }
    })
  }, RUNS_IN_THE_BACKGROUND)

  it.each(MANAGERS)("runs our check where the bin is installed, printing what the bin prints run directly, and exits 0: $kind's $runner", ({ kind }) => {
    const { withTheBin, theBinRunDirectly } = runMadeFor(runs(), kind)

    expect(withTheBin).toStrictEqual({ ...theBinRunDirectly, exitCode: EXIT.clean })
  })

  it("exits 1 without installing anything where no bin is installed, with npm's npx --no, beside the run where one is", () => {
    const { exitCode, installed } = runMadeFor(runs(), 'npm').withoutTheBin

    expect({ exitCode, installed }).toStrictEqual({ exitCode: NOTHING_TO_RUN, installed: false })
  })

  it('exits 1 saying no script has that name where no bin is installed, with bun run, beside the run where one is', () => {
    expect(runMadeFor(runs(), 'bun').withoutTheBin).toStrictEqual({ exitCode: NOTHING_TO_RUN, stderr: 'error: Script not found "agents-inc-lint"\n', installed: false })
  })
})

describe('the @types/node note', () => {
  const CASES = [
    { kind: 'the package lists it under devDependencies', root: null, packageJson: A_PACKAGE_WITH_TYPES, above: null, nested: false, noted: false },
    { kind: 'the package lists it under dependencies', root: null, packageJson: buildInitPackageJson({ dependencies: TYPES_NODE_ENTRY }), above: null, nested: false, noted: false },
    { kind: 'the repo root lists it, above the package', root: A_PACKAGE_WITH_TYPES, packageJson: A_PACKAGE, above: null, nested: true, noted: false },
    { kind: 'no package.json lists it', root: null, packageJson: A_PACKAGE, above: null, nested: false, noted: true },
    { kind: 'only a package.json above the git top level lists it', root: null, packageJson: A_PACKAGE, above: A_PACKAGE_WITH_TYPES, nested: false, noted: true },
  ]

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    CASES.map(({ kind, root, packageJson, above, nested }) => {
      const folder = nested ? `${NESTED_PACKAGE}/` : ''
      const project = createGitProject(tempProjects, {
        repo: 'committed',
        files: {
          [`${folder}${PACKAGE_JSON_FILE}`]: npmPackageJsonText(packageJson),
          ...(root !== null && { [PACKAGE_JSON_FILE]: npmPackageJsonText(root) }),
        },
      })
      if (above !== null) project.writeAbove(PACKAGE_JSON_FILE, npmPackageJsonText(above))
      return { kind, result: runInit(project.pathOf(folder)) }
    }),
  )

  it.each(CASES)('notes it is missing only where none from the folder up to the git top level lists it: $kind', ({ kind, noted }) => {
    const made = runMadeFor(runs(), kind)

    expect({ exitCode: made.result.exitCode, stderr: made.result.stderr }).toStrictEqual({ exitCode: EXIT.clean, stderr: noted ? TYPES_NODE_NOTE : '' })
  })
})

// A name starting with two dots, as ..pkg does, is not the folder above.
describe('init in a package whose folder at the repo root is named with two leading dots: the walk up to the git top level', () => {
  const PACKAGE = '..pkg'
  const LOCKFILE = 'pnpm-lock.yaml'

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const atTheRepoRoot = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [`${PACKAGE}/${PACKAGE_JSON_FILE}`]: npmPackageJsonText(A_PACKAGE), [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES, [LOCKFILE]: '' },
    })
    const aboveTheGitTopLevel = createGitProject(tempProjects, { repo: 'committed', files: { [`${PACKAGE}/${PACKAGE_JSON_FILE}`]: npmPackageJsonText(A_PACKAGE) } })
    aboveTheGitTopLevel.writeAbove(LOCKFILE, '')
    aboveTheGitTopLevel.writeAbove(PACKAGE_JSON_FILE, PACKAGE_JSON_WITH_TYPES)
    return { atTheRepoRoot: runInit(atTheRepoRoot.pathOf(PACKAGE)), aboveTheGitTopLevel: runInit(aboveTheGitTopLevel.pathOf(PACKAGE)) }
  })

  it('reads the lockfile and the package.json listing @types/node at the repo root, above the folder', () => {
    const { exitCode, stdout, stderr } = runs().atTheRepoRoot

    expect({ exitCode, stdout, stderr }).toStrictEqual({ exitCode: EXIT.clean, stdout: initStdout('added', PNPM), stderr: '' })
  })

  it('reads neither where they are only above the git top level', () => {
    const { exitCode, stdout, stderr } = runs().aboveTheGitTopLevel

    expect({ exitCode, stdout, stderr }).toStrictEqual({ exitCode: EXIT.clean, stdout: initStdout('added', NPM), stderr: TYPES_NODE_NOTE })
  })
})

describe('the ignores init writes, in check', () => {
  // Each file fires a rule oxlint runs (no-debugger) and one ESLint runs (no-throw-literal), so each
  // is reported where nothing ignores it, `*.min.js` too, which oxlint never lints.
  const IGNORED = [
    'dist/a.js',
    'packages/x/dist/a.js',
    'build/a.js',
    'coverage/a.js',
    '.next/a.js',
    '.yarn/releases/yarn.cjs',
    'public/vendor.min.js',
    'public/mockServiceWorker.js',
    'src/routeTree.gen.ts',
    'src/schema.gen.js',
    'src/types.d.ts',
    'src/generated/a.ts',
    'src/__generated__/a.ts',
  ]
  const NEAR_MISSES = ['src/distance.ts', 'src/generated-x/a.ts']

  function writeTheFiles(project: ReturnType<typeof createGitProject>): void {
    for (const file of [...IGNORED, ...NEAR_MISSES]) project.write(file, moduleText(exportedConstant('generated'), DEBUGGER_STATEMENT, A_LITERAL_THROWN))
  }

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const initialised = createGitProject(tempProjects, { repo: 'committed', files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES } })
    const init = runInit(initialised.dir)
    writeTheFiles(initialised)
    const ignoringNothing = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES, [CONFIG_FILE]: checkConfigText(EVERY_RULESET, { ignores: [] }) },
    })
    writeTheFiles(ignoringNothing)
    return { init, withInitsIgnores: runCheck(initialised.dir), withNoIgnores: runCheck(ignoringNothing.dir) }
  })

  it("reports nothing in a file under any pattern init's ignores list, in either engine, and reports each near miss", () => {
    const { init, withInitsIgnores } = runs()

    expect({
      init: init.exitCode,
      inIgnoredFiles: IGNORED.flatMap((file) => findingsInFile(withInitsIgnores.stdout, file)),
      nearMissesUnreported: NEAR_MISSES.filter((file) => !findingsInFile(withInitsIgnores.stdout, file).includes(`${file}:2 no-debugger`)),
    }).toStrictEqual({ init: EXIT.clean, inIgnoredFiles: [], nearMissesUnreported: [] })
  })

  it('reports each of those files where the config ignores nothing, so each pattern is what keeps its file out', () => {
    const { exitCode, stdout } = runs().withNoIgnores

    expect({ exitCode, unreported: IGNORED.filter((file) => findingsInFile(stdout, file).length === 0) }).toStrictEqual({
      exitCode: EXIT.findings,
      unreported: [],
    })
  })
})

describe('init where what it prints cannot be worked out, before it writes anything', () => {
  const emptyFolder = setUpEmptyFolders()

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const brokenRoot = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_LEFT_MID_MERGE, [`${NESTED_PACKAGE}/${PACKAGE_JSON_FILE}`]: npmPackageJsonText(A_PACKAGE) },
    })
    const noGit = createGitProject(tempProjects, { repo: 'not a repo', files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES } })
    return {
      brokenRoot: {
        rootPackageJson: brokenRoot.pathOf(PACKAGE_JSON_FILE),
        result: runInit(brokenRoot.pathOf(NESTED_PACKAGE)),
        entries: entriesUnder(brokenRoot.pathOf(NESTED_PACKAGE)),
        packageJson: brokenRoot.read(`${NESTED_PACKAGE}/${PACKAGE_JSON_FILE}`),
      },
      noGit: { result: runInit(noGit.dir, { env: { PATH: emptyFolder() } }), entries: entriesUnder(noGit.dir) },
    }
  })

  it('exits 2 naming a package.json above the folder that is not valid JSON, which the @types/node note reads, and writes nothing', () => {
    const { rootPackageJson, result, entries, packageJson } = runs().brokenRoot

    expect({ result, entries, packageJson }).toStrictEqual({
      result: { exitCode: EXIT.couldNotRun, signal: null, stdout: '', stderr: `init: could not run: ${rootPackageJson}: not valid JSON\n` },
      entries: [PACKAGE_JSON_FILE],
      packageJson: npmPackageJsonText(A_PACKAGE),
    })
  })

  it('writes both files where git cannot be run, as it does outside a git repo, notes that git could not be run and check needs it, and exits 0', () => {
    const { result, entries } = runs().noGit

    expect({ result, entries }).toStrictEqual({
      result: { exitCode: EXIT.clean, signal: null, stdout: initStdout('added', NPM), stderr: GIT_COULD_NOT_RUN_NOTE },
      entries: [CONFIG_FILE, PACKAGE_JSON_FILE],
    })
  })
})

describe('init in a folder it cannot write to', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'not a repo', files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES } })
    chmodSync(project.dir, 0o555)
    const result = runInit(project.dir)
    chmodSync(project.dir, 0o755)
    return { result, entries: entriesUnder(project.dir), packageJson: project.read(PACKAGE_JSON_FILE) }
  })

  it('exits 2 naming the file it could not write, and changes nothing', () => {
    const { result, entries, packageJson } = run()

    expect({
      exitCode: result.exitCode,
      couldNotWrite: /^init: could not run: could not write (?:agents-inc\.lint\.mts|package\.json): .+\. Nothing was changed\.\n$/u.test(result.stderr),
      entries,
      packageJson,
    }).toStrictEqual({ exitCode: EXIT.couldNotRun, couldNotWrite: true, entries: [PACKAGE_JSON_FILE], packageJson: PACKAGE_JSON_WITH_TYPES })
  })
})
