import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import { beforeAll } from 'vitest'

import { type Catalog, type Engine, type RuleRoute, routeOf, ruleIdsOxlintRunsTypeAware } from '../catalog.ts'
import { foundOr } from '../collections.ts'
import { writeFileCreatingItsDir } from '../write-file-creating-its-dir.ts'
import { PROJECT_MANIFEST, type RuleCase, type StubPackage, STUB_PACKAGES, TYPED_PROJECT_TSCONFIG } from './cases/changed-settings.ts'
import type { StandInCase } from './cases/stand-ins.ts'
import {
  type CaseFile,
  type CaseRun,
  type FileOutcome,
  type RuleSettings,
  UNSHIPPED_RULE_SETTINGS,
  eslintBlocksOf,
  eslintOutcomesOf,
  oxlintOutcomesOf,
  shippedSettingsOf,
  writeCaseFiles,
} from './rule-case-runs.ts'
import { setUpTempDir } from './temp-dirs.ts'

// A rule's cases proven on the real engines, as the catalog ships the rule: what each engine that may run
// it made of each file, beside what it owes there. The two are equal exactly when the case holds.

const TYPES_OF_NODE = '@types/node'
const VITEST = 'vitest'

/** Each engine's outcome on each file, by engine (or, for a stand-in case, by rule), then by path. */
type OutcomesByEngine = Readonly<Record<string, Readonly<Record<string, FileOutcome>>>>

/** What the engines made of a case's files, and what they owe there. */
type CaseOutcomes = { readonly actual: OutcomesByEngine; readonly expected: OutcomesByEngine }

type CatalogParts = Readonly<Pick<Catalog, 'rules' | 'coreRuleExtensions' | 'eslintStandIns' | 'oxlintRules'>>

type OxlintNames = { readonly oxlintName: string; readonly oxlintPlugin: string }

/** An engine a case runs on, with oxlint's version of the rule resolved before any engine runs: a refusal starts none. */
type EngineRun = { readonly engine: 'oxlint'; readonly version: OxlintNames } | { readonly engine: 'eslint' }

/** The rule a case runs, with the settings it ships, and the catalog that names its ESLint blocks. */
type RuleRun = { readonly route: Readonly<RuleRoute>; readonly settings: RuleSettings; readonly catalogParts: CatalogParts }

type RuleCaseOutcomes = {
  /** The case's rule with its shipped settings, on each engine the case names or each that may run it; its files under `folder`. */
  readonly outcomesOfCase: (folder: string, ruleCase: RuleCase) => Promise<CaseOutcomes>
  /** The case's oxlint rule in oxlint and its ESLint stand-in in ESLint, each owing the case's outcomes; its files under `folder`. */
  readonly outcomesOfStandInCase: (folder: string, standInCase: StandInCase) => Promise<CaseOutcomes>
}

const requireFromHere = createRequire(import.meta.url)

/** A case's name in its test's: the rule, and what the case covers where the rule has more than one. */
export function ruleCaseTitleOf({ rule, subject }: RuleCase): string {
  return subject === undefined ? rule : `${rule}, for ${subject},`
}

/**
 * A project the cases are written into, set up before the suite's tests: the typed fixtures' tsconfig,
 * the fixtures' manifest, Node's and Vitest's types, and the stub packages. Registers hooks: call it in a
 * describe block, and give each case a folder of its own.
 */
export function setUpRuleCaseOutcomes(catalogParts: CatalogParts): RuleCaseOutcomes {
  const projectDir = setUpTempDir('rule-data-rule-cases-')

  beforeAll(async () => {
    await writeTheProject(projectDir())
  })

  return {
    async outcomesOfCase(folder, ruleCase) {
      return caseOutcomesIn(projectDir(), folder, ruleCase, catalogParts)
    },
    async outcomesOfStandInCase(folder, standInCase) {
      return standInCaseOutcomesIn(projectDir(), folder, standInCase, catalogParts)
    },
  }
}

async function writeTheProject(projectDir: string): Promise<void> {
  await mkdir(join(projectDir, 'node_modules', '@types'), { recursive: true })
  await Promise.all([
    linkInstalledPackage(projectDir, TYPES_OF_NODE),
    linkInstalledPackage(projectDir, VITEST),
    writeStubPackages(projectDir, STUB_PACKAGES),
    writeFile(join(projectDir, 'tsconfig.json'), JSON.stringify(TYPED_PROJECT_TSCONFIG)),
    writeFile(join(projectDir, 'package.json'), JSON.stringify(PROJECT_MANIFEST)),
  ])
}

async function caseOutcomesIn(projectDir: string, folder: string, ruleCase: RuleCase, catalogParts: CatalogParts): Promise<CaseOutcomes> {
  const { rule, engines, silentIn, reportedIn } = ruleCase
  const route = routeOf(rule, catalogParts)
  const settings = shippedSettingsOf(route)
  const { silent, reported, files } = caseFilesIn(folder, silentIn, reportedIn)
  await writeCaseFolder(projectDir, folder, files, ruleCase)
  const runOn = engines ?? enginesThatMayRun(route)
  const actual = await outcomesByEngine(runOn, { route, settings, catalogParts }, { projectDir, files, configFile: `${folder}.oxlintrc.json` })
  return { actual, expected: owedOutcomesByEngine(runOn, silent, reported) }
}

// Without oxlint, ESLint states the stand-in for the oxlint rule: it must report, and leave, the code
// oxlint's rule does.
async function standInCaseOutcomesIn(projectDir: string, folder: string, { oxlintRule, silentIn, reportedIn }: StandInCase, catalogParts: CatalogParts): Promise<CaseOutcomes> {
  const route = routeOf(oxlintRule, catalogParts)
  const standIn = foundOr(catalogParts.eslintStandIns.get(oxlintRule), `no ESLint stand-in is recorded for ${oxlintRule}`)
  const { silent, reported, files } = caseFilesIn(folder, silentIn, reportedIn)
  await writeCaseFiles(projectDir, files)
  const oxlint = Object.fromEntries(oxlintOutcomesOf({ projectDir, files, configFile: `${folder}.oxlintrc.json` }, oxlintNamesOf(route), shippedSettingsOf(route)))
  const eslint = Object.fromEntries(await eslintOutcomesOf(projectDir, [{ ruleId: standIn, settings: UNSHIPPED_RULE_SETTINGS }], files, { typed: false }))
  const owed = owedOutcomes(silent, reported)
  return { actual: { [oxlintRule]: oxlint, [standIn]: eslint }, expected: { [oxlintRule]: owed, [standIn]: owed } }
}

async function outcomesByEngine(engines: readonly Engine[], rule: RuleRun, run: CaseRun): Promise<OutcomesByEngine> {
  const engineRuns = engines.map((engine) => engineRunOf(engine, rule))
  const outcomes = await Promise.all(engineRuns.map(async (engineRun): Promise<[Engine, Readonly<Record<string, FileOutcome>>]> => [engineRun.engine, await outcomesOn(engineRun, rule, run)]))
  return Object.fromEntries(outcomes)
}

function engineRunOf(engine: Engine, { route, catalogParts }: RuleRun): EngineRun {
  return engine === 'oxlint' ? { engine, version: oxlintVersionOf(route, catalogParts) } : { engine }
}

async function outcomesOn(engineRun: EngineRun, { route, settings, catalogParts }: RuleRun, { projectDir, files, configFile }: CaseRun): Promise<Readonly<Record<string, FileOutcome>>> {
  const read = readBy(engineRun.engine, files)
  if (engineRun.engine === 'oxlint') return Object.fromEntries(oxlintOutcomesOf({ projectDir, files: read, configFile }, engineRun.version, settings))
  const blocks = eslintBlocksOf(route, settings, catalogParts)
  // A moved core rule's typed extension, run on TS files in its place, needs type information there.
  const hasATypedRule = blocks.some(({ ruleId }) => routeOf(ruleId, catalogParts).typed)
  return Object.fromEntries(await eslintOutcomesOf(projectDir, blocks, read, { typed: hasATypedRule }))
}

/** The engines that may run the rule: the one it is routed to, and ESLint, which runs an oxlint rule without oxlint. */
function enginesThatMayRun({ engine }: Readonly<RuleRoute>): readonly Engine[] {
  return engine === 'oxlint' ? ['oxlint', 'eslint'] : ['eslint']
}

function oxlintVersionOf(route: Readonly<RuleRoute>, { oxlintRules }: Pick<CatalogParts, 'oxlintRules'>): OxlintNames {
  if (route.engine === 'oxlint') return oxlintNamesOf(route)
  const { oxlintName, oxlintPlugin } = foundOr(oxlintRules.find(({ id }) => id === route.id), `${route.id} has no oxlint version`)
  if (ruleIdsOxlintRunsTypeAware.has(route.id)) throw new Error(`${route.id}: oxlint runs its version only with type information`)
  return { oxlintName, oxlintPlugin }
}

function oxlintNamesOf(route: Readonly<RuleRoute>): OxlintNames {
  if (route.engine !== 'oxlint') throw new Error(`${route.id} is not routed to oxlint`)
  const { oxlintName, oxlintPlugin } = route
  return { oxlintName, oxlintPlugin }
}

/** A case's files under its folder: those it owes silence in, those it owes a finding in, and all of them. */
function caseFilesIn(folder: string, silentIn: readonly CaseFile[], reportedIn: readonly CaseFile[]): { silent: CaseFile[]; reported: CaseFile[]; files: CaseFile[] } {
  const silent = inFolder(folder, silentIn)
  const reported = inFolder(folder, reportedIn)
  return { silent, reported, files: [...silent, ...reported] }
}

function inFolder(folder: string, files: readonly CaseFile[]): CaseFile[] {
  return files.map((file) => ({ ...file, path: `${folder}/${file.path}` }))
}

async function linkInstalledPackage(projectDir: string, name: string): Promise<void> {
  await symlink(dirname(requireFromHere.resolve(`${name}/package.json`)), join(projectDir, 'node_modules', name))
}

/** Writes the case's files, the packages they resolve first, and its tsconfig where it sets compiler options. */
async function writeCaseFolder(projectDir: string, folder: string, files: readonly CaseFile[], { packages = [], compilerOptions }: Pick<RuleCase, 'packages' | 'compilerOptions'>): Promise<void> {
  await Promise.all([
    writeCaseFiles(projectDir, files),
    writeStubPackages(join(projectDir, folder), packages),
    ...(compilerOptions === undefined ? [] : [writeFolderTsconfig(join(projectDir, folder), compilerOptions)]),
  ])
}

/** TypeScript gives each file the nearest tsconfig, so the folder's files are typed by this one, not the project's. */
async function writeFolderTsconfig(folder: string, compilerOptions: Readonly<Record<string, unknown>>): Promise<void> {
  const tsconfig = { ...TYPED_PROJECT_TSCONFIG, compilerOptions: { ...TYPED_PROJECT_TSCONFIG.compilerOptions, ...compilerOptions } }
  await writeFileCreatingItsDir(join(folder, 'tsconfig.json'), JSON.stringify(tsconfig))
}

/** Writes each package under the folder's `node_modules`, as a package manager installs it. */
async function writeStubPackages(folder: string, packages: readonly StubPackage[]): Promise<void> {
  await Promise.all(packages.map(async (stubPackage) => writeStubPackage(join(folder, 'node_modules', stubPackage.name), stubPackage)))
}

async function writeStubPackage(packageDir: string, { name, declarations, module }: StubPackage): Promise<void> {
  await mkdir(packageDir, { recursive: true })
  await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name, version: '0.0.0', types: 'index.d.ts' }))
  await writeFile(join(packageDir, 'index.d.ts'), declarations)
  if (module !== undefined) await writeFile(join(packageDir, 'index.js'), module)
}

function readBy(engine: Engine, files: readonly CaseFile[]): CaseFile[] {
  return files.filter(({ onlyIn }) => onlyIn === undefined || onlyIn === engine)
}

/** What an engine owes: silence in the files the case allows, a finding in the others. */
function owedOutcomes(silentIn: readonly CaseFile[], reportedIn: readonly CaseFile[]): Readonly<Record<string, FileOutcome>> {
  return Object.fromEntries([
    ...silentIn.map(({ path }): [string, FileOutcome] => [path, 'silent']),
    ...reportedIn.map(({ path }): [string, FileOutcome] => [path, 'reports']),
  ])
}

function owedOutcomesByEngine(engines: readonly Engine[], silentIn: readonly CaseFile[], reportedIn: readonly CaseFile[]): OutcomesByEngine {
  return Object.fromEntries(engines.map((engine) => [engine, owedOutcomes(readBy(engine, silentIn), readBy(engine, reportedIn))]))
}
