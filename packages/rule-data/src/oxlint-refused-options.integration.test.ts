import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { catalog } from './catalog.ts'
import { optionKeysOxlintRefuses } from './oxlint-refused-options.ts'
import { EXTENSION_ONLY_OPTION_FIXTURES, type ExtensionOnlyOptionFixture, IMPORTED_FILE } from './__tests__/cases/extension-only-option-fixtures.ts'
import { buildOxlintConfigRunningTheRuleWith } from './__tests__/factories/oxlint-config-factories.ts'
import { printOxlintConfig } from './__tests__/oxlint-cli.ts'
import { optionListsTheSchemaTakes, optionsOnlyTheFirstSchemaTakes } from './__tests__/schema-options.ts'
import { setUpTempDir } from './__tests__/temp-dirs.ts'
import {
  type EngineReport,
  oxlintReportOn,
  schemaOfTheCoreRule,
  schemaOfTheExtension,
  type TwinPairRoutedToOxlint,
  twinPairsRoutedToOxlint,
  typescriptEslintReportOn,
} from './__tests__/twin-pair-runs.ts'

// data/oxlint-refused-options.json against the installed engines. Beside oxlint a twin pair's setting
// goes to oxlint's copy of the core rule unless the data lists its key, so oxlint must load every other
// option typescript-eslint's version takes, and an option only that version takes must change oxlint's
// report the same way or be listed. Each option list is given to oxlint one at a time.

const ENGINES_TIMEOUT_MS = 240_000
const OPTIONS_CONFIG = 'options.oxlintrc.json'
const TSCONFIG = { compilerOptions: { strict: true, module: 'esnext', target: 'es2022', moduleResolution: 'bundler', noEmit: true }, include: ['*.ts'] }

/** What oxlint made of one option list typescript-eslint's version of a twin pair takes. */
type OptionVerdict = { readonly pair: TwinPairRoutedToOxlint; readonly options: readonly unknown[]; readonly keys: readonly string[]; readonly refused: boolean }

/** The lines, or the fixed text, a report holds with the option that it does not without, and the reverse. */
type ReportChange = { readonly added: readonly string[]; readonly removed: readonly string[] }

/** How each engine's report on a fixture changed with its option: oxlint's, or its refusal to load the option. */
type FixtureOutcome = { readonly fixture: ExtensionOnlyOptionFixture; readonly typescriptEslint: ReportChange; readonly oxlint: ReportChange | 'refused' }

const TWIN_PAIRS = twinPairsRoutedToOxlint(catalog)

function pairOf(coreRule: string): TwinPairRoutedToOxlint {
  const pair = TWIN_PAIRS.find((candidate) => candidate.coreRule === coreRule)
  if (pair === undefined) throw new Error(`${coreRule} is the core rule of no twin pair oxlint runs`)
  return pair
}

function isListed(pair: TwinPairRoutedToOxlint, key: string): boolean {
  return optionKeysOxlintRefuses(pair.oxlintName).includes(key)
}

function nameOf({ coreRule, with: options }: ExtensionOnlyOptionFixture): string {
  return `${coreRule} ${JSON.stringify(options)}`
}

function changeOf(without: readonly string[], withTheOption: readonly string[]): ReportChange {
  return { added: withTheOption.filter((entry) => !without.includes(entry)), removed: without.filter((entry) => !withTheOption.includes(entry)) }
}

function oxlintChangeOf(without: EngineReport, withTheOption: EngineReport): ReportChange | 'refused' {
  if (without.outcome === 'refused') throw new Error('oxlint refused its copy of the core rule with options typescript-eslint takes without the option')
  return withTheOption.outcome === 'refused' ? 'refused' : changeOf(without.report, withTheOption.report)
}

/** Whether oxlint loads the option and changes its report as typescript-eslint does. */
function isHonoured({ typescriptEslint, oxlint }: FixtureOutcome): boolean {
  return oxlint !== 'refused' && JSON.stringify(oxlint) === JSON.stringify(typescriptEslint)
}

describe("the options typescript-eslint's version of each twin pair takes, given to oxlint's copy of the core rule, against data/oxlint-refused-options.json", () => {
  const projectDir = setUpTempDir('rule-data-oxlint-refused-options-')
  let verdicts: readonly OptionVerdict[] = []
  let outcomes: readonly FixtureOutcome[] = []

  async function verdictOf(pair: TwinPairRoutedToOxlint, options: readonly unknown[], keys: readonly string[]): Promise<OptionVerdict> {
    await writeFile(join(projectDir(), OPTIONS_CONFIG), JSON.stringify(buildOxlintConfigRunningTheRuleWith(pair.oxlintName, options, { plugins: [pair.oxlintPlugin] })))
    return { pair, options, keys, refused: printOxlintConfig(join(projectDir(), OPTIONS_CONFIG)).status === 'refused' }
  }

  async function outcomeOf(fixture: ExtensionOnlyOptionFixture, index: number): Promise<FixtureOutcome> {
    const pair = pairOf(fixture.coreRule)
    const file = `fixture-${String(index)}.ts`
    await writeFile(join(projectDir(), file), fixture.source)
    const typescriptEslint = changeOf(
      await typescriptEslintReportOn(projectDir(), pair.extension, fixture.without, file, fixture.reportOf),
      await typescriptEslintReportOn(projectDir(), pair.extension, fixture.with, file, fixture.reportOf),
    )
    const oxlint = oxlintChangeOf(
      oxlintReportOn(projectDir(), pair, fixture.without, file, fixture.source, fixture.reportOf),
      oxlintReportOn(projectDir(), pair, fixture.with, file, fixture.source, fixture.reportOf),
    )
    return { fixture, typescriptEslint, oxlint }
  }

  beforeAll(async () => {
    await writeFile(join(projectDir(), 'tsconfig.json'), JSON.stringify(TSCONFIG))
    await writeFile(join(projectDir(), IMPORTED_FILE.name), IMPORTED_FILE.source)
    const lists = TWIN_PAIRS.flatMap((pair) => optionListsTheSchemaTakes(schemaOfTheExtension(pair.extension)).map((list) => ({ pair, ...list })))
    const made: OptionVerdict[] = []
    for (const { pair, options, keys } of lists) made.push(await verdictOf(pair, options, keys))
    verdicts = made
    const fixtureOutcomes: FixtureOutcome[] = []
    for (const [index, fixture] of EXTENSION_ONLY_OPTION_FIXTURES.entries()) fixtureOutcomes.push(await outcomeOf(fixture, index))
    outcomes = fixtureOutcomes
  }, ENGINES_TIMEOUT_MS)

  it('are loaded by oxlint wherever they set no key the data lists', () => {
    expect(
      verdicts.filter(({ pair, keys, refused }) => refused && !keys.some((key) => isListed(pair, key))).map(({ pair, options }) => `${pair.coreRule} ${JSON.stringify(options)}`),
    ).toStrictEqual([])
  })

  it('are refused by oxlint, or shown not honoured by a fixture, under each key the data lists', () => {
    const refusedUnder = (pair: TwinPairRoutedToOxlint, key: string): boolean => verdicts.some((verdict) => verdict.pair === pair && verdict.refused && verdict.keys.includes(key))
    const shownNotHonoured = (pair: TwinPairRoutedToOxlint, key: string): boolean =>
      outcomes.some((outcome) => outcome.fixture.coreRule === pair.coreRule && outcome.fixture.key === key && !isHonoured(outcome))

    expect(
      TWIN_PAIRS.flatMap((pair) =>
        optionKeysOxlintRefuses(pair.oxlintName)
          .filter((key) => !refusedUnder(pair, key) && !shownNotHonoured(pair, key))
          .map((key) => `${pair.coreRule}: ${key}`),
      ),
    ).toStrictEqual([])
  })

  it("hold a fixture for each option only typescript-eslint's version of a twin pair takes, as the installed schemas say, and for no other", () => {
    const fixtureOptionsOf = (coreRule: string): string[] =>
      [...new Set(EXTENSION_ONLY_OPTION_FIXTURES.filter((fixture) => fixture.coreRule === coreRule).map(({ option }) => option))].toSorted()

    expect(Object.fromEntries(TWIN_PAIRS.map(({ coreRule }) => [coreRule, fixtureOptionsOf(coreRule)]))).toStrictEqual(
      Object.fromEntries(TWIN_PAIRS.map(({ coreRule, extension }) => [coreRule, optionsOnlyTheFirstSchemaTakes(schemaOfTheExtension(extension), schemaOfTheCoreRule(coreRule))])),
    )
  })

  it("change typescript-eslint's report on each fixture", () => {
    expect(outcomes.filter(({ typescriptEslint: { added, removed } }) => added.length === 0 && removed.length === 0).map(({ fixture }) => nameOf(fixture))).toStrictEqual([])
  })

  // An option oxlint loads but does not honour counts as refused, so the setting stays in ESLint.
  it("are honoured by oxlint on each fixture as typescript-eslint honours them, exactly where the data does not list the option's key", () => {
    expect(Object.fromEntries(outcomes.map((outcome) => [nameOf(outcome.fixture), isHonoured(outcome)]))).toStrictEqual(
      Object.fromEntries(outcomes.map(({ fixture }) => [nameOf(fixture), !isListed(pairOf(fixture.coreRule), fixture.key)])),
    )
  })
})
