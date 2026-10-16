import { chmodSync } from 'node:fs'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { describe, expect, it } from 'vitest'
import { A_LITERAL_THROWN, AN_IMPORT_BELOW_CODE, AN_IMPORT_OF_OUR_PACKAGE, NAMED_IMPORTS_OUT_OF_ORDER, NAMED_IMPORTS_SORTED, UNITS } from './__tests__/cases/check-sources.ts'
import { ESLINT_CONFIG_TEXT, OXLINT_CONFIG_TEXT } from './__tests__/cases/consumer-files-as-plan-md-shows.ts'
import { PACKAGE_JSON_EDITS, PACKAGE_JSON_LISTING_US } from './__tests__/cases/init-package-json-edits.ts'
import { autofixedFilesIn, findingsIn, findingsInFile } from './__tests__/check-output.ts'
import { importInNode, INSTALLED_TYPES_NODE, typeCheck } from './__tests__/config-file-loads.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/consumer-cli-runs.ts'
import { checkConfigText, CONFIG_FILE, DEBUGGER_STATEMENT, exportedConstant, moduleText, PACKAGE_JSON_FILE } from './__tests__/factories/check-factories.ts'
import {
  BUN,
  buildInitPackageJson,
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
import { createGitProject, entriesUnder, EXIT, gitStatusOf, runCheck, runInit, setUpEmptyFolders } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { INSTALLED_OXLINT, type TempProjects, THIS_PACKAGE } from './__tests__/temp-projects.ts'

// spec-cli.md "I: init": `agents-inc-lint init` writes agents-inc.lint.mts and adds
// @agents-inc/lint-rules to devDependencies, and changes nothing else (q-i1 to q-i9, q30a). Each
// suite runs the built bin (dist/cli.mjs) in a temp project.

allowEveryTestForParallelLoad()

const A_PACKAGE = buildInitPackageJson()
const A_PACKAGE_WITH_TYPES = buildInitPackageJson({ devDependencies: TYPES_NODE_ENTRY })
const PACKAGE_JSON_WITH_TYPES = npmPackageJsonText(A_PACKAGE_WITH_TYPES)
const CONSUMER_INSTALL = [THIS_PACKAGE, INSTALLED_OXLINT]
const NO_UNPUBLISHED_IMPORT = 'n/no-unpublished-import'
const USES_DEV_FILE = 'src/uses-dev.ts'

describe('init in a package in a git repo', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES } })
    const result = runInit(project.dir)
    return { result, config: project.readIfWritten(CONFIG_FILE), packageJson: project.read(PACKAGE_JSON_FILE), status: gitStatusOf(project) }
  })

  it("exits 0, printing the install command and the lines for the agents' instructions, and no note (q-i3, q-i5)", () => {
    expect(run().result).toStrictEqual({ exitCode: EXIT.clean, signal: null, stdout: initStdout('added', NPM), stderr: '' })
  })

  // Owner, 2026-10-15: the rulesets that sort code are opt-in, named in quality's comment with the
  // warning that they conflict with a formatter that sorts the same code.
  it('writes the agent set with every ruleset that is not opt-in, in data order, the sorting ones named only in a comment with the formatter warning, and the editor set empty (I-2, q-i6, q30a)', () => {
    expect(run().config).toBe(initConfigTextListing(initListsOfTheCatalog()))
  })

  it('adds our package to devDependencies at a caret on our version, in order (q-i4)', () => {
    expect(run().packageJson).toBe(npmPackageJsonText(buildInitPackageJson({ devDependencies: { [OUR_PACKAGE]: OUR_RANGE, ...TYPES_NODE_ENTRY } })))
  })

  it('changes exactly the two files, as git status shows (I-9)', () => {
    expect(run().status).toStrictEqual([` M ${PACKAGE_JSON_FILE}`, `?? ${CONFIG_FILE}`])
  })
})

describe('the package.json edit (I-1, I-7, q-i4)', () => {
  const EDITS = [...PACKAGE_JSON_EDITS.map((edit) => ({ ...edit, entry: 'added' as const })), ...PACKAGE_JSON_LISTING_US]

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    EDITS.map(({ kind, layout, before }) => {
      const project = createGitProject(tempProjects, { repo: 'committed', files: { [PACKAGE_JSON_FILE]: packageJsonTextIn(before, layout) } })
      const result = runInit(project.dir)
      return { kind, result, packageJson: project.read(PACKAGE_JSON_FILE), configWritten: project.exists(CONFIG_FILE) }
    }),
  )

  function runFor(kind: string): ReturnType<typeof runs>[number] {
    const found = runs().find((made) => made.kind === kind)
    if (found === undefined) throw new Error(`no init run was made for ${kind}`)
    return found
  }

  it.each(EDITS)('edits the text alone, every other byte kept: $kind', ({ kind, layout, after, entry }) => {
    const { result, packageJson, configWritten } = runFor(kind)

    expect({ exitCode: result.exitCode, firstLine: result.stdout.split('\n')[0], packageJson, configWritten }).toStrictEqual({
      exitCode: EXIT.clean,
      firstLine: initStdout(entry, NPM).split('\n')[0],
      packageJson: packageJsonTextIn(after, layout),
      configWritten: true,
    })
  })
})

describe('the file init writes, loaded (I-3, q-i9)', () => {
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

  // KNOWN GAP (an owner card, the cli review's "TypeScript 6 and the @types/node note"): TypeScript 6
  // loads no @types package its tsconfig's `compilerOptions.types` does not list, so with @types/node
  // installed, tsc 6.0.3 still reports TS2339 on import.meta.dirname (measured). Whether init's note
  // also names `"types": ["node"]`, or the file init writes references the types itself, waits on
  // the owner. Flip to `it` once that lands.
  it.fails('type-checks with tsc in a project that has @types/node', () => {
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

describe('check right after init, the config untracked (I-4, X6)', () => {
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
  const PUBLISHED_VARIANTS_A_TSCONFIG_TAKES_IN = [
    { kind: 'published, tsconfig including it, an opt-in comment, @types/node', isPrivate: false, includesConfig: true, optInComment: true, typesNode: true },
    { kind: 'published, tsconfig including it, an opt-in comment, no @types/node', isPrivate: false, includesConfig: true, optInComment: true, typesNode: false },
  ]
  const PUBLISHED_VARIANTS = [...PUBLISHED_VARIANTS_NO_TSCONFIG_TAKES_IN, ...PUBLISHED_VARIANTS_A_TSCONFIG_TAKES_IN]
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

  function checkAfterInit(kind: string): { readonly init: number | null; readonly check: number | null; readonly findings: readonly string[] } {
    const made = runs().find((variant) => variant.kind === kind)
    if (made === undefined) throw new Error(`no run was made for ${kind}`)
    return { init: made.init.exitCode, check: made.check.exitCode, findings: findingsIn(made.check.stdout) }
  }

  it.each(PRIVATE_VARIANTS_NO_TSCONFIG_TAKES_IN)('reports nothing in agents-inc.lint.mts: $kind', ({ kind }) => {
    expect(checkAfterInit(kind)).toStrictEqual({ init: EXIT.clean, check: EXIT.clean, findings: [] })
  })

  // KNOWN GAP (an owner card: plan.md Open, "Type-aware rules on agents-inc.lint.mts"): where a
  // tsconfig takes the config in, the typed rules read it (spec-core.md C9), and TypeScript 6 loads
  // no @types package the tsconfig's `types` does not list, so `import.meta.dirname` is an error type:
  // check reports `agents-inc.lint.mts:4 @typescript-eslint/no-unsafe-assignment` right after init,
  // with @types/node installed or not (measured at the cli landing, 2026-10-15).
  it.fails.each(PRIVATE_VARIANTS_A_TSCONFIG_TAKES_IN)('reports nothing in agents-inc.lint.mts: $kind', ({ kind }) => {
    expect(checkAfterInit(kind)).toStrictEqual({ init: EXIT.clean, check: EXIT.clean, findings: [] })
  })

  // In a package npm may publish, with no `"files"` field, n/no-unpublished-import leaves our config
  // file alone, though it imports our package, a devDependency (spec-cli.md X6).
  it.each(PUBLISHED_VARIANTS_NO_TSCONFIG_TAKES_IN)('reports nothing in agents-inc.lint.mts: $kind', ({ kind }) => {
    expect(checkAfterInit(kind)).toStrictEqual({ init: EXIT.clean, check: EXIT.clean, findings: [] })
  })

  // KNOWN GAP, the one above: where a tsconfig takes the config in, check reports
  // `agents-inc.lint.mts:4 @typescript-eslint/no-unsafe-assignment` right after init in a published
  // package too (measured, spec-answers2.md item 4).
  it.fails.each(PUBLISHED_VARIANTS_A_TSCONFIG_TAKES_IN)('reports nothing in agents-inc.lint.mts: $kind', ({ kind }) => {
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

describe('the sorting rulesets, opt-in: check in a project as init left it, beside one that lists them (owner, 2026-10-15)', () => {
  // Three files an agent adds: an array the program reads in order (perfectionist/sort-arrays, in
  // ordering; check withholds its fix and reports it), named imports out of order
  // (perfectionist/sort-named-imports, in import-order; check fixes them), and an import below other
  // code (import-x/first, in modules, which init lists).
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
    Object.entries(ADDED_FILES).forEach(([file, text]) => project.write(file, text))
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

  it('sorts nothing and reports no sorting where the config is as init wrote it, and still reports the import below other code', () => {
    expect(runs().asInitLeftIt).toStrictEqual({
      init: EXIT.clean,
      exitCode: EXIT.findings,
      findings: [`${FIRST_FILE}:2 import-x/first`],
      autofixed: [],
      texts: ADDED_FILES,
    })
  })

  it('sorts the imports and reports the array where the config lists both sorting rulesets, and reports the import below other code there too', () => {
    expect(runs().listingThem).toStrictEqual({
      init: EXIT.clean,
      exitCode: EXIT.findings,
      findings: [`${FIRST_FILE}:2 import-x/first`, `${UNITS_FILE}:1 perfectionist/sort-arrays`],
      autofixed: [IMPORTS_FILE],
      texts: { ...ADDED_FILES, [IMPORTS_FILE]: moduleText(...NAMED_IMPORTS_SORTED) },
    })
  })
})

describe('init where it refuses (I-5, I-6, q-i1, q-i2)', () => {
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

  it('exits 1 and changes neither file where agents-inc.lint.mts exists (q-i1)', () => {
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

  it.each([
    { kind: 'no package.json at all', made: () => runs().noPackageJson },
    { kind: 'a package.json only in the folder above', made: () => runs().onlyAbove },
  ])('exits 2 and writes nothing where the folder has no package.json: $kind (q-i2)', ({ made }) => {
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

  it.each([
    { kind: 'not valid JSON', problem: 'not valid JSON', made: () => runs().notJson, text: '{ "name": "consumer-project",\n' },
    { kind: 'a JSON array', problem: 'not a JSON object', made: () => runs().anArray, text: '[]\n' },
  ])('exits 2, naming the file, and writes nothing where package.json is $kind (q-i2)', ({ problem, made, text }) => {
    const { path, result, entries, text: textAfter } = made()

    expect({ result, entries, textAfter }).toStrictEqual({
      result: { exitCode: EXIT.couldNotRun, signal: null, stdout: '', stderr: `init: could not run: ${path}: ${problem}\n` },
      entries: [PACKAGE_JSON_FILE],
      textAfter: text,
    })
  })
})

describe('init outside a git repo (I-8, q-i8)', () => {
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

describe('the package manager init names (I-10, q-i5)', () => {
  const NESTED = 'packages/a'
  const CASES = [
    { kind: 'bun.lock', lockfiles: ['bun.lock'], above: [], nested: false, repo: 'committed', expected: BUN },
    { kind: 'bun.lockb', lockfiles: ['bun.lockb'], above: [], nested: false, repo: 'committed', expected: BUN },
    { kind: 'pnpm-lock.yaml', lockfiles: ['pnpm-lock.yaml'], above: [], nested: false, repo: 'committed', expected: PNPM },
    { kind: 'yarn.lock', lockfiles: ['yarn.lock'], above: [], nested: false, repo: 'committed', expected: YARN },
    { kind: 'package-lock.json', lockfiles: ['package-lock.json'], above: [], nested: false, repo: 'committed', expected: NPM },
    { kind: 'no lockfile', lockfiles: [], above: [], nested: false, repo: 'committed', expected: NPM },
    { kind: 'yarn.lock and package-lock.json in one folder, yarn first in order', lockfiles: ['package-lock.json', 'yarn.lock'], above: [], nested: false, repo: 'committed', expected: YARN },
    { kind: 'a lockfile at the repo root, above the package', lockfiles: ['pnpm-lock.yaml'], above: [], nested: true, repo: 'committed', expected: PNPM },
    { kind: 'a lockfile in the package beside one at the repo root: the nearer wins', lockfiles: ['bun.lock', `${NESTED}/package-lock.json`], above: [], nested: true, repo: 'committed', expected: NPM },
    { kind: 'a lockfile above the git top level, which it does not read', lockfiles: [], above: ['yarn.lock'], nested: false, repo: 'committed', expected: NPM },
    { kind: 'outside git, a lockfile in the folder', lockfiles: ['yarn.lock'], above: [], nested: false, repo: 'not a repo', expected: YARN },
    { kind: 'outside git, a lockfile only in the folder above', lockfiles: [], above: ['yarn.lock'], nested: false, repo: 'not a repo', expected: NPM },
  ] as const

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    CASES.map(({ kind, lockfiles, above, nested, repo }) => {
      const folder = nested ? `${NESTED}/` : ''
      const project = createGitProject(tempProjects, {
        repo,
        files: {
          [`${folder}${PACKAGE_JSON_FILE}`]: PACKAGE_JSON_WITH_TYPES,
          ...Object.fromEntries(lockfiles.map((lockfile) => [lockfile, ''])),
        },
      })
      above.forEach((lockfile) => project.writeAbove(lockfile, ''))
      return { kind, result: runInit(project.pathOf(folder)) }
    }),
  )

  it.each(CASES)('prints "$expected.install" and the $expected.runner runner: $kind', ({ kind, expected }) => {
    const made = runs().find((run) => run.kind === kind)
    if (made === undefined) throw new Error(`no init run was made for ${kind}`)

    expect({ exitCode: made.result.exitCode, stdout: made.result.stdout }).toStrictEqual({ exitCode: EXIT.clean, stdout: initStdout('added', expected) })
  })
})

describe('the @types/node note (I-11, q-i9)', () => {
  const NESTED = 'packages/a'
  const CASES = [
    { kind: 'the package lists it under devDependencies', root: null, packageJson: A_PACKAGE_WITH_TYPES, above: null, nested: false, noted: false },
    { kind: 'the package lists it under dependencies', root: null, packageJson: buildInitPackageJson({ dependencies: TYPES_NODE_ENTRY }), above: null, nested: false, noted: false },
    { kind: 'the repo root lists it, above the package', root: A_PACKAGE_WITH_TYPES, packageJson: A_PACKAGE, above: null, nested: true, noted: false },
    { kind: 'no package.json lists it', root: null, packageJson: A_PACKAGE, above: null, nested: false, noted: true },
    { kind: 'only a package.json above the git top level lists it', root: null, packageJson: A_PACKAGE, above: A_PACKAGE_WITH_TYPES, nested: false, noted: true },
  ]

  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    CASES.map(({ kind, root, packageJson, above, nested }) => {
      const folder = nested ? `${NESTED}/` : ''
      const project = createGitProject(tempProjects, {
        repo: 'committed',
        files: {
          [`${folder}${PACKAGE_JSON_FILE}`]: npmPackageJsonText(packageJson),
          ...(root === null ? {} : { [PACKAGE_JSON_FILE]: npmPackageJsonText(root) }),
        },
      })
      if (above !== null) project.writeAbove(PACKAGE_JSON_FILE, npmPackageJsonText(above))
      return { kind, result: runInit(project.pathOf(folder)) }
    }),
  )

  it.each(CASES)('notes it is missing only where none from the folder up to the git top level lists it: $kind', ({ kind, noted }) => {
    const made = runs().find((run) => run.kind === kind)
    if (made === undefined) throw new Error(`no init run was made for ${kind}`)

    expect({ exitCode: made.result.exitCode, stderr: made.result.stderr }).toStrictEqual({ exitCode: EXIT.clean, stderr: noted ? TYPES_NODE_NOTE : '' })
  })
})

// q-i5 and q-i9: init reads the lockfile and @types/node from the folder up to the git top level. A
// name starting with two dots, as ..pkg does, is not the folder above.
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

describe('the ignores init writes, in check (I-12, q-i7, q77)', () => {
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
  ]
  const NEAR_MISS = 'src/distance.ts'

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const writeTheFiles = (project: ReturnType<typeof createGitProject>): void =>
      [...IGNORED, NEAR_MISS].forEach((file) => project.write(file, moduleText(exportedConstant('generated'), DEBUGGER_STATEMENT, A_LITERAL_THROWN)))
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

  it("reports nothing in a file under any pattern init's ignores list, in either engine, and reports the near miss", () => {
    const { init, withInitsIgnores } = runs()

    expect({
      init: init.exitCode,
      inIgnoredFiles: IGNORED.flatMap((file) => findingsInFile(withInitsIgnores.stdout, file)),
      nearMissReported: findingsInFile(withInitsIgnores.stdout, NEAR_MISS).includes(`${NEAR_MISS}:2 no-debugger`),
    }).toStrictEqual({ init: EXIT.clean, inIgnoredFiles: [], nearMissReported: true })
  })

  it('reports each of those files where the config ignores nothing, so each pattern is what keeps its file out', () => {
    const { exitCode, stdout } = runs().withNoIgnores

    expect({ exitCode, unreported: IGNORED.filter((file) => findingsInFile(stdout, file).length === 0) }).toStrictEqual({
      exitCode: EXIT.findings,
      unreported: [],
    })
  })
})

describe('init where what it prints cannot be worked out, before it writes anything (spec-cli.md "I: init", step 4)', () => {
  const NESTED = 'packages/a'
  const emptyFolder = setUpEmptyFolders()

  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const brokenRoot = createGitProject(tempProjects, {
      repo: 'committed',
      files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_LEFT_MID_MERGE, [`${NESTED}/${PACKAGE_JSON_FILE}`]: npmPackageJsonText(A_PACKAGE) },
    })
    const noGit = createGitProject(tempProjects, { repo: 'not a repo', files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_WITH_TYPES } })
    return {
      brokenRoot: {
        rootPackageJson: brokenRoot.pathOf(PACKAGE_JSON_FILE),
        result: runInit(brokenRoot.pathOf(NESTED)),
        entries: entriesUnder(brokenRoot.pathOf(NESTED)),
        packageJson: brokenRoot.read(`${NESTED}/${PACKAGE_JSON_FILE}`),
      },
      noGit: { dir: noGit.dir, result: runInit(noGit.dir, { env: { PATH: emptyFolder() } }), entries: entriesUnder(noGit.dir) },
    }
  })

  it('exits 2 naming a package.json above the folder that is not valid JSON, which the @types/node note reads, and writes nothing (q-i2, q-i9)', () => {
    const { rootPackageJson, result, entries, packageJson } = runs().brokenRoot

    expect({ result, entries, packageJson }).toStrictEqual({
      result: { exitCode: EXIT.couldNotRun, signal: null, stdout: '', stderr: `init: could not run: ${rootPackageJson}: not valid JSON\n` },
      entries: [PACKAGE_JSON_FILE],
      packageJson: npmPackageJsonText(A_PACKAGE),
    })
  })

  it('writes both files where git is not installed, as it does outside a git repo, notes that check needs one, and exits 0 (q-i8)', () => {
    const { dir, result, entries } = runs().noGit

    expect({ result, entries }).toStrictEqual({
      result: { exitCode: EXIT.clean, signal: null, stdout: initStdout('added', NPM), stderr: outsideGitNote(dir) },
      entries: [CONFIG_FILE, PACKAGE_JSON_FILE],
    })
  })
})

describe('init in a folder it cannot write to (I-14)', () => {
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
