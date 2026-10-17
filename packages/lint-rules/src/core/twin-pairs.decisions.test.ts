import type { Catalog } from '@workspace/rule-data'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { setUpEslintConfigOracle } from '../__tests__/eslint-config-oracle.ts'
import { pluginRegisteredUnder } from '../__tests__/eslint-config-reads.ts'
import { buildCatalog, buildEslintRoute, buildOxlintRoute, buildQualityRuleset, buildShippedRule } from '../__tests__/factories/catalog-factories.ts'
import { buildFileOverride, buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { buildProjectFacts } from '../__tests__/factories/project-facts-factories.ts'
import { oxlintEntryOfRuleFor, severityOfOxlintEntry } from '../__tests__/oxlint-config-oracle.ts'
import { buildEslintConfig } from './build-eslint-config.ts'
import { buildOxlintConfig } from './build-oxlint-config.ts'
import type { LintRulesInput } from './lint-rules-input.ts'

// Twin-pair decisions read from the agent build, which runs beside oxlint. A small catalog: no-redeclare,
// which oxlint runs, extended by typescript-eslint's.

const CORE_RULE = 'no-redeclare'
const EXTENSION = '@typescript-eslint/no-redeclare'
const CORE_SPELLINGS = ['no-redeclare', 'eslint/no-redeclare']
const TS_FILE = 'src/a.ts'
const JS_FILE = 'src/a.js'
const LEGACY_TS_FILE = 'legacy/a.ts'
const LEGACY_JS_FILE = 'legacy/a.js'
const EVERY_FILE = [LEGACY_TS_FILE, LEGACY_JS_FILE, TS_FILE, JS_FILE]
const LEGACY_FILES = ['legacy/**']
const NOT_RUN = 'not run'
// Each setting below is distinct, so an entry of either engine tells which layer and name set it.
const TAKEN_OPTION = 'builtinGlobals'
const RULESET_SETTING = ['error', { [TAKEN_OPTION]: true }] as const
const EXTENSION_SETTING = ['warn', { [TAKEN_OPTION]: false }] as const
const ENTRY_EXTENSION_SETTING = ['error', { [TAKEN_OPTION]: false }] as const

type RunningEntries = Readonly<Record<string, unknown>>

function twinCatalogShipping(shipped: 'the core rule' | 'the extension' | 'neither'): Catalog {
  const ruleset = buildShippedRule('correctness', { options: [RULESET_SETTING[1]] })
  return buildCatalog({
    rulesets: [buildQualityRuleset('correctness')],
    rules: [
      buildOxlintRoute(CORE_RULE, { oxlintName: CORE_RULE, oxlintPlugin: 'eslint', shipped: shipped === 'the core rule' ? ruleset : null }),
      buildEslintRoute(EXTENSION, { typed: false, shipped: shipped === 'the extension' ? ruleset : null }),
    ],
    coreRuleExtensions: new Map([[CORE_RULE, [EXTENSION]]]),
  })
}

// The real typescript-eslint plugin, whose rules refuse options they do not take.
const plugins = { '@typescript-eslint': pluginRegisteredUnder(eslintPlugins, '@typescript-eslint') }

/** NOT_RUN where none applies, or it is off. */
function oxlintRunningEntriesFor(given: LintRulesInput, catalog: Catalog, files: readonly string[]): RunningEntries {
  const config = buildOxlintConfig(given, catalog)
  return Object.fromEntries(
    files.map((file) => {
      const entry = oxlintEntryOfRuleFor(config, file, CORE_SPELLINGS)
      return [file, entry === undefined || severityOfOxlintEntry(entry) === 'off' ? NOT_RUN : entry]
    }),
  )
}

/** NOT_RUN where no block sets it, or it is off. */
function setUpEslintExtensionSeverities(): (given: LintRulesInput, catalog: Catalog, files: readonly string[]) => Promise<RunningEntries> {
  const { ruleSeverityFor } = setUpEslintConfigOracle()

  async function runningSeverityFor(config: Linter.Config[], file: string): Promise<string> {
    const severity = await ruleSeverityFor(config, file, EXTENSION)
    return severity === undefined || severity === 'off' ? NOT_RUN : severity
  }

  return async (given, catalog, files) => {
    const config = buildEslintConfig(given, catalog, plugins, buildProjectFacts())
    return Object.fromEntries(await Promise.all(files.map(async (file) => [file, await runningSeverityFor(config, file)] as const)))
  }
}

describe('a twin pair whose extension alone our top level states, with options oxlint takes', () => {
  const extensionAlone = buildLintRules({ quality: ['correctness'] }, { rules: { [EXTENSION]: [...EXTENSION_SETTING] } })

  it("is run by oxlint with the extension's setting on TS and JS files alike, over a ruleset shipping the core rule, which it is in force by", () => {
    expect(oxlintRunningEntriesFor(extensionAlone, twinCatalogShipping('the core rule'), [TS_FILE, JS_FILE])).toStrictEqual({
      [TS_FILE]: [...EXTENSION_SETTING],
      [JS_FILE]: [...EXTENSION_SETTING],
    })
  })

  it('is run by no core rule of oxlint, where nothing puts the core rule in force', () => {
    expect(oxlintRunningEntriesFor(extensionAlone, twinCatalogShipping('neither'), [TS_FILE, JS_FILE])).toStrictEqual({ [TS_FILE]: NOT_RUN, [JS_FILE]: NOT_RUN })
  })
})

describe('a twin pair whose core rule alone our top level states, off, over a ruleset shipping the extension', () => {
  const eslintExtensionSeveritiesFor = setUpEslintExtensionSeverities()
  const catalog = twinCatalogShipping('the extension')

  it("turns the extension off with it: ESLint runs typescript-eslint's version nowhere", async () => {
    const coreOff = buildLintRules({ quality: ['correctness'] }, { rules: { [CORE_RULE]: 'off' } })

    expect(await eslintExtensionSeveritiesFor(coreOff, catalog, [TS_FILE, JS_FILE])).toStrictEqual({ [TS_FILE]: NOT_RUN, [JS_FILE]: NOT_RUN })
  })

  it('leaves the extension the ruleset ships on in every file, where our top level states neither name', async () => {
    const neitherStated = buildLintRules({ quality: ['correctness'] })

    expect(await eslintExtensionSeveritiesFor(neitherStated, catalog, [TS_FILE, JS_FILE])).toStrictEqual({ [TS_FILE]: 'error', [JS_FILE]: 'error' })
  })
})

describe('a twin pair whose core rule alone an entry of ours states, off, where our top level runs the extension', () => {
  const eslintExtensionSeveritiesFor = setUpEslintExtensionSeverities()
  const catalog = twinCatalogShipping('the extension')

  it("turns the extension off in the entry's files, and leaves it on in the rest", async () => {
    const coreOffInAnEntry = buildLintRules({ quality: ['correctness'] }, { fileOverrides: [buildFileOverride(LEGACY_FILES, { rules: { [CORE_RULE]: 'off' } })] })

    expect(await eslintExtensionSeveritiesFor(coreOffInAnEntry, catalog, [LEGACY_TS_FILE, TS_FILE])).toStrictEqual({ [LEGACY_TS_FILE]: NOT_RUN, [TS_FILE]: 'error' })
  })
})

// The top level states the extension alone, off, so the core rule is off with it and the entry finds it in force nowhere.
describe('a twin pair whose extension alone our top level states off, over a ruleset shipping the core rule, and an entry of ours states on', () => {
  const eslintExtensionSeveritiesFor = setUpEslintExtensionSeverities()
  const catalog = twinCatalogShipping('the core rule')
  const extensionOffThenOnInAnEntry = buildLintRules(
    { quality: ['correctness'] },
    { rules: { [EXTENSION]: 'off' }, fileOverrides: [buildFileOverride(LEGACY_FILES, { rules: { [EXTENSION]: [...ENTRY_EXTENSION_SETTING] } })] },
  )

  it('is run by no core rule of oxlint, in the entry or elsewhere', () => {
    expect(oxlintRunningEntriesFor(extensionOffThenOnInAnEntry, catalog, EVERY_FILE)).toStrictEqual(Object.fromEntries(EVERY_FILE.map((file) => [file, NOT_RUN])))
  })

  it("is run by ESLint as typescript-eslint's version in the entry's files alone", async () => {
    expect(await eslintExtensionSeveritiesFor(extensionOffThenOnInAnEntry, catalog, [LEGACY_TS_FILE, TS_FILE])).toStrictEqual({ [LEGACY_TS_FILE]: 'error', [TS_FILE]: NOT_RUN })
  })
})

describe('a twin pair whose extension alone an entry of ours states, with options oxlint takes', () => {
  const entryStatingTheExtension = { fileOverrides: [buildFileOverride(LEGACY_FILES, { rules: { [EXTENSION]: [...ENTRY_EXTENSION_SETTING] } })] }

  it('is run by no core rule of oxlint in the entry, where neither the entry nor the top level runs the core rule', () => {
    expect(oxlintRunningEntriesFor(buildLintRules({}, entryStatingTheExtension), twinCatalogShipping('neither'), EVERY_FILE)).toStrictEqual(
      Object.fromEntries(EVERY_FILE.map((file) => [file, NOT_RUN])),
    )
  })

  // The core rule is in force by the entry's own ruleset alone.
  it("is run by oxlint with the entry's setting in the entry's files, where the entry's own ruleset ships the core rule, and nowhere else", () => {
    const entryListingTheCoreRuleset = buildLintRules(
      {},
      { fileOverrides: [buildFileOverride(LEGACY_FILES, { rulesets: { quality: ['correctness'] }, rules: { [EXTENSION]: [...ENTRY_EXTENSION_SETTING] } })] },
    )

    expect(oxlintRunningEntriesFor(entryListingTheCoreRuleset, twinCatalogShipping('the core rule'), EVERY_FILE)).toStrictEqual({
      [LEGACY_TS_FILE]: [...ENTRY_EXTENSION_SETTING],
      [LEGACY_JS_FILE]: [...ENTRY_EXTENSION_SETTING],
      [TS_FILE]: NOT_RUN,
      [JS_FILE]: NOT_RUN,
    })
  })

  // The top level runs oxlint's core rule on TS files alone, with the extension's setting, which puts it in force in the entry.
  it("is run by oxlint with the entry's setting in all the entry's files, where the top level runs the core rule on its TS files alone", () => {
    const topLevelRunningTheCoreOnTsFiles = buildLintRules({}, { rules: { [CORE_RULE]: 'off', [EXTENSION]: [...EXTENSION_SETTING] }, ...entryStatingTheExtension })

    expect(oxlintRunningEntriesFor(topLevelRunningTheCoreOnTsFiles, twinCatalogShipping('neither'), EVERY_FILE)).toStrictEqual({
      [LEGACY_TS_FILE]: [...ENTRY_EXTENSION_SETTING],
      [LEGACY_JS_FILE]: [...ENTRY_EXTENSION_SETTING],
      [TS_FILE]: [...EXTENSION_SETTING],
      [JS_FILE]: NOT_RUN,
    })
  })

  // The top level runs the core rule in no file, so the entry finds it in force nowhere.
  it('is run by no core rule of oxlint, where the top level states both names off', () => {
    const topLevelRunningNeither = buildLintRules({}, { rules: { [CORE_RULE]: 'off', [EXTENSION]: 'off' }, ...entryStatingTheExtension })

    expect(oxlintRunningEntriesFor(topLevelRunningNeither, twinCatalogShipping('neither'), EVERY_FILE)).toStrictEqual(
      Object.fromEntries(EVERY_FILE.map((file) => [file, NOT_RUN])),
    )
  })
})
