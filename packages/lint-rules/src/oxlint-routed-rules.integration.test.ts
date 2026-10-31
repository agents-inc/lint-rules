import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalog, type RuleRoute, routeOf } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { type EngineRun, setUpEngineRun } from './__tests__/engine-run.ts'
import { movedRules, twinnedMovedRules } from './__tests__/eslint-versions.ts'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { oxlintCodeOf } from './__tests__/oxlint-codes.ts'
import { defineLintRules } from './index.ts'

// The ESLint-fallback fixtures prove ESLint's version of each shipped oxlint-run rule; the same files prove
// oxlint's, in check's build, which runs every such rule in oxlint (an editor part beside oxlint hands
// ESLint each rule whose fix check withholds).

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/eslint-fallback', import.meta.url))
const FIXTURE_INDEX = 'fixtures.json'
const TWIN_FIXTURE_INDEX = 'twin-fixtures.json'
const WHERE_EVERY_COVER_IS_OFF = ', where every rule covering it is off'
const WHERE_SUPPRESSIONS_ARE_ALLOWED = ', where suppressions are allowed'

// In TS files oxlint's own checks report a duplicate class member, with no code in its JSON, so its rule reports nothing there (measured, oxlint 1.87).
const REPORTED_IN_TS_BY_OXLINTS_OWN_CHECKS = [{ core: 'no-dupe-class-members', message: 'Identifier `foo` has already been declared' }]

function coversOf({ shipped }: Readonly<RuleRoute>): string[] {
  if (shipped === null) return []
  return [shipped.coveredBy, shipped.coveredInOxlintBy].filter((cover) => cover !== null)
}

function isDecidedByAllowSuppressions({ shipped }: Readonly<RuleRoute>): boolean {
  return shipped !== null && 'whenSuppressions' in shipped
}

function everyCoverOfAMovedRuleOff(): Readonly<Record<string, 'off'>> {
  return Object.fromEntries(movedRules().flatMap(coversOf).map((cover) => [cover, 'off']))
}

function setUpCheckRun(fields: Parameters<typeof buildEveryRulesetLintRules>[1] = {}): EngineRun {
  return setUpEngineRun(FIXTURES_DIR, (projectDir) => defineLintRules(buildEveryRulesetLintRules(projectDir, fields)))
}

/** Parse boundary: a fixture index, rule ID to fixture file. Throws where the rule has none. */
function fixtureFileIn(indexFile: string, id: string): string {
  const index = JSON.parse(readFileSync(join(FIXTURES_DIR, indexFile), 'utf8')) as Readonly<Record<string, string>>
  const file = index[id]
  if (file === undefined) throw new Error(`${id} has no fixture in test-fixtures/eslint-fallback/${indexFile}`)
  return file
}

function oxlintDiagnosticsOn(run: EngineRun, file: string): Array<{ readonly code: string | undefined; readonly message: string }> {
  return run
    .oxlintReport()
    .diagnostics.filter((diagnostic) => diagnostic.filename === file)
    .map(({ code, message }) => ({ code, message }))
}

describe('the shipped rules oxlint runs that ESLint has a version of, as check runs them, over their ESLint-fallback fixtures', () => {
  const everyRulesetListed = setUpCheckRun()
  const everyCoverOff = setUpCheckRun({ rules: everyCoverOfAMovedRuleOff() })
  const suppressionsAllowed = setUpCheckRun({ allowSuppressions: true })

  /** The run that turns the rule on: every cover off where another rule covers it, suppressions allowed where they decide it. */
  function runProving(route: Readonly<RuleRoute>): { readonly run: EngineRun; readonly where: string } {
    if (coversOf(route).length > 0) return { run: everyCoverOff, where: WHERE_EVERY_COVER_IS_OFF }
    if (isDecidedByAllowSuppressions(route)) return { run: suppressionsAllowed, where: WHERE_SUPPRESSIONS_ARE_ALLOWED }
    return { run: everyRulesetListed, where: '' }
  }

  it('load in oxlint in each run: oxlint prints a JSON report', () => {
    expect([everyRulesetListed, everyCoverOff, suppressionsAllowed].map((run) => typeof run.oxlintReport().number_of_rules)).toStrictEqual([
      'number',
      'number',
      'number',
    ])
  })

  it.each(movedRules().map((route) => ({ id: route.id, ...runProving(route) })))('fires $id in oxlint, under its oxlint code, on its fixture$where', ({ id, run }) => {
    expect(run.oxlintCodesOn(fixtureFileIn(FIXTURE_INDEX, id))).toContain(oxlintCodeOf(id, catalog))
  })

  it('fire each core rule a current typescript-eslint rule extends in oxlint on its twin TS fixture too, but where oxlint itself reports the code', () => {
    const reportedByOxlintItself = new Set(REPORTED_IN_TS_BY_OXLINTS_OWN_CHECKS.map(({ core }) => core))
    const silent = twinnedMovedRules()
      .filter(({ core }) => !reportedByOxlintItself.has(core))
      .map(({ core }) => ({ core, file: fixtureFileIn(TWIN_FIXTURE_INDEX, core) }))
      .filter(({ core, file }) => !runProving(routeOf(core, catalog)).run.oxlintCodesOn(file).includes(oxlintCodeOf(core, catalog)))
      .map(({ core, file }) => `${core}: ${file}`)

    expect(silent).toStrictEqual([])
  })

  it.each(REPORTED_IN_TS_BY_OXLINTS_OWN_CHECKS)('reports what $core would on its twin TS fixture without a code, and nothing else there', ({ core, message }) => {
    const file = fixtureFileIn(TWIN_FIXTURE_INDEX, core)

    expect(oxlintDiagnosticsOn(runProving(routeOf(core, catalog)).run, file)).toStrictEqual([{ code: undefined, message }])
  })

  it('are left to oxlint: ESLint reports none of them, nor a twin, on its fixture', () => {
    const twinOf = new Map(twinnedMovedRules().map(({ core, twin }) => [core, twin]))
    const reportedInEslint = movedRules().flatMap((route) => {
      const file = fixtureFileIn(FIXTURE_INDEX, route.id)
      const names = new Set([route.id, ...route.eslintAliases, ...[twinOf.get(route.id)].filter((twin) => twin !== undefined)])
      return runProving(route)
        .run.eslintRuleIdsOn(file)
        .filter((ruleId) => ruleId !== null && names.has(ruleId))
        .map((ruleId) => `${file}: ${ruleId}`)
    })

    expect([...new Set(reportedInEslint)]).toStrictEqual([])
  })
})
