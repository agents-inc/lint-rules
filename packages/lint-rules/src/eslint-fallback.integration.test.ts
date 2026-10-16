import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalog, pluginPrefixOf, routeOf, type RuleRoute } from '@workspace/rule-data'
import { ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON } from '@workspace/rule-data/test-support/routed-to-eslint-for-a-reason'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { type EngineRun, setUpEngineRun } from './__tests__/engine-run.ts'
import {
  movedRules,
  oxlintOnlyRules,
  provenMovedRules,
  skippedRuleIds,
  type TwinPair,
  twinnedMovedRules,
} from './__tests__/eslint-versions.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { defineLintRules } from './index.ts'

// Without oxlint, the ESLint part takes over each shipped oxlint-run rule ESLint has a version
// of, and runs it only where its fixture fires there: a matching name is not proof (CLAUDE.md). A
// rule that cannot be proven goes on rule-data's skip list, with its reason, and is not stated.
//
// test-fixtures/eslint-fallback holds the gate's fixture for each moved rule, re-keyed by canonical
// ID in fixtures.json, with the sibling modules the import-x fixtures resolve against; its
// package.json lists no oxlint. Where the gate's fixture is silent in ESLint (react-hooks/use-memo,
// react-hooks/error-boundaries), it holds a shape measured to fire there instead. A moved core rule a current typescript-eslint rule extends runs on
// JS files only, its twin on TS files (questions.md #39): fixtures.json gives it a JS fixture, and
// twin-fixtures.json the TS fixture its twin fires on. The rules are read from the catalog and the
// plugins, never from a list kept here.
//
// A moved rule another rule covers is left out wherever its cover is on, and so is its twin (S;
// spec-core.md C2). Every ruleset listed turns each cover on, so such a rule is proven in a second
// run whose top-level rules turn each cover off, which brings it back.

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/eslint-fallback', import.meta.url))
const FIXTURE_INDEX = 'fixtures.json'
const TWIN_FIXTURE_INDEX = 'twin-fixtures.json'

// Parse boundary: the fixture indexes, rule ID to fixture file.
const fixtureFileById = JSON.parse(readFileSync(join(FIXTURES_DIR, FIXTURE_INDEX), 'utf8')) as Readonly<Record<string, string>>
const twinFixtureFileByCoreRule = JSON.parse(readFileSync(join(FIXTURES_DIR, TWIN_FIXTURE_INDEX), 'utf8')) as Readonly<
  Record<string, string>
>

const fallback = setUpEngineRun(
  FIXTURES_DIR,
  (projectDir) => defineLintRules(buildEveryRulesetLintRules(projectDir)),
  {},
  buildEditorBuild(),
)

const fallbackWithEveryCoverOff = setUpEngineRun(
  FIXTURES_DIR,
  (projectDir) => defineLintRules(buildEveryRulesetLintRules(projectDir, { rules: everyCoverOfAMovedRuleOff() })),
  {},
  buildEditorBuild(),
)

/** Whether the catalog records a rule covering the rule. */
function isCovered({ shipped }: RuleRoute): boolean {
  return shipped !== null && shipped.coveredBy !== null
}

/** Each rule covering a moved rule, turned off. */
function everyCoverOfAMovedRuleOff(): Readonly<Record<string, 'off'>> {
  return Object.fromEntries(movedRules().flatMap(({ shipped }) => (shipped === null || shipped.coveredBy === null ? [] : [[shipped.coveredBy, 'off']])))
}

/** The run that proves the moved rule: the one with every cover off where another rule covers it, the one with every ruleset listed otherwise. */
function runProving(id: string): { readonly run: EngineRun; readonly where: string } {
  return isCovered(routeOf(id, catalog)) ? { run: fallbackWithEveryCoverOff, where: ', where the rule covering it is off' } : { run: fallback, where: '' }
}

function fixtureFileOf(id: string): string {
  return fileIndexedIn(fixtureFileById, FIXTURE_INDEX, id)
}

function twinFixtureFileOf(coreRule: string): string {
  return fileIndexedIn(twinFixtureFileByCoreRule, TWIN_FIXTURE_INDEX, coreRule)
}

function fileIndexedIn(index: Readonly<Record<string, string>>, indexFile: string, id: string): string {
  const file = index[id]
  if (file === undefined) throw new Error(`${id} has no fixture in test-fixtures/eslint-fallback/${indexFile}`)
  return file
}

function fatalMessagesOn(run: EngineRun, file: string): string[] {
  return run.eslintFatalMessages().filter((message) => message.startsWith(`${file}: `))
}

/** Which of the pair ESLint ran on the file, and which it reported under, each once. */
function pairOn(run: EngineRun, file: string, { core, twin }: TwinPair): { run: string[]; fired: (string | null)[] } {
  const isOfThePair = (id: string | null): boolean => id === core || id === twin
  return {
    run: run.eslintRulesRunOn(file).filter(isOfThePair),
    fired: [...new Set(run.eslintRuleIdsOn(file).filter(isOfThePair))],
  }
}

describe('the shipped oxlint-run rules, without oxlint', () => {
  it('lack an ESLint version only under oxc, which exists only in oxlint', () => {
    expect([...new Set(oxlintOnlyRules().map(({ id }) => pluginPrefixOf(id)))].toSorted()).toStrictEqual(['oxc'])
  })
})

describe('the ESLint-fallback fixtures', () => {
  it('give every moved rule a fixture or a skip entry', () => {
    const skipped = new Set(skippedRuleIds())

    expect(
      movedRules()
        .map(({ id }) => id)
        .filter((id) => !Object.hasOwn(fixtureFileById, id) && !skipped.has(id)),
    ).toStrictEqual([])
  })

  // A rule routed to ESLint for a measured reason keeps the fixture it had as a moved rule, its proof that ESLint's version fires.
  it('are kept for moved rules, and for the rules routed to ESLint for a measured reason, only', () => {
    const kept = new Set([...movedRules().map(({ id }) => id), ...ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON])

    expect(Object.keys(fixtureFileById).filter((id) => !kept.has(id))).toStrictEqual([])
  })

  it('give a TS fixture to the twin of each moved core rule a current typescript-eslint rule extends, and of no other', () => {
    expect(Object.keys(twinFixtureFileByCoreRule).toSorted()).toStrictEqual(
      twinnedMovedRules()
        .map(({ core }) => core)
        .toSorted(),
    )
  })
})

describe('the editor ESLint part of a project whose package.json lists no oxlint, over the fixtures', () => {
  it('reports no fatal message on the fixture of any rule it runs', () => {
    const fixturesOfRulesRun = provenMovedRules().map(({ id }) => fixtureFileOf(id))

    expect(
      fallback.eslintFatalMessages().filter((message) => fixturesOfRulesRun.some((file) => message.startsWith(`${file}: `))),
    ).toStrictEqual([])
  })

  it.each(provenMovedRules().map(({ id }) => ({ id, ...runProving(id) })))('fires $id on its fixture$where', ({ id, run }) => {
    expect(run.eslintRuleIdsOn(fixtureFileOf(id))).toContain(id)
  })

  it('runs no moved rule another rule covers, nor its twin, on their fixtures: every ruleset listed turns each cover on', () => {
    const covered = provenMovedRules().filter(isCovered)
    const coveredTwins = twinnedMovedRules().filter(({ core }) => covered.some(({ id }) => id === core))
    const leftOut = new Set([...covered.map(({ id }) => id), ...coveredTwins.map(({ twin }) => twin)])
    const files = [...covered.map(({ id }) => fixtureFileOf(id)), ...coveredTwins.map(({ core }) => twinFixtureFileOf(core))]

    expect(files.flatMap((file) => fallback.eslintRulesRunOn(file).filter((id) => leftOut.has(id)).map((id) => `${file}: ${id}`))).toStrictEqual([])
  })

  it('runs no skipped rule on any fixture', () => {
    const skipped = new Set(skippedRuleIds())
    const runOnTheFixtures = [...Object.values(fixtureFileById), ...Object.values(twinFixtureFileByCoreRule)].flatMap((file) =>
      fallback.eslintRulesRunOn(file),
    )

    expect([...new Set(runOnTheFixtures.filter((id) => skipped.has(id)))]).toStrictEqual([])
  })
})

describe('each moved core rule a current typescript-eslint rule extends, in a project whose package.json lists no oxlint', () => {
  it.each(twinnedMovedRules().map((pair) => ({ ...pair, ...runProving(pair.core) })))(
    'runs $twin, and not $core, on its TS fixture$where, firing there with no fatal message',
    ({ run, ...pair }) => {
      const file = twinFixtureFileOf(pair.core)

      expect({ fatal: fatalMessagesOn(run, file), ...pairOn(run, file, pair) }).toStrictEqual({
        fatal: [],
        run: [pair.twin],
        fired: [pair.twin],
      })
    },
  )

  it.each(twinnedMovedRules().map((pair) => ({ ...pair, ...runProving(pair.core) })))(
    'runs $core, and not $twin, on its JS fixture$where, firing there with no fatal message',
    ({ run, ...pair }) => {
      const file = fixtureFileOf(pair.core)

      expect({ fatal: fatalMessagesOn(run, file), ...pairOn(run, file, pair) }).toStrictEqual({
        fatal: [],
        run: [pair.core],
        fired: [pair.core],
      })
    },
  )
})

// Where oxlint's version of a rule is measurably worse than ESLint's, ESLint runs it beside oxlint
// too (decisions.md, "Owner 2026-10-14"; spec-merge-model.md, 3.2): each fires on its fixture in our
// ESLint part, and no oxlint config we write names it.
describe('the rules routed to ESLint for a measured reason, in a project whose package.json lists oxlint', () => {
  const besideOxlint = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildEveryRulesetLintRules(projectDir)),
    { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) },
    buildEditorBuild({ teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG }),
  )
  const routedOxlintNames = new Set(catalog.oxlintRules.filter(({ id }) => ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON.includes(id)).map(({ oxlintName }) => oxlintName))

  it.each(ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON.map((id) => ({ id })))('fire $id on its fixture, in our editor ESLint part', ({ id }) => {
    expect(besideOxlint.eslintRuleIdsOn(fixtureFileOf(id))).toContain(id)
  })

  it('are named by no rule key of the oxlint config the editor part, merged, writes', () => {
    expect(ruleKeysOf(besideOxlint.emittedOxlintConfig()).filter((key) => routedOxlintNames.has(key))).toStrictEqual([])
  })

  it('are named by no rule key of the oxlint config the agent build writes', () => {
    const { oxlint } = agentConfigsOf(defineLintRules(buildEveryRulesetLintRules(besideOxlint.projectDir())))

    expect(ruleKeysOf(oxlint).filter((key) => routedOxlintNames.has(key))).toStrictEqual([])
  })
})

/** Every rule key an oxlint config states, at its root, in its overrides, and in each config it extends, once each. */
function ruleKeysOf({ rules = {}, overrides = [], extends: extended = [] }: OxlintConfig): string[] {
  const keys = [...Object.keys(rules), ...overrides.flatMap(({ rules: overrideRules = {} }) => Object.keys(overrideRules)), ...extended.flatMap(ruleKeysOf)]
  return [...new Set(keys)]
}
