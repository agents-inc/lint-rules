import type { Catalog } from '@workspace/rule-data'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { buildShippedRule } from '@workspace/rule-data/test-support/shipped-rule-factories'
import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { pluginRegisteredUnder } from '../__tests__/eslint-config-reads.ts'
import { buildCatalog, buildEslintRoute, buildOxlintRoute, buildQualityRuleset } from '../__tests__/factories/catalog-factories.ts'
import { buildFileOverride, buildLintRules, buildTwoSetFileOverride, buildTwoSetLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { lintRulesPackageVersion } from '../__tests__/factories/package-json-factories.ts'
import { setUpEslintConfigOracle } from '../__tests__/eslint-config-oracle.ts'
import { buildProjectFacts } from '../__tests__/factories/project-facts-factories.ts'
import { oxlintEntryOfRuleFor, severityOfOxlintEntry } from '../__tests__/oxlint-config-oracle.ts'
import { NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG } from '../__tests__/team-configs-of-the-other-engine.ts'
import { buildEslintConfig } from './build-eslint-config.ts'
import { buildOxlintConfig } from './build-oxlint-config.ts'
import { editorPartsOf } from './editor-parts.ts'
import type { LintRulesInput, TwoSetLintRulesInput } from './lint-rules-input.ts'
import { mergeEslintPart } from './merge-eslint-config.ts'

// Where the deciding part states only typescript-eslint's version of a twin pair, with an option oxlint's copy
// refuses, ESLint runs it on TS files and oxlint's copy is off there; JS files keep the ruleset's core rule.
// A small catalog ships no-redeclare, whose ignoreDeclarationMerge oxlint refuses.

const CORE_RULE = 'no-redeclare'
const EXTENSION = '@typescript-eslint/no-redeclare'
const CORE_SPELLINGS = ['no-redeclare', 'eslint/no-redeclare']
const REFUSED_OPTION = 'ignoreDeclarationMerge'
const TS_FILE = 'src/a.ts'
const JS_FILE = 'src/a.js'
const LEGACY_TS_FILE = 'legacy/a.ts'
const LEGACY_JS_FILE = 'legacy/a.js'
const NOT_RUN = 'not run'
const RULESET_OPTIONS = [{ builtinGlobals: true }]
// An option of no-redeclare that oxlint's copy and typescript-eslint's version both take.
const TAKEN_OPTION = 'builtinGlobals'
// typescript-eslint extends no core rule twice today, but the catalog allows it.
const SECOND_EXTENSION = 'other/no-redeclare'

const twinCatalog = buildCatalog({
  rulesets: [buildQualityRuleset('correctness')],
  rules: [
    buildOxlintRoute(CORE_RULE, { oxlintName: CORE_RULE, oxlintPlugin: 'eslint', shipped: buildShippedRule('correctness', { options: RULESET_OPTIONS }) }),
    buildEslintRoute(EXTENSION, { typed: false, shipped: null }),
  ],
  coreRuleExtensions: new Map([[CORE_RULE, [EXTENSION]]]),
})

const catalogExtendingTheCoreRuleTwice = buildCatalog({
  rulesets: [buildQualityRuleset('correctness')],
  rules: [
    buildOxlintRoute(CORE_RULE, { oxlintName: CORE_RULE, oxlintPlugin: 'eslint', shipped: buildShippedRule('correctness', { options: RULESET_OPTIONS }) }),
    buildEslintRoute(EXTENSION, { typed: false, shipped: null }),
    buildEslintRoute(SECOND_EXTENSION, { typed: false, shipped: null }),
  ],
  coreRuleExtensions: new Map([[CORE_RULE, [EXTENSION, SECOND_EXTENSION]]]),
})

/** Our rules state typescript-eslint's version alone, with an option oxlint refuses. */
const lintRules = buildLintRules({ quality: ['correctness'] }, { rules: { [EXTENSION]: ['error', { [REFUSED_OPTION]: true }] } })

// The real typescript-eslint plugin, whose rules refuse options they do not take.
const plugins = { '@typescript-eslint': pluginRegisteredUnder(eslintPlugins, '@typescript-eslint') }

/** NOT_RUN where no statement of it applies or it is off. */
function oxlintRunningEntryFor(given: LintRulesInput, file: string): unknown {
  return oxlintRunningEntryUnder(twinCatalog, given, file)
}

function oxlintRunningEntryUnder(catalog: Catalog, given: LintRulesInput, file: string): unknown {
  const entry = oxlintEntryOfRuleFor(buildOxlintConfig(given, catalog), file, CORE_SPELLINGS)
  return entry === undefined || severityOfOxlintEntry(entry) === 'off' ? NOT_RUN : entry
}

describe('a twin pair whose extension alone our top level states, with an option oxlint refuses, over a ruleset shipping the core rule', () => {
  const { ruleSeverityFor, ruleEntryFor } = setUpEslintConfigOracle()

  /** NOT_RUN where no block sets it or it is off. */
  async function runningEntryFor(config: Linter.Config[], file: string, ruleId: string): Promise<unknown> {
    const severity = await ruleSeverityFor(config, file, ruleId)
    return severity === undefined || severity === 'off' ? NOT_RUN : ruleEntryFor(config, file, ruleId)
  }

  /** ESLint fills in the default options the rule declares. */
  async function ourSettingAsEslintFillsIn(): Promise<unknown> {
    return ruleEntryFor([{ files: [TS_FILE], plugins, rules: { [EXTENSION]: ['error', { [REFUSED_OPTION]: true }] } }], TS_FILE, EXTENSION)
  }

  it("is run by oxlint on JS files alone, with the ruleset's setting, in the agent build's oxlint config", () => {
    expect({ [TS_FILE]: oxlintRunningEntryFor(lintRules, TS_FILE), [JS_FILE]: oxlintRunningEntryFor(lintRules, JS_FILE) }).toStrictEqual({
      [TS_FILE]: NOT_RUN,
      [JS_FILE]: ['error', ...RULESET_OPTIONS],
    })
  })

  it('never gives oxlint the option it refuses', () => {
    expect(JSON.stringify(buildOxlintConfig(lintRules, twinCatalog)).includes(REFUSED_OPTION)).toBe(false)
  })

  it("is run by ESLint on TS files alone, as typescript-eslint's version with our setting, in the agent build's ESLint config", async () => {
    const config = buildEslintConfig(lintRules, twinCatalog, plugins, buildProjectFacts())

    expect({
      [TS_FILE]: { core: await runningEntryFor(config, TS_FILE, CORE_RULE), extension: await runningEntryFor(config, TS_FILE, EXTENSION) },
      [JS_FILE]: { core: await runningEntryFor(config, JS_FILE, CORE_RULE), extension: await runningEntryFor(config, JS_FILE, EXTENSION) },
    }).toStrictEqual({
      [TS_FILE]: { core: NOT_RUN, extension: await ourSettingAsEslintFillsIn() },
      [JS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
    })
  })
})

// The same in an entry: its TS files go to ESLint, its JS files keep the top level's setting in oxlint.
describe('a twin pair whose extension alone an entry of ours states, with an option oxlint refuses, over a ruleset shipping the core rule', () => {
  const entryLintRules = buildLintRules(
    { quality: ['correctness'] },
    { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { [EXTENSION]: ['error', { [REFUSED_OPTION]: true }] } })] },
  )

  it("is run by oxlint everywhere but the entry's TS files, with the ruleset's setting, and never given the option it refuses", () => {
    expect({
      entries: Object.fromEntries([LEGACY_TS_FILE, LEGACY_JS_FILE, TS_FILE, JS_FILE].map((file) => [file, oxlintRunningEntryFor(entryLintRules, file)])),
      givesTheRefusedOption: JSON.stringify(buildOxlintConfig(entryLintRules, twinCatalog)).includes(REFUSED_OPTION),
    }).toStrictEqual({
      entries: { [LEGACY_TS_FILE]: NOT_RUN, [LEGACY_JS_FILE]: ['error', ...RULESET_OPTIONS], [TS_FILE]: ['error', ...RULESET_OPTIONS], [JS_FILE]: ['error', ...RULESET_OPTIONS] },
      givesTheRefusedOption: false,
    })
  })
})

// A refused key makes oxlint load none of the config, so the setting stays out of oxlint even beside a taken key.
describe('a twin pair whose extension alone our top level states, with an option holding a key oxlint refuses beside one it takes, over a ruleset shipping the core rule', () => {
  const mixedLintRules = buildLintRules({ quality: ['correctness'] }, { rules: { [EXTENSION]: ['error', { [REFUSED_OPTION]: true, [TAKEN_OPTION]: false }] } })

  it("is run by oxlint on JS files alone, with the ruleset's setting, and never given the option it refuses", () => {
    expect({
      entries: { [TS_FILE]: oxlintRunningEntryFor(mixedLintRules, TS_FILE), [JS_FILE]: oxlintRunningEntryFor(mixedLintRules, JS_FILE) },
      givesTheRefusedOption: JSON.stringify(buildOxlintConfig(mixedLintRules, twinCatalog)).includes(REFUSED_OPTION),
    }).toStrictEqual({ entries: { [TS_FILE]: NOT_RUN, [JS_FILE]: ['error', ...RULESET_OPTIONS] }, givesTheRefusedOption: false })
  })
})

// The entry states no ruleset, so the extension is the pair's only name there and the core rule takes its setting.
describe('a core rule two rules extend, the second of which alone an entry of ours states, over a ruleset shipping the core rule', () => {
  const entryOptions = [{ [TAKEN_OPTION]: false }]
  const entryLintRules = buildLintRules(
    { quality: ['correctness'] },
    { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { [SECOND_EXTENSION]: ['error', ...entryOptions] } })] },
  )

  it("is run by oxlint with the extension's setting in the entry's files, and with the ruleset's elsewhere", () => {
    expect(
      Object.fromEntries([LEGACY_TS_FILE, LEGACY_JS_FILE, TS_FILE, JS_FILE].map((file) => [file, oxlintRunningEntryUnder(catalogExtendingTheCoreRuleTwice, entryLintRules, file)])),
    ).toStrictEqual({
      [LEGACY_TS_FILE]: ['error', ...entryOptions],
      [LEGACY_JS_FILE]: ['error', ...entryOptions],
      [TS_FILE]: ['error', ...RULESET_OPTIONS],
      [JS_FILE]: ['error', ...RULESET_OPTIONS],
    })
  })
})

// Both names in one layer with different settings: TS files keep the extension's setting and JS files the core
// rule's. Each setting differs from the ruleset's, so an entry tells which layer and name set it.
type StatedSetting = readonly ['error' | 'warn', ...unknown[]]
const CORE_SETTING: StatedSetting = ['warn', { [TAKEN_OPTION]: true }]
const EXTENSION_SETTING: StatedSetting = ['error', { [TAKEN_OPTION]: false }]
const EXTENSION_SETTING_OXLINT_REFUSES: StatedSetting = ['error', { [REFUSED_OPTION]: true }]
const EVERY_FILE = [LEGACY_TS_FILE, LEGACY_JS_FILE, TS_FILE, JS_FILE]

/** NOT_RUN where none applies or it is off. */
function oxlintRunningEntriesFor(given: LintRulesInput, files: readonly string[]): Readonly<Record<string, unknown>> {
  return Object.fromEntries(files.map((file) => [file, oxlintRunningEntryFor(given, file)]))
}

/** NOT_RUN where no block sets it or it is off. */
function setUpEslintRunningEntries(): (given: LintRulesInput, files: readonly string[]) => Promise<Readonly<Record<string, unknown>>> {
  const { ruleSeverityFor, ruleEntryFor } = setUpEslintConfigOracle()

  async function runningEntryFor(config: Linter.Config[], file: string, ruleId: string): Promise<unknown> {
    const severity = await ruleSeverityFor(config, file, ruleId)
    return severity === undefined || severity === 'off' ? NOT_RUN : ruleEntryFor(config, file, ruleId)
  }

  return async (given, files) => {
    const config = buildEslintConfig(given, twinCatalog, plugins, buildProjectFacts())
    const entries = await Promise.all(
      files.map(async (file) => [file, { core: await runningEntryFor(config, file, CORE_RULE), extension: await runningEntryFor(config, file, EXTENSION) }] as const),
    )
    return Object.fromEntries(entries)
  }
}

/** In the editor ESLint part of a project listing oxlint, merged into an empty team config. */
function setUpMergedEslintRunningEntries(): (given: TwoSetLintRulesInput, files: readonly string[]) => Promise<Readonly<Record<string, unknown>>> {
  const { ruleSeverityFor, ruleEntryFor } = setUpEslintConfigOracle()

  async function runningEntryFor(config: Linter.Config[], file: string, ruleId: string): Promise<unknown> {
    const severity = await ruleSeverityFor(config, file, ruleId)
    return severity === undefined || severity === 'off' ? NOT_RUN : ruleEntryFor(config, file, ruleId)
  }

  return async (given, files) => {
    const { eslint } = editorPartsOf(given, twinCatalog, true)
    const config = mergeEslintPart([], eslint, twinCatalog, plugins, lintRulesPackageVersion(), NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG)
    const entries = await Promise.all(
      files.map(async (file) => [file, { core: await runningEntryFor(config, file, CORE_RULE), extension: await runningEntryFor(config, file, EXTENSION) }] as const),
    )
    return Object.fromEntries(entries)
  }
}

/** ESLint fills in the default options the rule declares. */
function setUpExtensionEntryAsEslintFillsIn(): (setting: StatedSetting) => Promise<unknown> {
  const { ruleEntryFor } = setUpEslintConfigOracle()
  return async ([severity, ...options]) => ruleEntryFor([{ files: [TS_FILE], plugins, rules: { [EXTENSION]: [severity, ...options] } }], TS_FILE, EXTENSION)
}

describe('a twin pair both of whose names our top level states, with settings oxlint takes, over a ruleset shipping the core rule', () => {
  const eslintRunningEntriesFor = setUpEslintRunningEntries()
  const bothNamed = buildLintRules({ quality: ['correctness'] }, { rules: { [CORE_RULE]: CORE_SETTING, [EXTENSION]: EXTENSION_SETTING } })

  it("is run by oxlint with the extension's setting on TS files and the core rule's on JS files, in the agent build's oxlint config", () => {
    expect(oxlintRunningEntriesFor(bothNamed, [TS_FILE, JS_FILE])).toStrictEqual({ [TS_FILE]: EXTENSION_SETTING, [JS_FILE]: CORE_SETTING })
  })

  it("is run by no rule of the agent build's ESLint config, oxlint running the pair in every file", async () => {
    expect(await eslintRunningEntriesFor(bothNamed, [TS_FILE, JS_FILE])).toStrictEqual({
      [TS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
      [JS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
    })
  })
})

// The name a layer states alone decides the pair in every file, so TS files take the core rule's setting.
describe('a twin pair whose core rule alone our top level states, over a ruleset shipping the core rule', () => {
  const coreAlone = buildLintRules({ quality: ['correctness'] }, { rules: { [CORE_RULE]: CORE_SETTING } })

  it("is run by oxlint with the core rule's setting on TS and JS files alike, in the agent build's oxlint config", () => {
    expect(oxlintRunningEntriesFor(coreAlone, [TS_FILE, JS_FILE])).toStrictEqual({ [TS_FILE]: CORE_SETTING, [JS_FILE]: CORE_SETTING })
  })
})

describe('a twin pair both of whose names our top level states, the extension off, over a ruleset shipping the core rule', () => {
  const eslintRunningEntriesFor = setUpEslintRunningEntries()
  const extensionOff = buildLintRules({ quality: ['correctness'] }, { rules: { [CORE_RULE]: CORE_SETTING, [EXTENSION]: 'off' } })

  it("is run by oxlint on JS files alone, with the core rule's setting, in the agent build's oxlint config", () => {
    expect(oxlintRunningEntriesFor(extensionOff, [TS_FILE, JS_FILE])).toStrictEqual({ [TS_FILE]: NOT_RUN, [JS_FILE]: CORE_SETTING })
  })

  it("is run by no rule of the agent build's ESLint config", async () => {
    expect(await eslintRunningEntriesFor(extensionOff, [TS_FILE, JS_FILE])).toStrictEqual({
      [TS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
      [JS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
    })
  })
})

// Both names stated, the core rule off: TS files take the extension's setting, which oxlint runs as the core
// rule; JS files run neither.
describe('a twin pair both of whose names our top level states, the core rule off, over a ruleset shipping the core rule', () => {
  const eslintRunningEntriesFor = setUpEslintRunningEntries()
  const coreOff = buildLintRules({ quality: ['correctness'] }, { rules: { [CORE_RULE]: 'off', [EXTENSION]: EXTENSION_SETTING } })

  it("is run by oxlint on TS files alone, with the extension's setting, in the agent build's oxlint config", () => {
    expect(oxlintRunningEntriesFor(coreOff, [TS_FILE, JS_FILE])).toStrictEqual({ [TS_FILE]: EXTENSION_SETTING, [JS_FILE]: NOT_RUN })
  })

  it("is run by no rule of the agent build's ESLint config, the JS file included", async () => {
    expect(await eslintRunningEntriesFor(coreOff, [TS_FILE, JS_FILE])).toStrictEqual({
      [TS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
      [JS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
    })
  })
})

describe('a twin pair both of whose names an entry of ours states, the core rule off, over a ruleset shipping the core rule', () => {
  const eslintRunningEntriesFor = setUpEslintRunningEntries()
  const coreOffInAnEntry = buildLintRules(
    { quality: ['correctness'] },
    { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { [CORE_RULE]: 'off', [EXTENSION]: EXTENSION_SETTING } })] },
  )

  it("is run by oxlint with the extension's setting on the entry's TS files, nowhere on its JS files, and with the ruleset's elsewhere", () => {
    expect(oxlintRunningEntriesFor(coreOffInAnEntry, EVERY_FILE)).toStrictEqual({
      [LEGACY_TS_FILE]: EXTENSION_SETTING,
      [LEGACY_JS_FILE]: NOT_RUN,
      [TS_FILE]: ['error', ...RULESET_OPTIONS],
      [JS_FILE]: ['error', ...RULESET_OPTIONS],
    })
  })

  it("is run by no rule of the agent build's ESLint config, the entry's JS file included", async () => {
    expect(await eslintRunningEntriesFor(coreOffInAnEntry, EVERY_FILE)).toStrictEqual(
      Object.fromEntries(EVERY_FILE.map((file) => [file, { core: NOT_RUN, extension: NOT_RUN }])),
    )
  })
})

// The same in the editor set beside oxlint: the merged ESLint part runs neither name anywhere.
describe('a twin pair both of whose names the editor set states, the core rule off, merged into an empty team config, in a project whose package.json lists oxlint', () => {
  const mergedEslintRunningEntriesFor = setUpMergedEslintRunningEntries()
  const CORRECTNESS = { editorRulesets: { quality: ['correctness'] } }

  it.each([
    { where: 'our top level', given: buildTwoSetLintRules(CORRECTNESS, { rules: { [CORE_RULE]: 'off', [EXTENSION]: EXTENSION_SETTING } }) },
    {
      where: 'an entry of ours',
      given: buildTwoSetLintRules(CORRECTNESS, {
        fileOverrides: [buildTwoSetFileOverride(['legacy/**'], { rules: { [CORE_RULE]: 'off', [EXTENSION]: EXTENSION_SETTING } })],
      }),
    },
  ])('is run by no rule of the merged ESLint config, where $where states both names, the JS files included', async ({ given }) => {
    expect(await mergedEslintRunningEntriesFor(given, EVERY_FILE)).toStrictEqual(
      Object.fromEntries(EVERY_FILE.map((file) => [file, { core: NOT_RUN, extension: NOT_RUN }])),
    )
  })
})

describe('a twin pair both of whose names an entry of ours states, with settings oxlint takes, over a ruleset shipping the core rule', () => {
  const eslintRunningEntriesFor = setUpEslintRunningEntries()
  const bothNamedInAnEntry = buildLintRules(
    { quality: ['correctness'] },
    { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { [CORE_RULE]: CORE_SETTING, [EXTENSION]: EXTENSION_SETTING } })] },
  )

  it("is run by oxlint with the extension's setting on the entry's TS files, the core rule's on its JS files, and the ruleset's elsewhere", () => {
    expect(oxlintRunningEntriesFor(bothNamedInAnEntry, EVERY_FILE)).toStrictEqual({
      [LEGACY_TS_FILE]: EXTENSION_SETTING,
      [LEGACY_JS_FILE]: CORE_SETTING,
      [TS_FILE]: ['error', ...RULESET_OPTIONS],
      [JS_FILE]: ['error', ...RULESET_OPTIONS],
    })
  })

  it("is run by no rule of the agent build's ESLint config, oxlint running the pair in every file", async () => {
    expect(await eslintRunningEntriesFor(bothNamedInAnEntry, EVERY_FILE)).toStrictEqual(
      Object.fromEntries(EVERY_FILE.map((file) => [file, { core: NOT_RUN, extension: NOT_RUN }])),
    )
  })
})

describe('a twin pair both of whose names our top level states, the extension with an option oxlint refuses, over a ruleset shipping the core rule', () => {
  const eslintRunningEntriesFor = setUpEslintRunningEntries()
  const extensionEntryAsEslintFillsIn = setUpExtensionEntryAsEslintFillsIn()
  const bothNamed = buildLintRules(
    { quality: ['correctness'] },
    { rules: { [CORE_RULE]: CORE_SETTING, [EXTENSION]: EXTENSION_SETTING_OXLINT_REFUSES } },
  )

  it("is run by oxlint on JS files alone, with the core rule's setting, and never given the option it refuses", () => {
    expect({
      entries: oxlintRunningEntriesFor(bothNamed, [TS_FILE, JS_FILE]),
      givesTheRefusedOption: JSON.stringify(buildOxlintConfig(bothNamed, twinCatalog)).includes(REFUSED_OPTION),
    }).toStrictEqual({ entries: { [TS_FILE]: NOT_RUN, [JS_FILE]: CORE_SETTING }, givesTheRefusedOption: false })
  })

  it("is run by ESLint on TS files alone, as typescript-eslint's version with its setting, in the agent build's ESLint config", async () => {
    expect(await eslintRunningEntriesFor(bothNamed, [TS_FILE, JS_FILE])).toStrictEqual({
      [TS_FILE]: { core: NOT_RUN, extension: await extensionEntryAsEslintFillsIn(EXTENSION_SETTING_OXLINT_REFUSES) },
      [JS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
    })
  })
})

describe('a twin pair both of whose names an entry of ours states, the extension with an option oxlint refuses, over a ruleset shipping the core rule', () => {
  const eslintRunningEntriesFor = setUpEslintRunningEntries()
  const extensionEntryAsEslintFillsIn = setUpExtensionEntryAsEslintFillsIn()
  const bothNamedInAnEntry = buildLintRules(
    { quality: ['correctness'] },
    { fileOverrides: [buildFileOverride(['legacy/**'], { rules: { [CORE_RULE]: CORE_SETTING, [EXTENSION]: EXTENSION_SETTING_OXLINT_REFUSES } })] },
  )

  it("is run by oxlint everywhere but the entry's TS files, the core rule's setting on its JS files, and never given the option it refuses", () => {
    expect({
      entries: oxlintRunningEntriesFor(bothNamedInAnEntry, EVERY_FILE),
      givesTheRefusedOption: JSON.stringify(buildOxlintConfig(bothNamedInAnEntry, twinCatalog)).includes(REFUSED_OPTION),
    }).toStrictEqual({
      entries: {
        [LEGACY_TS_FILE]: NOT_RUN,
        [LEGACY_JS_FILE]: CORE_SETTING,
        [TS_FILE]: ['error', ...RULESET_OPTIONS],
        [JS_FILE]: ['error', ...RULESET_OPTIONS],
      },
      givesTheRefusedOption: false,
    })
  })

  it("is run by ESLint on the entry's TS files alone, as typescript-eslint's version with its setting", async () => {
    expect(await eslintRunningEntriesFor(bothNamedInAnEntry, EVERY_FILE)).toStrictEqual({
      [LEGACY_TS_FILE]: { core: NOT_RUN, extension: await extensionEntryAsEslintFillsIn(EXTENSION_SETTING_OXLINT_REFUSES) },
      [LEGACY_JS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
      [TS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
      [JS_FILE]: { core: NOT_RUN, extension: NOT_RUN },
    })
  })
})
