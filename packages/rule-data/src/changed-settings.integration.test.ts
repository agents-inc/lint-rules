import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import {
  CHANGED_SETTING_CASES,
  DUPLICATES_LEFT_TO_THE_SPECIFIC_RULE,
  MOVED_OR_ADDED_CASES,
  PROJECT_MANIFEST,
  type RuleCase,
  STAND_IN_CASES,
  type StandInCase,
  STUB_PACKAGES,
  SUPPRESSION_AND_RENAMED_CASES,
  TYPED_PROJECT_TSCONFIG,
} from './__tests__/cases/changed-settings.ts'
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
} from './__tests__/rule-case-runs.ts'
import { setUpTempDir } from './__tests__/temp-dirs.ts'
import { type Engine, type RuleRoute, catalog, routeOf } from './catalog.ts'

// The owner's answers of 2026-10-14 changed these rules' options, files, engines and rulesets
// (docs/work/spec-data.md, D3 and D5 to D8). Each rule runs here as it ships, its settings read from
// the catalog, through the real engines: silent where the change allows the code, still reporting
// beside it. A rule oxlint runs is run in ESLint too, which runs it without oxlint.

const ENGINES_TIMEOUT_MS = 120_000
const TYPES_OF_NODE = '@types/node'
const VITEST = 'vitest'

/** Each engine's outcome on each file it read. */
type OutcomesByEngine = Readonly<Record<string, Readonly<Record<string, FileOutcome>>>>

const requireFromHere = createRequire(import.meta.url)

/** The engines that may run the rule: the one it is routed to, and ESLint, which runs an oxlint rule without oxlint. */
function enginesThatMayRun(route: RuleRoute): readonly Engine[] {
  return route.engine === 'oxlint' ? ['oxlint', 'eslint'] : ['eslint']
}

function oxlintNamesOf(route: RuleRoute): { readonly oxlintName: string; readonly oxlintPlugin: string } {
  const { oxlintName, oxlintPlugin } = route
  if (oxlintName === null || oxlintPlugin === null) throw new Error(`${route.id} is not routed to oxlint`)
  return { oxlintName, oxlintPlugin }
}

/** A case's name in its test's: the rule, and what the case covers where the rule has more than one. */
function titleOf({ rule, subject }: RuleCase): string {
  return subject === undefined ? rule : `${rule}, for ${subject},`
}

function inFolder(folder: string, files: readonly CaseFile[]): CaseFile[] {
  return files.map((file) => ({ ...file, path: `${folder}/${file.path}` }))
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

describe('the rules whose settings, engine or ruleset the owner changed on 2026-10-14, run as the catalog ships them', () => {
  const projectDir = setUpTempDir('rule-data-changed-settings-')

  async function outcomesOn(engine: Engine, route: RuleRoute, settings: RuleSettings, files: readonly CaseFile[], configFile: string): Promise<Readonly<Record<string, FileOutcome>>> {
    const read = readBy(engine, files)
    const outcomes =
      engine === 'oxlint'
        ? oxlintOutcomesOf(projectDir(), configFile, oxlintNamesOf(route), settings, read)
        : await eslintOutcomesOf(projectDir(), eslintBlocksOf(route, settings, catalog), read, { typed: route.typed })
    return Object.fromEntries(outcomes)
  }

  /** The case's rule with its shipped settings, on each engine given or each that may run it. */
  async function outcomesOfCase(folder: string, { rule, engines, silentIn, reportedIn }: RuleCase): Promise<{ readonly actual: OutcomesByEngine; readonly expected: OutcomesByEngine }> {
    const route = routeOf(rule, catalog)
    const settings = shippedSettingsOf(route)
    const silent = inFolder(folder, silentIn)
    const reported = inFolder(folder, reportedIn)
    await writeCaseFiles(projectDir(), [...silent, ...reported])
    const runOn = engines ?? enginesThatMayRun(route)
    const actual = Object.fromEntries(
      await Promise.all(
        runOn.map(async (engine): Promise<[Engine, Readonly<Record<string, FileOutcome>>]> => [
          engine,
          await outcomesOn(engine, route, settings, [...silent, ...reported], `${folder}.oxlintrc.json`),
        ]),
      ),
    )
    return { actual, expected: owedOutcomesByEngine(runOn, silent, reported) }
  }

  beforeAll(async () => {
    await mkdir(join(projectDir(), 'node_modules', '@types'), { recursive: true })
    await symlink(dirname(requireFromHere.resolve(`${TYPES_OF_NODE}/package.json`)), join(projectDir(), 'node_modules', TYPES_OF_NODE))
    await symlink(dirname(requireFromHere.resolve(`${VITEST}/package.json`)), join(projectDir(), 'node_modules', VITEST))
    await Promise.all(
      STUB_PACKAGES.map(async ({ name, declarations }) => {
        const packageDir = join(projectDir(), 'node_modules', name)
        await mkdir(packageDir, { recursive: true })
        await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name, version: '0.0.0', types: 'index.d.ts' }))
        await writeFile(join(packageDir, 'index.d.ts'), declarations)
      }),
    )
    await writeFile(join(projectDir(), 'tsconfig.json'), JSON.stringify(TYPED_PROJECT_TSCONFIG))
    await writeFile(join(projectDir(), 'package.json'), JSON.stringify(PROJECT_MANIFEST))
  })

  describe('a rule whose options or files changed', () => {
    it.each(CHANGED_SETTING_CASES.map((ruleCase, index) => ({ ...ruleCase, title: titleOf(ruleCase), folder: `changed-${String(index)}` })))(
      '$title stays silent on the code the change allows, and still reports the code beside it, on each engine that may run it',
      async ({ folder, ...ruleCase }) => {
        const { actual, expected } = await outcomesOfCase(folder, ruleCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })

  // @typescript-eslint/no-deprecated no longer reports a legacy API a more specific rule reports
  // (r2-d46), so the specific rule is the one report left.
  describe('a legacy API no-deprecated leaves to a more specific rule', () => {
    it.each(DUPLICATES_LEFT_TO_THE_SPECIFIC_RULE.map((ruleCase, index) => ({ ...ruleCase, folder: `duplicates-${String(index)}` })))(
      '$rule still reports each one',
      async ({ folder, ...ruleCase }) => {
        const { actual, expected } = await outcomesOfCase(folder, ruleCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })

  describe('a rule moved to ESLint or newly shipped', () => {
    it.each(MOVED_OR_ADDED_CASES.map((ruleCase, index) => ({ ...ruleCase, folder: `moved-${String(index)}` })))(
      '$rule fires on its code in ESLint, and stays silent beside it',
      async ({ folder, ...ruleCase }) => {
        const { actual, expected } = await outcomesOfCase(folder, ruleCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })

  describe('the blanket-suppression rule and the rules ESLint and oxlint name differently, on oxlint', () => {
    it.each(SUPPRESSION_AND_RENAMED_CASES.map((ruleCase, index) => ({ ...ruleCase, folder: `suppression-${String(index)}` })))(
      '$rule reports in oxlint exactly where the case says',
      async ({ folder, ...ruleCase }) => {
        const { actual, expected } = await outcomesOfCase(folder, ruleCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })

  // Without oxlint, ESLint states a stand-in for each of these (#55, r2-d49-51): it must report the
  // code oxlint's rule reports, and leave the code oxlint's rule leaves.
  describe('an oxlint rule ESLint has no version of, and its ESLint stand-in', () => {
    async function standInOutcomesOf(folder: string, { oxlintRule, silentIn, reportedIn }: StandInCase): Promise<{ readonly actual: OutcomesByEngine; readonly expected: OutcomesByEngine }> {
      const route = routeOf(oxlintRule, catalog)
      const standIn = catalog.eslintStandIns.get(oxlintRule)
      if (standIn === undefined) throw new Error(`no ESLint stand-in is recorded for ${oxlintRule}`)
      const silent = inFolder(folder, silentIn)
      const reported = inFolder(folder, reportedIn)
      const files = [...silent, ...reported]
      await writeCaseFiles(projectDir(), files)
      const oxlint = Object.fromEntries(oxlintOutcomesOf(projectDir(), `${folder}.oxlintrc.json`, oxlintNamesOf(route), shippedSettingsOf(route), files))
      const eslint = Object.fromEntries(await eslintOutcomesOf(projectDir(), [{ ruleId: standIn, settings: UNSHIPPED_RULE_SETTINGS }], files, { typed: false }))
      const owed = owedOutcomes(silent, reported)
      return { actual: { [oxlintRule]: oxlint, [standIn]: eslint }, expected: { [oxlintRule]: owed, [standIn]: owed } }
    }

    it.each(STAND_IN_CASES.map((standInCase, index) => ({ ...standInCase, folder: `stand-in-${String(index)}` })))(
      '$oxlintRule in oxlint and its stand-in in ESLint report the same code, and leave the same code',
      async ({ folder, ...standInCase }) => {
        const { actual, expected } = await standInOutcomesOf(folder, standInCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })
})
