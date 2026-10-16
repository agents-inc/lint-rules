import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { eslintStderrOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { type EngineRun, setUpEngineRun } from './__tests__/engine-run.ts'
import { agentsIncLintModuleTextRootedAtItsFolder, emptyTeamEslintModuleText, mergedEslintConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildConsumerLintRules, buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { relativeImportSpecifiersIn } from './__tests__/import-specifiers.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { THIS_PACKAGE } from './__tests__/temp-projects.ts'
import { defineLintRules } from './index.ts'

// #33, fix C (spec-core.md C1; spec-next-batch E-1, E-2): ESLint's import-x rules resolve
// TypeScript imports as the project does, through eslint-import-resolver-typescript given every
// tsconfig.json and jsconfig.json of the project outside node_modules and .git, and import-x's
// extensions holding the TS ones: an import written without its extension, one written with .js
// that names a TS module, the tsconfig's path aliases, a package's own aliases where the root has
// no tsconfig, and a package that ships types alone. Each probe in test-fixtures/import-x-ts fires
// only where import-x resolves the module it imports. The agent build runs the six import-x rules
// ESLint runs beside oxlint; without oxlint, ESLint runs the four oxlint-run ones q-r3 takes off the
// skip list too. A broken tsconfig.json inside node_modules is never read (E-2).

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/import-x-ts', import.meta.url))
const PACKAGE_ALIAS_FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/import-x-ts-package-alias', import.meta.url))
const NO_TSCONFIG_FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/import-x-ts-no-tsconfig', import.meta.url))
const FALLBACK_FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/eslint-fallback', import.meta.url))
const IMPORT_X = 'import-x/'
// The ruleset shipping every import-x rule here.
const MODULES = { quality: ['modules'] } as const
const TS_EXTENSION = '.ts'
const WRITTEN_WITH_AN_EXTENSION = /\.[cm]?[jt]sx?$/u

// A package shipping types alone, which the fixture's package.json lists, one it does not, and a
// tsconfig.json inside node_modules that no JSON parser reads (written here: no node_modules folder
// is kept with the fixtures).
const TYPES_ONLY_PACKAGES = {
  'node_modules/types-only/package.json': '{ "name": "types-only", "version": "1.0.0", "types": "index.d.ts" }\n',
  'node_modules/types-only/index.d.ts': 'export declare const value: number\n',
  'node_modules/types-unlisted/package.json': '{ "name": "types-unlisted", "version": "1.0.0", "types": "index.d.ts" }\n',
  'node_modules/types-unlisted/index.d.ts': 'export declare const value: number\n',
}
const BROKEN_TSCONFIG_IN_NODE_MODULES = { 'node_modules/broken/tsconfig.json': '{ "compilerOptions": { \n' }

// Given more than one tsconfig, eslint-import-resolver-typescript 4.4.5 prints this once per process
// (lib/normalize-options.js). Ours is given every tsconfig of the project, so the warning would say
// nothing a team can act on, on every run of a project with several.
const MULTIPLE_PROJECTS_WARNING =
  'Multiple projects found, consider using a single `tsconfig` with `references` to speed up, or use `noWarnOnMultipleProjects` to suppress this warning'
const TSCONFIG_OF_EACH_PACKAGE = ['packages/a/tsconfig.json', 'packages/b/tsconfig.json']
const LINT_RULES_MODULE = 'agents-inc.lint.mts'
const EMPTY_TEAM_ESLINT_MODULE = 'team.eslint.mjs'
const RESOLVER_GIVEN_PROJECTS = "import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'\ncreateTypeScriptImportResolver({ project: JSON.parse(process.argv[1]) })\n"

/** What the probes owe in the agent build: the import-x rules ESLint runs beside oxlint. */
const OWED_IN_THE_AGENT_BUILD: Readonly<Record<string, readonly string[]>> = {
  'src/extensionless.ts': ['import-x/named'],
  'src/js-to-ts.ts': ['import-x/named'],
  'src/alias.ts': ['import-x/named'],
  'src/types-only.ts': ['import-x/named'],
  'src/unlisted.ts': ['import-x/no-extraneous-dependencies'],
  'src/deep/useless.ts': ['import-x/no-useless-path-segments'],
  'packages/a/src/x.ts': ['import-x/no-relative-packages'],
  'src/cycle-a.ts': [],
  'src/cycle-b.ts': [],
  'src/self.ts': [],
  'src/named-as-default.ts': [],
  'src/namespace.ts': [],
  'src/b.ts': [],
}

/** Without oxlint, ESLint also runs the four oxlint-run rules q-r3 takes off the skip list. */
const OWED_WITHOUT_OXLINT: Readonly<Record<string, readonly string[]>> = {
  ...OWED_IN_THE_AGENT_BUILD,
  'src/cycle-a.ts': ['import-x/no-cycle'],
  'src/cycle-b.ts': ['import-x/no-cycle'],
  'src/self.ts': ['import-x/no-self-import'],
  'src/named-as-default.ts': ['import-x/no-named-as-default'],
  'src/namespace.ts': ['import-x/namespace'],
}

function definedWithModules(projectDir: string): ReturnType<typeof defineLintRules> {
  return defineLintRules(buildConsumerLintRules(projectDir, { agentRulesets: MODULES, editorRulesets: MODULES }))
}

/** Each file's import-x rules ESLint reports, once each, sorted. */
function importXRulesReportedIn(run: EngineRun, files: readonly string[]): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    files.map((file) => [file, [...new Set(run.eslintRuleIdsOn(file).filter((ruleId): ruleId is string => ruleId !== null && ruleId.startsWith(IMPORT_X)))].toSorted()]),
  )
}

describe('the import-x probes, a broken tsconfig.json in node_modules beside them, linted by the agent build', () => {
  const run = setUpEngineRun(FIXTURES_DIR, definedWithModules, { ...TYPES_ONLY_PACKAGES, ...BROKEN_TSCONFIG_IN_NODE_MODULES })

  it('raise no fatal message: the broken tsconfig.json is never read', () => {
    expect(run.eslintFatalMessages()).toStrictEqual([])
  })

  it('each draw the import-x rule ESLint runs that reports what it imports, the module resolved as TypeScript resolves it', () => {
    expect(importXRulesReportedIn(run, Object.keys(OWED_IN_THE_AGENT_BUILD))).toStrictEqual(OWED_IN_THE_AGENT_BUILD)
  })
})

describe('the import-x probes, a broken tsconfig.json in node_modules beside them, linted by the ESLint merge of a project whose package.json lists no oxlint', () => {
  const run = setUpEngineRun(FIXTURES_DIR, definedWithModules, { ...TYPES_ONLY_PACKAGES, ...BROKEN_TSCONFIG_IN_NODE_MODULES }, buildEditorBuild())

  it('raise no fatal message', () => {
    expect(run.eslintFatalMessages()).toStrictEqual([])
  })

  it('each draw the import-x rule that reports what it imports, the four ESLint takes over from oxlint included', () => {
    expect(importXRulesReportedIn(run, Object.keys(OWED_WITHOUT_OXLINT))).toStrictEqual(OWED_WITHOUT_OXLINT)
  })
})

describe("a package's own path alias, in a project whose root has no tsconfig, a broken tsconfig.json in node_modules beside it", () => {
  const run = setUpEngineRun(PACKAGE_ALIAS_FIXTURES_DIR, definedWithModules, BROKEN_TSCONFIG_IN_NODE_MODULES)

  it('resolves through the tsconfig of the package, so import-x/named reports the import, with no fatal message', () => {
    expect({ fatal: run.eslintFatalMessages(), reported: importXRulesReportedIn(run, ['packages/app/src/a.ts']) }).toStrictEqual({
      fatal: [],
      reported: { 'packages/app/src/a.ts': ['import-x/named'] },
    })
  })
})

describe('an import of a TS module written without its extension, in a project with no tsconfig', () => {
  const run = setUpEngineRun(NO_TSCONFIG_FIXTURES_DIR, definedWithModules)

  it('resolves, so import-x/named reports the import, with no fatal message', () => {
    expect({ fatal: run.eslintFatalMessages(), reported: importXRulesReportedIn(run, ['src/a.ts']) }).toStrictEqual({ fatal: [], reported: { 'src/a.ts': ['import-x/named'] } })
  })
})

describe('a project with a tsconfig in each of two packages, whose package.json lists no oxlint, linted by the ESLint CLI through the built package', () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    [LINT_RULES_MODULE]: agentsIncLintModuleTextRootedAtItsFolder(buildConsumerSettings({ agentRulesets: MODULES, editorRulesets: MODULES })),
    'eslint.config.mjs': mergedEslintConfigText(LINT_RULES_MODULE, EMPTY_TEAM_ESLINT_MODULE, NO_TEAM_OXLINT_CONFIG),
    [EMPTY_TEAM_ESLINT_MODULE]: emptyTeamEslintModuleText(),
    ...Object.fromEntries(TSCONFIG_OF_EACH_PACKAGE.map((file) => [file, JSON.stringify(buildTsconfig({ include: ['src'] }))])),
    'packages/a/src/a.ts': 'export const a = 1\n',
    'packages/b/src/b.ts': 'export const b = 2\n',
  })

  it("prints no warning of the TypeScript resolver's, which our settings give both tsconfigs", () => {
    expect(warningsOfMultipleProjectsIn(eslintStderrOf(run()))).toStrictEqual([])
  })

  // The refusal beside it: the resolver itself, given the same two tsconfigs in a Node process of
  // its own, prints the warning, so the line above is one this project would draw.
  it('where the resolver is given both tsconfigs without turning that warning off, which prints it once', () => {
    const { projectDir } = run()
    const projects = TSCONFIG_OF_EACH_PACKAGE.map((file) => join(projectDir, file))
    const { stderr } = spawnSync(process.execPath, ['--input-type=module', '--eval', RESOLVER_GIVEN_PROJECTS, JSON.stringify(projects)], { cwd: THIS_PACKAGE.dir, encoding: 'utf8' })

    expect(warningsOfMultipleProjectsIn(stderr)).toStrictEqual([MULTIPLE_PROJECTS_WARNING])
  })
})

function warningsOfMultipleProjectsIn(stderr: string): string[] {
  return stderr.split('\n').filter((line) => line === MULTIPLE_PROJECTS_WARNING)
}

// The guard #33 asked for: a fixture of an import-x rule that imports a module of the fixtures
// imports a TS one, written without its extension, so a resolver that cannot read TypeScript leaves
// the rule silent rather than passing by an import any resolver reads.
describe('the ESLint-fallback fixtures of the import-x rules', () => {
  // Parse boundary: the fixture index, rule ID to fixture file.
  const fixtureFileById = JSON.parse(readFileSync(join(FALLBACK_FIXTURES_DIR, 'fixtures.json'), 'utf8')) as Readonly<Record<string, string>>
  const importXFixtures = Object.entries(fixtureFileById).filter(([id]) => id.startsWith(IMPORT_X))

  it('import every module of the fixtures as a TS module written without its extension', () => {
    const offenders = importXFixtures.flatMap(([id, file]) =>
      relativeImportSpecifiersIn(readFileSync(join(FALLBACK_FIXTURES_DIR, file), 'utf8'), file)
        .filter((specifier) => WRITTEN_WITH_AN_EXTENSION.test(specifier) || !existsSync(join(FALLBACK_FIXTURES_DIR, dirname(file), `${specifier}${TS_EXTENSION}`)))
        .map((specifier) => `${id}: ${file} imports ${specifier}`),
    )

    expect(offenders).toStrictEqual([])
  })

  // The refusal beside it: the guard reads the imports it judges, so a fixture importing nothing passes it vacuously.
  it('hold at least one import of a module of the fixtures, in the fixture of each import-x rule that reads the module it imports', () => {
    const readingTheModule = ['import-x/default', 'import-x/named', 'import-x/namespace', 'import-x/no-cycle', 'import-x/no-named-as-default', 'import-x/no-named-as-default-member', 'import-x/no-self-import']

    expect(
      readingTheModule.filter((id) => {
        const file = fixtureFileById[id]
        return file === undefined || relativeImportSpecifiersIn(readFileSync(join(FALLBACK_FIXTURES_DIR, file), 'utf8'), file).length === 0
      }),
    ).toStrictEqual([])
  })
})
