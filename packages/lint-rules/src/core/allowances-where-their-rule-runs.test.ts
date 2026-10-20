import type { AllowanceLeftTo, Catalog } from '@workspace/rule-data'
import { buildShippedRule } from '@workspace/rule-data/test-support/shipped-rule-factories'
import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { setUpEslintConfigOracle } from '../__tests__/eslint-config-oracle.ts'
import { buildCatalog, buildEslintRoute, buildLibsRuleset, buildPluginRegistry, buildQualityRuleset } from '../__tests__/factories/catalog-factories.ts'
import { buildFileOverride, buildLintRules, buildTwoSetFileOverride, buildTwoSetLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { lintRulesPackageVersion } from '../__tests__/factories/package-json-factories.ts'
import { buildProjectFacts } from '../__tests__/factories/project-facts-factories.ts'
import { NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG } from '../__tests__/team-configs-of-the-other-engine.ts'
import { buildEslintConfig } from './build-eslint-config.ts'
import { editorPartsOf } from './editor-parts.ts'
import type { RuleSettingsInput, RulesetsInput } from './lint-rules-input.ts'
import { mergeEslintPart } from './merge-eslint-config.ts'

// An options entry whose calls another rule reports stays in the holder's options only in the files that rule
// runs on: its shipped files, less its ignores, where its ruleset or the top-level rules turn it on. Everywhere
// else the holder runs, the entry is dropped, so the holder reports the call. ESLint's config for each file is
// read, so the tests hold however the layers carry the entry.

const HOLDER = '@typescript-eslint/no-floating-promises'
const QUERIES_RULE = 'testing-library/await-async-queries'
const EVENTS_RULE = 'testing-library/await-async-events'
const SAFE_CALLS = 'allowForKnownSafeCalls'
// Left to no other rule: kept wherever the holder runs.
const UNMARKED_ENTRY = { from: 'package', package: 'settle-helpers', name: 'settled' }
const QUERY_ENTRY = { from: 'package', package: '@testing-library/dom', name: ['findByText'] }
const EVENT_ENTRY = { from: 'package', package: '@testing-library/user-event', name: '__type' }
const EVERY_ENTRY = [UNMARKED_ENTRY, QUERY_ENTRY, EVENT_ENTRY]
const OUTSIDE_TEST_FILES = [UNMARKED_ENTRY]
const TEST_AND_STORY_FILES = ['**/*.test.ts', '**/*.stories.ts']
const STORY_FILES = ['**/*.stories.ts']
const CORRECTNESS = buildQualityRuleset('correctness')
const TESTING_LIBRARY = buildLibsRuleset('testing-library', 'testing')
const ERROR = 2
const WARN = 1
const TEST_FILE = 'src/button.test.ts'
const STORY_FILE = 'src/button.stories.ts'
const HELPER_FILE = 'src/render-helpers.ts'
const LEGACY_TEST_FILE = 'legacy/button.test.ts'
const LEGACY_HELPER_FILE = 'legacy/render-helpers.ts'
const LEGACY_FILES = 'legacy/**'
const WITH_TESTING_LIBRARY: Partial<RulesetsInput> = { quality: [CORRECTNESS.name], libs: { testing: [TESTING_LIBRARY.name] } }
const WITHOUT_TESTING_LIBRARY: Partial<RulesetsInput> = { quality: [CORRECTNESS.name] }
const DROPPING_TESTING_LIBRARY: Partial<RulesetsInput> = { libs: { testing: [] } }
const ADDING_TESTING_LIBRARY: Partial<RulesetsInput> = { libs: { testing: [TESTING_LIBRARY.name] } }
const OPTIONS_A_TEAM_WRITES = { [SAFE_CALLS]: [EVENT_ENTRY] }

/** Another key of the same options object, kept as shipped. */
function holderOptionsAllowing(entries: readonly unknown[]): readonly unknown[] {
  return [{ [SAFE_CALLS]: entries, ignoreVoid: true }]
}

function leftTo(entry: unknown, rule: string): AllowanceLeftTo {
  return { option: SAFE_CALLS, entry, rule }
}

// As the testing-library rules ship: the events rule runs in test files alone, the queries rule in story files too.
const CATALOG: Catalog = buildCatalog({
  rulesets: [CORRECTNESS, TESTING_LIBRARY],
  rules: [
    buildEslintRoute(HOLDER, {
      typed: true,
      shipped: buildShippedRule(CORRECTNESS.name, { options: holderOptionsAllowing(EVERY_ENTRY), allowancesLeftTo: [leftTo(QUERY_ENTRY, QUERIES_RULE), leftTo(EVENT_ENTRY, EVENTS_RULE)] }),
    }),
    buildEslintRoute(QUERIES_RULE, { typed: false, shipped: buildShippedRule(TESTING_LIBRARY.name, { files: TEST_AND_STORY_FILES }) }),
    buildEslintRoute(EVENTS_RULE, { typed: false, shipped: buildShippedRule(TESTING_LIBRARY.name, { files: TEST_AND_STORY_FILES, ignores: STORY_FILES }) }),
  ],
})
const PLUGIN_REGISTRY = buildPluginRegistry({ '@typescript-eslint': ['no-floating-promises'], 'testing-library': ['await-async-queries', 'await-async-events'] })

/** An entry for legacy/**: an empty `rulesets` keeps the top-level lists there. */
type LegacyEntry = { readonly rulesets: Partial<RulesetsInput>; readonly rules: RuleSettingsInput }

/** What a config lists and states: at the top level, and in an entry for legacy/**, where it gives one. */
type Listed = { readonly rulesets: Partial<RulesetsInput>; readonly rules?: RuleSettingsInput; readonly legacyEntry?: LegacyEntry }

/** A build as a test names it, and the ESLint config it gives for what is listed. */
type Build = { readonly build: string; readonly eslintConfigFor: (listed: Listed) => Linter.Config[] }

function agentBuildConfig({ rulesets, rules = {}, legacyEntry }: Listed): Linter.Config[] {
  const fileOverrides = legacyEntry === undefined ? [] : [buildFileOverride([LEGACY_FILES], legacyEntry)]
  return buildEslintConfig(buildLintRules(rulesets, { rules, fileOverrides }), CATALOG, PLUGIN_REGISTRY, buildProjectFacts())
}

function editorMergeConfig({ rulesets, rules = {}, legacyEntry }: Listed, usesOxlint: boolean): Linter.Config[] {
  const fileOverrides = legacyEntry === undefined ? [] : [buildTwoSetFileOverride([LEGACY_FILES], { editorRulesets: legacyEntry.rulesets, rules: legacyEntry.rules })]
  const { eslint } = editorPartsOf(buildTwoSetLintRules({ editorRulesets: rulesets }, { rules, fileOverrides }), CATALOG, usesOxlint)
  return mergeEslintPart([], eslint, CATALOG, PLUGIN_REGISTRY, lintRulesPackageVersion(), NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG)
}

const BUILDS: readonly Build[] = [
  { build: 'the agent build', eslintConfigFor: agentBuildConfig },
  {
    build: 'the ESLint merge, in a project listing oxlint',
    eslintConfigFor(listed) {
      return editorMergeConfig(listed, true)
    },
  },
  {
    build: 'the ESLint merge, in a project listing no oxlint',
    eslintConfigFor(listed) {
      return editorMergeConfig(listed, false)
    },
  },
]

function legacyEntryListing(rulesets: Partial<RulesetsInput>): LegacyEntry {
  return { rulesets, rules: {} }
}

function legacyEntryStating(rules: RuleSettingsInput): LegacyEntry {
  return { rulesets: {}, rules }
}

/** The holder's entry as ESLint calculates it, allowing the entries given. */
function holderEntry(entries: readonly unknown[], severity: number = ERROR): readonly unknown[] {
  return [severity, ...holderOptionsAllowing(entries)]
}

describe.each(BUILDS)('an options entry whose calls a rule run on some files reports, in $build', ({ eslintConfigFor }) => {
  const { ruleEntryFor } = setUpEslintConfigOracle()

  /** The holder's entry in each file given, by file. */
  async function holderEntriesIn(listed: Listed, files: readonly string[]): Promise<Readonly<Record<string, unknown>>> {
    const config = eslintConfigFor(listed)
    return Object.fromEntries(await Promise.all(files.map(async (file) => [file, await ruleEntryFor(config, file, HOLDER)] as const)))
  }

  describe('at the top level', () => {
    it("keeps it in the files its rule runs on, and drops it in the holder's other files, where its rule's ruleset is listed", async () => {
      expect(await holderEntriesIn({ rulesets: WITH_TESTING_LIBRARY }, [TEST_FILE, STORY_FILE, HELPER_FILE])).toStrictEqual({
        [TEST_FILE]: holderEntry(EVERY_ENTRY),
        [STORY_FILE]: holderEntry([UNMARKED_ENTRY, QUERY_ENTRY]),
        [HELPER_FILE]: holderEntry(OUTSIDE_TEST_FILES),
      })
    })

    it("drops it in every file where its rule's ruleset is not listed", async () => {
      expect(await holderEntriesIn({ rulesets: WITHOUT_TESTING_LIBRARY }, [TEST_FILE, STORY_FILE, HELPER_FILE])).toStrictEqual({
        [TEST_FILE]: holderEntry(OUTSIDE_TEST_FILES),
        [STORY_FILE]: holderEntry(OUTSIDE_TEST_FILES),
        [HELPER_FILE]: holderEntry(OUTSIDE_TEST_FILES),
      })
    })

    it("keeps it only in its rule's shipped files, less its ignores, where the top-level rules turn that rule on at warn, its ruleset not listed", async () => {
      expect(await holderEntriesIn({ rulesets: WITHOUT_TESTING_LIBRARY, rules: { [EVENTS_RULE]: 'warn' } }, [TEST_FILE, STORY_FILE, HELPER_FILE])).toStrictEqual({
        [TEST_FILE]: holderEntry([UNMARKED_ENTRY, EVENT_ENTRY]),
        [STORY_FILE]: holderEntry(OUTSIDE_TEST_FILES),
        [HELPER_FILE]: holderEntry(OUTSIDE_TEST_FILES),
      })
    })

    // Each entry follows its own rule: the other entry stays where its rule still runs.
    it('drops only the entry left to the rule the top-level rules turn off, its ruleset listed', async () => {
      expect(await holderEntriesIn({ rulesets: WITH_TESTING_LIBRARY, rules: { [QUERIES_RULE]: 'off' } }, [TEST_FILE, STORY_FILE, HELPER_FILE])).toStrictEqual({
        [TEST_FILE]: holderEntry([UNMARKED_ENTRY, EVENT_ENTRY]),
        [STORY_FILE]: holderEntry(OUTSIDE_TEST_FILES),
        [HELPER_FILE]: holderEntry(OUTSIDE_TEST_FILES),
      })
    })

    it('uses the options the top-level rules write for the holder as written, in every file', async () => {
      expect(await holderEntriesIn({ rulesets: WITH_TESTING_LIBRARY, rules: { [HOLDER]: ['error', OPTIONS_A_TEAM_WRITES] } }, [TEST_FILE, STORY_FILE, HELPER_FILE])).toStrictEqual({
        [TEST_FILE]: [ERROR, OPTIONS_A_TEAM_WRITES],
        [STORY_FILE]: [ERROR, OPTIONS_A_TEAM_WRITES],
        [HELPER_FILE]: [ERROR, OPTIONS_A_TEAM_WRITES],
      })
    })

    it('gives a severity alone in the top-level rules the options in force in each file', async () => {
      expect(await holderEntriesIn({ rulesets: WITH_TESTING_LIBRARY, rules: { [HOLDER]: 'warn' } }, [TEST_FILE, STORY_FILE, HELPER_FILE])).toStrictEqual({
        [TEST_FILE]: holderEntry(EVERY_ENTRY, WARN),
        [STORY_FILE]: holderEntry([UNMARKED_ENTRY, QUERY_ENTRY], WARN),
        [HELPER_FILE]: holderEntry(OUTSIDE_TEST_FILES, WARN),
      })
    })
  })

  describe('in an entry', () => {
    it("drops it in the entry's files where its lists drop the rule's ruleset, keeping it in the test files outside them alone", async () => {
      expect(await holderEntriesIn({ rulesets: WITH_TESTING_LIBRARY, legacyEntry: legacyEntryListing(DROPPING_TESTING_LIBRARY) }, [LEGACY_TEST_FILE, TEST_FILE, HELPER_FILE])).toStrictEqual({
        [LEGACY_TEST_FILE]: holderEntry(OUTSIDE_TEST_FILES),
        [TEST_FILE]: holderEntry(EVERY_ENTRY),
        [HELPER_FILE]: holderEntry(OUTSIDE_TEST_FILES),
      })
    })

    it("keeps it in the test files among the entry's files where its lists add the rule's ruleset, and nowhere else", async () => {
      expect(await holderEntriesIn({ rulesets: WITHOUT_TESTING_LIBRARY, legacyEntry: legacyEntryListing(ADDING_TESTING_LIBRARY) }, [LEGACY_TEST_FILE, LEGACY_HELPER_FILE, TEST_FILE])).toStrictEqual({
        [LEGACY_TEST_FILE]: holderEntry(EVERY_ENTRY),
        [LEGACY_HELPER_FILE]: holderEntry(OUTSIDE_TEST_FILES),
        [TEST_FILE]: holderEntry(OUTSIDE_TEST_FILES),
      })
    })

    it("gives a severity alone in an entry's own rules the options in force in each of its files", async () => {
      expect(await holderEntriesIn({ rulesets: WITH_TESTING_LIBRARY, legacyEntry: legacyEntryStating({ [HOLDER]: 'warn' }) }, [LEGACY_TEST_FILE, LEGACY_HELPER_FILE])).toStrictEqual({
        [LEGACY_TEST_FILE]: holderEntry(EVERY_ENTRY, WARN),
        [LEGACY_HELPER_FILE]: holderEntry(OUTSIDE_TEST_FILES, WARN),
      })
    })
  })
})
