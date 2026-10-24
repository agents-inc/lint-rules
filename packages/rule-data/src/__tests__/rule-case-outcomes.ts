import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import { beforeAll } from 'vitest'

import { type Catalog, type Engine, type RuleRoute, routeOf } from '../catalog.ts'
import { PROJECT_MANIFEST, type RuleCase, type StubPackage, STUB_PACKAGES, TYPED_PROJECT_TSCONFIG } from './cases/changed-settings.ts'
import type { StandInCase } from './cases/stand-ins.ts'
import {
  type CaseFile,
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

type CatalogParts = Readonly<Pick<Catalog, 'rules' | 'coreRuleExtensions' | 'eslintStandIns'>>

/** The rule a case runs, with the settings it ships, and the catalog that names its ESLint blocks. */
type RuleRun = { readonly route: Readonly<RuleRoute>; readonly settings: RuleSettings; readonly catalogParts: CatalogParts }

/** Where a case's files are, and the oxlint config file its run writes. */
type CaseRun = { readonly projectDir: string; readonly files: readonly CaseFile[]; readonly configFile: string }

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
  await symlink(dirname(requireFromHere.resolve(`${TYPES_OF_NODE}/package.json`)), join(projectDir, 'node_modules', TYPES_OF_NODE))
  await symlink(dirname(requireFromHere.resolve(`${VITEST}/package.json`)), join(projectDir, 'node_modules', VITEST))
  await writeStubPackages(projectDir, STUB_PACKAGES)
  await writeFile(join(projectDir, 'tsconfig.json'), JSON.stringify(TYPED_PROJECT_TSCONFIG))
  await writeFile(join(projectDir, 'package.json'), JSON.stringify(PROJECT_MANIFEST))
}

async function caseOutcomesIn(projectDir: string, folder: string, { rule, engines, silentIn, reportedIn, packages = [] }: RuleCase, catalogParts: CatalogParts): Promise<CaseOutcomes> {
  const route = routeOf(rule, catalogParts)
  const settings = shippedSettingsOf(route)
  const silent = inFolder(folder, silentIn)
  const reported = inFolder(folder, reportedIn)
  const files = [...silent, ...reported]
  await writeStubPackages(join(projectDir, folder), packages)
  await writeCaseFiles(projectDir, files)
  const runOn = engines ?? enginesThatMayRun(route)
  const actual = await outcomesByEngine(runOn, { route, settings, catalogParts }, { projectDir, files, configFile: `${folder}.oxlintrc.json` })
  return { actual, expected: owedOutcomesByEngine(runOn, silent, reported) }
}

// Without oxlint, ESLint states the stand-in for the oxlint rule: it must report, and leave, the code
// oxlint's rule does.
async function standInCaseOutcomesIn(projectDir: string, folder: string, { oxlintRule, silentIn, reportedIn }: StandInCase, catalogParts: CatalogParts): Promise<CaseOutcomes> {
  const route = routeOf(oxlintRule, catalogParts)
  const standIn = catalogParts.eslintStandIns.get(oxlintRule)
  if (standIn === undefined) throw new Error(`no ESLint stand-in is recorded for ${oxlintRule}`)
  const silent = inFolder(folder, silentIn)
  const reported = inFolder(folder, reportedIn)
  const files = [...silent, ...reported]
  await writeCaseFiles(projectDir, files)
  const oxlint = Object.fromEntries(oxlintOutcomesOf(projectDir, `${folder}.oxlintrc.json`, oxlintNamesOf(route), shippedSettingsOf(route), files))
  const eslint = Object.fromEntries(await eslintOutcomesOf(projectDir, [{ ruleId: standIn, settings: UNSHIPPED_RULE_SETTINGS }], files, { typed: false }))
  const owed = owedOutcomes(silent, reported)
  return { actual: { [oxlintRule]: oxlint, [standIn]: eslint }, expected: { [oxlintRule]: owed, [standIn]: owed } }
}

async function outcomesByEngine(engines: readonly Engine[], rule: RuleRun, run: CaseRun): Promise<OutcomesByEngine> {
  const outcomes = await Promise.all(engines.map(async (engine): Promise<[Engine, Readonly<Record<string, FileOutcome>>]> => [engine, await outcomesOn(engine, rule, run)]))
  return Object.fromEntries(outcomes)
}

async function outcomesOn(engine: Engine, { route, settings, catalogParts }: RuleRun, { projectDir, files, configFile }: CaseRun): Promise<Readonly<Record<string, FileOutcome>>> {
  const read = readBy(engine, files)
  const outcomes =
    engine === 'oxlint'
      ? oxlintOutcomesOf(projectDir, configFile, oxlintNamesOf(route), settings, read)
      : await eslintOutcomesOf(projectDir, eslintBlocksOf(route, settings, catalogParts), read, { typed: route.typed })
  return Object.fromEntries(outcomes)
}

/** The engines that may run the rule: the one it is routed to, and ESLint, which runs an oxlint rule without oxlint. */
function enginesThatMayRun({ engine }: Readonly<RuleRoute>): readonly Engine[] {
  return engine === 'oxlint' ? ['oxlint', 'eslint'] : ['eslint']
}

function oxlintNamesOf(route: Readonly<RuleRoute>): { readonly oxlintName: string; readonly oxlintPlugin: string } {
  if (route.engine !== 'oxlint') throw new Error(`${route.id} is not routed to oxlint`)
  const { oxlintName, oxlintPlugin } = route
  return { oxlintName, oxlintPlugin }
}

function inFolder(folder: string, files: readonly CaseFile[]): CaseFile[] {
  return files.map((file) => ({ ...file, path: `${folder}/${file.path}` }))
}

/** Writes each package under the folder's `node_modules`, as a package manager installs it. */
async function writeStubPackages(folder: string, packages: readonly StubPackage[]): Promise<void> {
  await Promise.all(
    packages.map(async ({ name, declarations, module }) => {
      const packageDir = join(folder, 'node_modules', name)
      await mkdir(packageDir, { recursive: true })
      await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name, version: '0.0.0', types: 'index.d.ts' }))
      await writeFile(join(packageDir, 'index.d.ts'), declarations)
      if (module !== undefined) await writeFile(join(packageDir, 'index.js'), module)
    }),
  )
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
