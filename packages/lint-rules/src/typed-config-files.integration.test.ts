import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { IMPORTED_ONLY_LAYOUT, TSCONFIG_LAYOUTS } from './__tests__/cases/tsconfig-layouts.ts'
import { eslintFatalMessagesOf, eslintReportOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { describeFinding, eslintFindingsIn, fatalMessagesIn } from './__tests__/engine-clis.ts'
import { type EslintBuild, type EslintRunsInItsOwnProcess, ruleIdsOn, rulesRunOn, setUpEslintRunsInItsOwnProcess } from './__tests__/eslint-in-its-own-process.ts'
import { buildConsumerLintRules, buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { configFileText } from './__tests__/factories/tsconfig-layout-factories.ts'
import { buildTsconfig, buildTsconfigListingNodeTypes } from './__tests__/factories/tsconfig-factories.ts'
import { INSTALLED_OXLINT, installedPackage, type ProjectFiles, THIS_PACKAGE } from './__tests__/temp-projects.ts'

// typed-config-files (spec-core.md C9): where the type information is ours, agents-inc.lint.mts and
// oxlint.config.mts at tsconfigRootDir get the typed rules through the tsconfig that takes them in,
// with no fatal parse error whatever the tsconfig shape. oxlint.config.mts imports
// agents-inc.lint.mts, so where a tsconfig takes in the importer alone, the project service finds
// the imported file through it (D-h), and it gets them too.
//
// KNOWN GAP: where no tsconfig takes them in, the two files get no typed rule, as any other TS file
// outside every tsconfig, though typed-config-files owes them the typed rules there too.
// typescript-eslint's default project, which gave them the rules, is set up once per process by the
// first config it parses: one ESLint process linting several projects, a monorepo's root run or an
// editor's ESLint server, then failed every project whose files differed from the first's in
// whether a tsconfig takes them in, with a fatal parse error. A tsconfig we ship as the default
// project keeps that fatal error, in both orders, under TypeScript 6.0 and 5.9 (measured on the
// packed package, 2026-10-15). So the default project is left out (review option (a), Must Fix 1),
// and each test owing the typed rules there is pinned with it.fails until the owner decides.
//
// Each project is linted in a process of its own, by the agent build and by the ESLint merge, ESLint
// run from tsconfigRootDir as a consumer runs it: every project in one process would share the
// first's project service. The last suite lints two projects in one process on purpose.

const CONSUMER_FILES_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files', import.meta.url))
const LINT_RULES_FILE = 'agents-inc.lint.mts'
const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
const ESLINT_CONFIG_FILE = 'eslint.config.mjs'
const TS_FILES_WE_HAVE_A_CONSUMER_WRITE = [LINT_RULES_FILE, OXLINT_CONFIG_FILE]
const FLOATING_PROMISES = '@typescript-eslint/no-floating-promises'
const FLOATING_PROMISE = 'Promise.resolve(1)\n'
const SOURCE_WITH_A_FLOATING_PROMISE = 'src/a.ts'
const TYPES_OF_NODE = installedPackage('@types/node')
const NESTED_PACKAGE = 'packages/app'
const BUILDS: readonly EslintBuild[] = ['agent', 'editor']
// The ruleset shipping no-floating-promises.
const CORRECTNESS = { quality: ['correctness'] } as const

/** A project's files beside the consumer's, the folder the consumer gives as tsconfigRootDir, and the consumer files the typed rules owe (relative to it). */
type ConsumerFilesLayout = {
  readonly shape: string
  readonly files: ProjectFiles
  readonly tsconfigRootDir: string
  /** Whether a tsconfig takes in the two files at tsconfigRootDir, itself or through the one importing the other. */
  readonly takesInTheTwo: boolean
  /** Nested packages' consumer files, relative to tsconfigRootDir, that no tsconfig takes in: untyped. */
  readonly untypedConsumerFiles: readonly string[]
}

/** The consumer file's text as plan.md gives it, with a floating promise planted on its last line. */
function withAFloatingPromise(file: string): string {
  return `${readFileSync(join(CONSUMER_FILES_DIR, file), 'utf8')}${FLOATING_PROMISE}`
}

/** The line the floating promise is planted on: the one after the plan.md text, which ends with a newline. */
function floatingPromiseLineOf(file: string): number {
  return readFileSync(join(CONSUMER_FILES_DIR, file), 'utf8').split('\n').length
}

/** The consumer's three files under the folder given, each TS one with its floating promise, and a package.json listing no oxlint. */
function consumerFilesUnder(folder: string): ProjectFiles {
  const under = (file: string): string => (folder === '.' ? file : `${folder}/${file}`)
  return {
    [under('package.json')]: packageJsonText(buildPackageJsonListingOthers()),
    [under(LINT_RULES_FILE)]: withAFloatingPromise(LINT_RULES_FILE),
    [under(OXLINT_CONFIG_FILE)]: withAFloatingPromise(OXLINT_CONFIG_FILE),
    [under(ESLINT_CONFIG_FILE)]: readFileSync(join(CONSUMER_FILES_DIR, ESLINT_CONFIG_FILE), 'utf8'),
  }
}

const LAYOUTS: readonly ConsumerFilesLayout[] = [
  ...TSCONFIG_LAYOUTS.map(({ shape, files, tsconfigRootDir, takesInTsFilesAtTsconfigRootDir }) => ({
    shape,
    files,
    tsconfigRootDir,
    takesInTheTwo: takesInTsFilesAtTsconfigRootDir,
    untypedConsumerFiles: [],
  })),
  {
    shape: "D-h's layout: a TS file no tsconfig lists, imported by one a tsconfig does",
    files: IMPORTED_ONLY_LAYOUT.files,
    tsconfigRootDir: IMPORTED_ONLY_LAYOUT.tsconfigRootDir,
    takesInTheTwo: false,
    untypedConsumerFiles: [],
  },
  { shape: '(a) a root tsconfig.json taking every TS file in, the two included', files: { 'tsconfig.json': configFileText() }, tsconfigRootDir: '.', takesInTheTwo: true, untypedConsumerFiles: [] },
  // The imported-only trap: the project service finds agents-inc.lint.mts through oxlint.config.mts's import.
  {
    shape: '(b) a tsconfig.json listing oxlint.config.mts alone, which imports agents-inc.lint.mts',
    files: { 'tsconfig.json': configFileText({ files: [OXLINT_CONFIG_FILE] }) },
    tsconfigRootDir: '.',
    takesInTheTwo: true,
    untypedConsumerFiles: [],
  },
  { shape: '(c) no tsconfig.json at all', files: {}, tsconfigRootDir: '.', takesInTheTwo: false, untypedConsumerFiles: [] },
  {
    shape: "(d) a root tsconfig.json including src alone, beside a nested package's own consumer files, which no tsconfig takes in",
    files: { 'tsconfig.json': configFileText({ include: ['src'] }), ...consumerFilesUnder(NESTED_PACKAGE) },
    tsconfigRootDir: '.',
    takesInTheTwo: false,
    untypedConsumerFiles: [`${NESTED_PACKAGE}/${LINT_RULES_FILE}`, `${NESTED_PACKAGE}/${OXLINT_CONFIG_FILE}`],
  },
]

const OWED_IN_THE_TWO: readonly string[] = TS_FILES_WE_HAVE_A_CONSUMER_WRITE.map((file) => `${file}:${String(floatingPromiseLineOf(file))} ${FLOATING_PROMISES}`).toSorted()

/** Each finding of the typed rule on a floating promise, as `file:line rule`, sorted. */
function floatingPromisesIn({ eslint, rootDir }: EslintRunsInItsOwnProcess, build: EslintBuild): string[] {
  return eslintFindingsIn(eslint[build], rootDir)
    .filter(({ rule }) => rule === FLOATING_PROMISES)
    .map(describeFinding)
    .toSorted()
}

function isInOneOf(files: readonly string[]): (finding: string) => boolean {
  return (finding) => files.some((file) => finding.startsWith(`${file}:`))
}

describe.each(LAYOUTS)("the consumer's config files at tsconfigRootDir, in $shape", ({ files, tsconfigRootDir, takesInTheTwo, untypedConsumerFiles }) => {
  const runs = setUpEslintRunsInItsOwnProcess({
    project: { files: { ...files, ...consumerFilesUnder(tsconfigRootDir) }, linkedPackages: [THIS_PACKAGE, INSTALLED_OXLINT] },
    tsconfigRootDir,
    lintRulesFor: (rootDir) => buildConsumerLintRules(rootDir, { agentRulesets: CORRECTNESS, editorRulesets: CORRECTNESS }),
    teamOxlintConfig: null,
    runsTheAgentOxlintConfig: false,
  })
  // KNOWN GAP (see the top of the file): the typed rules are owed where no tsconfig takes the two in.
  // A run that failed before the suite throws in the test beside this one, which no it.fails hides.
  const itWhereATsconfigTakesThemIn = takesInTheTwo ? it : it.fails

  it.each(BUILDS)('draw no fatal message, in the %s build', (build) => {
    const { eslint, rootDir } = runs()

    expect(fatalMessagesIn(eslint[build], rootDir)).toStrictEqual([])
  })

  itWhereATsconfigTakesThemIn.each(BUILDS)('draw the typed rule on the floating promise planted in each, in the %s build', (build) => {
    expect(floatingPromisesIn(runs(), build).filter(isInOneOf(TS_FILES_WE_HAVE_A_CONSUMER_WRITE))).toStrictEqual(OWED_IN_THE_TWO)
  })

  it.each(BUILDS)("draw no typed finding in a nested package's consumer files no tsconfig takes in, in the %s build", (build) => {
    expect(floatingPromisesIn(runs(), build).filter(isInOneOf(untypedConsumerFiles))).toStrictEqual([])
  })
})

// plan.md's files as it gives them, every ruleset listed, beside each tsconfig shape the consumer-files
// suite reads: the typed rules run on the two TS files and find nothing, where a tsconfig takes them
// in and @types/node is installed (spec-core.md C9).
const VERBATIM_TSCONFIGS = [
  // KNOWN GAP (see the top of the file): no typed rule runs on the two, which no tsconfig takes in.
  { includes: 'only src/, listing types: node', tsconfig: buildTsconfigListingNodeTypes({ include: ['src'] }), takesInTheTwo: false, findsNothingOn: TS_FILES_WE_HAVE_A_CONSUMER_WRITE },
  { includes: 'every TS file, listing types: node', tsconfig: buildTsconfigListingNodeTypes(), takesInTheTwo: true, findsNothingOn: TS_FILES_WE_HAVE_A_CONSUMER_WRITE },
  // KNOWN GAP, for the owner (review Must Fix 2): TypeScript 6 loads no @types package a tsconfig
  // does not list, so plan.md's `tsconfigRootDir: import.meta.dirname` is an error type, which
  // no-unsafe-assignment reports; the consumer's own tsc reports TS2339 on that line too.
  { includes: 'every TS file, listing no types', tsconfig: buildTsconfig(), takesInTheTwo: true, findsNothingOn: [OXLINT_CONFIG_FILE] },
]

function isTypedRule(ruleId: string | null): boolean {
  if (ruleId === null) return false
  const route = catalog.rules.get(ruleId)
  return route !== undefined && route.typed
}

describe.each(VERBATIM_TSCONFIGS)("plan.md's config files, beside a tsconfig that includes $includes, @types/node installed", ({ tsconfig, takesInTheTwo, findsNothingOn }) => {
  const runs = setUpEslintRunsInItsOwnProcess({
    project: { fixturesDir: CONSUMER_FILES_DIR, files: { 'tsconfig.json': JSON.stringify(tsconfig) }, linkedPackages: [THIS_PACKAGE, TYPES_OF_NODE, INSTALLED_OXLINT] },
    tsconfigRootDir: '.',
    lintRulesFor: (rootDir) => buildEveryRulesetLintRules(rootDir),
    teamOxlintConfig: {},
    runsTheAgentOxlintConfig: false,
  })
  const filesAndBuilds = TS_FILES_WE_HAVE_A_CONSUMER_WRITE.flatMap((file) => BUILDS.map((build) => ({ file, build })))
  const itWhereATsconfigTakesThemIn = takesInTheTwo ? it : it.fails

  itWhereATsconfigTakesThemIn.each(filesAndBuilds)('run the typed rules on $file, in the $build build', ({ file, build }) => {
    expect(rulesRunOn(runs(), build, file).some(isTypedRule)).toBe(true)
  })

  it.each(filesAndBuilds.filter(({ file }) => findsNothingOn.includes(file)))('draw no typed finding on $file, in the $build build', ({ file, build }) => {
    expect(ruleIdsOn(runs(), build, file).filter(isTypedRule)).toStrictEqual([])
  })

  it.fails.each(filesAndBuilds.filter(({ file }) => !findsNothingOn.includes(file)))('draw no typed finding on $file, in the $build build', ({ file, build }) => {
    expect(ruleIdsOn(runs(), build, file).filter(isTypedRule)).toStrictEqual([])
  })
})

// One ESLint process over two projects, as a monorepo linted once from its root, or an editor's
// ESLint server, lints them (review Must Fix 1): each project's own eslint.config.mjs, plan.md's, its
// own tsconfigRootDir, and a tsconfig taking its two files in or leaving them out. Neither order may
// give a fatal parse error, and each project's typed rules still run where its tsconfig takes files in.
const PROJECTS = ['packages/a', 'packages/b']
const DIRECTIONS = [
  { direction: 'the first takes its two files in and the second leaves them out', takingThemIn: 'packages/a' },
  { direction: 'the first leaves its two files out and the second takes them in', takingThemIn: 'packages/b' },
]

/** Each project's three files, a source file with a floating promise, and a tsconfig taking the two files in, or src alone. */
function monorepoFiles(takingThemIn: string): ProjectFiles {
  return Object.fromEntries(
    PROJECTS.flatMap((project) => [
      ...Object.entries(consumerFilesUnder(project)),
      [`${project}/${SOURCE_WITH_A_FLOATING_PROMISE}`, FLOATING_PROMISE],
      [`${project}/tsconfig.json`, JSON.stringify(project === takingThemIn ? buildTsconfigListingNodeTypes() : buildTsconfigListingNodeTypes({ include: ['src'] }))],
    ]),
  )
}

describe.each(DIRECTIONS)('two projects linted by one ESLint process from their monorepo root, where $direction', ({ takingThemIn }) => {
  const run = setUpConsumerEslintCliRun(monorepoFiles(takingThemIn), [TYPES_OF_NODE])
  const owed = [
    ...TS_FILES_WE_HAVE_A_CONSUMER_WRITE.map((file) => `${takingThemIn}/${file}:${String(floatingPromiseLineOf(file))} ${FLOATING_PROMISES}`),
    ...PROJECTS.map((project) => `${project}/${SOURCE_WITH_A_FLOATING_PROMISE}:1 ${FLOATING_PROMISES}`),
  ].toSorted()

  it('draws no fatal message in either', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it("draws the typed rule on each floating promise in the project whose tsconfig takes its two files in, and in each project's source", () => {
    const report = eslintReportOf(run())
    if (report.refused) throw new Error(`ESLint could not run: ${report.output}`)

    expect(report.findings.filter((finding) => owed.includes(finding))).toStrictEqual(owed)
  })
})
